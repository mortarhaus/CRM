# Review — spec `core-sales-design`

## Round 5 — 2026-10-09 · scope: v4.6 revision 11 follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 11 · hash (`git hash-object`) `7d402bb9a79af423daa06c75de86bf2d74857b01` · present on `origin/main` at merge `3b0a4bf9272670243082e04857351f3f3f2992a1`

**Verdict:** Approved
**Model used:** GPT-6.1 · **Switch model next step?** Yes — the project maps deep spec review to Opus 5.5; use that tier to confirm this review before build.

### Findings

### [P2] The agreement-pattern lock during provisioning may not be owner-approved — resolved
- Category: ambiguity
- Rule: `agents/PROJECT.md` §11; spec Open question 10
- Evidence: Charlie explicitly replied in this conversation: “option 1: and approved v4.5 as a whole, and the refusal rule was in the approved spec text. Adding it explicitly to the Approval record would remove the ambiguity.” Revision 11 records that answer at `docs/superpowers/specs/2026-09-27-core-sales-design.md:13`, and the approval record at line 7 and Open question 10 at line 224 now identify both the future-only behavior and the refusal while an unfrozen SOW awaits provisioning.
- Failure scenario: without the answer, the provisioning-time refusal could be treated as approved based only on an assistant recommendation.
- Why it matters: this is an owner-controlled default previously marked “pending Charlie.”
- Required correction: keep the answer and its scope accurately recorded in the Approval record, Open question 10 and the decision log.
- Owner: builder (record); owner (decision)
- Verification: compared Charlie's direct answer with the revision 11 wording and the matching `docs/DECISIONS.md` entry; the P2 condition is satisfied.
- Disposition: before v4.6 approval
- Status: resolved by Charlie's explicit answer, verified in this review.

### [P3] Handoff still presents PR #14 as open after it merged
- Category: quality
- Rule: reviewer role §2 (report handoff drift)
- Evidence: `.agent/handoff.md:15–16` says PR #14 is open, while lines 49–53 record it as merged and then repeat pre-merge next steps. GitHub reports PR #14 `MERGED`; `origin/main` is merge `3b0a4bf` and contains this spec hash.
- Failure scenario: a later session follows the stale active-target lines and repeats PR review, approval or merge steps already completed.
- Why it matters: the handoff contradicts the repository and its own newer status entry, obscuring the actual next gate.
- Required correction: reconcile the active-target and current-state sections with the merged PR and preserve older steps only as clearly marked history.
- Owner: builder
- Verification: compare the refreshed handoff with PR #14's host state, `origin/main`, and this review.
- Status: open

### Self-check audit

Applicability was based on the full spec scope and the revision 11 change. Revisions 8–10 were checked against earlier findings; revision 11 changes only the recorded scope of an existing owner-approved default.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `MON-01`–`MON-07` | Yes; the spec defines money and FX behavior. | Revision 11 makes no money-rule change. | Pass for carried-forward decisions and rules; the owner-confirmation wording does not change calculations. | Money rules; revisions 1–7; prior review Rounds 1–4. | None. |
| Frontend and accessibility (`FE-05`, `FE-14`, `FE-70`, `A11Y-01`, `A11Y-06`) | Yes; the spec includes the recurring-rate signal and dashboard link. | Revision 11 makes no UI change. | Pass for the carried-forward keyboard, focus and responsive acceptance checks. | Verification (r) 12–14; prior review Rounds 1–4. | None. |
| Tenancy/RLS, auth/public links, `REC-01`–`REC-12`, `PAY-01`, events/jobs | Yes; these domains are in the product spec. | Revision 11 makes no runtime-rule change. | Pass for carried-forward controls; no revision 11 change to access, isolation, finalized records, payments or jobs. | Relevant spec sections; prior review Rounds 1–4. | None. |
| `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13`, `UNI-14` | Yes; product values, secret hygiene, scope, CI and pinned dependencies apply. | No business value, secret, code or dependency change. | Pass; revision 11 is documentation-only and changes no implementation or dependencies. | Revision 11 change record; merged PR #14 CI was green in PR review Round 4. | None. |
| `PROJECT.md` §11 / owner choices | Yes; Q10 previously had a pending owner default. | Pass; Charlie's exact words and source are recorded. | Pass; Charlie directly confirmed that the v4.5 approval included the provisioning refusal. | Charlie's reply; spec lines 7, 13 and 221; `docs/DECISIONS.md`. | None. |

