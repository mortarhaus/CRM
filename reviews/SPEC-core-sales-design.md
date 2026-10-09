# Review — spec `core-sales-design`

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
