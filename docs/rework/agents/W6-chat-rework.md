# W6 — Chat Rework: View Modes, Stances, Composer, Prompt Optimizer

Branch: `claude/rework-chat` · Worktree: `../chorus-wt-w6`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §5 (your frozen contract),
`docs/rework/design/chat.md`, `design/composer.md`,
`design/prompt-optimizer.md`, then this file.

## Mission

Bring the chat surface to the Remake design: **Focus / Columns / Fused** view
modes in the chat header, per-message **stances/Modes** (Assist/Critic/
Socratic), the reworked **composer** (mode picker + model popover + optimizer
button), and the **Prompt Optimizer** modal. Largest and most delicate
workstream — MultiChat.tsx is 152KB and live; strangler discipline throughout.

## Context you must load before coding

- `MultiChat.tsx` — column rendering, message sets, selected-message logic,
  `ResizablePanelGroup` (3323-3376). Read the whole render path once; keep
  line-range notes in PROGRESS.md.
- `ChatState.ts` — block types, message-set model; your `viewMode`, `IMode`,
  `IGrade` types land here (frozen exports).
- `ChatInput.tsx` (~40KB) — composer; `QuickChatModelSelector.tsx`.
- Existing synthesis/compare plumbing: `brainstorm.ts`,
  `ChatCompareSelection.ts`, `SummaryDialog.tsx`, `simpleLLM.ts` — Fused mode
  reuses these, no new pipeline.
- `api/MessageAPI.ts` (132KB — read selectively: send path, system prompt
  assembly, where hidden/secondary models answer).
- W4's `model-select` module (branch `claude/rework-model-select`) — the
  composer model popover is W4's component; you mount it. If W4 hasn't
  landed, build against its frozen props contract and mount a placeholder.

## Phases

**P0 — Recon (docs commit).** `docs/rework/w6-chat-recon.md`: how a message
set fans out to models today, where system prompts assemble, how selected
messages render, existing synthesis flow. The map every later phase (and any
adopter) navigates by.

**P1 — Modes entity.** Migration: `modes` table (icon, name, description,
prompt, tag app-default/per-chat/custom, usage_count) + seed
Assist/Critic/Socratic exactly per `design/settings.md` prompt texts; ledger
entry. Core CRUD + `api/ModesAPI.ts` (frozen — W3's Modes section consumes
it). Injection: prepend active mode prompt to system prompt at send; track
usage_count. Per-chat + per-message override semantics per `design/chat.md`.

**P2 — Composer.** Per `design/composer.md`: mode picker popover (icon +
name + description rows, current mode chip in composer), model popover mount
(W4's, with quota badges from W1's `useQuota` — stub until W1 P2 lands),
optimizer button. Keep `ChatInput.tsx` changes additive; new pieces in
`src/ui/components/composer/`.

**P3 — View modes.** Migration: `chats.view_mode` (default `columns`);
segmented control in chat header (design: pill segmented, active =
inverted-ink). *Columns* = current behavior + main/hidden role chips.
*Focus* = primary model full-width + carousel pager over hidden responses
("2/3", badge "hidden · ✕ critic stance"). Hidden models still answer
(existing multi-model fan-out) — this is presentation, not pipeline.
One commit per mode; `columns` path must remain pixel-stable (regression
risk #1).

**P4 — Fused.** After all selected models respond: synthesis call (reuse
brainstorm/simpleLLM) produces fused answer + grades
(`IGrade { model, score, weightPct, note }`) rendered as the design's grade
table (score bar, weight, note). Persist grades as a message block/part per
architecture §5. Show cost line per column footer ("2 artifacts · 3
citations · $0.011" style — reuse `MessageCostDisplay`).

**P5 — Prompt Optimizer.** Modal per `design/prompt-optimizer.md`: rewrites
draft via cheap model (`simpleLLM.ts`); targets Just chat / Hand to agent —
build (adds acceptance criteria) / Plan first; Structured vs Before-After
views; model-set presets applying to chat selection on confirm. Draft
replacement is undoable (keep original in the drafts store).

## Coordination hotspots

- **MultiChat.tsx shared with W2:** W2's artifact-panel mount lands first;
  rebase over it, never touch `src/ui/components/artifacts/**`.
- Stances UI (settings cards) = W3; you own the entity + composer picker.
- Sidebar unchanged (W7/W8 territory).

## Resumability specifics

- Strict phase independence: P1, P2, P3, P4, P5 each shippable alone;
  view-mode work hides behind the segmented control defaulting to `columns`.
- PROGRESS.md must carry MultiChat line-range notes and the P0 recon doc link;
  this is the workstream most likely to be adopted mid-flight — write for
  the adopter.

## Done means

All three view modes usable; modes seeded/pickable/injected with usage
counts; composer matches design; optimizer round-trips a draft; columns-mode
regression-clean (test plan: existing multi-model chat, replies drawer,
find-in-page, compare/synthesis, quick chats); migrations ledgered;
lint/build green; PR per CLAUDE.md.
