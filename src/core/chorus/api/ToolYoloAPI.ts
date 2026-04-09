import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";

export const toolYoloKeys = {
    toolYolos: () => ["tool_yolo"] as const,
    toolYolo: (toolsetName: string, toolName: string) =>
        [...toolYoloKeys.toolYolos(), toolsetName, toolName] as const,
};

export type ToolYoloEntry = {
    toolsetName: string;
    toolName: string;
};

type ToolYoloDBRow = {
    toolset_name: string;
    tool_name: string;
    created_at: string;
};

function readToolYolo(row: ToolYoloDBRow): ToolYoloEntry {
    return {
        toolsetName: row.toolset_name,
        toolName: row.tool_name,
    };
}

export async function fetchAllToolYolo(): Promise<ToolYoloEntry[]> {
    const rows = await db.select<ToolYoloDBRow[]>(
        "SELECT * FROM tool_yolo ORDER BY toolset_name, tool_name",
    );
    return rows.map(readToolYolo);
}

/** Non-hook version for use inside ToolsetsManager */
export async function checkToolYolo(
    toolsetName: string,
    toolName: string,
): Promise<boolean> {
    const rows = await db.select<{ exists: number }[]>(
        "SELECT 1 AS exists FROM tool_yolo WHERE toolset_name = ? AND tool_name = ?",
        [toolsetName, toolName],
    );
    return rows.length > 0;
}

export function useAllToolYolo(enabled = true) {
    return useQuery({
        queryKey: toolYoloKeys.toolYolos(),
        queryFn: fetchAllToolYolo,
        enabled,
    });
}

export function useSetToolYolo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setToolYolo"] as const,
        mutationFn: async ({
            toolsetName,
            toolName,
        }: {
            toolsetName: string;
            toolName: string;
        }) => {
            await db.execute(
                "INSERT OR IGNORE INTO tool_yolo (toolset_name, tool_name) VALUES (?, ?)",
                [toolsetName, toolName],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: toolYoloKeys.toolYolos(),
            });
        },
    });
}

export function useDeleteToolYolo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["deleteToolYolo"] as const,
        mutationFn: async ({
            toolsetName,
            toolName,
        }: {
            toolsetName: string;
            toolName: string;
        }) => {
            await db.execute(
                "DELETE FROM tool_yolo WHERE toolset_name = ? AND tool_name = ?",
                [toolsetName, toolName],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: toolYoloKeys.toolYolos(),
            });
        },
    });
}
