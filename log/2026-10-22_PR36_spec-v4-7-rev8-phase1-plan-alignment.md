# PR 36 — docs(spec): v4.7 revision 8 (draft) — Phase 1 plan alignment (E1-E12)

- **Merged:** 2026-10-22T11:50:28Z · **Merge commit:** 36b5592d044acf1f767c4cc0ec4bc285525c0863 · **Branch:** docs/spec-v4.7-rev8-phase1-plan-alignment
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-36.receipt` on `agent-logs` (written 2026-10-22T11:45:06Z, about 5 minutes before the merge; reviewed head `5748d9b1aad7a1a5bfb65fcf3290aef3073c1ec5`; review file hash `b5af8b9670bf557a318e41521210c709b18454f2`, equal to the local review file; log-branch commit holding the review `dfcf4f6`).
- **Merge evidence:** `gh pr view 36 --repo mortarhaus/CRM` state MERGED, mergedAt 2026-10-22T11:50:28Z, merge commit above; `git merge-base --is-ancestor` shows it reachable from the fetched `origin/main`. Final head `5748d9b` equals the head in the PR review Round 1. The spec blob on `origin/main` hashes to `733cc0e9ce4af0771bdd2769720e3f228caf8855`, the hash Bob approved in spec Round 27. All four CI jobs passed on that head.
- **Drafted by:** Opus 5.5 sub-agents, builder Sonnet 5.5 (checks, PR) · **Final verdict:** Approved (PR Round 1); spec hash approved in spec Round 27
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 revision 8, `733cc0e9…`) · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (aligned) · **Milestone:** Phase 1 gates

## What changed
Spec revision 8 applies E1 to E12 from the Phase 1 plan: per-table polymorphic tests move to the phases that create each table; Open question 8 resolved (`crm_purge` own login); `job_now()` grant and the Better Auth `no-trusted-ip` limiter fallback corrected; revision 7 marked approved and merged; `DATABASE_WORKER_URL`; and the Phase 1 auth-audit and 2FA requirements (new no-RLS append-only `auth_audit_log` table with a row allow-list; no session without its audit row; enabling, disabling and regenerating recovery codes end every pre-change session and give the changer a fresh audited session; regeneration serialised against a recovery-code sign-in; recovery-code sign-in is a login; no password-only session after a completed enable; trusted-device cookies cannot skip the challenge; no enrolment lockout; Phase 0 sessions ended in the cutover migration). The PDPA check before Phase 4 now names `auth_audit_log`. The merged plan (Task 31 and rows) is aligned, and `docs/DECISIONS.md` has the entries. The file still says revision 8 is a draft.

## Why
The merged plan (PR #33) said these spec edits come in a separate spec PR so the done-when, the auth-audit requirements and Open question 8 match what Phase 1 builds.

## Review rounds
- Spec R25: [P1] regeneration kept the changer's old session (AUTH-07); [P1] TEN-09 and AUTH-06 missing from the self-check; [P2] open point A reopened scope choice B; [P2] stale Open question 8 summary; [P2] no pre-live retention gate for `auth_audit_log`; [P3] reviewer-directed wording → one every-pre-change-session policy, rows added, mechanism left to the PR 4 spike, own-login text, retention in the Phase 4 check, plain gate wording.
- Spec R26: [P1] regeneration can race an old recovery-code sign-in; [P1] UNI-15 and UNI-16 rows missing; [P2] plan still called F/G proposals; [P2] R13 "no personal data" vs the stored user_id and ip; [P2] stale PR body → serialisation outcome and T5 (c4), rows added, F/G marked decided, exact row allow-list, PR body rewritten.
- Spec R27: Approved (hash `733cc0e9…`); two P3s → T15 dead clause removed, decisions-log wording fixed.
- PR R1: Approved on `5748d9b`; one P3 (the revision 8 decisions entry says "the spec only").

## Deferred conditions
- [P3] `docs/DECISIONS.md` revision 8 entry, Scope / affects: change "the spec only" to "the spec and the merged Phase 1 plan (Task 31 and the rows that cite it)" → in the `setup` reconcile PR.
- Spec Status line still reads draft → the `setup` PR (or the next spec PR) marks revision 8 approved and merged, citing spec Round 27, PR Round 1 and this merge.
- Charlie's approval of revision 8 ("I approve spec revision 8", 2026-10-22) is recorded in the PR #36 body only; the `setup` PR records it in `docs/DECISIONS.md`.

## Decisions worth keeping
- Owner decisions (all quoted in the spec and `docs/DECISIONS.md`): ASK 1 and ASK 2 "follow bob's suggestions"; ASK 3 "B"; scope choice "B" (the mechanism is a PR 4 design spike); F and G "F A, G A" (a recovery-code sign-in ends no other session; Phase 0 sessions are ended at cutover, no audit row invented); approval "I approve spec revision 8".
- Bob ruled (spec Round 27): UNI-15 is conforming (the cutover removes no table, column, type, constraint or grant); UNI-16 conforming at plan level; open point B complete at spec level.
- Residual for the PR 4 spike: confirm Better Auth 1.7.6's compare-and-set on recovery-code consumption, or add a pause in that window to T5 (c4). All of R1 to R15 and T1 to T15 are unproved until PR 4.
- The auth-audit retention period is an ASK for the professional before Phase 4 goes live.

## Follow-ups
- `setup` reconcile PR: `agents/PROJECT.md` (hash `733cc0e9…`, plan P1 to P9) and `CLAUDE.md`, plus the DECISIONS approval record, the P3 above and the spec Status line; with `review <N>` of its final head before `approved <N>`.
- Then Phase 1 PR 1 (database roles) per the plan; ASK 4 to 9 are asked at the task that needs each.
- PR #34 (repo move + two-Mac decision) is still open and unreviewed.

## Appendix — final review rounds

## Round 1 — 2026-10-22 · scope: slice (docs only: spec v4.7 revision 8, Phase 1 plan alignment, decisions log)
- **Code review:** base (merge base) `999b9c4397fd76aaaa97297e8e0a71975f2ad735` (= `origin/main`) · head `5748d9b1aad7a1a5bfb65fcf3290aef3073c1ec5` · head re-checked at end: yes, unchanged
- **Spec review:** spec path `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash (`git hash-object`) `733cc0e9ce4af0771bdd2769720e3f228caf8855` — the exact hash approved in `SPEC-core-sales-design.md` Round 27. The only commit after that round (`5748d9b`) changes the plan and `docs/DECISIONS.md`, not the spec.

