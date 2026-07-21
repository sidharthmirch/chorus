# Rework Orchestration — decisions & environment (read before coding)

This file is authored by the **orchestrator** (the coordinating agent) and is
inherited by every workstream worktree (branched off `claude/rework`). It
records cross-cutting decisions and the local build environment. It complements
— does not replace — `docs/rework/00-ARCHITECTURE.md` and `01-COORDINATION.md`.

## Environment (Windows, no admin)

- Node is a **portable** install at
  `C:\Users\rsrchintern2\tools\node-v24.18.0-win-x64` and is on the **User
  PATH** already. `pnpm` is provided via corepack shims in that same dir.
- If a shell can't find `node`/`pnpm`, prepend the dir to PATH for that call:
  - bash: `export PATH="/c/Users/rsrchintern2/tools/node-v24.18.0-win-x64:$PATH"`
  - PowerShell: `$env:PATH = "C:\Users\rsrchintern2\tools\node-v24.18.0-win-x64;$env:PATH"`
- **Rust/cargo is NOT installed** and cannot be (no MSVC toolchain, no admin).
  You therefore **cannot compile the Tauri Rust backend**. Keep new Rust to an
  absolute minimum; anything you must add to `src-tauri/` is written to match
  existing patterns and handed to the user to compile/test (note it in the test
  plan). Prefer solving in TypeScript where a Tauri plugin already exposes the
  capability (shell, fs, http, opener, deep-link plugins are present).

## Quality gates you CAN run here (and must, before you report done)

- Typecheck: `pnpm exec tsc --noEmit` (or `pnpm build` for tsc+vite).
- Lint: `pnpm lint`.
- Unit tests: `pnpm test -- run` (vitest; add tests for pure logic you write).
- You CANNOT run the app. The **user** tests runtime behavior — every PR needs a
  user-executable test plan (CLAUDE.md).

## Worktree model (how the orchestrator runs you)

- You are given an explicit worktree path. **Do all work there.** `node_modules`
  is a directory junction to the shared install — do not delete or reinstall it;
  if you add a dependency, edit `package.json` + note it in PROGRESS.md and tell
  the orchestrator (lockfile is resolved at integration).
- Commit small and often on your branch. The orchestrator merges your branch
  into `claude/rework` between phases. Keep shared-file edits **append-only**
  (see 01-COORDINATION.md §4): `App.tsx` routes, `migrations.rs`,
  `themes/index.ts`, `tailwind.config.cjs`, `AppSidebar.tsx`, `package.json`.
- Maintain `.rework/PROGRESS.md` at the worktree root per 01-COORDINATION.md §2.

## Forbidden-feature policy (orchestrator pre-authorization)

CLAUDE.md forbids `setTimeout`, `useRef`, `useImperativeHandle`, and `as`
assertions without explicit permission. The orchestrator (not the user) grants
permission for this program under these rules — you do **not** need to stop and
ask:

- `useRef` for DOM refs (focus, scroll, iframe handles, measuring) — **allowed**.
- `setTimeout` for genuinely time-based UX (debounce, toast dismiss, poll
  intervals) — **allowed**; prefer a cleaned-up effect; never use it to paper
  over a race.
- `useImperativeHandle` — **avoid**; if truly needed, isolate and comment why.
- `as` assertions — **avoid**; use type guards/generics. Permitted only for
  (a) `as const`, (b) narrowing an `unknown` from JSON/IPC right after a runtime
  validation, (c) DB row → typed mapping where the column set is proven. Every
  `as` gets a one-line comment explaining why it is safe.

List every use of the above in your PROGRESS.md "Decisions log" so the
orchestrator can audit them at review.

## W1 direction change — use **9router** (github.com/decolua/9router, MIT)

The user directed that provider OAuth/routing go through **9router** — a local,
MIT-licensed, OpenAI/Anthropic-compatible proxy that already implements the
OAuth/subscription dance (Claude Code, Codex, Copilot, Cursor, Gemini CLI, …),
stores tokens in its own SQLite, auto-refreshes, and exposes `/v1`
chat/completions + models on `http://localhost:20128`. **Chorus wraps it with
our own on-brand in-app onboarding** — we do NOT send users to 9router's raw
dashboard.

Implications (these SUPERSEDE `docs/rework/design/accounts-oauth.md` and
`00-ARCHITECTURE.md §4` wherever they conflict — the frozen consumer contract
below is unchanged):

- **Do NOT hand-roll per-provider OAuth clients, PKCE, deep-link brokers, or a
  macOS Keychain integration.** 9router owns tokens + OAuth. This removes almost
  all of the original W1 Rust surface.
- W1 instead builds: (a) a 9router **client** in
  `src/core/chorus/accounts/nineRouterClient.ts` (typed calls to its HTTP API —
  you must read 9router's source to enumerate its API routes; it is a Next.js
  app, routes under `app/api/**` / `pages/api/**`); (b) **lifecycle**
  management (detect a running instance on :20128; if absent, guide the user or
  spawn a managed sidecar via an existing Tauri plugin — flag any Rust to the
  orchestrator); (c) **on-brand onboarding UI** (a `ProviderAccountCard` +
  connect flow that triggers 9router's provider-connect and polls status);
  (d) quota/usage derivation from 9router endpoints (fallback: response-header
  accounting, then local metering); (e) forwarding: `ModelProviders/*` gain a
  credential-resolution step that can route via 9router
  (`http://localhost:20128/v1`, model-name mapping `provider-code/model`),
  falling back to API key, then chorus backend proxy. Never proxy these tokens
  through app.chorus.sh.
- **Still binding:** W1 P1 adds `success`/`warning` semantic tokens to
  `src/ui/themes/index.ts` (both themes) + `tailwind.config.cjs` FIRST — the
  whole program rebases onto it. Values from `design/OVERVIEW.md`:
  success `#7fae7f` dark / `#4e8a52` light; warning `#d1a35d` dark / `#b07f36`
  light. `--err` stays mapped to existing `destructive`.
- **Frozen consumer contract (unchanged, downstream depends on it):**
  `api/ProviderAccountsAPI.ts` exposes `useProviderAccounts()` and
  `useQuota(providerId)`; types `IProviderAccount`, `IQuotaSnapshot` per
  `00-ARCHITECTURE.md §4.1`. Back it with stub data first so W3/W4/W6/W7
  unblock, then wire 9router.
- Record all 9router research (API routes, connect flow, usage endpoints,
  how it is launched/bundled) in `docs/rework/w1-provider-notes.md` (committed).

## Merge order (unchanged)

W1 → W2 → W4 → W6 → W3 → W7 → W8. Migration integers assigned at final rebase
per `docs/rework/MIGRATIONS-LEDGER.md`.
