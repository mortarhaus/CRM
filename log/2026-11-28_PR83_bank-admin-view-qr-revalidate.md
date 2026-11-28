# PR 83 — Admin view of bank details; QR route needs 2FA and must-revalidate; audit mask by code point

- **Merged:** 2026-11-28T13:25:33Z (by charliekhc) · **Merge commit:** `83cea4691808c047151974f688a9f5719d3086a6` · **Branch:** `feat/bank-admin-view-qr-revalidate`
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-83.receipt` (receipt commit `8cf9ac7`; review in `5afec23`, blob `4945ac4ed1e6094fd62e8c7841a35ece9a2e8e58`), time 2026-11-28T13:24:43Z, 50 seconds before the merge, for head `8a65f4c276415c63978ad97e3d576fda36f400e2`
- **Merge evidence:** host state MERGED (`gh pr view 83`); merge commit reachable from fetched `origin/main`; parents `3a50c26` and `8a65f4c`; the merge tree equals the reviewed head's tree (`6465b2a1`); final head equals the reviewed head
- **Drafted by:** Opus 5.5 sub-agent (code and review fixes); Sonnet 5.5 (checks, commits, this log) · **Final verdict:** Approved (round 2, reviewer model GPT-6 (Codex))
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 13 (`bf633eb3850c101134e682d4cea21dcc19cd93af`) · **Plan:** none (follow-ups of spec revision 13) · **Milestone:** Bank settings follow-up after Phase 2

## What changed
An Admin with 2FA can view the bank details and the DuitNow QR on the Bank page, view only; changes stay Owner only with step-up. The QR route serves an Admin or Owner with 2FA only and sends `must-revalidate`. The account-number audit mask keeps the last 4 Unicode code points, and the owner email job reads only changed column names and three formatting settings. The logo preview route is recorded as an accepted FILE-04 exception.

## Why
Spec v4.7 revision 13 ("Changes in v4.7" item 11), the owner decisions of 2026-11-27, Bob's spec review Round 32 P2 (split character in the audit mask), and Charlie's 2026-11-28 "yes" on the logo preview.

## Review rounds
- R1: [P1] Add the TEN-08 isolation self-check → PR body row, plus a cross-workspace audit lookup test (`c33b076`)
- R1: [P2, before merge] Keep current bank values out of the notification read → `findEmailSettings` reads country, time zone and date format only (`b3a0a99`)
- R1: [P2, before merge] Assert that denied Bank views omit the saved values → `expectNoSavedDetails` in the browser test (`8a65f4c`)
- R2: no new findings; Approved

## Deferred conditions
- none. The Unicode audit-mask condition carried from PRs 81 and 82 is satisfied.

## Decisions worth keeping
In `docs/DECISIONS.md` (2026-11-28): the logo preview FILE-04 exception; the Bank settings build entry, with Charlie's approval of the three Admin-view messages ("Use all three") and of `undici` 8.12.3 as a test-only dependency ("Add it").

## Follow-ups
- Existing Owner behaviour: saving bank details, then uploading a QR without reloading, is refused as stale. Small separate PR.
- `CLAUDE.md` still says the bank settings Admin-view and QR revalidation change is to be built: next docs change or `setup`.
- Next spec PR: the revision 13 Status label, and spec line 100 "needs no audit code change".
- Bank QR and logo preview routes are reviewed again with FILE-03 at the Phase 4 gate.
- Local only: root `.env` database credentials do not match the dev Compose stack (E2E used the committed dev-only URLs).
- Next phase plan: Phase 3 (customers and team).

## Appendix — final review round

## Round 2 — 2026-11-28 · scope: Bank settings, Round 1 fixes

- **Code review:** base and merge base `3a50c26e92823ae322ded09d62cd1472f3b306a9` · head `8a65f4c276415c63978ad97e3d576fda36f400e2` · head re-checked at end: yes.
- **Spec:** CRM v4.7 revision 13, blob `bf633eb3850c101134e682d4cea21dcc19cd93af`.
- **Reviewer:** Bob · **Builder:** Andy.

### Findings

- **Round 1 P1 resolved — TEN-08.** PR body line 66 now cites the rejected foreign-workspace QR read, exact audit ID and action lookup in both workspaces, Owner payment-write binding, and table RLS tests. The new lookup test (`apps/web/src/lib/audit.test.ts:129–140`) uses the same ID and action in the two workspaces, including a successful own-workspace control.
- **Round 1 P2 resolved — notification projection.** `apps/web/src/jobs/bank-details-email.ts:73–76` uses `findEmailSettings` under the same workspace transaction. Its query selects only country, time zone and date format and keeps the previous missing-row failure (`apps/web/src/db/settings/workspace-settings.ts:60–71`). The real database test checks the exact result and the failure for a missing row. The job tests reject calls to the full settings accessor. The separate audit reader still projects changed column names without values.
- **Round 1 P2 resolved — denied Bank views.** `apps/web/e2e/bank-details.spec.ts:279–287,329–353` checks that the synthetic saved values are absent from rendered text and the page HTML. It also rejects forms and fields in the denied main content and retains the direct QR-origin checks. The Admin positive case checks the same seeded values. The revised case passed at all three CI widths.
- No new findings in the revision delta.

### Self-check audit

| Rule | Reviewer result |
|---|---|
| TEN-08 | Revised rule row matches the QR, audit-read and payment-write isolation evidence. |
| UNI-09, TEN-09 and TEN-11 | The notification uses narrow audit and settings projections under the transaction's workspace context. The missing-row path and unchanged notification behavior have CI coverage. |
| AUTH-03 and FE-70 | Revised denial coverage checks what users can see and whether saved values were sent in page HTML. Three browser projects passed. |
| FILE-04 and prior Unicode condition | No new route or mask changes in this delta. Exact-head CI passed the stale-cache and payment-action regression cases. The deferred Unicode condition from PRs #81 and #82 is satisfied. |

### Verification performed

- Fetched and pinned the exact head and merge base, reviewed the delta, verified the spec blob, and ran `git diff --check` in a clean detached checkout.
- Exact-head workflow `46145946571` passed all eight jobs, including the image and all three browser jobs. The main test suite reported 1,543 passed and one skipped.
- Verified individual CI logs for the audit lookup, notification, settings data layer, payment actions and stale-cache tests. The revised Bank case passed on chromium, tablet-768 and mobile-320. The E2E total was 255 passed and 18 skipped.
- Used exact-head CI for executable verification. I did not rerun the application, browser or cache tests locally.

### Required before merge

- No open review findings. Run `approved 83` to archive the review and record the pre-merge receipt.

### Deferred conditions

- None. The pre-existing sequential Owner form version issue is outside this change and remains recorded in the PR.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for archiving and recording the receipt.

**Verdict:** Approved
