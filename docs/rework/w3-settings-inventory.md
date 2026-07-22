# W3 — Settings Inventory (P0)

Every setting currently reachable from `Settings.tsx` (the ~85KB/2021-line
monolith), its storage, its component, and its current location. This is the
regression checklist for the PR test plan — every row must map onto one of
the 5 new sections (**Accounts · Models · Modes · Connections · App**) or be
explicitly flagged as an intentional, documented change (never a silent
drop).

## How Settings is currently opened

**Not a route — a global `Dialog`.** `<Settings tab={defaultSettingsTab} />`
is mounted unconditionally in `App.tsx`'s `AppContent` (outside `<Routes>`,
alongside `<AppSidebar>`/`<CommandMenu>`), gated by Radix `Dialog`'s own
`activeDialogId === SETTINGS_DIALOG_ID` check (`useDialogStore`). It overlays
whatever route is currently active without unmounting it (e.g. your chat
keeps its state behind the dialog).

Four entry points, all converging on the same `SETTINGS_DIALOG_ID` dialog:
1. **Rust menu item** (`menu-settings` event, `App.tsx:622-642`) — toggles
   open/close, does not set a tab.
2. **`open_settings` Tauri event** (`App.tsx:767-787`) — payload
   `{ tab: SettingsTabId | "quick-chat" }`; sets `defaultSettingsTab` state
   then opens the dialog. Emitters: `AppSidebar.tsx`'s gear icon/`⌘,`
   tooltip (`tab: "general"`), `ManageModelsBox.tsx`'s `handleAddApiKey`
   (`tab: "api-keys"`) and `handleOpenProfile` (`tab: "visible-models"`,
   W4's temporary routing — brief says to repoint this one).
3. **`CommandMenu.tsx`**'s "Settings" item (`⌘,`) — calls
   `dialogActions.openDialog(SETTINGS_DIALOG_ID)` directly, no tab (opens
   whatever tab was last active this session, default `"general"`).
4. **`model-select/ModelSettingsRows.tsx`**'s own internal fallback (only
   fires if W3 mounts it without an explicit `onAddApiKey`) —
   `emit("open_settings", { tab: "api-keys" })`.

Legacy dead code: `Settings.tsx` also reads `useSearchParams().get("tab")` and
redirects `"quick-chat"` → `"defaults"`. Grepped the whole repo — nothing
ever sets a `?tab=` query param before opening Settings (the only other
`?tab=` user is `wiki/WikiView.tsx`, an unrelated coincidence of naming for
its own in-page tabs). This path is unreachable in practice; not carried
forward as a route mechanism, but the value-remapping idea (old id → new
section) is preserved via `settings/registry.ts`'s legacy map.

## Inventory table

