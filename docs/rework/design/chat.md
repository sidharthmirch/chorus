# Chat Screen Directive (W6)

## Layout

```
┌─────────────────────────────────────────┐
│ [⊞] Chat title · Mode badge (Assist)   │  ← Header (12px, height 40px)
├─────────────────────────────────────────┤
│                                         │
│  ← Chat scrollable area (max-width 768) │
│  Message 1 (user highlight) ← centered │
│  Message 2 (assist w/ artifacts)       │
│  • Focus View (carousel + view modes)   │
│  • Columns View (3-column grid)         │
│  • Fused View (synthesized + weights)   │
│                                         │
│                                         │
│                       ⿻ (artifact panel)│
└─────────────────────────────────────────┘
```

- **Header:** Fixed, 40px, `padding: 12px 20px`, `border-bottom: 1px solid --border`
  - Left: Breadcrumb (project › chat title), muted-foreground secondary text
  - Right: Mode badge (`✓ Assist · default`), pill-shaped, `bg-muted`, 28px tall
- **Message area:** Flex 1, scrollable, `max-width 768px` centered, `padding: 28px 24px 180px` (bottom padding for composer)
- **Responsive:** On mobile, max-width adjusts; panel group handles side-panel collapse.

## Component Inventory

### Header
- **Project breadcrumb:** `text-sm text-muted-foreground`, monospace for › divider
- **Chat title:** `text-sm text-foreground` (overflowing titles: ellipsis)
- **Mode badge:** Pill `bg-muted text-muted-foreground` with monospace "default" label (10px). Component: new small `Badge` or inline pill div.

### Messages
- **Sender row:** Avatar (18px circle with initials), model name (13px), mode tag (10px monospace, `bg-muted`), auth/tools hint (10px monospace, muted)
- **Sender avatar:** Circle, provider-specific color (from mock: Anthropic `#d97757`, OpenAI `#10a37f`, Google `#4285f4`). Store as `--provider-anthropic`, etc.
- **Message body:** `text-base` (14px), `line-height 1.6`, prose column, nested lists/blockquotes per Markdown.

### Citations (hover card)
- **Inline citation button:** Small pill, font-size 10.5px monospace, `color: accent-600`, `border: 1px --border`, `bg-muted`, `border-radius: 4px`, `padding: 0 5px`
- **Hover card:** Absolute position, 300px wide, `bg-background`, `border: 1px --border`, `border-radius: 10px`, `box-shadow: shadow-diffuse`
  - **PDF citation:** Fake document thumbnail (striped gradient), quote text (12px), link to source.pdf (monospace, `color: accent-500`)
  - **Web citation:** Fake preview (diagonal-stripe pattern), title (12px weight 500), snippet (11.5px muted), link

## Interactions

### View Mode Segmented Control (Focus / Columns / Fused)

**Focus Mode (carousel):**
- Single main answer display, carousel controls (‹ › buttons) to switch between responses
- `carLabel: "1/3"` (monospace 11px)
- Slide transition: `transform: translateX(-33.333%); transition: 0.35s cubic-bezier(0.4, 0, 0.2, 1)`
- **Inside carousel:** 
  - Column 1: Full response text + artifacts (table, entity card)
  - Column 2: Dashed border box, alternative response text
  - Column 3: Dashed border box, alternative response text

**Columns Mode (side-by-side):**
- 3-column grid, equal width (minus gaps)
- Each column: border (model-dependent: main has `accent-600` border, hidden have `--border`)
- Header shows model name, role badge (`main` / `hidden`), footer shows artifact count + cost
- All three visible simultaneously; no tabs needed

**Fused Mode (synthesized):**
- Single container with `border: 1px accent-600`
- Header: `⚭` icon + "Fused response" title + "3 models · graded by Haiku · $0.004" label
- Body: synthesized text with inline highlights (`bg-highlight` span) for key synthesis points
- Footer: "Grading · influence weights" section
  - Per-model row: avatar + model name + horizontal bar (width = weight %) + score badge + note
  - Example: `A · Claude Sonnet 4.5 · [████ 46%] · 92 · structure, tables, citations`

### Message Stance Selector
- **UI:** Mode indicator in composer (see composer.md); displayed as icon + name in header mode badge
- **Stances:** None (raw), Assist (✓ default), Critic (✕), Socratic (? custom)
- **Per-message application:** Shown in sender row as `✓ assist` label (10px monospace, `border: 1px --border`, `padding: 1px 5px`)

### Artifact Trigger
- **Within message:** Code blocks with `language: html|svg|xml` get inline "Open preview" button (CodeBlock.tsx addition)
- **⿻ button:** Floats in artifact container header, opens side panel (see artifacts.md)

## Copy

**Header labels:**
- "▤ LangAlpha Research › NVDA earnings deep dive" (project › chat)
- "✓ Assist · default" (mode badge)

**Sender labels:**
- "Claude Sonnet 4.5" (model name)
- "✓ assist" (stance badge — could be ✕ critic, ? socratic)
- "oauth · financial-lookup tools" (hints, optional)

**View mode tabs:**
- "Focus", "Columns", "⚭ Fused"

**Carousel controls:**
- "‹ 1/3 ›" (navigation)

**Citation buttons:**
- "10-Q · p.34" (PDF), "reuters.com" (web link)

**Artifact headers:**
- "Data-center revenue, quarterly" (title)
- "interactive" or "dataframe · 4×4" or "draft · uncommitted" (artifact type badge)
- "src: 10-Q × 8" (source hint, monospace)

**Fused footer:**
- "Grading · influence weights" (section label)
- "structure, tables, citations" (per-model note)

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Sender font size | 13px | `text-sm` (12px) | Use 12px; accept minor density loss. |
| Citation font | 10.5px | No 10.5px in scale | Use `text-xs` (10px) for both button and body. Slight tightness acceptable. |
| Mode badge height | 28px | No defined badge height | Define as new size or use pill `h-7` (28px); `padding-y: 4px` ensures fit at 12px text. |
| Artifact type badge color | `color: --ok` (green) for "interactive" | No status-ok token yet | Add `success` token per OVERVIEW.md; use for active/interactive state indicators. |

---

**Implementation notes:**
- W2 owns Focus/Columns/Fused view mode logic and carousel state in MultiChat.tsx
- Artifact side panel wiring via callback prop (see artifacts.md)
- Citation hover card is a pure UI pattern; no server state needed
