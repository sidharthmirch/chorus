# W1 Progress — Accounts: Provider OAuth Forward + Quota Meters (9router pivot)

## State: P1-P6 all done and committed. Not starting P7 (explicitly gated — "do NOT start before P1-P6 are PR-ready", separate PR). Ready for orchestrator review; see "Open questions for the orchestrator" below before merging.

## NEXT ACTION
No in-progress work — everything committed and green. If resuming: read
"Open questions for the orchestrator" (below) first, since the single
biggest remaining gap (the actual OAuth "Connect" browser flow) is a design
question, not a coding task, and guessing at it risks shipping broken
onboarding. If the orchestrator has answered that question, the next coding
task is: implement the real `useConnectProviderAccount`/
`useDisconnectProviderAccount` bodies in `api/ProviderAccountsAPI.ts`
(currently still `stubConnectProviderAccount`/`stubDisconnectProviderAccount`
— P6 wired *reads* to real 9router data but deliberately left *writes*
(connect/disconnect) on the stub, see decisions log) using
`nineRouterClient.getAuthorizeUrl`/`exchangeCode`/`deleteConnection`, whatever
browser-open + redirect-capture mechanism the orchestrator specifies, plus a
poll loop (`listConnections` until the new connection appears or timeout) —
`resolveCredential.ts`'s `findActiveConnectionForProvider` and
`NineRouterClient` already have everything needed except the redirect
capture itself.

If instead asked to pick at the two deliberately-deferred gaps:
- **P5's 401→expired detection** (see P5 checklist entry): wrap each
  provider class's whole `streamResponse` body in try/catch (don't touch
  the delicate internals), check `error?.status === 401 || error?.status
  === 403`, and only when a `nineRouterCredential` was in play, call a new
  `markProviderAccountExpired(providerId)` (add it to
  `api/ProviderAccountsAPI.ts` next to `stubDisconnectProviderAccount`,
  persisting `status: "expired"` the same way `persistProviderAccount`
  already does) before rethrowing unchanged.
- **P6's "refresh on-use"**: today's refresh is "next read after
  `NINEROUTER_QUOTA_REFRESH_INTERVAL_MS` has elapsed" (a passive interval,
  triggered by whatever next calls `fetchProviderAccounts`) plus the
  explicit `useRefreshProviderAccountQuota()` mutation — there is NOT yet a
  hook that fires immediately after a successful 9router-routed chat
  response the way the brief's "refresh on-use" literally implies. Wiring
  that means threading a callback from `resolveCredential.ts`'s
  success path back through each provider class's `onComplete`, which has
  the same "touches delicate, untestable streaming code" risk profile as
  the 401 item above — deferred for the same reason, not an oversight.

## Open questions for the orchestrator
1. **How should "Connect" actually open+capture the OAuth redirect?**
   `GET /api/oauth/:provider/authorize?redirect_uri=<uri>` requires *us* to
   supply `redirect_uri`, and 9router's exchange step needs the `code` that
   comes back to whatever URI we specified. Chorus has no deep-link broker
   or loopback HTTP listener (both explicitly out of scope per the 9router
   pivot — 9router "owns" OAuth), and building one now would need new Rust
   (a local socket listener; `tauri-plugin-http`'s `fetch` doesn't let a
   webview *receive* incoming HTTP). Two plausible resolutions I couldn't
   verify without deeper research into 9router's own dashboard frontend
   (out of scope for the research already spent — see notes file): (a)
   point `redirect_uri` at some page 9router's own already-running server
   hosts (if its dashboard has a generic "complete this OAuth flow, then
   you can close this tab" page, its URL is unknown to me) — Chorus never
   touches the code, just opens `authorizeUrl.url` in the system browser
   (`@tauri-apps/plugin-opener`, already a dependency) and polls
   `nineRouterClient.listConnections()` for the new connection; or (b)
   accept a small, scoped bit of new Rust (a temporary loopback listener,
   torn down after one redirect) — closer to the original architecture
   §4.2 design the 9router pivot otherwise removed. Recommend (a) if
   verifiable, since it needs zero new Rust and fits "never send users to
   9router's raw dashboard" (the redirect page, unlike the dashboard, would
   be invisible — open, redirect, close).
