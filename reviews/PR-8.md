# Review — PR #8

## Round 1 — 2026-10-07 · scope: slice
- **Code review:** base (merge base) `3bc4604965c03dd6d5828ed1cc8260c1aa1d4794` · head `1e343b3d6807e0a727a4c47ca3ce76b80d08fe18` · head re-checked at end: yes
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 7 · hash `583533732daa8ac9634374514bc664c9bc73dcaa`

**Verdict:** Revision required
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the separate v4.6 spec review concerns money rules and should use the project's deep tier (Opus 5.5).

### Findings

### [P2] Reconcile only after v4.6 is approved
- Category: guardrail mismatch
- Rule: `agents/START.md` — setup Part B reconcile
- Evidence: `agents/PROJECT.md:28` records the v4.6 draft's hash as “Spec hash at last reconcile,” and §1 / §9 adds v4.6 draft facts. The same file says v4.6 is not approved and v4.5 remains the source of truth. `agents/START.md:114-116` says a post-change reconcile compares project facts against the “newly approved spec”; `agents/START.md:140-145` directs the owner to run `setup` only after the spec review is Approved or Approved with conditions.
- Failure scenario: if the pending spec review requires a change, this PR has already marked the prior draft hash as reconciled and copied its assumptions into project guidance; the subsequent approved spec will need another reconcile, and the recorded “last reconcile” did not follow the setup gate.
- Why it matters: setup reconciliation is part of the build gate and should represent the reviewed, owner-approved source of truth. The PR itself confirms that v4.6 is still a draft.
- Required correction: wait for an Approved or Approved with conditions spec review and Charlie's approval of v4.6, then reconcile `PROJECT.md` against that exact approved hash. Keep the current approved-spec metadata until then.
- Owner: builder
- Verification: after approval, confirm `git hash-object` of the spec equals the `PROJECT.md` hash and recheck every spec-derived value changed here against that approved version.
- Disposition: before merge
- Status: open

### Self-check audit
| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-02 | yes — `PROJECT.md` restates product and currency facts | pass | pass, each changed fact is attributed to the v4.6 draft | Diff and v4.6 status in `agents/PROJECT.md` | no |
| UNI-07 | yes — hard secret rule applies to repository changes | pass | pass | Exact-head Secret scan passed | no |
| UNI-12 | yes — repository scope rule applies | pass | pass | Only `agents/PROJECT.md` changes | no |
| UNI-13 / UNI-14 | n-a — no CI configuration, dependency or lockfile change | n-a | n-a | One-file documentation diff | no |
| `PROJECT.md` §9 | yes — this PR changes project-specific instructions | pass | v4.6 facts are marked draft, but the reconcile is premature under `START.md` | `agents/PROJECT.md:28,181` and `agents/START.md:114-116` | yes |
| `START.md` setup reconcile gate | yes — this PR's stated purpose is Part B reconcile | not listed | fail: the spec is not approved | `agents/START.md:114-116,140-145`; PR body also states v4.6 is not approved | yes |

### Verification performed
| Command / check | Result |
|---|---|
| `git diff --stat` / `git diff --name-status` from merge base to head | One file: `agents/PROJECT.md`; 6 insertions, 5 deletions |
| `git diff --check 3bc4604...1e343b3` | pass |
| `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` | `583533732daa8ac9634374514bc664c9bc73dcaa`, matches the PR's recorded hash |
| Search for unresolved `{{` placeholders in `agents/PROJECT.md` | none |
| Exact-head CI (`gh pr checks 8`, head `1e343b3…`) | Dependency audit pass; Typecheck, lint, test (workflow also runs build) pass; Secret scan pass (run `37608786194`) |
| PR head re-read at end | still `1e343b3d6807e0a727a4c47ca3ce76b80d08fe18` |
| Detached checkout tracked status | clean |

### Residual risks and test gaps
- No local tests were run; this PR changes project documentation only, and exact-head CI passed.
- v4.6 remains unapproved. The project identifies v4.5 as the approved source of truth until the formal spec review and Charlie's approval.

### Required before merge
- Resolve the P2 setup-gate finding above.

### Deferred conditions
-

### Optional improvements
-
