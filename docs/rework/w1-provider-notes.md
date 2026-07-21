# W1 — 9router integration notes

Research artifact for the W1 (Accounts) pivot to wrapping **9router**
(github.com/decolua/9router, MIT) instead of hand-rolled per-provider OAuth.
Source: shallow clone of `decolua/9router` (commit at clone time, `main`,
`9router-app` v0.5.40) read directly — **not** the published npm README alone.
Clone was done outside any git repo per instructions, in the session scratch
dir, and discarded after this research (not committed, not part of this repo).

## 0. TL;DR for implementers

- 9router is a **Next.js app** that serves both a management dashboard and an
  OpenAI-compatible proxy, on the **same port, 20128** by default.
- Its management API (`/api/providers`, `/api/oauth/*`, `/api/usage/*`,
  `/api/keys`) has **no CORS headers and no auth gate** — it trusts that only
  local processes reach `localhost:20128`. This means: (a) call it with
  **`@tauri-apps/plugin-http`'s `fetch`**, not the browser's global `fetch` —
  Tauri's http plugin makes the request from Rust, so the missing CORS headers
  don't matter (a webview-origin `fetch` would otherwise be at risk of being
  blocked depending on how the response is handled); (b) `tauri-plugin-http`
  is **already a dependency** (`package.json` `@tauri-apps/plugin-http`,
  `Cargo.toml` `tauri-plugin-http`) and `src-tauri/capabilities/default.json`
  already grants `http:default` for `http://*`/`https://*` on windows
  `["main","quick-chat"]` — **no Rust changes and no capability edits needed**
  to reach `http://localhost:20128/*`.
- The actual `/v1/chat/completions` + `/v1/models` proxy **does** require an
  `Authorization: Bearer <9router-issued-api-key>` header (validated by
  `isValidApiKey`). That key is created via `POST /api/keys` (also unguarded
  locally). So the connect flow is: detect 9router → ensure we have (or
  create) a Chorus-owned 9router API key → use it for all `/v1/*` calls.
- **Naming collision to get right:** 9router has *two* separate provider
  entries for "Anthropic": `anthropic` (category `apikey` — direct API key,
  alias `anthropic`) and `claude` (category `oauth` — the Claude
  Code/subscription OAuth dance, alias `cc`). Chorus's architecture doc uses
  `providerId: "anthropic"` to mean *the subscription forwarded via OAuth*.
  **Chorus's `anthropic`+`oauth` maps to 9router's `claude` provider, not
  9router's `anthropic` provider.** Same pattern for OpenAI/`codex` and
  GitHub/`github`. See mapping table in §3.
- Launch: `npm install -g 9router && 9router` (opens dashboard at
  `http://localhost:20128`), or from source `PORT=20128 npm run dev`/`start`.
  No official "run programmatically as a library" API — it's a standalone
  server process. W1 treats it as an **externally-managed sidecar**: detect
  via health check, guide the user to install/launch it if absent (see §6).
- Data dir (tokens + non-secret state, entirely inside 9router's own SQLite —
  **Chorus never sees or stores these tokens**):
  - Windows: `%APPDATA%\9router\db\data.sqlite` (i.e.
    `C:\Users\<user>\AppData\Roaming\9router\db\data.sqlite`)
  - macOS/Linux: `~/.9router/db/data.sqlite`
  - Overridable via `DATA_DIR` env var (used for Docker: `/var/lib/9router`).

## 1. Launch & lifecycle

- Package: npm `9router` (global CLI/launcher) wraps the private
  `9router-app` (this Next.js repo). `9router` starts the server and opens
  the dashboard in the default browser.
- Env vars of note (from `.env.example` + README):
  - `PORT` (default 20128 in prod; the repo's own `npm run dev` script
    hardcodes `--port 20127` for contributor-local dev only — production/CLI
    default is 20128)
  - `NEXT_PUBLIC_BASE_URL` — should equal `http://localhost:20128`
  - `DATA_DIR` — override the SQLite/data directory
  - `HOSTNAME` — bind address (`0.0.0.0` for Docker)
  - `INITIAL_PASSWORD` / dashboard password (see auth note below)
