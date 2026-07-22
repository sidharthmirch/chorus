/**
 * Fleet ↔ Orca integration — `OrcaCliAdapter`, the third `FleetAdapter`
 * implementation (`kind: "orca"`), alongside `MockFleetAdapter` (fixture
 * data) and `FleetdAdapter` (a real fleetd daemon over HTTP/WS). Instead of
 * a daemon, this talks to a locally installed `orca` CLI
 * (github.com/stablyai/orca, onorca.dev) — an open-source ADE that runs
 * parallel coding agents, each in its own git worktree. See
 * docs/rework/fleet-orca-integration.md (orchestrator spec) for the full
 * mapping rationale and docs/rework/fleet-protocol.md for the shared
 * event/status vocabulary this still emits — UI code never branches on
 * `kind`, so Board/Worktrees/machines-strip render unchanged.
 *
 * Transport: `orcaCommand.ts`'s injectable `OrcaCommandRunner` — production
 * code gets a real `Command.create("orca", args)` runner
 * (`@tauri-apps/plugin-shell`, already a dependency, no new Rust), tests
 * inject a stub, exactly like `nineRouterClient.ts` injects `fetch`.
 *
 * No push API exists (`orca serve`'s HTTP surface is undocumented and out
 * of v1 scope — see the spec's non-goals), so `subscribe()` polls `orca
 * worktree ps --json` on an interval (`setInterval`/`clearInterval` — pre-
 * authorized for polling in `.rework/ORCHESTRATION.md`), computing
 * sessions/machines/features from that single call each tick.
 *
 * Detection / degradation: every CLI invocation is wrapped so a missing
 * binary (ENOENT), a non-zero exit code, or any other runner failure never
 * throws into the UI — `getConnectionState()` reports `"not-configured"`
 * and every `list*` resolves to `[]` (see `fetchSessions()`). There is no
 * "installed but momentarily unreachable" distinction in v1 — any failure
 * reads as `"not-configured"`, never `"disconnected"` (fleetd's states, by
 * contrast, distinguish those); documented simplification, not an oversight.
 *
 * Mutations — documented, non-obvious choices (the spec offered two options
 * for each and asked for one to be picked and noted, never faked):
 * - `dispatchSession` / `pauseSession` / `resumeSession` all throw a clear,
 *   descriptive `Error` rather than silently no-op-succeeding or faking a
 *   state change. orca has no first-class pause primitive, and orca's
 *   "create a worktree" flow doesn't correspond to "move an existing queued
 *   session onto a machine" (orca is also single-host in v1, so there is no
 *   second machine to move a session onto in the first place — and this
 *   adapter never actually surfaces a `"queued"` session in the first
 *   place, since an orca worktree already exists by the time it's listed).
 *   `useFleet.ts`'s mutations already turn a thrown error into a
 *   `toast.error` — the same "no-op-with-clear-error" tolerance the spec
 *   explicitly sanctions for pause/resume, applied consistently to all
 *   three mutating verbs instead of faking any of them.
 */

import { hostname } from "@tauri-apps/plugin-os";
import { FleetAdapter, FleetEventListener } from "./FleetAdapter";
import { createOrcaCommandRunner, OrcaCommandRunner } from "./orcaCommand";
import { mapOrcaFeatures, mapOrcaMachines, mapOrcaSessions } from "./orcaMap";
import {
    FleetConnectionState,
    FleetEvent,
    IFeature,
    IFleetCostPreset,
    IFleetSession,
    IMachine,
} from "./protocol";

const POLL_INTERVAL_MS = 5000;

const DISPATCH_UNSUPPORTED_MESSAGE =
    "Dispatching sessions isn't supported by the orca backend yet — orca creates a worktree directly (`orca worktree create`) rather than queuing one to be dispatched onto a machine, and orca is single-host in v1 so there is no second machine to move it to.";

const PAUSE_RESUME_UNSUPPORTED_MESSAGE =
    "Pausing/resuming isn't supported by the orca backend yet — orca has no first-class pause primitive (see docs/rework/fleet-orca-integration.md).";

export class OrcaCliAdapter implements FleetAdapter {
    readonly kind = "orca" as const;

    private connectionState: FleetConnectionState = "connecting";
    private pollHandle: ReturnType<typeof setInterval> | undefined;
    private readonly listeners = new Set<FleetEventListener>();
    private hostnamePromise: Promise<string> | undefined;

    constructor(
        private readonly runner: OrcaCommandRunner = createOrcaCommandRunner(),
    ) {}

    getConnectionState(): FleetConnectionState {
        return this.connectionState;
    }

