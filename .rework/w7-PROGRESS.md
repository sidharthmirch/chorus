# W7 Progress — Fleet (Board + Worktrees UI, fleetd protocol client)

Branch: `claude/rework-fleet` · Worktree: `chorus-wt-w7` (branched off the
integration branch, which already has W1 + W2 merged — `success`/`warning`
tokens confirmed present in `src/ui/themes/index.ts` + `tailwind.config.cjs`
before P1 started).

## State: P5 complete — ALL PHASES DONE

## NEXT ACTION

None — this workstream is done per docs/rework/agents/W7-fleet.md's "Done
means" checklist (see the handoff report in this session's final message
to the orchestrator for the full summary: phases/commits, files, gate
results, exported signatures, open questions, test plan). If resumed
later: re-verify the gate (`tsc --noEmit`, the two `eslint` targets,
`vitest run src/core/chorus/fleet`) still passes before doing anything
else, since this is the natural point where a resumer's first move should
be confirming nothing drifted, not writing new code.

## Phase checklist

- [x] P1 — Protocol + adapters (`protocol.ts`, `FleetAdapter.ts`,
      `fixtures.ts`, `MockFleetAdapter.ts`, `FleetdAdapter.ts`,
      `kanbanFormat.ts`, `worktreeFormat.ts`, `agentDisplay.ts`, `copy.ts`,
      `time.ts`, `fleetSettings.ts`, `useFleet.ts` + unit tests;
      `docs/rework/fleet-protocol.md`)
- [x] P2 — Board view (`/fleet` route in `App.tsx`; `FleetView.tsx`,
      `FleetHeader.tsx`, `KanbanBoard.tsx`, `KanbanColumn.tsx`,
      `KanbanCard.tsx`, `AgentBadge.tsx`, `FleetProgressBar.tsx`,
      `FleetStatusDot.tsx`, `fleetTone.ts`, `FleetEmptyState.tsx`,
      `FleetFooterHint.tsx`, `FleetView.types.ts`; dispatch (via a machine-
      picker `Popover`) and pause/resume are wired against the adapter,
      not just rendered inert — drag-and-drop is the only thing P2
      explicitly defers to v2)
- [x] P3 — Worktrees view (`FeatureCard.tsx`, real `WorktreesView.tsx`;
      `copy.ts` gained `FLEET_SUPERVISOR_LABEL`/`FLEET_SUPERVISOR_TONE`/
      `FLEET_TICKET_WORKER_CHIP_STATUSES`; wired `useFleetFeatures()` into
      `FleetView.tsx`, including its own `isInitialLoad` branch)
- [x] P4 — Cost presets + machines strip (`CostPresetsPanel.tsx`; staged +
      wired the P2-written `MachinesStrip.tsx`; `FleetView.tsx` now renders
      `CostPresetsPanel` Board-only and `MachinesStrip` on both views,
      matching design/fleet.md's two distinct ASCII footer layouts, gated
      behind `isReachable && !isInitialLoad`)
- [x] P4.5 — reconciled two convergent `FleetdAdapter`/UI drafts that
      briefly diverged mid-session (see Decisions log) back into one
      consistent, gate-clean state before P5.
- [x] P5 — Sidebar Sessions cluster (`FleetSessionsCluster.tsx`; one
      12-line, purely-additive insertion in `AppSidebar.tsx` — import +
      one clearly-commented render call, no reordering of existing code)

## Decisions log

- **2026-07-21 — paseo research.** No local paseo spec existed in-repo,
  and the brief requires mirroring its naming "where free." Used WebSearch
  + WebFetch (read-only) to pull paseo's real public docs from
  `github.com/getpaseo/paseo` (`public-docs/{index,worktrees,
  orchestration}.md`) — it's a real, existing 10.9k★ project, not something
  I could safely guess at. Findings + citations recorded in
  `docs/rework/fleet-protocol.md` §1. Confirmed: paseo's "session" =
  a live agent run (→ `IFleetSession`), "worktree" = isolated workspace
  (→ `ITicket`), "agent"/"provider" = the CLI tool (→ `FleetAgentId`); no
  paseo equivalent for our feature/ticket two-level hierarchy, planner/
  worker/supervisor role+cost-preset model, multi-machine mesh, or the
  kanban board itself — all noted as fleetd-specific divergences.
