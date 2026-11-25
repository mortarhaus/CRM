# PR 75 — feat: email template events, table and renderer (Phase 2 PR 8a)

- **Merged:** 2026-11-25T09:11:22Z · **Merge commit:** a65399e21f5e5a9c566fbd89bf0bb72ec3f8abae · **Branch:** feat/p2-email-templates-core
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-75.receipt` on agent-logs (receipt commit e71730f, review commit bcd7f4b; written 2026-11-25T09:05:11Z, about 6 minutes before the merge; head bae8dd6, review-file hash ab7ffbed…)
- **Merge evidence:** `gh pr view 75` state MERGED at the time above; merge commit equals fetched `origin/main`. Final head bae8dd6 equals the reviewed head. All five CI jobs SUCCESS on that head.
- **Drafted by:** Opus 5.5 sub-agent under Andy (Sonnet 5.5) · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` (PR 8, Tasks 23-24) · **Milestone:** Phase 2

## What changed
New core module `@crm/core/templates`: the eight email events, their fields and default texts, and a single-pass renderer that escapes its output and refuses unknown or malformed placeholders and a line break in the subject. New `email_template` tenant table (migrations 0037, 0038) with a read and save helper that audits what changed without storing the text. The bank-details owner email now reads its subject and body from the core default; the sent output is unchanged.

## Why
Plan PR 8 Tasks 23-24, Q23 (answered 2026-11-24) and the Q18 owner email wording; FILE-05, FILE-06.

## Review rounds
- R1: Blocked.
  - [P1] Supply the required self-check table → rule-by-rule table added to the PR body.
  - [P1] Keep editable template text out of append-only audit history → audit records event, actor, versions, default state and changed field names only (3b946c8).
  - [P2] Reject incomplete and nested placeholders during validation → one tokenizer for validation and rendering (41fad7a).
  - [P2] Update the runbook reference for the bank-details email default → bae8dd6.
  - [P3] Refresh the next step in the local handoff → done.
- R2: Approved. Two optional P3s.

## Deferred conditions
none

## Decisions worth keeping
- Event 8 (`payment_details_changed`) keeps the Q18 text that is sent today; the Q23 draft for event 8 is superseded. It has no `client_name` or `sender_name`.
- Subject limit 200, body limit 5,000 (approved by Charlie).
- Template audit entries never hold subject or body text.
- Plan PR 8 was split: 8a (core, table, helper) and 8b (settings page, e2e).

## Follow-ups
- [P3] `packages/core/src/security/limits.ts:90` comment still says the limits are pending Charlie (fix in 8b).
- [P3] Handoff header lagged the next step (builder, fixed at the next update).
- Residual: no test races two first saves from independent connections.
- 8b (`feat/p2-email-templates-page`) must be rebased on main, checked, pushed and reviewed. Its size (433 non-test lines before the R1 follow-up) needs Charlie's accept-or-split answer; the sample values "Siti Rahim" and "bank details" are unconfirmed.
- The future email sender must handle a line break a substituted value puts into a subject.

## Appendix — final review round
## Round 2 — 2026-11-25 · scope: slice

