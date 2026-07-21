# Migrations Ledger

Claimed migrations across rework branches. Protocol: `01-COORDINATION.md` §5.
Add a row (in your branch) when you introduce a migration; final integer
numbering is assigned at the last rebase before merge, in merge order
(W1 → W2 → W4 → W6 → W3 → W7 → W8).

| Stream | Migration description | Count | Status |
|--------|----------------------|-------|--------|
| W1 | `provider_accounts` table (oauth state + quota cache, non-secret) | 1 | shipped as v147 on `claude/rework-provider-oauth` (renumber at final rebase) |
| W2 | — (artifacts derive from messages; flag via app_metadata) | 0 | n/a |
| W4 | — (favorites via app_metadata if adopted) | 0 | n/a |
| W6 | `modes` table + seeds; `chats.view_mode` column | 2 | planned |
| W3 | — (none planned) | 0 | n/a |
| W7 | — (endpoint/presets via app_metadata) | 0 | n/a |
| W8 | `wiki_index` cache table (derived, rebuildable) | 1 | planned |
