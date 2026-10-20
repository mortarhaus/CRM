# Phase 1 — Tenancy, Security, Jobs Implementation Plan

> This plan is task data. Implementation follows `agents/START.md`, `agents/roles/builder.md` and the owner's instructions; how the builder works through it (sub-agents, task-by-task execution, or neither) is the builder's choice and never overrides the kit's commands, gates or PR checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: draft for Bob's plan review (2026-10-20; revised after Bob's plan review Rounds 1 and 2, and after Charlie's ASK 3 answer "B": Task 31 and spec edit E12).** Written against spec v4.7 revision 7, hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451` (= `agents/PROJECT.md` §2), `main` at `4bf02f9`. Items marked **builder proposal, Bob reviews; owner decides only if it changes a spec rule** are not decided until Bob's review round (and Charlie, where marked). No product code is in this PR, and no spec or `PROJECT.md` edit either: this PR holds the plan and its `docs/DECISIONS.md` entry only. The spec and `PROJECT.md` edits this plan needs are listed in "Spec / PROJECT.md edits this plan needs"; they are made **after this PR is merged**, in the separate PRs named in "Order of the plan, spec and reconcile PRs" (Task 30 and the `setup` reconcile).

**Goal:** Build the tenancy, security and jobs spine so that every later phase writes tenant data only as `crm_app` inside `withWorkspace()`, under RESTRICTIVE + PERMISSIVE RLS, through `action()`, with an audit trail, transactional domain events and jobs, database-backed rate limits, nonce CSP and a working email path, and so that every Phase 1 test and gate in the spec passes.

**Architecture:** Five database roles are created once per cluster by a bootstrap step run by the database admin (dev: a one-shot compose service; tests: the Testcontainers helper; production: a runbook command). Migrations run as `crm_migrator` (database owner) and create tables, RLS policies, grants and pg-boss. The web process holds a postgres.js pool as `crm_app` and a send-only pg-boss instance as `crm_app`. The worker holds a postgres.js pool as `crm_app` (tenant work) and a pg-boss instance as `crm_worker` (queue internals). `crm_purge` gets its own login (Settled item 1) and, in Phase 1, only INSERT on `audit_log`. `crm_link_resolver` is created `NOLOGIN` with no privileges (its function arrives in Phase 7). Every effective privilege of every non-owner role is compared, in a test, against one committed manifest (`apps/web/src/db/privileges.ts`).

**Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, Phase 1 row of "Build phases for Part 1" (line 1110):
> **Deliverable:** `billing_account` / `organization` / `member` (Better Auth system module, no RLS) + `workspace_settings` (RLS), five DB roles (`crm_migrator`, `crm_app`, `crm_link_resolver`, `crm_purge`, `crm_worker`), RLS with `nullif` policies + `withWorkspace()` (`set_config`) + lint rule + policy lint, `action()`, audit log (PII-redacted), nonce CSP + headers, DB-backed rate limits, pg-boss installed by migrations with `pgboss` grants, web send-only instance + worker, `domain_event` + transactional enqueue, `notification` table, email adapter + React Email, `/api/health`
>
> **Done when:** (quoted in full in the spec; each clause is mapped to a test in "Done-when and Verification map" below)

Other sections used: "Tenancy" (lines 774–790), "Authentication and sessions" → "Rate limits" and "Better Auth endpoints" (lines 710–751), "Secrets, supply chain, image" (surface list), "Audit, logging, privacy" → "`crm_purge` in Phase 1" (Phase 9 purge is **not** in scope), "Domain events and jobs", "Scalability", "Known risks" R3–R7, "Runtime and hosting" (env list), Verification (lines 1161–1257, Phase 1 parts), Open questions 8 and 9, `docs/DECISIONS.md` 2026-10-12 to 2026-10-17.

**Facts verified on 2026-10-20 against the published tarballs** (`npm pack`, read only, not installed in the repo; the tarballs were written and read in the session scratchpad, outside the project folder, see self-check UNI-12; each task re-checks them in the installed tree):
- **pg-boss 12.35.0** (MIT; published 2026-09-26; `"type": "module"`; dependencies `pg ^8.23.0`, `cron-parser ^5.10.1`, `rrule-temporal ^2.2.6`, `serialize-error ^13.0.1`; `engines.node >=22.12.0`). Schema version 43. Exports `getConstructionPlans(schema, options)`, `getMigrationPlans(schema, version, options)`, `fromDrizzle`. In the partitioned layout it creates 10 tables in its schema (`bam`, `job`, `job_common`, `job_dependency`, `queue`, `queue_stats`, `schedule`, `subscription`, `version`, `warning`), the enum `job_state`, and **6 functions**: `create_queue(text, jsonb)`, `delete_queue(text)`, `job_now()`, `job_table_format(text, text)`, `job_table_run(text, text, text)`, `job_table_run_async(text, int, text, text, text)`. `job_now()` is `LANGUAGE sql STABLE` and is called by the SQL of send, fetch, complete and maintenance. Maintenance options that run DDL or need ownership: `reindex` (default `true`, runs `REINDEX INDEX CONCURRENTLY`) and `persistQueueStats` (default `false`; creates and drops `queue_stats` partitions). Constructor options `migrate`, `createSchema`, `supervise`, `schedule` exist.
- **better-auth 1.7.6** (`@better-auth/core` 1.7.6): rate limiting is on only in production unless `rateLimit.enabled` is set. `storage: "database"` uses table `rateLimit` (`key`, `count`, `lastRequest`), refreshes `lastRequest` on every granted request (so its window is measured from the last grant, **not** a fixed window), checks with a read followed by conditional updates and retries, and after a window reset deletes **every** row whose `lastRequest` is older than its own longest configured window. `rateLimit.customStorage` (`{ consume(key, rule) → { allowed, retryAfter } }`) replaces the storage completely. The 429 is `{"message":"Too many requests. Please try again later."}` with header `X-Retry-After`. Client IP: `advanced.ipAddress.ipAddressHeaders` (default `["x-forwarded-for"]`), a header with more than one address is ignored unless `trustedProxies` is set, IPv6 is keyed by `ipv6Subnet` (default 64). **When no IP is found in production, Better Auth does not skip the limiter: it uses one shared key `no-trusted-ip` and logs a warning once** (the spec says it skips; see spec edit E6). `disabledPaths` (exact paths) answers `404 Not Found`.
- **Next.js 16** nonce CSP: a `proxy.ts` file exporting `proxy(request)` sets `x-nonce` and `Content-Security-Policy` on the request and the response; pages must render dynamically (docs page "Content Security Policy", updated 2026-03-20).
- Candidate new packages (versions to re-check with `pnpm view` at task time; pnpm 11's release-age gate may refuse a version younger than its window, in which case take the newest version that passes and record it): `nodemailer` 10.1.7 (MIT-0, 2026-10-18, ships its own types, `engines.node >=20`), `@react-email/render` 2.1.1 (MIT, 2026-10-16, peers React 18/19, dependencies `prettier`, `html-to-text`, `html5parser`, `entities`).

## Global Constraints

- Everything in the Phase 0 plan's Global Constraints still holds (Node 24.21.0, pnpm 11.6.0, exact pins, TypeScript 6.0.3, relative imports outside `src/app` and `src/components`, no comments by default, Conventional Commits, never commit to `main`, never `--no-verify`).
- Agent shells: `eval "$(fnm env --use-on-cd --shell zsh)"; fnm use 24.21.0` and check `node --version` prints `v24.21.0`.
- Commit trailer: `Co-Authored-By: Claude <model> <noreply@anthropic.com>` with the model that did the work. The commit commands below show `Claude Opus 5.5` as an example.
- **Pins:** pg-boss **12.35.0** and drizzle-orm **0.45.3** exactly (spec R5). `pg` comes only through pg-boss (8.23.0 at the spike); app code never imports `pg` (lint, Task 18).
- **New dependencies in Phase 1 (each needs a UNI-06 ladder row in `docs/DECISIONS.md` in its PR):** `pg-boss` 12.35.0 (spec-pinned), `nodemailer` (SMTP; Node has no SMTP client), `@react-email/render` (React Email). **Not added:** the `resend` SDK (the Resend adapter uses `fetch`), `@react-email/components` (20 sub-packages; templates use plain elements), `pino` (Phase 1 keeps the existing one-line JSON logs; Pino arrives with Sentry), Sentry, AWS SDK, Turnstile. Container images added: PgBouncer (tests only) and Mailpit (dev compose), each pinned by tag **and** digest.
- **Schema style:** tables are declared in Drizzle schema files and generated with `pnpm db:generate --name <change>`. RLS, policies, grants, triggers, functions and pg-boss SQL are hand-written **custom** migrations: `pnpm db:generate --custom --name <change>`, then the SQL is written into the generated empty file. One custom migration per concern, so a reviewer reads each policy set once.
- **Policy template** (TEN-05/06/07; spec Tenancy, revision 7). For a tenant table `<t>` where `crm_app` holds the commands `<cmds>`:
  ```sql
  ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
  ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
  CREATE POLICY <t>_workspace ON <t> AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
    USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
    WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
  -- one PERMISSIVE policy per granted command, repeating the predicate:
  CREATE POLICY <t>_app_select ON <t> AS PERMISSIVE FOR SELECT TO crm_app USING (<predicate>);
  CREATE POLICY <t>_app_insert ON <t> AS PERMISSIVE FOR INSERT TO crm_app WITH CHECK (<predicate>);
  CREATE POLICY <t>_app_update ON <t> AS PERMISSIVE FOR UPDATE TO crm_app USING (<predicate>) WITH CHECK (<predicate>);
  CREATE POLICY <t>_app_delete ON <t> AS PERMISSIVE FOR DELETE TO crm_app USING (<predicate>);
  GRANT <cmds> ON <t> TO crm_app;
  ```
  `<predicate>` is always the exact text of the workspace predicate above. A policy exists only for a command the role holds a grant for.
- **Workspace context:** only `withWorkspace()` (Task 5) calls `set_config('app.workspace_id', …, true)`. `SET`, `SET LOCAL` and `set_config(…, false)` are banned by lint (TEN-09).
- **Payloads:** `domain_event.payload` holds IDs and amounts only; pg-boss job data holds IDs only (spec "Domain events and jobs"). Job data is `{ workspaceId, … ids }`; see Settled item 5. Both are JSONB, which has no bigint: a money amount (bigint minor units) crosses the event boundary only as a canonical decimal string (`MinorUnits`, `minorUnits()`, Task 19), never as a raw `bigint` or a `number`.
- **Values:** every number from the spec's rate-limit table and every other fixed security value goes into `packages/core/src/security/limits.ts` with its spec citation (UNI-02; `docs/DECISIONS.md` 2026-10-13). No other literal limit in code.
- **Commands:** `pnpm test` (Vitest; Docker running), one file `pnpm vitest run <path>`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`. New in Task 19: `pnpm test:gates` (the 60 s+ pooler gate, excluded from `pnpm test`, run in CI).
- **PR size:** the 400 LOC target excludes generated migration SQL, the committed pg-boss construction SQL and `pnpm-lock.yaml`. Where a PR still exceeds it, its PR body says by how much and why.

## Items this plan settles

Each item is a **builder proposal, Bob reviews; owner decides only if it changes a spec rule.** Where `PROJECT.md` §11 or the spec makes it an owner choice anyway, that is said in the item.

### Settled item 1 — Open question 8: how `crm_purge` connects

**Choice: its own login.** `crm_purge` is created `LOGIN NOINHERIT CONNECTION LIMIT 2`, no `BYPASSRLS`, no superuser, no `CREATEROLE`, `CREATEDB` or `REPLICATION`, and **no role is a member of it**. Its connection string `DATABASE_PURGE_URL` is added to the **worker** environment only, in Phase 9, when the purge job lands (UNI-05: no unused env var now). In Phase 1 the role has **no password** in dev compose and production (a role without a password cannot pass `scram-sha-256`, the auth method of the official `postgres` image for TCP); the bootstrap sets a password only when `CRM_PURGE_PASSWORD` is given, which the Testcontainers helper does so the Phase 1 behavioural tests connect as the real role.

Reasons, against each criterion:
- **TEN-02 (hard).** With its own login, no runtime role can ever become `crm_purge`: `pg_auth_members` has no row with `roleid = crm_purge` (asserted in Task 1). With `SET ROLE`, the role whose pool runs the purge must be a member of `crm_purge`. The purge's tenant work runs on the worker's postgres.js pool, which is `crm_app` (spec: handlers do tenant work as `crm_app`), so `crm_app` would need the membership, and then every web request's connection could `SET ROLE crm_purge`. One SQL-injection or one misuse in any route would reach the purge's DELETE grants from Phase 9 on. PostgreSQL 16+ `GRANT … WITH INHERIT FALSE, SET TRUE` stops privilege inheritance but not the switch.
- **TEN-09 (hard).** Own login: the purge transaction is an ordinary `withWorkspace()` transaction on its own pool; only the workspace setting is transaction-local, and nothing about the role lives on a shared connection. `SET LOCAL ROLE` would also be transaction-local, but a mistake (`SET ROLE` without `LOCAL`, or a role switch outside the transaction) would leak the purge role to the next pooled user of that server connection; with its own login that failure cannot exist.
- **Pooler.** Transaction-mode PgBouncer needs one more user entry (`crm_purge`) in its auth file or auth query; the pool for it is `max: 1`, opened only by the purge job, so the connection budget grows by at most one server connection per worker. `SET LOCAL ROLE` needs no pooler user, which is its one advantage.
- **Docker and secrets.** One more secret, present only in the worker container's environment (never in `web`), rotated like the other DB passwords (runbook). The web image process can never hold it.

**Alternative (not chosen):** `crm_purge NOLOGIN`, `GRANT crm_purge TO crm_app WITH INHERIT FALSE, SET TRUE`, and `SET LOCAL ROLE crm_purge` as the first statement inside the purge's `withWorkspace()` transaction. Cheaper (no secret, no pooler user) but fails the TEN-02 reasoning above.

**Owner step:** `PROJECT.md` §11 says any choice on an open question in "Open questions for Charlie" (8 is one) needs Charlie's explicit choice. So this is **ASK 1**: Charlie confirms "own login" after Bob's review. Spec edit E3 marks Open question 8 resolved only after that.

### Settled item 2 — exact grants per role, functions included, and how they are measured

**Method (measured, not assumed).** The spike found `crm_app`'s pg-boss grants "by trial, one error at a time" (`CRM-spikes/RESULTS.md`). Phase 1 uses the same deny-and-add method for every role, then freezes the result in a manifest and a test:
1. Start from no grant beyond the PostgreSQL defaults the spec allows.
2. Run the role's complete operation set (listed per role below) against Testcontainers Postgres 17 as that role, with `log_min_error_statement = error`.
3. Each `42501 permission denied for <object>` names one missing privilege; add the narrowest grant (column-level where the statement allows), rerun.
4. Stop when the full set passes with zero `42501` and zero pg-boss `error` events. Record the final grants in a custom migration, in `apps/web/src/db/privileges.ts` (the manifest) and in a runbook table (`docs/runbooks/phase-1-database-roles.md`), and add a `docs/DECISIONS.md` entry with the measurement date and versions.
5. **Ablation check** (Task 17, `crm_worker` only, where the set is largest): remove each table grant in turn and rerun the targeted operation that needs it; it must fail with `42501`. A grant that no operation needs is removed.

**The permanent test** (`apps/web/src/db/privileges.test.ts`, Task 3): for each of `crm_app`, `crm_worker`, `crm_purge`, `crm_link_resolver` and `PUBLIC`, it computes **effective** privileges with `has_database_privilege` (CONNECT, CREATE, TEMPORARY), `has_schema_privilege` (USAGE, CREATE on every non-system schema: `public`, `pgboss`, `drizzle`), `has_table_privilege` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on every table, view and sequence-backed table in those schemas), `has_column_privilege` (for any table where the role has a column privilege but not the table privilege), `has_sequence_privilege` (USAGE, SELECT, UPDATE) and `has_function_privilege` (EXECUTE on every function in those schemas). These functions include privileges that come through `PUBLIC` and through role membership, so PUBLIC-derived privileges are counted. The result must **equal** the manifest exactly: an unlisted privilege fails the test, and so does a listed one that is missing. Built-in `pg_catalog` functions (for example `set_config`) are outside the scanned schemas and stay at the PUBLIC default the spec allows. Role attributes and memberships are checked in the same file (`pg_roles`, `pg_auth_members`).

**Functions.** Migration 0001 (Task 3) runs `ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` before any function exists, so no project or pg-boss function is executable through PUBLIC. Trigger functions need no EXECUTE grant at fire time (PostgreSQL checks EXECUTE only at `CREATE TRIGGER`, for the creator), so none is granted. The full list:

| Function (created in) | `crm_app` | `crm_worker` | `crm_purge` | `crm_link_resolver` | Why |
|---|---|---|---|---|---|
| `pgboss.job_now()` (Task 16) | EXECUTE | EXECUTE | — | — | Called inside the SQL of `send` (crm_app) and of fetch, complete, fail, retry and maintenance (crm_worker). Confirmed by the measurement; if `send` does not call it, the `crm_app` grant is dropped. |
| `pgboss.create_queue(text, jsonb)` | — | — | — | — | Queues are created only in migrations, by the owner `crm_migrator` (spec: queue options change only in migrations). |
| `pgboss.delete_queue(text)` | — | — | — | — | Same. |
| `pgboss.job_table_format(text, text)` | — | — | — | — | Used only by construction, migration and queue creation (owner). Confirmed by the measurement. |
| `pgboss.job_table_run(text, text, text)` | — | — | — | — | Same. |
| `pgboss.job_table_run_async(int …)` | — | — | — | — | Same (async DDL on partitioned queues, owner only). |
| `public.poly_ref_check_insert()` (Task 11, trigger) | — | — | — | — | Trigger function. |
| `public.poly_ref_forbid_retarget()` (Task 11, trigger) | — | — | — | — | Trigger function. |
| `public.resolve_share_link(bytea)` | — | — | — | — | Not in Phase 1 (Phase 7: owned by `crm_link_resolver`, EXECUTE to `crm_app` only). |

**Expected table grants (proposal; the measurement confirms or corrects each):**
- `crm_app`, schema `public`: Better Auth tables `user` (S, I, U), `session` (S, I, U, D), `account` (S, I, U), `verification` (S, I, U, D), `two_factor` (S, I, U, D), `organization` (S, I, U), `member` (S, I), `invitation` (none in Phase 1: invitations are disabled until Phase 3); `rate_limit` (S, I, U, D); `billing_account` (S, I); `auth_audit_log` (I only, Task 31); `workspace_settings` (S, I, U); `audit_log` (S, I); `domain_event` (S, I); `notification` (S, I, U(`read_at`)); `idempotency_key` (S, I, D). Schema `pgboss`: USAGE; `version`, `queue` (S); `job_common` (I, S(`id`, `start_after`)) — the spike set. Never S on `job_common` payload columns, never anything on `job`, `bam`, `schedule`, `subscription`, `warning`, `queue_stats`, `job_dependency`. Database: CONNECT (PUBLIC default). No sequence (all ids are `uuid` defaults).
- `crm_worker`, schema `pgboss` only: USAGE; operation set measured = `start()` with `supervise: true`, `schedule: true`, `migrate: false`, `createSchema: false`, `reindex: false`, `persistQueueStats: false`, `persistWarnings: false`; `work()` and `fetch()`; `complete()`; a handler throw (retry with backoff); retries exhausted (dead letter); `expireInSeconds` exceeded (maintenance fails it); `retentionSeconds`/`deleteAfterSeconds` passed (maintenance deletes it); `schedule()` and a cron fire; `unschedule()`; `boss.retry()` on a failed job (the admin command, Task 18); `stop()`. Starting guess, to be measured: `version` (S, U), `queue` (S, U), `job_common` (S, I, U, D), `job` (S), `job_dependency` (S, U, D), `schedule` (S, I, U, D), `subscription` (S), `bam` (S, U), `warning` (none, persistence off), `queue_stats` (none, persistence off). **Nothing** in `public` (TEN-02 condition, Bob R11; catalog-tested).
- `crm_purge`: exactly the spec's Phase 1 allow-list: CONNECT and USAGE on `public` (PUBLIC defaults), INSERT on `audit_log`; nothing else. No sequence (`audit_log.id` is a `uuid` default). TEMPORARY on the database is **revoked from PUBLIC** in migration 0001, because the spec's allow-list does not include it and no role needs temporary tables.
- `crm_link_resolver`: nothing beyond CONNECT and `public` USAGE through PUBLIC (it is `NOLOGIN`, so they cannot be used).
- `PUBLIC`: CONNECT on the database, USAGE on `public`, nothing else (no TEMPORARY, no EXECUTE on any project or pg-boss function, no table).
- `crm_migrator`: owner of the database, of schemas `public` (through `pg_database_owner`), `pgboss` and `drizzle`, and of every object; not in the manifest (ownership), but the test asserts it is the owner of every table and function in those schemas and has no superuser, `BYPASSRLS`, `CREATEROLE`, `CREATEDB` or `REPLICATION`.

### Settled item 3 — Bob spec Round 21 P2: Phase 1 polymorphic-reference tests vs the phase that creates each table

**Which reading holds:** the per-table tests run **in the phase whose migration creates the table**. Phase 1 builds the generic mechanism, two trigger functions (`poly_ref_check_insert()` for "the referenced row exists in the same workspace" and `poly_ref_forbid_retarget()` for "the target columns and `workspace_id` never change"), and tests it on **test-only fixture tables** created inside the Testcontainers database by the test itself (never by a migration), plus the generic `version_retention`-style checks (two partial unique indexes, the `num_nonnulls(...) = 1` CHECK) on a fixture table. Each later migration that creates one of the five tables attaches the two triggers and ships the spec's per-reference tests in the same PR.

Why: revision 7 (part (b1)) says the tables `crm_purge` acts on are created in Phase 3 onward, and the Phase 1 catalog test requires INSERT on `audit_log` to be `crm_purge`'s **only** table privilege. Creating `share_link`, `document_artifact`, `signature`, `line_item` and `version_retention` in Phase 1 would pull their real columns, FKs and (by the per-migration rule) `crm_purge` SELECT grants into Phase 1, which contradicts (b1) and builds tables before their features (UNI-05). The reading "tests run in the phase that creates the table" keeps every rule; it moves one done-when clause.

