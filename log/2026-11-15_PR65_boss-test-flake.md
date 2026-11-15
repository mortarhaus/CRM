# PR 65 — fix: boss.test.ts waits for the held transaction before sending (intermittent 30 s timeout)

- **Merged:** 2026-11-15T12:18:08Z · **Merge commit:** c5e4649a055f62c91b6c64771de56c935ef73c7f · **Branch:** fix/boss-test-flake
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-65.receipt` on agent-logs (log-branch commit ae942a15 holds the review-archive receipt chain; written 2026-11-15T12:12:31Z, before the merge; head a4bee55, review-file hash f5177333…)
- **Merge evidence:** `gh pr view 65` state MERGED with the time and commit above; commit reachable from fetched `origin/main` (it is the tip). Final head a4bee55 equals the reviewed head. CI run 43703589788 on a4bee55: all five jobs passed, image job ran.
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 1)
- **Spec:** none (test-only; spec unchanged) · **Plan:** Phase 1 plan Task 18 baseline · **Milestone:** Phase 2 (housekeeping)

## What changed
Two files: `apps/web/src/jobs/boss.test.ts` (26 additions, 2 deletions) and a DECISIONS entry dated 2026-11-15. The test now creates the release promise up front and signals an `isHolding` barrier from inside the transaction callback, after BEGIN and SET LOCAL, so `boss.send` is timed only while the auth connection and slot are held. No product code, schema, dependency or config changed.

## Why
`boss.test.ts:118` intermittently hit its 30 s timeout. Root cause: `release` was assigned inside the `auth.run` work callback, so `boss.send` could finish before BEGIN and the callback never ran. Under full CPU load, 3 of 20 runs failed before the fix and 40 of 40 passed after.

## Review rounds
- R1: no findings in the diff. [P3] stale fixed handoff sections → resolved during review (builder refreshed the handoff). Approved.

## Deferred conditions
none

## Decisions worth keeping
- Only inferred, not instrumented: that the four earlier CI failures (runs 43022811530, 43152940277, 43201947632, 43677922007) hung on this exact await. If the timeout recurs, reopen the 2026-11-15 DECISIONS entry.
- Pre-existing and unchanged: cleanup can still wait if the send or an assertion fails before `release()`.

## Follow-ups
- Repo goes private again now that no PR is open (`gh repo edit`, rule from DECISIONS 2026-11-14).
- Reviewer left an untracked `.pnpm-store/` in the main checkout; not mine to delete without asking.
- Next: spec line 730 revision (MY `dd/mm/yyyy` to `dd-mmm-yyyy`), then Phase 2 PR 5.

## Appendix — final review round
## Round 1 — 2026-11-15 · scope: slice
- **Code review:** base (merge base) `107163bdbcba20f0ca9228225b4566acf64d19d2` · head `a4bee55c647ab41436af82a95a41e192867816f5` · head re-checked at end: yes, unchanged, PR open.
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash `733cc0e9ce4af0771bdd2769720e3f228caf8855` (unchanged; approved version per PROJECT.md despite its known stale draft label).
- **Scope:** two-file test synchronization fix and decision-log entry, 26 additions / 2 deletions; no product implementation, schema, dependency, or configuration changes. Relevant baseline: Phase 1 plan Task 18 and the database-role runbook, “Connections and pools.”
- **Isolation:** exact-commit snapshot `.agent/worktrees/review-65-a4bee55c`. Detached worktree creation failed because the sandbox denies writes to `.git/worktrees`; used the prescribed `git archive` fallback. Extracted file list exactly matched the commit's 376 files; initial and final SHA-256 fingerprints match every original file.

### Findings

No open findings in the PR diff. The eagerly constructed release promise removes the lost-release race. The `isHolding` barrier signals inside the transaction callback, after BEGIN and SET LOCAL, so the timed send actually runs while the auth connection and slot are held. Racing that barrier against `held` propagates transaction-start failures instead of waiting on a signal that will never arrive. Existing rollback, independent-pool, and PoolBypassError assertions remain intact; neither timeout nor the 2-second assertion was widened.

### [P3] Fixed handoff sections described obsolete PR state — resolved during review
- Category: documentation inconsistency.
- Rule: reviewer §2, handoff drift reporting.
- Evidence: initial `.agent/handoff.md` read showed PR 65 in its opening line, but §0 named PR 57, §1 named `feat/p2-settings-general`, and §3 named main `1db8371`; the actual root was main `107163b`. A subsequent read showed §0 PR 65 (line 9), §1 `fix/boss-test-flake` (line 13), and §3 main `107163b` (line 24).
- Failure scenario: a subsequent builder could resume an old target using the stale fixed sections.
- Why it matters: reduces confidence in the resume point, without affecting this pinned code review.
- Required correction: refresh the fixed handoff sections to the current target and git state.
- Owner: builder (Andy).
- Verification: re-read the handoff and compare with git and the host.
- Status: resolved before this round was written; the handoff was updated concurrently, not by the reviewer.

### Self-check audit

Applicability assessed from the effective diff, universal pack and PROJECT.md §9. Procedural limitation: fetching PR metadata also exposed its body/self-check before the formal applicability audit; coverage below was independently checked against the diff rather than inferred from that table.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-01 | yes, changed TypeScript test | pass | pass | `boss.test.ts:133-146`; typed promises, no new casts or any; local typecheck passes | no |
| UNI-02 | n-a, no business value or timeout changed | omitted | n-a | effective diff | no |
| UNI-03 | n-a, no system boundary changed | n-a | n-a | only test ordering changes | no |
| UNI-04 | n-a, no import or module boundary changed | omitted | unchanged boundaries verified by lint | local lint; no import changes | no |
| UNI-05 | yes, new synchronization code | pass | pass | both deferred promises/resolvers used; no diagnostics left in diff; lint passes | no |
| UNI-06 | n-a, no dependency change | n-a | n-a | two-file diff | no |
| UNI-07 (hard) | yes, changed content must contain no secrets | pass | pass | added-line project-pattern scan: zero matches; full-history CI Secret scan succeeds | no |
| UNI-08 | n-a, no production secret handling | omitted | n-a | effective diff | no |
| UNI-09 | yes, ensure diagnostics did not enter committed content | pass | pass for committed diff | no added logging or personal data; temporary historical files not independently inspected | no |
| UNI-10 | n-a, audit implementation unchanged | n-a | n-a | effective diff | no |
| UNI-11 | n-a, no new service/integration or data transfer in change | omitted | n-a | effective diff | no |
| UNI-12 | yes, changed file locations | pass | pass for committed files | both files under project; historical temporary-work claims not independently verified | no |
| UNI-13 | yes, CI gate | pass | pass | run 43703589788 associated with exact head; all five jobs succeeded, including build, gates, image/Trivy/E2E | no |
| UNI-14 | n-a, no dependency/tooling pin change | n-a | n-a | lockfile and CI config unchanged | no |
| UNI-15 | n-a, no migration | n-a | n-a | effective diff | no |
| UNI-16 | n-a, no operational behavior changed | n-a | n-a; matching baseline runbook inspected | runbook connections/pools explanation agrees with test | no |
| UNI-17–19 | n-a, headers/cookies/endpoints unchanged | omitted | n-a | effective diff | no |
| PROJECT.md §9 | no implementation or locked switch changes; baseline pool behavior relevant | unchanged | test retains the existing pool/rollback/guard assertions | `boss.test.ts:116-160`; `system/auth-transaction.ts:108-138`; runbook “Connections and pools” | no |
| Frontend, tenancy, money, finalized records, auth, public links, files, events/jobs, payments packs | n-a to this synchronization-only diff | n-a, all domain packs | agree: no changed domain behavior or domain-rule coverage removed | production modules unchanged; test validates the deliberately independent send pool, not transactional domain enqueue | no |

### Verification performed

| Command / check | Result |
|---|---|
| Fetch origin; host metadata; local commit existence; merge base; effective diff/log | pinned exact head and main base above; one commit, two files |
| Snapshot file-list and SHA-256 checks | PASS: 376 files; no exclusions; unchanged at completion |
| Node / pnpm | v24.21.0 / 11.6.0; fnm shell initialization could not create its outside-project symlink, so used its already installed Node via PATH |
| Dependency install | offline attempt lacked cached tarballs; sandbox registry attempt failed DNS; approved retry with snapshot-local store completed frozen install |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm vitest run apps/web/src/jobs/boss.test.ts` | PASS with approved Docker access: 1 file, 5 tests, 1.86 s; initial sandbox run failed during container setup, with all 5 tests skipped |
| CI run 43703589788 | all 5 jobs successful: dependency audit, secret scan, changed-files decision, typecheck/lint/test/gates/build, image/Trivy/E2E; image job actually ran |
| `git diff --check <base>...<head>` | PASS, exit 0 |
| Project secret pattern on added lines | zero matches; CI independently scans full git history |
| Final host head read | unchanged `a4bee55c647ab41436af82a95a41e192867816f5`, open/unmerged |

