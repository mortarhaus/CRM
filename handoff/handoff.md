# Handoff — 2026-11-26 · PR 79 approved (R2) and receipted, head e432717; waiting for Charlie to merge, then `merged 79`

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 9, hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · Active PR number: 79
- Working folder: repo root (`main`). Build worktree: `.agent/worktrees/build-docs-phase-2-close` (branch `docs/phase-2-close`, head `e432717981aa16cfc7db73cf8f12c59ffba22d7d`). Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- `main` = `ffa616e` (equal to origin/main). Open PR: #79 "docs: close Phase 2" (CLAUDE.md and docs/DECISIONS.md only). Repo is PUBLIC while PR 79 needs CI; set private after merge.
- Last merged: PR 78, log on agent-logs (`3545fa1`).
- GitHub order: push first, then make public (a push right after the switch returned 403 "Repository is disabled" twice on 2026-11-26; the same push worked in the usual order; cause unverified).

## 2. Milestones
- Done: Phase 0; Phase 1; all Phase 2 plan PRs (1-8b) and the follow-ups PR 77 and PR 78. All logged on agent-logs.
- Pending before Phase 2 closes: record the FILE-03 exception review (Charlie 2026-11-26 "1a": keep, next review at the Phase 4 gate; Bob reviews); spec line 803 drops "SHA-256" in a spec PR (PROJECT.md s11); CLAUDE.md Status section is stale. Then the Phase 3 plan (customers and team; first PR of a milestone, builder s8; deep tier).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 78 (version 1795694336-2205); source in this session's scratchpad `crm-progress.html` (scratchpad can be cleared: rebuild by reading the artifact with path index.html). Republish after every merged PR.

