# PR 56 — feat: Phase 2 PR 3, country defaults and the onboarding step

- **Merged:** 2026-11-07T02:55:15Z · **Merge commit:** 3db1fcca646f5f484994a390d6bb5b963d2dbd46 · **Branch:** feat/p2-country-onboarding
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-56.receipt` on agent-logs (log-branch commit c04edbd5 holds the review; written 2026-11-07T02:53:38Z, before the merge; head 26499ea, review-file hash cba9ee46…)
- **Merge evidence:** `gh pr view 56` state MERGED with the time above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head 26499ea equals the reviewed head. All four CI checks green on 26499ea.
- **Drafted by:** Opus 5.5 sub-agent (code), Sonnet 5.5 builder (verification, PR) · **Final verdict:** Approved (round 3; the reviewer's model is recorded as "GPT-5 (current Codex runtime)", which is not in PROJECT.md §6)
- **Spec:** docs/superpowers/specs/2026-09-27-core-sales-design.md (v4.7 revision 8, unchanged) · **Plan:** docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md (PR 3, Tasks 7-8; Task 9 split out) · **Milestone:** Phase 2 (settings and onboarding)

## What changed
New core module `@crm/core/settings` (`COUNTRY_DEFAULTS` for MY and SG from spec lines 730-733, percent to basis points), an onboarding step in its own `(onboarding)` route group (country, then the SST/GST question; defaults applied by `applyCountryDefaults` in `withWorkspace` via `action()`, audited as `workspace_settings.onboarded`), an `(app)` layout gate (Owner redirected to `/onboarding` while `country IS NULL`; Admin and Staff see a "not finished" page), and migration 0026 (CHECK `not tax_registered or tax_registration_no is not null`). `action()` gains optional `redirectTo` (after commit, ok results only) and `echo` (INVALID_INPUT on a posted form). Task 9 (settings page) is a separate later PR.

## Why
Phase 2 plan PR 3: "MY and SG defaults applied on sign-up" (spec line 1138), partly met until PR 6 seeds the MY invoice pattern and Charlie answers Q10.

## Review rounds
- R1 (Revision required): [P1] self-check table missed UNI-04, UNI-09/UNI-10/TEN-03, UNI-15, A11Y-01 → rows added to the PR body. [P2] without JavaScript a refused Yes came back as No with the field hidden → `echo` on `action()`, Yes kept, field shown, tax name and rate kept (registration number, TIN, BRN deliberately not echoed), new no-JS e2e case (`634228c`). [P3] DECISIONS line for `redirectTo` → added with `echo` (`665a2b2`).
- R2 (Revision required): [P2] A11Y-01 row cited a test that did not exist → `toBeFocused()` asserted after the refusal in the SG e2e case (`26499ea`). [P3] stale Test plan counts → refreshed.
- R3 (Approved): no blocking findings.

## Deferred conditions
none. Carried P3s: Task 9 PR must refuse settings writes before onboarding or handle a tax state set earlier; Charlie to choose a general fix or an accepted limitation for the pre-existing no-JS 409 when a layout or page `redirect()` runs during the re-render of a no-JS post.

## Decisions worth keeping
- Country defaults live in `@crm/core/settings` (module location confirmed by Charlie 2026-11-06, "ok and subagent"); `docs/DECISIONS.md` 2026-11-06 items (1)-(10).
- A `redirect()` thrown while a page re-renders after a no-JS post is a 307 that repeats the POST (Next answers 409); only a redirect thrown from the action is a 303. Hence `redirectTo` in the AUTH-01 wrapper, not a forwarders exemption.
- Q10 values (SG invoice pattern, SG date format, locales) stay `null` with ASK comments; tax rates 8% (MY Service Tax) and 9% (SG GST) are labelled "pending professional check".
- Not edited here: PROJECT.md §9 "STILL OPEN: where country defaults live" (a `setup` reconcile item).

## Follow-ups
- Task 9 PR (settings page, tax/TIN/BRN, timezone, locale, currency) with the P3 above.
- PR 6 seeds the MY invoice pattern; Q10 from Charlie blocks real SG values.
- Charlie's choice on the no-JS render-redirect 409.
- Update PROJECT.md §9 and CLAUDE.md Status in a reviewed `setup` reconcile PR.
- Non-onboarding actions in a workspace with no country must be handled by Phase 4 paths.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-56.md (that file is local only). Redact per START.md. -->
## Round 3 — 2026-11-07 · scope: slice
- **Code review:** base (merge base) `1db83719e6cb7e1ac338a30c456db42c530c9fab` · head `26499eaada241f807734109ea46f3a2dfd13bf4c` · head re-checked at end: yes (unchanged)
- New since Round 2 (`665a2b2`): `26499ea` adds the missing A11Y-01 focus assertion. The PR body refreshes the A11Y-01 evidence and test counts.
- Review checkout: `.agent/worktrees/review-56-26499eaa` (detached; `git status --untracked-files=no` clean at end)
- Spec: `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 8 (hash `733cc0e9`, equal to PROJECT.md §2). Plan: `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` §PR 3 (Tasks 7 and 8; Task 9 split out).