**Verdict:** Approved
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No — `approved 36`, `merged 36` and `setup` are builder procedures.

This verdict applies only to head `5748d9b`. It is not Charlie's approval of revision 8. Approved is not a merge instruction: Charlie merges.

### Findings

No blocking findings.

#### [P3] Decisions entry says revision 8 affects "the spec only"
- Evidence: `docs/DECISIONS.md`, entry "2026-10-22 — Spec v4.7 revision 8 (draft)", **Scope / affects:** "the spec only (…)". The same PR also changes the merged Phase 1 plan (Task 31 R5, R13, R15, T5 (c4), T13, T15, open points, Risks 18–19, self-check rows), and the entry's own "Round 26 corrections" bullet cites those plan items.
- Required correction: change it to "the spec and the merged Phase 1 plan (Task 31 and the rows that cite it)". Fix it in the `setup` reconcile PR or the next docs PR, so this head does not move. Owner: builder. Status: open.

### Self-check audit
Independent applicable list made before reading the PR table (same list as spec Round 27, plus the PR-only hygiene rules).

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07/09/10/13 | Yes: logging/PII, append-only audit, decisions recorded | Pass at spec level | Agree; R13/T13 allow-list matches spec and plan | spec `:515`, `:862`; plan R13 `:745`, T13 `:767` | none |
| UNI-12 | Yes: files inside the repo | Pass | Agree: three docs files | `git diff --stat` | none |
| UNI-15 | Yes: R15 cutover deletes `session` rows | Conforms, for Bob to rule | Conforming (ruled in spec Round 27); no owner exception needed | plan `:747`, `:1606` | none |
| UNI-16 | Yes: auth/deployment change | Deliverables named, implementation pending (PR 4) | Agree | plan `:789`, `:798` | none |
| TEN-02/03/06/07/08/09/10 | Yes: roles, append-only grants, `crm_purge` own login, per-table tests | Pass at spec level, tests pending | Agree; no runtime pass claimed | spec Rounds 25–27 | none |
| AUTH-06/07/12 | Yes: limiter fallback, 2FA session revocation, session list | Pass at spec level, implementation pending | Agree; R5 race and T5 (c4) present | plan R5 `:737`, T5 `:759` | none |
| `PROJECT.md` §9 own-login `crm_purge`; no-RLS system tables | Yes | Pass at spec level | Agree; `auth_audit_log` on the no-RLS list | spec item 9 / Tenancy | none |
| Secret scan (`PROJECT.md` §7) | Yes | CI pass | Agree: two pattern hits in added lines are prose ("session token"), no value | command below | none |