- **Agent avatar color: no per-provider hex.** The design mock colors each
  agent avatar with a raw hex swatch (`P.anthropic = "#d97757"` etc. — a
  prototyping shortcut in the standalone HTML mock). DESIGN.md's Token-Only
  Rule forbids new hex/HSL literals in feature code, and explicitly rejects
  "purple-AI-tool branding." Chose to reuse the existing `ProviderLogo`
  component (`ui/provider-logo.tsx`) instead — it already renders each
  provider's own mark and already has a graceful fallback for an
  unrecognized provider. `agentDisplay.ts#agentProviderName` maps fleetd
  agent ids (`"claude-code"` → `anthropic`, `"codex"` → `openai`) into the
  existing `ProviderName` vocabulary; an agent fleetd adds later that isn't
  in this map still renders (falls back to `ProviderLogo`'s own unknown-
  provider glyph) instead of breaking.
- **`IFleetSession` vs `IKanbanCard` split.** The brief names both as
  required types. Modeled `IFleetSession` as the pure wire/domain entity
  (what an adapter returns — easy to unit-test, easy for a future fleetd to
  target) and `IKanbanCard` as a presentation view-model
  (`{session, metaText, metaTone, hasReviewBadge}`) built by a pure
  `buildKanbanCard()` in `kanbanFormat.ts`. This keeps `protocol.ts` free of
  any formatting/"now"-dependent logic and makes the meta-text rules
  (`"queued 4m"` / `"12m · $0.84"` / `"+412 −38"` / `"yesterday"`)
  independently unit-testable against a fixed clock.
- **Cost/date strings are derived client-side, not shipped pre-formatted.**
  Mirrors CLAUDE.md's date-rendering convention (use a helper, don't ship a
  formatted string) extended to elapsed-time and diff-stat text. Added
  `time.ts` (`formatElapsedShort`, `formatRelativeDay` — deliberately
  separate from `displayDate` in `ui/lib/utils.ts`, which renders full
  absolute timestamps, a different register) and a fleet-local
  `formatFleetCost` in `kanbanFormat.ts` — **not** the app-wide `formatCost`
  (`api/CostAPI.ts`), because that function shows 4 decimal places under
  $1 (tuned for sub-cent per-message costs) which would render the design's
  `"$0.84"` as `"$0.8400"`. Both are documented inline as deliberate, not
  overlooked duplication.
- **`FleetMetaTone` needs a 4th value, `"accent"`.** Cross-checking the
  design mock's actual JS state (not just `design/fleet.md`'s prose):
  merged *tickets* in the Worktrees view use the accent/Toasted-Sand token
  (`var(--acc)`, "merged ✓") while merged *kanban cards* on the Board use
  muted (`var(--helper)`, "yesterday"/"2d ago"). These are genuinely
  different signals in the source data, not an inconsistency to paper over
  — kept both tones distinct rather than collapsing to one.
- **`app_metadata` access stays self-contained under `fleet/**`.**
  `fleet_endpoint`/`fleet_cost_preset` accessors live in
  `fleetSettings.ts`, not appended to the shared `api/AppMetadataAPI.ts`
  (even though W1/W2 both appended purpose-specific functions there for
  their own keys — a viable alternative). Chose the zero-shared-file-edits
  option since it costs nothing here and there's no other consumer of
  these two keys; same table, same `db` singleton, same `INSERT OR REPLACE`
  idiom either way ("use existing app_metadata patterns" is satisfied by
  the table/idiom, not by which file the accessor lives in).
- **`setInterval` needs no permission.** CLAUDE.md's forbidden-without-
  asking list is exactly `setTimeout`, `useImperativeHandle`, `useRef`, `as`
  — `setInterval` isn't on it (and `App.tsx` already uses it freely for its
  update-check loop). `FleetdAdapter`'s HTTP-poll fallback uses
  `setInterval`/`clearInterval` as plain class fields — no React hook
  involved, so `useRef` doesn't even enter into it. Not claiming the
  ORCHESTRATION.md `setTimeout`-for-polling pre-authorization since it
  wasn't needed.
- **Pulse animation is pure CSS, not a JS timer.** ORCHESTRATION.md
  pre-authorizes `setTimeout` for things like "pulse animation timers,"
  anticipating JS-driven pulsing. Tailwind already ships a core
  `animate-pulse` utility (not disabled in `tailwind.config.cjs`), so the
  sidebar/supervisor pulse dots (P3/P5) will use
  `motion-safe:animate-pulse` — zero JS, and `prefers-reduced-motion` is
  handled for free via the `motion-safe:` variant. Recording this so the
  orchestrator doesn't go looking for a `setTimeout` that isn't there.
- **Review "CTA" renders as a static badge, not a button.** The brief says
  "review CTA on needs-review cards"; design/fleet.md's own Interactions
  section never specifies a click behavior for it (only drag&drop, preset
  selection, machine selection (explicitly future/read-only), pause/
  dispatch, and tab switching are documented as interactive). Rendering a
  clickable button that goes nowhere would be worse than an honest quiet
  badge reading "awaiting you" (`copy.ts#FLEET_REVIEW_BADGE_TEXT`) — matches
  the Copy section's exact listed string. `IKanbanCard.hasReviewBadge`
  drives it.
