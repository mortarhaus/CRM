# Runbook: Phase 1 security (rate limits, client IP, Better Auth surface, security headers)

Scope: Phase 1 PR 7 (plan `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`, Tasks 21-24):
database-backed rate limits, the trusted client IP, the per-account sign-in failure cap, the uniform 429, the
Phase 1 Better Auth paths, password change (AUTH-07) and the two daily cleanup jobs. Better Auth 1.7.14.
PR 8 adds the security headers (Task 25) and the email sections (Tasks 26-27).

"Verified" means the test named was run on 2026-11-01 against a Testcontainers Postgres 17 and, where it says so,
two `next start` processes behind a test edge (`apps/web/src/lib/auth/rate-limit.test.ts`).

## Limits

The numbers live in `packages/core/src/security/limits.ts`; `apps/web/src/lib/auth/rate-limit-rules.ts` maps
Better Auth's paths onto them. Counters are rows in `rate_limit` (system table), shared by every web process and
kept across restarts (AUTH-06). A window is fixed: it starts at the first counted request and the count resets
when it ends.

| Row | Paths | Limit | Key |
|---|---|---|---|
| sign-in | `/sign-in/email` (route and form) | 10 per 60 s | `ba:sign-in:<ip>` |
| sign-in account | `/sign-in/email`, failures only | 5 per 900 s | `acct:signin:<HMAC of the email>` |
| sign-up | `/sign-up/email` | 10 per 3600 s | `ba:sign-up:<ip>` |
| two-factor verify | `/two-factor/verify-totp`, `/two-factor/verify-backup-code` | 10 per 60 s | `ba:two-factor-verify:<ip>` |
| password check | `/change-password`, `/two-factor/enable`, `/two-factor/disable`, `/two-factor/generate-backup-codes` | 10 per 900 s | `ba:password-check:<ip>` |
| default | every other enabled `/api/auth/*` path | 100 per 60 s | `ba:default:<ip>` |
| step-up user | `verifyStepUp` (Phase 2 PR 5a), failures only: every check takes a unit and an accepted code gives it back (as the sign-in account row); besides the two-factor verify row it also spends | 5 per 900 s | `step-up:user:<user id>` |
| step-up code | `verifyStepUp`, an accepted code | 1 per 120 s | `step-up:code:<user id>:<HMAC of the code>` |

- `<ip>` is the trusted client IP (next section); an IPv6 address is keyed by its /64.
- Paths of one row share one counter per IP (a TOTP guess and a recovery-code guess spend the same budget).
- **Account cap.** Every sign-in spends a unit on its email's key before Better Auth runs; a 2xx gives it back,
  so only failures count, for an email with an account and one without alike (AUTH-05). The email is
  normalised (trimmed, lower-cased) and the key is an HMAC (key from `AUTH_SECRET` by HKDF, info
  `crm:rate-limit-key:v1`), so `rate_limit` stores no email.
- **Sign-in bodies.** A sign-in whose `Content-Type` is not JSON answers 415 before anything is counted (Better
  Auth would answer 415 too). A JSON-typed body the handler cannot read an email from (malformed JSON, no email,
  a non-string email) spends a unit on one shared key, `acct:signin:unreadable`.
