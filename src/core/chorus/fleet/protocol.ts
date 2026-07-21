/**
 * W7 — Fleet. Typed protocol for `fleetd`, our own agent-orchestration
 * daemon (client-first: Chorus ships the UI + this protocol client; the
 * daemon itself is out of repo scope — see docs/rework/00-ARCHITECTURE.md
 * §6 and docs/rework/agents/W7-fleet.md).
 *
 * This file is the wire/domain layer only: plain data shapes, no React, no
 * fetch/WebSocket code, no display formatting (see `kanbanFormat.ts` /
 * `agentDisplay.ts` / `copy.ts` for presentation). Keep it in lockstep with
 * `docs/rework/fleet-protocol.md` — that doc explains *why* each shape looks
 * the way it does (paseo alignment/divergence notes); this file is the
 * source of truth for *what* it looks like.
 */

// ---------------------------------------------------------------------------
// Agents & machines
// ---------------------------------------------------------------------------

/**
 * Raw agent identifier as reported by fleetd, e.g. "claude-code", "codex".
 * Deliberately a plain `string`, not a closed union: fleetd can add agents
 * Chorus doesn't recognize yet (paseo calls these "providers" — any ACP-
 * compatible CLI agent). `agentDisplay.ts` maps known ids to a
 * `ProviderLogo`-compatible provider name and falls back to a generic glyph
 * for unknown ones, so an unrecognized id degrades gracefully rather than
 * breaking the UI.
 */
export type FleetAgentId = string;

export type MachineStatus = "online" | "idle" | "offline";

/** A runner fleetd can dispatch sessions to. No paseo equivalent (paseo's daemon model is single-host); "machines" is fleetd's own multi-runner-mesh concept. */
export interface IMachine {
    id: string;
    name: string;
    status: MachineStatus;
    load: {
        current: number;
        max: number;
    };
}

// ---------------------------------------------------------------------------
// Sessions — paseo-equivalent concept: a live agent run ("session" in
// paseo's own terminology). This is the canonical wire entity; `GET
// /sessions` (see fleet-protocol.md) returns these. `IKanbanCard` below is a
// presentation-layer view over this data, not a second copy of the wire
// shape — see `kanbanFormat.ts`.
// ---------------------------------------------------------------------------

/** Kanban column identity — also fleetd's session lifecycle status. */
export type FleetSessionStatus =
    | "queued"
    | "running"
    | "needs-review"
    | "merged";

export interface IFleetSession {
    id: string;
    title: string;
    agent: FleetAgentId;
    /**
     * Machine name/id the session is running on. fleetd's own sentinel
     * value `"auto"` means "not yet dispatched to a specific machine" — it
     * is always a concrete string, never absent, matching the design
     * fixture (`machine: "auto"` on queued cards) and the Dispatch
     * interaction (picking a machine replaces "auto" with a real name).
     */
    machine: string;
    branch: string;
    status: FleetSessionStatus;
    createdAt: Date;
    updatedAt: Date;
    /** 0-100. Present while running or awaiting review; absent otherwise. */
    progressPct?: number;
    /** Last log line, tool-tail style, e.g. "▸ RefreshScheduler.test.ts 41/44". Server-composed human-readable text — passed through verbatim like a status line, not reformatted client-side. */
    logTail?: string;
    /** Accrued cost so far. Present for running/merged sessions. Render via `formatCost` (existing `CostAPI.ts` convention), never a raw literal. */
    costUsd?: number;
    /** Diff size once a review is ready. Present for needs-review (and sometimes merged) sessions. */
    diffAdded?: number;
    diffRemoved?: number;
    /**
     * True when fleetd is explicitly flagging this session as awaiting
     * human review (independent of `status === "needs-review"` so a
     * session can surface a review badge without necessarily being a
     * kanban card in that exact column — kept distinct per the design
     * fixture's own separate `hasReview` flag).
     */
    awaitingReview?: boolean;
    /**
     * True while a *running* session is paused (design/fleet.md's "[P]
     * pause button... progress freezes"). Deliberately a flag rather than
     * a 5th `FleetSessionStatus` value: a paused session stays in the
     * Running column, just visually frozen — it does not need a column of
     * its own. Meaningless (and always undefined/false) outside `status
     * === "running"`.
     */
    paused?: boolean;
    /** Links a session back to the ticket/feature it's fulfilling, when dispatched from the Worktrees view. Undefined for standalone board tasks with no feature breakdown. */
    ticketId?: string;
    featureId?: string;
}

