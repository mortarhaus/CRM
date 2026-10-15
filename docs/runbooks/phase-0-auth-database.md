# Runbook: Phase 0 auth and database

Scope: the Phase 0 PR 2 slice (env validation, Postgres client, Better Auth, auth schema and the
migration runner), the Phase 0 PR 3 slice (health check, sign-up and sign-in, 2FA, workspaces) and the
Phase 0 PR 4 slice (worker stub, Docker image and entrypoint, dev compose stack, CI image job; plan
Tasks 15-17, see "Docker image and compose stack" below).

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
| Start Postgres 17 on `127.0.0.1:5433` | `docker compose -f docker/compose.dev.yml up -d --wait postgres` | Verified. `pnpm stack:up` now also builds and starts `web` (port 3000) and `worker`; use it only when you want the image, not with `pnpm dev` |
| Apply migrations | `pnpm db:migrate` | Verified; prints `{"level":"info","msg":"migrations applied"}` |
| Check applied migrations | `docker exec crm-dev-postgres-1 psql -U crm -d crm -c 'select id, hash, created_at from drizzle.__drizzle_migrations order by id'` | Verified; one row per file in `apps/web/drizzle/` (today: `0000_auth_baseline.sql`) |
| Start the app | `pnpm dev` | Verified; reads the root `.env`, no exported variables needed |
| Auth route answers | `curl -s http://localhost:3000/api/auth/ok` | Verified; returns `{"ok":true}` |
| Smoke check: start with only the root `.env` | `pnpm smoke:auth-route` | Verified; prints `PASS: GET /api/auth/ok -> 200 {"ok":true} ...`. It starts `pnpm dev` on a free port with `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `DATABASE_MIGRATOR_URL`, `DEPLOYMENT_MODE` and `NODE_ENV` removed from its environment, then stops it. In CI it runs in the `image` job, which has a root `.env` (the `checks` job has none) |
| Stop the compose stack (keeps the data volume) | `pnpm stack:down` | Verified 2026-10-15 |

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
  again; 10 consecutive failures lock the account for 900 seconds. When the challenge has ended (Better Auth
  answers `INVALID_TWO_FACTOR_COOKIE` for a missing, expired or used challenge cookie, and
  `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE` once its attempts ran out), `/two-factor` sends the user to
  `/sign-in?expired=1`, which says "Your sign-in expired or had too many tries. Sign in again to continue."
  (a redirect, so it works without JavaScript). The account lock (`ACCOUNT_TEMPORARILY_LOCKED`, 429) shows
  "Too many attempts. Wait a moment and try again." A wrong code or recovery code keeps its own message.
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
- Forms without JavaScript (owner decisions 2026-10-14, FE-31/32): sign-up, sign-in, both `/two-factor` forms
  (authenticator code and recovery code), workspace creation, the 2FA enrolment on `/settings/security`
  (password, then the code), the workspace switcher and sign-out are HTML forms posting to Next server actions
  (`actions.ts` next to each form; the switcher and sign-out use `apps/web/src/app/(app)/actions.ts`). With JavaScript on, React submits them in place and shows the pending
  state; with it off, the browser posts the form and the server renders the result (the same messages,
  names and emails kept, never a password or code). Codes and passwords travel only in POST bodies, never in
  a URL. Each action posts to Better Auth's own HTTP handler (`apps/web/src/lib/auth/forward.ts`), forwarding
  the cookies, `Origin`, `Referer`, Fetch Metadata and `X-Forwarded-For`, so the rate limiter (production
  only), origin and CSRF checks and input limits of `/api/auth/*` apply to the form path too; the cookies
  Better Auth sets (session, 2FA) are copied onto the response with their flags. Workspace creation, 2FA
  enrolment, the switcher and sign-out check the session themselves before calling Better Auth (AUTH-02); a
  post without one is sent to `/sign-in`. If the server cannot be reached while JavaScript is on,
  `apps/web/src/app/error.tsx` shows "Something went wrong" with a "Try again" button; the switcher and
  sign-out instead stay in the header and show their own message ("Couldn't switch workspace. Try again.",
  "We couldn't sign you out. Try again.", AUTH-13) with focus back on the select or button
  (`apps/web/src/components/submit-failure-boundary.tsx`).
  - 2FA enrolment: the setup key, link and recovery codes come back from the password step. The code form
    posts the link and recovery codes back (POST body only) so a wrong code can show them again without
    JavaScript; they are only displayed, and Better Auth checks the code against the secret it stored. A
    right code reloads `/settings/security` with the new session cookie. There is no "turn off 2FA" control
    yet, so none was converted.
  - Workspace switcher: a native `<select>` and a visible "Switch" button. With JavaScript a change submits at
    once; the select keeps focus and nothing is disabled while it switches (A11Y-01). A blank id or an id that is not a
    uuid is refused before Better Auth is asked (a malformed id would otherwise reach its uuid lookup and give a 500). Better Auth 1.7.6 refuses a workspace the user is not a member of and then
    clears the session's active workspace; the page refreshes and shows "Choose a workspace".
  - Sign-out: posts to the server, which goes to `/sign-in` only after Better Auth confirms the sign-out.
  Next encrypts server action ids per build; a deployment with several app instances needs the same
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on all of them (not needed for one instance; not set today).
- Testing with JavaScript off: `e2e/no-javascript.spec.ts` runs with `javaScriptEnabled: false` and covers
  sign-up (success, server refusal, and a crafted post with a 14-character password), sign-in (success,
  cookie flags, wrong password), the 2FA code and recovery-code forms (wrong and right, no code or secret in
  any requested URL; a challenge whose cookie is gone goes to `/sign-in?expired=1`), workspace creation (success, blank name, 80 characters, a crafted 81-character
  post, and a crafted post without a session), 2FA enrolment (wrong password, wrong code with the setup
  key and recovery codes shown again, right code, then sign-in asks for a code; no password, secret or code
  in any requested URL; a post without a session), the workspace switcher (Switch button by mouse and by
  keyboard, a blank id, a workspace the user is not a member of, a post without a session) and sign-out
  (by keyboard; the server session ends). axe cannot run with JavaScript off; `e2e/accessibility.spec.ts`
  scans the same states with it on. By hand: in Chrome DevTools open the command menu
  (Cmd+Shift+P), run "Disable JavaScript", and reload.
- End-to-end tests: `pnpm test:e2e` (Playwright 1.63.0, Chrome for Testing 153.0.8010.12). It starts its own dev server
  and needs the dev Postgres (`docker compose -f docker/compose.dev.yml up -d --wait postgres`) and a root `.env`. Every spec runs at three widths (Playwright projects
  `chromium` 1280x720, `tablet-768` 768x1024, `mobile-320` 320x640). `e2e/accessibility.spec.ts` runs an axe-core 4.13.0
  scan (WCAG 2.0-2.2 A and AA tags, including `color-contrast`) of each auth, 2FA and workspace state in light and dark,
  checks for horizontal overflow, and walks the sign-up, 2FA enrolment, workspace switch and sign-out paths by keyboard.
  If port 3000 is taken, start `APP_URL=http://localhost:<port> pnpm --filter @crm/web exec next dev -p <port>` and run
  the tests with `E2E_BASE_URL=http://localhost:<port>`. Verified 2026-10-14 (Round 2 fixes) with `pnpm test:e2e` against `next dev` on
  port 3317: 81 passed (27 tests at three widths). The sign-out failure tests make the server action post itself fail
  (network error, HTTP 500); a refusal from Better Auth is covered by the unit tests in `src/app/form-actions.test.ts`. Also verified 2026-10-14 against `next start` of the CI-style build (port 3320,
  `E2E_RATE_LIMITED=1`): the six no-JavaScript form tests then in the spec pass, and a fourth wrong sign-in within 10 seconds shows
  "Too many attempts" with JavaScript off and on. Verified again 2026-10-14 against `next start` of a build made with
  `env -i` (port 3321, `E2E_RATE_LIMITED=1`, chromium): all 10 tests in `e2e/no-javascript.spec.ts` and the 3 in
  `e2e/sign-out.spec.ts` pass. In CI the `image` job runs the whole suite against the Docker image (below).

## Docker image and compose stack (Phase 0 PR 4)

- One image, `crm-app:dev`, built by `docker/Dockerfile` from `node:24.21.0-alpine` (pinned by digest). The
  entrypoint (`docker/entrypoint.sh`) takes `web` (migrations, then `node server.js`, the Next standalone
  server), `worker` (migrations, then `node dist/worker.mjs`) or `migrate` (migrations only). Migrations run
  from `dist/migrate.mjs` under the advisory lock, so `web` and `worker` starting together is safe: one waits,
  the other finds nothing to do. The image runs as `node` (uid 1000); compose mounts the root filesystem
  read-only with tmpfs on `/tmp` (and `.next/cache` for `web`). npm, npx, corepack and yarn are removed from
  the runtime stage.
- The worker is a stub until Phase 1 (pg-boss): it checks the database, logs
  `{"level":"info","msg":"worker ready"}`, and on SIGTERM or SIGINT logs `{"level":"info","msg":"worker stopped"}` and exits 0.
- `pnpm build` runs `next build` and then `scripts/build-node.mjs` (esbuild 0.28.2), which bundles
  `worker.ts` and `migrate.ts` into `apps/web/dist/`. `pnpm --filter @crm/web build:node` rebuilds only the
  bundles; `pnpm worker:dev` runs the worker from source with the root `.env`.
- Compose (`docker/compose.dev.yml`, project `crm-dev`) reads the root `.env` and replaces both database
  URLs with `postgres://crm:crm@postgres:5432/crm` inside the containers.

| Step | Command | Status |
|---|---|---|
| Build and start postgres, web and worker | `pnpm stack:up` | Verified 2026-10-15: postgres and web `Healthy`, worker started, both app containers log `migrations applied` |
| Health | `curl -s http://localhost:3000/api/health` | Verified; `{"status":"ok","db":"ok"}` |
| Missing root `.env` | `docker compose -f docker/compose.dev.yml up -d` | Verified; fails at once with `env file .../.env not found`, exit 1, no container starts |
| Blank `AUTH_SECRET` | (set `AUTH_SECRET=` in `.env`) `docker compose -f docker/compose.dev.yml up -d --wait web` | Verified; exit 1, `web` exits 1 logging `Invalid environment configuration:` and `AUTH_SECRET: must be at least 32 characters`; no value is logged |
| First boot on an empty database | `docker compose -f docker/compose.dev.yml down -v` then `pnpm stack:up` (`down -v` deletes the dev database) | Verified; one migration row, all eight auth tables, no restarts |
| E2E against the image | `E2E_BASE_URL=http://localhost:3000 E2E_RATE_LIMITED=1 pnpm test:e2e` | Verified 2026-10-15: 84 passed (28 tests at three widths) in 21.6 minutes; the rate-limit waits make it slow |
| Image scan | `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.74.0 image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 crm-app:dev` | Verified 2026-10-15; exit 0, no findings |

CI (`.github/workflows/ci.yml`, job `image`, after `checks`) writes a throwaway `.env` with a random
`AUTH_SECRET`, builds the image, scans it with Trivy (CRITICAL and HIGH, fixed only, blocking), starts the
stack, runs `pnpm smoke:auth-route`, and runs the full E2E suite against the image with rate limits on. On
failure it uploads the Playwright report, traces and the stack logs for 7 days.

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
| `connect ECONNREFUSED 127.0.0.1:5433` | Postgres is not running or the port is wrong | `docker compose -f docker/compose.dev.yml up -d --wait postgres`, then rerun |
| `pnpm stack:up` fails to bind port 3000 (exact message not captured) | `pnpm dev` (or another server) holds port 3000 | Stop that server, or start only Postgres (above) |
| `password authentication failed for user "crm"` | Wrong credentials in the URL | Fix the URL in `.env` |
| `pnpm db:migrate` hangs with no output | Another runner holds the migration lock; this one waits without a timeout | Find the holder: `docker exec crm-dev-postgres-1 psql -U crm -d crm -c "select l.pid, l.granted, a.state, a.query_start from pg_locks l join pg_stat_activity a using (pid) where l.locktype = 'advisory'"` (verified). Wait for it to finish. If the holder is a dead session, end it with `select pg_terminate_backend(<pid>)` (unverified) and rerun |
| A migration fails with a SQL error | Drizzle runs all pending files in one transaction (verified in drizzle-orm 0.45.3 source), so nothing from the run is applied and no row is added to `drizzle.__drizzle_migrations` | Fix the migration in a new PR, then rerun. Never edit an applied migration file |

A failed `pnpm db:migrate` exits non-zero.

The name fields (sign-up name, workspace name) have no native `maxlength`: it counts UTF-16 units while the server counts characters (code points), so it would cut valid names. The server refuses an over-limit name with a message; `e2e/name-limits.spec.ts` (JavaScript on) and a test in `e2e/no-javascript.spec.ts` check names of emoji at the limit and one over.
