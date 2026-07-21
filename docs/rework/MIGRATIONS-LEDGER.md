# Migrations Ledger

Claimed migrations across rework branches. Protocol: `01-COORDINATION.md` §5.
Add a row (in your branch) when you introduce a migration; final integer
numbering is assigned at the last rebase before merge, in merge order
(W1 → W2 → W4 → W6 → W3 → W7 → W8).

| Stream | Migration description | Count | Status |
|--------|----------------------|-------|--------|
| W1 | `provider_accounts` table (oauth state + quota cache, non-secret) | 1 | **integrated as v147** on `claude/rework` |
| W2 | — (artifacts derive from messages; flag via app_metadata) | 0 | n/a |
| W4 | — (favorites via app_metadata: `pinned_model_config_ids`) | 0 | n/a |
| W6 | `modes`/`chat_modes` tables + `message_sets.mode_id` seed; `chats.view_mode` + `messages.grades_json` | 2 | **integrated as v148, v149** on `claude/rework` |
| W3 | — (none planned) | 0 | n/a |
| W7 | — (endpoint/presets via app_metadata: `fleet_endpoint`, `fleet_cost_preset`) | 0 | n/a |
| W8 | `wiki_index` cache table (derived, rebuildable) | 1 | **integrated as v150** on `claude/rework` (was v148 on branch; renumbered at merge to avoid W6 collision) |
