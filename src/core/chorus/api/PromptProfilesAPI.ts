import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { PromptProfile } from "../Models";
import { v4 as uuidv4 } from "uuid";

const promptProfileKeys = {
    all: () => ["promptProfiles"] as const,
    list: () => [...promptProfileKeys.all(), "list"] as const,
    chatProfile: (chatId: string) =>
        [...promptProfileKeys.all(), "chat", chatId] as const,
};

type PromptProfileDBRow = {
    id: string;
    name: string;
    system_prompt: string;
    icon: string | null;
    author: "user" | "system";
    created_at: string;
    updated_at: string;
};

function readPromptProfile(row: PromptProfileDBRow): PromptProfile {
    return {
        id: row.id,
        name: row.name,
        systemPrompt: row.system_prompt,
        icon: row.icon ?? undefined,
        author: row.author,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function fetchPromptProfiles(): Promise<PromptProfile[]> {
    const rows = await db.select<PromptProfileDBRow[]>(
        "SELECT id, name, system_prompt, icon, author, created_at, updated_at FROM prompt_profiles ORDER BY created_at ASC",
    );
    return rows.map(readPromptProfile);
}

/**
 * Fetch the system prompt for the profile associated with a chat.
 * Returns undefined if no profile is set.
 * Intended for use inside mutations (not a hook).
 */
export async function fetchChatPromptProfileSystemPrompt(
    chatId: string,
): Promise<string | undefined> {
    const rows = await db.select<{ system_prompt: string }[]>(
        `SELECT pp.system_prompt
         FROM prompt_profile_chats ppc
         JOIN prompt_profiles pp ON pp.id = ppc.prompt_profile_id
         WHERE ppc.chat_id = ?`,
        [chatId],
    );
    return rows.length > 0 ? rows[0].system_prompt : undefined;
}

/**
 * Fetch the prompt profile ID associated with a chat.
 */
async function fetchChatPromptProfileId(
    chatId: string,
): Promise<string | null> {
    const rows = await db.select<{ prompt_profile_id: string }[]>(
        "SELECT prompt_profile_id FROM prompt_profile_chats WHERE chat_id = ?",
        [chatId],
    );
    return rows.length > 0 ? rows[0].prompt_profile_id : null;
}

export function usePromptProfiles() {
    return useQuery({
        queryKey: promptProfileKeys.list(),
        queryFn: fetchPromptProfiles,
    });
}

export function useChatPromptProfileId(chatId: string) {
    return useQuery({
        queryKey: promptProfileKeys.chatProfile(chatId),
        queryFn: () => fetchChatPromptProfileId(chatId),
    });
}

/**
 * Returns the full PromptProfile for a chat, or undefined if none is set.
 */
export function useChatPromptProfile(
    chatId: string,
): PromptProfile | undefined {
    const { data: profiles } = usePromptProfiles();
    const { data: profileId } = useChatPromptProfileId(chatId);
    if (!profiles || !profileId) return undefined;
    return profiles.find((p) => p.id === profileId);
}

/**
 * Set or clear the prompt profile for a chat.
 * Pass null to remove the association.
 */
export function useSetChatPromptProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            chatId,
            profileId,
        }: {
            chatId: string;
            profileId: string | null;
        }) => {
            if (profileId) {
                await db.execute(
                    "INSERT OR REPLACE INTO prompt_profile_chats (id, chat_id, prompt_profile_id) VALUES (?, ?, ?)",
                    [uuidv4(), chatId, profileId],
                );
            } else {
                await db.execute(
                    "DELETE FROM prompt_profile_chats WHERE chat_id = ?",
                    [chatId],
                );
            }
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: promptProfileKeys.chatProfile(variables.chatId),
            });
        },
    });
}

export function useCreatePromptProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            name,
            systemPrompt,
            icon,
        }: {
            name: string;
            systemPrompt: string;
            icon?: string;
        }) => {
            await db.execute(
                "INSERT INTO prompt_profiles (id, name, system_prompt, icon, author) VALUES (?, ?, ?, ?, 'user')",
                [uuidv4(), name, systemPrompt, icon ?? null],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: promptProfileKeys.list(),
            });
        },
    });
}

export function useUpdatePromptProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            name,
            systemPrompt,
            icon,
        }: {
            id: string;
            name: string;
            systemPrompt: string;
            icon?: string;
        }) => {
            await db.execute(
                "UPDATE prompt_profiles SET name = ?, system_prompt = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [name, systemPrompt, icon ?? null, id],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: promptProfileKeys.list(),
            });
        },
    });
}

export function useDeletePromptProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const rows = await db.select<{ author: "user" | "system" }[]>(
                "SELECT author FROM prompt_profiles WHERE id = ?",
                [id],
            );
            if (rows[0]?.author === "system") {
                throw new Error("Built-in prompt profiles cannot be deleted.");
            }

            await db.execute(
                "DELETE FROM prompt_profile_chats WHERE prompt_profile_id = ?",
                [id],
            );
            await db.execute("DELETE FROM prompt_profiles WHERE id = ?", [id]);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: promptProfileKeys.all(),
            });
        },
    });
}
