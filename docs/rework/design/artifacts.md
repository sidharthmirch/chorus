# Artifact Side Panel Directive (W2)

## Layout

```
┌─────────────────┬──────────────────────────────┐
│  Chat scroll    │  Artifact Panel               │
│  (left panel)   ├──────────────────────────────┤
│  • Message 1    │  [⊗] Panel title      [≡ ⤢] │ ← Header (40px)
│  • Message 2    ├──────────────────────────────┤
│    ⿻ opens     │  Preview | Code   [v3 of 5]  │ ← Tabs (32px)
│    • [...]      ├──────────────────────────────┤
│                 │                              │
│                 │  [Preview | Code content]    │ ← Content (scrollable)
│                 │  • iframe (Preview)          │
│                 │  • <code> block (Code)       │
│                 │  • virtualized log output    │
│                 │                              │
│                 │                              │
│                 ├──────────────────────────────┤
│                 │  [Copy] [Download] [⤢]      │ ← Footer (40px)
│                 └──────────────────────────────┘
```

- **Panel mount:** Third ResizablePanel in MultiChat's ResizablePanelGroup (similar to RepliesDrawer)
- **Width:** Collapsible, ~35–40% of chat width typical
- **Header:** 40px, `padding: 10px 14px`, `border-bottom: 1px --border`
  - Left: Model pill (avatar + name), title
  - Right: Version stepper, action buttons (copy, download, fullscreen, close)
- **Tabs:** 32px, `padding: 4px`, `border-bottom: 1px --border` (Preview / Code tabs)
- **Content area:** Scrollable, `flex: 1; min-height: 0`
- **Footer:** 40px, optional, for action hints or metadata

## Component Inventory

### Header

- **Close button (⊗):** Icon, no label, `color: muted-foreground`, hover highlight
- **Title:** 13px bold, model name prefix (optional): "Data-center revenue, quarterly"
- **Model pill:** Small avatar (16px) + model name (12px), inline
- **Version stepper:** Monospace 11px, `color: helper`, format "v3 of 5"
  - Buttons: ‹ › arrows (24px wide, 24px tall)
  - Center: Read-only label

### Tabs

- **Tab button:** 11.5px, 4px radius, transparent bg (unselected), full text (Preview/Code)
- **Active tab:** `bg-foreground text-background` (inverted)
- **Inactive tab:** `color: muted-foreground`, hover: `bg-muted`

### Content Panels

#### Preview Tab
- **HTML/SVG artifacts:** `<iframe srcdoc="...">` with sandbox attributes
  - Sandbox: `allow-scripts allow-forms` (NOT `allow-same-origin`)
  - CSP injected in iframe head: default-src restricted, script-src 'unsafe-inline', img-src data: blob:
- **Widget artifacts (React, live components):** Virtual DOM rendered in isolated component wrapper
- **Mermaid/graph artifacts:** Rendered canvas or SVG container

#### Code Tab
- **Raw source display:** `<pre><code>` block, monospace font (user preference)
- **Syntax highlighting:** Atom One Light/Dark theme (per DESIGN.md)
- **No line numbers** (design shows raw code block only)
- **Copy to clipboard:** Inline button or context menu

### Footer (Optional)

- **Metadata:** Source, toolset used, branch/repo info
  - Example: "src: 8 × 10-Q (local pdf) · tool: financial-lookup" (11px monospace, muted)
  - Example: "fleetd · m4-mini · branch feat/agents-dash" (11px monospace, muted)
- **Action buttons:** Export, Open vault, Open repo

### Per-Chat Artifact Palettes (UX Note)

Three chat examples show different artifact contexts:

1. **NVDA analysis chat:**
   - Artifacts: interactive chart (SVG), data table (HTML), entity card (HTML)
   - Panel shows: "chart" | "table" | "entity" tabs OR versioning (v1 of 3)

2. **Wiki rewrite chat:**
   - Artifacts: draft note (Markdown + frontmatter), relink queue (interactive list), local knowledge graph
   - Panel shows: "Note draft" | "Relink queue" | "Graph" tabs

3. **Fleet build chat:**
   - Artifacts: live component preview (React), code (TypeScript), agent handoff link
   - Panel shows: "Preview" | "Code" tabs + handoff action

**For now (W2 v1):** All artifacts use Preview/Code tabs. Future enhancement (post-v1, W6 fused outputs) may add context-specific tabs per domain/artifact kind.

## Interactions

### Opening the Panel

- **Trigger 1:** ⿻ button in artifact container (see chat.md)
- **Trigger 2:** "Open preview" button in CodeBlock (renderers/CodeBlock.tsx)
- **Trigger 3:** Auto-open on artifact arrival (settings-gated, default on)

### Version Navigation

- **Arrow buttons (‹ ›):** Cycle through available versions
  - Versions = ordered list of artifacts across selected messages in chat
  - Regeneration appends, never overwrites (immutable log)
- **Auto-select:** Newest version on arrival
- **Label:** "v3 of 5" (read-only, no typing)

### Tab Switching

- **Click tab:** Switches between Preview and Code views
- **State:** Persists during panel lifetime (session-scoped)

### Closing Panel

- **Close button (⊗):** In header, collapses panel
- **Also:** User drags panel resize to 0, or panel auto-closes on new message (setting-dependent)

### Copy / Download

- **Copy button:** Copies artifact code to clipboard; toast confirmation
- **Download button (.html):** Exports as standalone HTML file (Tauri file dialog)
- **Open in new window:** Launches detached Tauri WebviewWindow with artifact

## Copy

**Header labels:**
- "Data-center revenue, quarterly" (artifact title)
- "v3 of 5" (version stepper)

**Tabs:**
- "Preview"
- "Code"

**Buttons:**
- "⊗" (close, title: "Close artifact panel")
- "‹" "›" (navigation, title: "Previous version / Next version")
- "⧉" (copy, title: "Copy to clipboard")
- "⤢" (fullscreen, title: "Open in new window")
- "↓" (download, title: "Download as .html")

**Footer text:**
- "src: 8 × 10-Q (local pdf) · tool: financial-lookup"
- "fleetd · m4-mini · branch feat/agents-dash"

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Iframe sandbox combo | `allow-scripts allow-forms` | No explicit sandbox spec | Use this combo; document in code comment that `allow-same-origin` is NOT used (security risk). |
| Panel width | ~35–40% | No defined panel width | ResizablePanel default is fine; set `defaultSize={35}` as preference. |
| Action buttons size | 28px icon buttons | Standard 32px | Use `h-7 w-7` for icon-only buttons (28px). Compact is OK in panels. |
| Version label | "v3 of 5" | No versioning spec | This is new UI; define as `text-xs monospace`. |

---

**Implementation notes:**
- W2 owns ArtifactPanel component and extraction logic (src/core/chorus/artifacts/extract.ts)
- MessageMarkdown.tsx gains `onArtifactDetected` callback (optional prop)
- MultiChat mounts panel as third ResizablePanel; manages open/close state and version list
- Sandboxing via iframe srcdoc is security-critical; CSP injection is mandatory
