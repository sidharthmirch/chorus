# Composer Bar Directive (W6 + W4)

## Layout

```
┌──────────────────────────────────────────────────────┐
│  [Prompt Optimizer Modal — above bar]                │ ← Modal layer
├──────────────────────────────────────────────────────┤
│  [+] [A◯O] [Pick models] [Optimize ✦]  [Send ↵]    │ ← Composer bar
│       └─ avatars (model pills)                       │
└──────────────────────────────────────────────────────┘
```

- **Bar height:** 52px (`padding: 10px 16px 12px`)
- **Toolbar buttons:** 28px tall, 28px wide (icon-only), or pill shaped (with text)
- **Modals above:** Prompt Optimizer (max-height 400px) and Mode selector (300px wide), positioned `bottom: 100%; margin-bottom: 10px`
- **Max-width:** 768px container, centered with 24px margins
- **Backdrop:** Fixed overlay for Manage Models modal

## Component Inventory

### Toolbar (left to right)

1. **Attach button:** `+` icon, 28px circle, `bg-muted`, no text
2. **Model pills:** Inline flex, scrollable area
   - Each pill: 28px tall, `padding: 0 12px`, `bg-muted`, `border-radius: 999px`
   - Content: Two stacked 16px avatars (provider circles overlapped at -6px), model count text "A◯O" (or "2 models")
   - Click: Opens "Manage Models" modal (see model-select.md)
3. **Prompt Optimizer button:** Label "Optimize ✦", `color: accent-500` if open, else muted
   - State: `border: 1px accent-600` + `bg-highlight` when active, else transparent
   - Click: Toggles optimizer modal

### Modals

#### Mode Selector Popover (left of bottom)
- Width: 300px
- Header: "Mode · next message" (10px label)
- Items: List of modes (None, Assist, Critic, Socratic)
  - Each: Icon (◯, ✓, ✕, ?), name, description (11px), checkmark if active
  - Click: Sets message mode, closes popover
- Footer link: "Manage modes…" (routes to `/settings/modes`)

#### Manage Models Modal (W4 contribution)
- **Overlay:** Semi-transparent dark (`background: rgba(0,0,0,0.45)`)
- **Modal:** 680px wide, max-height 82vh, fixed center
- **Header:** "Manage models" title + close button (×)
- **Search:** `⌕ Search models…` (13px placeholder)
- **Two-column layout:**
  - **Left panel (55%):** Model catalog list
    - Checkbox (15px), avatar (18px), model name, auth label (10px monospace), quota bar (58px wide) + percent
    - Hover: `bg-muted`
  - **Right panel (45%):** Selected preview
    - "Selected · N models" header (10px label)
    - Per-selected: card with avatar, name, role badge (main/hidden), profile dropdown
    - Footer hint: "First model is main; the rest answer hidden and fuse on demand…"
- **Bottom:** "Clear all" + "Done" buttons

#### Prompt Optimizer Modal (W6 consumption)
- See `prompt-optimizer.md` for full spec.

## Interactions

### Model Selection (Manage Models Modal)
- **Checkbox toggling:** Toggles model visibility for this chat
- **First selected = main:** Marked with role badge "main", receives artifacts
- **Others = hidden:** answered silently, included in fused response
- **Profile dropdown (per model):** Shows profile name and T value (e.g., "default · t0.7")
  - Click opens Settings › Models to customize
- **Clear all:** Resets selection (all unchecked)
- **Done:** Commits selection, closes modal

### Mode Popover
- Click mode icon or button: Opens popover above composer
- Select mode: Updates active badge, closes popover
- "Manage modes…" link: Routes to Settings › Modes section

### Optimize Button
- Click: Opens Prompt Optimizer modal above (see prompt-optimizer.md)
- Visual state: Border + fill highlight when open

## Copy

**Buttons:**
- "Attach" (title)
- "Optimize ✦" (label)
- "Send" or "↵" (keyboard hint)

**Modals:**
- "Mode · next message" (header label)
- "None" / "Assist" / "Critic" / "Socratic" (mode names)
- "No stance. Raw model, mode off." (None description)
- "Do exactly what's asked. No pushback, no scope creep." (Assist)
- "Attack every claim. Chase every avenue to prove you wrong." (Critic)
- "Custom · answers only with questions until you commit." (Socratic)

**Manage Models:**
- "Manage models" (title + kbd ⌘J)
- "⌕ Search models…" (search placeholder)
- "Selected · 3 models" (header)
- "First model is main; the rest answer hidden and fuse on demand. Profiles come from Settings › Models." (footer hint)
- "Clear all ⌘⇧⌫" (button)

**Model row (catalog):**
- Model name (13px)
- "anthropic oauth · max" (10px auth label, monospace)
- "62% · 3h" (quota label, 9px monospace)
- Role: "main" or "hidden" (10px, color: accent or helper)

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Button heights | 28px | standard 32px buttons | 28px is icon-only size for compact toolbar. OK as-is; use `h-7` class. |
| Modal overlay opacity | `rgba(0,0,0,0.45)` | No explicit overlay style in DESIGN.md | Use this value for fixed overlay; ensure accessible contrast. |
| Search icon | ⌕ | Unicode is platform-specific | Use standard magnifying glass SVG from icon library. |
| Profile dropdown | Inline dropdown pill | No dropdown component defined | Use Popover or Select from shadcn/ui. |

---

**Implementation:** W4 owns ManageModelsBox.tsx presentation; W2 wires artifact panel via callback. Mode selector is independent chat state.
