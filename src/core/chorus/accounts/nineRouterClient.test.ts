import { describe, expect, it, vi } from "vitest";
import {
    NineRouterClient,
    NineRouterConnection,
    NineRouterError,
    buildNineRouterModelId,
    findActiveConnectionForProvider,
    getNineRouterProviderRef,
} from "./nineRouterClient";

function jsonResponse(body: unknown, status = 200): Response {
    // Test-only stub covering just the subset of Response the client reads
    // (ok/status/json()) — narrowing to the real DOM type here rather than
    // hand-rolling every unused Response member (headers, body, clone, ...).
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe("getNineRouterProviderRef", () => {
    it("maps the four oauth-capable Chorus providers to 9router ids/aliases", () => {
        expect(getNineRouterProviderRef("anthropic")).toEqual({
            id: "claude",
            alias: "cc",
        });
        expect(getNineRouterProviderRef("openai")).toEqual({
            id: "codex",
            alias: "cx",
        });
        expect(getNineRouterProviderRef("google")).toEqual({
            id: "gemini-cli",
            alias: "gc",
        });
        expect(getNineRouterProviderRef("copilot")).toEqual({
            id: "github",
            alias: "gh",
        });
    });

    it("has no entry for auth kinds that don't go through 9router", () => {
        expect(getNineRouterProviderRef("openrouter")).toBeUndefined();
        expect(getNineRouterProviderRef("local")).toBeUndefined();
    });
});

describe("buildNineRouterModelId", () => {
    it("joins alias and upstream model id with a slash", () => {
        expect(buildNineRouterModelId("cc", "claude-sonnet-5")).toBe(
            "cc/claude-sonnet-5",
        );
    });
});

describe("findActiveConnectionForProvider", () => {
    const base: NineRouterConnection = {
        id: "a",
        provider: "claude",
        authType: "oauth",
        isActive: true,
    };

    it("returns undefined when no connection matches the provider", () => {
        expect(findActiveConnectionForProvider([base], "codex")).toBeUndefined();
    });

    it("ignores inactive connections", () => {
        const inactive = { ...base, isActive: false };
        expect(
            findActiveConnectionForProvider([inactive], "claude"),
        ).toBeUndefined();
    });

    it("picks the most recently updated connection when several are active", () => {
        const older = { ...base, id: "old", updatedAt: "2026-01-01T00:00:00Z" };
        const newer = { ...base, id: "new", updatedAt: "2026-06-01T00:00:00Z" };
        const result = findActiveConnectionForProvider([older, newer], "claude");
        expect(result?.id).toBe("new");
    });
});

describe("NineRouterClient", () => {
    it("healthCheck returns true when /api/health responds ok:true", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await expect(client.healthCheck()).resolves.toBe(true);
        expect(fetchImpl).toHaveBeenCalledWith(
            "http://localhost:20128/api/health",
            expect.objectContaining({ method: "GET" }),
        );
    });

    it("healthCheck returns false when the request throws (9router not running)", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await expect(client.healthCheck()).resolves.toBe(false);
    });

    it("healthCheck returns false on a non-2xx response instead of throwing", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ error: "nope" }, 500));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await expect(client.healthCheck()).resolves.toBe(false);
    });

    it("listConnections parses and drops malformed entries", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                connections: [
                    {
                        id: "c1",
                        provider: "claude",
                        authType: "oauth",
                        isActive: true,
                        email: "you@example.com",
                    },
                    { id: "missing-fields" }, // malformed — dropped
                    {
                        id: "c2",
                        provider: "codex",
                        authType: "bogus-auth-kind", // unknown authType — dropped
                        isActive: true,
                    },
                ],
            }),
        );
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const connections = await client.listConnections();
        expect(connections).toHaveLength(1);
        expect(connections[0]).toMatchObject({
            id: "c1",
            provider: "claude",
            email: "you@example.com",
        });
    });

    it("getAuthorizeUrl throws a NineRouterError when the response has no url", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await expect(
            client.getAuthorizeUrl("claude", "http://127.0.0.1:8080/callback"),
        ).rejects.toBeInstanceOf(NineRouterError);
    });

    it("getAuthorizeUrl returns the pkce fields on success", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                url: "https://provider.example/authorize?...",
                state: "s1",
                codeVerifier: "v1",
                codeChallenge: "ch1",
            }),
        );
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const result = await client.getAuthorizeUrl(
            "claude",
            "http://127.0.0.1:8080/callback",
        );
        expect(result).toEqual({
            url: "https://provider.example/authorize?...",
            state: "s1",
            codeVerifier: "v1",
            codeChallenge: "ch1",
        });
    });

    it("exchangeCode surfaces success + connection on the happy path", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                success: true,
                connection: { id: "c1", provider: "claude", email: "you@example.com" },
            }),
        );
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const result = await client.exchangeCode("claude", {
            code: "abc",
            redirectUri: "http://127.0.0.1:8080/callback",
            codeVerifier: "v1",
            state: "s1",
        });
        expect(result.success).toBe(true);
        expect(result.connection).toEqual({
            id: "c1",
            provider: "claude",
            email: "you@example.com",
            displayName: undefined,
        });
        expect(fetchImpl).toHaveBeenCalledWith(
            "http://localhost:20128/api/oauth/claude/exchange",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("exchangeCode surfaces failure without a connection", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ success: false, error: "denied" }));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const result = await client.exchangeCode("claude", {
            code: "abc",
            redirectUri: "http://127.0.0.1:8080/callback",
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe("denied");
        expect(result.connection).toBeUndefined();
    });

    it("getUsage parses per-window quota data and drops malformed windows", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                plan: "Claude Code",
                quotas: {
                    "session (5h)": { used: 62, total: 100, resetAt: "2026-07-21T17:30:00Z" },
                    broken: { used: "not-a-number" },
                },
            }),
        );
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const usage = await client.getUsage("c1");
        expect(usage.plan).toBe("Claude Code");
        expect(usage.quotas).toEqual({
            "session (5h)": {
                used: 62,
                total: 100,
                remaining: undefined,
                remainingPercentage: undefined,
                resetAt: "2026-07-21T17:30:00Z",
                unlimited: false,
            },
        });
    });

    it("getUsage returns just a message when quota isn't available yet", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ message: "connected, no quota yet" }));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const usage = await client.getUsage("c1");
        expect(usage).toEqual({
            plan: undefined,
            message: "connected, no quota yet",
            quotas: undefined,
        });
    });

    it("createApiKey throws NineRouterError when the response is missing the key", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ id: "k1", name: "chorus" }));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await expect(client.createApiKey("chorus")).rejects.toBeInstanceOf(
            NineRouterError,
        );
    });

    it("createApiKey returns the plaintext key on success", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({ key: "sk-abc", id: "k1", name: "chorus" }),
        );
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        const result = await client.createApiKey("chorus");
        expect(result).toEqual({
            key: "sk-abc",
            id: "k1",
            name: "chorus",
            machineId: undefined,
        });
    });

    it("deleteConnection issues a DELETE to /api/providers/:id", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "ok" }));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await client.deleteConnection("c1");
        expect(fetchImpl).toHaveBeenCalledWith(
            "http://localhost:20128/api/providers/c1",
            expect.objectContaining({ method: "DELETE" }),
        );
    });

    it("wraps a non-2xx response into a NineRouterError with the status attached", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ error: "Connection not found" }, 404));
        const client = new NineRouterClient("http://localhost:20128", fetchImpl);
        await expect(client.deleteConnection("missing")).rejects.toMatchObject({
            message: "Connection not found",
            status: 404,
        });
    });
});
