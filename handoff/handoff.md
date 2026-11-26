# Handoff — 2026-11-26 · PR 80 open (split the E2E CI job), CI running, waiting for `review 80`

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 9, hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · Active PR number: 80
- Working folder: build worktree `.agent/worktrees/build-ci-split-e2e-job` (branch `ci/split-e2e-job`); main checkout on `main`. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- PR 80 https://github.com/mortarhaus/CRM/pull/80, branch `ci/split-e2e-job`, head `92aa80a`, base `main` = `8c75b01`. CI run 45834314859 started 2026-11-26T13:58Z.
- Repo `mortarhaus/CRM` is PUBLIC for PR 80; make it private after the merge.
- Last merged: PR 79 (close Phase 2) 2026-11-26T13:01:13Z, no gate breach, log on agent-logs (`210c5ca`). Log gate clear.
- GitHub order: push first, then make public (a push right after the switch returned 403 "Repository is disabled" twice on 2026-11-26; cause unverified).

## 2. Milestones
- Done: Phase 0; Phase 1; Phase 2 (closed 2026-11-26 by PR 79; DECISIONS "2026-11-26 — Phase 2 close" holds evidence and carried items).
- Next: E2E job split; spec PR for line 803; Phase 3 plan (customers and team).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 79 (version 1795698176-3d90); source in this session's scratchpad `crm-progress.html` (scratchpad can be cleared: rebuild by reading the artifact with path index.html). Republish after every merged PR.

## 3. Git state
```
## main...origin/main  (main = 8c75b01)
?? .playwright-mcp/
?? docker/sync-export.sh
?? docker/sync-import.sh
```
Uncommitted files — fingerprint:
| Path | Status | Content hash |
|---|---|---|
| `.playwright-mcp/` | untracked, not mine | directory |
| `docker/sync-export.sh` | untracked, not mine | `51dcde23b372ecaaf041cea716ec3f95fa70226a` |
| `docker/sync-import.sh` | untracked, not mine | `9f2c1205bbf77be1c82eded28974f9f3f1d648b8` |

## 4. Just finished
2026-11-26 `build`: Opus sub-agent built the split (jobs `image` + `e2e` matrix per Playwright project, guard test, DECISIONS entry, runbook). Its observed results: `--list` 273 total, 91 per project; mobile-320 alone on a fresh stack 87 passed / 4 skipped, 22.2 min; actionlint 0 errors; typecheck, lint, test (1531 passed, 1 skipped), build exit 0 at `b0a1016`. Head `92aa80a` only rewords three DECISIONS sentences (not re-run locally). Pushed, PR 80 opened.

## 5. Next step (file-level)
1. Check run 45834314859: the four new jobs must run and pass; record real job times in the PR. Then Charlie: `review 80`, then `approved 80` BEFORE merging.
2. Then the spec PR (PROJECT.md s11): line 803 drops "SHA-256"; revision 9 "draft" label. "Admin may view the QR" also needs a spec revision before it is built (could share that PR; ask).
3. Then the Phase 3 plan (customers and team, includes the require_2fa switch: Owner only, step-up; first PR of a milestone, builder s8 ask; deep tier).
4. Phase 4 items are listed in the PR 79 DECISIONS entry (carried forward).

## 6. Open ASK items, blockers, and owner answers
- All answers up to 2026-11-26 ("1 yes, 2 yes") are recorded in docs/DECISIONS.md (merged with PR 78 and PR 79). Later PRs implement the 2026-11-25 ones (numbering time-zone warning; payment page digits-only, Owner clear/remove, Admin QR view after a spec revision; currency list widening), each with a spec check first.
- Open owner asks: DuitNow/PayNow ID text field; spaces or hyphens in account numbers (remove or refuse); Admin seeing bank details text; deleted-user wording; meaning of "add 2 decimals 0.00" and "drop down list from the settings"; PR 74 money limits and text lengths; no-JS 409 policy; header greeting wording; Urbanist font source; outdated-browser notice wording; CRM sender name wording.
- Cloudflare token not saved yet (`.agent/cloudflare.env`, DNS edit on mortarhaus.com only, never in chat); then add the domain in Resend.
- Raise with Bob: Next dev mode logs arguments of the 2FA actions, incl. setup keys of throwaway e2e accounts (dev only).

## 7. Open review findings (P0/P1) and verdict
None open. PR 79 Approved (R2). Builder suggestion, not decided: weigh the QR route's `Cache-Control: private, max-age=3600` at the Phase 4 FILE-03 review. Residuals: catalog form action state may carry to another service across Edit links (source reading only); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only; PR 77 no stale-workspace no-JS e2e, no test races two first template saves, cold-dev-server accessibility.spec failures unverified. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 DB currency list vs code table test, edit link for a missing service, long name at 320 px e2e; PR 72 clock option, preview timing, time zone pause.

## 8. Decisions made this session, not yet in the decisions log
- None.

## 9. Files touched but not committed
None of mine (build worktree clean at `92aa80a`). Local `.env` and `.agent/q23-email-templates.md` are gitignored.
