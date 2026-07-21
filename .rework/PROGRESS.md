# W2 Progress — Inline Artifacts

## State: P2 — ArtifactFrame + renderer registry complete (tsc/lint/vitest green)

## NEXT ACTION
Implement `src/ui/components/artifacts/ArtifactPanel.tsx` (P3): props
roughly `{ artifacts: IArtifact[], selectedIndex: number, onSelectIndex:
(i: number) => void, onClose: () => void, className?: string }` (finalize
exact shape when wiring P4's chat-level state — see architecture §3.3 /
design/artifacts.md for the full component inventory). Structure: header
(40px, `border-b border-border`) — title (derived from
`artifacts[selectedIndex].title`) + model pill (reuse whatever ModelPills.tsx
exports for a single-model chip, or a minimal inline avatar+name if that
component expects a full column context) + version stepper "vN of M" (mono
11px, `text-muted-foreground`, ‹/› buttons `h-6 w-6`) + action buttons (copy
via `CopyButton`/`SimpleCopyButton` at src/ui/components/CopyButton.tsx,
download via `@tauri-apps/plugin-dialog` `save()` + `@tauri-apps/plugin-fs`
`writeTextFile()`, fullscreen via CSS (a `fixed inset-0 z-50` toggle is
simplest — no Tauri API needed for in-window fullscreen), open-in-window via
`@tauri-apps/api/webviewWindow`'s `WebviewWindow` constructor (2.5.0 exposes
this at that import path — confirmed in package.json, not yet used anywhere
in the codebase so there's no existing call site to mirror; pass the
artifact's `document`/`code` via a query param or a temp file since
WebviewWindow loads a URL, not srcdoc — simplest is a new Tauri window
pointed at a small in-app route like `/artifact-window/:id` that re-reads
the artifact from a shared store, OR write `artifact.document` to a temp
file via plugin-fs and load it as a `file://` URL; DECIDE AND RECORD HERE
which approach before implementing — the file:// approach loses the sandbox
entirely (a real window has no `sandbox` attribute equivalent), so the
in-app-route approach is very likely the right one; flag this as an open
question to the orchestrator if it's not resolvable from existing patterns),
close (X button). Segmented Preview/Code tabs via `tabs.tsx`
(`TabsList`/`TabsTrigger`/`TabsContent`) styled per artifacts.md's deviation
table (11.5px, active = `bg-foreground text-background`). Preview tab
dispatches through `getArtifactRenderer(artifact.kind)` from `./registry`
(call `registerDefaultArtifactRenderers()` once, e.g. at panel module load)
— render an "unsupported kind" fallback if `undefined` (covers future
chart/table). Code tab reuses `CodeBlock` from `renderers/CodeBlock.tsx`
passing `content={artifacts[selectedIndex].code}`
`language={artifacts[selectedIndex].language}`. Empty state (`artifacts.length
=== 0`, or panel rendered with no selection): teaching copy per brief
("Artifacts appear when a model writes HTML/SVG"). Footer (40px, optional):
provenance line, mono 11px muted — v1 has no real source/tool metadata to
show yet (that's W6 fused/tool-output territory per architecture §3.1) so
this can just be a placeholder or omitted entirely for v1; note the decision
here once made. Both themes — no new literals, semantic tokens only per
DESIGN.md. Keep this component UNMOUNTED/unused by anything else (dead code)
until the single P4 wiring commit, per the brief's resumability rule.

## Phase checklist
- [x] P1 — Core extraction (pure TS, no UI): `types.ts` + `extract.ts` +
      `extract.test.ts` (43 tests, all green). `tsc --noEmit` green for new
      files (one PRE-EXISTING unrelated repo error, see Landmines).
- [x] P2 — `ArtifactFrame.tsx` (iframe sandbox, CSP already-injected via P1's
      `document`, error bridge, external-link interception, refresh-via-key)
      + `registry.ts` (`registerArtifactRenderer`/`getArtifactRenderer`) +
      `MermaidArtifactRenderer.tsx` + `defaultRenderers.ts`. All dead code
      (nothing imports this subtree yet) — safe, inert until P3/P4.
- [ ] P3 — ArtifactPanel.tsx (Preview/Code tabs, header, version stepper,
      actions, empty state, footer provenance)              <- current
- [ ] P4 — MultiChat wiring (single minimal commit: mount + state + callback)
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
(empty — nothing UI-facing shipped yet; P1 is pure logic covered by the
automated vitest suite. Will populate once P2/P3 land.)
