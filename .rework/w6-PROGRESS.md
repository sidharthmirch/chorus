# W6 Progress — Chat Rework (View Modes, Stances, Composer, Prompt Optimizer)

## State: P2 done (commits e685fe6 P0, 9e6a761 P1, <fill in P2 hash after commit>).
Starting P3 (View modes).

## NEXT ACTION

Implement P3: migration v149 (`chats.view_mode TEXT NOT NULL DEFAULT
'columns' CHECK (...)`), a `viewMode` union type + `chats.viewMode` field
(export the union from `ChatState.ts` per architecture §5), a pill segmented
control in the chat header (`MultiChat.tsx`'s right "chat actions" cluster —
re-grep `chat actions - show as individual` for the current line, it drifts
every session), Focus mode (new component, primary model full-width +
carousel pager over `ToolsBlock.chatMessages` minus the primary), and Columns
role chips (`main`/`hidden`, index 0 of `useChatCompareModelConfigs` =
"main" — purely cosmetic, add right next to P1's stance badge in
`ToolsMessageView`'s header). `columns` (the default) must stay pixel-stable
— gate all new rendering behind `viewMode !== "columns"` branches, never
restructure `ToolsBlockView`'s existing JSX for the columns case itself.

## Phase checklist

- [x] P0 — recon (`docs/rework/w6-chat-recon.md`, committed). Contains a
      `CORRECTION` section at the top — read it, it overrides naive
      assumptions about `CompareBlockView` being live (it isn't; `ToolsBlockView`
      in `MultiChat.tsx:1737-2143` is today's actual "Columns").
- [x] P1 — Modes entity. Migration v148 (`modes`+`chat_modes` tables,
      `message_sets.mode_id`, seed data) in `src-tauri/src/migrations.rs`.
      `src/core/chorus/api/ModesAPI.ts` (new, frozen — CRUD +
      `fetchMessageSetModeSystemPrompt` + `incrementModeUsageCount`).
      `ChatState.ts` exports `IMode`, `MessageSet.modeId`. Injection wired at
      both `injectSystemPrompts` call sites in `MessageAPI.ts` (now ~1500,
      ~1584 after the edits — re-grep before trusting). `useCreateMessageSetPair`
      (~1864) takes `modeId?`, writes it on the **ai** row, increments
      usage_count once per send. `ChatInput.tsx` resolves+passes the chat's
      default mode (inert — no picker yet, see P2). `MultiChat.tsx`: sender-row
      badge in `ToolsMessageView` (~1463-1468, after the model-name span) +
      read-only header badge (~3266, inside the right "chat actions" cluster,
      reads `ModesAPI.useChatMode(chatId!)` called at ~2334). Tests:
      `src/core/chorus/prompts/prompts.test.ts` (5 tests, covers the
      `injectSystemPrompts` mode-splicing behavior). tsc 0 errors, eslint 0
      issues, vitest 187/187.
- [x] P2 — Composer. New `src/ui/components/composer/`: `ModePickerPill.tsx`
      (mirrors `PromptProfilePill.tsx`; selecting a mode calls
      `useSetChatMode` directly — simpler than the "ephemeral per-message
      local state" design sketched in this file's previous revision; see
      Decisions log for why that was dropped), `OptimizeButton.tsx` (visual
      states only, toggles a dialog id), `PromptOptimizerDialog.tsx`
      (presentable placeholder — shows the live draft read-only; P5 replaces
      the body, not the mount/dialog-id wiring). All three mounted in
      `ChatInput.tsx`'s toolbar right after `PromptProfilePill` (~792-794)
      and dialog mount after the reply `ManageModelsBox` (~846). Model popover
      needed zero new work (confirmed still true). tsc 0, eslint 0, vitest
      187/187 (no new tests — no new pure logic, just DB-CRUD-wrapper/UI
      code, consistent with `PromptProfilesAPI.ts` having no test file
      either).
- [ ] P3 — View modes (migration v149 `chats.view_mode`, segmented control in
      header at `MultiChat.tsx`'s right "chat actions" cluster — re-grep, line
      drifts every edit — Focus mode, Columns role chips) <- current
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
- 2026-07-21 P2: dropped the "ephemeral per-message local state" design this
  file's previous revision sketched for the mode picker (a `pendingModeId`
  React state separate from the persisted chat default). Reconsidered against
  `design/composer.md`'s actual copy ("Mode · next message... Click: Sets
  message mode, closes popover" — no separate "make default" affordance
  anywhere in the spec) and against `PromptProfilePill`'s proven precedent
  (selecting a profile calls `useSetChatPromptProfile` directly, no local
  staging state). Landed on: `ModePickerPill` calls `useSetChatMode` directly
  on click — "sticky until changed" per-chat default, exactly mirroring
  `PromptProfilePill`. The "per-message" half of "per-chat + per-message
  override" semantics is satisfied by `message_sets.mode_id` being an
  immutable snapshot taken AT SEND TIME (P1's `useCreateMessageSetPair`
  change) — i.e. changing the chat's mode only affects sends from that point
  forward; every past turn's sender-row badge still reflects whichever mode
  was active when IT was sent, which is the actual thing "per-message" needs
  to mean for a historical chat transcript. No `pendingModeId` state needed
  anywhere. This also means P1's `ChatInput.tsx` wiring (`chatModeId.data`
  passed straight into `createMessageSetPair`) was ALREADY the complete,
  correct final form — P2 didn't need to touch that call site at all, only
  add the UI that makes `chatModeId` ever be non-null.
- 2026-07-21 P2: no `useRef`/`useImperativeHandle`/`setTimeout` used. One
  `as`-shaped question considered and avoided: `ModeDBRow.tag` (in
  `ModesAPI.ts`) is typed as `IMode["tag"]` directly on the DB row type rather
  than `string` + a cast/guard at the read boundary — this mirrors
  `PromptProfilesAPI.ts`'s own `PromptProfileDBRow.author: "user" | "system"`
  precedent (an already-accepted pattern in this exact file family: trust the
  CHECK-constrained column's literal union at the type level rather than
  guarding every read), not a new risk introduced here.

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

- Open any chat, click the mode picker pill in the composer (circle icon,
  right of the prompt-profile pill). Expect a popover: "Mode · next message"
  label, None / Assist / Critic / Socratic rows each with icon + description,
  "Manage modes..." footer (opens Settings — no dedicated Modes tab yet,
  that's W3). Pick Assist. Expect: the pill becomes a chip reading "✓ Assist";
  the chat header (top right, near find/share) shows a "✓ Assist · default"
  pill; sending a message should show a small "✓ assist" badge next to each
  responding model's name once responses come in.
- Switch to Critic, send another message in the SAME chat. Expect the new
  turn's badge to read "✕ critic" while the PREVIOUS turn's badge still reads
  "✓ assist" (per-message-set history should not retroactively change).
- Pick "None". Expect both pill and header badge to clear; new sends show no
  stance badge.
- Click "Optimize" in the composer. Expect a modal titled "✦ Optimize prompt"
  showing your current draft text read-only, with a "coming soon" note (full
  Structured/Before-After UI is P5). Closing it (×/Escape) should return
  focus to the composer, draft untouched.
- Regression: existing model picker ("Manage models" pill), attach button,
  tools box, prompt-profile pill should all look/behave exactly as before —
  nothing about their layout should have shifted beyond the two new items
  appearing after them in the toolbar.