Expected creating phase (this plan's reading; each phase plan confirms it): `line_item` and `document_artifact` — Phase 4 (quick invoice lines; PDF at send); `version_retention` — Phase 5 (quote versions and quote → invoice); `share_link` and `signature` — Phase 7 (client links, OTP approval); Phase 8 reuses `signature` and `share_link` for agreements.

**This moves a done-when clause: ASK 2 — Charlie's OK is needed** (`PROJECT.md` §11). Exact spec edits: E1 (Phase 1 row), E2 (Phase 4, 5 and 7 rows), E4 (Tenancy "Tests, per reference"), E5 (Verification "Polymorphic references…"). If Charlie says no, the alternative is to create minimal versions of the five tables in Phase 1, which then requires changing revision 7 part (b1) (an owner decision and a reviewed spec revision) — not proposed.

### Settled item 4 — spec Status-line label

Revision 7 is approved and merged: Bob's spec review **Round 24** (2026-10-20) returned **Approved with conditions** at hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451` (PR #31 head `4ec37c3`), and PR #31 merged to `main` as **`7f7178a`**; `setup` reconciled `PROJECT.md` and `CLAUDE.md` in PR #32 (`d3bfff0`, merged `4bf02f9`). The spec still says "draft" and "pending Bob's confirmation" in its title (line 1), Status (line 3), the "Changes in v4.7" heading (line 11) and item 8's lead, and in Current gates (a) (line 1154). Exact edits: E7 to E10. They are made **only in Task 30**, a separate spec PR opened after this plan PR (#33) is merged; Bob reviews that PR's exact spec hash (`review spec`) and its final head (`review <N>`), Charlie approves and merges it, and then `setup` reconciles `PROJECT.md` §2 and §11 (P1 to P5) in its own PR. The exact order is in "Order of the plan, spec and reconcile PRs".

### Settled item 5 — smaller choices the spec leaves to the plan

- **Role creation and passwords.** Roles are cluster objects. A bootstrap step (`apps/web/src/db/bootstrap.ts`, CLI `pnpm db:bootstrap`, image command `bootstrap`) run with an admin connection creates or updates the five roles, sets passwords from env (`CRM_MIGRATOR_PASSWORD`, `CRM_APP_PASSWORD`, `CRM_WORKER_PASSWORD`, optional `CRM_PURGE_PASSWORD`), makes `crm_migrator` the database owner and gives `crm_migrator` membership in `crm_link_resolver` `WITH INHERIT FALSE, SET TRUE` (spec: "a member of it only so migrations can set ownership"). Migrations never contain a password and `crm_migrator` never holds `CREATEROLE`. Alternative: `crm_migrator WITH CREATEROLE` creating roles in migrations (rejected: wider migrator rights; passwords would still need a separate step).
- **Worker connection variable:** `DATABASE_WORKER_URL` (pooled, `crm_worker`). The spec's env list says the name was to be set in the Phase 0 plan patch, which never named it (spec edit E11, label only).
- **Job data carries `workspaceId`.** A handler must know the workspace before it can read the `domain_event` row under RLS, so job data is `{ workspaceId, eventId }` (and `{ workspaceId, … ids }` for other jobs). Both are IDs, so the spec rule "job payloads carry IDs only" holds; the spec's example `{ eventId }` is illustrative. The handler loads the event inside `withWorkspace(workspaceId)` and fails the job if the row is not found there.
- **Better Auth rate-limit storage:** `customStorage`, not `storage: "database"`. The spec allows this ("otherwise Better Auth gets a custom storage whose consume is this same single statement on its table"). 1.7.6's database storage does not meet the spec: its window slides with every grant (spec: fixed window), its check is a read then a conditional write with retries (spec: one atomic statement), and its pruning deletes rows of every key older than its own longest window, which would erase the app limiter's 24-hour counters in the shared table.
- **Sign-in "5 failures per 15 min per account":** each sign-in request consumes one unit of the account key **before** Better Auth runs; on a successful sign-in the unit is given back with a statement scoped to the reserved window (the same reservation pattern the spec defines for the non-resolving gate). So only failures stay counted, the check is atomic, and an unknown email is counted exactly like a known one.
- **Rate-limit HMAC key:** derived with HKDF-SHA-256 from `AUTH_SECRET` (`info = "crm:rate-limit-key:v1"`), so no new secret. Rotating `AUTH_SECRET` resets account counters (runbook).
- **`stepUp()`** is not built in Phase 1: its first user is Phase 2 (bank details). UNI-05.
- **Better Auth role names.** Phase 1 only has workspace creators (`owner`). `requireWorkspaceMember(minRole)` accepts stored roles `owner`, `admin`, `staff` and refuses any other value (fail closed). Mapping Better Auth's default `member` role to `staff` is decided in Phase 3 with invitations.
- **Connection budget (R4), final starting sizes:** web postgres.js `max: 10` (unchanged), web pg-boss `max: 2`, worker postgres.js (`crm_app`) `max: 3`, worker pg-boss (`crm_worker`) `max: 3`, migrator 1 (direct, short-lived), purge `max: 1` (Phase 9). Per web replica 12, worker 6.

## Review Focus

1. **A runtime role with a privilege nobody listed** (for example PUBLIC EXECUTE on a pg-boss function, or `crm_worker` SELECT on a `public` table). Expected: `privileges.test.ts` fails and names the role, object and privilege. Owner: Tasks 3, 13, 16, 17.
2. **A tenant query on a pooled connection where a previous transaction set the workspace.** Expected: a bare query returns 0 rows (no `22P02`), and a query in workspace A never sees B's rows. Owner: Tasks 5, 6.
3. **A forged `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, `CF-Connecting-IP` or internal client-IP header** on `/api/auth/*` and through a form. Expected: the key is the edge-set IP; rotating the forged value never gets past the cap. Owner: Task 22.
4. **A transaction that emits an event and rolls back.** Expected: no `domain_event` row and no job, ever. Owner: Task 19.
5. **pg-boss maintenance through PgBouncer as `crm_worker` for a full cycle.** Expected: no `42501`, no error event, expired jobs failed and old jobs deleted. Owner: Task 20.
6. **A mutating server action outside `action()`**: in a `"use server"` file with any name or path, or as an extra export beside a named Better Auth forwarder, or as extra work (a DB write, `fetch`, an unlisted import) inside a named forwarder. Expected: `pnpm lint` fails; a new mutating `route.ts` fails the entry-point test. Owner: Task 15.
7. **A money amount above 2^53 in an event payload.** Expected: it is stored and read back as the exact decimal string; a raw `bigint` is refused before any write. Owner: Task 19.

---

## File Structure

Existing files are marked *(modify)*; every other path is **new**.

```
.env.example                                  (modify) role URLs, DATABASE_WORKER_URL, TRUSTED_CLIENT_IP_HEADER, EMAIL_*, bootstrap vars
.github/workflows/ci.yml                      (modify) test:gates step, checks timeout
eslint.config.mjs                             (modify) TEN-09, TEN-10, AUTH-01 and `pg` import rules
package.json                                  (modify) db:bootstrap, test:gates scripts
docker/compose.dev.yml                        (modify) admin superuser, bootstrap service, role URLs, mailpit
docker/entrypoint.sh                          (modify) `bootstrap` command
docs/runbooks/phase-1-database-roles.md       roles, bootstrap, measured grants, rotation
docs/runbooks/phase-1-security.md             rate limits, trusted client IP, CSP/headers, email
docs/runbooks/phase-0-auth-database.md        (modify) pointers to the Phase 1 runbooks
docs/DECISIONS.md                             (modify) one entry per PR
packages/core/package.json                    (modify) exports ./audit, ./events
packages/core/src/security/limits.ts          (modify) rate-limit numbers, idempotency expiry (ASK 4)
packages/core/src/security/limits.test.ts     (modify)
packages/core/src/audit/redact.ts, redact.test.ts      redactPii()
packages/core/src/events/names.ts, names.test.ts       Part 1 event-name set, EventName type
packages/core/src/events/payload.ts, payload.test.ts   EventPayload, MinorUnits, minorUnits(), parseMinorUnits()
apps/web/package.json                         (modify) pg-boss, nodemailer, @react-email/render; scripts
apps/web/vitest.config.mts                    (modify) exclude *.gate.test.ts
apps/web/vitest.gates.config.mts              the pooler gate project
apps/web/proxy.ts                             nonce CSP (Next 16 proxy)
apps/web/next.config.ts                       (modify) static security headers
apps/web/worker.ts                            (modify) pg-boss worker entry
apps/web/scripts/bootstrap-roles.ts           CLI for bootstrapRoles()
apps/web/scripts/retry-job.ts                 admin command: retry a failed job (EVT-05)
apps/web/scripts/build-node.mjs               (modify) bundle dist/bootstrap.mjs
apps/web/drizzle/0001_privileges_baseline.sql            custom
apps/web/drizzle/0002_workspace_settings.sql             generated
apps/web/drizzle/0003_rls_workspace_settings.sql         custom
apps/web/drizzle/0004_billing_account.sql                generated
apps/web/drizzle/0005_poly_ref_functions.sql             custom
apps/web/drizzle/0006_audit_log.sql                      generated
apps/web/drizzle/0007_rls_audit_log.sql                  custom (incl. crm_purge INSERT + policy)
apps/web/drizzle/0008_idempotency_key.sql                generated
apps/web/drizzle/0009_rls_idempotency_key.sql            custom
apps/web/drizzle/0010_pgboss_install.sql                 custom (getConstructionPlans output, pg-boss 12.35.0)
apps/web/drizzle/0011_pgboss_queues_grants.sql           custom
apps/web/drizzle/0012_domain_event_notification.sql      generated
apps/web/drizzle/0013_rls_domain_event_notification.sql  custom
apps/web/drizzle/0014_rate_limit.sql                     generated
apps/web/drizzle/0015_auth_audit_log.sql                 generated (Task 31; drizzle-kit numbers it after PR 4's other migrations)
apps/web/drizzle/0016_grants_auth_audit_log.sql          custom (crm_app INSERT only)
(numbers are indicative; drizzle-kit assigns them in commit order)
apps/web/src/db/bootstrap.ts, bootstrap.test.ts          bootstrapRoles()
apps/web/src/db/privileges.ts, privileges.test.ts        manifest + effective-privilege test
apps/web/src/db/workspace.ts, workspace.test.ts          withWorkspace(), runInWorkspace()
apps/web/src/db/rls.test.ts                              policy lint, RESTRICTIVE catalog, no-RLS allow-list
apps/web/src/db/isolation.test.ts                        two-workspace read/write isolation, every tenant table
apps/web/src/db/schema-fk.test.ts                        composite-FK catalog test
apps/web/src/db/poly-ref.test.ts                         polymorphic helper on fixture tables
apps/web/src/db/purge-role.test.ts                       crm_purge part (b1) catalog + behavioural
apps/web/src/db/lint-rules.test.ts                       lint fixtures (TEN-09, TEN-10, AUTH-01, pg ban)
apps/web/eslint/server-action-wrapper.mjs                AUTH-01 local lint rule (every "use server" export)
apps/web/eslint/forwarding-actions.mjs                   named Better Auth forwarding exports (AUTH-01 exemptions)
apps/web/src/app/entry-points.test.ts                    classification of every route.ts / proxy entry point
apps/web/src/db/schema/index.ts               (modify) barrel
apps/web/src/db/schema/auth.ts                (modify, regenerated) organization.billing_account_id
apps/web/src/db/schema/tenancy.ts             workspace_settings
apps/web/src/db/schema/system.ts              billing_account, rate_limit, auth_audit_log
apps/web/src/db/schema/audit.ts               audit_log
apps/web/src/db/schema/events.ts              domain_event, notification
apps/web/src/db/schema/idempotency.ts         idempotency_key
apps/web/src/db/system/index.ts               system-module barrel (the TEN-10 allow-list)
apps/web/src/db/system/workspaces.ts          membership/role reads, workspace creation side effects
apps/web/src/db/system/billing.ts             billing_account
apps/web/src/db/system/users.ts               user email lookup for jobs
apps/web/src/db/system/rate-limit.ts          consume(), giveBack(), cleanupExpired()
apps/web/src/db/system/auth-audit.ts          recordAuthEvents() (the only writer of auth_audit_log; no reader in Phase 1)
apps/web/src/db/system/authorization.test.ts  two-workspace system-module tests
apps/web/src/db/system/rate-limit.test.ts     atomic consume, concurrency, window boundary
apps/web/src/lib/env.ts                       (modify) worker env, client-IP and email settings
apps/web/src/lib/auth/config.ts               (modify) customStorage, customRules, ipAddressHeaders, disabledPaths, hooks, crmAuthAudit plugin
apps/web/src/lib/auth/auth-audit-plugin.ts    crmAuthAudit(): Better Auth after-hooks that call recordAuthEvent() (Task 31)
apps/web/src/lib/auth/auth-audit.test.ts      sign-in and 2FA rows in auth_audit_log (Task 31)
apps/web/src/lib/auth/client-ip.ts, client-ip.test.ts    deriveClientIp(), prepareAuthRequest()
apps/web/src/lib/auth/handle.ts               handleAuthRequest(): IP, enabled paths, account keys, uniform 429
apps/web/src/lib/auth/enabled-paths.ts        Phase 1 enabled Better Auth paths
apps/web/src/lib/auth/rate-limit.test.ts      Verification "Rate limits and /api/auth/*" (Phase 1 parts)
apps/web/src/lib/auth/enabled-paths.test.ts   enabled-path, cross-origin and input-limit tests
apps/web/src/lib/auth/forward.ts              (modify) drop x-forwarded-for, call handleAuthRequest
apps/web/src/lib/auth/forward.test.ts         (modify)
apps/web/src/app/api/auth/[...all]/route.ts   (modify) call handleAuthRequest
apps/web/src/lib/auth/action.ts, action.test.ts          action(), requireWorkspaceMember()
apps/web/src/lib/audit.ts, audit.test.ts      recordAudit()
apps/web/src/lib/security-headers.ts, security-headers.test.ts   buildCsp(), static header list
apps/web/src/lib/health.ts                    (modify) queue check
apps/web/src/app/api/health/route.ts          (modify)
apps/web/src/jobs/boss.ts                     web send-only instance, worker instance factory
apps/web/src/jobs/enqueue.ts                  enqueueJob(tx, …), emitEvent(tx, …)
apps/web/src/jobs/handlers.ts                 queue → handler registry
apps/web/src/jobs/domain-event.ts             dispatch to core handlers (none in Phase 1)
apps/web/src/jobs/email-send.ts               email.send handler
apps/web/src/jobs/cleanup.ts                  rate-limit and idempotency cleanup handlers
apps/web/src/jobs/*.test.ts                   transactional enqueue, retry/dead-letter, handlers
apps/web/src/jobs/pooler.gate.test.ts         60 s+ maintenance cycle through PgBouncer
apps/web/src/worker/start.ts, start.test.ts   (modify) start pg-boss worker
apps/web/src/adapters/email/index.ts          EmailAdapter interface + factory
apps/web/src/adapters/email/smtp.ts, resend.ts
apps/web/src/adapters/email/contract.test.ts  adapter contract tests
apps/web/src/emails/test-email.tsx            React Email template
apps/web/src/app/(app)/settings/email/page.tsx, actions.ts, send-test-email-form.tsx
apps/web/src/test/postgres.ts                 (modify) startDatabase(): roles, URLs, migrations
apps/web/src/test/catalog.ts                  catalog queries shared by the schema tests
apps/web/src/test/pgbouncer.ts                PgBouncer container helper
apps/web/src/test/mailpit.ts                  Mailpit API helper (E2E)
apps/web/e2e/security-headers.spec.ts         CSP present, no violations
apps/web/e2e/test-email.spec.ts               web → job → Mailpit
apps/web/playwright.config.ts                 (modify) worker as a second webServer
```

## PR checkpoints

One logical change per PR. Stop at each checkpoint: push, open the PR (what, why, test plan, drafting model, self-check table), wait for Bob's review, `approved <n>`, Charlie's merge and `merged <n>`, then cut the next branch from the updated `main`. PR 1 is the first PR of the milestone and of a new module, so the builder asks Charlie before starting it (`roles/builder.md` §8), and only after the plan, spec and reconcile PRs below are merged.

| PR | Branch | Tasks | Model (`PROJECT.md` §6) | Verification delivered |
|---|---|---|---|---|
| 1 | `feat/p1-db-roles` | 1–3 | Opus 5.5 (roles, grants) | no-`BYPASSRLS` `pg_roles` test; effective-privilege manifest test (Better Auth tables); PUBLIC EXECUTE revoke; TEN-01/02 Phase 0 exception closed |
| 2 | `feat/p1-rls` | 4–7 | Opus 5.5 (RLS) | policy lint (`nullif`); RESTRICTIVE-policy catalog test; `set_config` + `nullif` bare-query test on a reused connection; `withWorkspace` lint rule; isolation test on every tenant table |
| 3 | `feat/p1-system-module` | 8–11 | Opus 5.5 (auth, tenancy); Sonnet 5 allowed for Task 9's schema typing | no-RLS allow-list test; TEN-10 lint fixture; system-module authorization tests over two workspaces; composite-FK schema test; polymorphic helper on fixtures |
| 4 | `feat/p1-action-audit` | 12–15, 31 (31 runs after 15) | Opus 5.5 (auth, roles) | audit PII redaction; `crm_purge` (b1) catalog + behavioural tests; no DELETE/UPDATE/TRUNCATE on `audit_log` (Scalability, part 1) or `auth_audit_log`; idempotency replay; AUTH-01 lint (every `"use server"` export) and entry-point classification; sign-in / 2FA rows in `auth_audit_log` (Task 31, ASK 3 = B; needs spec revision 8 approved, which the PR order already requires before PR 1) |
| 5 | `feat/p1-pgboss` | 16–18 | Opus 5.5 (grants) | pg-boss installed by migration; `crm_app` cannot read job payloads; `crm_worker` exact grants measured and recorded; retry and dead-letter; `pg` ban |
| 6 | `feat/p1-events` | 19–20 | Opus 5.5 | rolled-back transaction leaves no event and no job; no DELETE/UPDATE/TRUNCATE on `domain_event` (Scalability, part 2); pooler maintenance gate (60 s+); `/api/health` queue |
| 7 | `feat/p1-rate-limits` | 21–24 | Opus 5.5 (auth) | Verification "Rate limits and `/api/auth/*`", every Phase 1 part |
| 8 | `feat/p1-headers-email` | 25–29 | Opus 5.5 for Task 25 (CSP); Sonnet 5 for Tasks 26–27 (adapters, template, compose) and Task 29 (docs); Opus 5.5 reviews Task 27's `action()` use | nonce CSP + headers test; adapter contract tests (SMTP vs Resend); test email web → job → Mailpit in `pnpm dev` and `docker compose up`; Phase 1 done-when run |

Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. PR 7 needs PR 5–6 (the cleanup jobs run in the worker) and PR 4 (idempotency table for its cleanup). PR 8 needs PR 4 (`action()`) and PR 6 (jobs).

### Order of the plan, spec and reconcile PRs

PR 1 above does not start until steps 1–4 below are done, in this order. Each step names the commit or hash it uses; a step whose commit differs from the one named stops and goes back to the owner.

1. **Plan PR #33** (branch `docs/phase-1-plan`). Contains this plan and its `docs/DECISIONS.md` entry only — no spec, `PROJECT.md` or `CLAUDE.md` change (check: `git diff --stat origin/main...HEAD` lists exactly those two files). Uses spec hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451` (unchanged by this PR).
   1. The builder pushes the fixes; the PR's **final head** `<H33>` is the host's head SHA.
   2. Bob runs `review 33` on `<H33>`; the newest round in `.agent/reviews/PR-33.md` records `<H33>` and says Approved or Approved with conditions. Any new commit means a new round on the new head.
   3. Charlie runs `approved 33` **before merging**: it checks that the round's head equals the host's head `<H33>` and that the PR is open, archives the review and writes the receipt for `<H33>` on the log branch.
   4. Charlie merges PR #33 (merge commit `<M33>` on `main`).
   5. `merged 33` writes the PR log; it must find the receipt for `<H33>` written before the merge time.
2. **Spec PR — Task 30** (branch `docs/spec-v4.7-rev8-phase1-plan-alignment`, cut from `main` at `<M33>`; PR number `<N>`). Contains spec revision 8 (edits E1–E12; E12 is ASK 3 = B, the `auth_audit_log` table) and its `docs/DECISIONS.md` entry; nothing else.
   1. The builder makes Task 30's commits and pushes; the PR's final head is `<HN>` and `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` at `<HN>` is `<S8>`. Both go in the PR body.
   2. Bob runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` on the checkout of `<HN>`; the round in `.agent/reviews/SPEC-core-sales-design.md` records hash `<S8>` and pins PR head `<HN>` (as Rounds 22–24 did for PR #31). A fix commit changes `<HN>` and usually `<S8>`; Bob reviews the new pair. This round is what `build`'s spec gate reads later (step 4).
   3. The owner decisions revision 8 records are in the spec and DECISIONS **before** Bob's final round, so `<S8>` already holds them: ASK 1, ASK 2 and ASK 3 (answered 2026-10-20, quoted in Task 30). After Bob's Approved spec round, Charlie approves revision 8 at `<S8>`.
   4. Bob runs `review <N>` on the **same** final head `<HN>`; the round in `.agent/reviews/PR-<N>.md` records head `<HN>`, the spec hash `<S8>` it read at that head, and Approved or Approved with conditions. Both reviews must name the same `<HN>` and `<S8>`: if either differs (a commit after one review), both are re-run on the new head and hash. This is what `approved <N>` reads (`agents/START.md` `approved <number>` step 1 takes `PR-<number>.md`, not the SPEC file).
   5. Charlie runs `approved <N>` **before merging**: the newest `PR-<N>.md` round is Approved and its head equals the host's head `<HN>`; the PR is open; the whole `PR-<N>.md` is archived and the receipt names `<HN>` and `PR-<N>.md`'s hash.
   6. Charlie merges (merge commit `<MN>`); `merged <N>` writes the log: the final `PR-<N>.md` round's head must equal the PR's final head `<HN>`, and the receipt for `<HN>` must predate the merge.

   **Path chosen: no kit change.** This follows the PR #31 pattern with one deliberate tightening: PR #31 had only the SPEC review (Rounds 22–24) and its receipt `PR-31.receipt` used the spec review file, which `approved <number>` step 1 does not name. Here the spec PR gets both a `review spec` (for `build`'s spec gate) and a `review <N>` (for `approved <N>` and `merged <N>`), so every kit step finds the file it reads. `agents/START.md` is not changed.
3. **`setup` reconcile PR** (branch `chore/setup-reconcile-v4-7-rev8`, cut from `main` at `<MN>`; PR number `<R>`). First check `git hash-object` of the spec on `<MN>` equals `<S8>` (the merged blob is the reviewed blob); otherwise stop. `setup` (Part B reconcile) makes P1, P2 (§2 hash = `<S8>`), P3, P5, P8 and P9 in `agents/PROJECT.md` and the `CLAUDE.md` Status line; P4, P6 and P7 wait for the PRs named in them. The builder pushes; the final head is `<HR>`. Then Bob runs `review <R>` on `<HR>` (round in `.agent/reviews/PR-<R>.md` with head `<HR>`), Charlie runs `approved <R>` before merge (round head = host head `<HR>`), merges (`<MR>`), and `merged <R>` checks the round and receipt for `<HR>`, as for PR #32. No `review spec` is needed: the spec blob is unchanged (`<S8>`).

   **Simulation against `agents/START.md`** (each row: the command, the file it reads, the head and hash it must match):

   | Step | Command | File read | Head / hash used |
   |---|---|---|---|
   | 1.2 | `review 33` | writes `.agent/reviews/PR-33.md` | head `<H33>`; spec `50acbcfe…` |
   | 1.3 | `approved 33` | `PR-33.md` newest round | round head = host head `<H33>` |
   | 1.5 | `merged 33` | `PR-33.md` (archived) + `PR-33.receipt` | final head `<H33>`; receipt before merge `<M33>` |
   | 2.2 | `review spec <spec path>` | writes `.agent/reviews/SPEC-core-sales-design.md` | hash `<S8>` at head `<HN>` |
   | 2.4 | `review <N>` | writes `.agent/reviews/PR-<N>.md` | head `<HN>`; spec `<S8>` (same pair as 2.2) |
   | 2.5 | `approved <N>` | `PR-<N>.md` newest round | round head = host head `<HN>`; receipt names `PR-<N>.md` hash |
   | 2.6 | `merged <N>` | `PR-<N>.md` (archived) + `PR-<N>.receipt` | final head `<HN>`; receipt before merge `<MN>` |
   | 3 | `setup` (Part B reconcile) | spec at `<MN>`; `PROJECT.md` | `git hash-object` = `<S8>`; §2 set to `<S8>` |
   | 3 | `review <R>` | writes `.agent/reviews/PR-<R>.md` | head `<HR>` |
   | 3 | `approved <R>` | `PR-<R>.md` newest round | round head = host head `<HR>` |
   | 3 | `merged <R>` | `PR-<R>.md` (archived) + `PR-<R>.receipt` | final head `<HR>`; receipt before merge `<MR>` |
   | 4 | `build` | SPEC file round for `<S8>`; `PROJECT.md` §2 | spec gate `<S8>` Approved; reconcile gate §2 = `<S8>` |
4. **PR 1 of the build** (`feat/p1-db-roles`, from `main` after `<R>` merged). `build` runs its two gates against `main`: the spec gate (an Approved round in the SPEC review file for `<S8>`) and the reconcile gate (`<S8>` = **Spec hash at last reconcile** in `PROJECT.md` §2). Both pass only after steps 2 and 3. Then the builder asks Charlie before starting PR 1 (`roles/builder.md` §8).

---

## PR 1 — `feat/p1-db-roles` (Tasks 1–3)

**Guardrails:** TEN-01, TEN-02 (hard), TEN-03, UNI-02, UNI-07 (hard), UNI-08, UNI-13, UNI-14, UNI-15, UNI-16. §9 "Database roles (five, none with `BYPASSRLS`)", the TEN-02 ruling (Bob R11), and the expiring Phase 0 TEN-01/02 exception (`docs/DECISIONS.md` 2026-10-03), which this PR ends.

### Task 1: Bootstrap the five roles

**Files:**
- Create: `apps/web/src/db/bootstrap.ts`, `apps/web/src/db/bootstrap.test.ts`, `apps/web/scripts/bootstrap-roles.ts`
- Modify: `apps/web/src/test/postgres.ts`, `apps/web/package.json` (script `db:bootstrap`), root `package.json` (script `db:bootstrap`), `apps/web/scripts/build-node.mjs` (bundle `dist/bootstrap.mjs`), `docker/entrypoint.sh` (command `bootstrap`)

**Interfaces:**
- `bootstrapRoles(adminSql: postgres.Sql, passwords: { migrator: string; app: string; worker: string; purge?: string }): Promise<void>` — idempotent.
- `startDatabase(): Promise<TestDatabase>` where `TestDatabase = { container; adminUrl; migratorUrl; appUrl; workerUrl; purgeUrl; stop() }`; it starts `postgres:17-alpine`, runs `bootstrapRoles` with fixed test passwords (`purge` included), then `runMigrations(migratorUrl)`. `adminUrl` (the container superuser) is used **only** by schema tests that must bypass grants (spec: "the Testcontainers superuser, used only in this schema test").

- [ ] **Step 0: Start the PR 1 branch**

```bash
git switch main && git pull --ff-only
git switch -c feat/p1-db-roles
eval "$(fnm env --use-on-cd --shell zsh)"; fnm use 24.21.0; node --version   # v24.21.0
```

- [ ] **Step 1: Write the failing test** `apps/web/src/db/bootstrap.test.ts`. Against a fresh container (superuser connection), call `bootstrapRoles` twice (idempotency), then assert from `pg_roles`:
  - for each of `crm_migrator`, `crm_app`, `crm_worker`, `crm_purge`, `crm_link_resolver`: `rolsuper`, `rolbypassrls`, `rolcreaterole`, `rolcreatedb`, `rolreplication` all `false`;
  - `rolcanlogin`: true for `crm_migrator`, `crm_app`, `crm_worker`, `crm_purge`; false for `crm_link_resolver`;
  - `crm_purge.rolconnlimit = 2`; `crm_purge.rolinherit = false`;
  - `pg_database.datdba` of `current_database()` is `crm_migrator`;
  - `pg_auth_members`: exactly one row among the five roles — member `crm_migrator`, role `crm_link_resolver`, `inherit_option = false`, `set_option = true`; no row has `roleid` in (`crm_purge`, `crm_app`, `crm_worker`, `crm_migrator`);
  - connecting with each password works for the four login roles; a second call with a new `app` password changes it (old one refused with `28P01`).

- [ ] **Step 2: Run it to verify it fails.** `pnpm vitest run apps/web/src/db/bootstrap.test.ts` → FAIL, `Failed to resolve import "./bootstrap"`.

- [ ] **Step 3: Implement `bootstrapRoles`.** One transaction on the admin connection. For each role, `DO $$ … IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '<r>') THEN CREATE ROLE <r>; END IF; END $$`, then `ALTER ROLE` with the full attribute list every time (so a rerun repairs drift):
  ```sql
  ALTER ROLE crm_migrator LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION INHERIT;
  ALTER ROLE crm_app      LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION INHERIT;
  ALTER ROLE crm_worker   LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION INHERIT;
  ALTER ROLE crm_purge    LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION NOINHERIT CONNECTION LIMIT 2;
  ALTER ROLE crm_link_resolver NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION NOINHERIT;
  GRANT crm_link_resolver TO crm_migrator WITH INHERIT FALSE, SET TRUE;
  ```
  Passwords: `select format('ALTER ROLE %I PASSWORD %L', $1, $2) as stmt` with bound role and password, then `sql.unsafe(stmt)` (utility statements take no bind parameters; `format('%L')` quotes the value). The purge password is set only when given; otherwise `ALTER ROLE crm_purge PASSWORD NULL`. Database owner: `select format('ALTER DATABASE %I OWNER TO crm_migrator', current_database())`, executed the same way. Never log a statement (it holds a password).

- [ ] **Step 4: CLI and image command.** `apps/web/scripts/bootstrap-roles.ts` reads `DATABASE_ADMIN_URL`, `CRM_MIGRATOR_PASSWORD`, `CRM_APP_PASSWORD`, `CRM_WORKER_PASSWORD`, optional `CRM_PURGE_PASSWORD` with a Zod schema (each password at least 16 characters; names in the error, never values — same style as `parseEnv`), calls `bootstrapRoles`, prints `{"level":"info","msg":"roles bootstrapped"}`. `build-node.mjs` adds the entry `dist/bootstrap.mjs`. `docker/entrypoint.sh` adds `bootstrap) exec node dist/bootstrap.mjs ;;`. Scripts: apps/web `"db:bootstrap": "tsx --env-file=../../.env scripts/bootstrap-roles.ts"`; root `"db:bootstrap": "pnpm --filter @crm/web db:bootstrap"`.

- [ ] **Step 5: `startDatabase()`** in `apps/web/src/test/postgres.ts` as in Interfaces; keep `startPostgres()` and `MIGRATIONS_DIR`.

- [ ] **Step 6: Run the test.** `pnpm vitest run apps/web/src/db/bootstrap.test.ts` → PASS. `pnpm typecheck && pnpm lint` → exit 0.

- [ ] **Step 7: Commit.**
```bash
git add apps/web/src/db/bootstrap.ts apps/web/src/db/bootstrap.test.ts apps/web/scripts apps/web/src/test/postgres.ts apps/web/package.json package.json docker/entrypoint.sh
git commit -m "feat(db): bootstrap the five database roles with no BYPASSRLS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: One connection per role; end the Phase 0 single-user exception

**Files:**
- Modify: `apps/web/src/lib/env.ts`, `apps/web/src/lib/env.test.ts`, `.env.example`, `docker/compose.dev.yml`, `apps/web/worker.ts`, `apps/web/src/db/client.test.ts`, `apps/web/src/db/migrate.test.ts`, `apps/web/src/lib/auth/auth.test.ts`, `apps/web/src/worker/start.test.ts`, `docs/runbooks/phase-0-auth-database.md`, `docs/DECISIONS.md`
- Create: `docs/runbooks/phase-1-database-roles.md`

- [ ] **Step 1: Failing env tests.** In `env.test.ts`: `parseWorkerEnv` requires `DATABASE_WORKER_URL` (postgres URL) on top of `parseEnv`; `parseEnv` (web) does not require it; an error lists the names `DATABASE_WORKER_URL`, never values. Run `pnpm vitest run apps/web/src/lib/env.test.ts` → FAIL (`parseWorkerEnv` missing).
- [ ] **Step 2: Implement** `parseWorkerEnv` / `getWorkerEnv` in `env.ts` (`envSchema.extend({ DATABASE_WORKER_URL: postgresUrl })`). `worker.ts` uses `getWorkerEnv()` (the pg-boss part arrives in Task 18; here only the env).
- [ ] **Step 3: Compose.** `postgres` service: `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: postgres-dev-only`, `POSTGRES_DB: crm`. New service `bootstrap` (`<<: *app` image, `command: ["bootstrap"]`, `restart: "no"`, env `DATABASE_ADMIN_URL: postgres://postgres:postgres-dev-only@postgres:5432/crm`, `CRM_MIGRATOR_PASSWORD: crm-migrator-dev-only`, `CRM_APP_PASSWORD: crm-app-dev-only`, `CRM_WORKER_PASSWORD: crm-worker-dev-only`). `web` and `worker` `depends_on: { bootstrap: { condition: service_completed_successfully } }` and env `DATABASE_URL: postgres://crm_app:crm-app-dev-only@postgres:5432/crm`, `DATABASE_MIGRATOR_URL: postgres://crm_migrator:crm-migrator-dev-only@postgres:5432/crm`, `DATABASE_WORKER_URL` (`worker` only) `postgres://crm_worker:crm-worker-dev-only@postgres:5432/crm`. Dev-only fixed credentials bound to `127.0.0.1`, as in Phase 0 (Global Constraints of the Phase 0 plan). The healthcheck becomes `pg_isready -U postgres -d crm`.
- [ ] **Step 4: `.env.example`** host URLs use the three role users on `localhost:5433`, plus commented bootstrap variables (`DATABASE_ADMIN_URL`, `CRM_*_PASSWORD`) with the dev values above and the note "dev only; production passwords come from the host's secret store (UNI-08)".
- [ ] **Step 5: Existing tests connect as the real roles.** `client.test.ts`, `migrate.test.ts`, `auth.test.ts` and `start.test.ts` switch from `startPostgres()` + superuser URI to `startDatabase()`: migrations as `migratorUrl`, everything else as `appUrl` (the worker test as `workerUrl` once Task 18 lands; here `appUrl`). Expected first run: `auth.test.ts` FAILS with `42501 permission denied for table user` — the input for Task 3.
- [ ] **Step 6: Runbook.** `docs/runbooks/phase-1-database-roles.md`: the five roles and what each may do; bootstrap command for dev (`docker compose -f docker/compose.dev.yml down -v` then `pnpm stack:up`, because the Phase 0 volume's tables are owned by the old `crm` superuser), for host dev (`pnpm db:bootstrap` with the commented `.env` values), and for production (run `docker compose run --rm web bootstrap` once per cluster with the admin URL and passwords from the host's secret store); password rotation (rerun bootstrap with new values, then restart `web` and `worker`). Add a pointer line in the Phase 0 runbook's "Database URLs" section.
- [ ] **Step 7: Decisions.** New entry "Phase 1 PR 1: five roles, bootstrap step, connection per role" (Settled items 1, 2, 5). Edit the 2026-10-03 "Phase 0 uses one dev DB user" entry's status line only: "Expired: ended by Phase 1 PR 1 (#<n>)."
- [ ] **Step 8: Run.** `pnpm vitest run apps/web/src/lib/env.test.ts apps/web/src/db` → PASS except `auth.test.ts` (fixed in Task 3). Do not commit a failing suite: continue to Task 3, commit both together.

### Task 3: Privilege baseline, Better Auth grants, the manifest test

**Files:**
- Create: `apps/web/drizzle/0001_privileges_baseline.sql` (custom), `apps/web/src/db/privileges.ts`, `apps/web/src/db/privileges.test.ts`, `apps/web/src/test/catalog.ts`

- [ ] **Step 1: Write the manifest test first.** `apps/web/src/test/catalog.ts` exports `effectivePrivileges(sql, role)` returning sorted strings such as `database:CONNECT`, `schema:public:USAGE`, `table:public.session:SELECT`, `column:pgboss.job_common.id:SELECT`, `function:pgboss.job_now():EXECUTE`, using the functions in Settled item 2 over `pg_namespace` names `public`, `pgboss`, `drizzle` (`pgboss` may not exist yet; skip missing schemas). For `PUBLIC` it uses `aclexplode` on `relacl`/`proacl`/`nspacl`/`datacl` filtered on grantee `0` plus the built-in defaults (`acldefault`) where an ACL is `NULL`. `privileges.ts` exports `EXPECTED_PRIVILEGES: Record<"crm_app" | "crm_worker" | "crm_purge" | "crm_link_resolver" | "PUBLIC", readonly string[]>`. `privileges.test.ts` (on `startDatabase()`, read through `adminUrl`): for each role, `expect(await effectivePrivileges(sql, role)).toEqual([...EXPECTED_PRIVILEGES[role]].sort())`; plus a self-test: in a second schema created by the test (`scratch`), `GRANT SELECT ON scratch.t TO crm_purge` makes `effectivePrivileges` report `table:scratch.t:SELECT` when `scratch` is scanned (proves the helper sees a direct grant), and a function created there by `crm_migrator` after migration 0001 is **not** executable by PUBLIC (proves the default-privileges revoke). Also: owner check (every table and function in `public`, `pgboss`, `drizzle` is owned by `crm_migrator`).
- [ ] **Step 2: Run it.** Fails: PUBLIC has `database:TEMPORARY`; `crm_app` lacks Better Auth table privileges.
- [ ] **Step 3: Migration 0001.** `pnpm db:generate --custom --name privileges_baseline`, then write:
  ```sql
  ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  --> statement-breakpoint
  DO $$ BEGIN EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC', current_database()); END $$;
  --> statement-breakpoint
  -- Better Auth tables (system module, no RLS): the measured set, filled in Step 4
  ```
- [ ] **Step 4: Measure `crm_app` on the Better Auth tables** (Settled item 2 method). Operation set = `auth.test.ts` in full (sign-up, duplicate sign-up, sign-in, 2FA enable/verify/backup code/disable, organization create/list/set-active/update, sign-out, session read) plus the Phase 0 E2E suite against `pnpm dev` with the role URLs. Add the narrowest GRANT for each `42501`. Write the final GRANT lines into 0001 and the same privileges into `EXPECTED_PRIVILEGES.crm_app`. Record the table in the runbook.
- [ ] **Step 5: Run.** `pnpm test` → all pass (Docker running). `pnpm test:e2e` → all pass. `pnpm typecheck && pnpm lint && pnpm build` → exit 0.
- [ ] **Step 6: Commit and PR checkpoint.**
```bash
git add apps/web docs .env.example docker
git commit -m "feat(db): connect as crm_app and crm_migrator; revoke PUBLIC EXECUTE and TEMPORARY; privilege manifest test" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/p1-db-roles
```
Open PR 1. Self-check rows: TEN-01, TEN-02, TEN-03 (n-a until `audit_log`), UNI-07, UNI-08, UNI-13, UNI-15, UNI-16, §9 roles.

## PR 2 — `feat/p1-rls` (Tasks 4–7)

**Guardrails:** TEN-04, TEN-05, TEN-06, TEN-07, TEN-08, TEN-09 (hard), TEN-11 (hard), UNI-04, UNI-15. §9 "Workspace context (complies with TEN-09)", TEN-07 decision (revision 7 (c)), Known risk R1.

### Task 4: Catalog tests for policies (written before the first policy)

**Files:** Create `apps/web/src/db/rls.test.ts`; modify `apps/web/src/test/catalog.ts`.

- [ ] **Step 0: Branch.** `git switch main && git pull --ff-only && git switch -c feat/p1-rls`.
- [ ] **Step 1: Catalog helpers** in `catalog.ts`: `tenantTables(sql)` = every table in `public` whose name is not on `NO_RLS_ALLOW_LIST` (exported constant, filled in Task 8; in this PR the Better Auth tables and `drizzle` are skipped by schema/name); `policies(sql, table)` from `pg_policies` (`policyname`, `permissive`, `roles`, `cmd`, `qual`, `with_check`); `workspacePredicateText(sql)` = the `qual` PostgreSQL prints for the reference predicate, read by creating a table `scratch.rls_reference(workspace_id uuid)` with one policy using the exact predicate text, then dropping it (so the comparison never depends on a hand-typed `pg_get_expr` string).
- [ ] **Step 2: Tests** (all on `startDatabase()`, read via `adminUrl`):
  - *policy lint (R1):* every `qual` and `with_check` in `public` that contains `current_setting(` also contains `NULLIF(current_setting('app.workspace_id'::text, true), ''::text)`; self-test: a fixture policy on a `scratch` table using `current_setting('app.workspace_id', true)::uuid` without `nullif` is reported.
  - *RESTRICTIVE catalog (TEN-07):* for every tenant table: `relrowsecurity` and `relforcerowsecurity` true; exactly one policy with `permissive = 'RESTRICTIVE'`, `cmd = 'ALL'`, `roles = {crm_app,crm_purge}`, `qual` and `with_check` equal to `workspacePredicateText`; every PERMISSIVE policy names only `crm_app` or `crm_purge` (the `share_link_resolve` exception appears in Phase 7), carries the predicate in `qual`/`with_check` as its command needs, and exists only for a command the role holds a table privilege for (cross-checked with `EXPECTED_PRIVILEGES`); no policy names `public`; no policy names `crm_link_resolver`, `crm_worker` or `crm_migrator`. Self-test: a fixture table with a permissive `FOR ALL TO crm_app USING (true)` and no restrictive policy is reported.
  - *empty set guard:* `tenantTables` is not empty (fails until Task 6, by design).
- [ ] **Step 3: Run.** `pnpm vitest run apps/web/src/db/rls.test.ts` → FAIL on the empty-set guard only.

### Task 5: `withWorkspace()` and the TEN-09 lint rule

**Files:** Create `apps/web/src/db/workspace.ts`, `apps/web/src/db/workspace.test.ts`; modify `eslint.config.mjs`; create `apps/web/src/db/lint-rules.test.ts`.

**Interfaces:**
- `runInWorkspace<T>(db: Database, workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T>`
- `withWorkspace<T>(workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T>` = `runInWorkspace(getDb().db, …)`
- `type Tx` = the Drizzle transaction type of `Database`.

- [ ] **Step 1: Failing tests** (`workspace.test.ts`, Testcontainers, `appUrl`, pool `max: 1` so every transaction reuses one server connection; a scratch tenant table `scratch.items` with the policy template, created via `adminUrl` in `beforeAll`, rows seeded in workspaces A and B):
  - inside `runInWorkspace(A)`, `select current_setting('app.workspace_id', true)` returns A and `select * from scratch.items` returns only A's rows;
  - after it commits, on the same connection, `current_setting(…, true)` returns `''` and a bare `select * from scratch.items` returns 0 rows **without** `22P02` (R1);
  - after a rolled-back `runInWorkspace(A)` the same holds;
  - an INSERT of a B row inside `runInWorkspace(A)` fails with `42501` (WITH CHECK);
  - `runInWorkspace("not-a-uuid")` rejects before any SQL with `InvalidWorkspaceIdError`;
  - a `runInWorkspace` called inside another's callback throws `NestedWorkspaceError` (tracked with `AsyncLocalStorage`), so a transaction never mixes two workspaces.
- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement.**
  ```ts
  export async function runInWorkspace<T>(db: Database, workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!z.uuid().safeParse(workspaceId).success) throw new InvalidWorkspaceIdError();
    if (activeWorkspace.getStore() !== undefined) throw new NestedWorkspaceError();
    return activeWorkspace.run(workspaceId, () =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`);
        return fn(tx);
      }),
    );
  }
  ```
- [ ] **Step 4: Lint rule (TEN-09).** In `eslint.config.mjs`, for `apps/web/**` except `apps/web/src/db/workspace.ts`: `no-restricted-syntax` on `TemplateElement[value.raw=/set_config\s*\(|\bSET\s+(LOCAL\s+)?(ROLE|app\.)/i]` and on `Literal[value=/set_config\s*\(/]` with message "Set the workspace only through withWorkspace() (TEN-09)". `lint-rules.test.ts` uses `new ESLint({ cwd: repoRoot })` and `lintText(code, { filePath: "apps/web/src/lib/x.ts" })` on three fixtures (`set_config(…, false)`, `SET app.workspace_id`, `SET LOCAL ROLE`), each expected to report the rule, and on the same text with `filePath: "apps/web/src/db/workspace.ts"` for the `set_config(…, true)` call, expected clean.
- [ ] **Step 5: Run.** `pnpm vitest run apps/web/src/db/workspace.test.ts apps/web/src/db/lint-rules.test.ts` → PASS. `pnpm lint` → exit 0.
- [ ] **Step 6: Commit.** `git commit -m "feat(db): withWorkspace() sets the workspace transaction-locally; lint bans other forms" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 6: `workspace_settings` under RESTRICTIVE + PERMISSIVE RLS, and the isolation harness

**Files:** Create `apps/web/src/db/schema/tenancy.ts`, `apps/web/drizzle/0002_workspace_settings.sql` (generated), `apps/web/drizzle/0003_rls_workspace_settings.sql` (custom), `apps/web/src/db/isolation.test.ts`; modify `apps/web/src/db/schema/index.ts`, `apps/web/src/db/privileges.ts`.

- [ ] **Step 1: Isolation harness test first.** `isolation.test.ts` holds `TENANT_FIXTURES: Record<string, { seed(tx, workspaceId): Promise<void>; update?: …; delete?: … }>` and, for **every** table returned by `tenantTables()`, runs as `crm_app` (A and B both seeded through `runInWorkspace`): read in A sees only A; insert of a B-workspace row in A fails `42501`; update and delete in A of B's row affect 0 rows (where granted); a bare query with no workspace returns 0 rows (R1, rows exist in other workspaces). A table with no `TENANT_FIXTURES` entry fails the test with "no isolation fixture for <table> (TEN-08)".
- [ ] **Step 2: Run** → FAIL ("no isolation fixture for workspace_settings" once the table exists; before that, `rls.test.ts` empty-set guard).
- [ ] **Step 3: Schema.** `workspace_settings`: `workspace_id uuid primary key references organization(id) on delete restrict`, `version integer not null default 1`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. Only these columns in Phase 1; Phase 2 adds the settings it builds (additive, UNI-15). The FK to `organization` is tenant → system and single-column by nature (spec Tenancy). `pnpm db:generate --name workspace_settings`.
- [ ] **Step 4: RLS migration.** `pnpm db:generate --custom --name rls_workspace_settings`; the policy template with `crm_app` commands SELECT, INSERT, UPDATE (no DELETE: workspace deletion is Phase 9). Add the three privileges to `EXPECTED_PRIVILEGES.crm_app`; add the fixture.
- [ ] **Step 5: Run.** `pnpm vitest run apps/web/src/db` → PASS (rls, isolation, privileges, workspace).
- [ ] **Step 6: Commit.** `git commit -m "feat(db): workspace_settings with RESTRICTIVE and PERMISSIVE workspace policies" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 7: Every new workspace gets its `workspace_settings` row

**Files:** Create `apps/web/src/db/system/workspaces.ts`; modify `apps/web/src/lib/auth/config.ts`, `apps/web/src/lib/auth/auth.test.ts`.

- [ ] **Step 1: Failing test** in `auth.test.ts`: after `organization.create`, `runInWorkspace(newId)` reads exactly one `workspace_settings` row with `version = 1`; two workspaces created by one user each have their own row.
- [ ] **Step 2: Run** → FAIL (0 rows).
- [ ] **Step 3: Implement.** Better Auth organization plugin option `organizationHooks.afterCreateOrganization` (name verified in the installed 1.7.6 types before writing; if it differs, use the documented after-create hook of 1.7.6 and record it) calls `ensureWorkspaceSettings(db, organizationId)` in `system/workspaces.ts`, which runs `runInWorkspace(db, organizationId, tx => tx.insert(workspaceSettings).values({ workspaceId }).onConflictDoNothing())`. Because the hook runs after Better Auth's own write, `requireWorkspaceMember` (Task 14) also calls `ensureWorkspaceSettings` once if the row is missing, so a crash between the two writes heals on first use (Risk 6).
- [ ] **Step 4: Run.** `pnpm vitest run apps/web/src/lib/auth/auth.test.ts` → PASS; `pnpm test:e2e` → PASS.
- [ ] **Step 5: Commit and PR checkpoint.** `git commit -m "feat(auth): create workspace_settings with every new workspace" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`; push; open PR 2. Self-check rows: TEN-04–09, TEN-11, UNI-04, UNI-15, §9 workspace context.

## PR 3 — `feat/p1-system-module` (Tasks 8–11)

**Guardrails:** TEN-02 (hard), TEN-08, TEN-10, TEN-11 (hard), AUTH-01 (hard; system-module mutations), AUTH-03, UNI-04, UNI-05. §9 "Better Auth tables and `billing_account` have no RLS…", the locked switch `billing_account.plan = free`.

### Task 8: The system module, its lint rule and the no-RLS allow-list test

**Files:** Create `apps/web/src/db/system/index.ts`; modify `eslint.config.mjs`, `apps/web/src/db/lint-rules.test.ts`, `apps/web/src/db/rls.test.ts`, `apps/web/src/test/catalog.ts`, `apps/web/src/lib/auth/session.ts`.

- [ ] **Step 0: Branch** `feat/p1-system-module` from updated `main`.
- [ ] **Step 1: Failing tests.**
  - `rls.test.ts` *no-RLS allow-list*: the set of tables in `public` and `pgboss` with `relrowsecurity = false` equals exactly `NO_RLS_ALLOW_LIST` (`user`, `session`, `account`, `verification`, `two_factor`, `organization`, `member`, `invitation`, `billing_account`, `rate_limit`) plus every table in schema `pgboss`; schema `drizzle` is the migration ledger, reported separately and asserted to have no privilege for any runtime role (manifest). `billing_account` and `rate_limit` do not exist yet → FAIL until Tasks 9 and 21; in this PR the test uses `NO_RLS_ALLOW_LIST` filtered to existing tables **and** asserts every listed table exists by the end of Phase 1 in Task 29's done-when run.
  - `lint-rules.test.ts` *TEN-10*: a fixture at `apps/web/src/app/(app)/x/actions.ts` that imports `getDb` from `../../../db`, or imports `organization`, `member`, `billingAccount` or `rateLimit` from the schema, reports the rule; the same import at `apps/web/src/db/system/workspaces.ts` is clean.
- [ ] **Step 2: Lint rule.** For `apps/web/**` **except** `apps/web/src/db/**` and `apps/web/src/lib/auth/config.ts` and `apps/web/src/lib/auth/server.ts`: `no-restricted-imports` patterns on `**/db`, `**/db/index`, `**/db/client`, `**/db/schema`, `**/db/schema/*` with message "Use withWorkspace() for tenant data or a function of src/db/system for system tables (TEN-10)". Inside `apps/web/src/db/**`, a second rule restricts `**/schema/system` and `**/schema/auth` imports to `apps/web/src/db/system/**`, `apps/web/src/db/bootstrap.ts` and tests. Allowed imports from app code: `@/db/workspace` (`withWorkspace`, `Tx`) and `@/db/system` (named functions only).
- [ ] **Step 3: Move direct reads behind the module.** `session.ts`'s `listOrganizations` stays a Better Auth API call (Better Auth is configured by the system module through its adapter, spec "System module"); no app file imports a system table afterwards. `pnpm lint` → exit 0.
- [ ] **Step 4: Commit.** `git commit -m "feat(db): system module allow-list enforced by lint; no-RLS allow-list test" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 9: `billing_account` and `organization.billing_account_id`

**Files:** Create `apps/web/src/db/schema/system.ts`, `apps/web/src/db/system/billing.ts`, `apps/web/drizzle/0004_billing_account.sql`; modify `apps/web/src/lib/auth/config.ts`, `apps/web/src/db/schema/auth.ts` (regenerated), `apps/web/src/db/privileges.ts`, `apps/web/src/lib/auth/auth.test.ts`.

- [ ] **Step 1: Failing test** (`auth.test.ts`): a user's first `organization.create` creates one `billing_account` (`owner_user_id` = the user, `plan = 'free'`) and sets `organization.billing_account_id`; the user's second workspace reuses the same billing account; a direct insert with `plan = 'pro'` (through `adminUrl`) fails the CHECK.
- [ ] **Step 2: Schema.** `billing_account`: `id uuid pk default gen_random_uuid()`, `owner_user_id uuid not null references "user"(id) on delete restrict`, `name text not null`, `plan text not null default 'free' check (plan = 'free')` (locked switch until Part 3), `status text not null default 'active' check (status = 'active')` (**ASK 5**: the status list), `stripe_customer_id text null` (stub, Part 3), `limits jsonb not null default '{}'::jsonb`, `created_at timestamptz not null default now()`; unique `(owner_user_id)` (one billing account per owner in Part 1). `organization.billing_account_id uuid null references billing_account(id)` via the organization plugin's `schema.organization.additionalFields` (`input: false`), then `pnpm --filter @crm/web auth:generate` and `pnpm db:generate --name billing_account`. Nullable because existing dev rows predate it (dev volumes are recreated in Task 2; nullable keeps the migration additive, UNI-15).
- [ ] **Step 3: Implement** `ensureBillingAccount(db, userId, name)` in `system/billing.ts` (`insert … on conflict (owner_user_id) do nothing returning id`, then select), called from the organization plugin's before-create hook so the new organization row carries `billing_account_id`. `name` = the user's name at creation (builder default, reported in the PR). Grants: `crm_app` SELECT, INSERT on `billing_account` (manifest).
- [ ] **Step 4: Run.** `pnpm vitest run apps/web/src/lib/auth apps/web/src/db` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(db): billing_account owns workspaces; plan locked to free" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 10: System-module authorization tests over two workspaces

**Files:** Create `apps/web/src/db/system/authorization.test.ts`; modify `apps/web/src/db/system/workspaces.ts`.

**Interfaces:** `getMembership(db, userId, workspaceId): Promise<{ role: "owner" | "admin" | "staff" } | null>` (unknown stored role → `null`).

- [ ] **Step 1: Tests** (Testcontainers, `crm_app`, real Better Auth instance as in `auth.test.ts`). Users U1 (member of W1 only) and U2 (member of W2 only). For every system-module read and mutation that exists in Phase 1 — `getMembership`, `ensureWorkspaceSettings`, `ensureBillingAccount`, and the Better Auth endpoints enabled in Phase 1 that touch `organization`, `member`, `user`, `session`, `account`, `two_factor` (`/organization/set-active`, `/organization/update`, `/organization/list`, `/get-session`, `/list-sessions`, `/revoke-session`, `/update-user`, `/two-factor/*`) — assert:
  - U1 cannot read or change W2 **by ID in the payload** (`organizationId: W2` → 403 or the generic failure; W2 unchanged);
  - **stale active workspace**: U1's session row is edited (via `adminUrl`) to `active_organization_id = W2`; `getMembership(U1, W2)` returns `null` and `requireWorkspaceMember` (Task 14 adds its own case) refuses;
  - U1 cannot revoke U2's session by its id;
  - `getMembership` returns `null` for a stored role outside owner/admin/staff;
  - **invitation token for the other workspace**: invitation endpoints are disabled in Phase 1 (Task 24), so `/organization/accept-invitation` and `/organization/invite-member` answer 404 for any token; the full invitation cases are a Phase 3 done-when.
- [ ] **Step 2: Run** → the stale-session case FAILS until `getMembership` reads `member` by `(user_id, organization_id)` and never trusts the session's active id alone. Implement; rerun → PASS.
- [ ] **Step 3: Commit.** `git commit -m "test(auth): system-module authorization over two workspaces" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 11: Composite-FK schema test and the polymorphic-reference helper

**Files:** Create `apps/web/src/db/schema-fk.test.ts`, `apps/web/src/db/poly-ref.test.ts`, `apps/web/drizzle/0005_poly_ref_functions.sql` (custom).

- [ ] **Step 1: Composite-FK test.** Over `pg_constraint` (`contype = 'f'`) in `public`: for every FK whose referencing **and** referenced tables are both tenant tables, `conkey` and `confkey` include the `workspace_id` column at the same position. Phase 1 has no such FK, so the test also runs a **self-test**: in schema `scratch`, two tenant-shaped fixture tables with a single-column FK are reported, and with a composite `(workspace_id, parent_id) → (workspace_id, id)` FK they are not. FKs from tenant tables to `organization`, `user` and `billing_account` are outside the rule (spec).
- [ ] **Step 2: Polymorphic helper, failing tests first.** `poly-ref.test.ts` creates in schema `scratch` (via `adminUrl`): `target_a(workspace_id uuid, id uuid, unique (workspace_id, id))`, `target_b(…)`, and `ref(workspace_id uuid, id uuid, target_type text, target_id uuid, note text)` under the policy template, with
  ```sql
  CREATE TRIGGER ref_poly_insert BEFORE INSERT ON scratch.ref FOR EACH ROW
    EXECUTE FUNCTION public.poly_ref_check_insert('target_type', 'target_id', 'a=scratch.target_a', 'b=scratch.target_b');
  CREATE TRIGGER ref_poly_retarget BEFORE UPDATE ON scratch.ref FOR EACH ROW
    EXECUTE FUNCTION public.poly_ref_forbid_retarget('workspace_id', 'target_type', 'target_id');
  ```
  and asserts, as `crm_app` inside `runInWorkspace`: a same-workspace insert succeeds; an insert naming another workspace's target (id seeded in B) is rejected by the trigger with SQLSTATE `23503` and message `poly_ref: target not in workspace`; an unknown `target_type` is rejected; an UPDATE of `target_id` to a same-workspace row, of `target_id` to another workspace's row, of `target_type`, and of `workspace_id` are each rejected by the retarget trigger (`23514`, `poly_ref: target is immutable`); updating `note` succeeds. The insert trigger is `SECURITY INVOKER`: it looks for the target with `workspace_id = NEW.workspace_id` as the calling role, under RLS. A target in another workspace is hidden by RLS and also fails the `workspace_id` match, so it is "not in workspace", which is the rule. (`SECURITY DEFINER` would not help: the owner `crm_migrator` has no policy and sees no tenant row under `FORCE`.) The test proves it with B's id. Then the *append-only* variant: a `scratch.ref_ao` with no UPDATE grant to `crm_app` — retarget as `crm_app` fails `42501`, and through `adminUrl` (superuser) fails on the trigger (spec: both layers). Then the *retention-style* fixture: `scratch.retention(workspace_id, qv_id uuid null, psv_id uuid null, source_type text, source_id uuid)` with `CHECK (num_nonnulls(qv_id, psv_id) = 1)` and the two partial unique indexes from spec `version_retention`: a duplicate per target type is rejected (`23505`), neither/both targets rejected (`23514`), `ON CONFLICT DO NOTHING` against the matching partial index inserts nothing.
- [ ] **Step 3: Run** → FAIL (functions missing).
- [ ] **Step 4: Migration 0005** (`pnpm db:generate --custom --name poly_ref_functions`): two `plpgsql` functions, `SECURITY INVOKER`, `SET search_path = pg_catalog, public`, owned by `crm_migrator`. `poly_ref_check_insert()` reads `TG_ARGV[0]` (type column), `TG_ARGV[1]` (id column), then `type=schema.table` pairs; looks up the table for `NEW.<type>`, runs `EXECUTE format('SELECT 1 FROM %s WHERE workspace_id = $1 AND id = $2', <table>) USING NEW.workspace_id, NEW.<id>` and raises if no row. `poly_ref_forbid_retarget()` compares each named column of `OLD` and `NEW` (`to_jsonb(OLD) -> col IS DISTINCT FROM to_jsonb(NEW) -> col`) and raises on any change. No EXECUTE grant to any role (trigger functions; Settled item 2); the manifest stays unchanged and proves it.
- [ ] **Step 5: Run.** `pnpm vitest run apps/web/src/db` → PASS.
- [ ] **Step 6: Commit and PR checkpoint.** `git commit -m "feat(db): composite-FK schema test and polymorphic-reference triggers tested on fixtures" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`; push; open PR 3. The PR body states Settled item 3 and that the per-table tests land with each table (spec edits E1, E2, E4, E5 pending Charlie's OK).

## PR 4 — `feat/p1-action-audit` (Tasks 12–15, then Task 31)

Task 31 is numbered 31 so Tasks 16–30 keep their numbers; it runs in this PR after Task 15 and before the PR 4 checkpoint (numeric order is not run order here).

**Guardrails:** AUTH-01 (hard), AUTH-02, AUTH-03, TEN-02 (hard), TEN-03, TEN-06, TEN-07, TEN-08, TEN-09 (hard), TEN-10, TEN-11 (hard), UNI-03, UNI-09, UNI-10. §9 `crm_purge` Phase 1 scope (b1); §9 no-RLS system tables (with `auth_audit_log` after spec revision 8, E12 / P8).

### Task 12: `audit_log` with PII redaction

**Files:** Create `packages/core/src/audit/redact.ts`, `packages/core/src/audit/redact.test.ts`, `apps/web/src/db/schema/audit.ts`, `apps/web/drizzle/0006_audit_log.sql`, `apps/web/drizzle/0007_rls_audit_log.sql` (custom), `apps/web/src/lib/audit.ts`, `apps/web/src/lib/audit.test.ts`; modify `packages/core/package.json` (export `./audit`), `apps/web/src/db/privileges.ts`, `apps/web/src/db/isolation.test.ts`.

**Interfaces:**
- core: `redactPii<T extends Record<string, unknown>>(value: T | null, piiFields: readonly (keyof T)[]): Record<string, unknown> | null` — every listed field present in `value` becomes the string `"[pii]"`; nested objects are not walked (callers pass flat before/after shapes).
- web: `recordAudit(tx: Tx, entry: { actorUserId: string | null; action: string; targetType: string; targetId: string | null; before?: object | null; after?: object | null; piiFields?: readonly string[]; ip?: string | null }): Promise<void>` — `workspace_id` comes from the transaction's setting (`select nullif(current_setting('app.workspace_id', true), '')::uuid`), never from the caller (TEN-11).

- [ ] **Step 0: Branch** `feat/p1-action-audit`.
- [ ] **Step 1: Failing core test** (`redact.test.ts`): `{ name: "A", email: "a@x", amount: 5 }` with `["name","email"]` → `{ name: "[pii]", email: "[pii]", amount: 5 }`; `null` → `null`; a listed field that is absent stays absent. `pnpm vitest run packages/core/src/audit` → FAIL; implement; → PASS.
- [ ] **Step 2: Schema.** `audit_log`: `id uuid pk default gen_random_uuid()`, `workspace_id uuid not null references organization(id) on delete restrict`, `actor_user_id uuid null references "user"(id) on delete set null`, `action text not null`, `target_type text not null`, `target_id uuid null`, `before jsonb null`, `after jsonb null`, `ip text null`, `created_at timestamptz not null default now()`; index `(workspace_id, created_at)` (spec Scalability). `pnpm db:generate --name audit_log`.
- [ ] **Step 3: RLS + grants** (`pnpm db:generate --custom --name rls_audit_log`): policy template; `crm_app` SELECT, INSERT (PERMISSIVE select + insert); `crm_purge` INSERT only with `CREATE POLICY audit_log_purge_insert ON audit_log AS PERMISSIVE FOR INSERT TO crm_purge WITH CHECK (<predicate>)`. No UPDATE, DELETE or TRUNCATE for anyone but the owner. Manifest: `crm_app` `table:public.audit_log:SELECT`, `…:INSERT`; `crm_purge` `table:public.audit_log:INSERT`. Isolation fixture added.
- [ ] **Step 4: TEN-03 / UNI-10 catalog test, part 1** (in `privileges.test.ts`): for `crm_app`, `crm_worker`, `crm_purge`, `crm_link_resolver` and `PUBLIC`, `has_table_privilege(<r>, 'public.audit_log', 'DELETE' | 'UPDATE' | 'TRUNCATE')` is false; `pg_class.relowner` of `audit_log` is `crm_migrator`. (Part 2 adds `domain_event`, Task 19.)
- [ ] **Step 5: `recordAudit` test** (`audit.test.ts`, `crm_app`): inside `runInWorkspace(A)`, an entry with `piiFields: ["email"]` stores `"[pii]"` for `email` in `before` and `after` and A as `workspace_id`; outside `runInWorkspace` it throws `NoWorkspaceError` before any SQL; `UPDATE audit_log …` as `crm_app` fails `42501`.
- [ ] **Step 6: Run.** `pnpm vitest run apps/web/src/lib/audit.test.ts apps/web/src/db` → PASS.
- [ ] **Step 7: Commit.** `git commit -m "feat(audit): append-only audit_log with PII redaction" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 13: `crm_purge` part (b1) tests

**Files:** Create `apps/web/src/db/purge-role.test.ts`.

- [ ] **Step 1: Catalog tests** (spec "`crm_purge` in Phase 1" → Tests): `rolbypassrls`, `rolsuper` false (with Task 1's all-role test); its effective privileges equal exactly `EXPECTED_PRIVILEGES.crm_purge` = `database:CONNECT`, `schema:public:USAGE`, `table:public.audit_log:INSERT` (no TEMPORARY, no function, no sequence, no other table; the comparison is against the list, not "nothing"); it holds no DELETE, UPDATE or TRUNCATE on `audit_log` or `domain_event` (`domain_event` asserted absent-or-denied: before Task 19 the table does not exist, and "none on a table not yet created" holds by the manifest equality); its only PERMISSIVE policy anywhere is `audit_log_purge_insert`; it appears in the RESTRICTIVE policy of every tenant table (from `rls.test.ts`, asserted again here by name).
- [ ] **Step 2: Behavioural tests** (the real role, **connected with its own login** at `purgeUrl`, Settled item 1): inside `runInWorkspace(purgeDb, A)` it inserts an audit row for A; inserting a row with `workspace_id = B` inside A fails `42501` (WITH CHECK); `SELECT … FROM audit_log` fails `42501`; with no workspace set, the insert fails (`workspace_id` from the setting is NULL → NOT NULL violation `23502`, or `42501`; the test accepts only these two codes); after the transaction, on the same connection (`max: 1`), `current_setting('app.workspace_id', true)` is `''` and `current_user` is `crm_purge` (no role switch exists to leak); a third concurrent connection beyond `CONNECTION LIMIT 2` is refused (`53300`).
- [ ] **Step 3: Run** `pnpm vitest run apps/web/src/db/purge-role.test.ts` → PASS (it is written after the grants it checks; it fails if any grant drifts).
- [ ] **Step 4: Commit.** `git commit -m "test(db): crm_purge Phase 1 catalog and behavioural tests (own login)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 14: `idempotency_key`, `requireWorkspaceMember()` and `action()`

**Prerequisite:** ASK 4 answered (idempotency key expiry). Until then this task stops after Step 3.

**Files:** Create `apps/web/src/db/schema/idempotency.ts`, `apps/web/drizzle/0008_idempotency_key.sql`, `apps/web/drizzle/0009_rls_idempotency_key.sql` (custom), `apps/web/src/lib/auth/action.ts`, `apps/web/src/lib/auth/action.test.ts`; modify `packages/core/src/security/limits.ts` (`IDEMPOTENCY_KEY_EXPIRY_SECONDS`, value from ASK 4, with citation "Charlie, <date>"), `apps/web/src/db/privileges.ts`, `apps/web/src/db/isolation.test.ts`.

**Interfaces:**
```ts
type Role = "owner" | "admin" | "staff";
export async function requireWorkspaceMember(minRole: Role): Promise<{ userId: string; workspaceId: string; role: Role }>;
export function action<I, O extends Json>(spec: {
  name: string;                       // stable action id, e.g. "email.sendTest"
  minRole: Role;
  input: z.ZodType<I>;
  idempotent: boolean;
  handler: (ctx: { tx: Tx; userId: string; workspaceId: string; role: Role }, input: I) => Promise<O>;
}): (raw: unknown, idempotencyKey?: string) => Promise<ActionResult<O>>;
```
Order, fixed in code and tested: (1) session (`getCurrentSession`; none → `UNAUTHENTICATED`); (2) workspace = `session.session.activeOrganizationId` only (none → `NO_WORKSPACE`; any `workspaceId` in `raw` is ignored and never read); (3) role via `getMembership(userId, workspaceId)` ≥ `minRole` (else `FORBIDDEN`; also covers a stale active workspace); (4) Zod `input.safeParse(raw)` (else `INVALID_INPUT` with field paths, no values); (5) idempotency inside `withWorkspace(workspaceId)`: `insert into idempotency_key (workspace_id, key, action, request_hash, expires_at) … on conflict (workspace_id, key) do nothing returning id`; on conflict, read the row: same `action` and `request_hash` → return the stored `response` (`REPLAYED`), else `IDEMPOTENCY_KEY_REUSED`; (6) handler in the **same** transaction, then `update idempotency_key set response = $1` for that row. `request_hash` = SHA-256 of canonical JSON of the parsed input.

- [ ] **Step 1: Schema.** `idempotency_key`: `workspace_id uuid not null references organization(id)`, `key text not null` (≤ 128 chars, CHECK), `action text not null`, `request_hash bytea not null`, `response jsonb null`, `expires_at timestamptz not null`, `created_at timestamptz not null default now()`; primary key `(workspace_id, key)`. (Spec lists "response hash"; this stores the request hash to detect reuse and the response to replay it — builder proposal, Bob reviews.) Generate; RLS custom migration with `crm_app` SELECT, INSERT, UPDATE(`response`), DELETE; manifest; isolation fixture.
- [ ] **Step 2: Failing tests** (`action.test.ts`, Testcontainers + a real Better Auth instance; `headers()` and `cookies()` stubbed with `vi.mock("next/headers")` to the signed-in user's cookie):
  - no session → `UNAUTHENTICATED`, and the handler, Zod and the DB are not touched (spies);
  - `raw = { workspaceId: W2 }` while the active workspace is W1 → the handler sees W1;
  - staff-level action by an owner → runs; owner-level action by a stored `admin` → `FORBIDDEN` (role set via `adminUrl`);
  - stale active workspace (session points at W2, user not a member) → `FORBIDDEN` before Zod (a spy on `safeParse` is not called);
  - invalid input → `INVALID_INPUT`, handler not called;
  - same key twice, same input → handler runs once, second call returns the first response with `REPLAYED`; same key, different input → `IDEMPOTENCY_KEY_REUSED`; a handler that throws leaves no `idempotency_key` row (rollback);
  - ordering: spies record `session, membership, zod, idempotency, handler` in exactly that order.
- [ ] **Step 3: Run** → FAIL; implement `action.ts`; `requireWorkspaceMember` also calls `ensureWorkspaceSettings` when the row is missing (Task 7). Rerun → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(auth): action() wrapper with session, workspace, role, Zod and idempotency in order" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 15: AUTH-01 lint — every mutating server action goes through `action()`

**Files:** Create `apps/web/eslint/server-action-wrapper.mjs` (local rule), `apps/web/eslint/forwarding-actions.mjs` (the named exemptions), `apps/web/src/app/entry-points.test.ts`; modify `eslint.config.mjs`, `apps/web/src/db/lint-rules.test.ts`.

**Scope (the rule follows the directive, not the file name).** A server action is any function Next.js exposes to the client because of a `"use server"` directive: (i) every export of a module whose directive prologue contains `"use server"`, wherever the file is and whatever it is called; (ii) any function whose body starts with a `"use server"` directive (inline action, e.g. inside a server component). The rule is registered for `apps/web/**/*.{ts,tsx}` with **no** `files` narrowing by name and no whole-file ignore; it is a no-op on modules without the directive.

**Exemptions are named functions, not files.** `forwarding-actions.mjs` exports `FORWARDING_ACTIONS`, a map from repo-relative file path to the export **names** that only forward to Better Auth through `postToAuth` (spec "Better Auth endpoints": the `/api/auth/*` surface is not routed through `action()`, revision 7 (d)). The Phase 0 set, read from the tree on 2026-10-20:

| File | Exempt exports (only these) | Better Auth path |
|---|---|---|
| `apps/web/src/app/(auth)/sign-in/actions.ts` | `signInAction` | `/sign-in/email` |
| `apps/web/src/app/(auth)/sign-up/actions.ts` | `signUpAction` | `/sign-up/email` |
| `apps/web/src/app/(auth)/two-factor/actions.ts` | `verifyTwoFactorAction` | `/two-factor/verify-totp`, `/two-factor/verify-backup-code` |
| `apps/web/src/app/(app)/actions.ts` | `setActiveWorkspaceAction`, `signOutAction` | `/organization/set-active`, `/sign-out` |
| `apps/web/src/app/(app)/settings/security/actions.ts` | `startTwoFactorAction`, `confirmTwoFactorAction` | `/two-factor/enable`, `/two-factor/verify-totp` |
| `apps/web/src/app/(app)/workspaces/actions.ts` | `createWorkspaceAction` | `/organization/create` |

A type-only export (`export interface`, `export type`) is not a server action and is ignored. Every other export of these files is checked like any other.

**A listed name is exempt only while its body keeps the forwarding-only shape.** The path/name match is necessary, not sufficient: the same rule also checks the AST of each listed function (and of every non-exported helper function in the same file that it calls), so a forwarder that starts doing other work fails lint. The eight real bodies (read 2026-10-20) do more than call `postToAuth` and redirect: they check the session, read form fields, build a slug and map Better Auth's result to a message. The allowed shape is therefore an exact allow-list derived from them, kept in `forwarding-actions.mjs` beside `FORWARDING_ACTIONS`:
- **F1 — imports of an exempt file.** Every `import` in the file is a value or type import from exactly these modules and names: `@/lib/auth/forward` (`postToAuth` only), `@/lib/auth/session` (`getCurrentSession` only), `@/lib/auth/messages` (any message constant or `limitMessage`), `@/lib/forms` (`textField`, `EMPTY_FORM_STATE`, type `FormState`), `next/navigation` (`redirect`, `RedirectType`), `next/cache` (`refresh`), `node:crypto` (`randomUUID` only), `@crm/core/workspace` (`toWorkspaceSlug` only). Any other import — `@/db/*`, `@/db/system`, `drizzle-orm`, `postgres`, `pg-boss`, `@/jobs/*`, `@/lib/audit`, `@/lib/auth/action`, any other module — reports on the import, even if no exported function uses it. No `import()` expression and no `require` anywhere in the file.
- **F2 — exactly one Better Auth call.** The function body contains exactly one `CallExpression` whose callee is the imported `postToAuth`, and it is the argument of an `await`.
- **F3 — other awaits.** The only other `await` allowed is `await getCurrentSession()`. Any other awaited expression (a local async helper, a promise from another call) reports.
- **F4 — other calls.** Every other call or `new` in the body is one of: an F1-imported function (`getCurrentSession`, `redirect`, `refresh`, `textField`, `limitMessage`, `toWorkspaceSlug`, `randomUUID`); a non-exported function declared in the same file whose own body passes F2–F6 with "exactly one" replaced by "no" `postToAuth` call; the built-ins `String`, `Array.isArray`, `URL.canParse`, `new URL`; or a method call on a local binding (a parameter, a `const` of the function or file, or a property of one) or on the value an allowed call or `new` returns (e.g. `textField(form, "code").trim()`, `new URL(uri).searchParams.get("secret")`, `form.getAll("backupCode").filter(…)`). With F1 in force a local binding can only come from the request (`FormData`), Better Auth's result or an allowed import, so a method call on it cannot reach the database.
- **F5 — banned identifiers.** No reference to `fetch`, `globalThis`, `process`, `eval`, `Function`, `getDb`, `withWorkspace`, `runInWorkspace`, `sql` or `db`, in any position (call, argument, member object).
- **F6 — no writes outside the function.** No assignment, update (`++`/`--`) or `delete` whose target is a module-scope binding or a property of one.

A listed function that breaks any of F1–F6 reports "Forwarder <name> does more than forward to Better Auth (AUTH-01): <F-rule>"; an unlisted export reports the usual "Server actions go through action() (AUTH-01)". A new forwarder, or a change to the allowed sets above, is a reviewed edit to `forwarding-actions.mjs` (Bob reviews it like a grant).

- [ ] **Step 1: Failing fixtures** (`lint-rules.test.ts`, `lintText` with the given `filePath`; each "reports" case expects the message "Server actions go through action() (AUTH-01)"):
  - `apps/web/src/app/(app)/settings/email/actions.ts`, `"use server"`, `export async function doThing() {}` → reports; `export const doThing = action({ … })` → clean.
  - **Differently named file:** `apps/web/src/app/(app)/settings/email/mutations.ts`, `"use server"`, `export async function saveEmailSettings(form: FormData) { await withWorkspace(id, (tx) => tx.insert(workspaceSettings).values({ … })); }` (a mutating export that writes the database directly) → reports.
  - **Outside `src/app`:** the same body at `apps/web/src/lib/settings-mutations.ts` → reports.
  - **Extra export in an exempt file:** `apps/web/src/app/(app)/workspaces/actions.ts` with the real `createWorkspaceAction` plus `export async function renameWorkspaceAction(form: FormData) { … }` → reports on `renameWorkspaceAction` only; `createWorkspaceAction` stays clean.
  - **Other export shapes in a `"use server"` module:** `export default async function (…) {}`, `export const x = async () => {}`, `export const x = wrap(async () => {})` (a call that is not `action`), `const x = …; export { x }`, `export { x as y }` of a local non-`action()` binding, and `export * from "./other"` / `export { x } from "./other"` (re-exports cannot be checked, so they are refused) → each reports.
  - **Inline action:** `async function inline() { "use server"; … }` inside `apps/web/src/app/(app)/settings/email/page.tsx` → reports (Phase 1 has no inline actions; one needs `action()` or a named exemption).
  - **Known forwarding actions:** each of the eight exempt exports above, at its real path with its real body (fixture text read from the tree by the test, so it tracks the real file) → clean. The same function name at a different path (e.g. `signInAction` in `mutations.ts`) → reports.
  - **Exempt body changed (forwarding-only shape, F1–F6):** each starts from the real file text and adds one thing; each reports the "does more than forward" message on the named function (or on the import, for F1):
    - `createWorkspaceAction` with `import { withWorkspace } from "@/db/workspace"` and `import { workspaceSettings } from "@/db/schema"` added, and `await withWorkspace(id, (tx) => tx.insert(workspaceSettings).values({ workspaceId: id }));` inserted before the `postToAuth` call (a direct DB mutation inside an exempt function) → reports (F1 on both imports; F3 and F5 on the body);
    - `signInAction` with `await fetch("https://example.invalid/hook", { method: "POST" });` added and no new import → reports (F3, F5);
    - `signOutAction` with a second `await postToAuth("/sign-out", {})` → reports (F2);
    - `setActiveWorkspaceAction` with `import { recordAudit } from "@/lib/audit"` added but unused → reports (F1);
    - `verifyTwoFactorAction` calling a new non-exported helper in the same file that does `await import("@/db")` → reports (F1, no `import()`);
    - `confirmTwoFactorAction` with `lastCode = textField(form, "code");` writing a module-level `let lastCode` → reports (F6).
- [ ] **Step 2: Rule.** `server-action-wrapper.mjs`: on `Program`, read the directive prologue; if it has `"use server"`, walk every `ExportNamedDeclaration`, `ExportDefaultDeclaration`, `ExportAllDeclaration` and `ExportSpecifier`; an export is clean only if its binding is `const <name> = action({ … })` (callee identifier `action` imported from `@/lib/auth/action`), or `FORWARDING_ACTIONS[<file>]` lists `<name>` **and** its body passes F1–F6. The shape check is part of the same rule (a second message id, `forwarderShape`): for a file in `FORWARDING_ACTIONS` it checks every `ImportDeclaration` and `ImportExpression` against F1 once per file, then walks each listed function's body (and, through the file's scope manager, each same-file helper it calls, once each) for F2–F6, resolving identifiers with `context.sourceCode.getScope()` so a local shadow of `postToAuth` does not count as the import. On any `FunctionDeclaration`, `FunctionExpression` or `ArrowFunctionExpression` whose body's directive prologue has `"use server"`, report unless it is the initializer of a listed forwarding export. Register it in `eslint.config.mjs` as an inline plugin (`plugins: { crm: { rules: { "server-action-wrapper": … } } }`) for `apps/web/**/*.{ts,tsx}`.
- [ ] **Step 3: Classify every other mutating entry point** (`entry-points.test.ts`). It walks `apps/web/src/app/**/route.ts` and `apps/web/proxy.ts` and compares, per file, the exported HTTP method names with a committed table; an unlisted `route.ts`, or a listed one exporting a method not in its row, fails with "classify this entry point (AUTH-01)":

  | Entry point | Methods | How it is covered |
  |---|---|---|
  | `apps/web/src/app/api/auth/[...all]/route.ts` | GET, POST | The named `/api/auth/*` exception (revision 7 (d)): not through `action()`; DB rate limits, uniform 429, enabled-path allow-list — `rate-limit.test.ts`, `enabled-paths.test.ts` (Tasks 23, 24). |
  | `apps/web/src/app/api/health/route.ts` | GET only | Read-only, unauthenticated by design (UNI-19); `health.test.ts` (Task 20). The test fails if it ever exports POST, PUT, PATCH or DELETE. |
  | `apps/web/proxy.ts` (Task 25) | `proxy` | Sets headers only, reads no database (AUTH-11); `security-headers.test.ts`. Not a mutation path. |
  | any other `route.ts` exporting POST, PUT, PATCH or DELETE | — | None exists in Phase 1. The test fails until the new route is added to the table with its wrapper and test (a later phase decides, e.g. `linkAction()` for client link routes, §9 AUTH-01 ruling). |

  Not HTTP entry points, recorded in the same test file as a list the test does not walk: pg-boss job handlers (`apps/web/src/jobs/*`; they run in the worker under `withWorkspace(data.workspaceId)` and re-check membership where they act for a user, Task 27 Step 2; EVT rules), the CLI scripts `db:bootstrap` and `jobs:retry` (operator commands with admin or `crm_worker` credentials, never reachable over HTTP; runbooks).
- [ ] **Step 4: Run.** `pnpm vitest run apps/web/src/db/lint-rules.test.ts apps/web/src/app/entry-points.test.ts && pnpm lint` → PASS / exit 0 on the real tree (the eight forwarding exports pass by name and by shape F1–F6; no other `"use server"` module exists yet).
- [ ] **Step 5: Commit.** `git commit -m "chore(lint): every server action uses action() or is a named Better Auth forwarder (AUTH-01)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Then Task 31; the PR 4 checkpoint is Task 31 Step 8.

### Task 31: `auth_audit_log`: sign-in and 2FA events, one row per event per user (ASK 3 = B)

**Prerequisite:** spec revision 8 (Task 30, edit E12) approved, merged and reconciled. The PR order already requires this before PR 1 starts. If Bob's review of revision 8 changes E12, this task follows the approved text, and the plan is corrected before PR 4 starts.

**Spec basis** (line numbers for hash `50acbcfe…`; E12 adds the table to each): "Audit, logging, privacy" line 835 ("Audit log append-only; records logins, 2FA, …"; personal-data fields stored as `"[pii]"`); data model line 489 (`audit_log` columns, including `ip`: the pattern this table follows, minus the workspace); Tenancy lines 781–782 (no-RLS tables are reached only through the system module; the no-RLS allow-list test); "Better Auth endpoints" line 747 (Phase 1 enables "TOTP 2FA enrol, verify, disable and recovery codes").

**Events (closed list: only what line 835 names, mapped to the Phase 1 endpoints of line 747):**

| `event` | Spec words | Written when (Better Auth 1.7.6) | `detail` |
|---|---|---|---|
| `sign_in` | "logins" | A login issues a session: `/sign-in/email` succeeds and `ctx.context.newSession` is still set after the two-factor plugin's after-hook (a user without 2FA, or a trusted device); or `/two-factor/verify-totp` / `/two-factor/verify-backup-code` succeeds with no session before the request (the second step of a 2FA login). | `{"method":"password"}` or `{"method":"two_factor"}` |
| `two_factor_verified` | "2FA" (verify) | `/two-factor/verify-totp` or `/two-factor/verify-backup-code` succeeds with no session before the request. It is written together with that login's `sign_in`. | `{"method":"totp"}` or `{"method":"backup_code"}` |
| `two_factor_enabled` | "2FA" (enrol) | `/two-factor/verify-totp` succeeds with a session whose user had `twoFactorEnabled = false`. 1.7.6 sets it to true there (`dist/plugins/two-factor/totp/index.mjs`, lines 206–208). `/two-factor/enable` alone stores only an unverified secret, because `skipVerificationOnEnable` is off. | none |
| `two_factor_disabled` | "2FA" (disable) | `/two-factor/disable` succeeds. | none |
| `two_factor_backup_codes_regenerated` | "2FA" (recovery codes, line 747) | `/two-factor/generate-backup-codes` succeeds. | none |

**Not recorded,** because line 835 does not name them (each is listed so Bob can rule): failed sign-ins and failed 2FA codes (the rate limiter counts them, Tasks 21–23, and this plan reads "logins" as completed logins); sign-out; password change; session revoke; `/two-factor/enable` before it is confirmed; a `verify-totp` call by a user whose 2FA is already on (no change and no login). Member changes stay `audit_log` events (Phase 3).

**Files:**
- Create: `apps/web/drizzle/0015_auth_audit_log.sql` (generated), `apps/web/drizzle/0016_grants_auth_audit_log.sql` (custom), `apps/web/src/db/system/auth-audit.ts`, `apps/web/src/lib/auth/auth-audit-plugin.ts`, `apps/web/src/lib/auth/auth-audit.test.ts`
- Modify: `apps/web/src/db/schema/system.ts` (`authAuditLog`), `apps/web/src/db/schema/index.ts`, `apps/web/src/db/system/index.ts` (export `recordAuthEvents` and its types), `apps/web/src/lib/auth/config.ts` (the plugin, listed after `twoFactor`), `apps/web/src/db/privileges.ts`, `apps/web/src/db/privileges.test.ts`, `apps/web/src/test/catalog.ts` (`NO_RLS_ALLOW_LIST`), `apps/web/src/db/rls.test.ts`, `apps/web/src/db/lint-rules.test.ts`, `docs/runbooks/phase-1-database-roles.md`, `docs/DECISIONS.md`

**Interfaces:**
```ts
// apps/web/src/db/system/auth-audit.ts (system module, TEN-10)
export const AUTH_EVENTS = ["sign_in", "two_factor_verified", "two_factor_enabled", "two_factor_disabled", "two_factor_backup_codes_regenerated"] as const;
export type AuthEvent = (typeof AUTH_EVENTS)[number];
export interface AuthEventEntry { userId: string; event: AuthEvent; detail?: Record<string, string> | null; piiFields?: readonly string[]; ip?: string | null }
export async function recordAuthEvents(db: Database, entries: readonly AuthEventEntry[]): Promise<void>;
// apps/web/src/lib/auth/auth-audit-plugin.ts
export function crmAuthAudit(deps: { record: (entries: readonly AuthEventEntry[]) => Promise<void> }): BetterAuthPlugin; // id "crm-auth-audit"
```
`recordAuthEvents` runs **one** multi-row `insert into auth_audit_log (user_id, event, detail, ip) values …` with no `RETURNING` (`crm_app` has no SELECT), so the two rows of a 2FA login are stored together or not at all. Each `detail` goes through `redactPii(detail, piiFields ?? [])` (Task 12). It never runs inside `withWorkspace()` and reads no workspace setting, because the row has no workspace. The plugin gets the writer as a closure from `config.ts` (`record: (e) => recordAuthEvents(db, e)`). It imports only types from `@/db/system`, never the schema or `db/client` (TEN-10, Task 8 Step 2).

- [ ] **Step 1: Check the 1.7.6 hook facts** in the installed `node_modules/better-auth/dist` (read on 2026-10-20 from the published 1.7.6 tarball; re-read at task time and record each fact in the PR body):
  - (i) `options.hooks.after` runs before every plugin after-hook, and plugin after-hooks run in `plugins` order (`dist/api/dispatch.mjs`, `getHooks`). So the audit hook must be a plugin listed **after** `twoFactor()`. As a `hooks.after` it would see the password-step session, which the two-factor plugin then deletes (`dist/plugins/two-factor/index.mjs`: its sign-in after-hook calls `deleteSession` and `setNewSession(null)`).
  - (ii) An after-hook sees the endpoint's result in `ctx.context.returned` (an `APIError` on failure) and the issued session in `ctx.context.newSession`. `ctx.context.session` holds the session read at the start of the request (`getSessionFromCtx` caches it, `dist/api/routes/session.mjs`), so `null` there means "no session before the request" on the verify paths.
  - (iii) **No shared transaction is possible.** Sign-in and the 2FA endpoints make several separate adapter writes and open no transaction. Database `create.after` / `update.after` hooks are queued until after any transaction (`dist/db/with-hooks.mjs`, `queueAfterTransactionHook`). So in 1.7.6 the audit row cannot be written in the same transaction as the auth change. It is written after the endpoint's writes, in the after-hook. Failure handling is in Step 5 and open point 1.
  - (iv) Every path in the events table is in `Object.values(auth.api)` (the same check as Task 24 Step 1).
  If any fact differs, stop and take the difference to Bob before Step 5.
- [ ] **Step 2: Write the failing tests** in `apps/web/src/lib/auth/auth-audit.test.ts`. Setup: Testcontainers `startDatabase()`; a real Better Auth instance from `createAuth` on the `crm_app` pool, as in `auth.test.ts`; TOTP codes computed from the enrolment secret, as in `auth.test.ts`. Rows are read through `adminUrl`, because `crm_app` has no SELECT. The cases:
  - **User with no workspace:** sign up, then sign in → exactly **1** row: `event = 'sign_in'`, `user_id` = the user, `detail = {"method":"password"}`, `ip` null (PR 4) and `created_at` inside the test window. The test also asserts that the user has no `member` row.
  - **User in two workspaces:** a user who owns W1 and W2 signs in → exactly **1** new row for the user. It is a user event, so it is not copied per workspace. A catalog check in the same case shows `auth_audit_log` has no `workspace_id` column.
  - **2FA enable:** a signed-in user calls `/two-factor/enable` → 0 new rows. Then `/two-factor/verify-totp` with a valid code → exactly 1 `two_factor_enabled` row.
  - **2FA verify at sign-in:** that user signs in with the password → 0 new rows at the password step (the challenge is pending). Then `/two-factor/verify-totp` with a valid code → exactly 1 `two_factor_verified` row (`{"method":"totp"}`) and exactly 1 `sign_in` row (`{"method":"two_factor"}`). The same flow through `/two-factor/verify-backup-code` stores `{"method":"backup_code"}`.
  - **2FA disable:** `/two-factor/disable` with the password → exactly 1 `two_factor_disabled` row.
  - **Recovery codes:** `/two-factor/generate-backup-codes` → exactly 1 `two_factor_backup_codes_regenerated` row.
  - **Failures write nothing:** a wrong password, a wrong TOTP code, a wrong backup code, and a disable with a wrong password → 0 new rows each.
  - **Both entry paths:** the no-workspace sign-in also runs through `signInAction` (the `postToAuth` forwarder, Task 15) → exactly 1 row. The hook runs inside Better Auth, so the server-action path and `/api/auth/*` record the same way.
  - **Event list:** the event list in the CHECK constraint (`pg_get_constraintdef`) equals `AUTH_EVENTS`.
  - **PII redaction (UNI-09):** for every row this file writes, `row_to_json(auth_audit_log)::text` contains none of: the user's email, name or password, any TOTP code or backup code used, or the TOTP secret. Calling `recordAuthEvents` directly with `detail: { email: "a@x", method: "password" }, piiFields: ["email"]` stores `{"email":"[pii]","method":"password"}`.
  - **Failed audit write (the Step 5 proposal):** the test makes the insert fail by revoking `INSERT ON auth_audit_log FROM crm_app` through `adminUrl`, and grants it back afterwards. Then:
    - a sign-in returns 500, and no usable session exists: `/get-session` with the returned cookies → `null`, and the user's `session` row count is unchanged;
    - a 2FA disable returns 500, and its change stands: the `two_factor` row is gone (the stated gap);
    - each failure logs exactly one line, `{"level":"error","msg":"auth audit write failed","event":"<event>"}`, with no user data.

  Run `pnpm vitest run apps/web/src/lib/auth/auth-audit.test.ts` → FAIL with `Failed to resolve import "../../db/system/auth-audit"`.
- [ ] **Step 3: Schema and migrations.**
  - Add `auth_audit_log` to `schema/system.ts` with these columns:
    - `id uuid primary key default gen_random_uuid()`;
    - `user_id uuid not null references "user"(id) on delete restrict`. Phase 1 enables no user deletion (line 747); erasure is open point 2;
    - `event text not null check (event in ('sign_in','two_factor_verified','two_factor_enabled','two_factor_disabled','two_factor_backup_codes_regenerated'))`;
    - `detail jsonb null`;
    - `ip text null`;
    - `created_at timestamptz not null default now()`.

    Add an index on `(user_id, created_at)`. There is no `workspace_id`. Run `pnpm db:generate --name auth_audit_log`.
  - Run `pnpm db:generate --custom --name grants_auth_audit_log` and write:
    ```sql
    GRANT INSERT ON auth_audit_log TO crm_app;
    ```
  - No `ENABLE ROW LEVEL SECURITY` and no policy: the table keeps `relrowsecurity = false` and is on the allow-list. No grant goes to `crm_worker`, `crm_purge`, `crm_link_resolver` or PUBLIC. No runtime role gets UPDATE, DELETE, TRUNCATE or SELECT (append-only, as TEN-03 requires for `audit_log`; no reader in Phase 1).
- [ ] **Step 4: Catalog and lint tests.** Write them first: they fail before Step 3 and pass after it.
  - `privileges.test.ts` → manifest: `EXPECTED_PRIVILEGES.crm_app` gains exactly `table:public.auth_audit_log:INSERT`. The other roles and PUBLIC are unchanged, so the manifest equality proves that `crm_worker`, `crm_purge`, `crm_link_resolver` and PUBLIC hold nothing on the table. Task 13's exact `crm_purge` list still passes.
  - `privileges.test.ts` → "TEN-03 append-only" part 1, extended to `auth_audit_log`:
    - for `crm_app`, `crm_worker`, `crm_purge`, `crm_link_resolver` and PUBLIC, `has_table_privilege(<r>, 'public.auth_audit_log', 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'SELECT')` is false;
    - `relowner` is `crm_migrator`;
    - behavioural: as `crm_app`, `UPDATE auth_audit_log SET event = 'sign_in'`, `DELETE FROM auth_audit_log` and `SELECT 1 FROM auth_audit_log` each fail with `42501`.
  - `rls.test.ts` → "no-RLS allow-list": `NO_RLS_ALLOW_LIST` gains `auth_audit_log` (eleven tables). The test fails if the table gets RLS or is dropped from the list. It also asserts that the table has no policy.
  - `lint-rules.test.ts` → TEN-10:
    - a fixture at `apps/web/src/app/(app)/x/actions.ts` that imports `authAuditLog` from the schema → reports;
    - a fixture at `apps/web/src/lib/auth/auth-audit-plugin.ts` that imports `authAuditLog` from `../../db/schema` → reports;
    - the same import at `apps/web/src/db/system/auth-audit.ts` → clean;
    - `import type { AuthEventEntry } from "@/db/system"` in the plugin → clean.
- [ ] **Step 5: Implement.**
  - `recordAuthEvents` in `system/auth-audit.ts`, as in Interfaces (a Drizzle insert on the given `db`), exported from `system/index.ts`.
  - `crmAuthAudit({ record })` in `auth-audit-plugin.ts` returns `{ id: "crm-auth-audit", hooks: { after: [{ matcher: (ctx) => AUDITED_PATHS.has(ctx.path), handler: createAuthMiddleware(async (ctx) => …) }] } }`. The handler:
    - returns at once when `isAPIError(ctx.context.returned)`;
    - otherwise derives the events from the table above. Sign-in: `ctx.context.newSession` is not null. Verify paths: if `ctx.context.session` is `null`, the events are `two_factor_verified` then `sign_in`; if it is set and its user had `twoFactorEnabled === false`, the event is `two_factor_enabled`; otherwise there is no event;
    - takes the user id from `newSession.user.id` or `session.user.id`, sets `ip: null` until Task 22 Step 3a, and awaits one `record(entries)` call.
  - **Failure handling (builder proposal, open point 1).** If `record()` throws:
    - for an entry list that contains `sign_in`: the hook deletes the session just issued (`ctx.context.internalAdapter.deleteSession(newSession.session.token)`) and expires the session cookie (`deleteSessionCookie(ctx)`). It then logs `{"level":"error","msg":"auth audit write failed","event":"sign_in"}` and throws `APIError("INTERNAL_SERVER_ERROR")`. The login fails closed: no usable session exists without its row;
    - for `two_factor_enabled`, `two_factor_disabled` and `two_factor_backup_codes_regenerated`: the change is already stored (fact iii), and the hook cannot undo it safely. It logs the same line with its event and throws `APIError("INTERNAL_SERVER_ERROR")`. The user sees a failure and can retry, and the operator sees the log line. A stored change with no row is the stated gap.
  - `config.ts`: `plugins: [twoFactor({ issuer: "CRM" }), organization({ … }), crmAuthAudit({ record: (entries) => recordAuthEvents(db, entries) })]`. The audit plugin comes last (fact i).
  - Run `pnpm vitest run apps/web/src/lib/auth/auth-audit.test.ts apps/web/src/db` → PASS. Then `pnpm vitest run apps/web/src/lib/auth` → PASS (the Phase 0 auth tests are unchanged).
- [ ] **Step 6: Runbook and decisions.**
  - `docs/runbooks/phase-1-database-roles.md`: add an `auth_audit_log` row to the grants table. `crm_app` has INSERT only, and no runtime role reads the table in Phase 1. An operator reads it only through the admin connection, read-only, for an incident.
  - `docs/DECISIONS.md`: add an entry "Phase 1 PR 4: `auth_audit_log` events, hook placement and failure handling". It records:
    - the events table and the not-recorded list;
    - the write after the endpoint's writes, and why (fact iii);
    - the failure-handling proposal and Bob's ruling;
    - the erasure point, as Bob and Charlie rule it.
- [ ] **Step 7: Run the PR 4 suite.** `pnpm typecheck && pnpm lint && pnpm test` → exit 0 (Docker running). `pnpm test:e2e` → PASS (the sign-in, 2FA and sign-out specs are unchanged).
- [ ] **Step 8: Commit and PR checkpoint.**
```bash
git add apps/web docs
git commit -m "feat(audit): auth_audit_log for sign-in and 2FA events (system module, no RLS, append-only)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/p1-action-audit
```
Open PR 4. Self-check rows: AUTH-01, AUTH-02, AUTH-03, TEN-02, TEN-03, TEN-06–TEN-11, UNI-03, UNI-09, UNI-10, §9 `crm_purge` (b1), and §9 no-RLS system tables (with `auth_audit_log`).

**Open points for Bob (decided in the PR 4 review, not here):**
1. **Does a failed audit write fail the auth request?** Proposal: yes. A sign-in fails closed (session deleted, 500). The spec says the audit log records logins, and an unaudited login would break that without anyone noticing. A 2FA change returns 500 but stands, because 1.7.6 runs these endpoints without a transaction and the hook cannot roll them back (fact iii).
   - *Alternative for 2FA:* a `databaseHooks.user.update.before` hook that writes the row before the `twoFactorEnabled` update, so a failed write blocks the change. The cost is a row for a change whose own write later fails.
   - *Alternative overall:* best-effort (log the failure and let the request succeed). The proposal rejects it, because during a database fault logins would then go unrecorded.
2. **Retention and erasure (PDPA).** Proposal for Phase 1: rows are kept. `user_id` is `on delete restrict`, and no user-deletion endpoint is enabled (line 747), so nothing erases rows yet. `ip` is stored raw, as `audit_log.ip` is (line 489), and no other personal data is stored. Not decided:
   - whether a user's rows are erased together with the user, and by which role (no runtime role has DELETE, so the TEN-03 test would need a named exception like `crm_purge`'s);
   - whether rows are kept with `user_id` and `ip` redacted;
   - whether rows are kept for a fixed period.

   Proposal: decide this with workspace offboarding and the retention statement (spec line 837; Phase 9), and record it as an open item in the PR 4 DECISIONS entry. Charlie decides if the answer changes a spec rule.
3. **Event list.** `two_factor_backup_codes_regenerated` is included as a "2FA" event, because line 747 lists recovery codes among the 2FA endpoints. Failed sign-ins and failed codes are not recorded. Bob confirms the list or trims it.
4. **`ip` before PR 7.** It is null in PR 4. The trusted client IP exists only after Task 22, which fills it in (Task 22 Step 3a).

## PR 5 — `feat/p1-pgboss` (Tasks 16–18)

**Guardrails:** TEN-02 (hard), TEN-03, EVT-01, EVT-03, EVT-05, EVT-06, UNI-04, UNI-06, UNI-14, UNI-15. §9 pg-boss rules ("installed and upgraded by `crm_migrator` in migrations; app instances run with `migrate`/`createSchema` false; queue options (including `notify`) change only in migrations"), the locked switches (`notify` off; web instance `migrate`, `supervise`, `schedule`, `createSchema` false), R3, R5, R6, R7.

### Task 16: Install pg-boss 12.35.0 by migration; queues; `crm_app` enqueue grants

**Files:** Create `apps/web/drizzle/0010_pgboss_install.sql` (custom), `apps/web/drizzle/0011_pgboss_queues_grants.sql` (custom), `apps/web/scripts/pgboss-plans.ts`, `apps/web/src/jobs/install.test.ts`; modify `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/db/privileges.ts`, `docs/DECISIONS.md`.

- [ ] **Step 0: Branch** `feat/p1-pgboss`.
- [ ] **Step 1: Add the dependency.** `pnpm --filter @crm/web add pg-boss@12.35.0`. Check: `pnpm --filter @crm/web why pg` shows `pg 8.23.0` (or the version pg-boss resolves) only under `pg-boss`; `pnpm audit --audit-level high` exit 0. UNI-06 ladder row in DECISIONS (need: spec-named queue; licence MIT; published 2026-09-26; maintainers from `pnpm view pg-boss maintainers`; size from `pnpm view pg-boss@12.35.0 dist.unpackedSize`; install scripts: none expected, check `pnpm view pg-boss@12.35.0 scripts`).
- [ ] **Step 2: Generate the construction SQL.** `apps/web/scripts/pgboss-plans.ts` prints `getConstructionPlans("pgboss", { createSchema: true })` for the installed version. Run `pnpm --filter @crm/web exec tsx scripts/pgboss-plans.ts > /tmp/pgboss.sql`, `pnpm db:generate --custom --name pgboss_install`, paste the output into the new file with `--> statement-breakpoint` between top-level statements (or as one statement if the plan is a single `BEGIN … COMMIT`-free block; check by reading it). The file header line: `-- pg-boss 12.35.0 getConstructionPlans("pgboss"); regenerate only with a planned pg-boss upgrade (getMigrationPlans).`
- [ ] **Step 3: Failing test** (`install.test.ts`, `startDatabase()`): `select version from pgboss.version` = the schema version of the installed package (`43` for 12.35.0, read from `pg-boss/dist/schema.json` in the test so an upgrade fails loudly); a `new PgBoss({ connectionString: appUrl, migrate: false, createSchema: false, supervise: false, schedule: false, max: 2 })` `start()` succeeds as `crm_app` (the web send-only configuration); queues `domain_event`, `email.send`, `rate_limit.cleanup`, `idempotency.cleanup` and their dead-letter queues `domain_event.dead`, `email.send.dead` exist with `notify` off; as `crm_app`: `send('email.send', { workspaceId, userId })` returns an id; `select data from pgboss.job_common` fails `42501`; `select id from pgboss.job_common` works; `select * from pgboss.job` fails `42501`.
- [ ] **Step 4: Queues and grants migration** (`pnpm db:generate --custom --name pgboss_queues_grants`):
  ```sql
  SELECT pgboss.create_queue('domain_event.dead', '{"policy":"standard"}'::jsonb);
  SELECT pgboss.create_queue('email.send.dead',  '{"policy":"standard"}'::jsonb);
  SELECT pgboss.create_queue('domain_event', '{"policy":"standard","retryLimit":<n>,"retryDelay":<s>,"retryBackoff":true,"deadLetter":"domain_event.dead"}'::jsonb);
  SELECT pgboss.create_queue('email.send',   '{"policy":"standard","retryLimit":<n>,"retryDelay":<s>,"retryBackoff":true,"deadLetter":"email.send.dead"}'::jsonb);
  SELECT pgboss.create_queue('rate_limit.cleanup',  '{"policy":"singleton"}'::jsonb);
  SELECT pgboss.create_queue('idempotency.cleanup', '{"policy":"singleton"}'::jsonb);
  GRANT USAGE ON SCHEMA pgboss TO crm_app;
  GRANT SELECT ON pgboss.version, pgboss.queue TO crm_app;
  GRANT INSERT, SELECT (id, start_after) ON pgboss.job_common TO crm_app;
  GRANT EXECUTE ON FUNCTION pgboss.job_now() TO crm_app;
  ```
  The option keys are those `create_queue` reads in 12.35.0 (`retryLimit`, `retryDelay`, `retryBackoff`, `deadLetter`, `policy`); confirm against `pgboss.create_queue`'s body in the installed schema before writing. `<n>`/`<s>`: retry count and first delay are operational values not given by the spec; the builder proposes 5 retries starting at 30 s with backoff, records them in DECISIONS as operational defaults, and lists them for Bob (they are queue options, so they change only by migration, R7). No queue uses `partition: true` in Phase 1, so every job lives in `job_common` and the grants above cover it (R3); the manifest test fails if a new `pgboss` table appears without its manifest rows.
- [ ] **Step 5: Measure** whether `send` calls `job_now()`: revoke the grant in a scratch run; if `send` still works, drop the `crm_app` EXECUTE line (Settled item 2). Write the final `crm_app` pgboss privileges into the manifest.
- [ ] **Step 6: Run.** `pnpm vitest run apps/web/src/jobs/install.test.ts apps/web/src/db/privileges.test.ts` → PASS.
- [ ] **Step 7: Commit.** `git commit -m "feat(jobs): install pg-boss 12.35.0 by migration; queues; crm_app enqueue-only grants" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 17: Measure and record `crm_worker`'s exact grants

**Files:** Create `apps/web/src/jobs/worker-grants.test.ts`, `apps/web/drizzle/<next>_pgboss_worker_grants.sql` (custom; `pnpm db:generate --custom --name pgboss_worker_grants`), `docs/runbooks/phase-1-database-roles.md` (section "pg-boss grants"); modify `apps/web/src/db/privileges.ts`, `docs/DECISIONS.md`.

- [ ] **Step 1: The operation-set test** (`worker-grants.test.ts`, `crm_worker` at `workerUrl`, direct): a `PgBoss` with `migrate: false`, `createSchema: false`, `supervise: true`, `schedule: true`, `reindex: false`, `persistQueueStats: false`, `persistWarnings: false`, `max: 3`, and the shortest intervals the 12.35.0 types allow for `superviseIntervalSeconds`, `maintenanceIntervalSeconds`, `monitorIntervalSeconds` and `cronMonitorIntervalSeconds`. It records every `error` event. Scenario, in order: `start()`; `work('email.send', handler)` completes a job; a handler that throws twice then succeeds (retry with backoff); a handler that always throws until `retryLimit` (job lands in `email.send.dead`); a job with `expireInSeconds: 1` whose handler sleeps 3 s (maintenance fails it); `schedule('rate_limit.cleanup', '* * * * *')` fires once within 75 s; `unschedule`; `boss.retry('email.send.dead', id)` (admin command path, Task 18); `stop({ graceful: true })`. Assertions: zero `error` events, zero `42501` in the container log (read with `container.logs()`), and each scenario's expected job state in `pgboss.job_common` (read via `adminUrl`).
- [ ] **Step 2: Deny-and-add** (Settled item 2, steps 1–4) starting from only `USAGE ON SCHEMA pgboss` and `EXECUTE ON FUNCTION pgboss.job_now()`. Write each grant into the worker-grants migration and into `EXPECTED_PRIVILEGES.crm_worker`. Expected end state is the starting guess in Settled item 2; record any difference in the PR body.
- [ ] **Step 3: Ablation** (Settled item 2, step 5): a parametrised test revokes one table privilege at a time (via `adminUrl`) and runs only the scenario that needs it; each must fail with `42501`. Keep it as a test (`describe.each`), so a later grant change keeps the evidence.
- [ ] **Step 4: TEN-02 condition** (Bob R11): in `privileges.test.ts`, `crm_worker` holds no privilege on any table in `public` (manifest has no `table:public.*` row for it; the test also asserts it directly so the reason is readable).
- [ ] **Step 5: Record.** Runbook table (privilege · object · operation that needs it · measured on 2026-MM-DD, pg-boss 12.35.0, PostgreSQL 17.x). DECISIONS entry "crm_worker grants measured (spec R6, Phase 1 gate)".
- [ ] **Step 6: Run** `pnpm vitest run apps/web/src/jobs apps/web/src/db/privileges.test.ts` → PASS.
- [ ] **Step 7: Commit.** `git commit -m "feat(jobs): crm_worker grants measured, recorded and frozen in the manifest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 18: Web send-only instance, worker instance, retry admin command, `pg` import ban

**Files:** Create `apps/web/src/jobs/boss.ts`, `apps/web/src/jobs/handlers.ts`, `apps/web/src/jobs/boss.test.ts`, `apps/web/scripts/retry-job.ts`; modify `apps/web/src/worker/start.ts`, `apps/web/src/worker/start.test.ts`, `apps/web/worker.ts`, `eslint.config.mjs`, `apps/web/src/db/lint-rules.test.ts`, `apps/web/package.json` (script `jobs:retry`).

**Interfaces:**
- `getSendBoss(): Promise<PgBoss>` — web process singleton on `globalThis` (as `getDb`), `connectionString: DATABASE_URL`, `max: 2`, `migrate: false`, `createSchema: false`, `supervise: false`, `schedule: false`; `start()` once.
- `startWorker({ appDb, workerUrl, log }): Promise<WorkerHandle>` — creates the `crm_worker` instance with the Task 17 options, registers `HANDLERS` (`Record<QueueName, Handler>`), registers schedules (Task 24), logs `worker ready`; `stop()` stops pg-boss gracefully, then ends the `crm_app` pool.
- `pnpm --filter @crm/web jobs:retry -- --queue <name> --id <uuid>`: as `crm_worker`, calls `boss.retry(queue, id)`; prints `{"level":"info","msg":"job retried"}` or exits 1 with `job not found` (EVT-05 admin command; the UI badge comes with the first feature that shows jobs).

- [ ] **Step 1: Failing tests.** `boss.test.ts`: `getSendBoss()` options assert the four locked switches are `false` and `max` is 2 (reads the instance's resolved config, or wraps the constructor in a spy). `start.test.ts`: `startWorker` processes an `email.send` job sent by `crm_app` (handler stubbed), and `stop()` resolves. `lint-rules.test.ts`: `import pg from "pg"`, `import { Pool } from "pg-pool"` and `await import("pg")` in `apps/web/src/lib/x.ts` each report "pg is allowed only inside pg-boss (Charlie, 2026-09-30)"; `import { PgBoss } from "pg-boss"` is clean.
- [ ] **Step 2: Implement**; `worker.ts` builds `createDb(getWorkerEnv().DATABASE_URL, { max: 3 })` and passes `DATABASE_WORKER_URL`. Lint: `no-restricted-imports` paths `pg`, `pg/*`, `pg-pool`, `pg-cursor`, `pg-native`, `pg-query-stream` for `apps/web/**`, plus the dynamic-import selector already used for core.
- [ ] **Step 3: Run.** `pnpm test` → PASS; `pnpm build` → exit 0 (the worker bundle now includes pg-boss); `pnpm stack:up` → `web` and `worker` healthy, worker log shows `worker ready`; `pnpm stack:down`.
- [ ] **Step 4: Commit and PR checkpoint.** `git commit -m "feat(jobs): web send-only pg-boss instance, worker instance, retry command; ban pg in app code" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`; update `PROJECT.md`-tracked item UNI-04 "pg ban in apps/web" in the PR body (the `setup` reconcile updates §9); push; open PR 5.

## PR 6 — `feat/p1-events` (Tasks 19–20)

**Guardrails:** EVT-01, EVT-02 (n-a: no relay), EVT-03, EVT-05, EVT-06, TEN-03, TEN-05–09, TEN-08, UNI-03, UNI-09, UNI-10, UNI-19, MON-03 (money in event payloads as decimal strings). Known risks R6, R7.

### Task 19: `domain_event`, transactional enqueue, dispatch, `notification`

**Files:** Create `packages/core/src/events/names.ts`, `packages/core/src/events/names.test.ts`, `packages/core/src/events/payload.ts`, `packages/core/src/events/payload.test.ts`, `apps/web/src/db/schema/events.ts`, `apps/web/drizzle/0012_domain_event_notification.sql`, `apps/web/drizzle/0013_rls_domain_event_notification.sql` (custom), `apps/web/src/jobs/enqueue.ts`, `apps/web/src/jobs/domain-event.ts`, `apps/web/src/jobs/enqueue.test.ts`; modify `packages/core/package.json` (export `./events`), `apps/web/src/jobs/handlers.ts`, `apps/web/src/db/privileges.ts`, `apps/web/src/db/isolation.test.ts`, `apps/web/src/db/privileges.test.ts`.

**Interfaces:**
- core: `EVENT_NAMES` = the spec's Part 1 event set (23 names, "Domain events and jobs"), `type EventName`.
- core (`payload.ts`), the JSON-safe event boundary. JSON has no bigint (`JSON.stringify(1n)` throws), and money is `bigint` minor units, so **money crosses the event boundary as a decimal string**:
  ```ts
  export type MinorUnits = string & { readonly __brand: "MinorUnits" };   // canonical base-10 integer, e.g. "9007199254740993"
  export function minorUnits(amount: bigint): MinorUnits;                  // amount.toString(); throws RangeError on a negative amount (spec Money rules: no negatives)
  export function parseMinorUnits(value: string): bigint;                  // accepts only /^(0|[1-9][0-9]*)$/, else throws; BigInt(value)
  export type EventPayloadValue = string /* uuid */ | MinorUnits | number /* safe integer only, e.g. a count */;
  export type EventPayload = Readonly<Record<string, EventPayloadValue>>;  // IDs and amounts only; no bigint member
  ```
  Producers write `{ invoiceId, amount: minorUnits(total) }`; consumers read `parseMinorUnits(payload.amount)`. A `number` is never used for money.
- web: `emitEvent(tx: Tx, event: { name: EventName; version: number; payload: EventPayload }): Promise<string>` — **first** validates the payload with `eventPayloadSchema` (Zod, in `enqueue.ts`): each value is a uuid string, a canonical decimal string (`/^(0|[1-9][0-9]*)$/`) or `z.number().int().safe()`; a raw `bigint` value (from an untyped or `as` caller) is refused before any SQL with `EventPayloadError("payload.<field> is a bigint; encode money with minorUnits()")`, and any other value with `EventPayloadError("payload.<field> is not an ID or amount")` (field name only, never the value, UNI-09). Then it inserts the row (workspace from the transaction setting), then `await (await getSendBoss()).send("domain_event", { workspaceId, eventId }, { db: fromDrizzle(tx, sql), id: eventId })`; returns `eventId`. `enqueueJob(tx, queue, data: JobData)` — same `fromDrizzle(tx, sql)` pattern, for non-event jobs (`email.send`).
- web (`enqueue.ts`), the **job-data check shared by every producer**: `type JobData = Readonly<Record<\`${string}Id\`, string>>` and `jobDataSchema` (Zod) = an object with at least `workspaceId`, every key matching `/^[a-z][A-Za-z]*Id$/` and every value `z.uuid()`. Both `enqueueJob` and the job `emitEvent` sends call `assertJobData(data)` before `send`; a non-ID key or value is refused before any SQL with `JobDataError("job.<key> is not an ID")` (key only, never the value, UNI-09). This is the only path to `send` in app code: `getSendBoss()` is called only in `enqueue.ts` (checked by the "every planned producer" test below).
- worker: the `domain_event` handler runs `withWorkspace(data.workspaceId, tx => load event by id)`; unknown payload fields are ignored (EVT-03); not found → throws (job retries, then dead letter). Core handlers registry is empty in Phase 1.

- [ ] **Step 0: Branch** `feat/p1-events`.
- [ ] **Step 1: Schema.** `domain_event`: `id uuid pk default gen_random_uuid()`, `workspace_id uuid not null references organization(id)`, `name text not null`, `version integer not null`, `payload jsonb not null`, `created_at timestamptz not null default now()`; index `(workspace_id, created_at)`. `notification`: `id uuid pk`, `workspace_id uuid not null references organization(id)`, `user_id uuid not null references "user"(id) on delete cascade`, `kind text not null`, `target_type text not null`, `target_id uuid not null`, `created_at timestamptz not null default now()`, `read_at timestamptz null`; index `(workspace_id, user_id, read_at)`. RLS template; `crm_app`: `domain_event` SELECT, INSERT; `notification` SELECT, INSERT, UPDATE(`read_at`). `notification` has no producer in Phase 1 (its first is Phase 7, owner notifications); it ships as table, policies, grants and isolation fixture only.
- [ ] **Step 2: Failing tests** (`enqueue.test.ts`, `crm_app` + a worker on `crm_worker`):
  - **rollback**: `withWorkspace(A, tx => { emitEvent(tx, …); throw })` → 0 `domain_event` rows and 0 jobs (`pgboss.job_common` read via `adminUrl`), repeated 50 times (EVT-01);
  - **commit**: one row and one job whose id equals the event id; the worker's `domain_event` handler receives it and loads the row under A;
  - **invisible before commit**: while the transaction is open, a second connection (`adminUrl`) sees no job and the worker fetches nothing;
  - **same id twice** → one job;
  - **payload guard**: `emitEvent` with a string field holding an email (`a@x`) is refused by `eventPayloadSchema`, so a payload carries IDs and amounts only; so are a non-canonical amount (`"007"`, `"1.5"`, `"-1"`) and an unsafe number (`2 ** 53`);
  - **raw bigint refused before the transaction writes**: inside `withWorkspace(A, tx => …)`, `emitEvent(tx, { …, payload: { amount: 1n } as unknown as EventPayload })` rejects with `EventPayloadError` naming `payload.amount` and "minorUnits()"; a spy on `tx.execute`/`tx.insert` shows no statement after the `set_config`, and afterwards there are 0 `domain_event` rows and 0 jobs; the same call in a `.ts` fixture without the cast is a type error (`// @ts-expect-error` line in `enqueue.test.ts`, checked by `pnpm typecheck`);
  - **large amount round-trips exactly**: `emitEvent` with `{ invoiceId, amount: minorUnits(9007199254740993n) }` (2^53 + 1, beyond `Number.MAX_SAFE_INTEGER`) commits; through `adminUrl`, `select jsonb_typeof(payload->'amount'), payload->>'amount' from domain_event` returns `string`, `9007199254740993`; the worker's `domain_event` handler loads the row under A and `parseMinorUnits(row.payload.amount) === 9007199254740993n`; no step goes through `Number`;
  - **atomic with the large amount**: the same emit followed by a throw in the same `withWorkspace` → 0 `domain_event` rows and 0 jobs; the committed case → exactly one row and one job with `job.id = event.id` (event and job never apart);
  - **job data IDs only** (`PROJECT.md` §9): `enqueueJob(tx, "email.send", { workspaceId, userId, kind: "test" } as unknown as JobData)` rejects with `JobDataError` naming `job.kind`, and so do a non-uuid value (`{ workspaceId, userId: "a@x" }`) and a missing `workspaceId`; `{ workspaceId, userId }` is accepted; each refusal leaves 0 jobs. **Every planned producer**: a table-driven case lists every `enqueueJob`/`emitEvent` call site in Phase 1 (`domain_event` through `emitEvent` → `{ workspaceId, eventId }`, which has no app call site in Phase 1 and is run directly; `email.send` through `enqueueJob` in `settings/email/actions.ts` → `{ workspaceId, userId }`, a row added by Task 27 Step 1 when that producer lands), runs each, and asserts through `adminUrl` that the stored `pgboss.job_common.data` has only keys ending in `Id` with uuid values; a second check scans the non-test files under `apps/web/src` for `enqueueJob(`, `emitEvent(` and `getSendBoss(` and fails if an `enqueueJob`/`emitEvent` call site is not in that table or `getSendBoss(` appears outside `enqueue.ts` (so a new producer must be added and checked);
  - **unknown fields**: a job data object with an extra field is processed (EVT-03);
  - **cross-workspace**: job data with workspace B and an event id from A → handler throws "event not found" (RLS hides it), job retries;
  - **crm_app cannot read payloads** (repeated from Task 16 next to the producer).
  - `privileges.test.ts`, TEN-03 / UNI-10 part 2: no runtime role or PUBLIC holds DELETE, UPDATE or TRUNCATE on `domain_event`; owner is `crm_migrator`.
  - core `payload.test.ts`: `minorUnits(0n)` = `"0"`; `minorUnits(9007199254740993n)` = `"9007199254740993"`; `minorUnits(-1n)` throws; `parseMinorUnits` round-trips `2n ** 63n - 1n` exactly and refuses `""`, `"01"`, `"1e3"`, `" 1"`, `"-1"`.
- [ ] **Step 3: Implement**; run `pnpm vitest run apps/web/src/jobs apps/web/src/db packages/core/src/events` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(events): domain_event with transactional pg-boss enqueue; notification table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 20: Gate — maintenance through PgBouncer for a full cycle; `/api/health` queue check

**Files:** Create `apps/web/src/test/pgbouncer.ts`, `apps/web/src/jobs/pooler.gate.test.ts`, `apps/web/vitest.gates.config.mts`; modify `apps/web/vitest.config.mts` (exclude `**/*.gate.test.ts`), `apps/web/package.json` and root `package.json` (`test:gates`), `.github/workflows/ci.yml`, `apps/web/src/lib/health.ts`, `apps/web/src/lib/health.test.ts`, `apps/web/src/app/api/health/route.ts`, `docs/DECISIONS.md`.

- [ ] **Step 1: PgBouncer image.** Find the Docker Hub tag of `edoburu/pgbouncer` that carries PgBouncer 1.25.2 and resolve its digest: `docker buildx imagetools inspect edoburu/pgbouncer:<tag>`. The spike used digest prefix `4c1ca296ef52` (`CRM-spikes/RESULTS.md` line 7); use the same image if the tag still resolves to it, else record the new digest and why. Pin `tag@sha256:…` in `pgbouncer.ts` and DECISIONS.
- [ ] **Step 2: Helper.** `startPgBouncer(db: TestDatabase)` starts the image on the Testcontainers network with a generated `pgbouncer.ini` (`pool_mode = transaction`, `default_pool_size = 2`, `max_prepared_statements = 0`, `auth_type = scram-sha-256`) and `userlist.txt` holding the test passwords of `crm_app` and `crm_worker`, copied in with `withCopyContentToContainer`; returns pooled URLs for both roles.
- [ ] **Step 3: The gate test** (`pooler.gate.test.ts`, timeout 180 s): the Task 17 scenario, but `crm_worker` **and** `crm_app` connect through PgBouncer, with the worker running at least 75 s so supervise, maintenance and monitor each complete at least one cycle at their configured intervals; assertions as in Task 17 plus: the `expireInSeconds` job ends `failed` by maintenance, a completed job with `deleteAfterSeconds` 1 is deleted, the cron job fired, zero `42501`, zero `error` events. The chosen provider's run is the Stage 3 pre-cutover gate, not this test (spec R6).
- [ ] **Step 4: Scripts and CI.** `apps/web` `"test:gates": "vitest run --config vitest.gates.config.mts"`, root `"test:gates": "pnpm --filter @crm/web test:gates"`. In `ci.yml` job `checks`: add `- run: pnpm test:gates` after `pnpm test`, and raise `timeout-minutes` from 15 to 30 (Risk 7).
- [ ] **Step 5: Health.** `checkHealth(pingDb, pingQueue, timeoutMs)` → body `{ status, db, queue }`; `queue` is `ok` when `select version from pgboss.version` as `crm_app` returns the expected version. Test: both ok → 200; queue error → 503 with `queue: "error"`, never the error text; route `no-store` unchanged.
- [ ] **Step 6: Run.** `pnpm test && pnpm test:gates` → PASS (record the gate's duration in the PR body). `pnpm stack:up`; `curl -s localhost:3000/api/health` → `{"status":"ok","db":"ok","queue":"ok"}`.
- [ ] **Step 7: Commit and PR checkpoint.** `git commit -m "test(jobs): pg-boss maintenance through PgBouncer as crm_worker; health reports the queue" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`; push; open PR 6.

## PR 7 — `feat/p1-rate-limits` (Tasks 21–24)

**Guardrails:** AUTH-01 (hard; `/api/auth/*` is the named exception, revision 7 (d)), AUTH-05, AUTH-06, AUTH-07 (check only, Task 24 Step 2), AUTH-11, UNI-02, UNI-03, UNI-09, UNI-16, UNI-19, TEN-10, EVT-06. LINK-03 and LINK-07 are **n-a in Phase 1** (link and OTP limits ship in Phase 7; the spec's Verification says so). Spec "Rate limits" (storage and keys, system module, client IP, atomic consume, numbers, response) and "Better Auth endpoints".

### Task 21: Limits, the `rate_limit` table and the atomic consume

**Files:** Create `apps/web/src/db/system/rate-limit.ts`, `apps/web/src/db/system/rate-limit.test.ts`, `apps/web/drizzle/0014_rate_limit.sql`; modify `apps/web/src/db/schema/system.ts`, `packages/core/src/security/limits.ts`, `packages/core/src/security/limits.test.ts`, `apps/web/src/db/privileges.ts`, `apps/web/src/test/catalog.ts` (`NO_RLS_ALLOW_LIST` gains `rate_limit`).

- [ ] **Step 0: Branch** `feat/p1-rate-limits`.
- [ ] **Step 1: Limits.** Add, each with the comment-free spec citation in the test name ("spec Rate limits, Numbers row N"): `AUTH_DEFAULT_LIMIT = { windowSeconds: 60, max: 100 }`, `SIGN_IN_IP_LIMIT = { 60, 10 }`, `SIGN_IN_ACCOUNT_FAILURE_LIMIT = { 900, 5 }`, `SIGN_UP_IP_LIMIT = { 3600, 10 }`, `TWO_FACTOR_VERIFY_IP_LIMIT = { 60, 10 }`, `PASSWORD_CHECK_IP_LIMIT = { 900, 10 }`, `RATE_LIMIT_ROW_RETENTION_SECONDS = 86_400` ("removes counter rows whose window ended more than 24 hours ago"). The password-reset, link, OTP and Turnstile-off rows are **not** added now (UNI-02: "a value is added when the feature that uses it lands"). `limits.test.ts` asserts each value.
- [ ] **Step 2: Table.** `rate_limit` (system table, no RLS, spec: Better Auth's rate-limit table; here owned by the app because Better Auth uses `customStorage`, Settled item 5): `key text primary key`, `count integer not null check (count >= 0)`, `window_start timestamptz not null`, `window_seconds integer not null check (window_seconds > 0)`. Grants `crm_app` SELECT, INSERT, UPDATE, DELETE (manifest). `pnpm db:generate --name rate_limit`.
- [ ] **Step 3: Failing tests** (`rate-limit.test.ts`, `crm_app`):
  - grants exactly `max` in one window and refuses the next (`allowed: false`, `retryAfterSeconds` > 0);
  - a new window starts after `window_seconds`, using the injectable `now` (tests pass a timestamp; production passes `null` → `clock_timestamp()`);
  - **concurrency** (two `postgres` pools = two processes' worth of connections, 50 parallel calls, limit 10, count starting at 9): exactly one grant; **window boundary**: 20 parallel calls at a `now` past the window end start the new window once (final `count` equals the number granted, `window_start` equal for all granted);
  - **persistence**: a counter written by pool 1 is seen by a new pool 2 (restart);
  - `giveBack(key, reservedWindowStart)` decrements only when `window_start` matches and `count > 0`; after the window rolled it changes nothing;
  - `cleanupExpired(now)` deletes only rows with `window_start + window_seconds + 24 h < now`.
- [ ] **Step 4: Implement** (system module only, TEN-10):
  ```ts
  // consume: one statement; no returned row = refused
  INSERT INTO rate_limit AS r (key, count, window_start, window_seconds)
  VALUES ($1, 1, coalesce($4::timestamptz, clock_timestamp()), $3)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.window_start + make_interval(secs => r.window_seconds) <= coalesce($4::timestamptz, clock_timestamp())
                 THEN 1 ELSE r.count + 1 END,
    window_start = CASE WHEN r.window_start + make_interval(secs => r.window_seconds) <= coalesce($4::timestamptz, clock_timestamp())
                 THEN coalesce($4::timestamptz, clock_timestamp()) ELSE r.window_start END,
    window_seconds = EXCLUDED.window_seconds
  WHERE r.window_start + make_interval(secs => r.window_seconds) <= coalesce($4::timestamptz, clock_timestamp())
     OR r.count < $2
  RETURNING count, window_start;
  ```
  On refusal, a plain read of `window_start + window_seconds` computes `retryAfterSeconds` (read only for the header; the decision was atomic). `giveBack`: `UPDATE rate_limit SET count = count - 1 WHERE key = $1 AND window_start = $2 AND count > 0`. Keys are prefixed: `ba:` (Better Auth), `acct:` (account HMAC). Exported: `consume`, `giveBack`, `cleanupExpired`.
- [ ] **Step 5: Run** `pnpm vitest run apps/web/src/db/system/rate-limit.test.ts packages/core/src/security` → PASS. Commit: `git commit -m "feat(auth): database rate-limit counters with one atomic consume statement" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 22: One client-IP derivation for both auth paths; `forward.ts` change

**Files:** Create `apps/web/src/lib/auth/client-ip.ts`, `apps/web/src/lib/auth/client-ip.test.ts`, `apps/web/src/lib/auth/handle.ts`; modify `apps/web/src/lib/env.ts`, `apps/web/src/lib/env.test.ts`, `apps/web/src/lib/auth/forward.ts`, `apps/web/src/lib/auth/forward.test.ts`, `apps/web/src/app/api/auth/[...all]/route.ts`, `.env.example`, `docker/compose.dev.yml`.

**Interfaces:**
- env: `TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip" | "x-forwarded-for" | "none"`, required when `NODE_ENV=production` (start-up fails without it), default `none` otherwise.
- `CLIENT_IP_HEADER = "x-crm-client-ip"` (internal); `PLACEHOLDER_CLIENT_IP = "192.0.2.1"` (TEST-NET-1, RFC 5737: a valid address that is never a real client).
- `deriveClientIp(headers: Headers, setting): { ip: string; fallback: boolean }` — reads only the configured header; accepts exactly one valid IPv4 or IPv6 address (`node:net` `isIP`); IPv6 is reduced to its /64 prefix; anything else (missing, empty, list, invalid, setting `none`) → placeholder with `fallback: true` and one warning line `{"level":"warn","msg":"client ip fallback"}` without the value (UNI-09).
- `prepareAuthRequest(request: Request): Request` — new request with `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, `CF-Connecting-IP` and `x-crm-client-ip` removed, then `x-crm-client-ip` set to the derived IP.
- `handleAuthRequest(request: Request): Promise<Response>` — `prepareAuthRequest` → (Task 23: account keys) → (Task 24: enabled paths) → `getAuth().handler(prepared)` → (Task 23: uniform 429).
- Better Auth config: `advanced.ipAddress.ipAddressHeaders: ["x-crm-client-ip"]`.

- [ ] **Step 1: Failing unit tests** (`client-ip.test.ts`): SaaS setting reads only `CF-Connecting-IP` and ignores `X-Forwarded-For`; self-host setting reads only `X-Forwarded-For` and refuses a two-address list; `none` → placeholder; malformed → placeholder; IPv6 `2001:db8:1:2:3:4:5:6` and `2001:db8:1:2::9` → same key; `prepareAuthRequest` overwrites a caller-supplied `x-crm-client-ip` and strips the four forwarding headers; body, method, cookies and origin are preserved.
- [ ] **Step 2: `forward.ts` change** (spec "Required Phase 1 change to `forward.ts`"): remove `"x-forwarded-for"` from `FORWARDED_HEADERS`; build the forwarded request from the incoming `headers()` (all of `FORWARDED_HEADERS` plus the configured trusted header), then pass it through `handleAuthRequest` instead of `getAuth().handler`. `forward.test.ts` asserts the request Better Auth receives has `x-crm-client-ip` = the edge IP and no `x-forwarded-for`.
- [ ] **Step 3: Route.** `route.ts` `GET` and `POST` become `handleAuthRequest(request)` (the `toNextJsHandler` wrapper is replaced by the direct handler call; check in 1.7.6 that `toNextJsHandler` adds nothing but method dispatch before removing it, else keep it and pass the prepared request).
- [ ] **Step 3a: Audit IP (Task 31).** `crmAuthAudit` passes `ip` = the `x-crm-client-ip` value of the request Better Auth received (`ctx.headers?.get(CLIENT_IP_HEADER)`; only `prepareAuthRequest` sets it, after stripping any caller copy; an IPv6 address is its /64 prefix, as for the limiter key). `auth-audit.test.ts` gains two cases: a sign-in through `handleAuthRequest` with `CF-Connecting-IP: 203.0.113.7` (SaaS setting) stores `ip = '203.0.113.7'`; a caller-supplied `x-crm-client-ip: 198.51.100.9` is not stored. Also modify `apps/web/src/lib/auth/auth-audit-plugin.ts` and `apps/web/src/lib/auth/auth-audit.test.ts`.
- [ ] **Step 4: Run** `pnpm vitest run apps/web/src/lib` → PASS. Commit: `git commit -m "feat(auth): one trusted client-IP derivation for /api/auth and form submits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 23: Better Auth on the database limiter; per-account sign-in failures; uniform 429

**Files:** Create `apps/web/src/lib/auth/rate-limit.test.ts`; modify `apps/web/src/lib/auth/config.ts`, `apps/web/src/lib/auth/handle.ts`.

- [ ] **Step 1: Config.** `rateLimit: { enabled: true, window: AUTH_DEFAULT_LIMIT.windowSeconds, max: AUTH_DEFAULT_LIMIT.max, customRules: { "/sign-in/email": SIGN_IN_IP_LIMIT, "/sign-up/email": SIGN_UP_IP_LIMIT, "/two-factor/verify-totp": TWO_FACTOR_VERIFY_IP_LIMIT, "/two-factor/verify-backup-code": TWO_FACTOR_VERIFY_IP_LIMIT, …every enabled path whose body carries a password field: PASSWORD_CHECK_IP_LIMIT }, customStorage: { consume: (key, rule) => consume("ba:" + key, rule.max, rule.window) → { allowed, retryAfter } } }` (mapping seconds; values from `limits.ts`). The "path checks a password" list is read from the installed 1.7.6 endpoint body schemas (`password` or `currentPassword` field) and committed in `enabled-paths.ts` (Task 24) as `PASSWORD_CHECK_PATHS`. `enabled: true` turns the limiter on in dev and tests too (spec: "the tests run with them on"); E2E keeps `E2E_RATE_LIMITED` for its own pacing (Risk 8).
- [ ] **Step 2: Account key** in `handleAuthRequest` for `POST /sign-in/email` only (reset rows arrive with reset): parse a clone of the JSON body; `email` normalized (trim, lowercase, NFC) → key `acct:signin:` + base64url(HMAC-SHA-256(hkdfKey, email)); `consume(key, 5, 900)`; refused → uniform 429 without calling Better Auth; granted → call Better Auth; on a 2xx response (or Better Auth's 2FA-required success shape), `giveBack(key, reservedWindowStart)`. A body without a string `email` skips the key (Better Auth answers 400 as today).
- [ ] **Step 3: Uniform 429.** Every 429 leaving `handleAuthRequest`, from Better Auth or the app limiter, is rebuilt as status 429, body exactly `{"message":"Too many requests. Please try again later."}`, headers `Retry-After` and `X-Retry-After` (same value), `Content-Type: application/json`, `Cache-Control: no-store`. Forms keep showing the Phase 0 message "Too many attempts. Wait a moment and try again." (`messages.ts`, status 429 already mapped).
- [ ] **Step 4: Failing tests** (`rate-limit.test.ts`: Testcontainers + **two** `next start` processes on different ports sharing the database, built once in `beforeAll` with `pnpm --filter @crm/web build`; behind a tiny Node test edge (`http` proxy in the test) that sets the trusted header, run once with `TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip` and once with `x-forwarded-for`):
  - each Phase 1 row of the spec's table (default path, sign-in IP, sign-in account, sign-up IP, 2FA verify IP, password-check IP): the allowed number succeeds, the next gets 429 with `Retry-After`;
  - the 429 body is byte-identical for an existing and an unknown email; sign-in account failures count an unknown email exactly like a known one; a successful sign-in does not count toward the account cap;
  - a counter is shared by the two processes and survives restarting one of them (AUTH-06);
  - **client-IP parity**: a direct `POST /api/auth/sign-in/email` and the sign-in form (server action → `postToAuth`) from the same edge IP reach 429 at the row's limit together, not at twice it;
  - **forged headers**: requests carrying forged `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, `CF-Connecting-IP` or `x-crm-client-ip`, to the route and through the form, with the forged value rotated on every request, are keyed by the edge IP and hit the cap at the limit;
  - **fallback**: with the edge not setting the header, or setting a malformed one, all requests share the placeholder key and are still limited;
  - **Better Auth concurrency**: sign-in per IP at 9 of 10, 30 concurrent requests across both processes → exactly one more passes the limiter (counted by the `ba:` row's final count and by the number of non-429 responses);
  - `/two-factor/*` lockout defaults unchanged (5 attempts per challenge, 10 failures → 900 s), asserted as in Phase 0.
- [ ] **Step 5: Run** `pnpm vitest run apps/web/src/lib/auth/rate-limit.test.ts` → PASS; `pnpm test:e2e` → PASS. Commit: `git commit -m "feat(auth): database-backed Better Auth limits, per-account sign-in failures, uniform 429" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 24: Phase 1 enabled paths; counter and idempotency cleanup schedules

**Files:** Create `apps/web/src/lib/auth/enabled-paths.ts`, `apps/web/src/lib/auth/enabled-paths.test.ts`, `apps/web/src/jobs/cleanup.ts`, `apps/web/src/jobs/cleanup.test.ts`; modify `apps/web/src/lib/auth/config.ts`, `apps/web/src/lib/auth/handle.ts`, `apps/web/src/jobs/handlers.ts`, `apps/web/src/worker/start.ts`, `docs/runbooks/phase-1-security.md` (new), `docs/DECISIONS.md`.

- [ ] **Step 1: Enabled set.** `PHASE1_ENABLED_AUTH_PATHS` = the spec's list ("Enabled in Phase 1") mapped to 1.7.6 paths, read from `Object.values(auth.api)` endpoint `path` values in the installed version and committed: `/sign-up/email`, `/sign-in/email`, `/sign-out`, `/get-session`, `/list-sessions`, `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions`, `/change-password`, `/update-user`, `/two-factor/enable`, `/two-factor/disable`, `/two-factor/verify-totp`, `/two-factor/verify-backup-code`, `/two-factor/generate-backup-codes`, `/two-factor/get-totp-uri` (only if the enrolment UI calls it; check), `/organization/create`, `/organization/update`, `/organization/set-active`, `/organization/list` (the exact strings are whatever 1.7.6 exposes for these features; record any rename in the PR). Config: `disabledPaths` = every endpoint path of the built instance minus this set (computed once in `createAuth` from the instance's endpoints, so a new upstream path is disabled by default). `handleAuthRequest` also answers 404 to any path not in the set before calling Better Auth (second layer, and it covers `auth.api` paths with no HTTP route).
- [ ] **Step 2: Tests** (`enabled-paths.test.ts`, `next start` against Testcontainers): every path the installed version exposes is requested (POST and GET); exactly the enabled set answers non-404 and every other path answers 404; a snapshot of the full path list is committed so an upgrade that adds a path fails the test until it is classified; a cross-origin `POST /api/auth/sign-in/email` (`Origin: https://evil.example`) is refused (Better Auth CSRF, 403); the input-limits refusals (`PASSWORD_TOO_LONG`, `NAME_TOO_LONG`) answer identically for an existing and an unknown email (AUTH-05); **AUTH-07**: a user signed in twice (sessions S1, S2) changes the password through S1 → S2's `/get-session` returns no session; the same after S1 enables 2FA and after S1 disables it (if 1.7.6 does not do this as configured, stop and raise it before PR 7, see the self-check).
- [ ] **Step 3: Cleanup jobs** (EVT-06: worker-owned, no HTTP route). `startWorker` calls `boss.schedule("rate_limit.cleanup", RATE_LIMIT_CLEANUP_CRON)` and `boss.schedule("idempotency.cleanup", IDEMPOTENCY_CLEANUP_CRON)` (both daily at a fixed UTC minute; operational constants in `cleanup.ts`, recorded in DECISIONS). `rate_limit.cleanup` → `cleanupExpired(null)` through the system module as `crm_app` (no workspace context: system table). `idempotency.cleanup` → for each workspace id from the system module (`listWorkspaceIds()`), `withWorkspace(id, tx => delete from idempotency_key where expires_at < clock_timestamp())`.
- [ ] **Step 4: Tests** (`cleanup.test.ts`): after the job runs, only expired counter rows are gone; only expired idempotency rows are gone, in every workspace, and no other workspace's rows are touched by a single `withWorkspace`; the schedules are registered by `startWorker` (`boss.getSchedules()` lists both); a test walks `apps/web/src/app/**/route.ts` and asserts no route imports `src/jobs/cleanup` (no HTTP trigger).
- [ ] **Step 5: Runbook** `docs/runbooks/phase-1-security.md`: the limits table with numbers from `limits.ts`; `TRUSTED_CLIENT_IP_HEADER` per deployment (SaaS behind the Tunnel: `cf-connecting-ip`; self-host behind Caddy: `x-forwarded-for` with Caddy overwriting, not appending, and stripping `Forwarded`, `X-Real-IP`, `CF-Connecting-IP`; the web container reachable only through the edge); what a fallback warning means; that rotating `AUTH_SECRET` resets account counters.
- [ ] **Step 6: Run** `pnpm test && pnpm test:e2e && pnpm lint && pnpm typecheck && pnpm build` → all pass. Commit and PR checkpoint: `git commit -m "feat(auth): only Phase 1 Better Auth paths reachable; worker-owned cleanup schedules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`; push; open PR 7.

## PR 8 — `feat/p1-headers-email` (Tasks 25–29)

**Guardrails:** UNI-17, UNI-18, UNI-09, UNI-11, UNI-16, UNI-06, AUTH-01 (hard), AUTH-02, AUTH-03, EVT-01, EVT-05; for the `/settings/email` page and nav link in Task 27 (audited row by row in the self-check): FE-01, FE-02, FE-04, FE-05 (hard), FE-06, FE-07, FE-10, FE-11, FE-12, FE-13, FE-14, FE-20, FE-21, FE-22, FE-23, FE-31, FE-32, FE-34, FE-50, FE-60, FE-61, FE-70, FE-71 and A11Y-01 to A11Y-06, with `FRONTEND_STANDARDS.md`. FILE rules n-a (no uploads).

### Task 25: Nonce CSP and security headers

**Prerequisite:** ASK 6 (HSTS values) answered.

**Files:** Create `apps/web/proxy.ts`, `apps/web/src/lib/security-headers.ts`, `apps/web/src/lib/security-headers.test.ts`, `apps/web/e2e/security-headers.spec.ts`; modify `apps/web/next.config.ts`, `apps/web/src/app/layout.tsx`, `docs/runbooks/phase-1-security.md`, `docs/DECISIONS.md`.

**Interfaces:** `buildCsp(nonce: string, isDev: boolean): string`; `STATIC_SECURITY_HEADERS: { key: string; value: string }[]`.

- [ ] **Step 0: Branch** `feat/p1-headers-email`.
- [ ] **Step 1: Failing unit test.** `buildCsp` returns, in this order, `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'nonce-<n>'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` (Next 16 docs pattern); in dev it adds `'unsafe-eval'` to `script-src` and uses `'unsafe-inline'` for `style-src` (docs: React dev tooling); no `'unsafe-inline'` in production. `STATIC_SECURITY_HEADERS` = `Strict-Transport-Security` (value from ASK 6), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and for non-HTML responses `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.
- [ ] **Step 2: Implement.** `proxy.ts` (Next 16 `proxy` export): nonce = base64 of 16 bytes from `crypto.getRandomValues`; sets `x-nonce` and `Content-Security-Policy` on the request and the response; matcher excludes `_next/static`, `_next/image`, `favicon.ico` and prefetches (docs). It reads no database (AUTH-11). `next.config.ts` `headers()` applies `STATIC_SECURITY_HEADERS` to `/(.*)` and the `default-src 'none'` CSP to `/api/(.*)`. The root layout calls `await connection()` so every page renders dynamically (docs: nonces need dynamic rendering; Risk 9). Cookies: Phase 0 already sets `Secure` for non-loopback origins, `HttpOnly` and `SameSite=Lax` through Better Auth; the E2E asserts them (UNI-18).
- [ ] **Step 3: E2E** (`security-headers.spec.ts`; runs in the existing `chromium`, `tablet-768` and `mobile-320` projects): on `/sign-in` and an authenticated page, the response has the CSP with a nonce that differs between two loads, every `<script>` carries that nonce, and the page records **zero** `securitypolicyviolation` events and zero console CSP errors through sign-in, 2FA enrolment and workspace switching; `/api/health` has `default-src 'none'`; the session cookie has `HttpOnly`, `SameSite=Lax` and (behind `https` in the image job) `Secure`.
- [ ] **Step 4: Decisions (UNI-17):** where each header is applied (proxy for page CSP; `next.config.ts` for static headers; Cloudflare/Caddy add nothing that conflicts), and the HSTS values from ASK 6.
- [ ] **Step 5: Run** `pnpm vitest run apps/web/src/lib/security-headers.test.ts && pnpm test:e2e` → PASS. Commit: `git commit -m "feat(web): nonce CSP via proxy and static security headers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 26: Email adapter (SMTP, Resend), React Email, Mailpit

**Files:** Create `apps/web/src/adapters/email/index.ts`, `smtp.ts`, `resend.ts`, `contract.test.ts`, `apps/web/src/emails/test-email.tsx`; modify `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/lib/env.ts`, `apps/web/src/lib/env.test.ts`, `.env.example`, `docker/compose.dev.yml`, `docs/runbooks/phase-1-security.md`, `docs/DECISIONS.md`.

**Interfaces:**
```ts
interface EmailMessage { to: string; subject: string; html: string; text: string }
interface EmailAdapter { send(message: EmailMessage): Promise<{ providerId: string }> }
function createEmailAdapter(env: EmailEnv): EmailAdapter
```
Env (worker only; web never sends): `EMAIL_PROVIDER: "smtp" | "resend"`, `EMAIL_FROM` (an RFC 5322 address with display name; **ASK 7** for the production value), `SMTP_URL` (when smtp; `smtp://mailpit:1025` in dev), `RESEND_API_KEY` (when resend; never logged).

- [ ] **Step 1: Dependencies.** `pnpm --filter @crm/web add nodemailer@<version> @react-email/render@<version>` with the versions from "Facts verified" re-checked by `pnpm view`; UNI-06 ladder rows (nodemailer: Node has no SMTP client; @react-email/render: the spec's React Email; resend SDK not added, `fetch` is enough; `@react-email/components` not added). `pnpm audit --audit-level high` exit 0.
- [ ] **Step 2: Mailpit.** Compose service `mailpit` (`axllent/mailpit:<tag>@sha256:<digest>`, resolved with `docker buildx imagetools inspect` and recorded), ports `127.0.0.1:8025:8025` (UI/API) and internal 1025 (SMTP); `worker` env `EMAIL_PROVIDER: smtp`, `SMTP_URL: smtp://mailpit:1025`, `EMAIL_FROM: "CRM Dev <dev@localhost>"` (dev only).
- [ ] **Step 3: Failing contract test** (`contract.test.ts`, one `describe.each` over both adapters): SMTP against a Mailpit Testcontainer — `send` returns an id and Mailpit's API shows one message with the same `to`, `subject`, `text`, and HTML; Resend against a local `http` server standing in for `https://api.resend.com/emails` (base URL injectable; no real Resend call, UNI-11) — the request is `POST /emails` with `Authorization: Bearer <key>`, JSON `{ from, to: [to], subject, html, text }`, and a `{ id }` response becomes `providerId`; a non-2xx response throws `EmailSendError` whose message has the status but not the key or the address (UNI-09).
- [ ] **Step 4: Template.** `test-email.tsx` renders a plain React element tree (`html`, `body`, `p`) to HTML and text with `@react-email/render` (`render(el)` and `render(el, { plainText: true })`). Its words are **ASK 8** (draft: subject "Test email from CRM", body "This is a test email sent from your CRM workspace settings. If you received it, email delivery works."); the draft ships only after Charlie's OK.
- [ ] **Step 5: Runbook (UNI-16).** `docs/runbooks/phase-1-security.md` gains an "Email" section in this PR: the four env vars and which container gets them (worker only), dev Mailpit (`http://localhost:8025`), switching `EMAIL_PROVIDER`, rotating `RESEND_API_KEY` (host secret store, restart `worker`), and the sending domain's SPF/DKIM/DMARC (production value: ASK 7).
- [ ] **Step 6: Run** `pnpm vitest run apps/web/src/adapters` → PASS. Commit: `git commit -m "feat(email): SMTP and Resend adapters with contract tests; React Email render; Mailpit in dev" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

### Task 27: Test email — web → job → Mailpit

**Files:** Create `apps/web/src/app/(app)/settings/email/page.tsx`, `actions.ts`, `send-test-email-form.tsx`, `apps/web/src/jobs/email-send.ts`, `apps/web/src/jobs/email-send.test.ts`, `apps/web/src/db/system/users.ts`, `apps/web/src/test/mailpit.ts`, `apps/web/e2e/test-email.spec.ts`; modify `apps/web/src/app/(app)/nav-links.tsx`, `apps/web/src/lib/auth/messages.ts`, `apps/web/src/jobs/handlers.ts`, `apps/web/src/jobs/enqueue.test.ts` (the `email.send` row of "every planned producer"), `apps/web/playwright.config.ts`, `apps/web/e2e/accessibility.spec.ts`, `apps/web/e2e/no-javascript.spec.ts`, `apps/web/e2e/helpers.ts` (set a member's role through the test database).

- [ ] **Step 1: Action** (`actions.ts`): `export const sendTestEmail = action({ name: "email.sendTest", minRole: "admin", input: z.object({}), idempotent: true, handler: async ({ tx, userId, workspaceId }) => { await enqueueJob(tx, "email.send", { workspaceId, userId }); await recordAudit(tx, { actorUserId: userId, action: "email.test_requested", targetType: "user", targetId: userId }); return { queued: true }; } })`. Job data is IDs only (`PROJECT.md` §9; spec "Domain events and jobs"): there is no `kind` or other discriminator. In Phase 1 the `email.send` queue has exactly one producer (this action), so the handler derives the operation from the queue name. A second kind of email in a later phase gets its own queue (a migration, R7) or a reviewed spec change that permits a bounded discriminator; it never adds a non-ID field here. Add the `email.send` row to `enqueue.test.ts` "every planned producer" (Task 19); it fails until the stored data is exactly `{ workspaceId, userId }`. Admin and Owner only (builder proposal: the matrix gives "email settings" to Admin and Owner).
- [ ] **Step 2: Handler** (`email-send.ts`): parses `data` with `z.object({ workspaceId: z.uuid(), userId: z.uuid() })` (unknown fields ignored, EVT-03; a missing or non-uuid ID → throws, dead letter after retries); the operation is fixed by the queue `email.send` (the test email; no field selects it). `withWorkspace(data.workspaceId, …)` checks the user is still a member (system module); `getUserEmail(userId)` (system module, `users.ts`); renders the test template; `adapter.send`; records an audit entry `email.test_sent` with `targetId` = user id and no address. Test (`email-send.test.ts`): a job with data exactly `{ workspaceId, userId }` (asserted by reading `pgboss.job_common.data` through `adminUrl`: its key set is exactly `["userId", "workspaceId"]`) → one Mailpit message to the user with the test subject; a user no longer a member → no message, job fails; data with a non-uuid `userId` → no message, job fails.
- [ ] **Step 3: Page** (`/settings/email`), following `FRONTEND_STANDARDS.md` and the Phase 0 form pattern (`workspace-switcher.tsx`, `sign-out-button.tsx`, `two-factor-setup.tsx`):
  - **Structure (FE-01, FE-06, FE-07):** a server component inside the existing app layout (its one `<main>`); one `<h1>Email</h1>`; a short `<p>` saying what the button does; no `<section>` unless it has a heading (FE-02).
  - **Form (FE-05, FE-31, FE-32):** a `<form action={…}>` whose only control is a `<button type="submit">` "Send a test email" (its text is its accessible name; there is no input to label, A11Y-03 applies to the button's description and the messages below). The idempotency key is a hidden `<input type="hidden" name="idempotencyKey">` generated per render (not a user control). It works without JavaScript (plain form post to the server action, server-rendered result). `send-test-email-form.tsx` is the only client component, and only for `useActionState` pending state (button `disabled` + "Sending…" while pending), the smallest component that owns that state (FE-31).
  - **Messages (A11Y-03):** success "Test email queued." in a `<p role="status">`; an error in a `<p id="send-test-email-error" role="alert">` with the button's `aria-describedby="send-test-email-error"` while it shows, as in Phase 0. Error texts map the `action()` results: `FORBIDDEN` → "Only an Admin or Owner can send a test email."; `UNAUTHENTICATED` → redirect to `/sign-in` (as Phase 0); a network or server failure → the form is wrapped in the existing `SubmitFailureBoundary` and shows its own retry message (new constant in `messages.ts`, e.g. "We couldn't send the test email. Try again.", same style as `WORKSPACE_SWITCH_FAILED`) in the same `role="alert"` element. All wording is part of **ASK 8**.
  - **Layout (FE-10, FE-11, FE-12):** the same shape as `settings/security/page.tsx`: the `<h1>` is a direct child of the layout's `<main>` (already `flex flex-col gap-8`), followed by one `<div className="flex max-w-xl flex-col gap-4">` holding the intro `<p>` and the form. The form is `flex flex-col gap-2` (button, then the message element). Every layout here is a single axis, so Flexbox, no Grid (FE-10); siblings are spaced only by `gap` on the parent, no per-child `m*-` classes (FE-12); no absolute positioning (FE-11). The `expectAccessible` overflow check covers it at 320, 768 and desktop (Step 4).
  - **Components and decision ladder (FE-20, FE-21, FE-60, FE-61):** two files only — `page.tsx` (server: session, role check, copy) and `send-test-email-form.tsx` (client: `useActionState`, pending, result message), with one prop, the bound action. No new shared component: the form has one use (FE-20); no copy of a Phase 0 form, no variant props (FE-21). Ladder, top first (FE-60): native `<form>` posting to a server action (HTML) → existing project code (`components/ui/button.tsx`, `components/submit-failure-boundary.tsx`, `messages.ts`, the `useActionState` pattern of `two-factor-setup.tsx`, the page shape of `settings/security/page.tsx`) → framework (`useActionState`, server actions) → no registry component, no small custom code beyond the mapping from `ActionResult` to a message, no new dependency. FE-61: the app layout and `nav-links.tsx` are extended (one link), not restructured; Phase 0 forms are not touched. The PR body lists this ladder.
  - **Focus and styling (A11Y-01, FE-13, FE-23):** the existing `components/ui/button.tsx` (visible focus ring, tokens); `cn()` for variants; no literal colours.
  - **Authorization (AUTH-02, AUTH-03):** the nav link "Email" (with `aria-current="page"` when active) is shown only to Admin and Owner; the page itself checks the role server-side and shows the `FORBIDDEN` text instead of the form to Staff; `action()` refuses Staff regardless (`minRole: "admin"`). Neither the hidden link nor the page check is the gate.
- [ ] **Step 4: E2E** — every spec below runs in the three existing Playwright projects, `chromium` (desktop 1280), `tablet-768` and `mobile-320` (FE-70), with `respectRateLimit` as the other specs do:
  - `test-email.spec.ts` (flow): Playwright `webServer` gets a second entry `pnpm worker:dev` (with `.env` email settings pointing at the dev Mailpit). Sign up, create a workspace, open `/settings/email`, click "Send a test email", see the `status` "Test email queued.", then poll `apps/web/src/test/mailpit.ts` (`GET http://localhost:8025/api/v1/search?query=to:<email>`) until one message arrives (timeout 30 s). **Error paths:** with `failServerActions(page, "server")` and then `"network"` (existing helper) the click shows the error in `getByRole("alert")`, the button's `aria-describedby` points at it, and no message reaches Mailpit; **Staff:** the user's `member.role` set to `staff` by a new `e2e/helpers.ts` function (connects with `DATABASE_MIGRATOR_URL`; `crm_migrator` owns the no-RLS `member` table), the nav has no "Email" link, `/settings/email` shows the `FORBIDDEN` text and no form, and a replayed form post from the earlier page answers `FORBIDDEN` (AUTH-02). **Loading:** with the server-action request held by a `page.route` handler until released, the button shows "Sending…" and is disabled, then the `status` text appears after release. Zero unhandled page errors (`page.on("pageerror")` empty) in every case.
  - `accessibility.spec.ts` (add a case): `/settings/email` in its initial, success and error states → `expectAccessible` (axe WCAG A/AA in light and dark, plus no horizontal overflow at the project's width); **keyboard only** (A11Y-01, FE-05): from the page start, `tabTo` the button (every control passed shows visible focus; `expectVisibleFocus` on the button), `Enter` submits, the `status` text appears, and focus stays on or returns to a visible element.
  - `no-javascript.spec.ts` (add a case, JavaScript disabled): the form posts, the server-rendered page shows "Test email queued.", and the job is enqueued (FE-31/32).
  - A11Y-06: these are real-browser checks (keyboard + axe), not markup inspection; the PR body lists them per project.
  Run all of it also in the CI `image` job (compose stack has `worker` and `mailpit`).
- [ ] **Step 5: Run** `pnpm test && pnpm test:e2e` → PASS; `pnpm stack:up`, then `E2E_BASE_URL=http://localhost:3000 E2E_RATE_LIMITED=1 pnpm test:e2e` → PASS (spec Verification: "Run via `pnpm dev` and `docker compose up`; … emails (Mailpit) verified in both"). Commit: `git commit -m "feat(email): test email from settings through the worker to Mailpit" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"` (Opus 5.5 reviews the `action()` and handler code before push).

### Task 28: CI and compose wiring check

**Files:** modify `.github/workflows/ci.yml` (the `image` job's CI `.env` gets `TRUSTED_CLIENT_IP_HEADER=x-forwarded-for` and the role/bootstrap variables; the compose stack runs `bootstrap` first), `docker/compose.dev.yml` if the CI run shows a gap.

- [ ] **Step 1:** push the branch and read the CI run: `checks` (incl. `test:gates`), `audit`, `secrets`, `image` (Trivy on the image with pg-boss, nodemailer and react-email) all green. A Trivy CRITICAL/HIGH fixed finding blocks; fix by version, never by ignore without a DECISIONS entry.
- [ ] **Step 2:** commit any wiring fix: `git commit -m "ci: Phase 1 environment for the image job" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

### Task 29: Phase 1 close — done-when run, runbooks, CLAUDE.md commands

**Files:** modify `docs/runbooks/phase-0-auth-database.md`, `docs/runbooks/phase-1-database-roles.md`, `docs/runbooks/phase-1-security.md`, `CLAUDE.md` (Commands table only, outside the kit markers: add `pnpm db:bootstrap`, `pnpm test:gates`, `pnpm --filter @crm/web jobs:retry`), `docs/DECISIONS.md`.

- [ ] **Step 1: Done-when run.** On a clean clone: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm test:gates && pnpm build && pnpm test:e2e`, then the image path. Paste each command's result into the PR body against the "Done-when and Verification map" rows below; every row must show a passing test name, including the logins/2FA audit row (`auth-audit.test.ts`, Task 31, with the Task 22 Step 3a IP cases). If spec revision 8 (E12) is not the approved spec at this point, stop: Phase 1 is not done.
- [ ] **Step 2: Allow-list completeness.** `rls.test.ts` asserts every `NO_RLS_ALLOW_LIST` table exists (all eleven now do, `auth_audit_log` included).
- [ ] **Step 3: Commit and PR checkpoint.** `git commit -m "docs: Phase 1 runbooks and commands" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`; push; open PR 8. After it merges, `setup` reconciles `PROJECT.md` §7 (isolation tests now run under `pnpm test`; `pnpm test:gates`) and §9 (UNI-04 `pg` ban in place; `crm_worker` grants measured: see the runbook) — items P6 and P7 below.

---

## Task 30 (separate spec PR, after plan PR #33 is merged): spec revision 8

This is step 2 of "Order of the plan, spec and reconcile PRs". It is **not** part of PR #33 and never adds a commit to it.

**Do not start before** `merged 33` has pushed PR #33's log (step 1.5). Owner answers it uses, already given: **ASK 1** — Charlie, 2026-10-20: "follow bob's suggestions", adopting Bob's wording "ASK 1: own login."; **ASK 2** — the same message, adopting "ASK 2: yes, move the per-table tests to the phases that create those tables, with generic fixture tests in Phase 1." (`docs/DECISIONS.md` 2026-10-20). **ASK 3** — Charlie, 2026-10-20, in his own words in the Andy session, to the builder's question "Option A: one audit row per workspace the user belongs to; the spec gets an exception for a user with no workspace" or "Option B: a new `auth_audit_log` table outside the workspace rules; every login recorded; a bigger spec change": "B" (`docs/DECISIONS.md` 2026-10-20, ASK 3 = B). Edits E1, E2, E4 and E5 rest on ASK 2; E3 on ASK 1; E12 on ASK 3; E5b and E6–E11 are labels and accuracy fixes and need none of them. E12 is a rule change (a new no-RLS system table), so Bob reviews it as one in the same `review spec` round.

- [ ] **Step 0: Branch.** `git switch main && git pull --ff-only` (HEAD = `<M33>`, the PR #33 merge commit); `git switch -c docs/spec-v4.7-rev8-phase1-plan-alignment`.
- [ ] **Step 1:** apply E1–E12 (section "Spec / PROJECT.md edits this plan needs"; line numbers are for hash `50acbcfe…`, which `<M33>` still has) to `docs/superpowers/specs/2026-09-27-core-sales-design.md`, as revision 8 (labels, the moved done-when clause, two accuracy fixes, and E12's new `auth_audit_log` system table; no other rule changes). Add a "Changes in v4.7 revision 8" item listing them and quoting Charlie's answers to ASK 1, ASK 2 and ASK 3 exactly as above.
- [ ] **Step 2:** `docs/DECISIONS.md` entry "Spec v4.7 revision 8 (Phase 1 plan alignment)" citing the 2026-10-20 entries for ASK 1, ASK 2 and ASK 3 (Charlie's words) and stating that E12 (`auth_audit_log`) is the only rule added and no other rule changes.
- [ ] **Step 3:** `git diff --check`; `git diff --stat origin/main...HEAD` lists only the spec and `docs/DECISIONS.md`; `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` → `<S8>`.
- [ ] **Step 4:** commit `docs(spec): revision 8 — revision 7 marked approved and merged; Phase 1 plan resolutions` with the trailer; push; open PR `<N>` with `<S8>` and the head `<HN>` in the body. Then steps 2.2–2.6 of the order: Bob `review spec` on `<S8>` at `<HN>` (SPEC file), Charlie's approval of revision 8, Bob `review <N>` on the same `<HN>` (`PR-<N>.md`, naming the same `<S8>`), `approved <N>` before merge (reads `PR-<N>.md`), merge, `merged <N>`. Any commit after either review re-runs both on the new head and hash. Then step 3: `setup` reconciles P1, P2, P3, P5, P8, P9 (and `CLAUDE.md` Status) in its own PR, which gets its own `review <R>` before `approved <R>`, as PR #32 did.

---

## Done-when and Verification map

Every clause of the Phase 1 done-when (spec line 1110) and every Phase 1 part of Verification (lines 1161–1257) has a named test. Rows marked † move to a later phase if Charlie answers ASK 2 yes (Settled item 3).

| Spec clause | Test (file → case) | PR / Task |
|---|---|---|
| Isolation test, rows seeded in other workspaces, every tenant table | `apps/web/src/db/isolation.test.ts` → every `tenantTables()` row; missing fixture fails | 2 / 6 (extended in 12, 14, 19) |
| No-RLS allow-list test | `apps/web/src/db/rls.test.ts` → "no-RLS allow-list" | 3 / 8, 21, 29 |
| Composite-FK schema test | `apps/web/src/db/schema-fk.test.ts` (with fixture self-test) | 3 / 11 |
| † Polymorphic-reference tests (`share_link`, `document_artifact`, `signature`, `line_item`, `version_retention.source_id`): cross-workspace INSERT, RETARGET, both layers for append-only | Phase 1: `apps/web/src/db/poly-ref.test.ts` on fixture tables. Per table: the creating phase (E1, E2) | 3 / 11 |
| † `version_retention` duplicate per target type; neither/both targets | Phase 1: `poly-ref.test.ts` → retention fixture. Real table: Phase 5 (E2) | 3 / 11 |
| Rolled-back transaction leaves no event and no job | `apps/web/src/jobs/enqueue.test.ts` → "rollback" | 6 / 19 |
| `crm_app` cannot read job payloads | `apps/web/src/jobs/install.test.ts`; `enqueue.test.ts` | 5 / 16; 6 / 19 |
| System-module authorization tests over two workspaces | `apps/web/src/db/system/authorization.test.ts` (+ `action.test.ts` stale-session case) | 3 / 10; 4 / 14 |
| RESTRICTIVE-policy catalog test | `rls.test.ts` → "RESTRICTIVE catalog" | 2 / 4 |
| `crm_purge` part (b1) tests | `apps/web/src/db/purge-role.test.ts` (catalog + behavioural, own login) | 4 / 13 |
| No runtime role holds DELETE, UPDATE or TRUNCATE on `audit_log` / `domain_event` | `apps/web/src/db/privileges.test.ts` → "TEN-03 append-only" parts 1 and 2 | 4 / 12; 6 / 19 |
| Auth rate-limit tests; client-IP parity; forged headers; concurrent consume on the auth limiter | `apps/web/src/lib/auth/rate-limit.test.ts`; `client-ip.test.ts`; `apps/web/src/db/system/rate-limit.test.ts` | 7 / 21–23 |
| Counter-cleanup schedule test | `apps/web/src/jobs/cleanup.test.ts` | 7 / 24 |
| Counter-table lint fixture (TEN-10) | `apps/web/src/db/lint-rules.test.ts` → TEN-10 fixture for `rateLimit` | 3 / 8 |
| `/api/auth/*` enabled-path tests; cross-origin POST; input-limit uniformity | `apps/web/src/lib/auth/enabled-paths.test.ts` | 7 / 24 |
| Gate: `crm_worker` exact grants measured and recorded | `apps/web/src/jobs/worker-grants.test.ts` (+ ablation), manifest, runbook, DECISIONS | 5 / 17 |
| Gate: pg-boss maintenance/supervise full cycle (60 s+) through a local PgBouncer | `apps/web/src/jobs/pooler.gate.test.ts` (`pnpm test:gates`, in CI) | 6 / 20 |
| Test email flows web → job → Mailpit | `apps/web/e2e/test-email.spec.ts` (dev and image) ; `email-send.test.ts` | 8 / 27 |
| Verification: policy lint (no `current_setting` cast without `nullif`) | `rls.test.ts` → "policy lint" | 2 / 4 |
| Verification: `set_config` + `nullif` bare-query test on a reused connection | `apps/web/src/db/workspace.test.ts` | 2 / 5 |
| Verification: `withWorkspace` lint rule | `lint-rules.test.ts` → TEN-09 and TEN-10 fixtures | 2 / 5; 3 / 8 |
| Verification: idempotency replay | `apps/web/src/lib/auth/action.test.ts` | 4 / 14 |
| Verification: pg-boss retry and dead-letter | `worker-grants.test.ts` scenario; `boss.test.ts`; `jobs:retry` | 5 / 17–18 |
| Verification: no role has `BYPASSRLS` (`pg_roles`) | `apps/web/src/db/bootstrap.test.ts`; `privileges.test.ts` | 1 / 1, 3 |
| Verification: adapter contract tests, SMTP vs Resend | `apps/web/src/adapters/email/contract.test.ts` | 8 / 26 |
| Verification: S3 vs MinIO contract | n-a in Phase 1 (no storage adapter until uploads, Phase 2) | — |
| Verification: Rate limits — link/OTP limits, reservation and threshold tests | n-a in Phase 1 (spec: they run in Phase 7) | — |
| Verification: run via `pnpm dev` and `docker compose up`, emails in Mailpit in both | Task 27 Step 5 | 8 / 27 |
| Verification: CI typecheck, lint + boundaries, tests, `pnpm audit`, secret scan, Trivy | `.github/workflows/ci.yml` (+ `test:gates`) | 6 / 20; 8 / 28 |
| Deliverable: nonce CSP + headers (UNI-17 test) | `security-headers.test.ts`; `e2e/security-headers.spec.ts` | 8 / 25 |
| Deliverable: audit log PII-redacted | `packages/core/src/audit/redact.test.ts`; `apps/web/src/lib/audit.test.ts` | 4 / 12 |
| Spec "Audit, logging, privacy": the audit log records logins and 2FA (ASK 3 = B; `auth_audit_log` per E12) | `apps/web/src/lib/auth/auth-audit.test.ts` → "user with no workspace" (1 row), "user in two workspaces" (1 row, not per workspace), "2FA enable", "2FA verify at sign-in" (TOTP and backup code), "2FA disable", "recovery codes", "failures write nothing", "both entry paths", "PII redaction", "failed audit write"; IP cases from Task 22 Step 3a | 4 / 31; 7 / 22 |
| E12: `auth_audit_log` append-only, no reader | `privileges.test.ts` → manifest (`crm_app` INSERT only) and "TEN-03 append-only" part 1 (no UPDATE, DELETE, TRUNCATE or SELECT for any runtime role or PUBLIC; `42501` behaviourally) | 4 / 31 |
| E12: `auth_audit_log` on the no-RLS allow-list, system module only (TEN-10) | `rls.test.ts` → "no-RLS allow-list" (eleven tables, no policy on it); `lint-rules.test.ts` → TEN-10 fixtures for `authAuditLog` | 4 / 31 |
| Deliverable: transactional `domain_event` with JSON-safe amounts (MON-03, EVT-01) | `enqueue.test.ts` → "raw bigint refused", "large amount round-trips exactly", "atomic with the large amount"; `packages/core/src/events/payload.test.ts` | 6 / 19 |
| Deliverable: `/api/health` (DB + queue) | `apps/web/src/lib/health.test.ts` | 6 / 20 |
| Deliverable: `notification` table | `isolation.test.ts` fixture; `privileges.test.ts` | 6 / 19 |

## ASK list (for Charlie; nothing below is invented in code)

1. **ANSWERED 2026-10-20 (Charlie: "follow bob's suggestions"; own login; `docs/DECISIONS.md` 2026-10-20).** *Original:* **Open question 8** — confirm `crm_purge` connects with **its own login** (Settled item 1), alternative `SET LOCAL ROLE` from a `crm_app` connection. Needed because `PROJECT.md` §11 makes every open-question choice Charlie's. Blocks: E3 only (Phase 1 code works either way until Phase 9, but Task 13's behavioural test is written for own login).
2. **ANSWERED 2026-10-20 (Charlie: "follow bob's suggestions"; yes, move; `docs/DECISIONS.md` 2026-10-20).** *Original:* **Move the polymorphic-reference and `version_retention` tests** from the Phase 1 done-when to the phase that creates each table, with Phase 1 testing the generic helper on fixtures (Settled item 3). Blocks: E1, E2, E4, E5, and Phase 1's done-when sign-off.
3. **ANSWERED 2026-10-20 (Charlie: "B"; a new no-RLS `auth_audit_log` table; `docs/DECISIONS.md` 2026-10-20, ASK 3 = B).** The builder asked in plain text: "Option A: one audit row per workspace the user belongs to; the spec gets an exception for a user with no workspace" or "Option B: a new `auth_audit_log` table outside the workspace rules; every login recorded; a bigger spec change" (builder pick: B). Charlie answered: "B". Effect: spec edit E12 in Task 30 (revision 8, reviewed by Bob there); Task 31 builds the table in PR 4. *Original:* **Audit of user-level auth events (Bob plan Rounds 1 and 2, P1).** The spec ("Audit, logging, privacy") says the audit log "records logins, 2FA, … member changes", and `audit_log` is a tenant table with a non-null `workspace_id` under RLS; a sign-in or a 2FA change belongs to a user, not a workspace. Options were:
   - **(a) One audit row per workspace the user belongs to at that moment** (no spec change; a user with **no** workspace leaves no record, and a workspace joined later does not see earlier events) — rejected.
   - **(b) A new no-RLS system table `auth_audit_log`** (user-keyed, append-only, reached only through the system module; records every event, including for a user with no workspace; changes the spec) — **chosen**.
   - **(c) Defer auth-event auditing to a named later phase** (moves a Phase 1 done-when clause by a spec revision) — rejected.
4. **Idempotency key expiry** (`IDEMPOTENCY_KEY_EXPIRY_SECONDS`): not in the spec. Builder proposal: 24 hours. Blocks Task 14 Step 4 onwards.
5. **`billing_account.status` values.** Not in the spec. Builder proposal for Part 1: only `active` (CHECK), more states with plans in Part 3.
6. **HSTS:** `max-age` (proposal 31536000), `includeSubDomains` (proposal: no, because it would also bind other subdomains of the domain to HTTPS), `preload` (proposal: no). Blocks Task 25.
7. **Production `EMAIL_FROM`** address and display name for the SaaS (and the sending domain's SPF/DKIM/DMARC owner). Dev uses `CRM Dev <dev@localhost>`. Blocks only the production runbook line.
8. **Test-email wording** (subject and body; draft in Task 26 Step 4) **and the `/settings/email` page copy** (intro line, button, "Test email queued.", the `FORBIDDEN` and failure messages; drafts in Task 27 Step 3). Blocks Task 27's commit.
9. **`require_2fa` enforcement**: the Phase 0 plan listed it for Phase 1, the spec's Phase 1 row does not. Builder proposal: Phase 2 (with the settings page that sets it). Confirm.

## Risks

1. **pg-boss maintenance needs ownership for some passes.** `reindex` (default on) runs `REINDEX INDEX CONCURRENTLY`, and `persistQueueStats` creates/drops partitions; `crm_worker` owns nothing. Mitigation: both off in the worker; index bloat checks become a `crm_migrator` runbook task. If a 12.35.0 maintenance pass still needs DDL, Task 17 finds it (`42501`) and the plan comes back to Bob before any extra grant.
2. **Better Auth upgrade drift.** Paths, hooks and limiter internals were read from 1.7.6. The enabled-path snapshot test and the customStorage choice fail loudly on change; an upgrade is a reviewed PR.
3. **Spec says Better Auth skips its limiter without an IP; 1.7.6 uses a shared `no-trusted-ip` key.** Harmless here (we always set an IP), but the text is wrong (E6).
4. **`job_now()` is not executable through PUBLIC any more**, contrary to the spec's grant comment (line 499); without the explicit grant the web `send` fails at runtime. Task 16 tests `send` as `crm_app`; E5b fixes the comment.
5. **Dev data loss.** Splitting the compose superuser from `crm` to role users needs `docker compose … down -v`; Phase 0 dev accounts are lost (runbook says so).
6. **Two writes on workspace creation** (Better Auth's organization row, then `workspace_settings` and `billing_account`) are not one transaction. Mitigation: `ensureWorkspaceSettings` on first use (Task 7) and the before-create hook for `billing_account` (Task 9); tests cover the heal path.
7. **CI time.** The gate test (75 s+), two `next start` processes and extra Testcontainers raise `checks` beyond 15 minutes. Timeout raised to 30; if it grows further, split a `gates` job.
8. **Rate limits on in tests and E2E** (`enabled: true`) can make the existing E2E suite hit 429 from one IP. The suite already paces with `E2E_RATE_LIMITED`; the IP limits are per 60 s and generous (100 default, 10 sign-in); the account key gives back on success. If flakes appear, E2E uses distinct test edge IPs per worker, never a disabled limiter.
9. **Nonce CSP makes every page dynamic** (Next docs). Acceptable for an authenticated app; client link pages (Phase 7) are dynamic anyway. Tailwind v4 output is a stylesheet, not inline, so `style-src` with a nonce holds; the E2E fails on any violation.
10. **Payload rule edge — resolved (Bob plan review Round 2).** No job carries a non-ID field: `kind` was removed from the `email.send` data, the handler derives the operation from the queue name (Task 27 Steps 1–2), and `assertJobData` refuses any non-ID key for every producer (Task 19). `workspaceId` stays in job data as an ID (Settled item 5).
11. **New packages younger than pnpm's release-age gate** (nodemailer 10.1.7 was two days old on 2026-10-20). The task takes the newest version the gate allows and records it.
12. **Spec text says `share_link_resolve` and `crm_link_resolver`'s grant**; Phase 1 creates the role with nothing. The RESTRICTIVE catalog test's `share_link_resolve` exception is coded as "allowed when present" and becomes mandatory in Phase 7.
13. **`auth_audit_log` cannot share the auth change's transaction** (Better Auth 1.7.6 runs sign-in and the 2FA endpoints without a transaction; database after-hooks are queued after any transaction; Task 31 fact iii). Mitigation: the row is written in a plugin after-hook right after the endpoint's writes; a failed write fails a sign-in closed (session deleted) and returns 500 for a 2FA change that already stands, with an error log line (Task 31 Step 5; open point 1 for Bob). The hook must run after the two-factor plugin's own after-hook (fact i); the "2FA verify at sign-in" case (0 rows at the password step) fails if the order changes.
14. **`auth_audit_log` grows without a purge** (one row per login and 2FA event; no archive job in Part 1, as for `audit_log`). Small at 5–15 person agencies; the `(user_id, created_at)` index keeps reads fast. Erasure and retention for PDPA are open point 2 of Task 31, not decided here.

## Self-check for this plan PR (plan-only)

Built from every pack ticked in `PROJECT.md` §8 and the §9 constraints, rule by rule (not by "pack relevant or not"). `plan-only` means the task and its test are specified here; the runtime pass is claimed in the implementing PR. `pass` is claimed only for what this docs PR itself does.

**Universal**

| Rule | Status | Evidence / why |
|---|---|---|
| UNI-01 | plan-only, all PRs | Strict TypeScript unchanged. The one deliberate cast, `as unknown as EventPayload` in `enqueue.test.ts` (Task 19, raw-bigint case), exists to test the runtime guard and carries a why-comment; the `@ts-expect-error` twin proves the type refuses it. |
| UNI-02 | plan-only, PRs 4, 5, 7, 8 | Every spec number goes to `limits.ts` (Task 21 Step 1; Task 14 for idempotency expiry); values the spec lacks are ASK 4–6 or recorded operational defaults (queue retries Task 16 Step 4, cleanup cron Task 24 Step 3). |
| UNI-03 | plan-only, PRs 1, 4, 6, 7, 8 | Validation at each boundary, each tested: bootstrap CLI env (Zod, Task 1 Step 4); web and worker env (`parseEnv`/`parseWorkerEnv`, Task 2 Step 1, Task 22, Task 26 → `env.test.ts`); server-action input (Zod inside `action()`, Task 14 → `action.test.ts` "invalid input"); event payloads (`eventPayloadSchema`, Task 19 → `enqueue.test.ts` "payload guard", "raw bigint refused"); job data at enqueue (`assertJobData`, Task 19 → "job data IDs only") and in handlers (Task 19 `domain_event` cross-workspace case, Task 27 Step 2 non-uuid `userId`); client IP header (`deriveClientIp`, Task 22 → `client-ip.test.ts`); sign-in body for the account key (Task 23 Step 2 → `rate-limit.test.ts`). Internal calls are not re-validated. |
| UNI-04 | plan-only, PRs 2, 3, 4, 5, 6 | Every §9 boundary this plan adds is a lint rule with failing fixtures in `lint-rules.test.ts`, run by `pnpm lint` in CI: TEN-09 `set_config`/`SET` ban (Task 5 Step 4), TEN-10 system-module imports (Task 8 Step 2; `authAuditLog` fixtures, Task 31 Step 4), AUTH-01 server-action wrapper (Task 15), `pg` ban in `apps/web` (Task 18 Step 2). New core entries go through package `exports` (`./audit` Task 12, `./events` Task 19) under the existing core boundary lint. |
| UNI-05 | plan-only, all PRs | Nothing built before its user: `stepUp()` (Phase 2), reset/link/OTP limits, `DATABASE_PURGE_URL` (Phase 9) and invitation grants are not added (Settled items 1, 5; Task 21 Step 1). `notification` ships without a producer because it is a named Phase 1 deliverable (Task 19 Step 1). |
| UNI-06 | plan-only, PRs 5, 8 | Three packages named with version, licence and why (Tasks 16 Step 1, 26 Step 1); `resend` SDK, `@react-email/components`, `pino` not added. |
| UNI-07 (hard) | pass | Only dev-only fixed passwords named for compose and tests (same pattern as Phase 0); no secret, token or `.env` content in the plan; `git diff --check` clean; secret-scan pattern run on the diff. |
| UNI-08 | plan-only, PRs 1, 8 | Production DB passwords from the host's secret store (Task 1 Step 4, Task 2 Steps 4 and 6 runbook); `RESEND_API_KEY` likewise (Task 26 Step 5). |
| UNI-09 | plan-only, PRs 1, 4, 6, 7, 8 | No PII or secret in logs or errors, each with a test: bootstrap never logs a statement (Task 1 Step 3); env and CLI errors list names, never values (Task 1 Step 4, Task 2 Step 1 → `env.test.ts`); client-IP fallback warning without the value (Task 22 → `client-ip.test.ts`); `EmailSendError` without key or address (Task 26 → `contract.test.ts`); `EventPayloadError` names the field only (Task 19); health returns no error text (Task 20 Step 5 → `health.test.ts`); audit `"[pii]"` and no address in `email.test_sent` (Tasks 12, 27); `auth_audit_log` rows hold no email, name, password, code or secret and `detail` goes through `redactPii`, and the "auth audit write failed" log line carries only the event name (Task 31 Step 2 → `auth-audit.test.ts` "PII redaction", "failed audit write"). |
| UNI-10 / TEN-03 | plan-only, PRs 4, 6 | Append-only catalog tests on `audit_log` (Task 12 Step 4), `auth_audit_log` (Task 31 Step 4: no UPDATE, DELETE, TRUNCATE or SELECT for any runtime role or PUBLIC, `42501` behaviourally; `crm_app` INSERT only) and `domain_event` (Task 19 Step 2). |
| UNI-11 | plan-only, PR 8 | The Resend adapter is tested against a local stand-in server, never the real API (Task 26 Step 3); Mailpit is local. No project data leaves the machine in tests or CI. |
| UNI-12 | **not met literally (outside the project folder); low impact; builder reports it, Bob rules** | The plan itself was written only in `.agent/worktrees/docs-phase-1-plan` (inside the project folder). The draft parts and the `npm pack` tarballs read for "Facts verified" were written in the session scratchpad directory `/private/tmp/claude-501/-Users-charlie-Documents-Projects-Personal-CRM/<session-id>/scratchpad/`, which is **outside the project folder** (`PROJECT.md` §3: project root = repo root). It is provided by the agent harness for temporary files, is not a parent folder, sibling project or the master kit, and is git-ignored by location (outside the repository, so nothing there can be committed). Nothing written there holds a secret, and it holds no repo content beyond what was read for the plan. Not a pass: UNI-12 permits writes only inside the project folder. Later sessions use a folder under `.agent/` (git-ignored) for drafts and tarballs instead. |
| UNI-13 | plan-only | CI gates unchanged by this PR (docs only); PR 6 adds `test:gates` (Task 20 Step 4); PR 8's image job runs Trivy over the new packages (Task 28). |
| UNI-14 | plan-only, PRs 5, 6, 8 | `pnpm-lock.yaml` is committed with each dependency change (Task 16, Task 26 Files); every new package is an exact version (Global Constraints "Pins"); the PgBouncer and Mailpit images are pinned by tag **and** digest, recorded in DECISIONS (Task 20 Step 1, Task 26 Step 2). |
| UNI-15 | plan-only, PRs 1–7 | Every migration creates a table, policy, function, queue or grant (Tasks 3, 6, 9, 11, 12, 14, 16, 17, 19, 21, 31); none drops or rewrites a column. `organization.billing_account_id` is nullable so the change is additive (Task 9 Step 2); `workspace_settings` gains its settings later, additively (Task 6 Step 3). Migration 0001's `REVOKE TEMPORARY … FROM PUBLIC` removes a privilege no code uses (Settled item 2). The Phase 0 dev-volume reset (Task 2 Step 6, Risk 5) is a dev step, not a migration. |
| UNI-16 | plan-only, PRs 1, 4, 5, 7, 8 | Runbook in the same PR as each change: roles, bootstrap, role URLs and rotation (Task 2 Step 6, PR 1); `crm_worker` grants (Task 17 Step 5, PR 5); `auth_audit_log` grants (Task 31 Step 6, PR 4); rate limits, `TRUSTED_CLIENT_IP_HEADER`, `AUTH_SECRET` rotation effect (Task 24 Step 5, PR 7 — Task 22's env var lands in the same PR); headers and HSTS (Task 25 Files, PR 8); email env and provider switch (Task 26 Step 5, PR 8); commands (Task 29). |
| UNI-17 / UNI-18 | plan-only, PR 8 | Task 25 (`security-headers.test.ts`, `e2e/security-headers.spec.ts`; DECISIONS records where each header is applied). |
| UNI-19 | plan-only, PRs 4, 7 | Enabled-path tests (Task 24); only `/api/health` and `/api/auth/*` unauthenticated in Phase 1, and the entry-point classification test fails on any new mutating route (Task 15 Step 3); cleanup runs in the worker, no HTTP trigger (Task 24 Step 4). |

**Tenancy and RLS**

| Rule | Status | Evidence / why |
|---|---|---|
| TEN-01, TEN-02 (hard) | plan-only, PRs 1, 3, 4, 5 | Bootstrap (Task 1), manifest (Task 3), `crm_worker` no `public` privilege (Task 17 Step 4), own-login `crm_purge` (Task 13). Ends the Phase 0 exception (Task 2 Step 7). |
| TEN-04–08 | plan-only, PRs 2–4, 6 | Policy template, catalog tests (Task 4), isolation harness that fails on a missing fixture (Task 6, extended in Tasks 12, 14, 19). |
| TEN-09 (hard) | plan-only, PR 2 | `withWorkspace` + lint (Task 5). |
| TEN-10 | plan-only, PRs 3, 4, 7 | System-module lint + fixtures (Task 8); `auth_audit_log` only through `system/auth-audit.ts`, on the no-RLS allow-list, with lint fixtures (Task 31 Step 4); `rate_limit` only through `system/rate-limit.ts` (Task 21). |
| TEN-11 (hard) | plan-only, PRs 4, 6 | Workspace from session in `action()` (Task 14, "`raw = { workspaceId: W2 }`" case); from the transaction setting in `recordAudit`/`emitEvent` (Tasks 12, 19). `auth_audit_log` has no workspace column by design (a user event; ASK 3 = B), so no caller supplies one (Task 31 "user in two workspaces" catalog check). |
| TEN-12 | n-a | No bypass helper exists or is added (§8 "Admin/bypass helper: none"). |

**Auth**

| Rule | Status | Evidence / why |
|---|---|---|
| AUTH-01 (hard) | plan-only, PR 4 | `action()` order test (Task 14); lint on **every** `"use server"` export and inline action, regardless of file name, with exemptions limited to eight named Better Auth forwarding exports whose bodies must keep the forwarding-only shape F1–F6, and bypass fixtures (differently named file, extra export in an exempt file, a direct DB mutation or other extra work added inside an exempt function) (Task 15 Steps 1–2); every `route.ts` and `proxy.ts` classified by a test (Task 15 Step 3); `/api/auth/*` exception per revision 7 (d). |
| AUTH-02 | plan-only, PRs 4, 8 | `proxy.ts` only sets headers and never authorizes (Task 25 Step 2); every action re-authorizes in `action()` (Task 14 tests: no session, stale workspace, role). Task 27: the nav hides "Email" from Staff, but the page checks the role server-side and `action()` refuses Staff — `test-email.spec.ts` Staff case posts the form anyway and gets `FORBIDDEN` (Task 27 Step 4). |
| AUTH-03 | plan-only, PRs 3, 4, 8 | The only permission Phase 1 adds is "email settings" → Admin and Owner (spec matrix row "Templates, numbering, email settings, catalog"): `minRole: "admin"` (Task 27 Step 1), tested for Owner (allowed) and Staff (refused) in Task 27 Step 4 and for role order in `action.test.ts` (Task 14). Unknown stored roles fail closed (Task 10 → `authorization.test.ts`). |
| AUTH-04 | n-a (unchanged) | Phase 0 Argon2id hashing (`@crm/core/password`) is not touched. |
| AUTH-05, AUTH-06 | plan-only, PR 7 | Uniform 429 and input-limit uniformity for existing vs unknown email (Tasks 23, 24); database counters shared across two processes and restarts (Task 21, Task 23 Step 4). |
| AUTH-07 | plan-only, PR 7 | `/change-password` and `/two-factor/enable`/`disable` are in the Phase 1 enabled set, and no Phase 0 test shows other sessions ending on those changes. Task 24 Step 2 adds that test (a second session of the same user is refused after each change). If Better Auth 1.7.6 as configured does not revoke, the builder stops and raises it with Bob and Charlie before PR 7 (the fix may be a config option or an action-side call, not decided here). Email change is not enabled. |
| AUTH-08 | n-a | Reset and invitation endpoints stay disabled in Phase 1 (Task 24 Step 1; 404 asserted in Task 10 and Task 24 Step 2). |
| AUTH-09 | n-a | `stepUp()` has no user in Phase 1 (Settled item 5; first user Phase 2). |
| AUTH-10 | n-a | No OAuth until Part 3 (§8). |
| AUTH-11 | plan-only, PR 8 | `proxy.ts` reads no database (Task 25 Step 2). |
| AUTH-12 | plan-only, PRs 3, 4, 8 | Database sessions, not JWT; the role is read from `member` on every action (`getMembership`, Tasks 10, 14) and the nav reads the same membership per request (Task 27 Step 3), so a role change applies on the next request on both. |
| AUTH-13 | n-a (unchanged) | Phase 0 sign-out (`signOutAction`, `sign-out.spec.ts`) is unchanged; it stays a named forwarder (Task 15). |

**Events and jobs; money**

| Rule | Status | Evidence / why |
|---|---|---|
| EVT-01 | plan-only, PR 6 | Rollback test ×50, commit test, invisible-before-commit, and the large-amount atomic case (Task 19 Step 2). |
| EVT-03, EVT-05, EVT-06 | plan-only, PRs 5–7 | Unknown-field test (Task 19); retry/dead-letter + `jobs:retry` (Tasks 17, 18); worker-owned schedules (Task 24). |
| EVT-02, EVT-04, EVT-07–12 | n-a | EVT-02: no relay (jobs enqueued in the same transaction). EVT-04, EVT-07–12: no extensions until Part 3 (§8). |
| MON-03 | plan-only, PR 6 | Money crosses the event boundary as a canonical decimal string (`MinorUnits`, `minorUnits()`, `parseMinorUnits()`), never a float or raw bigint; tests: raw bigint refused before any write, 2^53 + 1 round-trips exactly through JSONB and the handler, atomic with the job (Task 19 → `enqueue.test.ts`, `payload.test.ts`). |
| MON-01, MON-02, MON-04–07 | n-a | No amount is stored or computed in Phase 1 (first money tables in Phase 4). |

**Frontend and accessibility (Task 27 `/settings/email` page and nav link; Task 25 headers)**

| Rule | Status | Evidence / why |
|---|---|---|
| FE-01, FE-02, FE-06, FE-07 | plan-only, PR 8 | One `<h1>`, the app layout's single `<main>`, a real `<form>` and `<button>`, no unnamed `<section>` (Task 27 Step 3); axe scan per state (Task 27 Step 4, `accessibility.spec.ts`). |
| FE-03 | n-a | The page has no self-contained item (no card, post or listing); it is one heading, one paragraph and one form. |
| FE-04 | plan-only, PR 8 | The "Email" link joins the existing nav list in `nav-links.tsx` (Task 27 Step 3). |
| FE-10 | plan-only, PR 8 | Single-axis layouts only, Flexbox (`flex flex-col`), no Grid and no flex-plus-percentage grid (Task 27 Step 3 "Layout"). |
| FE-11 | plan-only, PR 8 | No absolute positioning on the page (Task 27 Step 3 "Layout"). |
| FE-12 | plan-only, PR 8 | Sibling spacing by `gap-4` / `gap-2` on the parents and the layout's existing `gap-8`; no per-child margins (Task 27 Step 3 "Layout"); overflow checked at three widths (Step 4). |
| FE-20 | plan-only, PR 8 | No new shared component; the one client component exists because it owns pending state (Task 27 Step 3 "Components"). |
| FE-21 | plan-only, PR 8 | Two small files (server page, client form with one prop); no monolithic page, no near-duplicate of a Phase 0 form, no speculative props (Task 27 Step 3 "Components"). |
| FE-05 (hard) | plan-only, PR 8 | The button submits the form (no click handler on a non-control); the nav link has a real `href` and `aria-current`; keyboard-only case reaches and submits with visible focus (`tabTo`, `expectVisibleFocus`, Task 27 Step 4). |
| FE-13, FE-23 | plan-only, PR 8 | Existing `components/ui/button.tsx`, semantic tokens, `cn()`; no literal colours (Task 27 Step 3). |
| FE-14 | plan-only, PR 8 | `expectAccessible` asserts no horizontal overflow in each state at 320, 768 and desktop width (Task 27 Step 4). |
| FE-22 | plan-only, PR 8 | Page copy lives in `messages.ts` constants, not inline (Task 27 Step 3; wording ASK 8). |
| FE-31, FE-32 | plan-only, PR 8 | Server component page; one small client component for pending state only; the form works with JavaScript disabled (`no-javascript.spec.ts` case, Task 27 Step 4). |
| FE-34 | plan-only, PR 8 | The page reads the membership at its own server boundary, uncached (Task 27 Step 3). |
| FE-24, FE-40, FE-41, FE-42 | n-a | No business-logic component (FE-24); no new UI package or registry component — the page reuses the existing button (FE-40–42). |
| FE-50 | plan-only, PRs 1–8 | `pnpm typecheck && pnpm lint && pnpm build` in each PR's run step (e.g. Task 24 Step 6, Task 27 Step 5, Task 29 Step 1). |
| FE-51, FE-52 | plan-only, all PRs | No comments by default (Global Constraints); flat guard clauses in `action()` (fixed order, Task 14). |
| FE-60 | plan-only, PR 8 | Decision ladder walked top first and listed in the PR body: native form + server action → existing `Button`, `SubmitFailureBoundary`, `messages.ts`, Phase 0 `useActionState` pattern → framework → no registry, no new dependency (Task 27 Step 3 "Components"). The two new packages (Task 26) are below the page: their ladder rows are UNI-06. |
| FE-61 | plan-only, PR 8 | The page follows `settings/security/page.tsx` and the Phase 0 form pattern; the layout and `nav-links.tsx` gain one link, nothing is rewritten (Task 27 Step 3 "Components"). |
| FE-70 | plan-only, PR 8 | All three Playwright projects (`chromium` desktop, `tablet-768`, `mobile-320`): no overflow, keyboard path, success, error (server and network failure), Staff refusal, loading (held request), zero unhandled page errors (Task 27 Step 4). Empty state n-a (no list on the page). |
| FE-71 | plan-only, PR 8 | The longest message (failure text) is scanned for overflow at 320 px in its error state (Task 27 Step 4). One locale (en) in Phase 1; no images or prices on the page. |
| A11Y-01 | plan-only, PR 8 | Keyboard-only case with visible focus on every stop and logical order (Task 27 Step 4). |
| A11Y-02 | plan-only, PR 8 | axe WCAG AA contrast checks in light and dark on the page's states (Task 27 Step 4); existing tokens. |
| A11Y-03 | plan-only, PR 8 | Errors in `role="alert"`, linked to the button with `aria-describedby`; success in `role="status"` (Task 27 Step 3); asserted by `getByRole("alert")` and the `aria-describedby` check (Step 4). The form has no visible input to label; the hidden idempotency field is not a user control. |
| A11Y-04 | n-a | No new animation; the shared button's colour transition is existing Phase 0 code. |
| A11Y-05 | n-a | No images on the page. |
| A11Y-06 | plan-only, PR 8 | Real-browser keyboard and axe checks in Playwright on all three projects, not markup inspection (Task 27 Step 4); Task 25's E2E also checks zero CSP violations in the browser. |

**Other ticked packs**

| Rule | Status | Evidence / why |
|---|---|---|
| LINK-03, LINK-07 | n-a | Link and OTP limits ship in Phase 7 (spec Verification). Other LINK rules: no client links in Phase 1. |
| finalized-records (REC-*), payments (PAY-*), files-templates (FILE-*) | n-a | No issued records, numbering, payments, uploads, PDFs or user templates in Phase 1. The React Email template (Task 26) has no user-editable fields and no placeholder substitution (FILE-05 n-a). |

**`PROJECT.md` §9 constraints**

| Constraint | Status | Evidence / why |
|---|---|---|
| Five roles, none `BYPASSRLS`; `crm_worker` `pgboss.*` only; `crm_purge` Phase 1 scope (b1) | plan-only, PRs 1, 4, 5 | Tasks 1, 3, 13, 17. |
| Workspace context via `set_config(…, true)`; policies with `nullif` | plan-only, PR 2 | Tasks 4, 5. |
| Better Auth tables and `billing_account` (and, after revision 8 E12 / P8, `auth_audit_log`) no RLS, only through the system module; `billing_account.plan = free` | plan-only, PRs 3, 4 | Tasks 8, 9 (CHECK), 10; Task 31 (allow-list of eleven tables, TEN-10 fixtures for `authAuditLog`). |
| pg-boss installed by `crm_migrator` in migrations; app instances `migrate`/`createSchema` false; web `supervise`/`schedule` false; `notify` off | plan-only, PR 5 | Tasks 16, 18 (`boss.test.ts`). |
| Job payloads IDs only; `domain_event` payloads IDs and amounts only | plan-only, PRs 6, 8 | Task 19: event payload guard and the shared `assertJobData` check with the "job data IDs only" and "every planned producer" cases; Task 27: `email.send` data is `{ workspaceId, userId }`, no discriminator, handler keyed by queue name (Risk 10 resolved); Settled item 5 for `workspaceId`. |
| `pg` only inside pg-boss; postgres.js + Drizzle `prepare: false` | plan-only, PR 5 | Task 18 lint; existing client unchanged. |
| No cron endpoints; worker owns schedules | plan-only, PR 7 | Task 24 Steps 3–4. |
| Spec "Audit, logging, privacy": logins and 2FA audited | plan-only, PRs 4, 7 (after revision 8, E12) | ASK 3 = B (Charlie, 2026-10-20): `auth_audit_log` (no RLS, system module only, append-only, `crm_app` INSERT only) built in Task 31 with the no-workspace, two-workspace, 2FA enable/verify/disable/recovery-code, failure, PII and failed-write tests; IP in Task 22 Step 3a. Open for Bob: failed-write handling and retention/erasure (Task 31 open points 1–2). |

## Spec / PROJECT.md edits this plan needs (not made in this PR)

Applied in Task 30, the separate spec PR made after PR #33 is merged (spec), and by `setup` in its own reconcile PR after revision 8 is approved and merged (`PROJECT.md`); order and hashes in "Order of the plan, spec and reconcile PRs". Line numbers are for hash `50acbcfe…`.

**Spec (`docs/superpowers/specs/2026-09-27-core-sales-design.md`):**
- **E1 (needs ASK 2) — line 1110, Phase 1 done-when.** Replace "polymorphic-reference tests pass for `share_link` target, `document_artifact` target, `signature` doc ref, `line_item` parent and `version_retention.source_id` (cross-workspace INSERT rejected; RETARGET UPDATE rejected, incl. to another workspace's row; for the append-only tables both by the missing grant as `crm_app` and by the trigger); `version_retention` duplicate insert rejected per target type by its partial unique index, and neither/both targets rejected by the CHECK;" with "the generic polymorphic-reference triggers and the retention-style uniqueness pattern pass their tests on test-only fixture tables (cross-workspace INSERT rejected; RETARGET UPDATE rejected, incl. to another workspace's row; for an append-only fixture both by the missing grant as `crm_app` and by the trigger; duplicate per target type rejected by the partial unique indexes; neither/both targets rejected by the CHECK); the per-table tests run in the phase whose migration creates each table (revision 8);".
- **E2 (needs ASK 2) — lines 1113, 1114, 1116 (Phases 4, 5, 7 done-when).** Append to Phase 4: "the polymorphic-reference tests (Tenancy → Tests, per reference) pass for `line_item` parent and `document_artifact` target;". Phase 5: "the polymorphic-reference tests pass for `version_retention.source_id`, and `version_retention` duplicate inserts per target type and neither/both targets are rejected;" (plus `line_item` parents added in Phase 5: quotation, credit note, recurring template). Phase 7: "the polymorphic-reference tests pass for `share_link` target and `signature` doc ref;". Each phase plan confirms its table list.
- **E3 (needs ASK 1) — line 274, Open question 8.** Prefix "**RESOLVED (Charlie, <date>; Phase 1 plan): own login** (`crm_purge LOGIN`, no member roles, `DATABASE_PURGE_URL` only in the worker from Phase 9). *Original text:*". Also line 846 ("`crm_purge` in Phase 1" → *Connection and transaction*): replace "How it connects (own login, or a role switch from the worker) is Open question 8, settled in the Phase 1 plan with Bob." with "It connects with its own login (Open question 8, resolved <date>)." and drop the sentence about `SET LOCAL ROLE`; and line 847 "*Alternative for the audit entry:* … depends on how `crm_purge` connects (Open question 8, still open)" → "(Open question 8, resolved: own login)".
- **E4 (needs ASK 2) — line 789, Tenancy "Tests, per reference (Phase 1)".** Replace "(Phase 1)" with "(in the phase whose migration creates the table; Phase 1 tests the generic triggers on fixture tables, revision 8)".
- **E5 (needs ASK 2) — line 1251, Verification "Polymorphic references and retention uniqueness (rev 11)".** Insert after "(rev 11)": "(each in the phase that creates the table; Phase 1: the generic triggers on fixtures, revision 8)".
- **E5b — line 499, data model `pgboss` grants comment.** Replace "-- pgboss.job_now() is executable through the PUBLIC default." with "GRANT EXECUTE ON FUNCTION pgboss.job_now() TO crm_app;              -- PUBLIC EXECUTE is revoked by default (`ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`)" and add after line 501: "`crm_worker`'s grants were measured in Phase 1 (`docs/runbooks/phase-1-database-roles.md`)."
- **E6 — line 718 ("Client IP").** Replace "The placeholder is a valid address because Better Auth skips its limiter when it finds no IP; the Phase 1 plan pins that behaviour for the installed version." with "The placeholder is a valid address so Better Auth always finds one; Better Auth 1.7.6, finding none in production, falls back to one shared `no-trusted-ip` key (pinned in the Phase 1 plan)."
- **E7 — line 1 (title).** Replace "revision 7 (draft, updated 2026-10-19 after Bob's Rounds 16-19 and Charlie's scope decision); revision 6 was APPROVED 2026-10-16 and supersedes v4.6" with "revision 8 (draft); revision 7 APPROVED 2026-10-20 and merged as PR #31 (`7f7178a`)".
- **E8 — line 3 (Status).** Replace the opening bold sentence block up to "Until revision 7 is approved and merged, revision 6 stays the approved text.**" with: "**v4.7 revision 7 APPROVED and merged.** Charlie decided all five Phase 1 gate proposals on 2026-10-20 ("Changes in v4.7" item 8); Bob's spec review Round 24 (2026-10-20) returned Approved with conditions at hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451` (PR #31 head `4ec37c3`); PR #31 merged to `main` as `7f7178a`, and `setup` reconciled `agents/PROJECT.md` and `CLAUDE.md` in PR #32. Round 24's two conditions were deferred to the Phase 1 plan PR and are answered by revision 8 (this label and the polymorphic-test placement)." followed by one sentence for revision 8 (draft). The revision 6 and older sentences stay as history.
- **E9 — line 11 (heading of "Changes in v4.7").** Replace "revision 7 (draft, updated 2026-10-19 …) — the five Phase 1 plan gates, decided by Charlie on 2026-10-20 and pending Bob's confirmation of the exact hash" with "revision 7 — the five Phase 1 plan gates, decided by Charlie on 2026-10-20, approved (Bob Round 24) and merged (`7f7178a`)"; and remove "; pending Bob's confirmation of the exact hash" at the end of that heading.
- **E10 — item 8 lead (line 50) and Current gates (a) (line 1154).** Item 8: replace "the text still needs Bob's confirmation of the exact hash before merge" with "Bob confirmed the exact hash in Round 24; merged as `7f7178a`". Gate (a): replace "Bob must confirm the exact hash, then `approved 31` before merge and a `setup` reconcile of `agents/PROJECT.md` and `CLAUDE.md` to the new hash before `build`." with "Done: Bob's Round 24, `approved 31`, merged as `7f7178a`, `setup` reconcile PR #32." Gate (b): add "Answered by the Phase 1 plan (`docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`)."
- **E11 — "Runtime and hosting" env line (line 1070: "a worker connection for `crm_worker` … exact variable name set in the Phase 0 plan patch").** Replace the parenthesis with "`DATABASE_WORKER_URL`".
- **E12 (needs ASK 3 = B; a rule change, Bob reviews it as one) — the `auth_audit_log` system table.** Seven places, line numbers for hash `50acbcfe…`:
  - **(a) Data model, after line 489** (`audit_log`), insert: "- **`auth_audit_log`** (append-only; **no RLS**, system module only; revision 8, ASK 3 = B, Charlie 2026-10-20): user_id (FK `user`), event (`sign_in`, `two_factor_verified`, `two_factor_enabled`, `two_factor_disabled`, `two_factor_backup_codes_regenerated`), detail JSON (personal-data fields stored as `"[pii]"`), ip, created_at. No `workspace_id`: logins and 2FA belong to a user, not a workspace, so one event is one row, also for a user with no workspace. `crm_app` INSERT only; no runtime role reads, updates or deletes it in Phase 1."
  - **(b) Tenancy, line 781** ("**Better Auth tables** (…) and `billing_account` carry **no RLS**: …"). After "and `billing_account`" insert "and `auth_audit_log` (user-level login and 2FA audit; revision 8)", and after the sentence ending "(sign-in lookups by email)." insert "`auth_audit_log` has no workspace at all: its rows are a user's own auth events."
  - **(c) Tenancy, line 782.** Replace "equals the allow-list (Better Auth tables, `billing_account`, `pgboss.*`) exactly" with "equals the allow-list (Better Auth tables, `billing_account`, `auth_audit_log`, `pgboss.*`) exactly".
  - **(d) "Audit, logging, privacy", line 835.** After "…purges, member changes." insert: "Logins and 2FA events (sign-in, the 2FA step of a sign-in, 2FA enabled, disabled, recovery codes regenerated) belong to a user, not a workspace, and are written to `auth_audit_log` (no RLS, system module only, append-only; one row per event, also for a user with no workspace; revision 8, ASK 3 = B, Charlie 2026-10-20); every other event above is written to `audit_log` in its workspace. Better Auth runs these endpoints without a transaction, so the `auth_audit_log` row is written right after the auth change; a sign-in whose row cannot be written fails and its session is removed (the Phase 1 plan states the 2FA case)." *(The last clause follows Bob's ruling on Task 31 open point 1; if he rules otherwise, this sentence changes before his final round.)*
  - **(e) Scalability, line 1043.** Replace "No role deletes rows from `audit_log` or `domain_event`" with "No role deletes rows from `audit_log`, `auth_audit_log` or `domain_event`", and in the Test sentence replace "holds DELETE, UPDATE or TRUNCATE on `audit_log` or `domain_event`" with "holds DELETE, UPDATE or TRUNCATE on `audit_log`, `auth_audit_log` or `domain_event`".
  - **(f) Phase 1 row, line 1110.** Deliverable: replace "`action()`, audit log (PII-redacted)," with "`action()`, audit log (PII-redacted) and `auth_audit_log` for logins and 2FA (system module, no RLS; revision 8),". Done when: replace "the catalog test that no runtime role holds DELETE, UPDATE or TRUNCATE on `audit_log` or `domain_event` (Scalability)" with "the catalog test that no runtime role holds DELETE, UPDATE or TRUNCATE on `audit_log`, `auth_audit_log` or `domain_event` (Scalability), the auth-audit tests (revision 8: one `auth_audit_log` row per sign-in and per 2FA event, also for a user with no workspace, and not one per workspace for a user in two; failed attempts write none; no email, code or secret in a row; the table on the no-RLS allow-list and reached only through the system module, with the TEN-10 lint fixture)".
  - **(g) Verification, line 1252.** Replace "and the catalog test that no runtime role holds DELETE, UPDATE or TRUNCATE on `audit_log` or `domain_event` (Scalability; TEN-03)." with "the catalog test that no runtime role holds DELETE, UPDATE or TRUNCATE on `audit_log`, `auth_audit_log` or `domain_event` (Scalability; TEN-03); and, from revision 8, the auth-audit tests (Phase 1 row) with the real `crm_app` role and a real Better Auth instance."
  - Plus the "Changes in v4.7 revision 8" item for E12, quoting Charlie's "B" and the builder's two options as in Task 30.

**`agents/PROJECT.md` (by `setup`, after the revised spec is approved):**
- **P1 — §2 spec row:** "v4.7 revision 7 … The spec's Status line still says "draft" until the first later spec PR (§11)." → revision 8 with its approval record; drop the "still says draft" sentence.
- **P2 — §2 "Spec hash at last reconcile":** the new hash.
- **P3 — §9 `crm_purge` line:** add "connects with its own login (Open question 8, resolved <date>)".
- **P4 — §9 `crm_worker` line:** "(exact grants measured in Phase 1)" → "(exact grants measured in Phase 1: `docs/runbooks/phase-1-database-roles.md`, manifest `apps/web/src/db/privileges.ts`)" — after PR 5 merges.
- **P5 — §11 first bullet:** mark Open question 8, the `crm_worker` measurement, Bob spec Round 21 P2 and the Status-line label as done, citing this plan PR; §11 "The open questions are 2, 3 and 6–9" → "2, 3, 6, 7 and 9".
- **P6 — §7:** replace the `pending scaffold` isolation-tests line with "`pnpm test` (isolation, catalog and RLS tests; Docker running) and `pnpm test:gates` (pooler gate)" — after PR 6 merges.
- **P7 — §9 "Open for Bob" UNI-04 line:** "`pg` is lint-banned in `packages/core` and, outside pg-boss, in `apps/web`" — after PR 5 merges.
- **P8 — §9 system-module line (line 178: "Better Auth tables and `billing_account` have no RLS and are reached only through the allow-listed system module (lint rule, no-RLS allow-list test, two-workspace authorization tests).")** → "Better Auth tables, `billing_account` and `auth_audit_log` (user-level login and 2FA audit, append-only, `crm_app` INSERT only; spec revision 8) have no RLS and are reached only through the allow-listed system module (lint rule, no-RLS allow-list test, two-workspace authorization tests)." — in the revision 8 reconcile (with P1–P3, P5).
- **P9 — §9 UNI-10 line (line 218: "no role deletes rows from `audit_log` or `domain_event`")** → "no role deletes rows from `audit_log`, `auth_audit_log` or `domain_event`" — in the same reconcile.
