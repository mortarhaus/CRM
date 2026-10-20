# PR 32 — chore(setup): reconcile PROJECT.md and CLAUDE.md to approved spec v4.7 revision 7 (Phase 1 gates)

- **Merged:** 2026-10-20T04:00:23Z · **Merge commit:** 4bf02f9ef936e071ead180330ee923730524183f · **Branch:** chore/setup-reconcile-v4-7-rev7
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-32.receipt` on `agent-logs` (written 2026-10-20T03:52:42Z, 7 minutes before the merge; reviewed head `d3bfff02276af4ed43c8954f306cfe6b8037ce66`; review file hash `7a1ea600857c4a2a36bd6bdf6f1497a7bf53a984`, equal to the local review file; log-branch commit `f66519d2c97e03a979dc5ca5270cdb7830b14c1c`).
- **Merge evidence:** `gh pr view 32` state MERGED, mergedAt 2026-10-20T04:00:23Z, merge commit above; `git merge-base --is-ancestor` shows it reachable from the fetched `origin/main`. Final head `d3bfff0` equals the head in Round 2. `agents/PROJECT.md` on `origin/main` holds spec hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451`.
- **Drafted by:** Opus 5.5 sub-agent (edits), builder Sonnet 5.5 (checks, PR) · **Final verdict:** Approved with conditions (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 revision 7) · **Plan:** none · **Milestone:** Phase 1 gates (setup reconcile)

## What changed
`agents/PROJECT.md` and `CLAUDE.md` now match the merged spec v4.7 revision 7: new spec hash, TEN-07, UNI-10 and UNI-19 / AUTH-01 marked decided by Charlie on 2026-10-20, the `crm_purge` Phase 1 scope (b1) and the TEN-06/TEN-07 exception line, the Phase 1 gate list, and a Phase 9 purge-requirements gate. No spec text or code changed.

## Why
`build` and the Phase 1 plan stop at the reconcile gate while `PROJECT.md` holds a hash different from the spec on `main`.

## Review rounds
- R1: [P1] self-check omitted TEN-02/09, TEN-03/UNI-10, TEN-06/07/08 and UNI-19/AUTH-01/06 → PR body self-check extended with evidence per rule (no commit).
- R2: Approved with conditions on the same head.

## Deferred conditions
- Phase 1 polymorphic-reference tests vs the phase that creates each table → the Phase 1 plan PR states which reading holds and aligns the spec (spec review Round 24).
- Spec Status line still says revision 7 is draft → fix in the first later spec PR (the Phase 1 plan PR is fine), citing Round 24 and `7f7178a`.

## Decisions worth keeping
- Reconcile PRs need the self-check to cover every rule whose summary changes, not only UNI-07/12/13.
- `PROJECT.md` §11 now lists what the Phase 1 plan must settle: Open question 8 (`crm_purge` login vs `SET ROLE`), `crm_worker` grants including functions (PUBLIC EXECUTE revoked by default), Round 21 P2, the Status label.

## Follow-ups
- Write the Phase 1 plan (Opus 5.5) in a feature branch/PR.
- Optional: refresh the spec Status label with that PR.

## Appendix — final review round

## Round 2 — 2026-10-20 · scope: Round 1 self-check correction (setup reconcile)
- **Code review:** base (merge base) `7f7178a65c8c8ec6feebb3538727d2d005cd463b` · head `d3bfff02276af4ed43c8954f306cfe6b8037ce66` · host head re-checked at end: yes, unchanged
- **Spec reference:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 · `git hash-object` `50acbcfe0b402718ddd2c49f4297ce378e1b7451`

**Verdict:** Approved with conditions  
**Model used:** GPT-6 (Codex), outside the project's named model map · **Switch model next step?** Yes — use the project's deep tier, Opus 5.5, for the Phase 1 security and tenancy plan.

### Findings

