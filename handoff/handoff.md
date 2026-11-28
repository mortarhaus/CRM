# Handoff — 2026-11-28 · PR 82 approved (R2) and archived with receipt, head `c51ee12`; next: Charlie merges, then `merged 82`

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md`. On main: v4.7 rev 13, hash `bf633eb3850c101134e682d4cea21dcc19cd93af`, approved by Charlie 2026-11-28 (Status text still says draft).
- Working folder: `.agent/worktrees/build-chore-setup-reconcile-v4-7-rev13` (branch `chore/setup-reconcile-v4-7-rev13`). Main checkout on `main`, local `b0dbc52`, behind `origin/main` `826f70d`; not pulled. Merged worktree `.agent/worktrees/build-docs-spec-bank-audit-qr-view` still present.

## 1. Current PR / branch
- Open: PR 82 "docs: setup reconcile to spec v4.7 revision 13", base `main`, head `c51ee12de8939fa3036f22d256f93f90c8f22e5d`, CI run 46111470791 passed (four jobs; image and E2E skipped, docs only); PR body updated with the R1 rows; Bob round 2 approved; waiting for Charlie to merge.
- Repo `mortarhaus/CRM` PUBLIC since 2026-11-28 for PR 82's CI; make PRIVATE in `merged 82` if no other PR is open.
- GitHub order: push first, then make public.
- Last merged: PR 81 (`826f70d`), logged, no gate breach.

## 2. Milestones
- Done: Phase 0; Phase 1; Phase 2 (closed 2026-11-26 by PR 79; DECISIONS "2026-11-26 — Phase 2 close" holds evidence and carried items).
- Done: E2E job split (PR 80). Spec PR 81 (rev 13) merged 2026-11-28. Next: `setup`, then the Phase 3 plan (customers and team).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 81 (version 16, `1795836014-ee39`); source in this session's scratchpad `crm-progress.html` (scratchpad can be cleared: rebuild by reading the artifact with path index.html). Republish after every merged PR.

## 3. Git state
Build worktree: HEAD `c51ee12`, clean, tracks `origin/chore/setup-reconcile-v4-7-rev13`.
Main checkout: `main` at `b0dbc52`, untracked (not mine):
| Path | Status | Content hash |
|---|---|---|
| `.playwright-mcp/` | untracked, not mine | directory |
| `docker/sync-export.sh` | untracked, not mine | `51dcde23b372ecaaf041cea716ec3f95fa70226a` |
| `docker/sync-import.sh` | untracked, not mine | `9f2c1205bbf77be1c82eded28974f9f3f1d648b8` |

## 4. Just finished
2026-11-28 `approved 82`: Round 2 Approved with conditions, head `c51ee12`, PR open; review archived and receipt written on agent-logs (review commit `f50d750`, receipt commit `c3746c7`, 2026-11-28T05:35:03Z, review blob `edcbcd8`).
2026-11-28 commit `c51ee12de8939fa3036f22d256f93f90c8f22e5d` pushed (PROJECT.md section 8, R1 P2). R1 P1 is a PR body change, drafted at scratchpad `fix-pr-body.md`, not yet applied (apply after CI with the new head and run id). Build worktree clean. Open owner question from the draft: `/files/logo` has no FILE-04 alternative recorded in PROJECT.md section 9.
2026-11-28 `fix`: PR 82 review Round 1 (Revision required, head `8b87dba`) archived on agent-logs (`7146d58`, blob `e2af7d57`). Findings: [P1] no AUTH-03 self-check row (PR body); [P2, before merge] PROJECT.md section 8 storage summary omits the same-origin logo preview. Preflight: build worktree clean at `8b87dba`. Same Opus 5.5 sub-agent drafting in the session scratchpad (`fix-pr-body.md`, `fix-PROJECT.md`); next: check, commit, push, update PR body, watch CI.
2026-11-28 PR 82 opened; CI passed on `8b87dba`; PR body UNI-07 and UNI-13 rows filled. Opus draft checked by Sonnet 5.5, with two wording changes (CLAUDE.md next step; DECISIONS builder note on spec line 100). Local typecheck, lint, test and build not run (docs only).
2026-11-28 `setup` started. Owner answer on the model (asked: switch to Opus, or continue on Sonnet 5.5): "subagent on opus". Worktree `.agent/worktrees/build-chore-setup-reconcile-v4-7-rev13`, branch `chore/setup-reconcile-v4-7-rev13` from `826f70d` (no upstream set), nothing changed in it yet. Opus 5.5 sub-agent drafting in this session's scratchpad `reconcile/` (copies of PROJECT.md, CLAUDE.md, DECISIONS.md); next: review its diff, apply, check, commit, PR. Log gate clear (no merged PR after #3 without a log).
2026-11-28 `merged 81`. Merge proven (host state MERGED, merge `826f70d` on origin/main, parents `b0dbc52` + `733aae4`, tree equals the reviewed head); receipt before the merge; log pushed to agent-logs (`2d193cf`); progress artifact republished (version 16). A stale `CLAUDE.md` inside the agent-logs worktree (spec v4.5 era) is old branch content, not current project rules.

## 5. Next step (file-level)
1. Charlie merges PR 82 (head `c51ee12` only), then `merged 82` (log, repo private again).
2. Done in PR 82: PROJECT.md and CLAUDE.md reconciled; Charlie's rev 13 approval recorded in DECISIONS. Spec Status label waits for the next spec PR (it also corrects "needs no audit code change", spec line 100).
3. Implementation PR (Bank settings Admin-view and QR revalidation): QR route `must-revalidate`; Admin view with 2FA check; Unicode-safe audit mask (4 whole code points) with a synthetic test on a settings change; owner email job reads changed column names only; optional mask tests and two comment fixes. The `last4` shape stays.
4. Then the Phase 3 plan (require_2fa switch: Owner only, step-up; first PR of a milestone, builder s8 ask; deep tier).
5. With the next CI change: PR 80 R1 P3 (Compose logs on smoke failure); skipped E2E matrix job shows raw name.

## 6. Open ASK items, blockers, and owner answers
- ASK Charlie (found 2026-11-28 in the PR 82 R1 fix): `/files/logo` serves through a session route with a 1-hour private cache, not a ≤ 10 min signed URL, and PROJECT.md section 9 records no FILE-04 alternative for it. Builder suggestion: record it as an accepted alternative in section 9 (needs Charlie's yes and a DECISIONS entry). Not changed in PR 82.
- 2026-11-28 11:42: this conversation (session `c0de8f2c`) is open in three running windows (the CRM one, one other busy and one other idle), seen in `~/.claude/sessions/`. Charlie asked what that meant. Advised: after the repo is private, start a new conversation here (`/clear`), then `setup`. Do not touch the other windows.
- ASK before the Phase 7 plan: confirm the client link 30-day default (spec Current gates (e)).
- Superseded 2026-11-27 (Charlie chose "1" on Round 31): the full-account-number points told to Charlie no longer apply. Still open: he may correct the builder reading that the QR stays recorded as its storage key.
- Bob ruled in spec Round 32 (see section 7).
- Tell Charlie (rev 13 report): a number saved by mistake still leaves up to its last 4 characters permanently, so the option text "Both problems go away" was slightly too strong.
- All answers up to 2026-11-26 ("1 yes, 2 yes") are recorded in docs/DECISIONS.md (merged with PR 78 and PR 79). Later PRs implement the 2026-11-25 ones (numbering time-zone warning; payment page digits-only, Owner clear/remove, Admin QR view after a spec revision; currency list widening), each with a spec check first.
- Open owner asks: DuitNow/PayNow ID text field; spaces or hyphens in account numbers (remove or refuse); Admin seeing bank details text; deleted-user wording; meaning of "add 2 decimals 0.00" and "drop down list from the settings"; PR 74 money limits and text lengths; no-JS 409 policy; header greeting wording; Urbanist font source; outdated-browser notice wording; CRM sender name wording.
- Cloudflare token not saved yet (`.agent/cloudflare.env`, DNS edit on mortarhaus.com only, never in chat); then add the domain in Resend.
- Raise with Bob: Next dev mode logs arguments of the 2FA actions, incl. setup keys of throwaway e2e accounts (dev only).

## 7. Open review findings (P0/P1) and verdict
PR 82 Round 2 (2026-11-28, Approved with conditions, head `c51ee12`): R1 P1 and P2 resolved, no new findings; carried condition: the PR 81 Unicode audit mask, to the Bank settings Admin-view and QR revalidation implementation PR.
PR 82 Round 1 (2026-11-28, Revision required): [P1] record the authorization check (AUTH-03 row) for the QR alternative; [P2, before merge] storage summary and the logo preview. Both fixed at `c51ee12` (P1 in the PR body), resolved in Round 2.
PR 81 Round 3 (2026-11-28, Approved with conditions, head `733aae4`): R1 P1 resolved; Unicode audit-mask P2 deferred. Nothing blocking from review.
PR 81 Round 1 (2026-11-27, Revision required, head `733aae4`): [P1] missing self-check rows: resolved (R2). [P2, deferred] Unicode audit mask, to the Bank settings Admin-view and QR revalidation implementation PR.
Spec Round 32 (2026-11-27, Approved with conditions, rev 13 `bf633eb3`): same P2 deferred. Rulings: no new `[pii]` exception; QR preview stays scoped FILE-04 alternative; stale-copy test method chosen in the code PR (stale response + unreachable origin + header assert).
Spec Round 31 (resolved by R32): [P1] limit the audit exception to receiving account numbers (free-text field; unverified/legacy values); [P1] set retention and access boundaries before keeping full history (readers, export, notification projection, logs, backups, privacy review). QR cache finding resolved.
Spec Round 30 (2026-11-27, Revision required, on rev 11): [P1] cache policy, [P2] four-digit case — resolved by later rounds.
None blocking elsewhere. PR 80 Approved (R2), one optional P3 open: an auth smoke failure after the stack starts shows no Compose logs (ci.yml image job). PR 79 Approved (R2). Builder suggestion, not decided: weigh the QR route's cache at the Phase 4 FILE-03 review. Residuals: catalog form action state may carry to another service across Edit links (source reading only); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only; PR 77 no stale-workspace no-JS e2e, no test races two first template saves, cold-dev-server accessibility.spec failures unverified. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 DB currency list vs code table test, edit link for a missing service, long name at 320 px e2e; PR 72 clock option, preview timing, time zone pause.

## 8. Decisions made this session, not yet in the decisions log
- none (rev 13 approval is in PR 82's DECISIONS entry).

## 9. Files touched but not committed
None. Draft copies of the three files are in this session's scratchpad `reconcile/` (no longer needed).
