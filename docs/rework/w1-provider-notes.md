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

### 2.6 The multi-format proxy (what Chorus actually chats through)

**Update (second verification pass, same session):** 9router's proxy is
*not* only OpenAI-Chat-Completions-shaped — it mirrors **four** wire formats
at four different paths, all funneling into the same
`src/sse/handlers/chat.js` → `handleChat` pipeline via a
`initTranslators()`/format-auto-detection layer
(`open-sse/translator/formats.js`'s `detectFormatByEndpoint`). Confirmed by
reading each route file directly (not just README):

```
POST /v1/chat/completions   — OpenAI Chat Completions format
POST /v1/responses          — OpenAI Responses API format
POST /v1/messages           — Anthropic Messages API format (native x-api-key OR Bearer)
POST /v1beta/models/{model}:generateContent
POST /v1beta/models/{model}:streamGenerateContent
                             — Gemini native REST format (native x-goog-api-key,
                               Bearer, or ?key= query param; streaming choice is
                               the :generateContent vs :streamGenerateContent
                               URL suffix, not a body field)

GET  /v1/models
→ 200 { object: "list", data: [{ id: "<alias>/<modelId>", object: "model", owned_by: "<alias>" }, ...] }
```

**This matters a lot for P5 (forwarding):** each of Chorus's provider
classes can point its *existing* SDK client at 9router with only a
`baseURL`/`apiKey`/`model` swap — no request/response translation needed —
because each already speaks the wire format 9router mirrors natively:
- `ProviderAnthropic.ts` uses `@anthropic-ai/sdk`'s `client.messages.stream()`
  → hits `/v1/messages`, same shape.
- `ProviderOpenAI.ts` uses `openai` SDK's `client.responses.create()`
  (Responses API, not Chat Completions) → hits `/v1/responses`, same shape.
- `ProviderGoogle.ts` uses the `openai` SDK's `client.chat.completions.create()`
  pointed at Google's own OpenAI-compat shim (`generativelanguage.googleapis.com/v1beta/openai`)
  → hits 9router's `/v1/chat/completions`, same shape (Chorus never touches
  9router's native-Gemini `/v1beta/models/...` mirror at all, since it
  wasn't using Gemini's native format to begin with).

**Auth on all four paths** goes through the same `extractApiKey`
(`src/sse/services/auth.js`): checks `Authorization: Bearer <key>` first,
then the Anthropic-native `x-api-key` header — so the Anthropic SDK's
default auth header works unmodified against `/v1/messages`. The Gemini
native mirror additionally accepts `x-goog-api-key` and a `?key=` query
param (irrelevant to us, since we go through the OpenAI-shaped Google
provider, not the native one). **Enforcement is conditional**: auth is only
checked at all when `settings.requireApiKey` is true in 9router's own
settings (`src/sse/handlers/chat.js`: `if (settings.requireApiKey) { ... }
else { /* "No API key provided (local mode)" */ }`) — meaning a 9router
instance running for pure local/single-user use may not enforce a key at
all. Chorus should still always send the key it creates via `/api/keys`
(§2.5) regardless, both because we can't know the user's setting and because
it's harmless when not enforced.

Model id format on **all four proxy paths** is **`<providerAlias>/<modelId>`**
(the native-Gemini mirror builds this from the URL path segments — see its
route source — everywhere else it's the request body's `model` field), e.g.
`cc/claude-sonnet-5`, `cx/gpt-5.6-sol`, `gh/gpt-5.2`. This confirms the
orchestration doc's "model-name mapping `provider-code/model`" — the
"provider-code" is 9router's **alias**, not its full provider id.

**Model catalogs do NOT line up with Chorus's own catalog — verified, not
assumed.** Read the full `models:` array (not just the first few entries) for
all three OAuth-mirrored providers we ship model support for. Chorus's own
supported-model lists come from `ANTHROPIC_MODELS` in `ProviderAnthropic.ts`,
the hardcoded `modelId !==` chain in `ProviderOpenAI.ts`, and
`getGoogleModelName`'s allow-list in `ProviderGoogle.ts`.

