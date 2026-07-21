import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { FleetAdapter, FleetEventListener } from "./FleetAdapter";
import {
    FleetConnectionState,
    FleetFeatureStatus,
    FleetSessionStatus,
    FleetSupervisorState,
    FleetTicketStatus,
    IFeature,
    IFleetCostPreset,
    IFleetSession,
    IMachine,
    ITicket,
    MachineStatus,
} from "./protocol";

/**
 * Real adapter skeleton for a `fleetd` instance — see
 * docs/rework/fleet-protocol.md for the full HTTP/WebSocket contract this
 * implements. There is no daemon in this repo to test against (client-
 * first scope — see docs/rework/00-ARCHITECTURE.md §6), so this is
 * deliberately conservative: every parse is defensive (no `as`, matching
 * the pattern in `accounts/nineRouterClient.ts`), and every failure mode
 * degrades to an empty result + a `"disconnected"`/`"not-configured"`
 * connection state rather than throwing out of a render path. Dispatch/
 * pause/resume DO throw on failure — those are user-initiated actions where
 * the caller (a mutation in `useFleet.ts`) wants to catch and toast.
 *
 * Transport: WebSocket-first, HTTP-poll fallback (fleet-protocol.md §4).
 * The WS side intentionally does not implement reconnect-with-backoff yet —
 * there is nothing real to validate that against; see PROGRESS.md.
 */

type FetchLike = typeof fetch;

const POLL_INTERVAL_MS = 4000;

// ---------------------------------------------------------------------------
// Defensive JSON parsing (no `as` — mirrors nineRouterClient.ts's approach)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function readDate(value: unknown): Date | undefined {
    const raw = readString(value);
    if (!raw) return undefined;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const SESSION_STATUSES: readonly FleetSessionStatus[] = [
    "queued",
    "running",
    "needs-review",
    "merged",
];

const TICKET_STATUSES: readonly FleetTicketStatus[] = [
    "queued",
    "running",
    "awaiting-merge",
    "merged",
];

const MACHINE_STATUSES: readonly MachineStatus[] = ["online", "idle", "offline"];
const FEATURE_STATUSES: readonly FleetFeatureStatus[] = [
    "building",
    "supervising",
];
const SUPERVISOR_STATES: readonly FleetSupervisorState[] = ["idle", "reviewing"];

function readEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
): T | undefined {
    const str = readString(value);
    return str && (allowed as readonly string[]).includes(str)
        ? (allowed.find((a) => a === str) as T)
        : undefined;
}

function toMachine(value: unknown): IMachine | undefined {
    if (!isRecord(value)) return undefined;
    const id = readString(value.id) ?? readString(value.name);
    const name = readString(value.name) ?? id;
    const status = readEnum(value.status, MACHINE_STATUSES);
    const load = value.load;
    if (!id || !name || !status || !isRecord(load)) return undefined;
    const current = readNumber(load.current);
    const max = readNumber(load.max);
    if (current === undefined || max === undefined) return undefined;
    return { id, name, status, load: { current, max } };
}

function toFleetSession(value: unknown): IFleetSession | undefined {
    if (!isRecord(value)) return undefined;
    const id = readString(value.id);
    const title = readString(value.title);
    const agent = readString(value.agent);
    const machine = readString(value.machine);
    const branch = readString(value.branch);
    const status = readEnum(value.status, SESSION_STATUSES);
    const createdAt = readDate(value.createdAt);
    const updatedAt = readDate(value.updatedAt);
    if (
        !id ||
        !title ||
        !agent ||
        !machine ||
        !branch ||
        !status ||
        !createdAt ||
        !updatedAt
    ) {
        return undefined;
    }
    return {
        id,
        title,
        agent,
        machine,
        branch,
        status,
        createdAt,
        updatedAt,
        progressPct: readNumber(value.progressPct),
        logTail: readString(value.logTail),
        costUsd: readNumber(value.costUsd),
        diffAdded: readNumber(value.diffAdded),
        diffRemoved: readNumber(value.diffRemoved),
        awaitingReview: readBoolean(value.awaitingReview, false),
        paused: readBoolean(value.paused, false),
        ticketId: readString(value.ticketId),
        featureId: readString(value.featureId),
    };
}

function toTicket(value: unknown): ITicket | undefined {
    if (!isRecord(value)) return undefined;
    const id = readString(value.id);
    const title = readString(value.title);
    const worktreePath = readString(value.worktreePath);
    const status = readEnum(value.status, TICKET_STATUSES);
    const createdAt = readDate(value.createdAt);
    const updatedAt = readDate(value.updatedAt);
    if (!id || !title || !worktreePath || !status || !createdAt || !updatedAt) {
        return undefined;
    }
    return {
        id,
        title,
        worktreePath,
        status,
        createdAt,
        updatedAt,
        progressPct: readNumber(value.progressPct),
        sessionId: readString(value.sessionId),
    };
}

