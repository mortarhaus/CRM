# Review — spec `core-sales-design`

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
