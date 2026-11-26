# PR 79 — docs: close Phase 2

- **Merged:** 2026-11-26T13:01:13Z · **Merge commit:** 8c75b014125388e1a7acaa4439dae6f5696454fa · **Branch:** docs/phase-2-close
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-79.receipt` on agent-logs (review commit 9bfaf88; written 2026-11-26T12:42:30Z, 19 minutes before the merge; head e432717, review-file hash c005ef02…)
- **Merge evidence:** `gh pr view 79` state MERGED at the time above; merge commit equals fetched `origin/main`, with e432717 as its second parent and the same tree. Final head e432717 equals the reviewed head. Four CI jobs SUCCESS on that head, the last at 12:39:33Z, before the receipt; "Image, Trivy, E2E" SKIPPED by the docs-only filter.
- **Drafted by:** Opus 5.5 sub-agent under Andy (Sonnet 5.5), with Sonnet 5.5 corrections · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` · **Milestone:** Phase 2 (closed by this merge)

## What changed
`docs/DECISIONS.md` gained the "2026-11-26 — Phase 2 close" entry: evidence for the four done-when items, the FILE-03 exception review at the Phase 2 gate, the owner answers of 2026-11-25 and 2026-11-26, and the carried items; the 2026-10-03 FILE-03 entry points to it. `CLAUDE.md` Status is up to date. No code, test, CI or spec change.

## Why
Builder §7 and the Phase 2 gate: the FILE-03 exception named this gate as its review date, and owner answers must be recorded with what was asked.

## Review rounds
- R1: Revision required.
  - [P1] Add the rule rows for step-up and workspace binding → AUTH-09 and TEN-11 self-check rows added to the PR body.
  - [P2] Scope the QR access statement to requests that reach the server → control (7) limited to the origin, with the one-hour private cache recorded (e432717).
- R2: Approved, no new findings.

## Deferred conditions
none

## Decisions worth keeping
All in the decisions log entry "2026-11-26 — Phase 2 close":
- FILE-03 exception kept (owner "1a"); next review at the Phase 4 gate.
- Proposal cover options wait for Phase 6; the `require_2fa` switch goes in the Phase 3 plan (owner "1 yes, 2 yes").

## Follow-ups
- Builder suggestion, not decided by the owner: weigh the QR route's `Cache-Control: private, max-age=3600` at the Phase 4 FILE-03 review (a fresh browser copy skips the Owner and current-key checks for up to one hour; not exercised in a browser).
- Next: split the "Image, Trivy, E2E" job (about 69 of 90 minutes); the spec PR for line 803 (and the revision 9 "draft" label); the Phase 3 plan.
- "Admin may view the QR" (owner, 2026-11-25) needs a spec revision before it is built.
- Open owner questions: account-number separators; a DuitNow/PayNow ID text field; whether Admins see the bank details text; the deleted-user wording; "2 decimals 0.00"; the "drop down list from the settings"; the other asks listed in the entry. The Cloudflare token is not saved yet.
- Production object-store conditional put stays a pre-deployment check (`docs/runbooks/phase-2-storage.md`).
- Process: a push made right after switching the repo public was refused twice (403 "Repository is disabled"); pushing first, then switching, worked. Cause unverified.

## Appendix — final review round
## Round 2 — 2026-11-26 · scope: Phase 2 milestone gate, changes since Round 1

- **Code review:** base and merge base `ffa616e757d6dcac7fb9e566bab2ca4e56414be5` · head `e432717981aa16cfc7db73cf8f12c59ffba22d7d` · head re-checked at end: yes.
- **Spec:** CRM v4.7 revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca` · Phase 2 row.
- **Reviewer:** Bob · **Builder:** Andy.

### Findings

No new findings.

- **Round 1 P1 resolved.** PR body lines 76–77 now record AUTH-09 and TEN-11 individually. The QR upload invokes `requireStepUp` before reading or storing bytes (`settings/payment/actions.ts:39,98–117`). A missing step-up is refused and storage stays untouched (`actions.test.ts:246–251`). The server session selects the workspace and a rendered-workspace mismatch is refused before the action handler (`lib/auth/action.ts:85–98,206–209`). The two-workspace payment QR case checks both the refused stale post and the valid active-workspace post (`app/workspace-binding.test.ts:84,173–197`). The QR read uses the same session-derived workspace, with the query parameter checked only against the current key (`files/payment-qr/route.ts:16–23`).
- **Round 1 P2 resolved.** `docs/DECISIONS.md:14` limits the Owner and current-key assertions to the origin and records that a fresh private browser cache entry may be reused for up to one hour without repeating those checks. Confirmed the 404 `no-store` response and the successful `private, max-age=3600` response at `files/payment-qr/route.ts:11–37`. The direct handler test at `settings/payment/actions.test.ts:263–282` verifies the role, workspace and key boundaries at the origin.

### Self-check audit

| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| AUTH-09 | Step-up control for the QR exception | pass | Correctly recorded and supported | PR body line 76 and payment action tests | No |
| TEN-11 (hard) | Session workspace and stale page refusal | pass | Correctly recorded and supported | PR body line 77, action wrapper, two-workspace QR test and serve route | No |
| FILE-03, FILE-04, AUTH-03 | QR exception, delivery and origin permissions | pass | Access and browser caching described with their observed scope | PR body lines 67–68, `docs/DECISIONS.md:14,42`, QR route | No |
| UNI-13 | Exact-head CI | pass | See verification | Run `45820994196` | No |

Other applicability judgments and Phase 2 evidence carry forward from Round 1.

### Verification performed

| Command / check | Result |
|---|---|
| Fetch, merge base, detached checkout, Round 1 diff, `git diff --check` | The only new commit changes two lines in `docs/DECISIONS.md`. The full PR still changes only `CLAUDE.md` and `docs/DECISIONS.md`. Whitespace check passed. |
| Inspect revised decision, PR body and source/test references | Both Round 1 findings resolved. |
| Exact-head workflow `45820994196` | Typecheck, lint, test, `test:gates`, production build, dependency audit, secret scan and changed-files check passed. The image, Trivy and E2E job was skipped by the docs-only filter. |
| Phase 2 functional evidence | Main base `ffa616e` and PR #78 head `6d11ee3` still have identical trees. PR #78 run `45799683831` passed the full image, Trivy and E2E job. The cited cases and test counts are in Round 1. |
| PR head and detached worktree at end of review | Same head and clean checkout. |

### Residual risks and test gaps

- Relied on CI for executable verification. Local checks and browser cache behavior were not rerun.
- The production object-store verification and Phase 4 FILE-03 review remain recorded follow-ups.

### Required before merge

- No open findings. The project’s `approved 79` command archives the review and writes the approval receipt before the owner merges.

### Deferred conditions

- None.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for archiving this review and writing the approval receipt.

**Verdict: Approved.**
