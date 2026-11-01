# PR 49 — feat: Phase 1 PR 8 - security headers, email adapter, test email, Phase 1 close (Tasks 25-29)

- **Merged:** 2026-11-01T16:18:49Z · **Merge commit:** `516c6ecdbca1584b47d91464e051a516388a6e2f` · **Branch:** `feat/p1-headers-email`
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-49.receipt` on `agent-logs` (commit `15c9484`, written 2026-11-01T16:17:40Z, 69 s before the merge); reviewed head `6550472adf4f9b4c62d62dd346f9312bf1f9a3b1` = final PR head; review hash `e862d4f8f805064d1cb9cb3bfa52ba11e657b8c1`
- **Merge evidence:** `gh pr view 49` → MERGED, merge commit above; `git merge-base --is-ancestor 516c6ec origin/main` → reachable
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 1; reviewer ran on Sonnet 5.5, below the project's Opus 5.5 tier for auth/security review; Charlie merged without a second pass)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 8, unchanged) · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (PR 8, Tasks 25-29) · **Milestone:** Phase 1, plan PR 8 of 8 (last code PR of Phase 1; Task 30 spec revision 8 PR still to do)

## What changed
- Task 25: nonce CSP from `apps/web/src/proxy.ts`, static security headers and a separate `/api` CSP from `next.config.ts`; HSTS `max-age=31536000` with no `includeSubDomains` and no `preload` (Charlie, ASK 6 = A); root layout calls `await connection()`.
- Task 26: email adapters (SMTP through nodemailer 10.1.7, Resend through `fetch`), React Email render (`@react-email/render` 2.1.1), email settings in the worker schema only, Mailpit pinned by digest in dev compose.
- Task 27: `/settings/email` (Admin and Owner), `sendTestEmail` through `action()`, `email.send` job with `{ workspaceId, userId }` only, worker handler, audit rows `email.test_requested` and `email.test_sent`, E2E and accessibility cases.
- Review fix found by an independent Opus pass before the PR (P2-1): the test email is capped at 5 per user and 20 per workspace per hour; `RATE_LIMITED` added to `action()`; the handler refuses a call with other than one job.
- Task 29 docs: runbooks, `CLAUDE.md` Commands rows, DECISIONS entries. Task 28 had no commit; its check was the CI run (all four jobs green on the final head).

## Why
Spec "Secrets, supply chain, image" (security headers), "Domain events and jobs" (IDs-only job data), the permission matrix (email settings: Admin and Owner); UNI-17, UNI-18; Charlie's ASK 6 = A and ASK 8 = A (2026-11-01).

## Review rounds
- R1 (Bob, Sonnet 5.5): Approved with no P0, P1 or P2. Three optional P3s left open: stale handoff §0 (builder-local file), the proxy matcher skips every path that starts with `api`, and unverified-address mail is capped but not closed.

## Deferred conditions
- none (verdict was plain Approved).

## Decisions worth keeping
- Proxy lives at `apps/web/src/proxy.ts`; `API_CSP` is separate from the static headers; the proxy matcher excludes `api`. The security-headers E2E expects the dev policy when `E2E_BASE_URL` is unset and the production policy when it is set. The dev branch does not run in CI.
- Email settings are worker-only (schema, compose, Playwright `webServer` env for `worker:dev`); a test fails if another compose service names them.
- `action()` now turns an `ActionRefusedError` thrown in a handler into a refusal result for every action (touches the AUTH-01 wrapper).
- Known gap, recorded in DECISIONS: sign-up does not verify the email address; the test email is capped, not closed. Email verification and a delivery ledger keyed by job id must land before any customer-facing email kind.
- Mailpit SMTP is also published on `127.0.0.1:1025` (dev only). `scripts/retry-job.ts` reads only `DATABASE_WORKER_URL`.

## Follow-ups
- ASK 7 (production `EMAIL_FROM`, SPF/DKIM/DMARC owner) is open for Charlie; the runbook says "to be set by Charlie (ASK 7)". ASK 9 (`require_2fa` timing) is open.
- Charlie to confirm the `RATE_LIMITED` wording and the 5 and 20 per hour numbers (DECISIONS marks them open).
- Task 30: the separate spec revision 8 PR (E1-E12). Spec v4.7 revision 8 is already the approved text (hash `733cc0e9…`), so check the plan's Task 30 against that before starting.
- After this merge `setup` reconciles `PROJECT.md` §7 (isolation tests under `pnpm test`; `pnpm test:gates`) and §9 (UNI-04 `pg` ban in place; `crm_worker` grants measured). `CLAUDE.md` Status still says "Next: Phase 1 PR 3".
- The "Done-when and Verification map" the plan wants in the PR 8 body was not added (CI results only). Record it in the Phase 1 close.
- Optional P3s: anchor the proxy matcher (`api/` and `api$`) when a page ever starts with `api`; Resend `fetch` has no timeout; low advisory `deepmerge` via `@react-email/render` (2.2.0 fixes it; separate dependency PR); show different text when a replayed key answers REPLAYED; add a `no-restricted-imports` rule so `app/**` cannot import `adapters/email`.
- Carried: `boss.test.ts` once timed out under full-suite load (alone and on rerun it passed); `Secure` cookie flag untested over https; dev-server E2E not run in CI; rotate the dev `AUTH_SECRET`; refresh the local `.env`; repo visibility; untracked files in the main checkout.

## Appendix — final review round

## Round 1 — 2026-11-02 · scope: slice (Phase 1 PR 8, plan Tasks 25–29)
- **Code review:** base (merge base) `f1d2e0184488fd75945d9cc6b157e5abb0ae47af` · head `6550472adf4f9b4c62d62dd346f9312bf1f9a3b1` · head re-checked at end: yes
- **Spec review:** spec path `docs/superpowers/specs/2026-09-27-core-sales-design.md` · version v4.7 revision 8 · hash not re-computed (no spec file in the diff)

**Verdict:** Approved
**Model used:** Claude Sonnet 5.5 · **Switch model next step?** Yes — `PROJECT.md` §6 maps auth/security review to Opus 5.5. This round ran below that tier. Charlie may ask for one more pass on Opus 5.5 before merging.

### Findings

### [P3] Handoff §0 still says "Active PR number: none yet"
- Category: stale record · Rule: UNI-05 (polish)
- Evidence: `.agent/handoff.md` §0 says "none yet"; the title line and the PR name PR #49 and head `6550472`.
- Required correction: none required. Optional: set §0 to 49 before `approved 49`.
- Owner: builder · Status: open (optional)

### [P3] Proxy matcher skips every path that starts with `api`
- Category: edge case · Rule: UNI-17
- Evidence: `apps/web/src/proxy.ts` matcher `/((?!api|_next/static|_next/image|favicon.ico).*)` is a prefix test. A future page such as `/apiary` or `/api-docs` would get no nonce CSP (it would still get the static headers). `/api/(.*)` in `next.config.ts` covers only real API paths. No such page exists today. This is Next's own documented matcher.
- Required correction: none. Optional: anchor it as `api/` and `api$` when a page ever starts with `api`.
- Owner: builder · Status: open (optional)

### [P3] Unverified-address mail is capped but not closed
- Category: residual risk · Rule: AUTH-06 / UNI-09
- Evidence: sign-up does not verify the address. The test email is capped at 5 per user per hour and 20 per workspace per hour. Sign-up is capped at 10 per IP per hour (PR 48). So one IP can still queue about 50 test emails an hour to a victim's address, via many accounts. The content is fixed and harmless. DECISIONS records the "known gap: email verification deferred; delivery ledger before any customer-facing email".
- Required correction: none now. Email verification must land before any customer-facing email kind.
- Owner: builder / Charlie · Status: open (accepted, recorded)

### Applicability list (built before reading the builder's table)
Packs: universal, auth, events-jobs, frontend (new page, nav link). Not relevant: money, finalized-records, public-links, files-templates, payments, tenancy-rls (no migration, no table; the one new RLS-adjacent write is an audit row in `withWorkspace`). The builder's table covers the same rules; I re-checked every `pass` below.

### What I re-verified
- **UNI-17/18 headers:** `buildCsp` has no `'unsafe-inline'` or `'unsafe-eval'` in production, a per-request 16-byte nonce, `frame-ancestors 'none'`, `object-src 'none'`. `API_CSP` is a separate constant on `/api/(.*)` only, so no page gets two policies. HSTS is `max-age=31536000` (Charlie, ASK 6 = A). Root layout calls `await connection()` so the nonce reaches the scripts. The proxy reads no database (AUTH-11).
- **Email adapters:** `EmailSendError` holds provider and status only; no address, key or `cause`. The contract test runs both SMTP (Mailpit in a container) and Resend (local stand-in, no real API call) and checks that the address and key never reach the error.
- **Worker-only email settings:** in the worker schema only; `.env.example` has them commented out; compose sets them on the worker container only; `RESEND_API_KEY` appears in no committed file.
- **Action (AUTH-01/02/03):** `sendTestEmail` uses `action()` with `minRole: "admin"`; the nav link and page check only hide; the action re-checks on every post. The limit runs after session, role, input and key claim, so a refused post spends nothing. A handler `ActionRefusedError` rolls back the transaction and the key.
- **Job (EVT-01/03/05):** data is exactly `{ workspaceId, userId }`; parsed with zod; the address is read at send time; one job per call; a non-member or unknown user fails the job (retry then dead-letter).
- **Dependencies (UNI-06/14):** `nodemailer` 10.1.7 and `@react-email/render` 2.1.1, exact pins, ladder in DECISIONS; lockfile adds only the render tree (`html-to-text`, `htmlparser2`, `selderee`, `deepmerge` and friends) with integrity hashes. `pnpm audit --audit-level high` exits 0: 1 low, 5 moderate, matching DECISIONS. Mailpit pinned by tag and digest.
- **CI:** run 41314527814 is for head `6550472` and all four jobs pass (checks, audit, secrets, image/Trivy/E2E).

### Answers to the builder's open items
- ASK 7 (production `EMAIL_FROM`, SPF/DKIM/DMARC) stays open for Charlie. It does not block this PR.
- The `RATE_LIMITED` wording is a Charlie decision. It does not block this PR.

### Verification table (own checkout, Node 24.21.0, pnpm 11.6.0)
| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm audit --audit-level high` | exit 0 (1 low, 5 moderate) |
| `pnpm test` (Docker up) | exit 0 — 48 files, 968 passed, 1 skipped |
| `pnpm test:gates` | exit 0 — 1 passed |
| `pnpm build` | exit 0 |
| CI on `6550472` | all 4 jobs pass |

### Not verified by me
- Playwright E2E (`security-headers`, `test-email`) and the image stack: I rely on the green CI image/E2E job on this head. The dev-server branch of `security-headers.spec.ts` does not run in CI (DECISIONS says so).
- Real Resend delivery and DNS: not testable here (ASK 7).
- Spec hash not re-computed.

### Residual risks
- PR size: 49 files, about 520 lines of production code; over the 400-line target, plan makes Tasks 25–29 one PR. Accepted.
- The worker now needs `EMAIL_PROVIDER`, `EMAIL_FROM` and `SMTP_URL` or `RESEND_API_KEY` to start. The runbook says so; a deployment that misses them exits at start (by design).
