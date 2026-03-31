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

/**
 * Fresh-install defaults for model-related settings + prompt profile.
 * Always seeds Google Flash Lite as the ambient, fallback, and default chat
 * model, since no API keys are present at first install. Users can update
 * their defaults in Settings > Defaults after adding keys.
 */
export function buildFreshInstallModelAndPromptDefaults(): Pick<
    Settings,
    | "defaultPromptProfileId"
    | "defaultFallbackModelProfileId"
    | "defaultAmbientChatModel"
    | "defaultFallbackModel"
    | "defaultChatModels"
> & { quickChatModelConfigId: string } {
    return {
        defaultPromptProfileId: null,
        defaultFallbackModelProfileId: null,
        defaultAmbientChatModel: CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE,
        defaultFallbackModel: CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE,
        defaultChatModels: [CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE],
        quickChatModelConfigId: CHORUS_DEFAULT_GOOGLE_GEMINI_25_FLASH_LITE,
    };
}
