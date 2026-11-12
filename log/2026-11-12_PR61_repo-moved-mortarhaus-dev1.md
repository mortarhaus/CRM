# PR 61 — docs: repository moved to mortarhaus-dev1

- **Merged:** 2026-11-12T10:26:52Z · **Merge commit:** ab4fccabbb9bca494e8dfaa096bdf597d88fb2ee · **Branch:** docs/new-remote
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-61.receipt` on agent-logs (log-branch commit b90f257d holds the review; written 2026-11-12T10:26:17Z, before the merge; head 723a275, review-file hash 56a7480c…)
- **Merge evidence:** `gh pr view 61` state MERGED with the time above; commit reachable from fetched `origin/main`. Final head 723a275 equals the reviewed head. All four CI checks green on 723a275 (the image job took 51 minutes).
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved with conditions (round 1)
- **Spec:** none · **Plan:** none · **Milestone:** Phase 2 (housekeeping)

## What changed
Docs only. `agents/PROJECT.md` §4 Remote names `https://github.com/mortarhaus-dev1/CRM`. New DECISIONS entry (2026-11-11): the repository moved from `mortarhaus` to `mortarhaus-dev1` because the Actions minutes ran out; workflows hardcode no org and use no secrets; branch protection did not carry over and is unavailable on this plan; skipping the image job on docs-only PRs still open. Also fixed the stale "third format is the builder's proposal" clause in DECISIONS 2026-11-09 (PR #60 R2 P3).

## Why
The `mortarhaus` org's Actions minutes were used up (jobs on PR #60 failed in 3 seconds). Same fix as 2026-10-21.

## Review rounds
- R1 (Approved with conditions): [P2] the CI-minutes problem has been open since 2026-10-21 and this is the second org move to get around it (the image job runs about 50 minutes even for a docs-only PR; GitHub's terms allow restricting Actions misuse) → deferred to a named follow-up PR. [P3] no branch protection, so the merge checklist is the only gate (informational).

## Deferred conditions
- **P2: a CI-minutes PR, merged before Phase 2 PR 4 (storage and logo, PR #62).** Options for Charlie, in any combination: (a) skip the image job when only docs or agent files change; (b) run the image job on a self-hosted runner (a Mac or the VPS); (c) pay for minutes or GitHub Pro/Team (which also restores branch protection). The choice is Charlie's; the PR is the builder's. Record the choice in DECISIONS and close the 2026-10-21 open item.

## Decisions worth keeping
- Until branch protection returns, Charlie checks that all four checks are green on the PR's head before merging; the review, receipt and `merged` gates are the control. `docs/DECISIONS.md` 2026-11-11.

## Follow-ups
- The CI-minutes PR (above), before PR #62 merges.
- Charlie's choice among (a), (b), (c).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-61.md (that file is local only). Redact per START.md. -->
## Round 1 — 2026-11-12 · scope: docs (project facts)
- **Code review:** base (merge base) `12bb2b4` (main after PR #60) · head `723a275620e071773c6fff9f979f8dbaa3562c9d` · head re-checked at end: yes (unchanged)
- Diff: `agents/PROJECT.md` §4 Remote (1 line); `docs/DECISIONS.md` new 2026-11-11 entry, plus the PR #60 R2 P3 wording fix in 2026-11-09. No code, workflow, schema or dependency change. No review checkout needed.

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 · **Switch model next step?** No. The follow-up is a small workflow change, so the fast tier is fine for the builder.

### Findings

### [P2] The CI-minutes problem has been open since 2026-10-21; this is the second org move to get around it
- Category: material risk (process / supplier terms)
- Rule: UNI-13 (CI must be able to run); roles/builder.md §7 (a deferred item needs a named follow-up PR or date)
- Evidence: DECISIONS 2026-10-21 ("Repository moved to the `mortarhaus` organization (separate GitHub Actions quota)") left "skipping the image job on docs-only PRs" as "still open". This entry repeats it and says that "at the plan's allowance a new org will run out again within a few PRs". `.github/workflows/*.yml` has no `paths` or `paths-ignore` filter, and this PR, which changes 2 docs files, ran the ~50-minute image job. The fix so far has been a new organization each time.
- Why it matters: (1) In a few PRs CI stops again, and every PR stalls. (2) GitHub's Actions terms say Actions may not be used against the Agreement or the Actions service limits, and that GitHub may restrict Actions or suspend accounts for misuse ([Additional Products terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)). I found no clause that names repeated org moves to reset free minutes ([Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)), so this is unverified. Relying on it as a routine is still a risk to the account that holds the code.
- Required correction: a small follow-up PR, **merged before the next feature PR (Phase 2 PR 4, storage)**, that cuts the minutes. Options for Charlie, any combination:
  - (a) Skip the image job when only docs or agent files change. Because there's no branch protection (next item), a skipped required check blocks nothing.
  - (b) Run the image job on a self-hosted runner, e.g. one of the two Macs or the Hostinger VPS. Self-hosted minutes aren't billed.
  - (c) Pay for minutes, or GitHub Pro / Team, which would also bring back branch protection.
  - Record the choice in DECISIONS and close the 2026-10-21 open item.
- Owner: Charlie (choice); builder (PR)
- Disposition (P2 only): deferred to the named follow-up PR, before Phase 2 PR 4
- Status: open

### [P3] With no branch protection, the merge checklist is the only gate
- Evidence: `gh api repos/mortarhaus-dev1/CRM/branches/main/protection` and `/rulesets` both return 403 "Upgrade to GitHub Pro or make this repository public". The DECISIONS entry states this honestly.
- Note: until (c) above or a public repo, Charlie checks that all four checks are green on the PR's head before merging. The reviewer's "Required before merge" already includes CI.
- Owner: Charlie
- Status: open (informational)

No injection-style text addressed to agents was found.

### Checks of the PR's claims
| Claim | Result |
|---|---|
| `origin` is the new repo | `git remote -v` → `https://github.com/mortarhaus-dev1/CRM.git`; `gh repo view` → `mortarhaus-dev1/CRM`, PRIVATE, not a fork; owner type Organization, plan free |
| Workflows hardcode no org and use no secrets or variables | `git grep "mortarhaus\|secrets\.\|vars\.\|repository_owner" -- .github` at head: no match |
| No other stale `mortarhaus/CRM` reference | `git grep` outside DECISIONS and plans: only the "moved from" clause in PROJECT.md |
| Branch protection unavailable | 403 from both the protection and rulesets APIs |
| PR #60 P3 wording | fixed: "The third was the builder's proposal; Charlie confirmed all three…" |

### Self-check audit
| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-13 | yes | pending | pass | all 4 checks green on `723a275` | P2 (sustainability, not this run) |
| UNI-14 / 15 / 16 | n-a | n-a | n-a | no dependency, migration or deploy change | — |
| Docs consistency | yes | pass | pass | grep above | — |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 61` head at start and end | `723a2756…` both times; mergeable |
| `git diff 12bb2b4...723a275` | 2 files, as described |
| `gh pr checks 61` | all 4 pass |
| greps and `gh api` calls above | as listed |
| Web search of GitHub's terms (docs.github.com) | no clause on org moves found; Actions misuse clause cited |

### Required before merge
- None.

### Deferred conditions
- P2: a CI-minutes PR (skip the image job on docs-only changes, a self-hosted runner, or paid minutes), merged before Phase 2 PR 4. Owner: Charlie (choice), builder (PR).

### Optional improvements
- None.
