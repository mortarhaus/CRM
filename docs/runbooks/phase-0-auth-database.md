# Runbook: Phase 0 auth and database

Scope: the Phase 0 PR 2 slice (env validation, Postgres client, Better Auth, auth schema and the
migration runner) and the Phase 0 PR 3 slice (health check, sign-up and sign-in, 2FA, workspaces).
Unfinished Phase 0 steps (worker stub, Docker image, entrypoint, CI image job) are in
[the Phase 0 plan](../superpowers/plans/2026-09-29-phase-0-foundation.md), Tasks 15-17.

**Do not deploy Phase 0 anywhere reachable from outside.** It is a local or private staging slice
only, until Phase 1 lands: persistent, database-backed auth rate limits (AUTH-06; today Better Auth's
limiter is in memory per process), the five DB roles with RLS, and the `action()` wrapper.

"Verified" below means the command was run on 2026-10-13 against the dev compose Postgres.

## Required environment

All values live in one `.env` at the repo root (git-ignored). Copy `.env.example` and set every value.
`apps/web/next.config.ts` loads that file for `pnpm dev`; nothing needs exporting in the shell. A
variable already set in the shell wins over the file. A change to `.env` needs a dev server restart.
`apps/web/src/lib/env.ts` validates the values on first use (today: the first request to
`/api/auth/*`, `/`, `/workspaces` or `/settings/security`, or the first form submit), not at process start or during
`next build`, and fails with the variable names only, never the values.

`pnpm build` needs no runtime values: CI builds without a `.env`. Pages that read the session call
`headers()` before auth starts (`apps/web/src/lib/auth/session.ts`), so `next build` renders them at
request time instead of prerendering them; `apps/web/src/lib/auth/session.test.ts` fails if auth runs
first. To build like CI locally, move the root `.env` aside, run
`env -i PATH="$PATH" HOME="$HOME" pnpm --filter @crm/web build`, then move it back (verified
2026-10-14: exit 0; `/`, `/sign-in`, `/workspaces`, `/settings/security` and the API routes are dynamic,
`/sign-up` and `/two-factor` are static).

| Variable | Rule |
|---|---|
| `DEPLOYMENT_MODE` | `saas` or `selfhost` |
| `APP_URL` | Public URL of the web app (Better Auth base URL). Must be `https://` when `NODE_ENV=production`; only `localhost`, `127.0.0.1` and `[::1]` may use `http://` |
| `AUTH_SECRET` | At least 32 characters |
| `DATABASE_URL` | `postgres://` or `postgresql://` URL used by the app |
| `DATABASE_MIGRATOR_URL` | `postgres://` or `postgresql://` URL used only by migrations; must be a direct connection |

`NODE_ENV` is read only for the `APP_URL` rule above.

## AUTH_SECRET

- Generate: `openssl rand -base64 32` (44 characters). Put it in `.env` locally, or in the host's
  secret store in any shared environment. Never commit it, paste it into tickets, or log it.
- Rotation: do not rotate in Phase 0. Verified in the installed better-auth 1.7.6 source: the session
  cookie is signed with this secret (a new secret signs every user out), and TOTP secrets are
  encrypted with it (a plain replacement makes enrolled 2FA unusable). Better Auth has a versioned
  multi-secret option for rotation; it is not configured here and the procedure is unverified.

## Database URLs: direct vs pooled

- `DATABASE_MIGRATOR_URL` must point straight at Postgres, never at a pooler. The runner holds a
  session-level advisory lock (`apps/web/src/db/migrate.ts`), which a transaction-mode pooler breaks.
- `DATABASE_URL` may go through a transaction-mode pooler from Phase 1. The app client always uses
  `prepare: false` (`apps/web/src/db/client.ts`), so no setting is needed for that.
- Phase 0 uses one dev user for both URLs; Phase 1 splits them into `crm_app` and `crm_migrator`.

## Local startup and migrations

Run from the repo root (Node 24.21.0, pnpm 11.6.0).

