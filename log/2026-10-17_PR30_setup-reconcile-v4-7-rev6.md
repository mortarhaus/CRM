# PR 30 — chore(setup): reconcile PROJECT.md and CLAUDE.md to spec v4.7 revision 6 (hosting)

- **Merged:** 2026-10-17T07:43:23Z (GitHub) · **Merge commit:** `bccb846248f4d21f62c4dc21a3e5a15eef415b89` · **Branch:** `chore/setup-reconcile-v4-7-rev6` (final head `df507189199a562e0cb492e8deb857e36e827d4c`)
- **Gate breaches:** none. The final review round's head SHA (`df50718…`) equals the PR's final head SHA, and the receipt was written before the merge (receipt commit `cf4883f`, 2026-10-17T07:36:26Z; merge 2026-10-17T07:43:23Z).
- **Approval receipt:** `reviews/PR-30.receipt` on `agent-logs`, commit `cf4883f` (reviewed head `df507189199a562e0cb492e8deb857e36e827d4c`; review-file hash `2c426fb1d467d31559f6084d672e35efe8bf0d30`; review committed in `700fe93857ba3fa55d11a87226d6726a18707c1d`).
- **Merge evidence:** `gh pr view 30` → state MERGED, merge commit above, head `df50718…`, base `main`; all four CI jobs passed on that head (image job 26m12s); `git merge-base --is-ancestor bccb846 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-17).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 1)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 6, hash `0b4068967dd767addfcc791587317d4445ee4159` · **Plan:** none · **Milestone:** Phase 1 gates (reconcile)

## What changed
`agents/PROJECT.md`: the spec row says v4.7 revision 6 (approved by Charlie 2026-10-16, Bob Rounds 14 and 15, PR #29) with revision 4 kept as history; **Spec hash at last reconcile** is now `0b4068967dd767addfcc791587317d4445ee4159`; the Phase 1 gate (b) strikes the VPS provider (Hostinger KVM 2, Malaysia) and notes the Stage 3 provider is chosen at first sale; the open-questions list drops question 4. `CLAUDE.md`: spec line says revision 6; Status records the approval and that PR #27 merged (Phase 0 complete). Two files, 8 lines replaced.

## Why
`build` stops at its reconcile gate while `PROJECT.md` holds a hash that differs from the spec on `main`. This restores the gate after the hosting spec revision (PR #29).

## Review rounds
- R1 (**Approved**): no findings. No blocking findings; the spec hash in §2 equals the blob on the PR head and on merged main; only the VPS item of gate (b) and question 4 closed; no double-braced field remains.

## Deferred conditions
- none

## Decisions worth keeping
- This PR added no decision. The decisions it reflects are in `docs/DECISIONS.md`: Hostinger KVM 2 (2026-10-15) and the hosting spec revision (2026-10-16).
- The `setup` reconcile ran on Sonnet 5.5, not the deep tier the kit asks for; the builder said so before starting and Bob reviewed the result.
- Process: `approved 30` was run before the merge, so the PR 29 receipt gap did not repeat.

## Follow-ups
- `build` should now pass its spec gate (Bob Round 15 for hash `0b406896…`) and reconcile gate (`PROJECT.md` hash equals the spec on `main`).
- Phase 1 plan still needs the other gates in the spec: the rate-limit numbers and the OTP re-issue cap, the `crm_purge` read policies, a RESTRICTIVE tenant policy on each tenant table (TEN-07), `/api/auth/*` as unauthenticated surface (UNI-19), and the archive job removed or replaced (UNI-10). Several are owner choices. The Stage 3 database provider is chosen at first sale and tested at the spec's pre-cutover gate. The R2 backup region must be stated before the Phase 4 PDPA professional check.
- Master-kit question for Charlie: how `approved` works for a spec-only PR (review in `SPEC-<slug>.md`, no `PR-<n>.md`).
- Not installed, needs Charlie's OK after a read: the emilkowalski/skills pack. Docs bundle still open: PR #21 "Exception to a rule?" wording, the UI-kit direction, the "why PostgreSQL" entry.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-30.md (that file is local only). -->

## Round 1 — 2026-10-17 · scope: setup reconcile slice
- **Code review:** base and merge base `cc3afd70c4f5efde543f304071552d5ae43db32d` · head `df507189199a562e0cb492e8deb857e36e827d4c` · head rechecked at end: yes, still open at the same SHA.
- **Spec review basis:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · approved v4.7 revision 6 · hash `0b4068967dd767addfcc791587317d4445ee4159` · Bob's spec Round 15 Approved for that exact hash.

**Verdict:** Approved  
**Model used:** GPT-6 · **Switch model next step?** No for the mechanical `approved 30`/`merged 30` steps. Use the project's deep tier, Opus 5.5, for the later Phase 1 plan and its security and tenancy decisions.

### Findings

No blocking findings. The eight replaced lines in `agents/PROJECT.md` and `CLAUDE.md` reconcile the approved spec and merged PR history without changing a product rule or closing the other Phase 1 gates.

### Self-check audit

| Rule | Applies? | Builder said | Reviewer found | Evidence |
|---|---|---|---|---|
| UNI-07 | Yes, committed files | Pass | Pass. The diff contains project facts and hashes, no secret value. | Two-file diff; secret scan green on this head. |
| UNI-12 | Yes, write scope | Pass | Pass. Only `agents/PROJECT.md` and `CLAUDE.md` change. | `git diff --name-status <base>...<head>`. |
| UNI-13 | Yes, CI gate | Pending | Typecheck/lint/test, dependency audit and secret scan pass; Image/Trivy/E2E remains pending at review time. It must pass before merge. | GitHub PR #30 checks on `df50718`. |
| `START.md` setup reconcile | Yes | Pass | Pass. The spec hash in §2 equals the blob on both PR head and merged main; §11 closes only the VPS choice, and the open-question list drops only question 4. The other phase gates and owner decisions remain. No double-braced field remains. | `agents/PROJECT.md:28-29,243-249`; spec `:259,962,1000,1053`; `rg` for `{{`. |
| `CLAUDE.md` kit marker | Yes, entry file edited | Implicit pass | The marker block is byte-identical to main; four changed lines are outside it and update previously owner-authorized project prose. The source-of-truth version and phase status match the merged facts. | `CLAUDE.md:6,14-16`; marker block comparison; PR #21 owner authorization. |
| Other active packs / `PROJECT.md` §9 | No changed code or behavior | Not listed | N/A for this metadata-only reconcile. All architecture and business constraints remain unchanged. | Complete two-file diff. |

### Verification performed

| Check | Result |
|---|---|
| `git fetch origin`; GitHub PR #30 metadata; `git merge-base`, `git diff --stat`, `git diff --name-status`, `git log` | Host base `cc3afd7`, head `df50718`; one commit; only two intended files, four lines replaced in each. |
| Detached review checkout attempt | `git worktree add --detach` failed because this sandbox cannot create `.git/worktrees`; used the exact-head `git archive` snapshot at `.agent/worktrees/review-30-df507189`. |
| Snapshot integrity | 141 paths in `git ls-tree`, 141 extracted, no missing or extra path. Initial and final SHA-256 file-list fingerprints both `0e1c6a87e86527fbd5f8584e368e75c728e354b6a77d73f28fc36222b76ae0e0`. |
| Spec hash and merged history | Snapshot spec and merged main both hash to `0b4068967dd767addfcc791587317d4445ee4159`. GitHub confirms PR #29 merged as `cc3afd7` on 2026-10-16 and PR #27 as `b90dc48` on 2026-10-15, matching the prose. |
| `git diff --check`; `rg` for double opening braces in `PROJECT.md` | No whitespace error or unresolved setup field. |
| Local tests, build, database and UI checks | Not run for this documentation-only review. Same-head CI provides the project checks listed above; image job is still pending. |

### Residual risks and test gaps

- CI's Image/Trivy/E2E job is pending, so this verdict does not clear the UNI-13 merge gate by itself.
- The Phase 1 rate-limit values, `crm_purge` read policies, restrictive tenant policy, auth route surface and archive-job design remain open before the Phase 1 plan, as recorded in §11. This PR does not decide them.
- The builder used Sonnet 5.5 for `setup` and disclosed that it was not the project's deep tier. I rechecked the exact reconcile values here; future Phase 1 design still needs the deep tier.

### Required before merge

- Required CI checks green on this same head, then run `approved 30` to archive this review and create its receipt **before** Charlie merges PR #30.

### Deferred conditions

- None introduced by this PR. The spec's named phase-plan gates remain in force.

### Optional improvements

- None.
