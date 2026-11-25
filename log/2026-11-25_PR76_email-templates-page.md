# PR 76 — feat: email templates settings page (Phase 2 PR 8b)

- **Merged:** 2026-11-25T12:58:16Z · **Merge commit:** 0b7a04c77e9f0682dc88ed79c8b4b80048da9813 · **Branch:** feat/p2-email-templates-page
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-76.receipt` on agent-logs (receipt commit 9b7b0ea, review commit 841db1f; written 2026-11-25T12:57:54Z, 22 seconds before the merge; head b2d8395, review-file hash 10e2ae20…)
- **Merge evidence:** `gh pr view 76` state MERGED at the time above; merge commit equals fetched `origin/main`. Final head b2d8395 equals the reviewed head. All five CI jobs SUCCESS on that head.
- **Drafted by:** Opus 5.5 sub-agent under Andy (Sonnet 5.5) · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` (PR 8, Task 25) · **Milestone:** Phase 2 (last plan PR)

## What changed
New `/settings/templates` page for Admin and Owner: one editor per email event, a watermarked preview with sample data, an audited save with an optimistic version, and "Restore the default text". The form is bound to the workspace it was rendered for, a refused save returns field paths only, and a nav link was added. Saved templates are not used by any sender yet.

## Why
Plan PR 8 Task 25, Q23; spec line 792 (Admin and Owner).

## Review rounds
- R1: Revision required.
  - [P0] A template opened in one workspace can overwrite a template in another → the form posts its workspace, refused as `WORKSPACE_CHANGED` before any write (c4b9808).
  - [P1] The invalid-input response echoes free-form text → refusal returns field paths only (2fdd693).
  - [P1] Self-check omits accessibility rules, no keyboard verification → keyboard e2e at three widths and A11Y rows (259defc).
  - [P2] The settings intro implies edits change outgoing email → wording corrected (e49b555).
- R2: Approved.

## Deferred conditions
none

## Decisions worth keeping
- Without JavaScript a refused template save loses the typed draft, so that no posted text is returned (accepted by Charlie 2026-11-25).
- Size accepted by Charlie 2026-11-25: 487 non-test lines (the DECISIONS entry on main still says it had not been re-accepted).
- Any settings form must be bound to the workspace it was rendered for; the session stays the only authority for the destination.

## Follow-ups
- **Next PR (Charlie approved 2026-11-25, before Phase 2 closes):** workspace binding for brand colour, general settings, logo, bank details, payment QR, numbering, onboarding and catalog create (pre-existing on main; bank details is the most serious); check the catalog's echo of free text; add to `docs/DECISIONS.md` the three approvals of 2026-11-25 (size 487, no-JavaScript draft loss, this follow-up).
- Residual (R2): no browser test switches the active workspace while a form is open.
- Dev only: Next dev mode logged the arguments of the existing 2FA actions during e2e (throwaway accounts; local logs deleted). Not yet raised as a finding.

## Appendix — final review round
## Round 2 — 2026-11-25 · scope: feature-complete for Phase 2 email-template editing and preview

