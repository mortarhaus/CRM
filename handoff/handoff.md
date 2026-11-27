# Handoff — 2026-11-27 · PR 80 merged and logged; next: spec PR for line 803 (on `build` / `spec`)

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 9, hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · Active PR number: none (nothing open)
- Working folder: repo root (`main`). No build worktree. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- Branch: `main` = `b0dbc52` (equal to origin/main). Open PRs: 0. Repo `mortarhaus/CRM` is PRIVATE (standing rule: public while a PR needs CI, private after merge).
- Last merged: PR 80 (split the E2E CI job) 2026-11-27T00:39:34Z, no gate breach, log on agent-logs (`ca2d8e8`). Log gate clear.
- main CI run 45918009472 (merge commit), state when checked after going private: in_progress  Secret scan | completed success Dependency audit | completed success Typecheck, lint, test | in_progress  Changed files | completed success
- GitHub order: push first, then make public (a push right after the switch returned 403 "Repository is disabled" twice on 2026-11-26; cause unverified).

## 2. Milestones
- Done: Phase 0; Phase 1; Phase 2 (closed 2026-11-26 by PR 79; DECISIONS "2026-11-26 — Phase 2 close" holds evidence and carried items).
- Done: E2E job split (PR 80). Next: spec PR for line 803; Phase 3 plan (customers and team).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 80 (version 15, `1795740042-f01b`); source in this session's scratchpad `crm-progress.html` (scratchpad can be cleared: rebuild by reading the artifact with path index.html). Republish after every merged PR.

## 3. Git state
```
## main...origin/main  (main = b0dbc52)
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
2026-11-27 `merged 80`: logged (`ca2d8e8`; real CI times in the log), `main` fast-forwarded to b0dbc52, removed worktree `build-ci-split-e2e-job` and local branch `ci/split-e2e-job` (tip 92aa80a = final head, on main), repo private, progress artifact republished. Backup branches `feat/p2-email-templates` and `chore/setup-reconcile-v4-6` kept.

## 5. Next step (file-level)
1. Spec PR (PROJECT.md s11): line 803 drops "SHA-256"; revision 9 "draft" label. "Admin may view the QR" also needs a spec revision before it is built (could share that PR; ask).
2. Then the Phase 3 plan (customers and team, includes the require_2fa switch: Owner only, step-up; first PR of a milestone, builder s8 ask; deep tier).
3. With the next CI change: PR 80 R1 P3 (show Compose logs when the auth smoke check fails).
4. Remember on every PR: tell Charlie to run `approved N` BEFORE merging.
5. Phase 4 items are listed in the PR 79 DECISIONS entry (carried forward).

## 6. Open ASK items, blockers, and owner answers
- All answers up to 2026-11-26 ("1 yes, 2 yes") are recorded in docs/DECISIONS.md (merged with PR 78 and PR 79). Later PRs implement the 2026-11-25 ones (numbering time-zone warning; payment page digits-only, Owner clear/remove, Admin QR view after a spec revision; currency list widening), each with a spec check first.
- Open owner asks: DuitNow/PayNow ID text field; spaces or hyphens in account numbers (remove or refuse); Admin seeing bank details text; deleted-user wording; meaning of "add 2 decimals 0.00" and "drop down list from the settings"; PR 74 money limits and text lengths; no-JS 409 policy; header greeting wording; Urbanist font source; outdated-browser notice wording; CRM sender name wording.
- Cloudflare token not saved yet (`.agent/cloudflare.env`, DNS edit on mortarhaus.com only, never in chat); then add the domain in Resend.
- Raise with Bob: Next dev mode logs arguments of the 2FA actions, incl. setup keys of throwaway e2e accounts (dev only).

## 7. Open review findings (P0/P1) and verdict
None blocking. PR 80 Approved (R2), one optional P3 open: an auth smoke failure after the stack starts shows no Compose logs (ci.yml image job; fix with the next CI change). PR 79 Approved (R2). Builder suggestion, not decided: weigh the QR route's `Cache-Control: private, max-age=3600` at the Phase 4 FILE-03 review. Residuals: catalog form action state may carry to another service across Edit links (source reading only); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only; PR 77 no stale-workspace no-JS e2e, no test races two first template saves, cold-dev-server accessibility.spec failures unverified. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 DB currency list vs code table test, edit link for a missing service, long name at 320 px e2e; PR 72 clock option, preview timing, time zone pause.

## 8. Decisions made this session, not yet in the decisions log
- None.

## 9. Files touched but not committed
None of mine (see section 3). Local `.env` and `.agent/q23-email-templates.md` are gitignored.
