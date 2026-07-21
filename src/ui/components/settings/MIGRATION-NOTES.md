# Settings strangler migration notes

Maps the pre-rework `Settings.tsx` (2021 lines, deleted in this branch — see
`6274091` for the last full copy, or any commit before `3e92c1b`) onto its
new home. Companion to `docs/rework/w3-settings-inventory.md` (capability ->
storage -> section) — this file is line-range -> file, for anyone diffing.

## Toolsets / Connections block (old lines 1-1072)

| Old lines | Old symbol | New file |
|---|---|---|
| 97-288 | `RemoteToolsetForm` | `settings/connections/ToolsetForms.tsx` |
| 290-443 | `ToolsetForm` + `ToolsetFormProps` | `settings/connections/ToolsetForms.tsx` |
| 445-546 | `CustomToolsetRow` + `CustomToolsetRowProps` | `settings/connections/CustomToolsetRow.tsx` |
| 548-601 | `RECOMMENDED_TOOLSETS` | `settings/connections/recommendedToolsets.tsx` (split out further, post-extraction, to satisfy `react-refresh/only-export-components` — see decisions log) |
| 603-611 | `CORE_BUILTIN_TOOLSETS_DATA` | `settings/sections/ConnectionsSection.tsx` |
| 616-1072 | `ToolsTab()` | Split: quick-start grid -> `settings/connections/QuickStartGrid.tsx` (+ `GitHubManageConnectionButton`); state/handlers/custom+built-in tabs -> `settings/sections/ConnectionsSection.tsx` |
| — (new) | — | `settings/connections/FleetDaemonCard.tsx` — new, mounts W7's `fleetSettings.ts`/`useFleet.ts` (fleetd endpoint config + live status), per design/settings.md's "Fleetd card" |

## Dialog shell / nav / General+API-Keys+System-Prompt+Base-URL tabs (old lines 1074-1988)

