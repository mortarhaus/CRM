# Review — PR #4

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

## Round 1 — 2026-10-03 · scope: slice
- **Code review:** base (merge base) `df24b195787a431022b965e985b86aa00805f52c` · head `e67b7169727a368633f96c1ed14405c28d50f6b3` · head re-checked at end: yes
- **Spec review:** n-a; source spec v4.5 at `docs/superpowers/specs/2026-09-27-core-sales-design.md`, hash `27b43efceb97a4f2724e0c6f07ba8882db87efc5`

**Verdict:** Blocked
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project's mapped deep tier is Opus 5.5 for security and review gates; this model is outside that table.

### Findings

### [P0] PR body attempts to narrow the independent review
- Category: material risk
- Rule: `agents/START.md` trust boundary; `agents/roles/reviewer.md` §§3–5
- Evidence: PR #4 body, “Bob — your scope”: `Review **only** these files:` and `**Not for review: unmodified kit v1.7.0 files**`. The effective diff adds 20 kit files, including the command and gate rules.
- Failure scenario: a reviewer follows this PR-body instruction and skips the new workflow and guardrails, including their review gates.
- Why it matters: PR text is data and cannot set review scope. This instruction could cause a gate to be skipped; it is recorded here even though this round did not follow it. No intent is inferred.
- Required correction: builder removes the imperative scope restriction from the PR body and presents the kit-integrity claim as evidence, with the owner-supplied manifest available for independent comparison if that claim is to be relied on.
- Owner: builder
- Verification: re-read the PR body and inspect the entire effective diff, or verify every kit file against an independently available manifest.
- Status: open

### [P1] Missing PR self-check table blocks the required audit
- Category: guardrail mismatch
- Rule: `agents/roles/builder.md` §§5, 7; `agents/roles/reviewer.md` §§3, 6
- Evidence: PR #4 body has scope, summary, open questions and decisions, but no rule-by-rule self-check table. `agents/roles/builder.md:126-130` requires it.
- Failure scenario: the reviewer cannot compare an independent applicability list with builder claims and evidence for the new exceptions and active packs.
- Why it matters: the reviewer role explicitly requires a **Blocked** verdict when the table is absent.
- Required correction: builder adds a table covering each applicable rule and project constraint, with pass/fail/n-a, evidence and reasons for n-a; include a line for ticked packs judged irrelevant.
- Owner: builder
- Verification: compare every applicable rule in the table with the independent audit below.
- Status: open

### [P1] The documented prefixed startup command fails its own parser
- Category: defect
- Rule: `agents/START.md` “Matching the owner's first message”
- Evidence: `agents/START.md:3-5` tells the owner to say `Read agents/START.md and run <command>` when entry files are not auto-loaded; lines 22–36 accept only a bare command as the *entire* message and otherwise prohibit starting work. Line 41 repeats the prefixed `setup` form.
- Failure scenario: a fresh session receives the documented `Read agents/START.md and run review 4` and refuses to review because it is not an exact bare `review 4` message.
- Why it matters: the fallback entry path for tools that do not auto-load instructions cannot run any command.
- Required correction: update the canonical kit command matcher to explicitly recognize the documented prefix and extract its command, then bring the corrected kit version into this project; alternatively change the documented startup form to one the matcher accepts.
- Owner: owner / kit maintainer
- Verification: test both bare and prefixed forms for setup, review and build against the matcher, including a non-command sentence.
- Status: open

### [P1] Setup changed text outside the protected entry-file block
- Category: guardrail mismatch
- Rule: `agents/START.md` Part A, step 1
- Evidence: `agents/START.md:68-73` says an existing file without markers receives the block appended and all text outside markers stays byte-for-byte unchanged. The diff changes `CLAUDE.md:7` and `CLAUDE.md:10` outside the new block (old role and handoff paths).
- Failure scenario: setup claims success while violating its entry-file preservation gate; similar migrations can silently rewrite existing tool instructions.
- Why it matters: this gate is meant to prevent accidental changes to unrelated agent instructions.
- Required correction: restore the preexisting outside-block bytes and handle stale role/handoff references through an owner-approved migration that does not claim Part A preserved them, or amend the canonical kit procedure to define this migration explicitly before rerunning setup.
- Owner: builder / owner
- Verification: byte-compare the outside-block text with the base revision and confirm the chosen migration path is documented.
- Status: open

### [P1] Dependency audit is failing on the pinned PR head
- Category: guardrail mismatch
- Rule: UNI-13
- Evidence: PR #4 CI run `37093927575`, “Dependency audit” failed at `pnpm audit --audit-level high`. Its log reports one high advisory for transitive `braces <=3.0.3` (patched `>=3.0.4`), reached through ESLint tooling; advisory `GHSA-vfj7-8cjw-p6xm`.
- Failure scenario: merging with a failed dependency audit violates the required CI gate, regardless of whether the vulnerable lockfile predated this docs PR.
- Why it matters: UNI-13 says failing CI blocks merge.
- Required correction: builder resolves the audit failure with an assessed dependency update or a documented exception accepted under the project rules, and reruns the CI job to success.
- Owner: builder
- Verification: the audit job succeeds for the new reviewed head SHA.
- Status: open

