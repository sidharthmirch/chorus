import { useMemo } from "react";
import {
    ApiKeys,
    ModelConfig,
    ModelProfile,
    getProviderLabel,
    getProviderName,
} from "@core/chorus/Models";
import { hasApiKey } from "@core/utilities/ProxyUtils";
import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { useProviderVisibilityMap } from "@core/chorus/api/ProviderVisibilityAPI";
import { useActiveModelProfile } from "@core/chorus/api/ModelProfilesAPI";
import { usePinnedModelConfigIds } from "@core/chorus/api/ModelFavoritesAPI";
import { KNOWN_PROVIDERS, filterBySearch, parseSearchQuery } from "./search";
import { ModelRowDisabledReason } from "./types";

/** Direct (non-OpenRouter, non-local) providers, one CommandGroup each — ported from ManageModelsBox.tsx. */
const DIRECT_PROVIDERS = [
    "anthropic",
    "openai",
    "google",
    "perplexity",
    "grok",
] as const;
export type DirectProvider = (typeof DIRECT_PROVIDERS)[number];

export interface ModelCatalogGroups {
    custom: ModelConfig[];
    local: ModelConfig[];
    openrouter: ModelConfig[];
    directByProvider: Record<DirectProvider, ModelConfig[]>;
    /** New in this rework: shown, not hidden (inventory §2) — collapsed by default in the UI. */
    deprecated: ModelConfig[];
}

export interface UseModelCatalogOptions {
    searchQuery: string;
    /** Quick chat's ambient use case doesn't apply the active profile filter (ported behavior). */
    ignoreActiveProfile?: boolean;
}

export interface UseModelCatalogResult {
    isLoading: boolean;
    apiKeys: ApiKeys | undefined;
    groups: ModelCatalogGroups;
    /** All currently-visible+selectable models across every group (search-filtered), for "Select All". */
    selectableVisibleModels: ModelConfig[];
    activeProfile: ModelProfile | null;
    /** Active profile's models, filtered down to what's actually selectable right now. */
    profileSelectableConfigs: ModelConfig[];
    showOpenRouter: boolean;
    pinnedIds: string[];
    getDisabledReason: (model: ModelConfig) => ModelRowDisabledReason | undefined;
    isNewModel: (model: ModelConfig) => boolean;
    formatPricing: (model: ModelConfig) => string | undefined;
}

/** Ported from ManageModelsBox.tsx's `isNewModel`. */
function isNewModel(newUntil: string | undefined): boolean {
    if (!newUntil) return false;
    return new Date(newUntil) > new Date();
}

/** Ported from ManageModelsBox.tsx's `formatPricing`. */
function formatPricing(model: ModelConfig): string | undefined {
    if (
        model.promptPricePerToken === undefined ||
        model.completionPricePerToken === undefined
    ) {
        return undefined;
    }
    const inputPerMillion = model.promptPricePerToken * 1_000_000;
    const outputPerMillion = model.completionPricePerToken * 1_000_000;
    const fmt = (price: number) => {
        if (price >= 100) return price.toFixed(0);
        if (price >= 10) return price.toFixed(1);
        if (price >= 1) return price.toFixed(2);
        return price.toFixed(3);
    };
    return `$${fmt(inputPerMillion)} / $${fmt(outputPerMillion)} per 1M`;
}

function modelHaystack(model: ModelConfig): string {
    return `${model.displayName} ${getProviderLabel(model.modelId)} ${model.modelId}`;
}

function applyVisibility(
    models: ModelConfig[],
    visibilityMap: Map<string, boolean> | undefined,
): ModelConfig[] {
    if (!visibilityMap || visibilityMap.size === 0) return models;
    return models.filter((m) => visibilityMap.get(m.modelId) ?? true);
}

function search(models: ModelConfig[], modelTerms: string[], providerFilter: string | null) {
    return filterBySearch(models, modelTerms, providerFilter, modelHaystack, (m) =>
        getProviderName(m.modelId),
    );
}

/**
 * Data-composition hook backing every surface in `model-select/**` — ports
 * `ManageModelsBox.tsx`'s `modelGroups`/`selectableVisibleModels`/
 * `profileSelectableConfigs` memoized logic (docs/rework/w4-model-select-inventory.md
 * §2), adds the new deprecated-disclosure bucket, and folds in favorites.
 */
