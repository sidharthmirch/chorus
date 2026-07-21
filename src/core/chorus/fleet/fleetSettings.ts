/**
 * W7 — Fleet. `app_metadata`-backed settings: the `fleet_endpoint` key
 * (P1 — configures the adapter swap point) and `fleet_cost_preset` (P4 —
 * persists the selected cost preset). Self-contained under
 * `src/core/chorus/fleet/**` rather than appended to the shared
 * `api/AppMetadataAPI.ts` — same table (`app_metadata`) and the same
 * `INSERT OR REPLACE` idiom as that file (per ORCHESTRATION.md's "use
 * existing app_metadata patterns"), just with its own query key so this
 * workstream never has to touch a file outside its ownership map
 * (docs/rework/00-ARCHITECTURE.md §8).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { FLEET_DEFAULT_COST_PRESET_ID } from "./fixtures";

const FLEET_ENDPOINT_KEY = "fleet_endpoint";
const FLEET_COST_PRESET_KEY = "fleet_cost_preset";

const fleetSettingsQueryKey = ["fleetSettings"] as const;

async function fetchFleetSettings(): Promise<Record<string, string>> {
    const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM app_metadata WHERE key IN (?, ?)",
        [FLEET_ENDPOINT_KEY, FLEET_COST_PRESET_KEY],
    );
    return rows.reduce(
        (acc, row) => {
            acc[row.key] = row.value;
            return acc;
        },
        {} as Record<string, string>,
    );
}

function useFleetSettings() {
    return useQuery({
        queryKey: fleetSettingsQueryKey,
        queryFn: fetchFleetSettings,
    });
}

/** `undefined` means "no real fleetd configured" — `useFleetAdapter` (`useFleet.ts`) reads this to pick Mock vs Fleetd. */
export function useFleetEndpoint(): string | undefined {
    const { data } = useFleetSettings();
    return data?.[FLEET_ENDPOINT_KEY] || undefined;
}

export function useSetFleetEndpoint() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setFleetEndpoint"] as const,
        mutationFn: async (endpoint: string | undefined) => {
            const trimmed = endpoint?.trim();
            if (trimmed) {
                await db.execute(
                    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                    [FLEET_ENDPOINT_KEY, trimmed],
                );
            } else {
                await db.execute(
                    "DELETE FROM app_metadata WHERE key = ?",
                    [FLEET_ENDPOINT_KEY],
                );
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: fleetSettingsQueryKey,
            });
        },
    });
}

export function useFleetCostPresetId(): string {
    const { data } = useFleetSettings();
    return data?.[FLEET_COST_PRESET_KEY] || FLEET_DEFAULT_COST_PRESET_ID;
}

export function useSetFleetCostPresetId() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setFleetCostPresetId"] as const,
        mutationFn: async (presetId: string) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                [FLEET_COST_PRESET_KEY, presetId],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: fleetSettingsQueryKey,
            });
        },
    });
}
