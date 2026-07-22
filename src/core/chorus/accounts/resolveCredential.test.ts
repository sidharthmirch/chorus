import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNineRouterApiKey, setNineRouterApiKey } from "../api/AppMetadataAPI";
import { NineRouterConnection } from "./nineRouterClient";
import {
    ensureNineRouterApiKey,
    mapToNineRouterUpstreamModelId,
    resolveNineRouterCredential,
} from "./resolveCredential";

vi.mock("../api/AppMetadataAPI", () => ({
    getNineRouterApiKey: vi.fn(),
    setNineRouterApiKey: vi.fn(),
}));

function fakeConnection(
    overrides: Partial<NineRouterConnection>,
): NineRouterConnection {
    return {
        id: "c1",
        provider: "claude",
        authType: "oauth",
        isActive: true,
        ...overrides,
    };
}

function fakeClient(overrides: {
    healthCheck?: () => Promise<boolean>;
    listConnections?: () => Promise<NineRouterConnection[]>;
    createApiKey?: () => Promise<{ key: string; id: string; name: string }>;
}) {
    return {
        healthCheck: overrides.healthCheck ?? (() => Promise.resolve(true)),
        listConnections: overrides.listConnections ?? (() => Promise.resolve([])),
        createApiKey:
            overrides.createApiKey ??
            (() => Promise.resolve({ key: "sk-new", id: "k1", name: "chorus" })),
    };
}

describe("mapToNineRouterUpstreamModelId", () => {
    it("returns the verified mapping for a known model", () => {
        expect(
            mapToNineRouterUpstreamModelId("anthropic", "claude-haiku-4-5-20251001"),
        ).toBe("claude-haiku-4-5-20251001");
        expect(mapToNineRouterUpstreamModelId("google", "gemini-2.5-flash")).toBe(
            "gemini-2.5-flash",
        );
    });

    it("returns undefined for a model with no verified mapping", () => {
        expect(
            mapToNineRouterUpstreamModelId("anthropic", "claude-sonnet-4-5-20250929"),
        ).toBeUndefined();
        expect(mapToNineRouterUpstreamModelId("openai", "gpt-5")).toBeUndefined();
    });
});

describe("ensureNineRouterApiKey", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the cached key without creating a new one", async () => {
        vi.mocked(getNineRouterApiKey).mockResolvedValue("sk-cached");
        const createApiKey = vi.fn();
        const key = await ensureNineRouterApiKey(fakeClient({ createApiKey }));
        expect(key).toBe("sk-cached");
        expect(createApiKey).not.toHaveBeenCalled();
    });

    it("creates and persists a new key when none is cached", async () => {
        vi.mocked(getNineRouterApiKey).mockResolvedValue(undefined);
        const key = await ensureNineRouterApiKey(fakeClient({}));
        expect(key).toBe("sk-new");
        expect(setNineRouterApiKey).toHaveBeenCalledWith("sk-new");
    });
});

describe("resolveNineRouterCredential", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getNineRouterApiKey).mockResolvedValue("sk-cached");
    });

    it("returns undefined for providers with no 9router oauth mapping", async () => {
        const result = await resolveNineRouterCredential(
            "openrouter",
            "anything",
            fakeClient({}),
        );
        expect(result).toBeUndefined();
    });

    it("returns undefined when there is no verified model mapping", async () => {
        const result = await resolveNineRouterCredential(
            "anthropic",
            "claude-sonnet-4-5-20250929", // real Chorus model, no 9router mapping
            fakeClient({
                listConnections: () =>
                    Promise.resolve([fakeConnection({ provider: "claude" })]),
            }),
        );
        expect(result).toBeUndefined();
    });

    it("returns undefined when 9router isn't running", async () => {
        const result = await resolveNineRouterCredential(
            "anthropic",
            "claude-haiku-4-5-20251001",
            fakeClient({ healthCheck: () => Promise.resolve(false) }),
        );
        expect(result).toBeUndefined();
    });

    it("returns undefined when there is no active connection for the provider", async () => {
        const result = await resolveNineRouterCredential(
            "anthropic",
            "claude-haiku-4-5-20251001",
            fakeClient({
                listConnections: () =>
                    Promise.resolve([fakeConnection({ provider: "codex" })]),
            }),
        );
        expect(result).toBeUndefined();
    });

    it("resolves a full credential when everything lines up", async () => {
        const result = await resolveNineRouterCredential(
            "anthropic",
            "claude-haiku-4-5-20251001",
            fakeClient({
                listConnections: () =>
                    Promise.resolve([fakeConnection({ provider: "claude" })]),
            }),
        );
        expect(result).toEqual({
            baseUrl: "http://localhost:20128",
            apiKey: "sk-cached",
            model: "cc/claude-haiku-4-5-20251001",
        });
    });

    it("resolves for google with its verified model mapping", async () => {
        const result = await resolveNineRouterCredential(
            "google",
            "gemini-2.5-flash-lite",
            fakeClient({
                listConnections: () =>
                    Promise.resolve([fakeConnection({ provider: "gemini-cli" })]),
            }),
        );
        expect(result).toEqual({
            baseUrl: "http://localhost:20128",
            apiKey: "sk-cached",
            model: "gc/gemini-2.5-flash-lite",
        });
    });

    it("returns undefined (not a thrown error) when listConnections fails", async () => {
        const result = await resolveNineRouterCredential(
            "anthropic",
            "claude-haiku-4-5-20251001",
            fakeClient({
                listConnections: () => Promise.reject(new Error("network down")),
            }),
        );
        expect(result).toBeUndefined();
    });
});
