# PR 58 — fix: pin musl, musl-utils and zlib in the runtime image (Trivy HIGH)

- **Merged:** 2026-11-07T14:42:41Z · **Merge commit:** 083c2684b3ce18397f6f6b6aeb1aa5ef294b3edf · **Branch:** fix/image-apk-upgrade
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-58.receipt` on agent-logs (log-branch commit 28a8e9ab holds the review; written 2026-11-07T14:18:49Z, before the merge; head 21791b9, review-file hash 2eeaf18c…)
- **Merge evidence:** `gh pr view 58` state MERGED with the time above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head 21791b9 equals the reviewed head. All four CI checks green on 21791b9 (the image job after a re-run of a flaky onboarding test, below).
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 2)
- **Spec:** none · **Plan:** none · **Milestone:** Phase 2 (unblocks PR #57)

## What changed
`docker/Dockerfile` runtime stage: `RUN apk add --no-cache musl=1.2.6-r3 musl-utils=1.2.6-r3 zlib=1.4-r0`, a DECISIONS entry (2026-11-07) and one line in `docs/runbooks/phase-0-auth-database.md`. No application code.

## Why
The CI job "Image, Trivy, E2E" failed on every PR (first seen on #57): Trivy reported 3 HIGH findings in the pinned Alpine base (musl 1.2.6-r2, CVE-2026-107891; zlib 1.3.2-r0, CVE-2026-85091). The base tag had not moved, so no newer digest carried the fixes. Charlie chose the own-PR option ("A", 2026-11-07).

## Review rounds
- R1 (Revision required): [P1] the unpinned `apk upgrade` floated, and UNI-14 was missing from the self-check → exact `=version` pins, trade-off recorded (Alpine keeps only the newest build per branch, so the build fails loudly with "unable to select packages" when it moves on), UNI-14 row added. [P2] image CI not yet run → run on the final head, green. [P3] zlib wording (the 3.24 repo offers only 1.4-r0; the base's `node` links no system libz) → DECISIONS sentence.
- R2 (Approved).
- CI note: the first image run on 21791b9 passed Trivy and failed one e2e test, `onboarding.spec.ts:54` at mobile-320 (`getByRole("alert")` matched both the form error and Next's `__next-route-announcer__`, a strict-mode violation; intermittent, the test is from PR #56). A re-run of the failed job passed (185 passed, 10 skipped).

## Deferred conditions
none. Optional P3: the PR body's UNI-16 and UNI-13 rows are stale (UNI-16 still says `apk upgrade`; UNI-13 says pending though CI is green).

## Decisions worth keeping
- Runtime image installs musl 1.2.6-r3, musl-utils 1.2.6-r3, zlib 1.4-r0 (exact). When Alpine moves on, the build fails; re-pin these, or re-pin the base digest to an image that ships them and remove the line. `docs/DECISIONS.md` 2026-11-07.
- A `.trivyignore` stays rejected for the image (2026-10-15 decision, repeated here).

## Follow-ups
- PR #57: merge `main` in; scope the fragile `getByRole("alert")` selectors in `onboarding.spec.ts` (lines 67 and 149) to `main`; add the FE-60 row to its self-check.
- Remove the apk pin line when the base digest is re-pinned past these packages.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-58.md (that file is local only). Redact per START.md. -->
## Round 2 — 2026-11-07 · scope: fix check (infrastructure)
- **Code review:** base (merge base) `3db1fcca646f5f484994a390d6bb5b963d2dbd46` · head `21791b9859317b2d8e63d85d1ccbb6b7c7ad77ce` · head re-checked at end: yes (unchanged)
- Fix commit: `21791b9` ("Review R1 fix: pin musl, musl-utils and zlib exactly"). Diff vs R1 head: same 3 files. No review checkout needed.

**Verdict:** Approved
**Model used:** Opus 5.5 · **Switch model next step?** No.

### Round 1 findings
| Finding | Status | Evidence |
|---|---|---|
| P1 floating `apk upgrade`, UNI-14 missing | **resolved** | Dockerfile: `apk add --no-cache musl=1.2.6-r3 musl-utils=1.2.6-r3 zlib=1.4-r0`, with a comment naming the "unable to select packages" failure. DECISIONS records the exact versions, the fail-loudly trade-off, and the unpinned upgrade as a rejected alternative. Self-check has a UNI-14 row. CI build log: step `[runtime 2/10] RUN apk add … musl=1.2.6-r3 …` succeeded ("OK: 10.9 MiB in 18 packages"). |
| P2 image job not run | **resolved** | CI run 42368019597 (headSha `21791b9`): Image, Trivy, E2E **pass** (Trivy gate passed; e2e 185 passed, 10 skipped, 45.1 min); Typecheck/lint/test, Dependency audit, Secret scan pass. 185 passed matches PR #56's full run. |
| P3 zlib "fixed in" wording | **resolved** | DECISIONS now says the 3.24 repo offers only 1.4-r0, that Trivy accepts it, and that the `node` binary links no system `libz`. |

### New findings
### [P3] PR body self-check rows are stale
- Evidence: the UNI-16 row still says the runbook notes "the runtime `apk upgrade` and when to remove it" (the runbook now says the pinned `apk add`), and UNI-13 says "pending" though CI is green.
- Required correction: none before merge; optional body edit.
- Owner: builder
- Status: open (optional)

No injection-style text addressed to agents was found.

### Self-check audit
| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-06 | n-a | n-a | n-a | lockfile unchanged | — |
| UNI-13 | yes | pending | pass | run 42368019597 | stale row (P3) |
| UNI-14 | yes | pass | pass | exact `=version` pins | — |
| UNI-16 | yes | pass | pass | runbook line 181 updated to the pins | stale wording in body (P3) |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 58` head at start and end | `21791b98…` both times |
| `git diff a8f4b07 21791b9` | Dockerfile pin, DECISIONS rewrite, runbook line |
| `git diff --check 3db1fcc 21791b9` | clean |
| CI run 42368019597 | all 4 jobs pass; e2e 185 passed, 10 skipped |
| Image build / Trivy locally | not run by me (CI is the evidence) |

### Residual risks and test gaps
- When Alpine publishes a newer musl or zlib, every image build fails until re-pinned (intended, recorded).
- After merge, `main` should go green at the image gate; PR #57 then needs its branch updated from `main` and a green run.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- P3: refresh the UNI-13 and UNI-16 rows in the PR body.
