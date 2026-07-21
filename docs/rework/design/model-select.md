# Model Select Directive (W4)

## Surfaces

Two UI surfaces expose model selection and configuration:

1. **Composer Manage Models Modal** (see composer.md — modal UI spec)
2. **Settings › Models section** (see settings.md — rows UI spec)

This file focuses on the **data model, row anatomy, and quota/auth badge semantics** shared across both surfaces.

## Layout: Composer Modal (Recap)

```
┌────────────────────────────────────────────────────────────┐
│ Manage models ⌘J                                       [×] │
├────────────────────────────────────────────────────────────┤
│ ⌕ Search models…                                           │
├──────────────────────────────┬──────────────────────────────┤
│  Catalog (55%)               │  Selected (45%)              │
│  ☐ [A] Claude Sonnet 4.5     │  Selected · 3 models         │
│      anthropic oauth · max   │                              │
│      [████ 62%] 62% · 3h     │  [A] Claude Sonnet          │
│  ☐ [O] GPT-5.2               │      main                   │
│      openai oauth · pro      │      profile: default · t0.7 │
│      [██████ 84%!] 84% · 6h  │                              │
│  ☑ [G] Gemini 3 Pro          │  [O] GPT-5.2                │
│      google oauth · ai pro   │      hidden                  │
│      [██ 37%] 37% · 1d       │      profile: concise · t0.4 │
│  ☑ [R] Llama 4 Maverick       │                              │
│      openrouter · $8.20      │  [G] Gemini 3 Pro           │
│      [... 0%] pay/use        │      hidden                  │
│                              │      profile: critic · t0.9  │
│                              │                              │
│                              │  First model is main; rest   │
│                              │  answer hidden and fuse…     │
├──────────────────────────────┴──────────────────────────────┤
│  Clear all ⌘⇧⌫              Done                           │
└────────────────────────────────────────────────────────────┘
```

## Component Inventory

### Model Catalog Row

Each row in the left panel catalog:

**Anatomy (left to right):**
1. **Checkbox** (15px × 15px)
   - Border: `1px solid --border` (unchecked) or `--accent-500` (checked)
   - Fill: transparent (unchecked) or `--accent-500` (checked)
   - Checkmark: white, centered
   - Click: toggles model visibility for this chat

2. **Avatar** (18px circle)
   - Background: provider color (Anthropic `#d97757`, OpenAI `#10a37f`, Google `#4285f4`, etc.)
   - Content: single letter (initials — A, O, G, R, L)
   - Color: white, weight 600, font-size 9px

3. **Name + Auth** (flex 1)
   - **Name line:** 13px, `color: --foreground`
   - **Auth line:** 10px monospace, `color: --helper`, format "anthropic oauth · max"
     - Suffix semantics: "max" (unlimited quota), "pro" (tier), "$8.20" (pay-per-use), "local" (no auth), "oauth · ai pro"

4. **Quota bar + label** (58px wide)
   - **Bar:** 4px tall, `border-radius: 2px`, `bg-muted`, filled portion `success` (green) or `warning` (amber)
   - **Label:** 9px monospace, `color: --helper`, format "62% · 3h"
     - Percent (0–100%), window (3h, 6h, 1d, monthly, or "pay/use" for OpenRouter)
   - **State:** `warning` color if quota > 80%, `success` if < 80%

### Selected Preview Cards

Each card in the right panel:

**Anatomy:**
1. **Border:** 1px solid (main model: `--accent-600`, hidden: `--border`)
2. **Header row:**
   - Avatar (16px)
   - Name (12.5px)
   - Role badge (10px monospace, `color: accent` for main, `color: helper` for hidden)

3. **Profile row:**
   - Label: "profile" (10px monospace)
   - Dropdown pill: "default · t0.7" (11px), inline with label
   - Click: Opens profile selector (or routes to Settings › Models)

### Settings › Models Section

Same row anatomy as catalog, but vertically stacked. Per model:
- Checkbox (favorite/pin)
- Avatar + name + auth
- Quota bar
- Edit button (routes to model config modal)
- Delete button (if custom model)

## Interactions

