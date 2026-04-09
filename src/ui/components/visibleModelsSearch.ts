import { ModelConfig } from "@core/chorus/Models";

/**
 * Extracts the sub-provider org from a model ID.
 * For "openrouter::meta-llama/llama-4-scout" returns "meta-llama".
 * For models without an org prefix returns null.
 */
export function getSubProvider(modelId: string): string | null {
    const modelPart = modelId.split("::")[1];
    if (!modelPart) return null;
    const slashIdx = modelPart.indexOf("/");
    if (slashIdx === -1) return null;
    return modelPart.slice(0, slashIdx);
}

export interface ParsedSubProviderSearch {
    matchedSubProvider: string | null;
    remainingSearch: string;
}

export function parseSubProviderSearch(
    search: string,
    subProviders: string[],
): ParsedSubProviderSearch {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
        return {
            matchedSubProvider: null,
            remainingSearch: "",
        };
    }

    const normalizedSubProviders = new Set(
        subProviders.map((subProvider) => subProvider.toLowerCase()),
    );

    const colonIdx = trimmedSearch.indexOf(":");
    if (colonIdx === -1) {
        return {
            matchedSubProvider: null,
            remainingSearch: trimmedSearch,
        };
    }

    const candidateSubProvider = trimmedSearch
        .slice(0, colonIdx)
        .trim()
        .toLowerCase();
    if (
        !candidateSubProvider ||
        !normalizedSubProviders.has(candidateSubProvider)
    ) {
        return {
            matchedSubProvider: null,
            remainingSearch: trimmedSearch,
        };
    }

    return {
        matchedSubProvider: candidateSubProvider,
        remainingSearch: trimmedSearch.slice(colonIdx + 1).trim(),
    };
}

export function filterModelsBySearch(
    models: ModelConfig[],
    search: string,
    subProviders: string[],
    selectedSubProviders: string[] = [],
): ModelConfig[] {
    const normalizedSelectedSubProviders = new Set(
        selectedSubProviders.map((subProvider) => subProvider.toLowerCase()),
    );
    const selectedFilteredModels =
        normalizedSelectedSubProviders.size === 0
            ? models
            : models.filter((model) => {
                  const subProvider = getSubProvider(
                      model.modelId,
                  )?.toLowerCase();
                  return (
                      subProvider !== undefined &&
                      normalizedSelectedSubProviders.has(subProvider)
                  );
              });

    const { matchedSubProvider, remainingSearch } = parseSubProviderSearch(
        search,
        subProviders,
    );
    if (!matchedSubProvider && !remainingSearch) return selectedFilteredModels;

    const terms = remainingSearch.toLowerCase().split(/\s+/).filter(Boolean);

    return selectedFilteredModels.filter((model) => {
        if (matchedSubProvider !== null) {
            const subProvider = getSubProvider(model.modelId)?.toLowerCase();
            if (subProvider !== matchedSubProvider) return false;
        }

        if (terms.length === 0) return true;

        const searchableText =
            `${model.displayName} ${model.modelId}`.toLowerCase();
        return terms.every((term) => searchableText.includes(term));
    });
}
