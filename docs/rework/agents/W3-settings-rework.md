# W3 — Settings Rework

Branch: `claude/rework-settings` · Worktree: `../chorus-wt-w3`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §5, then this file.
**Soft-blocked on W0:** if `docs/rework/design/settings.md` exists, its IA/layout
directives are authoritative for the shell; the strangler extraction (P1–P2)
needs no design input — start there regardless.

## Mission

`src/ui/components/Settings.tsx` is an ~85KB monolith. Replace it with the
design's **5-section** settings ("5 sections. It was 12 tabs."):
**Accounts · Models · Modes · Connections · App** — sidebar nav with icons +
counts, deep-linkable routes (`/settings/:section`), every existing
capability preserved (absorbed into a section, listed in the nav footnote
"Absorbed: …"). IA and copy per `docs/rework/design/settings.md`.

Section data sources:
- **Accounts** — W1's frozen `ProviderAccountsAPI` (+ its reference
  `ProviderAccountCard`); `ApiKeysForm` becomes the api-key auth kind here.
- **Models** — mounts W4's model rows component.
- **Modes** — W6's `ModesAPI` (stance cards with prompt text, tags, usage).
- **Connections** — fleetd card (W7 endpoint config), MCP toolsets, imports.
- **App** — theme, fonts, cautious enter, show cost, tool permissions, import
  (rows per design).
Until a dependency's API lands, build the section shell with the current
equivalent UI inside; swap on rebase.

## Context you must load before coding

- `Settings.tsx` end to end (yes, all of it) — build the feature inventory
  first (P0). Note theme select (~line 1537), custom/builtin tabs (~983),
  ambient chat config (~1628).
- Satellite tabs: `DefaultsTab.tsx`, `PermissionsTab.tsx`,
  `ModelProfilesTab.tsx`, `PromptProfilesTab.tsx`, `ApiKeysForm.tsx`,
  `ShortcutRecorder.tsx`, `ToolPermissionDialog.tsx`.
- `App.tsx` routing (append-only), how Settings is currently opened
  (dialog? route? — document it in P0).
- API surfaces used by settings: `AppMetadataAPI`, `ToolPermissionsAPI`,
  `ToolYoloAPI`, `ModelProfilesAPI`, `PromptProfilesAPI`,
  `ProviderVisibilityAPI`.
- `screenshots/` dir for current-state reference.

## Phases

**P0 — Inventory (docs commit).** `docs/rework/w3-settings-inventory.md`:
every setting, its storage (app_metadata key / table), its component, its
current location. This is the regression checklist for the final test plan.
Getting this committed early makes the whole stream adoptable.

**P1 — Strangler extraction.** Create `src/ui/components/settings/`;
move each cohesive section out of `Settings.tsx` into
`settings/sections/<Name>Section.tsx` (props-only refactors, no behavior
change), one section per commit, `Settings.tsx` shrinking but always green.
Existing satellite tabs move under `settings/` with import updates.

**P2 — Shell.** `settings/SettingsShell.tsx`: left nav (sidebar-smoke surface,
`.sidebar-label` group headers, 14px items — see DESIGN.md navigation spec),
content pane, search-filter over section names (input primitive, focus-salmon
ring). Register sections in a typed `ISettingsSection[]` registry (id, label,
icon, component, keywords).

**P3 — Routing.** `/settings` + `/settings/:section` (append-only in
`App.tsx`); preserve the current entry point behavior (menu/shortcut) mapping
to the new shell; unknown section → first section.

**P4 — Design pass.** Apply `docs/rework/design/settings.md` directives
(when available): section order/grouping/renames, any new settings surfaces it
introduces. Deviations from DESIGN.md tokens get resolved per W0's rules
(intent yes, literal values no). If W0 still hasn't landed, ship P1–P3 as the
PR and record P4 as a follow-up in PROGRESS.md.

## Constraints

- **Zero regressions**: the P0 inventory is checked item-by-item in the PR
  test plan.
- Coordinate-by-ownership: W1 may deliver a standalone remote-toolset editor
  component while you work — mount it, don't rebuild it. Check W1's
  PROGRESS.md on their branch if unclear.
- No new persistence unless the design demands it; then migration ledger
  protocol applies.
- Monolith rule: no new file over ~400 lines; sections own their state.

## Resumability specifics

- Strangler order means every commit is shippable; PROGRESS.md tracks the
  "sections remaining in monolith" list explicitly.
- Keep a `settings/MIGRATION-NOTES.md` mapping old Settings.tsx line ranges →
  new files as you go (successors and reviewers both need it).

## Done means

`Settings.tsx` deleted or reduced to a thin re-export; all inventory items
verified in test plan; deep links work; both themes correct; lint/build green;
PR per CLAUDE.md with full regression checklist.
