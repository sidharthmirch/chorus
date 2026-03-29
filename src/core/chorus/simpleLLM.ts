import { SettingsManager } from "@core/utilities/Settings";
import {
    getSimpleCompletionProvider,
    createProviderByPrefix,
} from "./ModelProviders/simple/SimpleCompletionProviderFactory";
import {
    SimpleCompletionParams,
    SimpleCompletionMode,
} from "./ModelProviders/simple/ISimpleCompletionProvider";
import { fetchModelConfigById } from "./api/ModelsAPI";
import { ApiKeys } from "./Models";

/**
 * Resolves a model config ID to a provider + model name string.
 * Returns null if the config is missing, the provider unknown, or the API key absent.
 */
async function resolveProviderForModelConfig(
    modelConfigId: string,
    apiKeys: ApiKeys,
): Promise<{
    provider: NonNullable<ReturnType<typeof createProviderByPrefix>>;
    modelName: string;
} | null> {
    const modelConfig = await fetchModelConfigById(modelConfigId);
    if (!modelConfig) return null;

    const separatorIdx = modelConfig.modelId.indexOf("::");
    if (separatorIdx === -1) return null;

    const providerPrefix = modelConfig.modelId.slice(0, separatorIdx);
    const modelName = modelConfig.modelId.slice(separatorIdx + 2);
    const provider = createProviderByPrefix(providerPrefix, apiKeys);
    if (!provider) return null;

    return { provider, modelName };
}

/**
 * Makes a simple LLM call using the first available provider.
 * Used primarily for generating chat titles and suggestions.
 *
 * @param prompt The prompt to send
 * @param params Completion params (maxTokens, optional model)
 * @param modelConfigId Optional model config ID to use a specific model instead of auto-selecting
 */
export async function simpleLLM(
    prompt: string,
    params: SimpleCompletionParams,
    modelConfigId?: string,
): Promise<string> {
    const settingsManager = SettingsManager.getInstance();
    const settings = await settingsManager.get();
    const apiKeys = settings.apiKeys || {};

    if (modelConfigId) {
        const resolved = await resolveProviderForModelConfig(
            modelConfigId,
            apiKeys,
        );
        if (resolved) {
            return resolved.provider.complete(prompt, {
                ...params,
                model: resolved.modelName,
            });
        }
        // Fall through to default behavior if resolution fails
    }

    // Default to title generation mode if no model specified
    const paramsWithMode: SimpleCompletionParams = {
        ...params,
        model: params.model ?? SimpleCompletionMode.TITLE_GENERATION,
    };

    const provider = getSimpleCompletionProvider(apiKeys);
    return provider.complete(prompt, paramsWithMode);
}
