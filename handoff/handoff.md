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

- 2026-10-21 PR 33 Bob R7 P1 fixed at plan level, pushed 4cf983e (sign-in FOR SHARE check + revoke-sessions trigger). Next: review 33. PR 34 awaiting review.

- 2026-10-22 Charlie chose B (design moves to PR 4 spike). Plan restructured: 31.A R1-R14, 31.B T1-T14, 31.C spike, 31.E candidate designs; pushed 0556cef. Next: review 33.

- 2026-10-22 PR 33 Bob R9 fixed (R15/T15 legacy session cutover; 2FA-change list), pushed 84c492a. Next: review 33.

- 2026-10-22 approved 33 (Round 10 Approved, head 84c492a): review archived, receipt pushed; PR body P3 fixed. Plan line 5 reviewer-directed wording still to fix later (non-blocking). Charlie may merge PR #33; I detect the merge and write the log. Then Task 30 spec revision 8 PR.

- 2026-10-22 merged 33: log log/2026-10-22_PR33_phase-1-plan.md pushed (3e4568c). main ff 999b9c4. No breach. Plan worktree+branch removed. Next: Task 30 = separate spec revision 8 PR (E1-E12), asking Charlie. Plan line-5 reviewer-directed wording to fix in next plan edit. PR 34 open (will conflict in DECISIONS). ASK 4-9 open.

- 2026-10-22 Task 30: spec rev 8 draft PR opened (branch docs/spec-v4.7-rev8-phase1-plan-alignment, head 3ec71a4, spec hash 132747c701604754aafad92fe03e1f8cc1bd6625). Needs Bob: review spec + review N. Open for Charlie: points A, F, G (labelled proposals). PR 34 still waiting for Bob.

- 2026-10-22 PR 36 Bob R25 fixed, pushed e015e58 hash b81d8350b1337583b9d3cb6ca6bbdd7679304c3c. WAITING on Charlie: F (recovery-code sign-in) and G (Phase 0 session cutover) before re-review. PR 34 waiting for Bob.

- 2026-10-22 Charlie: "F A, G A". Recorded; PR 36 head 40f2777, spec hash 846b772e493464672f103c99bf8a4c39a9627085. Next: Bob review spec + review 36 (exact hash/head). PR 34 still unreviewed.

- 2026-10-22 PR 36 Bob R26 fixed, pushed 4714f04 spec hash 733cc0e9ce4af0771bdd2769720e3f228caf8855; body rewritten. Next: review spec + review 36.

- 2026-10-22 Bob spec Round 27: APPROVED hash 733cc0e9 (UNI-15 conforming). Two P3 fixed, PR 36 head 5748d9b. Next: review 36 on 5748d9b, then Charlie approval of rev 8 recorded in DECISIONS + PR body only (not spec), approved 36, merge.

- 2026-10-22 approved 36 procedure done (Bob PR Round 1 Approved head 5748d9b; spec Round 27 approved 733cc0e9; CI green). Review archived + receipt pushed. STILL NEEDED before merge: Charlie plain approval of revision 8 (record in PR body, no commit). Then merge; then setup PR also fixes DECISIONS scope line (plan too) and records rev 8 approval + spec Status line.

- 2026-10-22 approved 36 procedure done (Bob PR Round 1 Approved head 5748d9b; spec Round 27 approved 733cc0e9; CI green). Review archived + receipt pushed. STILL NEEDED before merge: Charlie plain approval of revision 8 (record in PR body, no commit). After merge: setup PR also fixes DECISIONS scope line, records rev 8 approval + spec Status line.

- 2026-10-22 Charlie: "I approve spec revision 8" recorded in PR 36 body (no commit). Ready to merge PR 36 (head 5748d9b, receipt 7055e80). After merge: merged 36 log, then setup PR (PROJECT.md P1-P9, DECISIONS approval + scope line, spec Status rev 8 approved+merged).

## 2026-10-22 — merged 36 done
- PR #36 (spec v4.7 revision 8 + plan alignment) merged: 36b5592. Log on agent-logs: log/2026-10-22_PR36_spec-v4-7-rev8-phase1-plan-alignment.md (remote aae7c1b). No gate breach.
- Worktree docs-spec-rev8 and its local branch removed. Main fast-forwarded to 36b5592. Spec hash on main: 733cc0e9ce4af0771bdd2769720e3f228caf8855.
- NEXT (ask Charlie "Shall I do it?"): `setup` reconcile PR: agents/PROJECT.md hash 733cc0e9… + plan P1-P9; CLAUDE.md status; DECISIONS: record "I approve spec revision 8", fix revision 8 "Scope / affects" to "the spec and the merged Phase 1 plan"; spec Status line: revision 8 approved and merged. Then Bob `review spec` (exact hash) + `review <N>`.
- Still open: PR #34 (unreviewed), repo visibility question (I recommend A: keep private), ASK 4-9 at their tasks.

