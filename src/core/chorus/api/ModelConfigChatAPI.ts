// Saved model config hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import { resolveOrderedCompareConfigs } from "../ChatCompareSelection";
import { db } from "../DB";
import * as ModelsAPI from "./ModelsAPI";
import { useActiveModelProfile } from "./ModelProfilesAPI";
import { useProviderVisibilityMap } from "./ProviderVisibilityAPI";
import { v4 as uuidv4 } from "uuid";

const modelConfigChatKeys = {
    savedModelConfigChat: (chatId: string) =>
        ["savedModelConfig", chatId] as const,
};

// Saved model config functions (model **config** ids, same as messages.model)
export async function fetchSavedModelConfigChat(
    chatId: string,
): Promise<string[] | null> {
    const rows = await db.select<{ model_ids: string }[]>(
        `SELECT model_ids FROM saved_model_configs_chats WHERE chat_id = ?`,
        [chatId],
    );

    if (rows.length === 0) {
        return null;
    }

    // Parse the JSON array of model IDs
    try {
        return JSON.parse(rows[0].model_ids) as string[];
    } catch {
        return null;
    }
}

export async function updateSavedModelConfigChat(
    chatId: string,
    modelIds: string[],
): Promise<void> {
    // First check if a config already exists for this chat
    const existing = await db.select<{ id: string }[]>(
        `SELECT id FROM saved_model_configs_chats WHERE chat_id = ?`,
        [chatId],
    );

    if (existing.length > 0) {
        // Update existing config
        await db.execute(
            `UPDATE saved_model_configs_chats 
             SET model_ids = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE chat_id = ?`,
            [JSON.stringify(modelIds), chatId],
        );
    } else {
        // Create new config with a unique ID
        const id = uuidv4();
        await db.execute(
            `INSERT INTO saved_model_configs_chats (id, chat_id, model_ids, created_at, updated_at) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [id, chatId, JSON.stringify(modelIds)],
        );
    }
}

export function useSavedModelConfigChat(chatId: string) {
    return useQuery({
        queryKey: modelConfigChatKeys.savedModelConfigChat(chatId),
        queryFn: () => fetchSavedModelConfigChat(chatId),
    });
}

export function useUpdateSavedModelConfigChat() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            chatId,
            modelIds,
        }: {
            chatId: string;
            modelIds: string[];
        }) => updateSavedModelConfigChat(chatId, modelIds),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: modelConfigChatKeys.savedModelConfigChat(
                    variables.chatId,
                ),
            });
        },
    });
}

/**
 * Ordered compare selection for a regular chat: persisted ids ∩ visible configs.
 */
export function useChatCompareModelConfigs(chatId: string) {
    const savedModelConfig = useSavedModelConfigChat(chatId);
    const ambientCompareQuery = ModelsAPI.useSelectedModelConfigsCompare();
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const providerVisibilityMap = useProviderVisibilityMap();
    const activeProfile = useActiveModelProfile();

    const visibleConfigs = useMemo(
        () =>
            getFilteredModelConfigs(
                modelConfigsQuery.data ?? [],
                providerVisibilityMap,
                activeProfile,
            ),
        [modelConfigsQuery.data, providerVisibilityMap, activeProfile],
    );

    return useMemo(() => {
        const fromSaved = resolveOrderedCompareConfigs(
            savedModelConfig.data,
            modelConfigsQuery.data ?? [],
            visibleConfigs,
        );
        if (fromSaved.length > 0) {
            return fromSaved;
        }
        const visibleIds = new Set(visibleConfigs.map((c) => c.id));
        return (ambientCompareQuery.data ?? []).filter((m) =>
            visibleIds.has(m.id),
        );
    }, [
        savedModelConfig.data,
        ambientCompareQuery.data,
        modelConfigsQuery.data,
        visibleConfigs,
    ]);
}

export function useAppendModelConfigToChatCompare(chatId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newSelectedModelConfigId: string) => {
            const current = (await fetchSavedModelConfigChat(chatId)) ?? [];
            if (current.includes(newSelectedModelConfigId)) {
                return;
            }
            await updateSavedModelConfigChat(chatId, [
                ...current,
                newSelectedModelConfigId,
            ]);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: modelConfigChatKeys.savedModelConfigChat(chatId),
            });
        },
    });
}

// Convenience hook for reply chats - gets just the first model ID
export function useReplyModelConfig(chatId: string) {
    const savedModelConfig = useSavedModelConfigChat(chatId);
    return {
        ...savedModelConfig,
        data: savedModelConfig.data?.[0] ?? null,
    };
}

// Convenience hook for updating reply model (one model **config** id)
export function useUpdateReplyModelConfig() {
    const updateSavedModelConfig = useUpdateSavedModelConfigChat();

    return useMutation({
        mutationFn: ({
            chatId,
            modelConfigId,
        }: {
            chatId: string;
            modelConfigId: string;
        }) =>
            updateSavedModelConfig.mutateAsync({
                chatId,
                modelIds: [modelConfigId],
            }),
    });
}
