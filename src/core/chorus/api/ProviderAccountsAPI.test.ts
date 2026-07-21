import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveProviderAccountFromNineRouter } from "../accounts/QuotaService";
import {
    __resetProviderAccountsStubForTests,
    fetchProviderAccount,
    fetchProviderAccounts,
    forceRefreshProviderAccountQuota,
    stubConnectProviderAccount,
    stubDisconnectProviderAccount,
    stubRefreshProviderAccountQuota,
} from "./ProviderAccountsAPI";

// ProviderAccountsAPI.ts now touches `db` (P6's SQLite cache) and
// QuotaService (P6's 9router derivation). Both are mocked so these tests
// run without a real Tauri/SQLite runtime and without a live 9router:
// - `db` defaults to "no cached rows" (select -> []), so the P6 merge logic
//   falls back to the in-memory stub exactly like pre-P6 behavior unless a
//   test explicitly seeds a cached row.
// - QuotaService's derive function defaults to `undefined` ("9router not
//   reachable"), same reasoning.
// vi.mock factories are hoisted above all imports/top-level statements, so
// dbMock must be created via vi.hoisted() rather than a plain `const` —
// referencing an ordinary outer-scope const here throws
// "Cannot access before initialization" at hoist time.
const dbMock = vi.hoisted(() => ({ select: vi.fn(), execute: vi.fn() }));
vi.mock("../DB", () => ({ db: dbMock }));

vi.mock("../accounts/QuotaService", () => ({
    deriveProviderAccountFromNineRouter: vi.fn(),
}));

describe("ProviderAccountsAPI stub store (9router unreachable / no cache)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbMock.select.mockResolvedValue([]);
        dbMock.execute.mockResolvedValue(undefined);
        vi.mocked(deriveProviderAccountFromNineRouter).mockResolvedValue(
            undefined,
        );
        __resetProviderAccountsStubForTests();
    });

    it("seeds every known provider as not-configured", async () => {
        const accounts = await fetchProviderAccounts();
        expect(accounts.map((a) => a.providerId).sort()).toEqual([
            "anthropic",
            "copilot",
            "google",
            "local",
            "openai",
            "openrouter",
        ]);
        expect(accounts.every((a) => a.status === "not-configured")).toBe(
            true,
        );
    });

    it("connect marks an oauth provider connected with a quota snapshot", async () => {
        const updated = await stubConnectProviderAccount("anthropic");
        expect(updated.status).toBe("connected");
        expect(updated.accountEmail).toBeDefined();
        expect(updated.quota).toBeDefined();
        expect(updated.quota?.level).toBe("ok");

        const refetched = await fetchProviderAccount("anthropic");
        expect(refetched?.status).toBe("connected");
    });

    it("connect on an api-key provider does not fabricate a quota", async () => {
        const updated = await stubConnectProviderAccount("openrouter");
        expect(updated.status).toBe("connected");
        expect(updated.quota).toBeUndefined();
    });

    it("disconnect resets status, email, and quota", async () => {
        await stubConnectProviderAccount("anthropic");
        const disconnected = await stubDisconnectProviderAccount("anthropic");
        expect(disconnected.status).toBe("not-configured");
        expect(disconnected.accountEmail).toBeUndefined();
        expect(disconnected.quota).toBeUndefined();
    });

    it("connect/disconnect only touches the targeted provider", async () => {
        await stubConnectProviderAccount("anthropic");
        const accounts = await fetchProviderAccounts();
        const others = accounts.filter((a) => a.providerId !== "anthropic");
        expect(others.every((a) => a.status === "not-configured")).toBe(true);
    });

    it("refresh returns undefined for a not-configured provider", async () => {
        const quota = await stubRefreshProviderAccountQuota("openai");
        expect(quota).toBeUndefined();
    });

    it("refresh returns the current quota for a connected provider", async () => {
        await stubConnectProviderAccount("anthropic");
        const quota = await stubRefreshProviderAccountQuota("anthropic");
        expect(quota).toBeDefined();
        expect(quota?.usedFraction).toBeGreaterThan(0);
    });
});

