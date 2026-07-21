/**
 * Pure half of model-config "favorite"/pin persistence (W4). Zero imports —
 * safely unit-testable, same convention as `ModelAccountView.ts` /
 * `accounts/ProviderAccounts.ts`. `ModelFavoritesAPI.ts` is the untested
 * `db`-touching glue on top of this.
 */

export const PINNED_MODEL_CONFIG_IDS_KEY = "pinned_model_config_ids";

/** Pure parse. Malformed/missing/non-array/non-string entries -> dropped, never throws. */
export function parsePinnedModelConfigIds(value: string | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === "string");
    } catch {
        return [];
    }
}

/** Pure toggle: add if absent, remove if present. Does not mutate the input. */
export function togglePinnedId(ids: string[], modelConfigId: string): string[] {
    return ids.includes(modelConfigId)
        ? ids.filter((id) => id !== modelConfigId)
        : [...ids, modelConfigId];
}
