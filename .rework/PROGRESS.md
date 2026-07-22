# Rework — Integration Progress Index (FINAL)

Integration branch: `claude/rework`. All workstreams merged + verified green.
Per-workstream ledgers under `.rework/progress/`. Cross-cutting decisions in
`.rework/ORCHESTRATION.md`.

## Merge status
| Stream | Surface | Merged |
|--------|---------|--------|
| W1 | Provider accounts via 9router (tokens, ProviderAccountsAPI, forwarding, quota, real connect flow) | YES |
| W2 | Inline artifacts (sandboxed side panel, detection, versions) | YES |
| W4 | Model select (shared vocabulary, quota/via labels, favorites) | YES |
| W6 | Chat rework (Focus/Columns/Fused, modes/stances, composer, optimizer) | YES |
| W7 | Fleet (protocol client, Board + Worktrees, presets, sidebar cluster) | YES |
| W8 | Wiki vault (tree, notes, backlinks, search, graph, wiki-mcp) | YES |
| W3 | Settings rework (5-section shell; Settings.tsx 2021 -> 116 lines) | YES |
| +Orca | OrcaCliAdapter behind W7 FleetAdapter seam (CLI-backed real fleet) | YES |
| W9 (oauth-routing "intelligence") | UNREQUESTED scope-creep from a rogue instance | PARKED (branch `claude/rework-oauth-routing`, NOT merged) |

## Gates (final, on HEAD)
- tsc --noEmit: 0 errors
- eslint src: clean
- vitest: 425/425 passing (32 files)

## Review outcomes (independent, post-hoc)
- FIXED [critical]: gray-matter frontmatter RCE in wiki (`parse.ts`) — eval engines disabled, regression tests added.
- FIXED [medium]: "Open in window" artifacts — `artifact-*` added to capability window scope (needs Tauri rebuild to apply).
- CONFIRMED CLEAN: wiki path-traversal containment, artifact iframe sandbox/CSP contract, 9router token boundary (never to app.chorus.sh), migrations additive (147-150, no collision with main max 146), fused-grading LLM-output parsing.

## Known follow-ups / limitations (documented, not blocking)
- W6 fused-mode synthesis/grading auto-triggers are guarded by `isPending`; a dev-only StrictMode double-invoke could theoretically double-fire. Recommended follow-up: make triggers idempotent per messageSet. Watch-item on test plan.
- W1 9router connect/disconnect: wired to open the authorize URL + poll status; needs a live 9router to validate end-to-end. Sparse verified model map (catalog overlap) — expands over time.
- W2 artifact regeneration does not snapshot the pre-regen version (accepted v1 limitation).
- Orca adapter: JSON field names for `orca worktree ps --json` are assumed-and-unverified (orca not installed in dev); validate against real orca. pause/resume semantics documented in OrcaCliAdapter.
- Not runtime-tested (no app run here): all UI. Full user test plan in the PR/report.
