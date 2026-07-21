# W1 Progress — Accounts: Provider OAuth Forward + Quota Meters (9router pivot)

## State: P2 done — frozen API surface backed by stub data. Starting P3 (nineRouterClient + lifecycle).

## NEXT ACTION
Create `src/core/chorus/accounts/nineRouterClient.ts`: typed client over the
9router HTTP API documented in `docs/rework/w1-provider-notes.md` §2 (health,
providers list/get/delete, oauth authorize/exchange, usage, keys), using
`@tauri-apps/plugin-http`'s `fetch` (already a dependency, already covered by
the existing broad `http:default` capability in
`src-tauri/capabilities/default.json` — no capability edit needed). Include
the `NINEROUTER_OAUTH_PROVIDER_MAP` (Chorus providerId+authKind →
9router provider id/alias) from notes §3. Then add a `detectNineRouter()`
health-check helper (lifecycle P3) and start wiring `ProviderAccountsAPI.ts`'s
stub functions to call it behind a feature-detection branch (fall back to
stub when 9router isn't running), without changing the exported hook
signatures.

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
      (`ProviderAccountsAPI.test.ts`, 7 tests). Not yet committed as of this
      NEXT ACTION write — see "commit cadence" note below; will be committed
      together with this PROGRESS.md.
- [ ] P3 — `nineRouterClient.ts` (typed HTTP client) + lifecycle detection
      (`detectNineRouter()` health-check poll). <- current
- [ ] P4 — on-brand onboarding UI: `ProviderAccountCard` +
      connect-flow-that-polls-status, in `src/ui/components/accounts/`.
- [ ] P5 — forwarding: credential-resolution step in `ModelProviders/*`
      (oauth via 9router → API key → backend proxy), 401 → `expired` →
      reauthorize.
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
- 2026-07-21 No `setTimeout`/`useRef`/`useImperativeHandle`/`as` used yet in
  P1/P2. One `as`-shaped consideration was written into
  `ProviderAccountsAPI.test.ts` (forcing an invalid provider id past the
  type system to test a fallthrough-error path) — removed rather than used,
  since it didn't fit the ORCHESTRATION.md-sanctioned exceptions ((a) `as
  const`, (b) unknown-from-JSON narrowing, (c) DB-row mapping). Flagging here
  so it doesn't get silently reintroduced. P3 (DB row → typed mapping, if we
  end up reading `provider_accounts` rows) and P6 (9router JSON → typed
  quota shape) are both expected to need a *legitimate* `as` under exception
  (b)/(c) — will comment each one inline and log it here when added.

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
  `docs/rework/w1-provider-notes.md` §3. Getting this wrong means silently
  hitting 9router's *direct-API-key* `anthropic`/`openai` entries instead of
  the OAuth ones.
- `gemini-cli` was marked `deprecated: true` with a risk notice in the
  9router source read during research (clone-time snapshot) — don't treat
  its disappearance in a future 9router release as a Chorus bug; degrade
  `google`'s row to "not available via 9router" per notes §5.
- Do not spawn 9router as a child process from Rust in this pass — see notes
  §6 for why that's explicitly deferred, not an oversight.

## User-test queue
(Nothing user-testable yet — P1/P2 are non-visual/internal. Will start
accumulating once P4's `ProviderAccountCard` and P3's lifecycle detection
land, since "is 9router detected correctly" needs a live 9router instance
the agent cannot start or verify here.)
