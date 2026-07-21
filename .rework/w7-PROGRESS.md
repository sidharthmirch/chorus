# W7 Progress — Fleet (Board + Worktrees UI, fleetd protocol client)

Branch: `claude/rework-fleet` · Worktree: `chorus-wt-w7` (branched off the
integration branch, which already has W1 + W2 merged — `success`/`warning`
tokens confirmed present in `src/ui/themes/index.ts` + `tailwind.config.cjs`
before P1 started).

## State: P1 complete — protocol + adapters

## NEXT ACTION

Start P2 (Board view): create `src/ui/components/fleet/` React components
(`FleetHeader`, `KanbanBoard`, `KanbanColumn`, `KanbanCard`,
`FleetEmptyState`) and a `FleetView.tsx` top-level component; wire it as the
`/fleet` route at the end of `App.tsx`'s route list (append-only). Use
`useFleetSessions()` + `buildKanbanColumns()` (already built and tested in
P1) to render. Card anatomy per `docs/rework/design/fleet.md`'s Component
Inventory + this ledger's Decisions log (agent avatar = `ProviderLogo` via
`agentProviderName`, not a hex-colored letter chip).

## Phase checklist

- [x] P1 — Protocol + adapters (`protocol.ts`, `FleetAdapter.ts`,
      `fixtures.ts`, `MockFleetAdapter.ts`, `FleetdAdapter.ts`,
      `kanbanFormat.ts`, `worktreeFormat.ts`, `agentDisplay.ts`, `copy.ts`,
      `time.ts`, `fleetSettings.ts`, `useFleet.ts` + unit tests;
      `docs/rework/fleet-protocol.md`)
- [ ] P2 — Board view (`/fleet` route, kanban columns/cards)     <- current
- [ ] P3 — Worktrees view (feature/ticket tree, supervisor strip)
- [ ] P4 — Cost presets + machines strip
- [ ] P5 — Sidebar Sessions cluster

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

(nothing yet — P2 will be the first phase with anything to look at in the
running app; this entry will be replaced once there's a concrete test
plan item.)