### Verification performed

| Check | Result |
|---|---|
| Pin requested spec | v4.6 draft revision 11; hash `7d402bb9a79af423daa06c75de86bf2d74857b01`; exact file is present on `origin/main` at `3b0a4bf`. |
| Re-read prior spec review rounds | Rounds 1–3 findings are addressed in revisions 8–10. Round 4's Q10 P2 is resolved by Charlie's direct answer and revision 11; handoff status remains inconsistent (P3 above). |
| Compare revision 11 with prior finding and source decision | Approval record and Q10 now name both parts of the accepted default; no rule or behavior changed. |
| Verify PR/merge state | PR #14 is merged; merge `3b0a4bf` is `origin/main` and contains the reviewed spec hash. |
| Code tests | Not run; this is a documentation/spec review. |

### Residual risks and test gaps
- v4.6 remains a draft until Charlie explicitly approves it. After that, reconcile `agents/PROJECT.md` with `setup` before `build`.
- Existing accepted money-rounding limits remain as recorded in prior rounds and `docs/DECISIONS.md`.
- Confirm this review in the project-mapped deep tier (Opus 5.5) before build.

### Required before v4.6 approval/build
- None.

### Deferred conditions
- None.

### Optional improvements
- Refresh the contradictory in-flight handoff state (P3).

## Round 4 — 2026-10-09 · scope: v4.6 revision 10 follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 10 · hash (`git hash-object`) `c20d9ffd93eb3cee6051da804acf53ecea26204d` · present on `origin/main` at merge commit `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`

**Verdict:** Revision required
**Model used:** GPT-6 · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps spec, money, security and data-isolation reviews to deep tier (Opus 5.5); use that tier for the corrected review before build.

### Findings

### [P2] The agreement-pattern lock during provisioning may not be owner-approved
- Category: ambiguity
- Rule: `agents/PROJECT.md` §11; spec Open question 10
- Evidence: the v4.5 approval record at `docs/superpowers/specs/2026-09-27-core-sales-design.md:7` records item 2 as “a customer agreement-pattern change affects future approvals only.” Open question 10's preserved original text at line 218 also includes a separate behavior: refuse the change while an unfrozen SOW is awaiting provisioning. The live rule at line 829 keeps that refusal and revision 10 marks all of Open question 10 resolved based on approval item 2.
- Failure scenario: an owner or builder treats the provisioning-time refusal as approved even though the approval record only explicitly names the future-approvals rule.
- Why it matters: this refusal blocks an owner setting change during a provisioning window; whether that guard is required is a product choice, and `PROJECT.md` §11 requires Charlie's explicit choice for defaults still pending.
- Required correction: have Charlie confirm whether the pending-provisioning refusal was included in v4.5 approval. If yes, record that scope in the approval/decision record. If no, split the question: leave the future-approvals behavior resolved and keep the provisioning refusal open until chosen.
- Owner: owner (Charlie)
- Verification: the spec and its approval record make the status of the provisioning-time refusal unambiguous before v4.6 is approved.
- Disposition: before v4.6 approval
- Status: open

### [P3] Handoff still says PR #12 is open
- Category: material risk
- Rule: reviewer role §2; handoff current-state accuracy
- Evidence: `.agent/handoff.md:11,15–16` says PR #12 is open and `main` is at `00cffa1`. GitHub reports PR #12 merged at `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`; `origin/main` is at that merge commit and contains the reviewed spec hash.
- Failure scenario: a later session follows the handoff and repeats PR #12 review or merge steps instead of resolving the remaining v4.6 decision and review gate.
- Why it matters: the current next step and active target are misrepresented.
- Required correction: update the handoff to record PR #12 merged and the current spec review result and next step.
- Owner: builder
- Verification: compare the handoff with PR #12's host state, `origin/main`, and this review round.
- Status: open

### Self-check audit

