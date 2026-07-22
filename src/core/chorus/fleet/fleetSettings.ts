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
 *
 * `fleet_backend` (Fleet ↔ Orca integration, docs/rework/fleet-orca-
 * integration.md) was added later, same pattern: a third independent
 * `app_metadata` key selecting which `FleetAdapter` `useFleetAdapter`
 * (`useFleet.ts`) constructs. Defaults to `"mock"` so nothing regresses for
 * anyone who never opts into `"orca"` (or the older `"fleetd"` endpoint-
 * based path, which predates this key and is still selected independently
 * via `fleet_endpoint` — see `useFleet.ts`'s comment on `useFleetAdapter`).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { FLEET_DEFAULT_COST_PRESET_ID } from "./fixtures";

const FLEET_ENDPOINT_KEY = "fleet_endpoint";
const FLEET_COST_PRESET_KEY = "fleet_cost_preset";
const FLEET_BACKEND_KEY = "fleet_backend";

export type FleetBackend = "mock" | "fleetd" | "orca";
const FLEET_DEFAULT_BACKEND: FleetBackend = "mock";

const fleetSettingsQueryKey = ["fleetSettings"] as const;

async function fetchFleetSettings(): Promise<Record<string, string>> {
    const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM app_metadata WHERE key IN (?, ?, ?)",
        [FLEET_ENDPOINT_KEY, FLEET_COST_PRESET_KEY, FLEET_BACKEND_KEY],
    );
    return rows.reduce((acc: Record<string, string>, row) => {
        acc[row.key] = row.value;
        return acc;
    }, {});
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

/** Which `FleetAdapter` `useFleetAdapter` (`useFleet.ts`) should construct —
 * `"mock"` (default) / `"fleetd"` / `"orca"`. An unrecognized/missing stored
 * value falls back to `"mock"` rather than throwing, same defensive spirit
 * as the rest of this file. */
export function useFleetBackend(): FleetBackend {
    const { data } = useFleetSettings();
    const raw = data?.[FLEET_BACKEND_KEY];
    return raw === "fleetd" || raw === "orca" ? raw : FLEET_DEFAULT_BACKEND;
}

export function useSetFleetBackend() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setFleetBackend"] as const,
        mutationFn: async (backend: FleetBackend) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                [FLEET_BACKEND_KEY, backend],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: fleetSettingsQueryKey,
            });
        },
    });
}
