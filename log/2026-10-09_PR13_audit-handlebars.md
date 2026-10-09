# PR 13 — chore: pin transitive handlebars to 4.7.10 (audit fix)

- **Merged:** 2026-10-09T06:43:16Z (GitHub) · **Merge commit:** `00cffa1d06bbe0a253cd8be0fc25562df1e87088` · **Branch:** `chore/audit-handlebars` (final head `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`)
- **Gate breaches:** none. The final review round's head SHA (`f64d514…`) equals the PR's final head SHA, and the receipt was written before the merge.
- **Approval receipt:** `reviews/PR-13.receipt` on `agent-logs`, commit `8e78cec` (written 2026-10-09T02:52:42Z; merge was 2026-10-09T06:43:16Z; reviewed head `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`; review-file hash `f508e32ed6c869dc4c72415c9ac1c844f619533c`, archived in commit `90b23d7`)
- **Merge evidence:** `gh pr view 13` → state MERGED, mergedBy `charliekhc`, merge commit above; `git merge-base --is-ancestor 00cffa1 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-09).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 1)
- **Spec:** none · **Plan:** none · **Milestone:** unscheduled (dependency-audit repair, blocking PR #12)

## What changed
`pnpm-workspace.yaml` gets `overrides: handlebars: 4.7.10`. `pnpm-lock.yaml` moves the single `handlebars` resolution from 4.7.9 to 4.7.10. `docs/DECISIONS.md` gets one entry. No application code.

## Why
Advisories GHSA-8r5x-fm3f-whwj and GHSA-p8wg-vrv2-v86f (handlebars `<= 4.7.9`, critical) made `pnpm audit --audit-level high` fail on `main` and on every PR (UNI-13). Bob blocked PR #12 for it (R1 P1). `handlebars` is a dev-tooling transitive dependency of `eslint-plugin-boundaries` (7.2.0, already the latest release). Per Charlie's 2026-10-06 rule, the fix is a separate small chore PR from `main`.

## Review rounds
- R1 (2026-10-09, **Approved**): one P3 (handoff active-target summary omitted the open audit PR). The handoff is git-ignored and not part of the PR; builder fixed it in `.agent/handoff.md` §0 after the merge.
- Builder verification before opening the PR: `pnpm audit --audit-level high` clean except the ignored braces advisory, `pnpm typecheck`, `pnpm test` (6 passed); exact-head CI green (audit, secret scan, typecheck/lint/test/build).

## Deferred conditions
- none

## Decisions worth keeping
- Same pattern as `source-map-js`: pin the patched transitive version with a `pnpm-workspace.yaml` override, no audit ignore. Recorded in `docs/DECISIONS.md` (2026-10-09 entry, now on `main`).

## Follow-ups
- Merge `main` into PR #12's branch (`docs/spec-v4.6-rev10`) so its dependency audit passes; then `review 12` (Bob's Round 1 was Blocked on the audit and the missing self-check table; the table is now in the PR body), `approved 12`, merge, `merged 12`.
- Then `review spec` for the new spec hash, Charlie's approval of v4.6, `setup`, `build`.
- Add the UI-kit direction (emilkowalski/skills first, then smoothui.dev, then ui.shadcn.com) to `docs/DECISIONS.md` through a reviewed PR.
- Cleanup needing Charlie's OK: worktrees `.agent/worktrees/build-chore-next-16-3-8` and `.agent/worktrees/build-chore-audit-source-map-js`; local branches `chore/audit-handlebars`, `chore/next-16-3-8`, `chore/audit-source-map-js`, `chore/setup-reconcile-v4-6`, `chore/agent-kit`, `docs/spec-v4.6-service-currency`, `docs/spec-v4.6-rev8`, `docs/spec-v4.6-rev9`; old `.claude/worktrees/` folders.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-13.md (that file is local only). -->

## Round 1 — 2026-10-09 · scope: slice
- **Code review:** base (merge base) `4feac56d6a8e473b63d4e2878641eb5e29ca39bc` · head `f64d5142e9d5b8689d3fe4359c37a3fe6881706f` · head re-checked at end: yes
- **Spec review:** not applicable; dependency audit remediation.

**Verdict:** Approved
**Model used:** GPT-6 · **Switch model next step?** No — this is a narrow dependency pin and audit review.

### Findings

#### [P3] Handoff active-target summary omits the open audit PR
- Category: material risk
- Rule: reviewer role §2; handoff current-state accuracy
- Evidence: `.agent/handoff.md:11` says “Active PR number: none”; lines 15–17 describe PR #12 as current and link PR #13 only as a chore PR. GitHub showed PR #13 open at `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`.
- Failure scenario: a later session follows the active-target summary and misses that the audit-fix PR is awaiting its review/approval gate.
- Why it matters: it can send the next action to the wrong PR, although the detailed next-step entry currently names PR #13.
- Required correction: update the handoff’s active-target summary to include the open audit PR, or clarify that “active” means the spec PR only.
- Owner: builder
- Verification: handoff summary agrees with the open PR list and next-step instructions.
- Status: open

No open P0–P2 findings. The dependency change itself is sound.

### Self-check audit

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-06 | Yes; changes dependency resolution for a transitive package. | Pass | Pass | `pnpm-workspace.yaml:11-12` pins Handlebars to `4.7.10`; `docs/DECISIONS.md:6-10` records why an override was chosen. | None |
| UNI-07 | Yes; check changed files for secrets. | Pass | Pass | Secret-pattern scan of the PR diff produced no secret findings. | None |
| UNI-12 | Yes; change scope must remain within the project. | Pass | Pass | Three changed files: workspace config, lockfile, decisions log. | None |
| UNI-13 | Yes; dependency audit must pass. | Pass | Pass | Exact-head CI Dependency audit succeeded on run `37865368338`. | None |
| UNI-14 | Yes; dependency version and lockfile must be pinned together. | Pass | Pass | Workspace override is exact `4.7.10` (`pnpm-workspace.yaml:12`); lockfile resolution is `4.7.10` (`pnpm-lock.yaml:1935`). | None |
| PROJECT.md §9 | Yes; architecture and approved exceptions apply to dependency changes. | Pass | Pass | No architecture exception was added; decision log documents the narrow override. | None |
| Auth, money, tenancy, files, payments, jobs, frontend packs | No; no application code or behavior changed. | N/A | N/A | Diff contains only dependency config/lockfile and decision documentation. | None |

### Verification performed

| Command / check | Result |
|---|---|
| PR head and CI lookup (earlier in this review) | PR #13 open at `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`; Dependency audit, Secret scan, and Typecheck/lint/test all green for that head. |
| Detached checkout `git rev-parse HEAD` | `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`. |
| `git diff --stat 4feac56d6a8e473b63d4e2878641eb5e29ca39bc...f64d5142e9d5b8689d3fe4359c37a3fe6881706f` | 3 files changed, 16 insertions(+), 5 deletions(-). |
| `git diff --check 4feac56d6a8e473b63d4e2878641eb5e29ca39bc...f64d5142e9d5b8689d3fe4359c37a3fe6881706f` | Passed. |
| Secret-pattern scan on the diff | No secret findings; path-only output. |
| Local test/build commands | Not run; the change is dependency configuration only and exact-head CI passed. |
| Final GitHub head recheck | Passed: PR #13 remains open at `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`. |
| Detached checkout status | Clean (`git status --short`). |

### Residual risks and test gaps
- Approval applies only to head `f64d5142e9d5b8689d3fe4359c37a3fe6881706f`.
- The project’s pre-existing audit exception for `braces` remains outside this PR’s scope.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.
