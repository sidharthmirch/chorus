import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import { SettingsManager, type Settings } from "@core/utilities/Settings";
import { db } from "./DB";
import { fetchModelConfigs, fetchModelConfigsCompare } from "./api/ModelsAPI";
import { fetchProviderVisibleModels } from "./api/ProviderVisibilityAPI";
import {
    fetchActiveModelProfileId,
    fetchModelProfiles,
} from "./api/ModelProfilesAPI";
import type { ModelConfig, ProviderVisibility } from "./Models";

function providerVisibilityMap(
    rows: ProviderVisibility[],
): Map<string, boolean> {
    return new Map(rows.map((v) => [v.modelId, v.isVisible]));
}

/**
 * Model configs the user can pick (same rules as the model picker).
 */
export async function fetchVisibleModelConfigsForSelection(): Promise<
    ModelConfig[]
> {
    const [all, visibilityRows, profiles, activeId] = await Promise.all([
        fetchModelConfigs(),
        fetchProviderVisibleModels(),
        fetchModelProfiles(),
        fetchActiveModelProfileId(),
    ]);
    const map = providerVisibilityMap(visibilityRows);
    const active = activeId
        ? (profiles.find((p) => p.id === activeId) ?? null)
        : null;
    return getFilteredModelConfigs(all, map, active);
}

async function resolveDefaultFallbackConfigId(
    settings: Settings,
    visibleIds: Set<string>,
): Promise<string | undefined> {
    const fallbackId = settings.defaultFallbackModel ?? undefined;
    if (!fallbackId || !visibleIds.has(fallbackId)) {
        return undefined;
    }
    const profileId = settings.defaultFallbackModelProfileId;
    if (profileId) {
        const profiles = await fetchModelProfiles();
        const prof = profiles.find((p) => p.id === profileId);
        if (prof && prof.modelConfigIds.includes(fallbackId)) {
            return fallbackId;
        }
        return undefined;
    }
    return fallbackId;
}

/**
 * Priority for new regular chats (no explicit default chat models):
 * 1. defaultChatModels (multi, when non-empty after visibility filter)
 * 2. defaultFallbackModel (single baseline — used before global ambient compare)
 * 3. ambient (global compare picker / ⌘J list)
 * 4. first visible model
 *
 * Fallback was previously evaluated only after ambient; that meant any non-empty
 * ambient list hid the fallback entirely.
 */
export async function computeInitialChatCompareModelConfigIds(): Promise<
    string[]
> {
    const visible = await fetchVisibleModelConfigsForSelection();
    const visibleIds = new Set(visible.map((c) => c.id));

    const settings = await SettingsManager.getInstance().get();
    const configured = (settings.defaultChatModels ?? []).filter((id) =>
        visibleIds.has(id),
    );
    if (configured.length > 0) {
        return configured;
    }

    const fallbackId = await resolveDefaultFallbackConfigId(
        settings,
        visibleIds,
    );
    if (fallbackId) {
        return [fallbackId];
    }

    const ambient = await fetchModelConfigsCompare();
    const filtered = ambient.filter((m) => visibleIds.has(m.id));
    if (filtered.length > 0) {
        return filtered.map((m) => m.id);
    }

    if (visible.length > 0) {
        return [visible[0].id];
    }

    return [];
}

export function resolveOrderedCompareConfigs(
    savedIds: string[] | null | undefined,
    allConfigs: ModelConfig[],
    visibleConfigs: ModelConfig[],
): ModelConfig[] {
    const visibleIds = new Set(visibleConfigs.map((c) => c.id));
    const byId = new Map(allConfigs.map((c) => [c.id, c]));
    if (!savedIds?.length) {
        return [];
    }
    const ordered: ModelConfig[] = [];
    for (const id of savedIds) {
        if (!visibleIds.has(id)) continue;
        const cfg = byId.get(id);
        if (cfg) ordered.push(cfg);
    }
    return ordered;
}

/**
 * Keeps app_metadata compare in sync so "ambient" defaults for new chats match
 * the last explicit multi-model selection from a regular chat.
 */
export async function syncGlobalCompareMetadataToConfigIds(
    orderedConfigIds: string[],
    allConfigs: ModelConfig[],
): Promise<void> {
    const byId = new Map(allConfigs.map((c) => [c.id, c]));
    const ordered = orderedConfigIds
        .map((id) => byId.get(id))
        .filter((m): m is ModelConfig => m !== undefined);
    if (ordered.length === 0) {
        return;
    }
    await db.execute(
        "UPDATE app_metadata SET value = ? WHERE key = 'selected_model_configs_compare'",
        [JSON.stringify(ordered.map((m) => m.id))],
    );
}
