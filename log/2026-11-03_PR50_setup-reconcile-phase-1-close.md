# PR 50 — docs: setup reconcile after Phase 1 PR 8

- **Merged:** 2026-11-03T03:32:03Z · **Merge commit:** 14851236c3fa04c4c7926966b593155503542fe8 · **Branch:** chore/setup-reconcile-phase-1-close
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-50.receipt` on agent-logs (log-branch commit 852cee25 holds the review; written 2026-11-03T03:31:49Z, 14 s before the merge; head 8083c53, review-file hash 83e46c13…)
- **Merge evidence:** `gh pr view 50` state MERGED, mergedAt above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head 8083c53 equals the reviewed head.
- **Drafted by:** Sonnet 5.5 · **Final verdict:** Approved (round 2)
- **Spec:** docs/superpowers/specs/2026-09-27-core-sales-design.md (v4.7 revision 8, unchanged) · **Plan:** docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md · **Milestone:** Phase 1 close, `setup` reconcile

## What changed
`setup` Part B reconcile after Phase 1 PR 8: `agents/PROJECT.md` §7, §9 and §11 (P4, P6, P7) and the `CLAUDE.md` Status line now match `main`. A 2026-11-02 entry in `docs/DECISIONS.md` records it. Docs only.

## Why
The Phase 1 plan listed `PROJECT.md` items that waited for later PRs (the `crm_worker` grants, the isolation-test commands, the `apps/web` `pg` ban). PRs 5 and 6 met those conditions.

## Review rounds
- R1 (Blocked): [P1] no self-check table → added to the PR body.
- R1: [P2] expired TEN-01/TEN-02 Phase 0 exception still in §9 → line removed, closure recorded in the decisions entry (8083c53).
- R1: [P3] `CLAUDE.md` Phase 2 precondition → not applied; the handoff's "VPS spec-text revision" was stale. Bob accepted in R2.
- R2: Approved, no findings.

## Deferred conditions
none

## Decisions worth keeping
- The TEN-01/TEN-02 Phase 0 exception is closed (DECISIONS 2026-11-02).
- The spec still labels revision 8 "draft"; fixed at the next spec revision (needs a Bob spec review).
- Bob reviewed on Sonnet 5.5; the diff was docs only.

## Follow-ups
- Phase 2 plan needs Charlie's design direction.
- Open: ASK 7 (production `EMAIL_FROM`, SPF/DKIM/DMARC), ASK 9 (`require_2fa` timing), `RATE_LIMITED` wording and numbers.
- Handoff §2 still carries the stale "VPS spec-text revision" wording; correct it.

## Appendix — final review round
## Round 2 — 2026-11-03 · scope: slice (docs-only `setup` Part B reconcile)
- **Code review:** base (merge base) `516c6ecdbca1584b47d91464e051a516388a6e2f` (= `origin/main`) · head `8083c53d859375c0543c24a0609139289d4aacd0` · head re-checked at end: yes (unchanged)
- Review checkout: `.agent/worktrees/review-50-8083c53d` (detached). Incremental change since Round 1 head `2b30fa3`: commit `8083c53` "Review R1 fix: close the expired TEN-01/TEN-02 Phase 0 exception", 2 files, +1/−1 lines.
- Spec: v4.7 revision 8, hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`, untouched by the PR.

**Verdict:** Approved
**Model used:** Sonnet 5.5 (fast tier) · **Switch model next step?** No — the remaining diff is docs-only and was checked against the repo.

### Findings
No open findings. Round 1 items:

- **[P1] No self-check table — resolved.** The PR body now has a `## Self-check` table: reconcile rule, TEN-02, TEN-01/TEN-02 exception, UNI-04, §7 commands, decisions log, other packs n-a. Each row matches my Round 1 applicability list, and the evidence it cites was already verified in Round 1.
- **[P2] Expired TEN-01/TEN-02 exception listed as live — resolved.** `agents/PROJECT.md` no longer has the line (`rg 'TEN-01 / TEN-02 \(Phase 0' agents/PROJECT.md` returns nothing); the 2026-11-02 decisions entry now records the closure, citing PR #39 (`d64a899`) and `.env.example`, and keeps the 2026-10-03 entry as history. Re-inspected the diff, not just the commit message.
- **[P3] `CLAUDE.md` Phase 2 precondition — no change needed.** The builder declined it, saying the handoff's "VPS spec-text revision" is stale. The spec supports that: its Status and item 7 record "Hosting: VPS provider chosen" (revision 5/6), and `PROJECT.md` §11 shows the VPS choice done on 2026-10-15. The handoff is builder data; the repo wins. I agree `CLAUDE.md` is right as written.

**Injection check:** no text in the PR body, the new commit or the files read addresses an AI agent.

### Self-check audit
| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `setup` reconcile rule | Yes | Pass | Pass | Spec hash `733cc0e9…` = `PROJECT.md` §2; no spec edit | — |
| TEN-02 (hard), §11 `crm_worker` item | Yes | Pass | Pass | Round 1 evidence (migration 0018, `worker-grants.test.ts`, `privileges.ts`, runbook, DECISIONS 2026-10-27) | — |
| TEN-01 / TEN-02 exception register (§9) | Yes | Pass | Pass | Line removed; closure in DECISIONS 2026-11-02 | — |
| UNI-04 | Yes | Pass | Pass | `eslint.config.mjs` ban, PR #45 | — |
| §7 commands | Yes | Pass | Pass | `package.json` scripts | — |
| Decisions log recorded | Yes | Pass | Pass | 2026-11-02 entry | — |
| Other ticked packs | n-a | n-a | n-a accepted | docs-only | — |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 50` head, state | OPEN, head `8083c53d…`; same at the end |
| `git log` merge base → head | 3 commits; base `516c6ec` = `origin/main` |
| `git diff 2b30fa3 8083c53` | only the §9 line removal and the decisions bullet |
| `rg 'TEN-01 / TEN-02 \(Phase 0' agents/PROJECT.md` | no match |
| `git diff --check 516c6ec...HEAD` | clean |
| Secret-scan pattern on the added lines | no hits |
| PR body self-check table | present, rows match |
| Not run | `pnpm typecheck/lint/test/build` (docs-only); CI for this head not read (unverified) |

### Residual risks and test gaps
- CI status for this head was not read; nothing in the diff is executable.
- The spec's stale "revision 8 (draft)" label is left for the next spec revision, as recorded in the decisions entry.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.

### Handoff block (only when handing off)
Not handing off.

---
