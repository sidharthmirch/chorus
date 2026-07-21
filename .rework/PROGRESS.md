# W1 Progress — Accounts: Provider OAuth Forward + Quota Meters (9router pivot)

## State: P4 done — client, lifecycle detection, and reference onboarding UI all in place on stub data. Starting P5 (forwarding).

## NEXT ACTION
Add the credential-resolution step to `ModelProviders/*` (P5). Read
`src/core/chorus/ModelProviders/ProviderAnthropic.ts`,
`ProviderOpenAI.ts`, `ProviderGoogle.ts` and `src/core/utilities/ProxyUtils.ts`
(`canProceedWithProvider`/`hasApiKey`) to find exactly where `apiKeys` gets
turned into a request (Anthropic/OpenAI already read via `Read` this session
— OpenAI: `client = new OpenAI({ apiKey: apiKeys.openai, baseURL: customBaseUrl, ... })`
around ProviderOpenAI.ts:173). Add a small shared helper (probably
`src/core/chorus/accounts/resolveCredential.ts`) that, given a provider name,
returns either `{ kind: "9router", baseUrl: "http://localhost:20128/v1",
apiKey: <chorus 9router key>, modelId: "<alias>/<upstream-id>" }` or
`{ kind: "api-key" }`/`{ kind: "backend-proxy" }` to fall through to existing
behavior — call it from each provider class right where `apiKeys.<provider>`
is currently read, per-provider request shaping stays inside each class as
the architecture requires. This needs: (a) a real 9router API key acquired
via `nineRouterClient.createApiKey`/`listApiKeys` and persisted somewhere
non-secret-tier (app_metadata is the natural fit, following the
`getCustomBaseUrl`/`useCustomBaseUrl` pattern in `AppMetadataAPI.ts`); (b) the
per-provider Chorus-model-id → 9router-upstream-model-id static map flagged
as a TODO/assumption in `nineRouterClient.ts`'s file header (documented in
`docs/rework/w1-provider-notes.md` §4 already — this map itself doesn't exist
in code yet, only the alias map does); (c) 401 handling that flips the
account to `expired` via `useProviderAccountsAPI`'s (still-stub) store and
falls through to the existing API-key/backend-proxy path for that turn.
Since `ProviderAccountsAPI.ts` is still stub-backed (P6 not started), P5's
"mark expired" step should call `stubDisconnectProviderAccount`-shaped logic
or a new `stubMarkProviderAccountExpired` — add that mutation now rather than
inventing ad hoc state, so P6 has one seam to replace.

## Phase checklist
- [x] Research: 9router API surface, launch/data-dir, provider-id mapping,
      quota response shapes — `docs/rework/w1-provider-notes.md` (commit
      `0581a28`). Scratch clone was outside the repo and deleted after
      reading; nothing from it is vendored here.
- [x] P1 — `success`/`warning` theme tokens (both themes) +
      `tailwind.config.cjs` wiring; `provider_accounts` migration (v147,
      ledger updated); core types `IProviderAccount`/`IQuotaSnapshot` +
      `QUOTA_WARN_THRESHOLD` in `src/core/chorus/accounts/ProviderAccounts.ts`
      (unit-tested). Commit `2bbedc7`.
- [x] P2 — `src/core/chorus/api/ProviderAccountsAPI.ts`: `useProviderAccounts()`,
      `useQuota(providerId)`, `useConnectProviderAccount()`,
      `useDisconnectProviderAccount()`, `useRefreshProviderAccountQuota()`.
      Backed by an in-memory stub store (module-level array, seeded
      not-configured for all 6 known provider ids). Unit-tested
      (`ProviderAccountsAPI.test.ts`, 7 tests). Commit `d6a22fe`.
- [x] P3 — `src/core/chorus/accounts/nineRouterClient.ts`: typed HTTP client
      (health/providers/oauth authorize+exchange/usage/keys) using
      `@tauri-apps/plugin-http`'s fetch, `NINEROUTER_OAUTH_PROVIDER_MAP`,
      type-guard JSON parsing (no `as`), 20 unit tests via injectable
      `fetchImpl`. Added `useNineRouterStatus()` (10s poll via
      `refetchInterval`, additive to the frozen API) to
      `ProviderAccountsAPI.ts`. Commit `99e931b`.
- [x] P4 — on-brand onboarding UI in `src/ui/components/accounts/`:
      `ProviderAccountCard.tsx` (reference card: status dot, name, auth
      badge, email/status detail line, `QuotaBar`, Connect/Reauthorize/
      Manage/Disconnect buttons gated by `account.status`),
      `QuotaBar.tsx` (4px meter + mono "62% · resets 3h" label, reusable by
      W4's model rows), `providerAccountDisplay.ts` (pure, unit-tested
      display-mapping helpers — badge copy, status-dot color, status text).
      Extended `ProviderAccounts.ts` with `formatQuotaResetWindow`/
      `formatQuotaLabel` (pure, unit-tested, deterministic via injectable
      `now`). Not yet committed as of this write — will commit together with
      this PROGRESS.md update. Total accounts-area tests: 48, all green.
      **Not wired into any route/Settings surface** — per the brief, this is
      a standalone reference component for W3 to mount; W1 does not touch
      `Settings.tsx`.
