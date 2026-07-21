# W0: Design Extraction Overview

## Design Inventory

The Chorus Remake.dc.html design file contains four primary surfaces, mapped below to current Chorus architecture and workstream consumption.

| Surface | Current Chorus | Workstream | File |
|---------|----------------|-----------|------|
| **Chat** (view modes, stances, citations) | `MultiChat.tsx` | W6 | `chat.md` |
| **Composer** bar | `ChatInput.tsx` | W6 (mounts W4 popover) | `composer.md` |
| **Prompt Optimizer** modal | N/A (new feature) | W6 | `prompt-optimizer.md` |
| **Artifact Side Panel** | N/A (new) | W2 | `artifacts.md` |
| **Settings** (12 tabs → 5 sections) | `Settings.tsx` monolith | W3 | `settings.md` |
| **Model Select** (popover + Models rows) | `ManageModelsBox.tsx` | W4 | `model-select.md` |
| **Accounts / provider OAuth + quotas** | N/A (API keys only today) | W1 | `accounts-oauth.md` |
| **Fleet** (board + worktrees) | N/A (new surface) | W7 | `fleet.md` |
| **Wiki** (Obsidian vault) | N/A (new surface) | W8 | `wiki.md` |
| **Sidebar** (sessions cluster, wiki nav) | `AppSidebar.tsx` | W7 + W8 insertions | see `fleet.md` / `wiki.md` |

## Design Notes (from the mock)

The designer's intent statements from lines 1126–1131:

> **3 chats** in the sidebar show different artifact palettes: NVDA (chart/table/entity), wiki rewrite (note draft + relink queue + local graph), fleet build (live preview + code + handoff).
>
> **⿻ opens artifacts in a side panel** (Claude-style split) — chat keeps scrolling on the left.
>
> **Focus / Columns / Fused** segmented control in the NVDA chat header previews all three multi-model treatments incl. weights.
>
> **Fleet** is our own board (fleetd, paseo-compatible) — kanban via sidebar "board →" or the handoff button.
>
> **Wiki = Obsidian vault** (statement-analysis): file tree, frontmatter properties, [[wikilinks]], backlinks, git sync.

## Design Token Vocabulary

### Color Tokens (CSS Variables in Mock)

The mock defines a custom token system that must map to Chorus `DESIGN.md` tokens. Mapping:

| Mock Variable | Mock Value (Dark) | Mock Value (Light) | DESIGN.md Token | Purpose |
|---------------|-------------------|-------------------|-----------------|---------|
| `--bg` | `#1c1a17` | `#ffffff` | `--background` | Canvas background |
| `--card` | `#22201d` | `#ffffff` | `--background` (same as bg in design) | Card/message container |
| `--sb` | `#252220` | `#fdfdfa` | `--sidebar-background` | Sidebar surface |
| `--fg` | `#fafaf7` | `#292524` | `--foreground` | Primary text |
| `--mfg` | `#bfbab5` | `#6e6862` | `--muted-foreground` | Secondary text |
| `--helper` | `#948d84` | `#bfbab5` | `--helper` (existing token) | Tertiary/helper text |
| `--bd` | `#3e3b37` | `#edeae8` | `--border` | Primary border |
| `--bd2` | `#514d48` | `#ddd9d4` | `--border` (stronger) | Secondary border |
| `--mut` | `#2b2825` | `#f6f6f3` | `--muted` | Muted fill (hover bg) |
| `--hl` | `#5c4a38` | `#f8f2ec` | `--highlight` | NEW token (design intent: warm highlight fill) |
| `--hlfg` | `#f8f2e9` | `#6a5442` | `--highlight-foreground` | NEW token (text on highlight) |
| `--acc` | `#cda174` | `#b0885f` | `accent-500` / `accent-600` | Accent (varies by mode) |
| `--acc2` | `#b0885f` | `#8a6a48` | `accent-600` / `accent-700` | Accent darker |
| `--ok` | `#7fae7f` | `#4e8a52` | **NEW** `success` | Success / active state |
| `--warn` | `#d1a35d` | `#b07f36` | **NEW** `warning` | Warning / caution state |
| `--err` | `#e0705f` | `#d05045` | `destructive` (existing — do not add third red) | Error / destructive state |

### Typography

Fixed scale (no `13.5px`, `11.5px`, `12.5px` arbitrary sizes):

| Mock Size | Intent | DESIGN.md Mapped | Notes |
|-----------|--------|-----------------|-------|
| 10px | Micro-labels, monospace | `label` (10px, Geist Mono) | Uppercase, 0.6px tracking — matches `.sidebar-label` exactly |
| 11px, 11.5px | Dense UI labels, monospace | Needs `text-xs` (10px) OR `text-sm` (12px) | **DEVIATION**: mock uses 11–11.5px; DESIGN.md has no 11px. Resolve to 10px or 12px per context. |
| 12px, 12.5px | Small UI text, body on chips | `small` (12px) | OK, within spec. |
| 13px, 13.5px | Prominent labels (e.g., model names, chat headers) | `base` (14px) | **DEVIATION**: 13–13.5px → 14px. Hierarchy impact: labels gain weight. |
| 14.5px | Main message text | `base` (14px) | Close; 14.5 → 14. Minor loss of breathing room. |
| 15px, 16px | Headers, section titles | `title` (16px) | Aligned with `text-lg`. |

