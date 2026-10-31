# PR 47 — fix(deps): upgrade better-auth to 1.7.14 (GHSA-965c-763c-88jm, GHSA-r4xp-prcw-77qf)

- **Merged:** 2026-10-31T14:56:10Z · **Merge commit:** `751ba3bd6e4b8be727abf4025d4b26f9d3a4783a` · **Branch:** `fix/audit-better-auth`
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-47.receipt` on `agent-logs` (commit `12a379f`, written 2026-10-31T14:55:38Z, 32 s before the merge); reviewed head `c70f3d76db1d58a04d8f1155b7e50f2b83ad85b9` = final PR head; review hash `103ae8861a78f4c53ca40d4c9c22480f5c773b5e`
- **Merge evidence:** `gh pr view 47` → MERGED, merge commit above; `git merge-base --is-ancestor 751ba3b origin/main` → reachable
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 7; reviewer ran on Sonnet 5.5, below the project's Opus 5.5 tier for auth review)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 8, unchanged) · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` (version wording only) · **Milestone:** Phase 1 (side fix, CI audit gate)

## What changed
Upgrades `better-auth` and the `auth` CLI from 1.7.6 to 1.7.14 (exact pins, lockfile updated). Records a source audit of the ten Better Auth facts the Task 31 auth audit relies on, updates code comments, two auth runbooks and the active plan wording to say 1.7.14 or "historical", and adds a DECISIONS entry. No application logic changed.

## Why
CI job "Dependency audit" (`pnpm audit --audit-level high`) failed on `main` because of new advisories on better-auth <1.7.7: one critical (GHSA-965c-763c-88jm) and one high (GHSA-r4xp-prcw-77qf), plus one low (GHSA-44jh-23m7-hpcf). None is reachable today (no magic link, OAuth proxy or social providers). It also blocked PR 46.

## Review rounds
- R1-R6 (same head `d8ad2721`, Blocked each time until the builder acted):
  - [P1] No guardrail self-check table → full rule-by-rule table in the PR body (UNI-05/06/07/13/14/16/18, AUTH-04/05/07/08/10/13 pass; the rest n-a with reasons).
  - [P1] Better Auth 1.7.14 source audit and runbook update incomplete → all ten facts re-read on 1.7.14 (none changed in a breaking way); every `1.7.6` hit classified; runbooks, comments and plan wording updated (`c70f3d7`).
  - [P2] Handoff did not name PR 47 → handoff rewritten; local and `agent-logs` copies agree.
- R7: Approved at `c70f3d7`. One optional P3 (stale "3 moderate" count in DECISIONS).

## Deferred conditions
none

## Decisions worth keeping
- Take the newest patch (1.7.14) when nothing after the first patched version is breaking, following PR 37 and PR 40. 1.7.7 was the fallback.
- The `auth` CLI devDependency must move with `better-auth`; at 1.7.6 it keeps the vulnerable copy in the tree.
- Grants were not remeasured on 1.7.14; the 1.7.6 measurement is kept as historical in `docs/runbooks/phase-1-database-roles.md`.
- Lasting decision is already in `docs/DECISIONS.md` (2026-10-30 entry).

## Follow-ups
- Fix "3 moderate" to "5 moderate" in the 2026-10-30 DECISIONS entry (P3, next PR that touches that file).
- 5 moderate dev-tooling advisories remain: esbuild GHSA-67mh-4wv8-2f99, `@vitest/mocker` GHSA-qxg6-89mg-rqv8 and GHSA-xp26-3454-mjgp, minimatch GHSA-g3hv-75wg-m249, glob GHSA-3g3m-2fjr-6pw4. Below the `high` gate; a separate audit-fix PR can clear them.
- Update PR 46 (`feat/p1-events`) from `main` so its Dependency audit check passes, then `review 46`.
- Remeasure `crm_app` and `crm_worker` grants on 1.7.14 with a statement log (Phase 1 close, Task 29).

## Appendix — final review round
### Round 7 — 2026-10-31
- **Code review:** base (merge base) `c599bd89dae32bd3c4e10f49913918e52c5f8e79` · head `c70f3d76db1d58a04d8f1155b7e50f2b83ad85b9` · head re-checked at end: yes (host head and `git status --untracked-files=no` both unchanged)
- **Spec review:** spec path `docs/superpowers/specs/2026-09-27-core-sales-design.md` · version v4.7 revision 8 · hash (`git hash-object`) `733cc0e9ce4af0771bdd2769720e3f228caf8855` (not re-hashed this round; no spec file in the diff)

