# PR 77 — fix: refuse a save from a page opened in another workspace

- **Merged:** 2026-11-26T04:26:41Z · **Merge commit:** 6926c5dc4d43ed4294e9e8f72fef61807d0b6211 · **Branch:** fix/settings-workspace-binding
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-77.receipt` on agent-logs (review commit b1467df; written 2026-11-26T02:26:23Z, two hours before the merge; head 9ad66d8, review-file hash 47c5e9d4…)
- **Merge evidence:** `gh pr view 77` state MERGED at the time above; merge commit equals fetched `origin/main`, with 9ad66d8 as its second parent. Final head 9ad66d8 equals the reviewed head. All five CI jobs SUCCESS on that head; "Image, Trivy, E2E" finished 03:06:43Z, after the receipt and before the merge.
- **Drafted by:** Opus 5.5 sub-agent under Andy (Sonnet 5.5) · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** none (owner-approved follow-up to PR #76 R1) · **Milestone:** Phase 2

## What changed
`action()` now requires the workspace the posting page was rendered for and refuses a missing or different value as `WORKSPACE_CHANGED`, before the membership check or any write, storage, job, step-up, rate-limit or idempotency work. All 13 bound actions post it and reset their client state on a workspace change; the eight Better Auth forwarders are exempt, and an inventory test fails for a new action without a decision. The session stays the only authority for the destination.

## Why
A form opened in one workspace and submitted after switching to another wrote into the second one (bank details most serious). Found while fixing PR #76 R1; Charlie approved this follow-up on 2026-11-25.

## Review rounds
- R1: Revision required.
  - [P1] Keep raw action payload reads behind the authentication and role checks → session first, then only the marker, other input read after the role check; eight order tests (a94f415).
  - [P1] Cover the applicable boundary and delivery rules in the PR self-check → rows added in the PR body (9ad66d8).
  - [P2] Document the other causes of a workspace-binding refusal → runbook names stale and pre-deployment pages too (705133c).
- R2: Approved. One optional P3: the PR description wrongly says the eight failing cold-run tests touch no bound action (test email and onboarding do).

## Deferred conditions
none

## Decisions worth keeping
- Every `action()` is bound to the rendered workspace; there is no opt-out. A new action needs the hidden field and its two-workspace case.
- A page rendered before a deployment (no marker) is refused once; reloading fixes it.
- The decisions entry of 2026-11-25 records Charlie's approvals: PR 8b size, no-JavaScript draft loss, this follow-up.

## Follow-ups
- **Open owner question:** catalog refusals echo free text (`catalog/actions.ts:72`, `:88`, `:101`). Bob and the builder recommend returning only allow-listed choices and booleans, as a separate PR.
- P3 not corrected in the PR description. Observed: two e2e runs on a freshly started dev server each failed the first eight chromium `accessibility.spec.ts` tests; they passed alone and in a full warm run, and image E2E passed in CI. Cause unverified.
- "Image, Trivy, E2E" took about 67.5 minutes (limit 90; Bob suggested splitting before about 75).
- Residual (R1/R2): no stale-workspace browser case with JavaScript disabled; `pnpm test:gates` not run locally (CI ran the pooler gate).

## Appendix — final review round
## Round 2 — 2026-11-26 · scope: slice

- **Code review:** merge base `0b7a04c77e9f0682dc88ed79c8b4b80048da9813` · head `9ad66d801489b4fe39cc0bab5b14f34584b59fb9` · head re-checked at end: yes, open and unchanged.
- **Spec:** Core Sales v4.7 revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`. Shared workspace binding, Phase 1 plan Tasks 14–15 and the owner-approved follow-up to PR #76.
- **Checkout:** detached `.agent/worktrees/review-77-9ad66d80`. Final status was clean, including untracked files.

### Findings

No blocking findings. All three Round 1 findings are resolved.

### [P3] Correct the PR description of the cold development browser failures

- Category: defect.
- Rule: reviewer §3, precise verification claims.
- Evidence: PR description lines 97–98 report eight tests failing on two cold development runs and say those tests touch no bound action. The spec includes test email at `apps/web/e2e/accessibility.spec.ts:173` and `:237`. `apps/web/e2e/helpers.ts:62` also calls onboarding as part of workspace creation. Both operations go through the shared wrapper.
- Failure scenario: A maintainer reads the evidence as excluding the changed code from the reported test paths.
- Why it matters: The report describes sign-up or navigation failures, and the cases subsequently passed on a warm server. The root cause of the cold failures remains unverified.
- Required correction: Omit the claim about action coverage and keep the observed failure stage and uncertainty about the cause.
- Owner: builder.
- Verification: Compare the PR description with the named browser test paths. Use the exact-head production-image result for the merge gate.
- Status: open (optional).