- **Round 1 P1 (self-check omissions): resolved.** The PR body now names TEN-02, TEN-03, TEN-06, TEN-07, TEN-08, TEN-09, UNI-10, UNI-19, AUTH-01 and AUTH-06, with evidence tied to `PROJECT.md`, the approved spec and the decisions log. UNI-13 is now marked Pass for all four CI jobs. The head and two-file diff did not change.
- **P2, deferred to the Phase 1 plan PR:** The approved spec's Phase 1 done-when still names polymorphic-reference tests for tables created in later phases. Spec review Round 24 deferred the phase alignment to the Phase 1 plan. `PROJECT.md:243` carries that requirement, including Charlie's approval if a done-when moves. This does not block this setup reconcile.
- **P3, tracked for the first later spec PR:** The spec Status line still calls revision 7 a draft and says Bob's confirmation is needed. Spec review Round 24 recorded this after-merge label issue; `PROJECT.md:29,243` carries it. No change to the approved spec hash belongs in this reconcile.
- No new finding.

### Self-check audit

The Round 1 applicability list is unchanged because head `d3bfff0` is unchanged. The amended PR body now covers every applicable item in that list. I checked the claims against the exact-head snapshot:

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07 / UNI-12 / UNI-13 | Yes: repository hygiene and merge gate | Pass | Changed files have no new secret; all four CI jobs pass | Two-file diff; changed-file secret-pattern scan; `gh pr checks 32` | No |
| `START.md` setup reconcile | Yes: purpose of PR | Pass | Approved spec hash equals `PROJECT.md:30`; only spec-supported summaries changed | `git hash-object` on exact-head snapshot; Round 24 spec review; `PROJECT.md:29-30,198,204,217-219,243-244` | No |
| TEN-02 / TEN-09 | Yes: `crm_purge` role and workspace transaction | Pass | No bypass/superuser and `withWorkspace()` retained | `PROJECT.md:198,200`; spec `crm_purge` in Phase 1 | No |
| TEN-03 / UNI-10 | Yes: append-only archive ruling | Pass | No Part 1 archive job; no runtime deletion of audit/event rows | `PROJECT.md:218`; spec Scalability; DECISIONS 2026-10-17 | No |
| TEN-06 / TEN-07 / TEN-08 | Yes: restrictive policy, resolver exception, purge isolation tests | Pass | Summary preserves restrictive workspace policy, narrow resolver exception and later grant tests | `PROJECT.md:198,204,217`; spec Tenancy and `crm_purge` in Phase 1 | No |
| UNI-19 / AUTH-01 / AUTH-06 | Yes: unauthenticated auth routes and limits | Pass | Summary preserves public route scope, `action()` exception, DB limits and uniform responses | `PROJECT.md:219,243`; spec Better Auth endpoints and Rate limits | No |
| Other ticked-pack rules | n-a: documentation-only reconcile, no behavior/schema/UI/dependency change | n-a | Reason supported by unchanged two-file diff | `git diff --name-status` | No |

### Verification performed

| Command / check | Result |
|---|---|
| Host PR metadata and exact commit | PR open; base `7f7178a…`, head `d3bfff0…`; merge base equals base and exact commit is local. Host head was unchanged at the end. |
| Exact-head snapshot | `.agent/worktrees/review-32-d3bfff02` via `git archive`, the reviewer-role fallback for the read-only `.git` sandbox. Extracted paths equal all 141 `git ls-tree` paths; pre/post SHA-256 fingerprint of all 141 files matches. |
| Effective diff | Same as Round 1: `CLAUDE.md` and `agents/PROJECT.md`, 13 insertions and 12 deletions, one commit. `git diff --check` clean. |
| Spec and decisions | Spec hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451`, equal to `PROJECT.md:30`; Round 24 approved that hash with conditions; `docs/DECISIONS.md:5-19` records Charlie's decisions. |
| CI and changed-file secret scan | Dependency audit, secret scan, typecheck/lint/test and Image/Trivy/E2E pass. The local pattern scan found only documentation of the scan pattern and `AUTH_SECRET` generation, no value. No runtime test suite was run locally for this docs-only PR. |

### Residual risks and test gaps
- The deferred Phase 1 polymorphic-test alignment and the spec Status label remain tracked above. This review approves the setup reconcile, not the Phase 1 plan or runtime implementation.
- CI results were checked on the exact head; the runtime suites were not re-run locally.

### Required before merge
- None from this review. The owner still follows the `approved 32` receipt and merge sequence in `agents/START.md`.

### Deferred conditions
- Phase 1 plan PR: align the polymorphic-reference done-when with the phases that create each table; get Charlie's approval if a done-when moves.
- First later spec PR: change revision 7's stale draft/confirmation Status label, citing Round 24 and PR #31's merge.

### Optional improvements
- None.