## 2026-10-23 — fix (Bob PR #34 Round 1, Revision required, 4 P1)
- Target: PR 34 (only unresolved newest round; PR 8 is closed). Review archived on agent-logs 5ef75eb (hash 095c5225).
- Worktree .agent/worktrees/chore-repo-moved, branch chore/repo-moved-to-mortarhaus. Local commits NOT pushed: 63cef10 (merge origin/main 36b5592, DECISIONS keeps all entries newest first), 5e9a629 (entry spacing). Uncommitted: none.
- P1 #1 (conflict) fixed locally. P1 #4 (UNI-11 row): handoff mirror scanned clean (secret pattern 0 hits, no private URLs/emails); PR body row not written yet.
- P1 #3 (audit): pnpm audit still exit 1 on this head and on main: next 16.4.0 has 2 critical + 1 high (patched 16.4.1). Needs a separate reviewed dependency PR. ASKED Charlie.
- P1 #2 (handoff mirror not in an authoritative source): builder.md §11 says the handoff is "only on this machine", so a PROJECT.md-only rule is a kit exception. ASKED Charlie: A = PROJECT.md rule + exception noted (DECISIONS "Exception to a rule?" -> yes), or B = master-kit change first.
- Next: on answers, push, update PR 34 body (UNI-11 row + new head), then Charlie runs `review 34`.

