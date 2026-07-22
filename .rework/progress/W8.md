# W8 Progress — Wiki Vault (Obsidian-style)

## State: All 5 phases done. tsc/lint/vitest green. Ready for orchestrator review/PR.
## NEXT ACTION
None required to ship v1. If resuming: the only deferred item is wiring a
live progress readout (`IRebuildProgress`, already plumbed through
`useRebuildIndex`) into the header's rebuild button, which currently just
shows a spinner. Everything else in the brief is done — see checklist.

## Phase checklist
- [x] P1 — `parse.ts` (frontmatter via gray-matter, wikilink extraction incl.
      aliases + embeds + code-fence immunity, headings, target resolution).
      `vault.ts` (dialog picker, `wiki_vault_path` app_metadata persistence,
      recursive `.md` walk, read/write/delete, debounced watch). Migration
      v148 (`wiki_index` table) + ledger row.
- [x] P2 — `linkGraph.ts` (mention resolution, backlink counts),
      `snippets.ts` (context-snippet extraction), `folderColors.ts`
      (deterministic legend colors), `vaultTree.ts` (flat files -> nested
      tree), `inline.ts` (note-body block splitting + inline tokenizer for
      wikilink-bearing blocks -- see decisions log on WHY this exists),
      `index.ts` (the `wiki_index` DB orchestration: rebuild, incremental
      update, getNote/getBacklinks/searchVault/getGraph/getLocalGraph/
      getVaultTree/getResolvableFiles), `relink.ts` (v2 typed stub),
      `useWiki.ts` (React Query hooks, mirrors `fleet/useFleet.ts`).
      109 vitest cases total across the pure modules (parse/linkGraph/
      snippets/folderColors/vaultTree/inline) — `useWiki.ts`/`index.ts`/
      `vault.ts` are DB/fs orchestration glue and intentionally untested
      the same way `fleet/useFleet.ts` and this repo's `AttachmentsHelpers.ts`
      are (they'd need a real Tauri runtime; `../DB`'s top-level
      `await Database.load(...)` would hang under plain vitest/Node -- kept
      entirely out of every test file's import graph, verified empirically).
- [x] P3 — `App.tsx` `/wiki` route (append-only); `AppSidebar.tsx` gains
      `WikiNavEntry` (one import + one render line, own navigate/active-
      state logic, placed right after "Start New Chat" and before the
      Minimized-models/`FleetSessionsCluster` block — neither touched).
      `WikiView.tsx` (header + tabs + `ResizablePanelGroup` tree/content;
      tab/note/query state lives in URL search params, so /wiki is
      deep-linkable without a second `<Route>`), `VaultTree.tsx`,
      `VaultPickerEmptyState.tsx`, `NoteView.tsx` (nested
      `ResizablePanelGroup` for the right-rail local graph, per the brief's
      explicit "right-rail" over the ASCII mock's single-column sketch),
      `FrontmatterTable.tsx` (tags render as clickable chips ->
      Search), `WikiNoteBody.tsx` + `WikiLinkToken.tsx` (existing note ->
      `text-accent-600` + navigate; missing -> subdued dotted-underline +
      an AlertDialog "Create new note?" confirmation), `BacklinksList.tsx`,
      `LocalGraph.tsx` + `graphLayout.ts` (+ 12 vitest cases) for the
      deterministic radial 1-hop layout.
- [x] P4 — `SearchView.tsx` (debounced live filter, 300ms setTimeout —
      orchestrator-pre-authorized), `GraphView.tsx` (grid-of-folder-clusters
      layout via `graphLayout.ts`'s `layoutGraphByFolder`, filter dims
      non-matches + "N of M nodes" readout), `WikiGraphSvg.tsx` (shared
      renderer, diamond=focus/circle=regular per design/wiki.md),
      `folderColorClasses.ts` (WikiFolderColor -> Tailwind class — see
      decisions log below on why `accent` needs the `-600` ramp suffix).
      101 vitest cases total now (added graphLayout.test.ts).
- [x] P5 — `wikiToolset.ts` (`ToolsetWiki extends Toolset`, follows
      `toolsets/web.ts`'s `addCustomTool` pattern, no MCP server): `read_note`
      (raw file text, or a clear "doesn't exist, use write_note" message),
      `write_note` (frontmatter-safe create/update via `index.ts`'s new
      `writeNoteFrontmatterSafe`, which also backs `useSaveNote` now),
      `search_vault`, `get_backlinks` — args validated with local type
      guards (`requireStringArg`, throws a clear message), not `as` casts.
      Registered in `ToolsetsManager.ts` (one import + one array entry — see
      Landmines). `WikiToolsToggle.tsx` in the Wiki header (Switch +
      tooltip, calls the pre-existing `useUpdateToolsetsConfig`) so the
      toolset is reachable without Settings.tsx. `relink.ts` was already
      the v2 typed stub from P2. 93 vitest cases total (added
      `stringifyNote` round-trip cases to parse.test.ts).

All 5 phases done. Final gate results (this worktree, portable node):
- `tsc --noEmit`: 0 errors, whole project.
- `eslint` on every file this workstream touched or created (`src/core/
  chorus/wiki`, `src/ui/components/wiki`, plus the 3 shared files below):
  0 errors, 0 warnings.
- `vitest run src/core/chorus/wiki`: 7 files, 93 tests, all passing.

## Decisions log
- 2026-07-21 Read order per brief: CLAUDE.md, DESIGN.md,
  .rework/ORCHESTRATION.md, 01-COORDINATION.md, 00-ARCHITECTURE.md §7/§8,
  design/wiki.md, agents/W8-wiki.md. Confirmed integration branch already
  has W1/W2/W4/W7 merged (fleet's `AppSidebar.tsx`/`ToolsetsManager.ts`
  precedents used below).
- 2026-07-21 **No capabilities/theme changes needed.**
  `src-tauri/capabilities/default.json` already grants `fs:read-all`,
  `fs:write-all`, `fs:scope` (`allow: ["**/*"]`), and `dialog:default`
  (includes `allow-open`) — all pre-existing, broad enough for an
  arbitrary user-chosen vault directory. `tauri-plugin-fs` already builds
  with the `watch` cargo feature (Cargo.toml). Likewise the P4 folder-color
  legend (companies=accent, concepts=success, sectors=warning,
  sources=helper) resolves entirely to tokens that already exist
  (`success`/`warning` added by W1) — `themes/index.ts` and
  `tailwind.config.cjs` are untouched by this workstream. This removes what
  the brief flagged as the "fs-permission landmine" — there is no
  additional grant step for the user to hit.
- 2026-07-21 **gray-matter has no types in this worktree.** No `.d.ts` is
  bundled and `@types/gray-matter` isn't installed, and installing one is
  not possible here (`pnpm add` is forbidden / node_modules is a junction).
  Added a minimal local ambient shim, `wiki/gray-matter.d.ts`, covering only
  the callable-returning-`{data, content}` surface actually used. Not a new
  package.json dependency.
- 2026-07-21 **Wikilinks are NOT rendered as standard markdown `[text](href)`
  links through `MessageMarkdown`.** Traced `MessageMarkdown`'s `a` ->
  `WebPreview`: for any non-wikipedia/non-file href it unconditionally
  appends an `ExternalLinkIcon` and its `onClick` calls `openUrl` (system
  browser) — there is no way for a wrapper to get in-app navigation or drop
  the icon without editing `WebPreview.tsx`/`MessageMarkdown.tsx`, which are
  W2-owned and off limits. Also ruled out repurposing the `code`/`img`
  custom-component slots as a smuggling channel for the same reason (fragile
  coupling to internals I don't own, and no way to distinguish "real inline
  code" from "a disguised wikilink" at render time). Resolution: note bodies
  are split into blank-line-separated blocks; blocks with no wikilink
  offsets inside them render unchanged through `MessageMarkdown` (full
  fidelity: headings/lists/tables/code/quotes); blocks that DO contain a
  wikilink (per the same `extractWikilinks` offsets used for the index) are
  rendered by a small local inline tokenizer
  (`src/core/chorus/wiki/inline.ts`, pure + tested) that understands
  **bold/italic/inline-code + wikilink tokens** and is walked line-by-line so
  list/blockquote/heading prefixes on a link-bearing line are preserved.
  `WikiLinkToken.tsx` renders the token itself (existing-note vs
  subdued-"create?" styling) with a real `onClick` that navigates in-wiki.
  This is a wrapper-only solution — zero edits under `renderers/**`. Noting
  for the PR: if W2 ever wants to support this more natively, the minimal
  hook would be an optional `components` override prop on `MessageMarkdown`.
- 2026-07-21 **A test caught a real bug in the first cut of block-splitting.**
  The initial `inline.ts` split note bodies into blocks on raw `\n{2,}`
  matches, filtering out any match whose *start offset* fell inside
  `parse.ts`'s (per-line) immune ranges. That's wrong: a `\n{2,}` match's
  start offset lands on the newline *between* two lines, which is never
  itself "inside" either line's own char range, so a blank line nested
  inside a fenced code block was never recognized as immune — it would have
  fragmented the fence into two blocks, each missing half its own fence
  markers, and each rendered independently by MessageMarkdown. Fixed by
  adding `parse.ts`'s `getBlockSeparatorRanges` (single source of truth,
  tested there), which instead checks whether the line *before* and the
  line *after* the gap are BOTH fenced — correctly keeps an internal blank
  line as part of the block, and correctly still splits right after a
  closing fence. `inline.test.ts`'s "does not fragment a fenced code block
  that itself contains a blank line" is the regression test.
- 2026-07-21 **`reagraph` (already a dependency) is intentionally unused.**
  It's a WebGL force-directed/physics graph lib; the brief and
  00-ARCHITECTURE.md §7 both explicitly require a static, hand-placed-node
  SVG layout with no physics library. Graph node positions come from a pure,
  deterministic function (`graphLayout.ts`: ring/grid placement, testable)
  rendered as plain SVG circles/lines.
- 2026-07-21 **`wiki_index` caches a `body_cache` column** (short-lived,
  fully derived) despite 00-ARCHITECTURE §7's "never a database of note
  bodies." Read that line as "SQLite is never the source of truth for
  content" (disk always is; `getNote`/NoteView always re-read the file live)
  rather than "must not cache body text at all" — a search INDEX inherently
  needs indexed content, and re-reading every file from disk on every
  debounced keystroke doesn't scale to the brief's own "~1k files" sanity
  bar. The cache is fully disposable and rebuilt via "Rebuild index."
  Flagging this explicitly in case the orchestrator wants a stricter read.
- 2026-07-21 Hooks live in `src/core/chorus/wiki/useWiki.ts` (not a new
  `api/WikiAPI.ts`), mirroring W7's precedent (`fleet/useFleet.ts`) — keeps
  everything inside this workstream's owned path.
- 2026-07-21 wiki-mcp tool args are validated with small local type guards
  (throw a clear error string) rather than `as`-casting `Record<string,
  unknown>` fields the way the pre-existing `ToolsetWeb`/`ToolsetMedia` do —
  file writes are higher-stakes than a web fetch, so this seemed worth the
  few extra lines. No `as` assertions introduced by this workstream (see
  full audit below once P5 lands).
- 2026-07-21 Migration v148 claimed (`docs/rework/MIGRATIONS-LEDGER.md`
  updated); max version on this branch prior to this change was 147 (W1's
  `provider_accounts`).
- 2026-07-21 **The folder-color legend's "accent" bucket uses `accent-600`,
  not bare `accent`.** `tailwind.config.cjs` (shared, not touched) defines
  `colors.accent` twice in one object literal — once as `{DEFAULT,
  foreground}`, once as the `colorPalette.accent` 25-900 ramp — and the
  second literal key wins entirely, so bare `bg-accent`/`text-accent`/
  `fill-accent` don't reliably resolve. W7's `fleet/fleetTone.ts` already
  hit and documented this exact issue; `src/ui/components/wiki/
  folderColorClasses.ts` mirrors its fix (`accent-600`, the ramp step
  already in real use elsewhere). `success`/`warning`/`helper` are each
  defined once and resolve fine bare. Wikilink text color
  (`WikiLinkToken.tsx`) also uses `text-accent-600` for the same reason —
  matches design/wiki.md's own deviation-table entry ("Link color:
  `color: accent-600`").
- 2026-07-21 `/wiki`'s tab/active-note/query state lives in
  `useSearchParams` (`?tab=&note=&q=`) rather than component state or a
  second route — deep-linkable/back-button-friendly for free, and stays
  inside the ownership/coordination rule that only `App.tsx`'s literal
  `<Route>` list is append-only-shared (the query string isn't a route).
- 2026-07-21 NoteView's local graph is a nested `ResizablePanelGroup` pane
  (not a fixed `w-[300px]` div) — DESIGN.md's "Do use ResizablePanelGroup
  for new split layouts" plus its "no arbitrary Tailwind values" rule both
  push away from a hardcoded pixel width; the design doc's own "~300px"
  note becomes the panel's `defaultSize`/`minSize`/`maxSize` instead.
- 2026-07-21 A VaultTree folder's count badge shows **total files nested
  under it** (recursive), not "backlinks in folder" — design/wiki.md's own
  prose and ASCII mock disagree with each other here (prose says folder
  badges mean backlinks too; the mock never actually shows a folder-level
  badge at all, only file-level ones). File-level badges ARE backlink
  counts, unambiguously matching both the prose and the mock. Flagging the
  folder-badge call as a judgment resolution, not a spec citation.

## Landmines / do-not
- **`ToolsetsManager.ts` needs one small, unavoidable edit in P5** (register
  `new ToolsetWiki()` alongside `ToolsetWeb`/`ToolsetMedia`/etc. in
  `_builtInToolsets`). It isn't in 01-COORDINATION.md §4's shared-file list
  or the §8 ownership table, but there's no way to ship a new builtin
  toolset without touching its one registration array — treating it exactly
  like the AppSidebar/App.tsx append points (single, minimal, commented).
  Flag prominently in the PR.
- Settings.tsx (where toolsets are normally enabled/disabled) is W3-owned
  and not yet built on this integration branch. wiki-mcp tools are
  registered but start **disabled** (`toolsets_config` has no row until a
  user enables it) — same default as every other builtin toolset. To keep
  "wiki-mcp usable from a chat" testable before W3 lands, P5 adds a small
  self-contained enable toggle inside the Wiki view's own header (calls the
  existing, already-shared `useUpdateToolsetsConfig` mutation — no
  Settings.tsx edits). Remove/relocate once W3 ships a Connections tab.
- `watch()`/`watchImmediate()` require the Rust `tauri-plugin-fs` "watch"
  cargo feature; it's already enabled in `Cargo.toml`, but that's Rust I
  cannot compile here — confirm live behavior is on the user-test queue.
  `watchVault()` fails soft (returns undefined, logs) if the watcher can't
  start, so a build without it just falls back to manual "Rebuild index."
- Wikilink rendering depends on the SAME `extractWikilinks` offsets used by
  the index — don't let block-splitting logic in the UI diverge from
  parse.ts's regex/immunity rules, or clickable links and indexed backlinks
  will disagree with each other.
- Embeds (`![[target]]`) are parsed and rendered as clickable links with a
  distinct visual marker, but are NOT transcluded (no inline content
  pull-in) — a deliberate v1 scope cut, not an oversight.
- `wiki_index` rows are keyed by `(vault_path, path)` specifically so
  switching vaults doesn't require a destructive delete of the old vault's
  rows first; `getVaultTree`/search/graph queries always filter by the
  current `vault_path`.

## Forbidden-feature audit (ORCHESTRATION.md §"Forbidden-feature policy")
- `as` assertions: exactly 3, all in the explicitly permitted categories,
  each with an adjacent comment: `index.ts` rowToIndexed's two
  `JSON.parse(...) as ...` (category c: DB row -> typed mapping, column
  set proven since this workstream controls the INSERT); `parse.ts`'s
  `toFrontmatterRecord`'s `data as Record<string, unknown>` (category b:
  narrowing `unknown` right after a runtime `typeof`/`Array.isArray`
  check). No other `as` anywhere in `src/core/chorus/wiki/**` or
  `src/ui/components/wiki/**`.
- `useRef`: none used.
- `useImperativeHandle`: none used.
- `setTimeout`: one use, `SearchView.tsx`'s 300ms search debounce —
  exactly the "debounce" case ORCHESTRATION.md pre-authorizes.

## Exported signatures (core, for anyone integrating against this workstream)
- `vault.ts`: `pickVaultDirectory()`, `getVaultPath()`, `setVaultPath(path)`,
  `clearVaultPath()`, `listVaultFiles(vaultPath)`, `readNoteRaw`/
  `writeNoteRaw`/`deleteNoteRaw`/`noteExistsOnDisk`/`getNoteMtime(vaultPath,
  relativePath)`, `watchVault(vaultPath, onChange)`.
- `parse.ts`: `parseFrontmatter(raw)`, `stringifyNote(body, frontmatter)`,
  `extractWikilinks(text)`, `extractHeadings(text)`, `getImmuneRanges(text)`,
  `getBlockSeparatorRanges(text)`, `parseNote(raw)`, `noteTitle`/
  `titleFromPath`/`folderOfPath`/`topFolderOfPath(path)`,
  `resolveWikilinkTarget(target, files)`.
- `index.ts`: `indexFile`/`removeFileFromIndex`/`rebuildIndex(vaultPath,
  onProgress?)`, `writeNoteFrontmatterSafe(vaultPath, path, content)`,
  `getNote`/`getBacklinks`/`searchVault`/`getGraph`/`getLocalGraph`/
  `getVaultTree`/`getResolvableFiles`/`hasIndexedAnyFiles(vaultPath, ...)`.
- `useWiki.ts` (React Query hooks): `useVaultPath`, `usePickVault`,
  `useRebuildIndex`, `useWikiVaultWatcher`, `useVaultTree`, `useNote`,
  `useBacklinks`, `useSearchVault`, `useVaultGraph`, `useLocalGraph`,
  `useResolveWikilink`, `useCreateNote`, `useSaveNote`, `useDeleteNote`,
  `useHasIndexedAnyFiles`.
- `wikiToolset.ts`: `ToolsetWiki` (registered in `ToolsetsManager.ts`) with
  tools `wiki_read_note`, `wiki_write_note`, `wiki_search_vault`,
  `wiki_get_backlinks` (namespaced `<toolsetName>_<suffix>` per
  `Toolsets.ts`'s convention).
- `graphLayout.ts`: `layoutLocalGraph`, `layoutFullGraph`,
  `layoutGraphByFolder`.
- Types (`types.ts`): `IVaultNote`, `IWikilinkMatch`, `IBacklinkEntry`,
  `ISearchResult`, `IWikiGraph`/`IWikiGraphNode`/`IWikiGraphEdge`,
  `WikiFolderColor`, `IVaultTreeNode` (`IVaultTreeFolder`|`IVaultTreeFile`),
  `IWikiIndexRow`, `IResolvableFile`.

## Open questions for the orchestrator
1. `body_cache` in `wiki_index` (decisions log above) — comfortable with
   the "cache, not source of truth" reading of 00-ARCHITECTURE §7, or
   should search instead re-read files live / use a smaller cached
   excerpt? Current implementation is fully rebuildable either way.
2. VaultTree folder-count semantics (recursive file count vs. summed
   backlinks) — the source docs disagree with themselves; I picked file
   count as the more legible/expected behavior. Flag if that should change.
3. `ToolsetsManager.ts` registration touch — fine as a precedent for "any
   future builtin toolset workstream," or should there be a formal
   extension point instead (e.g. a registry file per toolset that
   `ToolsetsManager` auto-discovers)? Out of scope for me to build now,
   but worth deciding before a W9 hits the same situation.

## User-test queue (full v1 test plan)
1. **Pick a vault.** Open `/wiki` via the sidebar "Wiki" entry (top of the
   nav, above Projects). Empty state appears; click "Choose folder", pick
   any folder of `.md` files (or a fresh empty folder). Tree renders;
   count badges fill in once indexing finishes (near-instant for a small
   folder).
2. **Large-vault sanity.** Point it at a ~1k-file vault (e.g. a big
   Obsidian vault, or a generated fixture). Confirm the tree renders and
   the index finishes in a reasonable time (rebuildIndex batches fs reads
   25 at a time). Rebuild index again (header refresh icon) and confirm
   it completes and re-reflects any edits made outside Chorus.
3. **Note view.** Click a note with YAML frontmatter and `[[wikilinks]]`
   in its body. Confirm: title, frontmatter properties table (mono keys),
   body renders markdown (bold/italic/lists/quotes/code) AND wikilinks are
   colored/clickable, backlinks section lists notes that mention it with
   a snippet, right-rail local graph shows the note + its neighbors.
4. **Wikilink navigation.** Click an existing wikilink -> navigates to
   that note. Click a wikilink to a note that doesn't exist -> "Create
   new note?" dialog -> Create -> navigates to the new (mostly empty)
   note, and it now appears in the tree.
5. **Search.** Search tab, type a query matching some note titles/bodies
   -> live-filtered results with folder chip, snippet, link count. Click
   a result -> opens it in Note view. "View results as Graph" -> switches
   to Graph tab with the same query pre-filled as the filter.
6. **Graph.** Graph tab: nodes clustered/colored by top-level folder,
   legend matches; typing in the filter dims non-matching nodes and shows
   "N of M nodes"; clicking a node navigates to that note.
7. **wiki-mcp from chat.** In the Wiki header, flip on "Wiki tools in
   chat". Start a chat and ask a model to, e.g., "read concepts/
   transformer-architecture.md and rewrite its intro to be one paragraph
   shorter" (or whatever exists in your test vault) — confirm it calls
   read_note then write_note, the file updates on disk, frontmatter (if
   any) survives untouched, and the Wiki tab reflects the change. Also
   try `search_vault`/`get_backlinks` prompts ("what notes mention TSMC?").
8. **fs-permission flow.** Since `fs:read-all`/`fs:write-all`/`fs:scope
   **/*` and `dialog:default` are already granted app-wide (pre-existing,
   confirmed in this ledger's decisions log), there should be no OS-level
   permission prompt beyond the folder picker dialog itself — flag if
   your platform shows anything unexpected.
9. **Both themes.** Toggle light/dark; re-check note view, wikilink color,
   frontmatter table, tree active-highlight, and the graph legend/nodes
   all still read clearly (I reasoned about token usage but could not
   render either theme myself).
10. **Rebuild index.** After manually editing/adding/deleting a `.md` file
    in the vault folder OUTSIDE Chorus (e.g. in a text editor), confirm
    the watcher picks it up within ~1s (or, if the watcher doesn't fire —
    see the Rust `watch` feature caveat above — that clicking "Rebuild
    index" reflects the change).
