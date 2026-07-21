/**
 * W7 — Fleet. Fixed product copy (column labels, role descriptions, footer
 * hints) — exact strings from docs/rework/design/fleet.md. This is
 * Chorus's own UI copy, not data fleetd would ever report over the wire, so
 * it stays out of `protocol.ts` and out of `fixtures.ts`.
 */

import { FleetRoleId, FleetSessionStatus } from "./protocol";

export const FLEET_COLUMN_LABELS: Record<FleetSessionStatus, string> = {
    queued: "Queued",
    running: "Running",
    "needs-review": "Needs review",
    merged: "Merged",
};

/** Column order for the Board's 4 kanban lanes. */
export const FLEET_COLUMN_ORDER: FleetSessionStatus[] = [
    "queued",
    "running",
    "needs-review",
    "merged",
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
