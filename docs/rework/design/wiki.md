# Wiki Directive (W8) — Obsidian-style Vault

## Purpose

A knowledge management system integrated with an Obsidian vault for statement analysis, research synthesis, and team knowledge building. Users can browse vault file trees, edit notes with [[wikilinks]], view concept graphs, search, and sync with Git.

## Screens & Layouts

### Wiki Main (Multi-view)

```
┌──────────────────────────────────────────────────────────────────┐
│ Wiki                               [Note|Concept|Search|Graph] ◆  │
├──────────────────────┬──────────────────────────────────────────┤
│ Vault Tree           │ Content Panel                            │
│ (left sidebar)       ├──────────────────────────────────────────┤
│ ▾ companies          │ Note view / Concept view / etc           │
│   ▸ NVIDIA.md (22)   │                                          │
│   ▸ TSMC.md (12)     │                                          │
│   ▸ AMD.md (8)       │                                          │
│ ▾ concepts           │                                          │
│   ▸ transformer…(9)  │                                          │
│   ▸ attention.md (4) │                                          │
│ ▾ sources            │                                          │
│   ▸ nvda-10q…(3)     │                                          │
│   ▾ questions        │                                          │
│   ▸ amd-catch…(4)    │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

### Note View

```
┌──────────────────────────────────────────────────────────┐
│ Note                                                     │
├──────────────────────────────────────────────────────────┤
│ companies/NVIDIA.md                                     │
│                                                          │
│ YAML frontmatter:                                       │
│ ┌──────────────────────────────────────────────────────┐│
│ │ type       │ company                               ││
│ │ tags       │ [semiconductors, networking, AI]      ││
│ │ updated    │ 2026-07-21 · by: claude-code         ││
│ │ mcap       │ $4.6T                                 ││
│ │ sector     │ semiconductors                        ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ Note body (Markdown):                                  │
│ NVIDIA Corp — fabless GPU designer…                   │
│ [[CUDA]] ecosystem [[Blackwell architecture]]…        │
│ [[kv-cache]] [[mixture-of-experts]]…                  │
│                                                          │
│ Backlinks (related notes):                             │
│ → TSMC.md (co-dependencies)                           │
│ → CoWoS packaging.md (manufacturing)                  │
│ → HBMI.md (memory supply)                             │
│                                                          │
│ Local graph:                                           │
│ [Graph visualization]                                  │
└──────────────────────────────────────────────────────────┘
```

### Concept View

Similar to Note, but focused on abstract concepts:
- Frontmatter: type: concept, tags: [architectures, attention], updated, etc.
- Body: Definition + related concepts via [[wikilinks]]
- Backlinks: All notes that mention this concept
- Graph: Concept-to-concept edges (when query crosses concept boundaries)

### Search View

```
┌──────────────────────────────────────────────────────────┐
│ Search                                                  │
├──────────────────────────────────────────────────────────┤
│ ⌕ Search vault…                                        │
│ [View results as Graph]                               │
│                                                          │
│ Results (6 matches):                                   │
│ ▸ companies/NVIDIA.md (22 links)                       │
│   …principal dependencies: TSMC (4NP wafers, CoWoS-L)… │
│ ▸ concepts/CoWoS packaging.md (7 links)                │
│   TSMC advanced 2.5D packaging; capacity binding…      │
│ ▸ companies/TSMC.md (12 links)                         │
│   …CoWoS-L capacity doubling through 2026…            │
│                                                          │
│ [Graph view] (render search results as graph)         │
└──────────────────────────────────────────────────────────┘
```

### Graph View (Full & Filtered)

```
┌──────────────────────────────────────────────────────────┐
│ Graph                                                   │
├──────────────────────────────────────────────────────────┤
│ Filter: [Query…]    Legend: [Folder colors…]          │
│                                                          │
│  ┌─ companies (blue)                                    │
│  │   ● NVIDIA ───── ● TSMC ───── ● AMD                 │
│  │        │              │                              │
│  │        └──────┬───────┘                              │
│  │               │                                      │
│  └─ concepts (green)                                    │
│       ● [[CoWoS]] ● [[CUDA]] ● [[HBM]]                 │
│              │          │          │                    │
│      ┌───────┴──────────┴──────────┘                    │
│      │                                                   │
│   ● transformer-arch ───── ● attention ──── ● kv-cache │
│                                                          │
│  ◆ = main/focus node, ○ = concept, ● = company         │
└──────────────────────────────────────────────────────────┘
```

## Component Inventory

### Vault Tree (Left Sidebar, 240px)

- **Structure:** Nested folders + files (expand/collapse)
- **Folder item:** 
  - Icon ▾ (expanded) / ▸ (collapsed)
  - Name (12px)
  - Count badge (10px monospace, right-aligned, gray): "(22)" = 22 backlinks in folder
- **File item:**
  - Icon: Document or concept icon
  - Name (12px)
  - Count badge (10px monospace): "(22)" = backlink count
  - Click: Opens Note/Concept view
- **Styling:** 
  - Normal: `color: --muted-foreground`
  - Hover: `bg-muted`
  - Active: `color: --foreground`, `bg-muted` or `accent` tint (TBD)

### Tabs (Note / Concept / Search / Graph)

- **Location:** Top of content panel (32px height)
- **Buttons:** Outline tabs, 11.5px, mutually exclusive
- **Active tab:** `bg-foreground text-background`, others transparent

### Note/Concept View

#### Frontmatter Properties Table

- **Background:** `bg-muted`, padding 8px 10px
- **Font:** Geist Mono 11px
- **Layout:** Two-column table (key, value)
- **Rows:**
  - type: "company" or "concept" or "note"
  - tags: "[semiconductors, networking]" (linked tags)
  - updated: "2026-07-21 · by: claude-code" (date + editor)
  - (Custom properties per note)

#### Note Body

- **Font:** SF Pro 14px, line-height 1.6
- **Links:** `[[wikilinks]]` rendered as `color: accent-600`, hover underline, click → navigate
- **Formatting:** Standard Markdown (bold, italics, lists, blockquotes, code)

#### Backlinks Section

- **Label:** "Backlinks · related notes" (10px label)
- **List:** Each backlink shows:
  - File path (12px)
  - Context snippet (11px muted, max 60 chars): "…co-dependencies…"
  - Link count (10px monospace): "(4)" = backlink count in target file
- **Click:** Opens target file

#### Local Graph

- **Size:** ~300px wide, 200px tall
- **Nodes:** Main node (accent) + related nodes (muted) + concept nodes (different color)
- **Edges:** Lines between connected nodes
- **Zoom/pan:** Basic (mouse wheel zoom, drag to pan)

### Search View

#### Search Input

- **Placeholder:** "⌕ Search vault…"
- **Live:** Filters results as you type (debounce 300ms)

#### Results List

- **Result row:** File icon + name + snippet + link count
- **Snippet:** First matching line (or surrounding context), with match highlighted in `accent` color
- **Link count:** "(22)" = backlinks in this file
- **Click:** Opens file

#### Graph View Toggle

- **Button:** "View results as Graph" (or icon ◆)
- **Toggle:** Shows results in graph layout instead of list

### Graph View (Full)

#### Legend & Filter

- **Legend:** Folder colors (companies=blue, concepts=green, sources=gray, etc.)
- **Filter input:** "⌕ Filter…" (live search by node label)
- **Active nodes:** Matching filter, rest dimmed (0.3 opacity)

#### Graph Canvas

- **Nodes:**
  - ● (circle, medium): Regular note
  - ◆ (diamond, larger): Main/focus node (clicked or search root)
  - Concept nodes: Specific color per concept type
  - Colors: Folder-dependent (companies blue, concepts green, sources gray)

- **Edges:** Lines between nodes (no arrowheads, undirected graph)
- **Interaction:**
  - Click node: Opens file / focuses graph
  - Drag node: Rearrange layout (local, doesn't persist)
  - Wheel zoom: +/- magnification
  - Drag canvas: Pan

## Interactions

### Tree Navigation
- Click folder arrow (▾/▸): Expands/collapses folder
- Click file: Loads Note/Concept view
- Double-click file: Opens in external editor (Obsidian, if installed)

### Wikilink Clicks
- Click `[[wikilink]]` in note body: Navigates to that note
- If wikilink doesn't exist: Shows "Create new note?" modal

### Backlinks
- Click backlink row: Opens target file

### Search
- Type in search input: Live filters results
- Click result: Opens file
- Click "View results as Graph": Switches graph tab, renders results as subgraph

### Graph Interactions
- Click node: Focus (or already focused if is current note)
- Drag node: Temporarily rearrange (not persisted)
- Filter by typing: Dims non-matching nodes
- Pinch zoom (mobile) / scroll wheel (desktop): Magnify

### Sync (Future)
- Button "Sync with Git" (in header, disabled for now)
- Future: Pulls latest from Git origin, merges changes

## Copy

**Tabs:**
- "Note" / "Concept" / "Search" / "Graph"

**Labels:**
- "Backlinks · related notes" (section header, 10px label)
- "Local graph" (optional header for graph viz)
- "Filter: [Query…]" (graph filter)
- "Legend: [Folder colors…]" (graph legend)
- "View results as Graph" (button/toggle)

**Search:**
- "⌕ Search vault…" (placeholder)

**Frontmatter fields:**
- "type", "tags", "updated", "mcap", "sector", etc. (example keys)

**Results:**
- "(22 links)" = backlink count badge
- "…co-dependencies…" = context snippet

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Graph node size | Varies (main=13px, concept=9px) | No size spec | Use CSS/SVG sizing; main node ~13px radius, concept ~9px. |
| Link color | `color: accent-600` | Quiet Accent Rule | OK; links are *state* (active wikilinks), not decoration. |
| Snippet font | 11px monospace | No 11px in scale | Use `text-xs` (10px) for snippets, accept slight tightness. |
| Local graph height | 200px | No spec | Use 200–300px responsive; auto-height to fit viewport. |
| Folder colors | Blue, green, gray per type | No palette defined | Define custom color map: companies=blue, concepts=teal/green, sources=gray, questions=amber. Add to themes/index.ts as `--vault-company`, `--vault-concept`, etc. |

## Data Model

```typescript
interface VaultFile {
  path: string                         // e.g., "companies/NVIDIA.md"
  folder: string                       // e.g., "companies"
  title: string
  frontmatter: Record<string, any>     // YAML parsed
  body: string                         // Markdown
  wikilinks: string[]                  // [[linked notes]]
  backlinkCount: number                // How many other files link here
  updatedAt: Date
  updatedBy?: string
  gitHash?: string                     // Commit hash if synced
}

