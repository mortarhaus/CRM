# Handoff — 2026-11-25 · PR #76 approved, review + receipt on agent-logs (head b2d8395); awaiting Charlie's merge, then `merged 76`

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 9, hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · Active PR number: 76
- Working folder: repo root (`/Users/charlie/Documents/Projects/Personal/CRM`, branch `main`). Build worktree for 8b: `.agent/worktrees/build-feat-p2-email-templates-page`. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- Branch: `main` = `a65399e`. Open PR: #76 (`feat/p2-email-templates-page`, head `b2d8395`). Repo `mortarhaus/CRM` is PUBLIC while PR 76 is open; make private after merge.
- Last merged: PR 75 (Phase 2 PR 8a, email template events, table, renderer) 2026-11-25T09:11:22Z, no gate breach, log on agent-logs (`54b7a1b`). Log gate clear.
- Next: Charlie runs `review 76`, then `approved 76` BEFORE merging, then `merged 76`.

## 2. Milestones
- Done: Phase 0; Phase 1; Phase 2 plan PRs 1-7 and PR 8a (#75). All logged on agent-logs.
- Pending: Phase 2 PR 8b (settings page). Phase 2 close: FILE-03 exception re-review, spec line 803 drops "SHA-256" in the next spec PR (PROJECT.md s11).
- Progress artifact (https://claude.ai/artifact/6de91JGVRQedUZ9YB3z3UQ): updated after PR 75 (version 1795597938-1f29); source copy in this session's scratchpad `crm-progress.html`. The earlier version showed stray wrapper text; removed. Republish after every merged PR.

## 3. Git state
```
## main...origin/main  (main = a65399e)
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
agent-logs worktree at `54b7a1b` plus the handoff-copy commit, clean.

## 4. Just finished
2026-11-25: Q23 answered; PR 8 built by an Opus 5.5 sub-agent and split into 8a and 8b; PR 75 (8a) R1 Blocked, fixed, R2 Approved, receipted, merged and logged. Removed local branch `feat/p2-email-templates-core` and worktree `build-feat-p2-email-templates` (tip equals PR head, on main). Kept backup branch `feat/p2-email-templates` (`ebb723a`). Repo set private. Artifact republished.

## 5. Next step (file-level)
1. `approved 76` done 2026-11-25. Charlie merges, then `merged 76`. Do NOT push to the branch.
1b. Follow-up PR after #76 merges (Charlie yes, 2026-11-25), before Phase 2 close: workspace binding (shared fix in action()) for brand colour, general, logo, bank details, QR, numbering, onboarding, catalog create; check catalog echo of free text; add the three 2026-11-25 owner approvals (size 487, no-JS draft loss, this follow-up) to docs/DECISIONS.md.
2. Remember on every PR: tell Charlie to run `approved N` BEFORE merging.
3. Phase 4 plan items: unique (workspace_id, number) index per issued document type; show PeriodBehindError clearly; no caller passes the allocator's `clock` option; the first email sender must replace CR/LF that a value brings into a subject.

## 6. Open ASK items, blockers, and owner answers
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

## 7. Open review findings (P0/P1) and verdict
PR 76 R2 Approved. PR 75 Approved (R2). Optional: limits.ts:90 comment (fix in 8b); no test races two first saves. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 (DB currency list vs code table test; edit link for a missing service; long name at 320 px e2e); PR 72 (clock option, preview timing, time zone pause); PR 71 (E2E sharding).

## 8. Decisions made this session, not yet in the decisions log
None pending: PR 75 decisions are in docs/DECISIONS.md; the 8b decisions are in the DECISIONS entry on its branch.

## 9. Files touched but not committed
None of mine (see section 3). Local `.env` at the repo root and `.agent/q23-email-templates.md` are gitignored. Backup of the previous handoff: this session's scratchpad `handoff-backup-2026-11-25.md`.

