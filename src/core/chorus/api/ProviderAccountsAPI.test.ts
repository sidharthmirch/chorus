import { beforeEach, describe, expect, it } from "vitest";
import {
    __resetProviderAccountsStubForTests,
    fetchProviderAccount,
    fetchProviderAccounts,
    stubConnectProviderAccount,
    stubDisconnectProviderAccount,
    stubRefreshProviderAccountQuota,
} from "./ProviderAccountsAPI";

describe("ProviderAccountsAPI stub store", () => {
    beforeEach(() => {
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
