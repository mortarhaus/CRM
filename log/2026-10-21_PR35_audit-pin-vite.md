# PR 35 — chore: pin transitive vite to 8.3.4 (GHSA-587h-7wmj-h5pm)

- **Merged:** 2026-10-21T12:51:35Z · **Merge commit:** 51aec6a94feb927ea290ee84270e9a70ddc37ef2 · **Branch:** chore/audit-vite-launch-editor
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-35.receipt` on `agent-logs` (written 2026-10-21T12:45:46Z, about 6 minutes before the merge; reviewed head `e716811c1874f6f4551e829d5d0995f83e34b34d`; review file hash `7ae86e675594bc8b3865b6d8ec9a4677faf0a2be`, equal to the local review file; log-branch commit holding the review `7ae86e6`-era archive on `agent-logs`).
- **Merge evidence:** `gh pr view 35 --repo mortarhaus/CRM` state MERGED, mergedAt 2026-10-21T12:51:35Z, merge commit above; `git merge-base --is-ancestor` shows it reachable from the fetched `origin/main`. Final head `e716811` equals the head in Round 1. `pnpm-workspace.yaml` on `origin/main` holds the `vite: 8.3.4` override.
- **Drafted by:** Sonnet 5.5 (builder) · **Final verdict:** Approved (round 1)
- **Spec:** none changed (`50acbcfe…`) · **Plan:** none · **Milestone:** CI hygiene (shared dependency audit)

## What changed
`pnpm-workspace.yaml` pins transitive `vite` to 8.3.4 (was 8.3.1) through `overrides`. The lockfile also moves vite's own dependencies (`rolldown` 1.2.11 to 1.2.14, `postcss`, `nanoid`). `docs/DECISIONS.md` has an entry. No application code.

## Why
GHSA-587h-7wmj-h5pm (vite 8.3.0 to 8.3.2, high; `launch-editor`) was published after the last green audit, so `pnpm audit --audit-level high` failed on `main` and every PR (UNI-13). Found on PR #33.

## Review rounds
- R1: Approved, no findings.

## Deferred conditions
none

## Decisions worth keeping
- 8.3.5 was not used: it was published 4 hours before the change and falls inside pnpm's minimum release age; pnpm had added a `minimumReleaseAgeExclude` entry on its own, which the builder removed. 8.3.4 (2026-10-08) satisfies the age rule. A moderate esbuild advisory remains below the audit gate.
- The repo moved to `mortarhaus/CRM` on 2026-10-21 (PR #34, `docs/DECISIONS.md`); this PR ran on the new repo.

## Follow-ups
- Re-run CI on PR #33 (merge or rebase `main` into it) so the audit job passes on its final head.
- An open owner question: a rule about repo visibility (public only while merging to `main`); the builder asked for confirmation and has not acted.

## Appendix — final review round

## Round 1 — 2026-10-21 · scope: slice
- **Code review:** base (merge base) `4bf02f9ef936e071ead180330ee923730524183f` · head `e716811c1874f6f4551e829d5d0995f83e34b34d` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 · hash (`git hash-object`) `50acbcfe0b402718ddd2c49f4297ce378e1b7451` (unchanged)
- **Checkout:** exact-head `git archive` snapshot at `.agent/worktrees/review-35-e716811c` because `.git/worktrees` was read-only. Its 141 files matched the archive before and after review. Snapshot SHA-256 fingerprint: `c51228a06126c6c868aaea38c0e6fad9135ad8ec38a7e6204b2ceb12763574ca`.

**Verdict:** Approved
**Model used:** GPT-6 · **Switch model next step?** Yes — `PROJECT.md` §6 calls for Opus 5.5 for the project's standard reviews; use that tier for the next substantive review.

### Findings
No blocking findings. The exact `vite: 8.3.4` override resolves all Vite lockfile entries to 8.3.4. The advisory affects Vite 8.3.0–8.3.2 and is patched from 8.3.3; 8.3.4 is a suitable fixed release. No application code, workflow, or spec changed.

### Self-check audit
| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-06 | Yes: dependency supply chain | Pass | Pass: existing transitive Vite, no new top-level package; exact fixed version | `pnpm-workspace.yaml:18`, lockfile, GitHub advisory | None |
| UNI-07 | Yes: changed files must contain no secrets | Pass | Pass: added lines had no project secret markers; CI secret scan passed | Diff scan; CI head `e716811` | None |
| UNI-12 | Yes: file location | Pass | Pass: all changed files inside project | Three-file diff | None |
| UNI-13 | Yes: CI gate | Pass locally; CI pending when body written | Pass: audit, secret scan, typecheck/lint/test, image/Trivy/E2E all succeeded on exact head | GitHub run `39586141254` | CI status advanced to passed |
| UNI-14 | Yes: lockfile and pin | Pass | Pass: committed lockfile matches exact override; frozen install succeeded in CI | `pnpm-workspace.yaml`, `pnpm-lock.yaml`, CI workflow | None |
| Other universal rules and ticked packs | N-a: this slice changes only dependency resolution and a decision entry; no application behavior, data model, UI, auth, jobs, payments, or deployment configuration | Not listed | No additional applicable rule found | Three-file diff | None |

### Verification performed
| Command / check | Result |
|---|---|
| Host PR metadata and final head read | PR open; final head still `e716811c1874f6f4551e829d5d0995f83e34b34d` |
| `git fetch origin`; `git cat-file`; merge-base | Exact commit local; merge-base equals host base |
| Three-dot diff and `git diff --check` | Only `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docs/DECISIONS.md`; whitespace clean |
| Lockfile resolution | All Vite references resolve to 8.3.4; accompanying Rolldown, PostCSS, OXC types, and nanoid changes follow the update |
| Official GitHub advisory and Vite release pages | Advisory range and patch verified; 8.3.4 published before 8.3.5 |
| `gh pr checks` and run `39586141254` | Four jobs succeeded on exact head, including frozen install and dependency audit |
| Secret-pattern scan of added lines | Zero matches |
| Snapshot integrity before and after review | 141 files; no missing, extra, or changed files; fingerprint unchanged |

### Residual risks and test gaps
- I did not run local tests; CI passed on the pinned head. The pre-existing ignored `braces` high finding and moderate `esbuild` finding are outside this PR's scope and are recorded in its decision entry.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.
