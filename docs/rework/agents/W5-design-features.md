# W5 — New Design-File Features (template)

**Hard-blocked on W0.** This workstream has no fixed scope until
`docs/rework/design/OVERVIEW.md` lands and lists net-new features (things in
`Chorus Remake.dc.html` that map to no existing surface and no W1–W4 stream).

## How W5 features get spawned

1. W0 writes `docs/rework/design/features/<name>.md` (directive format from
   `02-DESIGN-EXTRACTION.md`).
2. The user (or coordinating agent, on request) creates
   `docs/rework/agents/W5-<name>.md` from the template below and assigns a
   branch `claude/rework-<name>`.
3. Standard protocol applies (`01-COORDINATION.md`), one worktree per feature.

## Prompt template

```markdown
# W5-<name> — <Feature>

Branch: `claude/rework-<name>` · Worktree: `../chorus-wt-<name>`
Read first: /CLAUDE.md, /DESIGN.md, docs/rework/01-COORDINATION.md,
docs/rework/00-ARCHITECTURE.md, docs/rework/design/features/<name>.md.

## Mission
<one paragraph: user-visible outcome>

## Data model
<tables/app_metadata keys touched; migrations via ledger protocol §5;
 no FKs; null→undefined mapping>

## Ownership
<files created (preferred) / shared files touched (append-only rules)>
Check the ownership map in 00-ARCHITECTURE.md §6 — if your feature needs a
file owned by W1–W4, coordinate via their PROGRESS.md or build behind an
interface they export; do not edit their files while their branch is open.

## Phases
P0 inventory/design read → P1 core logic (pure, tested) → P2 components
(dead code) → P3 wiring (single commit) → P4 polish. Every phase green,
PROGRESS.md per coordination §2.

## Done means
<checklist + user test plan seeds>
```

## Standing rules for all W5 features

- UX from the design directive; visual language from `/DESIGN.md` (Token-Only
  Rule, One Kicker Rule, full state sets).
- Core logic in `src/core/chorus/`, UI in `src/ui/components/<feature>/`,
  queries split db/ + api/ per entity, per repo conventions.
- Dead-code-until-one-wiring-commit pattern (see W2/W4) so interruption never
  breaks the app.
- Agents cannot run the app: draft PR early, user test plan always.
