# W4 Progress — Model Select Rework

## State: DONE. All four phases complete and committed
(9a14714, 29ea1c6, badcba2, 59d3ae8, ed567ad, 075f979, eaf3b9f, + the
ModelPills/QuickChatModelSelector commit closing this session). The old
1202-line `ManageModelsBox.tsx` is now ~65 lines delegating to
`model-select/**`; `QuickChatModelSelector.tsx` and `ModelPills.tsx` are on
the same vocabulary. tsc/vitest/eslint all green across the repo (182
tests passing).
## NEXT ACTION
None outstanding for W4. If resumed: re-run the three gates
(`tsc --noEmit`, `vitest run`, `eslint` on the touched paths listed in the
handoff report) to confirm nothing drifted, then hand off to the
orchestrator for merge. Open items are the two flagged in "Decisions log"
below (quick-chat's dropped text-based safety filters, and the
`visible-models` settings-tab routing for the profile chip) — both are
documented risk calls, not bugs, and are listed in the user-test queue.

## Phase checklist
- [x] P0 — inventory doc (`docs/rework/w4-model-select-inventory.md`)
- [x] P1 — component skeleton (search.ts, types.ts, ModelRow, ProviderGroup,
      DeprecatedSection) — commit badcba2
- [x] P2 — feature parity (useModelCatalog, CatalogGroupsList,
      ModelSelectList, SelectedPreviewPanel + drag-reorder,
      ModelSelectPopover w/ frozen props, ProfileFilterBar,
      ModelSettingsRows for W3, ModelSelect container adapting
      ModelPickerMode) — commits badcba2, ed567ad, 075f979.
- [x] P3 — swap: `ManageModelsBox.tsx` is now a thin `ModelSelect` shell
      (commit eaf3b9f); `ModelPills.tsx`'s avatar sizing tightened to
      composer.md's ~16px spec — this session's commit.
- [x] P4 — `QuickChatModelSelector.tsx` rebuilt on `ModelSelectList`
      (variant "quick-chat") inside its existing Popover — this session's
      commit. Same commit as P3's ModelPills touch-up.

## Frozen composer-popover contract (W6 — verbatim, from `ModelSelectPopover.tsx`, final as of P3/P4)
```ts
export interface ModelSelectPopoverProps {
    id: string; // dialog-store id (dialogActions.openDialog(id) / useDialogStore convention)
    selectedModelConfigs: ModelConfig[]; // ordered; index 0 = "main" (cosmetic)
    onToggleModelConfig: (modelConfigId: string) => void;
    onClearModelConfigs: () => void;
    onReorderSelectedModelConfigs?: (modelConfigs: ModelConfig[]) => void;
    onSelectAllModelConfigs?: (modelConfigs: ModelConfig[]) => void;
    onUnionSelectAllVisibleModelConfigs?: (modelConfigs: ModelConfig[]) => void;
    onOpenProfile?: (modelConfigId: string) => void;
    onAddApiKey: () => void;
    onAddCustomModel?: () => void; // added during P3; defaults to navigate("/new-prompt") if omitted
    showCost?: boolean;
}
export function ModelSelectPopover(props: ModelSelectPopoverProps): JSX.Element;
```
Mountable directly by W6 (bypasses `ManageModelsBox`/`ModelPickerMode`
entirely), or indirectly via `ManageModelsBox`'s `mode.type === "default"`
branch (now live as of P3, commit eaf3b9f — same field names, 1:1 adapter
in `ModelSelect.tsx`).

## Architecture plan (written before coding, so a resumer doesn't have to
re-derive it from scratch)

New files, all additive (nothing below conflicts with another workstream's
owned paths per `00-ARCHITECTURE.md §8`):

- `src/core/chorus/api/ModelAccountAPI.ts` (+ `.test.ts`) — NEW. Pure
  `PROVIDER_NAME_TO_ACCOUNT_ID` map (`Models.ts`'s `ProviderName` ->
  W1's `ProviderAccountId`; `perplexity`/`grok`/`meta` have no account and
  fall back to legacy `ApiKeys`), `deriveModelViaInfo(modelConfig,
  providerAccounts, apiKeys)` pure fn returning `{ label, quota?,
  quotaText? }`, and `useModelViaInfo(modelConfig)` hook composing
  `useProviderAccounts()` (W1, frozen, read-only) + `useApiKeys()`. This is
  the "join in core, no schema change to `models`" the brief calls for.
