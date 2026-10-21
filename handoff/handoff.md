# Handoff — 2026-10-15 · branch feat/p0-runtime (worktree) · HEAD 074018f

> In-flight state only. Never committed. Updated after every decision, owner answer, verification,
> commit and PR change (roles/builder.md §11), not only at session end. Redact per START.md.

<!-- Fixed sections 0–10. Don't add, rename or renumber sections. -->

## 0. Active target
- Active spec path: `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 4, hash `eb89f4ab817c79c536cd36f8aef7c643a059d697`, equals PROJECT.md §2; Bob spec Round 12 Approved with conditions) · Active PR number: none yet (Phase 0 PR 4)
- Working folder: `.agent/worktrees/build-feat-p0-runtime` (main checkout `/Users/charlie/Documents/Projects/Personal/CRM` is on `main`, clean apart from untracked `.playwright-mcp/`, not mine)

## 1. Current PR / branch
- Branch: `feat/p0-runtime` · Base: `main` at `074018f` (merge of PR #26)
- Status: ready (in review once Charlie runs `review 27`); head 1bb6dcb pushed
- Link: https://github.com/charliekhc/CRM/pull/27

## 2. Milestones
- Done: Phase 0 PR 1 (tooling), PR 2 (#22, auth + DB), PR 3 (#26, health, sign-up/in, 2FA, workspaces; merged 2026-10-15T02:04:21Z, `074018f`). Logs through PR 26 on `agent-logs` (`bc4b678`). Log gate clear.
- In progress: Phase 0 PR 4 = plan Tasks 15-17 (worker stub + esbuild bundles; Dockerfile/entrypoint/compose; CI image job with Trivy + E2E + CLAUDE.md Commands).
- Pending: Phase 1 plan (after Charlie picks the VPS provider).

## 3. Git state
```
main checkout: ## main, up to date with origin/main, only untracked .playwright-mcp/ (not mine)
worktree build-feat-p0-runtime: branch feat/p0-runtime == origin/main, clean (git-ignored .env copied in; root .env restored from the old auth-db worktree because removing the PR 3 worktree took its copy)
```
Uncommitted files — fingerprint every staged, modified or untracked path when writing this handoff:
| Path | Status | Content hash (`git hash-object <path>`, or `deleted`) |
|---|---|---|
| (none) | | |

```
1bb6dcb chore: also ignore nested .env files in the Docker build context
bed7adc docs: record PR 4 decisions and supply-chain ladder, and add the Docker image and compose stack to the runbook
447e0f8 ci: cap the image job at 60 minutes
cc02ba8 ci: build the image, scan it with Trivy and run E2E and the auth route smoke check
ee46c82 fix(web): send an expired or exhausted 2FA challenge back to sign in
bf5a58e feat: add single runtime image for web and worker
188d231 feat(web): add worker entry stub and esbuild bundles
```

## 4. Just finished
2026-10-15: `merged 26` done and verified (GitHub MERGED, `074018f` reachable from origin/main, log `bc4b678`, branch/worktree of feat/p0-auth-ui removed). Charlie typed `build`; spec gate (Round 12, hash eb89f4ab…) and reconcile gate pass; log gate clear (PRs 1-7, 9-26 all logged). Local main fast-forwarded to origin/main. Created branch and worktree for PR 4. Old handoff saved to the session scratchpad (handoff.old.md).

## 5. Next step (file-level)
2026-10-15 PR #27 opened (head 1bb6dcb). Builder re-ran typecheck, lint, 146 tests, image secret scan (0 hits, no .env in image). CI: checks/audit/secrets pass; `image` job (Trivy + 84 E2E, ~20+ min) pending. Next: Charlie runs `review 27` after image job is green; then `fix`/`approved 27`/`merged 27`. Old text follows.

Plan Task 15 (apps/web/src/worker/start.ts + test, apps/web/worker.ts, scripts/build-node.mjs, esbuild devDependency with UNI-06 ladder in DECISIONS), then Task 16 (docker/Dockerfile, entrypoint.sh, .dockerignore, compose web+worker), then Task 17 (.github/workflows/ci.yml image job, CLAUDE.md Commands). Also Bob PR #26 deferred items for PR 4: expired/exhausted 2FA challenge message ("sign in again"); wire `pnpm test:e2e` and `smoke:auth-route` into CI. Check real current versions/SHAs (esbuild, Trivy, actions) before pinning; plan values are unverified.

## 6. Open ASK items, blockers, and owner answers
- Open: VPS provider (Hostinger KVM 2 or iCore NODE2; Phase 1 gate); install emilkowalski/skills? (not installed); cleanup of `feat/p0-auth-db` branch + worktree and older merged branches (needs Charlie's OK); PR #21 docs bundle (not requested).
- Answered this session (question → answer): "all three yes" (FE-32 controls in PR 26); "remove maxLength"; "#2 follow bob" (UI kit option A); `merged 26`; `build`.
- Ports: Task 16 compose binds 127.0.0.1:3000 and 5433 (crm-dev-postgres-1 already uses 5433; BOMY containers use 5432/6379/9000/1025/8025). Port 3000 was held by an unrelated process earlier; free at 2026-10-15 start.

## 7. Open review findings (P0/P1) and verdict
- Review file: none for PR 4 yet · Verdict: n/a. PR 26 final: Approved with conditions (Round 3); only a P3 PR-text condition, not fixed (merged first); recorded in the PR 26 log.

## 8. Decisions made this session, not yet in the decisions log
- None (all PR 26 decisions merged in docs/DECISIONS.md).

## 9. Files touched but not committed
- None.

## 10. Model for the next session
Opus 5.5 for Dockerfile/entrypoint/CI/security work (supply chain, secrets, non-root); Sonnet 5 only for mechanical edits.

- 2026-10-15 (fix, Bob PR #27 R1): review archived (ae70237). Runbook P2 + PR body P3 fixed in 088d013, pushed; CI re-running. Next: Charlie runs `review 27` when CI is green.

- 2026-10-15: `approved 27` done. Review archived, receipt written (head 088d013). Next: Charlie merges PR 27, then `merged 27`.

- 2026-10-15: `merged 27` done. Merge b90dc48 (2026-10-15T10:55:01Z). Log 3d0bb3f on agent-logs. No gate breach. feat/p0-runtime branch+worktree removed; main fast-forwarded. PHASE 0 COMPLETE (PRs 1, 22, 26, 27). Next: Phase 1 plan after Charlie picks the VPS provider.

- 2026-10-15: Charlie: "hostinger kvm 2 and clean up". Cleanup done (old merged local branches + worktrees removed; kept agent-logs, main, chore/setup-reconcile-v4-6 (not merged); remote branches untouched). VPS choice recorded in DECISIONS: PR #28 (docs/vps-hostinger-kvm-2, head 145c445) open. Spec hosting text (Singapore, DO Managed PG) still needs a spec revision via `spec` -> Bob `review spec` -> Charlie approval -> `setup`. Next: Charlie runs `review 28`.

- 2026-10-16: `spec hosting: Hostinger KVM 2 in Malaysia`; Charlie answered "A" (Stage 3 = managed PostgreSQL, provider chosen at first sale). Spec v4.7 revision 5 (draft, hosting only) written on branch docs/spec-v4.7-rev5-hosting (worktree .agent/worktrees/build-docs-spec-hosting, head 4faae0d), PR #29 stacked on PR #28 (base docs/vps-hostinger-kvm-2). New spec hash 3c2df1a0d8b3a61b7b387c2faee635514b5021f9 (main: eb89f4ab…). Active spec path for review: docs/superpowers/specs/2026-09-27-core-sales-design.md on that branch. Next: Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` (Bob, on the branch head), merge order #28 then #29, Charlie approves in own words, then `setup` reconcile.

