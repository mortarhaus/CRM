# PR 22 — feat(web): Phase 0 PR 2 — env, Postgres client, Better Auth, schema, auth tests (Tasks 6-10)

- **Merged:** 2026-10-13T12:16:28Z (GitHub) · **Merge commit:** `ce4bbf28fc49c6e7ff9153e80fb23994d1163e31` · **Branch:** `feat/p0-auth-db` (final head `01196a43bafe971b375746505d3d18a7e3d50038`)
- **Gate breaches:** none. The final review round's head SHA (`01196a4…`) equals the PR's final head SHA, and the receipt was written before the merge (receipt commit `7bd2ddd`, 2026-10-13T12:13:20Z; merge 2026-10-13T12:16:28Z).
- **Approval receipt:** `reviews/PR-22.receipt` on `agent-logs`, commit `7bd2ddd` (reviewed head `01196a43bafe971b375746505d3d18a7e3d50038`; review-file hash `90c6b9a5c502411362943e2f8b3cc89bad745709`; review committed in `27298399eb97a4aac0f6dece5b5a3bb3d47e2e7e`).
- **Merge evidence:** `gh pr view 22` → state MERGED, merge commit above; `git merge-base --is-ancestor ce4bbf2 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-13).
- **Drafted by:** Claude Sonnet 5.5 (orchestration, checks, paperwork); Tasks 6-10 and two rounds of review fixes implemented by Opus 5.5 sub-agents, re-verified by the builder · **Final verdict:** Approved with conditions (round 5)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 4, hash `eb89f4ab817c79c536cd36f8aef7c643a059d697` (no Bob round for this exact hash; Charlie's 2026-10-10 waiver covers Phase 0 PR 2, Tasks 6-10) · **Plan:** `docs/superpowers/plans/2026-09-29-phase-0-foundation.md` Tasks 6-10 · **Milestone:** Phase 0 (PR 2 of 4)

## What changed
Server side of Phase 0 auth: Zod env validation that names variables and never values, the Postgres client over the `postgres` TCP driver (`prepare: false`) with a Testcontainers harness, Better Auth 1.7.6 (Argon2id, TOTP 2FA, organizations, uuid ids, `autoSignIn: false`), the generated auth schema with `timestamptz`, a baseline migration with an advisory-locked runner, and real-Postgres auth behaviour tests. Review fixes added: 30-minute invitation expiry, refusal of a plain-http public `APP_URL` in production with `Secure` cookies off loopback, a Phase 0 auth and database runbook, a dependency decision table, the root `.env` loaded under `pnpm dev` with a smoke check, and `INVITATION_EXPIRY_SECONDS` in `packages/core/src/security/limits.ts`.

## Why
Phase 0 "done when": sign up, 2FA, two workspaces, switch. This PR is the server side and its tests. UI is PR 3, runtime is PR 4. Phase 0 builds no roles, RLS, `action()`, pg-boss or Pino.

## Review rounds
- R1 (Revision required): [P1] invitations valid 48 h instead of 30 min (AUTH-08) → `invitationExpiresIn` set, 3 real-Postgres tests. [P1] http production origin could issue a non-Secure cookie (UNI-18) → env refusal plus `useSecureCookies`, tests. [P1] no runbook (UNI-16) → `docs/runbooks/phase-0-auth-database.md`. [P1] no dependency ladder (UNI-06) → table in the 2026-10-12 DECISIONS entry. [P1] self-check omitted applicable rules → rows added. P2 AUTH-06 deferred. P3 duplicate-sign-up test strength deferred.
- R2 (Revision required): [P1] `pnpm dev` ignored the root `.env` → `forceReload` in `next.config.ts` plus `pnpm smoke:auth-route` (500 before, 200 after). [P1] invitation expiry had no approved config location (UNI-02) → `packages/core/src/security/limits.ts`.
- R3 (Revision required): [P0] the decisions log attributed an assistant-generated reply to Charlie → relabelled a builder proposal. [P2] unverified email can accept an invitation when its ID is known → deferred by Bob to the Phase 1 email-adapter PR.
- R4 (Blocked on evidence): Bob could not see Charlie's "yes and yes" given in the Andy session. [P3] stale password-length reason in DECISIONS → fixed. Charlie was asked to confirm to Bob directly.
- R5 (**Approved with conditions**): no open P0-P1. CI green on the final head.

## Deferred conditions
- Verified-email invitation acceptance (`requireEmailVerificationOnInvitation: true` with verified vs unverified tests, plus expiry and resend): Phase 1 email-adapter PR, before invitations are externally usable.
- AUTH-06 shared persistent rate limits with Charlie's chosen numbers and cross-instance and restart tests: Phase 1 auth/security PR, before any externally reachable deployment.
- Phase 0 must not be deployed externally until then (runbook).

## Decisions worth keeping
- Recorded in `docs/DECISIONS.md` (2026-10-12 "Phase 0 PR 2 (Tasks 6-10)" and 2026-10-13 "Fixed security values live in `packages/core/src/security/limits.ts`"), now on `main`.
- Charlie confirmed in his own words on 2026-10-13: "yes and yes" to (1) `limits.ts` as the home for fixed security values and (2) a max password length of 128 (Better Auth's built-in default, not pinned in our config).
- A reply that arrives through the multiple-choice tool but reads like assistant advice is not the owner's own words. Check before recording (Bob R3 P0).
- Under the 1.7.1 kit on `main`, the post-merge cleanup rule is not yet in force. PR #23 (kit 1.7.4) has not merged.

## Follow-ups
- Phase 1 email-adapter PR: verified-email invitation acceptance. Phase 1 auth/security PR: persistent rate limits.
- Strengthen the duplicate-sign-up test (AUTH-05, Bob P3): compare HTTP status and safe response fields, and assert no stored profile field leaks.
- Wire `pnpm smoke:auth-route` into CI (plan Task 17).
- `next dev` creates untracked `apps/web/AGENTS.md` and `apps/web/CLAUDE.md`: decide to ignore them in `.gitignore` or commit them.
- A LAN `http://192.168.x.x` dev address gets Secure cookies and sign-in will not work there; loopback dev is unaffected.
- Rebase PR #23 (kit 1.7.4): `docs/DECISIONS.md` conflict. PR #23 also waits for Charlie's master-kit fix to `roles/reviewer.md` (Bob R2 P2).
- PR 3 (Tasks 11-14, `feat/p0-auth-ui`) starts from the updated `main`. Charlie must type `build`. UI tasks follow emilkowalski/skills first, then smoothui.dev, then ui.shadcn.com.
- Cleanup needing Charlie's OK: merged worktrees and local branches, including `feat/p0-auth-db` and `.agent/worktrees/build-feat-p0-auth-db` (kit 1.7.4's auto-cleanup is not in force on `main` yet).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-22.md (that file is local only). -->

