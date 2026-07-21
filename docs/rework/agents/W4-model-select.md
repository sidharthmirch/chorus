# W4 — Model Select Rework

Branch: `claude/rework-model-select` · Worktree: `../chorus-wt-w4`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §5, then this file.
**Soft-blocked on W0:** `docs/rework/design/model-select.md` refines the UX;
P0–P1 proceed without it.

## Mission

Rework model selection per `docs/rework/design/model-select.md`: two surfaces
sharing one component vocabulary —
1. **Composer model popover** (consumed by W6's composer): checkbox catalog
   rows with provider avatar, name, auth "via" label (mono, e.g.
   "anthropic oauth · max"), quota bar + mono quota label ("62% · 3h") from
   W1's `useQuota` (stub until W1 P2 lands), profile chip ("concise · t0.4"),
   selected-count + clear.
2. **Settings Models rows** (mounted by W3): same row anatomy + favorite
   star + visibility toggle + dashed "add custom model" affordance.

Keep Chorus data contracts intact: `ModelsAPI` / `ModelConfigChatAPI` /
`model_configs` semantics are frozen (architecture §5). Quota/auth display is
read-only consumption of W1's frozen API. Export the popover's props
contract early (frozen) — W6 mounts it.

## Context you must load before coding

- `ManageModelsBox.tsx` end to end — inventory of capabilities (P0): search,
  provider grouping, enable/disable, custom models, deprecation handling,
  capability badges (text/image/webpage/pdf), thinking variants,
  reasoning-effort configs, selection persistence
  (`selected_model_config_ids`).
- `QuickChatModelSelector.tsx`, `ModelPills.tsx`, `provider-logo.tsx`.
- `api/ModelsAPI.ts`, `api/ModelConfigChatAPI.ts`, `api/ModelProfilesAPI.ts`,
  `api/ProviderVisibilityAPI.ts`; `Models.ts` in core; `SCHEMA.md`
  (`models`, `model_configs`).
- How MultiChat consumes the selection (grep `selected_model_config_ids`,
  `ManageModelsBox` usages) — the consumer contract must not change.
- `screenshots/` for current UI.

## Phases

**P0 — Inventory (docs commit).** `docs/rework/w4-model-select-inventory.md`:
every capability + data dependency of the current picker. Regression
checklist for the PR.

**P1 — Component skeleton.** `src/ui/components/model-select/` module:
`ModelSelect.tsx` (container), `ModelSearch`, `ProviderGroup`, `ModelRow`,
typed registry of row affordances. Command-palette-style search-first
interaction (reuse `command.tsx` primitives — cmdk already in the kit).
Dead code until P3 swap.

**P2 — Feature parity.** Port every P0 inventory item into the new module.
States per DESIGN.md (hover/focus/selected/disabled/loading/empty). Selected
state uses highlight tokens (Quiet Accent Rule — selection is exactly what
Toasted Sand is for). Provider logos, capability badges as muted chips,
deprecated models collapsed under a disclosure.

**P3 — Swap + design pass.** Replace `ManageModelsBox` mount points behind the
same props; apply `docs/rework/design/model-select.md` directives when
available (grouping, pinning/favorites, quick-swap ideas). If a new
persistence need appears (e.g. pinned models), prefer an `app_metadata`
JSON key over schema change; else migration ledger protocol.

**P4 — Quick chat.** Bring `QuickChatModelSelector` onto the same components
(one vocabulary — Consistency over surprise).

## Resumability specifics

- New module is dead code until the single P3 swap commit; interruption never
  breaks chat.
- P0 inventory + per-phase commits make this trivially adoptable; note any
  subtle `ManageModelsBox` behaviors (debounces, optimistic updates) in
  PROGRESS.md landmines section as you discover them.

## Done means

Old box fully replaced, inventory verified in test plan (selection persists,
multi-model selection in chat unaffected, quick chat picker consistent),
both themes, lint/build green, PR per CLAUDE.md.
