# PR 31 — docs(spec): v4.7 revision 7 — Phase 1 gate decisions

- **Merged:** 2026-10-20T02:05:54Z · **Merge commit:** 7f7178a65c8c8ec6feebb3538727d2d005cd463b · **Branch:** docs/spec-v4.7-rev7-phase1-gates
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-31.receipt` on `agent-logs` (written 2026-10-20T02:05:39Z, 15 seconds before the merge; reviewed head `4ec37c33b8360a3d3a0d4acf6781a176d8f179a7`; review file `reviews/SPEC-core-sales-design.md`, hash `10e3f3977d649577ca79466600524ccdeef2ed49`). PR 31 has no `PR-31.md`: its review is the spec review file.
- **Merge evidence:** `gh pr view 31` state MERGED, mergedAt 2026-10-20T02:05:54Z, merge commit above; `git merge-base --is-ancestor` shows it reachable from the fetched `origin/main`. Final head `4ec37c3` equals the head in Round 24. Spec blob on `origin/main` is `50acbcfe0b402718ddd2c49f4297ce378e1b7451`, the hash Bob confirmed.
- **Drafted by:** Opus 5.5 sub-agent drafts, builder (Sonnet 5.5) edits · **Final verdict:** Approved with conditions (spec Round 24)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 revision 7) · **Plan:** none · **Milestone:** Phase 1 plan gates

## What changed
Spec v4.7 revision 7 closes the five Phase 1 plan gates: database-backed rate limits and an OTP re-issue cap; `crm_purge` split into a Phase 1 part (b1) and a Phase 9 requirement list (b2); a RESTRICTIVE tenant policy (TEN-07); `/api/auth/*` as unauthenticated surface; and no archive job in Part 1. `docs/DECISIONS.md` records the owner decisions.

## Why
These were the open Phase 1 plan gates ("Next steps after approval" → Current gates (b)). Phase 1 planning needs them decided.

## Review rounds
- R16 to R19: purge edge cases found each round (purged_at guard, insert guard, FK actions, direct DELETE of a current version, PDF render vs purge) → Charlie chose scope option "A" on 2026-10-19: Phase 1 keeps only part (b1); the purge rules become Phase 9 plan requirements, not solved.
- R20: [P1] TEN-08 isolation tests for later `crm_purge` read grants; [P2] Phase 1 privilege allow-list; [P3] stale PR summary → fixed.
- R21: [P2] TEN-08 gate in Phases 7 and 8; [P3] PUBLIC EXECUTE default; [P3] duplicated PR body → fixed.
- R22: [P3] wrong SHA in PR body → fixed. Approved with conditions.
- R23: [P2] gate (b) and Phase 1 row still said undecided → fixed after Charlie's decisions of 2026-10-20.
- R24: Approved with conditions for hash `50acbcfe…`; no new finding.

## Deferred conditions
- [P2] Phase 1 done-when tests tables that Phase 1 does not create (polymorphic-reference tests) → the Phase 1 plan PR states which reading holds and aligns the spec.
- [P3] Status line still reads "draft" on `main` → mark revision 7 approved and merged in the first later spec PR (the Phase 1 plan PR is fine).

## Decisions worth keeping
- Charlie, 2026-10-19: "A" (scope decision for `crm_purge`). Charlie, 2026-10-20: "Owner answers for PR 31: 1 ok, 2 ok, 3 yes, 4 A (remove the archive job), 5 A (the purge writes its own audit entry), 6 A (check invoice status only)" and "follow bob's suggestion" (question 2 yes; all five approved). Recorded in the spec and `docs/DECISIONS.md` (2026-10-17 entry).
- Customer-purge findings of Rounds 17 to 19 are Phase 9 plan requirements, not solved.
- Open question 8 (`crm_purge` login or `SET ROLE`) stays open for the Phase 1 plan. With PUBLIC EXECUTE revoked by default, the `crm_worker` grant measurement must include functions.

## Follow-ups
- Run `setup` to reconcile `agents/PROJECT.md` (§2 hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451`; §9 TEN-07, UNI-10, UNI-19 lines) and `CLAUDE.md` Status to revision 7.
- Then the Phase 1 plan (Opus 5.5).
- Builder note: the builder's Question 2 option labels were reversed; Bob caught it before the answer was recorded.

## Appendix — final review round

## Round 24 — 2026-10-20 · scope: Round 23 label fix, exact-hash confirmation (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7, owner decisions of 2026-10-20 recorded · hash (`git hash-object`) `50acbcfe0b402718ddd2c49f4297ce378e1b7451`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `4ec37c33b8360a3d3a0d4acf6781a176d8f179a7` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-31-4ec37c33`; its spec blob hash matches. Round 23 reviewed hash `c49329f78c6d7adc074263ab4b35353d8ac3ed5f`. This round checks the fix diff `3ec62ef..4ec37c3` (spec only, +2/−2).

**Verdict:** Approved with conditions  
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No — `approved 31`, `merged 31` and `setup` are builder procedures; the Phase 1 plan review needs the deep tier again.

This verdict applies only to hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451` at head `4ec37c3`. It confirms that the text records Charlie's 2026-10-20 decisions on the five Phase 1 gates (all approved as written; question 2 = stricter Turnstile-off limits stay) and his 2026-10-19 scope decision "A". Charlie gave the six-answer line and "follow bob's suggestion" in the Andy session; he did not dispute that record when shown it in this window.

#