| # | Setting | Storage | Current component | Current location (tab) | New section |
|---|---------|---------|--------------------|------------------------|-------------|
| 1 | Theme (light/dark/system) | `useTheme()` (localStorage via `ThemeProvider`, key `melty-theme`) | `Settings.tsx` inline `<Select>` | General, ~line 1524-1548 | **App** |
| 2 | Sans font | `SettingsManager` (`sansFont`) + `useTheme().setSansFont` | `Settings.tsx` inline `<Select>` | General, ~1551-1595 | **App** |
| 3 | Mono font | `SettingsManager` (`monoFont`) + `useTheme().setMonoFont` | Loaded in `useEffect` (~1293) but **no `<Select>` renders it** — pre-existing dead/latent capability, not a regression introduced here | General (latent) | **App** (left as-is; not fabricating new UI for a gap that predates this rework) |
| 4 | Chat title model | `SettingsManager` (`titleGenerationModelConfigId`) | `Settings.tsx` inline `<Select>` | General, ~1597-1643 | **App** |
| 5 | Auto-convert long text | `SettingsManager` (`autoConvertLongText`) | `Settings.tsx` inline `<Switch>` | General, ~1645-1664 | **App** |
| 6 | Auto-scrape URLs | `SettingsManager` (`autoScrapeUrls`) | `Settings.tsx` inline `<Switch>` | General, ~1666-1684 | **App** |
| 7 | Cautious Enter | `SettingsManager` (`cautiousEnter`) + `app_metadata.cautious_enter` (dual-write) | `Settings.tsx` inline `<Switch>` | General, ~1686-1704 | **App** |
| 8 | Show message cost | `SettingsManager` (`showCost`) | `Settings.tsx` inline `<Switch>` | General, ~1706-1722 | **App** |
| 9 | Restart onboarding | `app_metadata` (`has_dismissed_onboarding`, `onboarding_step`) | `Settings.tsx` `showOnboarding()` button | General, ~1485-1492 | **App** (Advanced/General block) |
| 10 | Feedback / book-a-call links | n/a (external) | `Settings.tsx` inline | General, ~1494-1511 | **App** (Advanced/General block) |
| 11 | Import chat history (OpenAI/Anthropic) | Importers write chats directly to DB | `Settings.tsx` buttons + `ImportChatDialog.tsx` (own dialog id `import-openai`/`import-anthropic`) | Import tab, ~1729-1767 | **App** |
| 12 | Universal system prompt | `app_metadata.universal_system_prompt` | `Settings.tsx` `<Textarea>` + reset button, `useReactQueryAutoSync` | System Prompt tab, ~1769-1817 | **Modes** (Advanced disclosure — distinct from the new per-mode prompts, but same "system prompt" subject area) |
| 13 | API keys (anthropic/openai/google/perplexity/openrouter/grok/firecrawl) | `SettingsManager` (`apiKeys` map) | `ApiKeysForm.tsx` | API Keys tab, ~1819-1837 | **Accounts** |
| 14 | LM Studio base URL | `SettingsManager` (`lmStudioBaseUrl`) | `Settings.tsx` inline `<Collapsible>` + `<Input>` | API Keys tab, ~1839-1861 | **Accounts** (Advanced disclosure — matches design/settings.md's explicit listing) |
| 15 | Visible models (per-provider, per-model toggle + fetch) | `provider_visibility` table (`ProviderVisibilityAPI`) | `VisibleModelsTab.tsx` (+ `visibleModelsSearch.ts` helper) | Visible Models tab | **Models** — **superseded**, see Decisions below (not a straight move) |
| 16 | Model profiles (named sets) | `model_profiles` table (`ModelProfilesAPI`) | `ModelProfilesTab.tsx` | Model Profiles tab | **Models** (Advanced disclosure) |
| 17 | Prompt profiles (personas) | `prompt_profiles` table (`PromptProfilesAPI`) | `PromptProfilesTab.tsx` | Prompt Profiles tab | **Modes** (Advanced disclosure — adjacent subject, explicitly a *different* entity than the new Modes/stances; kept clearly labeled apart) |
| 18 | Default prompt profile | `SettingsManager` (`defaultPromptProfileId`) | `DefaultsTab.tsx` | Defaults tab | **Models** (Advanced → Chat defaults, split from DefaultsTab) |
| 19 | Default fallback model (+ compatible profile) | `SettingsManager` (`defaultFallbackModel`, `defaultFallbackModelProfileId`) | `DefaultsTab.tsx` | Defaults tab | **Models** (Advanced → Chat defaults) |
| 20 | Default ambient chat model | `SettingsManager` (`defaultAmbientChatModel`) | `DefaultsTab.tsx` | Defaults tab | **Models** (Advanced → Chat defaults) |
| 21 | Default chat models (explicit list) | `SettingsManager` (`defaultChatModels`) | `DefaultsTab.tsx` | Defaults tab | **Models** (Advanced → Chat defaults) |
| 22 | Ambient Chat enable toggle | `SettingsManager` (`quickChat.enabled`) | `DefaultsTab.tsx` | Defaults tab (bottom "Ambient Chat" block) | **App** (Advanced → Ambient Chat, split from DefaultsTab) |
| 23 | Ambient Chat shortcut | `SettingsManager` (`quickChat.shortcut`) | `DefaultsTab.tsx` + `ShortcutRecorder.tsx` | Defaults tab | **App** (Advanced → Ambient Chat) |
| 24 | Screen-recording permission (ambient chat capture) | OS-level, checked via `tauri-plugin-macos-permissions-api` | `AccessibilityCheck.tsx`'s `AccessibilitySettings` | Defaults tab | **App** (Advanced → Ambient Chat) |
| 25 | Custom base URL (proxy for all model requests) | `app_metadata` (`AppMetadataAPI.useCustomBaseUrl`) | `Settings.tsx` inline | Base URL tab | **Accounts** (Advanced disclosure — matches design/settings.md) |
| 26 | Custom/remote MCP toolsets (create/edit/delete) | `custom_toolsets` (`ToolsetsAPI`) | `Settings.tsx`'s `ToolsTab`/`ToolsetForm`/`RemoteToolsetForm`/`CustomToolsetRow` | Connections tab | **Connections** |
| 27 | Built-in toolsets (read-only list + GitHub "Manage Connection" link) | `ToolsetsManager.instance` (static) | `Settings.tsx`'s `ToolsTab` | Connections tab | **Connections** |
| 28 | Import from Claude Desktop (MCP config) | writes into `custom_toolsets` | `Settings.tsx`'s `ToolsTab` | Connections tab | **Connections** |
| 29 | Recommended MCP quick-adds (context7/replicate/stripe/elevenlabs/supabase) | writes into `custom_toolsets` | `Settings.tsx`'s `ToolsTab` | Connections tab | **Connections** |
| 30 | Tool permissions (per-tool always-allow/ask/deny) | `tool_permissions` table (`ToolPermissionsAPI`) | `PermissionsTab.tsx` | Permissions tab | **App** |
| 31 | YOLO mode (global + per-tool) | `app_metadata.yolo_mode` + `tool_yolo` table | `PermissionsTab.tsx` | Permissions tab | **App** |
| 32 | Tool permission request modal (runtime, not a settings *row* but shares `ToolPermissionsAPI`) | `ToolPermissionStore` (in-memory) | `ToolPermissionDialog.tsx` — mounted globally in `App.tsx`, **not** inside the Settings dialog at all | n/a (global overlay) | stays a global overlay; file moves under `settings/` per the brief's explicit list, mount point in `App.tsx` unchanged |
| 33 | Documentation link | n/a (external `https://docs.chorus.sh`) | `Settings.tsx`'s nav item, tab id `"docs"` (never rendered content — always just opened a URL) | nav-only, all tabs | **shell nav footer** (small external link, same behavior — click opens the URL, does not switch section) |

## Decisions requiring a documented deviation (not silent drops)

- **#15 Visible Models supersession.** W4's `model-select/ModelSettingsRows.tsx`
  (mounted verbatim by W3, per this workstream's brief) already re-implements
  every capability `VisibleModelsTab.tsx` had — per-model visibility toggle
  (`useSetModelVisibility`), and provider-grouped refresh for
  OpenRouter/Ollama/LM Studio (`CatalogGroupsList.tsx`'s `RefreshButton`,
  wired to the same `useRefreshOpenRouterModels`/`useRefreshOllamaModels`/
  `useRefreshLMStudioModels` mutations) — plus improves the no-API-key case
  (dimmed row + inline "Add API key" CTA, instead of hiding the provider's
  models entirely). W4's own doc comment on `ModelSettingsRows.tsx` flags
  this exact supersession for W3 to resolve. Resolution: `VisibleModelsTab.tsx`
  + its `visibleModelsSearch.ts` helper + `VisibleModelsTab.search.test.ts`
  are deleted (not left as orphaned dead code); the *capability* (choose which
  models are visible, per model, per provider) is fully preserved via
  `ModelSettingsRows`, just consolidated into a single, richer row UI instead
  of two parallel ones. Flagged prominently in the PR test plan.
- **#12 vs. Modes cards.** The universal system prompt (one global text blob,
  prepended to every chat) and the new `modes`/`chat_modes` stance entities
  (W6, per-mode prompts selected per chat/message) are two independent
  features that happen to both edit "a system prompt." They are **not**
  merged in the UI — the universal prompt lives in a clearly-labeled
  "Advanced" disclosure below the Modes stance-card grid, explicitly captioned
  to distinguish it from per-mode prompts.
- **#17 Prompt Profiles vs. Modes.** Same reasoning as #12: Prompt Profiles
  (`prompt_profiles`, a pre-existing, out-of-scope persona system) is visually
  and conceptually adjacent to the new Modes section but is a **different
  entity** (W6's own decision log: "do not conflate the two"). Kept as its
  own clearly-labeled disclosure under Modes rather than merged into the
  stance-card grid or moved to a section with no thematic connection at all.
- **#18-24 DefaultsTab split.** The pre-existing `DefaultsTab.tsx` bundled six
  unrelated concerns (model selection defaults, ambient-chat shortcut/enable,
  OS accessibility permission). The 5-section IA has no single natural home
  for all of them together, so the component is split by subject: model
  selection defaults → Models section's Advanced disclosure; ambient-chat
  enable/shortcut/accessibility → App section's Advanced disclosure. Every
  individual control keeps its exact existing storage key and behavior —
  only the file/section boundary changes.
- **"Domain configs" (design/settings.md's Connections section)** describes a
  bundling feature (tools + mode + artifact palette per domain) that **does
  not exist anywhere in the current codebase** — grepped for any existing
  "domain config" concept and found none. Since W3's mandate is to preserve
  every *existing* capability (not build new ones the design doc aspires to),
  this is intentionally **not built** in this PR. Flagged as a follow-up
  feature request in the PR description, not a regression (there is nothing
  to migrate).
- **"← Back / Home" dialog chrome.** design/settings.md's ASCII mock shows a
  page-level back/home affordance. Settings stays a `Dialog` overlay (not a
  route that replaces the current view) to avoid unmounting whatever chat is
  open behind it — see `settings/MIGRATION-NOTES.md` for the full reasoning.
  Only the `[×]` close affordance is implemented (new — the old dialog had no
  visible close button at all, only outside-click/Escape); "← Back" is
  dropped as not meaningful inside a modal overlay.
