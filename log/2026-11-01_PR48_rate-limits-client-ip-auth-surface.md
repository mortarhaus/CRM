# PR 48 — feat(auth): Phase 1 PR 7: database rate limits, trusted client IP, account cap, Phase 1 auth surface, AUTH-07, cleanup schedules (Tasks 21-24)

- **Merged:** 2026-11-01T10:15:03Z · **Merge commit:** `f1d2e0184488fd75945d9cc6b157e5abb0ae47af` · **Branch:** `feat/p1-rate-limits`
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-48.receipt` on `agent-logs` (commit `1083c52`, written 2026-11-01T10:13:49Z, 74 s before the merge); reviewed head `69b738f65cd5b4f1d750111df40a89bbd26aa23f` = final PR head; review hash `94772eb32d797242e7d514d3a591511e194ee2b6`
- **Merge evidence:** `gh pr view 48` → MERGED, merge commit above; `git merge-base --is-ancestor f1d2e01 origin/main` → reachable
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 1; reviewer ran on Sonnet 5.5, below the project's Opus 5.5 tier for auth review; Charlie merged without a second pass)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 8, unchanged) · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (PR 7, Tasks 21-24) · **Milestone:** Phase 1, plan PR 7 of 8

## What changed
- Task 21: `rate_limit` table and one atomic consume statement (migrations 0021, 0022; the plan's 0014).
- Task 22: one trusted client-IP derivation for `/api/auth` and form submits (`TRUSTED_CLIENT_IP_HEADER`).
- Task 23: Better Auth's limiter runs on the database with its own small `crm_app` pool; per-account sign-in cap; uniform 429; 415 for non-JSON sign-in.
- Task 24: only Phase 1 Better Auth paths are reachable (`disabledPaths` plus a 404 layer); AUTH-07 hook refuses `/change-password` without `revokeOtherSessions: true` (migration 0023 grants UPDATE on `password`, `updated_at`); `revokeOwnSession`; worker-owned cleanup schedules (`rate_limit.cleanup`, `idempotency.cleanup`); origin/CSRF pinned on; runbook `docs/runbooks/phase-1-security.md`.
- Fix found by CI: the worker container exited 1 because `migrate.mjs` used the web environment rules; each container now checks only its own (`migrateEnvFor`), and CI prints the service logs when the stack fails to start.

## Why
Spec §9 and Phase 1 plan PR 7: limits must live in the database (not per process), the client IP must come from one trusted header, and only the planned auth surface may answer. AUTH-04/05/06/07/08/10/13, UNI-19, EVT-06, TEN-09, plus Charlie's two decisions on 2026-11-01.

## Review rounds
- Builder stop (before the PR): two decisions for Charlie → **1A** limiter gets its own small autocommit `crm_app` pool (the plan's design; the probe showed a slow sign-in holding the shared IP row for 4.7 s and ending in a 500) and **2A** add the AUTH-07 hook (Better Auth 1.7.14 signs out other sessions only when the request sends `revokeOtherSessions: true`).
- Automated security scan (HIGH, parser differential in `request-handler.ts`: an unreadable body skipped the per-account count) → the handler answers 415 for non-JSON before counting; an unreadable JSON body spends a unit on the shared key `acct:signin:unreadable`; padded and cased emails share one key (test first).
- CI image job failed on the first head (`e5d2036`): worker exited 1 (`TRUSTED_CLIENT_IP_HEADER` required by the web rules) → `69b738f`.
- R1: Approved at `69b738f`, no P0-P2. Three optional P3s (see Follow-ups).

## Deferred conditions
none

## Decisions worth keeping
- Web process connection budget is now up to 14 (10 app + 2 pg-boss + 2 limiter); this replaces the earlier decision that rejected a separate auth pool.
- A rate-limit unit granted to a request that later fails with a 500 is not given back; a refused (429) request still spends an account-cap unit (spec design: 5 per 15 min per account).
- Counter keys are `ba:<spec row>:<ip>`, not the plan's `"ba:" + key`, so the spec's per-IP rows hold (row mapping in DECISIONS).
- Origin and CSRF checks are pinned on because Better Auth turns them off when `TEST` or `NODE_ENV=test` is set.
- `/ok` is enabled; `get-totp-uri`, `verify-otp` and `get-full-organization` answer 404; invitation grants are kept.
- A missing `x-forwarded-for` is filled by Next with the socket peer, so a misconfigured edge gives the edge's address, not the placeholder.
- Size: 73 files, about 670 lines of production code and about 2,230 of tests and docs; the plan puts Tasks 21-24 in one PR.
- Lasting decisions are in `docs/DECISIONS.md` (PR 7 entry). The image fix is in the PR body and `docs/runbooks/phase-0-auth-database.md`, not in DECISIONS.

## Follow-ups
- Optional P3: decode IPv4-mapped IPv6 in hex form (`::ffff:c000:201`) to IPv4 in `client-ip.ts`. Today all such clients share one counter (fails closed).
- Optional P3: one sentence in `docs/runbooks/phase-1-security.md` that a refused request still counts against the account cap.
- `revokeMySession` has no caller. Bob's answer: no user-scoped wrapper in this PR; add it with the session-list page, derive the user from the session, and run it as a Next server action so the origin check applies.
- Add the image-fix decision (`migrateEnvFor`) to `docs/DECISIONS.md` in a PR that touches that file.
- Local dev: the root `.env` still holds the Phase 0 database user, so local `pnpm smoke:auth-route` fails (CI passes it); the dev volume `crm-dev_pgdata` is not migrated to 0021-0023. The dev `AUTH_SECRET` was echoed once into an agent's tool output (not into any file); consider rotating it.
- Not verified in this PR: the 2FA lockout through `next start` (in-process only), the runbook's Caddy block against a real Caddy, a page for `revokeMySession`.
- Carried: fix "3 moderate" to "5 moderate" in the PR 47 DECISIONS entry; Task 29 updates the stale health body in `docs/runbooks/phase-0-auth-database.md`; optional event-name check in `emitEvent`.
- Next plan PR: PR 8 `feat/p1-headers-email` (Tasks 25-29).

## Appendix — final review round
### Round 1 — 2026-11-01
- **Code review:** base (merge base) `fe8664e7111053a505cf38683f26fb4e0083f7b2` · head `69b738f65cd5b4f1d750111df40a89bbd26aa23f` · head re-checked at end: yes (host head and `origin/main` unchanged)
- **Spec review:** spec path `docs/superpowers/specs/2026-09-27-core-sales-design.md` · version v4.7 revision 8 · hash not re-computed this round (no spec file in the diff; handoff hash `733cc0e9…` equals PROJECT.md §2)

**Verdict:** Approved
**Model used:** Claude Sonnet 5.5 · **Switch model next step?** Yes — `PROJECT.md` §6 maps auth/security review to Opus 5.5. This round ran below that tier. Charlie may ask for one more pass on Opus 5.5 before merging this auth change.

### Findings

### [P3] IPv4-mapped IPv6 in hex form shares one key
- Category: edge case
- Rule: UNI-03 (polish)
- Evidence: `apps/web/src/lib/auth/client-ip.ts` `keyOf`: `::ffff:1.2.3.4` maps to the IPv4 address, but `::ffff:c000:201` (same address, hex form) matches the regex, fails `isIPv4`, and falls to `ipv6Prefix64`, giving `0000:0000:0000:0000`.
- Failure scenario: an edge that writes mapped addresses in hex puts all those clients on one counter (fail closed, not open). Cloudflare and Caddy write dotted form, so no known deployment hits it.
- Required correction: none. Optional: decode the two hex groups to IPv4 in a later PR.
- Owner: builder · Status: open (optional)

### [P3] A 429 from the per-IP row still spends an account-cap unit
- Category: preference / documentation
- Rule: AUTH-05 (no effect on uniformity)
- Evidence: `request-handler.ts` `signIn` takes the account unit before `handler(request)`; Better Auth's IP row runs inside the handler; `giveBack` runs only for `response.ok`.
- Failure scenario: someone at 10+ sign-ins per minute from one IP spends units on a victim's email key even when the IP row refuses. The cap (5 per 15 min per account) is a spec design choice with this lockout trade-off. Responses stay identical for known and unknown emails.
- Required correction: none. Optional: one sentence in `docs/runbooks/phase-1-security.md` that a refused request still counts.
- Owner: builder · Status: open (optional)

### [P3] `revokeMySession` has no caller (answer to the builder's question)
- Category: preference
- Rule: UNI-05
- Evidence: `apps/web/src/lib/auth/session.ts`; the builder's PR body, difference 11, asks whether a user-scoped action wrapper is wanted and in which PR.
- Answer: no wrapper in this PR. Add it in the PR that ships the session-list page. It must derive the user from the session (as now) and run as a Next server action, so the built-in origin check applies. `revokeOwnSession` and its 3 tests (two users) are correct today.
- Required correction: none.
- Owner: builder · Status: open (decision recorded)

### Applicability list (built before reading the builder's table)
Packs: universal, auth, tenancy-rls, events-jobs. Not relevant: frontend (no page), money, finalized-records, public-links, files-templates, payments. The builder's table covers the same set; every `pass` I re-checked below.

### What I re-verified
- **Migrations 0021–0023:** one table, two GRANT-only files. `rate_limit` has no RLS (system table), `crm_app` gets SELECT/INSERT/UPDATE/DELETE only. `account` UPDATE is limited to `password, updated_at`. `privileges.ts` manifest matches and `privileges.test.ts` passes.
- **Consume statement:** one atomic `INSERT … ON CONFLICT … WHERE ended OR count < max`; the row lock serialises callers; the Retry-After read is advisory only. `giveBack` matches the exact `window_start`.
- **Limiter pool:** separate `crm_app` pool, max 2; `createAuth` refuses a shared pool (`SharedLimiterPoolError`). Connection budget stated: 10 + 2 + 2 = 14.
- **Client IP (AUTH-06):** one header, set by the app after all forwarding headers and any caller copy are removed; exactly one valid address, else a shared placeholder (fail closed); IPv6 uses the /64.
- **Sign-in handler:** 415 before counting for non-JSON (same rule as better-call); unreadable JSON counts on one shared key; known and unknown email count alike; HMAC key from `AUTH_SECRET` via HKDF, no email stored.
- **Allow-list (UNI-19):** `disabledPaths` computed from the built options; second 404 layer in the handler; test sends every path by GET and POST.
- **AUTH-07:** `/change-password` refused unless `revokeOtherSessions === true`; tested through `auth.api` and `next start`.
- **Cleanups (EVT-06, TEN-09):** scheduled by the worker with `boss.schedule`; idempotency delete runs per workspace in `withWorkspace`; no HTTP trigger.
- **Image fix:** `migrateEnvFor` checks each container's own schema; entrypoint passes `web` or `worker`. The CI image job passes on this head.
- **Handoff:** names PR #48, branch and head `69b738f`.

### Verification table (own checkout, Node 24.21.0, pnpm 11.6.0)
| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm audit --audit-level high` | exit 0 (5 moderate, none high) |
| `pnpm test` (Docker up) | exit 0 — 45 files, 928 passed, 1 skipped |
| `pnpm test:gates` | exit 0 — 1 passed |
| `pnpm build` | exit 0 |
| CI on `69b738f` | all 4 jobs pass (checks, audit, secret scan, image/Trivy/E2E) |

### Not verified by me
- Playwright E2E and the local image stack: I rely on the CI image/E2E job, green on this head.
- Spec hash not re-computed.

### Residual risks
- PR size: 73 files, about 670 lines of production code, about 2,230 of tests and docs. Over the 400-line target; the plan makes Tasks 21–24 one PR and the body says so. Accepted.
- The `TRUSTED_CLIENT_IP_HEADER` must match the real edge in each deployment; a wrong value collapses all clients onto one key (fails closed but locks everyone out quickly). The runbook covers it.
