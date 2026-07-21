// Modes / stances (Assist, Critic, Socratic, ...) — W6 rework.
//
// Mirrors the shape/naming conventions of `PromptProfilesAPI.ts` (a separate,
// pre-existing, out-of-scope feature — persona system prompts — do not
// conflate the two; see docs/rework/w6-chat-recon.md §8). Frozen surface:
// W3's Settings > Modes section and this workstream's composer picker both
// consume these exports as-is — do not change field names without updating
// docs/rework/00-ARCHITECTURE.md §5.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { IMode } from "../ChatState";
import { v4 as uuidv4 } from "uuid";

const modeKeys = {
    all: () => ["modes"] as const,
    list: () => [...modeKeys.all(), "list"] as const,
    chatMode: (chatId: string) => [...modeKeys.all(), "chat", chatId] as const,
};

type ModeDBRow = {
    id: string;
    icon: string | null;
    name: string;
    description: string;
    prompt: string;
    tag: IMode["tag"];
    usage_count: number;
    author: "user" | "system";
    created_at: string;
    updated_at: string;
};

function readMode(row: ModeDBRow): IMode {
    return {
        id: row.id,
        icon: row.icon ?? undefined,
        name: row.name,
        description: row.description,
        prompt: row.prompt,
        tag: row.tag,
        usageCount: row.usage_count,
        author: row.author,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function fetchModes(): Promise<IMode[]> {
    const rows = await db.select<ModeDBRow[]>(
        "SELECT id, icon, name, description, prompt, tag, usage_count, author, created_at, updated_at FROM modes ORDER BY created_at ASC",
    );
    return rows.map(readMode);
}

/**
 * Fetch the system prompt for whichever mode is active for a given message
 * set (its own `mode_id` override), or undefined if no mode is active.
 * Intended for use inside send-time mutations (not a hook) — mirrors
 * `PromptProfilesAPI.fetchChatPromptProfileSystemPrompt`'s shape.
 */
export async function fetchMessageSetModeSystemPrompt(
    messageSetId: string,
): Promise<string | undefined> {
    const rows = await db.select<{ prompt: string }[]>(
        `SELECT modes.prompt
         FROM message_sets
         JOIN modes ON modes.id = message_sets.mode_id
         WHERE message_sets.id = ?`,
        [messageSetId],
    );
    return rows.length > 0 ? rows[0].prompt : undefined;
}

/**
 * Fetch the mode ID associated with a chat (the per-chat default, distinct
 * from a per-message-set override stored on `message_sets.mode_id`).
 */
export async function fetchChatModeId(chatId: string): Promise<string | null> {
    const rows = await db.select<{ mode_id: string }[]>(
        "SELECT mode_id FROM chat_modes WHERE chat_id = ?",
        [chatId],
    );
    return rows.length > 0 ? rows[0].mode_id : null;
}

/**
 * Increment a mode's usage_count by 1. Call exactly once per send (on the
 * message SET, not once per fanned-out model) — see
 * `useCreateMessageSetPair` in `MessageAPI.ts`, the single call site.
 */
export async function incrementModeUsageCount(modeId: string): Promise<void> {
    await db.execute(
        "UPDATE modes SET usage_count = usage_count + 1 WHERE id = ?",
        [modeId],
    );
}

export function useModes() {
    return useQuery({
        queryKey: modeKeys.list(),
        queryFn: fetchModes,
    });
}

export function useChatModeId(chatId: string) {
    return useQuery({
        queryKey: modeKeys.chatMode(chatId),
        queryFn: () => fetchChatModeId(chatId),
    });
}

/**
 * Returns the full IMode for a chat's default, or undefined if none is set.
 */
export function useChatMode(chatId: string): IMode | undefined {
    const { data: modes } = useModes();
    const { data: modeId } = useChatModeId(chatId);
    if (!modes || !modeId) return undefined;
    return modes.find((m) => m.id === modeId);
}

/**
 * Set or clear the default mode for a chat. Pass null to remove the
 * association (back to "None").
 */
export function useSetChatMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            chatId,
            modeId,
        }: {
            chatId: string;
            modeId: string | null;
        }) => {
            if (modeId) {
                await db.execute(
                    "INSERT OR REPLACE INTO chat_modes (id, chat_id, mode_id) VALUES (?, ?, ?)",
                    [uuidv4(), chatId, modeId],
                );
            } else {
                await db.execute("DELETE FROM chat_modes WHERE chat_id = ?", [
                    chatId,
                ]);
            }
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: modeKeys.chatMode(variables.chatId),
            });
        },
    });
}

export function useCreateMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            name,
            description,
            prompt,
            icon,
        }: {
            name: string;
            description: string;
            prompt: string;
            icon?: string;
        }) => {
            // User-created modes are always tagged 'custom' — 'app-default' is
            // reserved for the seeded Assist/Critic rows, 'per-chat' for a
            // future one-off chat-scoped mode (see recon doc §15).
            await db.execute(
                "INSERT INTO modes (id, icon, name, description, prompt, tag, author) VALUES (?, ?, ?, ?, ?, 'custom', 'user')",
                [uuidv4(), icon ?? null, name, description, prompt],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modeKeys.list(),
            });
        },
    });
}

export function useUpdateMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            name,
            description,
            prompt,
            icon,
        }: {
            id: string;
            name: string;
            description: string;
            prompt: string;
            icon?: string;
        }) => {
            await db.execute(
                "UPDATE modes SET name = ?, description = ?, prompt = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [name, description, prompt, icon ?? null, id],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modeKeys.list(),
            });
        },
    });
}

export function useDeleteMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            // Clean up the per-chat default association. Deliberately do NOT
            // touch message_sets.mode_id — historical sends keep their
            // (now-dangling) reference, same "no FK, orphans are fine" stance
            // CLAUDE.md takes elsewhere; readers resolve it via a JOIN, which
            // just returns nothing for a deleted mode.
            await db.execute("DELETE FROM chat_modes WHERE mode_id = ?", [id]);
            await db.execute("DELETE FROM modes WHERE id = ?", [id]);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modeKeys.all(),
            });
        },
    });
}
