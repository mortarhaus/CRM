# PR 39 — feat(db): five database roles, connect as crm_app and crm_migrator, privilege manifest (Phase 1 PR 1)

- **Merged:** 2026-10-25 (03:29 UTC) · **Merge commit:** d64a89937289bae604d08d06fd72747e45c2a1a9 · **Branch:** feat/p1-db-roles
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-39.receipt` on agent-logs, log-branch commit cac220626d1a14e3b25ed7b1dac2552d7f0f6233 (written 03:28:39 UTC, 23 seconds before the merge); head 8285bee37ff5bd22357c18a6675bc0db2c333a67 = final head; review-file hash dafa5fc570c1d0cc6b48b3d390e15d2831906295
- **Merge evidence:** `gh pr view 39` reports MERGED, merge commit d64a899, merged 2026-10-25T03:29:02Z, head 8285bee; `git merge-base --is-ancestor d64a899 origin/main` succeeds.
- **Drafted by:** Opus 5.5 helper (code, deep tier) with Sonnet 5.5 (builder: git, checks, PR) · **Final verdict:** Approved with conditions (round 2, Bob on Opus 5.5)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 8 · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (Tasks 1-3) · **Milestone:** Phase 1 PR 1

## What changed
`bootstrapRoles()` creates or repairs the five roles (`crm_migrator`, `crm_app`, `crm_worker`, `crm_purge`, `crm_link_resolver`; none superuser, BYPASSRLS, CREATEROLE, CREATEDB or REPLICATION) through `pnpm db:bootstrap`, the image command `bootstrap` and a one-shot compose service. The app connects as `crm_app`, migrations as `crm_migrator`, the worker as `crm_worker`. Migration `0001_privileges_baseline.sql` revokes PUBLIC defaults and grants `crm_app` the measured Better Auth privileges; a privilege manifest test covers all roles and PUBLIC.

## Why
TEN-01 and TEN-02: runtime and migrations on separate least-privilege roles before any Phase 1 data. Roles are cluster objects, so a migration cannot create them.

## Review rounds
- R1 (Revision required, head ebcc651): [P1] UNI-01/02/03/05 missing from the self-check → rows added to the PR body (UNI-02: kept the 16-character role-password floor beside the AUTH_SECRET floor, with the reason); [P3] wrong claims in docs (invitation cancel/reject, admin must be a superuser, stale Phase 0 migration note) → fixed in 2dfb4ee; PR size explained.
- R1 [P2] audit failing on main (zod, undici) → PR #40, merged first, then `main` merged into the branch (8285bee).
- R2 (Approved with conditions, head 8285bee): all Round 1 findings resolved except the deferred invitation P2; one open P3 about stale PR-body lines, fixed in the body at `approved 39`.

## Deferred conditions
- P2 `invitation` grants (granted SELECT, INSERT, UPDATE expires_at/status): Phase 1 PR 7 (plan Task 24) must revoke them or give a reason.
- P3: one extra blank line in `docs/DECISIONS.md` before the 2026-10-23 entry: remove in the next PR that edits that file.

## Decisions worth keeping
- Measured `crm_app` grants are narrower than the plan's proposal (column-level UPDATE, no UPDATE on account/verification/member); Bob accepted them. Recorded in `docs/DECISIONS.md` (2026-10-24).
- UNI-09: bootstrap sends client-computed SCRAM-SHA-256 verifiers and sets log guards locally; passwords must be printable ASCII; a superuser admin is required. Differs from plan Task 1 Step 3.
- The 2026-10-03 "Phase 0 uses one dev DB user" entry is marked Expired.

## Follow-ups
- Next: Phase 1 PR 2 (`feat/p1-rls`, Tasks 4-7); ask the owner first.
- Flaky E2E test `accessibility.spec.ts:77` (tablet-768, axe `document-title`): fix in its own PR if it fails again.
- Still due 2026-11-06 in the next PR that edits `agents/PROJECT.md`: the PR #38 P2/P3 items (handoff restore wording, `CLAUDE.md` line 6, PROJECT.md §11 wording, DECISIONS rev 8 pending sentences).
- Open owner items: repo visibility (private recommended); fate of untracked `docker/sync-*.sh`.

## Appendix — final review round
## Round 2 — 2026-10-25 · scope: slice (re-review of the Round 1 fix and the update onto `main`)
- **Code review:** base (merge base) `39918cd7af98045fb336bf8431c60152770125e2` (= `origin/main`, PR #40 merge) · head `8285bee37ff5bd22357c18a6675bc0db2c333a67` · head re-checked at end: yes (still `8285bee`, OPEN, MERGEABLE)
- **Spec reference:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash `733cc0e9ce4af0771bdd2769720e3f228caf8855` (not changed by this PR).
- **Checkout mode:** detached worktree `.agent/worktrees/review-39-8285bee3` at the exact head; my build output (`node_modules`, `apps/web/node_modules`, `packages/core/node_modules`, `.next`, `dist`, `next-env.d.ts`, `tsconfig.tsbuildinfo`) deleted; no tracked file changed; removed without `--force`.

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No — `approved 39` / `merged 39` are builder procedures.

### What changed since Round 1 (`ebcc651`)
- `2dfb4ee` (docs only, 3 files, +4 −5): the P3 doc fixes.
- `8285bee`: merge of `origin/main` (`39918cd`, PR #40: zod 4.6.7, undici 8.12.3). Conflict in `docs/DECISIONS.md`, resolved by keeping both entries.
- Effective diff check: the three-dot diff `39918cd...8285bee` equals the Round 1 diff plus `2dfb4ee`. The only other difference is one extra blank line in `docs/DECISIONS.md` between the PR #40 entry and the 2026-10-23 entry, left by the merge. No code, test, migration or config line changed since Round 1. 27 files, +1,813 −72.
- The PR body is updated: a "Review Round 1 response" table, the four missing self-check rows, the size explanation and the new head.

### Round 1 findings
| Round 1 finding | Status now | Evidence |
|---|---|---|
| [P1] UNI-01, UNI-02, UNI-03, UNI-05 missing from the self-check | **resolved** | All four rows are in the PR body. UNI-01: `env.test.ts:129-157` covers missing, short, non-ASCII and non-Postgres values, and none echoes the value. UNI-02: the 16 is kept beside the `AUTH_SECRET` 32 floor with a reason (operator secret, not user input). `agents/PROJECT.md:254` puts the spec security values and user-facing limits in `limits.ts` and does not list operator secrets, so I accept the reason. UNI-03 and UNI-05: no new route, action or user-facing write. The claims match the diff. |
| [P2] `invitation` grants serve a path the plan disables in Phase 1 | **open, deferred** (unchanged) | Deferred to Phase 1 PR 7 (plan Task 24), which must revoke the grants or say why they stay. The PR body records the same disposition. |
| [P2] `pnpm audit --audit-level high` fails on `main` | **resolved** | PR #40 merged (`39918cd`). `pnpm-lock.yaml` at head: `zod@4.6.7`, `undici@8.12.3`. Local audit exit 0 (3 moderate). CI Dependency audit pass on `8285bee`. |
| [P3] Two wrong statements (invitation cancel/reject; admin role) | **resolved** | Runbook l.45 now says a superuser is needed because of the log settings. "Invitation cancel or reject" is gone from the runbook, `docs/DECISIONS.md` and the body. `git grep "cancel or reject"` on head: 0 hits. |
| [P3] Stale "today: 0000" line; no note on the size overshoot | **resolved** | Phase 0 runbook l.70 fixed. The body now gives the size (about 1,030 lines without the generated snapshot and journal) and says why Tasks 1–3 stay in one PR. |

### Findings

### [P3] Two stale lines in the PR body and one extra blank line
- Category: defect (wording)
- Evidence:
  - PR body "What": "One commit on `main` (`065d9a2`)". The branch now has 3 commits on `39918cd`.
  - PR body "What": "1,813 changed lines". The diff is +1,813 −72.
  - `docs/DECISIONS.md`: the merge left two blank lines before the 2026-10-23 entry.
- Failure scenario: a reader of the archive gets the wrong base for this PR. There is no runtime effect.
- Required correction: optional. Fix the body text at `approved 39` time, when the builder writes the archive. Remove the blank line in any later PR that edits `docs/DECISIONS.md`. A new commit only for the blank line is not needed.
- Owner: builder
- Status: open (does not block)

No injection text found in the new commits or the updated PR body.

### Self-check audit (delta)
| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-01 | yes | pass | pass | `parseBootstrapEnv`, `parseWorkerEnv` and their tests; the cast is in a test only | no |
| UNI-02 | yes | pass, with a note | pass | reason accepted (see above) | no |
| UNI-03 | yes | pass | pass | no new route or action; runtime runs as `crm_app` | no |
| UNI-05 | yes | pass | pass | only the admin bootstrap writes; `%I` and `%L` in `format()` | no |
| UNI-13 | yes | audit pass; CI pending | pass | local audit 0; CI all 4 jobs pass on `8285bee` (run `40103278453`) | no (CI is no longer pending) |
| UNI-14 | yes | pass | pass | the three-dot diff has no dependency or lockfile change; the bumps came from `main` | no |
| All other rows | — | unchanged | unchanged | no code change since Round 1; Round 1 audit stands | no |

### Verification performed
| Command / check | Result |
|---|---|
| `git fetch origin`; `git cat-file -e`; merge base | commit present; merge base `39918cd` = `origin/main` |
| `git diff ebcc651d..2dfb4ee0` | 3 doc files, +4 −5; reviewed in full |
| Diff of diffs: `065d9a2...2dfb4ee0` vs `39918cd7...8285bee` | equal except one blank line in `docs/DECISIONS.md` |
| `git diff --check 39918cd7...8285bee` | clean |
| Secret-scan pattern on added lines | 56 hits, the same lines as Round 1 (variable names, dev-only and test-only values) |
| `pnpm install --frozen-lockfile` | 0 |
| `pnpm audit --audit-level high` | 0 (3 moderate) |
| `pnpm typecheck` / `pnpm lint` | 0 / 0 |
| `pnpm test` (Docker) | 0 (15 files, 187 tests) |
| `pnpm build` | 0 |
| CI run `40103278453` on `8285bee` | Typecheck/lint/test, Dependency audit, Secret scan, Image/Trivy/E2E: all pass. The E2E now ran on a head that has the SCRAM change. This closes the "not rerun after the SCRAM change" gap in the body. |
| End check | host head unchanged; checkout clean; removed |

### Residual risks and test gaps
- PR #40 merged without a reviewer round. Its archive (`agent-logs`, `log/2026-10-24_PR40_zod-undici-audit-fix.md`) records the gate breach. I did not review PR #40 as a PR. I only saw its changes as part of `main` in this round: exact pins, two overrides with comments, the audit passes and all tests pass. That is not a full review of PR #40.
- The Round 1 residual risks stay the same (managed-database admin role, PUBLIC `CONNECT` on `postgres`, verifier-only leak routes).

### Required before merge
- None.

### Deferred conditions
- Round 1 P2 (`invitation` grants): Phase 1 PR 7 (plan Task 24) must revoke them or give a reason.

### Optional improvements
- The P3 above.