### Residual risks and test gaps
- The builder's 25 unloaded / 20 loaded pre-fix / 40 loaded post-fix experiments were not repeated independently. One local targeted run and green CI verify current behavior, not a statistical failure rate.
- The earlier CI failures were not instrumented at the held await; attributing all historical timeouts to this race remains an inference, explicitly acknowledged in the PR body.
- Full suite, gates, production build, image scan and E2E were verified through exact-head CI rather than rerun locally. No product UI was changed, so no independent viewport/browser pass was needed.
- Pre-existing failure cleanup can still wait if the send/assertion fails before `release()`; this is unchanged test infrastructure, not evidence of a product defect or a new finding in this diff.
- The first pnpm install attempt created an untracked `.pnpm-store/` cache under the project root (observed afterwards in git status); subsequent installation explicitly used a store inside the snapshot. It is reviewer-generated cache, not product source. Left in place to avoid removing potentially shared cache content while another session is active. Existing unrelated untracked files were untouched.
- Snapshot source files remained unchanged. The snapshot is removed after the integrity check; no product file, spec, decision log, handoff, branch, commit or PR was edited by this reviewer.

### Required before merge
- No code corrections required. Builder must run `approved 65` to archive this review and create the receipt before Charlie merges, per START.md.

### Deferred conditions
- None.

### Optional improvements
- None required by this review.

**Model used:** GPT-6 (Codex). **Switch model next step?** No — review complete; the next builder step archives the exact-head review and receipt.

**Verdict:** Approved
