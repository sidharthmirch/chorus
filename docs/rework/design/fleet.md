# Fleet Directive (W7) — fleetd Board + Worktrees

## Purpose

A kanban-based task board for managing multi-agent work: autonomous agents (Claude Code, Codex, etc.) execute features broken into tickets, with live status tracking, cost monitoring, and supervisor merge workflows. "Fleet" is Chorus's own coordination protocol (paseo-compatible); separate from chats.

## Screens & Layouts

### Fleet Board View (Primary)

```
┌─────────────────────────────────────────────────────────────────┐
│ Fleet                                                    [Board|Tree]
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Kanban (4 columns, horizontally scrollable on mobile)          │
│                                                                   │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│ │ Queued   │  │ Running  │  │Needs     │  │ Merged   │         │
│ │ ● 2      │  │ ● 2      │  │Review ● 1│  │ ● 2      │         │
│ ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤         │
│ │ Card 1   │  │ Card 1   │  │ Card 1   │  │ Card 1   │         │
│ │ [→]      │  │ [P]      │  │ [→]      │  │ [✓]      │         │
│ │ …        │  │ [■ 72%]  │  │ [+N −M]  │  │ (merged) │         │
│ │ queued   │  │ ▸ log…   │  │ awaiting │  │ …        │         │
│ │          │  │          │  │ you      │  │          │         │
│ │ Card 2   │  │ Card 2   │  │          │  │ Card 2   │         │
│ │ [→]      │  │ [P]      │  │          │  │ [✓]      │         │
│ │ …        │  │ [■ 31%]  │  │          │  │ (merged) │         │
│ │ queued   │  │ ▸ log…   │  │          │  │ …        │         │
│ └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Cost presets: [Economy] [Balanced] [Max quality]                │
│ Models: Planner [A Sonnet]  Worker [A Sonnet]  Supervisor [A…] │
│                                                                   │
│ m4-mini (2/2) · hetzner-01 (1/4) · gpu-box (0/1)               │
│                                                                   │
│ ▸ drag cards between columns to dispatch                        │
└─────────────────────────────────────────────────────────────────┘
```

### Fleet Worktrees View (Secondary)

Tree view showing feature branches and ticket worktrees:

