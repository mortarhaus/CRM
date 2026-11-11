# PR 60 — feat: owner-editable date format on General settings

- **Merged:** 2026-11-11T12:43:29Z · **Merge commit:** 12bb2b4be60165411c6bbb9b0c375d1ece3997cb · **Branch:** feat/p2-date-format
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-60.receipt` on agent-logs (log-branch commit b3b15533 holds the review; written 2026-11-11T12:43:02Z, before the merge; head df25066, review-file hash f347bc9c…)
- **Merge evidence:** `gh pr view 60` state MERGED with the time above; commit reachable from fetched `origin/main`. Final head df25066 equals the reviewed head. All four CI checks green on df25066 (e2e 197 passed, 10 skipped). The repository had moved to `mortarhaus-dev1/CRM` (new org) during this PR; CI was re-run there.
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 2)
- **Spec:** v4.7 rev 8 · **Plan:** 2026-11-04-phase-2-settings-onboarding.md (PR #59's named follow-up) · **Milestone:** Phase 2

## What changed
A **Date format** select on `/settings/general` (Admin and Owner). `DATE_FORMATS` in `@crm/core/settings`: `dd-mmm-yyyy` (default), `dd/mm/yyyy`, `yyyy-mm-dd`; `DATE_FORMAT_EXAMPLES` labels each as an example date and the form posts the code. `mmm` is the English three-letter month whatever the locale. Locale stays `en`, not editable. `SelectField` accepts `{value, label}` options. No schema or migration change.

## Why
Charlie, 2026-11-08: "allow user to set different format" (PR #59 follow-up).

## Review rounds
- R1 (Revision required): [P2] the format list was partly the builder's → Charlie chose all three (recorded in DECISIONS). [P2] the spec line 730 edit had no end → Charlie accepted "before Phase 2 closes", recorded in DECISIONS and the handoff. [P3] raw format codes and a hint that fitted one option → example-date labels, hint dropped.
- R2 (Approved). Optional P3: DECISIONS item (2) still says the third format is the builder's proposal; PR body UNI-13 row stale.

## Deferred conditions
- Spec line 730 edit (MY `dd/mm/yyyy` → `dd-mmm-yyyy`): a small spec revision (`review spec`, then `setup`) **before Phase 2 closes, i.e. before plan PR 8 merges**. Owner: builder.

## Decisions worth keeping
- The date format is display-only and not "new documents only". The Phase 4 formatter must implement exactly these three codes, with `mmm` as an English three-letter month. `docs/DECISIONS.md` 2026-11-09.

## Follow-ups
- Spec revision for line 730 (above).
- Docs PR: `agents/PROJECT.md` Remote line still names `mortarhaus/CRM`; now `mortarhaus-dev1/CRM`. Branch protection did not carry over to the new org (needs a paid plan or a public repo).
- Optional: remove the stale "builder's proposal" clause in DECISIONS 2026-11-09 item (2).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-60.md (that file is local only). Redact per START.md. -->
## Round 2 — 2026-11-11 · scope: fix check
- **Code review:** base (merge base) `4283c4cdc198d134b9fdc937878a0ed0e84e2b74` · head `df25066fc6b851a24bec710c2e45f3823662522a` · head re-checked at end: yes (unchanged)
- New commits: `bcde5ac` (example-date labels, hint dropped), `df25066` (DECISIONS: Charlie's answers). No review checkout needed; CI ran every suite on this head.

**Verdict:** Approved
**Model used:** Opus 5.5 · **Switch model next step?** No.

#
