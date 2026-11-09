# PR 57 — feat: Phase 2 Task 9, general settings page; no settings write before onboarding

- **Merged:** 2026-11-09T01:56:38Z · **Merge commit:** 4283c4cdc198d134b9fdc937878a0ed0e84e2b74 · **Branch:** feat/p2-settings-general
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-57.receipt` on agent-logs (log-branch commit 2c9b12ed holds the review; written 2026-11-09T01:50:30Z, before the merge; head 25955c8, review-file hash be16ff94…)
- **Merge evidence:** `gh pr view 57` state MERGED with the time above; commit reachable from fetched `origin/main`. Final head 25955c8 equals the reviewed head. All four CI checks green on 25955c8 (e2e 197 passed, 10 skipped).
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 2)
- **Spec:** v4.7 rev 8 · **Plan:** 2026-11-04-phase-2-settings-onboarding.md §PR 3, Task 9 · **Milestone:** Phase 2

## What changed
`/settings/general` (Admin and Owner): short code, structured address, timezone, base and default currency, the SST/GST answer with number, tax name and rate, own TIN and BRN, through `updateGeneralSettings`; works without JavaScript (`fromForm`, non-personal `echo`). New `action()` refusal `NOT_ONBOARDED` (no settings write before onboarding, PR #56 P3). Migration 0027 (default tax name and rate both set or both null). Shared `TextField`/`SelectField`/`TaxFields`, native `Select`, `SETTINGS_CURRENCIES` in core, nav link "General".

## Why
Plan PR 3 Task 9 (split from PR #56) and PR #56 review P3.

## Review rounds
- R1 (Blocked): [P1] the image job failed at Trivy (musl/zlib HIGH in the base), so the full e2e never ran → fixed by PR #58 (exact pins), merged into this branch. [P3] FE-60 row missing → added.
- R2 (Approved, no findings): after merging `main` twice (PR #58, PR #59). The one hand edit, scoping two onboarding alert selectors to `main`, matched PR #59's identical change. DECISIONS conflicts were resolved by keeping both entries.

## Deferred conditions
none. Residual: A11Y-01 focus return on the general form is checked in code only, not by a test.

## Decisions worth keeping
- No settings write before onboarding: `NOT_ONBOARDED` refusal (Owner/Admin), Staff get `FORBIDDEN` earlier. `docs/DECISIONS.md` 2026-11-07.
- "Applies to new documents only" is copy and a result flag until Phase 4 has documents.

## Follow-ups
- Owner-editable date format on `/settings/general` with an allowed-format list; define `mmm` (English three-letter month); edit spec line 730 (MY `dd/mm/yyyy`) in that PR or the next spec revision (PR #59 condition).
- Optional: an `toBeFocused()` test for A11Y-01 on the general form.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-57.md (that file is local only). Redact per START.md. -->
## Round 2 — 2026-11-09 · scope: fix check (branch updated from main)
- **Code review:** base (merge base) `33dfb1cbc2201fdce00acdacc5eca8d1edda3575` (main after PR #59) · head `25955c89c2112c4ad83ade09f1fb32b2b1771c3f` · head re-checked at end: yes (unchanged)
- New commits since R1: `aa9fae3` (merge main at `083c268`, PR #58), `ae48041` (merge main at `33dfb1c`, PR #59), `25955c8` (docs: Q10 answered). No review checkout needed: the PR's own code is unchanged since R1 except one comment (below), and CI ran every suite on this head, which already contains `main`.

**Verdict:** Approved
**Model used:** Opus 5.5 · **Switch model next step?** No.

#
