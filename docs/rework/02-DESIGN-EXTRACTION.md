# 02 — W0: Design Extraction (Chorus Remake.dc.html → per-surface directives)

**Status: done.** The design project is vendored at
`docs/rework/design/src/` (`Chorus Remake.dc.html`, `support.js`,
`uploads/*.png`). Extraction is complete — the 10 directive files in
`docs/rework/design/` are the consumable output; re-read the vendored
source only to resolve ambiguity.

Line map of the .dc.html: sidebar 29-82 · chat 86-685 (composer ~452,
optimizer ~548, artifact panel ~616) · fleet 686-824 · wiki 825-999 ·
settings 1000-1118 · author design-notes 1119-1134 · state/data model
1139-1501 (read fully — it defines all data shapes).

## Mission

Import the `Chorus Remake.dc.html` design project and decompose it into
written, implementation-ready UX directives — one file per surface — under
`docs/rework/design/`. You are translating, not designing: capture layout, IA,
component inventory, interaction notes, and copy from the design file, and map
each visual element onto the locked design system in `/DESIGN.md`.

## Output files (branch `claude/rework-design-extraction`)

- `docs/rework/design/OVERVIEW.md` — inventory of every screen/flow in the
  design file; note which existing surface it maps to and which workstream
  (W1–W5) consumes it. Flag anything that matches *no* current workstream —
  that becomes a W5 feature file.
- `docs/rework/design/artifacts.md` → consumed by W2
- `docs/rework/design/settings.md` → consumed by W3
- `docs/rework/design/model-select.md` → consumed by W4
- `docs/rework/design/chat.md` — MultiChat-adjacent changes (layout, input,
  pills, headers)
- `docs/rework/design/features/<name>.md` — one per net-new feature → W5

## Directive file format

For each screen/surface:

1. **Layout** — regions, panel sizes, responsive/collapse behavior. ASCII
   sketch encouraged.
2. **Component inventory** — each element mapped to an existing primitive from
   `src/ui/components/ui/` where possible; only mark `NEW COMPONENT` when
   nothing fits, and specify it in DESIGN.md vocabulary (tokens, radii, type
   steps — never raw hex from the design file).
3. **Interactions** — hover/click/keyboard/empty/loading/error states.
4. **Copy** — labels, empty-state text, exact strings.
5. **Deviations** — where the design file conflicts with `/DESIGN.md`
   (colors, fonts, radii, shadows): record the conflict and resolve it in
   favor of `/DESIGN.md` tokens, preserving the design's *intent* (hierarchy,
   emphasis) rather than its literal values. List unresolvable conflicts for
   the user.

## Rules

- The design file's UX/IA decisions are authoritative for structure; the
  chorus design ethos (`/DESIGN.md`) is authoritative for visual language.
  User has explicitly endorsed: settings rework and model-select ideas from
  the design; artifacts UX comes from W2's referenced open-source patterns +
  whatever the design file adds.
- Extract with the MCP's read tools; keep imported raw assets out of the repo
  (reference, don't vendor). Screenshots of the design → `docs/rework/design/img/`
  only if small and useful.
- Follow `01-COORDINATION.md` (worktree, PROGRESS.md, commits). Docs-only
  branch; safe to merge anytime; open the PR as soon as OVERVIEW.md exists so
  downstream agents can start consuming.