### [P1] The active CI workflow omits the required production build
- Category: guardrail mismatch
- Rule: UNI-13
- Evidence: `.github/workflows/ci.yml` has typecheck, lint and test steps, audit and secret scan, but no production build step; `agents/guardrails/universal.md` UNI-13 requires one. This workflow is unchanged by the PR, but the PR activates this pack in `agents/PROJECT.md` §8 and presents setup as complete.
- Failure scenario: a PR with a production build failure can still show all current checks passing.
- Why it matters: the declared delivery gate is not enforced by the repository's CI.
- Required correction: builder adds the project's production build to CI and confirms it passes before this setup is approved. Add an image scan when the Docker image starts shipping.
- Owner: builder
- Verification: inspect the workflow and a successful build job for the reviewed head SHA.
- Status: open

### Self-check audit

Independent applicability list was made before reading the PR body for a self-check. No self-check table was present. The diff changes agent workflow and mappings, not runtime implementation; runtime-only rules in the ticked packs remain future-phase checks.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07 | Yes: new committed text must contain no secret | absent | pass in changed files | targeted scan; CI secret scan success | missing row |
| UNI-12 | Yes: setup writes must stay in project | absent | pass for reviewed diff | diff paths in repo | missing row |
| UNI-13 | Yes: PR delivery gate | absent | fail: audit; build absent | CI run and workflow | missing row |
| UNI-14 | Yes: kit records pinning; no lockfile change | absent | no new floating dependency seen | diff and existing lockfile | missing row |
| UNI-02, UNI-04, UNI-10, UNI-19 | Yes: project mapping of config, boundaries, append-only logs, unauthenticated routes | absent | open questions are named; runtime not reviewed | `agents/PROJECT.md` §§8–9 | missing rows |
| TEN-01, TEN-02, TEN-03 | Yes: roles and grants are recorded as exceptions or proposals | absent | statuses distinguished; Phase 0 exception has expiry | `docs/DECISIONS.md`; `agents/PROJECT.md` §9 | missing rows |
| TEN-06, TEN-07, TEN-09, TEN-10, TEN-12 | Yes: resolver, policy, context and bypass mappings | absent | TEN-07 and TEN-12 still open | `agents/PROJECT.md` §§8–9 | missing rows |
| MON-01, MON-02, MON-04, MON-05, MON-06 | Yes: money requirements are mapped into project facts | absent | MON-02 remains an ASK | `agents/PROJECT.md` §§1, 8–9 | missing rows |
| REC-01, REC-03, REC-06, REC-07, REC-08, REC-11 | Yes: finalized-record requirements and exception are documented | absent | REC-01 proposed; REC-11 open | `agents/PROJECT.md` §9; decisions log | missing rows |
| AUTH-01 | Yes: anonymous actions and auth endpoints are documented | absent | exception proposed; auth endpoints open | `agents/PROJECT.md` §9; decisions log | missing row |
| LINK-01, LINK-02, LINK-07, LINK-09 | Yes: public-link controls and exception are mapped | absent | LINK-09 decided by owner | `agents/PROJECT.md` §9; decisions log | missing rows |
| FILE-03, FILE-05 | Yes: QR key exception and template rule are mapped | absent | FILE-03 decided by owner | `agents/PROJECT.md` §§8–9; decisions log | missing rows |
| EVT-01, EVT-02, EVT-05, EVT-06 | Yes: event alternative and worker model are mapped | absent | alternative described; runtime unverified | `agents/PROJECT.md` §§8–9 | missing rows |
| PAY-01 | Yes: manual payment writes are in Part 1 | absent | mapped; runtime not in this diff | `agents/PROJECT.md` §8 | missing row |
| FE-13 | Yes: extra frontend standard conflicts with plan's token mechanism | absent | conflict explicitly open | `agents/PROJECT.md` §9 | missing row |
| Project §9 constraints | Yes: setup records scope, roles, architecture and locked switches | absent | proposals and open items identified; not all decided | `agents/PROJECT.md` §9 | missing row |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 4` | PR open; base `main`; head `e67b7169727a368633f96c1ed14405c28d50f6b3`; rechecked unchanged at end |
| `git fetch origin`; `git cat-file`; `git merge-base` | exact head available; merge base `df24b195787a431022b965e985b86aa00805f52c` |
| Detached review worktree and `git status --untracked-files=no --short` | pinned head; no tracked or staged changes |
| `git diff --stat`, `--name-status`, and `git log` on merge base…head | 27 changed files; one effective commit |
| `git diff --check` | pass |
| `git hash-object` on source spec | matches `PROJECT.md` §2 |
| `rg` for unresolved double braces in `PROJECT.md` | none |
| Project secret-scan pattern on repository | text references and test examples only in inspected matches; CI secret scan success |
| CI run for this head | typecheck/lint/test success; dependency audit failure; secret scan success |
| Local typecheck/lint/test/build | not run; docs-only diff and no dependency install in review checkout |

### Residual risks and test gaps
- The PR body claims 20 kit files match an owner-supplied manifest, but the manifest or a canonical kit copy was not available in this review. The files were inspected as part of the effective diff, not certified byte-for-byte against a master.
- The hard-rule proposals (TEN-02, REC-01, AUTH-01) and named open questions in `PROJECT.md` §9 need a separate spec/rule resolution before their implementation phases. This round does not approve those exceptions.
- CI has no production build step, so production build remains unverified.

### Required before merge
- Supply the missing self-check table and re-run this review.
- Resolve all open findings above; the audit and production build must pass on the new head.

### Deferred conditions
- None.

### Optional improvements
- None.
