# Handoff — 2026-11-27 · `fix`: spec Round 29 Revision required (P1 FILE-04/QR cache, P2 audit digits); waiting for Charlie on the QR cache

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md`. Approved on main: v4.7 rev 9, hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`. Draft on PR 81: rev 10, hash `7bb8bc0736ce817801bcacf5d0efdeffa06eb116` (not approved). Active PR number: 81
- Working folder: build worktree `.agent/worktrees/build-docs-spec-bank-audit-qr-view` (branch `docs/spec-bank-audit-qr-view`); main checkout on `main`. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- PR 81 https://github.com/mortarhaus/CRM/pull/81, head `721f90d`, base `main` = `b0dbc52`. Docs only (image and E2E jobs skip).
- Repo `mortarhaus/CRM` is PUBLIC for PR 81; make it private after the merge.
- Last merged: PR 80 2026-11-27T00:39:34Z, no gate breach, log on agent-logs (`ca2d8e8`). Log gate clear.
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
2026-11-27 `build, include QR`: Opus sub-agent wrote spec rev 10 draft (bank audit keeps last 4 only; matrix row: Admin and Owner view the current DuitNow QR; rev 9 relabelled approved) and a DECISIONS entry; commit `da3ee60`, checked by the builder, pushed, PR 81 opened. Spec check of the other 2026-11-25 answers (sub-agent report): digits-only account number silent in spec; Owner clear details allowed but not mentioned; remove QR ok only if the file is kept (never-deleted rule); currency widening and numbering time-zone warning silent, no conflict.

## 5. Next step (file-level)
1. `fix` in progress for spec Round 29 (hash `7bb8bc07`, head `721f90d`; review archived on agent-logs `9d994d8`). Asked Charlie 2026-11-27: (A) stop the browser saving the QR (`no-store`; builder now recommends this) or (B) keep 1 hour and accept that others using the same browser could see the saved image. Then one sub-agent pass: P1 (state the Bank preview as a scoped FILE-04 alternative in spec + DECISIONS: origin checks session workspace, current key, role, 2FA; attachment + nosniff; cache scope; signed downloads keep <= 10 min; evidence list for `setup`/PROJECT s9) and P2 (stop saying the shipped audit stores digits only: `workspace-settings.ts` keeps `slice(-4)` characters and the input accepts non-digits; carry digits-only masking, incl. old values on the before side, into the code work; historical rows stay). Push, update PR body, Charlie re-runs `review spec <worktree path>` then `review 81`.
2. Then approve rev 10, `approved 81` before merge, merge, `merged 81`, `setup`.
3. Then the Phase 3 plan (require_2fa switch: Owner only, step-up; first PR of a milestone, builder s8 ask; deep tier).
4. With the next CI change: PR 80 R1 P3 (Compose logs on smoke failure); skipped E2E matrix job shows raw name.

## 6. Open ASK items, blockers, and owner answers
- Rev 10 ASKs ANSWERED 2026-11-27, Charlie "all ok" to the builder's recommendations: (1) Admin also sees bank details text, view only; (2) no fresh 2FA code to view the QR; (3) same Bank page, view only, with a menu link; (4) keep the 1-hour private QR cache; (5) FILE-03 audience change checked at the Phase 4 review. Not an approval of the spec text. Being written into rev 10 by sub-agent a965963a32f0bf0b3.
- Pushed in `42c8ddb`. Then answered 2026-11-27, Charlie "ok both" to the builder's recommendations: (a) no fresh 2FA code to view the bank text; (b) an Admin must have 2FA on to see these details. Being added to rev 10 by sub-agent a965963a32f0bf0b3. Bob to rule: 1-hour QR cache vs FILE-04.
- Pushed in `f1896a2`. Then answered 2026-11-27, Charlie "yes both": the QR image route refuses an Admin or Owner without 2FA; pushed in `721f90d`. No owner question open for rev 10. Not asked, no rule set: whether an Owner without 2FA sees the bank TEXT on the page (page hides it today). Bob to rule: 1-hour QR cache vs FILE-04.
- All answers up to 2026-11-26 ("1 yes, 2 yes") are recorded in docs/DECISIONS.md (merged with PR 78 and PR 79). Later PRs implement the 2026-11-25 ones (numbering time-zone warning; payment page digits-only, Owner clear/remove, Admin QR view after a spec revision; currency list widening), each with a spec check first.
- Open owner asks: DuitNow/PayNow ID text field; spaces or hyphens in account numbers (remove or refuse); Admin seeing bank details text; deleted-user wording; meaning of "add 2 decimals 0.00" and "drop down list from the settings"; PR 74 money limits and text lengths; no-JS 409 policy; header greeting wording; Urbanist font source; outdated-browser notice wording; CRM sender name wording.
- Cloudflare token not saved yet (`.agent/cloudflare.env`, DNS edit on mortarhaus.com only, never in chat); then add the domain in Resend.
- Raise with Bob: Next dev mode logs arguments of the 2FA actions, incl. setup keys of throwaway e2e accounts (dev only).

## 7. Open review findings (P0/P1) and verdict
Spec Round 29 (2026-11-27) Revision required: [P1] record the Bank QR preview as a scoped FILE-04 alternative (cache behaviour beyond the accepted one needs the owner); [P2, before merge] the audit does not yet guarantee digits only. No PR-81 review file yet.
None blocking. PR 80 Approved (R2), one optional P3 open: an auth smoke failure after the stack starts shows no Compose logs (ci.yml image job; fix with the next CI change). PR 79 Approved (R2). Builder suggestion, not decided: weigh the QR route's `Cache-Control: private, max-age=3600` at the Phase 4 FILE-03 review. Residuals: catalog form action state may carry to another service across Edit links (source reading only); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only; PR 77 no stale-workspace no-JS e2e, no test races two first template saves, cold-dev-server accessibility.spec failures unverified. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 DB currency list vs code table test, edit link for a missing service, long name at 320 px e2e; PR 72 clock option, preview timing, time zone pause.

## 8. Decisions made this session, not yet in the decisions log
- None.

## 9. Files touched but not committed
None of mine (build worktree clean at `721f90d`). Local `.env` and `.agent/q23-email-templates.md` are gitignored.
