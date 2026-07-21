# W2 Progress — Inline Artifacts

## State: P4 — MultiChat wiring landed (tsc/lint/vitest green); ready for P5 polish

## NEXT ACTION
Do P5 (versions + polish). Concretely, in order:
1. **Chronological cross-message ordering.** `collectChatArtifacts.ts`
   currently orders by message-SET iteration order (whatever order
   `messageSetsQuery.data` comes back in, which is presumably already
   creation-order from `fetchMessageSets`'s SQL, but this hasn't been
   explicitly verified against `messages`/`message_sets` table `ORDER BY`
   clauses in MessageAPI.ts — check `fetchMessageSets`'s SQL there first).
   Within a single message SET, `messagesFromSet()` currently orders by
   block-kind (chatBlock, then toolsBlock, then compareBlock, then
   brainstorm) rather than by actual message timestamp — if a set's
   `compareBlock.synthesis` message was created AFTER its `toolsBlock`
   siblings chronologically (likely, since synthesis runs after the
   compared responses), the current order doesn't reflect that. Decide
   whether this matters enough to fix (probably: add each message's own
   `createdAt`/ordering field if `Message` exposes one — spot-checked
   ChatState.ts's `Message` interface and it does NOT currently carry a
   timestamp field, only `MessageSet.createdAt` does — so true per-message
   chronological sort may require joining back to `MessageSet.createdAt`
   plus a stable tiebreaker, OR accepting message-set-order as "good
   enough" chronological granularity for v1 and only reordering block-kinds
   within a set by removing the artificial chat/tools/compare/brainstorm
   grouping bias). RECORD the decision either way — this is exactly the
   kind of thing that's easy to get subtly wrong without being able to run
   the app with real multi-model compare/brainstorm data.
2. **Regeneration append verification.** Confirm (by reading, since this
   can't be run) that when a message is regenerated/restarted
   (`useRestartMessage` in MessageAPI.ts), the OLD message row is preserved
   (new message, old kept, both present in `messageSetsQuery.data`) rather
   than being overwritten in place — `collectChatArtifacts` only produces
   an "immutable log" naturally if the underlying data already is one. If
   regeneration mutates the existing message row in place instead of
   creating a new one, the "regeneration appends, never overwrites" design
   requirement isn't actually satisfiable from data alone and needs a
   different approach (e.g. tracking a version history separately) — this
   is a case where reading `useRestartMessage`'s implementation matters
   more than writing code; report back if this reveals a real gap rather
   than silently working around it.
3. **`esc` closes panel when focused.** Add a `keydown` listener (window
   level, mirroring `ArtifactPanel`'s own existing fullscreen-escape effect)
   that closes the panel — needs to NOT fire when a text input inside the
   panel has focus (there currently isn't one, so this is low-risk) and
   needs to not fight with `ArtifactFrame`'s sandboxed iframe (key events
   inside a cross-origin-opaque iframe do NOT bubble to the parent window,
   so this is naturally scoped to the panel chrome, not the artifact's own
   content — verify this reasoning holds, don't just assume).
4. **Reduced-motion.** Audit `ArtifactPanel.tsx`'s `fullscreen` CSS toggle
   (currently `fixed inset-0 z-50`, no transition classes added at all —
   so there's nothing to guard yet) and `ArtifactFrame.tsx`'s
   `RetroLoadingBar` (this animates via `setInterval` regardless of
   `prefers-reduced-motion` — decide whether to skip/simplify it under
   reduced motion, e.g. render a static "Loading…" label instead via a
   `useMediaQuery`-style check; there's no existing reduced-motion hook in
   the codebase to reuse — search for one before writing a new one).
5. **Per-model attribution pill polish** — revisit the P3 decision that the
   model pill shows `IArtifact.modelName` verbatim: now that P4 actually
   resolves a display name via `modelConfigsQuery.data?.find(...)
   ?.displayName ?? modelId` in MultiChat.tsx (see `chatArtifacts`'s
   `useMemo` there), verify this reads naturally in the header (falls back
   to the raw model id string when a config lookup misses, e.g. for a
   since-removed/renamed model — acceptable but worth a glance).
Also carry forward from P3/P4 (not strictly "P5" but unresolved):
   `openArtifactWindow.ts` is untested end-to-end (see User-test queue);
   CodeBlock's `onOpenPreview` prop exists but has no caller anywhere yet
   (see Decisions log) — wiring it is optional polish, not required for
   "Done means".

## Phase checklist
- [x] P1 — Core extraction (pure TS, no UI): `types.ts` + `extract.ts` +
      `extract.test.ts` (43 tests, all green). `tsc --noEmit` green for new
      files (one PRE-EXISTING unrelated repo error, see Landmines).
- [x] P2 — `ArtifactFrame.tsx` (iframe sandbox, CSP already-injected via P1's
      `document`, error bridge, external-link interception, refresh-via-key)
      + `registry.ts` (`registerArtifactRenderer`/`getArtifactRenderer`) +
      `MermaidArtifactRenderer.tsx` + `defaultRenderers.ts`. All dead code
      (nothing imports this subtree yet) — safe, inert until P3/P4.
- [x] P3 — `ArtifactPanel.tsx` (header: close/title/model-pill/overflow-menu
      [copy, download, open-in-window, reload-preview]/fullscreen; tabs row:
      Preview/Code + version stepper "vN of M"; content dispatches through
      the P2 registry; empty state; unsupported-kind fallback). Supporting
      files: `downloadArtifact.ts` (save dialog + fs write, saves
      `artifact.code` not `artifact.document`), `openArtifactWindow.ts` +
      `ArtifactWindowView.tsx` + ONE new appended route
      (`/artifact-window`) in App.tsx for "open in window" (see Decisions
      log for why). Still dead code — nothing outside this subtree imports
      `ArtifactPanel` yet except the new App.tsx route (which is inert
      until something actually opens such a window).
- [x] P4 — MultiChat wiring. Two commits (prep, then the actual mount) per
      the resumability convention — see the git log; the MultiChat.tsx diff
      itself is ONE commit, +58/-0 lines, purely additive (verified via
      `git diff --stat`). See Landmines for exact line ranges.
- [ ] P5 — Versions + polish (chronological ordering, attribution pill,
      regeneration append, esc-to-close, reduced-motion)   <- current

## Decisions log
- 2026-07-21 `IArtifact.modelName` kept as required `string` (not `string |
  undefined`) to match architecture §3.1's frozen shape literally
  (`id, messageId, chatId, modelName,` — no `?`). This is a deliberate
  deviation from CLAUDE.md's general "prefer undefined" rule, justified
  because the frozen contract is explicit and callers (MultiChat) always
  know the model name for a model-authored message.
- 2026-07-21 `IArtifact.createdAt` is extraction-time (`new Date()` at call
  time), NOT the message's own timestamp — `extractArtifacts(text, meta)`'s
  signature per the brief takes only `{messageId, chatId, modelName}`, no
  timestamp. Documented in types.ts: callers needing cross-message
  chronological ordering (P5) must sort by the message's own `createdAt`,
  and MUST memoize `extractArtifacts` per message (`useMemo` keyed on
  messageId+text) so id/createdAt stay referentially stable across
  re-renders — this will matter a lot once P4 wires this into MultiChat's
  render loop.
- 2026-07-21 `IArtifact.id` is deterministic: `` `${messageId}:artifact:${index}` ``
  (index = order of appearance after grouping), NOT a random UUID. Required
  for React keys / version-list stability across re-extraction of the same
  message text.
- 2026-07-21 mermaid is a supported v1 kind per architecture §3.1's mission
  line ("v1 ships html/svg/mermaid kinds"), but is NOT rendered through
  `ArtifactFrame`/iframe — planned to render via the EXISTING
  `MermaidPreview` React component (`renderers/Mermaid.tsx`) directly,
  dispatched through the P3 `registerArtifactRenderer` seam. Rationale:
  mermaid needs the mermaid.js runtime; bundling/inlining it into a
  `connect-src 'none'` sandboxed iframe (no CDN allowed) is unnecessary
  complexity when a safe, already-battle-tested React renderer exists and
  mermaid source has no script-injection risk. `IArtifact.document` for
  mermaid artifacts is therefore just `code` (not iframe-consumed in v1).
  NOT YET IMPLEMENTED — the registry lives in P2/P3, this is a forward note.
- 2026-07-21 Fence-grouping "consecutive" semantics (open-webui heuristic,
  since the reference clone at /tmp/artifact-research/ was gone and had to be
  re-derived from the brief's digest): an `html` fence opens a group;
  immediately-following `css`/`js` fences merge into it even across
  intervening prose (not requiring zero characters between fences); ANY
  OTHER fence type (a second `html`, `svg`, `mermaid`, or an unrelated
  language like `python`) flushes/closes the current group. A `css`/`js`
  fence with no open group is dropped silently (never forms its own
  artifact). Fully covered by extract.test.ts's "fence grouping" describe
  block — read those tests before changing groupFences() in extract.ts.
- 2026-07-21 `tauri.conf.json`'s `app.security.csp` is already `null` (no
  Tauri-level CSP restriction on the webview), so `<iframe srcdoc>` is not
  blocked by any app-level CSP — verified by reading the file; NO CHANGE
  NEEDED for srcdoc/frame-src. If a later phase discovers otherwise (e.g.
  the webview's default policy blocks `srcdoc` differently on macOS
  WebKit), flag it here before editing the file (shared/append-only zone).
- 2026-07-21 No new dependencies added in P1. `@tauri-apps/api` 2.5.0 is
  already a dependency and exposes `WebviewWindow` at
  `@tauri-apps/api/webviewWindow` for the P3 "open in window" action — no
  package.json change needed for that either.
- 2026-07-21 `useRef`/`setTimeout` not yet used (P1 is pure TS, no UI). Will
  be used in P2 (iframe DOM ref, per orchestrator pre-authorization) — will
  log the specific call sites here when added. No `as` assertions used in
  P1.
- 2026-07-21 (P2) `useRef<HTMLIFrameElement>` used in `ArtifactFrame.tsx`
  solely to compare `event.source === iframeRef.current?.contentWindow` in
  the postMessage handler, so error/link messages are attributed to THIS
  artifact's own frame — pre-authorized per ORCHESTRATION.md ("DOM refs ...
  iframe handles"). No `setTimeout` used. No `as` assertions — postMessage
  payloads are narrowed via `typeof`/`in` type guards instead
  (`isArtifactFrameMessage`/`describeErrorPayload`/`getHrefFromPayload`),
  deliberately avoiding the `as { type: string; payload: unknown }` pattern
  `renderers/HTML.tsx` uses for the same kind of data.
- 2026-07-21 (P2) mermaid rendering decision implemented: registered
  `MermaidArtifactRenderer` (wraps the existing `renderers/Mermaid.tsx`
  `MermaidPreview`) for kind "mermaid" in `defaultRenderers.ts`, confirming
  the P1 forward-note. `getArtifactRenderer("chart"|"table")` returns
  `undefined` in v1 — `ArtifactPanel` (P3) renders an "unsupported kind"
  fallback for those.
- 2026-07-21 (P3) "Open in window" implemented via a dynamically-created
  `WebviewWindow` (`@tauri-apps/api/webviewWindow`, already a dependency —
  `core:webview:allow-create-webview-window` is ALREADY granted in
  `src-tauri/capabilities/default.json`, confirmed by reading the file, so
  NO capability/Rust change was needed). The new window has no shared JS
  memory with the main window, so instead of serializing the (potentially
  large) assembled document through a URL/IPC, the new window is pointed at
  a new appended route `/artifact-window?messageId=...&artifactId=...`
  (`ArtifactWindowView.tsx`) that re-fetches the source message via the
  already-exported `MessageAPI.fetchMessage` and re-runs the same pure
  `extractArtifacts` to reconstruct the identical artifact (ids are
  deterministic — see P1's id-stability decision — so this always finds the
  same one). This is the "derivation, not storage" philosophy applied one
  level up. **UNTESTED against a running app** (cannot run Tauri here) —
  flagged prominently in the user-test queue below; if it doesn't work, the
  most likely failure points are (a) window label collisions if the
  sanitized label isn't unique enough, (b) the `url` resolution for a
  dynamically created window pointing at an app-relative path vs. needing a
  full origin — see `WebviewOptions.url`'s doc comment in
  `node_modules/@tauri-apps/api/webview.d.ts:381-389`, which says a route
  like `/path` is appended to the app's base URL, which should be correct,
  but has not been runtime-verified.
- 2026-07-21 (P3) `App.tsx` changes (append-only per coordination §4): added
  one import (`ArtifactWindowView`), one `<Route path="/artifact-window">`
  entry (end of the `<Routes>` list), one derived `isArtifactWindow` const
  (`location.pathname === "/artifact-window"`, reusing the already-
  destructured `location` from `useLocation()` at line ~136), and threaded
  that const into the THREE existing `!isQuickChatWindow && ...` chrome
  conditionals (`AppSidebar`, `CommandMenu`, `Settings`) so the detached
  artifact window doesn't render the full app shell. Nothing else in
  App.tsx touched; did not modify `isQuickChatWindow`/AppProvider.tsx at
  all (kept the diff local to App.tsx).
- 2026-07-21 (P3) Download saves `artifact.code` (clean source), never
  `artifact.document` (carries our CSP meta + postMessage bridge, meaningless
  outside our own sandboxed iframe). svg kind gets wrapped in a minimal
  standalone (CSP-free, bridge-free) HTML shell before saving so it opens
  correctly in a real browser; mermaid kind saves as `.mmd` (raw diagram
  source) instead of mislabeling it `.html`, despite the design copy's
  generic "Download as .html" — v1's mermaid artifacts were never HTML to
  begin with.
- 2026-07-21 (P3) Footer provenance line (artifacts.md's "src: 8 × 10-Q ·
  tool: financial-lookup" example) was OMITTED for v1 — there is no real
  source/tool metadata attached to an `IArtifact` yet (that's W6
  fused-pipeline/tool-output territory per architecture §3.1's non-goals),
  so a footer would either be empty or fabricated. Revisit once a producer
  actually populates such metadata.
- 2026-07-21 (P3) Model pill renders `IArtifact.modelName` verbatim (both as
  the `ProviderLogo`'s `modelId` — for provider-icon inference — and as the
  visible label text). If P4's wiring passes a raw internal model id rather
  than a friendly display name, the pill will look less polished; P4 should
  prefer passing a display name if one is readily available at the
  `extractArtifacts` call site, since `IArtifact.modelName` has no separate
  display-name field per the frozen §3.1 shape.
- 2026-07-21 (P4) Chose to compute the chat's artifact list via a NEW pure
  helper (`collectChatArtifacts.ts`) fed by data MultiChat ALREADY has
  loaded (`messageSetsQuery.data`, `modelConfigsQuery.data` — both already
  queried at the top of `MultiChat()`, lines ~2316-2317), rather than
  threading an `onArtifactDetected` callback down through
  `MessagePartView`/`ToolsAIMessageViewInner` (the actual per-message
  rendering path, ~6+ component layers below the top-level `MultiChat`
  function per `ToolsAIMessageViewInner`'s own call site at line ~1653,
  itself nested inside a per-model-column component). Threading a callback
  that deep would have touched many more functions/signatures across the
  152KB file — clearly not "mount + state + callback only" — and would have
  been unverifiable without running the app. `collectChatArtifacts`
  flattens EVERY message across EVERY block kind (chat/tools/compare/
  brainstorm) in EVERY message set, deliberately ignoring each set's
  `selectedBlockType` — see that file's own doc comment for why this is
  actually closer to the design's "immutable log" versioning intent, not
  just an expedient shortcut. `MessageMarkdown`'s `onArtifactDetected` prop
  (added in the P4-prep commit) is consequently NOT used by MultiChat's own
  wiring at all — it's there as a self-contained, independently-testable
  additive API for callers that only have one message's text in hand (its
  own doc comment says as much). Model name resolution
  (`modelConfigsQuery.data?.find((m) => m.id === modelId)?.displayName ??
  modelId`) mirrors the EXACT pattern already used elsewhere in
  MultiChat.tsx for the same lookup (e.g. `ToolsMessageFullScreenDialogView`
  at line ~869, `DeepResearchNotificationHandler` at ~954) — not a new
  convention.
- 2026-07-21 (P4) `detectArtifactsEnabled` is read directly off
  `appMetadata["detect_artifacts"]` (the `useWaitForAppMetadata()` context
  value already destructured at the top of `MultiChat()`), NOT via the new
  `AppMetadataAPI.useDetectArtifacts()` hook added in the same commit —
  matches this file's OWN established local convention (see e.g. line ~547
  `appMetadata["cautious_enter"] === "true"`, ~2787 `vision_mode_enabled`)
  of reading flags straight off the context inside MultiChat rather than
  via a second `useAppMetadata()` subscription. The `AppMetadataAPI.ts` hook
  pair still exists and is exported for OTHER future consumers (a W3
  Settings toggle) that don't already hold this context.
- 2026-07-21 (P4) The "previous artifact count" used to detect a NEW
  artifact arriving (to auto-open + auto-select-newest) is tracked via
  `useState` + the functional-setState form inside the `useEffect`
  (`setPreviousArtifactCount((previousCount) => {...; return
  chatArtifacts.length;})`), specifically to AVOID `useRef` for this —
  the orchestrator's pre-authorization for `useRef` is scoped to "DOM refs
  (focus, scroll, iframe handles, measuring)", and a "remember the previous
  render's value" ref is a different (broader) use that policy doesn't
  clearly cover, so this sidesteps the question entirely rather than
  stretching the authorization.
- 2026-07-21 (P4) The artifact panel and `RepliesDrawer` CAN both be open
  simultaneously (a 3-way `ResizablePanelGroup` split: chat | replies |
  artifact) — there is no mutual-exclusion logic. This is UNVERIFIED
  visually (cannot run the app) and may be cramped on a typical window
  width; flagged in the User-test queue rather than guessed around blindly.
- 2026-07-21 (P4) The artifact panel does NOT get the mobile/narrow-window
  treatment `RepliesDrawer` has (a full-screen overlay swap at `@2xl`
  breakpoints, MultiChat.tsx's `repliesDrawerOpen && (...)` block right
  after `</ResizablePanelGroup>`). Chorus is a Mac desktop app (per
  CLAUDE.md) so very narrow windows are an edge case; accepted as a v1 gap
  rather than adding unverifiable responsive logic. If this matters,
  the fix is a `<div>` sibling to that existing mobile-overlay block,
  following its exact `@2xl:hidden` pattern.

## Landmines / do-not
- (P4) Exact current MultiChat.tsx line ranges (re-verify with `grep -n` if
  you're picking this up cold, since line numbers drift with every edit):
  imports added at ~163-164 (`collectChatArtifacts`, `ArtifactPanel`, right
  after the existing `AppMetadataAPI`/`chatCreationDefaults` imports);
  top-level state/memo/effect at ~2326-2359, inside `export default
  function MultiChat()` (starts line 2308), placed right after the
  pre-existing `const [searchParams] = useSearchParams();` and before the
  "One-time backfill" `useEffect`; the panel mount JSX at ~3414-3431, as a
  third conditional block inside the `ResizablePanelGroup` (starts ~3361),
  immediately after the existing `{repliesDrawerOpen && (...)}` block and
  before the group's own closing tag (~3434). The ENTIRE MultiChat.tsx diff
  is +58/-0 lines (verified via `git diff --stat` right after committing) —
  if a future edit to this file shows unrelated deletions/reformatting
  mixed in, something went wrong; the append-only intent was to touch
  nothing else.
- (P4) `MessagePartView`/`ToolsAIMessageViewInner` (the actual per-message
  render path, `MultiChat.tsx` ~649-668 and ~1038+) were deliberately NOT
  touched — do not add artifact-detection logic there; `collectChatArtifacts`
  is the single source of truth for the panel's content, operating on
  `messageSetsQuery.data` directly rather than on what's currently rendered.
  If a future need arises to know "did THIS specific on-screen message
  produce an artifact" (e.g. to finally wire `CodeBlock`'s `onOpenPreview`),
  matching by `messageId` against `chatArtifacts` (already computed at the
  top level) is far cheaper than re-deriving it from the render tree.
- Pre-existing, UNRELATED tsc failure on a clean checkout: `src/ui/components/
  Draggable.tsx(2,21): error TS2307: Cannot find module '@dnd-kit/utilities'`.
  `@dnd-kit/utilities` is imported by Draggable.tsx but is NOT listed in
  `package.json` (`@dnd-kit/core` and `@dnd-kit/modifiers` are; `utilities`
  is not) and is not present in the shared `node_modules`. This predates any
  W2 change — do not attempt to fix it as part of this workstream (not
  ours to own); it just means `tsc --noEmit` will never show fully clean
  output in this worktree until someone (orchestrator/W-whoever owns
  Draggable.tsx) adds the dependency. All NEW artifacts files typecheck
  clean in isolation — confirmed by diffing tsc output before/after P1
  (single error, identical file/line, before and after).
- `src/ui/components/artifacts/` does not exist yet (P2 creates it) — don't
  be surprised the lint command from the brief
  (`eslint src/core/chorus/artifacts src/ui/components/artifacts`) currently
  errors with "no files matching" on the second path; that's expected until
  P2 lands, just lint the two paths separately until then.
- Do not extend/import `renderers/HTML.tsx` (legacy full-page runner) — read
  only, per both the architecture doc and the W2 brief. ArtifactFrame is a
  new, unrelated component that happens to reuse its postMessage error-shape
  convention.
- `groupFences()`/`scanFences()` in extract.ts are intentionally NOT
  exported — tests exercise them through the public `extractArtifacts` API
  (black-box) plus a few exported pure helpers (`injectCspMeta`,
  `stripReasoningBlocks`, `deriveHtmlTitle`, `deriveSvgTitle`,
  `deriveMermaidTitle`, `HTML_ARTIFACT_CSP`, `SVG_ARTIFACT_CSP`) that are
  independently useful to P2/P3. If you need to unit-test grouping directly,
  add exports rather than duplicating the regex logic elsewhere.
- UPDATE (P4 landed): MultiChat.tsx IS now touched — see the dedicated (P4)
  landmine entry above for current line ranges instead of this note.
  `MessageMarkdown` is still invoked without the new optional props at
  MultiChat.tsx:658/:940 (MultiChat's own wiring doesn't use them — see
  Decisions log) and unchanged at MultiChatDeprecationPath.tsx:597/:715/:1521
  and SummaryDialog.tsx:126 (not ours to touch; the props are optional so
  these keep compiling untouched).

## User-test queue

The core flow is now reachable from the running app (P4 landed) — this is
the FIRST point in the workstream where the user can actually test
anything. Priority: the primary end-to-end flow first, then the P3
action-button items below it (still none of which have been runtime-verified):

- **Primary flow**: open a chat, send a prompt like "make me a pong game in
  one html file", wait for the response to complete. Expected: the artifact
  panel auto-opens on the right (third resizable pane) showing a live
  preview of the game; the header shows a title + model pill; Code tab
  shows the merged HTML/CSS/JS source; the game should actually be
  playable inside the sandboxed preview (keyboard input works — sandbox is
  `allow-scripts allow-forms`, keyboard events aren't gated by either token
  so this should work, but hasn't been runtime-verified).
- Ask a follow-up in the SAME chat that produces a second HTML artifact
  (e.g. "now make it single-player against an AI paddle"). Expected: panel
  auto-jumps to the new version, version stepper reads "v2 of 2", `‹` steps
  back to the pong game from before.
- Toggle the `detect_artifacts` app_metadata flag off (no Settings UI for
  this yet — set it directly via SQL:
  `UPDATE app_metadata SET value='false' WHERE key='detect_artifacts';`
  or `INSERT` it if missing) and confirm a new artifact-bearing response no
  longer auto-opens the panel.
- Regression: existing mermaid/svg/plain-code-block rendering INLINE in the
  chat should be completely unchanged (MessageMarkdown's `Code` component
  wasn't modified, only new optional props were added around it).
- Regression: RepliesDrawer still opens/closes/resizes normally, and
  (unverified — see Decisions log) opening it AT THE SAME TIME as the
  artifact panel doesn't produce a broken 3-way layout.
- Regression: Cmd+F find-in-page still works normally while the artifact
  panel is open (the panel's content is plain DOM except for the sandboxed
  iframe, whose content is naturally excluded from find-in-page — this is
  expected/correct, not a bug, since the iframe is a separate document).

- "Open in window" (`openArtifactWindow.ts`) is completely untested against
  a real Tauri build — verify a new detached window actually opens, shows
  the artifact full-window with no app chrome (no sidebar/command menu),
  and that clicking it again on an already-open artifact focuses the
  existing window instead of erroring.
- Download (`downloadArtifact.ts`) — verify the save dialog appears, the
  written `.html` file opens correctly in a real browser (html and svg
  kinds), and a mermaid artifact downloads as `.mmd` with the raw diagram
  text.
- ArtifactFrame's external-link interception — an artifact containing
  `<a href="https://...">` should NOT navigate the iframe away from the
  preview; clicking it should open the user's default browser instead
  (verify Tauri's `openUrl` actually fires).
- ArtifactFrame's error bridge — an artifact whose script throws should
  show the inline red error banner at the bottom of the preview, not a
  silent failure or a crashed iframe.
- Both light and dark theme — panel header/tabs/empty-state have only been
  reasoned about via DESIGN.md tokens, never visually rendered.

## Landmines / do-not (P3 additions)

- `ArtifactWindowView.tsx` calls `registerDefaultArtifactRenderers()` at
  module scope, same as `ArtifactPanel.tsx` — this is intentionally
  idempotent (registering the same kind twice just overwrites with the same
  value) so it's safe for both to do it independently; don't "fix" this by
  centralizing it into a single call site unless you also handle the
  detached-window case (which has no shared module state with the main
  window's React tree).
- Do not read `IArtifact.document` for anything user-facing outside
  `ArtifactFrame`/the registry renderers (download, copy, and the Code tab
  all intentionally use `.code`). `.document` is an implementation detail of
  the sandboxed preview.
