# PR 42 — docs: close deferred handoff-restore and stale-wording findings (PR #38, #39, #41)

- **Merged:** 2026-10-25 (08:46 UTC) · **Merge commit:** e4fd1003d23b352a0999977382d9962eee3a9c47 · **Branch:** chore/docs-status-deferred
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-42.receipt` on agent-logs, log-branch commit 4c17a7dcd4d71cd6523117494fd2602121f3f9a1 (written 08:43:44 UTC, about 3 minutes before the merge); head 75cc03d93d415e0ff8fdfd136a36e02ef6e44f84 = final head; review-file hash 609d68158bf7dd9b36b4aa41ea125a4eec976ca2 (archived copy re-hashed: matches)
- **Merge evidence:** `gh pr view 42` reports MERGED, merge commit e4fd100, merged 2026-10-25T08:46:39Z, head 75cc03d; `git merge-base --is-ancestor e4fd100 origin/main` succeeds.
- **Drafted by:** Sonnet 5.5 (builder) · **Final verdict:** Approved (round 1, Bob on Opus 5.5)
- **Spec:** none · **Plan:** none · **Milestone:** Phase 1 housekeeping

## What changed
`agents/PROJECT.md` §2 "Restore on the other Mac": after the owner says which handoff copy is newer, a newer remote copy is copied over `.agent/handoff.md`, a newer local copy is kept, the remote hash is written to `.agent/handoff.synced`, and an interrupted refresh restarts from step 1. Revision 8 wording fixed in `CLAUDE.md`, `agents/PROJECT.md` §11 and the revision 8 decision entry. `CLAUDE.md` Status names Phase 1 PRs 1 and 2 as merged. Extra blank lines removed from `docs/DECISIONS.md` and three test files. New decisions entry 2026-10-25. The same restore wording went into `handoff/README.md` on `agent-logs` as a separate commit.

## Why
Closes findings deferred to "the next PR that edits `agents/PROJECT.md`" before 2026-11-06: PR #34 Round 2 P2, PR #38 Round 1 P2 and P3, PR #39 Round 2 P3, PR #41 Round 1 P3.

## Review rounds
- R1 (Approved, no conditions, head 75cc03d): no findings that needed a fix.

## Deferred conditions
none (the PR #41 P2 on the TEN-09 lint stays with Phase 1 PR 3, PR #43).

## Decisions worth keeping
Decisions entry 2026-10-25 "Close the PR #34 and PR #38 deferred handoff-copy and wording items" (merged with the PR).

## Follow-ups
- `handoff/README.md` on `agent-logs` already carries the restore change.
- PR #43 (Phase 1 PR 3) needs `main` merged in; expect a conflict at the top of `docs/DECISIONS.md` (keep both entries).

## Appendix — final review round
## Round 1 — 2026-10-25 · scope: slice (docs: close deferred review findings; blank lines only in three test files)
- **Code review:** base (merge base) `5e82a4c1c5b79735dfe4329f51f1fb3ca3ac4269` (= `origin/main`, PR #41 merge) · head `75cc03d93d415e0ff8fdfd136a36e02ef6e44f84` · head re-checked at end: yes (still `75cc03d`, OPEN, MERGEABLE)
- **Spec reference:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash `733cc0e9ce4af0771bdd2769720e3f228caf8855` (not changed by this PR).
- **Checkout mode:** detached worktree `.agent/worktrees/review-42-75cc03d9` at the exact head. My build output is deleted. No tracked file changed. Removed without `--force`.

**Verdict:** Approved
**Model used:** Opus 5.5 · **Switch model next step?** No — `approved 42` / `merged 42` are builder procedures.

### Deferred findings this PR closes

| Finding | Status now | Evidence |
|---|---|---|
| PR #38 Round 1 P2 (carries PR #34 Round 2 P2): after "remote is newer", nothing adopts the remote copy | **resolved** | `agents/PROJECT.md` §2 restore step. Trace of the PR #38 scenario: the owner says "remote is newer". Then the local file becomes B byte-for-byte, synced = B, and the refresh restarts at step 1. Step 3: synced B = remote B, so it continues. Step 4: local B = remote B, so nothing changed and it stops. B is never overwritten. The other answer, "local is newer": local L is kept, synced = B, restart, step 3 equal, step 4 pushes L. That is the owner's choice. `handoff/README.md` on `origin/agent-logs` (`85e1c7d`) has the same wording. |
| PR #38 Round 1 P3: three spots name revision 7 as current | **resolved** | `CLAUDE.md:6` names revision 8. `agents/PROJECT.md` §11 adds "and those settled by revision 8". The `docs/DECISIONS.md` revision 8 entry marks its two pending sentences "(at writing … approved 2026-10-22)". |
| PR #39 Round 2 P3: extra blank line in `docs/DECISIONS.md` | **resolved** | removed before the 2026-10-23 entry |
| PR #41 Round 1 P3: extra blank lines in three test files | **resolved** | `rls.test.ts`, `isolation.test.ts`, `workspace.test.ts`. `git diff -w --ignore-blank-lines` on `apps/` is empty. |

### Findings

No findings.

No injection text found in the diff or the PR body.

### Self-check audit

Independent applicability list: UNI-07, UNI-11 (handoff copy), UNI-12, UNI-13, decision provenance, command authority (the steps stay in `agents/PROJECT.md` §2). n-a: every rule touching code behaviour, schema, UI, money, records, links, files or jobs. The test-file edits are blank lines only, so UNI-05 and the TEN rules are not engaged.

| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07 | yes | pass | pass | 0 secret-pattern hits on added lines; CI Secret scan pass | no |
| UNI-11 | yes | pass | pass | the copy stays on the private `agent-logs` branch; no new destination | no |
| UNI-12 | yes | pass | pass | — | no |
| UNI-13 | yes | CI pending | pass | local checks 0; CI all 4 jobs pass on `75cc03d` (run `40172457722`) | no |
| Decision provenance / command authority | yes | pass | pass | the new 2026-10-25 entry names each closed finding; the owner's "B then A" is recorded | no |

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`; merge base | merge base `5e82a4c` = `origin/main` |
| Diff | 6 files, +19 −12; 1 commit (trailer: Claude Sonnet 5.5); read in full |
| `git diff --check` | clean |
| `git diff -w --ignore-blank-lines 5e82a4c...75cc03d -- apps/` | empty (no code change) |
| `origin/agent-logs:handoff/README.md` | same restore wording as `agents/PROJECT.md` §2 |
| `pnpm install --frozen-lockfile` / `pnpm audit --audit-level high` | 0 / 0 |
| `pnpm lint`, `pnpm typecheck`, then `pnpm vitest run apps/web/src/db` twice (Andy's order for the skip report) | 0, 0, then 2 × 0 (8 files, 69 tests, 0 skipped) |
| `pnpm test` | 0 (19 files, 228 tests) |
| `pnpm build` | 0 |
| CI run `40172457722` on `75cc03d` | all 4 jobs pass |
| End check | host head unchanged; checkout clean; removed |

### Residual risks and test gaps
- **The "58 passed | 11 skipped" report (not caused by this PR).** `vitest list` shows that `apps/web/src/db/lint-rules.test.ts` has exactly 11 tests (9 `it.each` cases plus 2). So the whole file was skipped in that run. The test code has no `.skip`, `skipIf`, `runIf` or `ctx.skip` (`grep` over `apps/web/src` and `packages/core/src`). Vitest marks every test in a file as skipped only when a suite hook or the file setup fails, and then the file and the run fail too. So this cannot give a green run with the tests missing. It is a flaky red run, not a silent pass. I could not repeat it in 2 runs in Andy's order. If it happens again, save the full output with `pnpm vitest run apps/web/src/db --reporter=verbose > <scratchpad file> 2>&1`, then fix it in its own PR. The PR #41 report of "7 tests skipped" matches `isolation.test.ts` (7 tests) or `privileges.test.ts` (7 tests), so it may be a different file.

### Required before merge
- None.

### Deferred conditions
- None. The PR #41 Round 1 P2 (TEN-09 lint gaps) stays deferred to Phase 1 PR 3. This PR does not touch it.

### Optional improvements
- None.