**Resolution:** Adopt the fixed scale from `DESIGN.md`. The mock's sub-12px and 13–14.5px sizes reflect a higher-density design than Chorus's 10/12/14/16 grid; accept this difference for consistency with the system.

### Radius Tokens

Mock does not use explicit radius values; typical values are:
- `border-radius: 4px` on inputs, citations, badges
- `border-radius: 6px` on many UI elements
- `border-radius: 8px` on buttons, cards
- `border-radius: 12px` on artifacts, large containers
- `border-radius: 999px` (rounded pills) on mode/model selector buttons

These align with `DESIGN.md` rounded set: `xs/sm 4px`, `md 6px`, `lg 8px`, `xl 12px`. **No deviations; use as-is.**

### Spacing

Mock uses `4px`, `8px`, `12px`, `16px`, `24px` gaps and padding — matches `DESIGN.md` spacing: `xs 4px`, `sm 8px`, `md 16px`, `lg 24px`. **Aligned; no new tokens needed.**

### NEW Semantic Status Tokens Required

Three colors appear in the mock that have no equivalent in current DESIGN.md:

1. **`--ok` / `success`** (green): `#7fae7f` dark, `#4e8a52` light
   - Usage: active pulse dot, progress bar fill, "✓" checkmarks, quota OK, model selected
   
2. **`--warn` / `warning`** (amber): `#d1a35d` dark, `#b07f36` light
   - Usage: "awaiting review" badges, quota warning (84%), paused states
   
3. **`--err` / `destructive`** (red): `#e0705f` dark, `#d05045` light
   - Usage: ratio underperformance (0.2× AMD), destructive actions
   - Note: distinct from `--destructive` (signal red `#ea4334`); this is warmer and more muted

**Action (binding, per W1 P1):** add `success` + `warning` to `src/ui/themes/index.ts` (both themes) and expose via `tailwind.config.cjs`; the mock's `--err` maps to existing `destructive`.

### Shadow

Mock defines `--shadow: 0 8px 30px rgba(0,0,0,.45)` (dark) and `0 8px 30px rgba(40,30,20,.12)` (light). This aligns with `DESIGN.md` `shadow-diffuse` for floating surfaces (popovers, modals). Reuse existing token; no new shadow needed.

## Responsive Behavior & Collapsibility

- **Sidebar:** Resizable (250–300px typical); collapses to icon-only in narrow viewports.
- **Chat main:** Flex, min-width 0 to allow overflow.
- **Artifact panel:** Opens as right third panel via ResizablePanelGroup; closes via button or keyboard.
- **Settings:** Sidebar navigation + main content panel (ResizablePanelGroup-style split for wider screens).
- **Fleet board:** Kanban columns scroll horizontally on small screens; machines footer is sticky.

## Deviations Summary

| Area | Deviation | Resolution |
|------|-----------|-----------|
| Typography scale | Mock uses 13–14.5px; design uses 14px. Also 11–11.5px vs 10/12 grid. | Apply DESIGN.md fixed scale (10/12/14/16); accept minor density trade-off. |
| Color tokens | Mock defines `--ok`, `--warn`, `--err` status colors; DESIGN.md has only `--destructive`. | Add three new semantic tokens to `themes/index.ts`. |
| Accent use | Mock's accent ramp (`--acc`, `--acc2`) is used heavily (highlights, model chips, fused response border). DESIGN.md "Quiet Accent Rule" limits to <10% screen. | The mock's design intent (warmth, model identity via color) is preserved; scale the accent saturation per site analysis in implementation. |

## Workstream & Merge Order

Per `00-ARCHITECTURE.md` §9 merge order: **W1 → W2 → W4 → W6 → W3 → W7 → W8**
(W7/W8 may land earlier; W0 docs anytime).

- **W1 (Provider OAuth + quotas)** consumes: `accounts-oauth.md`, `settings.md` (Accounts section).
- **W2 (Artifacts)** consumes: `artifacts.md` (+ `chat.md` artifact triggers).
- **W4 (Model select)** consumes: `model-select.md`, `composer.md` (model popover).
- **W6 (Chat rework)** consumes: `chat.md`, `composer.md`, `prompt-optimizer.md`.
- **W3 (Settings)** consumes: `settings.md` (mounts W1/W4/W6-backed sections).
- **W7 (Fleet)** consumes: `fleet.md`.
- **W8 (Wiki)** consumes: `wiki.md`.

**Status-token naming (binding):** the mock's `--ok`/`--warn` land as
`success`/`warning` in `src/ui/themes/index.ts` (added once by W1 P1, both
themes, exposed via Tailwind). The mock's `--err` maps to the existing
`destructive` token — do not add a third red.

---

Next files detail each surface in full directive format.