Applicability was determined from the full v4.6 scope and the revision 10 diff before comparing earlier review notes. Revision 10 only relabels decisions; the existing money, UI, tenancy, authentication, jobs, and finalized-record requirements remain in scope and were previously checked in Rounds 1–3.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `MON-01`–`MON-07` | Yes; the spec defines stored and computed money and v4.6 changes FX behavior. | Revision 10 makes no rule or behavior change. | Pass for carried-forward rules; the new decision-status wording does not change calculations. Open question 10 remains ambiguous as described above. | Money rules; revisions 1–7; Open question 10; Rounds 1–3. | None beyond finding above. |
| `FE-05`, `FE-14`, `FE-70`, `A11Y-01`, `A11Y-06` | Yes; v4.6 specifies the dashboard link and recurring-rate badge. | Revisions 8–10 are test/status clarifications only. | Pass for carried-forward acceptance checks: keyboard access, visible focus, responsive profiles and accessible text were specified in earlier rounds. | Verification (r) 12–14; Round 1 and Round 2 findings resolved in revisions 8–9. | None. |
| `TEN-02`, `TEN-05`–`TEN-12` | Yes; the product is multi-tenant and the spec defines workspace-scoped reads, writes and purge. | No change to tenancy in revision 10. | Pass for carried-forward controls; revision 10's purge label is consistent with the narrow-scope approval, subject to the separate Q10 finding. | Tenancy; Customer purge; Verification (r) 12; Rounds 1–3. | None. |
| `REC-01`–`REC-12` | Yes; the spec covers issued invoices, credit notes and signed agreements. | No change to finalized-record behavior in revision 10. | Pass for carried-forward snapshot, immutability, numbering and PDF rules; no revision 10 change. | Immutability rules; Numbering; PDF timing; Rounds 1–3. | None. |
| Auth and public-link controls | Yes; anonymous customer links and authentication are part of the spec scope. | No change in revision 10. | Pass for carried-forward controls; no new auth/link behavior. | Authentication and sessions; Anonymous access; Client links and signatures; Rounds 1–3. | None. |
| `PAY-01`, events/jobs | Yes; the spec covers payment records and recurring jobs, but revision 10 changes neither implementation nor behavior. | No change in revision 10. | Pass for carried-forward server-side writes, idempotency and job rules; no new requirement. | Payments and refunds; Domain events and jobs; Rounds 1–3. | None. |
| `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13`, `UNI-14` | Yes; values, secrets, scope, build gates and pinned dependencies apply to the overall spec. | No new business value, secret or dependency; v4.6 remains a draft. | Pass; no new values/secrets/dependencies in revision 10, and project approval/reconcile gates remain stated. | Revision 10 diff; current status line; `agents/PROJECT.md` §§2, 7, 11. | None. |
| `agents/PROJECT.md` §11 / owner choices | Yes; unresolved defaults must remain open until Charlie decides. | Six questions are resolved by the v4.5 approval record. | Partial: five resolutions are supported by their cited accepted defaults. For question 10, the approval record does not explicitly mention the separate refusal during pending SOW provisioning. | Approval record line 7; Open question 10 line 218; Money rule line 829; revision 10 line 13. | Yes; P2 finding. |

### Verification performed

| Check | Result |
|---|---|
| Pin current spec and main | v4.6 draft revision 10; hash `c20d9ffd93eb3cee6051da804acf53ecea26204d`; on `origin/main` at merge commit `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`. |
| Confirm PR #12 merge state | GitHub reports PR #12 merged at `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`. |
| Read earlier spec review rounds | R1 and R2's test-clarity findings are resolved in revisions 8–9; R3's status-label finding is addressed in revision 10, except for the Q10 subdecision recorded above. |
| Compare approval record, question 10 and live rule | Found that the approval record names the future-approvals-only rule but not the separate pending-provisioning refusal. |
| Review revision 10 history and diff from revision 9 | Status labels and references only; no calculation, security control, test, milestone or scope change. |
| Review carried-forward consistency, security controls, scope, milestones and test criteria | No additional revision 10 defect found. Existing v4.6 behaviors and earlier resolved test findings are unchanged. |
| Code tests | Not run; this is a specification review. |

### Residual risks and test gaps
- v4.6 remains a draft; Charlie's approval and `setup` reconciliation remain gates after the spec review is approved.
- Accountant, lawyer, SST and PDPA checks remain gated before Phase 4 goes live, as stated in the spec.
- This review used GPT-6; the project's configured model for deep spec review is Opus 5.5. Use deep tier for the corrected review before build.

### Required before v4.6 approval
- Resolve whether Charlie accepted the refusal to change `customer.agreement_pattern` while an unfrozen SOW awaits provisioning. Keep that subdecision open unless the approval record confirms it.