function toFeature(value: unknown): IFeature | undefined {
    if (!isRecord(value)) return undefined;
    const id = readString(value.id);
    const branch = readString(value.branch);
    const title = readString(value.title);
    const worktreePath = readString(value.worktreePath);
    const status = readEnum(value.status, FEATURE_STATUSES);
    const createdAt = readDate(value.createdAt);
    const updatedAt = readDate(value.updatedAt);
    const supervisorValue = value.supervisor;
    if (
        !id ||
        !branch ||
        !title ||
        !worktreePath ||
        !status ||
        !createdAt ||
        !updatedAt ||
        !isRecord(supervisorValue) ||
        !Array.isArray(value.tickets)
    ) {
        return undefined;
    }
    const supervisorState = readEnum(supervisorValue.state, SUPERVISOR_STATES);
    const supervisorNote = readString(supervisorValue.note);
    if (!supervisorState || supervisorNote === undefined) return undefined;
    const tickets: ITicket[] = [];
    for (const rawTicket of value.tickets) {
        const ticket = toTicket(rawTicket);
        if (ticket) tickets.push(ticket);
    }
    return {
        id,
        branch,
        title,
        worktreePath,
        status,
        createdAt,
        updatedAt,
        supervisor: { state: supervisorState, note: supervisorNote },
        tickets,
    };
}

function toRoleAssignment(
    value: unknown,
): { agent: string; modelLabel: string } | undefined {
    if (!isRecord(value)) return undefined;
    const agent = readString(value.agent);
    const modelLabel = readString(value.modelLabel);
    if (!agent || !modelLabel) return undefined;
    return { agent, modelLabel };
}

