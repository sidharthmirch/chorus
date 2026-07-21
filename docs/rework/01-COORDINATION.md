# 01 — Coordination Protocol

Rules for running multiple agents in parallel on the rework without destroying
each other's progress. These override convenience. If a rule blocks you,
document why in `.rework/PROGRESS.md` and stop — do not improvise around it.

## 1. Worktrees & branches

- One workstream = one branch = one git worktree:

  ```bash
  git -C /Users/admin/repos/chorus fetch origin
  git -C /Users/admin/repos/chorus worktree add \
      ../chorus-wt-<stream-id> -b claude/rework-<stream-name> origin/main
  cd ../chorus-wt-<stream-id> && pnpm install
  ```

- Branch names are fixed in `README.md`'s table. Never commit to `main`,
  never push to `origin/main`, never touch another workstream's worktree.
- Rebase onto `origin/main` (never merge) at session start and before opening
  or updating a PR.
- Run separate git commands (`git add -A`, then `git commit`) — no `&&` chains
  (CLAUDE.md rule).

## 2. Progress ledger — the resumability contract

Every workstream keeps `.rework/PROGRESS.md` at the worktree root, **committed
with the code it describes**. It is the handoff artifact: assume your session
dies mid-keystroke (quota exhaustion) and the next reader is either future-you
or a different agent with none of your conversation context.

Required structure:

```markdown
# W<n> Progress — <stream name>

## State: <phase id> — <one line>
## NEXT ACTION
<single imperative sentence precise enough to execute cold,
 e.g. "Implement refresh-token path in MCPOAuthProvider.refresh(); test
 stub exists at MCPOAuthProvider.test.ts:88 and currently fails.">

## Phase checklist
- [x] P1 scaffold …
- [ ] P2 …          <- current
…

## Decisions log
- <date> chose X over Y because …

## Landmines / do-not
- <things a naive resumer would break>

## User-test queue
- <items awaiting user verification, with expected behavior>
```

Update cadence:
- Update `NEXT ACTION` **before** starting any multi-file change, not after.
- Commit at every green checkpoint (`tsc` passes; tests you added pass).
- If you must stop while red, commit anyway with prefix `wip:` and make
  `NEXT ACTION` describe the exact broken state and the fix path.

A workstream is "adoptable" when: prompt file + PROGRESS.md + `git log --oneline`
suffice to continue. That is the standard for every commit, not just the last.

## 3. Interruption & adoption rules

- **Same-agent resume:** re-read prompt file, PROGRESS.md, last 10 commits.
  Trust the ledger over memory.
- **Cross-agent adoption** (asked by user, or a hard blocker where W-x owns a
  file you need): allowed. Adopting agent appends to the Decisions log
  (`ADOPTED by <who> <date>`), follows the same protocol, and does not
  re-architect. If you disagree with an existing decision, note it and
  continue; propose the change in the PR description instead of rewriting
  history.
- Never `git rebase -i`/squash another agent's commits; never force-push except
  after your own rebase onto origin/main (`--force-with-lease` only).

## 4. Shared files (append-only zone)

`App.tsx` (routes), `src-tauri/src/migrations.rs`, `src/ui/themes/index.ts`,
`tailwind.config.cjs`, `src-tauri/capabilities/*`, `package.json`:

- Additions only; place them at the natural append point (end of route list,
  end of migrations vec, etc.). Never reorder or reformat surrounding code —
  keeps cross-branch conflicts trivially resolvable.
- New dependencies: add to `package.json`, note in PROGRESS.md; expect to
  resolve `pnpm-lock.yaml` conflicts at rebase by regenerating
  (`pnpm install`), never by hand-editing.

## 5. Migrations ledger

Migration versions are sequential integers, so parallel branches collide.
Protocol:

1. While developing, register your migration with a placeholder constant and a
   `// REWORK-MIGRATION: renumber at rebase` comment; use the number
   `<current max on your branch> + 1`.
2. Record it in `docs/rework/MIGRATIONS-LEDGER.md` **in your branch**:
   `| W1 | add remote transport cols to custom_toolsets | 1 migration |`.
3. Final numbering happens at the last rebase before merge, following the
   merge order (W1 → W2 → W4 → W3): take `max(main) + 1..n`.
4. Migrations must be additive and independently safe (nullable columns,
   new tables; no FKs — CLAUDE.md rule; no data rewrites of other streams'
   tables).

## 6. Quality gates (before opening/updating a PR)

- `pnpm lint` and `tsc` (`pnpm build`) green; Husky hooks handle formatting.
- Unit tests for pure logic you added (vitest); extraction/assembly/oauth
  state machines are the priority targets.
- Both themes visually reasoned about (agent cannot run the app — flag any
  visual uncertainty in the test plan instead of guessing silently).
- PR per CLAUDE.md: `by-claude` tag, description starts with issue number,
  test plan the *user* can execute, covering new + impacted-existing behavior.
- The forbidden-features rule holds: `setTimeout`, `useRef`,
  `useImperativeHandle`, `as` assertions all require explicit user permission —
  list any such request in the PR/PROGRESS.md rather than sneaking it in.

## 7. Communication

- Anything you need from the user (design auth, testing, an API key, a
  decision) goes in PROGRESS.md under `User-test queue` / a `BLOCKED:` line in
  NEXT ACTION, *and* in the PR description. Don't sit blocked silently; find
  the next unblocked task in your phase list.
- Cross-stream interface change requests: edit `00-ARCHITECTURE.md` in your
  branch with the proposal and flag it prominently in the PR. The user
  arbitrates.