- **`paused` is a flag, not a 5th status.** Design/fleet.md's pause
  interaction ("[P] pause button... progress freezes") keeps a paused
  session in the Running column, just visually frozen — so
  `IFleetSession.paused?: boolean` rather than widening
  `FleetSessionStatus`, which stays the exact 4 kanban-column values.
- **Added two endpoints beyond design/fleet.md's original API table:**
  `GET /features` (Worktrees view needs the feature/ticket tree as
  first-class data — not derivable from `/sessions` alone) and
  `GET /cost-presets` (supersedes the original's singular
  `GET /cost-estimate`; the UI needs per-role model assignments, not just
  an estimate string). Both documented in `fleet-protocol.md` §4 as
  explicit divergences/supersessions, not silent additions.
- **P2 — column-header dot tone ≠ card meta tone for "merged".** Same
  accent-vs-muted split as the ticket/session one above, but at the
  *column* level: the fixture's Merged column header dot is
  `var(--acc)`, while cards inside it read muted ("yesterday"). Added a
  separate `FLEET_COLUMN_DOT_TONE` table (`copy.ts`) rather than reusing
  `formatSessionMeta`'s tone for a role it was never meant for. Same
  reasoning for `FLEET_MACHINE_DOT_TONE` (machines strip; `offline` groups
  with `idle` → muted, since DESIGN.md reserves the destructive/red token
  for actual errors, and "offline" here just means "not in the pool").
- **P2 — card anatomy includes `title` and `machine`, not just agent/
  branch.** The Component Inventory prose in `design/fleet.md` doesn't list
  "title" as an explicit bullet under "Header row" (it enumerates agent
  avatar+name, branch, action icons — title is presumably assumed/obvious
  since every task has one). First pass of `KanbanCard.tsx` missed both
  `title` and `machine` entirely before typechecking caught nothing (it's
  valid, just visually incomplete) — caught on manual re-read against
  `docs/rework/agents/W7-fleet.md`'s own restatement of card anatomy, which
  *does* list "title" first. Fixed: title renders as its own line
  (`line-clamp-2`) above the agent/machine/action row; machine renders
  inline after the agent name as "· {machine}", matching the sidebar
  fixture's own "claude-code · m4-mini" convention (`sessions[].meta` in
  the design mock's JS state) for consistency across surfaces.
- **P2 — dispatch/pause/resume ARE wired (not just rendered).** The brief's
  "wire nothing" instruction for P2 is scoped explicitly to *drag-and-drop*
  ("footer hint... drag itself = v2"). The `[→]` dispatch icon (opens a
  `Popover` machine picker) and `[P]`/`▶` pause/resume icon both call
  through `useFleet.ts`'s mutations into the adapter, proving the adapter
  round-trip end-to-end against `MockFleetAdapter` (which genuinely mutates
  its in-memory session list and notifies subscribers — see P1's
  `MockFleetAdapter.test.ts`). The Board's "review CTA" is deliberately
  NOT a button — see P1's decision on that; nothing in
  `design/fleet.md`'s Interactions section specifies a click behavior for
  it, so a static "awaiting you" badge is the honest choice.
