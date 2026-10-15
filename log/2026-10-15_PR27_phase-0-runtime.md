# PR 27 — feat: Phase 0 PR 4 — worker, Docker image, CI image job (Tasks 15-17)

- **Merged:** 2026-10-15T10:55:01Z (GitHub) · **Merge commit:** `b90dc480a3f8e2b9ee04e201d7ae94f5454d1791` · **Branch:** `feat/p0-runtime` (final head `088d013a41058db3ae8149a5df9f8c75ec26f7d9`)
- **Gate breaches:** none. The final review round's head SHA (`088d013…`) equals the PR's final head SHA, and the receipt was written before the merge (receipt commit `576a412`, 2026-10-15T10:31:08Z; merge 2026-10-15T10:55:01Z).
- **Approval receipt:** `reviews/PR-27.receipt` on `agent-logs`, commit `576a412` (reviewed head `088d013a41058db3ae8149a5df9f8c75ec26f7d9`; review-file hash `8019a4b52af0fc321ed2438a3f603aa20e5060f0`; review committed in `fc0013291846f99b7921f23f9a3ec91a64c0a7d4`).
- **Merge evidence:** `gh pr view 27` → state MERGED, merge commit above, head `088d013…`; `git merge-base --is-ancestor b90dc48 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-15).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 rev 4 (hash `eb89f4ab817c79c536cd36f8aef7c643a059d697`) · **Plan:** `docs/superpowers/plans/2026-09-29-phase-0-foundation.md` Tasks 15-17 · **Milestone:** Phase 0 (PR 4 of 4, last)

## What changed
A worker stub and esbuild bundles (`dist/worker.mjs`, `dist/migrate.mjs`); one digest-pinned, non-root, read-only runtime image (`docker/Dockerfile`, `docker/entrypoint.sh`, `.dockerignore`) and `web` and `worker` in `docker/compose.dev.yml`; a CI `image` job (build, Trivy CRITICAL/HIGH fixed-only, boot the stack, `smoke:auth-route`, full Playwright suite against the image, 84 tests); `CLAUDE.md` Commands and Status. An expired or used-up 2FA challenge now redirects to `/sign-in?expired=1` with a neutral notice (Bob PR #26 deferred item).

## Why
Phase 0 done-when: `docker compose up` runs web + worker + migrations, and sign-up, 2FA and workspaces pass against the image in CI. This closes Phase 0.

## Review rounds
- R1 (Revision required): [P2] runbook gave the wrong invalid-origin failure path for the image → runbook now says the entrypoint validates the environment at container start and `web` and `worker` exit 1 before they listen (verified on the real image); [P3] stale PR text → refreshed with the green exact-head CI run.
- R2 (**Approved**): no findings.

## Deferred conditions
- none

## Decisions worth keeping
- In `docs/DECISIONS.md` (2026-10-15): esbuild 0.28.2 exact pin; node:24.21.0-alpine and the Dockerfile frontend pinned by digest; Trivy 0.74.0, trivy-action v0.36.0, upload-artifact v7.0.1 (SHAs verified against the tags); the ended-2FA-challenge redirect; the smoke check lives in the `image` job. The entry is marked "builder proposal pending owner review"; the owner merged the PR without changing it, and the sign-in notice wording was left as written.
- `pnpm stack:up` now builds and starts web (port 3000) and worker, so it cannot run next to `pnpm dev`; Postgres alone: `docker compose -f docker/compose.dev.yml up -d --wait postgres`.
- In the image, `web` and `worker` validate the environment in the migration step and exit 1 before listening; under `pnpm dev` or `next start` validation happens on first use.
- Do not deploy Phase 0 anywhere reachable from outside until Phase 1 (persistent rate limits, roles/RLS, `action()`).

## Follow-ups
- Phase 1 plan: written only after the Phase 1 gates are met, including Charlie's VPS provider choice (Hostinger KVM 2 or iCore NODE2).
- Newer than the pins: Trivy 0.76.0 and upload-artifact v7.0.2 (update in a later PR). `postgres:17-alpine` in compose is still tag-only. The web container exits 143 on stop (no SIGTERM handler in the Next standalone server).
- Phase 1 items accepted by Bob: persistent rate limits (AUTH-06), verified-email invitations, roles/RLS/`action()`. PDPA professional check before Phase 9.
- Not installed, needs Charlie's OK after a read: the emilkowalski/skills pack.
- Cleanup needing Charlie's OK: branch `feat/p0-auth-db` and worktree `.agent/worktrees/build-feat-p0-auth-db` (it holds a git-ignored `.env` copy; the root `.env` was already restored from it), plus older merged branches and worktrees.
- Docs bundle still open: PR #21 "Exception to a rule?" wording, the UI-kit direction, and the "why PostgreSQL" entry.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-27.md (that file is local only). -->

## Round 2 — 2026-10-15 · scope: Phase 0 PR 4 slice
- **Code review:** merge base `074018f8fecc4770de1772e37c2c69821cd0aca1` · head `088d013a41058db3ae8149a5df9f8c75ec26f7d9`.
- **Spec:** v4.7 revision 4, `docs/superpowers/specs/2026-09-27-core-sales-design.md`; blob `eb89f4ab817c79c536cd36f8aef7c643a059d697`, equal to `PROJECT.md` §2.
- **Review source:** exact-head `git archive` snapshot at `.agent/worktrees/review-27-088d013a`; 141-file list equals `git ls-tree`, with initial fingerprint `8bc55dd6cfd111fa0a79d9c4118e1e9c982a630b7f1e71b8bb31127e11787f7a`. The sandbox prevented a detached Git worktree under `.git/worktrees`.

**Verdict: Approved** — this is approval of the Phase 0 PR 4 slice at the head above, not a production deployment approval.
**Model used:** GPT-6 · **Switch model next step?** Yes. `PROJECT.md` §6 calls for Opus 5.5 on deep auth, security and milestone gates; the owner can request an independent pass on that tier before merging.

### Findings
None open on this head. Round 1 P2 and P3 are resolved:

- **R1 P2 (UNI-16), resolved:** The new runbook distinguishes first-request validation under direct `pnpm dev` / `next start` from image-start validation (`docs/runbooks/phase-0-auth-database.md:21-25,200-206,223`). The entrypoint runs migration before either service (`docker/entrypoint.sh:5-11`); `migrate.ts:5-7` calls `getEnv()`; `env.ts:17-20` rejects an invalid production origin. The documented image exit-before-listening path matches the code. The builder reports an invalid-origin `docker run` for both commands; this reviewer did not repeat it.
- **R1 P3, resolved:** The PR body now identifies head `088d013`, records exact-head run `38675950135` on the previous code head, removes the stale “Pending CI” claim, and separates unverified items. The new run `38713541981` succeeded on `088d013`.

### Independent self-check and scope
The effective three-dot diff still comprises the worker stub and Node bundles, one web/worker image, dev compose, CI image job, runbook, and the deferred expired 2FA notice. Only the runbook changed since Round 1; the rest of Round 1's rule-by-rule applicability audit remains applicable. I rechecked the builder's self-check against the full diff. UNI-01–09, 12–14, 16, AUTH-05, FE-31/32/50, A11Y-01/03/06 and FE-70 apply in this slice; Phase 1 tenancy, RLS, persistent rate limits and action-wrapper gates remain deferred by the approved plan. No applicable rule is missing from the self-check, and no new disagreement arose. The changes include no reviewer-directed instruction attempt.

### Verification performed
| Check | Result |
|---|---|
| Host PR, fetch, exact commit, merge base, full three-dot diff and Round 1→2 delta | Open PR; head `088d013a41058db3ae8149a5df9f8c75ec26f7d9`; base `074018f8fecc4770de1772e37c2c69821cd0aca1`; 19 files, 432 additions and 29 deletions. New commit edits only the runbook |
| `git diff --check` | Clean |
| Hosted CI run `38713541981` | `pull_request` event on exact head; checks (typecheck, lint, tests, build), dependency audit, full-history gitleaks, and image (build, Trivy, stack, auth smoke, E2E) all succeeded |
| Runbook, entrypoint, migration, environment schema, PR body | R1 P2 and P3 corrected, as above |
| Local tests, browser and container | Not rerun in this round; hosted CI and builder's invalid-origin container report are the runtime evidence |
| Snapshot integrity and host head at end | All 141 files unchanged; fingerprint `8bc55dd6cfd111fa0a79d9c4118e1e9c982a630b7f1e71b8bb31127e11787f7a` matched; PR remained open at `088d013a41058db3ae8149a5df9f8c75ec26f7d9` |

### Residual risks and test gaps
- Phase 0 is limited to local or private staging. Persistent rate limits, tenant roles/RLS and `action()` arrive in Phase 1.
- The CI image job runs on amd64 and blocks fixed CRITICAL/HIGH Trivy findings. The builder's arm64 and invalid-origin image checks were not repeated here.
- The developer plan retains the mutable `postgres:17-alpine` tag for disposable dev and CI databases. Failure artifacts can hold synthetic test credentials or ephemeral cookies and should remain in the trusted CI artifact store.

### Required before merge
None from this round.

### Deferred conditions
None from this round. The PR #26 deferred 2FA notice and image E2E gate are implemented and hosted CI passed on this head.
