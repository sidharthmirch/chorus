# Best Reply Rework Design

## Problem

1. **Stuck selection bug**: `useEffect` in `ToolsBlockView` clears all `selected` state on every mount (line 1870-1884 MultiChat.tsx), meaning best reply selections are lost on remount
2. **Intrusive visual**: The amber border + blurred non-selected messages is visually jarring; the "Best reply" text label is prominent
3. **No stats**: Users can't see how often a model "wins" across conversations

## Design Decisions

- **Scope**: Tools + Compare views only (not single chat)
- **Deselect**: Click the best reply badge to deselect, or click outside the block
- **Fix normalization bug**: Remove the `useEffect` that clears `selected` on mount
- **Visual**: Small bottom badge instead of border/blur; no blur on non-selected messages
- **Stats**: All-time per-model best reply tally + winrate, shown on messages and in model picker

## Changes

### 1. Fix: Remove Selection Clearing Effect

**File**: `src/ui/components/MultiChat.tsx` (lines ~1870-1884)

Remove the `useEffect` that calls `deselectToolsMessages` on mount. The DB trigger `ensure_message_selected_on_insert` already handles normalization. Keep the click-outside-to-deselect behavior.

### 2. Visual: Rework Best Reply Badge

**Files**: `src/ui/components/MultiChat.tsx` (ToolsMessageView, CompareAIMessageView)

Current behavior (to remove):

- Amber border on "Mark best" button: `border-amber-400 text-amber-500`
- Blur on non-selected: `blur-[1.5px]`
- Opacity on non-selected: `opacity-70 hover:opacity-100`
- Selected has `!border-special` special border
- "Best reply" / "Mark best" text button with border

New behavior:

- Remove `blur-[1.5px]` from `ToolsAIMessageViewInner` entirely
- Remove `opacity-70 hover:opacity-100` from `messageClasses` for non-selected messages
- Remove `!border-special` for selected messages
- Replace the "Best reply" / "Mark best" button with a small bottom badge:
    - When selected: `<StarIcon>★ Best reply` in amber, positioned similar to cost display
    - When not selected: `<StarIcon> Mark best` in muted text, shown on hover
    - Click the badge to toggle (select/deselect)
- For compare view: same badge pattern in the message header

### 3. Stats: Best Reply DB Schema

**File**: `src-tauri/src/migrations.rs`

New migration:

```sql
CREATE TABLE IF NOT EXISTS best_reply_stats (
    model_id TEXT NOT NULL,
    best_reply_count INTEGER NOT NULL DEFAULT 0,
    total_eligible_rounds INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (model_id)
);
```

- `best_reply_count`: incremented when a model wins best reply
- `total_eligible_rounds`: incremented for all models in a round where best reply was selected

### 4. Stats: TanStack Query Hooks

**File**: `src/core/chorus/api/MessageAPI.ts` (or new `BestReplyStatsAPI.ts`)

New hooks:

- `useBestReplyStats()` — fetches all best reply stats
- `useRecordBestReply()` — mutation that:
    1. Increments `best_reply_count` for the winning model
    2. Increments `total_eligible_rounds` for all models in the message set
- `useRemoveBestReply()` — mutation that decrements the stats (for deselect)

The `useSelectMessage` mutation should be extended to call `useRecordBestReply` when selecting in tools/compare blocks.

When deselecting (via `deselectToolsMessages` or `deselectCompareMessages`), we decrement the winning model's `best_reply_count` and decrement `total_eligible_rounds` for all models in that set.

### 5. Stats: Display on Messages

**File**: `src/ui/components/MultiChat.tsx` (ToolsMessageView, compare block)

Next to the model name in the message header:

```
Claude 3.5 Sonnet  ★ 3 (60%)
```

- The star + count + percentage only shows for models that have stats
- Parsed from `best_reply_stats` table via a query hook
- Winrate = `best_reply_count / total_eligible_rounds * 100`, only shown if `total_eligible_rounds > 0`

### 6. Stats: Display in Model Picker

**File**: `src/ui/components/ManageModelsBox.tsx` (or `VisibleModelsTab.tsx`)

In the model card/badge, show a small stat:

```
[Logo] GPT-4o  ★5·63%
```

or

```
[Logo] GPT-4o  ★5 (63%)
```

The stat is fetched via `useBestReplyStats()` and looked up by model ID.

### 7. Compare View Best Reply

**File**: `src/ui/components/MultiChatDeprecationPath.tsx` or `MultiChat.tsx` compare block

Add the same best reply badge to compare messages. Currently compare messages have a `selected` property but no visual "best reply" indicator. Add the same badge pattern.

### 8. Edge Cases

- **Model name changes**: Stats are keyed by `model_id` which is stable across name changes
- **No best reply selected**: Winrate simply doesn't apply; `total_eligible_rounds` is only incremented when someone votes
- **Multiple messages from same model**: Best reply is per-message-set, so incrementing all models in the set handles this correctly
- **Deselect then reselect**: Decrement then increment — net zero change if same model, or adjusts if different model