export function useModelCatalog({
    searchQuery,
    ignoreActiveProfile = false,
}: UseModelCatalogOptions): UseModelCatalogResult {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const showOpenRouter = AppMetadataAPI.useShowOpenRouter();
    const providerVisibilityMap = useProviderVisibilityMap();
    const activeProfileRaw = useActiveModelProfile();
    const activeProfile = ignoreActiveProfile ? null : activeProfileRaw;
    const { data: pinnedIds = [] } = usePinnedModelConfigIds();

    const getDisabledReason = useMemo(
        () =>
            (model: ModelConfig): ModelRowDisabledReason | undefined => {
                if (!model.isEnabled) return "model-disabled";
                const provider = getProviderName(model.modelId);
                if (provider === "ollama" || provider === "lmstudio") return undefined;
                // `as`: ported from ManageModelsBox.tsx's identical pre-rework
                // check. ProviderName has members ApiKeys doesn't key on
                // (ollama/lmstudio, already excluded above; meta) — safe
                // because hasApiKey's lookup (apiKeys[providerKey]) just
                // returns undefined for a non-key, which hasApiKey already
                // treats as "not configured" rather than throwing.
                if (apiKeys && hasApiKey(provider as keyof typeof apiKeys, apiKeys)) {
                    return undefined;
                }
                return "no-api-key";
            },
        [apiKeys],
    );

    const groups = useMemo<ModelCatalogGroups>(() => {
        const { providerFilter, modelTerms } = parseSearchQuery(searchQuery, KNOWN_PROVIDERS);
        const all = modelConfigsQuery.data ?? [];

        const filtered = getFilteredModelConfigs(all, providerVisibilityMap, activeProfile);
        const systemModels = filtered.filter((m) => m.author === "system");
        const userModels = filtered.filter((m) => m.author === "user");

        const localModels = systemModels.filter((m) => {
            const provider = getProviderName(m.modelId);
            return provider === "ollama" || provider === "lmstudio";
        });
        const openrouterModels = systemModels.filter(
            (m) => getProviderName(m.modelId) === "openrouter",
        );
        // `as`: Object.fromEntries() widens to Record<string, ModelConfig[]>;
        // safe here because the entries come from mapping DIRECT_PROVIDERS
        // (typed `readonly DirectProvider[]`, one entry per union member) —
        // the resulting object's keys are exactly DirectProvider, exhaustively.
        const directByProvider = Object.fromEntries(
            DIRECT_PROVIDERS.map((provider) => [
                provider,
                providerFilter !== null && providerFilter !== provider
                    ? []
                    : search(
                          systemModels.filter((m) => getProviderName(m.modelId) === provider),
                          modelTerms,
                          providerFilter,
                      ),
            ]),
        ) as Record<DirectProvider, ModelConfig[]>;

        // Deprecated bucket: same base hygiene (not internal, not disabled) as
        // getFilteredModelConfigs, minus its deprecated-exclusion — respects
        // provider visibility so a fully-hidden provider doesn't resurface via
        // its deprecated models. Deliberately NOT profile-filtered: it's a
        // "browse everything" disclosure, not a selection bucket that has to
        // match the active profile (inventory §2/§3).
        const deprecatedCandidates = applyVisibility(
            all.filter((m) => !m.isInternal && m.isEnabled && m.isDeprecated),
            providerVisibilityMap,
        );

        return {
            custom: search(userModels, modelTerms, providerFilter),
            local: search(localModels, modelTerms, providerFilter),
            openrouter: search(openrouterModels, modelTerms, providerFilter),
            directByProvider,
            deprecated: search(deprecatedCandidates, modelTerms, providerFilter),
        };
    }, [modelConfigsQuery.data, searchQuery, providerVisibilityMap, activeProfile]);

    const selectableVisibleModels = useMemo(() => {
        const all = [
            ...Object.values(groups.directByProvider).flat(),
            ...groups.custom,
            ...groups.local,
            ...(showOpenRouter ? groups.openrouter : []),
        ];
        return all.filter((m) => getDisabledReason(m) === undefined);
    }, [groups, showOpenRouter, getDisabledReason]);

    const profileSelectableConfigs = useMemo(() => {
        if (!activeProfile) return [];
        const selectableIds = new Set(selectableVisibleModels.map((m) => m.id));
        const byId = new Map((modelConfigsQuery.data ?? []).map((m) => [m.id, m]));
        const ordered: ModelConfig[] = [];
        for (const configId of activeProfile.modelConfigIds) {
            if (!selectableIds.has(configId)) continue;
            const c = byId.get(configId);
            if (c) ordered.push(c);
        }
        return ordered;
    }, [activeProfile, selectableVisibleModels, modelConfigsQuery.data]);

    return {
        isLoading: modelConfigsQuery.isLoading,
        apiKeys,
        groups,
        selectableVisibleModels,
        activeProfile,
        profileSelectableConfigs,
        showOpenRouter,
        pinnedIds,
        getDisabledReason,
        isNewModel: (model) => isNewModel(model.newUntil),
        formatPricing,
    };
}
