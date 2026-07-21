# Chorus Remake — Rework Program

This directory is the single source of truth for the "Chorus Remake" rework.
Design source vendored at `docs/rework/design/src/Chorus Remake.dc.html`
(+ `support.js`, `uploads/*.png`; original claude.ai/design project
`4aa08dca-f7e3-461e-b27b-3464e29eb309`). Extracted per-surface directives
live in `docs/rework/design/`.

## Reading order (every agent, every session)

1. `/CLAUDE.md` — repo onboarding, workflow, coding style. Non-negotiable.
2. `/DESIGN.md` — the locked design system. Visual law for all UI work.
3. `docs/rework/01-COORDINATION.md` — worktree/branch/migration/resume protocol.
4. `docs/rework/00-ARCHITECTURE.md` — the overall architecture of the rework.
5. Your own workstream file in `docs/rework/agents/`.
6. Your surface's directive file(s) in `docs/rework/design/` (W0 output).

## Workstreams

| ID | Workstream | Prompt file | Branch | Depends on |
|----|-----------|-------------|--------|------------|
| W0 | Design extraction → `docs/rework/design/` | `02-DESIGN-EXTRACTION.md` | (docs) | done/in progress |
| W1 | Accounts: provider OAuth forward + quota meters | `agents/W1-provider-oauth.md` | `claude/rework-provider-oauth` | — |
| W2 | Inline artifacts (detection, sandboxed preview, side panel) | `agents/W2-artifacts.md` | `claude/rework-artifacts` | — |
| W3 | Settings rework (12 tabs → 5 sections) | `agents/W3-settings-rework.md` | `claude/rework-settings` | W1 (quota UI), W6 (modes data) — soft |
| W4 | Model select rework (composer popover + Models section) | `agents/W4-model-select.md` | `claude/rework-model-select` | W1 (quota API) — soft |
| W6 | Chat rework: view modes (Focus/Columns/Fused), stances, composer, prompt optimizer | `agents/W6-chat-rework.md` | `claude/rework-chat` | W4 (composer picker) — soft |
| W7 | Fleet (fleetd board + worktrees UI, protocol client) | `agents/W7-fleet.md` | `claude/rework-fleet` | design/fleet.md |
| W8 | Wiki vault (Obsidian-style: tree, notes, backlinks, search, graph, wiki-mcp) | `agents/W8-wiki.md` | `claude/rework-wiki` | design/wiki.md |
| W5 | Catch-all for remaining design-file features | `agents/W5-design-features.md` | per-feature | W0 |

"Soft" = start now; reconcile against the dependency's exported interfaces
before opening the PR (interfaces are frozen in `00-ARCHITECTURE.md`).

Suggested launch order given effort: **W1 + W2 first** (enablers, backend-ish),
then **W4 → W6 → W3** (chat surface chain), **W7/W8 anytime** (independent
surfaces, large).

Live status is **not** tracked here (README stays static to avoid cross-branch
conflicts). Each workstream tracks status in `.rework/PROGRESS.md` on its own
branch — see coordination doc.

## Ground rules (summary — full rules in 01-COORDINATION.md)

- One worktree per workstream. Never commit to `main`. Never push `origin/main`.
- Commit small and often; every stopping point must leave `tsc` green or be a
  clearly marked `wip:` commit with a NEXT-ACTION note in `.rework/PROGRESS.md`.
- Your work must be resumable by you *and* adoptable by any other agent:
  `.rework/PROGRESS.md` + git log carry all context that isn't in your prompt file.
- UI work follows `/DESIGN.md`. Design-file UX directives win on layout/IA;
  `DESIGN.md` wins on tokens, type scale, and component vocabulary. New semantic
  status tokens (`success`/`warning`, used by quotas/fleet) are added once by W1
  (P1) to `src/ui/themes/index.ts`; everyone else rebases and reuses.
- Agents cannot test the running app. The user tests. Draft PRs early, test
  plans always (see CLAUDE.md workflow).
