# Prompt Optimizer Directive (W6)

## Purpose

A modal dialog that rewrites user prompts for specific use cases (just-chat, hand-to-agent, plan-first) and model sets (chat trio, coding, fast/cheap). Intent: improve output quality by structuring vague prompts into well-formed requests with clear context, requirements, and acceptance criteria.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ✦ Optimize prompt              [Structured|Before/After] [×] │
├──────────────────────────────────┬──────────────────────────┤
│  Input (left, 50%)               │  Output (right, 60%)    │
├──────────────────────────────────┼──────────────────────────┤
│ Your prompt · natural language   │ Optimized · [label]     │
│ ok                               │                         │
│ make me a dashboard for the      │ <role>                  │
│ fleet agents, live status, logs, │ Senior frontend eng...  │
│ should look like the rest of the │ </role>                 │
│ app, react                       │ <context>               │
│                                  │ Fleet daemon exposes... │
│ Intent                           │ </context>              │
│ ○ Just chat                      │ ...                     │
│ ◎ Hand to agent — build [hint]   │                         │
│ ○ Plan first                     │ [⧉ copy] [use ↵]       │
│                                  │                         │
│ Curate for · model set           │                         │
│ [Chat trio] [Coding] [Fast/cheap]│                         │
│                                  │                         │
│ [A] Sonnet [O] GPT [G] Gemini ☐  │                         │
│                                  │                         │
│ Output style adapts per model…   │                         │
└──────────────────────────────────┴──────────────────────────┘
```

- **Modal:** 100% width on mobile, 1000px+ on desktop
- **Height:** Max-height 400px (content scrolls)
- **Left panel:** 50% width, input section
- **Right panel:** 60% width, output section (wider because of code/XML display)
- **Tab toggle:** "Structured" (default) | "Before / After" (side-by-side comparison view)

## Component Inventory

### Input Panel (Left)

1. **Your Prompt**
   - Label: "Your prompt · natural language ok" (10px monospace label)
   - Display: Readonly box showing user's raw prompt
   - Background: `bg-muted`, padding 10px, 13px line-height, word-wrap

2. **Intent Section**
   - Label: "Intent" (10px monospace)
   - Radio buttons (custom, 12px × 12px):
     - "Just chat" (light touch)
     - "Hand to agent — build" (adds acceptance criteria) — default selected
     - "Plan first" (asks before specifying)
   - Click: Updates `optTarget` state, re-optimizes

3. **Model Set Section**
   - Label: "Curate for · model set" (10px monospace)
   - Pill buttons (rounded 999px, 11.5px):
     - "Chat trio" (default)
     - "Coding"
     - "Fast / cheap"
   - Hover: Border color shifts to `accent-600`
   - Click: Updates `optSet`, re-renders `optModels`

4. **Per-Model Toggles**
   - Label: None (implicit from parent section)
   - Items: Circular model badges (14px diameter) with optional ☐ checkbox overlay (right-aligned)
   - Unchecking a model: Grays it out (opacity 0.6), sets `optOff[key]` to true
   - Helper text: "Output style adapts: XML sections for Claude, markdown headers for GPT, terse bullets for Gemini." (10.5px, muted)

### Output Panel (Right)

#### Structured View (default tab)

- **Header row:** "Optimized · [label]" + copy/use buttons
  - Label: "sonnet-curated" or "chat-trio · 3 models" (10px monospace, muted)
  - Buttons: "⧉ copy" (outline), "use ↵" (filled primary)

- **Content:** XML-style structured prompt
  - Font: Geist Mono, 11.5px
  - Line-height: 1.7
  - Colors: Tags in `accent-600`, content in muted-foreground, same as code block
  - Structure (example):
    ```xml
    <role>
    Senior frontend engineer inside the Chorus (Tauri + React 18) codebase.
    </role>
    <context>
    Fleet daemon exposes GET /sessions → id, agent, machine, status, log tail.
    Design tokens: src/ui/themes/index.ts.
    </context>
    <requirements>
    Route /agents · live status ≤2s stale · virtualized logs >5k lines · reuse sidebar list + pill components.
    </requirements>
    <acceptance>
    50 sessions <16ms/frame · socket reconnect · light+dark · zero new deps.
    </acceptance>
    ```
  - Background: `bg-muted`, padding 12px 14px, border-radius 8px, overflow auto

#### Before / After View (alt tab)

- **Before section:**
  - Label: "before" (9.5px monospace, uppercase, muted)
  - Box: `bg-muted`, padding 10px 12px, 12.5px line-height, user's original prompt
  - No scroll (fixed height)

- **Divider:** "↓ ✦" (centered, 13px, muted, padding 8px 0)

- **After section:**
  - Label: "after · claude-curated" (9.5px monospace, uppercase, accent-600)
  - Box: `border: 1px accent-600`, padding 10px 12px, 12.5px line-height, optimized prompt
  - Formatted as natural prose (not XML), tailored to primary model

## Interactions

### Modal Opening
- Click "Optimize ✦" button in composer bar
- Modal appears above composer with fadeUp animation (0.18s ease)

### Modal Closing
- Click close button (×) in header, or Escape key
- Clears state, returns focus to composer

### Intent Selection
- Click radio button: Sets optTarget, state triggers re-render (API call or local recomputation)
- Visual: Selected radio has filled dot, label weight 500

### Model Set Selection
- Click pill button: Sets optSet, re-initializes optModels list
- Visual: Selected pill has `bg-highlight text-highlight-foreground`, others transparent

### Per-Model Toggle
- Click checkbox on model badge: Sets optOff[setIndex][modelIndex]
- Visual: Unchecked model badge fades (opacity 0.6), border changes to `--border`
- Behavior: Output re-optimizes if enabled (fewer models = shorter output)

### Tab Switching
- Click "Structured" / "Before / After" button
- Switches view, preserves state

### Copy to Clipboard
- Click "⧉ copy" button
- Copies optimized prompt text to clipboard
- Toast: "Copied to clipboard"

### Use Prompt
- Click "use ↵" button
- Closes modal, pastes optimized prompt into composer input
- User can send or further edit

## Copy

**Header:**
- "✦ Optimize prompt" (title)
- "function · not a mode" (subtitle, 10px label)

**Input labels:**
- "Your prompt · natural language ok"
- "Intent"
- "Curate for · model set"

**Intent options:**
- "Just chat" + "(light touch)"
- "Hand to agent — build" + "(adds acceptance criteria)"
- "Plan first" + "(asks before specifying)"

**Model set names:**
- "Chat trio"
- "Coding"
- "Fast / cheap"

**Model set description:**
- "Output style adapts: XML sections for Claude, markdown headers for GPT, terse bullets for Gemini." (helper text)

**Output labels:**
- "Optimized · [curated label]"
- "⧉ copy" (button)
- "use ↵" (button)

**Before/After labels:**
- "before"
- "after · claude-curated"

**Example optimized outputs:**

*Structured (Claude):**
```xml
<role>
Senior frontend engineer inside the Chorus (Tauri + React 18) codebase.
</role>
<context>
Fleet daemon exposes GET /sessions → id, agent, machine, status, log tail. Design tokens: src/ui/themes/index.ts.
</context>
<requirements>
Route /agents · live status ≤2s stale · virtualized logs >5k lines · reuse sidebar list + pill components.
</requirements>
<acceptance>
50 sessions <16ms/frame · socket reconnect · light+dark · zero new deps.
</acceptance>
```

*Before/After (natural):**
```
Build an agent-fleet dashboard page for the existing Chorus app (Tauri + React 18). 
Data: fleet daemon GET /sessions — id, agent, machine, status, log tail. Match tokens 
in src/ui/themes; reuse sidebar list + pill components. Live status ≤2s stale; virtualize 
logs past 5k lines. Acceptance: 50 sessions under 16ms/frame, socket reconnect, light+dark, 
zero new deps.
```

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Modal width | 680px–1000px responsive | No modal size spec | Use 1000px max on desktop, 92vw on mobile. |
| Panel width ratio | 50% / 60% (asymmetric) | No layout spec | OK; right panel wider to accommodate code/XML. |
| Tab button styling | Segmented control (border, toggle) | No tab spec in DESIGN.md | Use standard Button component with toggle state (outlined / filled). |
| XML color scheme | Tags in accent-600 | XML not shown elsewhere | Use code block syntax highlighting (Atom One Light/Dark). |

## State Model

```typescript
interface OptimizerState {
  optimizerOpen: boolean           // Modal visibility
  optView: "structured" | "stacked" // Tab selection
  optTarget: 0 | 1 | 2             // 0: just-chat, 1: hand-to-agent (default), 2: plan-first
  optSet: 0 | 1 | 2                // 0: chat-trio (default), 1: coding, 2: fast-cheap
  optOff: Record<string, boolean>  // optOff[`${setIndex}-${modelIndex}`]: true if unchecked
}
```

## API Contract (if server-side optimization)

**Optional:** If optimization is done client-side (heuristics), no API needed. If calling Claude or another model to optimize:

```typescript
POST /api/optimize-prompt
{
  userPrompt: string
  intent: "just-chat" | "hand-to-agent" | "plan-first"
  modelSet: "chat-trio" | "coding" | "fast-cheap"
  activeModels: string[]           // e.g., ["sonnet", "gpt"]
}

Response:
{
  optimized: string                // Optimized prompt (XML or prose)
  format: "xml" | "prose"
}
```

---

**Implementation (W6):** Standalone feature. Can be client-side heuristic-based or call backend optimizer service. No data persistence needed.
