# Handoff — 2026-11-28 · PR 81 merged and logged, main CI passed, repo private again; next: new conversation (`/clear`), then `setup`

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md`. On main: v4.7 rev 13, hash `bf633eb3850c101134e682d4cea21dcc19cd93af`, approved by Charlie 2026-11-28 (Status text still says draft). No open PR.
- Working folder: main checkout on `main` (local `b0dbc52`, behind `origin/main` `826f70d`; not pulled). Merged build worktree `.agent/worktrees/build-docs-spec-bank-audit-qr-view` still present. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- Last merged: PR 81 2026-11-28T03:19:01Z, merge `826f70d`, head `733aae4`, no gate breach, log on agent-logs (`2d193cf`). Log gate clear.
- Repo `mortarhaus/CRM` made PRIVATE 2026-11-28 after main run 46102264079 passed on `826f70d` (all eight jobs, finished 03:50:22Z); no open PR.
- GitHub order: push first, then make public (a push right after the switch returned 403 "Repository is disabled" twice on 2026-11-26; cause unverified).

## 2. Milestones
- Done: Phase 0; Phase 1; Phase 2 (closed 2026-11-26 by PR 79; DECISIONS "2026-11-26 — Phase 2 close" holds evidence and carried items).
- Done: E2E job split (PR 80). Spec PR 81 (rev 13) merged 2026-11-28. Next: `setup`, then the Phase 3 plan (customers and team).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 81 (version 16, `1795836014-ee39`); source in this session's scratchpad `crm-progress.html` (scratchpad can be cleared: rebuild by reading the artifact with path index.html). Republish after every merged PR.

## 3. Git state
Main checkout:
```
## main  (local b0dbc52; origin/main 826f70d)
?? .playwright-mcp/
?? docker/sync-export.sh
?? docker/sync-import.sh
```
| Path | Status | Content hash |
|---|---|---|
| `.playwright-mcp/` | untracked, not mine | directory |
| `docker/sync-export.sh` | untracked, not mine | `51dcde23b372ecaaf041cea716ec3f95fa70226a` |
| `docker/sync-import.sh` | untracked, not mine | `9f2c1205bbf77be1c82eded28974f9f3f1d648b8` |

Build worktree (merged branch): HEAD `733aae4`, clean.

## 4. Just finished
2026-11-28 `merged 81`. Merge proven (host state MERGED, merge `826f70d` on origin/main, parents `b0dbc52` + `733aae4`, tree equals the reviewed head); receipt before the merge; log pushed to agent-logs (`2d193cf`); progress artifact republished (version 16). A stale `CLAUDE.md` inside the agent-logs worktree (spec v4.5 era) is old branch content, not current project rules.

## 5. Next step (file-level)
1. Done 2026-11-28: repo private; handoff copy refreshed.
2. Charlie runs `setup` (reconcile PROJECT.md incl. section 11 "line 803" item and the Phase 7 gate, and CLAUDE.md, to spec `bf633eb3`).
3. In that or the next reviewed PR: record Charlie's approval in `docs/DECISIONS.md` ("I approve spec revision 13", 2026-11-28, Andy session, after `approved 81`, before the merge) and relabel the spec Status.
4. Implementation PR (Bank settings Admin-view and QR revalidation): QR route `must-revalidate`; Admin view with 2FA check; Unicode-safe audit mask (4 whole code points) with a synthetic test on a settings change; owner email job reads changed column names only; optional mask tests and two comment fixes. The `last4` shape stays.
5. Then the Phase 3 plan (require_2fa switch: Owner only, step-up; first PR of a milestone, builder s8 ask; deep tier).
6. With the next CI change: PR 80 R1 P3 (Compose logs on smoke failure); skipped E2E matrix job shows raw name.

## 6. Open ASK items, blockers, and owner answers
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
PR 81 Round 3 (2026-11-28, Approved with conditions, head `733aae4`): R1 P1 resolved; Unicode audit-mask P2 deferred. Nothing blocking from review.
PR 81 Round 1 (2026-11-27, Revision required, head `733aae4`): [P1] missing self-check rows: resolved (R2). [P2, deferred] Unicode audit mask, to the Bank settings Admin-view and QR revalidation implementation PR.
Spec Round 32 (2026-11-27, Approved with conditions, rev 13 `bf633eb3`): same P2 deferred. Rulings: no new `[pii]` exception; QR preview stays scoped FILE-04 alternative; stale-copy test method chosen in the code PR (stale response + unreachable origin + header assert).
Spec Round 31 (resolved by R32): [P1] limit the audit exception to receiving account numbers (free-text field; unverified/legacy values); [P1] set retention and access boundaries before keeping full history (readers, export, notification projection, logs, backups, privacy review). QR cache finding resolved.
Spec Round 30 (2026-11-27, Revision required, on rev 11): [P1] cache policy, [P2] four-digit case — resolved by later rounds.
None blocking elsewhere. PR 80 Approved (R2), one optional P3 open: an auth smoke failure after the stack starts shows no Compose logs (ci.yml image job). PR 79 Approved (R2). Builder suggestion, not decided: weigh the QR route's cache at the Phase 4 FILE-03 review. Residuals: catalog form action state may carry to another service across Edit links (source reading only); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only; PR 77 no stale-workspace no-JS e2e, no test races two first template saves, cold-dev-server accessibility.spec failures unverified. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 DB currency list vs code table test, edit link for a missing service, long name at 320 px e2e; PR 72 clock option, preview timing, time zone pause.

## 8. Decisions made this session, not yet in the decisions log
- Charlie's approval of spec rev 13 (2026-11-28, verbatim in section 5): not yet in `docs/DECISIONS.md`.

## 9. Files touched but not committed
None of mine (build worktree clean at `733aae4`). Local `.env` and `.agent/q23-email-templates.md` are gitignored.
