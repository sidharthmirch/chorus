import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import {
    PINNED_MODEL_CONFIG_IDS_KEY,
    parsePinnedModelConfigIds,
    togglePinnedId,
} from "./ModelFavorites";

/**
 * "Favorite"/pin state for model configs (W4 — model-select.md's row
 * "favorite star" + Settings-row checkbox). New persistence need with no
 * natural home in the frozen `model_configs`/`models` schema, so per the
 * P3 guidance ("prefer an app_metadata JSON key over schema change") this
 * stores an ordered JSON array of ids under one `app_metadata` row — no
 * migration. Distinct from `ModelProfilesAPI`'s unrelated `ModelProfile`
 * ("named set of models" for quick-swap presets) which happens to share the
 * word "profile" in the design mock's copy but not this concept.
 *
 * The actual parse/toggle rules live in `ModelFavorites.ts` (pure,
 * unit-tested); this file is untested `db`-touching glue, same convention
 * as the rest of `api/*API.ts`.
 */

const pinnedModelConfigKeys = {
    all: () => ["pinnedModelConfigIds"] as const,
};

export async function fetchPinnedModelConfigIds(): Promise<string[]> {
    const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM app_metadata WHERE key = ?",
        [PINNED_MODEL_CONFIG_IDS_KEY],
    );
    return parsePinnedModelConfigIds(rows[0]?.value);
}

async function persistPinnedModelConfigIds(ids: string[]): Promise<void> {
    await db.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
        [PINNED_MODEL_CONFIG_IDS_KEY, JSON.stringify(ids)],
    );
}

export function usePinnedModelConfigIds() {
    return useQuery({
        queryKey: pinnedModelConfigKeys.all(),
        queryFn: fetchPinnedModelConfigIds,
    });
}

export function useIsModelConfigPinned(modelConfigId: string): boolean {
    const { data } = usePinnedModelConfigIds();
    return data?.includes(modelConfigId) ?? false;
}

export function useToggleModelConfigPinned() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["toggleModelConfigPinned"] as const,
        mutationFn: async (modelConfigId: string) => {
            const current = await fetchPinnedModelConfigIds();
            const next = togglePinnedId(current, modelConfigId);
            await persistPinnedModelConfigIds(next);
            return next;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: pinnedModelConfigKeys.all(),
            });
        },
    });
}