| Step | Command | Status |
|---|---|---|
| Start Postgres 17 on `127.0.0.1:5433` | `pnpm stack:up` | Verified |
| Apply migrations | `pnpm db:migrate` | Verified; prints `{"level":"info","msg":"migrations applied"}` |
| Check applied migrations | `docker exec crm-dev-postgres-1 psql -U crm -d crm -c 'select id, hash, created_at from drizzle.__drizzle_migrations order by id'` | Verified; one row per file in `apps/web/drizzle/` (today: `0000_auth_baseline.sql`) |
| Start the app | `pnpm dev` | Verified; reads the root `.env`, no exported variables needed |
| Auth route answers | `curl -s http://localhost:3000/api/auth/ok` | Verified; returns `{"ok":true}` |
| Smoke check: start with only the root `.env` | `pnpm smoke:auth-route` | Verified; prints `PASS: GET /api/auth/ok -> 200 {"ok":true} ...`. It starts `pnpm dev` on a free port with `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `DATABASE_MIGRATOR_URL`, `DEPLOYMENT_MODE` and `NODE_ENV` removed from its environment, then stops it. Not in CI yet (plan Task 17) |
| Stop Postgres | `pnpm stack:down` | Not run |

Migrations are additive. `pnpm db:migrate` is safe to repeat: applied files are skipped.

## Health check, sign-in, 2FA and workspaces (Phase 0 PR 3)

- `GET /api/health` is unauthenticated. It answers `200 {"status":"ok","db":"ok"}` when the database
  answers within 2 seconds, otherwise `503 {"status":"error","db":"error"}`. It always sends
  `Cache-Control: no-store` and never shows the database error text. Verified with the dev Postgres up and stopped.
- Pages: `/sign-up`, `/sign-in`, `/two-factor` (code step of a 2FA sign-in), `/workspaces` and
  `/settings/security` (2FA enrolment). The last two need a session; the `(app)` layout redirects to `/sign-in` without one.
- 2FA enrolment: the user enters the password, adds the setup key to an authenticator app, and confirms
  with a 6-digit code. A wrong code leaves 2FA off. Recovery codes are shown once; the page does not store or log them.
  The TOTP secret and URI never appear in a URL or in logs.
- Better Auth 1.7.6 defaults, not set in our config: 5 attempts per 2FA challenge, then the user must sign in
  again; 10 consecutive failures lock the account for 900 seconds. Today the `/two-factor` page shows
  "That code didn't work" for these cases without telling the user to sign in again (follow-up).
- Switching to a workspace the user is not a member of is refused with `403`; the session keeps its
  previous active workspace.
- Limits (owner decision 2026-10-14): a password has 15 to 128 characters and no composition rules; a
  user name at most 100 characters; a workspace name at most 80. The values live only in
  `packages/core/src/security/limits.ts`; the forms read them from there and changing one needs a reviewed PR.
  The server enforces them in a Better Auth `before` hook (`apps/web/src/lib/auth/input-limits.ts`) on
  sign-up, password change and reset, user rename, and workspace create and rename, for the app and for
  direct `POST /api/auth/*` requests alike. Refusals are `400` with the code `PASSWORD_TOO_SHORT`,
  `PASSWORD_TOO_LONG`, `NAME_TOO_LONG` or `WORKSPACE_NAME_TOO_LONG`, and are the same whether or not
  the email already has an account. Characters are counted as Unicode code points (an emoji counts
  once). Better Auth's own check counts UTF-16 units, so its maximum is set to 256 units to keep it from
  refusing a 128-character password; the hook is the real limit. The minimum applies when a password is
  set, not at sign-in, so an older dev account with a shorter password can still sign in.
- Unicode (owner decision 2026-10-14): passwords are normalized to NFC before they are counted, hashed
  and verified (`normalizePassword` in `packages/core/src/password/index.ts`, used by `hashPassword` and
  `verifyPassword`, so any later password change or reset path gets it too). A password typed with a
  decomposed accent ("e" + U+0301) matches the same password typed with a composed one ("é"). NFC does
  not fold compatibility look-alikes: a full-width "Ａ" or the "ﬁ" ligature stays a different password.
  Hashes stored before this change were made from the raw string; an older dev account whose password
  had a decomposed character must set it again (no such production data exists).
- Forms without JavaScript (owner decision 2026-10-14, FE-31/32): sign-up, sign-in, both `/two-factor` forms
  (authenticator code and recovery code) and workspace creation are HTML forms posting to Next server actions
  (`actions.ts` next to each form). With JavaScript on, React submits them in place and shows the pending
  state; with it off, the browser posts the form and the server renders the result (the same messages,
  names and emails kept, never a password or code). Codes and passwords travel only in POST bodies, never in
  a URL. Each action posts to Better Auth's own HTTP handler (`apps/web/src/lib/auth/forward.ts`), forwarding
  the cookies, `Origin`, `Referer`, Fetch Metadata and `X-Forwarded-For`, so the rate limiter (production
  only), origin and CSRF checks and input limits of `/api/auth/*` apply to the form path too; the cookies
  Better Auth sets (session, 2FA) are copied onto the response with their flags. Workspace creation checks
  the session itself before calling Better Auth (AUTH-02). If the server cannot be reached while JavaScript
  is on, `apps/web/src/app/error.tsx` shows "Something went wrong" with a "Try again" button. Still needing
  JavaScript (follow-up): the 2FA enrolment on `/settings/security`, the workspace switcher and sign-out.
  Next encrypts server action ids per build; a deployment with several app instances needs the same
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on all of them (not needed for one instance; not set today).
- Testing with JavaScript off: `e2e/no-javascript.spec.ts` runs with `javaScriptEnabled: false` and covers
  sign-up (success, server refusal, and a crafted post with a 14-character password), sign-in (success,
  cookie flags, wrong password), the 2FA code and recovery-code forms (wrong and right, no code or secret in
  any requested URL) and workspace creation (success, blank name, 80 characters, a crafted 81-character
  post, and a crafted post without a session). By hand: in Chrome DevTools open the command menu
  (Cmd+Shift+P), run "Disable JavaScript", and reload.
- End-to-end tests: `pnpm test:e2e` (Playwright 1.63.0, Chrome for Testing 153.0.8010.12). It starts its own dev server
  and needs the dev Postgres from `pnpm stack:up` and a root `.env`. Every spec runs at three widths (Playwright projects
  `chromium` 1280x720, `tablet-768` 768x1024, `mobile-320` 320x640). `e2e/accessibility.spec.ts` runs an axe-core 4.13.0
  scan (WCAG 2.0-2.2 A and AA tags, including `color-contrast`) of each auth, 2FA and workspace state in light and dark,
  checks for horizontal overflow, and walks the sign-up, 2FA enrolment, workspace switch and sign-out paths by keyboard.
  If port 3000 is taken, start `APP_URL=http://localhost:<port> pnpm --filter @crm/web exec next dev -p <port>` and run
  the tests with `E2E_BASE_URL=http://localhost:<port>`. Verified 2026-10-14 (that way, port 3100): 45 passed. It is not in CI yet (plan Task 17).

## Safe public-origin settings

- Production `APP_URL` must be the public `https://` origin. Otherwise the process still starts,
  but the first request to `/api/auth/*` fails with 500 and the log line
  `APP_URL: must be an https:// URL in production ...`; no auth request succeeds. (First-use
  failure verified under `pnpm dev` with an invalid `AUTH_SECRET`; the production `APP_URL` case
  uses the same check and was not run.)
- Auth cookies are always `HttpOnly` and `SameSite=Lax`. They are `Secure` (with the `__Secure-`
  prefix) for every non-loopback origin; only loopback `http://` dev gets non-Secure cookies.
- Terminate TLS in front of the app. Do not serve a public host over plain HTTP.

## Expiry of reset and invitation links

- Workspace invitations expire 30 minutes after they are created or resent (spec "Authentication and
  sessions"). The value is `INVITATION_EXPIRY_SECONDS` in `packages/core/src/security/limits.ts`, the one
  place for fixed security values (DECISIONS 2026-10-13); changing it needs a reviewed PR.
- Password reset is not enabled in Phase 0. When it is, set `emailAndPassword.resetPasswordTokenExpiresIn`
  to the spec's 30 minutes (in seconds); the better-auth 1.7.6 default is 1 hour.

## Failure recovery

| Symptom | Meaning | Action |
|---|---|---|
| `Invalid environment configuration:` then lines like `DATABASE_MIGRATOR_URL: must be a postgres:// URL` | A variable is missing or invalid; only its name is printed. Under `pnpm dev` it shows on the first `/api/auth/*` or signed-in page request, which returns 500. If it shows during `pnpm build`, a page started auth before reading `headers()` (see "Required environment") | Fix that variable in `.env` (compare with `.env.example`), check it is not overridden by an exported shell variable, and restart |
| `connect ECONNREFUSED 127.0.0.1:5433` | Postgres is not running or the port is wrong | `pnpm stack:up`, then rerun |
| `password authentication failed for user "crm"` | Wrong credentials in the URL | Fix the URL in `.env` |
| `pnpm db:migrate` hangs with no output | Another runner holds the migration lock; this one waits without a timeout | Find the holder: `docker exec crm-dev-postgres-1 psql -U crm -d crm -c "select l.pid, l.granted, a.state, a.query_start from pg_locks l join pg_stat_activity a using (pid) where l.locktype = 'advisory'"` (verified). Wait for it to finish. If the holder is a dead session, end it with `select pg_terminate_backend(<pid>)` (unverified) and rerun |
| A migration fails with a SQL error | Drizzle runs all pending files in one transaction (verified in drizzle-orm 0.45.3 source), so nothing from the run is applied and no row is added to `drizzle.__drizzle_migrations` | Fix the migration in a new PR, then rerun. Never edit an applied migration file |

A failed `pnpm db:migrate` exits non-zero.
