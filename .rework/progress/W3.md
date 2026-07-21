# W3 Progress — Settings Rework

## State: DONE. All four phases (P0-P4) complete and committed.

## NEXT ACTION
None outstanding. If resumed: re-run the three gates (commands below) to
confirm nothing drifted, then hand off to the orchestrator for merge/PR.
Open items are listed under "Open questions for the orchestrator" — none
are blocking.

Gates (from repo root):
```
export PATH="/c/Users/rsrchintern2/tools/node-v24.18.0-win-x64:$PATH"
node node_modules/typescript/bin/tsc --noEmit          # must be 0 errors
node node_modules/eslint/bin/eslint.js src/ui/components/settings src/ui/components/Settings.tsx
node node_modules/vitest/vitest.mjs run                # 371/371 expected
```

## Phase checklist
- [x] P0 — inventory (`docs/rework/w3-settings-inventory.md`, commit
      `f97419b`). 33 individual settings mapped old-tab -> new-section,
      documents the 4 pre-existing Settings-dialog entry points, and the
      dead legacy `?tab=` searchParams path (confirmed unreachable).
- [x] P1 — strangler extraction into `src/ui/components/settings/**`.
      Session died mid-phase once (API error) — orchestrator preserved the
      in-flight work as `b6ed8c1`; resumed from there. All satellite tabs
      moved (ToolPermissionDialog/PermissionsTab/ModelProfilesTab/
      PromptProfilesTab/ApiKeysForm/ShortcutRecorder/AccessibilityCheck),
      `DefaultsTab.tsx` split (ModelDefaultsPanel + AmbientChatPanel),
      `VisibleModelsTab.tsx`+helper+test deleted (superseded, not moved —
      see inventory doc), old top-level originals deleted once nothing
      referenced them. `Settings.tsx` rewritten as a thin Dialog wrapper
      (2021 -> 116 lines). Commits: `f6db2f1`, `9a16893`, `d2022e4`,
      `3e92c1b`, `d629d40`, plus fixes `1817bc5` (eslint
      react-refresh/only-export-components — split `RECOMMENDED_TOOLSETS`
      into its own data file), `73de2e3` (restored two capabilities I'd
      silently dropped on first pass: the font-preloader div and the
      Sans-Font `SelectItem`s' `onFocus` live-preview — caught on
      self-review against the deleted original, before it left git
      history), and `22642fe` (post-hoc file-size split — see below).
- [x] P2 — `settings/SettingsShell.tsx` (commit `25dade9`): left nav
      (sidebar-smoke surface, `.sidebar-label` header, 14px items,
      `sidebar-accent` hover), search-filter input (gets `focus:ring-special`
      for free from the shared `Input` primitive), count badges, "Absorbed"
      footer footnote (real copy from the P0 inventory, not the mock's
      fictional example) + Documentation external-link row. Registry split
      commit `276bec5`: `sectionMeta.ts` (pure — id/label/description/icon/
      keywords/resolution logic, zero data-hook imports so it's unit-
      testable) + `registry.ts` (thin combiner that zips the 5 section
      *components* onto that metadata) — see Landmines below for why the
      split was necessary, not stylistic.
- [x] P3 — routing (commit `b08bae4`): `/settings` + `/settings/:section`
      appended to `App.tsx`'s `<Routes>` (both `element={null}` — the real
      work is `Settings.tsx`'s own `useLocation()` watcher, so the dialog-
      opening logic has exactly one implementation regardless of entry
      point). `defaultSettingsTab`/`SettingsTabId` renamed to
      `defaultSettingsSection`/loose `string` in `App.tsx` (renders
      `<Settings section={defaultSettingsSection} />` now). Three
      brief-mandated legacy-tab-id repoints, commit `d0260f2`:
      `AppSidebar.tsx`'s gear icon (`"general"` -> `"accounts"`),
      `ManageModelsBox.tsx`'s `handleAddApiKey` (`"api-keys"` ->
      `"accounts"`) and `handleOpenProfile` (`"visible-models"` ->
      `"models"`).
