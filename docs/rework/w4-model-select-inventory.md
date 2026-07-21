# W4 — Model Select Inventory (P0)

Regression checklist for the rework PR. Every behavior below either gets
ported into `src/ui/components/model-select/**` (P1-P2), gets consciously
changed (noted as **CHANGE**), or is explicitly out of scope (noted as
**OUT OF SCOPE**) because it belongs to another workstream's owned files.

Source read: `ManageModelsBox.tsx` (1202 lines), `QuickChatModelSelector.tsx`,
`ModelPills.tsx`, `VisibleModelsTab.tsx`, `ModelProfilesTab.tsx`,
`visibleModelsSearch.ts`, `ChatInput.tsx`, `MultiChat.tsx`,
`MultiChatDeprecationPath.tsx`, `ChatCompareSelection.ts`, `ModelFiltering.ts`,
`ProxyUtils.ts`, `Models.ts`, `SCHEMA.md`, plus W1's frozen
`ProviderAccountsAPI.ts` / `ProviderAccounts.ts` / `accounts/QuotaBar.tsx` /
`accounts/providerAccountDisplay.ts`.

## 1. Consumer contract (MUST NOT CHANGE)

`ManageModelsBox` has exactly 4 JSX mount sites, all outside my ownership
(W6/W2 territory) — the external props shape is load-bearing:

| Mount site | Mode | Notes |
|---|---|---|
| `ChatInput.tsx` (~828) | `default` | main chat compare picker |
| `ChatInput.tsx` (~848) | `single` | reply-chat model picker |
| `MultiChat.tsx` (~2125), `ToolsBlockView` | `add` | inline "add model" to an existing tools block |
| `MultiChatDeprecationPath.tsx` (~1210), `CompareBlockView` | `add` | same, for the legacy side-by-side compare block type |

`ModelPickerMode` union (`ManageModelsBox.tsx:239-262`) — 3 variants,
all fields must keep working:
- `default`: `onToggleModelConfig`, `onClearModelConfigs`,
  `onSelectAllModelConfigs`, `onUnionSelectAllVisibleModelConfigs?`,
  `selectedModelConfigsForChat?`, `onReorderSelectedModelConfigs?`
- `add`: `checkedModelConfigIds`, `onAddModel`
- `single`: `onSetModel`, `selectedModelConfigId`

`ManageModelsButtonCompare` (`ModelPills.tsx`) — 2 mount sites, both in
`ChatInput.tsx`. Props: `selectedModelConfigs?`, `dialogId`, `showShortcut?`.

`QuickChatModelSelector` — 1 mount site, `MultiChat.tsx`'s
`ModelSelectorWrapper` (~2283). Props used: `onModelSelect` only (`open`/
`onOpenChange` are supported but never passed today — popover self-manages).

**Exported dialog-id string literals** — values, not just names, must stay
identical because `MultiChat.tsx` independently re-declares two matching
literals instead of importing the constants (a pre-existing landmine, not
introduced by this rework):
- `MANAGE_MODELS_CHAT_DIALOG_ID = "manage-models-chat"` — dead (zero
  importers/usages anywhere in `src/`); safe to leave or repurpose.
- `MANAGE_MODELS_COMPARE_DIALOG_ID = "manage-models-compare"` — also
  independently redeclared as `MultiChat.tsx`'s `MANAGE_MODELS_TOOLS_DIALOG_ID`
  (itself unused/dead).
- `MANAGE_MODELS_COMPARE_INLINE_DIALOG_ID = "manage-models-compare-inline"` —
  imported by `MultiChatDeprecationPath.tsx`; value duplicated (not imported)
  by `MultiChat.tsx`'s `MANAGE_MODELS_TOOLS_INLINE_DIALOG_ID`.

