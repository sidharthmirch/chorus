/**
 * W7 — Fleet. TanStack Query hooks over the active `FleetAdapter` — the
 * only place UI code reaches for fleet data. `useFleetAdapter` is the swap
 * point: no `fleet_endpoint` configured -> `MockFleetAdapter` (fixture
 * data, so `/fleet` is fully reviewable out of the box); endpoint
 * configured -> a `FleetdAdapter` pointed at it, which degrades to
 * `"disconnected"`/`"not-configured"` on its own rather than silently
 * falling back to mock data (a configured-but-unreachable fleetd should
 * read as an honest error state, not fake data — see
 * docs/rework/fleet-protocol.md §5).
 *
 * Fleet ↔ Orca integration added a third case: `fleet_backend === "orca"`
 * (an independent `app_metadata` key, `fleetSettings.ts`) picks
 * `OrcaCliAdapter` instead, regardless of `fleet_endpoint` — see
 * docs/rework/fleet-orca-integration.md. `"mock"` stays the default so
 * nothing regresses for anyone who never opts in.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FleetAdapter } from "./FleetAdapter";
import { FleetdAdapter } from "./FleetdAdapter";
import { mockFleetAdapter } from "./MockFleetAdapter";
import { OrcaCliAdapter } from "./OrcaCliAdapter";
import { FleetConnectionState, IFleetCostPreset } from "./protocol";
import {
    useFleetBackend,
    useFleetCostPresetId,
    useFleetEndpoint,
} from "./fleetSettings";

const sessionsKey = ["fleet", "sessions"] as const;
const machinesKey = ["fleet", "machines"] as const;
const featuresKey = ["fleet", "features"] as const;
const costPresetsKey = ["fleet", "costPresets"] as const;

export function useFleetAdapter(): FleetAdapter {
    const endpoint = useFleetEndpoint();
    const backend = useFleetBackend();
    return useMemo<FleetAdapter>(() => {
        if (backend === "orca") return new OrcaCliAdapter();
        return endpoint ? new FleetdAdapter(endpoint) : mockFleetAdapter;
    }, [backend, endpoint]);
}

export function useFleetConnectionState(): FleetConnectionState {
    const adapter = useFleetAdapter();
    const [state, setState] = useState<FleetConnectionState>(() =>
        adapter.getConnectionState(),
    );
    useEffect(() => {
        setState(adapter.getConnectionState());
        return adapter.subscribe((event) => {
            if (event.type === "connection") setState(event.state);
        });
    }, [adapter]);
    return state;
}

export function useFleetSessions() {
    const adapter = useFleetAdapter();
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: sessionsKey,
        queryFn: () => adapter.listSessions(),
    });
    useEffect(
        () =>
            adapter.subscribe((event) => {
                if (event.type === "sessions") {
                    queryClient.setQueryData(sessionsKey, event.sessions);
                }
            }),
        [adapter, queryClient],
    );
    return query;
}

export function useFleetMachines() {
    const adapter = useFleetAdapter();
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: machinesKey,
        queryFn: () => adapter.listMachines(),
    });
    useEffect(
        () =>
            adapter.subscribe((event) => {
                if (event.type === "machines") {
                    queryClient.setQueryData(machinesKey, event.machines);
                }
            }),
        [adapter, queryClient],
    );
    return query;
}

export function useFleetFeatures() {
    const adapter = useFleetAdapter();
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: featuresKey,
        queryFn: () => adapter.listFeatures(),
    });
    useEffect(
        () =>
            adapter.subscribe((event) => {
                if (event.type === "features") {
                    queryClient.setQueryData(featuresKey, event.features);
                }
            }),
        [adapter, queryClient],
    );
    return query;
}

/** Cost presets are config, not live status — no subscription, just a fetch. */
export function useFleetCostPresets() {
    const adapter = useFleetAdapter();
    return useQuery({
        queryKey: costPresetsKey,
        queryFn: () => adapter.listCostPresets(),
    });
}

/** Convenience: resolves the persisted preset id (`fleetSettings.ts`) against the loaded preset list, falling back to the first preset if the persisted id doesn't match anything loaded. */
export function useActiveFleetCostPreset(): IFleetCostPreset | undefined {
    const presetId = useFleetCostPresetId();
    const { data: presets } = useFleetCostPresets();
    if (!presets || presets.length === 0) return undefined;
    return presets.find((p) => p.id === presetId) ?? presets[0];
}

function useInvalidateFleetSessions() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: sessionsKey });
}

export function useDispatchSession() {
    const adapter = useFleetAdapter();
    const invalidateSessions = useInvalidateFleetSessions();
    return useMutation({
        mutationKey: ["fleet", "dispatchSession"] as const,
        mutationFn: ({
            sessionId,
            machineId,
        }: {
            sessionId: string;
            machineId: string;
        }) => adapter.dispatchSession(sessionId, machineId),
        onSuccess: () => invalidateSessions(),
        onError: (error) => {
            toast.error("Couldn't dispatch session", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

export function usePauseSession() {
    const adapter = useFleetAdapter();
    const invalidateSessions = useInvalidateFleetSessions();
    return useMutation({
        mutationKey: ["fleet", "pauseSession"] as const,
        mutationFn: (sessionId: string) => adapter.pauseSession(sessionId),
        onSuccess: () => invalidateSessions(),
        onError: (error) => {
            toast.error("Couldn't pause session", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

export function useResumeSession() {
    const adapter = useFleetAdapter();
    const invalidateSessions = useInvalidateFleetSessions();
    return useMutation({
        mutationKey: ["fleet", "resumeSession"] as const,
        mutationFn: (sessionId: string) => adapter.resumeSession(sessionId),
        onSuccess: () => invalidateSessions(),
        onError: (error) => {
            toast.error("Couldn't resume session", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}