2. **Is the near-empty `NINEROUTER_MODEL_MAP` (3 entries) acceptable to
   ship, or should this PR wait for broader coverage?** See P5's checklist
   entry and `docs/rework/w1-provider-notes.md` §2.6 — this is a real,
   verified finding (Chorus's catalog and 9router's registries mostly don't
   overlap today), not a shortcut. Widening it safely needs either manual
   re-curation against a fresh 9router clone periodically, or a
   live-`/v1/models`-lookup-plus-fuzzy-match strategy (more code, deferred).
   Shipping as-is means forwarding *works* end-to-end but will rarely
   actually trigger until either catalog changes; that may or may not be
   acceptable for this PR's bar.

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
      `now`). Commit `c124988`. Total accounts-area tests: 48, all green.
      **Not wired into any route/Settings surface** — per the brief, this is
      a standalone reference component for W3 to mount; W1 does not touch
      `Settings.tsx`.
- [x] P5 — forwarding. `src/core/chorus/accounts/resolveCredential.ts`:
      `resolveNineRouterCredential(providerId, chorusModelId)` — the
      credential-resolution step, gated on (a) a 9router oauth mapping
      existing for the provider, (b) a **verified** Chorus-model-id →
      9router-upstream-id entry in `NINEROUTER_MODEL_MAP` (deliberately
      sparse — see below), (c) 9router actually running, (d) an active
      connection for that provider. Returns `undefined` on any failure —
      callers must treat that as "use existing behavior." `ensureNineRouterApiKey`
      creates+caches a 9router API key via `AppMetadataAPI.getNineRouterApiKey`/
      `setNineRouterApiKey` (new, additive, mirrors the existing
      `getCustomBaseUrl` pattern). 11 unit tests via an injected client double.
      Wired into all three eligible provider classes
      (`ProviderAnthropic.ts`, `ProviderOpenAI.ts`, `ProviderGoogle.ts`) with
      a minimal diff each: swap `baseURL`/`apiKey`/outgoing `model` when a
      credential resolves, skip the `canProceedWithProvider` early-throw in
      that case, otherwise byte-for-byte unchanged. This was possible with
      **zero request/response translation** because a second research pass
      (see `docs/rework/w1-provider-notes.md` §2.6, updated) found 9router
      mirrors each SDK's *native* wire format at a dedicated path
      (`/v1/messages` for Anthropic, `/v1/responses` for OpenAI's Responses
      API, `/v1/chat/completions` for Google's existing OpenAI-shim client) —
      not just a single OpenAI-Chat-Completions surface as first assumed.
      **Known, deliberate gap:** `NINEROUTER_MODEL_MAP` has only 3 verified
      entries total (1 Anthropic, 0 OpenAI, 2 Google) because Chorus's model
      catalog and 9router's registries mostly don't overlap (different
      version numbering/releases tracked) — verified by reading full
      registry files, not guessed. This means forwarding will rarely
      actually trigger against today's real catalogs even when a user has
      connected accounts; the infrastructure is correct and ready, coverage
      is the follow-up (see NEXT ACTION). **Also deliberately NOT done:**
      401 → `expired` → reauthorize detection — flagged in NEXT ACTION as
      the most important remaining P5 gap, deferred because fixing it safely
      means touching each provider's untestable streaming error internals.
      67 tests total repo-wide, all green; tsc/lint clean (only the
      pre-existing unrelated Draggable.tsx error — since resolved on its
      own, see landmines).
- [x] P6 — `src/core/chorus/accounts/QuotaService.ts`:
      `deriveQuotaSnapshot(usage)` reduces a 9router `UsageResult`'s
      `quotas` map to one `IQuotaSnapshot` per the §2.4 derivation strategy
      (prefer a "session"-named window, else soonest `resetAt`, else first;
      percentage-vs-raw-count `used` convention handled per provider).
      `deriveProviderAccountFromNineRouter(providerId)` derives a full
      status+quota for one OAuth-forwarded provider (undefined = 9router
      unreachable this round, distinct from `{status: "not-configured"}` =
      reachable but genuinely no connection). 16 unit tests via an injected
      client double. Wired into `api/ProviderAccountsAPI.ts`:
      `fetchProviderAccounts`/`fetchProviderAccount` now merge live
      9router-derived data (cached in `provider_accounts`, migration 147's
      `quota_json`/`status`/`account_email` columns, `INSERT OR REPLACE`,
      guarded by `isProviderAccountId`/`isProviderAuthKind`/
      `isProviderAccountStatus` type guards on read — no `as`) for the four
      oauth providers, gated by `NINEROUTER_QUOTA_REFRESH_INTERVAL_MS`
      (60s) so usage endpoints aren't hammered; falls back to the cached row
      or the stub when 9router is unreachable. `openrouter`/`local` stay on
      the pure in-memory stub (unchanged, documented gap). New
      `forceRefreshProviderAccountQuota` bypasses the interval gate — wired
      as `useRefreshProviderAccountQuota`'s real mutation body.
      **Deliberately NOT done: connect/disconnect mutations remain
      stub-only** — see "Open questions for the orchestrator" #1 above; real
      writes need a decision on the OAuth redirect-capture mechanism first.
      96 tests total repo-wide, all green; tsc 0 errors, lint clean.
- [ ] P7 (later, gated, separate PR) — remote/OAuth MCP servers. NOT
      started; instructions say explicitly not to start before P1–P6 are
      PR-ready, so this is intentional, not incomplete.

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
- 2026-07-21 Before wiring P5, re-cloned 9router (sparse checkout, same
  scratch-dir-outside-repo discipline, deleted after) specifically to verify
  two things the first research pass hadn't checked: whether 9router mirrors
  Anthropic's/OpenAI's *native* SDK wire formats (not just OpenAI Chat
  Completions), and whether Chorus's actual model catalog strings overlap
  with 9router's registries. Both turned out to matter a lot — see the
  updated `docs/rework/w1-provider-notes.md` §2.6. Worth the extra research
  pass: it changed the implementation from "rewrite each provider's request
  building to speak one shared wire format" (large, risky, untestable here)
  to "swap 3 fields on the existing client construction" (small, safe).
- 2026-07-21 `NINEROUTER_MODEL_MAP` (`resolveCredential.ts`) intentionally
  ships with only 3 verified entries (not a broader guessed table) — see the
  P5 checklist entry and `w1-provider-notes.md` §2.6's comparison table.
  Every unmapped Chorus model is a deliberate no-op (falls back to existing
  behavior), not a bug. Do not "helpfully" add guessed entries for other
  models without re-verifying against a fresh 9router clone first — a wrong
  entry would silently misroute a chat request to a nonexistent upstream
  model id.
- 2026-07-21 Chose not to implement 401→`expired` detection in P5 (see
  `w1-provider-notes.md` §4 point 5 and the NEXT ACTION suggested shape).
  The risk/reward didn't clear the bar given no way to run the app here:
  the safest-shaped fix (wrap each provider's whole `streamResponse` body in
  try/catch rather than touching internals) is still an editorial judgment
  call about where exactly to place the wrapper in three different
  large, delicate streaming-response methods — better done by whoever can
  actually test the result.
- 2026-07-21 P6: `provider_accounts.provider_id` is the PRIMARY KEY (from
  P1), so persistence is a per-provider `INSERT OR REPLACE` keyed on
  `provider_id` — matches the codebase's established upsert idiom
  (`ProviderVisibilityAPI.ts` et al.) rather than introducing
  `ON CONFLICT ... DO UPDATE` syntax that, while valid SQLite, has no
  precedent elsewhere in this codebase and wasn't worth the risk of being
  the first thing to test whether this exact `tauri-plugin-sql` version
  supports it.
- 2026-07-21 P6 deliberately keeps `useConnectProviderAccount`/
  `useDisconnectProviderAccount` on the stub (`stubConnectProviderAccount`/
  `stubDisconnectProviderAccount`, unchanged from P2) while making *reads*
  (`fetchProviderAccounts`) real. This means: when 9router is reachable,
  live derived data always wins over whatever the stub mutations last set;
  when 9router is unreachable, the stub's last mutation is what shows
  through the fallback chain (`refreshed ?? cached?.account ?? fallback`).
  This isn't an accident of not-getting-to-it — seeded here deliberately
  because building *real* connect/disconnect needs the OAuth redirect-
  capture design decision that's flagged as Open Question #1, and shipping
  a half-real mutation (e.g. one that opens a browser to *something* without
  knowing if it'll actually complete the flow) seemed worse than an honest,
  clearly-documented stub.
- 2026-07-21 `deriveProviderAccountFromNineRouter` returning `undefined`
  (9router unreachable) is deliberately distinct from returning
  `{status: "not-configured"}` (9router reachable, genuinely no connection)
  — conflating the two would make `fetchProviderAccounts` show
  "not connected" every time the user's 9router process happens to be
  stopped, even if they have real connected accounts recorded in the cache.
  The merge logic in `ProviderAccountsAPI.ts` relies on this distinction
  (`refreshed ?? cached?.account ?? fallback` — `refreshed` is `undefined`,
  not a not-configured account, when 9router is down).

## Landmines / do-not
- **RESOLVED, was a landmine, isn't anymore:** `src/ui/components/Draggable.tsx`
  used to fail `tsc --noEmit` with `Cannot find module '@dnd-kit/utilities'`
  (pre-existing since "Initial commit", unrelated to W1 — a gap in the
  shared `node_modules` junction). Sometime during this session the shared
  install gained `@dnd-kit/utilities` (presumably another concurrent
  workstream in a sibling worktree touched the shared `node_modules`, per
  ORCHESTRATION.md's "junction to the shared install" model) and `tsc
  --noEmit` is now 0 errors, not "0 errors except this one." Leaving this
  note so a future reader who sees a *clean* tsc doesn't wonder why earlier
  commits' messages mention a now-nonexistent error.
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
- `ModelProviders/ProviderAnthropic.ts`, `ProviderOpenAI.ts`,
  `ProviderGoogle.ts` each have exactly one new import
  (`resolveNineRouterCredential`) and a small, mechanical diff right before
  their existing `canProceedWithProvider`/client-construction code — this is
  W1's one explicitly-authorized touch into files W1 does not otherwise own
  ("`ModelProviders/*` (credential step)" per `00-ARCHITECTURE.md §8`'s file
  ownership table). Do not expand W1's footprint in those files beyond the
  credential swap (e.g. don't "fix" unrelated things noticed while in
  there) — if something else needs changing, flag it instead.
- `NINEROUTER_MODEL_MAP` is intentionally near-empty (3 entries). If you're
  tempted to "fill it in" from memory of what models exist, don't — every
  entry so far came from reading 9router's *actual* registry source and
  cross-checking against Chorus's *actual* catalog constant, not from
  general knowledge of model names. A plausible-sounding but wrong entry is
  worse than a missing one (silent misroute vs. safe fallback).

## User-test queue
(Nothing user-testable yet — P1-P5 are stub-backed/non-networked (P5's
forwarding code is real and wired, but with today's `NINEROUTER_MODEL_MAP`
coverage it will rarely actually engage — see the P5 checklist entry). The first
genuinely user-testable item will land with P5/P6: whether Chorus correctly
detects a real running 9router instance, and whether a real OAuth
connect→chat→disconnect round trip works. The agent cannot start a live
9router instance or open a system browser from this environment, so that
verification is entirely the user's per CLAUDE.md's "Your role" section.)
