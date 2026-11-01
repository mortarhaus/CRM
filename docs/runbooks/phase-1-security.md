# Runbook: Phase 1 security (rate limits, client IP, Better Auth surface)

Scope: Phase 1 PR 7 (plan `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`, Tasks 21-24):
database-backed rate limits, the trusted client IP, the per-account sign-in failure cap, the uniform 429, the
Phase 1 Better Auth paths, password change (AUTH-07) and the two daily cleanup jobs. Better Auth 1.7.14.

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
  900 s.
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

**Next.js fills a missing `X-Forwarded-For`.** Next 16.4.2 sets `X-Forwarded-For` to the socket peer when the
request has none (`next/dist/server/base-server.js:567`). With `x-forwarded-for` configured and an edge that
does not set it, the key is the **edge's** address, not the placeholder, and no warning is logged: every client
shares the edge's counters. Checked in `rate-limit.test.ts` (the key is 127.0.0.1 there).

### What a fallback warning means

`client ip fallback` in the web log means a request reached the app without one valid address in the configured
header. In production that is a misconfigured edge (appending instead of overwriting, a second proxy in the
chain, the header renamed) or a request that bypassed the edge. Every such request shares one budget, so real
users start to see 429s together. Fix the edge; do not switch to `none`.

## Rotating `AUTH_SECRET`

Besides signing every user out, a new `AUTH_SECRET` changes the HMAC key of the per-account counters, so every
account's failure count starts again at 0 (the old rows expire and the daily cleanup removes them). The IP
counters are not affected.

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

## Commands

| What | Command | Result |
|---|---|---|
| Rate-limit and surface tests | `pnpm vitest run apps/web/src/lib/auth/rate-limit.test.ts apps/web/src/lib/auth/enabled-paths.test.ts` | Verified 2026-11-01 (part of `pnpm test`) |
| Cleanup jobs | `pnpm vitest run apps/web/src/jobs/cleanup.test.ts` | Verified 2026-11-01 |