## 3. Git state
```
## main...origin/main  (main = ffa616e)
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
Build worktree clean at `e432717` (pushed).

## 4. Just finished
2026-11-26 `build`: Phase 2 close-out docs PR #79 (Opus sub-agent a27b062 + builder correction 94080df). Gate evidence: all four done-when items met on ffa616e. Local checks ran at a27b062 (typecheck, lint, 1529 tests, build); 94080df edits DECISIONS text only. Then 0c48538 records Charlie's "1 yes, 2 yes" (Q24 waits for Phase 6; require_2fa switch in Phase 3). `fix` R1 (Bob, head 0c48538, Revision required): P1 added AUTH-09 and TEN-11 self-check rows (PR body); P2 scoped the QR access statement to the origin and recorded the 1 h private cache (e432717). Review archived at agent-logs 33ad818.

## 5. Next step (file-level)
1. Charlie merges PR 79 (approved R2, receipt on agent-logs, head e432717), then runs `merged 79`.
2. Q24 and the require_2fa placement are answered (recorded in 0c48538); nothing blocks the close but Bob's review.
3. E2E sharding is due (image job ~69 min, limit 90). Then the spec PR for line 803, and the Phase 3 plan (customers and team; builder s8 ask; deep tier).
4. Phase 4 items are listed in the PR 79 DECISIONS entry (carried forward).

## 6. Open ASK items, blockers, and owner answers
- ANSWERED 2026-11-26 (Charlie, "B"), asked after the corrected description: after a currency-lock refusal on edit, A keep the typed currency or B put the currency back to the saved one (other typed boxes kept in both)? Answer: B. Recorded in docs/DECISIONS.md (merged with PR 78).
- ANSWERED 2026-11-26 (Charlie: "No, keep the currency reset for currency-lock refusals"), asked: add the currency drop-down jumping back after a currency-locked refusal to the fix list? Answer: no, keep the behaviour. SUPERSEDED/REOPENED: based on a wrong description; re-asked as A/B.
- ANSWERED 2026-11-26 (Charlie, "1a"), asked: keep the FILE-03 QR exception (content-named QR images, never deleted) and review again at the Phase 4 gate (A), or drop it (B)? Answer: A. Record in docs/DECISIONS.md in the Phase 2 close-out PR; Bob reviews.
- ANSWERED 2026-11-26 (Charlie, "2a"), asked: should refused catalog saves stop sending the typed text back (A, accepting that without JavaScript the user retypes) or keep it (B)? Answer: A. Separate small PR; record in docs/DECISIONS.md there. Keep the price error message useful (service-form.tsx:85 uses the echoed price); with JavaScript typed text stays (onSubmit prevents reset).
- ANSWERED 2026-11-25 ("1 yes, 2 yes, 3 yes"): size 487 accepted; follow-up PR for the other forms: yes; no-JS draft loss accepted.
- Charlie's answers 2026-11-25 ("1 A, 2 ok, then build; 3 b, 4 ok, 5 digits only, yes can clear, admin yes, why is a user details deleted?, 6 ok widen, add 2 decimals 0.00 and drop down list from the settings"). Implementation of 3-6 is NOT in 8b; each needs its own reviewed PR, spec check first (builder s8):
  - 8b: size accepted (A); preview samples "Siti Rahim" / "bank details" approved.
  - DNS: option B (Cloudflare token, DNS edit on mortarhaus.com only, in a gitignored local file, never in chat). Waiting for the token and the Resend records.
  - Numbering time zone: keep behaviour ("4 ok"; includes the suggested warning on the time zone page).
  - Payment page: account number digits only; Owner can clear bank details / remove QR (spec matrix and step-up to check); Admin can view the QR. OPEN: DuitNow/PayNow ID text field (not answered); deleted-user wording (Charlie asked why it happens; explained, awaiting ok).
  - Catalog: widen the currency list. OPEN (confirm meaning): "add 2 decimals 0.00 and drop down list from the settings" (builder reading: accept/show 2 decimals; a drop-down, likely service unit, managed in settings).
  - E2E sharding: unanswered.
- Note from the 8b run: Next dev mode logs arguments of the existing 2FA actions, incl. setup keys of throwaway e2e accounts (dev only, not from 8b; local logs deleted). Raise with Bob.
- When to shard the E2E job (57+ min; limit 90; Bob suggests before about 75 min). Older small items: Q24 proposal_cover, header greeting wording, Urbanist font source, outdated-browser notice wording, no-JS 409 policy, CRM sender name wording.
- 2026-11-26 asked with PR 79, ANSWERED "1 yes, 2 yes" (recorded in PR 79): Q24 proposal cover options wait for Phase 6; require_2fa switch goes in the Phase 3 plan (Owner only, step-up). Still open: Admin viewing the QR needs a spec clarification; account-number separators; DuitNow/PayNow ID text field; deleted-user wording; both Q6 parts; Cloudflare token not saved.

## 7. Open review findings (P0/P1) and verdict
PR 79 Approved (R2, no open findings). QR route sends `Cache-Control: private, max-age=3600` (a fresh browser copy skips the Owner/current-key checks for up to 1 h; not exercised in a browser): weigh at the Phase 4 FILE-03 review. None open (P0/P1). PR 78 Approved (R2). Residual: pre-existing, from source reading only: catalog form action state keyed by workspace may carry to another service across Edit links (error/saved message, version number); two unexplained CATALOG_FAILED results in flaky local runs; new catalog browser tests desktop Chromium only. PR 77: no stale-workspace e2e with JavaScript disabled; no test races two first template saves; cold-dev-server accessibility.spec failures unverified. Dev only: Next dev mode logs 2FA action arguments (raise with Bob). Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 (DB currency list vs code table test; edit link for a missing service; long name at 320 px e2e); PR 72 (clock option, preview timing, time zone pause).

## 8. Decisions made this session, not yet in the decisions log
- The 2026-11-25 approvals are now in docs/DECISIONS.md (merged with PR 77).

## 9. Files touched but not committed
None of mine (see section 3). Local `.env` and `.agent/q23-email-templates.md` are gitignored.