## Round 5 — 2026-10-13 · scope: Phase 0 PR 2 slice (Tasks 6–10)
- **Code review:** base (merge base) `70520f6e401e8cc7514ca93b10481dbe3fc012eb` · head `01196a43bafe971b375746505d3d18a7e3d50038` · host head rechecked at end: yes, PR open
- **Spec context:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 approved revision 4 · `git hash-object` `eb89f4ab817c79c536cd36f8aef7c643a059d697`

### Findings

### [P2] Unverified email can accept an invitation when its ID is known
- Category: material security risk
- Rule: AUTH-08; approved spec “Authentication and sessions.”
- Evidence: `apps/web/src/lib/auth/config.ts:40` still omits `requireEmailVerificationOnInvitation`. Installed Better Auth 1.7.6 `organization/routes/crud-invites.mjs:30-37,265-277` defaults the verified-email requirement off for generated UUID invitation IDs; acceptance checks the ID and matching signed-in email. Phase 0 has no email sender and `docs/runbooks/phase-0-auth-database.md:6-9` forbids external deployment.
- Failure scenario: someone with a valid ID signs up using the invited address without proving mailbox control, then accepts during the 30-minute window.
- Required correction: enable verified-email acceptance and test unverified refusal and verified acceptance when the email adapter makes invitations externally usable.
- Owner: builder.
- Verification: real-Postgres tests for both cases, plus expiry and resend.
- Disposition: deferred to the Phase 1 email-adapter PR, before externally usable invitations.
- Status: open from Round 3; no code change in R4–R5.

### [P2] Persistent auth rate limiting remains deferred
- Category: material risk / guardrail mismatch
- Rule: AUTH-06.
- Evidence: `apps/web/src/lib/auth/config.ts` still has no persistent `rateLimit.storage`; the approved Phase 0 plan sequences DB-backed limits to Phase 1 and the runbook forbids external deployment.
- Failure scenario: guesses can be distributed across instances or reset by a process restart.
- Required correction: add shared persistent limits with Charlie's chosen numbers before external deployment.
- Owner: Charlie for values; builder for implementation.
- Verification: integration tests across two instances and a restart.
- Disposition: deferred to the Phase 1 auth/security PR, before any externally reachable deployment.
- Status: open from Round 3; no code change in R4–R5.

### [P3] Duplicate-sign-up assertion remains weaker than the plan's uniform-response requirement
- Category: test coverage
- Rule: AUTH-05; Phase 0 plan Review Focus #1.
- Evidence: `apps/web/src/lib/auth/auth.test.ts:113-135` compares null tokens and response keys but not HTTP status or safe field values. No test change in R4–R5.
- Required correction: in a later auth-test cleanup, compare status and safe response fields and assert no stored profile field leaks.
- Owner: builder.
- Status: open, non-blocking.

#
