# W8 — Wiki Vault (Obsidian-style)

Branch: `claude/rework-wiki` · Worktree: `../chorus-wt-w8`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §7 (your frozen contract),
`docs/rework/design/wiki.md`, then this file.

## Mission

A Wiki surface over a user-chosen **local directory of Markdown files**
(Obsidian conventions: YAML frontmatter, `[[wikilinks]]`): vault tree, note
view with properties + backlinks + local graph, search, full graph view, and
a **wiki-mcp** builtin toolset so models can read/write the vault from chat.
Files on disk are the truth; SQLite holds only a rebuildable index cache.

## Context you must load before coding

- Tauri fs usage precedents: `renderers/HTML.tsx` imports of
  `@tauri-apps/plugin-fs`, `AttachmentsHelpers.ts`; capabilities files for
  fs scope patterns (vault dir must be user-granted, scoped, persisted).
- `Toolsets.ts` — builtin toolset pattern (how MediaTools/WebTools register);
  wiki-mcp follows it. `src/core/chorus/WebTools.ts` as reference.
- `MessageMarkdown.tsx` — you'll reuse it for note body rendering, extending
  link handling for wikilinks (coordinate: renderers are W2-owned — implement
  wikilink rendering via a wrapper component in `src/ui/components/wiki/`,
  not by editing renderers; if a hook in MessageMarkdown proves unavoidable,
  make it a single optional prop and flag it to W2 via PR note).
- `AppSidebar.tsx` — Wiki nav entry insertion (minimal; rebase-coordinate
  with W7's sessions cluster).
- Search precedent: `api/SearchAPI.ts`.
- Frontmatter/markdown parsing: prefer battle-tested deps (`gray-matter`,
  existing remark stack) over hand-rolling; note additions in PROGRESS.md.

## Phases

**P1 — Vault core.** `src/core/chorus/wiki/vault.ts` (pick directory via
dialog, persist `wiki_vault_path` app_metadata, walk + watch), `parse.ts`
(frontmatter, wikilinks, headings). Pure parse logic fully unit-tested
(vitest) — links with aliases `[[a|b]]`, embeds, code-fence immunity.

**P2 — Index.** `index.ts`: link graph, backlinks with context snippets,
search index in a `wiki_index` SQLite cache table (migration, ledger entry;
derived data only — a "Rebuild index" action must fully regenerate it).
Incremental update on file events.

**P3 — Tree + note view.** `/wiki` route (append-only). Vault tree per
`design/wiki.md` (folders with counts, mono file rows, active highlight);
note view: title, frontmatter properties table (mono keys, e.g. type/ticker/
mcap/updated/revisions), rendered body with clickable wikilinks (navigate
in-wiki; missing note → subdued "create?" affordance), backlinks section
with context snippets, right-rail local graph (static SVG, 1-hop, design's
hand-placed-node aesthetic — no physics lib).

**P4 — Search + graph views.** Search view (query input, results: file path,
folder chip, snippet, link count; live filter). Full graph view: folder
color legend (companies=accent, concepts=success, sectors=warning,
sources=helper — via semantic tokens), filter query dims non-matches
("N of M nodes" mono readout), click navigates.

**P5 — wiki-mcp.** Builtin toolset: `read_note`, `write_note` (create/
update, frontmatter-safe), `search_vault`, `get_backlinks`. Write path goes
through vault.ts (never raw fs), respects the watch/index loop. This powers
the design's "Transformer wiki rewrite" chat flow; relink suggestions
(orphan mentions / merge / rename queue) are **v2** — leave the seam in
`relink.ts` as a stub with types.

## Out of scope (v1)

Git sync (seam noted in vault.ts), relink queue UI, graph physics, non-md
attachments in vault, multi-vault.

## Resumability specifics

- P1/P2 pure logic + tests → instantly adoptable.
- Views land one per commit behind the /wiki route; app untouched otherwise.
- Landmine to document as you go: fs-scope permission grants (capabilities
  changes are shared-append files).

## Done means

Pick vault → tree renders; notes render with properties, working wikilinks,
backlinks; search + graph functional on the index; wiki-mcp tools usable
from a chat (user test: "rewrite concepts/transformer-architecture.md
intro"); index rebuildable; migrations ledgered; both themes; lint/build
green; PR with test plan incl. large-vault (~1k files) sanity and
fs-permission flow.
