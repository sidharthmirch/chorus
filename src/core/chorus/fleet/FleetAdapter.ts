/**
 * W7 — Fleet. The client-side contract every fleet data source implements:
 * `MockFleetAdapter` (fixture data, the default — see `MockFleetAdapter.ts`)
 * and `FleetdAdapter` (talks to a real `fleetd`, `FleetdAdapter.ts`). UI code
 * (`useFleet.ts` and everything under `src/ui/components/fleet/`) only ever
 * depends on this interface, never on a concrete adapter — that's the swap
 * point docs/rework/agents/W7-fleet.md calls out as "done means" criteria.
 */

import {
    FleetConnectionState,
    FleetEvent,
    IFeature,
    IFleetCostPreset,
    IFleetSession,
    IMachine,
} from "./protocol";

/** Callback invoked for every event on the active transport (WebSocket push or HTTP-poll diff — see fleet-protocol.md §4). */
export type FleetEventListener = (event: FleetEvent) => void;

export interface FleetAdapter {
    /** For logging/debugging only — never branch UI rendering on this. */
    readonly kind: "mock" | "fleetd";

    getConnectionState(): FleetConnectionState;

    listSessions(): Promise<IFleetSession[]>;
    listMachines(): Promise<IMachine[]>;
    listFeatures(): Promise<IFeature[]>;
    listCostPresets(): Promise<IFleetCostPreset[]>;

    /** Moves a queued session onto a machine (design/fleet.md "Dispatch"). */
    dispatchSession(sessionId: string, machineId: string): Promise<void>;
    pauseSession(sessionId: string): Promise<void>;
    resumeSession(sessionId: string): Promise<void>;

    /**
     * Subscribes to live updates. Implementations call `listener`
     * immediately with a best-effort initial snapshot (so callers don't
     * need a separate initial-fetch step), then again whenever fleetd
     * pushes/reports a change. Returns an unsubscribe function; callers
     * MUST call it on cleanup (React `useEffect` return) to avoid leaking a
     * socket/interval per mount.
     */
    subscribe(listener: FleetEventListener): () => void;
}