Selection persistence flow (do not touch — lives outside my owned files):
`ChatInput.tsx`'s handlers -> `ModelConfigChatAPI` (`saved_model_configs_chats`
table, ordered id array) -> `ChatCompareSelection.ts`'s
`resolveOrderedCompareConfigs` (order-preserving intersection of "saved" ∩
"currently visible"; never resurrects hidden models, never reorders, never
adds unpicked models). Toggling in a real chat *also* pushes the new list out
as the new global ambient default (`app_metadata.selected_model_configs_compare`)
via `syncGlobalCompareMetadataToConfigIds` — a non-obvious side effect worth
knowing about but not mine to change. **No debounce, no optimistic update**
anywhere in this chain (full mutateAsync + query-invalidation round trip).
`ChatInput.tsx`'s `toggleCompareModelConfig` has a pre-existing stale-closure
race (two rapid toggles can clobber each other) — not introduced by me, not
fixed by me (outside owned files), flagged so the new UI doesn't make it
worse by adding client-side optimistic state that could desync further.

## 2. Feature inventory (ported into the new module)

- **Search**: hand-rolled relevance scorer (`normalizeSearchValue`,
  `parseSearchQuery`, `scoreMatch`, `filterBySearch`) — supports a
  `provider:term` prefix filter (exact or unambiguous-prefix match against a
  curated `KNOWN_PROVIDERS` list that must stay exhaustive over
  `ProviderName`), word-boundary/substring/normalized/numeric-group scoring,
  results sorted by score. **Ported verbatim logic** into
  `model-select/search.ts` (pure, unit-tested).
- **Provider grouping**: OpenRouter (collapsible show/hide + refresh),
  direct providers (Anthropic/OpenAI/Google/Grok/Perplexity, one group each,
  hidden if empty), Custom (`author === "user"`, with an "Add" affordance
  that navigates to `/new-prompt`), Local (Ollama+LMStudio merged, with
  refresh + install-prompt empty state).
- **Enable/disable**: `model.isEnabled` (from `models.is_enabled`) disables
  selection entirely.
- **API-key wall**: non-local providers without a matching API key render
  dimmed (opacity-60) with an inline "Add API Key" action that emits
  `open_settings` (`{tab: "api-keys"}`, listened to in `App.tsx:765-770`) and
  closes the dialog. **Kept as the canonical pattern** — see CHANGE below re:
  `VisibleModelsTab.tsx` doing this differently.
- **Custom models**: `author === "user"` configs grouped separately; "Add"
  routes to `/new-prompt` (`App.tsx:903`) — not an inline creation flow.
  Left as-is (creating an inline flow is out of scope for this rework).
- **Capability badges (text/image/webpage/pdf)**: **did not exist** in
  `ManageModelsBox` before this rework — `supportedAttachmentTypes` is on
  `ModelConfig` but was never rendered as a badge anywhere in this component.
  New in P2: muted chips per DESIGN.md ("capability badges as muted chips").
- **"NEW" badge**: `isNewModel(newUntil)` — ported as-is.
- **Pricing**: `formatPricing()` shown only when `settings.showCost` is on —
  ported as-is (via `useSettings()`).
- **Thinking variants / reasoning-effort configs**: `budgetTokens` /
  `reasoningEffort` live on `ModelConfig` (`model_configs.budget_tokens` /
  `.reasoning_effort`) and are consumed by `ProviderAnthropic.ts` /
  `ProviderOpenAI.ts` for request-shaping, but **were never surfaced in any
  picker UI** — "thinking" variants today are simply separate `model_configs`
  rows (distinct `displayName`, same or different base model) that show up
  as ordinary rows. No UI regression risk here since there was no UI to
  begin with; P2 adds a small "thinking" chip when `budgetTokens` is set, as
  a bonus, not a port.
