# PR 5 — ci: add production build step, ignore GHSA-vfj7-8cjw-p6xm in the audit (expiring)

- **Merged:** 2026-10-03T08:57:24Z (GitHub) · **Merge commit:** `4d1b245baee3e4b508ccabd41b4c41b6c23a6d60` · **Branch:** `ci/audit-exception-and-build` (final head `f041d24860be7f757fef5f56e8391ac2e1cd1f47`)
- **Gate breaches:** none. The final review round's head SHA equals the PR's final head SHA, and the receipt was written before the merge.
- **Approval receipt:** `reviews/PR-5.receipt` on `agent-logs`, commit `c23b5c7` (written 2026-10-03T08:53:56Z; merge was 08:57:24Z; reviewed head and review-file hash `ee6a8024b3ee55cbcf0261d1025aea4d269d99ef` match). Review archived in commit `57f338f`.
- **Merge evidence:** `gh pr view 5` → state MERGED, mergedBy `charliekhc`, merge commit above; `git merge-base --is-ancestor` confirms it is reachable from `origin/main` (checked 2026-10-03).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved with conditions (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.5) · **Plan:** none · **Milestone:** pre-Phase 0 PR 2 (repository health)

## What changed
Three files, +20/−0, one commit. `pnpm build` is added to the `checks` job in `.github/workflows/ci.yml`. `pnpm-workspace.yaml` gets `auditConfig.ignoreGhsas` with the single entry `GHSA-vfj7-8cjw-p6xm` (`braces` <= 3.0.3). `docs/DECISIONS.md` is created (kit header plus the exception entry).

## Why
`main` had failed the "Dependency audit" job since 2026-10-03 03:18Z, which blocked every PR. The advisory lists no patched version and npm's latest `braces` is 3.0.3, so no update could clear it. `braces` is reached only through two dev tooling plugins. CI also had no production build step (UNI-13).

## Review rounds
- R1 (Blocked): [P1] self-check table missing → added to the PR body, no new commit.
- R2 (Approved with conditions): one P2, deferred (below).

## Deferred conditions
- P2: Phase 0 PR 4 (plan Task 17) must assert that the built runtime image excludes `braces` and run the image scan. Recheck the exception at every phase gate and when a patched `braces` ships; then remove the ignore.

## Decisions worth keeping
Owner-approved, expiring audit exception, recorded in `docs/DECISIONS.md` ("braces audit exception"). The ignore is by advisory ID; the CI audit job still has no `--prod`, and a different advisory still fails it (tested locally with a dummy ID: exit 1; not re-run in CI). Job rename to mention the build step was an optional suggestion, not done.

## Follow-ups
- PR #4 (open) also adds `docs/DECISIONS.md`: when it is rebased onto `main`, keep the header once and both sets of entries.
- Phase 0 PR 4: image assertion and image scan (above).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-5.md. -->

## Round 2 — 2026-10-03 · scope: slice
- **Code review:** base (merge base) `df24b195787a431022b965e985b86aa00805f52c` · head `f041d24860be7f757fef5f56e8391ac2e1cd1f47` · head re-checked at end: yes
- **Spec review:** n-a; source spec v4.5 at `docs/superpowers/specs/2026-09-27-core-sales-design.md`, hash `27b43efceb97a4f2724e0c6f07ba8882db87efc5`

**Verdict:** Approved with conditions
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project's mapped deep tier is Opus 5.5 for security review gates; this model is outside that table.

### Findings

