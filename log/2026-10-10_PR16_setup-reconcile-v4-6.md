# PR 16 — chore(setup): reconcile PROJECT.md to approved spec v4.6 (3d0d99ab)

- **Merged:** 2026-10-10T06:53:13Z (GitHub) · **Merge commit:** `a347854604081fa8cd253382c16ce7df79692d3d` · **Branch:** `chore/setup-reconcile-v4-6-approved` (final head `eb9204ec14b624b3c8e274f0f8b497e677bd800c`)
- **Gate breaches:** none. The final review round's head SHA (`eb9204e…`) equals the PR's final head SHA, and the receipt was written before the merge (44 seconds before; see below).
- **Approval receipt:** `reviews/PR-16.receipt` on `agent-logs`, commit `5694fe6` (written 2026-10-10T06:52:29Z; merge was 2026-10-10T06:53:13Z; reviewed head `eb9204ec14b624b3c8e274f0f8b497e677bd800c`; review-file hash `9700a9d670f1661c08c6dab14f65cc8d3e8447a5`, archived in commit `c4ecb93`)
- **Merge evidence:** `gh pr view 16` → state MERGED, merge commit above; `git merge-base --is-ancestor a347854 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-10).
- **Drafted by:** Claude Sonnet 5.5 (read-only comparison by an Opus 5.5 sub-agent; builder verified and applied) · **Final verdict:** Approved (round 1)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.6 revision 11, APPROVED, hash `3d0d99abce0e07c7e1286f77eafd5a8fbce83791` (equals `PROJECT.md` §2) · **Plan:** none · **Milestone:** `setup` complete; `build` (Phase 0 PR 2, tasks 6-10) next

## What changed
`agents/PROJECT.md` (one file, 14 insertions, 6 deletions): spec hash `27b43efc…` becomes `3d0d99ab…`; §2 spec row says v4.6 revision 11 approved 2026-10-09 (v4.5 superseded); §1 markets line (base currency can change; frozen `base_currency`/`fx_rate`/base totals per finalized document); §9 new currency-rules bullet and MON-02 wording; §11 VPS citation and the list of open versus resolved Open questions. "Log tracking starts at" untouched. `CLAUDE.md` NOT changed.

## Why
Kit gate order: Bob's spec review, owner approval, then `setup` Part B reconcile, then `build`. Closed PR #8 reconciled too early; this one ran after Bob R5 (Approved) and Charlie's "approve 4.6". `setup` asks for the deep tier; the builder was on Sonnet 5.5, said so, and used an Opus 5.5 sub-agent for the comparison.

## Review rounds
- R1 (2026-10-10, **Approved**): no findings; CI green on the final head.

## Deferred conditions
- none

## Decisions worth keeping
- Reconcile edits restate approved spec rules only; no exception was added; proposed exceptions TEN-02, REC-01, AUTH-01 remain PROPOSED.
- `CLAUDE.md` lies outside the kit markers; changing it needs Charlie's explicit OK (precedent: DECISIONS 2026-10-03). Three small edits are ready and held.

## Follow-ups (before `build`)
- **Spec gate:** `build` needs a review round in `.agent/reviews/SPEC-core-sales-design.md` for the exact current spec hash `3d0d99abce0e07c7e1286f77eafd5a8fbce83791`. Bob R5 Approved covers `7d402bb9a79af423daa06c75de86bf2d74857b01` (the approval PR changed only the Status line). Charlie decides: a short Bob round on `3d0d99ab…`, or an explicit ruling.
- Opus 5.5 confirmation of Bob's spec review (R5 advice) is still undecided.
- Charlie's OK for the three `CLAUDE.md` edits (Source of truth v4.5 to v4.6; Status bullet; plan/next-step bullet).
- Add the UI-kit direction (emilkowalski/skills first, then smoothui.dev, then ui.shadcn.com) and "why PostgreSQL" to `docs/DECISIONS.md` through a reviewed PR.
- Cleanup needing Charlie's OK: worktrees `.agent/worktrees/build-chore-next-16-3-8` and `.agent/worktrees/build-chore-audit-source-map-js`; local branches `chore/setup-reconcile-v4-6-approved`, `docs/spec-v4.6-approved`, `docs/spec-v4.6-rev11`, `docs/spec-v4.6-rev10`, `chore/audit-handlebars`, `chore/next-16-3-8`, `chore/audit-source-map-js`, `chore/setup-reconcile-v4-6`, `chore/agent-kit`, `docs/spec-v4.6-service-currency`, `docs/spec-v4.6-rev8`, `docs/spec-v4.6-rev9`; old `.claude/worktrees/` folders.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-16.md (that file is local only). -->

## Round 1 — 2026-10-10 · scope: slice
- **Code review:** base (merge base) `c79fd762a8cadf86249f42f04db88934ccf02cb8` · head `eb9204ec14b624b3c8e274f0f8b497e677bd800c` · head re-checked at end: yes
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 revision 11 approved · hash `3d0d99abce0e07c7e1286f77eafd5a8fbce83791`

**Verdict:** Approved
**Model used:** GPT-6.1 · **Switch model next step?** No — this change reconciles project metadata to already-approved spec text; no new design choice is made.

### Findings

No blocking findings.

### Self-check audit

Applicability was determined from the `agents/PROJECT.md` reconciliation diff before comparing the PR self-check.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `UNI-02` | Yes; §1, §2 and §9 restate business facts from the spec. | Pass | Pass | Each changed currency rule cites an approved spec section; project spec hash matches the spec file. | None |
| `UNI-07` | Yes; secret hygiene applies to every change. | Pass | Pass | Exact-head Secret scan passes. Local scan finds only the scan-pattern text itself, no secret value. | None |
| `UNI-12` | Yes; scope/write boundary applies. | Pass | Pass | One in-repository project metadata file changed; detached checkout is clean. | None |
| `UNI-13` | Yes; CI delivery gate applies. | Pending CI | Pass | Exact-head Dependency audit, Secret scan, and Typecheck/lint/test pass. | None |
| `UNI-14` | No; no dependency, lockfile or toolchain change. | N/A | N/A | Diff changes only `agents/PROJECT.md`. | None |
| `PROJECT.md` §9 / setup reconcile gate | Yes; the PR adds the approved v4.6 constraints and advances the reconciled spec hash. | Pass | Pass | Updated facts match the approved spec; `git hash-object` matches the recorded hash; no double-braced fields remain. | None |

### Verification performed

| Command / check | Result |
|---|---|
| Pin PR #16 | Open against `main`; base/merge base `c79fd762a8cadf86249f42f04db88934ccf02cb8`; exact head `eb9204ec14b624b3c8e274f0f8b497e677bd800c`. |
| Three-dot diff | One file, `agents/PROJECT.md`; 14 insertions and 6 deletions. |
| Compare reconciled spec hash | `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` = `3d0d99abce0e07c7e1286f77eafd5a8fbce83791`, matching §2. |
| Re-read changed §1, §2, §9 and §11 | Markets/base-currency facts, v4.6 currency constraints, resolved/open question statuses and approval references match the approved spec and decisions log. Proposed hard-rule exceptions remain proposed, not silently accepted. |
| Unresolved setup fields | No `{{` fields remain in `agents/PROJECT.md`. |
| `git diff --check <merge-base>...<head>` | Passed. |
| Project secret-scan pattern on changed file | Only the pattern itself appears in the command documentation; no secret value. |
| Exact-head CI | Dependency audit, Secret scan, and Typecheck/lint/test passed (run `38020958014`). |
| Local tests/build | Not run; metadata-only reconciliation and exact-head CI is green. |
| Detached checkout | Exact head; tracked status clean. |

### Residual risks and test gaps
- The spec-review gate for the post-approval hash `3d0d99ab…` and the recommended Opus 5.5 confirmation remain open before `build`, as recorded in the PR description. Charlie decides whether to obtain that review confirmation.
- `CLAUDE.md` remains at v4.5 pending Charlie's explicit approval to edit its text outside the kit markers; this PR correctly leaves it unchanged.
- This approval applies only to head `eb9204ec14b624b3c8e274f0f8b497e677bd800c`.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.
