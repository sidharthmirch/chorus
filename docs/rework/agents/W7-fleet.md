# W7 — Fleet (Board + Worktrees UI, fleetd protocol client)

Branch: `claude/rework-fleet` · Worktree: `../chorus-wt-w7`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §6 (your frozen contract),
`docs/rework/design/fleet.md`, then this file.

## Mission

Build the Fleet surface: a kanban **Board** of agent runs
(Queued / Running / Needs review / Merged) and a **Worktrees** view (feature
branch → ticket worktrees with planner/worker/supervisor roles), cost
presets, and a machines strip — talking our own `fleetd` protocol
(paseo-compatible). **Client-first:** the daemon is out of scope; you ship
the typed protocol, an adapter interface, a mock adapter with the design's
fixture data, and the full UI.

## Scope guard (important)

You are NOT building an agent orchestrator. You are building:
1. `src/core/chorus/fleet/protocol.ts` — typed protocol: `IFleetSession`,
   `IFeature`, `ITicket`, `IMachine`, `IKanbanCard`, status enums, event
   stream shapes. Design the wire format WebSocket-first with HTTP polling
   fallback; document it in `docs/rework/fleet-protocol.md` (committed) so a
   future fleetd implements against it. Where paseo has an equivalent
   concept (sessions, worktrees, agents), mirror its naming — that's the
   "paseo-compatible" requirement; note divergences in the protocol doc.
2. `FleetAdapter` interface + `MockFleetAdapter` (fixture data below) +
   `FleetdAdapter` skeleton (connects, degrades gracefully to
   "fleetd not reachable" state when endpoint absent).
3. The UI.

If you find yourself writing process-spawning or git-executing code, stop —
that's fleetd's job.

## Fixture data (from the design mock — seed MockFleetAdapter with exactly this)

- Machines: `m4-mini` (2/2, ok), `hetzner-01` (1/4, ok), `gpu-box` (0/1 idle).
- Kanban: Queued(2): "Add quota meters to model picker" (codex, auto,
  feat/quota-ui), "Vault: backfill sector pages" (claude-code, hetzner-01);
  Running(2): "fix: oauth token refresh" (claude-code, m4-mini,
  fix/oauth-refresh, 72%, "▸ RefreshScheduler.test.ts 41/44", "12m · $0.84"),
  "wiki-indexer nightly" (codex, hetzner-01, 31%, "▸ ingested 214/680
  filings"); Needs review(1): "Fleet dashboard build ✦" (+412 −38,
  "▸ acceptance 4/4 ✓ · awaiting you"); Merged(2).
- Worktrees: `feat/agents-dash` (building · 2/3 merged; T-101/T-102 merged,
  T-103 64%); `fix/oauth-refresh` (supervising; T-201/T-202 awaiting merge,
  supervisor "● reviewing now" pulse).
- Cost presets: Economy / Balanced / Max quality with Planner/Worker/
  Supervisor role chips and est-cost copy (see design state lines 1327-1331 —
  exact strings in `design/fleet.md`).

## Phases

**P1 — Protocol + adapters.** Types, `docs/rework/fleet-protocol.md`,
`FleetAdapter`, `MockFleetAdapter` (unit-tested), `FleetdAdapter` skeleton.
Endpoint config via `app_metadata` key `fleet_endpoint`.

**P2 — Board view.** `/fleet` route (append-only App.tsx),
`src/ui/components/fleet/`: kanban columns with count chips, card anatomy
per `design/fleet.md` (title, agent avatar + name, machine, mono branch,
progress bar in status color, mono log line, review CTA on needs-review
cards), footer hint "drag cards between columns to dispatch" (drag itself =
v2; render the hint, wire nothing). Status colors: `success`/`warning`
tokens (landed by W1 P1 — rebase to pick up; until then use destructive +
muted and note it).

**P3 — Worktrees view.** Segmented Board/Worktrees control; feature cards
with ticket rows (mono worktree paths, merged ✓ / % / awaiting-merge
states), supervisor strip (state + pulse animation + note), footer hint
about merge-up flow.

**P4 — Cost presets + machines.** Preset segmented control, role chips,
est line; machines strip with load fractions. Persist preset in app_metadata.

**P5 — Sidebar Sessions cluster.** `AppSidebar.tsx` insertion (minimal,
clearly-bounded — coordinate with W8's wiki nav insertion via rebase):
live session rows (pulse dot, name, agent · machine mono meta, time/status)
navigating to /fleet. Powered by the adapter; renders nothing when no
sessions and no endpoint (empty-state discipline).

## Resumability specifics

- Mock adapter makes every UI phase reviewable without any daemon — the user
  can test each PR build immediately.
- Protocol doc is the durable artifact; keep it in lockstep with
  `protocol.ts` (same commit).
- One view per phase; `/fleet` route registered in P2 renders whatever
  exists so far.

## Done means

/fleet with Board + Worktrees on mock data, adapter swap point proven
(endpoint configured → FleetdAdapter attempts, degrades cleanly), sidebar
sessions cluster, protocol doc complete, both themes, lint/build green, PR
with test plan (mock walkthrough + empty states + sidebar regression).
