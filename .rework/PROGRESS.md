# Rework — Integration Progress Index

The integration branch is `claude/rework`. Each workstream's detailed handoff
ledger lives under `.rework/progress/W<n>.md` (moved here at merge time to avoid
add/add collisions on a single shared path). See `.rework/ORCHESTRATION.md` for
cross-cutting decisions and the environment.

## Merge status (order: W1 -> W2 -> W4 -> W6 -> W3 -> W7 -> W8)

| Stream | Surface | Branch | Merged? | Ledger |
|--------|---------|--------|---------|--------|
| W1 | Provider accounts (9router) + quota | claude/rework-provider-oauth | YES | progress/W1.md |
| W2 | Inline artifacts | claude/rework-artifacts | YES | progress/W2.md |
| W4 | Model select | claude/rework-model-select | YES | progress/W4.md |
| W6 | Chat rework | claude/rework-chat | YES | progress/W6.md |
| W3 | Settings rework | claude/rework-settings | YES | progress/W3.md |
| W7 | Fleet | claude/rework-fleet | YES | progress/W7.md |
| W8 | Wiki | claude/rework-wiki | YES | progress/W8.md |

## Orchestrator follow-ups (tracked, not blocking parallel work)
- W1 connect flow: connect/disconnect mutations are stub-only; wire the real
  9router authorize-URL open (via Tauri opener) + status poll during final
  integration. Rust-free. On the user-test queue.
- W2 regeneration versioning: accepted v1 limitation (documented in W2 ledger).

## Protocol note for future workstreams
Write your ledger to `.rework/<stream-id>-PROGRESS.md` (e.g. `.rework/w4-PROGRESS.md`)
-- a UNIQUE path -- not `.rework/PROGRESS.md`, so integration merges never hit
add/add conflicts. The orchestrator relocates it under `.rework/progress/` at merge.