- **P2 — `MachinesStrip.tsx` exists but isn't wired into `FleetView` yet.**
  Wrote it while building the shared `fleetTone.ts`/`FleetStatusDot`
  primitives (natural to do together), but it's explicitly a P4 deliverable
  per the phase brief ("P4 — Cost presets + machines: ... machines strip
  with load fractions"). Left untracked/unstaged on purpose so the P2
  commit stays scoped to what P2 actually asked for; P4 both stages it and
  wires it into `FleetView.tsx`.

- **P3 — supervisor label drops the fixture's embedded "●".** The design
  fixture's `supState` string for the active case is literally
  `"● reviewing now"` — a text bullet baked into the label. Since
  `FeatureCard.tsx` renders a real `FleetStatusDot` (with its own `pulse`)
  right next to the label, keeping the bullet in the text too would
  duplicate the same signal twice. `FLEET_SUPERVISOR_LABEL` (`copy.ts`)
  holds the plain label ("idle" / "reviewing now"); the dot carries the
  "active" signal.
- **P3 — "Worker" ticket chip shown on `running`/`awaiting-merge` only.**
  Reverse-engineered from the fixture rather than stated as a rule
  anywhere: T-103 (running) and T-201/T-202 (awaiting-merge) all show
  `[● Worker]` in the Worktrees ASCII mock; T-101/T-102 (merged) don't.
  Reads as "still worker-owned, not yet merged" → `queued` (no fixture
  example either way) was extrapolated to also hide it, on the reasoning
  that a ticket with no dispatched worker yet shouldn't claim one.
  `FLEET_TICKET_WORKER_CHIP_STATUSES` (`copy.ts`) holds the 2-status list.
- **P3 — `now` must be real wall-clock time, not `feature.updatedAt`.**
  First draft of `FeatureCard.tsx` passed `feature.updatedAt` down to each
  `TicketRow` as "now" for `formatTicketMeta`'s elapsed-time math — wrong:
  that pins a still-running ticket's "12m" reading to whenever fleetd last
  touched the *feature* record, not the actual current time. Fixed:
  `WorktreesView.tsx` computes a real `new Date()` per render (no
  `useMemo` — nothing about "now" depends on `features`, and it's cheap
  enough to just recompute; an earlier attempt to memoize it against
  `[features]` tripped `react-hooks/exhaustive-deps` since `features`
  isn't actually read inside the factory) and threads it down through
  `FeatureCard`/`TicketRow` as an explicit `now` prop.
- **P4 — role chips show icon + `modelLabel`, not `AgentBadge` verbatim.**
  `AgentBadge` (built in P2 for kanban cards) renders icon + the *agent id*
  text ("claude-code"). The role chips need icon + the *model* text
  ("Sonnet 4.5") instead — reusing `AgentBadge` as-is would print the wrong
  string. `CostPresetsPanel.tsx` inlines `ProviderLogo` +
  `assignment.modelLabel` directly rather than stretching `AgentBadge` to
  cover a second, different use case.
- **P4 — cost-preset default resolution.** `useFleetCostPresetId()`
  (`fleetSettings.ts`, P1) falls back to the string id `"balanced"`
  (`FLEET_DEFAULT_COST_PRESET_ID`) when `app_metadata` has no
  `fleet_cost_preset` row yet; `useActiveFleetCostPreset()` then looks that
  id up by value in the loaded preset list (not by array index), so it
  stays correct even if a future fleetd reorders `GET /cost-presets`'
  response. Matches the design mock's own default (`costPreset: 1` = index
  1 of `[Economy, Balanced, Max quality]` = "Balanced").
- **P5 — sidebar label is "Fleet", not "Sessions".** The brief's own prose
  calls this the "Sessions cluster," but the design mock's actual sidebar
  sketch renders the section header as "Fleet" (matching "Minimized"/
  "Projects" — short category nouns). Went with the mock's literal text
  over the brief's descriptive name for the on-screen label; `FleetSessions
  Cluster` is still the component/file name (matches the brief's own
  vocabulary for what the thing IS, just not what it's labeled on screen).
- **P5 — sidebar-scoped tokens, not the general ones.** `text-sidebar-
  foreground` / `text-sidebar-muted-foreground` / `hover:bg-sidebar-accent`
  throughout `FleetSessionsCluster.tsx`, not the plain `text-foreground`/
  `text-muted-foreground`/`hover:bg-muted` used on `/fleet` itself.
  DESIGN.md is explicit that "Sidebar sits on Sidebar Smoke with its own
  token family" — the sidebar's background is a different shade than the
  main canvas, so its muted/accent tokens are calibrated separately for
  contrast against it. Easy to miss since every OTHER Fleet component
  lives on the main canvas and correctly uses the general tokens.
- **P5 — trailing status label is tone-colored.** The design mock's own
  sidebar fixture colors each row's time label to match its dot
  (`timeColor` alongside `dot` in the mock's `sessions` state array) —
  carried that through via `FLEET_TONE_TEXT_CLASS[tone]` rather than a
  flat muted color, so e.g. a running session's elapsed-time label reads
  in the same success green as its dot.
- **P5 — one duplicate-insertion cleanup mid-session.** Two consistent
  drafts of the same sidebar component (`FleetSessionsCluster.tsx` /
  `SidebarSessionsCluster.tsx`, functionally near-identical — same filter/
  sort/cap logic, same navigate-to-`/fleet` behavior) briefly existed side
  by side, and `AppSidebar.tsx` transiently ended up with both wired in at
  once (caught immediately by `tsc`: an undefined-name error, since the
  two edits landed referencing each other's now-stale import). Resolved by
  reviewing both, keeping the better-reasoned one (`FleetSessionsCluster.tsx`
  — correct sidebar-scoped tokens once merged with the other's tone-colored
  label + cleaner two-line row layout), deleting the other, and reducing
  `AppSidebar.tsx` back down to exactly one import + one render call (see
  the P4.5 checklist line). Net diff to `AppSidebar.tsx` is 12 lines,
  purely additive, verified via `git diff HEAD --stat`.

## Landmines / do-not

- Don't reuse `formatCost` (`api/CostAPI.ts`) for session/task cost display
  — use `kanbanFormat.ts#formatFleetCost` (2 decimals, matches the design
  fixture's "$0.84"/"$0.12"; `formatCost` would render "$0.8400").
- Don't add a 5th `FleetSessionStatus` for "paused" — it's the `paused`
  boolean flag on a `"running"` session, not a column.
- `formatRelativeDay`/`time.ts`'s day-boundary math is LOCAL-calendar-day
  based (`Date#getFullYear/getMonth/getDate`, not UTC). If you add tests or
  fixtures involving day boundaries, construct `Date`s with the local
  constructor (`new Date(y, m, d, h)`), not UTC ISO strings — see the
  comment in `time.test.ts` for why (an earlier draft of that test was
  timezone-flaky and was fixed before commit).
- `MockFleetAdapter` is intentionally static (no fake progress ticking over
  time) — design/fleet.md's own closing line sanctions "mock/static for
  UI." Don't add a ticking clock/interval to it; that would misrepresent
  fake data as if real work were happening.
- `FleetdAdapter`'s WebSocket path has no reconnect-with-backoff yet (falls
  straight to HTTP polling on any failure) — there is no real fleetd in
  this repo to validate a reconnect strategy against. Documented as a known
  gap in `fleet-protocol.md` §4, not an oversight to silently fix without
  re-reading that note first.
