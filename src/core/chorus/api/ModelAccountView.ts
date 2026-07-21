import { IProviderAccount, IQuotaSnapshot } from "../accounts/ProviderAccounts";

/**
 * Pure half of the model -> provider-account "via" join (W4). Deliberately
 * has ZERO dependency on `Models.ts` or anything that touches `db` —
 * `Models.ts` transitively imports provider classes that call into
 * `AppMetadataAPI.ts` -> `DB.ts`, which does a top-level
 * `await Database.load(...)` that throws under this repo's vitest setup
 * (no `window`, no jsdom config — confirmed empirically, and consistent
 * with the existing convention: `accounts/ProviderAccounts.ts` is the only
 * other tested file touching this domain, and it also has zero imports).
 * `ModelAccountAPI.ts` is the untested hook-glue half that bridges this to
 * `Models.ts`/React Query; keep new logic here, not there, if it needs a
 * test.
 */

export type ModelViaInfo = {
    /** Mono "via" line, e.g. "anthropic oauth", "ollama · local", "perplexity · no key". */
    label: string;
    /** Numeric quota, only ever present for oauth-forwarded providers with live W1 data. */
    quota?: IQuotaSnapshot;
    /** Textual fallback shown in the quota slot when there's no numeric snapshot. */
    quotaText?: string;
};

const AUTH_KIND_WORD: Record<IProviderAccount["authKind"], string> = {
    oauth: "oauth",
    "api-key": "api key",
    "none-local": "local",
};

/**
 * Status-derived label suffix. Deliberately no entry for "connected" — that
 * would be the slot the design mock fills with a fabricated subscription
 * tier ("max"/"pro"); we show nothing rather than invent one
 * (docs/rework/w4-model-select-inventory.md §3).
 */
const STATUS_SUFFIX: Partial<Record<IProviderAccount["status"], string>> = {
    "needs-auth": "reauthorize",
    expired: "reauthorize",
    error: "error",
    "not-configured": "not connected",
};

/**
 * Builds the "via" line + quota display for an already-resolved provider
 * account. `providerLabel` is the models-catalog provider name (e.g.
 * "anthropic", from `Models.ts`'s `getProviderName`) — passed in as a
 * plain string rather than derived here, per the file-header note above.
 */
export function accountViaInfo(
    account: IProviderAccount,
    providerLabel: string,
): ModelViaInfo {
    const suffix = STATUS_SUFFIX[account.status];
    const label = suffix
        ? `${providerLabel} ${AUTH_KIND_WORD[account.authKind]} · ${suffix}`
        : `${providerLabel} ${AUTH_KIND_WORD[account.authKind]}`;

    switch (account.authKind) {
        case "api-key":
            // OpenRouter today: no balance/usage API wired up (inventory §3).
            return {
                label,
                quotaText: account.status === "connected" ? "pay/use" : undefined,
            };
        case "none-local":
            return { label, quotaText: "local" };
        case "oauth":
            return { label, quota: account.quota };
        default: {
            const exhaustiveCheck: never = account.authKind;
            throw new Error(`Unhandled auth kind: ${exhaustiveCheck as string}`);
        }
    }
}

/** Fallback for providers with no OAuth-forward account (perplexity/grok/meta). */
export function legacyViaInfo(providerLabel: string, hasKey: boolean): ModelViaInfo {
    return {
        label: hasKey ? `${providerLabel} api key` : `${providerLabel} · no key`,
        quotaText: hasKey ? undefined : "no key",
    };
}