- **Code review:** merge base `9b8a6d02ed80ea6b09434f49313ff53b95cebde2` · head `bae8dd6236c6fe5f775f191f3818978fe2e55aba` · head re-checked at end: yes, open and unchanged.
- **Spec:** Core Sales v4.7 revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`. Phase 2 plan Tasks 23–24, Q23 and Q18. Task 25, the settings page, preview and action, is PR 8b.
- **Checkout:** detached `.agent/worktrees/review-75-bae8dd62`. Final status was clean, including untracked files.

### Findings

No blocking findings.

### [P3] The email-limit comment still reads as pending owner approval

- Category: defect.
- Rule: UNI-02 and builder §7.
- Evidence: `packages/core/src/security/limits.ts:90` labels the 200 and 5,000 limits proposals pending Charlie. `docs/DECISIONS.md:6` records approval of both.
- Failure scenario: A maintainer reading the constants can incorrectly assume the limits still need an owner decision.
- Why it matters: The stale comment is the only discrepancy. Code, migrations and the decision agree on the limits.
- Required correction: Update the comment at the next edit to these constants.
- Owner: builder.
- Verification: Compare the revised comment with the approved decision and limits.
- Status: open (optional).

### [P3] The handoff header and active PR summary lag the updated next step

- Category: defect.
- Rule: reviewer §2.
- Evidence: `.agent/handoff.md:1`, `:9` and `:13` still describe an unanswered Q23 or no active PR. Line 41 correctly names the new head and the re-review. GitHub confirms PR #75 is open at `bae8dd62`.
- Failure scenario: The next session follows the active-target summary and misses the open PR.
- Why it matters: The correct continuation is already in the file-level next step, which resolves the specific Round 1 P3.
- Required correction: Refresh the header and active-target summary during the next builder handoff update.
- Owner: builder.
- Verification: Compare those fields with the host PR state and the Q23 decision.
- Status: open (optional).

### Round 1 resolutions

| Finding | Status | Verification |
|---|---|---|
| P1, required self-check table | Resolved | PR description lines 12–48 contain the table, evidence and reasons for n-a entries. Cross-checked applicable rules and the grouped AUTH entries. |
| P1, raw template text in the audit log | Resolved | `email-templates.ts:76`–`:83` records actor, event, versions, default state and changed field names in the same transaction. The save-and-restore regression in `email-templates.test.ts:93` passed in CI as `crm_app`. It inspects all audit columns for the synthetic value. |
| P2, incomplete and nested placeholders | Resolved | `render.ts:11` is shared by validation and rendering. `render.test.ts:52`–`:74` covers both original cases, stray delimiters and literal single braces. Independent probe repeated those paths. |
| P2, email runbook reference | Resolved | `phase-1-security.md:225`–`:228` now points to the core Q18 default and the worker renderer. The Q18 output regression still passed in CI. |
| P3, stale file-level next step | Resolved | `.agent/handoff.md:41` records the new head and the current continuation. See the remaining optional header finding above. |

### Self-check audit

| Applicable rules | Builder said | Reviewer found and evidence |
|---|---|---|
| UNI-01, UNI-02, UNI-04, UNI-05 | Pass | Typecheck and lint green. Owner-approved constants and defaults match the code and SQL. Catalog uses the shared Zod helper. The data helpers support the agreed split. |
| UNI-03, FILE-05, FILE-06 | Pass | Catalog actions preserve the shared schema flow. The template validator and renderer agree on token boundaries. The local probe confirmed single-pass substitution, escaping of interpolated text and rejection of CR/LF in the subject. The bank email output tests passed. |
| UNI-07, UNI-09, UNI-10 | Pass | Secret scans clean. Template audit data is limited to metadata and appended in the save transaction. Audit grants are SELECT and INSERT for `crm_app`, with INSERT as its only write privilege. |
| UNI-13, UNI-15 | CI partly observed in description, additive schema passed | All five CI jobs passed. Cold-start migrations passed and the Round 1 migration files are identical. |
| TEN-01–08, PROJECT §9 database roles and FK rules | Pass, TEN-03 n-a for the editable template table | Rechecked owner and runtime roles, required tenant key, RLS policy and manifest against the exact head. Two-workspace, role-grant and catalog RLS suites passed. The FK points at the system organization table. |
| TEN-09–11, PROJECT §9 workspace context, AUTH-01–03 | Pass | Template helper receives the workspace-scoped transaction. RLS enforces the transaction setting. The catalog uses the existing session workspace, Admin/Owner authorization and action schema. The catalog action tests passed. |
| TEN-12 and rules outside the slice | n-a | This head adds no tenant bypass, editor entry point, template preview, queue contract, public link, upload or payment workflow. |
| Reviewer §7 | Database and email runbooks updated | Verified grant and policy descriptions in the database runbook and the Q18 source path in the security runbook. |

I reviewed PR text, the three new commits and their diff for instructions addressed to the reviewer. GitHub reported zero PR discussion comments, reviews and inline comments.

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`, `gh pr view 75`, `git merge-base origin/main HEAD` | Pinned the exact head and merge base. Rechecked the GitHub head and checkout status at the end. |
| Three-dot diff from merge base and Round 1 head | 24 files and nine commits. The three follow-up commits cover audit, grammar and runbook. Compared migrations, email sender, default catalogue, lockfile, workflow and tenant fixtures to Round 1. |
| `git diff --check` and project added-line secret check | Clean, zero secret-pattern matches. CI full-history gitleaks also passed. |
| Isolated Docker Node 24.21.0 probe with read-only source and no network | Nine malformed or unknown cases rejected in both subject and body. Literal braces and adjacent tokens worked, substituted values were escaped and skipped on subsequent scanning, and all eight default subjects and bodies validated and rendered. |
| GitHub CI run 45569648224 at `bae8dd62` | 5/5 successful. Typecheck, lint, build, dependency audit, 1,460 unit/integration tests (1 skipped), pooler gate, image, Trivy, cold-start migration and image E2E passed. E2E recorded 240 passed and 12 skipped. Renderer suite 28 passed, DB template suite 3 passed, bank email suite 5 passed, isolation 55 passed, RLS 22 passed, privileges 19 passed and catalog action suite 15 passed. |

### Residual risks and test gaps

- I executed the renderer probe locally and used CI for application, live-role database and browser checks.
- The real-role suite exercises a sequential stale save. It still has no test for two first saves racing on independent connections. The insert conflict is handled before the audit write, and that code path is unchanged from Round 1.
- PR 8b's page, authorization and preview need verification at its own head.

### Required before merge

- No code corrections.

### Deferred conditions

- None.

### Optional improvements

- Update the limit comment and handoff summary.

**Model used:** GPT-6 (Codex). PROJECT.md names Opus 5.5 for deep review. **Switch model next step?** No for the approval receipt, which is administrative.

**Verdict: Approved.**