- **Deprecation handling — CHANGE**: `getFilteredModelConfigs` (step 1)
  unconditionally drops `isDeprecated` models before they ever reach
  `ManageModelsBox` — today deprecated models are **fully hidden**, not
  "collapsed". `docs/rework/design/model-select.md` / the W4 brief both
  call for a disclosure instead. P2 changes this: deprecated models are
  excluded from the *default* filtered set used for search/selection parity
  (`getFilteredModelConfigs` return value, unchanged, still feeds
  selection/compare-list logic elsewhere), but the new catalog view
  separately fetches all system model configs and shows deprecated ones
  under a closed-by-default disclosure per provider group, selectable but
  visually de-emphasized. This is a deliberate, documented UX improvement,
  not a silent behavior change to data contracts.
- **Selected-pills strip + drag reorder**: `@hello-pangea/dnd` draggable pill
  row (default mode only), right-edge scroll gradient indicator, inline
  "Clear ⌘⇧⌫". Ported.
- **Select All (⌘⇧A)**: replace-selection vs union-select depending on
  which callback the mount site wired up. Ported as-is (calls the same
  `mode.onSelectAllModelConfigs` / `onUnionSelectAllVisibleModelConfigs`).
- **Model Profiles integration**: `ProfileSelector` (global active profile,
  filters the catalog) + "Apply" button (default mode: replaces selection
  with the profile's selectable configs, in profile order). Ported as-is —
  this is `ModelProfilesAPI`'s `ModelProfile` (a *named set of models*),
  **distinct from** the design mock's per-model "profile" pill (see §3).
- **Refresh buttons**: OpenRouter / Ollama+LMStudio, each with a
  minimum-600ms spinner floor via `setTimeout` (cosmetic, not a request
  timeout — allowed under orchestrator policy as "genuinely time-based UX").
  Ported as-is; documented as an explicit `setTimeout` use in PROGRESS.md.
- **Show/hide OpenRouter section**: `app_metadata.show_openrouter`. Ported.
- **Keyboard nav**: cmdk arrow-nav + Enter-to-select, hover-reveal "⤶ to
  select/add/remove" hint, autofocus + clear-on-close search. Ported via
  continued use of `command.tsx` primitives.
- **Scroll-reset-on-search**: ported, minus the leftover `console.log`/
  `console.error` debug statements (removed as noise, not a behavior).

## 3. Design-mock concepts that need a grounded reinterpretation

- **"Selected" role badges (main/hidden) + "fuse on demand" footer copy**
  (`design/model-select.md`, `design/composer.md`): these describe W6's
  not-yet-built Focus/Fused chat view modes (`00-ARCHITECTURE.md §5`). W4
  runs before W6 in the merge order. Resolution: the new popover's right-hand
  "Selected" panel renders index-0 as "main" and the rest as "hidden" as a
  **cosmetic, order-derived label only** (no new backend semantics — the
  underlying ordered list and drag-reorder are the same feature that already
  exists today). Documented explicitly as a seam for W6, not a functional
  claim that hidden models currently "fuse."
- **Per-model "profile" pill ("default · t0.7")**: the mock's copy implies a
  `temperature` field that does not exist on `model_configs` (frozen schema:
  `id, model_id, display_name, author, system_prompt, is_default,
  budget_tokens, reasoning_effort, new_until` — no temperature column, and
  adding one would violate "keep `model_configs` semantics frozen").
  Resolution: reinterpreted as a **variant switcher** — when a base model
  (`modelId`) has more than one `model_configs` row (e.g. a "thinking"
  variant alongside the default), the profile chip shows the active
  variant's `displayName` and, on click, routes to Settings › Models
  (the spec's own documented alternative to an inline editor) rather than
  fabricating a temperature value. Hidden entirely when a model has no
  sibling variants (the common case). This does not collide with
  `ModelProfilesAPI`'s unrelated, pre-existing "named set of models" concept
  of the same word ("profile") — kept as two distinct UI ideas, both
  surfaced, clearly labeled.
- **OpenRouter "$8.20" account-balance figure**: not derivable from any data
  source W1 exposes (no OpenRouter balance API integration exists).
  Resolution: render the textual quota state `"pay/use"` (already a valid
  member of the design's own `quotaWindow` union) instead of a fabricated
  number.
- **Subscription tier suffix ("max"/"pro"/"ai pro")** in the auth line:
  `IProviderAccount.label` doc-comment anticipates this
  (`"oauth · max 20x"`) but W1's current stub populates it as
  `"oauth · Anthropic"` (no tier detection yet — P6 status note in
  `ProviderAccountsAPI.ts`). Resolution: the "via" label is built from
  `${providerName} ${authKind}` plus a status-derived suffix (e.g.
  "reauthorize", "not connected") rather than a fabricated tier — upgrades
  automatically once W1 adds real tier data, since it's read live off
  `IProviderAccount`, not hardcoded.

## 4. Data dependencies (read-only; contracts frozen)

- `ModelsAPI`: `useModelConfigs`, `useModels`, `useModelConfig`,
  `useSelectedModelConfigsCompare`, `useSelectedModelConfigQuickChat`,
  `useRefreshOpenRouterModels`/`Ollama`/`LMStudio`, `useDeleteModelConfig`,
  `useUpdateModelConfig`, `useCreateModelConfig`.
- `ModelConfigChatAPI`: `useSavedModelConfigChat`,
  `useUpdateSavedModelConfigChat`, `useChatCompareModelConfigs`,
  `useAppendModelConfigToChatCompare`, `useReplyModelConfig`,
  `useUpdateReplyModelConfig`.
- `ModelProfilesAPI`, `ProviderVisibilityAPI` (`useProviderVisibilityMap` is
  the load-bearing filter used everywhere), `AppMetadataAPI.useApiKeys` /
  `useShowOpenRouter`.
- `ModelFiltering.ts`: `getFilteredModelConfigs` (kept as the single source
  of truth for "is this model config selectable right now").
- `ProxyUtils.ts`: `hasApiKey`, `canProceedWithProvider`.
- **New, read-only** (W1, frozen per `00-ARCHITECTURE.md §4.1`):
  `ProviderAccountsAPI.useProviderAccounts` / `useQuota`; types
  `IProviderAccount` / `IQuotaSnapshot` / `ProviderAccountId` from
  `accounts/ProviderAccounts.ts`; reusable UI `accounts/QuotaBar.tsx`
  (explicitly documented there as reusable by W4's narrower 58px row
  variant) and `accounts/providerAccountDisplay.ts` helpers
  (`quotaBarFillClassName`, `statusText`, `authKindBadgeLabel`).
  `ProviderAccountId` is a **different enum** than `Models.ts`'s
  `ProviderName` (no `perplexity`/`grok`/`meta`; `ollama`+`lmstudio` both
  collapse to `local`) — the join needs an explicit partial mapping with a
  legacy-`ApiKeys`-based fallback for providers with no account entry.

## 5. Out of scope / other workstreams (read-only for W4)

- `VisibleModelsTab.tsx` / `ModelProfilesTab.tsx` — today's closest
  equivalent of a "Models" settings surface, but not the new
  design/model-select.md row anatomy, and not in W4's ownership list
  (`00-ARCHITECTURE.md §8`: `Settings.tsx` + `settings/**` is W3's). Noted
  behavioral inconsistency for W3's attention: `VisibleModelsTab` hides an
  entire provider's rows outright when no API key is configured, instead of
  `ManageModelsBox`'s dim + "Add API Key" CTA pattern — the new shared
  `ModelRow` standardizes on the CTA pattern; W3 should prefer it for
  consistency when it rebuilds the Models settings section.
- W4 instead ships a ready-to-mount `model-select/ModelSettingsRows.tsx`
  (search + grouped rows with favorite/visibility/edit/delete affordances)
  inside its own owned directory, so W3 can adopt it without needing W4 to
  touch `Settings.tsx` at all.
- `ChatInput.tsx`, `MultiChat.tsx`, `MultiChatDeprecationPath.tsx` — read
  only; their calls into `ManageModelsBox`/`ManageModelsButtonCompare`/
  `QuickChatModelSelector` are the frozen contract from §1.
