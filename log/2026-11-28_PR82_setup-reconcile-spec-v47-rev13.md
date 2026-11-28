# PR 82 — docs: setup reconcile to spec v4.7 revision 13

- **Merged:** 2026-11-28T05:37:15Z · **Merge commit:** 3a50c26e92823ae322ded09d62cd1472f3b306a9 · **Branch:** chore/setup-reconcile-v4-7-rev13
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-82.receipt` on agent-logs (review commit f50d750, receipt commit c3746c7; written 2026-11-28T05:35:03Z, 2 minutes 12 seconds before the merge; head c51ee12, review-file hash edcbcd81…)
- **Merge evidence:** `gh pr view 82` state MERGED at the time above; the merge commit is reachable from fetched `origin/main`, has parents 826f70d and c51ee12, and has the same tree as c51ee12 (7b03bf0e). Final head c51ee12de8939fa3036f22d256f93f90c8f22e5d equals the reviewed head. CI run 46111470791 on that head: the docs-only jobs passed, image and E2E skipped. The run on the merge commit (46112935328) was still in progress when this log was written.
- **Drafted by:** an Opus 5.5 sub-agent drafted both commits' changes (owner, 2026-11-28, "subagent on opus"); Andy (Sonnet 5.5) checked, adjusted and committed them (both trailers on both commits) · **Final verdict:** Approved with conditions (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 13 (hash `bf633eb3850c101134e682d4cea21dcc19cd93af`, not changed here) · **Plan:** none · **Milestone:** between Phase 2 and Phase 3

## What changed
Documents only, three files. `agents/PROJECT.md` follows spec revision 13: the spec row and hash, the Bank QR preview recorded as a scoped FILE-04 alternative, a storage summary that names both same-origin image previews, and the section 11 items (SHA-256 wording done, 30-day client link confirmation added to the Phase 7 gate). `CLAUDE.md` status is up to date, and `docs/DECISIONS.md` records Charlie's approval of revision 13.

## Why
`build` stops at the reconcile gate while the spec hash in `PROJECT.md` differs from the merged spec.

## Review rounds
- R1: [P1] Record the authorization check for the reconciled QR alternative → AUTH-03 row added to the PR description, with the related auth and tenancy rows clarified.
- R1: [P2] Keep the storage summary accurate for the existing logo preview → `PROJECT.md` section 8 corrected (c51ee12).
- R2: Approved with conditions; both R1 findings resolved; no new findings.

## Deferred conditions
- Carried from PR 81 (spec Round 32 P2): the audit mask takes the last 4 whole Unicode code points, and the settings write is verified. To the Bank settings Admin-view and QR revalidation implementation PR.

## Decisions worth keeping
- Charlie's approval of spec revision 13 is now in `docs/DECISIONS.md` (2026-11-28). The spec reconcile gate is clear at hash `bf633eb3`.
- The QR-specific FILE-04 approval does not cover the logo preview route (review Round 2).

## Follow-ups
- Open owner question: `/files/logo` has a 1-hour private browser cache behind a session check, not a signed URL of 10 minutes or less, and `PROJECT.md` section 9 records no FILE-04 alternative for it. Builder recommendation: record it as an accepted alternative in the next documents change. Not answered.
- Next spec PR: relabel revision 13 as approved and correct the "needs no audit code change" sentence (`docs/DECISIONS.md` 2026-11-28, builder note).
- Implementation PR (Bank settings): QR route `must-revalidate`; Admin view with the 2FA check; Unicode-safe audit mask with a test; owner email job reads changed column names only; their tests and the runbook note.
- Then the Phase 3 plan (customers and team).

## Appendix — final review round

## Round 2 — 2026-11-28 · scope: revision 13 setup reconcile, Round 1 fixes

- **Code review:** base and merge base `826f70dbc22cda53990849b95120b689e0dc5b55` · head `c51ee12de8939fa3036f22d256f93f90c8f22e5d` · head re-checked at end: yes.
- **Spec:** CRM v4.7 revision 13, blob `bf633eb3850c101134e682d4cea21dcc19cd93af`. Matches spec Round 32 and the PR #81 approval and merge.
- **Reviewer:** Bob · **Builder:** Andy.

### Findings

- **Round 1 P1 resolved.** PR body line 42 now checks AUTH-03 against spec lines 809–810, 817 and 865, including the Admin/Owner view rules, enrollment and step-up distinctions, the role and 2FA refusal cases, and the current Owner-only route. Lines 43–46 document the related origin, mutation and workspace guards and identify runtime changes as implementation follow-ups.
- **Round 1 P2 resolved.** `agents/PROJECT.md:180` now records the logo and Bank QR previews as authenticated same-origin reads. It describes the current lack of a signed-URL method and retains the ten-minute rule for signed downloads. `agents/PROJECT.md:245` still scopes the revision 13 alternative to the Bank QR preview. The summary matches the existing logo handler and storage runbook.
- No new findings in the reconcile. The existing logo route is identified in the PR body as an open question about formalizing its storage rule. The QR-specific approval neither answers that question nor changes the logo route.

### Self-check audit

| Rule or check | Reviewer result |
|---|---|
| AUTH-01, AUTH-02, AUTH-03, AUTH-09 and TEN-11 | Documented outcomes match the spec. The self-check distinguishes the intended authorization and workspace outcomes from the current implementation and pending tests. |
| FILE-04 and FILE-03 | The summary now names both existing preview mechanisms and identifies the QR-specific alternative. QR retention and the Phase 4 review are carried forward. |
| UNI-02, UNI-09, UNI-10 and UNI-16 | No new configuration, audit storage, logging or operational behavior in the diff. Approved defaults and the runbook follow-up are correctly identified. |
| UNI-07 (hard), UNI-13 and LINK-02 | Exact-head secret and delivery checks passed. The Phase 7 confirmation checkpoint remains in the reconcile. |

### Verification performed

- Pinned the new head in a clean detached checkout. The revision delta changes only `agents/PROJECT.md:180`. The full PR remains three Markdown files with a clean diff. Reverified the approved spec blob, final head and docs-only change filter.
- Compared the amended PR self-check and project summary with the pinned spec, logo route, storage runbook and existing authorization controls.
- Exact-head CI run `46111470791` passed typecheck, lint, tests, `test:gates`, the production build, dependency audit, secret scan and changed-files check. Image and E2E skipped under the docs-only filter.
- No local application or browser tests were run.

### Required before merge

- No open blocking review findings. Run `approved 82` to record the pre-merge receipt.

### Deferred conditions carried forward from PR #81

- Correct the Unicode audit mask and verify the settings write in the Bank settings Admin-view and QR revalidation implementation PR.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for archiving this round. Use the project's deep tier for the Bank settings implementation review.

**Verdict:** Approved with conditions
