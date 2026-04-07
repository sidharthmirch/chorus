import { ModelConfig, ModelProfile } from "@core/chorus/Models";

/**
 * Centralized filtering utility that combines provider visibility and profile filtering.
 *
 * Filtering order:
 * 1. Filter out internal and deprecated models (always)
 * 2. Filter by provider visibility (if configured)
 * 3. Filter by active profile (if active)
 *
 * Models not in the visibility map are considered visible by default (backward compatibility).
 *
 * @param allModelConfigs - All available model configs
 * @param providerVisibilityMap - Map of modelId -> isVisible (from ProviderVisibilityAPI)
 * @param activeProfile - Currently active profile (or null)
 * @returns Filtered model configs that pass all filters
 */
export function getFilteredModelConfigs(
    allModelConfigs: ModelConfig[],
    providerVisibilityMap: Map<string, boolean> | undefined,
    activeProfile: ModelProfile | null,
): ModelConfig[] {
    // Step 1: Always filter out internal and deprecated models
    let filtered = allModelConfigs.filter(
        (config) =>
            !config.isInternal && !config.isDeprecated && config.isEnabled,
    );

    // Step 2: Filter by provider visibility
    // If providerVisibilityMap is undefined, assume all models visible (backward compatibility)
    if (providerVisibilityMap && providerVisibilityMap.size > 0) {
        filtered = filtered.filter((config) => {
            const isVisible = providerVisibilityMap.get(config.modelId);
            // If model is not in the visibility map, default to visible
            return isVisible === undefined ? true : isVisible;
        });
    }

    // Step 3: If a profile is active, filter to only include models in that profile
    // Note: Profile uses modelConfigIds, not modelIds
    if (activeProfile) {
        const profileConfigIds = new Set(activeProfile.modelConfigIds);
        filtered = filtered.filter((config) => profileConfigIds.has(config.id));
    }

    return filtered;
}