- **Code review:** merge base `a65399e21f5e5a9c566fbd89bf0bb72ec3f8abae` · head `b2d8395b083ec548b6650233aab7060a713da8cb` · head re-checked at end: yes, open and unchanged.
- **Spec:** Core Sales v4.7 revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`. Phase 2 plan Task 25, Q23, Q18 and the merged PR #75.
- **Checkout:** detached `.agent/worktrees/review-76-b2d8395b`. Final status was clean, including untracked files.

### Findings

No blocking findings. All four Round 1 findings are resolved.

| Round 1 finding | Re-reviewed evidence |
|---|---|
| P0, stale form writing into another workspace | `page.tsx:21`–`:22` derives the template and its workspace from the same authenticated read. `page.tsx:73` keys the editor by workspace and event. `template-form.tsx:206` posts the render workspace. `actions.ts:61` compares it against the session workspace before the mutation transaction. `actions.test.ts:171`–`:213` verifies both save and restore refusals at versions 0 and 1 with unchanged templates and audit rows in both workspaces, then a successful save and restore in the intended workspace. The independent action probe confirmed a refusal before the write callback. |
| P1, refusal echoes arbitrary template text | `actions.ts:55`–`:57` has no echo configuration and `action.ts` returns only field paths for that action. `actions.test.ts:123` checks both invalid fields using a synthetic address. With JavaScript, the posted draft stays in browser state and the editor can explain the specific refusal. Without JavaScript, the page shows saved text, marks the refused field and explains that the draft was discarded. The no-JavaScript corrected-post test passed. |
| P1, missing accessibility self-check and keyboard coverage | PR description lines 63–68 cover the applicable A11Y rules, and the FE-70 row identifies the paths exercised. The keyboard test in `email-templates.spec.ts:103` checks tab order, visible focus while navigating, keyboard activation, error associations, and focus return after refusal, save, stale save and restore. Verified the case passed at desktop, 768 px and 320 px in CI. |
| P2, intro implies saved changes affect delivery | `messages.ts:299` and `page.tsx:46` tell users that saved edits are for editing and preview and outgoing mail still uses its defaults. This agrees with the Q18 runbook, and the owner-notification view is asserted in browser tests. |

### Self-check audit

| Applicable rules | Builder said | Reviewer found and evidence |
|---|---|---|
| UNI-01–05, UNI-07 | Pass | Exact-head typecheck, lint, build and secret scans passed. Zod validates the workspace ID as a precondition and validates template fields using core. The shared default values and approved length limits agree with the merged slice. |
| UNI-09/10 | Pass | Both tests and source show metadata-only audit through the DB helper and no submitted text in validation refusals. |
| UNI-13/19 | CI pending at time of writing, protected route | All five CI jobs passed. Roles are enforced on the page and action and Staff denial passed in browser and action tests. |
| TEN-02/03/08–11, PROJECT §9 | Pass for relevant paths | Session workspace still determines the query and transaction. The submitted workspace is a precondition. Real `crm_app` action tests, isolation tests and the independent action probe cover the corrected behavior. |
| AUTH-01–03 | Pass | The existing action wrapper checks role before validation and mutation. The shared wrapper change adds only the new refusal value. |
| FILE-05/06 and REC-12 by analogy | Pass | Preview uses the existing tokenizer and renderer, sample data, React text and a watermark. CI tested invalid and markup-like inputs in the preview. |
| Applicable FE and A11Y rules | Pass | Source and exact-head browser logs show the exercised editor, preview, responsive nav, success, refusal, stale state, focus and no-JavaScript retry paths. The cross-workspace refusal is covered at the action layer. |
| Reviewer §7 | Runbooks updated | The DB role and email security runbooks describe the template page and actual Q18 delivery. |

The Round 1 applicability review covered the full diff. The follow-up also touches the shared refusal type and adds the workspace precondition. Reviewed PR text, follow-up commit messages and the diff for instructions directed at the reviewer. GitHub reports zero discussion comments, reviews and inline comments.

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`, `gh pr view 76`, `git merge-base origin/main HEAD` | Pinned the exact head and merge base. Head remained open and unchanged at the final check. |
| Three-dot diff, `git diff --check` and added-line secret scan | 13 files and five follow-up commits after Round 1. Independently counted 487 added lines in non-test, non-doc files. Diff check passed, zero secret-pattern matches on added lines. |
| Independent Docker Node 24.21.0 probe with pinned Zod 4.6.7 | Ran the real action and wrapper with a fixture session and stubbed DB boundary, read-only source and no network. All four stale workspace cases stopped before the write transaction. Invalid input returned field paths only. Matching-workspace save and restore reached the expected callback, and Staff was refused. |
| GitHub CI run 45600120823 at `b2d8395b` | All five jobs passed. 1,479 unit and integration tests passed with one skip, including all 19 template action tests. Typecheck, lint, build, pooler gate, dependency audit, secret scan, image build, Trivy and cold-start migration passed. Image E2E ran 250 passing tests with 14 skips. Reviewed the individual keyboard results at all three widths and the desktop no-JavaScript result. |
| Local browser access | The in-app browser host was unavailable. Browser and live-role DB evidence comes from exact-head CI. |

### Residual risks and test gaps

- With JavaScript disabled, a refused save returns to the stored text and asks the user to re-enter the draft. The working retry path passed. The handoff lists the draft-reset trade-off for owner confirmation.
- The earlier size decision in `docs/DECISIONS.md:6` covers about 433 lines. The fixes add 44 lines to the prior reviewed 443. The PR description and handoff disclose the current 487 and leave the expanded size for the owner. This technical verdict does not record an owner decision.
- The handoff describes similar workspace-context risks in existing settings actions. Those paths are outside this template slice. The shared wrapper change adds the refusal type without claiming to fix those paths.
- CI exercises the decisive workspace switch at the real-role action layer. The browser suite exercises stale version handling and keyboard focus, with no browser case for switching active workspace while the form is open.

### Required before merge

- No code corrections from this review. The owner confirmation items above remain recorded in the handoff.

### Deferred conditions

- None.

**Model used:** GPT-6 (Codex). PROJECT.md names Opus 5.5 for deep reviews. **Switch model next step?** No for recording the approval receipt.

**Verdict: Approved.**