### Checkbox Toggling
- Click checkbox: Toggles model selection
- Behavior:
  - **Composer modal:** Reflects in Selected panel immediately
  - **Settings › Models:** Toggles `visibility` or `pinned` flag (per model_configs table)
  - Unchecking main model: Auto-promotes first hidden to main

### Profile Dropdown (Per-Selected Model)
- Click pill: Opens inline dropdown or modal
- Options: Predefined profiles (default, concise, critic) + custom
- Selection: Updates model_config row (e.g., `temperature: 0.4`, `name: "concise"`)

### Clear All
- Button in modal footer
- Action: Unselects all models
- Keyboard shortcut: ⌘⇧⌫

### Search
- Input field (modal only): "⌕ Search models…"
- Behavior: Case-insensitive search on model name + auth label
- Filters catalog in real-time

### Model Catalog Loading
- Placeholder: 6 skeleton cards (looping, density hint)
- On load: Catalog populates with `catalogDefs` from state
- Error state: If fetch fails, show "Unable to load models" + retry button

## Copy

**Buttons & Labels:**
- "⌕ Search models…" (search placeholder)
- "Selected · N models" (header, N = count)
- "Clear all" (button)
- "Done" (button)
- "First model is main; the rest answer hidden and fuse on demand. Profiles come from Settings › Models." (footer hint)

**Model rows (catalog):**
- "Claude Sonnet 4.5" (name)
- "anthropic oauth · max" (auth label)
- "62% · 3h" (quota label)

**Selected preview:**
- "main" or "hidden" (role badge)
- "profile" (label)
- "default · t0.7" (profile name + T value)

**Settings › Models section:**
- Per row: same anatomy as catalog
- Additional button: "Edit" (model config) or "..." (menu)

## Deviations

| Item | Mock | DESIGN.md | Resolution |
|------|------|-----------|-----------|
| Checkbox size | 15px | No defined checkbox size | OK; matches typical checkbox sizing. Use shadcn Checkbox component (sized to fit). |
| Quota bar color warning threshold | 80% | No threshold defined | Use `success` (green) <80%, `warning` (amber) ≥80%. Define threshold as constant. |
| Profile dropdown | Inline pill | No dropdown component | Use Popover or Select from shadcn/ui. Populate from `mode_configs` table + predefined list. |
| Avatar size (catalog vs selected) | 18px vs 16px | No size specification | Catalog 18px (prominent), Selected 16px (compact). OK. |

## Data Model

### Model Catalog Entry (from `models` table)

```typescript
interface CatalogModel {
  id: string                           // e.g., "sonnet", "gpt", "gem"
  name: string                         // e.g., "Claude Sonnet 4.5"
  provider: "anthropic" | "openai" | "google" | "openrouter" | "ollama"
  providerColor: string                // Hex color from provider brand
  letter: string                       // Single initial (A, O, G, R, L)
  authRequired: "oauth" | "api-key" | "none"
  authTier?: string                    // e.g., "max", "pro", "ai pro"
  quotaPercentage?: number             // 0–100
  quotaWindow?: "3h" | "6h" | "1d" | "monthly" | "pay/use"
  defaultProfile?: string              // e.g., "default"
  visibility: boolean                  // Hidden/shown in picker
  pinned?: boolean                     // Favorite status
}
```

### Model Config Entry (from `model_configs` table)

```typescript
interface ModelConfig {
  modelId: string
  name: string                         // User-visible name (e.g., "concise", "default")
  temperature: number                  // 0–1
  topP?: number
  customSystemPrompt?: string
  customBaseUrl?: string               // For local/self-hosted
  createdAt: Date
  updatedAt: Date
}
```

## Quota Semantics

Quotas surface across the app in three places:

1. **Composer modal:** Quota bar (%) + window (3h/6h/1d/monthly)
2. **Settings › Models:** Same quota bar in each row
3. **Fleet cost presets:** "quota-aware: falls to GPT-5.2 when Anthropic meter > 90%" (see fleet.md)

**Refresh behavior:** Quotas are cached locally; update interval is TBD (pull on app start, background sync every 1h). Fallback to local default if network unavailable.

---

**Implementation:** W4 owns ManageModelsBox.tsx (modal) and rework of model rows in Settings › Models (W3 pulls in). Data contracts (ModelsAPI, ModelConfigChatAPI) are frozen.
