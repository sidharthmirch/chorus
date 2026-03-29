import { ApiKeys } from "../../Models";
import { canProceedWithProvider } from "@core/utilities/ProxyUtils";
import { ISimpleCompletionProvider } from "./ISimpleCompletionProvider";
import { SimpleCompletionProviderAnthropic } from "./SimpleCompletionProviderAnthropic";
import { SimpleCompletionProviderOpenRouter } from "./SimpleCompletionProviderOpenRouter";
import { SimpleCompletionProviderOpenAI } from "./SimpleCompletionProviderOpenAI";
import { SimpleCompletionProviderGoogle } from "./SimpleCompletionProviderGoogle";

type ProviderConfig = {
    name: string;
    key: keyof ApiKeys;
    create: (apiKey: string) => ISimpleCompletionProvider;
};

const PROVIDER_PRECEDENCE: ProviderConfig[] = [
    {
        name: "anthropic",
        key: "anthropic",
        create: (key) => new SimpleCompletionProviderAnthropic(key),
    },
    {
        name: "openai",
        key: "openai",
        create: (key) => new SimpleCompletionProviderOpenAI(key),
    },
    {
        name: "google",
        key: "google",
        create: (key) => new SimpleCompletionProviderGoogle(key),
    },
    {
        name: "openrouter",
        key: "openrouter",
        create: (key) => new SimpleCompletionProviderOpenRouter(key),
    },
];

/**
 * Creates a provider for the given provider prefix (e.g. "anthropic", "openrouter") using
 * the matching API key. Returns null if the prefix is unknown or the key is missing.
 */
export function createProviderByPrefix(
    prefix: string,
    apiKeys: ApiKeys,
): ISimpleCompletionProvider | null {
    const config = PROVIDER_PRECEDENCE.find((p) => p.name === prefix);
    if (!config) return null;
    const apiKey = apiKeys[config.key];
    if (!apiKey) return null;
    return config.create(apiKey);
}

/**
 * Factory function that selects and returns an appropriate simple completion provider
 * based on available API keys. Follows explicit precedence order.
 *
 * @param apiKeys The API keys object from settings
 * @returns An ISimpleCompletionProvider instance
 * @throws Error if no suitable provider is configured
 */
export function getSimpleCompletionProvider(
    apiKeys: ApiKeys,
): ISimpleCompletionProvider {
    const reasons: string[] = [];

    for (const provider of PROVIDER_PRECEDENCE) {
        const check = canProceedWithProvider(provider.name, apiKeys);
        const apiKey = apiKeys[provider.key];

        if (check.canProceed && apiKey) {
            return provider.create(apiKey);
        }

        if (!check.canProceed && check.reason) {
            reasons.push(check.reason);
        }
    }

    throw new Error(
        `Please add an Anthropic, OpenAI, Google, or OpenRouter API key in Settings to generate chat titles. ${reasons.join(" ")}`,
    );
}