- [x] P4 — design pass. Folded into P1-P3 rather than a separate mechanical
      pass, since `docs/rework/design/settings.md` was already committed
      and read before any code was written — every section's IA/copy/order
      already matches it (Accounts·Models·Modes·Connections·App, in that
      order; provider-card anatomy; mode-card anatomy; App-section row
      list). Deviations from the literal mock (all intent-yes/literal-no,
      per the brief's own resolution rule) are catalogued in
      `settings/MIGRATION-NOTES.md`'s final section and the P0 inventory's
      "Decisions requiring a documented deviation" list.

## Final shape

- `Settings.tsx`: **116 lines** (was ~2021 / ~85KB). Thin `Dialog` wrapper +
  `useLocation()` route bridge + the two `ImportChatDialog` mounts.
- `src/ui/components/settings/`: 27 files, ~5,300 lines total, every file
  ≤400 lines (two — `AppSection.tsx`, `ModelDefaultsPanel.tsx` — briefly
  exceeded that during P1 and were split again before this ledger's final
  commit; see `MIGRATION-NOTES.md`'s addendum).
- Registry shape (`settings/sectionMeta.ts` + `settings/registry.ts`):
  ```ts
  type SettingsSectionId = "accounts" | "models" | "modes" | "connections" | "app";
  interface ISettingsSectionMeta { id, label, description, icon: LucideIcon, keywords: string[] }
  interface ISettingsSection extends ISettingsSectionMeta { component: ComponentType<ISettingsSectionProps> }
  interface ISettingsSectionProps { navigateToSection: (id: SettingsSectionId) => void }
  const SETTINGS_SECTIONS: ISettingsSection[]  // registry.ts, order = nav order
  resolveSettingsSection(value): SettingsSectionId  // old-tab-id/unknown -> new id, unknown -> first
  ```
- Merged-component mount map (who owns it -> where it's mounted):
  - W1 `ProviderAccountCard`/`QuotaBar`/`useProviderAccounts`/
    `useConnectProviderAccount`/`useDisconnectProviderAccount` ->
    `settings/sections/AccountsSection.tsx` (grid of cards; oauth-kind
    providers get real connect/disconnect wiring; the api-key-kind
    `openrouter` card intentionally gets no buttons — see its file comment
    — the `ApiKeysForm` block below it is the real entry point).
  - W4 `ModelSettingsRows` -> `settings/sections/ModelsSection.tsx` (primary
    content; `onAddApiKey` calls `navigateToSection("accounts")`).
  - W6 `ModesAPI` (`useModes`/`useCreateMode`/`useUpdateMode`/
    `useDeleteMode`) -> `settings/sections/ModesSection.tsx` (new stance
    cards + a new inline create/edit form, `settings/ModeEditForm.tsx` —
    W6 built the data layer + composer picker but explicitly left the
    Settings-side CRUD UI for W3, per its own PROGRESS.md).
  - W7 `useFleetEndpoint`/`useSetFleetEndpoint`/`useFleetConnectionState` ->
    new `settings/connections/FleetDaemonCard.tsx`, mounted at the top of
    `settings/sections/ConnectionsSection.tsx`.

## Decisions log

- 2026-07-22 **Settings stays a `Dialog`, not a `<Route>` element.** Full
  reasoning in `settings/MIGRATION-NOTES.md`'s "Why Settings.tsx is still a
  Dialog" section — short version: unlike Fleet/Wiki, opening Settings has
  never unmounted whatever chat was open behind it, and four different
  existing entry points depend on that; converting to a route would be an
  unflagged behavior change disguised as "just routing." `/settings` and
  `/settings/:section` are layered on as an additional way in via a
  `useLocation()` watcher inside `Settings.tsx` itself.
- 2026-07-22 **`registry.ts` split into `registry.ts` + `sectionMeta.ts`**
  (commit `276bec5`), discovered the hard way (a crashing test, not a
  hunch): `registry.ts` imports the 5 section *components* for the
  `component:` field, which transitively import their `@core/chorus/api/*`
  data hooks, which import `@core/chorus/DB.ts`'s module-top-level `await
  Database.load(...)` — that throws "window is not defined" under plain
  vitest. Exactly the landmine class W6's PROGRESS.md documents for
  `ChatState.ts`/`promptOptimizer.ts` (import types from value-heavy
  modules, never values) — worth remembering for **any** future settings
  file that wants to unit-test pure id/label logic: import from
  `sectionMeta.ts`, never `registry.ts`.
- 2026-07-22 **`VisibleModelsTab.tsx` deleted, not moved** (+ its
  `visibleModelsSearch.ts` helper + `.search.test.ts`). W4's
  `ModelSettingsRows.tsx` already re-implements the same capability with a
  better no-API-key-row UX (dim + inline CTA vs. hiding the whole
  provider), and W4's own doc comment on that file explicitly flagged this
  exact supersession for W3 to resolve. Confirmed via repo-wide grep that
  nothing else imported either file before deleting.
- 2026-07-22 **`DefaultsTab.tsx` split by subject**, not moved verbatim:
  model-selection defaults -> `settings/ModelDefaultsPanel.tsx` (Models
  Advanced disclosure); ambient-chat enable/shortcut/accessibility ->
  `settings/AmbientChatPanel.tsx` (App Advanced disclosure). The 5-section
  IA has no single home for both halves' unrelated subjects.
- 2026-07-22 **Two capabilities caught missing on self-review, restored
  before the original file left git history** (commit `73de2e3`): the
  hidden font-preloader `<div>` (now in `AppPreferencesPanel.tsx`), and the
  Sans-Font `<SelectItem>`s' `onFocus` live-preview + per-item font-styled
  span (both restored verbatim). Lesson: a line-by-line diff against the
  original before deleting it is worth doing even after tsc/eslint/vitest
  all pass clean — those gates catch broken code, not silently-dropped
  *working* code.
- 2026-07-22 **Universal system prompt and Prompt Profiles kept as clearly-
  labeled "Advanced" disclosures under Modes**, not merged into the new
  stance-card grid. Both are real, different entities from the new
  `modes`/`chat_modes` W6 built (one global text blob; a pre-existing
  persona system) — W6's own decision log says explicitly "do not conflate
  the two." Same reasoning for Model Profiles under Models' Advanced
  disclosure.
- 2026-07-22 **"Domain configs" (design/settings.md's Connections section)
  not built.** No such capability — tools+mode+artifact-palette bundling —
  exists anywhere in the current codebase to migrate. Flagged as a
  follow-up feature request in this report, not a silent gap.
- 2026-07-22 Kept the `open_settings` Tauri event's wire shape
  (`{tab: string}`) unchanged rather than renaming to `{section}` —
  minimizes the diff to the two W4/W7-owned files I touch (one repointed
  string literal each) to exactly what the brief pre-authorizes.
- 2026-07-22 **Post-hoc file-size split** (commit `22642fe`): `AppSection.tsx`
  (476 lines) and `ModelDefaultsPanel.tsx` (509 lines) both briefly exceeded
  the brief's ~400-line guideline. Extracted `AppPreferencesPanel.tsx`
  (theme/font/title-model selects + toggles + font-preloader) and
  `ChatModelsChecklist.tsx` + shared `formatCostSuffix.ts` (the provider-
  grouped chat-models checklist). Pure extraction, re-verified gates after.

## `as`/forbidden-feature audit

- **No new `as` assertions** anywhere in `settings/**` or the touched lines
  of `App.tsx`/`AppSidebar.tsx`/`ManageModelsBox.tsx`/`Settings.tsx`
  (grepped explicitly; the only `as` in `AppPreferencesPanel.tsx` —
  `newMode as "light" | "dark" | "system"` — is carried over unchanged from
  the original `Settings.tsx`'s pre-existing `handleThemeChange`, not new).
- **`useRef`**: one pre-existing instance, carried over verbatim in the
  *moved* `settings/ShortcutRecorder.tsx` (`keysRef`/`inputRef`, DOM-ref +
  transient-key-tracking use) — not new code written by this workstream;
  falls under ORCHESTRATION.md's DOM-ref pre-authorization regardless.
- **No `setTimeout`/`useImperativeHandle`** anywhere in `settings/**`.
- **No new dependency** added to `package.json`.

## Landmines / do-not
- Do not import section *components* (`registry.ts`, or any
  `sections/*.tsx`) from a vitest test file — see the Decisions log entry
  above. Pure id/label logic lives in `sectionMeta.ts` specifically so it's
  safe to import from tests; `sectionMeta.test.ts` is the pattern to copy.
- Relative-import depth is easy to get wrong when a file moves one level
  (`components/X.tsx` -> `settings/X.tsx` needs `../ui/*`, not `./ui/*`) —
  I made this exact mistake three separate times across this session
  (`AmbientChatPanel.tsx`/`UniversalSystemPromptPanel.tsx` first, then
  `ChatModelsChecklist.tsx` again later) before tsc caught each one. Always
  re-run tsc immediately after any file move, don't trust the diff by eye.
- `model-select/**`, `accounts/**`/`ProviderAccountsAPI.ts`, `fleet/**`,
  `ModesAPI.ts` are read-only for this workstream (per
  `00-ARCHITECTURE.md §8`) — mount, don't edit. The only pre-authorized
  exceptions are the two `ManageModelsBox.tsx` string-literal repoints.
- `openrouter`'s `ProviderAccountCard` intentionally has no `onConnect`/
  `onDisconnect` wired (see `AccountsSection.tsx`'s file comment) — don't
  "fix" this by wiring the oauth-shaped stub mutation to it; that would
  silently mark it "connected" without validating a real key.

## Open questions for the orchestrator
1. **Content-pane width**: sections keep their pre-existing `max-w-2xl`
   (672px) rather than design/settings.md's literal 768px spec. Cosmetic,
   didn't seem worth a 5-file diff for 96px — flag if you disagree.
2. **"Domain configs"**: confirmed out of scope for this PR (no existing
   capability to migrate) — worth a follow-up issue if the product still
   wants it.
3. **Dialog vs. full-page route**: Settings stays a `Dialog` (see Decisions
   log) rather than a full-page route like Fleet/Wiki. If a future decision
   moves Settings to a full page, `SettingsShell.tsx` itself needs no
   changes (it already dual-sources its active section from either the
   route or a prop) — only `Settings.tsx`'s outer wrapper would change.

## User-test queue (full regression checklist — every P0 inventory item)

**Entry points**
- [ ] Sidebar gear icon / `⌘,` tooltip -> opens Settings on **Accounts**.
- [ ] Rust menu "Settings" -> toggles the dialog open/closed (unchanged).
- [ ] Command menu (`⌘K` -> "Settings") -> opens on whichever section was
      last active this session.
- [ ] `ManageModelsBox`'s "Add API key" CTA (locked model row) -> closes the
      model picker, opens Settings on **Accounts**.
- [ ] `ManageModelsBox`'s profile chip (per-model variant switcher) -> opens
      Settings on **Models**.
- [ ] Typing a route to `/settings` or `/settings/models` directly (e.g. via
      command menu "forward"/browser devtools navigation) opens the dialog
      to that section; closing it (Escape, `[x]`, click outside) returns to
      whatever was showing before.

**Accounts section**
- [ ] 6 provider cards render (anthropic/openai/google/copilot/openrouter/
      local); oauth-kind cards show Connect (not-configured) or Disconnect
      (connected, via the stub mutations — real 9router wiring is W1's
      follow-up, not this PR's).
- [ ] Typing an OpenRouter API key below immediately flips its card to
      "Connected" (derived client-side from the key, not the stub).
- [ ] API Keys block: all 7 providers (anthropic/openai/google/perplexity/
      openrouter/grok/firecrawl) still editable exactly as before.
- [ ] Advanced disclosure: Custom Base URL + LM Studio base URL fields both
      persist (same `app_metadata`/`SettingsManager` keys as before).

**Models section**
- [ ] Search + rows (favorite star, visibility toggle, quota bar, delete for
      custom models) work exactly as the pre-rework `ManageModelsBox`
      catalog did.
- [ ] "Add custom model" -> `/new-prompt` (unchanged destination).
- [ ] Advanced -> Chat defaults: prompt profile / fallback model (+
      compatible-profile) / ambient model / chat-models checklist all
      persist to the same `SettingsManager` keys as before.
- [ ] Advanced -> Model Profiles: create/edit/delete named model sets,
      unchanged.

**Modes section**
- [ ] Stance cards (Assist/Critic/whatever exists) show icon, description,
      truncated prompt preview, usage count, tag badge.
- [ ] "Create mode…" -> inline form -> new card appears; Edit -> inline
      form pre-filled; Delete (user-authored only) removes it.
- [ ] Advanced -> Universal system prompt: textarea + reset-to-default,
      same `app_metadata.universal_system_prompt` key.
- [ ] Advanced -> Prompt Profiles: create/edit/delete personas, unchanged.

**Connections section**
- [ ] Fleet daemon card shows current connection state; "Configure" reveals
      an endpoint input, saves to `fleet_endpoint`.
- [ ] MCP: quick-start grid (new local/remote MCP, Claude Desktop import,
      5 recommended one-click servers), Custom/Built-in tabs, GitHub
      "Manage Connection" button on the built-in github row — all unchanged
      from the pre-rework `ToolsTab`.

**App section**
- [ ] Theme/Sans-Font (incl. live-preview-on-focus)/Chat-title-model selects
      persist as before.
- [ ] Auto-convert-long-text / auto-scrape-urls / cautious-enter (dual-
      writes `app_metadata.cautious_enter`) / show-cost toggles all persist.
- [ ] Tool Permissions block (+ YOLO mode, global and per-tool) unchanged.
- [ ] Import from OpenAI/Anthropic buttons still open their existing import
      dialogs.
- [ ] Advanced -> Ambient Chat: enable toggle, shortcut recorder (+ "Set to
      default"/"Save and restart"), screen-recording permission check —
      all unchanged.
- [ ] Advanced -> Restart Onboarding / feedback link / book-a-call link /
      "Configure API Keys" (-> Accounts) all work.
- [ ] Opening the font dropdowns doesn't show a flash-of-unstyled-text (the
      preloader div is present and scoped to this section now).

**Shell**
- [ ] Left nav: 5 sections in order, icons, count badges (connected
      accounts / visible models / modes / custom toolsets — App has none).
- [ ] Search input filters the nav by label/description/keyword; clearing
      it restores all 5; searching something that matches nothing shows
      "No matching sections."
- [ ] Active section uses a plain muted fill (not the accent color) per
      design/settings.md's own resolution.
- [ ] "Documentation" nav-footer link opens `docs.chorus.sh` without
      switching section content (same as the old "docs" tab's behavior).
- [ ] Both light and dark themes — not visually verified here (cannot run
      the app); reasoned through DESIGN.md tokens only (sidebar-*, `--muted`,
      `--helper`, `--success`/`--warning` for the fleetd status dot).
