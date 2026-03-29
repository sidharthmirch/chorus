import { SettingsManager } from "@core/utilities/Settings";
import { getSimpleCompletionProvider } from "./ModelProviders/simple/SimpleCompletionProviderFactory";
import {
    ISimpleCompletionProvider,
    SimpleCompletionParams,
    SimpleCompletionMode,
} from "./ModelProviders/simple/ISimpleCompletionProvider";
import { SimpleCompletionProviderAnthropic } from "./ModelProviders/simple/SimpleCompletionProviderAnthropic";
import { SimpleCompletionProviderOpenAI } from "./ModelProviders/simple/SimpleCompletionProviderOpenAI";
import { SimpleCompletionProviderGoogle } from "./ModelProviders/simple/SimpleCompletionProviderGoogle";
import { SimpleCompletionProviderOpenRouter } from "./ModelProviders/simple/SimpleCompletionProviderOpenRouter";
import { fetchModelConfigById } from "./api/ModelsAPI";
import { ApiKeys } from "./Models";

/**
 * Creates a SimpleCompletionProvider for a given model config.
 * Extracts the provider prefix from the model ID and returns the right provider.
 * Returns null if the required API key is missing.
 */
async function createProviderForModelConfig(
    modelConfigId: string,
    apiKeys: ApiKeys,
): Promise<{ provider: ISimpleCompletionProvider; modelName: string } | null> {
    const modelConfig = await fetchModelConfigById(modelConfigId);
    if (!modelConfig) return null;

    const separatorIdx = modelConfig.modelId.indexOf("::");
    if (separatorIdx === -1) return null;

    const providerPrefix = modelConfig.modelId.slice(0, separatorIdx);
    const modelName = modelConfig.modelId.slice(separatorIdx + 2);

    switch (providerPrefix) {
        case "anthropic": {
            if (!apiKeys.anthropic) return null;
            return {
                provider: new SimpleCompletionProviderAnthropic(
                    apiKeys.anthropic,
                ),
                modelName,
            };
        }
        case "openai": {
            if (!apiKeys.openai) return null;
            return {
                provider: new SimpleCompletionProviderOpenAI(apiKeys.openai),
                modelName,
            };
        }
        case "google": {
            if (!apiKeys.google) return null;
            return {
                provider: new SimpleCompletionProviderGoogle(apiKeys.google),
                modelName,
            };
        }
        case "openrouter": {
            if (!apiKeys.openrouter) return null;
            return {
                provider: new SimpleCompletionProviderOpenRouter(
                    apiKeys.openrouter,
                ),
                modelName,
            };
        }
        default:
            return null;
    }
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
        const resolved = await createProviderForModelConfig(
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
