import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { ProviderVisibility, ProviderName } from "../Models";

const providerVisibilityKeys = {
    all: () => ["providerVisibility"] as const,
    list: () => [...providerVisibilityKeys.all(), "list"] as const,
};

type ProviderVisibilityDBRow = {
    provider_name: string;
    model_id: string;
    is_visible: number;
};

function readProviderVisibility(row: ProviderVisibilityDBRow): ProviderVisibility {
    return {
        providerName: row.provider_name,
        modelId: row.model_id,
        isVisible: row.is_visible === 1,
    };
}

/**
 * Fetch all provider visibility records from the database.
 */
export async function fetchProviderVisibleModels(): Promise<ProviderVisibility[]> {
    const rows = await db.select<ProviderVisibilityDBRow[]>(
        "SELECT provider_name, model_id, is_visible FROM provider_visible_models"
    );
    return rows.map(readProviderVisibility);
}

/**
 * Hook to get all provider visibility records.
 */
export function useProviderVisibleModels() {
    return useQuery({
        queryKey: providerVisibilityKeys.list(),
        queryFn: fetchProviderVisibleModels,
    });
}

/**
 * Hook to set visibility for a specific model.
 */
export function useSetModelVisibility() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setModelVisibility"] as const,
        mutationFn: async ({
            providerName,
            modelId,
            isVisible,
        }: {
            providerName: string;
            modelId: string;
            isVisible: boolean;
        }) => {
            await db.execute(
                "INSERT OR REPLACE INTO provider_visible_models (provider_name, model_id, is_visible) VALUES (?, ?, ?)",
                [providerName, modelId, isVisible ? 1 : 0]
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: providerVisibilityKeys.list(),
            });
        },
    });
}

/**
 * Hook to set visibility for all models of a provider at once.
 */
export function useSetAllProviderModelsVisible() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setAllProviderModelsVisible"] as const,
        mutationFn: async ({
            providerName,
            modelIds,
            isVisible,
        }: {
            providerName: ProviderName;
            modelIds: string[];
            isVisible: boolean;
        }) => {
            const value = isVisible ? 1 : 0;
            for (const modelId of modelIds) {
                await db.execute(
                    "INSERT OR REPLACE INTO provider_visible_models (provider_name, model_id, is_visible) VALUES (?, ?, ?)",
                    [providerName, modelId, value]
                );
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: providerVisibilityKeys.list(),
            });
        },
    });
}

/**
 * Get the visibility map for quick lookup.
 * Returns a Map where key is modelId and value is isVisible.
 * Models not in the map should be considered visible by default.
 */
export function useProviderVisibilityMap(): Map<string, boolean> | undefined {
    const { data } = useProviderVisibleModels();
    if (!data) return undefined;

    return new Map(data.map((v) => [v.modelId, v.isVisible]));
}
