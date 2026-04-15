# Single Chat Mode — Implementation Status

## Overview

Single chat mode lets users focus on one model's output in a compare view, creating a spacious single-pane chat experience reminiscent of Claude.ai or ChatGPT's web UI. All models still receive messages — switching back to multi-mode reveals all responses.

## Files Changed

| File                                             | Changes                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src-tauri/src/migrations.rs`                    | Migration 147: `is_single_chat_mode BOOLEAN NOT NULL DEFAULT 0`, `focused_model_id TEXT` on `chats` table                                                                                               |
| `src/core/chorus/api/ModelConfigChatAPI.ts`      | `fetchSingleChatMode`, `updateSingleChatMode`, `useSingleChatMode`, `useUpdateSingleChatMode`, `getFocusedModelIdWhenEnablingSingleMode`, `singleChatModeKeys` query key object                         |
| `src/ui/components/ChatInput.tsx`                | ⌘⇧S shortcut, Columns toggle button, `MANAGE_MODELS_SINGLE_CHAT_DIALOG_ID`, `toggleSingleChatMode` callback, ManageModelsBox "single" mode dialog                                                       |
| `src/ui/components/ManageModelsBox.tsx`          | `ModelPickerMode "single"` type variant, `isSingleChatMode`/`onToggleSingleChatMode` props, Single/Multi Toggle in header, removed debug console.log                                                    |
| `src/ui/components/MultiChat.tsx`                | `useSingleChatMode` hook in MessageSetView, `isSingleChatMode`/`focusedModelId` props threaded to child views, `UserBlockView` accepts `isSingleChatMode` for centered layout                           |
| `src/ui/components/MultiChatDeprecationPath.tsx` | `CompareBlockView` — filter messages by `focusedModelId`, hide spacer/synthesis in single mode, full-width column layout; `ChatBlockView` — remove `ml-10`, center with `mx-auto`, hide reviews sidebar |

## Review Findings (6-agent review team)

### Fixed Issues

- **Empty filter fallback**: When `focusedModelId` doesn't match any message, show all messages instead of blank
- **Accessibility**: Added `aria-pressed` and dynamic `aria-label` to toggle button
- **User hint**: Tooltip now says "all models still receive messages" when in single mode
- **Debug console.log**: Removed from ManageModelsBox.tsx
- **Unused import**: Restored `fetchSavedModelConfigChat` in MultiChatDeprecationPath.tsx
- **Query key consistency**: Created `singleChatModeKeys` object (matches `modelConfigChatKeys` pattern)
- **Missing enabled guard**: Added `enabled: !!chatId` to `useSingleChatMode`

### Intentional Design Decisions

- **Messages sent to all models**: Single mode is UI-only filtering — toggling back to multi reveals all responses
- **Dead props on ChatBlockView**: `isSingleChatMode`/`focusedModelId` prefixed with `_` for future implementation
- **No foreign key on `focused_model_id`**: Per project convention ("do not use foreign keys or other constraints")
- **⌘⇧S shortcut**: No conflicts within codebase; minor macOS Safari "Save Page As" overlap handled by `preventDefault`

### Layout Redesign (Critical Fix)

Original implementation just centered and narrowed content with `max-w-3xl mx-auto` on every layer. Redesigned to:

- **MessageSetView wrapper**: Keeps `max-w-3xl mx-auto` (aligns with ChatInput frame of reference)
- **CompareBlockView**: Single column uses `w-full max-w-prose` (no min/max column constraints), spacer hidden, synthesis hidden when only 1 visible model
- **ChatBlockView**: Removes `ml-10` offset, centers with `mx-auto max-w-prose`, hides reviews sidebar
- **UserBlockView**: Centers user messages with `mx-auto max-w-prose` instead of left-aligned `ml-10`

## Known Issues / Future Work

### Pre-existing (not introduced by this PR)

- ESLint warning: `MANAGE_MODELS_SINGLE_CHAT_DIALOG_ID` missing from `useCallback` deps (same pattern used elsewhere)
- `console.log` in MultiChat.tsx line 2309 (`ModelSelector: selecting model`)

### Future enhancements to consider

- **Synthesis toggle**: Bring back synthesis as an experimental feature in settings (currently hidden in single mode). The reviewer consensus is it should be accessible.
- **Focused model naming**: `focused_model_id` stores a model _config_ ID; consider renaming to `focused_model_config_id` for clarity
- **SCHEMA.md**: Needs regeneration to include migration 147 columns and other recent migrations
- **`populateBlock` integration**: Currently all models receive messages even in single mode. Future optimization could send only to the focused model and cache others for multi-mode switch.
- **`renderMessageSet` props**: `isSingleChatMode`/`focusedModelId` are read via hook inside MessageSetView rather than passed from parent — props are currently dead code at that call site but kept for future flexibility

## Verification

- ✅ `pnpm tsc --noEmit` — no errors
- ✅ `pnpm test run` — 8 tests pass
- ✅ `pnpm lint` — 1 pre-existing warning
- ✅ `cargo check --lib` — passes
