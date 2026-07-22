# W6 Recon — how chat/compare/synthesis works today

Read this before touching any P1-P5 code. All line numbers verified by direct
reading on `claude/rework-chat` at the commit this doc was added in (W1+W2+W4
already merged in). Line numbers drift — re-`grep -n` if picked up cold.

## CORRECTION (read this first — it overrides the first draft of §5/§6 below)

First draft of this doc (written before cross-checking a parallel recon pass)
assumed `blockType: "compare"` / `CompareBlockView` was today's live multi-model
side-by-side view. **That is wrong.** Verified directly by reading
`ChatInput.tsx:215` (`const BLOCK_TYPE = "tools";`, hardcoded for every new
send) and `usePopulateBlock`'s switch (`MessageAPI.ts:3220-3234`, only a
`"tools"` case exists, everything else throws). **`blockType: "compare"` is
legacy/unreachable for new messages** — `CompareBlockView`
(`MultiChatDeprecationPath.tsx:899-1225`) only ever renders pre-existing old
data; there is no UI path to create a new one. **The actual live "Columns"
view is `ToolsBlockView`, defined in `MultiChat.tsx:1737-2143`** (not in
`MultiChatDeprecationPath.tsx` at all), backed by `ToolsBlock.chatMessages`,
rendering `ToolsMessageView` (`MultiChat.tsx:1287-`, exported) columns. It has
**no synthesis affordance whatsoever today** — the synthesize button only
exists in the dead `CompareBlockView`. §5/§6/§11/§16 below are corrected
in-place (marked `[CORRECTED]`) rather than rewritten from scratch, so the
reasoning trail stays visible. Everything else in this doc (§1-4, §7-10, §12-15)
was independently verified twice (by me directly and by a parallel recon
agent) and stands as originally written.

## 1. Data model (ground truth = `src-tauri/src/migrations.rs`, not `SCHEMA.md`
which is stale/auto-generated as of 2025-07-08 and missing everything after
`model_profiles`)

