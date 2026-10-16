# PR 29 — docs(spec): v4.7 revision 6 — hosting on Hostinger KVM 2 (Malaysia), approved

- **Merged:** 2026-10-16T14:48:47Z (GitHub) · **Merge commit:** `cc3afd70c4f5efde543f304071552d5ae43db32d` · **Branch:** `docs/spec-v4.7-rev5-hosting` (final head `24317ab7168746cf686c84e32583215dcb9f2cc2`)
- **Gate breaches:** **GATE BREACH: final review was not confirmed before merge.** No approval receipt exists for PR 29: `approved 29` was not run before the merge, and there is no `reviews/PR-29.receipt` on `agent-logs`. The builder (Andy) did not tell the owner to run it; the next-step message said only "wait for CI, then merge". Not a breach: the final reviewer round exists (Bob's spec review Round 15, Approved, in `SPEC-core-sales-design.md`) and its pinned head `24317ab…` equals the PR's final head SHA. The review text and verdict were archived on `agent-logs` before the merge (spec review file hash `99c7ecec5c8305e93c002ec9085416bd029ce97a`, archived 2026-10-16 before 14:48:47Z); archiving does not create a receipt (START.md `merged` step 5).
- **Approval receipt:** missing
- **Merge evidence:** `gh pr view 29` → state MERGED, merge commit above, head `24317ab…`, base `main`; all four CI jobs passed on that head (image job 26m16s); `git merge-base --is-ancestor cc3afd7 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-16).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (spec review round 15)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 6, hash `0b4068967dd767addfcc791587317d4445ee4159` · **Plan:** none · **Milestone:** Phase 1 gates (VPS provider, hosting text)

## What changed
Spec v4.7 revisions 5 and 6, hosting wording only: Stage 2 is one Hostinger KVM 2 VPS (Malaysia); Stage 3 is a managed PostgreSQL with PITR and a transaction-mode pool, provider and region chosen at first sale, with a named pre-cutover test gate (pool and direct ports, roles and RLS isolation, pg-boss and rollback, PITR restore, PDPA location check); Open question 4 resolved; the PDPA professional check for the Stage 2 host and R2 backups stays before Phase 4 goes live; gate labels cleaned. One `docs/DECISIONS.md` entry (2026-10-16) with Charlie's words. Charlie's approval of revision 6 ("yes", 2026-10-16) is recorded in the spec Status.

## Why
The approved spec said "one Singapore VPS" and "DigitalOcean Managed PostgreSQL, Singapore". Charlie chose Hostinger KVM 2 (Malaysia) on 2026-10-15 (PR #28) and found DigitalOcean too expensive. The VPS provider was a gate of the Phase 1 plan.

## Review rounds
- Spec R13 (Revision required): [P1] the chosen-provider test was impossible in Phase 1 → moved to a Stage 3 pre-cutover gate on a staging instance; [P1] self-check missing TEN-01, TEN-02, TEN-09, EVT-01 → rows added, pending for the provider; [P2] PDPA deadline wrongly "before Phase 9" → before Phase 4 goes live for the Stage 2 host and R2 backups, again before Stage 3 cutover; [P2] VPS gate both met and unmet → intro and item 3 say met, old text marked history.
- Spec R14 (Approved): the four findings resolved; [P3] stale revision 5 labels in the PR body and gates paragraph (fixed with the approval-record edit).
- Spec R15 (**Approved**, exact hash `0b406896…`): [P3] PR title and body still carried older labels → refreshed (PR text only).

## Deferred conditions
- none from the review. The R2 backup region is not stated in the spec; it must be stated before the Phase 4 PDPA professional check.

## Decisions worth keeping
- Charlie's approval of revision 6 was the plain "yes" to the builder's question "Do you approve revision 6?"; the approval record changed the spec hash, so Bob confirmed the exact hash (Round 15), as in Round 12.
- The Stage 3 provider and region are still not chosen; they are chosen at first sale and must pass the pre-cutover gate.
- Process lesson: for a PR whose review sits in `SPEC-<slug>.md`, run `approved <number>` before the merge too. The builder must say so in the next-step message. This PR merged without a receipt.

## Follow-ups
- `setup` must reconcile `agents/PROJECT.md` §2 (spec hash `0b4068967dd767addfcc791587317d4445ee4159`) and `CLAUDE.md` before `build` passes its reconcile gate.
- Phase 1 plan needs the other open gates: rate-limit numbers and the OTP re-issue cap, the `crm_purge` read policies, a RESTRICTIVE tenant policy on each tenant table (TEN-07), `/api/auth/*` as unauthenticated surface (UNI-19), and the archive job removed or replaced (UNI-10).
- Master-kit question for Charlie: should the kit say how `approved` works for a spec-only PR (review in `SPEC-<slug>.md`, no `PR-<n>.md`)?
- Not installed, needs Charlie's OK after a read: the emilkowalski/skills pack. Docs bundle still open: PR #21 "Exception to a rule?" wording, the UI-kit direction, the "why PostgreSQL" entry.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/SPEC-core-sales-design.md (that file is local only). Round 15, the final round for this PR. -->

## Round 15 — 2026-10-16 · scope: exact-hash approval-record follow-up (PR #29)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 6 APPROVED · hash (`git hash-object`) `0b4068967dd767addfcc791587317d4445ee4159`.
- **Pin:** PR #29 base and merge base `21507058293ca5d70d62e631eac6bde8d6a134f4`, head `24317ab7168746cf686c84e32583215dcb9f2cc2`. The clean builder worktree and committed head have the same spec hash. Round 14 approved the rule body at `c826f3ad87558ca9b1d8de2125569ad24fe6a464`; this round checks the four approval-record edits between those blobs.

**Verdict:** Approved  
**Model used:** GPT-6 · **Switch model next step?** No; this is an exact-hash approval-record check, and Round 11 was the independent Opus 5.5 full-spec review.

### Findings

No new P0, P1 or P2 finding. The spec diff from Round 14 changes exactly the title (`:1`), Status approval record (`:3`) and Current gates paragraph (`:1053`); `docs/DECISIONS.md` adds one approval line. R6, Stage 3's pre-cutover gate, the Phase 4 professional-check deadline, data model, flows, milestones and verification cases are unchanged. The new Status quotes Charlie's “yes” to the builder's explicit “Do you approve revision 6?” question after Round 14. The decisions entry and handoff give the same provenance; Bob cannot independently see that Andy-session exchange, so this check rests on the recorded owner answer rather than an invented one. The current gate text correctly puts merge after green CI and `setup` after merge to reconcile the final hash.

#### [P3] PR body has stale hash and revision labels
- Category: documentation polish.
- Rule: exact revision and gate provenance.
- Evidence: PR #29's top status block names head `24317ab` and hash `0b406896…`, but its “Gates” section still says `c826f3ad…` is the hash “on this head”; its “What” section still says the Current gates label is revision 5. The spec itself now labels Current gates revision 6 (`:1053`) and has the new hash above. The PR title also still says revision 5, reflecting the first hosting draft. The old approval-record clause at spec `:3` says the 2026-10-11 record changed only gate (a), while that older amendment actually touched gates (a)–(e) (Round 12 P3); it is historical and does not alter this approval.
- Failure scenario: a reader using the PR body alone cites the prior reviewed blob or an old revision label. The current head/status block and spec record the correct hash and approval.
- Why it matters: provenance is easier to follow when every PR summary names the final blob consistently; this is not a change to an operative rule.
- Required correction: refresh the PR body before merge to identify the final hash and revision 6 throughout. Leave the historical spec clause for a later reviewed spec edit if desired; changing it now would create another hash and require another spec review.
- Owner: builder.
- Verification: PR body hash, title and revision labels match the final head and spec.
- Status: open, nonblocking.

### Applicability and verification

- Scope is approval provenance and exact-hash consistency. The Round 14 applicability check of UNI-07, UNI-12, UNI-13, TEN-01, TEN-02, TEN-09 and EVT-01 remains valid because the hosting rule body and PR self-check table did not change. The phase-specific owner choices remain deferred at their named gates.
- `git diff 223c6ee..24317ab` contains three spec-line replacements and one decisions-log line; `git diff --check` passes. `git show 24317ab:<spec> | git hash-object --stdin` and the clean builder worktree both return `0b4068967dd767addfcc791587317d4445ee4159`.
- GitHub PR #29 still has its current head at `24317ab`. At the final check, dependency audit, secret scan and typecheck/lint/test pass; Image/Trivy/E2E is pending. No code tests or deployment checks were run locally for this document-only follow-up. Required CI must be green before merge (UNI-13).

### Next step

The owner approval is recorded. Once PR #29's required CI is green, Charlie can merge it. Then run `setup` to reconcile `agents/PROJECT.md` and `CLAUDE.md` to this exact final spec hash before `build` relies on the hosting revision.