### Deferred conditions
- None.

### Optional improvements
- None.

**Verdict:** Revision required

## Round 3 — 2026-10-09 · scope: slice (revision 9 follow-up and carried-forward decision status)
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 9 · hash (`git hash-object`) `19e7241aa37841a617f8c56aad3aede0a4c2666d` · `origin/main` commit `4feac56d6a8e473b63d4e2878641eb5e29ca39bc`

**Verdict:** Revision required
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project maps spec review, money, security and data isolation to deep (Opus 5.5). Confirm the corrected spec in that tier before build.

### Findings

### [P2] Open questions still mark v4.5-approved defaults as pending
- Category: spec/guardrail mismatch
- Rule: `agents/PROJECT.md` §11; spec Open questions 1, 5, 10–13
- Evidence: The v4.5 approval record at spec line 7 says Charlie accepted the `pg` driver restriction, narrow purge scope, agreement-pattern rule, excess-only refunds, “Credited” label and guarded credit-note void. Open questions at lines 203, 207, and 212–215 still ask Charlie to choose or confirm those same defaults; questions 5 and 10–13 explicitly say “pending Charlie.” `PROJECT.md` §11 says a default still marked pending needs Charlie's explicit choice.
- Failure scenario: After Charlie approves v4.6, setup/build treats one of these choices as unresolved, or the builder reads the question as permission to change a behavior already accepted with v4.5.
- Why it matters: The spec presents conflicting decision status at the build gate and risks either blocking authorized work or changing an owner-approved policy.
- Required correction: Reconcile those question entries with the v4.5 approval record. Mark the accepted decisions resolved and cite the approval, or isolate any genuinely unapproved subdecision precisely. Keep the still-open questions (for example, the Phase 4 VPS provider choice) open.
- Owner: builder
- Verification: Re-read the approval record and Open questions; no accepted default is still labeled pending, and any remaining question identifies a specific choice not covered by the approval.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### Self-check audit
| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| MON-01–MON-07 | Yes — v4.6 changes currency, FX and stored money behavior | No revision 9 change | Prior v4.6 rules remain explicit about minor units, currency, exact rational conversion, frozen rates/base currency, and separate currency totals; the change under review introduces no new money rule | Spec money rules and revision history; revisions 8–9 are test clarifications | None |
| FE-14 / FE-70 | Yes — revision 9 defines responsive test profiles | Prior R2 finding addressed | Pass; cases 13–14 and the Playwright plan consistently name `chromium` and `mobile-chrome` | Spec lines 13, 1057, Verification (r) 13–14; Phase 0 plan pins Playwright 1.63.0 | None |
| FE-05 / A11Y-01 / A11Y-06 | Yes — the recurring-rate count link and badge have keyboard and accessibility acceptance criteria | Prior R1 finding addressed | Pass; tab order, visible focus, Enter activation, accessible badge text, no extra badge tab stop and an automated scan remain specified | Verification (r) 13–14 | None |
| TEN-02, TEN-05–TEN-12 | Yes — CRM is multi-tenant and the spec defines tenant storage and access | No change in revisions 8–9 | Existing spec requires RLS/default deny, server-derived tenant context and isolation tests; no inconsistency found in this follow-up | Spec “Tenancy”; Verification (r) 12 | None |
| AUTH / public-link controls | Yes — authentication and anonymous client links are in scope | No change in revisions 8–9 | Existing OTP, expiry, revocation, scoped resolution and concurrency requirements remain testable; no inconsistency found in this follow-up | Spec “Authentication and sessions,” “Anonymous access,” “Client links and signatures,” Verification (a)–(g) | None |
| UNI-13 | Yes — eventual implementation must pass delivery checks | No change in revisions 8–9 | Not an implementation change; no CI claim is needed for this spec review | Spec “Verification (for the build)” | None |
| `PROJECT.md` §11 / pending owner choices | Yes — the spec carries defaults that control later plans and implementation | Not included in the revision 9 change summary | Disagreement: the approved v4.5 record and current “pending Charlie” labels conflict (finding above) | Spec lines 7, 203, 207, 212–215; `agents/PROJECT.md` §11 | Yes |

