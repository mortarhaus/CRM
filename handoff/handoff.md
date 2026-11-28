# Handoff — 2026-11-28 · PR 83 approved and receipt recorded; waiting for Charlie to merge, then `merged 83`

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md`. On main: v4.7 rev 13, hash `bf633eb3850c101134e682d4cea21dcc19cd93af`, approved by Charlie 2026-11-28 (Status text still says draft). Spec and reconcile gates pass.
- Working folder: `.agent/worktrees/build-feat-bank-admin-view`, branch `feat/bank-admin-view-qr-revalidate` from `3a50c26`, upstream `origin/feat/bank-admin-view-qr-revalidate`. Main checkout `main` fast-forwarded to `3a50c26` on 2026-11-28. Merged worktree `.agent/worktrees/build-docs-spec-bank-audit-qr-view` (PR 81) still present. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- OPEN: PR 83 https://github.com/mortarhaus/CRM/pull/83, head `8a65f4c276415c63978ad97e3d576fda36f400e2`, base `3a50c26`, 7 commits: R1 fixes `c33b076`, `b3a0a99`, `8a65f4c` on top of (`aafda3f` feat, `f78d05c` logo exception docs, `63d97dd` stale-entry test, `ad07b73` approval records). Body source: scratchpad `bank-pr-body.md`. CI run 46137046404 on `ad07b73`: all eight jobs passed; PR body updated with it.
- Last merged: PR 82 2026-11-28T05:37:15Z, merge `3a50c26`, head `c51ee12`, no gate breach, log on agent-logs (`f07215a`). Log gate clear.
- Removed after the merge: worktree `build-chore-setup-reconcile-v4-7-rev13` and local branch `chore/setup-reconcile-v4-7-rev13` (tip `c51ee12`). Remote branch kept.
- Repo `mortarhaus/CRM` PUBLIC for PR 83 (flipped 2026-11-28 after the push); make PRIVATE in `merged 83` if no other PR is open.
- GitHub order: push first, then make public.

## 2. Milestones
- Done: Phase 0; Phase 1; Phase 2 (closed 2026-11-26 by PR 79; DECISIONS "2026-11-26 — Phase 2 close" holds evidence and carried items).
- Done: E2E job split (PR 80). Spec PR 81 (rev 13) and setup reconcile PR 82 merged 2026-11-28. Next: bank settings implementation PR, then the Phase 3 plan (customers and team).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 82 (version 17); source in this session's scratchpad `crm-progress.html` (scratchpad can be cleared: rebuild by reading the artifact with path index.html). Republish after every merged PR.

## 3. Git state
Build worktree `.agent/worktrees/build-feat-bank-admin-view`: HEAD `8a65f4c`, clean.
Main checkout: `main` at `3a50c26`, untracked (not mine):
| Path | Status | Content hash |
|---|---|---|
| `.playwright-mcp/` | untracked, not mine | directory |
| `docker/sync-export.sh` | untracked, not mine | `51dcde23b372ecaaf041cea716ec3f95fa70226a` |
| `docker/sync-import.sh` | untracked, not mine | `9f2c1205bbf77be1c82eded28974f9f3f1d648b8` |

## 4. Just finished
2026-11-28 `approved 83`: Round 2 Approved, head `8a65f4c`, PR open; review archived (commit `5afec23`, blob `4945ac4`) and receipt written 2026-11-28T13:24:43Z (receipt commit `8cf9ac7`).
2026-11-28 R1 fixes: sub-agent ran bank-details E2E 15/15 and two mutation checks; Andy read the diff, reran typecheck, lint, test (83 files, 1543 passed, 1 skipped) and build: exit 0. Committed, pushed, PR body updated.
2026-11-28 `fix`: PR 83 Round 1 (Revision required, head `ad07b73`) archived on agent-logs (`5a5e723`, blob `54f59b66`). Preflight: build worktree clean at `ad07b73`. Findings: [P1] no TEN-08 self-check row (add a same-id lookup from the second workspace to the audit test); [P2, before merge] the email job still reads the whole settings row, limit it to country, time zone, date format; [P2, before merge] denied Bank views must assert the saved values are absent. Next: check the sub-agent's diff, commit, push, update PR body, watch CI.
2026-11-28 PR 83 opened. Owner answers before opening (asked by question dialog): new Admin-view wording, three messages: "Use all three (Recommended)"; add `undici` 8.12.3 as a test-only dependency: "Add it (Recommended)". Both recorded in DECISIONS (`ad07b73`). Andy reran lint and typecheck after that commit: ok.
2026-11-28: Opus 5.5 sub-agent build finished; Andy read the diff, reran typecheck, lint, test (83 files, 1541 passed, 1 skipped) and build: all exit 0. Committed locally, HEAD 63d97dd, working tree clean (pushed afterwards, see above). Commit 3 (undici dev dependency + stale-entry test + one PROJECT.md line) is last so it can be dropped. Both ASKs then answered (above). E2E: sub-agent ran it (see PR body, scratchpad bank-pr-body.md); Andy did not rerun it.
2026-11-28 `build`: startup checks passed (log gate clear, reviews archived, handoff copy matched); main fast-forwarded; build worktree created. Owner message, verbatim: "run as subagent for opus" / "yes" / "build". Opus 5.5 sub-agent implements; Andy (Sonnet 5.5) checks, commits, pushes and opens the PR. The bomy_* containers hold ports 5432, 6379, 9000-9001: leave them running.
2026-11-28 `merged 82`: merge proven (host MERGED, `3a50c26` on origin/main, tree equals `c51ee12`), receipt before the merge, log pushed (`f07215a`), progress artifact republished (version 17, `1795844314-38bc`).
2026-11-28 `approved 82`: Round 2 Approved with conditions, head `c51ee12`, PR open; review archived and receipt written on agent-logs (review commit `f50d750`, receipt commit `c3746c7`, 2026-11-28T05:35:03Z, review blob `edcbcd8`).
2026-11-28 commit `c51ee12de8939fa3036f22d256f93f90c8f22e5d` pushed (PROJECT.md section 8, R1 P2). R1 P1 is a PR body change, drafted at scratchpad `fix-pr-body.md`, not yet applied (apply after CI with the new head and run id). Build worktree clean. Open owner question from the draft: `/files/logo` has no FILE-04 alternative recorded in PROJECT.md section 9.
2026-11-28 `fix`: PR 82 review Round 1 (Revision required, head `8b87dba`) archived on agent-logs (`7146d58`, blob `e2af7d57`). Findings: [P1] no AUTH-03 self-check row (PR body); [P2, before merge] PROJECT.md section 8 storage summary omits the same-origin logo preview. Preflight: build worktree clean at `8b87dba`. Same Opus 5.5 sub-agent drafting in the session scratchpad (`fix-pr-body.md`, `fix-PROJECT.md`); next: check, commit, push, update PR body, watch CI.
2026-11-28 PR 82 opened; CI passed on `8b87dba`; PR body UNI-07 and UNI-13 rows filled. Opus draft checked by Sonnet 5.5, with two wording changes (CLAUDE.md next step; DECISIONS builder note on spec line 100). Local typecheck, lint, test and build not run (docs only).
2026-11-28 `setup` started. Owner answer on the model (asked: switch to Opus, or continue on Sonnet 5.5): "subagent on opus". Worktree `.agent/worktrees/build-chore-setup-reconcile-v4-7-rev13`, branch `chore/setup-reconcile-v4-7-rev13` from `826f70d` (no upstream set), nothing changed in it yet. Opus 5.5 sub-agent drafting in this session's scratchpad `reconcile/` (copies of PROJECT.md, CLAUDE.md, DECISIONS.md); next: review its diff, apply, check, commit, PR. Log gate clear (no merged PR after #3 without a log).
2026-11-28 `merged 81`. Merge proven (host state MERGED, merge `826f70d` on origin/main, parents `b0dbc52` + `733aae4`, tree equals the reviewed head); receipt before the merge; log pushed to agent-logs (`2d193cf`); progress artifact republished (version 16). A stale `CLAUDE.md` inside the agent-logs worktree (spec v4.5 era) is old branch content, not current project rules.

## 5. Next step (file-level)
1. Done 2026-11-28: repo private; handoff copy refreshed.
2. Done in PR 82: PROJECT.md and CLAUDE.md reconciled; Charlie's rev 13 approval recorded in DECISIONS. Spec Status label waits for the next spec PR (it also corrects "needs no audit code change", spec line 100).
3. PR 83: Charlie merges, then `merged 83` (log, cleanup, repo private, progress artifact). Then `fix`, or `approved 83` before Charlie merges, `merged 83` after. After the merge, CLAUDE.md "Still to build: the bank settings Admin-view and QR revalidation change" is stale (next docs change or setup).
4. Then the Phase 3 plan (require_2fa switch: Owner only, step-up; first PR of a milestone, builder s8 ask; deep tier).
5. With the next CI change: PR 80 R1 P3 (Compose logs on smoke failure); skipped E2E matrix job shows raw name.

## 6. Open ASK items, blockers, and owner answers
- ANSWERED 2026-11-28: logo preview accepted as a FILE-04 exception ("yes"); recorded in PROJECT.md section 9 and DECISIONS in PR 83 (`f78d05c`).
- Found during the PR 83 build, not changed (not yet raised as work): (a) saving bank details then uploading a QR without reloading is refused as stale (existing Owner behaviour on main); worth a follow-up. (b) root `.env` DB credentials do not match the dev compose stack (E2E used the committed dev-only URLs as process env). (c) container `tt-1d3-pg` is running, not started by this project's build; left alone.
- ASK before the Phase 7 plan: confirm the client link 30-day default (spec Current gates (e)).
- Superseded 2026-11-27 (Charlie chose "1" on Round 31): the full-account-number points told to Charlie no longer apply. Still open: he may correct the builder reading that the QR stays recorded as its storage key.
- Bob ruled in spec Round 32 (see section 7).
- Tell Charlie (rev 13 report): a number saved by mistake still leaves up to its last 4 characters permanently, so the option text "Both problems go away" was slightly too strong.
- All answers up to 2026-11-26 ("1 yes, 2 yes") are recorded in docs/DECISIONS.md (merged with PR 78 and PR 79). Later PRs implement the 2026-11-25 ones (numbering time-zone warning; payment page digits-only, Owner clear/remove, Admin QR view after a spec revision; currency list widening), each with a spec check first.
- Open owner asks: DuitNow/PayNow ID text field; spaces or hyphens in account numbers (remove or refuse); deleted-user wording; meaning of "add 2 decimals 0.00" and "drop down list from the settings"; PR 74 money limits and text lengths; no-JS 409 policy; header greeting wording; Urbanist font source; outdated-browser notice wording; CRM sender name wording.
- Cloudflare token not saved yet (`.agent/cloudflare.env`, DNS edit on mortarhaus.com only, never in chat); then add the domain in Resend.
- Raise with Bob: Next dev mode logs arguments of the 2FA actions, incl. setup keys of throwaway e2e accounts (dev only).

## 7. Open review findings (P0/P1) and verdict
PR 83 Round 2 (2026-11-28, Approved, head `8a65f4c`): Round 1 findings resolved, no new ones, no deferred conditions (the PR 81 Unicode condition is satisfied).
PR 83 Round 1 (2026-11-28, Revision required, head `ad07b73`): [P1] TEN-08 self-check; [P2, before merge] notification settings projection; [P2, before merge] denial assertions. All three fixed and pushed in `8a65f4c`; CI run 46145946571 passed all eight jobs, PR body updated; waiting for Round 2.
PR 82 Round 2 (2026-11-28, Approved with conditions, head `c51ee12`): R1 P1 and P2 resolved, no new findings; carried condition: the PR 81 Unicode audit mask, to the Bank settings Admin-view and QR revalidation implementation PR.
PR 82 Round 1 (2026-11-28, Revision required): [P1] record the authorization check (AUTH-03 row) for the QR alternative; [P2, before merge] storage summary and the logo preview. Both fixed at `c51ee12` (P1 in the PR body), resolved in Round 2.
PR 81 Round 3 (2026-11-28, Approved with conditions, head `733aae4`): R1 P1 resolved; Unicode audit-mask P2 deferred. Nothing blocking from review.
PR 81 Round 1 (2026-11-27, Revision required, head `733aae4`): [P1] missing self-check rows: resolved (R2). [P2, deferred] Unicode audit mask, to the Bank settings Admin-view and QR revalidation implementation PR.
Spec Round 32 (2026-11-27, Approved with conditions, rev 13 `bf633eb3`): same P2 deferred. Rulings: no new `[pii]` exception; QR preview stays scoped FILE-04 alternative; stale-copy test method chosen in the code PR (stale response + unreachable origin + header assert).
Spec Round 31 (resolved by R32): [P1] limit the audit exception to receiving account numbers (free-text field; unverified/legacy values); [P1] set retention and access boundaries before keeping full history (readers, export, notification projection, logs, backups, privacy review). QR cache finding resolved.
Spec Round 30 (2026-11-27, Revision required, on rev 11): [P1] cache policy, [P2] four-digit case — resolved by later rounds.
None blocking elsewhere. PR 80 Approved (R2), one optional P3 open: an auth smoke failure after the stack starts shows no Compose logs (ci.yml image job). PR 79 Approved (R2). Builder suggestion, not decided: weigh the QR route's cache at the Phase 4 FILE-03 review. Residuals: catalog form action state may carry to another service across Edit links (source reading only); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only; PR 77 no stale-workspace no-JS e2e, no test races two first template saves, cold-dev-server accessibility.spec failures unverified. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 DB currency list vs code table test, edit link for a missing service, long name at 320 px e2e; PR 72 clock option, preview timing, time zone pause.

## 8. Decisions made this session, not yet in the decisions log
None (all in PR 83's DECISIONS entries).

## 9. Files touched but not committed
None. Draft copies of the three files are in this session's scratchpad `reconcile/` (no longer needed).