- Docker image also available: `decolua/9router` (Docker Hub) /
  `ghcr.io/decolua/9router`, `-p 20128:20128`.
- **Health check:** `GET /api/health` → `{ ok: true }`, CORS-open (has an
  explicit `OPTIONS`/`Access-Control-Allow-Origin: *`). Cheapest way to detect
  "is 9router running on :20128 right now" — use this for lifecycle polling.
- **Dashboard auth:** `GET /api/auth/status` reports `requireLogin` (dashboard
  password gate, defaults to `true` in `getSettings()`) and `authMode`. This
  gate protects the **dashboard UI** (cookie session, `auth_token`). It does
  **not** gate the management JSON API routes we need (`/api/providers`,
  `/api/oauth/**`, `/api/usage/**`, `/api/keys`) — none of those import
  `getDashboardAuthSession`/`dashboardSession`. So Chorus can drive
  connect/disconnect/usage without ever touching the dashboard password, as
  long as it's talking to `localhost:20128` directly (which is the only
  place 9router listens by default).
- No "spawn 9router from Chorus" path is implemented in P3 — see §6. This is
  the one open item to flag to the orchestrator (matches the brief's "prefer
  detecting + guiding the user for v1").

## 2. Management API surface actually used

Base: `http://localhost:20128`. All bodies are JSON; all responses are JSON
(`NextResponse.json(...)`). Route source paths below are relative to the
9router repo (`src/app/api/...`), included so a future reader can re-verify
against a newer clone.

### 2.1 Health
```
GET /api/health
→ 200 { ok: true }
```
(`src/app/api/health/route.js`)

### 2.2 List / manage provider connections
```
GET  /api/providers
→ 200 { connections: [ProviderConnection, ...] }   // apiKey/accessToken/refreshToken/idToken stripped

POST /api/providers                                 // API-key connections only; OAuth uses §2.3
  body: { provider, apiKey, name?, displayName?, priority?, globalPriority?, defaultModel?, proxyPoolId?, providerSpecificData? }
→ 201 { connection: ProviderConnection }             // apiKey stripped

GET  /api/providers/:id
→ 200 { connection: ProviderConnection }             // secrets stripped
→ 404 { error: "Connection not found" }

PUT  /api/providers/:id                              // partial update (name, priority, isActive, apiKey if authType=apikey, ...)
→ 200 { connection: ProviderConnection }

DELETE /api/providers/:id
→ 200 { message: "Connection deleted successfully" }
→ 404 { error: "Connection not found" }
```
(`src/app/api/providers/route.js`, `src/app/api/providers/[id]/route.js`)

`ProviderConnection` shape (fields relevant to us; secrets present only in the
DB, never in these responses):
```ts
{
  id: string
  provider: string          // 9router provider id, e.g. "claude", "codex", "github", "gemini-cli", "anthropic"
  authType: "oauth" | "apikey" | "cookie" | "access_token"
  name?: string
  email?: string
  displayName?: string
  isActive: boolean
  testStatus?: "unknown" | "active" | "error" | ...
  lastError?: string
  lastErrorAt?: string
  expiresAt?: string | null      // ISO
  providerSpecificData?: Record<string, unknown>
  createdAt, updatedAt: string
}
```
There is **no per-connection "id" that's provider-scoped and stable across
reconnects** — treat `connections[].id` as opaque and always re-fetch the list
to find "the connection for provider X" (a provider can, in 9router's model,
have *multiple* connections/accounts — Chorus's v1 contract assumes one
active account per `providerId`, so pick the first `isActive` connection for
that provider, or the most recently updated if several).

### 2.3 OAuth connect flow (authorization_code + PKCE, the default flow)
```
GET  /api/oauth/:provider/authorize?redirect_uri=<uri>
→ 200 { url, state, codeVerifier, codeChallenge, ... }   // exact fields vary per provider; url is what to open in the system browser

POST /api/oauth/:provider/exchange
  body: { code, redirectUri, codeVerifier, state, meta? }
→ 200 { success: true, connection: { id, provider, email, displayName } }
→ 400/500 { error }
```
(`src/app/api/oauth/[provider]/[action]/route.js`, actions `authorize` (GET)
and `exchange` (POST))

Device-code flow (used by some providers, not the four we target initially):
```
GET  /api/oauth/:provider/device-code?...
→ 200 { deviceCode, userCode, verificationUri, codeVerifier, ... }

POST /api/oauth/:provider/poll
  body: { deviceCode, codeVerifier, extraData? }
→ 200 { success: true, connection: { id, provider } }        // done
→ 200 { success: false, pending: true }                       // still waiting
→ 200 { success: false, error, errorDescription }             // failed
```
Our four target providers (`claude`, `codex`, `github`, `gemini-cli`) do
**not** set `flowType: "device_code"` in the registry as of this clone — they
all use the `authorize`/`exchange` PKCE pair above, so our v1 client only
needs to implement that pair. `device-code`/`poll` are documented here for
completeness/future providers but out of scope for P4.

There is **no separate "disconnect" endpoint** — disconnect is
`DELETE /api/providers/:id` (§2.2).

There is **no separate "status" endpoint** either — status is derived by
re-`GET`-ing `/api/providers` and reading `isActive`/`testStatus`/`expiresAt`
on the matching connection. Token refresh is handled internally by 9router
(triggered lazily inside `/api/usage/:connectionId` and inside the `/v1`
proxy path) — Chorus never calls a refresh endpoint directly.

### 2.4 Usage / quota
```
GET /api/usage/providers
→ 200 { providers: [{ id, name }, ...] }        // providers that have logged request history

GET /api/usage/:connectionId
→ 200 UsageResult                                // shape below
→ 401 { error: "Credential refresh failed: ..." } // oauth token dead, needs reauthorize
→ 500 { error }
```
(`src/app/api/usage/providers/route.js`, `src/app/api/usage/[connectionId]/route.js`)

`UsageResult` is **not perfectly uniform across providers** (each has its own
upstream quota API) but consistently shaped as:
```ts
{
  plan?: string                    // "Claude Code", "unknown", copilot_plan, ...
  message?: string                 // present instead of quotas when usage isn't available yet
  quotas?: Record<string, {        // keyed by a human window label, provider-specific
    used: number                   // Claude: 0-100 (already a percentage); GitHub: raw count
    total: number                  // Claude: 100; GitHub: entitlement; 0 if unlimited/unknown
    remaining?: number
    remainingPercentage?: number
    resetAt?: string | null        // ISO, when parseable
    unlimited?: boolean
  }>
}
```
Concretely, for our four target providers, the `quotas` keys observed in
source (`open-sse/services/usage/{claude,codex,github,google}.js`):
- **claude**: `"session (5h)"`, `"weekly (7d)"`, plus optional per-model
  `"weekly <model> (7d)"` — each `{used: 0-100, total: 100, remaining, resetAt, unlimited: false}`.
  `used` is already a **percentage** (Anthropic's own `utilization` field), not a raw count.
- **codex**: provider-specific rate-limit windows; same
  `{used, total: 100, remaining, resetAt, unlimited}` shape per window.
- **github** (Copilot): `quotas.chat` / `quotas.completions` /
  `quotas.premium_interactions`, each `{used, total, remaining, unlimited}`
  where `used`/`total` are **raw counts** (entitlement - remaining), not
  percentages — must divide to get a fraction.
- **gemini-cli**: `quotas` built from a `buckets` array in the upstream
  response; shape present but shallow (frequently just `{plan, message}` when
  the CLI project isn't fully provisioned — treat "no `quotas` key" as
  "connected, quota unknown" rather than an error).

**QuotaService derivation strategy (recorded here so it isn't re-derived):**
pick the quotas entry with the shortest/most-urgent reset window when several
exist (Claude: prefer `"session (5h)"` over `"weekly (7d)"`; generically,
prefer the entry with the smallest `total`/soonest `resetAt` when window
semantics aren't known); compute `usedFraction = unlimited ? 0 : (total > 0 ?
used/total : used > 0 ? used/100 : 0)` — i.e. treat `used` as already a
0–100 percentage when `total === 100` (Claude/Codex convention), else as a
raw count needing division by `total` (GitHub convention). `resetsAt` from
`resetAt` when present. A provider connection with no `quotas` key at all
(only `message`) yields `quota: undefined` in `IProviderAccount` — the UI
falls back to showing just the auth/connected badge, no bar.

### 2.5 API keys (needed to call the `/v1` proxy)
```
GET  /api/keys
→ 200 { keys: [{ id, name, machineId, ... }] }     // no secret value on list

POST /api/keys
  body: { name }
→ 201 { key, name, id, machineId }                  // `key` is the plaintext secret, shown once
```
(`src/app/api/keys/route.js`) — Chorus should create one key named e.g.
`"chorus"` on first successful provider connect (if `GET /api/keys` has no
key already tagged that way) and cache the plaintext `key` value app-side
(non-secret-tier: it only grants access to the user's own local 9router
instance, which already holds the real provider tokens — still, don't log it).

### 2.6 The OpenAI-compatible proxy (what Chorus actually chats through)
```
GET  /v1/models
→ 200 { object: "list", data: [{ id: "<alias>/<modelId>", object: "model", owned_by: "<alias>" }, ...] }

POST /v1/chat/completions
  headers: Authorization: Bearer <9router-api-key>
  body: standard OpenAI chat.completions request, model = "<alias>/<modelId>"
→ streaming or non-streaming OpenAI-shaped response
```
(`src/app/api/v1/models/route.js`, `src/app/api/v1/chat/completions/route.js`
→ delegates to `src/sse/handlers/chat.js`, which requires
`Authorization: Bearer <key>` and validates via `isValidApiKey` — confirmed by
reading the handler; 401 on missing/invalid key.)

Model id format is **`<providerAlias>/<modelId>`**, e.g.
`cc/claude-sonnet-5`, `cx/gpt-5.6-sol`, `gh/gpt-5.2`. This confirms the
orchestration doc's "model-name mapping `provider-code/model`" — the
"provider-code" is 9router's **alias**, not its full provider id.

## 3. Provider id / alias mapping (Chorus ↔ 9router)

9router keeps OAuth-subscription providers and API-key providers as
**separate entries even for the same vendor**. Chorus's
`IProviderAccount.providerId` + `authKind` together select which 9router
entry to use:

| Chorus `providerId` | Chorus `authKind` | 9router provider id | 9router alias | 9router category | Notes |
|---|---|---|---|---|---|
| `anthropic` | `oauth` | `claude` | `cc` | `oauth` | "Claude Code" subscription OAuth — this is what architecture §4.1 means by "anthropic oauth · max" |
| `anthropic` | `api-key` | `anthropic` | `anthropic` | `apikey` | direct Anthropic API key — unrelated 9router entry, same vendor |
| `openai` | `oauth` | `codex` | `cx` | `oauth` | "OpenAI Codex" subscription OAuth |
| `openai` | `api-key` | `openai` | `openai` | `apikey` | direct OpenAI API key |
| `google` | `oauth` | `gemini-cli` | `gc` | `free` (sic) | Google OAuth login; 9router categorizes it "free" because no paid key is needed, but it's still a Google-account OAuth dance gated by the user's AI Pro/Ultra entitlement upstream. **Also marked `deprecated: true` with a risk notice in the 9router source at clone time** — flag to orchestrator/user, don't hard-fail if it disappears in a future 9router release. |
| `copilot` | `oauth` | `github` | `gh` | `oauth` | GitHub Copilot OAuth |
| `openrouter` | `api-key` | *(not via 9router)* | — | — | Chorus's existing OpenRouter integration is unaffected — no 9router involvement, per architecture (API-key auth kinds remain direct) |
| `local` | `none-local` | *(not via 9router)* | — | — | Ollama, unaffected |

This table is the seam for `nineRouterClient.ts`'s provider-id translation —
implemented as `NINEROUTER_OAUTH_PROVIDER_MAP` in that file. If 9router adds
a proper "copilot"/"anthropic-oauth"-named id in a later release, only that
map needs updating.

## 4. What P5 (forwarding) actually calls

For a chat request on a model whose provider has a **connected** 9router
OAuth account:
1. Resolve `alias` for the Chorus provider via §3's map (e.g. `anthropic`+`oauth` → `cc`).
2. Resolve the upstream model id 9router expects — **not** the same string
   Chorus's own catalog uses (e.g. Chorus's `claude-sonnet-4-5-20250929` vs.
   9router/Claude Code's exposed `claude-sonnet-5`). This mapping is
   provider-specific and not guessable from Chorus's model catalog alone; v1
   ships a small per-provider static map (documented as an assumption/TODO in
   `nineRouterClient.ts`) rather than trying to auto-derive it, and falls
   back cleanly (see below) when a given Chorus model has no known 9router
   equivalent.
3. `POST http://localhost:20128/v1/chat/completions` with
   `Authorization: Bearer <chorus-9router-key>`, `model: "<alias>/<upstream-model-id>"`.
4. On non-2xx (esp. 401 from 9router — meaning **9router's own refresh
   failed**, i.e. the underlying provider token is actually dead): mark the
   `IProviderAccount` `expired`, and the existing provider class's fallback
   path (API key → chorus backend proxy per architecture §4.2) takes over for
   that turn, exactly like today's `canProceedWithProvider` short-circuit.

## 5. Assumptions / things NOT verified against a live instance

We do not have network access to run 9router itself in this environment (no
child process execution of an installed 9router, no port 20128 listening) —
everything above is read from source, not observed at runtime. Flag as
assumptions:
- Exact `authorize` response field names may have small per-provider
  variance (confirmed `url`/`state`/`codeVerifier`/`codeChallenge` present for
  the generic path; provider-specific `meta` passthrough exists for a few
  providers like GitLab, irrelevant to our four targets).
- The claim that `/api/providers` etc. have no auth gate was verified by
  absence of any `dashboardSession`/`getDashboardAuthSession` import in those
  route files, not by an observed unauthenticated request/response — a
  version bump could add a gate. `nineRouterClient.ts` treats a 401/403 from
  any management call as "9router present but needs the user to unlock the
  dashboard first" and surfaces that distinctly from "9router not running".
- Default `PORT` is 20128 per Docker/CLI docs; the checked-out repo's own
  `npm run dev` script hardcodes 20127 for its own contributor workflow. If a
  user runs 9router "from source" with plain `npm run dev` (no `PORT` env
  override) they'll actually be on 20127, not 20128 — the lifecycle detector
  should say so in its "not detected" guidance rather than silently failing
  quietly on 20128 only. (Assumption: v1 only probes 20128, per the
  orchestrator's fixed contract; documenting the 20127 foot-gun as user-guidance copy.)
- Google Gemini's `deprecated: true` flag in the registry as read may mean
  9router itself is moving away from `gemini-cli` as an OAuth path; if a
  future 9router drops it, Chorus's `google` row in the Accounts UI should
  degrade to "not available via 9router" rather than crash — `nineRouterClient.ts`
  treats an unknown/absent provider id in `/api/providers` output as
  `not-configured`, not an error.

## 6. Lifecycle management (P3) — decision recorded

Per the brief ("managing/spawning the process may require a Tauri plugin —
if you must add Rust, keep it minimal and flag it"): **v1 does not spawn
9router.** There's no documented programmatic "start as a library/child
process with a stable API" story in 9router itself (it's `next start`
under the hood; spawning it reliably would mean shipping/managing a whole
Next.js server as a Chorus-managed child process, finding a free port,
handling its own first-run migration, etc. — real scope, not "minimal Rust").
v1 instead:
- Polls `GET http://localhost:20128/api/health` (via `@tauri-apps/plugin-http`,
  no new capability needed — see §0) to detect a running instance.
- If absent, `ProviderAccountCard`/onboarding UI shows "9router not detected"
  with copy pointing at `npm install -g 9router && 9router` (or the Docker
  one-liner) and a "Check again" action — no auto-launch.
- This is the flagged-to-orchestrator open item: revisit spawning as a
  Tauri sidecar in a later phase if the user wants zero-setup onboarding: it
  would need a bundled Node runtime or a packaged 9router binary as a Tauri
  `sidecar` (same mechanism already used for `binaries/run-mcp` etc. in
  `src-tauri/capabilities/default.json` — precedent exists, just not built
  here).
