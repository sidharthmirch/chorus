# Settings Rework Directive (W3)

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ ← Back / Home                  Settings             [×]    │
├──────────────────┬─────────────────────────────────────────┤
│  Settings Nav    │  Content Panel                          │
│  ■ Accounts      │  ┌─────────────────────────────────────┐│
│  ■ Models        │  │ Accounts                            ││
│  ■ Modes         │  │ Manage providers, keys, quotas      ││
│  ■ Connections   │  ├─────────────────────────────────────┤│
│  ■ App           │  │ [Provider card] [Provider card]     ││
│                  │  │ ...                                 ││
│                  │  │                                     ││
│                  │  └─────────────────────────────────────┘│
├──────────────────┴─────────────────────────────────────────┤
│ Absorbed: Claude Code, Codex, Hermes (shared org)          │
└────────────────────────────────────────────────────────────┘
```

- **Modal/drawer:** 100% width on mobile, ~80% max-width desktop
- **Navigation:** Left sidebar (256px on desktop, collapsed to icons on mobile), vertical flex
- **Content:** Main panel, scrollable, `max-width 768px` centered with padding
- **Responsive:** On mobile, nav becomes horizontal tabs; on desktop, ResizablePanelGroup split

## Component Inventory

### Navigation Sidebar

- **Header:** Settings icon (⚙) + title "Settings", small close button (×)
- **Section items:**
  - Icon (■ = placeholder for section icon)
  - Label (12px, `color: --foreground` if active, else `--muted-foreground`)
  - Optional count badge (10px, monospace, `color: --helper`)
  - Click: Routes to `/settings/:section`
  - Active state: `bg-accent` + `color: --background` OR `bg-muted` (TBD — check /DESIGN.md Quiet Accent Rule)

- **Sections:**
  1. **Accounts** (provider OAuth, API keys)
  2. **Models** (model catalog, profiles, custom models)
  3. **Modes** (message stances, system prompts)
  4. **Connections** (MCP/toolset setup, domain configs)
  5. **App** (theme, appearance, permissions, data)

- **Footer:** Absorbed footnote
  - "Absorbed: Claude Code, Codex, Hermes (shared org)" (11px, `color: --helper`)

### Content Panels (Per Section)

#### Accounts Section

**Header:** "Accounts", description "Manage providers, keys, quotas" (12px muted)

**Provider cards** (grid, 1–2 per row):
- **Layout:** 280px × 160px cards (or full-width stacked on mobile)
- **Border:** 1px `--border`, `border-radius: 12px`
- **Background:** `bg-card`
- **Content:**
  - **Top row:** Provider name + OAuth badge ("oauth" or "api-key", small pill, 9px)
  - **Icon row:** Provider logo (48px × 48px, centered)
  - **Quota bar:** Full-width, 4px tall, same as model rows (see model-select.md)
  - **Quota label:** "62% · 3h" (11px monospace, muted)
  - **Button row:** "Manage" (ghost), "Edit key" (ghost) or "Configure" (ghost)

**Advanced section** (collapsed by default, Disclosure):
- **Title:** "Advanced" (12px, label style)
- **Rows:**
  - "Custom base URL" (text input, placeholder "https://api.openai.com/v1")
  - "LM Studio" (checkbox + description "Use local LM Studio instance")
  - Other provider-specific options

#### Models Section

**Header:** "Models", description "Configure model profiles and visibility" (12px muted)

**Rows** (per model, see model-select.md for anatomy):
- Avatar (16px) + name (13px)
- Auth label (10px monospace)
- Quota bar (58px) + percentage
- Buttons: Star/pin (toggle), "Edit" (model config), Delete (if custom)

**Custom model row** (at bottom, if custom models exist):
- Avatar placeholder (gray)
- Name "Add custom model…"
- Click: Opens modal to add new (API key, base URL, model name)

#### Modes Section

**Header:** "Modes", description "Manage message stances and system prompts" (12px muted)

**Mode cards** (grid, 1–2 per row):
- **Layout:** 280px × 160px (same as provider cards)
- **Content:**
  - **Icon + name:** ✓ Assist, ✕ Critic, ? Socratic, ◯ None
  - **System prompt preview:** First 2–3 lines of prompt in monospace (11px), truncated, `bg-muted`
  - **Metadata row:** "Used N times", "App default" or "Per-chat" or "Custom" badge
  - **Edit button:** Opens modal to edit prompt, tags

**New mode button:**
- "Create mode…" card, centered + icon
- Click: Opens mode creation modal

#### Connections Section

**Header:** "Connections", description "MCP servers, toolsets, integrations" (12px muted)

**Fleetd card:**
- Title: "Fleet daemon" (13px)
- Status: "Connected · online" or "Disconnected" (11px, color-coded)
- Protocol: "Own protocol, paseo-compatible" (11px monospace, muted)
- Button: "Configure" (ghost)

**MCP server cards** (per toolset):
- Title (model name or toolset name)
- Transport: "stdio" or "http://..." (11px monospace)
- Status: "Ready" (green dot) or "Needs auth" (amber) or "Error" (red)
- Buttons: "Edit", "Delete" (if custom)

**Domain configs section** (Disclosure, collapsed):
- **Title:** "Domain configs" (10px label)
- **Note:** "Market research", "Wiki", "Financial" — bundle tools + mode + artifact palette
- **Rows:** Domain name, enabled toggle, tools count, edit button

#### App Section

**Header:** "App", description "Appearance, behavior, permissions, data" (12px muted)

**Rows** (2-column table: key, description, value/toggle):
- **Theme:** dropdown (Light, Dark, Auto) or toggle
- **Fonts:** dropdown (SF Pro, Geist, etc.) or custom font picker
- **Cautious Enter:** toggle (Cmd+Enter to send, not plain Enter)
- **Show model cost:** toggle (displays $ estimate per response)
- **Tool permissions:** collapsible list of allowed tools + toggles
- **Import:** button "Import settings from backup…" (file picker)

## Interactions

### Navigation
- Click section item: Routes to `/settings/:section`, loads content
- Active section highlighted with `bg-muted` or accent fill (TBD per DESIGN.md review)

### Provider Cards (Accounts)
- **Manage button:** Opens provider-specific UI (e.g., OAuth flow, key entry form)
- **Edit key button:** Opens text input to paste/update API key
- **Quota bar:** Visual-only; shows current usage

### Mode Cards (Modes)
- **Card click or Edit button:** Opens modal
  - Modal form: mode name, icon selector, system prompt textarea, tags
  - Buttons: "Save", "Delete", "Cancel"

### MCP/Toolset Cards (Connections)
- **Status indicator:** Green dot (ready), amber (needs auth), red (error)
- **Reauthorize link** (if expired): Opens OAuth flow
- **Edit button:** Modal to change transport, URL, headers, etc.

### Advanced Toggles (App)
- **Cautious Enter:** Requires Cmd+Enter instead of plain Enter
- **Show cost:** Displays $ estimate badges in messages
- **Tool permissions:** Checkboxes enable/disable tool access

### Import/Export
- **Export:** Button (future) exports settings as JSON
- **Import:** File picker, loads backup .json file

## Copy

**Section headers:**
- "Accounts" / "Manage providers, keys, quotas"
- "Models" / "Configure model profiles and visibility"
- "Modes" / "Manage message stances and system prompts"
- "Connections" / "MCP servers, toolsets, integrations"
- "App" / "Appearance, behavior, permissions, data"

**Provider cards:**
- "OAuth" (badge) or "API key" (badge)
- "Manage" / "Edit key" / "Configure" (buttons)
- "62% · 3h" (quota)

**Modes:**
- "Assist · Do exactly what's asked. No pushback, no scope creep." (description)
- "Critic · Attack every claim. Chase every avenue to prove you wrong."
- "Socratic · Custom · answers only with questions until you commit."
- "Used 47 times" / "App default" / "Per-chat" / "Custom" (metadata badges)

**Connections:**
- "Fleet daemon" (title)
- "Connected · online" / "Disconnected" (status)
- "Own protocol, paseo-compatible" (description)
- "Needs auth" / "Reauthorize" (status badge + link)

**App section:**
- "Theme" (Light, Dark, Auto)
- "Cautious Enter" / "Require Cmd+Enter to send" (toggle + description)
- "Show model cost" / "Display $ estimate per response" (toggle)
- "Tool permissions" (section label)
- "Absorbed: Claude Code, Codex, Hermes (shared org)" (footer)

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Nav sidebar width | 256px (standard) | Not specified | OK; matches AppSidebar precedent. Use ResizablePanel default. |
| Active nav styling | `bg-accent` | Quiet Accent Rule forbids fill for non-state | Use `bg-muted` instead; accent only for text indicator (e.g., left border or underline). |
| Card grid columns | 2 columns on desktop | No grid spec | Use CSS Grid `grid-cols-1 md:grid-cols-2` for responsive. |
| Provider card height | 160px fixed | No card sizing spec | Height is content-dependent; use min-height 160px instead. |
| Mode card layout | Icon + name + preview + metadata | Varies from NVDA chat | Consistent card-based UI; acceptable. |

## Implementation Strategy (W3)

**Strangler approach:**
1. Extract Settings.tsx into `src/ui/components/settings/` module
2. Create `settings/SettingsShell.tsx` (nav + router)
3. Move existing sections into `settings/sections/*`:
   - `settings/sections/AccountsTab.tsx` (new component, accounts cards)
   - `settings/sections/ModelsTab.tsx` (rework ManageModelsBox logic)
   - `settings/sections/ModesTab.tsx` (move PromptProfilesTab logic)
   - `settings/sections/ConnectionsTab.tsx` (new component, toolsets UI)
   - `settings/sections/AppTab.tsx` (move DefaultsTab, PermissionsTab logic)
4. Add route `/settings/:section` to App.tsx (append-only)
5. One commit per section extraction, all green
6. Last commit: shell navigation + route wiring

**No data model changes needed** (Settings.tsx currently manages state). **Navigation layer only.**

---

**Implementation notes:**
- W3 owns all Settings.tsx rework and extracted sections
- W1 waits for W3's extraction of Connections section OR implements in separate toolsets-owned components
- W4 provides model-select.md data for Models section rows
