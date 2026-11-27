# PR 80 — ci: run the browser tests as one job per screen size, in parallel

- **Merged:** 2026-11-27T00:39:34Z · **Merge commit:** b0dbc52579fb7492571fa2e6e56e0466c62636b8 · **Branch:** ci/split-e2e-job
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-80.receipt` on agent-logs (review commit 0eb90d4, receipt commit ccfeb7a; written 2026-11-27T00:38:55Z, 39 seconds before the merge; head 92aa80a, review-file hash f70794f3…)
- **Merge evidence:** `gh pr view 80` state MERGED at the time above; merge commit equals fetched `origin/main`, with 92aa80a as its second parent and the same tree. Final head 92aa80a equals the reviewed head. All eight jobs of CI run 45834314859 SUCCESS on that head, the last at 2026-11-26T14:30:25Z, before the receipt.
- **Drafted by:** Andy (Sonnet 5.5); the change was built by an Opus 5.5 sub-agent · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** none (carried item of the Phase 2 close) · **Milestone:** between Phase 2 and Phase 3

## What changed
The CI job "Image, Trivy, E2E" is now "Image, Trivy, smoke" (20-minute limit) followed by "E2E (chromium)", "E2E (tablet-768)" and "E2E (mobile-320)" in parallel (40-minute limit each), each on its own fresh stack. A guard test keeps the CI matrix equal to the Playwright projects; the CI runbook and decisions log are updated. No application code, schema or data change.

## Why
The combined job took 69 of its 90 minutes on PR 78 and the Phase 2 close carried a split before about 75.

Measured on run 45834314859: image job 2m03s; chromium 23m31s, tablet-768 23m40s, mobile-320 25m37s; image start to last E2E end 27m43s (PR 78 combined job 68m58s); whole run 32 minutes. 91 tests per project; 255 passed and 18 skipped overall, as before (reviewer's counts). The four jobs used 74m51s of runner time.

## Review rounds
- R1: Approved. One optional [P3] "Keep Compose diagnostics for an auth smoke failure": open.
- R2: Approved, same head, no new findings.

## Deferred conditions
none

## Decisions worth keeping
In the decisions log entry "2026-11-26 — CI: the browser tests run as one job per Playwright project":
- Each E2E job builds its own image from the same commit; Trivy scans the build of the image job, not those bytes. The builder asked the owner whether they wanted the exact scanned image instead; they approved and merged without asking for it.
- Specs must not depend on another project having run first. The run line must be `pnpm test:e2e --project=<name>` with no `--`.

## Follow-ups
- Optional P3 (R1): after the stack starts, a failed auth smoke check shows no Compose service logs. Builder suggestion: fix with the next CI change.
- The push run on `main` for the merge commit (45918009472) was still in progress when this log was written; its result is not part of this merge's evidence.

## Appendix — final review round
## Round 2 — 2026-11-27 · scope: confirm CI slice at the same head

- **Code review:** base and merge base `8c75b014125388e1a7acaa4439dae6f5696454fa` · head `92aa80a492915f7a1ca0bf5761f9000e3c0701fa` · head re-checked at end: yes.
- **Spec:** CRM v4.7 revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`.
- **Reviewer:** Bob · **Builder:** Andy.

### Findings

The Round 1 P3 remains optional. An auth smoke failure after Compose starts has the dev-server output but lacks Compose logs. The relevant conditions at `.github/workflows/ci.yml:124–143,187–200` are unchanged. This recheck found no new issues.

### Self-check audit

Rule applicability and the audit carry forward from Round 1. The PR still lists UNI-13 and FE-70, with passing evidence for the original image gate and all three browser widths.

### Verification performed

| Check | Result |
|---|---|
| Remote base, PR head and detached checkout | Same commits as Round 1. PR is open. Detached checkout was clean. |
| `git diff --check` and `bash -n .github/scripts/code-changed.sh` | Passed. Filter still reports `true` for workflow changes and missing SHAs, `false` for the docs-only comparison. |
| Exact-head CI run `45834314859` | Same completed run, all eight jobs passed. The browser counts and timings are recorded in Round 1. |

### Residual risks and test gaps

- Reused the exact-head CI evidence for image and browser tests. Local recheck covered the change filter and workflow diff.

### Required before merge

- Run `approved 80` to archive this review and record the approval receipt.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for archiving the review and writing the receipt.

**Verdict: Approved.**