function toCostPreset(value: unknown): IFleetCostPreset | undefined {
    if (!isRecord(value)) return undefined;
    const id = readString(value.id);
    const name = readString(value.name);
    const estimateText = readString(value.estimateText);
    const rolesValue = value.roles;
    if (!id || !name || !estimateText || !isRecord(rolesValue)) return undefined;
    const planner = toRoleAssignment(rolesValue.planner);
    const worker = toRoleAssignment(rolesValue.worker);
    const supervisor = toRoleAssignment(rolesValue.supervisor);
    if (!planner || !worker || !supervisor) return undefined;
    return { id, name, estimateText, roles: { planner, worker, supervisor } };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class FleetdAdapter implements FleetAdapter {
    readonly kind = "fleetd" as const;

    private connectionState: FleetConnectionState;
    private ws: WebSocket | undefined;
    private pollHandle: ReturnType<typeof setInterval> | undefined;
    private readonly listeners = new Set<FleetEventListener>();

    constructor(
        private readonly endpoint: string | undefined,
        private readonly fetchImpl: FetchLike = tauriFetch,
    ) {
        this.connectionState = endpoint ? "connecting" : "not-configured";
    }

    getConnectionState(): FleetConnectionState {
        return this.connectionState;
    }

    async listSessions(): Promise<IFleetSession[]> {
        const json = await this.get("/sessions");
        if (!isRecord(json) || !Array.isArray(json.sessions)) return [];
        return json.sessions.map(toFleetSession).filter(isDefined);
    }

    async listMachines(): Promise<IMachine[]> {
        const json = await this.get("/machines");
        if (!isRecord(json) || !Array.isArray(json.machines)) return [];
        return json.machines.map(toMachine).filter(isDefined);
    }

    async listFeatures(): Promise<IFeature[]> {
        // Not in the original design/fleet.md endpoint table (which only
        // lists /sessions, /machines, /cost-estimate) — added because the
        // Worktrees view needs the feature/ticket tree as first-class data.
        // See fleet-protocol.md §3's divergences note.
        const json = await this.get("/features");
        if (!isRecord(json) || !Array.isArray(json.features)) return [];
        return json.features.map(toFeature).filter(isDefined);
    }

    async listCostPresets(): Promise<IFleetCostPreset[]> {
        // Supersedes design/fleet.md's singular `GET /cost-estimate` (an
        // estimate string alone can't drive the role/model chips) — see
        // fleet-protocol.md §3.
        const json = await this.get("/cost-presets");
        if (!isRecord(json) || !Array.isArray(json.presets)) return [];
        return json.presets.map(toCostPreset).filter(isDefined);
    }

    async dispatchSession(sessionId: string, machineId: string): Promise<void> {
        await this.post(`/sessions/${encodeURIComponent(sessionId)}/dispatch`, {
            machineId,
        });
    }

    async pauseSession(sessionId: string): Promise<void> {
        await this.patch(`/sessions/${encodeURIComponent(sessionId)}`, {
            paused: true,
        });
    }

    async resumeSession(sessionId: string): Promise<void> {
        await this.patch(`/sessions/${encodeURIComponent(sessionId)}`, {
            paused: false,
        });
    }

    subscribe(listener: FleetEventListener): () => void {
        this.listeners.add(listener);
        listener({ type: "connection", state: this.connectionState });

        if (this.listeners.size === 1) {
            this.start();
        } else {
            // A later subscriber piggybacks on the already-running
            // transport but still wants an immediate snapshot.
            void this.refreshAll();
        }

        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.stop();
        };
    }

    private start(): void {
        if (!this.endpoint) {
            this.setConnectionState("not-configured");
            return;
        }
        this.setConnectionState("connecting");
        this.connectWebSocket();
        // Always poll once immediately regardless of WS outcome, so data
        // shows up even if the socket handshake is still in flight.
        void this.refreshAll();
    }

    private stop(): void {
        this.ws?.close();
        this.ws = undefined;
        if (this.pollHandle !== undefined) {
            clearInterval(this.pollHandle);
            this.pollHandle = undefined;
        }
    }

    private connectWebSocket(): void {
        if (!this.endpoint) return;
        let wsUrl: string;
        try {
            const url = new URL("/events", this.endpoint);
            url.protocol = url.protocol === "https" ? "wss" : "ws";
            wsUrl = url.toString();
        } catch {
            this.startPolling();
            return;
        }

        try {
            const socket = new WebSocket(wsUrl);
            this.ws = socket;
            socket.addEventListener("open", () => {
                this.setConnectionState("connected");
                // WebSocket is live — HTTP polling would be redundant.
                this.stopPolling();
            });
            socket.addEventListener("message", (event: MessageEvent) => {
                this.handleWireMessage(event.data);
            });
            socket.addEventListener("close", () => {
                this.ws = undefined;
                this.setConnectionState("disconnected");
                this.startPolling();
            });
            socket.addEventListener("error", () => {
                this.startPolling();
            });
        } catch {
            this.startPolling();
        }
    }

    private handleWireMessage(data: unknown): void {
        if (typeof data !== "string") return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch {
            return;
        }
        if (!isRecord(parsed)) return;
        const type = readString(parsed.type);
        if (type === "sessions" && Array.isArray(parsed.sessions)) {
            this.emit({
                type: "sessions",
                sessions: parsed.sessions.map(toFleetSession).filter(isDefined),
            });
        } else if (type === "machines" && Array.isArray(parsed.machines)) {
            this.emit({
                type: "machines",
                machines: parsed.machines.map(toMachine).filter(isDefined),
            });
        } else if (type === "features" && Array.isArray(parsed.features)) {
            this.emit({
                type: "features",
                features: parsed.features.map(toFeature).filter(isDefined),
            });
        }
    }

    private startPolling(): void {
        if (this.pollHandle !== undefined) return;
        this.pollHandle = setInterval(() => {
            void this.refreshAll();
        }, POLL_INTERVAL_MS);
    }

    private stopPolling(): void {
        if (this.pollHandle === undefined) return;
        clearInterval(this.pollHandle);
        this.pollHandle = undefined;
    }

    private async refreshAll(): Promise<void> {
        if (!this.endpoint) return;
        try {
            const [sessions, machines, features] = await Promise.all([
                this.listSessions(),
                this.listMachines(),
                this.listFeatures(),
            ]);
            this.setConnectionState("connected");
            this.emit({ type: "sessions", sessions });
            this.emit({ type: "machines", machines });
            this.emit({ type: "features", features });
        } catch {
            this.setConnectionState("disconnected");
        }
    }

    private setConnectionState(state: FleetConnectionState): void {
        if (this.connectionState === state) return;
        this.connectionState = state;
        this.emit({ type: "connection", state });
    }

    private emit(event: import("./protocol").FleetEvent): void {
        for (const listener of this.listeners) listener(event);
    }

    private async get(path: string): Promise<unknown> {
        if (!this.endpoint) return undefined;
        try {
            const response = await this.fetchImpl(`${this.endpoint}${path}`);
            if (!response.ok) return undefined;
            return await response.json();
        } catch {
            return undefined;
        }
    }

    private async post(path: string, body: unknown): Promise<void> {
        if (!this.endpoint) {
            throw new Error("fleetd endpoint not configured");
        }
        const response = await this.fetchImpl(`${this.endpoint}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`fleetd returned ${response.status} for POST ${path}`);
        }
    }

    private async patch(path: string, body: unknown): Promise<void> {
        if (!this.endpoint) {
            throw new Error("fleetd endpoint not configured");
        }
        const response = await this.fetchImpl(`${this.endpoint}${path}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`fleetd returned ${response.status} for PATCH ${path}`);
        }
    }
}

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}