- `src/core/chorus/api/ModelFavoritesAPI.ts` (+ `.test.ts`) — NEW. Favorite
  "pin" state (distinct from selection and distinct from
  `ModelProfilesAPI`'s unrelated "named set of models" `ModelProfile`),
  persisted as a JSON array under `app_metadata` key
  `pinned_model_config_ids` (pattern copied from `AppMetadataAPI.ts`'s
  `useShowOpenRouter`/`useSetShowOpenRouter`) — no migration needed.
- `src/ui/components/model-select/`:
  - `search.ts` (+ `.test.ts`) — ported relevance scorer (pure).
  - `types.ts` — `ModelRowAffordances` registry + shared prop shapes.
  - `ModelRow.tsx` — the one row component for both surfaces (checkbox|star,
    avatar, name+NEW badge, auth "via" line, capability chips, quota bar
    (reusing W1's `accounts/QuotaBar.tsx` at its narrow 58px variant —
    that file's own doc-comment calls this out as the intended reuse),
    pricing, favorite star, visibility switch, edit/delete, disabled+CTA
    state). Full DESIGN.md state set; selected state = highlight tokens.
  - `ProviderGroup.tsx` — heading + rows + optional refresh/collapse.
  - `DeprecatedSection.tsx` — disclosure for deprecated models (new
    behavior — see inventory §2).
  - `SelectedPreviewPanel.tsx` — composer popover's right panel (main/hidden
    cosmetic labels, profile-variant chip — see inventory §3).
  - `useModelCatalog.ts` — the data-composition hook (ports
    `modelGroups`/`selectableVisibleModels`/`profileSelectableConfigs`
    memoized logic from `ManageModelsBox.tsx`).
  - `ModelSelectPopover.tsx` — **the frozen composer-popover contract**
    (two-column: catalog + selected preview), per `design/composer.md`.
  - `ModelSelectList.tsx` — single-column variant (add/single modes, quick
    chat) sharing `ModelRow`/`ProviderGroup`/search.
  - `ModelSelect.tsx` — container picking List vs Popover by mode; this is
    what `ManageModelsBox` delegates to internally.
  - `ModelSettingsRows.tsx` — ready-to-mount Settings-rows component for W3
    (favorite/visibility/edit/delete), built entirely inside my owned dir so
    W3 can adopt it without W4 touching `Settings.tsx`/`VisibleModelsTab.tsx`.
- Rewritten in place (props/exports frozen, internals swapped in P3):
  `ManageModelsBox.tsx`, `QuickChatModelSelector.tsx`, `ModelPills.tsx`.

## Decisions log
- 2026-07-21 P0: deprecated models will be shown (collapsed disclosure) in
  the new UI instead of fully hidden — a deliberate UX change vs current
  behavior, not a silent one. Documented in inventory §2.
- 2026-07-21 P0: per-model "profile" pill reinterpreted as a variant switcher
  across sibling `model_configs` sharing a `modelId`, display-only (routes
  to Settings, does not inline-edit) — avoids fabricating a `temperature`
  field that doesn't exist on the frozen `model_configs` schema. Inventory §3.
- 2026-07-21 P0: OpenRouter "$X.XX balance" mock copy rendered as textual
  `"pay/use"` instead (no balance data source exists). Inventory §3.
- 2026-07-21 P0: favorites/pins persist as a new `app_metadata` JSON key
  (`pinned_model_config_ids`), not a migration — per P3 guidance to prefer
  app_metadata over schema change.
- No `useRef`/`useImperativeHandle`/`setTimeout` anywhere in `model-select/**`
  or the three swapped files (verified via grep across the whole touched
  surface). The pre-rework OpenRouter/local refresh spinners' cosmetic
  600ms `setTimeout` floor was dropped when ported — `CatalogGroupsList.tsx`'s
  `RefreshButton` now just tracks each mutation's own `isPending`, which
  still shows a spinner for the mutation's real duration, just without an
  artificial minimum. A deliberate simplification, not a regression.
- **Full `as`-assertion audit** (grep-verified across every touched file;
  all 4 are the DB-row/JSON/exhaustive-switch category ORCHESTRATION.md
  permits, each with its own inline justification comment at the site):
  - `core/chorus/api/ModelFavorites.ts:18` — `JSON.parse(value) as unknown`:
    narrows `any` down to `unknown` immediately (safening), followed by a
    runtime `Array.isArray`/`typeof` check before anything escapes.
  - `core/chorus/api/ModelAccountView.ts:78` —
    `${exhaustiveCheck as string}`: standard exhaustive-switch-guard
    template-literal cast, same idiom as the pre-existing, unmodified
    `accounts/providerAccountDisplay.ts:authKindBadgeLabel`.
  - `model-select/useModelCatalog.ts:133` —
    `provider as keyof typeof apiKeys`: ported from `ManageModelsBox.tsx`'s
    identical pre-rework check; safe because `hasApiKey`'s lookup just
    returns `undefined` (treated as "not configured") for a `ProviderName`
    `ApiKeys` doesn't key on, rather than throwing.
  - `model-select/useModelCatalog.ts:171` and
    `model-select/CatalogGroupsList.tsx:93` —
    `Object.fromEntries(...)  as Record<DirectProvider, ...>` /
    `Object.keys(...) as DirectProvider[]`: both widen-then-narrow casts
    where the runtime keys are provably exactly `DirectProvider` (built by
    mapping the exhaustive `DIRECT_PROVIDERS` tuple / a `Record` typed with
    every union member required).
- 2026-07-21 P4: `QuickChatModelSelector.tsx`'s pre-rework
  `!id.includes("chorus") && !displayName.includes("Deprecated")` text
  filters were dropped when it was rebuilt on `ModelSelectList`/
  `useModelCatalog` — the real flags they were guarding
  (`models.is_internal`, `models.is_deprecated`) are already enforced by
  `getFilteredModelConfigs`, the same pipeline `ManageModelsBox` has always
  relied on without those text filters. Flagged as a documented risk (not
  a silent one) in case some `chorus::*` row is missing `is_internal` in
  practice — see User-test queue.
- 2026-07-21 P3: the per-model "profile" chip and any locked-row "Add API
  key" CTA route to `Settings.tsx`'s existing `"visible-models"` tab (via
  the `open_settings` event) since W3's dedicated Models section doesn't
  exist yet. Whoever wires the real Models tab (W3) should repoint
  `ManageModelsBox.tsx`'s `handleOpenProfile`/`handleAddApiKey`.

