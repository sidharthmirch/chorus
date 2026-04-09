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

export function filterModelsBySearch(
    models: ModelConfig[],
    search: string,
    subProviders: string[],
): ModelConfig[] {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return models;

    const normalizedSubProviders = new Set(
        subProviders.map((subProvider) => subProvider.toLowerCase()),
    );

    let matchedSubProvider: string | null = null;
    let remainingSearch = trimmedSearch;
    const colonIdx = trimmedSearch.indexOf(":");

    if (colonIdx !== -1) {
        const candidateSubProvider = trimmedSearch
            .slice(0, colonIdx)
            .trim()
            .toLowerCase();
        if (
            candidateSubProvider &&
            normalizedSubProviders.has(candidateSubProvider)
        ) {
            matchedSubProvider = candidateSubProvider;
            remainingSearch = trimmedSearch.slice(colonIdx + 1).trim();
        }
    }

    const terms = remainingSearch.toLowerCase().split(/\s+/).filter(Boolean);

    return models.filter((model) => {
        if (matchedSubProvider !== null) {
            const subProvider = getSubProvider(model.modelId)?.toLowerCase();
            if (subProvider !== matchedSubProvider) return false;
        }

        if (terms.length === 0) return true;

        const searchableText = `${model.displayName} ${model.modelId}`.toLowerCase();
        return terms.every((term) => searchableText.includes(term));
    });
}
