# W2 Progress — Inline Artifacts

## State: P3 — ArtifactPanel complete (tsc/lint/vitest green); ready for P4 wiring

## NEXT ACTION
Do the P4 MultiChat wiring in ONE minimal commit. Read
`.rework/PROGRESS.md`'s "Landmines" section below FIRST for the exact
MultiChat.tsx line ranges (already re-confirmed against the current file).
Steps:
1. In MultiChat.tsx, add chat-level state: `artifacts: IArtifact[]`
   (built via `useMemo` — see types.ts's note: extraction must be memoized
   per message, keyed on messageId+text, or ids/createdAt won't stay
   referentially stable across re-renders), `selectedArtifactIndex: number`,
   `artifactPanelOpen: boolean`. Build the artifacts list by mapping over
   the messages currently rendered (both call sites at MultiChat.tsx:658 and
   :940 — confirm exact line numbers again after your own edits shift them)
   through `extractArtifacts(part.content / fullText, { messageId, chatId,
   modelName: <the column's model id/display name> })` and flattening.
   Order chronologically by message creation time (NOT `IArtifact.createdAt`
   — that's extraction-time, see types.ts) for P5 later; P4 can start with
   simple append-order since true chronological sort is explicitly a P5 task.
2. Read `AppMetadataAPI.ts`'s existing hook pattern (e.g.
   `useShowOpenRouter`/`useSetShowOpenRouter` at lines ~101-104 and ~83-99)
   and add an analogous `useDetectArtifacts`/`useSetDetectArtifacts` pair
   for the `detect_artifacts` app_metadata key, default-on (mirror
   `useShowOpenRouter`'s `=== "true"` check but treat MISSING key as `true`
   default — e.g. `appMetadata?.["detect_artifacts"] !== "false"` — since
   `useShowOpenRouter` defaults to off/false-when-missing and we need the
   opposite default). Put these two hooks in AppMetadataAPI.ts (core API
   file — read the ownership table: not explicitly owned by another
   workstream, safe to extend) OR co-locate in your own
   `src/core/chorus/artifacts/` if you'd rather not touch a shared file;
   DECIDE which and record it here once done (leaning: put it in
   AppMetadataAPI.ts next to the other flag hooks, for consistency — it's
   additive, not a shared-file conflict risk).
3. Auto-open: when a NEW artifact appears (the memoized list grows) AND
   `useDetectArtifacts()` is true, set `artifactPanelOpen = true` and
   `selectedArtifactIndex` to the new last index. Use a `useEffect` keyed on
   `artifacts.length` (compare against a previous-length ref/state) — this
   is exactly the kind of "genuinely time-based/state-transition UX" the
   orchestrator's forbidden-feature policy already covers for `useRef`; a
   plain `useState` holding previous length also works and avoids `useRef`
   entirely, prefer that.
4. Mount `<ArtifactPanel>` as the THIRD `ResizablePanel` sibling, immediately
   after the existing `repliesDrawerOpen && (...)` block (currently ends
   around MultiChat.tsx:3374, right before the closing
   `</ResizablePanelGroup>` at :3376 — RE-VERIFY these exact numbers first,
   they will have shifted from step 1's edits). Follow the exact
   `ResizableHandle` + `ResizablePanel` shape used for RepliesDrawer
   (:3362-3373), with `defaultSize={35}`, `minSize={25}` or similar per
   artifacts.md's "~35-40%, min 380px" guidance (ResizablePanel uses
   percentage sizes, not pixels — 380px min isn't directly expressible;
   approximate with `minSize` as a percentage and note the approximation
   here). Gate the whole block on `artifactPanelOpen && artifacts.length >
   0`, passing `artifacts`, `selectedArtifactIndex`,
   `onSelectIndex={setSelectedArtifactIndex}`,
   `onClose={() => setArtifactPanelOpen(false)}`.
5. `MessageMarkdown` gains the optional `onArtifactDetected` prop (additive
   — default undefined, existing call sites in MultiChatDeprecationPath.tsx
   and SummaryDialog.tsx keep compiling untouched). Simplest correct
   implementation: MessageMarkdown itself doesn't need to call
   `extractArtifacts` internally (that would duplicate step 1's work) —
   instead, thread whether the CURRENT message produced artifacts as a
   boolean/count down from MultiChat's own already-computed list, OR (if
   you want MessageMarkdown to stay self-contained and this prop genuinely
   useful for OTHER callers later) have it independently detect and report
   via the callback while MultiChat's own `useMemo` remains the source of
   truth for the panel's actual content — pick whichever keeps the
   MultiChat diff smaller; record the choice here.
6. CodeBlock.tsx gets an "Open preview" affordance (small button, next to
   the existing copy/run buttons at CodeBlock.tsx:121-152) that calls up
   through props to whatever MultiChat wires — needs a new optional prop on
   CodeBlock (e.g. `onOpenArtifactPreview?: () => void`) rendered only when
   provided, so the two OTHER CodeBlock call sites (Code tab inside
   ArtifactPanel itself, and any other renderer usage) don't get an
   affordance that makes no sense there. Wire MultiChat to pass a handler
   that opens the panel at the matching artifact's index (match by
   `messageId` + fence position, or simplest: by matching `code`/`content`
   string against `artifacts[i].code`).
Keep the ENTIRE diff to MultiChat.tsx to mount + state + the two callback
props — no new business logic there; anything more complex belongs in your
own files under `src/core/chorus/artifacts/` or
`src/ui/components/artifacts/`.

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
- [ ] P4 — MultiChat wiring (single minimal commit: mount + state + callback)   <- current
- [ ] P5 — Versions + polish (chronological ordering, attribution pill,
      regeneration append, esc-to-close, reduced-motion)

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

## Landmines / do-not
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
- MultiChat.tsx has NOT been touched yet (P4 is a single dedicated commit).
  Current read-only notes on the mount point (confirmed by reading the file):
  the `ResizablePanelGroup` + `RepliesDrawer` precedent is at
  MultiChat.tsx:3323-3376 (desktop layout) with a matching mobile-overlay
  block immediately after (~3379-3389). The artifact panel will be a THIRD
  `ResizablePanel` sibling inside the same `ResizablePanelGroup` (after the
  `repliesDrawerOpen && (...)` block), following the same
  `ResizableHandle` + `ResizablePanel` shape. `MessageMarkdown` is invoked at
  MultiChat.tsx:658 and :940 (and also in MultiChatDeprecationPath.tsx:597,
  :715, :1521, and SummaryDialog.tsx:126 — those are NOT ours to touch;
  `onArtifactDetected` is an OPTIONAL prop so those call sites keep
  compiling untouched).

## User-test queue

Nothing is reachable from the running app yet (ArtifactPanel/ArtifactFrame
are dead code until P4 mounts them) — these can't be tested until then,
listed here so they aren't forgotten:

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
