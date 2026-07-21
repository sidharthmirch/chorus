# 00 — Architecture of the Chorus Remake

Audience: implementation agents. This document fixes the shared architecture so
workstreams can proceed in parallel without stepping on each other. Interface
contracts defined here are **frozen**; changing one requires updating this file
in your branch *and* calling it out in your PR description.

Design-intent source: `docs/rework/design/` (extracted from
`Chorus Remake.dc.html`). The design's author notes ("Design notes · v2"):
artifacts open in a side panel Claude-style while chat keeps scrolling;
Focus/Columns/Fused are the three multi-model treatments (incl. weights);
Fleet is our own board (fleetd, paseo-compatible); Wiki is an Obsidian vault
(file tree, frontmatter, [[wikilinks]], backlinks, git sync).

## 1. Current system (as of `main` @ v0.14.15)

- **Shell:** Tauri v2 (Rust in `src-tauri/`), React 18 + TypeScript (strict),
  Vite, TanStack Query, local SQLite via `tauri-plugin-sql` with migrations in
  `src-tauri/src/migrations.rs` (sequential integer versions; ~150+ already).
- **Data layer:** `src/core/chorus/db/*` (per-entity SQL), `src/core/chorus/api/*`
  (per-entity TanStack Query wrappers). Schema reference: `/SCHEMA.md`.
- **Chat UI:** `src/ui/components/MultiChat.tsx` (~152KB monolith), model
  columns inside `ResizablePanelGroup`; right-drawer precedent `RepliesDrawer`
  (MultiChat.tsx:3363-3376). Existing compare/synthesis primitives:
  `ChatCompareSelection.ts`, `brainstorm.ts`, `SummaryDialog.tsx`, block types
  in `ChatState.ts`.
- **Render pipeline:** `renderers/MessageMarkdown.tsx` (code→CodeBlock,
  mermaid, svg, think-blocks, citations). Legacy full-page HTML runner
  `renderers/HTML.tsx` — do not extend.
- **Models/providers:** catalog in DB (`models`, `model_configs`), API-key auth
  only (`ApiKeysForm.tsx`), providers in `src/core/chorus/ModelProviders/`,
  Ollama detection (`OllamaClient.ts`). Backend at app.chorus.sh proxies for
  account-holders; BYO keys go direct.
- **Settings:** `Settings.tsx` (~85KB) + satellite tabs — the "12 tabs" the
  design collapses to 5 sections.
- **Tools/MCP:** `Toolsets.ts`, `ToolsetsManager.ts`, stdio transport only.
- **Design system:** `/DESIGN.md` (+ `.impeccable/design.json`); tokens
  `src/ui/themes/index.ts` → CSS vars → `tailwind.config.cjs`. The design
  mock's palette maps 1:1 onto it (`--acc` = Toasted Sand, `--sb` = sidebar
  smoke, `--hl` = highlight). The mock adds **status colors** `--ok/--warn`
  (+ existing destructive for `--err`): W1 adds `success`/`warning` tokens to
  `themes/index.ts` (both themes) in its first commit; everyone reuses.

## 2. Target state (the Remake)

1. **Accounts & provider OAuth forward (W1).** Users sign in with the consumer
   subscriptions they already pay for — Anthropic (Max), OpenAI (Pro), Google
   (AI Pro), GitHub Copilot — via OAuth; Chorus forwards those tokens to the
   provider APIs. Per-provider **quota meters** (% used + reset window) power
   badges across the whole app. API-key (OpenRouter) and local (Ollama)
   remain as auth kinds.
2. **Inline artifacts (W2).** Side panel, Claude-style split; Preview/Code
   tabs; per-chat artifact palettes (charts/tables/entity cards, wiki note
   drafts, live app previews).
3. **Settings rework (W3).** 12 tabs → 5 sections: Accounts, Models, Modes,
   Connections, App.
4. **Model select rework (W4).** Composer model popover + Settings "Models"
   rows: quota bars, auth ("via") labels, favorite star, visibility toggle,
   per-model profile chips.
