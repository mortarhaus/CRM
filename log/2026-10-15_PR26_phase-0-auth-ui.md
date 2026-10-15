# PR 26 — feat(web): Phase 0 PR 3 — health, sign-up/in, 2FA, workspaces (Tasks 11-14)

- **Merged:** 2026-10-15T02:04:21Z (GitHub) · **Merge commit:** `074018f8fecc4770de1772e37c2c69821cd0aca1` · **Branch:** `feat/p0-auth-ui` (final head `3cdede217e78943df64bc930a057bde0824b218a`)
- **Gate breaches:** none. The final review round's head SHA (`3cdede2…`) equals the PR's final head SHA, and the receipt was written before the merge (receipt commit `d2fb2eb`, 2026-10-14T15:06:15Z; merge 2026-10-15T02:04:21Z).
- **Approval receipt:** `reviews/PR-26.receipt` on `agent-logs`, commit `d2fb2eb` (reviewed head `3cdede217e78943df64bc930a057bde0824b218a`; review-file hash `0f426a6bab7b29dce39658b8a5f0c2a184bd2a4b`; review committed in `16a8b89589eee31130dce39ad026486048c9e52f`).
- **Merge evidence:** `gh pr view 26` → state MERGED, merge commit above, head `3cdede2…`; `git merge-base --is-ancestor 074018f origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-15).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved with conditions (round 3)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 rev 4 (hash `eb89f4ab817c79c536cd36f8aef7c643a059d697`) · **Plan:** `docs/superpowers/plans/2026-09-29-phase-0-foundation.md` Tasks 11-14 · **Milestone:** Phase 0 (PR 3 of 4)

## What changed
Health check `/api/health`; sign-up, sign-in, 2FA code step, 2FA enrolment, workspace create and switch, and sign-out, all as Server Actions that post to Better Auth through its HTTP handler (`postToAuth`) so the rate limiter and origin checks still apply, and that work without JavaScript (FE-31/32). Shared security limits in `packages/core/src/security/limits.ts` (password 15 to 128, name 100, workspace name 80) enforced by an `enforceInputLimits` hook; passwords normalized to Unicode NFC before hashing and verifying. Playwright end-to-end tests at 320, 768 and 1280 px (81 passes at the final head) with axe checks, plus JavaScript-disabled specs.

## Why
Phase 0 plan Tasks 11-14: the sign-up/sign-in, 2FA and workspace slice that the Phase 0 "done when" checks need.

## Review rounds
- R1 (Revision required): [P1] production build fails at the root page → session reads `headers()` before auth; [P1] hardcoded form limits → shared limits file, owner choices; [P1] forms need JavaScript → server-action forms; [P1] accessibility and width evidence → axe, keyboard and width specs; [P1] self-check omissions → AUTH-13, FE-50, FE-70 rows added; [P2] sign-out navigates on failure → navigates only after confirmation; [P2] Unicode policy → NFC (owner); [P2] expired 2FA message → deferred to Phase 0 PR 4.
- R2 (Revision required): [P2] name fields truncate valid Unicode → native `maxLength` removed, server checks kept, boundary tests; [P2] malformed workspace id reaches the uuid lookup → uuid check before Better Auth; [P3] stale PR text → fixed.
- R3 (Approved with conditions): no blocking findings.

## Deferred conditions
- [P3] The PR description's "Notes for Bob" still said a non-UUID workspace id reaches Better Auth and returns a 500. The code and tests are correct; only the PR text is stale. The builder offered to fix it before the merge, and the owner merged without answering, so the note stays in the merged PR text. No follow-up PR is needed; this log is the correction.
- [P2 from R1, accepted by the reviewer] Expired or exhausted 2FA challenge shows the wrong-code message: **Phase 0 PR 4**, before any production release.

## Decisions worth keeping
- In `docs/DECISIONS.md` (2026-10-14): password minimum 15 and maximum 128, shared limits file, forms that work without JavaScript, NFC; the three remaining FE-32 controls ship in this PR ("all three yes"); no native `maxLength` on the password field ("remove maxLength"); UI components (shadcn, SmoothUI) are added only when a screen needs one, each reviewed and recorded ("#2 follow bob" plus Bob's option A text).
- The name fields also lost `maxLength` on Bob's Round 2 finding (UTF-16 units versus code points), consistent with the password decision.
- Better Auth 1.7.6 clears the session's active workspace when it refuses a workspace the user is not a member of (library behaviour, `crud-org.mjs`).
- Forms must post through `postToAuth`, not `auth.api`, or the rate limiter and origin checks are skipped.

## Follow-ups
- Phase 0 PR 4 (Tasks 15-17): Docker image, entrypoint, CI image job; also the expired 2FA message, and wiring `pnpm test:e2e` plus the smoke check into CI. Charlie must type `build`.
- Phase 1 gates still open: VPS provider (Hostinger KVM 2 or iCore NODE2), persistent rate limits (AUTH-06), verified-email invitations, roles/RLS/`action()`.
- Not installed, needs Charlie's OK after a read: the emilkowalski/skills pack.
- Cleanup needing Charlie's OK: branch `feat/p0-auth-db` and worktree `.agent/worktrees/build-feat-p0-auth-db`, plus older merged branches and worktrees.
- Docs bundle still open: PR #21 "Exception to a rule?" wording, the UI-kit direction, and the "why PostgreSQL" entry.
- A process outside this work holds port 3000; the default Playwright web server fails while it runs. Use `E2E_BASE_URL` with your own port (see the runbook).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-26.md (that file is local only). -->

## Round 3 — 2026-10-14 · scope: Phase 0 PR 3 slice
- **Code review:** base (merge base) `5b562107b8242bc2cd5a14850fc469a68865f369` · head `3cdede217e78943df64bc930a057bde0824b218a` · host head re-checked at end: yes
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, v4.7 revision 4; hash `eb89f4ab817c79c536cd36f8aef7c643a059d697`, equal to the `PROJECT.md` reconcile hash.
- **Review source:** exact-head `git archive` snapshot at `.agent/worktrees/review-26-3cdede21`; the sandbox refused `.git/worktrees` creation. The extracted 134-file list matched `git ls-tree`, and the before/after fingerprint matched (`9a1abc7dc30254dd511a318a6d5590a2dd3cb33451f7150c8d991cd47fcf2f9e`).

**Verdict:** Approved with conditions
**Model used:** GPT-6 · **Switch model next step?** Yes — the project's deep tier names Opus 5.5 for auth/security review; an independent pass on that tier is prudent before production release.

### Findings
No blocking findings.

### [P3] Remove the stale workspace-ID note from the PR description
- Category: documentation consistency
- Rule: review provenance
- Evidence: PR #26's “Bob Round 2” section says malformed IDs are refused before Better Auth, matching `apps/web/src/app/(app)/actions.ts:10-19`. Its later “Notes for Bob” still says a non-UUID ID reaches Better Auth, causes a database error/500, and that the action checks only nonempty input.
- Failure scenario: A later reviewer or maintainer follows the obsolete note and misunderstands the current server-action boundary.
- Why it matters: The code and tests are consistent; only the PR description contradicts them.
- Required correction: Delete or update the obsolete “Notes for Bob” sentences to match head `3cdede2`.
- Owner: builder
- Verification: PR body describes the UUID guard once, consistently.
- Status: open; optional follow-up, not a merge blocker

#
