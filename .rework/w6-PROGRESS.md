# W6 Progress — Chat Rework (View Modes, Stances, Composer, Prompt Optimizer)

## State: P0 done (recon doc committed). Starting P1 (Modes entity).

## NEXT ACTION

Implement P1: migration v148 (`modes` + `chat_modes` tables, `message_sets.mode_id`
column, seed Assist/Critic/Socratic), then `api/ModesAPI.ts` (frozen — mirror
`PromptProfilesAPI.ts`'s exact shape/naming per recon §8), then wire injection
at the two `injectSystemPrompts` call sites (`MessageAPI.ts:~1498`, `~1580`)
and usage_count increment inside `useCreateMessageSetPair`
(`MessageAPI.ts:~1855-1899`, write `mode_id` onto the **ai** message_sets row
only). Export `IMode` from `ChatState.ts`. See
`docs/rework/w6-chat-recon.md` §1/§4/§8/§14/§15 for the full plan — it's
already fully designed, this is implementation, not research.

## Phase checklist

- [x] P0 — recon (`docs/rework/w6-chat-recon.md`, committed). Contains a
      `CORRECTION` section at the top — read it, it overrides naive
      assumptions about `CompareBlockView` being live (it isn't; `ToolsBlockView`
      in `MultiChat.tsx:1737-2143` is today's actual "Columns").
- [ ] P1 — Modes entity (migration v148, `ModesAPI.ts`, injection, seed data,
      `IMode` export) <- current
- [ ] P2 — Composer (mode picker pill, optimize button; model popover already
      free via existing `ManageModelsBox`, see recon §2)
- [ ] P3 — View modes (migration v149 `chats.view_mode`, segmented control in
      header at `MultiChat.tsx:3245-3351`, Focus mode, Columns role chips)
- [ ] P4 — Fused (generalize `useStreamSynthesis`/`useSelectSynthesis`/
      `useDeselectSynthesis` + `llmConversationForSynthesis` to accept
      `blockType`; new `FusedBlockView`; `grades_json` column on `messages`,
      part of migration v149; grading via separate `simpleLLM()` call)
- [ ] P5 — Prompt Optimizer modal (new, self-contained; undo via in-memory
      stash, not a schema change — see recon §9)

## Decisions log

All substantive design decisions (mode `tag` semantics, grades storage
strategy, Fused-mode reuse strategy, optimizer undo strategy, why quota
badges need zero extra wiring, why `SummaryDialog`/`brainstorm.ts` are false
leads for P4) are recorded in `docs/rework/w6-chat-recon.md` §6-§9, §14-§16 —
not duplicated here. This log only tracks decisions made *during
implementation* that post-date the recon doc.

- 2026-07-21 P0: recon doc's first draft conflated the legacy `compare` block
  type with today's live multi-model view; corrected in-place after a
  parallel recon pass (background agent) caught it independently — see the
  recon doc's `CORRECTION` section. Lesson for any adopter: trust the
  `[CORRECTED]`-marked passages over the surrounding original prose if they
  ever seem to disagree with the live code.
- 2026-07-21 P0: no `useRef`/`useImperativeHandle`/`setTimeout`/`as` used yet
  (pure research phase). Will log specific call sites here as P1+ introduces
  any (expect `useRef` for none so far planned; will flag before use if that
  changes).

## Landmines / do-not

- Do not implement Focus/Columns/Fused by modifying `CompareBlockView`
  (`MultiChatDeprecationPath.tsx`) — that path is legacy/unreachable for new
  chats. All new view-mode work targets `ToolsBlockView`
  (`MultiChat.tsx:1737-2143`) and a new sibling `FusedBlockView`.
- Do not touch `src/ui/components/artifacts/**` or the W2 artifact-panel mount
  in `MultiChat.tsx` (imports ~164-165, state/effect ~2326-2359, JSX mount
  ~3414-3433, inside the `ResizablePanelGroup` that starts ~3361). Preserve
  exactly.
- Do not touch `src/ui/components/model-select/**` (W4, frozen/read-only) or
  re-mount `ModelSelectPopover` directly in `ChatInput.tsx` — the existing
  `ManageModelsBox` (`mode.type: "default"`) mount at `ChatInput.tsx:827-845`
  already gets quota badges for free; adding a second, parallel mount would
  duplicate working plumbing for no benefit.
- Do not rename/touch `PromptProfilesAPI.ts`/`PromptProfilePill.tsx`/
  `PromptProfilesTab.tsx` — a separate, shipped, out-of-scope feature (persona
  system prompts). `modes`/`chat_modes` is a new, parallel entity, not a
  replacement.
- Do not modify `Prompts.SYNTHESIS_INTERJECTION` or any text inside it —
  shared with the still-reachable legacy manual "Synthesize" button
  (`CompareBlockView`, `MultiChatDeprecationPath.tsx:1041-1074`, and the ⌘S
  shortcut in `MultiChat.tsx`). Generalize the *plumbing* around it
  (`blockType` param), never the prompt text itself.
- `SummaryDialog.tsx` and `brainstorm.ts` are **not** building blocks for
  Fused-mode grading despite being named alongside it in the W6 brief — see
  recon §7. Don't waste time trying to reuse them.
- Migrations start at **v148** (current max on this branch is 147, W1's
  `provider_accounts`). Ledger row already exists at
  `docs/rework/MIGRATIONS-LEDGER.md` ("W6 | 2 | planned") — update its
  description text (not the count) if the final split of what's in each
  migration drifts from recon §14's plan.

## User-test queue

(Empty — nothing shippable yet. Will populate per-phase as UI lands.)
