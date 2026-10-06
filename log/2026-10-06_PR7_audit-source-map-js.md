# PR 7 — chore: pin transitive source-map-js to 1.2.2 (GHSA-68fv-2mgg-jv7q)

- **Merged:** 2026-10-06T16:02:01Z (GitHub) · **Merge commit:** `908093c125aefd5bc9374f50687f8d4a34ff0116` · **Branch:** `chore/audit-source-map-js` (final head `23b33d30eb074b157e851b7efa528ad028b750e4`)
- **Gate breaches:** **GATE BREACH: no reviewer verdict on record — unverified.** No `PR-7.md` review file exists locally or on `agent-logs`; Bob did not review this PR. **GATE BREACH: final review was not confirmed before merge.** No approval receipt (`reviews/PR-7.receipt`) exists. Charlie asked for this separate PR on 2026-10-06 ("X A", on Bob's review R6 of PR #6) and merged it himself; that owner statement is noted but does not stand in for the reviewer's verdict.
- **Approval receipt:** missing
- **Merge evidence:** `gh pr view 7` → state MERGED, mergedAt 2026-10-06T16:02:01Z, merge commit above, base `main`; `git merge-base --is-ancestor 908093c origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-07).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** none (unreviewed)
- **Spec:** none · **Plan:** none · **Milestone:** unscheduled (dependency-audit repair, found in Bob's review R6 of PR #6)

## What changed
Three files. `pnpm-workspace.yaml` gets `overrides: source-map-js: 1.2.2`. `pnpm-lock.yaml` changes only that one resolution (1.2.1 → 1.2.2 and its seven references). `docs/DECISIONS.md` gets one entry. No application code.

## Why
Advisory GHSA-68fv-2mgg-jv7q (source-map-js `>=1.0.0 <1.2.2`, high, event-loop denial of service) was published after the 2026-10-03 audit run. `pnpm audit --audit-level high` then failed on `main` and on every PR (UNI-13). `source-map-js` is transitive: `next` and `vitest`/`vite` reach it through `postcss`. Bob found the failure in his review R6 of PR #6, a docs-only PR. Charlie chose a separate PR for the fix.

## Review rounds
- none (no reviewer record). Builder verification before opening the PR: `pnpm audit --audit-level high` exit 0 (only the ignored `braces` advisory remains), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (6 passed), `pnpm build` — all pass. Exact-head CI on the PR: dependency audit, secret scan and typecheck/lint/test all passed (run `37468451251`).

## Deferred conditions
- none

## Decisions worth keeping
- The override pins an exact version (`1.2.2`). Remove it once every dependent (`postcss`) resolves `source-map-js >= 1.2.2` on its own; recheck at every phase gate, together with the `braces` exception. Recorded in `docs/DECISIONS.md` (2026-10-06 entry, now on `main`).
- Process lesson: a small dependency-only PR still needs a reviewer round and an approval receipt (`review 7`, then `approved 7`) before the owner merges. This one was merged without either.

## Follow-ups
- PR #6 (`docs/spec-v4.6-service-currency`): merge `main` into the branch so its dependency audit passes, then Bob's `review 6`.
- Remove the local worktree `.agent/worktrees/build-chore-audit-source-map-js` and local branch `chore/audit-source-map-js` (needs Charlie's OK).
- Optional: Bob may review PR #7 after the fact; any finding would go in a normal follow-up PR.

## Appendix — final review round
No review round exists for this PR.