describe("ProviderAccountsAPI 9router-derived merge (P6)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbMock.select.mockResolvedValue([]);
        dbMock.execute.mockResolvedValue(undefined);
        __resetProviderAccountsStubForTests();
    });

    it("never queries QuotaService for providers with no 9router mapping", async () => {
        vi.mocked(deriveProviderAccountFromNineRouter).mockResolvedValue({
            status: "connected",
        });
        await fetchProviderAccounts();
        const calledProviders = vi
            .mocked(deriveProviderAccountFromNineRouter)
            .mock.calls.map(([providerId]) => providerId);
        expect(calledProviders).not.toContain("openrouter");
        expect(calledProviders).not.toContain("local");
    });

    it("derives live status+quota for oauth providers when 9router is reachable", async () => {
        vi.mocked(deriveProviderAccountFromNineRouter).mockImplementation(
            (providerId) =>
                Promise.resolve(
                    providerId === "anthropic"
                        ? {
                              status: "connected" as const,
                              accountEmail: "you@example.com",
                          }
                        : { status: "not-configured" as const },
                ),
        );

        const accounts = await fetchProviderAccounts();
        const anthropic = accounts.find((a) => a.providerId === "anthropic");
        expect(anthropic?.status).toBe("connected");
        expect(anthropic?.accountEmail).toBe("you@example.com");
        // Persisted to the cache table.
        expect(dbMock.execute).toHaveBeenCalled();
    });

    it("uses a fresh cached row without re-querying QuotaService", async () => {
        dbMock.select.mockResolvedValue([
            {
                provider_id: "anthropic",
                auth_kind: "oauth",
                label: "oauth · Anthropic",
                account_email: "cached@example.com",
                status: "connected",
                quota_json: null,
                updated_at: new Date().toISOString().replace("Z", ""),
            },
        ]);

        const accounts = await fetchProviderAccounts();
        const anthropic = accounts.find((a) => a.providerId === "anthropic");
        expect(anthropic?.accountEmail).toBe("cached@example.com");
        // The sweep still derives the other 3 oauth providers (no cached row
        // for them) — only anthropic's fresh cache should skip re-deriving.
        expect(deriveProviderAccountFromNineRouter).not.toHaveBeenCalledWith(
            "anthropic",
        );
    });

    it("re-derives when the cached row is stale", async () => {
        const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000)
            .toISOString()
            .replace("Z", "");
        dbMock.select.mockResolvedValue([
            {
                provider_id: "anthropic",
                auth_kind: "oauth",
                label: "oauth · Anthropic",
                account_email: "stale@example.com",
                status: "connected",
                quota_json: null,
                updated_at: staleTimestamp,
            },
        ]);
        vi.mocked(deriveProviderAccountFromNineRouter).mockResolvedValue({
            status: "connected",
            accountEmail: "fresh@example.com",
        });

        const accounts = await fetchProviderAccounts();
        const anthropic = accounts.find((a) => a.providerId === "anthropic");
        expect(anthropic?.accountEmail).toBe("fresh@example.com");
    });

    it("falls back to the cached row when 9router becomes unreachable mid-session", async () => {
        dbMock.select.mockResolvedValue([
            {
                provider_id: "anthropic",
                auth_kind: "oauth",
                label: "oauth · Anthropic",
                account_email: "cached@example.com",
                status: "connected",
                quota_json: null,
                updated_at: new Date(Date.now() - 10 * 60 * 1000)
                    .toISOString()
                    .replace("Z", ""),
            },
        ]);
        vi.mocked(deriveProviderAccountFromNineRouter).mockResolvedValue(
            undefined,
        );

        const accounts = await fetchProviderAccounts();
        const anthropic = accounts.find((a) => a.providerId === "anthropic");
        expect(anthropic?.accountEmail).toBe("cached@example.com");
    });

    it("forceRefreshProviderAccountQuota bypasses the freshness gate for oauth providers", async () => {
        dbMock.select.mockResolvedValue([
            {
                provider_id: "anthropic",
                auth_kind: "oauth",
                label: "oauth · Anthropic",
                account_email: "cached@example.com",
                status: "connected",
                quota_json: JSON.stringify({ usedFraction: 0.5 }),
                updated_at: new Date().toISOString().replace("Z", ""), // fresh
            },
        ]);
        vi.mocked(deriveProviderAccountFromNineRouter).mockResolvedValue({
            status: "connected",
            quota: { usedFraction: 0.91, level: "warn" },
        });

        const quota = await forceRefreshProviderAccountQuota("anthropic");
        expect(quota?.usedFraction).toBe(0.91);
        expect(deriveProviderAccountFromNineRouter).toHaveBeenCalled();
    });

    it("forceRefreshProviderAccountQuota falls back to the stub for providers with no 9router mapping", async () => {
        await stubConnectProviderAccount("openrouter");
        const quota = await forceRefreshProviderAccountQuota("openrouter");
        // getNineRouterProviderRef("openrouter") is undefined, so the
        // force-refresh path itself never derives "openrouter" specifically
        // (the fallback stub read still sweeps the other 4 oauth providers
        // as part of fetchProviderAccounts — that's unrelated, correct
        // behavior, not what this test is checking).
        expect(deriveProviderAccountFromNineRouter).not.toHaveBeenCalledWith(
            "openrouter",
        );
        expect(quota).toBeUndefined(); // openrouter never gets a fabricated quota
    });
});
