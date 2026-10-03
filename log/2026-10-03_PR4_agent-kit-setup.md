# PR 4 — chore: set up the agent kit (v1.7.0), fill PROJECT.md, retire init_andy/init_bob

- **Merged:** 2026-10-03T09:26:08Z (GitHub) · **Merge commit:** `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · **Branch:** `chore/agent-kit` (final head `079b55c4caaaca2732e0020f893339fe3e3565d5`)
- **Gate breaches:** none. The final review round's head SHA equals the PR's final head SHA, and the receipt was written before the merge.
- **Approval receipt:** `reviews/PR-4.receipt` on `agent-logs`, commit `49c8b29` (written 2026-10-03T09:24:21Z; merge was 09:26:08Z; reviewed head and review-file hash `3f19f168d646e08c2b50416586eb9a96a6c9b43a` match). Review archived in commit `49eb125`.
- **Merge evidence:** `gh pr view 4` → state MERGED, mergedBy `charliekhc`, merge commit above; `git merge-base --is-ancestor` confirms it is reachable from `origin/main` (checked 2026-10-03).
- **Drafted by:** Claude Sonnet 5.5, with an Opus 5.5 subagent for `PROJECT.md` and the owner-ruling edits · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.5) · **Plan:** none · **Milestone:** agent-kit setup (before Phase 0 PR 2)

## What changed
27 files, +1677/−336, 3 commits (setup, kit 1.7.1 update, merge of `main`). Adds the agent kit 1.7.1 in `agents/` and a filled `agents/PROJECT.md` (from spec v4.5, hash `27b43efceb97a4f2724e0c6f07ba8882db87efc5`), `AGENTS.md`, the kit block in `CLAUDE.md`, `.gitignore` entry `.agent/`, and `docs/DECISIONS.md` entries. Deletes `init_andy.md` and `init_bob.md`. Two `CLAUDE.md` lines outside the kit block were edited as a separate, owner-approved migration.

## Why
Moves the Andy/Bob workflow onto the kit: one set of commands, rules with IDs, reviews archived and logged on `agent-logs`.

## Review rounds
- R1 (Blocked at `e67b716`): [P0] PR body narrowed review scope → body rewritten; [P1] no self-check table → added; [P1] `START.md` prefixed command failed its parser → kit 1.7.1; [P1] `CLAUDE.md` changed outside the block → separate owner-approved migration recorded in `docs/DECISIONS.md`; [P1] dependency audit failing (`braces`) and [P1] no production build in CI → PR #5, merged into this branch.
- R2 (Approved at `079b55c`): two P3, optional: handoff detail sections stale (refreshed, local file); PR title names v1.7.0 (not changed; the merge commit title still says v1.7.0).

## Deferred conditions
none

## Decisions worth keeping
Kit identity rests on manifests supplied by Charlie (no master copy on this machine). Proposed, not approved, awaiting Bob: AUTH-01, REC-01, TEN-02 (all hard rules). Open question for Bob: TEN-12 (is `crm_link_resolver` a bypass?). Charlie decided: TEN-06/07, LINK-09, FILE-03, the expiring Phase 0 single dev DB user. Kit 1.7.1 now allows `set_config(…, true)`, SELECT on append-only tables and transactional enqueue, so those are no longer exceptions. All recorded in `docs/DECISIONS.md` and `agents/PROJECT.md` §9.

## Follow-ups
- `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` (hash `27b43ef…`): `build` is blocked until a kit-format spec review round exists.
- Bob's rulings on AUTH-01, REC-01, TEN-02, TEN-12 and the "Open for Bob" list in `agents/PROJECT.md` §9 (MON-02, TEN-07, UNI-10, UNI-19/AUTH-01, UNI-02, REC-11, UNI-04, FE-13).
- Charlie: the MON-02 currency; OK to remove the two old `.claude/worktrees/` folders.
- Phase 0 PR 4: image must exclude `braces`, plus image scan (from PR #5).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-4.md. -->

## Round 2 — 2026-10-03 · scope: slice
- **Code review:** base (merge base) `4d1b245baee3e4b508ccabd41b4c41b6c23a6d60` · head `079b55c4caaaca2732e0020f893339fe3e3565d5` · head re-checked at end: yes
- **Spec review:** n-a; source spec v4.5 at `docs/superpowers/specs/2026-09-27-core-sales-design.md`, hash `27b43efceb97a4f2724e0c6f07ba8882db87efc5`

**Verdict:** Approved
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project's mapped deep tier for the subsequent spec and security gates is Opus 5.5.

### Findings

### [P3] Handoff detail sections retain Round 1 state
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:36-38` lists only `e67b716` as the branch commit; line 68 still calls the audit and production-build findings open, although the header and lines 16 and 46 identify head `079b55c` with green CI. Lines 21, 43 and 74 also describe the older kit and commit state.
- Failure scenario: the next builder reads §7 and spends time resolving already-closed CI findings or treats the older commit as the current branch tip.
- Why it matters: the handoff is the next session's working context; its correct header and §5 limit the impact.
- Required correction: builder refreshes the stale detail sections to the current branch, CI and review state.
- Owner: builder
- Verification: compare handoff §§2–9 with Git history, exact-head CI and this review round.
- Status: open

### [P3] PR title still names kit v1.7.0
- Category: quality
- Rule: PR accuracy
- Evidence: PR #4 title is `chore: set up the agent kit (v1.7.0), fill PROJECT.md, retire init_andy/init_bob`; `agents/README.md` and the PR body identify the installed kit as 1.7.1.
- Failure scenario: a reader scanning the PR list or merge history records the wrong kit version.
- Why it matters: setup version is part of the audit trail, with limited operational impact because the body and files are correct.
- Required correction: builder updates the PR title to v1.7.1.
- Owner: builder
- Verification: re-read the PR title and `agents/README.md`.
- Status: open

