import type { Settings } from "./Settings";

/** Direct Google system config (migrations seed this id). */
export const CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE =
    "google::gemini-2.5-flash-lite";

/**
 * OpenRouter catalog id for the same model class (after `downloadOpenRouterModels`).
 * Filtered out of defaults until the model exists and is visible.
 */
export const CHORUS_DEFAULT_OPENROUTER_GEMINI_25_FLASH_LITE =
    "openrouter::google/gemini-2.5-flash-lite";

type ApiKeys = NonNullable<Settings["apiKeys"]>;

/**
 * Fresh-install defaults for model-related settings + prompt profile.
 * Ambient and fallback use the same single config: Google when a Google key is
 * present or when no OpenRouter key; otherwise OpenRouter Flash Lite.
 *
 * Default chat models: always include Google Flash Lite; add OpenRouter Flash
 * Lite when an OpenRouter API key is set (typical “Google + free/low-cost OR” setup).
 */
export function buildFreshInstallModelAndPromptDefaults(
    apiKeys: ApiKeys | undefined,
): Pick<
    Settings,
    | "defaultPromptProfileId"
    | "defaultFallbackModelProfileId"
    | "defaultAmbientChatModel"
    | "defaultFallbackModel"
    | "defaultChatModels"
> & { quickChatModelConfigId: string } {
    const hasGoogle = !!apiKeys?.google?.trim();
    const hasOpenRouter = !!apiKeys?.openrouter?.trim();

    const ambientAndFallback =
        hasGoogle || !hasOpenRouter
            ? CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE
            : CHORUS_DEFAULT_OPENROUTER_GEMINI_25_FLASH_LITE;

    const defaultChatModels: string[] = [CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE];
    if (hasOpenRouter) {
        defaultChatModels.push(CHORUS_DEFAULT_OPENROUTER_GEMINI_25_FLASH_LITE);
    }

    return {
        defaultPromptProfileId: null,
        defaultFallbackModelProfileId: null,
        defaultAmbientChatModel: ambientAndFallback,
        defaultFallbackModel: ambientAndFallback,
        defaultChatModels,
        quickChatModelConfigId: ambientAndFallback,
    };
}
