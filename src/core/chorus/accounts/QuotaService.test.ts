import { describe, expect, it } from "vitest";
import { NineRouterConnection, NineRouterUsageResult } from "./nineRouterClient";
import { deriveProviderAccountFromNineRouter, deriveQuotaSnapshot } from "./QuotaService";

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
    getUsage?: () => Promise<NineRouterUsageResult>;
}) {
    return {
        healthCheck: overrides.healthCheck ?? (() => Promise.resolve(true)),
        listConnections: overrides.listConnections ?? (() => Promise.resolve([])),
        getUsage: overrides.getUsage ?? (() => Promise.resolve({})),
    };
}

describe("deriveQuotaSnapshot", () => {
    it("returns undefined when there is no quotas map", () => {
        expect(deriveQuotaSnapshot({ message: "connected, no quota yet" })).toBeUndefined();
    });

    it("returns undefined when quotas is an empty object", () => {
        expect(deriveQuotaSnapshot({ quotas: {} })).toBeUndefined();
    });

    it("prefers a window named 'session' over others (Claude convention)", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: {
                "weekly (7d)": { used: 10, total: 100 },
                "session (5h)": { used: 62, total: 100 },
            },
        });
        expect(snapshot?.usedFraction).toBe(0.62);
    });

    it("treats used as a 0-100 percentage when total is 100", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: { only: { used: 84, total: 100 } },
        });
        expect(snapshot?.usedFraction).toBe(0.84);
        expect(snapshot?.level).toBe("warn");
    });

    it("divides used/total as raw counts when total isn't 100 (GitHub convention)", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: { chat: { used: 30, total: 50 } },
        });
        expect(snapshot?.usedFraction).toBe(0.6);
    });

    it("treats unlimited windows as 0% used", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: { chat: { used: 999, total: 0, unlimited: true } },
        });
        expect(snapshot?.usedFraction).toBe(0);
    });

    it("guards against a total of 0 without unlimited set", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: { chat: { used: 5, total: 0 } },
        });
        expect(snapshot?.usedFraction).toBe(0);
    });

    it("picks the window with the soonest resetAt when none is named 'session'", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: {
                far: { used: 10, total: 100, resetAt: "2026-08-01T00:00:00Z" },
                near: { used: 20, total: 100, resetAt: "2026-07-21T18:00:00Z" },
            },
        });
        expect(snapshot?.usedFraction).toBe(0.2);
    });

    it("parses resetAt into a Date on the resulting snapshot", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: { session: { used: 10, total: 100, resetAt: "2026-07-21T18:00:00Z" } },
        });
        expect(snapshot?.resetsAt).toEqual(new Date("2026-07-21T18:00:00Z"));
    });

    it("ignores an unparseable resetAt rather than throwing", () => {
        const snapshot = deriveQuotaSnapshot({
            quotas: { session: { used: 10, total: 100, resetAt: "not-a-date" } },
        });
        expect(snapshot?.resetsAt).toBeUndefined();
    });
});

describe("deriveProviderAccountFromNineRouter", () => {
    it("returns undefined for providers with no 9router oauth mapping", async () => {
        const result = await deriveProviderAccountFromNineRouter(
            "openrouter",
            fakeClient({}),
        );
        expect(result).toBeUndefined();
    });

    it("returns undefined when 9router isn't running", async () => {
        const result = await deriveProviderAccountFromNineRouter(
            "anthropic",
            fakeClient({ healthCheck: () => Promise.resolve(false) }),
        );
        expect(result).toBeUndefined();
    });

    it("returns not-configured when running but no active connection exists", async () => {
        const result = await deriveProviderAccountFromNineRouter(
            "anthropic",
            fakeClient({ listConnections: () => Promise.resolve([]) }),
        );
        expect(result).toEqual({ status: "not-configured" });
    });

    it("returns error when the connection has a lastError", async () => {
        const result = await deriveProviderAccountFromNineRouter(
            "anthropic",
            fakeClient({
                listConnections: () =>
                    Promise.resolve([
                        fakeConnection({ provider: "claude", lastError: "refresh failed" }),
                    ]),
            }),
        );
        expect(result).toEqual({ status: "error", accountEmail: undefined });
    });

    it("returns connected + quota on the happy path", async () => {
        const result = await deriveProviderAccountFromNineRouter(
            "anthropic",
            fakeClient({
                listConnections: () =>
                    Promise.resolve([
                        fakeConnection({ provider: "claude", email: "you@example.com" }),
                    ]),
                getUsage: () =>
                    Promise.resolve({
                        quotas: { "session (5h)": { used: 62, total: 100 } },
                    }),
            }),
        );
        expect(result?.status).toBe("connected");
        expect(result?.accountEmail).toBe("you@example.com");
        expect(result?.quota?.usedFraction).toBe(0.62);
    });

    it("returns connected without quota when the usage fetch itself fails", async () => {
        const result = await deriveProviderAccountFromNineRouter(
            "anthropic",
            fakeClient({
                listConnections: () =>
                    Promise.resolve([fakeConnection({ provider: "claude" })]),
                getUsage: () => Promise.reject(new Error("rate limited")),
            }),
        );
        expect(result).toEqual({ status: "connected", accountEmail: undefined });
    });
});
