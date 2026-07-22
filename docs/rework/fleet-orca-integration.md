# Fleet ↔ Orca integration (OrcaCliAdapter)

Status: architecture (orchestrator-authored) → implementation delegated.
Extends W7 Fleet. Read `docs/rework/00-ARCHITECTURE.md` §6, W7's
`docs/rework/fleet-protocol.md`, and `src/core/chorus/fleet/FleetAdapter.ts`
first — this doc only adds a third adapter behind that frozen seam.

## Goal

Make the Fleet surface drive a **real** backend by implementing `FleetAdapter`
against **Orca** (github.com/stablyai/orca, `onorca.dev`) — an open-source ADE
that runs a fleet of parallel coding agents (Claude Code, Codex, Cursor, …),
each in its own git worktree, via a scriptable CLI. Orca's worktree/agent model
maps almost 1:1 onto Fleet's session/feature/ticket model, so no protocol
redesign is needed: we add `OrcaCliAdapter` alongside `MockFleetAdapter` and
`FleetdAdapter`, selectable at runtime.

## Why this fits the seam

`FleetAdapter` (W7) is the single contract all Fleet UI depends on:
`listSessions/listMachines/listFeatures/listCostPresets`,
`dispatchSession/pauseSession/resumeSession`, `subscribe`, `getConnectionState`,
`kind`. UI never branches on the concrete adapter. Orca just needs to satisfy
this interface; everything else (Board, Worktrees view, machines strip) renders
unchanged.

**One frozen-type change (append-only):** extend the `kind` union in
`FleetAdapter.ts` from `"mock" | "fleetd"` to `"mock" | "fleetd" | "orca"`.
This is the only edit to a W7-owned type; keep it minimal.

## Orca CLI surface (grounded in onorca.dev/docs/cli)

Most commands accept `--json` for machine-readable output. Relevant to us:

| Need | Orca command |
|------|--------------|
| List worktrees (= agent sessions) | `orca worktree ps --json` |
| Current worktree | `orca worktree current --json` |
| Create/dispatch a task worktree | `orca worktree create --repo id:<repoId> --name <name> [--issue <n>] --json` |
| Annotate a worktree | `orca worktree set --worktree <sel> --comment "…" --json` |
| Remove/finish a worktree | `orca worktree rm --worktree id:<id> [--force] --json` |
| List terminals in a worktree | `orca terminal list --json` |
| Read terminal output (progress/log line) | `orca terminal read --json` |
| Send input to an agent terminal | `orca terminal send --text "…" [--enter] --json` |
| Wait for idle | `orca terminal wait --for tui-idle --timeout-ms <n> --json` |
| Headless mode (servers) | `orca serve` (no documented stable HTTP API → do NOT depend on it in v1) |

Binary name: `orca`. Install (user machine): `brew install --cask stablyai/orca/orca`
(macOS), `yay -S stably-orca-bin` (Arch), or release binaries.

> The exact JSON field names of `worktree ps --json` are NOT documented publicly
> and orca is not installed in this dev environment. Implement mapping
> **defensively** against a documented-but-unverified shape (see below), parse
> only fields you read, default everything else, and put "validate field names
> against real `orca worktree ps --json`" on the user-test queue.

## Transport (no new Rust)

Shell out via the already-present, already-registered `@tauri-apps/plugin-shell`
(`tauri_plugin_shell::init()` in `src-tauri/src/lib.rs`; `shell:allow-execute`
already in `capabilities/default.json`; precedent: `MCPStdioTauri.ts`,
`toolsets/messages.ts`). Use `Command.create("orca", args)` /
`.execute()` and parse stdout as JSON.

- If `shell:allow-execute`'s scope is command-restricted, append an `orca` entry
  to that scope's `args`/`name` allowlist in `capabilities/default.json`
  (append-only, JSON only — no Rust). Document the exact edit; the user rebuilds
  to apply it. If the scope already permits arbitrary execution (as MCP stdio
  servers need), no capability edit is required — verify and note which.
- Detection: run `orca --version` (or `worktree ps`) once; if it errors
  (ENOENT / non-zero), the adapter reports `getConnectionState()` =
  `"not-configured"` and all `list*` return `[]` — the Fleet empty state then
  teaches the user to install/point at orca. Never throw into the UI.

## Mapping orca → fleet protocol (v1)

- **Session/Feature/Ticket:** each orca worktree → one `IFleetSession`. Group
  sessions into `IFeature`/`ITicket` by repo + branch prefix where derivable;
  if orca doesn't expose enough grouping, emit one feature per repo (documented
  simplification). Fill `agent`, `branch`, `machine`, `progress`, `logLine`
  from worktree/terminal fields; `logLine` best-effort from `terminal read`.
- **Status:** map orca worktree/agent state → `FleetSessionStatus`
  (queued/running/needs-review/merged). Provide a small, well-commented
  `mapOrcaStatus()` with a conservative default (`running`) for unknown states.
- **Machines:** orca is local-first; represent the local host as a single
  `IMachine` (id `local`, from `plugin-os` hostname if easy, else "local"),
  load fraction = running-session count / a sane cap. Remote `orca serve` hosts
  are out of v1 scope (note the seam).
- **dispatchSession(sessionId, machineId):** `orca worktree create …`. Since the
  Fleet "dispatch queued card onto machine" gesture doesn't 1:1 match orca
  (orca creates fresh worktrees), v1 may map dispatch to "resume/annotate" or
  document it as create-only; do the least-surprising thing and note it.
- **pause/resume:** orca has no first-class pause. v1: either no-op with a
  clear thrown "not supported by the orca backend yet" that the UI already
  tolerates, or approximate via `terminal send`/`wait`. Pick one, document it,
  do NOT fake success silently.
- **subscribe(listener):** no push API → poll `orca worktree ps --json` on an
  interval (`setTimeout`/`setInterval` — pre-authorized in
  `.rework/ORCHESTRATION.md`), emit a snapshot event on each tick and once
  immediately; return an unsubscribe that clears the timer. Reuse W7's event
  shapes (`FleetEvent`) exactly.

## Selection / config

- `app_metadata` key `fleet_backend: "mock" | "fleetd" | "orca"` (default
  keeps today's behavior — `mock`). Optional `orca_bin` path override.
- `useFleetAdapter()` (W7, `useFleet.ts`) picks the adapter from that key.
  Add the `orca` case; keep `mock` the default so nothing regresses.

## Testing (what CAN be verified here)

- Pure unit tests (vitest) for the JSON→protocol mapping: feed representative
  `orca worktree ps --json` / `terminal read --json` fixture strings (author
  plausible fixtures from the CLI doc) through the parse/map functions and
  assert the resulting `IFleetSession[]`/status mapping. Test the
  binary-missing → `not-configured` path with a stubbed command runner
  (inject the runner, like `nineRouterClient` injects fetch).
- The live end-to-end (real `orca` installed, real worktrees) goes on the
  user-test queue — cannot run in this environment.

## Non-goals (v1)

New Rust; remote orca-serve hosts; orca's browser/mobile/emulator commands;
cost-preset control of orca; replacing Mock as the default. Keep the diff inside
`src/core/chorus/fleet/**` + the one `kind` union line + the `useFleetAdapter`
case + (maybe) one capability JSON append.
