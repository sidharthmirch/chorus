import { describe, expect, it } from "vitest";
import { IProviderAccount, makeQuotaSnapshot } from "../accounts/ProviderAccounts";
import { accountViaInfo, legacyViaInfo } from "./ModelAccountView";

// NOTE: this tests `ModelAccountView.ts` (the pure half) rather than
// `deriveModelViaInfo`/`useModelViaInfo` in `ModelAccountAPI.ts` (the hook
// glue) directly, because the glue file runtime-imports `Models.ts`, which
// transitively reaches `DB.ts`'s top-level `await Database.load(...)` and
// throws under this repo's vitest setup (no `window`). See
// `ModelAccountView.ts`'s file header and `docs/rework/w4-model-select-inventory.md`
// §4. `accountViaInfo`/`legacyViaInfo` carry the real formatting-rule
// coverage; `deriveModelViaInfo` is a thin, untested lookup on top of them
// (same convention as `ProviderAccountsAPI.ts` sitting untested on top of
// the tested `ProviderAccounts.ts`).

function account(
    partial: Partial<IProviderAccount> &
        Pick<IProviderAccount, "providerId" | "authKind" | "status" | "label">,
): IProviderAccount {
    return partial;
}

describe("accountViaInfo", () => {
    it("passes through live quota for a connected oauth provider, no fabricated tier suffix", () => {
        const info = accountViaInfo(
            account({
                providerId: "anthropic",
                authKind: "oauth",
                status: "connected",
                label: "oauth · Anthropic",
                quota: makeQuotaSnapshot(0.62, new Date("2026-07-21T18:00:00Z")),
            }),
            "anthropic",
        );
        expect(info.label).toBe("anthropic oauth");
        expect(info.quota?.usedFraction).toBe(0.62);
        expect(info.quotaText).toBeUndefined();
    });

    it("adds a status suffix (not a fabricated tier) when not connected", () => {
        const info = accountViaInfo(
            account({
                providerId: "anthropic",
                authKind: "oauth",
                status: "not-configured",
                label: "oauth · Anthropic",
            }),
            "anthropic",
        );
        expect(info.label).toBe("anthropic oauth · not connected");
        expect(info.quota).toBeUndefined();
    });

    it("maps needs-auth/expired to a reauthorize suffix", () => {
        expect(
            accountViaInfo(
                account({
                    providerId: "openai",
                    authKind: "oauth",
                    status: "expired",
                    label: "oauth · OpenAI",
                }),
                "openai",
            ).label,
        ).toBe("openai oauth · reauthorize");
        expect(
            accountViaInfo(
                account({
                    providerId: "openai",
                    authKind: "oauth",
                    status: "needs-auth",
                    label: "oauth · OpenAI",
                }),
                "openai",
            ).label,
        ).toBe("openai oauth · reauthorize");
    });

    it("renders a textual 'local' quota state for none-local accounts", () => {
        const info = accountViaInfo(
            account({
                providerId: "local",
                authKind: "none-local",
                status: "connected",
                label: "ollama · local",
            }),
            "ollama",
        );
        expect(info.label).toBe("ollama local");
        expect(info.quotaText).toBe("local");
        expect(info.quota).toBeUndefined();
    });

    it("renders 'pay/use' for a connected api-key provider instead of a fabricated balance", () => {
        const info = accountViaInfo(
            account({
                providerId: "openrouter",
                authKind: "api-key",
                status: "connected",
                label: "api key",
            }),
            "openrouter",
        );
        expect(info.label).toBe("openrouter api key");
        expect(info.quotaText).toBe("pay/use");
    });

    it("omits the quota text for a not-yet-connected api-key provider", () => {
        const info = accountViaInfo(
            account({
                providerId: "openrouter",
                authKind: "api-key",
                status: "not-configured",
                label: "api key",
            }),
            "openrouter",
        );
        expect(info.label).toBe("openrouter api key · not connected");
        expect(info.quotaText).toBeUndefined();
    });
});

describe("legacyViaInfo", () => {
    it("reports 'api key' when configured", () => {
        expect(legacyViaInfo("perplexity", true).label).toBe("perplexity api key");
        expect(legacyViaInfo("perplexity", true).quotaText).toBeUndefined();
    });

    it("reports 'no key' when not configured", () => {
        expect(legacyViaInfo("grok", false).label).toBe("grok · no key");
        expect(legacyViaInfo("grok", false).quotaText).toBe("no key");
    });
});
