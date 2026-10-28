# PR 45 — Phase 1 PR 5: pg-boss install, worker grants, send-only and worker instances

- **Merged:** 2026-10-28 (09:50 UTC) · **Merge commit:** c599bd89dae32bd3c4e10f49913918e52c5f8e79 · **Branch:** feat/p1-pgboss
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-45.receipt` on agent-logs, log-branch commit 4dcc43953fb203e45f77045b5d40c0bf7d537ce7 (written 09:49:45 UTC, 31 seconds before the merge); head 06bdd6e11eccebecd1cdf497b2c5148212b3b9a9 = final head; review-file hash 9a77e25cb361c927be81beefce0d17f99b677491 (local review file re-hashed: matches)
- **Merge evidence:** `gh pr view 45` reports MERGED, merge commit c599bd8, merged 2026-10-28T09:50:16Z, head 06bdd6e; `git merge-base --is-ancestor c599bd8 origin/main` succeeds.
- **Drafted by:** Opus 5.5 helper (code, deep tier) with Sonnet 5.5 (builder: git, checks, PR) · **Final verdict:** Approved with conditions (round 1, Bob on Opus 5.5)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 8 · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (Tasks 16-18) · **Milestone:** Phase 1 PR 5

## What changed
pg-boss 12.35.0 is installed by migration (0015), with the queues and `crm_app` enqueue-only grants (0016), a patched cron start so `crm_worker` needs no queue-creation rights (patch plus 0017), and measured, frozen `crm_worker` grants (0018, 31-case ablation). The web app has a send-only pg-boss instance, the worker has its own instance with a bounded stop, `jobs:retry` retries a failed job, and the `pg` driver is banned in app code (UNI-04); the `worker.ts` driver exemption is gone.

## Why
Spec "Domain events and jobs" and §9 pg-boss rules: queues are created only by migrations, the web app can only enqueue, and the worker holds the least privilege that was measured. TEN-02, EVT-05, EVT-06, UNI-04.

## Review rounds
- R1 (Approved with conditions, head 06bdd6e): [P2-1] the retry command retries the failed original, which pg-boss deletes after 7 days, and leaves the dead-letter copy behind (`redrive()` exists) → deferred to PR 6 (Task 19); [P3-1] the decisions log and one commit say "option (c)" while Charlie chose option A → fix the label in a later docs change; two optional notes (unused `SELECT(start_after)`, `RETRY_HELP` shows only the pnpm form). No P0/P1.

## Deferred conditions
- P2-1: switch `jobs:retry` to `redrive()` on the dead-letter queue (or an equal fix) and update the runbook retry section, in PR 6 (plan Task 19), **before the first handler can dead-letter a job**.

## Decisions worth keeping
- Charlie chose option A on 2026-10-27, with Bob's advice: patch pg-boss (`patches/pg-boss@12.35.0.patch`) so `start()` skips `createQueue('__pgboss__send-it')` when the queue exists, plus migration 0017. The alternative (give `crm_worker` EXECUTE on `create_queue` and INSERT on `pgboss.queue`) was rejected because it breaks "queues change only in migrations". Removal condition: a pg-boss release that does not create an existing queue (12.38.0 still does).
- Measured `crm_worker` grants differ from the plan's guess: `job` INSERT and UPDATE, `job_dependency` without UPDATE, nothing on `subscription` or `bam`, column-limited UPDATE on `queue` and `version`.
- Retry defaults (builder, queue options): 5 retries, 30 s first delay, backoff; a failing job dead-letters after about 15 to 31 minutes.
- `boss.retry` on the `.dead` queue does nothing; Task 19 must switch to `redrive()`.
- A `send()` that must commit with the request's writes has to pass `db: fromDrizzle(tx, sql)`. Handlers in Tasks 19+ must bound their own queries (no `statement_timeout`). Whether pg-boss stores handler error messages in `output` (UNI-09) is open for Tasks 19 and 27.

## Follow-ups
- Next: Phase 1 PR 6 (events, Tasks 19-20, branch `feat/p1-events`): ask the owner first. It carries the P2-1 deferral.
- Docs after this merge (setup reconcile or a small docs PR): `agents/PROJECT.md` says the UNI-04 `pg` ban is "not in place yet" and §11 says the `crm_worker` grants are "still to be measured"; `CLAUDE.md` Status says the same and its "Next" line is now PR 6. Also the P3-1 label fix in `docs/DECISIONS.md`, the image form of `RETRY_HELP`, and PR 44's wrong evidence pointers.
- Owner: answer ASK 5 (`billing_account.status`, proposal "only `active`"); refresh repo-root `.env` role URLs from `.env.example`; repo visibility; fate of untracked `docker/sync-export.sh`, `docker/sync-import.sh`, `.playwright-mcp/`; decide whether to narrow the unused `SELECT(start_after)` on `pgboss.job_common` (needs a spec change).
- Task 24 must name revoke-session-by-id (from PR 44).

## Appendix — final review round
## Round 1 — 2026-10-27 · scope: slice (Phase 1 PR 5, plan Tasks 16–18)
- **Code review:** base (merge base) `130fd4debb8c378c9430d96ffdd10d5b2cfe264f` · head `06bdd6e11eccebecd1cdf497b2c5148212b3b9a9` · head re-checked at end: yes (host head unchanged; `git status --untracked-files=no` clean)
- Spec: `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 8. Plan: `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`, PR 5.
- Review checkout: `.agent/worktrees/review-45-06bdd6e1` (detached, removed at the end). For the checks I copied the root `.env` into the checkout (gitignored, contents not read or recorded); I deleted it with the build output before `git worktree remove`.

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 · **Switch model next step?** No — the next step is the owner's merge decision.

