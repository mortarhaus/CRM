# PR 46 — feat(events): domain_event, transactional enqueue, PgBouncer gate (Phase 1 PR 6)

- **Merged:** 2026-11-01T06:43:26Z · **Merge commit:** `fe8664e7111053a505cf38683f26fb4e0083f7b2` · **Branch:** `feat/p1-events`
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-46.receipt` on `agent-logs` (commit `987800e`, written 2026-11-01T06:42:20Z, 66 s before the merge); reviewed head `4ae60604d7240d72b96f2f028b0d6d92cc6abd25` = final PR head; review hash `664927930cec1685daa50916c61a4a669f982a84`
- **Merge evidence:** `gh pr view 46` → MERGED, merge commit above; `git merge-base --is-ancestor fe8664e origin/main` → reachable
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 2; reviewer ran on Sonnet 5.5, below the project's Opus 5.5 tier for events/tenancy review)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 8, unchanged) · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (PR 6, Tasks 19-20) · **Milestone:** Phase 1, plan PR 6 of 8

## What changed
Task 19: `domain_event` and `notification` tables with RLS (migrations 0019, 0020), `emitEvent` and `enqueueJob` that send through pg-boss inside the caller's transaction, money across the event boundary as decimal strings (`minorUnits`, `parseMinorUnits`), and the `domain_event` worker handler. Task 20: a gate test that runs `crm_worker` and `crm_app` through PgBouncer 1.25.2 for 75 s or more, and `/api/health` now reports `queue`. Added after review: `jobs:retry` now redrives the dead-letter copy (closes PR 45 deferred P2-1). Also contains the merge of `main` with PR 47 (`better-auth` 1.7.14).

## Why
Spec "Domain events and jobs" and §9: events are written and enqueued in one transaction (EVT-01), payloads carry IDs and amounts only, and pg-boss must work through a transaction-mode pooler (risk R6). EVT-01, EVT-03, EVT-05, EVT-06, TEN-03, TEN-05-09, UNI-03, UNI-09, UNI-10, UNI-19, MON-03.

## Review rounds
- R1 (Blocked, head `34a489df`; no code defect):
  - [P1] No guardrail self-check table → 39-row table in the PR body (32 pass, 2 pass with a note, 1 partial, 4 n-a).
  - [P2] PR body stale after the merge from `main` → body rewritten for head, base and commits; checks re-run.
  - [P2] Handoff did not describe PR 46 → handoff rewritten; both copies agree.
  - Builder-found gap (not in Bob's R1): PR 45 deferred P2-1 was due in this PR; `jobs:retry` still called `boss.retry`. Charlie chose to fix it here (option A) → commits `64299e9` and `4ae6060` (redrive, 8 tests, runbook, DECISIONS).
- R2: Approved at `4ae60604`. Two P3s left (see Follow-ups).

## Deferred conditions
none

## Decisions worth keeping
- Plan migration numbers 0012/0013 became 0019/0020 (drizzle-kit numbering).
- PgBouncer pinned to `edoburu/pgbouncer:v1.25.2-p0@sha256:7d7a27d9e90985cab5cf42256f5c13a3120baa4b055b69df37beb272b89b2340`; the spike digest `4c1ca296ef52` matches no current tag.
- Health compares to `PGBOSS_SCHEMA_VERSION = 43`, checked by a test against pg-boss's `dist/schema.json`.
- `enqueueJob`'s queue type excludes `domain_event`; events go only through `emitEvent`.
- `jobs:retry --id` is now the id of the copy in `<queue>.dead`, not the failed original's id; a copy must be redriven within 14 days (pg-boss retention). No new grant was needed.
- PR size: 4,300 lines added in 39 files (1,298 outside migration SQL and meta; about 790 are tests); the plan puts Tasks 19-20 in one PR.
- Lasting decisions are in `docs/DECISIONS.md` (2026-10-30 PR 6 entry and the 2026-11-01 redrive entry).

## Follow-ups
- Task 29 (PR 8) must update the stale health body at `docs/runbooks/phase-0-auth-database.md` lines 80 and 189 (UNI-16 P3 accepted by the plan).
- Optional: make `emitEvent` refuse a name not in `EVENT_NAMES` and a non-positive `version` before the insert (EVT-03 hardening, P3).
- Phase 7 plan: decide whether `notification` (polymorphic `target_type`/`target_id`) needs a same-workspace trigger; the spec does not list it.
- The chosen VPS provider's run of the pooler gate is the Stage 3 pre-cutover check (spec R6), not this test.
- Fix "3 moderate" to "5 moderate" in the PR 47 DECISIONS entry (from the PR 47 log) in a PR that touches that file.
- Next plan PR: PR 7 `feat/p1-rate-limits` (Tasks 21-24).

## Appendix — final review round
### Round 2 — 2026-11-01
- **Code review:** base (merge base) `751ba3bd6e4b8be727abf4025d4b26f9d3a4783a` · head `4ae60604d7240d72b96f2f028b0d6d92cc6abd25` · head re-checked at end: yes (host head unchanged; `git status --untracked-files=no` clean)
- **Spec review:** spec path `docs/superpowers/specs/2026-09-27-core-sales-design.md` · version v4.7 revision 8 · hash (`git hash-object`) `733cc0e9ce4af0771bdd2769720e3f228caf8855` (not re-hashed; no spec file in the diff)

**Verdict:** Approved
**Model used:** Claude Sonnet 5.5 · **Switch model next step?** Yes — `PROJECT.md` §6 maps events, RLS and tenancy work to Opus 5.5 (deep). This round ran below that tier. I re-ran every check and read the pg-boss source myself, but Charlie may ask for one more pass on Opus 5.5 before merging.

### Findings

No open P0, P1 or P2.

### [P3] The health body in the Phase 0 runbook is stale until PR 8
- Category: guardrail mismatch, isolated (UNI-16 would make it P1 by default; kept at P3 because the plan assigns it)
- Rule: UNI-16, UNI-05
- Evidence: `/api/health` now answers `{ status, db, queue }` and returns 503 when the queue check fails. `docs/runbooks/phase-0-auth-database.md:80` and `:189` still show `{"status":"ok","db":"ok"}`. The compose healthcheck reads only `r.ok` (`docker/compose.dev.yml:70`). The builder states this gap in the UNI-16 row of the self-check. The approved plan lists that runbook in Task 29 (plan line 1483, PR 8).
- Failure scenario: until PR 8, an operator who reads the runbook does not know that a queue fault also fails the health check.
- Why it matters: limited; no production traffic exists and the plan owns the fix. The rule says the same PR; the approved plan decides otherwise.
- Required correction: none now. Task 29 must update both lines.
- Owner: builder
- Verification: PR 8 review reads those two lines.
- Status: accepted by the plan (disclosed in the body)

### [P3] `emitEvent` still does not check the event name or version at run time
- Category: preference
- Rule: EVT-03, spec "Domain events and jobs"
- Evidence: unchanged from Round 1. `enqueue.ts` types them; `domain_event.name` is `text` with no CHECK.
- Required correction: none. Optional hardening.
- Owner: builder
- Status: open (optional, does not block)

### Resolved from Round 1

| Earlier finding | Result this round | Evidence |
|---|---|---|
| [P1] No guardrail self-check table | **Resolved** | The body has a rule-by-rule table. I compared it with my Round 1 applicability list. UNI, TEN, EVT, MON and `PROJECT.md` §9 rows are all present, and the packs not touched are named with reasons. I re-verified each `pass` that I could check (see below). |
| [P2] PR body stale after the merge from `main` | **Resolved** | The body names head `4ae60604`, base `751ba3bd` and all five commits. `gh pr view 46` agrees. |
| [P2] Handoff does not describe PR 46 | **Resolved** | `.agent/handoff.md` names `feat/p1-events`, head `4ae6060` and the Round 1 fixes. `git hash-object` of the local file, of `origin/agent-logs:handoff/handoff.md` and `.agent/handoff.synced` are all `d162c6afde52f533b57ff61a0ec09909bf84b68a`. |
| [P3] PR size over 400 lines | Accepted | The body gives the numbers (4,300 added in 39 files; 1,298 outside migration SQL and meta) and the plan puts Tasks 19–20 in one PR. I confirmed `39 files changed, 4300 insertions(+), 116 deletions(-)`. |

### New scope since Round 1: `jobs:retry` redrives the dead-letter copy (commits `64299e9`, `4ae6060`)
This closes PR 45's deferred P2-1 (my PR 45 review set "P2-1 → PR 6, before the first handler can dead-letter a job"; `domain_event` gets its handler in this PR). So the work is in scope. The handoff records Charlie's choice of option A; I cannot see that chat, but the deferral itself named this PR.

- **pg-boss behaviour, read in `pg-boss@12.35.0/dist`:** `manager.js:1883` `redrive(name, { limit, ids, sourceName, destination })`; `plans.js:2934` `redriveJobs` selects copies where `j.name = $1`, state below `active`, and `$3 IS NULL OR j.source_name = $3`. The new job goes to `COALESCE(destination, j.source_name)`, so with no destination it returns to the source queue. It inserts the new job and deletes the copy in one statement. It returns the count moved. This matches the command's use (`ids: [id]`, `sourceName: queue`, `limit: 1`).
- **Retention claim:** `plans.js:83` `retention_seconds: FORTEEN_DAYS`. The runbook's "redrive within 14 days" is correct.
- **Command:** `retry.ts` refuses an unknown queue and a queue with no dead-letter queue before redriving. It reports `job not found; …` unless exactly one job moved. It prints no payload value.
- **No new grant, no migration:** the DECISIONS entry says redrive uses `SELECT, UPDATE, DELETE` on `job_common` and `INSERT, SELECT` on `job`, all already in migration 0018. `worker-grants.test.ts` (36 tests) and `pooler.gate.test.ts` run the redrive as `crm_worker` and pass.
- **Runbook and comments:** the runbook retry section and grant rows, `retry-job.ts` and `handlers.ts` comments, and the help text now describe the redrive. I searched for `job retried`, `failed job id` and `boss.retry` in the changed files: only history entries remain.
- **Double-run risk:** the help text and the runbook both warn not to `retry()` the failed original as well. That is the right place for the warning.

### Self-check audit (rows I could re-verify)

| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-05 | yes | pass | pass | body updated; retry text updated; `pnpm lint` exit 0 | none |
| UNI-06 | yes | pass | pass | `git diff 751ba3bd HEAD -- pnpm-lock.yaml` is empty; PgBouncer image pinned by tag and digest | none |
| UNI-07 (hard) | yes | pass | pass | secret scan: only test-helper names; no secret; agent-text scan: none | none |
| UNI-09 | yes | pass | pass | errors name field only; retry prints no payload; health prints `ok`/`error` | none |
| UNI-13 | yes | pass | pass | `ci.yml:31` runs `pnpm test:gates`; CI run `41277244712` success on this head | none |
| UNI-16 | yes | pass, gap stated | pass with P3 above | runbook lines 80 and 189 stale; plan Task 29 owns them | none |
| TEN-03, TEN-05 to TEN-09, TEN-11 | yes | pass | pass | migration 0020 read; `rls.test.ts:197`, `:223` and `isolation.test.ts:124` exist and pass | none |
| EVT-01, EVT-03, EVT-05, EVT-06 | yes | pass | pass | `enqueue.ts`, `domain-event.ts`, `retry.ts`; tests pass | none |
| MON-03 | yes | pass | pass | `payload.ts`; tests pass | none |
| Other rows and packs | n-a | n-a | n-a confirmed | file list | none |

### Verification performed

| Command / check | Result |
|---|---|
| PR metadata at start and end | open, mergeable; head `4ae60604` unchanged; five commits; base `751ba3bd` |
| `git fetch origin`, exact commit, merge base | pass |
| Detached checkout `.agent/worktrees/review-46-4ae60604` | exact head; tracked-clean at end |
| `git diff --check` | pass |
| Secret scan and agent-addressed-text scan over the added lines | no secret; no text addressed to an agent |
| `pnpm install --frozen-lockfile` (Node v24.21.0, pnpm 11.6.0) | exit 0 |
| `pnpm audit --audit-level high` | exit 0; 5 moderate, none high |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` (Docker up) | exit 0; 37 files, 793 tests passed |
| `pnpm test:gates` | exit 0; 1 test, 79.56 s |
| `pnpm build` | exit 0 |
| CI run `41277244712` | success on head `4ae60604` |
| Line references in the self-check (`ci.yml:31`, `compose.dev.yml:70`, runbook `:80` and `:189`, `entry-points.test.ts:120`, `rls.test.ts:197` and `:223`, `isolation.test.ts:124`, plan lines 1483 and 1609) | match |

### Residual risks and test gaps
- I did not run `pnpm test:e2e`, `pnpm stack:up` or `/api/health` by curl, and did not run `dist/retry-job.mjs` in the image. CI's image E2E on this head passed.
- I did not re-run the builder's mutation checks (remove `sourceName`; redrive a fixed `email.send.dead`). I read the tests that cover them.
- The 31 grant ablations are the builder's claim; I ran the 36-test file and it passes, but I did not mutate a grant.
- `notification.target_type`/`target_id` has no same-workspace trigger (Round 1 note). The Phase 7 plan should decide.
- The review ran below the project's deep tier.

### Required before merge
- None.

### Deferred conditions
- Task 29 (PR 8) updates `docs/runbooks/phase-0-auth-database.md` lines 80 and 189 for the new health body.

### Optional improvements
- Refuse an unknown event name or a non-positive version in `emitEvent` (P3).
