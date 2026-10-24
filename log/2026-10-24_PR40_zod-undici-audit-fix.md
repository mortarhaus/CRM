# PR 40 — chore(deps): raise zod to 4.6.7 and undici to 8.12.3 (audit)

- **Merged:** 2026-10-24 (14:35 UTC) · **Merge commit:** 39918cd7af98045fb336bf8431c60152770125e2 · **Branch:** chore/deps-zod-undici
- **Gate breaches:** GATE BREACH: no reviewer verdict on record — unverified. The owner merged without a `review 40` round and without `approved 40`, so there is no review file and no approval receipt for head d339048.
- **Approval receipt:** missing
- **Merge evidence:** `gh pr view 40` reports MERGED, merge commit 39918cd, merged 2026-10-24T14:35:27Z; `git merge-base --is-ancestor 39918cd origin/main` succeeds (commit is reachable from the fetched default branch).
- **Drafted by:** Sonnet 5.5 (builder) · **Final verdict:** none (no reviewer round exists)
- **Spec:** none · **Plan:** none · **Milestone:** Phase 1 (unblocks PR #39)

## What changed
`zod` moves from 4.6.5 to 4.6.7 (exact pin in `apps/web/package.json`) with a `pnpm-workspace.yaml` override for every transitive copy. A second override pins `undici` to 8.12.3 (was 8.11.2 via `testcontainers`). The lockfile and the decisions log (entry 2026-10-24) changed with them. No application code.

## Why
`pnpm audit --audit-level high` failed on `main` and on PR #39 (GHSA-mrhx-c7xc-m3w5, zod < 4.6.6; GHSA-xjj6-f33q-929c, undici 8.0.0 to 8.12.1). Owner chose a separate dependency PR ("A", 2026-10-24).

## Review rounds
- None. No reviewer round was run before merge.
- Builder checks on d339048: audit 0 (3 moderate left), typecheck 0, lint 0, 146 tests, build 0; CI all four jobs green (the image job failed once on a flaky axe `document-title` check on tablet-768, then passed on rerun).

## Deferred conditions
none

## Decisions worth keeping
Decision entry 2026-10-24 in `docs/DECISIONS.md` (merged with the PR). Raised versions are exact pins and overrides; remove the overrides when the parent packages ship patched ranges.

## Follow-ups
- Flaky test: `apps/web/e2e/accessibility.spec.ts:77` failed once on tablet-768 (axe `document-title` on `html` during "/workspaces switch refused"). If it fails again, fix in its own PR.
- Bring the new `main` into PR #39 so its Dependency audit job passes.
- Reminder for the owner: run `review <n>` and `approved <n>` before merging; this PR skipped both.

## Appendix — final review round
No review file exists for this PR.
