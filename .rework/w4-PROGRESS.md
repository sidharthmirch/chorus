# W4 Progress — Model Select Rework

## State: P0 — inventory doc committed
## NEXT ACTION
Start P1: scaffold `src/ui/components/model-select/` (types.ts, search.ts +
search.test.ts, ModelRow.tsx, ProviderGroup.tsx) as dead code — nothing
mounts it yet, zero risk to the app. Port the search/scoring logic from
`ManageModelsBox.tsx` (`normalizeSearchValue`/`parseSearchQuery`/
`scoreMatch`/`filterBySearch`/`KNOWN_PROVIDERS`) into `search.ts` first since
everything else depends on it.

## Phase checklist
- [x] P0 — inventory doc (`docs/rework/w4-model-select-inventory.md`)
- [ ] P1 — component skeleton (dead code)      <- current
- [ ] P2 — feature parity + design pass (still dead code until P3 swap)
- [ ] P3 — swap ManageModelsBox/QuickChatModelSelector/ModelPills internals
      behind unchanged external props; favorites persistence
- [ ] P4 — confirm QuickChatModelSelector fully on shared components
      (likely folded into P3 since it's a small file)

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
- (pending) any `useRef`/`setTimeout`/`as` uses will be logged here with
  file:line + justification as they're written, per ORCHESTRATION.md.

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
(filled in as P3 lands — will include: selection persists across the swap,
multi-model chat compare unaffected, reply picker unaffected, quick-chat
picker consistent with the composer popover, both themes, deprecated-models
disclosure, favorites persist across restart.)
