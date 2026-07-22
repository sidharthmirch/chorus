# Fleet Protocol (`fleetd`)

Owner: W7. Companion to `docs/rework/design/fleet.md` (UI spec) and
`docs/rework/agents/W7-fleet.md` (implementation brief). This document is
the wire/domain contract a future `fleetd` daemon implements against —
**client-first**: this repo ships the protocol client + UI; the daemon
itself is out of scope (`docs/rework/00-ARCHITECTURE.md` §6). Keep this file
in lockstep with `src/core/chorus/fleet/protocol.ts` — same commit, every
time either changes.

## 1. What "paseo-compatible" means here

The brief asks fleetd to be "paseo-compatible where free" and to mirror
[paseo](https://github.com/getpaseo/paseo)'s naming where an equivalent
concept exists. Paseo is a real, existing project (10.9k★, MIT-ish OSS) that
orchestrates coding agents (Claude Code, Codex, OpenCode, etc.) via a local
daemon. Its public docs (`getpaseo/paseo`'s `public-docs/`) establish this
vocabulary:

| Paseo term | Paseo meaning | fleetd equivalent |
|---|---|---|
| **daemon** | backend service that runs agents on your machine | `fleetd` itself |
| **agent** / **provider** | an external CLI tool being orchestrated (Claude Code, Codex, …) | `FleetAgentId` (`IFleetSession.agent`) |
| **session** | "user interactions within the Paseo environment" — a live agent run | `IFleetSession` — the canonical wire entity, `GET /sessions` |
| **workspace** | "the place where a task happens" | (see divergences — fleetd splits this into `IFeature`/`ITicket`) |
| **worktree** | a *type* of workspace: an isolated directory + branch, one agent runs in it | `ITicket` — one ticket worktree |
| **branch-off / checkout-branch / checkout-pr** | how a worktree's branch gets created | not modeled 1:1; fleetd always branches a ticket off its feature branch |

Sources consulted: `github.com/getpaseo/paseo` README and
`public-docs/{index,worktrees,orchestration}.md` (fetched during
implementation; see PROGRESS.md decisions log for the exact URLs).

Paseo's own orchestration vocabulary is **orchestrator** (the driving agent)
and **worker**/**subagent** (a spawned, delegated agent) — it does not have
a built-in planner/worker/supervisor role split, per-role model/cost
presets, or a kanban-column status model. Those are fleetd-specific design
choices, detailed below.

## 2. Divergences from paseo (fleetd-specific concepts)

- **Two-level feature → ticket hierarchy.** Paseo's worktrees are flat (one
  workspace = one worktree = one branch). fleetd groups multiple ticket
  worktrees (`ITicket`) under one feature branch (`IFeature`), so a feature
  can be split into parallel tickets that each run in their own isolated
  worktree and later merge up into the shared feature branch before the
  feature itself merges to main.
- **On-demand supervisor.** A feature's tickets are built by worker agents;
  once ticket(s) land, fleetd spawns a supervisor agent on demand
  (`IFeatureSupervisor`) that reviews diffs, merges ticket worktrees into
  the feature branch, opens the PR to main, then exits. No paseo
  equivalent surfaced in its public docs.
- **Planner / Worker / Supervisor roles + cost presets.** `IFleetCostPreset`
  assigns a model to each of 3 fixed roles (`FleetRoleId`) and bundles them
  into named presets (Economy / Balanced / Max quality) with an estimated
  cost range. This is fleetd/Chorus product design, not a paseo concept.
- **Machines (multi-runner mesh).** Paseo's daemon model is single-host.
  `IMachine` generalizes fleetd to multiple runners a session can be
  dispatched to (`m4-mini`, `hetzner-01`, …), each with a load fraction.
- **Kanban board as the primary surface.** The 4-lane
  Queued/Running/Needs-review/Merged board (`IKanbanColumn`/`IKanbanCard`)
  is Chorus's own presentation layer over sessions, not a paseo concept.

## 3. Wire entities

Canonical TypeScript shapes live in `protocol.ts` — this section is the
prose companion, not a duplicate; if the two ever disagree, `protocol.ts`
wins and this file is stale and should be fixed.

- **`IMachine`** — a runner (`id`, `name`, `status: online|idle|offline`,
  `load: {current, max}`).
- **`IFleetSession`** — one live agent run (paseo "session"). Carries
  `agent`, `machine` (the literal string `"auto"` means "not yet dispatched
  to a specific machine" — always present, never absent), `branch`,
  `status` (`queued|running|needs-review|merged` — doubles as the kanban
  column), timestamps, and status-dependent optional fields
  (`progressPct`, `logTail`, `costUsd`, `diffAdded`/`diffRemoved`,
  `awaitingReview`, `paused`). `logTail` and the supervisor's `note` (below)
  are the only server-composed *text* fields — everything else that reads
  as "text" in the UI (elapsed time, cost, diff stat, relative day) is
  **derived client-side** from raw numbers/timestamps
  (`kanbanFormat.ts`/`worktreeFormat.ts`), deliberately mirroring
  CLAUDE.md's date-handling rule ("format dates via a helper, don't ship
  pre-formatted date strings") extended to the rest of Fleet's meta text —
  this keeps fleetd's payloads simple and guarantees the UI never drifts
  from a "queued 4m ago" string that was accurate only at send time.
- **`ITicket`** — one ticket worktree inside a feature (paseo "worktree").
  `status: queued|running|awaiting-merge|merged`.
- **`IFeature`** — a feature branch grouping `ITicket[]` plus an
  `IFeatureSupervisor` (`state: idle|reviewing`, `note`). `status`
  (`building|supervising`) is authoritative from fleetd; the "2/3 merged"
  fragment of the Worktrees badge is always derived from counting
  `tickets`, never trusted as separate server-sent text (see
  `worktreeFormat.ts#formatFeatureBadge`).
- **`IFleetCostPreset`** — `roles: Record<"planner"|"worker"|"supervisor",
  {agent, modelLabel}>` + `estimateText`. Role *labels/descriptions*
  ("Planner", "Splits a feature into tickets…") are fixed Chorus UI copy
  (`copy.ts`), not sent by fleetd — only the per-role model assignment and
  the estimate string are server data.

## 4. Transport: WebSocket-first, HTTP-poll fallback

- **HTTP base:** the endpoint configured via `app_metadata.fleet_endpoint`
  (§5), e.g. `http://localhost:9000`.
- **WebSocket:** `<ws|wss>://<host>/events`, derived from the HTTP base by
  swapping the scheme. Messages are JSON objects shaped like `FleetEvent`
  (`{"type": "sessions", "sessions": [...]}` etc.), with all `Date` fields
  as ISO 8601 strings on the wire (parsed defensively — see
  `FleetdAdapter.ts`'s `readDate`/`toFleetSession` etc.; a session/ticket/
  feature/machine missing a required field, or carrying a status outside
  the closed enum, is silently dropped rather than crashing the UI, since a
  future fleetd version may add fields/statuses this client doesn't know
  about yet).
- **HTTP-poll fallback:** if the WebSocket fails to open (or later closes/
  errors), `FleetdAdapter` polls `GET /sessions`, `GET /machines`,
  `GET /features` every 4s until the process using it unsubscribes.
  `FleetAdapter.subscribe()` emits the same `FleetEvent` union regardless of
  which transport is actually active — UI code never branches on transport.
- **Known gap:** the WebSocket path does not yet retry-with-backoff after a
  failed connect; it falls straight to polling. There is no real fleetd in
  this repo to validate a reconnect strategy against yet — revisit once one
  exists (noted in PROGRESS.md).

### Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/sessions` | `{ sessions: IFleetSession[] }` |
| GET | `/machines` | `{ machines: IMachine[] }` |
| GET | `/features` | `{ features: IFeature[] }` — **added**; not in the original design/fleet.md endpoint table, needed because the Worktrees view is first-class data, not derivable from sessions alone |
| GET | `/cost-presets` | `{ presets: IFleetCostPreset[] }` — **supersedes** design/fleet.md's singular `GET /cost-estimate`: the UI needs the role→model assignment per preset, not just an estimate string, so the richer list-shape replaces it |
| POST | `/sessions/{id}/dispatch` | body `{ machineId: string }` |
| PATCH | `/sessions/{id}` | body `{ paused: boolean }` (pause/resume only in v1; fleetd may accept other fields later) |
| WS | `/events` | pushes `FleetEvent` messages |

`POST /sessions` and `PATCH /sessions/{id}` for general field updates (from
design/fleet.md's original contract) are **not yet implemented** by the
client — v1 only needs dispatch and pause/resume; a future phase can widen
`FleetAdapter` if fleetd exposes more mutations.

## 5. Adapter swap point

`useFleetAdapter()` (`src/core/chorus/fleet/useFleet.ts`) is the single
place that decides which `FleetAdapter` backs the whole UI:

- **No `fleet_endpoint`** in `app_metadata` (the default, out of the box) →
  `MockFleetAdapter`. This is deliberate, not a placeholder: it means
  `/fleet` is fully populated and reviewable immediately after this PR
  merges, with zero daemon setup. Fixture data lives in `fixtures.ts`,
  transcribed exactly from the design mock (see its own header comment for
  the source line numbers).
- **`fleet_endpoint` set** → `FleetdAdapter` pointed at it. If fleetd isn't
  actually reachable there, the adapter reports `"disconnected"` (or stays
  `"connecting"`/`"not-configured"`) rather than silently falling back to
  mock data — a user who configured a real endpoint should see an honest
  "fleetd not reachable" state, never fabricated sessions.

`fleet_cost_preset` is a second, independent `app_metadata` key (P4) that
only persists the user's selected preset id; it does not affect adapter
selection.

## 6. Status enum reference

| Enum | Values |
|---|---|
| `FleetSessionStatus` | `queued`, `running`, `needs-review`, `merged` |
| `FleetTicketStatus` | `queued`, `running`, `awaiting-merge`, `merged` |
| `FleetFeatureStatus` | `building`, `supervising` |
| `FleetSupervisorState` | `idle`, `reviewing` |
| `MachineStatus` | `online`, `idle`, `offline` |
| `FleetConnectionState` | `connected`, `connecting`, `disconnected`, `not-configured` |
