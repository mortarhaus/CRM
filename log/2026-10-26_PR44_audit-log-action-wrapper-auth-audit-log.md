# PR 44 — Phase 1 PR 4: audit_log, action(), AUTH-01 lint, auth_audit_log

- **Merged:** 2026-10-26 (14:53 UTC) · **Merge commit:** 130fd4debb8c378c9430d96ffdd10d5b2cfe264f · **Branch:** feat/p1-action-audit
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-44.receipt` on agent-logs, log-branch commit 346a19551021b70bafb011550447591207674c79 (written 14:53:16 UTC, 17 seconds before the merge); head 1f5939ef765019e6a20d22e595b8d9268679f1df = final head; review-file hash 19f27e13762b3165ebcb96df0c6afaa84ae81a2f (local review file re-hashed: matches)
- **Merge evidence:** `gh pr view 44` reports MERGED, merge commit 130fd4d, merged 2026-10-26T14:53:33Z, head 1f5939e; `git merge-base --is-ancestor 130fd4d origin/main` succeeds.
- **Drafted by:** Opus 5.5 helpers (code, deep tier) with Sonnet 5.5 (builder: git, checks, PR) · **Final verdict:** Approved with conditions (round 4, Bob on Opus 5.5)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 8 · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (Tasks 12-15 and 31) · **Milestone:** Phase 1 PR 4

## What changed
Login and 2FA events are now audited: `auth_audit_log` is written by database triggers inside one transaction per auth request, with a per-user lock, a pool bound and a sign-in email lock (migrations 0007-0010). Tenant actions get an append-only `audit_log` with PII redaction, a `crm_purge` test set, an `idempotency_key` table (24 h expiry) and `action()` (session, workspace, role, Zod, idempotency, handler). An AUTH-01 lint rule forces every server action through `action()`; the PR #43 TEN-10 lint gaps are closed. postgres.js 3.4.9 is patched (`patches/postgres@3.4.9.patch`) so a killed backend no longer wedges a pool connection.

## Why
AUTH-01, AUTH-05, AUTH-07, TEN-03, TEN-10 and UNI-10: every login and 2FA change leaves an audit row, no 2FA change can lock a user out, and every mutating action passes one checked path.

## Review rounds
- R1 (spike, Approved with conditions, head b935a47): [P2] pool and lock use of an auth request → half-pool bound, bypass guard, Task 22 note; [P2] postgres.js uncaught TypeError → checked on `next start` (process survived, one pool connection wedged), fixed with `pnpm patch`; [P2] revoke one session by id → deferred to Task 24; [P2] facts relied on missing → list with file:line in the PR body and DECISIONS.
- R2 (feature-complete, Blocked, head b782501): [P1] no self-check table → table added; [P1] 10 applicable rules missing → rows added; [P2] ASK 4 builder default → Charlie answered 24 h; [P2] sign-in timing shows whether an account exists (AUTH-05) → advisory lock on the sign-in email; [P3] `canonical()` hashes Set/Map/Blob as `{}` → refuses non-plain objects.
- R3 (Blocked, head e3afafd): P1-1, P1-2, P2-2 still open; P2-1 resolved.
- R4 (Approved with conditions, head 1f5939e): all earlier findings resolved; [P3-2] three wrong evidence pointers in the PR body self-check (not fixed, see Follow-ups).

## Deferred conditions
- P2-3: end one chosen session by id (the session list no longer shows tokens) → Phase 1 PR 7, plan Task 24. Task 24's self-check must name it. The plan carries a note.

## Decisions worth keeping
- `docs/DECISIONS.md` entries of 2026-10-26: Tasks 12-15 (departures (a)-(o), migration numbers 0011-0014, plan inconsistency on `idempotency_key` grants, followed Task 14), PR #44 Round 1 conditions (pool bound, postgres.js patch, UNI-06 reasoning and removal condition), PR #44 Round 2 (sign-in email lock, `canonical()`), the spike entry with Bob's rulings and the facts relied on.
- ASK 4 decided by Charlie on 2026-10-26: idempotency key expiry 24 hours.
- Residual: a burst on any email (account or not) can hold up to 5 request transactions for 5 s or 10 s; Task 22's rate limits bound it. Task 22's rate-limit storage must use the routed db or memory (plan note).
- A Phase 0 user with the 2FA flag on and enrolment unverified recovers with a recovery code (R11 terms in DECISIONS). Upgrade notice: every Phase 0 user is signed out once (runbook).

## Follow-ups
- Next: Phase 1 PR 5 (pg-boss, Tasks 16-18): ask the owner first. The `crm_worker` grants are measured there. The TEN-10 `worker.ts` driver exemption ends in PR 5.
- Owner: answer ASK 5 (`billing_account.status`, builder proposal "only `active`"); refresh repo-root `.env` role URLs from `.env.example`; repo visibility; fate of untracked `docker/sync-export.sh`, `docker/sync-import.sh`, `.playwright-mcp/`.
- Builder: fix the three wrong evidence pointers of the PR 44 self-check if the table is reused (`apps/web/src/lib/audit.test.ts`, TEN-01 relowner test lines, no unused-exports lint rule); update `CLAUDE.md` Status ("Next" is PR 5) in a later docs PR.
- Later PRs: a same-key race test for `action()`; Task 24 must name revoke-session-by-id; the `reserve()` path of postgres.js is not patched (app code never calls it); a dynamic `import("postgres")` in three TEN-10-exempt files is not linted.
- Flaky E2E `accessibility.spec.ts:77` (tablet-768): look into it if it recurs.

## Appendix — final review round
## Round 4 — 2026-10-26 · scope: delta re-review (Round 2 and 3 open findings) on the feature-complete PR
- **Code review:** base (merge base) `c0bc2cc159ef41ce4b02ed79dabbf35285ccb821` (= `origin/main`) · head `1f5939ef765019e6a20d22e595b8d9268679f1df` · head re-checked at end: yes (still `1f5939e`, OPEN, not draft)
- **Delta since Round 3 (`e3afafd`):** 3 commits, 10 files, +223 / −19. `e0b63bd` (P2-2 sign-in email lock), `f29ba42` (P3-1 `canonical()`), `1f5939e` (DECISIONS, runbook). The PR body now has the self-check table.
- **Spec reference:** unchanged (v4.7 revision 8, hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`).
- **Checkout mode:** detached worktree `.agent/worktrees/review-44-1f5939ef` at the exact head. My build output and `node_modules` are deleted. No tracked file changed. Removed without `--force`. **Disclosure:** I reran my Round 2 timing probe from a temporary untracked test file, `apps/web/src/lib/auth/probe-r44d.test.ts`, after the full check run. I deleted it in the same command right after the run, and `git status` was clean. Its result went to my scratchpad only.