- [ ] P5 — forwarding: credential-resolution step in `ModelProviders/*`
      (oauth via 9router → API key → backend proxy), 401 → `expired` →
      reauthorize. <- current, see NEXT ACTION.
- [ ] P6 — `QuotaService.ts`: derive real usage from 9router, cache in
      `provider_accounts` (migration 147's `quota_json` column), wire into
      P2's API replacing the stub, refresh on-use + interval.
- [ ] P7 (later, gated, separate PR) — remote/OAuth MCP servers. Do not
      start before P1–P6 are PR-ready.

## Decisions log
- 2026-07-21 Followed ORCHESTRATION.md's "W1 direction change — use 9router"
  section, which supersedes `design/accounts-oauth.md`'s hand-rolled
  OAuth+Keychain design and `00-ARCHITECTURE.md §4.2/§4.4`'s Rust broker
  wherever they conflict. No Keychain, no PKCE client, no deep-link broker
  built — 9router owns all of that. `IProviderAccount`/`IQuotaSnapshot` and
  the `useProviderAccounts()`/`useQuota()` contract are unchanged (frozen).
- 2026-07-21 Chose to keep the migration 147 `provider_accounts` table
  *unused* by P2 (stub is a pure in-memory module array, not DB-backed).
  Architecture's phrasing — "P6 wires real data into P2's API... cached in
  SQLite" — reads as: DB wiring is P6's job, not P2's. This keeps P2 minimal
  and avoids inventing seeding/migration-write semantics that P6 would need
  to revisit anyway once real 9router data has a shape to persist.
- 2026-07-21 `provider_accounts.provider_id` is the table's PRIMARY KEY
  (one row per known provider id) rather than one row per *connection*.
  9router itself supports multiple connections per provider (round-robin
  accounts) — see `docs/rework/w1-provider-notes.md` §2.2's note on
  `connections[].id` being opaque/non-unique-per-provider. Chorus's frozen
  `IProviderAccount` contract is explicitly single-account-per-provider
  (matches architecture §4.1's shape exactly: one `IProviderAccount` per
  `providerId`), so the migration mirrors that scope rather than modeling
  9router's richer multi-account case. If multi-account support is wanted
  later, that's a schema change + contract change, flagged here for whoever
  picks it up.
- 2026-07-21 9router research: confirmed via source read (not just README)
  that 9router's *management* API (`/api/providers`, `/api/oauth/**`,
  `/api/usage/**`, `/api/keys`) has no CORS headers and no dashboard-auth
  gate — see notes §0/§5 for the exact verification method and the caveat
  that this was confirmed by absence of an auth-session import, not by an
  observed live request. Decided: use `@tauri-apps/plugin-http`'s `fetch`
  (not global `fetch`) for all 9router calls in P3, both because it sides
  around any CORS ambiguity and because it's already an unused-but-present
  dependency (`@tauri-apps/plugin-http` in package.json, `tauri-plugin-http`
  in Cargo.toml, already covered by the existing broad `http:default`
  capability scope in `src-tauri/capabilities/default.json` — verified no
  capability edit is needed).
