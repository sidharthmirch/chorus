# W2 — Inline Artifacts

Branch: `claude/rework-artifacts` · Worktree: `../chorus-wt-w2`
Read first: `/CLAUDE.md`, `/DESIGN.md`, `docs/rework/01-COORDINATION.md`,
`docs/rework/00-ARCHITECTURE.md` §3 (your frozen contract), then this file.
`docs/rework/design/artifacts.md` (W0 output) refines the UX — the design
confirms: side panel Claude-style split (~44% width, min 380px), chat keeps
scrolling left, `⿻` chip on artifact-bearing blocks opens the panel,
Preview/Code segmented tabs, header context action + footer provenance line
("src: 8 × 10-Q · tool: financial-lookup" style). The design's richer
per-chat palettes (chart/table/entity card, note draft, live app preview)
are future renderer kinds behind your `registerArtifactRenderer` seam —
v1 ships html/svg/mermaid only (architecture §3.1).

## Mission

When any model's message contains renderable content (HTML/CSS/JS groups, SVG),
show a live sandboxed preview in a right-side **artifact panel** (Preview/Code
tabs, versions, copy/download/fullscreen), auto-opening on detection. Chat
content stays the star; the panel is chat-scoped and quiet.

## Reference research (already done — digest)

Two open-source references were analyzed; clones may still exist at
`/tmp/artifact-research/` (open-webui, fragments). If gone, re-clone shallow:
`git clone --depth 1 https://github.com/open-webui/open-webui` and
`https://github.com/e2b-dev/fragments`.

Key findings to port:

- **Detection (open-webui)** `src/lib/components/chat/Messages/ContentRenderer.svelte:132-147`:
  trigger on fenced langs `html`, `svg`, or `xml` containing `<svg`; gated by a
  `detectArtifacts` setting (default on).
- **Assembly (open-webui)** `src/lib/utils/index.ts` `getCodeBlockContents`:
  strip think/details blocks first; group consecutive `css` + `js` fences into
  the preceding `html` fence; wrap as full document (`<style>` head, `<script>`
  body-end). Fallback: bare inline HTML documents.
- **Sandbox (open-webui)** `src/lib/components/chat/Artifacts.svelte:243-258`:
  `srcdoc` + `sandbox="allow-scripts allow-downloads"` (same-origin OFF by
  default), CSP meta injected before `<head>` content (`src/lib/utils/csp.ts`),
  click-listener intercepts links and blocks external navigation.
- **Versioning (open-webui)** `Artifacts.svelte:28-115`: contents array, index
  = version, "vN of M" stepper, auto-jump to newest when a new artifact
  arrives; regeneration appends.
- **Panel UX (e2b fragments)** `components/preview.tsx`: side panel with
  Code | Preview tabs; `components/fragment-web.tsx`: iframe re-key to force
  refresh. Their schema-driven generation and cloud sandbox are explicitly
  out of scope (architecture §3.4).

## Chorus integration points (read these files before coding)

- `src/ui/components/renderers/MessageMarkdown.tsx` — `Code` component (line
  ~55) is where fenced blocks route today (mermaid/svg/code). Your detection
  hooks in here + a message-level extract.
- `src/ui/components/renderers/CodeBlock.tsx` — add "Open preview" affordance.
- `src/ui/components/MultiChat.tsx:3323-3376` — `ResizablePanelGroup` +
  `RepliesDrawer` mount; your `ArtifactPanel` is a sibling `ResizablePanel`.
  Keep the MultiChat diff minimal — mount + state + callback only; all logic
  lives in your own files.
- `src/ui/components/renderers/HTML.tsx` — legacy file-based runner:
  read for the postMessage error-bridge pattern, do NOT extend or reuse.
- `src-tauri/tauri.conf.json` — verify webview CSP permits srcdoc iframes
  (`frame-src`); document any change.

## Phases

**P1 — Core extraction (pure TS, no UI).**
`src/core/chorus/artifacts/extract.ts` + `types.ts`: `IArtifact`, `
extractArtifacts(text, {messageId, chatId, modelName})`, assembly, CSP
injection helper, title derivation. Must tolerate streaming partials
(unclosed fences → ignored). **Vitest suite is the deliverable of this phase**
— fence grouping, xml/svg edge cases, think-block stripping, bare-HTML
fallback, CSP meta position.

**P2 — ArtifactFrame.** `src/ui/components/artifacts/ArtifactFrame.tsx`:
srcdoc iframe per security contract (architecture §3.2 — sandbox attrs frozen:
`allow-scripts allow-forms`, never same-origin), error postMessage bridge,
external-link interception → `openUrl`, refresh via key bump. SVG kind renders
through the same frame (no scripts needed → drop `allow-scripts` for pure SVG).

**P3 — ArtifactPanel.** `src/ui/components/artifacts/ArtifactPanel.tsx`:
Preview/Code tabs (`tabs.tsx`), header with title + model pill + version
stepper + actions (copy `CopyButton`, download .html via tauri fs dialog,
fullscreen, open-in-window via Tauri `WebviewWindow`, close). Code tab reuses
`CodeBlock`. Empty state teaches ("Artifacts appear when a model writes
HTML/SVG"). All `/DESIGN.md`: hairline borders, sidebar-smoke surface, mono
micro-label for the version readout, retro-loader while iframe loads.

**P4 — MultiChat wiring.** Panel as third ResizablePanel; chat-level state
(artifact list per selected messages, selected index, open flag);
`MessageMarkdown` gains optional `onArtifactDetected`; auto-open gated by a
new `detect_artifacts` app_metadata flag (default on) — that's an
`app_metadata` key via existing patterns, no migration. CodeBlock preview
button opens/focuses panel at that artifact.

**P5 — Versions + polish.** Ordering across message sets (chronological,
newest auto-selected), per-model attribution pill, regeneration appends,
keyboard: `esc` closes panel when focused. Reduced-motion respected (no
animated panel slide beyond the resizable default).

## Resumability specifics

- P1 is pure + fully tested → any agent can pick up from P2 with zero context.
- UI phases: one component per commit; panel stays unmounted (dead code) until
  the single P4 wiring commit — interruption never leaves MultiChat broken.
- Record every MultiChat line-range you touch in PROGRESS.md (the file is
  152KB; precise pointers save the successor an hour).

## Done means

HTML/CSS/JS and SVG artifacts detected on stream-complete, panel auto-opens,
versions navigate, copy/download/fullscreen work, sandbox contract holds
(no same-origin+scripts, CSP injected, external links blocked), extraction
suite green, lint/build green, PR with user test plan (include a canned
"make me a pong game in one html file" prompt and expected behavior, plus
regression checks: mermaid/svg/code rendering, RepliesDrawer, find-in-page).