5. **Chat rework (W6).** View modes **Focus** (one main answer + carousel of
   hidden models), **Columns** (today's multi-column, roles main/hidden),
   **Fused** (one synthesized answer + per-model grades and weights);
   per-message **stances/Modes** (Assist/Critic/Socratic — reusable system-
   prompt stances); **Prompt Optimizer** modal (Structured / Before-After,
   targets: Just chat / Hand to agent / Plan first, model sets).
6. **Fleet (W7).** Agent orchestration surface: kanban Board
   (Queued/Running/Needs review/Merged) + Worktrees view (feature branch →
   ticket worktrees; planner/worker/supervisor roles; cost presets;
   machines). Protocol: our own `fleetd`, paseo-compatible.
7. **Wiki (W8).** Obsidian-style vault: file tree, notes with frontmatter
   properties, [[wikilinks]] + backlinks, search, graph views, relink queue,
   wiki-mcp toolset so models read/write the vault.

## 3. Artifacts architecture (W2 contract)

### 3.1 Data flow

Derivation, not storage (v1): artifacts are a pure function of message
content + tool results. No migrations.

```
message ──> extractArtifacts(text, meta) ──> IArtifact[]
             (src/core/chorus/artifacts/extract.ts)

IArtifact {
    id, messageId, chatId, modelName,
    kind: "html" | "svg" | "mermaid" | "chart" | "table",
    title, language, code,        // Code tab
    document,                     // assembled srcdoc payload
    createdAt
}
```

- Detection heuristics ported from open-webui (`getCodeBlockContents`):
  fenced `html`/`svg`/`xml`(with `<svg`); consecutive `css`/`js` blocks merge
  into the preceding html group; bare-HTML-document fallback; tolerant of
  streaming partials.
- The design's richer palettes (chart/table/entity/note/relink-queue) are
  *renderer kinds* over the same `IArtifact` shape — extensible via a
  `registerArtifactRenderer` map. v1 ships html/svg/mermaid; chart/table
  arrive with W6's fused pipeline or tool outputs later.

### 3.2 Sandboxing (frozen security contract)

`ArtifactFrame`: `<iframe srcdoc>` with `sandbox="allow-scripts allow-forms"` —
**never** `allow-same-origin` with `allow-scripts` (would expose the Tauri IPC
bridge). CSP `<meta>` injected first in `<head>`; `connect-src 'none'` in v1;
error bridge via postMessage; external links intercepted → `openUrl`. Verify
`src-tauri/tauri.conf.json` CSP permits srcdoc frames; document changes.

### 3.3 UI (see `design/artifacts.md`)

Side panel = third `ResizablePanel` in MultiChat (~44% width, min 380px in the
mock), chat keeps scrolling left. Header: title + model pill + version stepper
+ actions (copy, download, fullscreen, open-in-window, context action like
"export csv"/"open repo"). Footer: provenance line (source/tool/branch).
Preview | Code segmented tabs. Versions accumulate; newest auto-selected.
Message affordance: `⿻ open panel` chip on artifact-bearing blocks;
auto-open gated by `detect_artifacts` app_metadata flag (default on).

### 3.4 Non-goals (v1)

No server-side execution, no artifact persistence tables, no JSX
transpilation, no artifact network access.

## 4. Accounts & provider OAuth architecture (W1 contract)

### 4.1 Model

```
IProviderAccount {
    providerId: "anthropic" | "openai" | "google" | "copilot" | "openrouter" | "local" | ...
    authKind: "oauth" | "api-key" | "none-local"
    label: string           // "oauth · max 20×", "api key", "ollama · detected"
    accountEmail?: string
    status: "connected" | "needs-auth" | "expired" | "error" | "not-configured"
    quota?: IQuotaSnapshot
}
IQuotaSnapshot {
    usedFraction: number      // 0..1
    resetsAt?: Date           // → "resets 3h" / "resets 1d" / "monthly"
    level: "ok" | "warn"      // warn ≥ 0.8 (single threshold constant)
}
```

- **Frozen consumer interface:** `api/ProviderAccountsAPI.ts` exposes
  `useProviderAccounts()` and `useQuota(providerId)`. W3 (Accounts section),
  W4 (model rows/popover), W6 (composer), W7 (quota-aware fallback copy) all
  render from these — no one else touches token logic.
- Model catalog rows gain a `via` derivation: model → provider account →
  auth label + quota. No schema change to `models`; join in core.

### 4.2 OAuth flows

- Per-provider OAuth 2.0/2.1 + PKCE clients in
  `src/core/chorus/accounts/<provider>OAuth.ts` behind one
  `IProviderOAuth` interface (authorize URL, exchange, refresh, revoke,
  quota fetch). Provider quirks isolated per file.
- Rust broker: open system browser; callback via deep link
  `chorus://oauth/callback` (tauri-plugin-deep-link) with loopback
  `127.0.0.1:<port>` fallback; Rust emits `oauth-callback` event with the
  redirect URL; TS completes exchange.
- **Token storage: macOS Keychain** via `keyring` crate commands
  (`secret_set/get/delete`, service `sh.chorus.provider-oauth`). Non-secret
  state (account email, expiry, scopes, quota cache) in SQLite.
- **Forwarding:** `ModelProviders/*` gain a credential resolution step:
  oauth token if connected, else API key, else chorus backend proxy —
  per-provider request shaping (headers/base URL) stays inside the existing
  provider classes.
- Compliance note: forwarding consumer-subscription tokens to provider APIs
  mimics each vendor's own CLI/desktop flows (Claude Code, Codex, Gemini);
  ToS exposure is the user's accepted risk — do not proxy these tokens
  through app.chorus.sh, ever.

### 4.3 Quota service

`accounts/QuotaService.ts`: fetch/derive per-provider usage (API where
offered, response-header accounting where not, local metering fallback),
cached in SQLite, refreshed on use + interval; exposes the snapshot consumed
by `useQuota`. Design semantics: percentage bar + reset window
("62% · resets 3h", warn at 84%).

### 4.4 DB

One migration: `provider_accounts` table (provider_id, auth_kind, label,
email, non-secret oauth state JSON, quota cache JSON, timestamps). Ledger
protocol applies. Remote/OAuth **MCP** servers are a later phase (P7+) of W1
— same broker + Keychain reused; do not build it before provider accounts
ship.

## 5. Chat rework architecture (W6 contract)

- **View mode** is per-chat state (`chats` table gains `view_mode` via
  migration, default `columns` = today's behavior).
  - *Focus:* primary model's answer full-width; other selected models answer
    silently (existing hidden columns), surfaced via a carousel pager
    ("2/3", model badge like "hidden · ✕ critic stance").
  - *Columns:* current MultiChat treatment; role chips main/hidden.
  - *Fused:* after all responses land, a synthesis model produces one answer
    + a grades table (score, weight %, note per model). Reuse the existing
    synthesis/brainstorm plumbing (`brainstorm.ts`, compare primitives)
    rather than a new pipeline; grades stored as a message part/block type.
- **Modes/stances** (Assist/Critic/Socratic): a `modes` entity (id, icon,
  name, description, prompt, tag: app-default/per-chat/custom, usage count).
  Table + CRUD in core; injection = prepend to system prompt at send time,
  per message-set. Composer mode picker (W6) + Settings Modes cards (W3)
  render the same entity. One migration (ledger).
- **Prompt Optimizer:** composer affordance → modal; rewrites the draft via a
  cheap model with target-specific instructions (Just chat / Hand to agent —
  adds acceptance criteria / Plan first); Structured vs Before-After preview;
  model-set presets (Chat trio / Coding / Fast-cheap) with per-model toggles
  that update the chat's selection on apply. Uses `simpleLLM.ts`.
- Frozen interfaces: `IMode`, `IGrade`, `viewMode` union — exported from
  `ChatState.ts`.

## 6. Fleet architecture (W7 contract)

- **Client-first.** Chorus implements the *UI + protocol client*; `fleetd`
  (the daemon that actually runs agents on machines) is out of repo scope.
  Protocol: our own, paseo-compatible where free.
- `src/core/chorus/fleet/protocol.ts`: typed protocol (sessions, features,
  tickets, machines, events) over WebSocket/HTTP to a configurable `fleetd`
  endpoint; `FleetAdapter` interface with two impls: `FleetdAdapter` (real)
  and `MockFleetAdapter` (fixture data from the design mock — powers UI dev
  and the empty/demo state).
- UI: `/fleet` route; Board view (4 kanban columns, card anatomy per
  `design/fleet.md`: agent avatar, machine, branch, progress, log line,
  review CTA), Worktrees view (feature → ticket worktrees, supervisor
  states, merge-up flow), cost-preset strip (Economy/Balanced/Max quality;
  role chips Planner/Worker/Supervisor), machines footer. Sidebar gains a
  "Sessions" cluster (live agent rows with pulse dot) linking to /fleet.
- Persistence: `fleet_config` app_metadata keys (endpoint, presets); board
  state lives in fleetd, not SQLite.

## 7. Wiki architecture (W8 contract)

- **Vault = a user-chosen local directory of .md files** (Obsidian
  conventions: YAML frontmatter, `[[wikilinks]]`). Chorus reads/writes via
  Tauri fs with vault-scoped permissions; never a database of note bodies.
- `src/core/chorus/wiki/`: `vault.ts` (fs walk, watch), `parse.ts`
  (frontmatter + wikilink extraction), `index.ts` (link graph + backlinks +
  search index in SQLite cache table — derived, rebuildable), `relink.ts`
  (orphan-mention / merge / rename suggestions — the design's relink queue).
- UI: `/wiki` route with vault tree (folders + counts), note view
  (properties table from frontmatter, rendered body with clickable
  wikilinks, backlinks with context snippets, local graph), search view,
  full graph view (folder-color legend, filter dims non-matches).
  Graph rendering: SVG force-lite (static layout ok for v1 — the mock uses
  hand-placed nodes; no physics library).
- **wiki-mcp:** expose the vault to models as a builtin toolset
  (read_note/write_note/search/backlinks) via the existing `Toolsets.ts`
  builtin pattern — this is how chat "wiki rewrite" flows write drafts.
- Git sync: v2 (out of v1 scope; note the seam in vault.ts).
- One migration: `wiki_index` cache table + `wiki_vault_path` app_metadata.

## 8. File ownership map (conflict avoidance)

| Path | Owner | Others may |
|------|-------|-----------|
| `src/core/chorus/artifacts/**`, `src/ui/components/artifacts/**`, `renderers/*` | W2 | read |
| `src/core/chorus/accounts/**`, `ModelProviders/*` (credential step), `src-tauri` oauth/keyring | W1 | read |
| `api/ProviderAccountsAPI.ts` | W1 | consume (W3/W4/W6/W7) |
| `Settings.tsx`, `src/ui/components/settings/**` | W3 | read |
| `ManageModelsBox.tsx`, `QuickChatModelSelector.tsx`, `ModelPills.tsx`, `src/ui/components/model-select/**` | W4 | read |
| `MultiChat.tsx` | W6 primary; W2 panel-mount only (coordinate line ranges via PROGRESS.md; W2's mount lands first — W6 rebases over it) | read |
| `ChatInput.tsx`, chat view-mode/mode/optimizer core + UI | W6 | read |
| `src/core/chorus/fleet/**`, `src/ui/components/fleet/**` | W7 | read |
| `src/core/chorus/wiki/**`, `src/ui/components/wiki/**` | W8 | read |
| `AppSidebar.tsx` | W7 adds Sessions cluster; W8 adds Wiki nav — separate, clearly-bounded insertions; both keep diffs minimal | read |
| `App.tsx` routes, `migrations.rs`, `themes/index.ts`, `tailwind.config.cjs`, capabilities, `package.json` | shared — append-only (coordination §4) | append |
| `/DESIGN.md`, `docs/rework/**` | architect/user | propose via PR note |

## 9. Merge order

W1 → W2 → W4 → W6 → W3 → W7 → W8 (W7/W8 may land earlier if ready — they
touch almost nothing shared except sidebar/routes). Migration numbers assigned
at final rebase per ledger. Each PR follows CLAUDE.md: `claude/*` branch,
`by-claude` tag, user-executable test plan, rebase not merge.
