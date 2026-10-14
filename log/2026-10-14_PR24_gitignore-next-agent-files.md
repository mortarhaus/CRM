# PR 24 — chore: ignore the two files next dev generates in apps/web

- **Merged:** 2026-10-14T01:36:17Z (GitHub) · **Merge commit:** `0234ab96561d3032ec5353cb1690dfb9338a436d` · **Branch:** `chore/gitignore-next-agent-files` (final head `dca0aba72966e326eb1cc14d64193e2e06069291`)
- **Gate breaches:** none. The final review round's head SHA (`dca0aba…`) equals the PR's final head SHA, and the receipt was written before the merge (receipt commit `19f979f`, 2026-10-14T01:29:50Z; merge 2026-10-14T01:36:17Z).
- **Approval receipt:** `reviews/PR-24.receipt` on `agent-logs`, commit `19f979f` (reviewed head `dca0aba72966e326eb1cc14d64193e2e06069291`; review-file hash `cbd87fa29ef7d535bfba8bc1ad1cb418de8963f0`; review committed in `5637b3e49c1477ec339c4611e3165cd0bad03e17`).
- **Merge evidence:** `gh pr view 24` → state MERGED, merge commit above; `git merge-base --is-ancestor 0234ab9 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-14).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 1)
- **Spec:** none (config and docs only) · **Plan:** none · **Milestone:** Phase 0 (housekeeping)

## What changed
Two exact-path lines in the root `.gitignore`: `/apps/web/AGENTS.md` and `/apps/web/CLAUDE.md`. `docs/DECISIONS.md` has a new 2026-10-13 entry for this choice, and the kit entry now marks 1.7.4 as the first copy and 1.7.5 as the final version.

## Why
`next dev` (Next 16.3.8) generates those two files in `apps/web`. They left the `build-feat-p0-auth-db` worktree not clean, which blocks the kit 1.7.5 automatic cleanup, and deleting them only makes `next dev` write them again. Charlie chose to ignore them: the builder listed "1. ignore them in .gitignore, 2. commit them" and he answered "1".

## Review rounds
- R1 (**Approved**): no open P0-P2. One non-blocking P3: the opening bullet of the kit decisions entry still says `PROJECT.md` "is now 1.7.4" in the present tense, while `agents/PROJECT.md` says 1.7.5. NOT fixed here (`approved` forbids changing the PR); recorded as a follow-up. CI green on the final head.

## Deferred conditions
- none

## Decisions worth keeping
- Recorded in `docs/DECISIONS.md` (2026-10-13 "Ignore the two files `next dev` generates in `apps/web`"), now on `main`.
- The ignored files stay on disk. Their text is third-party data under the kit's trust boundary, not instructions that override the project's rules.

## Follow-ups
- Docs cleanup (Bob R1 P3): in the 2026-10-13 kit entry, say that the first copy set the field to 1.7.4 and the final state is 1.7.5. Bundle with the next DECISIONS PR (with the UI-kit direction and "why PostgreSQL" entries and the PR #21 "no exception" wording fix).
- The old worktree `.agent/worktrees/build-feat-p0-auth-db` is on a branch cut before this change, so it still shows the two files as untracked and the 1.7.5 cleanup still fails there. Removing it needs Charlie's OK, or the two files deleted first.
- Phase 0 PR 3 (Tasks 11-14, `feat/p0-auth-ui`): Charlie must type `build`. UI tasks follow emilkowalski/skills first, then smoothui.dev, then ui.shadcn.com.
- Phase 1 gates still open: VPS provider (Hostinger KVM 2 or iCore NODE2), persistent rate limits, verified-email invitations.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-24.md (that file is local only). -->

## Round 1 — 2026-10-14 · scope: slice
- **Code review:** base (merge base) `4c56927e2bfd123bf87f195c656a42e5acc1ec9b` · head `dca0aba72966e326eb1cc14d64193e2e06069291` · head re-checked at end: yes
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, v4.7 revision 4, hash `eb89f4ab817c79c536cd36f8aef7c643a059d697` (unchanged by this PR)

**Verdict:** Approved
**Model used:** GPT-6 · **Switch model next step?** No — this narrow docs/config review is complete.

### Findings

### [P3] Historical kit entry still uses present tense for 1.7.4
- Category: defect
- Rule: decisions log accuracy
- Evidence: `docs/DECISIONS.md:16` says the final kit copy is 1.7.5 but also says `agents/PROJECT.md` “Kit version used” **is now 1.7.4**; `agents/PROJECT.md:3` says 1.7.5.
- Failure scenario: a reader skims the opening decision bullet and thinks the project is still on kit 1.7.4.
- Why it matters: the dated history is useful, but its present-tense clause remains misleading.
- Required correction: say that the first copy set the field to 1.7.4 and that the final state is 1.7.5.
- Owner: builder
- Verification: compare the revised sentence with `agents/PROJECT.md:3`.
- Status: open; nonblocking.

### Self-check audit

Own applicability list before comparing the PR table: UNI-07 (no secrets), UNI-12 (repo-local changes), UNI-13 (CI), and the kit trust boundary (generated agent text is third-party data). UNI-06/UNI-14 and all behavioral rules in `PROJECT.md` §9 are n-a because the PR changes only ignore rules and documentation.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07 | Yes; inspect new text and secret scan | Pass | Pass | Two-file diff, local pattern scan no hit, exact-head CI secret scan passed | None |
| UNI-12 | Yes; edits stay inside repo | Pass | Pass | `.gitignore`, `docs/DECISIONS.md` only | None |
| UNI-13 | Yes; CI gate | Pending CI | Pass | Run `38415495681` succeeded at exact head; typecheck, lint, test, build, audit, secret scan | CI completed after self-check |
| Kit trust boundary | Yes; generated AI note remains on disk | Pass | Pass | `docs/DECISIONS.md:7` calls it third-party data; no rule elevates it | None |
| UNI-06 / UNI-14; `PROJECT.md` §9 behavioral packs | No dependency, lockfile, code, or behavior change | N/A | N/A | Effective diff has only `.gitignore` and `docs/DECISIONS.md` | None |

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`; pin host PR #24 head and merge base | Open PR, head `dca0aba72966e326eb1cc14d64193e2e06069291`, base `4c56927e2bfd123bf87f195c656a42e5acc1ec9b` |
| Detached checkout `.agent/worktrees/review-24-dca0aba7` | Exact head; path and review file are inside the real repo, with no symlink |
| `git diff --stat`, `--name-status`, effective diff, and `git log` | Two changed files, 12 insertions and one deletion; scope matches PR description |
| `git check-ignore -v --no-index apps/web/AGENTS.md apps/web/CLAUDE.md` | Only `.gitignore:17-18` match, one exact rule per file |
| `git check-ignore -v --no-index AGENTS.md CLAUDE.md docs/AGENTS.md apps/AGENTS.md apps/api/AGENTS.md` | No matches; command exits 1 as expected |
| `git diff --check` and local secret pattern on changed files | No output or matches |
| `gh run view 38415495681` and `gh pr checks 24` | All three jobs passed; run head SHA equals reviewed head; local tests not run |
| Host head re-read; `git status --untracked-files=no --short` in detached checkout | Head unchanged and checkout clean |

### Residual risks and test gaps
- The existing `build-feat-p0-auth-db` worktree is on an older commit, so this PR alone does not make its untracked files ignored there. Its cleanup still needs a separate safe disposition.
- No local tests were run; exact-head CI supplies test and build results.

### Required before merge
- Builder runs `approved 24` to archive this full review and write the approval receipt before Charlie merges.

### Deferred conditions
- None.

### Optional improvements
- Fix the P3 present-tense clause in a later docs PR.