- 2026-07-21 `nineRouterClient.ts` parses all HTTP JSON via hand-written type
  guards (`isRecord`/`readString`/`toConnection`/`toQuotaWindow`/...) instead
  of `as` casts on `unknown` — chose this over the
  ORCHESTRATION.md-sanctioned exception (b) ("narrowing unknown from JSON/IPC
  right after a runtime validation") because a guard *is* the runtime
  validation, so there's nothing left to cast; a version bump on 9router's
  side that renames/drops a field degrades a row to "dropped" rather than
  producing a bad cast that type-checks but lies at runtime. No `as` used in
  `nineRouterClient.ts` itself.
- 2026-07-21 One legitimate `as` used: `providerAccountDisplay.ts`'s
  exhaustiveness-check `default` branches do
  `` `Unhandled status: ${exhaustiveCheck as string}` `` — this is not a new
  pattern, it's copied verbatim from the existing convention in
  `ModelProviders/ProviderOpenAI.ts`'s attachment-type switch (`` `... ${exhaustiveCheck as string}` ``),
  needed because template-literal interpolation of a `never`-typed value
  trips `@typescript-eslint/restrict-template-expressions`. It appears in
  exactly three places, all in `providerAccountDisplay.ts`'s
  exhaustiveness-check `default` branches (`authKindBadgeLabel`,
  `statusText`, `statusDotClassName`); `ProviderAccountCard.tsx` has no
  exhaustive switch and uses none.
- 2026-07-21 `ProviderAccountCard`'s Disconnect button uses the plain
  `destructive` Button variant (quiet text+10%-tint per DESIGN.md, not a
  solid red slab) rather than gating through `ConfirmButton`. DESIGN.md says
  "gated by ConfirmButton where irreversible" — judged disconnect as *not*
  irreversible (reconnecting is always available, no data is lost), and
  `ConfirmButton` is an icon-only click-to-arm control that doesn't fit the
  card's plain-text button row anyway. Flagging this judgment call for
  W3/orchestrator review since it's a UX call, not just an implementation
  detail.
- 2026-07-21 `QuotaBar` is a plain-div meter, not built on the shared
  `ui/progress.tsx` Radix primitive — that component hardcodes its fill to
  `bg-foreground` with no per-level color hook, and forking/extending a
  shared `ui/` primitive felt riskier (other workstreams read that dir) than
  a small self-contained meter local to `components/accounts/`. Flagged in
  the component's own doc comment too.
- 2026-07-21 Quota label copy follows `IQuotaSnapshot`'s own doc comment in
  `00-ARCHITECTURE.md §4.1` ("resetsAt?: Date // → 'resets 3h' / 'resets 1d' /
  'monthly'") — i.e. `"62% · resets 3h"` — rather than
  `design/accounts-oauth.md`'s bar-label example `"62% · 3h"` (no "resets"
  word). Treated the frozen-contract doc comment as more authoritative than
  the mock-derived example when the two disagree on wording (not substance).

## Landmines / do-not
- `src/ui/components/Draggable.tsx` fails `tsc --noEmit` with
  `Cannot find module '@dnd-kit/utilities'` — **pre-existing**, present since
  the repo's "Initial commit" (confirmed via `git log -- Draggable.tsx`),
  unrelated to W1, caused by a gap in the shared `node_modules` junction (the
  package is present under `@dnd-kit/core` and `@dnd-kit/modifiers` but not
  `@dnd-kit/utilities`). Do not try to "fix" this from this worktree — it's
  not ours to fix and editing the shared `node_modules` is explicitly
  forbidden by the toolchain rules. `tsc --noEmit` is "green" for W1 purposes
  whenever this is the *only* reported error.
- `provider_accounts` migration is numbered **147** with a
  `// REWORK-MIGRATION: renumber at rebase` tag — do not renumber it
  yourself; that happens at the final integration rebase per
  `docs/rework/MIGRATIONS-LEDGER.md`.
- Do not add a "copilot"/"anthropic-oauth" 9router provider id assuming it's
  the obvious name — 9router's actual ids for our four OAuth targets are
  `claude` (alias `cc`), `codex` (alias `cx`), `gemini-cli` (alias `gc`),
  `github` (alias `gh`). Full mapping in
  `docs/rework/w1-provider-notes.md` §3, also encoded as
  `NINEROUTER_OAUTH_PROVIDER_MAP` in `nineRouterClient.ts`. Getting this
  wrong means silently hitting 9router's *direct-API-key*
  `anthropic`/`openai` entries instead of the OAuth ones.
- `gemini-cli` was marked `deprecated: true` with a risk notice in the
  9router source read during research (clone-time snapshot) — don't treat
  its disappearance in a future 9router release as a Chorus bug; degrade
  `google`'s row to "not available via 9router" per notes §5.
- Do not spawn 9router as a child process from Rust in this pass — see notes
  §6 for why that's explicitly deferred, not an oversight.
- `ProviderAccountCard`/`QuotaBar`/`providerAccountDisplay` are deliberately
  NOT imported anywhere outside `src/ui/components/accounts/` yet (no route,
  no Settings mount). That's correct per the brief, not an oversight — don't
  "helpfully" wire it into `Settings.tsx` from this workstream; that's W3's
  file.
- `getNineRouterProviderRef`/`NINEROUTER_OAUTH_PROVIDER_MAP` only has entries
  for `anthropic`/`openai`/`google`/`copilot` — `openrouter`/`local` are
  intentionally absent (those auth kinds never go through 9router). Don't
  add fallback entries for them "for completeness."

## User-test queue
(Nothing user-testable yet — P1-P4 are stub-backed/non-networked. The first
genuinely user-testable item will land with P5/P6: whether Chorus correctly
detects a real running 9router instance, and whether a real OAuth
connect→chat→disconnect round trip works. The agent cannot start a live
9router instance or open a system browser from this environment, so that
verification is entirely the user's per CLAUDE.md's "Your role" section.)