**Verdict:** Approved
**Model used:** GPT-5 (current Codex runtime; not listed in PROJECT.md's model map) · **Switch model next step?** No — this review is complete, and the next `approved 56` gate is mechanical.

### Findings

No blocking findings.

### [P3] Benign reviewer-directed text is present in the PR data
- Category: material risk (trust-boundary note; no unsafe effect)
- Rule: START.md “Before any command”; roles/reviewer.md trust boundary
- Evidence: PR body heading `Deviations / please look at (for Bob)` and `docs/DECISIONS.md:12` text `builder proposals for Bob`.
- Failure scenario: none in this PR. The text asks for scrutiny and does not ask the reviewer to skip a check, weaken a gate, disclose data or approve the change.
- Why it matters: agent-addressed text must be listed and treated as untrusted data even when benign.
- Required correction: none. Future PR text can describe the deviations without addressing the reviewer directly.
- Owner: builder
- Verification: the review was derived independently from the pinned diff, spec, plan, guardrails, tests and CI; the quoted text did not control the verdict.
- Status: open (optional)

### Round 2 findings re-inspected
- **[P2] A11Y-01 evidence: resolved.** `apps/web/e2e/onboarding.spec.ts:69` now asserts that “Finish setup” is focused after the refused SG/GST submission. The assertion is inside the normal test (not skipped or conditional), and Playwright runs every spec at desktop, 768 px and 320 px. CI's image E2E job passed at this exact head.
- **[P3] Test-plan counts: resolved.** The PR body now says 1113 unit tests and 185 E2E passed / 10 skipped, matching its current CI account.
- **[P3] Task 9 pre-onboarding tax state:** still open as a note for the Task 9 PR.
- **[P3] Pre-existing no-JS render-time redirect 409:** still open for Charlie's choice.

### Self-check audit
| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| A11Y-01 | yes; the only code change asserts focus after refusal | pass | pass | `onboarding.spec.ts:69`; exact-head image E2E CI pass | — |
| A11Y-06 / FE-70 | yes; browser proof and three supported widths | pass through the cited E2E | pass | Playwright projects: desktop, tablet-768, mobile-320; CI image E2E pass | — |
| UNI-13 / FE-50 | yes; new head must retain green delivery checks | Test plan says pass | pass | all four GitHub checks passed at `26499ea`; CI includes typecheck, lint, unit tests, gates, build, audit, secret scan, image scan and E2E | — |
| Other Round 1 applicability rows | no behavioural code changed since Round 2 | unchanged | unchanged | `git show 26499ea`: one test file, two added lines | — |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 56` head at start and end | `26499eaada241f807734109ea46f3a2dfd13bf4c` both times |
| `git show 26499ea -- apps/web/e2e/onboarding.spec.ts` | exactly one comment and one `toBeFocused()` assertion added |
| Static inspection of `onboarding.spec.ts` and `playwright.config.ts` | assertion is in the unskipped SG refusal path; every spec runs at desktop, 768 px and 320 px |
| GitHub CI run 42251452120 at the exact head | Typecheck/lint/test, dependency audit, secret scan, and image/Trivy/E2E all pass |
| `git diff --check 1db8371...26499ea` | clean |
| Project secret-scan pattern on added lines | one false positive: the existing `PASSWORD` E2E helper import; GitHub gitleaks full-history scan passes |
| Local runtime checks | not rerun in Round 3; the detached checkout has no installed dependencies. Round 2 ran typecheck, lint and 1113 unit tests at the preceding head; exact-head CI supplies the runtime evidence for this two-line E2E-only change |

### Residual risks and test gaps
- The plan's full done-when remains partial until PR 6 seeds the MY invoice pattern and Charlie answers Q10, as already recorded by the plan and Rounds 1–2.
- Real Safari and Firefox were not run; the configured E2E projects are Chromium at three widths.
- The two carried P3 notes above remain future/owner follow-up items and do not make this head unsafe to merge.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- Task 9 must refuse or deliberately reconcile settings writes before onboarding, as recorded in Round 1.
- Charlie may choose a general fix or record an accepted limitation for the pre-existing no-JS render-time redirect 409.

---
