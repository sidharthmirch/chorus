/**
 * W7 — Fleet. The default adapter: static, in-memory fixture data (see
 * `fixtures.ts`) so every UI phase is reviewable with no daemon running.
 * Selected by `useFleetAdapter` (`useFleet.ts`) whenever no `fleet_endpoint`
 * is configured — see docs/rework/fleet-protocol.md §5 for the swap-point
 * rationale.
 *
 * Data is otherwise static (no fake progress ticking — design/fleet.md's
 * own closing note sanctions "mock/static for UI"); `dispatchSession` /
 * `pauseSession` / `resumeSession` DO mutate the in-memory store and notify
 * subscribers, so those interactions are genuinely exercised against this
 * adapter rather than being visually inert.
 */

import { FleetAdapter, FleetEventListener } from "./FleetAdapter";
import {
    createFixtureCostPresets,
    createFixtureFeatures,
    createFixtureMachines,
    createFixtureSessions,
} from "./fixtures";
import {
    FleetConnectionState,
    FleetEvent,
    IFeature,
    IFleetCostPreset,
    IFleetSession,
    IMachine,
} from "./protocol";

export class MockFleetAdapter implements FleetAdapter {
    readonly kind = "mock" as const;

    private sessions: IFleetSession[];
    private readonly machines: IMachine[];
    private readonly features: IFeature[];
    private readonly costPresets: IFleetCostPreset[];
    private readonly listeners = new Set<FleetEventListener>();

    constructor(now: Date = new Date()) {
        this.sessions = createFixtureSessions(now);
        this.machines = createFixtureMachines();
        this.features = createFixtureFeatures(now);
        this.costPresets = createFixtureCostPresets();
    }

    getConnectionState(): FleetConnectionState {
        return "connected";
    }

    listSessions(): Promise<IFleetSession[]> {
        return Promise.resolve([...this.sessions]);
    }

    listMachines(): Promise<IMachine[]> {
        return Promise.resolve([...this.machines]);
    }

    listFeatures(): Promise<IFeature[]> {
        return Promise.resolve([...this.features]);
    }

    listCostPresets(): Promise<IFleetCostPreset[]> {
        return Promise.resolve([...this.costPresets]);
    }

    dispatchSession(sessionId: string, machineId: string): Promise<void> {
        const session = this.sessions.find((s) => s.id === sessionId);
        if (!session || session.status !== "queued") {
            return Promise.resolve();
        }
        const now = new Date();
        this.sessions = this.sessions.map((s) =>
            s.id === sessionId
                ? {
                      ...s,
                      machine: machineId,
                      status: "running",
                      progressPct: 0,
                      updatedAt: now,
                  }
                : s,
        );
        this.emitSessions();
        return Promise.resolve();
    }

    pauseSession(sessionId: string): Promise<void> {
        this.setPaused(sessionId, true);
        return Promise.resolve();
    }

    resumeSession(sessionId: string): Promise<void> {
        this.setPaused(sessionId, false);
        return Promise.resolve();
    }

    private setPaused(sessionId: string, paused: boolean): void {
        const session = this.sessions.find((s) => s.id === sessionId);
        if (!session || session.status !== "running") return;
        this.sessions = this.sessions.map((s) =>
            s.id === sessionId ? { ...s, paused } : s,
        );
        this.emitSessions();
    }

    subscribe(listener: FleetEventListener): () => void {
        this.listeners.add(listener);
        listener({ type: "connection", state: "connected" });
        listener({ type: "sessions", sessions: [...this.sessions] });
        listener({ type: "machines", machines: [...this.machines] });
        listener({ type: "features", features: [...this.features] });
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit(event: FleetEvent): void {
        for (const listener of this.listeners) listener(event);
    }

    private emitSessions(): void {
        this.emit({ type: "sessions", sessions: [...this.sessions] });
    }
}

/** Shared singleton — mirrors the `nineRouterClient` precedent (`accounts/nineRouterClient.ts`). One "now" is frozen at first import, which is fine since this adapter is deliberately static (see class doc comment). */
export const mockFleetAdapter = new MockFleetAdapter();