### Findings

### [P2-1] The retry admin command retries the failed original, which pg-boss deletes after 7 days, and leaves the dead-letter copy behind; pg-boss 12.35.0 has `redrive()` for this
- Category: material risk
- Rule: EVT-05 ("a way to retry from the UI or an admin command"); spec "Domain events and jobs"
- Evidence:
  - `apps/web/src/jobs/retry.ts:60-67` calls `boss.retry(queue, id)` on the failed original. `docs/DECISIONS.md` (Task 18 entry, "Alternatives rejected") says a CLI on the `.dead` copy is "a no-op in 12.35.0". That is true for `retry()` only.
  - pg-boss 12.35.0 has `redrive(name, { ids, sourceName, data, createdBefore, destination, limit })` (`dist/manager.js:1883`, `dist/types.d.ts:531-563`). It moves a dead-letter job back to its source queue (`source_name`) as a new job and deletes the copy.
  - `dist/plans.js:3032` `deletion()`: a job with `completed_on + deletion_seconds < job_now()` is deleted. A failed job has `completed_on` set.
  - Migration 0016 sets no `deleteAfterSeconds`, so the default applies (`QUEUE_DEFAULTS.deletion_seconds` = 7 days, `retention_seconds` = 14 days).
  - Probe (temporary file `apps/web/src/jobs/probe-r45.test.ts`, deleted right after the run, `git status` clean): one `email.send` job with `retryLimit: 0` and a throwing handler, on the migrated test database.
    - Original: `state failed`, `completed_on` set, `deletion_seconds 604800`.
    - Dead-letter copy: `state created`, `source_name email.send`, `keep_until − created_on` = 1 209 600 s (14 days).
    - `redrive('email.send.dead', { ids: [<copy id>] })` from a `RETRY_BOSS_OPTIONS` instance as `crm_worker` returned 1. Rows after: the original (`failed`) and one new `email.send` job (`created`); the copy is gone.
    - `crm_worker` permission errors in the server log: none. `error` events: 0. So `redrive` needs no grant beyond migration 0018.
- Failure scenario:
  1. A job dead-letters, and the operator finds out 8 days later. Maintenance has already deleted the failed original, so `jobs:retry --queue email.send --id <id>` prints `job not found`. The copy still exists, but the command cannot use it. The job cannot be retried with the documented tool.
  2. An operator retries the original within 7 days, and it succeeds. The copy stays in `email.send.dead` as `created` for 14 days. The dead-letter queue still lists a job that is already done. Anyone who later redrives that queue (the pg-boss way) runs it a second time, for example a second email.
- Why it matters: EVT-05's admin retry works only inside an undocumented 7-day window. The dead-letter queue stops showing what is still outstanding. Today the impact is nil: `HANDLERS` is empty, so no production job can fail until the first handler lands.
- Required correction (one of):
  - (recommended) `jobs:retry --queue <dead-letter queue> --id <copy id>` calls `redrive(queue, { ids: [id] })` and exits 1 when it moves 0. Update the help text, the runbook "Retrying a failed job" and the DECISIONS entry. Add a test: a job dead-letters, `redrive` as `crm_worker` moves it, the copy is gone, zero 42501.
  - or keep `retry()` and (a) set `deleteAfterSeconds` on `domain_event` and `email.send` in a migration to at least the dead-letter retention, (b) delete or complete the copy after a successful retry, and (c) state the window in the runbook.
