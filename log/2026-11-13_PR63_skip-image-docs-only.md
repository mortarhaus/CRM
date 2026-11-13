# PR 63 — ci: skip the image job for documentation-only pull requests

- **Merged:** 2026-11-13T15:38:21Z · **Merge commit:** 9cf13937c344a9fba2ca7a1988e35103934e5e86 · **Branch:** ci/skip-image-docs-only
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-63.receipt` on agent-logs (log-branch commit ee393aa1 holds the review; written 2026-11-13T02:43:51Z, before the merge; head 000e026, review-file hash fe211f4c…)
- **Merge evidence:** `gh pr view 63` state MERGED with the time and commit above; commit reachable from fetched `origin/main`. Final head 000e026 equals the reviewed head. All five CI jobs green on 000e026 (run 43261080629; the image job ran, 49m32s).
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 2)
- **Spec:** none · **Plan:** none · **Milestone:** Phase 2 (housekeeping)

## What changed
New `changes` job and `.github/scripts/code-changed.sh`: the 50-minute "Image, Trivy, E2E" job now runs only when a PR touches something outside `docs/`, `agents/` and `*.md`. Unsure means run (unreadable diff, pushes to `main`, any `.github/` change). The other checks still run on every PR. DECISIONS 2026-11-12.

## Why
Closes PR #61's deferred P2 (Actions minutes ran out, the repo moved org). Option (a) only; the self-hosted Mac runner (option b) is not built: "a first but build b when it is needed" (Charlie).

## Review rounds
- R1: [P2] CI red on `boss.test.ts:118` timeout → re-run; green on the final head with the image job run.
- R1: [P2] renames counted as docs → `git diff --name-only --no-renames`.
- R1: [P3] decision not visible → printed in the log and step summary.
- R1: [P3] flaky test unowned → recorded as an open item in DECISIONS.
- R2: Approved, no new findings.

## Deferred conditions
none

## Decisions worth keeping
- Docs-only PRs no longer run Trivy; a new base-image CVE shows on the next code PR. `*.md` anywhere counts as docs.
- No branch protection exists; Charlie checking green CI plus the review/receipt/`merged` gates are the control.

## Follow-ups
- The skip is **not yet observed in Actions**: the first docs-only PR after this merge is the proof. If it still runs the image job, or skips wrongly, fix in a small PR.
- Deflake `apps/web/src/jobs/boss.test.ts:118` in its own PR (diagnose first; do not just raise the timeout).
- Merge PR 62 next (needs this one first); spec line 730 edit before Phase 2 closes.

## Appendix — final review round
## Round 2 — 2026-11-13 · scope: fix check (CI)
- **Code review:** base (merge base) `ab4fccabbb9bca494e8dfaa096bdf597d88fb2ee` · head `000e026d575ad98326e913a21ee6b76621ec025d` · head re-checked at end: yes (unchanged)
- New commit: `000e026` ("Review R1 fix: count renames as code, print the decision"). No review checkout needed.

**Verdict:** Approved
**Model used:** Sonnet 5.5 · **Switch model next step?** No.

#
