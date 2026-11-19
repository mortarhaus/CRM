# PR 67 — docs: setup reconcile to spec v4.7 revision 9

- **Merged:** 2026-11-19T17:18:38Z · **Merge commit:** db626ea49dc5f72624572828f2cfae4f38f0586b · **Branch:** chore/setup-reconcile-v4-7-rev9
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-67.receipt` on agent-logs (log-branch commit 561a22aa holds the review; written 2026-11-19T17:18:14Z, 24 s before the merge; head 19bba04, review-file hash 457022ca…)
- **Merge evidence:** `gh pr view 67` state MERGED with the time and commit above; commit reachable from fetched `origin/main`. Final head 19bba04 equals the reviewed head. CI run 44572988522 on 19bba04 (after one re-run): changed-files, dependency audit, secret scan, typecheck/lint/test pass; image job skipped (docs-only).
- **Drafted by:** Sonnet 5.5 builder (reconcile by an Opus 5.5 subagent) · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · **Plan:** none · **Milestone:** Phase 2 (housekeeping)

## What changed
Docs only, three files, two commits. `agents/PROJECT.md`: §1 MY default date format `dd-mmm-yyyy`; §2 spec row names revision 9 (Bob spec Round 28, PR #66 Round 1, Charlie's approval 2026-11-20, merge `b926fd6`); "Spec hash at last reconcile" now `b8e5a758…`; §11 gate (b) marks the revision 8 label fix done. `CLAUDE.md`: revision 9, and the stale "Next: the Phase 2 plan" line now points at Phase 2 PR 5. `docs/DECISIONS.md`: new 2026-11-20 entry recording Charlie's approval of revision 9.

## Why
`build` stops at the reconcile gate while PROJECT.md's spec hash differs from the merged spec. Charlie ran `setup` and said yes to the DECISIONS entry and the CLAUDE.md line.

## Review rounds
- R1: [P2] CI did not start (GitHub billing annotation: "recent account payments have failed or your spending limit needs to be increased") → re-ran run 44572988522 on the same head; all jobs started and passed (inferred cause: the public flip had not reached Actions yet; not confirmed).
- R2: Approved.

## Deferred conditions
none

## Decisions worth keeping
- Reconcile gate is cleared: PROJECT.md §2 spec hash = `b8e5a758…`, equal to the spec on main.
- If CI fails to start on a public repo again with the billing annotation, check Billing & plans for the `mortarhaus` account.
- The spec file still calls revision 9 a draft; the next spec PR relabels it.

## Follow-ups
- Next: Phase 2 PR 5 (`EMAIL_FROM` = `CRM <no-reply@mortarhaus.com>` recorded in DECISIONS/runbook; `require_2fa` with step-up; bank, QR, notifications, owner email).
- Open asks still owed by Charlie: `RATE_LIMITED` wording and numbers; Q17, Q18, Q23 values.

## Appendix — final review round
## Round 2 — 2026-11-20 · scope: fix check (CI re-run)
- **Code review:** base (merge base) `b926fd6969e1ba669dd50b686bbcba25699bf286` · head `19bba042a144606a7554d9eb30ca0aaa8e546351` · head re-checked at end: yes (unchanged; no new commit)
- The head is the same as Round 1, so the content checks of Round 1 stand. Only CI changed.

**Verdict:** Approved
**Model used:** Sonnet 5.5 · **Switch model next step?** No.

### Round 1 findings
| Finding | Status | Evidence |
|---|---|---|
| P2 CI didn't start (billing) | **resolved** | Run 44572988522 was re-run on the same head: Changed files, Dependency audit, Secret scan and Typecheck/lint/test **pass**; "Image, Trivy, E2E" **skipped** (docs only; the log says `code changed: false`) |

### New findings
- None.

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 67` head at start and end | `19bba042…`; mergeable; same two commits |
| `gh pr checks 67`, run 44572988522 | all four pass, image skipped |

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.

