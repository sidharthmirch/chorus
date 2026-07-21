# W6 Progress — Chat Rework (View Modes, Stances, Composer, Prompt Optimizer)

## State: P4 done (commits e685fe6 P0, 9e6a761 P1, 138b0db P2, 3a05d46 P3,
59b398b P4). Starting P5 (Prompt Optimizer) — the last phase.

## NEXT ACTION

Implement P5: flesh out `src/ui/components/composer/PromptOptimizerDialog.tsx`
(currently P2's presentable placeholder — mount/dialog-id wiring in
`ChatInput.tsx` is done, only this file's body + its own props need to grow)
into the real modal per `docs/rework/design/prompt-optimizer.md`: Structured
(default) vs Before/After tabs (`ui/tabs.tsx` or plain toggle buttons), Intent
radios (`ui/radio-group.tsx`: Just chat / Hand to agent — build / Plan first),
model-set pills (Chat trio / Coding / Fast-cheap) with per-model checkbox
toggles, rewrite via `simpleLLM()` (no modelConfigId — same "let it auto-pick"
reasoning as P4's grading call, see recon §10 and the Decisions log entry
below), "use ↵" calls `onApply`/`setDraft` back in `ChatInput.tsx` with an
undo affordance (stash the pre-optimize draft in local state, one-shot revert
— NOT a schema change, see recon §9), "⧉ copy" to clipboard. Model-set preset
selection on confirm should update the chat's selection via the SAME
callbacks `ChatInput.tsx` already built for the model popover
(`toggleCompareModelConfig`/`persistMainChatCompareIds` — thread them down as
new props, or lift the apply logic up into `ChatInput.tsx` and have the
dialog just report "apply this model set" via a callback prop).

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
- [x] P3 — View modes. Migration v149: `chats.view_mode` (default 'columns',
      CHECK-constrained) + `messages.grades_json` (P4 uses it, bundled here
      since the ledger declared 2 migrations total). `ChatState.ts` exports
      `ViewMode`/`VIEW_MODES`/`isViewMode`. `ChatAPI.ts`: `Chat.viewMode`,
      `readChat` narrows via `isViewMode`, `useUpdateChatViewMode` mutation.
      New `src/ui/components/ViewModeControl.tsx` (pill segmented, active =
      inverted-ink) mounted in `MultiChat.tsx`'s header right cluster.
      `MessageSetView`'s `tools`-block branch now switches on
      `chatQuery.data?.viewMode`: `"focus"` → new `FocusBlockView` (defined
      INSIDE `MultiChat.tsx`, not a separate file — it needs to call
      `ToolsMessageView` directly and a separate file would have created a
      circular import; see Decisions log); anything else → the untouched
      `ToolsBlockView`. Role chips (main/hidden) added to `ToolsMessageView`'s
      header via a new `isMain?: boolean` prop, computed in `ToolsBlockView`
      from `chatCompareModelConfigs[0]` — purely cosmetic, no data-model
      change. Selecting "Fused" at this point silently fell back to columns
      (no branch yet) — resolved in P4.
- [x] P4 — Fused. Generalized (not duplicated) `useStreamSynthesis`/
      `useSelectSynthesis`/`useDeselectSynthesis` (`MessageAPI.ts`) with an
      optional `blockType: "tools" | "compare"` param, defaulting to
      `"compare"` so the legacy manual-button call site's behavior is
      unchanged. Generalized `llmConversationForSynthesis` (`ChatState.ts`)
      to read `toolsBlock.chatMessages` when `selectedBlockType === "tools"`.
      `SYNTHESIS_INTERJECTION` itself untouched. New
      `src/core/chorus/fusedGrading.ts` (pure — prompt-building +
      untrusted-LLM-JSON parsing/validation, 13 unit tests) +
      `MessageAPI.ts`'s `useComputeFusedGrades` (a SEPARATE `simpleLLM()`
      call after synthesis finishes, not folded into the synthesis prompt).
      `ChatState.ts` exports `IGrade`, `Message.grades`; `readMessage` parses
      `grades_json`. New local `FusedBlockView` (same "inside `MultiChat.tsx`,
      not a separate file" reasoning as `FocusBlockView`) auto-triggers
      synthesis once all models are idle, then grading once the fused answer
      finishes streaming (both effects guarded by the mutation's own
      `isPending`, not a ref); renders the grade table + reuses
      `MessageCostDisplay`. Wired into P3's `viewMode` switch — "Fused" now
      does something.
- [ ] P5 — Prompt Optimizer modal (P2 already built the button + a
      placeholder dialog + the mount wiring; undo via in-memory stash, not a
      schema change — see recon §9) <- current

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
- 2026-07-21 P3: `FocusBlockView` was originally sketched as a standalone
  `src/ui/components/FocusBlockView.tsx` (per the recon doc's original P3
  plan). Reconsidered once actually writing it: it needs to call
  `ToolsMessageView` (exported from `MultiChat.tsx`) to render the
  primary/paged responses with identical stance badges and role chips, but
  `MultiChat.tsx` also needs to import `FocusBlockView` to mount it — a
  circular import. Rather than risk it (even though function-body-deferred
  circular imports between React component files often work fine with
  Vite/ESM), moved `FocusBlockView` to be a plain local function defined
  inside `MultiChat.tsx` itself, right after `ToolsBlockView` — zero
  cross-file dependency, and consistent with how `ToolsBlockView`/
  `ChatBlockView`-equivalents already live in this file rather than being
  extracted. Same reasoning applied again in P4 for `FusedBlockView`. The
  ONLY genuinely standalone new file is `ViewModeControl.tsx` (the segmented
  control), which has no such dependency.
- 2026-07-21 P3: one `as` used — `isViewMode`'s `VIEW_MODES.includes(value as
  ViewMode)` — same established idiom as this file's pre-existing
  `isBlockType`, commented inline for CLAUDE.md compliance even though the
  precedent function it mirrors doesn't have a comment either.
- 2026-07-21 P4: confirmed (by reading `SimpleCompletionProviderFactory.ts`)
  that `simpleLLM(prompt, params, "chorus::synthesize")` would NOT actually
  route through chorus's special virtual-model resolution the way the
  streaming pipeline does — `createProviderByPrefix("chorus", apiKeys)`
  returns `null` (only anthropic/openai/google/openrouter are registered in
  that simpler factory), so passing it would silently no-op back to
  `getSimpleCompletionProvider`'s auto-pick anyway. Decided NOT to pass any
  `modelConfigId` to the grading call — let it auto-pick — and NOT to render
  a "graded by X" model name in the UI (chat.md's mock copy shows "graded by
  Haiku", but asserting a specific model name I can't reliably know ahead of
  time, given auto-pick depends on which API keys are configured, would be
  actively misleading). The grade table itself (score/weight/note) doesn't
  need this and is unaffected.
- 2026-07-21 P4: no `useRef`/`useImperativeHandle`/`setTimeout` used.
  `FusedBlockView`'s two auto-trigger effects are guarded by each mutation's
  own `isPending` (TanStack Query state) rather than a ref-based "already
  fired" flag — deliberately, to sidestep the question of whether that kind
  of ref falls under the orchestrator's "DOM refs" pre-authorization (it
  doesn't clearly), same reasoning W2's PROGRESS.md already used for its
  "previous artifact count" tracking.

## Landmines / do-not

- Do not implement Focus/Columns/Fused by modifying `CompareBlockView`
  (`MultiChatDeprecationPath.tsx`) — that path is legacy/unreachable for new
  chats. All new view-mode work targets `ToolsBlockView`
  (`MultiChat.tsx:1737-2143`) and the local `FocusBlockView`/`FusedBlockView`
  functions (both now landed, also inside `MultiChat.tsx` — see Decisions
  log for why they're not separate files).
- Do not add a `blockType: "tools" | "compare"` default of anything other
  than `"compare"` to `useStreamSynthesis`/`useSelectSynthesis`/
  `useDeselectSynthesis` — the legacy manual Synthesize button
  (`MultiChatDeprecationPath.tsx`) and `MultiChat.tsx`'s ⌘S shortcut call
  these WITHOUT passing `blockType` at all, relying on the default to stay
  `"compare"`. Changing the default would silently break old compare-block
  chats' still-working synthesis feature.
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
- Open a multi-model chat (2-3 models selected). Click the "Focus"/"Columns"/
  "Fused" segmented control in the header (top right). Expect: Columns
  (default) looks pixel-identical to before, except each column header now
  shows a small "main"/"hidden" label next to the model name (only when 2+
  models are selected). Focus: the first-selected model's response shows
  full-width; the others collapse into a single dashed-border box below it
  with "‹ 1/N ›" pager controls — clicking the arrows should cycle through
  the other responses. Fused: while models are still answering, looks like
  Columns; once ALL of them finish, it should automatically replace the
  columns with a single bordered "⚭ Fused response" card containing a
  synthesized answer, and — a beat later — a "Grading · influence weights"
  section with one row per model (name, weight bar, weight%, score, short
  note). Switching back to Columns/Focus mid-fusion should not error.
- Regression: the OLD compare-block synthesis feature (if you have a chat
  from before this rework with an actual "compare" block in it) — the
  manual synthesize button (merge icon in the small left gutter column) and
  ⌘S shortcut should still work exactly as before; this is the hardest
  regression to accidentally break since P4 generalized shared code, so it's
  worth specifically checking if such a chat is available to test with.
- Both light and dark theme for the new Fused card, grade bars, and role
  chips — not visually verified here (cannot run the app).