Current max migration version on this branch: **147** (`provider_accounts`,
W1's last migration, already tagged `// REWORK-MIGRATION: renumber at rebase`).
My migrations start at **148**.

Tables relevant to W6:
- `chats`: id, title, project_id, updated_at, created_at, pinned, quick_chat,
  summary, is_new_chat, parent_chat_id, project_context_summary(+is_stale),
  reply_to_id, gc_prototype_chat, total_cost_usd. **No `selected_model_config_ids`
  column** — it was added (migration ~line 780) then DROPPED (line 873); model
  selection today lives in `saved_model_configs_chats` (see §2). I append
  `view_mode` here (P3).
- `message_sets`: id, chat_id, deprecated_parent_id, type ('user'|'ai'),
  created_at, selected_block_type ('user'|'chat'|'compare'|'tools'|'brainstorm'),
  level (turn index, sequential per chat). One user-turn = **two rows**: a
  `type='user'` set (holds the prompt, `userBlock`) and a `type='ai'` set one
  `level` higher (holds whichever block type is active for that turn — usually
  `tools`). I append `mode_id` here (P1) — nullable, set once on the **ai**
  set at creation time, so historical turns retain which stance was active
  (needed for chat.md's per-message "✓ assist" sender-row badge).
- `messages`: id, message_set_id, chat_id, text, model, selected, created_at,
  streaming_token, state('streaming'|'idle'), error_message, is_review,
  review_state, block_type, level, reply_chat_id, branched_from_id,
  prompt_tokens, completion_tokens, total_tokens, cost_usd. `model` doubles as
  the model_config id (matches `ChatState.ts`'s comment "same as messages.model").
  I append `grades_json` here (P4, nullable TEXT, JSON `IGrade[]`) — see §7.
- `message_parts`: (message_id, level) composite PK, content, tool_calls,
  tool_results — sequential tool-turn storage for ONE message. Not a fit for
  grades (confirmed by reading; do not repurpose).
- Prior-art precedent tables to mirror: `prompt_profiles` / `prompt_profile_chats`
  (migration v141, `migrations.rs:2604-2634`) — exact same shape I need for
  `modes`/`chat_modes` (see §8). `model_profiles` (v140) also uses the same
  `id/name/.../created_at/updated_at` skeleton.

`ChatState.ts` TS types (already read fully, 475 lines, no changes needed there
except adding `IMode`/`IGrade`/`viewMode` frozen exports per architecture §5):
`MessageSet`, `MessageSetDetail` (= MessageSet + all 5 block variants as
siblings; `selectedBlockType` picks which one is canonical), `Message`,
`MessagePart`, `Block` union (`UserBlock|ChatBlock|CompareBlock|BrainstormBlock|ToolsBlock`).
**`CompareBlock = { type: "compare", messages: Message[], synthesis: Message | undefined }`
already exists** — this IS today's "Columns" data shape; `synthesis` is an
existing optional slot, not something I'm inventing. `llmConversation()` /
`llmConversationForSynthesis()` (ChatState.ts:380-475) turn a `MessageSetDetail[]`
into the wire format per block type — read fully, no changes needed for P1-P4
(mode injection happens in MessageAPI.ts, not here; see §4).

## 2. Model selection per chat

`src/core/chorus/api/ModelConfigChatAPI.ts` (read fully, 189 lines). Source of
truth: `saved_model_configs_chats` table (chat_id -> JSON array of model_config
ids, ordered). Key exports:
- `useChatCompareModelConfigs(chatId): ModelConfig[]` — **the** ordered list
  (persisted ∩ visible ∪ ambient-default fallback). Index 0 = "main" is a
  *display convention only* (W4's frozen `ModelSelectPopoverProps` comment says
  so explicitly) — nothing in the data model marks a model as main today.
  P3's "main/hidden role chips" are purely `index === 0` ? "main" : "hidden",
  no schema change.
- `useUpdateSavedModelConfigChat()`, `useAppendModelConfigToChatCompare()`,
  `useReplyModelConfig`/`useUpdateReplyModelConfig` (single-model reply chats).
- `ChatInput.tsx` (see §11) already has ALL the callback plumbing
  (`toggleCompareModelConfig`, `clearCompareModelConfigs`,
  `selectAllCompareModelConfigs`, `unionSelectAllCompareModelConfigs`,
  `reorderMainChatCompare`) wired to a `ManageModelsBox` with `mode.type:
  "default"` — this is 1:1 field-compatible with W4's frozen
  `ModelSelectPopoverProps` (confirmed by reading `ManageModelsBox.tsx`, now a
  9-line-of-logic shell at `src/ui/components/ManageModelsBox.tsx` that wires
  `onAddApiKey`/`onOpenProfile`/`showCost` and delegates to
  `model-select/ModelSelect.tsx`). **Consequence for P2: quota badges are
  already free** — `ModelSelectPopover`/`ModelRow` render them internally via
  W4's `useModelViaInfo`. I do not need to touch `useQuota` wiring myself; I
  only need to add the NEW mode-picker pill + optimize button next to the
  existing model-picker trigger, and I can keep using `ManageModelsBox`
  as-is (do not re-mount `ModelSelectPopover` directly — that would duplicate
  working, tested plumbing for no benefit and risks desyncing from
  `ChatInput.tsx`'s existing callbacks).

## 3. Send / fan-out pipeline (how a message set fans out to models today)

Entry point: `ChatInput.tsx`'s `submit` mutation (`ChatInput.tsx:210-375`,
read fully). Sequence:
1. `createMessageSetPair.mutateAsync({chatId, userMessageSetParent: currentMessageSet, selectedBlockType: "tools"})`
   → `MessageAPI.useCreateMessageSetPair` (`MessageAPI.ts:1855-1899+`, read).
   Inserts BOTH message_sets rows in one mutationFn: `userMessageSetId` at
   `userLevel`, `aiMessageSetId` at `userLevel+1`. **This is where I hook mode
   persistence + usage_count (P1)** — extend this mutation's input with
   `modeId?: string`, write it onto the INSERT for the **ai** row only
   (`migrations.rs`-style additive column), bump `modes.usage_count` once here
   (NOT inside the per-model streaming calls in §4, which would multi-count
   for N-model fanout).
2. `createMessage.mutateAsync({message: createUserMessage(...)})` — inserts the
   user's message row.
3. `convertDraftAttachmentsToMessageAttachments`, `forceRefreshMessageSets`,
   `generateChatTitle` (fire-and-forget), `markProjectContextSummaryAsStale`.
4. `populateBlock.mutateAsync({messageSetId: aiMessageSetId, blockType: "tools", replyToModelId, excludedModelIds: minimizedModels, applyChatCreationModelDefaults})`
   → `MessageAPI.usePopulateBlock` (`MessageAPI.ts:3184-3240ish`, read) →
   for `blockType==="tools"` calls `populateToolsBlock.mutateAsync(...)` →
   (not traced further; not needed — it fans out to N models, each of which
   eventually calls `useStreamMessage`/`useStreamMessageLegacy`, see §4). This
   is the "existing multi-model fan-out" my P3 brief says Focus/Fused reuse
   unchanged — confirmed there is exactly one fan-out mechanism, gated only by
   how many models are in `useChatCompareModelConfigs`.

## 4. System prompt assembly — the mode-injection point (P1)

`src/core/chorus/prompts/prompts.ts:597-632`, `injectSystemPrompts(modelConfigIn, options?)`:
joins `[CHORUS_SYSTEM_PROMPT, universalSystemPrompt, ...promptProfileSystemPrompt,
...toolsetInfo, ...isInProject, ...modelConfigIn.systemPrompt]` with `\n\n`.
**Exactly two call sites**, both in `MessageAPI.ts`, both already fetch
`fetchChatPromptProfileSystemPrompt(chatId)` right before calling it — mirror
this pattern for modes:
- `MessageAPI.ts:1490-1507` inside `useStreamMessage` (the "message parts" /
  tool-calling path).
- `MessageAPI.ts:1578-1584` inside `useStreamMessageLegacy` (the "vanilla" /
  legacy-text path — **also used by `useStreamSynthesis`**, see §7, so mode
  injection automatically applies to the synthesis call too with zero extra
  wiring; decided this is correct/desired, see §12).

Plan: add `fetchActiveModeSystemPrompt(messageSetId): Promise<string | undefined>`
to a new `api/ModesAPI.ts`, resolving `message_sets.mode_id -> modes.prompt`
(pure read, no side effect — usage_count is counted once at send time per §3,
not per model per here). Call it at both sites, pass as a new
`modeSystemPrompt?` option into `injectSystemPrompts`, spliced into the join
array right after `promptProfileSystemPrompt`.

## 5. Existing "Columns" rendering [CORRECTED — see top]

**The live one: `ToolsBlockView`, `MultiChat.tsx:1737-2143`** (defined in
`MultiChat.tsx` itself, not `MultiChatDeprecationPath.tsx`). Flex row (not
`ResizablePanelGroup`, not CSS grid): `<div className="flex flex-1 h-fit ...
overflow-x-auto ...">` (2009-2018) wrapping a `@dnd-kit` `DndContext`
(2019-2087) of `SortableColumnItem > ToolsMessageView` columns, each
`min-w-[450px] max-w-[550px]` (2041-2045, `2043` for quick-chat variant).
Column order: `useModelOrderStore`/`modelOrderActions` (custom drag order) else
finished-first (tracked via `finishedModelsOrder` state + a `prevMessageStatesRef`
comparing previous/current `message.state`, 1774-1829) then alphabetical.
"Included in next response" pending-model chips + trailing dashed "Add" button
+ `ManageModelsBox` (`mode: "add"`) at 2088-2137, shown only `isLastRow &&
!isQuickChatWindow`. **No main/hidden concept, no synthesis affordance** —
confirmed by full read, lines 1737-2143 contain no reference to
`chorus::synthesize`/`selectSynthesis`/anything grade-shaped.

**`ToolsMessageView`** (`MultiChat.tsx:1287-`, exported, read 1287-1476 in
detail): header block at **1425-1476** — `ProviderLogo` + `displayModelConfig
?.displayName` (1454-1458) + conditional `routingBadgeText` (OpenRouter
auto-route indicator, 1459-1463) + conditional `"tools off"` badge
(1464-1468). **This exact spot (right after the model-name span, before or
alongside the existing badges) is where the P3 role chip (main/hidden) and
the P1 per-message stance badge ("✓ assist") get added** — additive JSX only,
same insertion strategy as originally planned, just the correct
component/file (`ToolsMessageView` in `MultiChat.tsx`, not `AIMessageView` in
`MultiChatDeprecationPath.tsx`).

`CompareBlockView`/`AIMessageView`/`ChatBlockView`/`BrainstormBlockView` in
`MultiChatDeprecationPath.tsx` (899-1554, all read in full) remain accurate as
descriptions of the **legacy/dead-for-new-messages** compare path — old chats
that already have compare-block data still render and are still interactive
(the manual synthesize button still works on them), so this code must not be
deleted or broken, just understood as non-primary. Everything below that was
originally written about `CompareBlockView`'s sort/DnD/pinned-synthesis-column
structure is factually accurate for *that* component — the correction is only
about which component is "Columns" for *new* chats.

**Critical structural fact**: despite the name, this file is NOT dead/legacy —
`MultiChat.tsx` actively imports `CompareBlockView`, `ChatBlockView`,
`BrainstormBlockView` from it (`MultiChat.tsx:85-89`) and they are the ONLY
implementation of those three block renderers. 1554 lines total. Read in full
(component list): `ReviewMessageView` (175), `AIMessageView` (334, read fully
to line ~650), `SynthesisAnimation` (724), `MinimizedColumnView` (755),
`CompareBlockView` (899-1225, read fully), `ChatBlockView` (1227),
`BrainstormBlockView` (1489).

**`CompareBlockView`** (899-1225) is today's "Columns" mode, verbatim:
- Sorts `compareBlock.messages` (custom drag order via `useModelOrderStore` >
  streaming-first > moved-right-last > alphabetical). **No main/hidden concept
  exists today** — every model is an equal column. P3 adds a role chip purely
  as a cosmetic badge keyed on `index === 0` in the *selected* order (§2),
  layered into `AIMessageView`'s header (below), not into this sort/layout logic.
- Renders the pinned synthesis column (if `compareBlock.synthesis &&
  isSynthesisSelected`) then a `DndContext`-wrapped flex row of
  `SortableColumnItem > AIMessageView` (or `MinimizedColumnView` if minimized),
  each `flex-1 min-w-[400px] max-w-[550px]`. Trailing "Add" button opens
  `ManageModelsBox` with `mode.type: "add"`.
- The manual synthesize/un-synthesize button lives at line 1039-1075
  (`selectSynthesis.mutate({chatId, messageSetId})` /
  `deselectSynthesis.mutate(...)`), gated on `isLastRow && totalVisibleCount > 1`.
  **This manual button is the ONLY current trigger for synthesis** — there is
  no auto-trigger today. P4 needs to add an auto-trigger (see §7).

**`AIMessageView`** (334-~650, header section at 430-489): per-column header,
`blockType === "compare"` branch (454-489) renders model name always-visible,
then EITHER a "Drag to move" hint (if selected+not-synthesis) OR a `⌘N`
shortcut hint. **This is the exact, minimal insertion point for both the P3
role chip (main/hidden) and the P1 per-message stance badge ("✓ assist")** —
add small badges after the model-name span (~line 463-465), additive JSX only,
nothing else in this function needs to change. `isSynthesis` prop already
exists and special-cases the synthesis column's icon (`MergeIcon`) instead of
a model name — P4's grade table is a NEW sibling render block, not a
modification of this row (see §7 decision).

`MultiChat.tsx` itself does not define any block-rendering component; it only
supplies data/callbacks down into `ChatBlockView`/`CompareBlockView`/
`BrainstormBlockView`/`ToolsBlockView` (the last one IS defined locally in
MultiChat.tsx at line 1737, for the `tools`-block per-message UI, distinct
from the compare/columns UI — not touched by this rework except where noted).

## 6. Existing synthesis mechanism (reuse target for P4 Fused)

`MessageAPI.ts:2293-2400`, read fully:
- `useStreamSynthesis()` (2293-2366): guarded by "skip if a `chorus::synthesize`
  message already exists in this set's compareBlock". Looks up model config
  `id === "chorus::synthesize"` (a real seeded row, `migrations.rs:902-908`:
  `models`/`model_configs` INSERT with `is_internal=1`, empty `system_prompt`,
  `model_id = 'chorus::synthesize'` — i.e. it's a *virtual* model whose
  provider-prefix routing is handled specially downstream; not traced further,
  not needed — it already works end-to-end today). Creates an AI message
  (`blockType: "compare"`, `model: "chorus::synthesize"`, `selected: true`),
  builds the conversation via `ChatState.llmConversationForSynthesis()` (which
  wraps `Prompts.SYNTHESIS_INTERJECTION`, `prompts.ts:145-166` — instructs the
  model to synthesize `<perspective sender="...">` blocks into one brief
  answer), then streams it through the **normal** `useStreamMessageLegacy`
  pipeline (`messageType: "vanilla"`) — meaning it goes through the same
  system-prompt injection as §4, gets real token/cost accounting for free
  (`prompt_tokens`/`completion_tokens`/`cost_usd` columns), and renders through
  the same `AIMessageView` as any other column (with `isSynthesis={true}`).
- `useSelectSynthesis()` (2368-2400): sets `messages.selected` so only the
  synthesis row is selected within the compare block, then calls
  `streamSynthesis.mutateAsync(...)`. `useDeselectSynthesis()` (2600+, not
  fully re-read, symmetric) reverts.

**Decision for P4 [CORRECTED — see top]**: since `ToolsBlock` (the live block
type) has **zero** existing synthesis mechanism — `useStreamSynthesis`/
`useSelectSynthesis`/`useDeselectSynthesis` hardcode `blockType: "compare"`
(the `createAIMessage` call, `MessageAPI.ts:2338`) and `block_type = 'compare'`
(SQL, `MessageAPI.ts:2383` and `:2620`), and `llmConversationForSynthesis`
(`ChatState.ts:465-475`) hardcodes reading `messageSets[...].compareBlock` —
reusing "the existing synthesis plumbing" for Fused mode requires a **small,
surgical generalization** of these three functions + the encoder, not a
verbatim reuse of a manual-button click. This is still "no new pipeline" in
spirit (same prompt text, same model resolution, same streaming/persistence
code path) — just parameterized over which block's message list to read,
instead of hardcoded to the one that's now legacy. Plan:
- `ChatState.ts`: generalize `llmConversationForSynthesis` to read
  `toolsBlock.chatMessages.filter(m => m.model !== "chorus::synthesize")` when
  `selectedBlockType === "tools"`, else the existing `compareBlock.messages`
  path — same function signature, callers unaffected, legacy compare-block
  chats keep working byte-for-byte since their `selectedBlockType` is still
  `"compare"`.
- `MessageAPI.ts`: add a `blockType: "tools" | "compare"` field to
  `useStreamSynthesis`/`useSelectSynthesis`/`useDeselectSynthesis`'s mutate
  input; thread it into the SQL (`block_type = $N` instead of the literal) and
  into `createAIMessage({..., blockType})`. Update the two existing call
  sites (`MultiChatDeprecationPath.tsx`'s manual synthesize button,
  `MultiChat.tsx`'s ⌘S shortcut handler) to explicitly pass `blockType:
  "compare"` — zero behavior change for them. My new Fused-mode auto-trigger
  passes `blockType: "tools"`.
- Rendering: new `FusedBlockView` component (sibling to `ToolsBlockView`, not
  a modification of it) takes `toolsBlock: ToolsBlock` + `isLastRow`, derives
  `synthesisMessage = toolsBlock.chatMessages.find(m => m.model ===
  "chorus::synthesize")` and `modelMessages = toolsBlock.chatMessages.filter(m
  => m.model !== "chorus::synthesize")` inline — **no `ChatState.ts` type
  change to `ToolsBlock` itself needed** (unlike `CompareBlock`, it gets no
  new `synthesis` field; deriving via `.find()` is simpler and avoids touching
  a shared type other block-type code depends on).
- Auto-trigger: a `useEffect` in `FusedBlockView`, gated on `viewMode ===
  "fused" && isLastRow && modelMessages.length > 1 && modelMessages.every(m =>
  m.state === "idle") && !synthesisMessage`, calls the now-generalized
  `useSelectSynthesis` (or a thin wrapper) with `blockType: "tools"`.
- Grading is a **second, independent** step after synthesis resolves: a new
  `useComputeFusedGrades`-style mutation calling `simpleLLM()` (not the
  streaming pipeline) with the per-model original texts + the synthesis text,
  asking only for a JSON `IGrade[]`, persisted via `UPDATE messages SET
  grades_json = ? WHERE id = ?` on the synthesis message row. Kept separate
  from the synthesis call itself so `SYNTHESIS_INTERJECTION`'s prompt text —
  shared with the legacy manual button — never needs to change. Grade-table's
  "graded by X" label reads the *actual* resolved model's display name, not a
  hardcoded "Haiku" (no guarantee that model is configured for a given user).

`ChatState.ts` encoder for this: `encodeCompareBlockForSynthesis` (306-324),
`llmConversationForSynthesis` (465-475) — both read fully, no changes needed.

## 7. `SummaryDialog.tsx` — a false lead, noted so nobody re-investigates it

Read fully (131 lines). It's a generic "show markdown text in a modal with
copy/refresh buttons" component, used for the **whole-chat** `chats.summary`
column (unrelated feature). It has nothing to do with per-turn multi-model
synthesis/grading. Despite being named in the W6 brief alongside
`brainstorm.ts`/`ChatCompareSelection.ts`, it is not a building block for P4 —
don't spend time trying to reuse it for the grade table.

`brainstorm.ts` (58 lines, read fully): `parseIdeaMessage` (regex-parses
`<idea>`/`<advantage>` tags) + `BRAINSTORMER_NAMES`/`BRAINSTORMERS` (hardcoded
model list for the separate "Brainstorm" block type / ideation feature). Not
directly reusable for Fused grading (different shape), but its regex-tag
parsing style (`<idea>...</idea>`) is a good precedent if I need to parse a
`<grades>...</grades>` tag out of anything — I'm not doing that (see §6
decision: grades come from a separate `simpleLLM()` JSON call, not tag-parsing
the synthesis text), noted only as a style precedent.

`ChatCompareSelection.ts` (140 lines, read fully): `resolveOrderedCompareConfigs`,
`computeInitialChatCompareModelConfigIds` (new-chat default model selection
priority chain), `syncGlobalCompareMetadataToConfigIds` (keeps `app_metadata`
ambient-compare in sync). Pure logic, already consumed by `ChatInput.tsx`/
`ModelConfigChatAPI.ts`. No changes needed for W6.

`simpleLLM.ts` (77 lines, read fully): `simpleLLM(prompt, params: {model?,
maxTokens}, modelConfigId?): Promise<string>` — single non-streaming
completion. If `modelConfigId` given, resolves via
`ModelProviders/simple/SimpleCompletionProviderFactory.ts`'s
`createProviderByPrefix`; else auto-picks via `getSimpleCompletionProvider`
using `SimpleCompletionMode` (`TITLE_GENERATION`/`SUMMARIZER` only today,
`ISimpleCompletionProvider.ts:1-9`). **Reuse target for P4's grading call and
P5's optimizer rewrite call.** Decision: do not add new `SimpleCompletionMode`
enum values (that touches `SimpleCompletionProviderFactory.ts`'s
provider-selection internals, outside W6's owned surface); instead pass an
explicit `modelConfigId` when one is contextually known (e.g. reuse
`"chorus::synthesize"`'s resolved model for grading), and fall back to no
`modelConfigId` (auto-pick) otherwise — same pattern already used elsewhere,
zero risk to shared provider-resolution code.

## 8. Prior art: `PromptProfilesAPI` — a *different*, coexisting feature

`src/core/chorus/api/PromptProfilesAPI.ts` (202 lines, read fully) +
`PromptProfilePill.tsx` (121 lines, read fully) + `prompt_profiles`/
`prompt_profile_chats` tables (migration v141) is an **existing, shipped**
feature: user-managed "persona" system-prompt presets (e.g. "Data Scientist",
"Academic Researcher"), one optional profile per chat, injected via
`fetchChatPromptProfileSystemPrompt(chatId)` at the same two call sites as §4.
This is **not** what the architecture doc's "Modes/stances" describes and is
**out of scope** to rename/replace/merge — it's a different axis (persona
flavor vs. interaction stance) and the design docs (`chat.md`/`composer.md`/
`settings.md`) never mention it. Decision: build `modes`/`chat_modes` as a
**new, separate** entity mirroring this file's exact patterns (same
`id/name/.../author/created_at/updated_at` shape, same
`fetch.../use.../useSet.../useCreate.../useUpdate.../useDelete...` naming
convention), and leave `PromptProfilePill`/`PromptProfilesAPI`/`PromptProfilesTab`
completely untouched. Both pills coexist in `ChatInput.tsx`'s toolbar (see
§11) — they answer different questions ("what persona" vs "what stance").

## 9. Drafts store (for P5's "undoable" requirement)

`src/core/chorus/api/DraftAPI.ts` (134 lines, read fully).
`useAutoSyncMessageDraft(chatId, wait=500): {draft, setDraft, ...}` (via
`use-react-query-auto-sync`) is THE single current-draft mechanism, backed by
`message_drafts` table (one row per chat, no history/versions). **There is no
multi-version draft history anywhere in the codebase.** Decision: "keep
original in the drafts store" for the optimizer's undo does NOT mean a schema
change — implement a lightweight in-memory undo (stash the pre-optimization
draft string in local component state at the moment the user clicks "use ↵",
offer a one-shot "Undo" action that calls `setDraft(stashed)`). No migration,
no new persistence.

## 10. `MessageCostDisplay.tsx` (reuse target for P4 footer cost line)

`src/ui/components/MessageCostDisplay.tsx` (44 lines, read fully). Props:
`{costUsd?, promptTokens?, completionTokens?, isStreaming, isQuickChatWindow}`.
Pure presentational, reads `settings.showCost` itself, renders nothing if that
setting is off or still streaming. Directly reusable as-is for both the
per-column footer cost and the Fused footer's `$0.004`-style line — just pass
the synthesis message's own `costUsd`/token fields (available for free once
grading's `grades_json` UPDATE also happens post-stream, or straight off the
synthesis message row since it streams through the normal cost-tracking path
per §6).

## 11. `MultiChat.tsx` structural map (3797 lines; W2's artifact mount already
landed — DO NOT TOUCH, only preserve)

- Imports: `CompareBlockView`/`ChatBlockView`/`BrainstormBlockView` from
  `MultiChatDeprecationPath` at 85-89; `ArtifactPanel`/`collectChatArtifacts`
  (W2) at 164-165; `ChatInput` at 79; `ManageModelsBox` at 132;
  `ResizablePanelGroup`/`ResizablePanel`/`ResizableHandle` at 141-145;
  `MessageCostDisplay` at 157; heavy `* as MessageAPI/ChatAPI/ProjectAPI/
  ModelConfigChatAPI/ModelsAPI/AttachmentsAPI/DraftAPI` namespace imports
  (148-155) — follow this namespace-import convention for any new
  `ModesAPI`/`OptimizerAPI` I add.
- `export default function MultiChat()` starts **2308**.
- **[CORRECTED — header location, closes the §16 open question]** Normal
  (non-quick-chat) header: **3180-3353** (`<div data-tauri-drag-region
  className="absolute top-0 ... h-[52px] ...">`). Left cluster **3190-3242**:
  sidebar trigger, back/forward nav buttons, `<ProjectSwitcher />` at **3241**
  (breadcrumb + `EditableTitle`, defined at 406-482 — no existing badge/pill
  next to it today). Right "chat actions" cluster **3245-3351**: conditional
  find/summarize/share icon buttons (**3246-3334**, shown only when
  `!isQuickChatWindow && messageSetsQuery.data.length > 1`), then an
  always-shown `<MoveToProjectDropdown>` (**3337-3350**). **The P3 segmented
  control (Focus/Columns/Fused) and P1's read-only mode badge both go in this
  right cluster**, most naturally inserted as new items before the
  find/summarize/share group (order: [segmented control] [mode badge]
  [find/summarize/share] [move-to-project]) — gated the same way
  (`!isQuickChatWindow`; the segmented control probably shouldn't also
  require `length > 1` since even a single-turn chat can be in any view mode).
  Quick-chat header (titleless ambient window, no room for either control) is
  the separate **3055-3178** branch — do not add either control there.
- W2 artifact state/effect at **2326-2359** (do not touch); `repliesDrawerOpen`
  derivation at **2552**; `ResizablePanelGroup` at **3361**, main chat panel
  **3366-3397**, conditional replies-drawer panel **3401-3411**, W2's artifact
  panel **3417-3431** (third `ResizablePanel`, immediately before the group's
  close at **3434**). **My view-mode segmented control goes in the chat
  HEADER, not here** — I have not yet located the exact header JSX line range
  (still to confirm at implementation time via fresh grep for the breadcrumb/
  title row, likely near `ProjectSwitcher`/`EditableTitle` usage) — treat as
  open, resolve at P3 implementation time, note the confirmed range in
  `.rework/w6-PROGRESS.md` once found.
- Other components defined in this file: `ErrorView` (177), `ContextLimitError`
  (206), `ProjectSwitcher` (406), `EditableMessage` (484), `UserMessageView`
  (541, exported), `MessagePartView` (651), `ToolCallView` (672),
  `ToolsMessageFullScreenDialogView` (860), `DeepResearchNotificationHandler`
  (951)/`Button` (983), `ToolsAIMessageViewInner` (1040), `ToolsReplyCountView`
  (1152, exported), `ToolsMessageView` (1287, exported), `ToolsBlockView`
  (1737 — the `tools`-block renderer, analogous to but separate from
  `CompareBlockView`), `MinimizedToolsColumnView` (1699, exported),
  `UserBlockView` (2145), `ModelSelectorWrapper` (2283), `ChatMessageSkeleton`
  (3526), `MainScrollableContentView` (3564).
- Dialog ids: `MANAGE_MODELS_CHAT_DIALOG_ID`/`MANAGE_MODELS_COMPARE_DIALOG_ID`/
  `MANAGE_MODELS_COMPARE_INLINE_DIALOG_ID` now live in `ManageModelsBox.tsx`
  (frozen per W4's comment there — 4+2+1 outside call sites depend on the
  string values, not just the constants).

## 12. `ChatInput.tsx` structural map (1011 lines, read fully — this is P2/P5's
primary file)

- Single default export `ChatInput({chatId, isNewChat, currentMessageSet,
  inputRef, eyeRef, scrollToLatestMessageSet, isReply, defaultReplyToModel,
  showScrollButton, handleScrollToBottom, minimizedModels})`.
- Draft state: `const { draft, setDraft } = DraftAPI.useAutoSyncMessageDraft(chatId)` (119).
- Model-selection callbacks (all already wired, reused as-is by P2, see §2):
  `persistMainChatCompareIds` (429), `ensureCompareModelConfigSelected/Deselected`
  (453/462), `toggleCompareModelConfig` (477), `clearCompareModelConfigs` (503),
  `selectAllCompareModelConfigs` (512), `unionSelectAllCompareModelConfigs` (530),
  `reorderMainChatCompare` (558).
- `submit` mutation (210-375) — the send entry point, see §3.
- Toolbar JSX: `<div className="flex py-3 w-full">` at **759**, left cluster
  **761-782** (`AttachmentAddPill`, `ManageModelsButtonCompare` ×2 for
  reply/non-reply, `ToolsBox`, `PromptProfilePill` at **781**), right cluster
  (send button) **784-824**. **My new mode-picker pill + optimize button slot
  in right after `PromptProfilePill` at line 781, additive**, matching its
  exact visual pattern (`inline-flex bg-muted ... rounded-full h-7`, Popover
  trigger). `ManageModelsBox` mounts at **827-867** (both default and reply
  variants) — untouched.
- Three render branches at the bottom (873-909 new-chat centered, 911-993
  quick-chat, 994-1010 reply/normal) all share the single `defaultChatComposer`
  JSX const (657-870) — my toolbar additions live inside that one shared const,
  so they automatically apply to all three render paths without triplicating
  code.
- No existing "mode"/"stance" concept anywhere in this file (confirmed).

## 13. UI primitives available (no new deps needed for W6)

`src/ui/components/ui/*.tsx` includes: `popover`, `dialog`, `dropdown-menu`,
`tabs`, `radio-group`, `switch`, `select`, `badge`, `command`, `hover-card`,
`tooltip`, `collapsible`, `progress`, `table`, `separator`, `toggle`,
`checkbox`, `scroll-area`. All matching `@radix-ui/*` packages already in
`package.json`. `lucide-react` (icons) already present. This covers: segmented
control (build from `toggle`-group or plain buttons per DESIGN.md's pill spec,
`tabs.tsx` is also viable), mode popover (`popover.tsx`, same pattern as
`PromptProfilePill.tsx`), optimizer modal (`dialog.tsx`), optimizer intent
radios (`radio-group.tsx`), structured/before-after toggle (`tabs.tsx` or
plain buttons). **No package.json change anticipated for W6.**

## 14. Migrations plan (ledger: 2 entries, matches
`docs/rework/MIGRATIONS-LEDGER.md`'s pre-declared W6 row)

- **v148** — `modes` + `chat_modes` tables (mirroring `prompt_profiles`/
  `prompt_profile_chats` shape exactly) + `message_sets.mode_id` nullable
  column + seed INSERT for Assist/Critic/Socratic.
- **v149** — `chats.view_mode` (`TEXT NOT NULL DEFAULT 'columns' CHECK (view_mode
  IN ('columns','focus','fused'))`, precedent: `messages.state`/`review_state`
  CHECK-constrained TEXT columns) + `messages.grades_json` (nullable TEXT,
  JSON `IGrade[]`, precedent: `attachments`-style JSON-in-TEXT columns).

Both tagged `// REWORK-MIGRATION: renumber at rebase (W6 — docs/rework/MIGRATIONS-LEDGER.md)`
per W1's exact precedent comment at `migrations.rs:2722`.

## 15. Mode seed data — resolving the `tag` ambiguity

Architecture §5 says `tag: app-default/per-chat/custom`. `design/settings.md`'s
copy is `"Assist · Do exactly what's asked..."`, `"Critic · Attack every
claim..."`, `"Socratic · Custom · answers only with questions..."` — the word
"Custom" appears **only** in the Socratic line. Decision: `tag` = provenance/
badge classification (`'app-default'` = shipped by Chorus, shown as "App
default" badge; `'custom'` = user-style/example custom mode; `'per-chat'` =
reserved for a future one-off chat-scoped mode, not seeded). Seed: Assist
(icon `✓`, tag `app-default`), Critic (icon `✕`, tag `app-default`), Socratic
(icon `?`, tag `custom`). "None" (icon `◯`) is a **UI-only virtual option**
(clears `mode_id` to NULL), never a stored row. No mode auto-applies by
default for new chats — `mode_id IS NULL` (None) is the true default; this
avoids silently changing any existing chat's behavior (regression risk).
Header badge suffix ("· default" / "· custom") is derived at render time from
whichever mode happens to be active, per its `tag`, not from any
selection-time logic.

## 16. Open questions (none blocking — all resolved above with a documented
decision; flagged here only for orchestrator visibility)

- Whether `message_sets.mode_id` (per-turn override) is the right persistence
  granularity vs. a `message_set_id -> mode_id` join table: went with the
  direct nullable column (simpler, additive, matches `selected_block_type`'s
  own precedent of living directly on `message_sets`).
- Whether Fused grading should be one combined LLM call or two (synthesis +
  separate grading): went with two, specifically to avoid touching the shared
  `SYNTHESIS_INTERJECTION` prompt that Columns mode's existing manual
  "Synthesize" button still depends on. See §6.
- ~~Exact chat-header JSX line range~~ RESOLVED — see §11's `[CORRECTED]` note
  (3180-3353 normal header, right cluster 3245-3351).
- Whether to generalize `useStreamSynthesis`/`useSelectSynthesis`/
  `useDeselectSynthesis` (add a `blockType` param) vs. write parallel
  tools-block-specific versions: went with generalizing the three synthesis
  functions specifically (single call-site each, hardcoding one literal
  string each — low-risk, avoids duplicating the whole
  streaming/persistence/invalidation body), while still following the
  codebase's existing convention of *separate* functions per block type for
  more substantial per-block-type logic (e.g. `useAddMessageToToolsBlock` vs
  `useAddMessageToCompareBlock` already coexist as separate functions — not
  touched, not generalized, precedent noted but not followed here since those
  do genuinely more block-type-specific work than a one-line hardcoded string).
