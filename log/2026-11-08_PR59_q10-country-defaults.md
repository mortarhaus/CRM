# PR 59 — feat: plan Q10 country defaults (SG pattern, dd-mmm-yyyy, locale en)

- **Merged:** 2026-11-08T08:08:57Z · **Merge commit:** 33dfb1cbc2201fdce00acdacc5eca8d1edda3575 · **Branch:** feat/p2-q10-defaults
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-59.receipt` on agent-logs (log-branch commit 07d581e6 holds the review; written 2026-11-08T08:08:22Z, before the merge; head efb0109, review-file hash 29882dd7…)
- **Merge evidence:** `gh pr view 59` state MERGED with the time above; commit reachable from fetched `origin/main`. Final head efb0109 equals the reviewed head. All four CI checks green on efb0109 (e2e 185 passed).
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 2)
- **Spec:** v4.7 rev 8 (line 730 superseded for MY date format) · **Plan:** 2026-11-04-phase-2-settings-onboarding.md §7 Q10 · **Milestone:** Phase 2

## What changed
`COUNTRY_DEFAULTS` (`@crm/core/settings`): SG invoice pattern `INV-{CODE}-{YYYY}-{SEQ:4}` (as MY); date format `dd-mmm-yyyy` for both countries (MY was `dd/mm/yyyy`); locale `en` for both. Tests, onboarding e2e expectations, plan §7 Q10 and a DECISIONS entry (2026-11-08) updated. No schema or migration change.

## Why
Charlie answered plan Q10 on 2026-11-08 and confirmed Bob's restatement ("yes correct"): pattern as MY, date format regardless of locale with the owner able to change it later, plain `en`.

## Review rounds
- R1 (Revision required): [P1] UNI-02 row missing → added. [P2] MY date format overrides the spec and Charlie's words were only paraphrased → his "yes correct" recorded in DECISIONS; spec edit named as a follow-up. [P2] CI had not run the changed e2e → green on final head. [P3] stale comments and plan lines → refreshed.
- R2 (Approved). CI note: the R1-fix run failed one e2e (`onboarding.spec.ts:53` tablet-768, `getByRole("alert")` also matched Next's route announcer); both selectors were scoped to `main` (`efb0109`), the next run passed 185.

## Deferred conditions
- Spec line 730 (MY `dd/mm/yyyy`) edit: in the date-format settings PR after #57, or the next spec revision, whichever comes first (owner: builder). That PR also defines `mmm` (English three-letter month, whatever the locale).
- Optional P3: PR body UNI-13 and E2E rows stale.

## Decisions worth keeping
- Date format default `dd-mmm-yyyy` for both countries; locale `en` only; owner-editable later. Existing workspaces keep stored values (no backfill). `docs/DECISIONS.md` 2026-11-08.

## Follow-ups
- Owner-editable date format on `/settings/general` with an allowed-format list, after PR #57 merges.
- Spec line 730 edit (above).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-59.md (that file is local only). Redact per START.md. -->
## Round 2 — 2026-11-08 · scope: fix check
- **Code review:** base (merge base) `083c2684b3ce18397f6f6b6aeb1aa5ef294b3edf` · head `efb010918b7123bf9a95298845e1036194b9f631` · head re-checked at end: yes (unchanged)
- New commits: `67a5e25` (R1 fixes), `efb0109` (e2e alert selectors scoped to `main`). No review checkout needed: the code changes since R1 are comments, docs and two e2e selectors; CI ran the full suites on this head.

**Verdict:** Approved
**Model used:** Opus 5.5 · **Switch model next step?** No.

#