**Verdict:** Approved
**Model used:** Claude Sonnet 5.5 · **Switch model next step?** Yes — `PROJECT.md` §6 maps auth/security review to Opus 5.5 (deep). This round ran below that tier. Every check below was re-run or re-read from primary sources, not taken from the builder's text. Charlie may ask for one more pass on Opus 5.5 before merging if he wants the deep tier on this auth change.

### Findings

### [P3] DECISIONS entry still says "3 moderate remain"; the audit now shows 5
- Category: preference (stale count in a dated record)
- Rule: UNI-05 (polish only)
- Evidence: `docs/DECISIONS.md` 2026-10-30 entry, "Scope / affects" bullet: "3 moderate remain: esbuild … `@vitest/mocker` …". `pnpm audit --audit-level high` at this head prints "5 vulnerabilities found, Severity: 5 moderate": esbuild GHSA-67mh-4wv8-2f99, `@vitest/mocker` GHSA-qxg6-89mg-rqv8 and GHSA-xp26-3454-mjgp, minimatch GHSA-g3hv-75wg-m249 (via `eslint`), glob GHSA-3g3m-2fjr-6pw4 (via `testcontainers`). All five are dev tooling and below the `high` gate. The PR body and the handoff both say 5 and name the two new ones.
- Failure scenario: a later reader of the decision log counts 3 and wonders about the other two. No security effect.
- Why it matters: minor record drift only. The gate (`high`) passes and the PR body is correct.
- Required correction: none required. Optional: change "3 moderate" to "5 moderate" and add minimatch and glob in the next PR that touches `docs/DECISIONS.md`.
- Owner: builder
- Verification: read the entry.
- Status: open (optional, does not block)

### Resolved from Rounds 1–6

| Earlier finding | Result this round | Evidence |
|---|---|---|
| [P1] No guardrail self-check table | **Resolved** | The PR body now has a rule-by-rule table. I built my own applicability list first from `guardrails/universal.md` and `guardrails/auth.md` and compared. Every UNI and AUTH rule is accounted for: UNI-05/06/07/13/14/16/18 and AUTH-04/05/07/08/10/13 are `pass`, the rest are `n-a` with reasons. I re-verified each `pass` (see the audit table below). |
| [P1] Better Auth 1.7.14 source audit and runbook update incomplete | **Resolved** | See "Source audit I re-did" and "Version claims" below. |
| [P2] Handoff does not name PR 47 | **Resolved** | `.agent/handoff.md` names PR #47, branch `fix/audit-better-auth` and head `c70f3d7`. `git hash-object` of the local file and of `origin/agent-logs:handoff/handoff.md` are both `bfaac545e1ff177abf4d38bc196e3d4038b46a50`, and `.agent/handoff.synced` holds the same hash. |

### Source audit I re-did (installed 1.7.14 vs the 1.7.6 copy in another worktree's store)
- Byte-identical, as the builder says: `plugins/two-factor/verify-two-factor.mjs`, `plugins/two-factor/schema.mjs`, `db/with-hooks.mjs`, `plugins/two-factor/error-code.mjs`, `api/routes/email-verification.mjs` (checked with `cmp`).
- Fact 3 (backup-code compare-and-set): read `backup-codes/index.mjs:222-233` in 1.7.14. `incrementOne` where `id` and `backupCodes` equal the read value; no row gives 409 `CONFLICT`. Drizzle adapter `index.mjs:539` now repeats `...clause` in the outer `UPDATE`; `:566` is `transaction: config.transaction ?? false`. Matches the entry.
- Fact 4 (`onAPIError.throw`): `api/index.mjs:196-198`, `onError` is `async`, returns for `FOUND`, rethrows when `throw` is set. Matches. (better-call `router.mjs` is claimed byte-identical; I read the 1.4.4 file is present, I did not diff it against 1.4.0.)
- Fact 2 (enable order): `totp/index.mjs:172-190` shows flag update, `createSession` from the active session, cookie, old session deleted, then `verified: true`. `diff` of `plugins/two-factor/index.mjs` shows the only change is that the new session is created before `setSessionCookie` (three places). The fact holds.
- Fact 6 (`createSession` copy): read `db/internal-adapter.mjs:259-290`. `diff` against 1.7.6 shows only secondary-storage changes and literal constants (`604800`, `86400`). No session is stored differently without `secondaryStorage` (not configured).
- Fact 8 (`sign-in.mjs`): `diff` shows one changed line (196, social sign-in). Matches.
- Fact 9 (no GET inserts a session): recounted `createSession(` per file across `dist/` in both versions: 18 files, identical counts (diff empty).
- `/change-password` order change: read `api/routes/update-user.mjs:173-180`. It deletes sessions, updates the password, creates the session inside `runWithTransaction`. With `transaction: false` on the Drizzle adapter this runs inline in our request transaction. Matches the entry's "changed, compatible" ruling.
- Not independently verified: the "74 endpoint paths, same body fields" count, fact 10 (`core/utils/ip.mjs` marker-only change), and the limiter 429 header detail. The 736 tests and CI cover behaviour; I list these as residual.