| Old lines | Old symbol | New file |
|---|---|---|
| 1080-1097 | `FONT_OPTIONS` | `settings/sections/AppSection.tsx` (sans only — mono was already dead, see inventory #3) |
| 1099-1135 | `SettingsTabId`, `TabConfig`, `TABS` | `settings/registry.ts`'s `SettingsSectionId`/`ISettingsSection`/`SETTINGS_SECTIONS` |
| 1133-1151 | `isSettingsTabId`, `SETTINGS_TAB_ORDER` | `settings/registry.ts`'s `isSettingsSectionId` (+ array order in `SETTINGS_SECTIONS`) |
| 1153-1164 | local `Settings` interface (the settings-manager shape, unfortunately same name as the component) | gone — each section reads only the `SettingsManager` fields it needs, no shared interface |
| 1166-1406 | `Settings()` component's hooks/state/handlers | Split by subject, see rows below |
| 1250-1257, 1524-1548 | theme select + `getCurrentThemeValue`/`handleThemeChange` | `settings/sections/AppSection.tsx` |
| 1259-1263, 1551-1595 | sans-font select + `handleSansFontChange` (incl. per-item `onFocus` live-preview) | `settings/sections/AppSection.tsx` |
| 1310-1319, 1597-1643 | chat-title-model select + handler | `settings/sections/AppSection.tsx` |
| 1321-1337, 1645-1684 | auto-convert-long-text / auto-scrape-urls toggles | `settings/sections/AppSection.tsx` |
| 1339-1357, 1686-1704 | cautious-enter toggle (dual-writes `app_metadata.cautious_enter`) | `settings/sections/AppSection.tsx` |
| 1359-1366, 1706-1722 | show-cost toggle | `settings/sections/AppSection.tsx` |
| 1385-1400, 1485-1492 | `showOnboarding()` + "Restart Onboarding" button | `settings/sections/AppSection.tsx` (Advanced disclosure) |
| 1494-1511 | feedback/book-a-call links | `settings/sections/AppSection.tsx` (Advanced disclosure) |
| 1402-1404, 1729-1767 | `handleImportHistory` + import-from-OpenAI/Anthropic buttons | `settings/sections/AppSection.tsx`; the `<ImportChatDialog>` mounts themselves stay in `Settings.tsx` (unchanged — own dialog ids, must survive section switches) |
| 1220-1248, 1769-1817 | universal system prompt textarea + reset | `settings/UniversalSystemPromptPanel.tsx`, mounted in `settings/sections/ModesSection.tsx`'s Advanced disclosure |
| 1265-1287, 1819-1837 | `ApiKeysForm` mount + `handleApiKeyChange` | `settings/sections/AccountsSection.tsx` |
| 1210-1212, 1368-1378, 1839-1861 | LM Studio base URL field | `settings/sections/AccountsSection.tsx` (Advanced disclosure) |
| 1866 | `<VisibleModelsTab />` | **superseded**, not moved — `model-select/ModelSettingsRows` (W4) mounted in `settings/sections/ModelsSection.tsx`; see inventory doc's deviations |
| 1868 | `<ModelProfilesTab />` | `settings/sections/ModelsSection.tsx` (Advanced disclosure), component moved to `settings/ModelProfilesTab.tsx` |
| 1870 | `<PromptProfilesTab />` | `settings/sections/ModesSection.tsx` (Advanced disclosure), component moved to `settings/PromptProfilesTab.tsx` |
| 1872-1878 | `<DefaultsTab onOpenVisibleModels={...} />` | **split**: model-selection fields -> `settings/ModelDefaultsPanel.tsx` (Models Advanced); ambient-chat enable/shortcut/accessibility -> `settings/AmbientChatPanel.tsx` (App Advanced) |
| 1880-1884 | `<ToolsTab />` mount | `settings/sections/ConnectionsSection.tsx` |
| 1886-1890 | `<PermissionsTab />` mount | `settings/sections/AppSection.tsx`, component moved to `settings/PermissionsTab.tsx` |
| 1380-1383, 1892-1986 | custom base URL field + explanation copy | `settings/sections/AccountsSection.tsx` (Advanced disclosure) |
| 1990-2003 | hidden font-preloader `<div>` | `settings/sections/AppSection.tsx` (kept next to the font selects that are its only reason to exist) |
| 2007-2020 | `<Dialog>`/`<DialogContent>` + two `<ImportChatDialog>` mounts | `Settings.tsx` (thin wrapper — unchanged mechanism, new route bridge added) |

## Satellite files (moved into `settings/`, own git history predates this table)

| Old path | New path | Changed? |
|---|---|---|
| `components/ApiKeysForm.tsx` | `settings/ApiKeysForm.tsx` | import paths only (`./ui/*` -> `../ui/*`) |
| `components/ShortcutRecorder.tsx` | `settings/ShortcutRecorder.tsx` | import paths only |
| `components/ToolPermissionDialog.tsx` | `settings/ToolPermissionDialog.tsx` | none (zero relative imports in the original) |
| `components/PermissionsTab.tsx` | `settings/PermissionsTab.tsx` | none (zero relative imports in the original) |
| `components/ModelProfilesTab.tsx` | `settings/ModelProfilesTab.tsx` | import paths only |
| `components/PromptProfilesTab.tsx` | `settings/PromptProfilesTab.tsx` | import paths only |
| `components/AccessibilityCheck.tsx` | `settings/AccessibilityCheck.tsx` | none (zero relative imports in the original) |
| `components/DefaultsTab.tsx` | **deleted**, split into `settings/ModelDefaultsPanel.tsx` + `settings/AmbientChatPanel.tsx` | real split, not a move |
| `components/VisibleModelsTab.tsx` + `visibleModelsSearch.ts` + `VisibleModelsTab.search.test.ts` | **deleted, not moved** | superseded by `model-select/ModelSettingsRows.tsx` (W4) |

## Why `Settings.tsx` is still a `Dialog`, not a `<Route>` element

Considered making `/settings` a plain routed page (mirroring Fleet/Wiki:
sidebar stays, `<Routes>` swaps the main content, current chat unmounts).
Rejected because that would be a real behavior change — today, opening
Settings is a non-destructive overlay; whatever chat you had open keeps its
scroll position/streaming state behind the dialog. Fleet/Wiki don't have
that precedent to protect (navigating to them is always a deliberate
"leave the chat" action); Settings does, four different ways
(menu/shortcut/sidebar-button/command-menu), none of which should suddenly
start unmounting your chat.

Instead: `Settings.tsx` keeps the exact pre-rework `Dialog`/`dialogActions`/
`SETTINGS_DIALOG_ID` mechanism (byte-for-byte compatible with all 4 existing
entry points), and separately watches `useLocation()` — when the pathname
matches `/settings` or `/settings/:section`, it opens the dialog itself, no
different from the Rust menu event doing so. Two tiny `<Route>` entries in
`App.tsx` (`element={null}`) exist purely so `<Routes>` recognizes the path
as "real" instead of falling through to blank content behind the dialog's
own backdrop — they render nothing; `Settings.tsx`'s effect does the actual
work, which means it works exactly the same whether or not those routes
happen to match (a nice property: the dialog-opening logic has exactly one
implementation, not two that could drift).

`SettingsShell.tsx` then decides, per click, whether the URL needs to track
the active section:
- **Opened via the route** (`isRouteActive`): nav clicks
  `navigate(`/settings/${id}`, { replace: true })` — URL always mirrors the
  active section, never grows history (so `navigate(-1)` on close always
  lands exactly one step back, regardless of how many sections were browsed).
- **Opened via the legacy mechanism** (menu/shortcut/`open_settings` event):
  nav clicks are local `setState` only — the URL is never touched, exactly
  matching every observable behavior of the pre-rework `activeTab` state.

## Deviations from the literal design mock (intent yes, literal no)

- **"← Back / Home" header control**: dropped. Not meaningful inside a modal
  overlay (there's no "page" to go back to — the chat is still there,
  visible the instant you close the dialog). The `[×]` close button (new —
  the pre-rework dialog had no visible close affordance at all) covers the
  same intent.
- **Active nav item styling**: `bg-muted`, not `bg-accent`/`bg-sidebar-accent`
  — design/settings.md's own Deviations table already resolved this
  (DESIGN.md's Quiet Accent Rule: accent fill is reserved for state, not nav
  chrome) before W3 started; followed its resolution rather than
  re-deriving it.
- **Content pane max-width**: individual sections keep their pre-existing
  `max-w-2xl` (672px) rather than the mock's literal 768px. Not worth
  touching five files' width classes for a 96px difference in a narrow
  reading column; both satisfy "centered, readable prose width."
- **"Domain configs" (Connections section)**: not built. No such capability
  exists anywhere in the current codebase — see the P0 inventory's
  deviations list for the full reasoning.
