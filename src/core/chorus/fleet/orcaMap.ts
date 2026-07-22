/**
 * Fleet ↔ Orca integration. Pure JSON -> Fleet-protocol mapping for the
 * `OrcaCliAdapter` backend (`OrcaCliAdapter.ts`). Deliberately free of any
 * process-spawning or Tauri import (see `orcaCommand.ts` for that boundary)
 * so every function here is directly unit-testable against fixture strings
 * — mirroring `FleetdAdapter.ts`'s defensive-parsing style: no `as`, drop a
 * malformed entry instead of throwing, never let one bad record blow up the
 * whole list.
 *
 * ---------------------------------------------------------------------
 * IMPORTANT — every field name read below is ASSUMED, NOT VERIFIED. `orca`
 * is not installed in this dev environment, and onorca.dev/docs/cli does
 * not publish the JSON schema of `orca worktree ps --json` / `orca
 * terminal read --json` (see docs/rework/fleet-orca-integration.md, which
 * grounds the assumed shape in the flags `orca worktree create` documents).
 * Field names are isolated behind small, well-commented helpers so fixing
 * them — once a real orca install exists to inspect — is a small, local
 * edit. Flagged again on the user-test queue in `.rework/orca-PROGRESS.md`.
 * ---------------------------------------------------------------------
 */

import {
    FleetSessionStatus,
    FleetTicketStatus,
    IFeature,
    IFleetSession,
    IMachine,
    ITicket,
} from "./protocol";

// ---------------------------------------------------------------------------
// Defensive JSON reading (mirrors FleetdAdapter.ts's isRecord/readString/etc)
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

function readDate(value: unknown, fallback: Date): Date {
    const raw = readString(value);
    if (!raw) return fallback;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

// ---------------------------------------------------------------------------
// `orca worktree ps --json` (assumed to also cover `orca worktree current
// --json`, which plausibly returns one worktree object of the same shape)
// ---------------------------------------------------------------------------

/**
 * ASSUMED shape — grounded in the `orca worktree create --repo id:<repoId>
 * --name <name> [--issue <n>]` flags documented in
 * docs/rework/fleet-orca-integration.md (a `ps` listing plausibly echoes
 * back what `create` accepts, plus live status/timing fields):
 *
 * ```json
 * {
 *   "worktrees": [
 *     {
 *       "id": "wt_9f2a1b",
 *       "name": "fix-oauth-refresh",
 *       "repoId": "chorus",
 *       "branch": "fix/oauth-refresh",
 *       "agent": "claude-code",
 *       "status": "running",
 *       "createdAt": "2026-07-21T17:48:00.000Z",
 *       "updatedAt": "2026-07-21T18:00:00.000Z",
 *       "issue": 42,
 *       "path": "/Users/dev/repos/chorus/.orca/wt/fix-oauth-refresh"
 *     }
 *   ]
 * }
 * ```
 *
 * Also tolerates a bare top-level array (`[{ ... }]`) — it is equally
 * plausible the CLI omits the `worktrees` wrapper; unverified either way,
 * so this reads defensively for both.
 */
function readWorktreeList(json: unknown): unknown[] {
    if (Array.isArray(json)) return json;
    if (isRecord(json) && Array.isArray(json.worktrees)) return json.worktrees;
    return [];
}

/** Parses `orca worktree ps --json`'s stdout into a raw, untyped list —
 * malformed JSON degrades to `[]` rather than throwing. */
export function parseOrcaWorktreePs(stdout: string): unknown[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        return [];
    }
    return readWorktreeList(parsed);
}

/**
 * Maps orca's worktree/agent status vocabulary (ASSUMED — not documented)
 * onto `FleetSessionStatus`. Conservative default: an unrecognized/unknown
 * status (including orca states we simply haven't seen yet, like "idle")
 * reads as `"running"` — the worktree exists and is presumably doing
 * something — rather than guessing "needs-review"/"merged", which would be
 * a much more misleading default to get wrong.
 */
export function mapOrcaStatus(rawStatus: unknown): FleetSessionStatus {
    const value = readString(rawStatus)?.toLowerCase();
    switch (value) {
        case "queued":
        case "pending":
        case "creating":
            return "queued";
        case "needs-review":
        case "needs_review":
        case "review":
        case "awaiting-review":
        case "awaiting_review":
            return "needs-review";
        case "merged":
        case "done":
        case "completed":
        case "closed":
            return "merged";
        default:
            // Covers "running", "active", "in-progress", "idle", and any
            // future/unrecognized value — see doc comment above.
            return "running";
    }
}

const DEFAULT_AGENT = "unknown";
const ORCA_FEATURE_PREFIX = "orca-feature-";
const UNGROUPED_FEATURE_ID = `${ORCA_FEATURE_PREFIX}ungrouped`;

function orcaFeatureId(repoId: string): string {
    return `${ORCA_FEATURE_PREFIX}${repoId}`;
}

