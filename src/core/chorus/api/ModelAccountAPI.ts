import { useMemo } from "react";
import { ApiKeys, ModelConfig, ProviderName, getProviderName } from "../Models";
import { hasApiKey } from "@core/utilities/ProxyUtils";
import { IProviderAccount, ProviderAccountId } from "../accounts/ProviderAccounts";
import { useProviderAccounts } from "./ProviderAccountsAPI";
import { useApiKeys } from "./AppMetadataAPI";
import { ModelViaInfo, accountViaInfo, legacyViaInfo } from "./ModelAccountView";

/**
 * Model -> provider-account "via" join (W4): the hook-glue half. Combines
 * three already-frozen, read-only sources — no schema change to
 * `models`/`model_configs`, per docs/rework/00-ARCHITECTURE.md §4.1:
 *   1. `Models.ts`'s `ProviderName` (from `model_configs.model_id`'s prefix)
 *   2. W1's `useProviderAccounts()` (frozen consumer surface)
 *   3. the legacy per-provider `ApiKeys` (`AppMetadataAPI.useApiKeys`) for
 *      providers W1 doesn't manage an account for (perplexity/grok/meta)
 * The actual label/quota formatting rules live in `ModelAccountView.ts`
 * (pure, unit-tested) — this file is untested glue, same convention as
 * `ProviderAccountsAPI.ts` (untested) sitting on top of `ProviderAccounts.ts`
 * (tested).
 */

/**
 * `ProviderAccountId` (accounts) and `ProviderName` (models catalog) are
 * different enums (docs/rework/w4-model-select-inventory.md §4) — this is
 * the only place that bridges them. Providers absent here (perplexity,
 * grok, meta) have no OAuth-forward account and fall through to the legacy
 * `ApiKeys` check below.
 */
export const PROVIDER_NAME_TO_ACCOUNT_ID: Partial<
    Record<ProviderName, ProviderAccountId>
> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    openrouter: "openrouter",
    ollama: "local",
    lmstudio: "local",
};

/** Providers with no `ProviderAccountId` mapping that still have a legacy API-key field. */
const LEGACY_API_KEY_FIELD: Partial<Record<ProviderName, keyof ApiKeys>> = {
    perplexity: "perplexity",
    grok: "grok",
};

export type { ModelViaInfo } from "./ModelAccountView";

/** Combines the two lookups above; kept here so `deriveModelViaInfo` still
 *  takes a whole `ModelConfig` for caller convenience. */
function resolveAccount(
    providerName: ProviderName,
    providerAccounts: IProviderAccount[] | undefined,
): IProviderAccount | undefined {
    const accountId = PROVIDER_NAME_TO_ACCOUNT_ID[providerName];
    if (!accountId) return undefined;
    return providerAccounts?.find((a) => a.providerId === accountId);
}

/**
 * Join entry point. Not unit-tested directly (it runtime-imports
 * `Models.ts`, which isn't safely importable under this repo's vitest setup
 * — see `ModelAccountView.ts`'s header) — `accountViaInfo`/`legacyViaInfo`
 * carry the actual test coverage for the formatting rules this delegates to.
 */
export function deriveModelViaInfo(
    modelConfig: ModelConfig,
    providerAccounts: IProviderAccount[] | undefined,
    apiKeys: ApiKeys | undefined,
): ModelViaInfo {
    const providerName = getProviderName(modelConfig.modelId);
    const account = resolveAccount(providerName, providerAccounts);
    if (account) return accountViaInfo(account, providerName);

    const field = LEGACY_API_KEY_FIELD[providerName];
    const hasKey = field !== undefined && !!apiKeys && hasApiKey(field, apiKeys);
    return legacyViaInfo(providerName, hasKey);
}

/** Hook wiring — composes the two frozen upstream hooks, memoized per model config. */
export function useModelViaInfo(modelConfig: ModelConfig): ModelViaInfo {
    const { data: providerAccounts } = useProviderAccounts();
    const { data: apiKeys } = useApiKeys();
    return useMemo(
        () => deriveModelViaInfo(modelConfig, providerAccounts, apiKeys),
        [modelConfig, providerAccounts, apiKeys],
    );
}
