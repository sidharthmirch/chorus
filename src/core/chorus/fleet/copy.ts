/**
 * W7 — Fleet. Fixed product copy (column labels, role descriptions, footer
 * hints) — exact strings from docs/rework/design/fleet.md. This is
 * Chorus's own UI copy, not data fleetd would ever report over the wire, so
 * it stays out of `protocol.ts` and out of `fixtures.ts`.
 */

import {
    FleetMetaTone,
    FleetRoleId,
    FleetSessionStatus,
    FleetSupervisorState,
    MachineStatus,
} from "./protocol";

export const FLEET_COLUMN_LABELS: Record<FleetSessionStatus, string> = {
    queued: "Queued",
    running: "Running",
    "needs-review": "Needs review",
    merged: "Merged",
};

/**
 * Tone for each column HEADER's status dot — distinct from a merged
 * card's own meta-text tone (`kanbanFormat.ts#formatSessionMeta`, which is
 * `"muted"` for merged sessions). Per the design fixture's own data, the
 * Merged *column* dot is accent (`var(--acc)`) while merged *cards* inside
 * it read muted ("yesterday", "2d ago") — the same "landed state gets the
 * accent treatment at the container level" pattern seen with ticket rows
 * in the Worktrees view (see `FleetMetaTone`'s doc comment in
 * protocol.ts). Kept as its own table rather than reusing
 * `formatSessionMeta` for a different purpose.
 */
export const FLEET_COLUMN_DOT_TONE: Record<FleetSessionStatus, FleetMetaTone> = {
    queued: "muted",
    running: "success",
    "needs-review": "warning",
    merged: "accent",
};

/** Column order for the Board's 4 kanban lanes. */
export const FLEET_COLUMN_ORDER: FleetSessionStatus[] = [
    "queued",
    "running",
    "needs-review",
    "merged",
];

/** Machines strip status dot — design/fleet.md only shows "green if online, gray if idle"; `offline` groups with `idle` (both "not currently doing work") rather than borrowing the destructive/red token, which DESIGN.md reserves for actual errors. */
export const FLEET_MACHINE_DOT_TONE: Record<MachineStatus, FleetMetaTone> = {
    online: "success",
    idle: "muted",
    offline: "muted",
};

/**
 * Supervisor strip label + tone. The design fixture embeds a literal "●"
 * inside the reviewing-state label string itself ("● reviewing now") —
 * since the UI renders a real `FleetStatusDot` (with its own `pulse` prop)
 * right next to this label, duplicating a text bullet would be redundant;
 * the dot carries that signal and the label stays plain text.
 */
export const FLEET_SUPERVISOR_LABEL: Record<FleetSupervisorState, string> = {
    idle: "idle",
    reviewing: "reviewing now",
};

export const FLEET_SUPERVISOR_TONE: Record<FleetSupervisorState, FleetMetaTone> = {
    idle: "muted",
    reviewing: "success",
};

/** Ticket statuses that still show a small "Worker" role chip — a ticket that's merged (worker's job for it is done) or not yet started (queued — no fixture example, but no worker has been assigned yet either) doesn't get one. Matches every ticket in the design fixture exactly (T-103 running + T-201/T-202 awaiting-merge all show "[● Worker]"; T-101/T-102 merged do not). */
export const FLEET_TICKET_WORKER_CHIP_STATUSES: readonly string[] = [
    "running",
    "awaiting-merge",
];

export interface IFleetRoleInfo {
    id: FleetRoleId;
    label: string;
    note: string;
}

export const FLEET_ROLES: readonly IFleetRoleInfo[] = [
    {
        id: "planner",
        label: "Planner",
        note: "Splits a feature into tickets; sizes each one.",
    },
    {
        id: "worker",
        label: "Worker · per ticket",
        note: "One per ticket, isolated in its own worktree.",
    },
    {
        id: "supervisor",
        label: "Supervisor · on demand",
        note: "Spawned when tickets land: reviews diffs, merges up, exits.",
    },
];

export const FLEET_FOOTER_HINT_BOARD =
    "drag cards between columns to dispatch";

export const FLEET_FOOTER_HINT_WORKTREES =
    "ticket worktrees merge up to the feature; supervisor merges feature → main";

export const FLEET_REVIEW_BADGE_TEXT = "awaiting you";

export const FLEET_NOT_REACHABLE_TITLE = "fleetd not reachable";

export const FLEET_NOT_CONFIGURED_TITLE = "No fleetd endpoint configured";
