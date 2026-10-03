# Review — PR #5

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

## Round 1 — 2026-10-03 · scope: slice
- **Code review:** base (merge base) `df24b195787a431022b965e985b86aa00805f52c` · head `f041d24860be7f757fef5f56e8391ac2e1cd1f47` · head re-checked at end: yes
- **Spec review:** n-a; source spec v4.5 at `docs/superpowers/specs/2026-09-27-core-sales-design.md`, hash `27b43efceb97a4f2724e0c6f07ba8882db87efc5`

**Verdict:** Blocked
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project's mapped deep tier is Opus 5.5 for security review gates; this model is outside that table.

### Findings

### [P1] The required rule-by-rule self-check is missing
- Category: guardrail mismatch
- Rule: `agents/roles/builder.md` §§5, 7; `agents/roles/reviewer.md` §§3, 6
- Evidence: PR #5 body includes an “Evidence” command-results table, but no self-check with rule IDs, pass/fail/n-a, evidence per rule, reasons for n-a, or a line identifying irrelevant ticked packs. `agents/roles/builder.md:126-130` requires those fields. The changed files contain no such table either.
- Failure scenario: the reviewer cannot compare the builder's rule applicability and exception assessment against an independent list, especially for the audit suppression under UNI-13.
- Why it matters: `agents/roles/reviewer.md` §3 requires **Blocked** when there is no self-check table, even if CI is green.
- Required correction: builder adds the PR-body self-check for the applicable rules listed below, with evidence and explicit n-a reasons, then requests `review 5` again.
- Owner: builder
- Verification: compare the completed table with the independent applicability list and recheck every claimed pass on the new head.
- Status: open

### Self-check audit

Independent applicability list for this CI and audit-config diff, made before treating the PR's command-results table as builder evidence:

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-04 | Yes: lint-enforced module boundaries must remain in CI | no rule row | lint remains and passes in CI | `.github/workflows/ci.yml:29`; CI checks job | missing row |
| UNI-06 | n-a: no dependency added or updated | no n-a row | no dependency change in diff | three-file diff | missing row |
| UNI-07 | Yes: new committed text must contain no secrets | no rule row | no secret found in changed files; secret-scan CI passed | diff; CI secret job | missing row |
| UNI-12 | Yes: agent writes stay within project | no rule row | changed files are inside repository | diff paths | missing row |
| UNI-13 | Yes: build, audit and secret scan are the purpose of the PR | no rule row | CI jobs pass; build ran; the named advisory is ignored | CI run `37109277016`; workflow/config | missing row |
| UNI-14 | Yes: build tooling and integrations must stay pinned | no rule row | no floating action or package introduced | workflow diff; package manifest | missing row |
| UNI-16 | n-a: no deployment, env, domain or auth behavior changed | no n-a row | no runbook triggered by this diff | three-file diff | missing row |
| Project §9 architecture boundary | Yes: the decision retains lint plugins protecting `packages/core` | no constraint row | lint job still runs; no boundary edit | decisions entry; CI log | missing row |
| Other ticked packs | n-a: no UI, tenant DB, money, finalized record, auth, public link, file/template, event/job or payment implementation changed | no pack rationale | no runtime changes in diff | three-file diff | missing rationale |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 5` before and after review | PR open; head `f041d24860be7f757fef5f56e8391ac2e1cd1f47` unchanged; three CI jobs success |
| `git fetch origin`; `git cat-file`; `git merge-base` | exact head available; merge base `df24b195787a431022b965e985b86aa00805f52c` |
| Detached review checkout; `git status --untracked-files=no --short` | pinned head; no tracked or staged changes |
| `git diff --stat`, `--name-status`, `git log`, and effective diff | three files, 20 insertions, one commit |
| `git diff --check` | pass |
| Project secret-scan pattern via `rg -l` | matches only pre-existing documentation/plan files; CI secret scan success |
| CI checks job log | typecheck, lint, tests and `pnpm build` ran; Next production build completed successfully |
| CI audit job log | one high vulnerability, one ignored; job success |
| Official GitHub advisory and npm package listing, checked 2026-10-03 | `GHSA-vfj7-8cjw-p6xm` affects `braces <=3.0.3`; no patched release listed; npm latest is 3.0.3 |
| Official pnpm audit documentation | `auditConfig.ignoreGhsas` remains supported in pnpm 11; ignore is by GHSA ID |
| Local typecheck/lint/test/build/audit | not run; CI logs for the exact head were used, and no dependencies were installed in the review checkout |

### Residual risks and test gaps
- The owner-approved, expiring audit exception is global to this advisory ID, so future occurrences along a production dependency path would also be ignored. The recorded condition is to assert `braces` is absent from the production image in the Phase 0 image PR; no Dockerfile or production image exists yet. Recheck at that gate and each later phase gate as `docs/DECISIONS.md` requires.
- The PR's claim that substituting a different ignored ID makes audit fail was not independently rerun. The CI audit and pnpm's documented per-GHSA filtering support the current behavior.
- PR #4 also adds `docs/DECISIONS.md` and remains open. Whichever PR merges second must preserve both sets of entries when resolving the add/add conflict.

### Required before merge
- Add the required PR-body self-check and obtain a new review round for the resulting PR state.

### Deferred conditions
- None introduced by this round. The existing owner decision requires the production-image check in the Phase 0 image PR.

### Optional improvements
- Rename the CI checks job to mention the build step; this does not affect the gate.
