import { v4 as uuidv4 } from "uuid";
import { db } from "./DB";
import { ModelConfig } from "./Models";
import type { Settings } from "@core/utilities/Settings";
import { SettingsManager } from "@core/utilities/Settings";
import { fetchProviderVisibleModels } from "./api/ProviderVisibilityAPI";
import { fetchModelConfigs, modelConfigQueries } from "./api/ModelsAPI";
import { fetchPromptProfiles } from "./api/PromptProfilesAPI";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Whether this model config counts as visible in pickers (Visible Models + enabled).
 */
export function isModelConfigEffectivelyVisible(
    config: ModelConfig,
    visibilityMap: Map<string, boolean>,
): boolean {
    const v = visibilityMap.get(config.modelId);
    const visible = v === undefined ? true : v;
    return (
        visible &&
        config.isEnabled &&
        !config.isInternal &&
        !config.isDeprecated
    );
}

export function modelConfigSupportsVision(config: ModelConfig): boolean {
    return config.supportedAttachmentTypes.includes("image");
}

export async function buildProviderVisibilityMap(): Promise<
    Map<string, boolean>
> {
    const rows = await fetchProviderVisibleModels();
    return new Map(rows.map((r) => [r.modelId, r.isVisible]));
}

/**
 * After a chat row is inserted: prompt profile (regular) or ambient model metadata (quick).
 */
export async function applyCreationDefaultsForNewChatRow(
    chatId: string,
    queryClient?: QueryClient,
): Promise<void> {
    const rows = await db.select<{ quick_chat: number }[]>(
        "SELECT quick_chat FROM chats WHERE id = ?",
        [chatId],
    );
    if (rows.length === 0) return;

    const settings = await SettingsManager.getInstance().get();

    if (rows[0].quick_chat === 1) {
        await applyDefaultAmbientModelToMetadata(settings, queryClient);
        return;
    }

    await applyDefaultPromptProfileForChat(chatId, settings);
}

export async function applyDefaultPromptProfileForChat(
    chatId: string,
    settings?: Settings,
): Promise<void> {
    const s = settings ?? (await SettingsManager.getInstance().get());
    const profileId = s.defaultPromptProfileId;
    if (!profileId) return;

    const profiles = await fetchPromptProfiles();
    if (!profiles.some((p) => p.id === profileId)) return;

    const existing = await db.select<{ id: string }[]>(
        "SELECT id FROM prompt_profile_chats WHERE chat_id = ?",
        [chatId],
    );
    if (existing.length > 0) return;

    await db.execute(
        "INSERT INTO prompt_profile_chats (id, chat_id, prompt_profile_id) VALUES (?, ?, ?)",
        [uuidv4(), chatId, profileId],
    );
}

export async function applyDefaultAmbientModelToMetadata(
    settings?: Settings,
    queryClient?: QueryClient,
): Promise<void> {
    const s = settings ?? (await SettingsManager.getInstance().get());
    const id = s.defaultAmbientChatModel;
    if (!id) return;

    const all = await fetchModelConfigs();
    const visibilityMap = await buildProviderVisibilityMap();
    const config = all.find((c) => c.id === id);
    if (
        !config ||
        !isModelConfigEffectivelyVisible(config, visibilityMap) ||
        !modelConfigSupportsVision(config)
    ) {
        return;
    }

    await db.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('quick_chat_model_config_id', ?)",
        [config.id],
    );

    if (queryClient) {
        queryClient.setQueryData(
            modelConfigQueries.quickChat().queryKey,
            config,
        );
        await queryClient.invalidateQueries(modelConfigQueries.quickChat());
    }
}
