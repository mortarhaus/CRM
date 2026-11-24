# Runbook: Phase 1 database roles

Scope: Phase 1 PR 1 (plan `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`, Tasks 1-3):
the five database roles, the bootstrap step that creates them, one connection per role, and the privilege
baseline (migration `0001_privileges_baseline.sql`). PR 2 (Tasks 4-7) adds the first tenant table,
`workspace_settings`, under row-level security, and `withWorkspace()` (section "Tenant tables and the
workspace context"). PR 3 (Tasks 8-11) adds the system table `billing_account` (section "System tables
beyond Better Auth") and the polymorphic-reference trigger functions. PR 4 (Tasks 12-15 and 31) adds the
tenant tables `audit_log` and `idempotency_key`, `crm_purge`'s one grant and the system table
`auth_audit_log` (sections "Auth audit and 2FA sessions" and "Upgrading a Phase 0 database to Phase 1:
every user is signed out once"). PR 5 adds the pg-boss grants. PR 6 adds the tenant tables `domain_event` and
`notification`; PR 7 adds the system table `rate_limit` and the `account.password` grant (section "Rate-limit counters").

"Verified" means the command was run on 2026-10-24 against the dev compose Postgres 17 or a Testcontainers
Postgres 17.

## The five roles

None is superuser or has `BYPASSRLS`, `CREATEROLE`, `CREATEDB` or `REPLICATION`
(`apps/web/src/db/bootstrap.test.ts`, `apps/web/src/db/privileges.test.ts`).

| Role | Login | What it may do | Connection |
|---|---|---|---|
| `crm_migrator` | yes | Owns the database, every schema object and (from PR 5) `pgboss`; runs migrations. Member of `crm_link_resolver` with `INHERIT FALSE, SET TRUE`, only so a migration can make it the owner of `resolve_share_link()` (Phase 7) | `DATABASE_MIGRATOR_URL`, direct, never pooled |
| `crm_app` | yes | Every web request and the worker's tenant work. Today: the Better Auth tables, exactly as measured below, `billing_account` (SELECT, INSERT), `auth_audit_log` (INSERT), `rate_limit` (SELECT, INSERT, UPDATE, DELETE), `workspace_settings`, `audit_log`, `idempotency_key`, `domain_event` and `notification` under RLS, and enqueue only in `pgboss` (see "pg-boss grants") | `DATABASE_URL`, may be pooled |
| `crm_worker` | yes | The worker's pg-boss instance, `pgboss.*` only, exactly as measured in "pg-boss grants". Nothing in `public` (TEN-02): the worker's tenant work runs on its `crm_app` pool | `DATABASE_WORKER_URL` (worker only, direct) |
| `crm_purge` | yes, `NOINHERIT`, `CONNECTION LIMIT 2` | PDPA purge only. INSERT on `audit_log` only, for the purge's own entry, under the RESTRICTIVE workspace policy and `audit_log_purge_insert` (PR 4, migration 0012; `purge-role.test.ts`). No role is a member of it. It has **no password** in dev compose and production until the purge job lands (Phase 9), so nobody can sign in as it | none until Phase 9 (`DATABASE_PURGE_URL`, worker only) |
| `crm_link_resolver` | no (`NOLOGIN`) | Owns `resolve_share_link()` from Phase 7. No privilege beyond the PUBLIC defaults, which it cannot use | none |

`PUBLIC` keeps only `CONNECT` on the database and `USAGE` on schema `public`. Migration 0001 revokes
`TEMPORARY` on the database and, through `ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator`, `EXECUTE` on every
function `crm_migrator` creates; a later migration grants `EXECUTE` per function to the role that needs it.

## Bootstrap: create or repair the roles

Roles belong to the cluster, not to one database, so a migration cannot create them without `CREATEROLE`.
The bootstrap step (`apps/web/src/db/bootstrap.ts`) runs once per cluster with an admin connection,
**before** migrations. It is idempotent: every run re-applies each role's full attribute list (repairing
drift), sets the passwords, grants the `crm_link_resolver` membership and makes `crm_migrator` the database
owner, all in one transaction. Passwords never reach the server: the step computes each SCRAM-SHA-256
verifier itself (16-byte random salt, 4096 iterations) and sends that, and the transaction first sets
`log_statement = 'none'` and `log_min_error_statement = 'panic'` (plus the duration and sample log settings)
locally, so even the verifiers stay out of the server log (UNI-09; this needs a superuser admin). It never
prints a statement; on failure it prints only the database error message (`bootstrap.test.ts`, "password
handling", checks the log with `log_statement = all`, the thrown error and the CLI output).

Inputs (`parseBootstrapEnv` in `apps/web/src/lib/env.ts`; an error names the variable, never the value):

| Variable | Rule |
|---|---|
| `DATABASE_ADMIN_URL` | `postgres://` URL of a superuser (the bootstrap sets log settings that only a superuser may set) |
| `CRM_MIGRATOR_PASSWORD`, `CRM_APP_PASSWORD`, `CRM_WORKER_PASSWORD` | at least 16 characters, printable ASCII only (`openssl rand -base64 24` fits) |
| `CRM_PURGE_PASSWORD` | optional, same rule; leave unset until Phase 9. Unset means `PASSWORD NULL` |

| Where | Command | Status |
|---|---|---|
| Dev compose | `pnpm stack:up`: the one-shot `bootstrap` service runs first; `web` and `worker` wait for it to exit 0 | Verified |
| Dev, host only (`pnpm dev`) | uncomment the bootstrap lines in `.env` (copied from `.env.example`), then `docker compose -f docker/compose.dev.yml up -d --wait postgres`, `pnpm db:bootstrap`, `pnpm db:migrate` | Verified; prints `{"level":"info","msg":"roles bootstrapped"}`, twice in a row without error |
| Production | `docker compose run --rm web bootstrap` once per cluster, with `DATABASE_ADMIN_URL` and the passwords from the host's secret store (UNI-08), then start `web` and `worker` (they migrate) | Not run: no production stack yet. Assumes a superuser admin (self-managed Postgres on the VPS, Stage 2); a managed database's admin role is checked at the Stage 3 pre-cutover gate |

### Upgrading a Phase 0 dev database

The Phase 0 dev volume was created by the old superuser `crm`, which owns its tables. Dev data is
disposable (`docs/DECISIONS.md` 2026-10-21), so start again:

```bash
docker compose -f docker/compose.dev.yml down -v   # deletes the crm-dev database volume
pnpm stack:up                                       # or: postgres only, then db:bootstrap and db:migrate
```

Then copy the new `DATABASE_*` lines (and, for `pnpm db:bootstrap`, the commented bootstrap lines) from
`.env.example` into `.env`.

## Password rotation

1. Put the new password(s) in the host's secret store (or `.env` in dev).
2. Rerun bootstrap with the new values (it sets all three login passwords every time).
3. Update `DATABASE_URL`, `DATABASE_MIGRATOR_URL` and `DATABASE_WORKER_URL` to match, then restart `web`
   and `worker`. Existing connections stay open until the restart; new ones need the new password
   (`bootstrap.test.ts`: the old password is refused with `28P01`).

## Measured grants: `crm_app` on the Better Auth tables

Method (plan Settled item 2): start from no grant, run the operation set as `crm_app`, add the narrowest
grant for each statement, stop at zero `permission denied`. Operation set: `apps/web/src/lib/auth/auth.test.ts`
in full (sign-up, duplicate sign-up, sign-in, password limits, user rename, 2FA enrolment, restart and
confirmation, recovery-code sign-in, 2FA disable, session refresh after a day, workspace create, rename and
switch, invitations) and the Phase 0 E2E suite (`pnpm test:e2e`, 84 tests, against `pnpm dev` with the role
URLs). Measured 2026-10-24, better-auth 1.7.6, drizzle-orm 0.45.3, Postgres 17: every statement `crm_app`
ran was logged (`log_statement = all` on a throwaway database), each grant below comes from those
statements, and with only these grants both suites pass and the Postgres log shows no `permission denied`.
Not remeasured on better-auth 1.7.14 (PR #47, 2026-10-31; DECISIONS 2026-10-30): there the full unit suite
(`auth.test.ts`, `auth-audit.test.ts`, `privileges.test.ts`) and the Phase 0 E2E suite pass as `crm_app` with
these grants; the statement log was not re-collected.

| Table | SELECT | INSERT | UPDATE (columns) | DELETE | Why |
|---|---|---|---|---|---|
| `user` | yes | yes | `name`, `two_factor_enabled`, `updated_at` | no | sign-up, session reads, rename, 2FA flag |
| `session` | yes | yes | `active_organization_id`, `expires_at`, `updated_at` | yes | sign-in, workspace switch, refresh after a day, sign-out and 2FA session rotation |
| `account` | yes | yes | `password`, `updated_at` (PR 7, migration 0023) | no | credential row at sign-up, password check at sign-in, `/change-password` |
| `verification` | yes | yes | none | yes | the 2FA challenge row, consumed and expired-row cleanup |
| `two_factor` | yes | yes | `backup_codes`, `failed_verification_count`, `locked_until`, `secret`, `verified` | yes | enrolment (restart replaces the secret), confirmation, recovery codes, failed-attempt lock, disable |
| `organization` | yes | yes | `name` | no | workspace create, list, rename |
| `member` | yes | yes | none | no | owner membership at create, membership checks |
| `invitation` | yes | yes | `expires_at`, `status` | no | invite, resend, accept (Phase 0 tests of the 30-minute expiry) |

INSERT is table-level because Drizzle names every column in an insert. Better Auth paths outside the
operation set get no grant and fail with `permission denied` (HTTP 500) if called, for example a successful
email change, a workspace slug or logo change, and member role changes. Since PR 7 the Phase 1 enabled-path
list (`apps/web/src/lib/auth/enabled-paths.ts`, plan Task 24) decides which paths are reachable: every other
Better Auth path answers 404 over HTTP (`disabledPaths`, computed from the built options, and the request
handler). `/change-password` is enabled, with its grant (migration 0023) and a refusal unless the body sends
`revokeOtherSessions: true` (AUTH-07; `docs/runbooks/phase-1-security.md`). The seven invitation endpoints
answer 404 (invitations are Phase 3), so the `invitation` grants are used only by the server-side tests until then.

The manifest `apps/web/src/db/privileges.ts` holds the same set, together with every grant below
(system tables, tenant tables, `crm_purge`); `privileges.test.ts` fails on any privilege
that is missing from it or not in it, for every role and for PUBLIC.

## System tables beyond Better Auth

`billing_account` (migration 0004, grants in 0005) has no RLS and is reached only through the system module
(`apps/web/src/db/system/billing.ts`). `crm_app` holds SELECT and INSERT; no role holds UPDATE or DELETE.
One row per owner (`UNIQUE (owner_user_id)`), created by the organization plugin's before-create hook on the
user's first workspace; `organization.billing_account_id` points at it (`ON DELETE RESTRICT`; nullable, so
workspaces created before PR 3 have none). `plan` is locked to `free` and `status` to `active` by CHECK
constraints until Part 3, so any other value fails with `23514`, also for the admin.

## Rate-limit counters

`rate_limit` (migration 0021, grants in 0022) is a system table with no RLS: counters keyed by text (`ba:`,
`acct:`, `email-test:` prefixes), reached only through the system module (`apps/web/src/db/system/rate-limit.ts`).
`crm_app` holds SELECT, INSERT, UPDATE and DELETE; the web process uses a pool of its own for it
(`getLimiterDb`, 2 connections), so a counter row is never held for a whole request. Limits, keys and cleanup:
`docs/runbooks/phase-1-security.md`.

## Polymorphic-reference trigger functions

Migration 0006 installs `public.poly_ref_check_insert()` and `public.poly_ref_forbid_retarget()`
(`SECURITY INVOKER`, owned by `crm_migrator`, no EXECUTE grant: a trigger function needs none to fire). No
table uses them yet; each later migration that creates a table with a polymorphic reference attaches them.
Their errors: `23503 poly_ref: target not in workspace`, `23514 poly_ref: unknown target type`,
`23514 poly_ref: target is immutable`.

## Auth audit and 2FA sessions (`auth_audit_log`)

Plan Task 31; design and evidence in `docs/DECISIONS.md` ("Phase 1 PR 4: `auth_audit_log` design (Task 31
spike)").

| Table | `crm_app` | Reader | Created by |
|---|---|---|---|
| `auth_audit_log` | INSERT only (no SELECT, UPDATE, DELETE or TRUNCATE for any runtime role; append-only) | none at runtime. Operators read it only through the admin connection, read-only, for an incident | migrations 0007 (table, `session.issue_reason`), 0008 (grant), 0009 (triggers, R15 cutover), 0010 (trusted devices refused) |

No RLS (it is on the no-RLS allow-list, `apps/web/src/test/catalog.ts`): rows are per user, not per
workspace. `user_id` is `ON DELETE RESTRICT`; no user deletion is enabled. Retention and erasure are decided
by the PDPA check before Phase 4 goes live (plan Task 31 open point E); until then every row is kept.

### Mechanism

- **Only a migration may change it.** The rows are written by four trigger functions of migration 0009
  (`SECURITY INVOKER`, owned by `crm_migrator`, no EXECUTE for anyone), in the statement that makes the
  change they record. No application code writes a row, and no runtime role can drop, disable or replace
  a trigger (`auth-audit.test.ts` T14).
- **Each auth POST is one database transaction** (outside `/organization/*`; `withRequestTransactions`
  in `apps/web/src/lib/auth/request-transaction.ts`, `createAuthTransactions` in
  `apps/web/src/db/system/auth-transaction.ts`). It commits when the response status is below 500 and
  otherwise rolls back and drops `Set-Cookie`. It sets `lock_timeout = '5s'` and `crm.auth_client_ip` (the
  IP the triggers store). GET endpoints run outside it; none of them inserts a session, and a session
  insert without a known label is refused anyway (default deny).
- **One request of a user at a time.** On the seven paths that read or write the 2FA state, the request
  locks the user row (`FOR NO KEY UPDATE`) before Better Auth reads it, until commit. A sign-in
  (`/sign-in/email`) first takes a transaction advisory lock on its lower-cased email, whether or not an
  account has it, so sign-ins on one email run one at a time and a burst does not show whether the account
  exists (AUTH-05, PR #44 Round 2 P2-2). To see who waits for an email lock: `select l.pid, l.granted,
  a.query_start from pg_locks l join pg_stat_activity a using (pid) where l.locktype = 'advisory' and
  l.objsubid = 2 and l.classid = 1129467137` (unverified against a live server; the tests count waiters with the same filter).
- **Pool bound (PR #44 P2-1).** Request transactions take at most half of the web process's pool
  (`createDb` `max: 10`, so 5). A request waits at most 10 s for one of those slots in memory, then answers
  500 with no change (`[auth] request failed: AuthTransactionsBusy`). The other half always serves the rest
  of the app: in the test, 30 parallel sign-ins for one locked user left an unrelated `select 1` under
  1 000 ms (`auth-audit.test.ts`, "PR #44 P2-1"). **Residual:** during such a burst, the other users' sign-ins
  and 2FA requests queue behind it for a slot (auth throughput, not the app, is what the burst slows), and
  requests on the attacked email, with or without an account, can see 500s after 5 s (lock wait) or 10 s
  (slot wait). The per-IP and per-account
  rate limits (plan Task 22) bound the burst. Inside a request transaction a query on the pool itself, which
  would need a second connection, fails at once (`PoolBypassError`) and the request rolls back.
- **A 2FA change ends every session of the user that existed before it (AUTH-07, R5).** Enabling 2FA,
  disabling it and regenerating the recovery codes each end every session of that user, on every device,
  the device that made the change included. That device continues on a fresh session that the same response
  sets, with its own `session_issued` row (reason `rotation`). **Signing in with a recovery code ends no
  session** (it is a login method; open point F, decided by Charlie on 2026-10-22).
- **Trusted devices are off.** `trustDevice: true` is refused with 400 `TRUST_DEVICE_DISABLED`, and the
  database refuses any `trust-device-%` verification row (23514); migration 0010 deleted the Phase 0 ones.
  Every sign-in of a 2FA user asks for the second step.
- **`/list-sessions` returns no token** (R10): id, user id, timestamps, IP and user agent only. Ending one
  chosen other session by id comes with plan Task 24 (PR #44 P2-3); "sign out other sessions" works today.

### An interrupted or failed 2FA enrolment or disable (R11)

Enable and disable are each one transaction: a failure or a lost connection at any statement rolls the
flag, the session revocation, the replacement session and their audit rows back together. The user keeps
the session they had and the 2FA state they had, and simply tries again (enrolment restarts with a new
secret and new recovery codes). If the response is lost after the commit, the change happened: the user
signs in again (with the authenticator just set up, or with the password only after a disable). No operator
action is needed in either case.

A **Phase 0** account can be in the state "2FA flag on, enrolment unverified" (Phase 0 had no transaction).
Such a user is asked for a second step at sign-in that the authenticator cannot answer, so they sign in
with one of the recovery codes shown when they started the enrolment, then restart enrolment or disable 2FA.
Phase 0 holds only test data, so there is no real user in this state.

### How a login maps to rows

| What happened | Rows (in order) |
|---|---|
| Sign-in, password only | `session_issued` `{reason: sign_in, method: password}` |
| Sign-in of a 2FA user, password step | `session_issued` `{reason: two_factor_pending, method: password}` (Better Auth deletes this session in the same request; it is not a login) |
| Second step with the authenticator | `two_factor_verified` `{method: totp}`, `session_issued` `{reason: sign_in, method: totp}` |
| Second step with a recovery code | `two_factor_backup_codes_changed`, `two_factor_verified` `{method: backup_code}`, `session_issued` `{reason: sign_in, method: backup_code}` |
| 2FA enabled (enrolment confirmed) | `two_factor_enabled`, `session_issued` `{reason: rotation, cause: two_factor_enabled}` |
| 2FA disabled | `two_factor_disabled`, `session_issued` `{reason: rotation, cause: two_factor_disabled}` |
| Recovery codes regenerated | `two_factor_backup_codes_changed`, `session_issued` `{reason: rotation, cause: backup_codes_regenerated}` |
| Password changed (from plan Task 24) | `session_issued` `{reason: rotation, cause: password_changed}` |

A login is exactly one `session_issued` row with reason `sign_in`. `session_issued` and `two_factor_verified`
rows also hold `session_id`, the internal id of the session (never its token). Every row has `user_id`, `ip` (null when
the request had no trustworthy IP) and `created_at`. Sign-out, a failed password and a failed code are not
recorded here (failed codes count in `two_factor.failed_verification_count`).

### Incident queries (admin connection, read-only)

```sql
-- A user's history, oldest first (in one statement the 2FA step comes before its session).
select created_at, event, detail, ip from auth_audit_log
where user_id = '<user uuid>'
order by created_at, case event when 'two_factor_verified' then 0 else 1 end;

-- Logins in a time window, with method and IP.
select created_at, user_id, detail ->> 'method' as method, ip from auth_audit_log
where event = 'session_issued' and detail ->> 'reason' = 'sign_in'
  and created_at >= '<from>' and created_at < '<to>'
order by created_at;

-- Logins from one IP.
select created_at, user_id, detail ->> 'method' as method from auth_audit_log
where event = 'session_issued' and detail ->> 'reason' = 'sign_in' and ip = '<ip>'
order by created_at;

-- 2FA changes in a time window.
select created_at, user_id, event, ip from auth_audit_log
where event in ('two_factor_enabled', 'two_factor_disabled', 'two_factor_backup_codes_changed')
  and created_at >= '<from>' and created_at < '<to>'
order by created_at;

-- The invariant: every session has its row. Expect no rows.
select s.id from session s
where not exists (select 1 from auth_audit_log a
                  where a.event = 'session_issued' and a.detail ->> 'session_id' = s.id::text);
```

To end every session of a compromised account, an operator deletes them as the admin
(`delete from session where user_id = '<user uuid>'`); this writes no audit row, so record it in the incident
notes.

### Database driver patch (postgres.js 3.4.9)

`patches/postgres@3.4.9.patch` (pnpm `patchedDependencies`, applied at install, also in the image's deps
stage) fixes what happens when a database backend ends during a transaction (a Postgres restart, a failover,
`pg_terminate_backend`): without it the web process logged an uncaught `TypeError` and one pool connection
stayed wedged (health checks 503 after 2 s). With it the transaction is rejected (`CONNECTION_CLOSED`, the
request answers 500), and the connection reconnects for the next query. Remove the patch when an upstream
release fixes it (see `docs/DECISIONS.md`, 2026-10-26, PR #44 Round 1).

## Upgrading a Phase 0 database to Phase 1: every user is signed out once

- **What happens:** migration 0009, which installs the audit mechanism, first locks `session` against
  writes, deletes every session and writes no audit row (plan R15, open point G, decided by Charlie on
  2026-10-22). Only then do the triggers exist. Migration 0010 deletes the Phase 0 trusted-device records.
  All pending migrations run in one transaction, so the lock holds until they commit.
- **User effect:** everyone is signed out once and signs in again (with their second step, if 2FA is on;
  no device stays trusted). No account, workspace, setting or 2FA enrolment is lost.
- **Operator steps:** announce it to users before a production upgrade. Note the time just before starting
  the upgrade (the cutover time). Let `migrate` finish before `web` and `worker` start, as the compose order
  and the image entrypoint already do. No manual session cleanup.
- **After-check** (admin connection), each expects 0:

```sql
select count(*) from session where created_at < '<cutover time>';
select count(*) from auth_audit_log where created_at < '<cutover time>';
select count(*) from verification where identifier like 'trust-device-%';
select count(*) from session s
where not exists (select 1 from auth_audit_log a
                  where a.event = 'session_issued' and a.detail ->> 'session_id' = s.id::text);
```

## Tenant tables and the workspace context

Every table in `public` that is not a system table (today: the Better Auth tables, `billing_account`, `auth_audit_log` and `rate_limit`) is a tenant table:
it has a non-null `workspace_id`, row-level security `ENABLE`d and `FORCE`d, one RESTRICTIVE workspace
policy `FOR ALL TO crm_app, crm_purge`, and one PERMISSIVE policy per command `crm_app` holds (spec
Tenancy, revision 7). The predicate is always
`workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid)`.

App code reads and writes a tenant table only inside `withWorkspace(workspaceId, tx => ...)`
(`apps/web/src/db/workspace.ts`), which opens a transaction and runs
`select set_config('app.workspace_id', $1, true)` first. The setting ends with the transaction (commit or
rollback), so a pooled connection never carries it to the next request. A query outside it sees **no**
tenant rows and cannot insert any. `SET`, `SET LOCAL`, `SET ROLE` and any other `set_config` call are lint
errors in `apps/web` (TEN-09). `crm_migrator` and `crm_worker` have no policy on a tenant table, so under
`FORCE ROW LEVEL SECURITY` they see no tenant rows either; only the database admin (a superuser) does.

| Table | `crm_app` | Policies | Created by |
|---|---|---|---|
| `workspace_settings` | SELECT, INSERT, UPDATE (no DELETE: workspace deletion is Phase 9) | `workspace_settings_workspace` (RESTRICTIVE), `_app_select`, `_app_insert`, `_app_update` | migrations 0002 (table) and 0003 (RLS, grants) |
| `audit_log` | SELECT, INSERT (append-only: no role but the owner updates, deletes or truncates, TEN-03); `crm_purge` INSERT only | `audit_log_workspace` (RESTRICTIVE), `_app_select`, `_app_insert`, `_purge_insert` | migrations 0011 (table) and 0012 (RLS, grants) |
| `idempotency_key` | SELECT, INSERT, DELETE, UPDATE (`response` only) | `idempotency_key_workspace` (RESTRICTIVE), `_app_select`, `_app_insert`, `_app_update`, `_app_delete` | migrations 0013 (table) and 0014 (RLS, grants) |
| `domain_event` | SELECT, INSERT (append-only, TEN-03) | `domain_event_workspace` (RESTRICTIVE), `_app_select`, `_app_insert` | migrations 0019 (table) and 0020 (RLS, grants) |
| `notification` | SELECT, INSERT, UPDATE (`read_at` only) | `notification_workspace` (RESTRICTIVE), `_app_select`, `_app_insert`, `_app_update` | migrations 0019 (table) and 0020 (RLS, grants) |
| `doc_sequence` | SELECT, INSERT, UPDATE (`pattern`, `reset_rule`, `counter`, `last_reset_period`, `version`, `updated_at`); no DELETE, so a counter is never removed and a number never given twice; nothing for `crm_purge` | `doc_sequence_workspace` (RESTRICTIVE), `_app_select`, `_app_insert`, `_app_update` | migrations 0033 (table) and 0034 (RLS, grants) |
| `service` | SELECT, INSERT, UPDATE (`name`, `default_description`, `default_unit_price_minor`, `currency`, `unit`, `default_taxable`, `archived_at`, `version`, `updated_at`); no DELETE, a service is archived, never deleted; nothing for `crm_purge`. Trigger `service_currency_locked` refuses a currency change while a default price is set (SQLSTATE 23514) | `service_workspace` (RESTRICTIVE), `_app_select`, `_app_insert`, `_app_update` | migrations 0035 (table) and 0036 (RLS, grants, trigger) |

Every new workspace gets its `workspace_settings` row from Better Auth's `afterCreateOrganization` hook
(`apps/web/src/db/system/workspaces.ts`, `ensureWorkspaceSettings`). It is a second write after Better
Auth's own, so a crash in between can leave a workspace without its row; the call is idempotent, and `requireWorkspaceMember`
(`apps/web/src/lib/auth/action.ts`, through `healWorkspaceSettings` in the system module) recreates it when
the row is missing (plan Task 14 and Risk 6).

Checks: `apps/web/src/db/rls.test.ts` (the `nullif` policy lint and the RESTRICTIVE + PERMISSIVE catalog
test over every tenant table), `apps/web/src/db/isolation.test.ts` (two workspaces, every tenant table,
read and write), `apps/web/src/db/workspace.test.ts` (a reused connection after commit and rollback).

To inspect tenant rows by hand, connect as the admin, or as `crm_app` inside a transaction that first
runs `select set_config('app.workspace_id', '<workspace uuid>', true)`. Never `SET` it for a session.

## pg-boss grants

pg-boss 12.35.0 lives in schema `pgboss`, installed and upgraded only by `crm_migrator` in migrations (0015
install, 0016 the Phase 1 queues and the `crm_app` grants, 0017 the internal cron queue, 0018 the `crm_worker`
grants, 0032 the owner email queue `email.bank_details_changed` and its dead-letter queue; the grants are on the
`pgboss` tables, so a new queue needs none). Neither app instance migrates, creates the schema or creates a queue; queue options (`notify`
included, off on every queue) change only in a migration.

Method (plan Settled item 2, Task 17): the instance runs with the production switches (`apps/web/src/jobs/options.ts`)
and the shortest intervals 12.35.0 allows (1 s; polling 0.5 s), against Testcontainers PostgreSQL 17 started with a
server log (`log_line_prefix = '%m [%p] user=%u sqlstate=%e '`). With only the grants below the whole operation set
runs with zero `42501` lines for the role, zero `error` events and zero `warning` events; then each grant is revoked
in turn and the operation set must hit `permission denied` for that object (`describe.each`, kept as a test so a
later change keeps the evidence). Measured 2026-10-27, pg-boss 12.35.0 with the CRM patch (below), PostgreSQL 17.11.

**`crm_app`, the web send-only instance** (`migrate`, `createSchema`, `supervise`, `schedule` false, `max` 2;
`apps/web/src/jobs/install.test.ts`): `start()`, `send()`, the queue-cache refresh, `stop()`.

| Privilege | Object | Operation that needs it |
|---|---|---|
| USAGE | schema `pgboss` | every statement |
| SELECT | `version` | `start()` checks the schema version |
| SELECT | `queue` | the queue cache (`send()` looks the queue up) |
| INSERT | `job_common` | `send()` |
| SELECT (`id`) | `job_common` | `send()`'s `RETURNING id` |
| SELECT (`start_after`) | `job_common` | not used in Phase 1 (only returned when a queue has `notify` on); kept because the spec lists it |
| EXECUTE | `job_now()` | `send()` (`created_on`, `start_after`) |

No payload column (`data`, `output`) is readable: `select data from pgboss.job_common` fails `42501`.

**`crm_worker`, the worker instance** (`supervise`, `schedule` true; `migrate`, `createSchema`, `reindex`,
`persistQueueStats`, `persistWarnings` false; `max` 3; `apps/web/src/jobs/worker-grants.test.ts`). Operation set:
`start()`; `work()`, fetch and `complete()`; a handler that throws twice then succeeds (retry with backoff); a handler
that always throws (retries exhausted, a copy in `email.send.dead`); `expireInSeconds` exceeded (maintenance fails the
job); `deleteAfterSeconds` after completion and `retentionSeconds` on an unfetched job (maintenance deletes both);
`schedule()` and a cron fire within 75 s; `unschedule()`; `redrive()` of the dead-letter copy (the admin command,
`jobs:retry`); `stop()`.

| Privilege | Object | Statement that fails without it (ablation) |
|---|---|---|
| USAGE | schema `pgboss` | every statement (`start()` first) |
| EXECUTE | `job_now()` | the clock check at `start()`, fetch, the cron and maintenance passes |
| SELECT | `version` | `start()` reads the schema version |
| UPDATE (`cron_on`) | `version` | the cron pass claims its minute |
| UPDATE (`flow_on`) | `version` | the flow (job dependency) pass claims its turn |
| UPDATE (`monitor_backoff_on`) | `version` | supervise's monitor backoff |
| SELECT | `queue` | the queue cache, the patched `start()` (does the cron queue exist?) |
| UPDATE (`monitor_claim_on`, `monitor_on`, `maintain_on`, `deferred_count`, `queued_count`, `ready_count`, `active_count`, `failed_count`, `total_count`, `singletons_active`, `ready_history`) | `queue` | supervise: the monitor claim and queue counts, the maintenance claim (each column ablated on its own) |
| SELECT, INSERT, UPDATE | `schedule` | `schedule()` (an upsert), the cron pass reads the schedules |
| DELETE | `schedule` | `unschedule()` |
| SELECT, UPDATE | `job_common` | fetch, `complete()`, `redrive()` (locks the dead-letter copy `FOR UPDATE`) |
| INSERT, DELETE | `job_common` | `fail()` and expiry (pg-boss moves a failed job with a DELETE and an INSERT in one statement); the cron fire (INSERT); maintenance deletion after `deleteAfterSeconds` and `retentionSeconds` (DELETE); `redrive()` deletes the copy (DELETE) |
| SELECT, INSERT, UPDATE | `job` (the partitioned parent) | the dead-letter copy, `redrive()` (inserts the new job), the flow pass (`FOR UPDATE` on parents) |
| SELECT, DELETE | `job_dependency` | the flow pass and maintenance deletion |

Nothing on `subscription`, `bam`, `warning` or `queue_stats` (no statement of the operation set uses them; warnings
and queue stats are not persisted), no UPDATE on `job_dependency`, no table-level UPDATE on `queue` or `version` (so
queue options, `notify` included, and the schema version change only in migrations), no EXECUTE on `create_queue` or
`delete_queue`, no INSERT on `queue`, and nothing in `public` (TEN-02, `privileges.test.ts`). The manifest
`apps/web/src/db/privileges.ts` holds both lists; `privileges.test.ts` fails on any difference.

### Retrying a failed job (`jobs:retry`)

A job whose retries are exhausted is `failed` in its own queue, and a copy lands in the queue's dead-letter queue
(`email.send.dead`, `email.bank_details_changed.dead`, `domain_event.dead`) in state `created`. No worker works the dead-letter queues. pg-boss deletes
the failed original after the queue's `deleteAfterSeconds` (7 days by default). The copy is never fetched, so
maintenance deletes it when its `retentionSeconds` ends (14 days by default; migration 0016 sets no retention on the
`.dead` queues): **redrive within 14 days of the failure**, or the job is gone. To run the job again once the cause is fixed, **redrive the copy**: pass the **original queue** and
the **copy's id**, as `crm_worker`:

```sql
-- the copy's id (admin connection): every copy in the queue, or the copy of one failed job
select id, source_id, created_on from pgboss.job where name = 'email.send.dead' order by created_on;
select id from pgboss.job where name = 'email.send.dead' and source_id = '<failed job id>';
```

```sh
# host (reads the root .env)
pnpm --filter @crm/web jobs:retry -- --queue email.send --id <dead-letter job id>
# image (the running worker container has the URLs)
docker compose -f docker/compose.dev.yml exec worker node dist/retry-job.mjs --queue email.send --id <dead-letter job id>
```

It calls pg-boss `redrive('email.send.dead', { ids: [<id>], sourceName: 'email.send', limit: 1 })`, which in one
statement creates a **new job** in `email.send` (a new id, state `created`, `retry_count` 0) and deletes the copy, then
prints `{"level":"info","msg":"job redriven","queue":"email.send"}` (exit 0). It works whether or not the failed
original still exists. The new job takes the queue's **current** retry, expiry and dead-letter settings: per-send
overrides from the original `send()` are not kept. Its `source_root_id` is the original job's id, so
`select id, state from pgboss.job where name = 'email.send' and source_root_id = '<failed job id>'` finds it. If it fails
again, a new copy lands in the dead-letter queue and can be redriven the same way.

The failed original stays `failed` until pg-boss deletes it. Do **not** also run pg-boss `retry()` on it, or the job
runs twice. Passing the failed original's id, an unknown id, or a copy that came from another queue prints
`job not found; pass the id of the copy in the dead-letter queue (see --help)` (exit 1) and changes nothing. An unknown
queue prints `queue not found`; a queue with no dead-letter queue (a `.dead` queue itself, `rate_limit.cleanup`)
prints `queue has no dead-letter queue; pass the original queue` (exit 1). A missing or malformed argument exits 2
before connecting. The command starts pg-boss with one connection, no maintenance and no cron
(`RETRY_BOSS_OPTIONS`), never prints a payload value, and logs errors by name and SQLSTATE only (UNI-09). It needs
no grant beyond the worker's (`worker-grants.test.ts` runs the redrive in the operation set with zero permission
errors). Before PR #46 the command called `retry()` on the failed original, which stopped working once pg-boss deleted
it and left the copy behind (PR #45 deferred P2-1).

### Connections and pools

| Process | crm_app (postgres.js) | pg-boss (`pg`) | Notes |
|---|---|---|---|
| web | 10 (`getDb()`), plus 2 for the rate limiter (`getLimiterDb()`) | 2, `crm_app` (`getSendBoss()`, send only) | the auth-transaction slots (5) and `PoolBypassError` cover the postgres.js pool only |
| worker | 3 (`openDatabase`, the `getDb()` singleton) | 3, `crm_worker` | one crm_app pool per process: a second `openDatabase` throws |
| `jobs:retry` | none | 1, `crm_worker` | one-off |

pg-boss's pool is not the guarded postgres.js pool: a `send()` inside an auth request transaction neither fails with
`PoolBypassError` nor joins that transaction (`boss.test.ts`). A job that must commit with the request's writes
passes the transaction as pg-boss's `db` (Task 19, `enqueue.ts`).

On SIGTERM or SIGINT the worker stops in at most 8 s, under Docker's 10 s before SIGKILL: active jobs get 6 s, then
pg-boss fails them (retried by the queue's policy), and the `crm_app` pool closes within 2 s. A statement a handler
left running keeps running on the server until it ends (no `statement_timeout` is set).

### The pg-boss patch (12.35.0)

`patches/pg-boss@12.35.0.patch` (pnpm `patchedDependencies`, applied at install, also in the image's deps stage)
changes one line of `dist/timekeeper.js`: with `schedule` on, `start()` called `createQueue('__pgboss__send-it')`
every time, and `create_queue` inserts into `pgboss.queue` (`ON CONFLICT DO NOTHING`) even when the queue exists, so
the worker role would have needed EXECUTE on `create_queue` and INSERT on `pgboss.queue`. Patched, `start()` reads
the queue first (`getQueue`, a SELECT on `pgboss.queue`) and creates it only when it is missing. Migration 0017
creates it (`notify` off), so on a migrated database the worker never creates a queue. If the queue is missing
(a database not migrated to 0017), the worker's `start()` fails with `permission denied for function create_queue`
instead of creating it: run `pnpm db:migrate`.

Checks: `worker-grants.test.ts` "the pg-boss patch" fails if the installed pg-boss is not patched (the marker
`crm-patch(send-it-exists)`), and the worker start test then fails with that `42501`. Remove the patch when a
pg-boss release no longer calls `createQueue` when the queue exists (or no longer needs the queue): drop the
`patchedDependencies` entry and the patch file in the planned upgrade (R5), and keep the start test as the check.

## Failure recovery

| Symptom | Meaning | Action |
|---|---|---|
| `password authentication failed for user "crm_app"` (or another role) | Bootstrap has not run on this cluster, or the URL's password differs from the last bootstrap | Run bootstrap with the same passwords as the URLs, or fix the URL |
| `permission denied for table <name>` (`42501`) in the app log | A code path uses a privilege that was never measured | Do not grant by hand. Add the path to the operation set (a test), measure, and add the grant to a migration and to `privileges.ts` in a reviewed PR |
| `must be owner of table <name>` during `pnpm db:migrate` | The database was created before the roles (a Phase 0 volume) | Dev: `down -v` as above. Never run migrations as the admin |
| `invalid input syntax for type uuid: ""` (`22P02`) on a tenant table | A policy casts `current_setting('app.workspace_id', true)` without `nullif`, on a connection where an earlier transaction set it (Known risk R1) | A migration bug: `rls.test.ts` should have failed. Fix the policy in a new migration; never work around it in app code |
| A tenant query returns no rows, or an insert fails with `new row violates row-level security policy` (`42501`) | The query ran outside `withWorkspace()`, or for another workspace's row | Run it inside `withWorkspace()` with the workspace from the server session (TEN-11). Do not add a broader policy |
| `pnpm stack:up` fails with `service "bootstrap" didn't complete successfully` | Bootstrap exited non-zero; `docker compose -f docker/compose.dev.yml logs bootstrap` shows the reason (variable names only) | Fix the variable or the admin URL and rerun |
| `[auth] request failed: AuthTransactionsBusy` (HTTP 500 on sign-in or 2FA) | Every request-transaction slot (half of the pool) stayed busy for 10 s, usually a burst of sign-ins on one email waiting for that email's lock (or requests of one user for its row) | Nothing to repair. Look for the burst in the access log (one email, many IPs); the rate limits (plan Task 22) bound it |
| `[auth] request failed: PoolBypassError` | A query inside an auth request transaction went to the pool instead of the transaction (a code defect) | Nothing to repair: the request rolled back. Report it; the path must use the routed db |
| `[auth] request failed: … (55P03)` | A request waited 5 s for its user's lock or, on sign-in, its email's lock (`lock_timeout`; the same for an email with no account) | Nothing to repair; the user retries |
| `[auth] request failed: … (40001)` on a sign-in | A 2FA change of the same user committed during the sign-in; the sign-in was refused | Nothing to repair; the user signs in again |
| `[auth] request failed: … (23514)` on a session insert | A session insert had no known `issue_reason` label (an auth path the audit does not know) | Do not grant or relabel by hand. Add the path to `labelSessionIssue` with its test |
| `permission denied for function create_queue` (`42501`) when the worker starts | The pg-boss patch is not applied (a fresh install without `patchedDependencies`), or the database is not migrated to 0017 (the cron queue is missing) | Run `pnpm install` and rebuild the image; run `pnpm db:migrate`. Do not grant `create_queue` to `crm_worker` |
| `permission denied for table <pgboss table>` (`42501`) in the worker log | A pg-boss path outside the measured operation set (a new option or a pg-boss upgrade) | As for any `42501`: add the path to `worker-grants.test.ts`, measure, and grant in a migration with its manifest row |
| `[auth] request failed: Error (CONNECTION_CLOSED)` | The request's database backend ended (restart, failover, `pg_terminate_backend`); the request rolled back | Nothing to repair once the database is back. If it is followed by an uncaught `TypeError` in `connection.js`, the postgres.js patch is not applied: run `pnpm install` and rebuild the image |
