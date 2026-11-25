# Handoff — 2026-11-25 · PR 75 (Phase 2 PR 8a) merged (a65399e) and logged; next PR 8b (built, not pushed)

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 9, hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`) · Active PR number: none open (next is 8b, not yet pushed)
- Working folder: repo root (`/Users/charlie/Documents/Projects/Personal/CRM`, branch `main`). Build worktree for 8b: `.agent/worktrees/build-feat-p2-email-templates-page`. Log worktree: `.agent/worktrees/agent-logs`.

## 1. Current PR / branch
- Branch: `main` = `a65399e` (equal to origin/main). Open PRs: 0. Repo `mortarhaus/CRM` is PRIVATE (standing rule: public while a PR needs CI, private after merge).
- Last merged: PR 75 (Phase 2 PR 8a, email template events, table, renderer) 2026-11-25T09:11:22Z, no gate breach, log on agent-logs (`54b7a1b`). Log gate clear.
- Next: PR 8b, branch `feat/p2-email-templates-page` at `ef2dec4`, stacked on the pre-merge 8a head `bae8dd6`, NOT pushed.

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
1. 8b: in `.agent/worktrees/build-feat-p2-email-templates-page`, rebase onto `origin/main` (drop the 8a commits), fix the stale "pending Charlie" comment at `packages/core/src/security/limits.ts:90` (Bob P3), re-run typecheck, lint, test, build, e2e (email-templates, shell, catalog; warm dev server, `TRUSTED_CLIENT_IP_HEADER=x-forwarded-for`), write the full rule-by-rule self-check table (missing table was a P1 on PR 75), push, make repo public, open PR. Deep tier: Opus 5.5 sub-agent (Charlie chose "subagent").
2. Remember on every PR: tell Charlie to run `approved N` BEFORE merging.
3. Phase 4 plan items: unique (workspace_id, number) index per issued document type; show PeriodBehindError clearly; no caller passes the allocator's `clock` option; the first email sender must replace CR/LF that a value brings into a subject.

## 6. Open ASK items, blockers, and owner answers
- 8b size (433 non-test lines, over 400): accept (builder recommends) or split again. Confirm preview sample values owner name "Siti Rahim" and what changed "bank details".
- DNS for mortarhaus.com (SPF, DKIM, DMARC on Cloudflare and Resend) before the first real email: Charlie has not chosen A (connect Chrome extension), B (Cloudflare token), C (I give the records). Claude-in-Chrome tools are not available in this session.
- Numbering: confirm or change the behaviour after a time zone change (issuing pauses up to about 26 hours until the new zone reaches the stored period).
- Payment page: DuitNow/PayNow text ID field; account-number character rules; clear or remove bank details/QR; Admin QR view; the deleted-user wording ("a user who no longer has an account").
- Catalog and money (PR 74, no merge block, Bob agrees with my defaults): full ISO list for default/base currency; accept zero-only extra decimals (Bob leans yes); service unit free text vs list.
- When to shard the E2E job (57+ min; limit 90; Bob suggests before about 75 min). Older small items: Q24 proposal_cover, header greeting wording, Urbanist font source, outdated-browser notice wording, no-JS 409 policy, CRM sender name wording.

## 7. Open review findings (P0/P1) and verdict
None open. PR 75 Approved (R2). Optional: limits.ts:90 comment (fix in 8b); no test races two first saves. Older optional P3s: PR 73 non-ASCII upper-casing in shortCode; PR 74 (DB currency list vs code table test; edit link for a missing service; long name at 320 px e2e); PR 72 (clock option, preview timing, time zone pause); PR 71 (E2E sharding).

## 8. Decisions made this session, not yet in the decisions log
None pending: PR 75 decisions are in docs/DECISIONS.md; the 8b decisions are in the DECISIONS entry on its branch.

## 9. Files touched but not committed
None of mine (see section 3). Local `.env` at the repo root and `.agent/q23-email-templates.md` are gitignored. Backup of the previous handoff: this session's scratchpad `handoff-backup-2026-11-25.md`.

