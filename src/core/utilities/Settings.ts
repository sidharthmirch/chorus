import { getStore } from "@core/infra/Store";
import { emit } from "@tauri-apps/api/event";
import { buildFreshInstallModelAndPromptDefaults } from "./ChorusDefaultPreferences";

export interface Settings {
    defaultEditor: string;
    sansFont: string;
    monoFont: string;
    autoConvertLongText: boolean;
    autoScrapeUrls: boolean;
    showCost: boolean;
    apiKeys?: {
        anthropic?: string;
        openai?: string;
        google?: string;
        perplexity?: string;
        openrouter?: string;
        firecrawl?: string;
    };
    quickChat?: {
        enabled?: boolean;
        modelConfigId?: string;
        shortcut?: string;
    };
    lmStudioBaseUrl?: string;
    cautiousEnter?: boolean;
    titleGenerationModelConfigId?: string;
    /** Model config ids for new regular chats; null/undefined = use ambient compare list */
    defaultChatModels?: string[] | null;
    /** Default prompt profile for new regular chats */
    defaultPromptProfileId?: string | null;
    /** Single fallback model config when no other selection applies. */
    defaultFallbackModel?: string | null;
    /** Optional model profile whose allowed configs must include the fallback model config id. */
    defaultFallbackModelProfileId?: string | null;
    /** Vision-capable model config for ambient / quick chat. */
    defaultAmbientChatModel?: string | null;
}

export class SettingsManager {
    private static instance: SettingsManager;
    private storeName = "settings";

    private constructor() {}

    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }

    public async get(): Promise<Settings> {
        try {
            const store = await getStore(this.storeName);
            const settings = await store.get("settings");
            const { quickChatModelConfigId, ...modelPreferenceFields } =
                buildFreshInstallModelAndPromptDefaults({});
            const defaultSettings: Settings = {
                defaultEditor: "default",
                sansFont: "Geist",
                monoFont: "Geist Mono",
                autoConvertLongText: true,
                autoScrapeUrls: true,
                showCost: false,
                apiKeys: {},
                quickChat: {
                    enabled: true,
                    modelConfigId: quickChatModelConfigId,
                    shortcut: "Alt+Space",
                },
                ...modelPreferenceFields,
            };

            // If no settings exist yet, save the defaults
            if (!settings) {
                await this.set(defaultSettings);
                return defaultSettings;
            }

            return (settings as Settings) || defaultSettings;
        } catch (error) {
            console.error("Failed to get settings:", error);
            const { quickChatModelConfigId: qcId, ...modelFields } =
                buildFreshInstallModelAndPromptDefaults({});
            return {
                defaultEditor: "default",
                sansFont: "Geist",
                monoFont: "Fira Code",
                autoConvertLongText: true,
                autoScrapeUrls: true,
                showCost: false,
                apiKeys: {},
                quickChat: {
                    enabled: true,
                    modelConfigId: qcId,
                    shortcut: "Alt+Space",
                },
                ...modelFields,
            };
        }
    }

    public async set(settings: Settings): Promise<void> {
        try {
            const store = await getStore(this.storeName);
            await store.set("settings", settings);
            await store.save();
            await emit("settings-changed", settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    }

    public async getChorusToken(): Promise<string | null> {
        try {
            const store = await getStore("auth.dat");
            const token = await store.get("api_token");
            return (token as string) || null;
        } catch (error) {
            console.error("Failed to get Chorus token:", error);
            return null;
        }
    }
}