### [P2] Verify the advisory is absent from the future production image
- Category: material risk
- Rule: UNI-13; `docs/DECISIONS.md` “braces audit exception”
- Evidence: `pnpm-workspace.yaml:8-12` ignores `GHSA-vfj7-8cjw-p6xm` globally by ID. The current lockfile reaches `braces@3.0.3` through root `devDependencies` only; no Dockerfile or production image exists. `docs/DECISIONS.md:12-13` names the Phase 0 image job and each phase gate as follow-up checks.
- Failure scenario: a later production dependency brings in vulnerable `braces`; the advisory-wide ignore leaves `pnpm audit` green, and an image without an exclusion check could ship it.
- Why it matters: the ignored advisory is high severity. Impact is isolated for this PR because the current chain is development tooling and no runtime image exists, so this guardrail risk is P2 rather than P1.
- Required correction: in the Phase 0 foundation runtime/image PR, make the image job assert that the built runtime image excludes `braces`, run the planned image scan, and retain the phase-gate rechecks. Remove the ignore when a patched release or a dependency-chain change makes it unnecessary.
- Owner: builder
- Verification: inspect the built production image or SBOM and its CI assertion; re-run the audit without the ignore when the advisory changes.
- Disposition: deferred to Phase 0 foundation PR 4 (plan Task 17, runtime/image PR; distinct from repository PR #4)
- Status: open

Round 1's P1 is **resolved**: PR #5's body now contains a self-check with rule IDs, pass/fail/n-a results, evidence, reasons for n-a, and a line explaining the other ticked packs. The commit and effective diff did not change.

### Self-check audit

Independent applicability is unchanged from Round 1. Each new builder row was compared with the pinned diff, lockfile and CI evidence:

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-04 | Yes: boundary lint must remain enforced | pass | pass; lint step remains and CI passed | `.github/workflows/ci.yml:29`; CI checks job | none |
| UNI-06 | n-a: no dependency added or updated | n-a | correct; manifests and lockfile unchanged | three-file effective diff | none |
| UNI-07 | Yes: no committed secrets | pass | pass; changed text has no secret and CI scan passed | diff; CI secret job | none |
| UNI-12 | Yes: writes stay in project | pass | pass; all changed paths inside repo | diff paths | none |
| UNI-13 | Yes: CI build, audit and secret scan | pass with accepted exception | pass under recorded owner exception; all CI jobs green; production build ran; audit reports one ignored high advisory | workflow; config; CI run `37109277016`; decisions entry | deferred image check as P2 above |
| UNI-14 | Yes: tooling and integrations pinned | pass | pass; actions and packages unchanged and pinned | workflow; package manifest | none |
| UNI-16 | n-a: no deployment, env, domain or auth behavior changed | n-a | correct; no runbook triggered | three-file diff | none |
| Project §9 architecture boundary | Yes: keep boundary lint tooling | pass | pass; plugins remain and lint runs in CI | root manifest; workflow and CI | none |
| Other ticked packs | n-a: no UI, tenant DB, money, finalized record, auth, public link, file/template, event/job or payment implementation changed | n-a with pack list and reason | correct for this diff | three-file diff | none |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 5` before and after review | PR open; same head `f041d24860be7f757fef5f56e8391ac2e1cd1f47`; self-check added to body; all three CI jobs success |
| `git fetch origin`; exact-commit check; `git merge-base` | pinned head available; merge base `df24b195787a431022b965e985b86aa00805f52c` |
| Detached checkout; effective diff and `git status --untracked-files=no` | three files, 20 insertions, one commit; no tracked or staged changes |
| `git diff --check`; source-spec `git hash-object`; project secret-scan pattern | pass; spec hash matches; text matches only pre-existing docs/plan files |
| CI run `37109277016` | typecheck, lint, tests, production build, audit and secret scan passed; Round 1 inspected the build and audit logs for this unchanged SHA |
| Official GitHub advisory, checked again 2026-10-03 | `braces <=3.0.3` affected; no patched release listed |
| Official pnpm audit documentation | ignore is by GHSA ID; `auditConfig.ignoreGhsas` remains supported |
| Local typecheck/lint/test/build/audit | not run; exact-head CI logs and status used because the commit is unchanged |

### Residual risks and test gaps
- The advisory-wide ignore can mask a future production path. The deferred image condition and phase-gate rechecks above keep this risk explicit.
- The builder's negative test using a dummy ignored ID was not independently rerun; pnpm's documented ID filtering and the current CI audit support the narrower claim.
- PR #4 also adds `docs/DECISIONS.md` and is still open. Its later integration must preserve both sets of entries.

### Required before merge
- None for PR #5. This verdict is for the recorded head SHA only; the owner merges.

### Deferred conditions
- P2: Phase 0 foundation PR 4 (plan Task 17) must verify the built runtime image excludes `braces` and run the image scan.

### Optional improvements
- Rename the checks job to mention the build step when convenient.