| 9router provider (registry `models:`) | Overlaps with Chorus's own catalog |
|---|---|
| `claude`: `claude-fable-5`, `claude-sonnet-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-haiku-4-5-20251001` | **One exact match:** `claude-haiku-4-5-20251001` (both use the same dated model string). Everything else in Chorus's catalog uses `-latest`-style aliases (`claude-sonnet-4-latest`, `claude-opus-4-latest`, ...) or different dated ids (`claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`) that don't appear in 9router's list at all — 9router's registry evidently tracks newer/different model releases than Chorus's catalog does as of this clone. |
| `codex`: `gpt-5.6-sol(-review)`, `gpt-5.6-terra(-review)`, `gpt-5.6-luna(-review)`, `gpt-5.5(-review)`, `gpt-5.4(-review)`, `gpt-5.4-mini(-review)`, `gpt-5.3-codex-spark(-review)`, `gpt-5.5-image` | **Zero matches.** None of Chorus's OpenAI ids (`gpt-4o`, `gpt-4.1*`, `o1*`, `o3*`, `o4-mini`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`) appear in 9router's codex registry at all. |
| `gemini-cli`: `gemini-3.1-pro-preview`, `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite` | **Two exact matches:** `gemini-2.5-flash`, `gemini-2.5-flash-lite`. Chorus's `gemini-2.5-pro-preview-03-25` does NOT match 9router's bare `gemini-2.5-pro`. |

**Conclusion for P5:** ship a deliberately *minimal, verified* static
Chorus-model-id → 9router-upstream-model-id map (only the three confirmed
exact matches above) rather than a guessed broad one — sending a model id
9router's connected provider doesn't actually have would fail at request
time with no graceful way to detect it in advance. Every Chorus model not in
that tiny map falls back to existing behavior (API key / backend proxy)
even when a 9router account is connected. This is a real, known limitation,
not an oversight — see `.rework/PROGRESS.md`. Widening coverage later needs
either manual re-curation against a fresh 9router clone, or switching to a
live-`/v1/models`-lookup-plus-fuzzy-match strategy (more robust to both
catalogs moving, more code, deferred).

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

## 4. What P5 (forwarding) actually calls (implemented — see `resolveCredential.ts`)

For a chat request on a model whose provider has a **connected** 9router
OAuth account and a **known model mapping** (§2.6's verified table — this is
the gate that most often says "no"):
1. Resolve the 9router provider ref (`id`+`alias`) via
   `NINEROUTER_OAUTH_PROVIDER_MAP` (e.g. `anthropic`+`oauth` → `{id: "claude", alias: "cc"}`).
2. Resolve the upstream model id via the small verified static map in
   `resolveCredential.ts` (`NINEROUTER_MODEL_MAP`) — **not** a guess; only
   the three cross-checked exact matches from §2.6 are present. No entry ⇒
   no 9router route for that specific model, full stop; the calling provider
   class falls through to its pre-existing apiKeys/backend-proxy logic
   completely unchanged.
3. Ensure a Chorus-owned 9router API key exists (create via `POST /api/keys`
   once, cache the plaintext in `app_metadata` — see
   `AppMetadataAPI.getNineRouterApiKey`/`setNineRouterApiKey`).
4. Each provider class swaps **only** `baseURL`, `apiKey`, and the outgoing
   `model` field on its *existing* SDK client call — no request/response
   translation, because 9router mirrors each SDK's native wire format
   (§2.6): `ProviderAnthropic.ts` → `/v1/messages`, `ProviderOpenAI.ts` →
   `/v1/responses`, `ProviderGoogle.ts` → `/v1/chat/completions` (via its
   existing OpenAI-shaped client). `customBaseUrl`/direct API key are only
   used when no 9router credential resolved.
5. **401/expiry handling is NOT wired in this pass.** Detecting "this
   request failed because 9router's own token refresh failed" and flipping
   the `IProviderAccount` to `expired` would require touching each
   provider's existing streaming error-handling internals (Anthropic's
   `stream.on("error", ...)`, OpenAI's typed SSE event loop, Google's
   `isProviderError` catch) — judged too risky to do blind (no way to run
   the app here) inside otherwise-working production chat code. Flagged as
   the top follow-up in `.rework/PROGRESS.md`; today a 401 from 9router
   surfaces as a generic stream error to the user, same as any other
   provider error, rather than a friendly "reauthorize" prompt.

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
