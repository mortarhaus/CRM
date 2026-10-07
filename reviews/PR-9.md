# Review — PR #9

## Round 1 — 2026-10-07 · scope: slice (spec test-plan clarification)
- **Code review:** base (merge base) `3bc4604965c03dd6d5828ed1cc8260c1aa1d4794` · head `491957eaad01a29c4a1e9836b4b530b3dbf324c1` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 8 · hash (`git hash-object`) `de327c9ba836c0d3a01b793d81b8394c9c3fa47e`

**Verdict:** Approved
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the follow-up formal spec review covers money behavior; the project maps spec review to deep tier (Opus 5.5).

### Findings

### [P3] Handoff Git-state section still names the old branch
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md` §0–1 now names branch `docs/spec-v4.6-rev8` and PR #9, while §3 says the checkout is on `chore/setup-reconcile-v4-6` and lists its old commit history. The actual checkout is `docs/spec-v4.6-rev8` at `491957e`.
- Failure scenario: a later session follows §3 and resumes from the closed setup-reconcile branch instead of the active PR #9 branch.
- Why it matters: the handoff contains conflicting current Git state.
- Required correction: refresh §3 with the current branch, HEAD, status, and relevant history.
- Owner: builder
- Status: open

### Self-check audit

Applicability list for this spec-only change: FE-05 (keyboard operation and focus), FE-14 (mobile overflow), FE-70 (desktop/mobile browser coverage), A11Y-01 (keyboard and focus), A11Y-06 (real-browser checks and automated scan), MON-06 (recurring invoice rate behavior remains unchanged), UNI-02 (no new business values), UNI-07 (secret hygiene), UNI-12 (file scope), UNI-13 (CI gates), and `PROJECT.md` §9 (no exception or owner decision changed).

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| FE-05 | Yes — count link is keyboard operable with visible focus | pass | pass | Verification (r) 13 | none |
| FE-14 | Yes — new responsive checks | pass | pass | Verification (r) 14 | none |
| FE-70 | Yes — browser checks at desktop and mobile widths | pass | pass | Verification (r) 13–14; Playwright plan | none |
| A11Y-01 | Yes — keyboard operation, visible focus and tab order | pass | pass | Verification (r) 13 | none |
| A11Y-06 | Yes — browser plus automated accessibility check | pass | pass | Verification (r) 14 | none |
| MON-06 | Yes — test setup touches recurring FX behavior; rule itself unchanged | pass | pass | Verification (r) cases 1–14; money rules | none |
| UNI-02 | Yes — ensure no business values introduced | pass | pass | diff adds no product/business value | none |
| UNI-07 | Yes | pass | pass | diff contains no secrets | none |
| UNI-12 | Yes | pass | pass | diff changes one in-repository spec file | none |
| UNI-13 | Yes — CI required | pass (CI) | pass | exact-head dependency audit, secret scan, typecheck/lint/test all pass | none |
| `PROJECT.md` §9 | Yes — confirm no owner exception changed | pass | pass | no `PROJECT.md` or decisions-log change | none |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 9 --repo charliekhc/CRM` | PR open; base `main`; head `491957eaad01a29c4a1e9836b4b530b3dbf324c1` |
| `git fetch origin`; `git merge-base origin/main <head>` | base/merge base `3bc4604965c03dd6d5828ed1cc8260c1aa1d4794` |
| `git diff --stat <base>...<head>` / `git diff --name-status <base>...<head>` | One spec file; 43 changed lines (27 insertions, 16 deletions) |
| `git diff --check <base>...<head>` | Pass |
| `gh pr checks 9 --repo charliekhc/CRM` | Dependency audit, secret scan, typecheck/lint/test: all pass |
| Review Verification (o), (p), (q), (r), milestone references and Playwright plan against the previous round | The fixture rules remove the previously reported state contradictions; cases (r) 13–14 address keyboard and responsive coverage |
| Re-read PR head; `git status --untracked-files=no` in detached review checkout | Head unchanged; no tracked changes |
| Local tests | Not run; this is a documentation-only change and exact-head CI passed |

### Residual risks and test gaps
- The spec remains v4.6 draft and requires the formal spec review and Charlie's approval before setup reconciliation/build.
- The handoff's §3 Git-state snapshot remains stale; this is a P3 and does not block merging this PR.
- This review used GPT-6.1-sol, below the project's mapped deep tier; use Opus 5.5 for the next formal spec review.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.