### Verification performed
| Check | Result |
|---|---|
| Pin spec version and hash on current `origin/main` | v4.6 draft revision 9; `19e7241aa37841a617f8c56aad3aede0a4c2666d`; main at `4feac56d6a8e473b63d4e2878641eb5e29ca39bc` |
| Read previous spec review rounds | R1 fixture-isolation and keyboard/responsive findings are covered in revision 8; R2's undefined mobile-profile finding is covered in revision 9. |
| Compare v4.5 approval, current decisions, PROJECT gates and Open questions | Found the stale pending labels recorded above. The v4.6 owner choices in revisions 1–7 otherwise match the documented decision history. |
| Check revision 9 Playwright profile against pinned library | The Phase 0 plan pins Playwright 1.63.0. Its [official device registry](https://github.com/microsoft/playwright/blob/v1.63.0/packages/isomorphic/deviceDescriptorsSource.json) contains both Desktop Chrome and Pixel 5; Pixel 5 is a Chromium mobile profile with touch support and a concrete viewport. |
| Review spec structure and acceptance criteria | Reviewed money rules and examples, tenancy and access controls, links/signatures, milestones and gates, open questions, and the recurring-signal cases. No other revision 9 defect found. |
| Code tests / implementation checks | Not run; this is a specification review and no implementation change is under review. |

### Residual risks and test gaps
- This review uses GPT-6.1-sol rather than the project-mapped Opus 5.5 deep tier. Re-review the corrected revision in deep tier before build.
- Accountant, lawyer, SST and PDPA checks remain explicitly gated before Phase 4 goes live; they do not block Phase 0 work.

### Required before v4.6 approval/build
- Resolve the pending-status contradiction in Open questions 1, 5, and 10–13.

### Deferred conditions
- None.

### Optional improvements
- None.

### Handoff block
- **Current objective:** Review v4.6 revision 9 at spec hash `19e7241aa37841a617f8c56aad3aede0a4c2666d`.
- **Completed checks:** Pinned current `origin/main`; rechecked both earlier spec findings; verified the named Playwright profiles against the pinned 1.63.0 device registry; compared Open questions with the v4.5 approval record and project gates.
- **Pending checks:** Reconcile Open questions 1, 5, and 10–13 with the approved v4.5 choices; run a fresh spec review on the resulting hash.
- **Key decisions / assumptions:** Charlie's v4.5 approval remains authoritative for defaults listed in its approval record. Do not infer a new choice from Bob's recommendation.
- **Open risks:** Current spec repeats “pending Charlie” for decisions the v4.5 approval says Charlie accepted.
- **Next exact command:** `fix`, then `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md`.
- **Suggested model tier for next step:** Deep (Opus 5.5), as required for spec, money and security review by `agents/PROJECT.md` §6.

## Round 2 — 2026-10-08 · scope: spec review
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 8 · hash (`git hash-object`) `de327c9ba836c0d3a01b793d81b8394c9c3fa47e` · matches `origin/main` at `0e11cde7549a6146d0813aa454f03161d131e81c`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project maps spec review and money behavior to deep tier (Opus 5.5); confirm this finding in that tier before build.

### Findings

### [P2] Responsive test references a mobile viewport that is not defined
- Category: ambiguity
- Rule: Verification (r) 14; `FE-14`, `FE-70`
- Evidence: the spec says case 14 uses “the mobile viewport it uses for client pages” (`docs/superpowers/specs/2026-09-27-core-sales-design.md:1034`). The referenced Phase 0 Playwright configuration defines only `projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]` and has no mobile viewport or viewport size (`docs/superpowers/plans/2026-09-29-phase-0-foundation.md:2308`). No other `viewport` or mobile device configuration appears in that plan.
- Failure scenario: the implementer must choose an unstated width/device profile, so two test suites can claim to satisfy case 14 while testing different breakpoints; the spec's mobile overflow and full-label assertions are not reproducible from the named plan.
- Why it matters: responsive behavior is an explicit acceptance test for the new dashboard, invoice-list badge and detail header, and FE-14/FE-70 require the supported mobile width to be exercised.
- Required correction: define the mobile viewport/device profile used by the test (in the spec or the referenced Playwright plan) and have cases 13–14 refer to that same named configuration.
- Owner: builder
- Verification: the named plan or spec resolves to a concrete Playwright viewport/device configuration, and cases 13–14 unambiguously use it.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### Self-check audit

Applicable areas: money rules and `MON-02`/`MON-04`/`MON-05`/`MON-06` for the v4.6 changes; frontend `FE-05`, `FE-14`, `FE-70`, `A11Y-01`, `A11Y-06` for the new in-app signal; tenancy/RLS and auth for workspace-scoped reads; events/jobs for the recurring signal's no-event/no-job rule; universal `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13`; and `PROJECT.md` §9 owner decisions/exceptions. These were checked against the spec, decision log and prior review. No revision 8 owner choice or business value was introduced.

| Rule / area | Applies? | Reviewer found | Evidence |
|---|---|---|---|
| `MON-02`, `MON-04`, `MON-05`, `MON-06` | Yes — core v4.6 scope | Owner-decided currency and rounding rules remain consistent with their decision-log entries; revision 8 changes only test setup/assertions | Spec money rules, data model, `docs/DECISIONS.md` |
| `FE-05`, `A11Y-01` | Yes — dashboard count is a link and badge is text | Keyboard, visible focus, reading order, Enter activation and non-focusable badge are specified | Verification (r) 13 |
| `FE-14`, `FE-70`, `A11Y-06` | Yes — responsive browser acceptance | No overflow and full labels/accessible scan are specified, but the mobile viewport is undefined (finding above) | Verification (r) 14; Phase 0 Playwright plan config |
| Tenancy/RLS | Yes — count and filtered list are workspace-scoped | Workspace isolation is explicit with real `crm_app` role and RLS | Verification (r) 12; Dashboard v1 |
| Events/jobs | Yes — signal must add none | Tests distinguish signal side effects from recurring-run and issue events | Money rules; Verification (r) 10 |
| `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13` | Yes | No new product values or secrets; spec is in-repo; exact-head CI on merged PR #9 had passed per PR review record | Revision 8 diff; `.agent/reviews/PR-9.md` Round 1 |
| `PROJECT.md` §9 | Yes | Revision 8 adds no exception or owner decision; existing accepted risks remain documented | `docs/DECISIONS.md`; spec change history |

### Verification performed

| Check | Result |
|---|---|
| `git fetch origin`; compare requested spec with `origin/main` | Spec hash `de327c9ba836c0d3a01b793d81b8394c9c3fa47e` matches the spec on `origin/main` (`0e11cde`) |
| Re-read prior spec-review Round 1 and PR #9 Round 1 | The fixture-isolation and keyboard/responsive findings are addressed; the handoff's stale Git-state section has since been corrected |
| Re-read revision 8 history, recurring money rules, dashboard count, authorization, tenancy/RLS, event/job rules, Phase 5 acceptance criteria and Verification (o), (p), (q), (r) | No further inconsistency found; the previously reported (r) fixture contradictions are resolved |
| Inspect the referenced Playwright plan | Desktop Chrome is configured; no mobile viewport/device or viewport size is defined, confirming the finding |
| Code tests | Not run; this is a specification review |

### Residual risks and test gaps
- The final spec approval and `PROJECT.md` reconcile remain pending. The handoff correctly requires Charlie's approval in his own words before `setup`, then `build`.
- Existing owner-accepted limits remain: cumulative-rounding void gaps can accumulate by one base minor unit per void until a new row of that series; credit-note component amounts can differ from the official base total due to rounding.
- This review used GPT-6.1-sol rather than the project-mapped Opus 5.5 deep tier. Confirm in deep tier before build.

### Required before merge / v4.6 approval
- Define the mobile viewport/device profile used by Verification (r) 13–14.

### Deferred conditions
- None.

### Optional improvements
- None.

**Verdict:** Revision required

## Round 1 — 2026-10-07 · scope: spec review
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 7 · hash (`git hash-object`) `583533732daa8ac9634374514bc664c9bc73dcaa` · current on `origin/main` at `3bc4604965c03dd6d5828ed1cc8260c1aa1d4794`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — this review covers money behavior; the project maps that work to deep tier (Opus 5.5), and the review should be confirmed in that tier before build.

### Findings

### [P2] Recurring-run verification cases need explicit fixture isolation
- Category: ambiguity
- Rule: Verification (r)
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:1014` issues and sends T1/P1; line 1017 later requires the same T1/P1 to remain a draft and unsent; line 1019 refers to the P1 draft from case 1 showing the badge; line 1022 reuses T2 from case 5 after that case has issued and sent its invoice, then describes an `auto_send`-off draft.
- Failure scenario: a reader treats cases 1–12 as one sequence and finds cases 6, 8, and 11 impossible after cases 3 and 5; another reader resets fixtures between those cases and gets a different test setup.
- Why it matters: the recurring-run behaviors are financial and idempotency-sensitive; the Phase 5 acceptance tests need an unambiguous starting state for each assertion.
- Required correction: state which cases run with isolated/reset fixtures and which intentionally share state; update cross-references so no test expects an invoice both issued and still draft.
- Owner: builder
- Verification: re-read each case in (r) as a deterministic executable sequence and confirm the referenced invoice/template states are reachable.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### [P2] The new dashboard link lacks an explicit keyboard and responsive check
- Category: guardrail mismatch
- Rule: FE-05, FE-70, `FRONTEND_STANDARDS.md` §3.4
- Evidence: the new dashboard count is a link to a filtered invoice list (`docs/superpowers/specs/2026-09-27-core-sales-design.md:572`), and cases (r) 8–9 check badge text, role visibility and the link destination (`:1019-1020`). The general Playwright plan says mobile viewport coverage for client pages and mentions dashboard totals, but does not cover keyboard navigation or mobile widths for this dashboard link and its new badge surfaces (`:1038`).
- Failure scenario: the count or badge is rendered correctly by pointer but cannot be reached or activated by keyboard, or the link/badge causes overflow at a narrow app viewport, while the specified tests still pass.
- Why it matters: this adds interactive authenticated UI; the frontend rules require keyboard operation and browser tests at desktop and mobile widths.
- Required correction: extend the recurring signal verification to exercise the dashboard link with keyboard and visible focus, and check the dashboard, invoice list row and detail header at desktop and mobile widths (including no horizontal overflow).
- Owner: builder
- Verification: the Phase 5 Playwright cases assert keyboard activation/focus and responsive rendering at the named viewports.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### [P3] Handoff still reports PR #6 as open and awaiting Round 6
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:11` says PR #6 is open and awaiting review 6 on revision 6; `.agent/handoff.md:16` says PR #6 merged at `3bc4604`. The repo's `origin/main` contains that merge and the spec is revision 7.
- Failure scenario: the next session follows the stale active target and repeats completed PR review work.
- Why it matters: the handoff contradicts repository state and obscures the next gate.
- Required correction: update the handoff to reflect PR #6 merged and this formal spec review's result.
- Owner: builder
- Status: open

### Verification performed
- Confirmed the requested file hashes to `583533732daa8ac9634374514bc664c9bc73dcaa`, matching `origin/main` and `agents/PROJECT.md`.
- Reviewed v4.6 change history, data model, money rules, recurring-run behavior, dashboard, authorization, tenancy and RLS requirements, events/jobs, Phase 5 acceptance criteria, and the relevant guardrail packs.
- Confirmed the owner choices in revisions 1–7 are recorded in `docs/DECISIONS.md`; the spec continues to mark v4.6 as a draft and v4.5 as the approved source of truth.
- No code tests were run; this is a specification review.

### Residual risks and test gaps
- Existing owner-accepted limits remain documented: post-void base-currency gaps can accumulate, and credit-note parts can differ from their official base total due to rounding.
- This review used GPT-6.1-sol rather than the project-mapped Opus 5.5 deep tier. Confirm the findings in that tier before build.

### Handoff block
- **Current objective:** Obtain formal review of v4.6 revision 7 at hash `583533732daa8ac9634374514bc664c9bc73dcaa`.
- **Completed checks:** Compared requested hash with `origin/main`; checked decisions and relevant money, auth, tenancy, UI and job requirements; identified two open P2s and one handoff P3.
- **Pending checks:** Resolve the recurring-run fixture ambiguity and add keyboard/responsive assertions; refresh the handoff; re-review the exact resulting spec hash.
- **Key decisions / assumptions:** Charlie's recorded v4.6 choices stand; v4.5 remains the approved source until v4.6 is approved.
- **Open risks:** Do not use the revised spec for build while this review is Revision required.
- **Next exact command:** `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` after edits.
- **Suggested model tier:** Deep (Opus 5.5), because this spec defines financial calculations and invoice lifecycle behavior.

**Verdict:** Revision required