## Round 1 — 2026-11-20 · scope: slice (docs, setup reconcile)
- **Code review:** base (merge base) `b926fd6969e1ba669dd50b686bbcba25699bf286` (main after PR #66) · head `19bba042a144606a7554d9eb30ca0aaa8e546351` · head re-checked at end: yes (unchanged)
- Diff: `agents/PROJECT.md` (+4/−4), `CLAUDE.md` (+3/−3), `docs/DECISIONS.md` (+10). Two commits (`68526e4` reconcile, `19bba04` the DECISIONS entry and the CLAUDE.md "Next" line that Charlie said yes to). No code, config or spec change. No review checkout needed.

**Verdict:** Blocked
**Model used:** Sonnet 5.5 · **Switch model next step?** No.

The content has no findings. It's blocked only because CI could not run on this head (below). When the checks run green, I approve this head, or a head that differs only by a re-run, after a short re-check.

### Findings

### [P2] No CI result: all four jobs failed before starting, with a billing message
- Category: material risk (infrastructure; not caused by this diff)
- Rule: UNI-13 (CI must pass before merge)
- Evidence: run 44572988522 (`19bba04`). "Changed files", "Dependency audit", "Secret scan" and "Typecheck, lint, test" each failed in 2–3 s with no failed step. The check-run annotation says: "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings." The repo is PUBLIC now (the public-during-PR rule), so this isn't the free-minutes allowance running out; it's a billing state on the account that owns the repo (`mortarhaus`). I can't see that account's billing and haven't checked why. The image job shows "skipping" because it needs the others.
- Failure scenario: merging now ships docs with no check evidence (the secret scan and audit also didn't run), and every later PR hits the same wall.
- Required correction: Charlie opens `mortarhaus` → Settings → Billing & plans, fixes the payment or the spending limit, and re-runs the failed jobs on this head. Then all four checks must pass; the image job should show "skipped" (docs only).
- Owner: Charlie (billing); builder (re-run, update the PR body)
- Disposition (P2 only): before merge
- Status: open

No injection-style text addressed to agents was found in the PR body, commits or diff.

### Checks of the PR's claims
| Claim | Result |
|---|---|
| The spec is unchanged and its hash is the approved one | `git hash-object` of the spec on `origin/main` = `b8e5a758ced6738217b8c98aa3bc9e40376a6eca` (Round 28 / PR #66 hash); the PR doesn't touch the spec file |
| PR #66 merge details | `gh pr view 66`: merged `2026-11-19T16:58:42Z`, `b926fd6`. The text's "2026-11-20 (2026-11-19T16:58:42Z)" is the same moment in Malaysia time; Charlie's approval date 2026-11-20 fits |
| PROJECT.md §1 date format | `dd-mmm-yyyy`, `mmm` defined, "a default the workspace can change", matches spec line 734 |
| §2 spec row | names revision 9, Round 28 hash `b8e5a758`, Charlie's "approve" 2026-11-20, PR review Round 1 head `e22bc6b`, merge `b926fd6`; the "draft label stays until the next spec PR" rule is kept; revision 8 history kept |
| §2 "Spec hash at last reconcile" | `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`, equal to the main spec's hash |
| §11 gate (b) | revision 8 label fix struck through as done (PR #66); revision 9's label stays open for the next spec PR. Accurate |
| No stale spec values left | `git grep` of `733cc0e9`, "revision 8 (draft", `dd/mm/yyyy` in CLAUDE.md, AGENTS.md, agents/: only the intended "replaces this" and history mentions (PROJECT.md row, DECISIONS history) |
| CLAUDE.md revision 9 lines | source-of-truth and Status updated; the older revisions' history kept |
| CLAUDE.md "Next" line | "Phase 2 is under way … Next: Phase 2 PR 5 (step-up and `require_2fa`, bank, QR, notifications, owner email)". Matches the plan's PR 5 heading and ASK 9; PR 4 (#62) is merged (`8a1e95c`) |
| agent-kit marker blocks | `<!-- agent-kit:start -->` and `<!-- agent-kit:end -->` present in CLAUDE.md (lines 52, 62); this diff doesn't touch them |
| DECISIONS 2026-11-20 entry | decision, why, trade-offs, scope, "Decided by: owner (Charlie, 2026-11-20): 'approve'". Quotes his single word and adds nothing; hash, PR #66 and Round 28 match |
| `git diff --check b926fd6...19bba04` | clean |

### Notes (no finding)
- The "Next: PR 5" line is accurate, but the plan lists Q17 (bank detail fields for MY and SG) and Q18 (owner email wording) as blocking PR 5 Tasks 14 and 16. Whether Charlie has answered them isn't shown in this PR. Not a defect here; the builder should check before starting PR 5.
- Older DECISIONS entries (2026-11-xx, line ~169) still say the spec labels revision 8 a draft. That was true when written and is history, so I left it alone.

### Self-check audit
| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-13 | yes | pending ("image job should be skipped") | **not met** (CI didn't start) | run 44572988522 | P2 |
| PROJECT.md §2 / §11 (reconcile) | yes | pass | pass | hash and text checks above | — |
| UNI-14 / 15 / 16, secrets | n-a | — | n-a | docs only | — |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 67` head at start and end | `19bba042…` both times; mergeable |
| `git diff b926fd6...19bba04` | 3 files, as described |
| `git hash-object` of the spec on `origin/main` | `b8e5a758…` |
| `gh pr view 66` merge time | `2026-11-19T16:58:42Z`, `b926fd6` |
| `git grep` for stale values; marker check; plan PR 5 heading | as in the table |
| `gh pr checks 67`, run 44572988522, check-run annotation | 4 failed before start (billing message); image skipping |
| Local tests | not run (docs only) |

### Required before merge
- P2: all four checks pass on the final head (billing fixed, jobs re-run).

### Deferred conditions
- None.

### Optional improvements
- None.