- **2FA lockout** (Better Auth's own, on top of the row): 5 wrong codes per challenge, and 10 failures lock 2FA for
  900 s. It applies to the sign-in challenge only; a step-up check (signed in) is limited by the step-up user row
  instead (next section).
- **Every 429** has the same body, `{"message":"Too many requests. Please try again later."}`, and the headers
  `Retry-After` and `X-Retry-After` in seconds (60 when the source gives none), whichever limit refused it.
- A granted unit is not given back when the request later fails with a 500 (a failed sign-in after a database
  error stays counted).

Verified: `rate-limit-rules.test.ts`, `request-handler.test.ts` (in process); `rate-limit.test.ts` (every row,
restart, route and form, forged headers, fallback, concurrency, for each trusted header; 25 passed, 1 skipped
by design).

## `TRUSTED_CLIENT_IP_HEADER`

The one header the app reads the client IP from. Required when `NODE_ENV=production` (the web process does not
start without it); `none` by default otherwise. The app removes `X-Forwarded-For`, `Forwarded`, `X-Real-IP`,
`CF-Connecting-IP` and `x-crm-client-ip` from every `/api/auth/*` request and every auth form submit, then sets
`x-crm-client-ip` to the derived IP, so a header the caller sends never reaches Better Auth.

| Deployment | Value | The edge must |
|---|---|---|
| SaaS, behind the Cloudflare Tunnel | `cf-connecting-ip` | be the only way in: the web container is not reachable except through the Tunnel |
| Self-host, behind Caddy | `x-forwarded-for` | **overwrite** (not append) `X-Forwarded-For` with the peer address, and strip `Forwarded`, `X-Real-IP` and `CF-Connecting-IP`; the web container is reachable only through Caddy |
| Local dev compose (`docker/compose.dev.yml`) and E2E | `x-forwarded-for` | nothing: the port is bound to 127.0.0.1 and each E2E test sends its own address (`apps/web/e2e/fixtures.ts`) |
| `pnpm dev` and unit tests without a setting | `none` | - |

A Caddy block for self-host:

```
reverse_proxy web:3000 {
  header_up X-Forwarded-For {remote_host}
  header_up -Forwarded
  header_up -X-Real-IP
  header_up -CF-Connecting-IP
}
```

The header must hold **exactly one** valid address. A list (`a, b`), a malformed value, a missing header or
`none` gives the placeholder `192.0.2.1` (TEST-NET-1), shared by every such request: the IP limits then hold
for the whole deployment at once (fail closed), and the process logs `{"level":"warn","msg":"client ip fallback"}`.

**Next.js fills a missing `X-Forwarded-For`.** Next 16.4.x (checked on 16.4.6) sets `X-Forwarded-For` to the socket peer when the
request has none (`next/dist/server/base-server.js:604`). With `x-forwarded-for` configured and an edge that
does not set it, the key is the **edge's** address, not the placeholder, and no warning is logged: every client
shares the edge's counters. Checked in `rate-limit.test.ts` (the key is 127.0.0.1 there).

### What a fallback warning means

`client ip fallback` in the web log means a request reached the app without one valid address in the configured
header. In production that is a misconfigured edge (appending instead of overwriting, a second proxy in the
chain, the header renamed) or a request that bypassed the edge. Every such request shares one budget, so real
users start to see 429s together. Fix the edge; do not switch to `none`.

## Rotating `AUTH_SECRET`

Besides signing every user out, a new `AUTH_SECRET` changes the HMAC key of the per-account counters, so every
account's failure count starts again at 0 (the old rows expire and the daily cleanup removes them). The same holds
for the step-up used-code markers (key info `crm step-up code v1`): a code accepted in the 120 s before the rotation
could be used once more, by a user who must sign in again anyway. The IP counters are not affected.

## Step-up and `require_2fa` (Phase 2 PR 5a)

- **Step-up** (spec "Authorization", AUTH-09): a high-risk action calls `requireStepUp(tx, session)`
  (`apps/web/src/lib/auth/step-up.ts`), which refuses `STEP_UP_REQUIRED` unless this session passed a TOTP check in
  this workspace in the last 300 s (`STEP_UP_WINDOW_SECONDS`). `verifyStepUp` posts the code to
  `/two-factor/verify-totp` with the user's session (it issues no new session) and records the check in the tenant
  table `step_up` (one row per workspace and session; rows of ended sessions stay until a later retention sweep).
  A user without 2FA gets `TWO_FACTOR_REQUIRED` and enrols at `/settings/security`. An accepted code is refused
  for any later step-up of the same user for 120 s (`STEP_UP_CODE_REUSE_SECONDS`). A Better Auth 5xx is an error, not
  `WRONG_CODE`, and keeps its unit spent. The prompt is on `/settings/payment` (PR 5b), above the bank details and QR
  forms, which are Owner only and need step-up.
- **`require_2fa`** (per workspace, default false): when true, an Admin or Owner without 2FA is refused
  `TWO_FACTOR_REQUIRED` by every action and admin settings page, and the pages send them to `/settings/security`.
  Staff are not affected, and nobody is signed out: the check runs on each request. No page sets the flag yet
  (Charlie 2026-11-22: only the Owner may switch it on, with step-up; the toggle is a later PR).

## Better Auth paths

Only the paths in `apps/web/src/lib/auth/enabled-paths.ts` answer over HTTP: sign-up, sign-in, sign-out, session
reads and revocation, change-password, update-user, the 2FA paths used by the pages (enable, disable, verify-totp,
verify-backup-code, generate-backup-codes), organization create, update, set-active and list, and `/ok`
(liveness, no data). Every other path, including every invitation and member path, `/two-factor/get-totp-uri`
and `/two-factor/verify-otp`, answers 404 with the same body for GET and POST. A Better Auth upgrade that adds a
path fails `enabled-paths.test.ts` until the path is classified.

Better Auth's origin and CSRF checks are pinned on (`advanced.disableOriginCheck: false`): Better Auth 1.7.14
turns them off when `NODE_ENV=test` or `TEST` is set, which must never decide production behaviour.

### Password change (AUTH-07)

`/change-password` refuses (400, `REVOKE_OTHER_SESSIONS_REQUIRED`) unless the body sends
`revokeOtherSessions: true`; with it, Better Auth deletes every session of the user and issues the caller a new
one. Changing a password therefore signs the user out everywhere else.

To end one chosen session of a user (for example after a lost device), the server function
`revokeMySession(sessionId)` (`apps/web/src/lib/auth/session.ts`) deletes that session if it belongs to the
signed-in user. Phase 1 has no page for it yet.

## Cleanup jobs

The worker schedules both at start (`apps/web/src/worker/start.ts`), daily, UTC. Neither has an HTTP trigger.

| Queue | Cron (UTC) | What it deletes |
|---|---|---|
| `rate_limit.cleanup` | `17 3 * * *` | `rate_limit` rows whose window ended more than 24 hours ago |
| `idempotency.cleanup` | `47 3 * * *` | expired `idempotency_key` rows, one workspace at a time under RLS |

To check the schedules: `select name, cron from pgboss.schedule;` as `crm_migrator`. Each run logs one line
from the worker with the number of rows it deleted; a failed run is retried like any job.

## Security headers (PR 8, Task 25)

The app sets every security header itself; the edge adds none.

| Header | Value | Set by | On |
|---|---|---|---|
| `Content-Security-Policy` (pages) | `buildCsp(nonce)` in `apps/web/src/lib/security-headers.ts`: `script-src` and `style-src` allow `'self'` and the request's nonce, `frame-ancestors 'none'`, no `'unsafe-inline'` | `apps/web/src/proxy.ts`, a new nonce per request | every path except `/api/*`, `/_next/static/*`, `/_next/image*`, `/favicon.ico` and prefetches |
| `Content-Security-Policy` (API) | `default-src 'none'; frame-ancestors 'none'` | `next.config.ts` `headers()` | `/api/*` |
| `Strict-Transport-Security` | `max-age=31536000` (no `includeSubDomains`, no `preload`; Charlie, ASK 6 option A) | `next.config.ts` | every response |
| `X-Content-Type-Options` | `nosniff` | `next.config.ts` | every response |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `next.config.ts` | every response |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | `next.config.ts` | every response |

- In development (`pnpm dev`) the page CSP also allows `'unsafe-eval'` for scripts and `'unsafe-inline'` (no nonce)
  for styles, which React's dev tooling needs. Production has neither.
- Every page renders per request (the root layout calls `connection()`): a nonce cannot be put into a prerendered
  page, so no page can be served from a CDN cache.
- **The edge must not add or rewrite these headers.** On Cloudflare, leave HSTS (SSL/TLS → Edge Certificates) off
  and add no rule that sets a CSP; on Caddy, the `reverse_proxy` block above has no `header` directive. A second
  CSP from the edge would be enforced alongside the app's, and a second HSTS value would make the effective one
  unclear.
- **HSTS:** browsers ignore it over plain HTTP, so local `http://localhost` is unaffected. Adding
  `includeSubDomains` or `preload` later is the owner's call: `includeSubDomains` forces HTTPS on every other
  subdomain of the domain, and preload is hard to undo.
- Session cookie (UNI-18): `HttpOnly` and `SameSite=Lax` always; `Secure` for an https or non-loopback `APP_URL`
  (`useSecureCookies` in `apps/web/src/lib/auth/config.ts`).

Verified: `security-headers.test.ts` (the policy strings and the header table); `e2e/security-headers.spec.ts` (the
nonce differs per load and is on every `<script>`; no CSP violation through sign-in, 2FA enrolment and workspace
switching; `/api/health`'s policy; the cookie flags).

## Email (PR 8, Task 26)

Only the worker sends email; the web app queues an `email.send` job. The four settings go to the **worker
container only**. The web container must not get them, and `RESEND_API_KEY` above all: the worker schema
(`parseWorkerEnv`, `apps/web/src/lib/env.ts`) requires them, while the web schema neither needs nor keeps them.

| Variable | Value | When |
|---|---|---|
| `EMAIL_PROVIDER` | `smtp` or `resend` | always |
| `EMAIL_FROM` | a display name and one address, `Name <address>` | always. Dev: `CRM Dev <dev@localhost>`. Production (SaaS): `CRM <no-reply@mortarhaus.com>` (address: DECISIONS 2026-11-15, ASK 7; display name `CRM`: DECISIONS 2026-11-20) |
| `SMTP_URL` | `smtp://` or `smtps://` URL, credentials in the URL if the server needs them | `EMAIL_PROVIDER=smtp` |
| `RESEND_API_KEY` | the Resend API key | `EMAIL_PROVIDER=resend` |

A missing or invalid setting stops the worker container at start (the entrypoint's environment check) with the
variable's name, never its value. A failed send throws `EmailSendError`, whose message is the provider and its
status only (SMTP reply code, HTTP status or a short code such as `network`), never the address or the key; the
job is retried and then dead-lettered like any job (`jobs:retry`, `phase-1-database-roles.md`). `jobs:retry`
reads only `DATABASE_WORKER_URL`, so it needs no email setting.

- **Dev:** `docker/compose.dev.yml` sets the three SMTP settings on the `worker` service and runs Mailpit
  (`axllent/mailpit`, pinned by tag and digest). Every message the worker sends is caught there: UI and API on
  http://localhost:8025, SMTP on `127.0.0.1:1025`. For `pnpm worker:dev` on the host, uncomment the email lines in
  `.env` (`SMTP_URL=smtp://localhost:1025`). The root `.env` is the `env_file` of every app container, web
  included, so under compose it holds no email setting, and it never holds `RESEND_API_KEY`.
- **Switching provider:** set `EMAIL_PROVIDER` and the matching `SMTP_URL` or `RESEND_API_KEY` in the worker's
  environment, then restart `worker`. Jobs still queued are sent by the new provider.
- **Rotating `RESEND_API_KEY`:** create a new key in Resend, put it in the host's secret store for the worker
  (UNI-08; never in `.env` or the repository), restart `worker`, send a test email, then revoke the old key in
  Resend.
- **Sending domain (production):** the provider is Resend and the sender is `CRM <no-reply@mortarhaus.com>`; DNS is
  on Cloudflare and Charlie sets the SPF, DKIM and DMARC records for `mortarhaus.com` (DECISIONS 2026-11-15, ASK 7).
  **Gate:** do not set `EMAIL_PROVIDER=resend` in production, and do not send a real message, until those three
  records exist and Resend shows the domain as verified. Still pending: the exact record values
  (Resend gives them when the domain is added; the Phase 2 notification-email PR lists them here).
- **Owner email on a bank-details or payment QR change** (Phase 2 PR 5c, plan Task 16): the payment settings action
  enqueues one `email.bank_details_changed` job per Owner in the change's transaction (migration 0032 creates the
  queue and `email.bank_details_changed.dead`; retries 5, first delay 30 s, backoff, as `email.send`). Job data is
  `{ workspaceId, changeId, userId }` (the change is its audit entry; no bank value, name or address), and the job id
  is derived from the change and the Owner, so the same change never makes two jobs for one Owner. The worker reads
  the names and the address when it sends, so it needs no new setting. A recipient who is no longer an Owner, or has
  no address, is skipped: the job completes and the worker logs `{"level":"info","msg":"owner email skipped",
  "queue":"email.bank_details_changed","reason":"not_owner"|"no_address"|"no_workspace"}` (no id, no address). A
  change it cannot find fails the job (retries, then the dead-letter queue; redrive with `jobs:retry -- --queue
  email.bank_details_changed --id <dead-letter job id>`). Wording (Charlie, Q18, 2026-11-22): subject "Payment
  details changed on {{workspace_name}}"; the body names the change time in the workspace's time zone and date
  format, who made it and what kind changed (bank details and/or the DuitNow/PayNow QR), and never shows an account
  number, the holder name or the QR. The text lives in one place, the `payment_details_changed` default in
  `packages/core/src/templates/events.ts` (event 8 of the email templates); the worker renders it with
  `apps/web/src/emails/bank-details-changed.tsx` and still sends this Q18 copy. A workspace's saved event 8 template
  (edited on `/settings/templates`, "Payment details changed (to the owner)") is not read by the worker (no sender
  reads saved templates in Phase 2): an owner who edits it there still receives the Q18 copy. The page says so
  in its intro (`TEMPLATES_INTRO` in `apps/web/src/lib/auth/messages.ts`).
- **Test email wording** (Charlie, ASK 8 = A, 2026-11-01): subject "Test email from CRM", body "This is a test
  email sent from your CRM workspace settings. If you received it, email delivery works."
  (`apps/web/src/emails/test-email.tsx`).
- **Test email limit** (review P2-1, 2026-11-01): 5 per user and 20 per workspace per hour (`TEST_EMAIL_USER_LIMIT`,
  `TEST_EMAIL_WORKSPACE_LIMIT`), counted in `rate_limit` under `email-test:user:<user id>` and
  `email-test:ws:<workspace id>`; to let a user send again before the hour ends, delete that user's row.

Verified: `apps/web/src/adapters/email/contract.test.ts` runs the same cases against both adapters: SMTP against a
Mailpit Testcontainer, Resend against a local stand-in server (no test calls the real Resend API, UNI-11).

## Commands

| What | Command | Result |
|---|---|---|
| Rate-limit and surface tests | `pnpm vitest run apps/web/src/lib/auth/rate-limit.test.ts apps/web/src/lib/auth/enabled-paths.test.ts` | Verified 2026-11-01 (part of `pnpm test`) |
| Cleanup jobs | `pnpm vitest run apps/web/src/jobs/cleanup.test.ts` | Verified 2026-11-01 |
| Header unit test | `pnpm vitest run apps/web/src/lib/security-headers.test.ts` | Verified 2026-11-01 |
| Header E2E | `pnpm test:e2e e2e/security-headers.spec.ts` (from `apps/web`) | Verified 2026-11-01 against `next start` and `next dev` on a Testcontainers database (9 passed each) |
| Email adapter contract | `pnpm vitest run apps/web/src/adapters` (Docker running: Mailpit Testcontainer) | Verified 2026-11-01 (5 passed) |