**Verdict:** Approved with conditions — no open P0, P1 or before-merge P2. The one condition is the Round 1 deferral P2-3 → plan Task 24 (PR 7). The P3s below do not block.
**Model used:** Opus 5.5 · **Switch model next step?** No.

### Open findings from earlier rounds
| Finding | Status | Evidence |
|---|---|---|
| P1-1 (R2): no self-check table | **resolved** | PR body "## Self-check (whole PR 4)": a table, 30 rows, rule · result · evidence, plus the line for the 7 ticked packs judged not relevant, each with a reason. |
| P1-2 (R2): 10 applicable rules missing | **resolved** | AUTH-05, TEN-01, TEN-04, TEN-05, UNI-04, UNI-05, UNI-07, UNI-12, UNI-13, UNI-14 are all rows now. I re-verified each against the code (3 evidence pointers are wrong, P3-2). |
| P2-1 (R2): ASK 4 | resolved in Round 3 | — |
| P2-2 (R2): sign-in timing shows if an account exists (AUTH-05) | **resolved** | See below. |
| P3-1 (R2): `canonical()` and non-plain objects | **resolved** | `action.ts:51-55` `isPlainObject` (prototype `Object.prototype` or `null`); any other object falls through to the existing `TypeError`. Test "refuses to hash a Set, a Map, a Blob, a File or a class instance (TypeError), and claims no key", plus a null-prototype object that hashes like a literal (`DONE`, then `REPLAYED`). |