## 2026-10-23 — Charlie: "1a, 2a"
- 1a: PR #37 opened (branch chore/next-16-4-2, worktree .agent/worktrees/build-chore-next-16-4-2, head d44542c): next/@next/env/@next/eslint-plugin-next 16.3.8 -> 16.4.2 (16.4.2 over 16.4.1: same security fixes + Turbopack bug fixes; recorded in DECISIONS). Local: audit exit 0, typecheck, lint, 146 tests, build pass. E2E only in CI image job.
- 2a: PR 34 local commit c1ba65e: PROJECT.md §2 row + "Handoff copy (two Macs)" refresh/restore steps (accepted exception to builder §11); DECISIONS "Two Macs" scope + exception=yes.
- PR 34 commits 63cef10, 5e9a629, c1ba65e NOT pushed on purpose: the audit fails until #37 merges, and each push runs the ~26-min image job. Uncommitted: none.
- Next: Charlie runs `review 37` (Bob); `approved 37` BEFORE merge; merge; `merged 37`. Then I merge main into PR 34, push, write the PR 34 body (UNI-11 row: Charlie's authorization, destination agent-logs handoff/handoff.md, allowed data = in-flight state only, secret scan 0 hits; new head; Round 1 response), wait for green CI, then Charlie runs `review 34`.

## 2026-10-23 — fix (Bob PR #37 Round 1, Revision required, 1 P2 before merge)
- Review archived on agent-logs f757669 (hash e7552db7).
- P2 fixed in f64d010 (DECISIONS only: nanoid 3.3.20 edge disclosed, next-code-frame fix listed, advisory ranges incl. both GHSA-2464 lower bounds). Lockfile unchanged. Pushed; PR 37 body rebuilt with Round 1 response. CI re-running on f64d010.
- Bob asked that the re-review use Opus 5.5 (deep tier; security dependency gate).
- PR 34 still waits (local commits 63cef10, 5e9a629, c1ba65e not pushed). Uncommitted: none.
- Next: Charlie runs `review 37` (Bob, Opus 5.5) on f64d010; `approved 37` BEFORE merge; merge; `merged 37`; then PR 34 merge-main + push + body.

## 2026-10-23 — approved 37 done
- Bob PR #37 Round 2 Approved (Opus 5.5) at head f64d010 = PR head; CI green; PR open. Review archived (hash 38d72fec), receipt reviews/PR-37.receipt pushed on agent-logs (0e34822).
- Next: Charlie merges PR #37, then `merged 37`; then PR 34 (merge main, push, body). Uncommitted: none.

## 2026-10-23 — merged 37 done
- PR #37 merged f9d1454 (2026-10-23T13:27:15Z). Log log/2026-10-23_PR37_next-16-4-2-security-upgrade.md on agent-logs (8b56953). No gate breach. Worktree + local branch removed; main ff to f9d1454. Log gate clear.
- Next (ask Charlie first, a push starts the ~26 min image job): in .agent/worktrees/chore-repo-moved merge main (f9d1454) into PR 34 (local c1ba65e; conflict risk in DECISIONS.md), confirm audit exit 0, push, rewrite PR 34 body (Round 1 response + UNI-11 row: Charlie's authorization, destination agent-logs handoff/handoff.md, in-flight state only, secret scan 0 hits), wait for green CI, then Charlie runs `review 34`.
- Open: repo visibility (I pick A: keep private). Untracked on main, not mine: .playwright-mcp/, docker/sync-export.sh, docker/sync-import.sh. Uncommitted: none.

## 2026-10-23 — fix (Bob PR #34 Round 1, 4 P1) done
- Merged main f9d1454 into PR 34 branch; pushed head 00fc620 (mergeable). Audit exit 0. All 4 P1 fixed: conflict (63cef10, 5e9a629, 00fc620), handoff steps in PROJECT.md §2 (c1ba65e), audit via PR #37, UNI-11 row in PR body (rewritten with Round 1 response). CI running on 00fc620 (~26 min image job).
- Worktree .agent/worktrees/chore-repo-moved clean. Uncommitted: none.
- Next: when CI is green, Charlie runs `review 34` (Bob). Then `approved 34` BEFORE merge; merge; `merged 34`. Then `setup` reconcile PR (spec rev 8 hash 733cc0e9, P1-P9, DECISIONS approval) and Phase 1 PR 1.

## 2026-10-23 — approved 34 done
- Bob PR #34 Round 2 Approved with conditions (Opus 5.5) at head 00fc620 = PR head; CI green. Nothing required before merge. Deferred: P2 + P3 (see review) in the next PR that edits agents/PROJECT.md, no later than 2026-11-06. Review archived, receipt reviews/PR-34.receipt pushed on agent-logs.
- Next: Charlie merges PR #34, then `merged 34`; then `setup` reconcile PR (carry the deferred P2/P3 there).

## 2026-10-23 — merged 34 done
- PR #34 merged 9e965f1 (2026-10-23T15:23:40Z). Log log/2026-10-23_PR34_repo-move-and-two-mac-handoff-copy.md on agent-logs (f6902c5). No gate breach (receipt 35 s before merge). Worktree + local branch removed; main ff to 9e965f1. Log gate clear.
- Deferred (Bob R2, due 2026-11-06): P2 refresh must not overwrite a newer remote handoff copy (compare last-pushed hash, else ask); P3 restore cites builder §1 step 2. Do both in the next PR that edits agents/PROJECT.md (the setup reconcile PR) and in handoff/README.md on agent-logs.
- Next (ask Charlie): `setup` reconcile PR: PROJECT.md spec hash 733cc0e9 + plan P1-P9; CLAUDE.md status; DECISIONS revision 8 approval record + scope line fix; spec Status line rev 8 approved+merged; plus the P2/P3 above. Then Bob review spec + review N; Phase 1 PR 1.
- Open: repo visibility (I pick A: keep private). Untracked on main, not mine: .playwright-mcp/, docker/sync-export.sh, docker/sync-import.sh (decision rejected the scripts; Charlie decides). Uncommitted: none.

## 2026-10-23 — setup (Part B reconcile) done, PR #38
- Branch chore/setup-reconcile-v4-7-rev8, worktree .agent/worktrees/build-chore-setup-reconcile-v4-7-rev8, head cb20fc6, PR https://github.com/mortarhaus/CRM/pull/38. Done on Sonnet 5.5 (not deep tier), stated to Charlie. Spec unchanged (hash 733cc0e9 = §2); no review spec needed.
- Contents: P1, P2, P3, P5, P8, P9; CLAUDE.md Status; DECISIONS rev 8 approval + scope line; Bob PR #34 R2 P2/P3 (handoff.synced newer-copy check, restore section ref). P4, P6, P7 wait for Phase 1 PRs 5/6. Spec file still labels rev 8 draft (fix in first later spec PR; PROJECT.md §2 says so).
- handoff/README.md on agent-logs updated for the newer-copy check (not in PR 38).
- Next: CI green -> Charlie runs `review 38` (Bob); `approved 38` BEFORE merge; merge; `merged 38`; then `build` (Phase 1 PR 1, database roles; ask Charlie first).
- Open: repo visibility (I pick A: private); untracked on main, not mine: .playwright-mcp/, docker/sync-export.sh, docker/sync-import.sh. Uncommitted: none.

## 2026-10-24 — approved 38 done
- Bob PR #38 Round 1 Approved with conditions at head cb20fc6 = PR head; CI green. Nothing required before merge. Deferred, due 2026-11-06, next PR that edits agents/PROJECT.md (with handoff/README.md on agent-logs): P2 an owner answer "remote is newer" must adopt the remote copy (write .agent/handoff.synced and the file) so the next refresh does not overwrite it; P3 three spots still call revision 7 current / revision 8 pending (see review). Review archived, receipt PR-38.receipt pushed.
- Next: Charlie merges PR #38, then `merged 38`; then `build` (Phase 1 PR 1), ask first.

## 2026-10-24 — merged 38 done
- PR #38 merged 065d9a2 (2026-10-23T16:55:02Z). Log log/2026-10-23_PR38_setup-reconcile-v4-7-rev8.md on agent-logs (6305f0d). No gate breach (receipt 12 min before merge). Worktree + local branch removed; main ff to 065d9a2. Log gate clear. Spec gate (SPEC Round 27, 733cc0e9) and reconcile gate (PROJECT.md §2 = 733cc0e9 = spec on main) pass.
- Deferred, due 2026-11-06, next PR that edits agents/PROJECT.md (+ handoff/README.md on agent-logs): P2 owner answer "remote is newer" must copy the remote over .agent/handoff.md, then write .agent/handoff.synced, restart refresh from step 1; P3 CLAUDE.md line 6, PROJECT.md §11 "decided in revision 7", DECISIONS rev 8 Decision/Scope pending sentences. Interim: if a builder asks "which is newer?" and remote is newer, tell it to copy the remote into .agent/handoff.md first.
- Next (ask Charlie): `build` = Phase 1 PR 1 (database roles) per the Phase 1 plan; use Opus 5.5 (RLS/roles). Ask Charlie before starting.
- Open: repo visibility (I pick A: private); untracked on main, not mine: .playwright-mcp/, docker/sync-export.sh, docker/sync-import.sh. Uncommitted: none.

## 2026-10-24 — build started: Phase 1 PR 1 (feat/p1-db-roles)
- Gates: spec gate (SPEC Round 27, hash 733cc0e9) and reconcile gate (PROJECT.md §2 = 733cc0e9) pass; log gate clear (PRs 1-7, 9-38 all logged). Charlie typed `build` after I asked "Shall I start?".
- Branch feat/p1-db-roles, worktree .agent/worktrees/build-feat-p1-db-roles, base 065d9a2. Plan Tasks 1-3 (bootstrap five roles; connection per role; privilege baseline + manifest test). Running on Sonnet 5.5; code work handed to an Opus 5.5 helper (deep tier), I do git, checks, PR.
- No open ASK for PR 1. Uncommitted: none yet.

## 2026-10-24 — PR 1 code done by Opus helper; security fix pending
- Helper commit 7482990 on feat/p1-db-roles (Tasks 1-3; 27 files; typecheck, lint, 181 tests, build, audit, compose stack, 84 E2E vs image all pass per helper). Not pushed, no PR yet.
- Automated security review (UNI-09): bootstrap.ts sends plaintext `ALTER ROLE ... PASSWORD` which can reach the Postgres log. Asked helper to add SET LOCAL log_statement='none' + log_min_error_statement='panic' (and SCRAM verifier if it works), tests, DECISIONS line, amend to one commit. Waiting for its report.
- Deviations to tell Bob/Charlie: Invitation table granted; UPDATE grants per column; some proposed grants left out (fail closed until Task 24); ci.yml edited; env.ts restructured. ASK: accept the narrower measured grant set.
- After the fix: I re-verify myself (typecheck, lint, test, build, audit), fill "#<PR number>" in DECISIONS, push, open PR 1, Charlie runs `review <N>`.
- Uncommitted: none (worktree .agent/worktrees/build-feat-p1-db-roles).

## 2026-10-24 — Phase 1 PR 1 opened: PR #39
- https://github.com/mortarhaus/CRM/pull/39 · branch feat/p1-db-roles · worktree .agent/worktrees/build-feat-p1-db-roles · head ebcc651 (1 commit on main 065d9a2, 27 files). Helper fix for UNI-09 included (SCRAM verifier + SET LOCAL log guards, 5 tests). I reran typecheck, lint, test (187), build, audit: all exit 0. E2E (84) ran only on the earlier commit 7482990; CI image job runs it on ebcc651.
- ASK for Bob/Charlie: accept the measured crm_app grant set (narrower than the plan; invitation granted; per-column UPDATE).
- Next: wait for CI green; Charlie runs `review 39` (Bob, Opus 5.5); `fix` if needed; `approved 39` BEFORE merge; merge; `merged 39`; then PR 2 (feat/p1-rls, Tasks 4-7).
- Uncommitted: none. Helper agent a35d5be9c4e14d085 finished.

## 2026-10-24 fix PR #39 (Bob Round 1)
- Archived `reviews/PR-39.md` on agent-logs (hash 32c0c7c verified).
- Pushed 2dfb4ee (docs only): invitation cancel/reject removed from fail-closed lists, admin = superuser, stale Phase 0 runbook note.
- PR body: UNI-01/02/03/05 rows, size line, Round 1 response table. UNI-02: kept 16 floor beside AUTH_SECRET, justified.
- Next: wait CI green on 2dfb4ee (image job ~26 min), Charlie runs `review 39` (Bob, Opus 5.5). Then `approved 39` before merge, `merged 39`. P2 invitation grants -> Task 24; audit dep PR (zod/undici) separate.

## 2026-10-24 dependency PR #40 (owner chose "A")
- PR #39 CI Dependency audit failed: zod <4.6.6 and undici 8.0.0-8.12.1 (high), also on main.
- Opened PR #40 `chore/deps-zod-undici` (worktree `.agent/worktrees/chore-deps-zod-undici`): zod 4.6.7 + override, undici 8.12.3 override, DECISIONS entry. Local: audit 0, typecheck, lint, 146 tests, build all 0.
- Next: CI green on #40, Charlie `review 40`, `approved 40`, merge, `merged 40`. Then merge new main into feat/p1-db-roles (PR #39), push, Charlie `review 39`.

## 2026-10-24 PR #40 image job failed once (flake)
- E2E: 1 of 84 failed (tablet-768 accessibility.spec.ts:77, axe `document-title` on html in "/workspaces switch refused (light)"); same test passed on chromium, mobile-320, and on PR #39 head. zod change unrelated. Reran failed job (run 40084966255). If it fails again in the same place, treat as a real flake bug: report to Charlie (own fix PR, not in #40).
- PR #39 CI: only Dependency audit red (fixed by #40); image job green on 2dfb4ee.

## 2026-10-24 merged 40; PR #39 updated
- Owner merged PR #40 (39918cd) without `review 40`/`approved 40`. Log written on agent-logs with GATE BREACH (no reviewer verdict, no receipt); told owner.
- Merged origin/main into feat/p1-db-roles (conflict only in DECISIONS.md, kept both entries), pushed. Local: audit 0, typecheck, lint, 187 tests, build all 0. PR body updated.
- Next: CI green on new #39 head (image job ~26 min), Charlie `review 39` (Bob, Opus 5.5), then `approved 39` BEFORE merge, `merged 39`. Then PR 2 (feat/p1-rls, Tasks 4-7). Flaky test accessibility.spec.ts:77 tablet-768 noted.

## 2026-10-25 approved 39
- Bob Round 2: Approved with conditions on head 8285bee (= PR head, PR open). Review archived (hash dafa5fc), receipt PR-39.receipt on agent-logs. Fixed two stale PR-body lines first (body only, head unchanged).
- Deferred: invitation grants -> Phase 1 PR 7 (Task 24); one extra blank line in DECISIONS.md -> next PR editing it; P2 items from PR #38 still due 2026-11-06.
- Next: Charlie merges #39, then `merged 39`. Then PR 2 (feat/p1-rls, Tasks 4-7): ask Charlie first.

## 2026-10-25 merged 39
- PR #39 merged (d64a899, 2026-10-25T03:29:02Z). Receipt 23 s before merge, head matched: no breach. Log on agent-logs: `log/2026-10-25_PR39_five-db-roles-privilege-manifest.md`. Log gate clear.
- Next: ask Charlie before starting Phase 1 PR 2 (`feat/p1-rls`, Tasks 4-7, Opus tier). Old worktrees (build-feat-p1-db-roles, chore-deps-zod-undici) can be removed on his OK. Pending: CLAUDE.md Status line ("Next: Phase 1 PR 1") is stale; update in the next PR that edits it.

## 2026-10-25 build Phase 1 PR 2 started (Charlie: "A")
- Cleaned up merged worktrees/branches for #39 and #40 (tips on main, clean, pushed; no --force).
- New worktree `.agent/worktrees/build-feat-p1-rls`, branch `feat/p1-rls` from origin/main d64a899, upstream unset (push only with `git push -u origin feat/p1-rls`). `.env` copied, `pnpm install` done.
- Plan Tasks 4-7 (RLS, `withWorkspace()`, `workspace_settings`, hook). Deep tier: Opus 5.5 helper writes code and commits locally (trailer Claude Opus 5.5), no push. I verify, push, open PR.
- Gates: spec hash 733cc0e9 reviewed + reconciled; log gate clear (PR 39 log on agent-logs).

## 2026-10-25 PR #41 opened (Phase 1 PR 2, feat/p1-rls, head 9128033)
- Opus helper built Tasks 4-7 (5 local commits); I reran typecheck, lint, 228 tests, build, audit: all 0. Pushed, opened PR #41 with self-check, size note, unverified list.
- Helper note: repo-root `.env` still has Phase 0 `crm` user URLs (role gone); dev Postgres `crm-dev-postgres-1` at migration 0001. Tell Charlie to refresh `.env` from `.env.example` (his local file; I did not edit it).
- Next: CI green (image job ~26 min), Charlie `review 41` (Bob Opus 5.5), `approved 41` before merge, `merged 41`. Then PR 3 (feat/p1-system-module, Tasks 8-11), ask Charlie first (new module).

## 2026-10-25 approved 41
- Bob Round 1: Approved with conditions on head 9128033 (= PR head, open, CI green). Review archived and receipt `reviews/PR-41.receipt` written on agent-logs.
- Deferred: P2 TEN-09 lint gaps (connection-level forms) -> Phase 1 PR 3 (Task 8); P3 extra blank lines -> next edit of those files.
- Next: Charlie merges #41, then `merged 41`. PR 3 (feat/p1-system-module, Tasks 8-11): ask Charlie first; must fix the TEN-09 lint P2 in Task 8.

## 2026-10-25 merged 41
- PR #41 merged (5e82a4c, 07:13:48Z). Receipt 07:10:47Z, head matched: no breach. Log `log/2026-10-25_PR41_workspace-settings-rls-withworkspace.md` on agent-logs. Log gate clear.
- Cleaned up branch and worktree `feat/p1-rls` (tip on main, clean, pushed).
- Next: ask Charlie before PR 3 (`feat/p1-system-module`, Tasks 8-11, Opus helper). Task 8 must fix the TEN-09 lint P2 (quoted `set_config`, `app.` connection keys, `-c app.` options, 3 fixtures). P3 blank lines in rls/isolation/workspace tests: next touch. Stale CLAUDE.md Status ("Next: Phase 1 PR 1") and PR #38 P2/P3 items due 2026-11-06 in next PR editing PROJECT.md/CLAUDE.md.

## 2026-10-25 PR #42 opened; PR 3 build started (Charlie: "B then A")
- B: PR #42 `chore/docs-status-deferred` (head 75cc03d): PROJECT.md remote-newer restore fix (PR #38 P2), revision-8 wording (P3), CLAUDE.md Status, blank lines (PR #39/#41 P3), DECISIONS entry. README on agent-logs updated in a separate commit. CI pending. Local: lint, typecheck, 228 tests, build 0. Note: one `apps/web/src/db` run right after lint showed 58 passed / 11 skipped; 7 reruns clean (same unexplained skip as in PR #41 build). Worktree `.agent/worktrees/build-chore-docs-status-deferred`.
- A: worktree `.agent/worktrees/build-feat-p1-system-module`, branch `feat/p1-system-module` from origin/main 5e82a4c (upstream unset). Tasks 8-11 (system module lint, billing_account, authz tests, composite-FK + poly-ref). Opus helper writes code, commits locally, no push. Must also fix PR #41 P2 (TEN-09 lint gaps) in Task 8. ASK 5 (billing_account.status): build with builder proposal (only `active`), flag in PR body for Charlie.
- Next: helper hand-back, verify, push, open PR; Charlie `review 42` and `review <PR3>`.

## 2026-10-25 PR #43 opened (Phase 1 PR 3, feat/p1-system-module, head c44f17d)
- Helper built Tasks 8-11 (6 local commits); I reran typecheck, lint, 321 tests, build, audit: all 0. Pushed, opened PR #43 with self-check, size note, ASK 5, observations for Bob.
- Open for Charlie: ASK 5 (billing_account.status: only `active` built; name = user's name). PR #42 and #43 both edit docs/DECISIONS.md top: expect a merge conflict in the second to merge; resolve by keeping both entries (newest first).
- Next: CI green on #42 and #43; Charlie `review 42`, `review 43`; `approved N` before merge; `merged N`. Then PR 4 (feat/p1-action-audit, Tasks 12-15 then 31): ask Charlie first; ASK 4 (idempotency expiry, proposal 24 h) blocks Task 14 Step 4.

## 2026-10-25 approved 42
- Bob Round 1: Approved (no conditions) on head 75cc03d = PR head, open, CI green. Review archived + receipt `reviews/PR-42.receipt`.
- Next: Charlie merges #42, `merged 42`. Then PR #43 will conflict in DECISIONS.md top (keep both entries). #43 awaits CI and `review 43`; ASK 5 pending with Charlie.

## 2026-10-25 merged 42; PR #43 updated
- PR #42 merged (e4fd100, 08:46:39Z), receipt 3 min before, no breach. Log `log/2026-10-25_PR42_close-deferred-handoff-and-wording.md`. Branch/worktree chore/docs-status-deferred removed.
- Merged origin/main into feat/p1-system-module (conflict only in DECISIONS.md top, kept both), pushed head new. Local: typecheck, lint, 321 tests, build, audit 0. PR #43 body updated. CI restarted.
- Next: CI green on #43, Charlie `review 43` (Bob Opus 5.5), `approved 43` BEFORE merge, `merged 43`. ASK 5 answer pending from Charlie (A = only `active`). Then PR 4 (feat/p1-action-audit): ask Charlie first; ASK 4 blocks Task 14 Step 4.

## 2026-10-25 approved 43
- Bob Round 1: Approved with conditions on head bfcef5a = PR head, open, CI green. Added the "Settled item 3" line to the PR body (body only). Review archived + receipt `reviews/PR-43.receipt`.
- Deferred: P2 TEN-10 lint gaps (`.js`/trailing-slash import forms, `postgres`/`pg` client outside src/db with worker.ts exemption until PR 5, 4 fixtures) -> Phase 1 PR 4 Task 15 (next PR editing eslint.config.mjs); P3 runbook manifest paragraph order -> next PR touching the runbook. ASK 5 still open with Charlie.
- Next: Charlie merges #43, then `merged 43`. Then ask before PR 4 (feat/p1-action-audit, Tasks 12-15 then 31; Task 31 Step 0 spike reviewed by Bob first; ASK 4 idempotency expiry blocks Task 14 Step 4).

## 2026-10-25 merged 43
- PR #43 merged (c0bc2cc, 12:24:50Z); receipt 2 min before, head matched: no breach. Log `log/2026-10-25_PR43_system-module-billing-account-poly-ref.md`. Branch/worktree feat/p1-system-module removed. Log gate clear.
- Deferred: P2 TEN-10 lint gaps -> PR 4 Task 15; P3 runbook paragraph order -> next PR touching runbook. ASK 5 open with Charlie (built: only `active`).
- Next: ask Charlie before PR 4 (`feat/p1-action-audit`): Task 31 Step 0 spike first (Bob reviews), ASK 4 idempotency expiry (proposal 24 h) blocks Task 14 Step 4.

## 2026-10-25 build Phase 1 PR 4 started (Charlie: "build"; ASK 4 default 24 h proposal, ASK 5 still open)
- Worktree `.agent/worktrees/build-feat-p1-action-audit`, branch `feat/p1-action-audit` from origin/main c0bc2cc (upstream unset; push with `git push -u origin feat/p1-action-audit`). `.env` copied, install done.
- Scope NOW: only Task 31 Step 0 (design spike, plan lines ~714-1217, 31.C) by an Opus helper: build `auth_audit_log` + mechanism, tests T1-T15, evidence for the PR body. Then push, open PR 4 as DRAFT, Charlie runs `review <n>` (Bob reviews the spike). Tasks 12-15 and 31 Steps 1-4 start only after Bob's spike round says Approved / Approved with conditions. Stop rule: if an R cannot be met without weakening it, stop and bring a spec revision proposal to Charlie.
- Carried into Task 15: PR #43 P2 (TEN-10 lint gaps: `.js`/trailing slash, `postgres`/`pg` ban with worker.ts exemption, 4 fixtures). P3 runbook paragraph order: next PR touching the runbook.

## 2026-10-25 21:59 build Phase 1 PR 4 spike pushed (DRAFT PR #44)
- Branch feat/p1-action-audit, head b935a47, worktree .agent/worktrees/build-feat-p1-action-audit. Draft PR #44 (https://github.com/mortarhaus/CRM/pull/44).
- Scope so far: Task 31 Step 0 only (auth_audit_log design spike by Opus helper). Builder reran typecheck, lint, test (24 files, 425 tests), build, audit: all exit 0. e2e (84 passed) reported by helper on 1bed3c5, not rerun.
- Next: Charlie runs "review 44" (Bob). Tasks 12-15 and 31 Steps 1-4 start only after Approved / Approved with conditions.
- Open: ASK 4 (Task 14), ASK 5, postgres.js uncaught TypeError on killed backend (decision needed), .env refresh, repo visibility, untracked docker/sync-*.sh and .playwright-mcp/.
- Carried P3s: runbook manifest paragraph order; CLAUDE.md Status "Next" line; flaky E2E accessibility.spec.ts:77.

## 2026-10-26 00:42 build Phase 1 PR 4: Bob Round 1 = Approved with conditions (spike)
- Bob's review: .agent/reviews/PR-44.md Round 1. Tasks 12-15 may start. Conditions before PR 4 final review: P2-1 (bound auth-transaction pool/lock use, bypass guard, Task 22 note), P2-2 (next start crash check for postgres.js; pnpm patch if it exits), P2-4 (Facts relied on in PR body + DECISIONS). P2-3 (revoke session by id) goes to Task 24. Also: DECISIONS must say how a Phase 0 'flag on, unverified' user recovers (R11 terms).
- Next: Opus helper builds Tasks 12-15 (+ PR #43 TEN-10 lint P2 in Task 15) in worktree build-feat-p1-action-audit; then conditions + Task 31 Steps 1-4. ASK 4: builder uses 24 h unless Charlie answers.

## 2026-10-26 02:02 build Phase 1 PR 4 ready for final review (PR #44)
- Head b782501 pushed, PR #44 retitled, body rewritten (facts, upgrade notice, self-check), marked ready. Tasks 12-15 + Bob conditions P2-1, P2-2 (postgres.js patch), P2-4 + Task 31 Steps 1-4 done. Builder reran install/typecheck/lint/test (569)/build/audit: all 0. e2e 84 reported by helper. CI pending.
- Next: Charlie runs "review 44" (final round). Task 24 must name revoke-session-by-id (P2-3); Task 22 note added to plan. ASK 4 = 24 h builder default.
- Open: ASK 4, ASK 5, .env refresh, repo visibility, untracked docker/sync-*.sh, .playwright-mcp/. Carried: CLAUDE.md Status "Next" line (now PR 5 after merge).

## 2026-10-26 15:08 ASK 4 answered by Charlie: 24 hours
- Docs/code comment updated and pushed (head e3afafd, docs-only commit, limits test passes, lint and typecheck 0). PR #44 body updated. CI re-runs on the new head. Charlie still runs "review 44"; Bob must re-check head e3afafd.

## 2026-10-26 15:41 fix 44 done (Round 3 findings)
- Review PR-44.md (3 rounds) archived to agent-logs first. Fixed: P1-1/P1-2 (self-check table, all rules, packs line, in PR body), P2-1 (ASK 4 answered), P2-2 (sign-in email advisory lock, AUTH-05, commit e0b63bd), P3-1 (canonical, f29ba42). Head 1f5939e pushed; PR body updated incl. replay-per-workspace note.
- Builder reran install/typecheck/lint/test (573)/build/audit: all 0. CI pending on new head. E2E not rerun after e3afafd (helper e2e was at b782501).
- Next: Charlie runs "review 44" (Round 4) once CI is green.

## 2026-10-26 22:53 approved 44
- Round 4 Approved with conditions at head 1f5939e; CI 4/4 green. Review archived (hash 19f27e13762b3165ebcb96df0c6afaa84ae81a2f) and receipt written on agent-logs. Condition: P2-3 (revoke session by id) in Task 24 / PR 7. Next: Charlie merges, then "merged 44".

## 2026-10-26 22:54 merged 44
- PR #44 merged 2026-10-26 (130fd4d). Log on agent-logs (log/2026-10-26_PR44_...). Receipt before merge, no gate breaches. Worktree and branch feat/p1-action-audit removed without --force.
- Next: Phase 1 PR 5 (pg-boss, Tasks 16-18) via "build" (ask Charlie first). Open: ASK 5, .env refresh, repo visibility, untracked docker/sync-*.sh and .playwright-mcp/. Carried: CLAUDE.md Status line, PR 44 P3-2 pointers, Task 24 revoke-by-id.
