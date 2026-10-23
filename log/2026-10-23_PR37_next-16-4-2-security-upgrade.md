# PR 37 — fix(deps): upgrade Next.js to 16.4.2 (two critical advisories)

- **Merged:** 2026-10-23T13:27:15Z · **Merge commit:** f9d145460149b4fb44f0c89e6ea3f1c8ed8b5615 · **Branch:** chore/next-16-4-2
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-37.receipt` on `agent-logs` (written 2026-10-23T13:26:13Z, about 1 minute before the merge; reviewed head `f64d0105f093259ce57d9c8654efeaf84132b216`; review file hash `38d72fec2a1a0c1f2b17ebe03afa8729bd566999`, equal to the local review file; log-branch commit holding the review `9f10a4b`).
- **Merge evidence:** `gh pr view 37 --repo mortarhaus/CRM` state MERGED, mergedAt 2026-10-23T13:27:15Z, merge commit above; `git merge-base --is-ancestor` shows it reachable from the fetched `origin/main`. Final head `f64d010` equals the head in Bob's Round 2. All four CI jobs passed on that head.
- **Drafted by:** Opus 5.5 (code and fix), builder Sonnet 5.5 (approved/merged procedures) · **Final verdict:** Approved (round 2, Opus 5.5)
- **Spec:** none (dependency-only; no spec change) · **Plan:** none · **Milestone:** Phase 1 prep (unblocks PR #34's dependency audit)

## What changed
`next`, `@next/env` and `@next/eslint-plugin-next` move from 16.3.8 to 16.4.2 (exact pins). The lockfile moves the Next.js packages and the `better-auth`/`auth` peer entries, plus one edge: `postcss@8.5.23` now resolves `nanoid` 3.3.20 instead of 3.3.19 (both already in the lockfile). `docs/DECISIONS.md` has the entry.

## Why
`pnpm audit --audit-level high` failed on `main`: Next.js 16 up to 16.4.0 has two critical unauthenticated remote-code-execution advisories (GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw) and one high denial of service (GHSA-p3m5-59mp-jv5r). UNI-13 blocks merge on a failing audit. Bob found it in PR #34 Round 1.

## Review rounds
- R1: [P2] recorded scope of the upgrade was incomplete (nanoid edge, `next-code-frame` fix, GHSA-2464 lower bound) → decision entry and PR body corrected in `f64d010`; lockfile unchanged.
- R2: Approved (Opus 5.5) on `f64d010`; Round 1 finding resolved.

## Deferred conditions
- none

## Decisions worth keeping
- Charlie chose a separate dependency PR ("1a", 2026-10-23); the builder chose 16.4.2 over 16.4.1 (same security fixes plus later bug fixes).
- The two official sources give different lower bounds for GHSA-2464-fhr4-w9xw (`>16.0.0` vs `>=16.0.0`); both are recorded. The old 16.3.8 is affected either way.
- Three moderate audit findings and the time-limited `braces` exception remain; none come from this PR.
- Round 1 was reviewed on GPT-5 Codex, below the mapped deep tier; Bob re-reviewed on Opus 5.5.

## Follow-ups
- PR #34: merge the new `main`, push, add the UNI-11 row to the body, wait for green CI, then `review 34`.
- Local `pnpm build` could not be repeated in Bob's sandbox (port bind); CI built it on Linux.

## Appendix — final review rounds

## Round 2 — 2026-10-23 · scope: slice (Next.js security dependency update)
- **Code review:** base (merge base) `36b5592d044acf1f767c4cc0ec4bc285525c0863` · head `f64d0105f093259ce57d9c8654efeaf84132b216` · head re-checked at end: yes (still `f64d010`, PR open, mergeable)
- **Review checkout:** detached worktree `.agent/worktrees/review-37-f64d0105` at the exact head; `git status --untracked-files=no` clean at the end; my build/test output deleted and the worktree removed without `--force`
- **Applicable product spec:** Core Sales v4.7 revision 7 (approved). Revision 8 is still draft. This dependency-only slice changes neither.

**Verdict:** Approved
**Model used:** Opus 5.5 (deep tier, as Round 1 asked) · **Switch model next step?** No — `approved 37` and `merged 37` are builder procedures; Opus 5.5 or Sonnet 5 both fit.

### Round 1 finding

### [P2] Correct the recorded scope of the upgrade
- Status: **resolved** in `f64d010` (re-inspected, not taken from the builder's table).
- Evidence: `docs/DECISIONS.md:6-7` and the PR body now (1) disclose the `postcss@8.5.23` → `nanoid` 3.3.19 → 3.3.20 edge, (2) list the `next-code-frame` char-boundary fix and the other 16.4.2 items, (3) give each advisory's range with both published lower bounds for GHSA-2464-fhr4-w9xw. `git diff d44542c..f64d010` touches only `docs/DECISIONS.md`; the lockfile is unchanged since Round 1.
- Fact check against primary sources, all match the text:
  - npm: `next` 16.4.1 published 2026-10-14, 16.4.2 published 2026-10-15; `nanoid` 3.3.20 published 2026-10-05; `postcss@8.5.23` declares `nanoid: ^3.3.16`.
  - GitHub Advisory Database vs `vercel/next.js` repository advisories: GHSA-673q-mjm6-r5xr critical `>=16.0.0 <=16.4.0`; GHSA-2464-fhr4-w9xw critical, GHSA DB `>=16.0.0 <=16.4.0`, repo `>16.0.0 <=16.4.0`; GHSA-p3m5-59mp-jv5r high `>=16.0.0 <=16.4.0`; first patched 16.4.1 for all three.
  - `vercel/next.js` release v16.4.2 notes: Turbopack fixes, `fix(next-code-frame): snap visible window to char boundaries` (#100212), docs backports. Matches the entry.
  - Lockfile: both `nanoid@3.3.19` and `nanoid@3.3.20` exist in the base lockfile (`3.3.19` via `@tailwindcss/postcss` → `postcss@8.5.28`, `3.3.20` via `vite` → `postcss@8.5.31`). No package added or removed. The three-dot lockfile diff changes only the Next.js entries, the `better-auth` / `auth` peer strings and that one `nanoid` edge.

### Findings

None new.

### Self-check audit

Independent applicability list (unchanged from Round 1): UNI-06, UNI-07, UNI-12, UNI-13, UNI-14, `PROJECT.md` §9 exact versions, decision provenance/accuracy. Other packs n-a: no application, data, UI, auth, money, file, job, link or payment behaviour changes.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-06 | yes — existing packages move to a new patch | pass | pass | npm integrity for `next`, `@next/env`, `@next/eslint-plugin-next` 16.4.2 equals the lockfile values; release notes and advisories match the decision | no |
| UNI-07 | yes | pass | pass | secret-scan pattern over added lines: 0 hits; CI Secret scan pass on `f64d010` | no |
| UNI-12 | yes | pass | pass | four files, all in repo | no |
| UNI-13 | yes | pass on `d44542c`; CI pending on `f64d010` | pass | local `pnpm audit --audit-level high` exit 0; all four CI jobs pass on `f64d010` | no |
| UNI-14 | yes | pass | pass | exact pins; `pnpm install --frozen-lockfile` pass; every moved lockfile entry is disclosed | no |
| `PROJECT.md` §9 exact versions | yes | pass | pass | all three packages exactly `16.4.2`; `pnpm ls` shows `next@16.4.2`, `@next/env@16.4.2` | no |
| Decision provenance / accuracy | yes | pass | pass | entry quotes Charlie's "1a"; technical scope matches the three-dot diff and primary sources | no |

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`; `git cat-file -e f64d010^{commit}`; `git merge-base origin/main f64d010` | commit present; merge base `36b5592` (= `origin/main`) |
| `git diff --stat / --name-status`, `git log` (three-dot) | 4 files, +67 −58; commits `d44542c`, `f64d010` |
| `git diff --check 36b5592...f64d010` | clean |
| Node v24.21.0, pnpm 11.6.0: `pnpm install --frozen-lockfile` | pass |
| `pnpm audit --audit-level high` | exit 0; 3 moderate, 1 high ignored (existing `braces` exception GHSA-vfj7-8cjw-p6xm) |
| `pnpm typecheck` / `pnpm lint` | pass / pass |
| `pnpm test` (Docker running) | 13 files, 146 tests pass |
| `pnpm build` | pass (Next build plus worker/migrate bundles; Round 1 could not run this locally) |
| CI on `f64d010` (run 39945127353) | Typecheck/lint/test pass; Dependency audit pass; Secret scan pass; Image, Trivy, E2E pass (26m15s) |
| npm registry + GitHub advisory and release APIs | facts in the decision entry confirmed (see Round 1 finding above) |
| End check | host head still `f64d010`, OPEN, MERGEABLE; review checkout clean, then removed |