- `src/core/chorus/fleet/**` and `src/ui/components/fleet/**` are this
  workstream's exclusive ownership per `00-ARCHITECTURE.md` §8 — everything
  fleet-specific (including its own `app_metadata` accessors) stays inside
  them; the only files touched outside are the two explicitly-sanctioned
  append points (`App.tsx` route, `AppSidebar.tsx` Sessions cluster) plus
  this progress ledger and `docs/rework/fleet-protocol.md`.

## User-test queue

- Navigate to `/fleet` (no UI entry point yet — P5 adds the sidebar link;
  until then, type the URL/route directly, e.g. via the command menu or
  browser devtools navigation) with no `fleet_endpoint` configured. Expect:
  Board tab active by default, all 4 columns populated from
  `MockFleetAdapter`'s fixtures (2 queued / 2 running / 1 needs-review / 2
  merged), progress bars + log lines on the running/needs-review cards,
  "awaiting you" badge on the needs-review card. Click a queued card's
  dispatch icon → pick a machine → card should move to the Running column.
  Click a running card's pause icon → card should show a "paused" tag and
  its pause icon should become a play icon; click again to resume.
- Click the Worktrees tab: expect 2 feature cards
  (`feat/agents-dash` "building · 2/3 merged", `fix/oauth-refresh`
  "supervising"), each with ticket rows (T-101/T-102 "merged ✓", T-103
  "64% · 12m" with a small Worker chip, T-201/T-202 "awaiting merge" each
  with a Worker chip), and a per-feature supervisor strip — the
  `fix/oauth-refresh` one should show a pulsing dot next to "Supervisor:
  reviewing now" (respects `prefers-reduced-motion` — worth checking with
  that OS setting on and off). The explanatory paragraph below the cards
  should read "Every ticket runs in its own git worktree branched off the
  feature worktree..." with "spawned on demand" bolded.
- In the sidebar (any regular chat window, not the sidebar-less quick-chat
  window): expect a "Fleet" cluster near the top, above "Minimized"/
  "Projects" — 3 rows (the design mock's own default `MockFleetAdapter`
  has 5 non-merged sessions; the cluster caps at 3, newest-updated-first),
  each with a dot, a title, a small mono "agent · machine" line, and a
  tone-colored trailing label ("4m"/"11m" for queued, elapsed time for
  running, "review" for the needs-review one). The running sessions'
  dots should pulse. Clicking any row, or "board →", navigates to
  `/fleet`. **Regression check:** with the sidebar's existing behavior —
  new chat button, Minimized panel, Projects, chat list, Ambient Chats —
  unaffected; the diff to `AppSidebar.tsx` is exactly 12 additive lines
  (verified via `git diff HEAD --stat`), so there should be nothing to
  regress, but worth confirming the sidebar still looks/behaves normally
  end to end.
- Check both light and dark themes throughout (I can't render the app to
  verify contrast myself — flagging as visual-uncertainty per
  01-COORDINATION.md §6 rather than guessing).