**P2-2 fix, as I read it:**
- `apps/web/src/db/system/auth-audit.ts:59-61`: for each email key (only `/sign-in/email` gives one, lower-cased in `session-audit.ts:61`), `pg_advisory_xact_lock(SIGN_IN_EMAIL_LOCK_SPACE::int, hashtext(email))`, before the row lock, whether or not an account exists.
- Lock order: the email lock is the sign-in transaction's first lock. No other path takes it, and a request takes at most one email key, so I see no new wait cycle. T6 and T7 (sign-in against a 2FA change, both orders) pass unchanged. `lock_timeout` applies to advisory locks, so both kinds of email meet the same 5 s.
- The two-int key form keeps it apart from the single-bigint test holds and the migration lock. The harness now tells them apart (`objsubid` 1 or 2).
- Tests (`auth-audit.test.ts`, describe "PR #44 Round 2 P2-2 (AUTH-05)"): a burst of 20 on a known email and on an unknown email (one request at a time in the lookup, all 401, comparable time); the lock is per email and case-blind; an unknown email meets the 5 s lock timeout exactly as a known one (500, no session, no audit row, two 55P03 log lines). DECISIONS records the before numbers (unknown max 5 in flight) as a mutation proof.
- **My probe on the new head** (the same Round 2 probe, unchanged, plus an upper-case run):

  | Burst | Known: total / median / max | Unknown: total / median / max | Round 2 (before) known vs unknown total | Statuses |
  |---|---|---|---|---|
  | 1 | 17 / 17 / 17 ms | 13 / 13 / 13 ms | 15 vs 13 ms | all 401 |
  | 30 | 290 / 163 / 289 ms | 282 / 143 / 282 ms | 304 vs 94 ms | all 401 |
  | 80 | 827 / 425 / 826 ms | 743 / 388 / 742 ms | 751 vs 218 ms | all 401 |
  | 30, unknown in capitals | — | 278 / 147 / 278 ms | — | all 401 |

  The 3× gap is gone. A small gap remains (about 10 % at 80, and 4 ms on one request). It comes from Better Auth's own work after the lookup (verifying a stored hash against hashing a password), which the PR records as a residual. I accept it.

### Findings

### [P3-2] Three evidence pointers in the self-check table are wrong (the claims are true)
- Category: defect (docs)
- Evidence, PR body self-check:
  - TEN-03 and TEN-11 rows cite `db/audit.test.ts`. That file does not exist. The tests are in `apps/web/src/lib/audit.test.ts`.
  - TEN-01 row: "`db/privileges.test.ts` checks `relowner` is `crm_migrator` for `audit_log` and `idempotency_key`". The `relowner` test (`privileges.test.ts:68-73`) covers `APPEND_ONLY_TABLES` only (`audit_log`, `auth_audit_log`). `idempotency_key` is covered by "makes crm_migrator the owner of every table…" (`privileges.test.ts:40-45`, `objectsNotOwnedBy`). The claim holds.
  - UNI-05 row: "unused exports checked by `pnpm lint`". I found no unused-exports rule in `eslint.config.mjs`. Lint catches unused variables and imports, not unused exports. I saw no dead code.
- Impact: a later reader follows a wrong pointer. No rule fails.
- Required correction: fix the three pointers in the PR body (no code change, no new review round needed).
- Owner: builder
- Status: open (does not block)

**Notes (no finding):**
- Residual recorded in DECISIONS and the runbook: a burst on any email (account or not) can now hold up to 5 request transactions for up to 5 s or 10 s. The half-pool bound still protects the rest of the app, and Task 22's rate limits bound the burst. I agree.
- The runbook's new `pg_locks` query is marked "unverified against a live server". Its filter matches the harness, which the tests use.
- No text addressed to an AI agent in the delta or the PR body.

### Verification performed
| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | 0 |
| `pnpm audit --audit-level high` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `pnpm test` | 0 — 30 files, 573 tests (matches the PR body; Round 2 had 569) |
| `pnpm build` | 0 |
| `gh pr checks 44 -R mortarhaus/CRM` | 4/4 pass on `1f5939e` (Dependency audit, Image Trivy E2E, Secret scan, Typecheck lint test) |
| `git diff --check e3afafd 1f5939e` | clean |
| Secret scan on added lines | one hit: the existing `PASSWORD` test constant |
| Timing probe (temporary test, deleted) | table above |
| Head re-check at end | `1f5939e`, OPEN |

### Required before merge
- None.

### Deferred conditions
- P2-3 (Round 1): end one session by id → plan Task 24 (PR 7). Task 24's self-check must name it.

### Optional improvements
- P3-2: fix the three self-check pointers.
- A same-key race test for `action()` in a later PR (Round 2 note).

