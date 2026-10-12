# PR 19 — docs(spec): record Charlie's approval of v4.7 (revision 4)

- **Merged:** 2026-10-12T03:11:50Z (GitHub) · **Merge commit:** `98f8675be57a3f352580e2eff869b0996fa7ac05` · **Branch:** `docs/spec-v4.7-approved` (final head `89f52060245908f67e428b2afad838013e125df1`)
- **Gate breaches:** none. The final review round's head SHA (`89f5206…`) equals the PR's final head SHA, and the receipt was written before the merge (2026-10-11T15:53:19Z, about 11 hours before the merge).
- **Approval receipt:** `reviews/PR-19.receipt` on `agent-logs`, commit `213c40e` (written 2026-10-11T15:53:19Z; merge was 2026-10-12T03:11:50Z; reviewed head `89f52060245908f67e428b2afad838013e125df1`; review-file hash `d2fdbb93cbb68ab00c7be59892bd0302bfe56f9f`, archived in commit `a73628e`)
- **Merge evidence:** `gh pr view 19` → state MERGED, merge commit above; `git merge-base --is-ancestor 98f8675 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-12).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` **v4.7 revision 4 APPROVED** by Charlie on 2026-10-11, hash on `main` `eb89f4ab817c79c536cd36f8aef7c643a059d697` (Bob's Round 11 Approved with conditions was for the earlier blob `521a70979f48329363f6154a1f73687d9a82e03f`; the later changes are the Status/title/gate text only). `agents/PROJECT.md` §2 still holds the v4.6 hash `3d0d99ab…` until `setup`. · **Plan:** none · **Milestone:** `setup`, then `build`

## What changed
Spec: title, Status and the "Current gates" paragraph of "Next steps after approval" now record that v4.7 (revision 4) is APPROVED (Charlie, 2026-10-11, "based on the table in the chat, ok approve", after Bob's Round 11), and the gate list now carries every Bob Round 11 deferred condition at its phase (Phase 1: restrictive tenant policy, `/api/auth/*`, archive job; Phase 4: credit-note tax source, zero-total credit note, refund-void step-up; Phase 7: artifact kinds at sign; `setup`: rulings for TEN-02 / REC-01 / AUTH-01). `docs/DECISIONS.md`: one entry quoting Charlie's words. No rule or code change.

## Why
Kit gate order: Bob's formal spec review, then the owner's approval, then `setup`, then `build`. Bob's Round 11 (Opus 5.5) approved v4.7 with conditions; Charlie then approved in his own words. Bob cannot see the Andy session, so the words are quoted.

## Review rounds
- R1 (2026-10-11, Revision required): [P2] the Status said all of Bob's conditions were written in the spec, but the gate list omitted several. Fixed: the gate list now has every Round 11 condition.
- R2 (2026-10-11, **Approved**): no open P0-P2. One non-blocking P3: the PR body still described the earlier one-clause diff and "pending CI". NOT edited (`approved` forbids changing the PR); recorded here. CI green on the final head.

## Deferred conditions
- After this merge, an exact-hash spec review for the `build` gate (current blob `eb89f4ab…`), and `setup` to reconcile `agents/PROJECT.md` (Charlie's confirmation needed for the TEN-02 / REC-01 / AUTH-01 rulings). Charlie's 2026-10-10 ruling already waives the `build` spec and reconcile gates for Phase 0 PR 2, tasks 6-10 only.
- The Phase 1, 4, 5 and 7 conditions in the spec's "Current gates" stay due before their first plan PRs; none is decided by this approval.

## Decisions worth keeping
- Recorded in `docs/DECISIONS.md` (2026-10-11 entry "Spec v4.7 approved by Charlie (revision 4)", now on `main`).
- An approval record that claims "all conditions are written in the spec" must be checked against the gate list (Bob's R1 P2).

## Follow-ups
- `setup` (Opus 5.5 sub-agent comparison, reviewed PR): hash to `eb89f4ab…`; REC-01 (a) adds payment and receipt voids; the TEN-02 / REC-01 / AUTH-01 rulings move out of "Proposed" with Charlie's confirmation; amount, tax-rate and discount bounds; `CLAUDE.md` still says v4.5 and needs Charlie's explicit OK for its three small edits.
- Then `build` (Phase 0 PR 2, tasks 6-10). UI tasks later: emilkowalski/skills first, then smoothui.dev, then ui.shadcn.com.
- Add the UI-kit direction and "why PostgreSQL" to `docs/DECISIONS.md` through a reviewed PR.
- Cleanup needing Charlie's OK: worktrees `.agent/worktrees/build-chore-next-16-3-8`, `.agent/worktrees/build-chore-audit-source-map-js` and any detached `.agent/worktrees/review-*`; local branches `docs/spec-v4.7-approved`, `docs/spec-v4.7-rev4`, `docs/spec-v4.7-rev1`, `chore/setup-reconcile-v4-6-approved`, `docs/spec-v4.6-approved`, `docs/spec-v4.6-rev11`, `docs/spec-v4.6-rev10`, `chore/audit-handlebars`, `chore/next-16-3-8`, `chore/audit-source-map-js`, `chore/setup-reconcile-v4-6`, `chore/agent-kit`, `docs/spec-v4.6-service-currency`, `docs/spec-v4.6-rev8`, `docs/spec-v4.6-rev9`; old `.claude/worktrees/` folders.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-19.md (that file is local only). -->

## Round 2 — 2026-10-11 · scope: approval-record slice
- **Code review:** base (merge base) `9b95910d48108a026927e501e918e4fa5e05e234` · head `89f52060245908f67e428b2afad838013e125df1` · head re-checked at end: yes, PR still open
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 4 approval record · head blob hash (`git hash-object`) `eb89f4ab817c79c536cd36f8aef7c643a059d697`; previously reviewed rule-body blob on base `521a70979f48329363f6154a1f73687d9a82e03f`

**Verdict:** Approved
**Model used:** GPT-6 (the project maps standard and deep reviews to Opus 5.5) · **Switch model next step?** Yes, if the project's model mapping is to be followed strictly for the next review; this round's evidence is pinned below.

### Findings

The Round 1 P2 is resolved. The new "Current gates" paragraph (`docs/superpowers/specs/2026-09-27-core-sales-design.md:1051`) now includes every Round 11 deferred condition under `setup` or its named Phase 1, 4, 5 or 7 plan. It preserves the earlier gates, requires Charlie's confirmation for the proposed-exception rulings, labels Bob's unresolved proposals as proposals, and says the plan items need reviewed spec revisions first. No P0, P1 or P2 remains open for this PR head.

### [P3] PR body still describes the former one-clause diff and pending CI
- Category: documentation consistency
- Evidence: the PR #19 body says "only the title, the Status text and gate (a)" change, although the new commit expands gates (a)–(e) at spec line 1051. Its UNI-13 self-check still says "pending CI", while all three checks passed for head `89f52060245908f67e428b2afad838013e125df1` (`gh pr checks 19`).
- Failure scenario: an owner skimming the PR body underestimates the gate-list edit or thinks CI is still pending.
- Why it matters: the summary is stale, but the diff and checks are available and correct.
- Required correction: refresh the PR body scope sentence and UNI-13 row before `approved 19` if convenient; no spec or code edit is needed.
- Owner: builder
- Verification: PR body describes gates (a)–(e) and reports green exact-head CI.
- Status: open (non-blocking)

### Self-check audit
I assessed applicable rules from the two-file documentation diff before comparing the PR self-check. The change introduces no runtime code, UI, DB, money calculation, auth endpoint, dependency, deployment or runbook change, so those ticked-pack implementation rules are n-a for this slice. Spec gate accuracy, owner-choice handling and universal secrets/delivery rules apply.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `PROJECT.md` §2/§11; Round 11 conditions | Yes; v4.7 becomes the approved source of truth. | pass | Round 1 omission fixed. The current gate list matches Round 11's deferred conditions without silently deciding open choices. | Spec line 1051; SPEC review Round 11 "Deferred conditions"; Decisions line 9. | None. |
| UNI-07, UNI-12 | Yes; two documentation files changed. | pass | No secret in the diff; both paths are project-local. | Three-dot diff; exact-head secret scan passed. | None. |
| UNI-13 | Yes; exact-head CI must pass. | pending CI | Typecheck, lint, tests, build, dependency audit and secret scan passed. | PR #19 check rollup at `89f52060`; `.github/workflows/ci.yml`. | PR body is stale (P3). |
| UNI-02, UNI-14 and runtime packs | n-a; no code values, dependencies or runtime surfaces changed. | n-a for UNI-02/14. | Correct for this slice. | Two docs files in `git diff --name-status`. | None. |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 19 --json ...`; `git fetch origin`; `git merge-base` | PR open; base and merge base `9b95910d…`; exact head `89f52060245908f67e428b2afad838013e125df1` fetched. |
| `git diff --stat`, `git diff --name-status`, `git log` | Two docs files; two commits; no code or dependency change. |
| Detached checkout `.agent/worktrees/review-19-89f52060`; diff from Round 1 head and full three-dot diff | Only the spec's current gate paragraph changed after Round 1; it now lists the missing conditions. |
| `git hash-object <spec>` in the detached checkout | `eb89f4ab817c79c536cd36f8aef7c643a059d697`. |
| Line-by-line comparison with SPEC review Round 11 and decisions entry | `setup`, Phase 1, 4, 5 and 7 conditions accounted for; Bob's proposals are marked undecided. |
| `gh pr checks 19`; CI workflow read | All three checks passed for this head. The checks job includes typecheck, lint, tests and build. No local tests run for this document review. |
| Final `gh pr view 19`; detached checkout `git status --untracked-files=no --short` | PR still open at the same head; no tracked checkout changes. |

### Residual risks and test gaps
- This is an approval-record slice review. The full-spec Round 11 approval applies to the prior rule-body hash; `agents/START.md` requires a spec-review round for the final exact hash before ordinary `build`, unless Charlie makes an explicit ruling.
- The approval quote is attributed to Charlie's Andy session in the PR and decisions log. This reviewer did not see that session directly; I found no contradiction in the available record.
- No local implementation tests were run. CI results are reported for the exact PR head.

### Required before merge
- None.

### Deferred conditions
- After this PR merges, obtain an exact-hash spec review for the `build` gate, and reconcile `agents/PROJECT.md` through `setup` after the recorded owner approval. The Phase 1, 4, 5 and 7 conditions at spec line 1051 remain due before their first plan PRs.

### Optional improvements
- Refresh the PR body's scope sentence and UNI-13 self-check row to match the current diff and green CI.