### Residual risks and test gaps
- The audit still lists 3 moderate advisories and the ignored `braces` high; neither is introduced by this PR.
- `agents/PROJECT.md` §4 still names the old remote `charliekhc/CRM`; the repository is `mortarhaus/CRM`. Already known (PR #33 review) and outside this PR's scope; it needs its own reviewed change.
- PR #34 must merge `main` after this lands and pass the audit on its own final head (UNI-13).

### Required before merge
- None. Builder runs `approved 37` before Charlie merges. Approved is not a merge instruction.

### Deferred conditions
- None.

### Optional improvements
- None.

## Round 1 — 2026-10-23 · scope: slice (Next.js security dependency update)
- **Code review:** base (merge base) `36b5592d044acf1f767c4cc0ec4bc285525c0863` · head `d44542c71151d9d66a2d5bece6d5d458079e4cd6` · head re-checked at end: yes
- **Review checkout:** exact-head `git archive` snapshot; 142-file archive/list comparison matched and the final SHA-256 fingerprint check passed
- **Applicable product spec:** Core Sales v4.7 revision 7 is the approved source of truth; revision 8 at hash `733cc0e9ce4af0771bdd2769720e3f228caf8855` is present but still draft. This dependency-only slice changes neither version.

**Verdict:** Revision required
**Model used:** GPT-5 Codex · **Switch model next step?** Yes — this is a security dependency gate, which `agents/PROJECT.md` maps to the deep tier (Opus 5.5).

### Findings

### [P2] Correct the recorded scope of the upgrade
- Category: defect
- Rule: UNI-06 / UNI-14; durable decision accuracy
- Evidence: `docs/DECISIONS.md:6` and the PR body's “Lockfile” section say the lockfile changes only Next.js packages and the `better-auth` / `auth` peer-resolution entries. The effective diff also changes the `postcss@8.5.23` dependency edge at `pnpm-lock.yaml:5810` from `nanoid: 3.3.19` to `nanoid: 3.3.20`. `docs/DECISIONS.md:7` and the PR body also say 16.4.2 adds only Turbopack and documentation fixes over 16.4.1, while the official 16.4.2 release notes include a separate `next-code-frame` character-boundary fix. The official GHSA-2464-fhr4-w9xw v16 affected range is `>16.0.0 <=16.4.0`, not the recorded `>=16.0.0 <=16.4.0`; the upgraded 16.3.8 installation is affected either way.
- Failure scenario: a later maintainer uses the decision as the audit trail for this security update and concludes that no non-Next resolution changed and that 16.4.2 contained no other code fix, then misses the PostCSS/Nanoid resolution change or relies on the wrong release/advisory boundary during a regression or security investigation.
- Why it matters: the dependency pins, frozen install, audit and CI are sound, but the committed decision is the project's durable supply-chain record and must describe the effective lockfile and upstream patch accurately.
- Required correction: either regenerate the lockfile without changing the `postcss@8.5.23` → `nanoid` edge, or disclose and justify that edge in both the PR body and decision. In the same two places, describe the `next-code-frame` fix and correct the GHSA-2464-fhr4-w9xw lower bound. Do not change the Next.js 16.4.2 target.
- Owner: builder
- Verification: compare the revised decision and PR body with the final three-dot lockfile diff and the official 16.4.2 release/advisory pages; rerun `pnpm install --frozen-lockfile` and `pnpm audit --audit-level high` if the lockfile changes.
- Disposition: before merge
- Status: open

### Self-check audit

Independent applicability list: UNI-06 (dependency diligence), UNI-07 (secret hygiene), UNI-12 (repository scope), UNI-13 (required CI/audit gates), UNI-14 (exact pins and lockfile), `PROJECT.md` §9 exact-version policy, and decision provenance/accuracy. The other active packs do not apply because no application, data, UI, authentication, money, file, job, public-link or payment behavior changes.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-06 | yes — three existing framework packages move to a new patch | partly; pass | dependency choice passes; the recorded upstream patch scope is incomplete | exact pins; official Next.js advisories and v16.4.2 release notes; P2 above | yes |
| UNI-07 | yes — all repository changes require secret hygiene | pass | pass | changed-file pattern scan had no hits; exact-head CI gitleaks passed | no |
| UNI-12 | yes — scope must remain in this repository | pass | pass | four changed files, all in repository | no |
| UNI-13 | yes — dependency audit and required CI must pass | pass locally, CI pending | pass | local audit exit 0; all four exact-head CI jobs passed | no |
| UNI-14 | yes — versions must be exact and lockfile committed | pass | pins and frozen install pass; stated lockfile scope is inaccurate | manifests, frozen install, and `pnpm-lock.yaml:5810`; P2 above | yes |
| `PROJECT.md` §9 exact-version policy | yes — dependency versions changed | pass | pass | `next`, `@next/env`, and `@next/eslint-plugin-next` are exactly `16.4.2` | no |
| Decision provenance / accuracy | yes — this PR records Charlie's “1a” choice and technical rationale | pass | provenance passes; technical scope needs correction | `docs/DECISIONS.md:5-12`; P2 above | yes |

### Verification performed

| Command / check | Result |
|---|---|
| PR metadata and final head re-read | PR open and mergeable; head stayed `d44542c71151d9d66a2d5bece6d5d458079e4cd6` |
| `git fetch origin`; `git cat-file -e <head>^{commit}`; `git merge-base origin/main <head>` | exact commit available; merge base `36b5592d044acf1f767c4cc0ec4bc285525c0863` |
| Exact-head snapshot list and fingerprint | all 142 archive paths matched `git ls-tree`; all 142 final SHA-256 checks passed |
| Three-dot stat, name-status and commit log | four files; 67 insertions, 58 deletions; one dependency-fix commit |
| `git diff --check <base>...<head>` | pass |
| `pnpm install --frozen-lockfile` (Node 24.21.0, pnpm 11.6.0) | pass |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` with Docker access | 13 files and 146 tests passed |
| `pnpm audit --audit-level high` | exit 0; 3 moderate findings and the existing ignored high-severity `braces` advisory remain |
| Local `pnpm build` | unverified locally: Turbopack's helper process was denied permission to bind a loopback port by the review environment |
| Exact-head CI | Typecheck/lint/test/build, dependency audit, gitleaks, image build, Trivy and E2E all passed |
| Changed-file secret pattern | no matches |
| Official advisory and release review | confirms 16.4.1 is patched for the three cited advisories and 16.4.2 includes the additional `next-code-frame` fix |

### Residual risks and test gaps
- The production build was not completed independently on this Mac because the review environment denied Turbopack's local port bind. The exact-head Linux CI ran `pnpm build` successfully, and the image/Trivy/E2E job also passed.
- The audit still reports three moderate advisories and one ignored high advisory; the high advisory is the existing time-limited `braces` exception recorded in `pnpm-workspace.yaml` and `docs/DECISIONS.md`, not introduced by this PR.
- This security review used GPT-5 Codex, below the project's mapped deep tier. Re-review the corrected head with Opus 5.5.

### Required before merge
- Resolve the P2 finding above and request a new review of the resulting head SHA.

### Deferred conditions
- None.

### Optional improvements
- None.