- Owner: builder
- Verification: I rerun the dead-letter scenario through `jobs:retry` against the migrated test database, as `crm_worker`.
- Disposition (P2 only): deferred to PR 6 (plan Task 19, the first handler, `domain_event`). It must land before any handler can dead-letter a job.
- Status: open

### [P3-1] The decisions log and one commit record Charlie's choice as "option (c)"; Charlie chose option A
- Category: defect (documentation)
- Rule: decisions log accuracy
- Evidence: `docs/DECISIONS.md`, entry "pg-boss 12.35.0 patched …" heading and "Decided by: Charlie (option (c), 2026-10-27)". Commit `2e47df1` body: "Charlie's decision, option (c)". The PR body says "Chosen: option A". The choice Charlie was given had two options, A (patch) and B (two grants). The entry's own "Alternatives rejected" relabels them (a), (b), so "(c)" matches nothing Charlie saw.
- Failure scenario: a later reader cannot match the logged decision to the choice the owner made.
- Required correction: write "option A (patch pg-boss; Charlie, 2026-10-27)" in the DECISIONS heading and "Decided by" line. The commit message can stay.
- Owner: builder
- Verification: read the entry.
- Status: open (does not block)

No P0 or P1 findings. No text addressed to an AI agent was found in the PR body, commits, code or docs (the "for Bob" notes are builder-to-reviewer coordination, not instructions to the reviewer).

### Self-check audit
My applicability list (built before reading the table): plan PR 5 guardrails TEN-02 (hard), TEN-03, EVT-01, EVT-03, EVT-05, EVT-06, UNI-04, UNI-06, UNI-14, UNI-15; §9 pg-boss rules and the locked switches; R3, R5, R6, R7; plus TEN-01, TEN-09 (hard), TEN-10, EVT-02, UNI-01, UNI-02, UNI-03, UNI-05, UNI-07 (hard), UNI-08, UNI-09, UNI-12, UNI-13, UNI-16, UNI-19. TEN-04 to TEN-08 apply to new tables, and the spec's R3 exception covers `pgboss.*`. Not applicable: UNI-10, UNI-11, UNI-17, UNI-18, TEN-11, TEN-12, EVT-04, EVT-07 to EVT-12 (no audit, UI, cookies, session, bypass or plugin change). Every applicable rule is in the builder's table.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| TEN-01 | yes, new schema | pass | pass | `install.test.ts` "owned by crm_migrator"; `privileges.test.ts:40` owner scan | — |
| TEN-02 (hard) | yes, worker role | pass | pass | `privileges.test.ts:51-87` (manifest and live scan of `public`); migration 0018 is `pgboss` only | — |
| TEN-03 | yes, job records | pass | pass | `install.test.ts:142-164`: `data`, `output`, `*` give 42501; no UPDATE or DELETE for `crm_app` | — |
| TEN-04–08 (via R3) | yes, new no-RLS tables | (R3 row) | pass | spec R3 and Tenancy allow-list; `rls.test.ts:161` "pgboss: every table" | R3 row cites only the partition check; `rls.test.ts:161` is the stronger evidence |
| TEN-09 (hard) / TEN-10 | yes, worker DB access | pass | pass | `lint-rules.test.ts:38,75,132`; `worker.ts` exemption removed (`eslint.config.mjs:219-221`); `openDatabase` in the system module | — |
| EVT-01 | later | n/a until PR 6 | n/a | no `domain_event` table or enqueue yet | — |
| EVT-02 | no relay | n/a | n/a | pg-boss is the queue | — |
| EVT-03 | no handlers | n/a | n/a | `HANDLERS = {}` (`handlers.ts:21`) | — |
| EVT-05 | yes | pass | partial | queues with retry, backoff and dead letter in 0016 (pass); admin command works only within 7 days and leaves the copy | P2-1 |
| EVT-06 | yes | pass | pass | `options.ts`: worker `schedule: true`, send `schedule: false`; `boss.test.ts:52,85` | — |
| §9 pg-boss rules / locked switches | yes | pass | pass | installed in 0015 by the migrator; `migrate`/`createSchema` false on all three instances; `notify` false in 0016/0017; `install.test.ts:86` | — |
| R3 | yes | pass | pass | no partitioned queue (`install.test.ts:86`) | — |
| R5 | yes | pass | pass | exact pin 12.35.0; patch hash in the lockfile; installed path `pg-boss@12.35.0_patch_hash=e3b96c49…` | — |
| R6 | yes | pass | pass | 0018 matches the manifest; 31 ablation cases = 31 grants in 0018 (counted); zero-42501 runs have a sentinel | — |
| R7 | yes | pass | pass | no `create_queue` EXECUTE, no queue INSERT, column-limited UPDATE (`worker-grants.test.ts:135-146`) | — |
| UNI-01 | yes | pass | pass | typecheck 0; casts commented (`worker-grants.test.ts:100`, `retry.ts:66-67`) | — |
| UNI-02 | yes | pass | pass | retry policy in migration 0016; stop timeouts are operational constants | — |
| UNI-03 | yes, CLI input | pass | pass | `retry.ts:35-56` parseArgs strict and uuid check before connecting; checked offline with the built bundle | — |
| UNI-04 | yes | pass | pass | `eslint.config.mjs:50-53`; `lint-rules.test.ts:183`; build metafile check printed "pg only inside pg-boss" | — |
| UNI-05 | yes | pass | pass | lint 0; no dead code seen | — |
| UNI-06 | yes, new dependency and patch | pass | pass | ladder row in DECISIONS; the patch is one hunk, checked by test and by the bundle check | — |
| UNI-07 (hard) / UNI-08 | yes | pass | pass | secret pattern on added lines: no hit; CI secret scan pass; test passwords are throwaway | — |
| UNI-09 | yes, job logs | pass, open point | pass | `log.ts:13-26` logs name, code and queue only; `boss.test.ts:100`. pg-boss writes a failed handler's error into `output`, open for Tasks 19/27 | — |
| UNI-12 | yes | pass | pass | not re-checked beyond the PR body; my probes used Testcontainers only | — |
| UNI-13 | yes | pending | pass | CI 4/4 SUCCESS on `06bdd6e` | — |
| UNI-14 | yes | pass | pass | `pnpm install --frozen-lockfile` 0 | — |
| UNI-15 | yes | pass | pass | 0015–0018 only add | — |
| UNI-16 | yes, roles and worker | pass | pass, with P2-1 | runbook sections present and match the code; the retry section needs the P2-1 update | P2-1 |
| UNI-19 | no new endpoint | pass | pass | no route added | — |