Round 1 findings rechecked: the PR-body scope restriction is gone; a rule-by-rule self-check is present; `START.md` accepts the documented fixed prefix; the two outside-block `CLAUDE.md` edits are separately owner-approved in `docs/DECISIONS.md`; exact-head CI includes a successful audit and production build. No open P0, P1 or P2 finding remains for this slice.

### Self-check audit

Independent applicability list is carried forward from Round 1 and rechecked against the current diff before comparing the builder's new table. This PR adds workflow, mappings and decisions, with no runtime implementation.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07, UNI-12, UNI-14 | Yes: committed text, setup writes, dependency pinning | pass | pass; targeted scan finds only the scan-pattern example; all diff paths are in repo; no dependency or lockfile change | effective diff; `agents/PROJECT.md:114`; secret-scan CI | none |
| UNI-13 | Yes: delivery gate | pass via PR #5 | pass for this head; CI runs typecheck, lint, tests, production build, scoped audit and secret scan | CI run `37112155569`; `.github/workflows/ci.yml`; `pnpm-workspace.yaml` | none |
| UNI-02, UNI-04, UNI-10, UNI-19 | Yes for mapping; runtime later | n-a (recorded) | documented as open where decisions are still needed; no runtime claim accepted | `agents/PROJECT.md` §§8–9 | none |
| TEN-01, TEN-02, TEN-03 | Yes for setup exceptions and kit semantics | n-a / pass | expiring Phase 0 dev-user decision and proposed later role exception are distinct; append-only SELECT is allowed by kit 1.7.1 | `docs/DECISIONS.md`; `agents/guardrails/tenancy-rls.md`; `agents/PROJECT.md` §9 | none |
| TEN-06, TEN-07, TEN-09, TEN-10, TEN-12 | Yes for resolver and context mappings | n-a / pass | decided resolver-policy exception and open TEN-07/TEN-12 questions remain explicit; transaction-local `set_config` is allowed | `agents/PROJECT.md` §9; `docs/DECISIONS.md`; `agents/guardrails/tenancy-rls.md` | none |
| MON-01/02/04/05/06; REC-01/03/06/07/08/11; AUTH-01 | Yes for project facts and proposals; runtime later | n-a (recorded) | money and record mappings are present; MON-02, REC-11 and hard-rule proposals remain open, not silently approved | `agents/PROJECT.md` §§8–9; `docs/DECISIONS.md` | none |
| LINK-01/02/07/09; FILE-03/05 | Yes for link and file decisions; runtime later | n-a (recorded) | owner decisions for LINK-09 and FILE-03 are recorded; other controls mapped for later implementation | `agents/PROJECT.md` §9; `docs/DECISIONS.md` | none |
| EVT-01/02/05/06; PAY-01; FE-13 | Yes for job, payment and frontend mappings; runtime later | pass / n-a | kit 1.7.1 permits transactional enqueue; no relay in this design; payment and frontend questions remain future gates | `agents/guardrails/events-jobs.md`; `agents/PROJECT.md` §§8–9 | none |
| Project §9 constraints | Yes: this PR records them | n-a (recorded) | required decisions, proposals and unresolved items remain labelled; no conflicting runtime changes | `agents/PROJECT.md` §9; effective diff | none |

All ten packs are ticked in `PROJECT.md`; no ticked pack was omitted from the comparison. A documented future mapping is not treated as proof of runtime compliance.

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 4` at start and end | open; exact head `079b55c4caaaca2732e0020f893339fe3e3565d5`; three CI jobs successful |
| `git fetch origin`, `git cat-file`, `git merge-base` | exact head available; merge base `4d1b245baee3e4b508ccabd41b4c41b6c23a6d60` |
| Detached review checkout and `git status --untracked-files=no` | pinned head; no tracked or staged changes |
| `git diff --stat`, `--name-status`, `git log` on merge base…head | 27 effective changed files; setup commits plus merge of main |
| `git diff --check` and conflict-marker search | pass; no conflict markers in reviewed files |
| `docs/DECISIONS.md` comparison before and after merge | one header; all nine entries kept, including main's audit decision |
| `git hash-object` source spec; unresolved-placeholder search | hash matches `PROJECT.md`; no double-brace placeholders |
| Targeted secret scan | only the documented scan command in `PROJECT.md` matched; CI secret scan succeeded |
| CI run `37112155569` logs | typecheck, lint, six tests, production build, audit and secret scan passed on exact head |
| Local typecheck/lint/test/build | not run; exact-head CI used for this documentation-only slice |

### Residual risks and test gaps
- The owner-supplied kit manifests and canonical kit copy were not available in the repository; byte-for-byte kit identity remains unverified independently. The 1.7.1 changes and effective diff were inspected directly.
- The `braces` audit exception was approved in PR #5, is scoped and expires under its decision-log conditions. The image-content check belongs to Phase 0 runtime/image work; this slice ships no image. The advisory currently lists no patched release.
- TEN-02, REC-01 and AUTH-01 proposals, plus the named `PROJECT.md` §9 questions, require their separate spec and phase gates before implementation. This slice approval does not approve those exceptions.
- No runtime behavior, database isolation or UI path was tested; none was changed in this slice.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- Refresh the handoff details and PR title as described in the P3 findings.