### Version claims
- `rg '1\.7\.6'` over `apps/`, `packages/`, `docs/runbooks/` and the active plan (excluding the lockfile): remaining hits are the ones the PR body classifies. I read plan lines 1567, 1578, 1580, 1584, 1633 and the runbook/code hits. Each either says "reverified on 1.7.14" or is a labelled historical measurement. No current claim says 1.7.6 is installed. `docs/runbooks/phase-1-database-roles.md:88` keeps the 1.7.6 grant measurement and says plainly that it was **not** remeasured on 1.7.14.

### Self-check audit

| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-05 | yes | pass | pass (one P3 count) | version claims classified; no logic change | none blocking |
| UNI-06 | yes | pass | pass | exact pins in `apps/web/package.json`; lockfile adds only `auth`/`better-auth`/`better-call` entries plus the listed transitive moves; frozen install exit 0 | none |
| UNI-07 (hard) | yes | pass | pass | project secret pattern over added lines: two hits, both existing plan wording (`PASSWORD_CHECK_*`); no secret; same-head gitleaks green | none |
| UNI-13 | yes | pass | pass | `pnpm audit --audit-level high` exit 0; CI run `41205034551` on head `c70f3d76` all green | none |
| UNI-14 | yes | pass | pass | `pnpm install --frozen-lockfile` exit 0 | none |
| UNI-16 | yes | pass | pass | runbooks edited in this PR | none |
| UNI-18 | yes | pass | pass | cookie tests in the 736 pass; config unchanged | none |
| AUTH-04/05/07/08/10/13 | yes (compatibility) | pass | pass | tests, source audit, same-head E2E | none |
| AUTH-06 | n-a | n-a | n-a confirmed | limiter is still Better Auth's memory default; DB limiter is Phase 1 Task 23; the vulnerable DB-storage path is not configured | none |
| Other UNI/AUTH, other packs, `PROJECT.md` §9 | n-a | n-a | n-a confirmed | diff is pins, lockfile, comments, docs | none |

### Verification performed

| Command / check | Result |
|---|---|
| PR metadata at start and end | open, mergeable; head `c70f3d76` unchanged; 16 files, 146 insertions / 122 deletions; 3 commits |
| `git fetch`, exact-commit, merge base | pass; merge base `c599bd89` |
| Detached checkout `.agent/worktrees/review-47-c70f3d76` | exact head; tracked-clean at end |
| `git diff --check` | pass |
| `pnpm install --frozen-lockfile` (Node v24.21.0, pnpm 11.6.0) | exit 0 |
| `pnpm audit --audit-level high` | exit 0; 5 moderate, no high or critical |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` (Docker up) | exit 0; 34 files, 736 tests passed |
| `pnpm build` | exit 0 |
| CI run `41205034551` | success on head `c70f3d76` (checks, audit, secret scan, image/Trivy/E2E) |
| Diff secret scan and agent-addressed-text scan | no secret; no text addressed to an agent or reviewer |

### Residual risks and test gaps
- Not run by me: `pnpm test:e2e`, `pnpm db:generate` and the Auth CLI schema reproduction (the builder reports byte-identical; CI's same-head image E2E passed).
- Grants were not remeasured with a statement log on 1.7.14 (disclosed in the runbook). The 736 tests and the builder's 84 E2E tests ran as `crm_app` and hit no `42501`, so the risk is a new statement outside those tests. Phase 1 PR 5 measures the `crm_worker` grants and is the next place to catch this.
- Source-audit items listed above as not independently verified.
- The review ran on a model below the project's deep tier.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- Fix the "3 moderate" count in the 2026-10-30 DECISIONS entry (P3).