### Round 1 resolutions

| Finding | Status | Evidence |
|---|---|---|
| P1, early raw payload reads | Resolved | `action.ts:85`–`:92` reads the session and active workspace before invoking the marker reader. `renderedOf` reads only the marker (`:135`–`:137`). `withoutRendered` and form decoding run only after membership, the role gate and any required 2FA check (`:206`–`:211`). The eight order regressions in `action.test.ts:353` onward passed. I independently tested signed out, no active workspace, stale/missing marker, Staff role, required 2FA and authorized posts for both raw input and FormData. |
| P1, applicable self-check rows | Resolved | PR body lines 125–127 and 140 include UNI-04, UNI-07, UNI-13 and FE-22, with the updated AUTH-01 evidence on line 109. Cross-checked current-head boundary lint and gitleaks, the inventory suite, editor copy and CI status. |
| P2, runbook diagnoses only workspace switching | Resolved | `phase-1-security.md:113`–`:118` now lists a switched workspace and an old or stale form missing the marker, retains reload guidance and drops the categorical conclusion. Wrapper tests cover missing, non-text and different markers, with normal bound forms passing. |

### Self-check audit

| Rule | Re-reviewed result |
|---|---|
| AUTH-01/02/03/06/09 | The session is read first, only the marker is read before authorization, and the normal path retains Zod and transaction ordering. Stale posts stop ahead of membership, settings initialization, rate limiting and step-up. Auth and step-up suites passed. |
| TEN-02/08/09/10/11 and PROJECT §9 | Both representations preserve the session as the write destination. The 13-action matrix passed against the actual app role and disposable storage/queue infrastructure in CI. |
| UNI-01–05, UNI-07/09/10/13/16 | The applicable self-check gaps are filled. CI typecheck, lint, build, secret scan and dependency audit passed. The stale rejection still returns a status only. The runbook text now covers failure modes. Production-image E2E remains pending. |
| FILE-01–03, EVT-01 | Exact-head binding tests still cover no storage write or queue submission on stale requests. Existing upload and enqueue paths remain exercised by the positive cases. |
| Applicable FE and A11Y rules | The follow-up retains the Round 1 UI wiring and the three-width workspace-switch case. The shared message is centralized. Round 1 image E2E passed at three widths. The PR reports exact-head warm development E2E passing. Exact-head image E2E had not finished. |

I reassessed the Round 1 applicability list against the five files changed since that head before checking the updated builder table. Reviewed the new commits, PR description and diff for instructions directed at the reviewer. GitHub reported zero discussion comments, reviews and inline comments.

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`, `git merge-base origin/main HEAD`, `gh pr view 77` | Pinned the exact merge base and head and rechecked host state at the end. |
| Three-dot diffs, `git diff --check`, added-line secret scan | 39 files overall, three follow-up commits since Round 1. Clean diff. The one secret-pattern match remains the synthetic test fixture from Round 1. Exact-head full-history CI gitleaks passed. |
| Independent Docker Node 24.21.0 probe with Zod 4.6.7 | Ran the checked-out wrapper in a network-disabled fixture with read-only inputs and stubbed session, membership and DB boundaries. Raw and FormData refusals kept the business payload unread. Authorized matching posts passed validation and used the session workspace. |
| GitHub CI run 45738891083, exact head `9ad66d80` | Typecheck, lint, dependency audit, secret scan, build and pooler gate passed. Unit/integration suite: 1,521 passed, one skipped across 81 files. Reviewed exact-head wrapper (47), step-up (14), action inventory (25) and two-workspace binding (13) results. Image build, Trivy, cold-start migrations and the auth-route smoke test passed. Image E2E was still running. |

### Residual risks and test gaps

- I ran the wrapper ordering probe locally and verified the full database tests through CI. Browser evidence for the final production image is still pending. The prior exact head passed image E2E and the builder reports a full warm-development pass on the current head after the cold failures described above.
- Catalog's pre-existing raw freetext echo is outside this slice and still recorded as a separate owner question. The Round 1 recommendation to return only values the server can establish are safe still stands.

### Required before merge

- No code corrections from this review. The existing UNI-13 gate still requires passing CI on this head, including image E2E.

### Deferred conditions

- None.

**Model used:** GPT-6 (Codex). PROJECT.md names Opus 5.5 for deep reviews. **Switch model next step?** No for the administrative approval receipt after CI.

**Verdict: Approved.**