function mapWorktreeSession(raw: unknown, now: Date): IFleetSession | undefined {
    if (!isRecord(raw)) return undefined;
    const id = readString(raw.id);
    if (!id) return undefined;
    const name = readString(raw.name) ?? id;
    const branch = readString(raw.branch) ?? name;
    const agent = readString(raw.agent) ?? DEFAULT_AGENT;
    const status = mapOrcaStatus(raw.status);
    const createdAt = readDate(raw.createdAt, now);
    const updatedAt = readDate(raw.updatedAt, createdAt);
    // ASSUMED field name: `repoId` (falls back to `repo`) — see file header.
    const repoId = readString(raw.repoId) ?? readString(raw.repo);
    return {
        id,
        title: name,
        agent,
        // orca is local-first / single-host in v1 (non-goal: remote `orca
        // serve` hosts) — every session runs on the one synthesized
        // "local" IMachine, see mapOrcaMachines below.
        machine: "local",
        branch,
        status,
        createdAt,
        updatedAt,
        progressPct: readNumber(raw.progressPct),
        featureId: repoId ? orcaFeatureId(repoId) : undefined,
        ticketId: id,
    };
}

/** Maps `orca worktree ps --json`'s stdout directly into `IFleetSession[]` —
 * the one entry point `OrcaCliAdapter.listSessions()`/polling loop uses. */
export function mapOrcaSessions(
    stdout: string,
    now: Date = new Date(),
): IFleetSession[] {
    return parseOrcaWorktreePs(stdout)
        .map((raw) => mapWorktreeSession(raw, now))
        .filter(isDefined);
}

// ---------------------------------------------------------------------------
// Machines — orca is local-first (no remote-host concept in v1, see the
// spec's non-goals); represent the single local host as one `IMachine`.
// ---------------------------------------------------------------------------

/** Sane default cap for "how many parallel worktrees before the local host
 * reads as fully loaded" — orca doesn't report a machine capacity, so this
 * is a Chorus-side product guess, not a value the CLI sends. */
const LOCAL_MACHINE_LOAD_CAP = 4;

export function mapOrcaMachines(
    sessions: readonly IFleetSession[],
    hostname = "local",
): IMachine[] {
    const running = sessions.filter((s) => s.status === "running").length;
    return [
        {
            id: "local",
            name: hostname,
            status: "online",
            load: {
                current: running,
                max: Math.max(running, LOCAL_MACHINE_LOAD_CAP),
            },
        },
    ];
}

// ---------------------------------------------------------------------------
// Features/tickets — orca has no feature/ticket grouping concept (that's
// fleetd's own two-level model, fleet-protocol.md §2). v1 simplification
// per docs/rework/fleet-orca-integration.md: one synthetic `IFeature` per
// distinct repo id, with one `ITicket` per session in that repo — a 1:1
// mirror of the session, since an orca worktree already *is* the smallest
// unit here; there is no further per-ticket breakdown to recover from the
// CLI. Sessions with no recoverable repo id all collapse into a single
// "ungrouped" feature (the doc's "emit one feature per repo" simplification,
// taken to its limit when no repo info is present at all).
// ---------------------------------------------------------------------------

const SESSION_TO_TICKET_STATUS: Record<FleetSessionStatus, FleetTicketStatus> =
    {
        queued: "queued",
        running: "running",
        "needs-review": "awaiting-merge",
        merged: "merged",
    };

function sessionToTicket(session: IFleetSession): ITicket {
    return {
        id: session.id,
        title: session.title,
        worktreePath: session.branch,
        status: SESSION_TO_TICKET_STATUS[session.status],
        progressPct: session.progressPct,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        sessionId: session.id,
    };
}

function earliest(dates: readonly Date[]): Date {
    return dates.reduce((a, b) => (a < b ? a : b));
}

function latest(dates: readonly Date[]): Date {
    return dates.reduce((a, b) => (a > b ? a : b));
}

export function mapOrcaFeatures(sessions: readonly IFleetSession[]): IFeature[] {
    const byFeature = new Map<string, IFleetSession[]>();
    for (const session of sessions) {
        const featureId = session.featureId ?? UNGROUPED_FEATURE_ID;
        const group = byFeature.get(featureId);
        if (group) group.push(session);
        else byFeature.set(featureId, [session]);
    }

    const features: IFeature[] = [];
    for (const [featureId, group] of byFeature) {
        const title =
            featureId === UNGROUPED_FEATURE_ID
                ? "Orca worktrees"
                : featureId.slice(ORCA_FEATURE_PREFIX.length);
        features.push({
            id: featureId,
            branch: group[0].branch,
            title,
            worktreePath: group[0].branch,
            // orca has no supervisor/merge-up concept — always "building".
            // Documented divergence from fleetd's own two-level model.
            status: "building",
            tickets: group.map(sessionToTicket),
            supervisor: {
                state: "idle",
                note: "not modeled by the orca backend (v1) — orca has no on-demand supervisor concept",
            },
            createdAt: earliest(group.map((s) => s.createdAt)),
            updatedAt: latest(group.map((s) => s.updatedAt)),
        });
    }
    return features;
}

// ---------------------------------------------------------------------------
// `orca terminal read --json` — best-effort log line. NOT currently wired
// into `OrcaCliAdapter`'s polling loop (would require one extra subprocess
// spawn per worktree per poll tick — an N+1 cost judged not worth paying in
// v1 for a "last log line" nicety); exposed here, tested against a fixture,
// and left as a documented seam for a future per-session enrichment pass.
// ---------------------------------------------------------------------------

/**
 * ASSUMED shape:
 * ```json
 * { "lines": [ { "text": "▸ RefreshScheduler.test.ts 41/44" } ] }
 * ```
 */
export function mapOrcaLogLine(stdout: string): string | undefined {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        return undefined;
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.lines)) return undefined;
    const last: unknown = parsed.lines[parsed.lines.length - 1];
    if (!isRecord(last)) return undefined;
    return readString(last.text);
}