- 2026-10-16 (fix, Bob PR #28 R1): review archived (07b1a78). P2 iCore wording fixed in 553f0b2 on docs/vps-hostinger-kvm-2, pushed; merged into stacked docs/spec-v4.7-rev5-hosting (head 0b90799; spec hash unchanged 3c2df1a0). Next: Charlie runs `review 28` again, then `review spec` for the new spec.

- 2026-10-16: `approved 28` done. Review archived, receipt written (head 553f0b2). Next: Charlie merges PR 28, then `merged 28`. PR 29 (stacked) is retargeted to main by GitHub after #28 merges; it still needs `review spec`.

- 2026-10-16: `merged 28` done. Merge 2150705 (2026-10-16T09:52:41Z). Log 914b1b7 on agent-logs. No gate breach. docs/vps-hostinger-kvm-2 local branch+worktree removed; main fast-forwarded. PR 29 retargeted to main. Next: Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` (Bob), then approves in own words, then `setup`.

- 2026-10-16 (fix, Bob spec Round 13 of rev 5, hash 3c2df1a0): review archived (be02e9e). Spec v4.7 revision 6 pushed on docs/spec-v4.7-rev5-hosting (head 223c6ee), new spec hash c826f3ad87558ca9b1d8de2125569ad24fe6a464. Fixed 2 P1 + 2 P2. PR 29 body rebuilt (an earlier edit lost backtick text to the shell; redone). Next: Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md`.

- 2026-10-16: Charlie "yes" to "Do you approve revision 6?" (after Bob spec Round 14 Approved, hash c826f3ad). Approval recorded in spec Status; branch docs/spec-v4.7-rev5-hosting head 24317ab, NEW spec hash 0b4068967dd767addfcc791587317d4445ee4159. PR 29 CI re-running. Next: Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` (Bob confirms exact hash, like Round 12), merge PR 29 when CI green, then `setup`.

- 2026-10-16: Bob spec Round 15 Approved for exact hash 0b4068967dd767addfcc791587317d4445ee4159 (PR 29 head 24317ab). Review archived on agent-logs. PR 29 title/body labels refreshed (Bob P3). Waiting for PR 29 image job to go green; then Charlie merges PR 29, then `setup`.

- 2026-10-16: `merged 29` done. Merge cc3afd7 (2026-10-16T14:48:47Z). Log 29585b0 on agent-logs. GATE BREACH recorded: no approval receipt (approved 29 not run; builder did not prompt it). Branch+worktree removed; main fast-forwarded; spec on main hash 0b406896… but PROJECT.md reconcile hash still eb89f4ab…. Next: Charlie types `setup` (reconcile PROJECT.md + CLAUDE.md), then `build` / Phase 1 plan gates.

- 2026-10-17: `setup` reconcile done on branch chore/setup-reconcile-v4-7-rev6 (worktree .agent/worktrees/build-chore-setup-reconcile-v4-7-rev6, head df50718), PR #30. PROJECT.md reconcile hash -> 0b4068967dd767addfcc791587317d4445ee4159; CLAUDE.md status refreshed (PR 27 merged). Done on Sonnet 5.5, not the deep tier (stated to Charlie). Next: Charlie runs `review 30`; then I tell him to run `approved 30` BEFORE merging (lesson from PR 29 breach); then merged 30; then `build`.

- 2026-10-17: `approved 30` done. Review archived, receipt written (head df50718). Next: Charlie merges PR 30, then `merged 30`, then `build`.

- 2026-10-17: `merged 30` done. Merge bccb846 (2026-10-17T07:43:23Z). Log 0a85861 on agent-logs. No gate breach. Branch+worktree removed; main fast-forwarded; PROJECT.md reconcile hash == spec on main (0b406896…). Spec gate (Round 15) + reconcile gate pass. Next: Charlie types `build`; Phase 1 plan needs other owner gates (rate limits, crm_purge read policies, TEN-07, UNI-19, UNI-10) - ask Charlie before planning.

- 2026-10-17: Charlie: "go ahead with subagent for opus" (pasted Bob advice: choose A, use Opus 5.5). Path A: Opus sub-agent drafts spec v4.7 revision 7 (5 Phase 1 gate items as PROPOSALS) in worktree .agent/worktrees/build-docs-spec-v4-7-rev7 (branch docs/spec-v4.7-rev7-phase1-gates, base bccb846). Next: verify, push, open PR, Charlie runs `review spec`; Charlie decides each proposal; then setup + Phase 1 plan.

- 2026-10-17: Opus draft verified (diff-check ok, 2 files, hash 03e64025ffa5db54cd4428c1c02fcb7be581b832). Branch docs/spec-v4.7-rev7-phase1-gates (head ed0ead7) pushed; PR #31 opened (draft proposals). Next: Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` (Bob), answers the 6 questions in own words; then approval record, setup, Phase 1 plan. Remember: tell Charlie to run `approved 31` BEFORE merging.

- 2026-10-17 (fix, Bob spec Round 16): review archived (88a4cc5). Opus fixed 3 P1 + 1 P2; spec revision 7 updated, head 01a9959, new spec hash 3e816bee2c65fe8ef646a41939e89a2d22750c40; pushed; PR 31 body updated with Round 16 response + TEN-03/TEN-09/EVT-06 rows. Next: Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again (Bob). Then Charlie answers the 6 questions in own words; approval record; `approved 31` BEFORE merge; merged 31; setup; Phase 1 plan.

- 2026-10-17 (fix, Bob spec Round 17): review archived (c10c802). Opus fixed 2 P1 + 1 P2; spec revision 7 head 1f29584, new spec hash 418d7a60a43617e20bc0c64ac71d8abfec7dff98; pushed; PR 31 body updated (Round 17 response + TEN-10 row). Next: Charlie runs `review spec` again (Bob).

- 2026-10-18 (fix, Bob spec Round 18): review archived (adc4b41). Opus fixed 1 P1 + 1 P2 (purge insert guard; version FK actions + current-pointer rule). Spec revision 7 head d9c046a, new spec hash f44e0e5f876e4cd15b59a0bf1c4530fe941cd921; pushed; PR 31 body updated. Open gap noted: PDF render job after purge (retry vs finished). Next: Charlie runs `review spec` again. NOTE: 3 rounds in a row found new purge edge cases; offer Charlie a scope choice if Round 19 finds more.

- 2026-10-18 (fix, Bob spec Round 19, hash f44e0e5f): review archived (adc4b41 -> new). 2 P1 (direct DELETE of current version leaves live parent with NULL pointer; PDF render after purge recreates a PDF outside the artifact ledger). 4th round of purge edge cases. Asked Charlie to choose: A shrink item (b) to what Phase 1 needs and move purge invariants to Phase 9 gate list, or B keep hardening in this PR. Waiting for his answer; no fix started.

- 2026-10-19 Round 19 answered by Charlie: "A". Option A built by Opus helper; pushed b28e916; spec hash ec2f4fc75b633f3e83f872944a9b793179f8e179; PR #31 body updated (Round 19 section, EVT-05 row). Next: Charlie runs review spec in Bob window.

- 2026-10-19 Bob spec Round 20 fixed (TEN-08 per-migration tests, allow-list, PR summary). Pushed 952f5d4, spec hash 022012e2b69be2953edbe63b4619cb9969c216a5. Next: Charlie runs review spec (Opus 5.5).

- 2026-10-19 Bob spec Round 21 fixed; pushed f7fc721, hash f9532b6fba97093cc4f10eac20077fe047a373b1. Deferred to Phase 1 plan: polymorphic-test tables vs creation phase (Round 21 P2b). Next: review spec.

- 2026-10-19 Bob Round 22: Approved with conditions for f9532b6f (PR #31 head f7fc721). P3 body SHA fixed. Charlie answered 6 PR questions: 1 ok, 2 ok (ambiguous, asked), 3 yes, 4 A, 5 A, 6 A. Five proposals not yet decided by him.

- 2026-10-20 Charlie: "Owner answers for PR 31: ..." + "follow bob's suggestion" (Q2 yes, approve all five). Recorded in spec + DECISIONS; pushed 3ec62ef; hash c49329f78c6d7adc074263ab4b35353d8ac3ed5f. Next: Bob confirms exact hash (review spec), then approved 31 BEFORE merge, merged 31, setup.

- 2026-10-20 Bob Round 23 fixed (gate (b) + Phase 1 row labels); pushed 4ec37c3, hash 50acbcfe0b402718ddd2c49f4297ce378e1b7451. Carried: polymorphic-test P2 and post-merge Status P3 -> Phase 1 plan PR. Next: review spec again.

- 2026-10-20 approved 31: spec review archived (hash 10e3f397...), receipt PR-31.receipt pushed. Charlie may merge PR #31, then merged 31, then setup.

- 2026-10-20 merged 31: log log/2026-10-20_PR31_spec-v4-7-rev7-phase1-gates.md pushed (f47fbc3). main ff to 7f7178a. Spec on main 50acbcfe0b402718ddd2c49f4297ce378e1b7451. No breach. Local branch+worktree removed. Next: setup (PROJECT.md hash, section 9 TEN-07/UNI-10/UNI-19, CLAUDE.md Status), then Phase 1 plan (Opus 5.5).

- 2026-10-20 setup: branch chore/setup-reconcile-v4-7-rev7 (d3bfff0) pushed, PR opened. Next: Charlie review (Bob) -> approved N -> merge -> merged N, then Phase 1 plan (Opus 5.5).

- 2026-10-20 PR 32 Bob R1 (P1 self-check omitted rules) fixed in PR body only, head unchanged d3bfff0. Next: Charlie asks Bob to re-review 32 (same head).

- 2026-10-20 approved 32: review archived, receipt pushed. Charlie may merge PR #32, then merged 32.

- 2026-10-20 merged 32: log pushed; main ff to 4bf02f9; PROJECT.md hash 50acbcfe. No breach. Next: Phase 1 plan (Opus 5.5): settle Open question 8, crm_worker grants incl functions, Round 21 P2, Status label.

- 2026-10-20 Phase 1 plan drafted by Opus: branch docs/phase-1-plan (bfaf338), PR #33 opened. 8 PR slices. ASK list 9 (ASK1 crm_purge own login, ASK2 move polymorphic tests = done-when move, need Charlie). Next: Charlie answers ASK 1-2 (+3-9), Bob review 33, fix, approved 33, merge, merged 33, then Task 30 spec edits.

- 2026-10-20 Charlie: "follow bob's suggestions" -> ASK 1 own login, ASK 2 yes. Recorded in DECISIONS + plan; pushed 2f6c498 to PR #33. ASK 3-9 open (defaults). Next: Charlie review 33 (Bob).

- 2026-10-20 PR 33 Bob R1 fixed except P1 audit events (ASK 3 open, needs Charlie). Pushed c62f177. Next: Charlie answers ASK 3, then review 33 again.

- 2026-10-20 PR 33 Bob R2: 4 of 5 P1 fixed, pushed d1cf4bf. Open: ASK 3 (auth audit events) needs Charlie; (a) needs spec exception for no-workspace user, (b) new auth_audit_log table (my pick).

- 2026-10-20 ASK 3 = B (Charlie). Plan Task 31 full (auth_audit_log); DECISIONS entry; pushed 1578cd3 to PR #33. ASK 4-9 still open (defaults). Next: Charlie review 33.

- 2026-10-21 PR 33 Bob R3 fixed; pushed b088fe4 (2FA audit via triggers; alias lint; reconcile wording; PR body). Event renamed two_factor_backup_codes_changed (Bob to rule). ASK 4-9 open. Next: review 33.

- 2026-10-21 Repo moved to mortarhaus/CRM (Charlie). origin updated in all worktrees; PR opened for PROJECT.md section 4 + DECISIONS (branch chore/repo-moved-to-mortarhaus 9a67a4a). CI jobs start now. Audit fails on main deps (vite/launch-editor advisory): needs chore PR. PR 33 awaiting Bob review of b088fe4.

- 2026-10-21 Audit fix PR #35 (chore/audit-vite-launch-editor e716811): vite pin 8.3.4, audit exit 0, 146 tests pass. Opus helper fixing PR 33 Round 4/5 P1 (atomic session audit trigger). Charlie asked for a rule: repo private after merge, public when merging to main is needed: NOT done, asked for confirmation (making public exposes code/history).

- 2026-10-21 PR 33 Bob R4/R5 P1 fixed at plan level, pushed 07ff039 (session audit trigger). Needs PR 35 (audit) merged then CI rerun on 33. Next: review 33 + review 35.

- 2026-10-21 approved 35: review archived, receipt pushed. Charlie may merge PR #35, then merged 35; then rerun CI on PR 33.

- 2026-10-21 merged 35: log d15b9a6; main ff 51aec6a. PR 33 reopen did not retrigger CI, so merged main into docs/phase-1-plan -> new head  (adds only vite pin). Bob has not reviewed 07ff039. Next: review 33 on new head.

- 2026-10-21 PR 33 head now 41c8e32 (merged main, DECISIONS conflict resolved keeping both). Awaiting CI + Bob review.

- 2026-10-21 PR 33 Bob R6 (2 P1) fixed at plan level, pushed 8902e44 (trust cookies migration+guard; single-read 2FA flag). Next: review 33 on new head; image job must pass.

- 2026-10-21 Charlie: "A, and yes put the handoff on agent-logs" -> dev DB disposable, real data on server; handoff copy at agent-logs handoff/handoff.md (7c22d74); DECISIONS entry added to PR #34 (332d3c5). PR 33 awaiting Bob review of 8902e44; PR 34 awaiting review. Repo-visibility rule still unanswered (A/B).
