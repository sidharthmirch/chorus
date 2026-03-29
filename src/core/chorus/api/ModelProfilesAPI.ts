import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { ModelProfile } from "../Models";

const modelProfileKeys = {
    all: () => ["modelProfiles"] as const,
    list: () => [...modelProfileKeys.all(), "list"] as const,
    active: () => [...modelProfileKeys.all(), "active"] as const,
};

type ModelProfileDBRow = {
    id: string;
    name: string;
    model_config_ids: string;
    created_at: string;
    updated_at: string;
};

function readModelProfile(row: ModelProfileDBRow): ModelProfile {
    return {
        id: row.id,
        name: row.name,
        modelConfigIds: JSON.parse(row.model_config_ids) as string[],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Fetch all model profiles from the database.
 */
export async function fetchModelProfiles(): Promise<ModelProfile[]> {
    const rows = await db.select<ModelProfileDBRow[]>(
        "SELECT id, name, model_config_ids, created_at, updated_at FROM model_profiles ORDER BY created_at ASC",
    );
    return rows.map(readModelProfile);
}

/**
 * Fetch the active model profile ID from app_metadata.
 */
export async function fetchActiveModelProfileId(): Promise<string | null> {
    const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM app_metadata WHERE key = 'active_model_profile_id'",
    );
    return rows.length > 0 ? rows[0].value : null;
}

/**
 * Hook to get all model profiles.
 */
export function useModelProfiles() {
    return useQuery({
        queryKey: modelProfileKeys.list(),
        queryFn: fetchModelProfiles,
    });
}

/**
 * Hook to get the active model profile ID.
 */
export function useActiveModelProfileId() {
    return useQuery({
        queryKey: modelProfileKeys.active(),
        queryFn: fetchActiveModelProfileId,
    });
}

/**
 * Hook to get the full active model profile (if any).
 */
export function useActiveModelProfile(): ModelProfile | null {
    const { data: profiles } = useModelProfiles();
    const { data: activeId } = useActiveModelProfileId();

    if (!profiles || !activeId) return null;

    return profiles.find((p) => p.id === activeId) ?? null;
}

/**
 * Hook to set the active model profile.
 * Pass null to deactivate (no profile active).
 */
export function useSetActiveModelProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setActiveModelProfile"] as const,
        mutationFn: async (profileId: string | null) => {
            if (profileId) {
                await db.execute(
                    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('active_model_profile_id', ?)",
                    [profileId],
                );
            } else {
                await db.execute(
                    "DELETE FROM app_metadata WHERE key = 'active_model_profile_id'",
                );
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modelProfileKeys.active(),
            });
        },
    });
}

/**
 * Hook to create a new model profile.
 */
export function useCreateModelProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["createModelProfile"] as const,
        mutationFn: async ({
            id,
            name,
            modelConfigIds,
        }: {
            id: string;
            name: string;
            modelConfigIds: string[];
        }) => {
            await db.execute(
                "INSERT INTO model_profiles (id, name, model_config_ids) VALUES (?, ?, ?)",
                [id, name, JSON.stringify(modelConfigIds)],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modelProfileKeys.list(),
            });
        },
    });
}

/**
 * Hook to update an existing model profile.
 */
export function useUpdateModelProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["updateModelProfile"] as const,
        mutationFn: async ({
            id,
            name,
            modelConfigIds,
        }: {
            id: string;
            name: string;
            modelConfigIds: string[];
        }) => {
            await db.execute(
                "UPDATE model_profiles SET name = ?, model_config_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [name, JSON.stringify(modelConfigIds), id],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modelProfileKeys.list(),
            });
        },
    });
}

/**
 * Hook to delete a model profile.
 */
export function useDeleteModelProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["deleteModelProfile"] as const,
        mutationFn: async ({ id }: { id: string }) => {
            await db.execute("DELETE FROM model_profiles WHERE id = ?", [id]);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: modelProfileKeys.list(),
            });
        },
    });
}