```
┌─────────────────────────────────────────────────────────────────┐
│ Fleet                                                    [Board|Tree]
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ▾ feat/agents-dash (building · 2/3 merged)                     │
│   ▾ wt/agents-dash/t101 (merged ✓)                             │
│   ▸ wt/agents-dash/t102 (merged ✓)                             │
│   ▸ wt/agents-dash/t103 (64% · 12m) [● Worker]                 │
│   └─ Supervisor: idle — spawns when T-103 lands                │
│                                                                   │
│ ▾ fix/oauth-refresh (supervising)                               │
│   ▸ wt/oauth-refresh/t201 (awaiting merge) [● Worker]          │
│   ▸ wt/oauth-refresh/t202 (awaiting merge) [● Worker]          │
│   └─ Supervisor: ● reviewing now — diffing, merging up         │
│                                                                   │
│ Machines: m4-mini (2/2) · hetzner-01 (1/4)                      │
│                                                                   │
│ ▸ ticket worktrees merge up to feature; supervisor merges      │
│   feature → main                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Inventory

### Kanban Board (Board View)

**Column (4 columns: Queued, Running, Needs Review, Merged):**
- Header: Column name + status dot (color-coded) + count badge (10px monospace)
- Body: Scrollable list (vertical), gap 8px
- Bottom: Drop zone (visual hint on hover)

**Card anatomy (per task/job):**
- **Header row (sticky):** 
  - Agent avatar (16px, provider color) + agent name (12px)
  - Branch name (11px monospace, muted)
  - [→] dispatch button (if Queued/Running, small icon)
  - [P] pause button / [●] active indicator
- **Progress bar** (if Running/Needs Review):
  - 4px tall, full width, `bg-muted` with fill % in `success` (running) or `warning` (needs review)
  - Label: "72%" or "100%" (11px monospace, right-aligned)
- **Log line** (if Running):
  - Example: "▸ RefreshScheduler.test.ts 41/44" (12px monospace, muted)
  - Truncated, single line
- **Meta row:**
  - "queued 4m" (11px monospace, time-colored: fresh green → yellow → gray as time passes)
  - OR: "12m · $0.84" (Running) cost
  - OR: "+412 −38" (Needs Review) diff size
- **Review badge** (if Needs Review):
  - Small badge "awaiting you" (11px, muted)

**Drag & drop:**
- Drag card between columns to move task status
- On drop: Update task state (e.g., Queued → Running sends dispatch signal)

### Cost Presets Section

**Buttons (3 pill buttons, mutually exclusive):**
- "Economy" (default in first preset)
- "Balanced" (default active in mock)
- "Max quality"
- Styling: Outline border if inactive, filled if active

**Role chips** (3 rows, read-only description):
| Role | Model | Note |
|------|-------|------|
| Planner | [A] Sonnet 4.5 | Splits a feature into tickets; sizes each one. |
| Worker · per ticket | [A] Haiku 4.5 | One per ticket, isolated in its own worktree. |
| Supervisor · on demand | [A] Sonnet 4.5 | Spawned when tickets land: reviews diffs, merges up, exits. |

**Cost estimate** (below chips):
- "est $0.40–0.90 per feature · lint/test passes fall back to local qwen3 (free)"
- OR: "est $1.50–3.00 per feature · quota-aware: falls to GPT-5.2 when Anthropic meter > 90%"

### Machines Strip

- **Layout:** Horizontal scrollable or wrapped list
- **Each machine card:** 
  - Name (12px): "m4-mini"
  - Status dot (● green if online, gray if idle): "2/2" load (11px monospace)
  - Hover: Show CPU/memory gauge (future)

### Footer Hint

- Column-dependent text:
  - Board view: "drag cards between columns to dispatch"
  - Worktrees view: "ticket worktrees merge up to feature; supervisor merges feature → main"

## Interactions

### Kanban Drag & Drop
- **Drag card:** From one column to another
- **On drop:** 
  - POST to fleetd API with new status
  - Card animates to target column
  - If error, card returns to original column + error toast

### Cost Preset Selection
- Click preset pill
- Updates roleChips display (shows models for selected preset)
- Updates costEst text
- No persistent change (future: save user's default preset)

### Machine Selection (Future)
- Click machine card (currently read-only)
- Future: Shows machine details or allows filtering tasks by machine

### Task Card Actions
- **Pause/resume:** Click [P] or [●] button (only on Running cards)
  - Sends pause signal to fleetd
  - Card shows "paused" state, progress freezes
- **Dispatch:** Click [→] button (only on Queued cards)
  - Opens machine selector popover
  - Pick machine, confirm
  - Card moves to Running

### Tab Switching (Board ↔ Worktrees)
- Buttons at top: "Board" | "Worktrees"
- Click: Switches between views, preserves scroll position

## Copy

**Column headers:**
- "Queued" (with dot + "2" count)
- "Running" (with dot + "2" count)
- "Needs review" (with dot + "1" count)
- "Merged" (with dot + "2" count)

**Cost presets:**
- "Economy", "Balanced", "Max quality"

**Role descriptions:**
- "Planner" + "Splits a feature into tickets; sizes each one."
- "Worker · per ticket" + "One per ticket, isolated in its own worktree."
- "Supervisor · on demand" + "Spawned when tickets land: reviews diffs, merges up, exits."

**Cost estimates:**
- "est $0.40–0.90 per feature · lint/test passes fall back to local qwen3 (free)"
- "est $1.50–3.00 per feature · quota-aware: falls to GPT-5.2 when Anthropic meter > 90%"

**Card meta:**
- "queued 4m" / "12m · $0.84" / "+412 −38"
- "awaiting you" (review badge)
- "▸ RefreshScheduler.test.ts 41/44" (log line)
- "merged ✓" (final state)

**Tab labels:**
- "Board" | "Worktrees"

**Worktrees view labels:**
- "building · 2/3 merged" (feature status)
- "supervising" (feature status)
- "merged ✓" (worktree status)
- "awaiting merge" (ticket status)
- "● reviewing now — diffing, merging up" (supervisor state)

**Footer hints:**
- "drag cards between columns to dispatch"
- "ticket worktrees merge up to feature; supervisor merges feature → main"

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Status dot colors | --ok, --warn, --err | NEW tokens added in OVERVIEW.md | Use semantic status tokens (green/amber/red). |
| Progress bar color | `success` running, `warning` review | Matches semantic palette | Aligned. |
| Card padding | Variable | 10–14px typical | Use consistent 12px padding; visual: spacing-md. |
| Column spacing | 10px gap | Matches spacing grid | Aligned. |
| Machine load label | "2/2" monospace | 11px, matching label scale | Aligned. |
| Dispatch button icon | [→] unicode | Use standard arrow icon SVG | Replace with `IconArrowRight` or similar. |

## State Model

```typescript
interface KanbanTask {
  id: string                           // e.g., "feat/agents-dash"
  title: string
  agent: string                        // Agent name
  agentLetter: string                  // Avatar letter (A, O, etc.)
  agentColor: string                   // Provider color
  machine: string                      // Machine name
  branch: string                       // Git branch
  status: "queued" | "running" | "needs-review" | "merged"
  progress?: number                    // 0–100 (if running/review)
  cost?: number                        // Dollar amount
  logTail?: string                     // Last log line
  createdAt: Date
  updatedAt: Date
}

interface CostPreset {
  name: string
  plannerModel: [letter: string, name: string, color: string]
  workerModel: [letter: string, name: string, color: string]
  supervisorModel: [letter: string, name: string, color: string]
  estimatedCost: string
}

interface Machine {
  name: string
  status: "online" | "offline"
  load: [current: number, max: number]   // e.g., [2, 2]
  cpuPercent?: number                    // Future
  memoryPercent?: number                 // Future
}
```

## API Contract (fleetd)

**Endpoints:**

```
GET /sessions                            // List all running/queued tasks
POST /sessions                           // Create new task
PATCH /sessions/{id}                     // Update task (status, pause, etc.)
GET /machines                            // List available machines
POST /sessions/{id}/dispatch             // Dispatch to machine
GET /cost-estimate                       // Estimate cost for preset
```

**WebSocket (optional):**
```
ws://fleetd:9000                         // Live updates for progress/logs
```

## Implementation Notes

- **Data source:** fleetd (separate daemon, HTTP API)
- **Sidebar link:** "board →" (from design) routes to `/fleet`
- **Session integration:** Can handoff from chat to Fleet (W1 / W7 integration point)
- **No persistence in Chorus DB:** Fleet state lives in fleetd; Chorus displays + user controls
- **Polling:** Fetch `/sessions` every 3–5s (or WebSocket for live updates)
- **Mobile:** Kanban columns scroll horizontally; machines strip wraps or scrolls

---

**Implementation (W7):** Standalone Fleet feature, integrates with fleetd daemon. Can start as mock/static for UI, iterate to real fleetd integration later.
