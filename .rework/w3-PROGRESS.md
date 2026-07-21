# W3 Progress — Settings Rework

## State: P0 done. Starting P1 (strangler extraction).

## NEXT ACTION
Create `src/ui/components/settings/registry.ts` (SettingsSectionId union +
ISettingsSection registry + legacy tab-id mapping), then move the satellite
files that need zero/near-zero changes first (ToolPermissionDialog.tsx,
PermissionsTab.tsx — zero relative imports; AccessibilityCheck.tsx — zero
relative imports) before tackling the bigger splits (DefaultsTab →
ModelDefaultsPanel + AmbientChatPanel; the ~975-line ToolsTab block →
Connections section files).

## Phase checklist
- [x] P0 — inventory doc (`docs/rework/w3-settings-inventory.md`), committed.
      Documents how Settings currently opens (global Dialog, 4 entry points
      all converging on `SETTINGS_DIALOG_ID`), the legacy dead `?tab=`
      searchParams path (confirmed unreachable — grepped repo-wide), and 33
      individual settings mapped old-location → new-section.
- [ ] P1 — strangler extraction into `src/ui/components/settings/**`
- [ ] P2 — `SettingsShell.tsx` (nav + content pane + search filter)
- [ ] P3 — routing (`/settings`, `/settings/:section`)
- [ ] P4 — design pass (folding into P1-P3 as I build, since
      `docs/rework/design/settings.md` was already available at session
      start — no separate mechanical pass needed; noting this deviation from
      the brief's phase order here per its own "If W0 still hasn't landed..."
      escape clause, inverted: W0 HAD landed, so P4 isn't deferred, it's
      inlined)

## Decisions log

- 2026-07-22 **Settings stays a `Dialog`, not a route that replaces the view.**
  Considered making `/settings` a plain `<Route>` element (matching Fleet/
  Wiki's precedent — full-page, sidebar stays, current chat unmounts).
  Rejected: today, opening Settings never unmounts whatever chat is open
  behind it (it's a floating overlay via `App.tsx`'s always-mounted
  `<Settings>` + Radix `Dialog`'s own open/closed state). Fleet/Wiki don't
  have that precedent to protect (they're new destinations you deliberately
  navigate *to*); Settings does. Converting it to a route would be a real,
  unflagged behavior change disguised as "just routing." Chosen design
  instead: keep the exact `Dialog`/`dialogActions`/`SETTINGS_DIALOG_ID`
  mechanism (zero risk to the 4 existing entry points), and layer
  `/settings` + `/settings/:section` on top as an *additional* way in —
  `SettingsShell` watches `useLocation()` and opens the dialog + seeds the
  active section when the URL matches, and does a `replace`-navigate (never
  pushing new history entries) if the nav is ever clicked while the dialog
  was opened *via* a route. If it was opened via the legacy
  menu/shortcut/event mechanism, clicking nav items only changes local
  component state — exactly today's behavior, URL untouched. Full reasoning
  and the exact effect/hook design in `settings/MIGRATION-NOTES.md`.
- 2026-07-22 **`VisibleModelsTab.tsx` deleted, not moved.** See inventory
  doc's "Decisions requiring a documented deviation" #15 — W4's
  `ModelSettingsRows.tsx` supersedes it entirely (same capability, better
  per-row UX for the no-API-key case), and W4's own doc comment on that file
  explicitly flags this for W3 to resolve. Deleted alongside its
  `visibleModelsSearch.ts` helper and `VisibleModelsTab.search.test.ts` —
  confirmed via repo-wide grep that nothing else imports either.
- 2026-07-22 **`DefaultsTab.tsx` split, not moved verbatim** into
  `ModelDefaultsPanel.tsx` (Models section) + `AmbientChatPanel.tsx` (App
  section). Six previously-bundled concerns have no single home in the
  5-section IA. Every individual control's storage key/behavior is
  unchanged — see inventory doc items #18-24.
- 2026-07-22 Legacy `open_settings` event payload (`{tab: string}`) kept as
  the wire shape (event name and payload key both unchanged) rather than
  renamed to `{section}` — minimizes the diff to `AppSidebar.tsx`/
  `ManageModelsBox.tsx` (both W7/W4-owned files I only touch for the two
  explicitly-authorized string-value repoints) to literally one changed
  string literal each. `settings/registry.ts#resolveSettingsSection` is the
  single place old tab-id strings (and the dead `"quick-chat"` value) map
  onto the new 5 section ids; unknown/unmapped → first section (Accounts),
  per the brief.

## Landmines / do-not
- Do not re-add `VisibleModelsTab.tsx` — it's deleted deliberately, not an
  accidental loss. If a regression is ever reported against "visible models
  no longer grouped the old way," the fix is in `model-select/**` (W4-owned,
  read-only for W3) or a new Models-section wrapper, not resurrecting the
  old file.
- `model-select/**`, `ProviderAccountsAPI.ts`/`accounts/**`,
  `fleet/**`/`fleet/*.tsx`, `ModesAPI.ts` are all read-only for this
  workstream — mount, do not edit. The only pre-authorized exceptions (from
  the W3 brief itself) are two one-line string literals in
  `ManageModelsBox.tsx` (`handleAddApiKey`/`handleOpenProfile`'s `tab:`
  values) repointed to the new section ids.
- `App.tsx`/`AppSidebar.tsx` edits must stay surgical — see
  `settings/MIGRATION-NOTES.md` for the exact line-level diff plan before
  touching either file.

## User-test queue
(Populated at the end, once P1-P3 land — see the final handoff report.)