### Verification performed
| Command / check | Result |
|---|---|
| Pin | `gh pr view 36` head `5748d9b1…`, base `main`; local merge base = `origin/main` = `999b9c4…`. Detached checkout `.agent/worktrees/review-36-5748d9b1`; host head re-read at the end, unchanged. (One earlier `gh` call timed out on the network; the retry worked.) |
| `git diff --stat origin/main...5748d9b` | 3 files: `docs/DECISIONS.md` +12, plan +42/−41, spec +53/−25; total +107/−66. |
| `git diff --check origin/main...5748d9b` | Clean. |
| Spec blob at head | `733cc0e9…` = Round 27's approved hash. |
| Delta since Round 27 (`4714f04..5748d9b`) | 2 files, +2/−2: T15 now asserts only "no `session` row remains"; `DECISIONS.md` sentence now reads "These are owner decisions; changing them needs a new owner decision." Both Round 27 P3s resolved. |
| Plan diff main→head | Read in full. Every change aligns the plan with the reviewed spec: AUTH-07 every-pre-change-session revocation with an audited replacement, R5 race, R13 allow-list, R15 cutover decided, open-point gates, Phase 4 retention gate. Nothing found outside revision 8's scope. |
| Secret-scan pattern on added lines | 2 matches, both prose words; no secret value, key, private key or URL with credentials. |
| CI on this head | Dependency audit, Secret scan, Typecheck/lint/test: pass. Image/Trivy/E2E: **pending** when checked. |
| Local tests | Not run: docs-only PR. |

### Residual risks and test gaps
- Image/Trivy/E2E was still pending. This PR changes docs only, so it cannot change the image, but merge only after that job is green.
- All of Task 31's runtime behaviour (R1–R15, T1–T15) is unproved until PR 4. The PR 4 spike must confirm Better Auth 1.7.6's compare-and-set on recovery-code consumption, or T5 (c4) adds a pause in that window (spec Round 27 residual).
- Charlie's approval of revision 8 is not yet recorded. To keep this head: record it in the PR body (no commit), and in `docs/DECISIONS.md` plus the spec Status line in the `setup` reconcile PR or the next spec PR. A commit to this branch moves the head and needs a new round.

### Required before merge
- None from this review. Process gates: Charlie approves revision 8; Image/Trivy/E2E green; `approved 36` before the merge.

### Deferred conditions
- None (only a P3, above).

### Optional improvements
- None.

## Round 27 — 2026-10-22 · scope: v4.7 revision 8, Round 26 fixes (PR #36)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash (`git hash-object`) `733cc0e9ce4af0771bdd2769720e3f228caf8855`.
- **Pin:** PR #36 base and merge base `999b9c4397fd76aaaa97297e8e0a71975f2ad735`, head `4714f04ef55316d864707a9cc621065febf7654c` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-36-4714f04e` (`git worktree add --detach` worked this time); its spec blob hash matches. Round 26 reviewed hash `846b772e493464672f103c99bf8a4c39a9627085`. Fix diff `40f2777..4714f04`: three docs files, +33/−31. Main→head: three files, +106/−65 (matches the PR body's Size).

**Verdict:** Approved  
**Model used:** Opus 5.5 (deep tier, as Rounds 25–26 asked) · **Switch model next step?** No — `review 36` of the final head should also run on Opus 5.5.

This verdict applies only to spec hash `733cc0e9…`. It is not Charlie's approval of revision 8 and does not approve PR #36's final head; `review 36` does that.

#