## Landmines / do-not
- Do NOT change the exported dialog-id string *values*
  (`manage-models-chat`/`manage-models-compare`/`manage-models-compare-inline`)
  — `MultiChat.tsx` (not mine) independently hardcodes two of them instead of
  importing the constants. See inventory §1.
- Do NOT change `ModelPickerMode`'s field names/shapes, or the props of
  `ManageModelsBox`/`ManageModelsButtonCompare`/`QuickChatModelSelector` —
  4 + 2 + 1 call sites outside my owned files depend on them structurally.
- Do NOT add any debounce/optimistic local state around selection mutations
  in the new components — today's flow is deliberately a plain
  mutateAsync + query-invalidate round trip; layering optimistic state on
  top risks desyncing with the known stale-closure race already in
  `ChatInput.tsx` (not mine to fix).
- `getFilteredModelConfigs` stays the single source of truth for "is this
  selectable" (compare-list/search parity) — the new catalog view adds a
  *separate* deprecated-disclosure fetch path, it does not change what
  `getFilteredModelConfigs` returns.
- `ProviderAccountId` (W1) and `ProviderName` (Models.ts) are different
  enums — always go through the new `ModelAccountAPI.ts` mapping, never
  assume they're interchangeable.

## User-test queue
- Main chat model picker (⌘J): opening it now shows the new two-column
  "Manage models" modal (search, provider groups, quota bars, favorites)
  instead of the old single-column command palette. Confirm selection
  still persists per-chat and multi-model chat/compare is unaffected.
- Reply-chat model picker: still a single-column list (unchanged shape);
  confirm picking a model still works and closes the dialog.
- "Add model" inline button (tools block / legacy compare block): confirm
  adding a model still works and closing behaves the same.
- Quick chat's model picker: now grouped by provider (was a flat list) —
  confirm this reads fine, and that no expected model is missing. In
  particular check for any `chorus::`-prefixed or "Deprecated"-named model
  that might have relied on QuickChatModelSelector's now-removed text-based
  safety filters rather than the `is_internal`/`is_deprecated` flags (see
  Decisions log) — if one surfaces, it's a data-flag gap to fix at the
  source, not a UI bug.
- Favorites (star icon): pin/unpin a model, restart the app, confirm the
  pin survived (stored in `app_metadata.pinned_model_config_ids`).
- Deprecated models: confirm they now appear under a closed-by-default
  "Deprecated" disclosure per surface instead of being fully absent.
- Model Profiles filter/Apply: confirm the profile dropdown + "Apply"
  button still work identically to before (ported, not redesigned).
- Profile chip (per-model variant switcher) in the Selected panel: only
  appears when a model has a sibling `model_configs` row sharing its base
  model; clicking it opens Settings → Visible Models (temporary route —
  see Decisions log).
- Both light and dark themes — nothing here was visually verified at
  runtime (cannot run the app), only reasoned through DESIGN.md tokens.
- Drag-reorder in the Selected preview panel (composer modal) — confirm it
  still reorders the compare list the same way the old pill strip did.
