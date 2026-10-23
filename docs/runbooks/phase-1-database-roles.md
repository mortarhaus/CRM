# Runbook: Phase 1 database roles

Scope: Phase 1 PR 1 (plan `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`, Tasks 1-3):
the five database roles, the bootstrap step that creates them, one connection per role, and the privilege
baseline (migration `0001_privileges_baseline.sql`). Later Phase 1 PRs add grants (RLS tables, `audit_log`,
pg-boss) and update the table below.

"Verified" means the command was run on 2026-10-24 against the dev compose Postgres 17 or a Testcontainers
Postgres 17.

## The five roles

None is superuser or has `BYPASSRLS`, `CREATEROLE`, `CREATEDB` or `REPLICATION`
(`apps/web/src/db/bootstrap.test.ts`, `apps/web/src/db/privileges.test.ts`).

| Role | Login | What it may do | Connection |
|---|---|---|---|
| `crm_migrator` | yes | Owns the database, every schema object and (from PR 5) `pgboss`; runs migrations. Member of `crm_link_resolver` with `INHERIT FALSE, SET TRUE`, only so a migration can make it the owner of `resolve_share_link()` (Phase 7) | `DATABASE_MIGRATOR_URL`, direct, never pooled |
| `crm_app` | yes | Every web request and the worker's tenant work. Today: the Better Auth tables, exactly as measured below | `DATABASE_URL`, may be pooled |
| `crm_worker` | yes | The worker's pg-boss instance, `pgboss.*` only. No grant yet: PR 5 measures them | `DATABASE_WORKER_URL` (worker only; read since PR 1, used from PR 5) |
| `crm_purge` | yes, `NOINHERIT`, `CONNECTION LIMIT 2` | PDPA purge only. No grant yet (PR 4 adds INSERT on `audit_log`). No role is a member of it. It has **no password** in dev compose and production until the purge job lands (Phase 9), so nobody can sign in as it | none until Phase 9 (`DATABASE_PURGE_URL`, worker only) |
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
| `DATABASE_ADMIN_URL` | `postgres://` URL of a superuser (or a role that may create roles and change the database owner) |
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

| Table | SELECT | INSERT | UPDATE (columns) | DELETE | Why |
|---|---|---|---|---|---|
| `user` | yes | yes | `name`, `two_factor_enabled`, `updated_at` | no | sign-up, session reads, rename, 2FA flag |
| `session` | yes | yes | `active_organization_id`, `expires_at`, `updated_at` | yes | sign-in, workspace switch, refresh after a day, sign-out and 2FA session rotation |
| `account` | yes | yes | none | no | credential row at sign-up, password check at sign-in |
| `verification` | yes | yes | none | yes | the 2FA challenge row, consumed and expired-row cleanup |
| `two_factor` | yes | yes | `backup_codes`, `failed_verification_count`, `locked_until`, `secret`, `verified` | yes | enrolment (restart replaces the secret), confirmation, recovery codes, failed-attempt lock, disable |
| `organization` | yes | yes | `name` | no | workspace create, list, rename |
| `member` | yes | yes | none | no | owner membership at create, membership checks |
| `invitation` | yes | yes | `expires_at`, `status` | no | invite, resend, accept (Phase 0 tests of the 30-minute expiry) |

INSERT is table-level because Drizzle names every column in an insert. Better Auth paths outside the
operation set get no grant and fail with `permission denied` (HTTP 500) if called, for example a successful
password change (`account.password`), email change, a workspace slug or logo change, member role changes and
invitation cancel or reject. The Phase 1 enabled-path list (plan Task 24) decides which of them stay
reachable; enabling one adds its grant and a test here.

The manifest `apps/web/src/db/privileges.ts` holds the same set; `privileges.test.ts` fails on any privilege
that is missing from it or not in it, for every role and for PUBLIC.

## Failure recovery

| Symptom | Meaning | Action |
|---|---|---|
| `password authentication failed for user "crm_app"` (or another role) | Bootstrap has not run on this cluster, or the URL's password differs from the last bootstrap | Run bootstrap with the same passwords as the URLs, or fix the URL |
| `permission denied for table <name>` (`42501`) in the app log | A code path uses a privilege that was never measured | Do not grant by hand. Add the path to the operation set (a test), measure, and add the grant to a migration and to `privileges.ts` in a reviewed PR |
| `must be owner of table <name>` during `pnpm db:migrate` | The database was created before the roles (a Phase 0 volume) | Dev: `down -v` as above. Never run migrations as the admin |
| `pnpm stack:up` fails with `service "bootstrap" didn't complete successfully` | Bootstrap exited non-zero; `docker compose -f docker/compose.dev.yml logs bootstrap` shows the reason (variable names only) | Fix the variable or the admin URL and rerun |
