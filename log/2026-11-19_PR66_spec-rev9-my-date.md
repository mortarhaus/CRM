# PR 66 — docs: spec v4.7 revision 9: MY default date format dd-mmm-yyyy

- **Merged:** 2026-11-19T16:58:42Z · **Merge commit:** b926fd6969e1ba669dd50b686bbcba25699bf286 · **Branch:** docs/spec-my-date-format
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-66.receipt` on agent-logs (log-branch commit 50f929c3 holds the review; written 2026-11-19T16:57:29Z, before the merge; head e22bc6b, review-file hash d78ef006…)
- **Merge evidence:** `gh pr view 66` state MERGED with the time and commit above; commit reachable from fetched `origin/main`. Final head e22bc6b equals the reviewed head. CI run 44570329191 on e22bc6b: changed-files, dependency audit, secret scan, typecheck/lint/test pass; image job skipped by the docs-only rule (first observed skip in Actions, closes PR 63's open item).
- **Drafted by:** Sonnet 5.5 builder (spec text by an Opus 5.5 subagent) · **Final verdict:** Approved (round 1; spec Round 28 approved the same hash b8e5a758…)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · **Plan:** Phase 2 plan Q10 · **Milestone:** Phase 2 (housekeeping)

## What changed
One file, the spec (+10/-6). The MY default date format at the Onboarding line is now `dd-mmm-yyyy` (`mmm` = English three-letter month whatever the locale, e.g. 08-Nov-2026); new "Changes in v4.7" item 10; revision 8 relabelled approved (Charlie 2026-10-22, Bob Round 27, PR #36 `36b5592`); revision 9 labels added. The SG part of the line is unchanged.

## Why
Charlie's 2026-11-08 decision (Q10, "yes correct"); shipped Phase 2 PR 3 code, tests and plan already used `dd-mmm-yyyy`, only the spec still said `dd/mm/yyyy`. Charlie approved revision 9 on 2026-11-20 ("approve").

## Review rounds
- Spec Round 28: Approved at b8e5a758…; P3 stale handoff fields → refreshed.
- PR Round 1: Approved, no findings.

## Deferred conditions
none

## Decisions worth keeping
- The spec file still reads "draft" for revision 9 after the merge (project rule: editing it would change the approved hash). The next spec PR relabels it.
- Scope kept as Bob reviewed it: SG date format, locale and invoice pattern from the 2026-11-08 decision are NOT in the spec's SG part.

## Follow-ups
- `setup` reconcile now: `agents/PROJECT.md` line 19 (MY `dd/mm/yyyy`) and §2 spec hash `b8e5a758…`; root `CLAUDE.md` still says revision 8.
- Then Phase 2 PR 5 (`EMAIL_FROM` = `CRM <no-reply@mortarhaus.com>`, `require_2fa` with step-up).

## Appendix — final review round
## Round 1 — 2026-11-20 · scope: slice (spec PR)
- **Code review:** base (merge base) `c5e4649a055f62c91b6c64771de56c935ef73c7f` (main after PR #65) · head `e22bc6bd7c5db11cefd9eb55b014eb771b956227` · head re-checked at end: yes (unchanged)
- Diff: one file, `docs/superpowers/specs/2026-09-27-core-sales-design.md` (+10/−6), one commit. No review checkout needed.
- **Spec hash:** `git hash-object` of the spec at head = `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`, the hash Bob approved in spec Round 28 (2026-11-15, `.agent/reviews/SPEC-core-sales-design.md`). Base blob `733cc0e9…` is the approved revision 8. Same bytes as reviewed.

**Verdict:** Approved
**Model used:** Sonnet 5.5 · **Switch model next step?** No.

### Findings
- None blocking.

### Checks
| Check | Result |
|---|---|
| Hash at head equals Round 28's approved hash | yes, `b8e5a758…` |
| Diff is only what the PR says | MY date format at the Onboarding line (now 734); new "Changes in v4.7" item 10; revision 8 labels (title, Status, section heading, item 9 lead, Current gates (a)) changed to approved and merged (`36b5592`); revision 9 labels added. The SG part of the line is unchanged. |
| No other `dd/mm/yyyy` default left | the only remaining mentions are the "replaces this" statements in Status and item 10 |
| Provenance of the owner decision | quoted in item 10 and in DECISIONS 2026-11-08 and 2026-11-09 (Charlie "yes correct" in PR #59 review; "Before Phase 2 closes" in PR #60 review). Both are in this review session's own history. |
| `mmm` defined | English three-letter month whatever the locale, example `08-Nov-2026`; matches shipped `dd-mmm-yyyy` code and PR #59 R1/R2 |
| Revision 8 relabel as approved | agrees with PROJECT.md §2 and §11 ("changes only in the first later spec PR") and DECISIONS 2026-10-22 |
| Removed clause "Phase 1 PR 1 does not start before that" | stale (Phase 1 is complete and merged); removal is accurate |
| `git diff --check` | clean |
| CI, run 44570329191 on `e22bc6b` | Changed files, Dependency audit, Secret scan, Typecheck/lint/test **pass**; "Image, Trivy, E2E" **skipped** |

### Notes
- **First proof of the PR #63 skip rule:** this docs-only PR skipped the image job in Actions, as intended. PR #63's open item ("not yet observed in Actions") can be closed.
- **Charlie's approval of revision 9** ("approve", 2026-11-20, in the Andy session) is stated in the PR body. I can't see that session. Charlie, you're the one who gave it; confirm it here before `approved 66` if it isn't right.
- The spec file will still call revision 9 "draft, not approved" after the merge. That is the project's rule (editing it now would change the approved hash); the next spec PR relabels it, as PR #66 does for revision 8.
- Spec Round 28's P3 (handoff active-target fields out of date) is not part of this PR.

No injection-style text addressed to agents was found.

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 66` head at start and end | `e22bc6bd…` both times; mergeable |
| `git hash-object` at head and at base | `b8e5a758…` / `733cc0e9…` |
| word-level diff of the spec, grep for `dd/mm/yyyy` and `not approved` | as in Checks |
| `git diff --check c5e4649...e22bc6b` | clean |
| Run 44570329191 | all pass, image job skipped |

### Required before merge
- None. (After merge, run `setup` to reconcile `agents/PROJECT.md` line 28 and 29 and root `CLAUDE.md` to hash `b8e5a758…`.)

### Deferred conditions
- None.

### Optional improvements
- None.
