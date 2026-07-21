# W1 — Accounts: Provider OAuth Forward + Quota Meters

Branch: `claude/rework-provider-oauth` · Worktree: `../chorus-wt-w1`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §4 (your frozen contract),
`docs/rework/design/accounts-oauth.md` + `design/settings.md` (Accounts
section), then this file.

## Mission

Let users sign in with the AI subscriptions they already pay for — Anthropic
(Max), OpenAI (Pro), Google (AI Pro), GitHub Copilot — via OAuth, and forward
those tokens to the provider APIs when chatting. Surface per-provider **quota
meters** (percent used + reset window, e.g. "62% · resets 3h") through one
frozen API that W3/W4/W6/W7 render from. Existing auth kinds (API key,
OpenRouter, chorus backend proxy, local Ollama) remain.

## Context you must load before coding

- `src/core/chorus/ModelProviders/` — every provider class; find where
  requests get credentials today (API keys / backend proxy). Your forwarding
  step slots in here.
- `src/core/chorus/Models.ts`, `api/ModelsAPI.ts` — catalog → provider join
  for the `via` label derivation.
- `ApiKeysForm.tsx` — current key management UX (stays, becomes one auth kind).
- `OllamaClient.ts` — "local · detected" pattern.
- `src-tauri/src/` — command registration; `capabilities/` for plugin perms.
- Research per provider (WebSearch/docs): OAuth endpoints + PKCE params used
  by each vendor's own CLI (Claude Code, Codex CLI, Gemini CLI, Copilot
  device flow) and what usage/quota signals each exposes. Record findings in
  `docs/rework/w1-provider-notes.md` (committed) — this research is the
  costliest part; never make a successor redo it.

## Phases

**P1 — Tokens + schema.** Add `success`/`warning` semantic colors to
`src/ui/themes/index.ts` (both themes) + `tailwind.config.cjs` (append-only;
whole program depends on this landing first). Migration: `provider_accounts`
table per architecture §4.4 (ledger entry). TS types `IProviderAccount`,
`IQuotaSnapshot` exported from core.

**P2 — Frozen API surface.** `api/ProviderAccountsAPI.ts`:
`useProviderAccounts()`, `useQuota(providerId)`, mutations
(connect/disconnect/refresh). Backed by stub data first — commit the frozen
interface early so W3/W4/W6 can build against it.

**P3 — Rust broker + Keychain.** `keyring` wrapper commands
(`secret_set/get/delete`, service `sh.chorus.provider-oauth`); deep link
`chorus://oauth/callback` (tauri-plugin-deep-link) + loopback fallback;
`oauth-callback` event. Idempotent, provider-agnostic.

**P4 — Provider OAuth clients.** `src/core/chorus/accounts/<provider>OAuth.ts`
behind one `IProviderOAuth` interface (authorizeUrl, exchange, refresh,
revoke, fetchQuota). One provider per commit: Anthropic → OpenAI → Google →
Copilot (device-code flow). Unit-test the state machines (PKCE, expiry,
refresh races); the browser dance itself goes to the user-test queue.

**P5 — Forwarding.** Credential-resolution step in `ModelProviders/*`:
oauth token → API key → backend proxy, per provider; request shaping
(headers, base URLs) stays inside each provider class. Never send these
tokens to app.chorus.sh. Handle 401 → mark account `expired` → surface
reauthorize.

**P6 — QuotaService.** `accounts/QuotaService.ts`: per-provider usage
(API where offered; response-header accounting; local metering fallback),
SQLite cache, refresh on-use + interval, warn threshold 0.8 as a named
constant. Wires the real data into P2's API.

**P7 (later, gated) — Remote/OAuth MCP servers.** Reuse broker + Keychain for
MCP-spec OAuth and StreamableHTTP transport (`MCPRemote.ts`). Do **not**
start before P1–P6 are PR-ready; separate PR.

## UI note

You own no big surface: the Accounts settings section is W3's; model rows are
W4's; both consume your P2 API. You may build one small standalone
`ProviderAccountCard` component (per `design/settings.md` card anatomy:
avatar, name, oauth badge, email/models detail line, quota bar + mono quota
label, Manage button) as a reference implementation for W3 to mount.

## Resumability specifics

- P2's stub-backed API means every downstream stream unblocks after two
  phases — prioritize.
- Per-provider commits are independent; an interrupted P4 leaves earlier
  providers fully working.
- `w1-provider-notes.md` carries all external research; PROGRESS.md carries
  state.

## Done means

Connect/disconnect per provider works (user-tested browser flows); chats run
on forwarded oauth credentials with correct fallback; quota meters live;
tokens only in Keychain; `success`/`warning` tokens landed; lint/build green;
PR with test plan (include: revoke-mid-chat behavior, expiry → reauthorize
path, API-key-only regression, Ollama detection regression).