interface VaultGraph {
  nodes: VaultNode[]
  edges: VaultEdge[]
}

interface VaultNode {
  id: string                           // File path
  label: string                        // File title
  folder: string
  type: "note" | "concept" | "question" | "source"
  color: string                        // Folder-based or custom
  x: number                            // Layout position (force-directed)
  y: number
}

interface VaultEdge {
  source: string                       // File path
  target: string                       // Linked file path
  label?: string                       // Link text (optional)
}
```

## API Contract (wiki-mcp)

**Endpoints / MCP methods:**

```
GET /vault/files                        // List all files
GET /vault/files/{path}                 // Fetch file + frontmatter
POST /vault/files                       // Create note
PUT /vault/files/{path}                 // Update note (save)
DELETE /vault/files/{path}              // Delete note
GET /vault/graph                        // Full graph (nodes + edges)
GET /vault/search?q=...                 // Search vault
GET /vault/backlinks/{path}             // Backlinks for a file
```

**MCP Special Capabilities:**
- Write access: Create/update files in vault
- Git sync: Commit + push changes
- Wikilink resolution: Resolve `[[mention]]` → file path

---

**Implementation (W8):** Wiki is a knowledge management system. Can start with read-only view (browse + search), iterate to write access + Git sync later. Integration point: agents (Claude Code, Codex) have wiki-mcp write access to save findings.