// ---------------------------------------------------------------------------
// Kanban — Board view-model layer. Built from `IFleetSession[]` by
// `kanbanFormat.ts`'s pure functions; never constructed by an adapter
// directly, so adapters/tests only ever have to deal with `IFleetSession`.
// ---------------------------------------------------------------------------

/**
 * Shared presentation tone vocabulary for meta text/dots across sessions,
 * tickets, and features. `"accent"` is distinct from `"success"`: per the
 * design fixture, a *merged ticket* inside the Worktrees view uses the
 * accent (Toasted Sand) token ("merged ✓", `var(--acc)`) to read as "landed"
 * — a different signal from a *merged kanban card* on the Board, which
 * fades to `"muted"` since it has left the active board entirely. Keep both
 * distinct rather than collapsing them.
 */
export type FleetMetaTone = "muted" | "success" | "warning" | "accent";

export interface IKanbanCard {
    session: IFleetSession;
    /** Precomputed display text for the meta row, e.g. "queued 4m" / "12m · $0.84" / "+412 −38" / "yesterday". */
    metaText: string;
    metaTone: FleetMetaTone;
    /** Renders the quiet "awaiting you" badge — see `IFleetSession.awaitingReview`. */
    hasReviewBadge: boolean;
}

export interface IKanbanColumn {
    status: FleetSessionStatus;
    label: string;
    cards: IKanbanCard[];
}

// ---------------------------------------------------------------------------
// Worktrees — feature branch -> ticket worktrees -> on-demand supervisor.
// paseo-equivalent concept: a "worktree" is paseo's isolated workspace
// (its own directory + branch, one agent runs in it) — that maps onto our
// `ITicket`. paseo's worktrees are flat (one workspace = one worktree);
// fleetd's `IFeature` grouping multiple `ITicket`s under one feature branch,
// with an on-demand supervisor that merges tickets up before the feature
// merges to main, is fleetd's own addition — noted as a divergence in
// fleet-protocol.md.
// ---------------------------------------------------------------------------

export type FleetTicketStatus =
    | "queued"
    | "running"
    | "awaiting-merge"
    | "merged";

export interface ITicket {
    id: string;
    title: string;
    /** e.g. "wt/agents-dash/t101" — the worktree path relative to the feature's own worktree root. */
    worktreePath: string;
    status: FleetTicketStatus;
    /** 0-100. Present while running. */
    progressPct?: number;
    createdAt: Date;
    updatedAt: Date;
    /** The live session currently fulfilling this ticket, if any. */
    sessionId?: string;
}

export type FleetFeatureStatus = "building" | "supervising";

export type FleetSupervisorState = "idle" | "reviewing";

export interface IFeatureSupervisor {
    state: FleetSupervisorState;
    /** Server-composed status note, e.g. "diffing T-201 + T-202 → merge to parent worktree, then PR to main". Same treatment as `logTail`: verbatim passthrough. */
    note: string;
}

export interface IFeature {
    id: string;
    branch: string;
    title: string;
    /** e.g. "~/fleet/wt/agents-dash" — the feature's own worktree root. */
    worktreePath: string;
    status: FleetFeatureStatus;
    tickets: ITicket[];
    supervisor: IFeatureSupervisor;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Cost presets & roles
// ---------------------------------------------------------------------------

export type FleetRoleId = "planner" | "worker" | "supervisor";

export interface IFleetRoleAssignment {
    agent: FleetAgentId;
    modelLabel: string;
}

export interface IFleetCostPreset {
    id: string;
    name: string;
    roles: Record<FleetRoleId, IFleetRoleAssignment>;
    /** Fixed copy from fleetd, e.g. "est $0.40–0.90 per feature · lint/test passes fall back to local qwen3 (free)". */
    estimateText: string;
}

// ---------------------------------------------------------------------------
// Connection & event stream — WebSocket-first with HTTP-poll fallback (see
// fleet-protocol.md §4). `FleetAdapter.subscribe` (FleetAdapter.ts) emits
// these regardless of which transport is actually active, so UI code never
// branches on transport.
// ---------------------------------------------------------------------------

export type FleetConnectionState =
    | "connected"
    | "connecting"
    | "disconnected"
    | "not-configured";

export type FleetEvent =
    | { type: "sessions"; sessions: IFleetSession[] }
    | { type: "machines"; machines: IMachine[] }
    | { type: "features"; features: IFeature[] }
    | { type: "connection"; state: FleetConnectionState };