### Verification performed
| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | 0 |
| `pnpm audit --audit-level high` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `pnpm test` | 0 — 34 files, 736 tests, none skipped |
| `pnpm build` | 0 — "bundle checks: pg only inside pg-boss; worker bundles the patched pg-boss and postgres.js" |
| `node dist/retry-job.mjs --help` / `--id nope` (built bundle, empty env) | exit 0 / exit 2 before connecting |
| Read `pg-boss@12.35.0` `dist/timekeeper.js`, `manager.js`, `plans.js` | patch applies to `start()` only; `create_queue` inserts even when the queue exists (confirms the need); `retryJobs` matches `failed` only; `deletion()` 7-day default; `redrive()` exists |
| Probe `probe-r45.test.ts` (temporary, deleted) | `redrive` as `crm_worker` moved 1, zero 42501, zero errors (P2-1) |
| `git diff --check` | only trailing spaces at `0015_pgboss_install.sql:420,431`, pg-boss's own text (`install.test.ts:54` requires byte equality); accepted |
| Secret-scan pattern (`PROJECT.md` §7) on added lines | no hit |
| CI on `06bdd6e` | 4/4 SUCCESS |
| Head re-check at end | `06bdd6e` unchanged; checkout clean |

### Residual risks and test gaps
- Not run by me: `pnpm stack:up`, image E2E and `node dist/retry-job.mjs` against a live database inside the image. CI's image job covers the final head.
- Next.js bundling of pg-boss once a route imports `getSendBoss()` (Task 19). The bundle check covers the esbuild bundles only, not `.next`.
- No `statement_timeout` on either pool. Task 19+ handlers must bound their own queries.
- pg-boss stores a failed handler's error message and stack in `job.output` (UNI-09 open point for Tasks 19/27).
- Retry defaults accepted: 5 retries, 30 s first delay, backoff, dead letter after about 15–31 minutes. Revisit for `email.send` in Task 27 (a provider outage longer than that sends every email to the dead letter).

### Required before merge
- None.

### Deferred conditions
- P2-1 → PR 6 (plan Task 19), before the first handler can dead-letter a job.

### Optional improvements
- P3-1: fix the "option (c)" label in `docs/DECISIONS.md`.
- `SELECT (start_after)` on `pgboss.job_common` for `crm_app` is unused while `notify` is off. Narrowing it needs a spec change; Charlie's call.
- `RETRY_HELP` shows only the `pnpm` form; the image form (`node dist/retry-job.mjs …`) is only in the runbook.