    listSessions(): Promise<IFleetSession[]> {
        return this.fetchSessions();
    }

    async listMachines(): Promise<IMachine[]> {
        const sessions = await this.fetchSessions();
        if (this.connectionState === "not-configured") return [];
        return mapOrcaMachines(sessions, await this.getHostname());
    }

    async listFeatures(): Promise<IFeature[]> {
        const sessions = await this.fetchSessions();
        if (this.connectionState === "not-configured") return [];
        return mapOrcaFeatures(sessions);
    }

    /** orca has no cost-preset/role-model concept (non-goal per the spec)
     * — always empty; `CostPresetsPanel` already renders fine with 0
     * presets (Board just won't show the panel). */
    listCostPresets(): Promise<IFleetCostPreset[]> {
        return Promise.resolve([]);
    }

    dispatchSession(_sessionId: string, _machineId: string): Promise<void> {
        return Promise.reject(new Error(DISPATCH_UNSUPPORTED_MESSAGE));
    }

    pauseSession(_sessionId: string): Promise<void> {
        return Promise.reject(new Error(PAUSE_RESUME_UNSUPPORTED_MESSAGE));
    }

    resumeSession(_sessionId: string): Promise<void> {
        return Promise.reject(new Error(PAUSE_RESUME_UNSUPPORTED_MESSAGE));
    }

    subscribe(listener: FleetEventListener): () => void {
        this.listeners.add(listener);
        listener({ type: "connection", state: this.connectionState });
        if (this.listeners.size === 1) {
            this.start();
        } else {
            // A later subscriber piggybacks on the already-running poll
            // loop but still wants an immediate snapshot.
            void this.refreshAndEmit();
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.stop();
        };
    }

    private start(): void {
        void this.refreshAndEmit();
        this.pollHandle = setInterval(() => {
            void this.refreshAndEmit();
        }, POLL_INTERVAL_MS);
    }

    private stop(): void {
        if (this.pollHandle !== undefined) {
            clearInterval(this.pollHandle);
            this.pollHandle = undefined;
        }
    }

    private async refreshAndEmit(): Promise<void> {
        const sessions = await this.fetchSessions();
        this.emit({ type: "sessions", sessions });
        if (this.connectionState === "not-configured") {
            this.emit({ type: "machines", machines: [] });
            this.emit({ type: "features", features: [] });
            return;
        }
        this.emit({
            type: "machines",
            machines: mapOrcaMachines(sessions, await this.getHostname()),
        });
        this.emit({ type: "features", features: mapOrcaFeatures(sessions) });
    }

    /**
     * The one place this adapter shells out. `listSessions`/`listMachines`/
     * `listFeatures` and the poll loop all call this independently (one
     * `orca worktree ps --json` invocation per call) rather than sharing a
     * cache — matching `FleetdAdapter`'s per-call-fetches-fresh style at
     * the cost of an extra subprocess spawn per call; judged an acceptable
     * v1 tradeoff over adding cache-invalidation complexity for a local CLI
     * call, not an HTTP round-trip.
     */
    private async fetchSessions(): Promise<IFleetSession[]> {
        try {
            const result = await this.runner(["worktree", "ps", "--json"]);
            if (result.exitCode !== 0) {
                this.setConnectionState("not-configured");
                return [];
            }
            const sessions = mapOrcaSessions(result.stdout);
            this.setConnectionState("connected");
            return sessions;
        } catch {
            // Binary missing (ENOENT) or any other runner failure — never
            // throw into a render path (matches FleetdAdapter's contract).
            this.setConnectionState("not-configured");
            return [];
        }
    }

    /** Lazily resolved and cached for the adapter's lifetime — orca is
     * local-first, so the hostname can't change out from under a running
     * session. Falls back to `"local"` (matching `mapOrcaMachines`'s own
     * default) if `@tauri-apps/plugin-os`'s `hostname()` throws/rejects —
     * e.g. no Tauri runtime present, or the OS call itself fails. */
    private async getHostname(): Promise<string> {
        if (!this.hostnamePromise) {
            this.hostnamePromise = (async () => {
                try {
                    const name = await hostname();
                    return name ?? "local";
                } catch {
                    return "local";
                }
            })();
        }
        return this.hostnamePromise;
    }

    private setConnectionState(state: FleetConnectionState): void {
        if (this.connectionState === state) return;
        this.connectionState = state;
        this.emit({ type: "connection", state });
    }

    private emit(event: FleetEvent): void {
        for (const listener of this.listeners) listener(event);
    }
}
