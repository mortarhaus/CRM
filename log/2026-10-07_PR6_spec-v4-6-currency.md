# PR 6 — docs: spec v4.6 draft revision 7: currency handling for money, accepted rounding limits, recurring FX rate per run with an in-app signal (MON-02, MON-04, MON-05, MON-06)

- **Merged:** 2026-10-07T10:32:48Z (GitHub) · **Merge commit:** `3bc4604965c03dd6d5828ed1cc8260c1aa1d4794` · **Branch:** `docs/spec-v4.6-service-currency` (final head `f53d41c24ddd7b53f9a074866963f6c9e62abbe7`)
- **Gate breaches:** none. The final review round's head SHA (`f53d41c…`) equals the PR's final head SHA, and the receipt was written before the merge.
- **Approval receipt:** `reviews/PR-6.receipt` on `agent-logs`, commit `1ce6456c1299a154c129d4b89cd706fc4332b02d` (written 2026-10-07T10:29:52Z; merge was 2026-10-07T10:32:48Z; reviewed head `f53d41c24ddd7b53f9a074866963f6c9e62abbe7`; review-file hash `d86dcdfb241113484e1fdafa4a4335c42fb40cc0`, archived in commit `5cf9ef4eb95f695fdc9bdb554a9000f591d2bb76`)
- **Merge evidence:** `gh pr view 6` → state MERGED, mergedBy `charliekhc`, merge commit above; `git merge-base --is-ancestor 3bc4604 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-07).
- **Drafted by:** Claude Sonnet 5.5 applying drafts from Opus 5.5 sub-agents (money/spec work) · **Final verdict:** Approved (round 7)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.6 draft, revision 7; **not yet approved as a spec**) · **Plan:** none · **Milestone:** pre-Phase 0 PR 2 (spec amendment)

## What changed
Three files, +320/−25, over seven revisions. Spec v4.6 changes only currency handling for money: a catalog service price carries its own currency; stored `line_item.currency`, `credit_note.currency` and a frozen `base_currency`; a draft currency change is refused while the document holds monetary input; FX rate guards, an FX source for credit notes, payments and refunds, and reporting per frozen base currency; a proposal link guard for milestones by amount; cumulative rounding across the rows of one invoice (no negative rows, DB CHECKs); a recurring invoice template stores no rate and each foreign-currency run is a draft until a user confirms a rate, with an in-app "Needs rate" badge and a plain dashboard count. `docs/DECISIONS.md` gets the matching entries and `agents/PROJECT.md` §9 (MON-02 line) is updated. v4.5 stays the approved spec until v4.6 is approved.

## Why
Charlie's catalog needs prices in more than one currency (MON-02). Bob's reviews R1–R6 found the rules around currency change, FX source, reporting, link guards, rounding and recurring runs incomplete. Each fix was an owner decision recorded in `docs/DECISIONS.md`.

## Review rounds
- R1 (2026-10-03, Revision required): service currency and prefill rules → revision 2.
- R2 (Revision required): [P1] Draft currency guard omits linked proposal amounts and an existing FX rate; [P1] Base values for credit notes, payments and refunds have no defined FX source; [P1] Reporting behavior remains undefined when frozen base currencies differ → revision 3 (Charlie: "yes" to Bob's A, A, B).
- R3 (Revision required): [P1] Re-linking a fixed-amount proposal can silently change the milestone currency; [P1] Fully settled invoices can show a false base-currency outstanding amount → revision 4 (Charlie: Decision 1 = A, Decision 2 = A).
- R4 (Revision required): [P1] Reconciliation can store a negative base amount; [P2] Quote unlink and hard-delete policy exceeds the recorded owner decision → revision 5 (Charlie: A = 1, B = 1; cumulative rounding, refusal confirmed).
- R5 (Revision required): [P2] Post-void rounding gap; [P2] Credit-note component amounts vs cumulative total; [P2] Recurring invoices reuse a confirmed FX rate → revision 6 (Charlie: D1 = A, D2 = A, D3 = B).
- R6 (Revision required): [P1] Required dependency audit fails (`source-map-js`, UNI-13); [P2] The no-notification choice for waiting recurring invoices is unapproved → revision 7 and chore PR #7 (Charlie: X = A, Y = B).
- R7 (2026-10-07, **Approved**): no findings.
- Each round's P3 (handoff or PR-body drift) was fixed by the builder.

## Deferred conditions
- none

## Decisions worth keeping
- Spec v4.6 is still a **draft**. Merging PR #6 put it on `main`, but Bob's R7 says the PR review does not replace the separate `review spec` approval or Charlie's approval of v4.6. `agents/PROJECT.md` §2 still holds v4.5's spec hash until `setup` reconciles; `build` stays blocked until a kit-format spec review exists for the final hash and the reconcile is done.
- Rules Andy specified beyond the literal owner choice, for Bob's spec review: the two-series cumulative form and the post-void gap rule; the credit-note and refund cases; the recurring-run detail (no rate column, "current" means confirmed on the run's own draft); the "Needs rate" badge and count definition (valid `fx_rate`, Admin/Owner only, plain count).
- Charlie accepted explicitly on 2026-10-06: the post-void gap with accumulation, the credit-note parts-vs-total rounding, and draft-only recurring runs. Optional and unspecified: confirming a rate ahead of a run (needs a validity window, a business number).
- Lasting decisions are in `docs/DECISIONS.md` (2026-10-03 to 2026-10-06 entries).

## Follow-ups
- `setup` (Part B reconcile of `agents/PROJECT.md` §2 spec hash, v4.5 `27b43ef…` → merged v4.6 hash).
- `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` in Bob's window for the final spec hash; Bob also rules on the "Proposed, not approved" items and the "Open for Bob" list in `agents/PROJECT.md` §9.
- Charlie's approval of spec v4.6 in his own words.
- Then `build` (Phase 0 PR 2, tasks 6–10).
- Cleanup needing Charlie's OK: worktree `.agent/worktrees/build-chore-audit-source-map-js` and local branches `chore/audit-source-map-js`, `chore/agent-kit`, the old `.claude/worktrees/` folders.
- Process: PR #7 was merged without review or receipt (breach in its log); run `review N` then `approved N` before every merge.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-6.md (that file is local only). -->

## Round 7 — 2026-10-07 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `908093c125aefd5bc9374f50687f8d4a34ff0116` · head `f53d41c24ddd7b53f9a074866963f6c9e62abbe7` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 7 · hash (`git hash-object`) `583533732daa8ac9634374514bc664c9bc73dcaa`

**Verdict:** Approved
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project maps formal money/spec review to its deep tier (Opus 5.5); this is a PR slice review, not that separate spec approval.

### Findings
No blocking findings.

### Self-check audit
Applicable rules were determined from the currency, rounding, recurring-run and in-app signal changes before comparing the PR self-check.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| MON-02 / MON-04 / MON-05 / MON-06 | yes — currency rules, cumulative rounding, reporting and recurring FX behavior are the substance of v4.6 | pass | pass | Spec defines each rule and carries the owner choices through dashboard, accounting, and verification cases | no |
| REC-01 / REC-06 | yes — issued invoice lifecycle stays frozen; recurring linkage distinguishes generated drafts; invoice number remains assigned on issue | pass | pass | Spec data model and Money rules; verification (r) 6, 8, 11 | no |
| EVT-01 / EVT-06 | yes — feature defines that the signal adds no event or job while preserving normal issue/send events | pass | pass | Spec lines 496 and 1021; no new event or job is proposed | no |
| AUTH-03 | yes — visibility is restricted by role | pass | pass | Spec lines 495, 572, 633; verification (r) 8 | no |
| TEN-09 / TEN-11 | yes — count and filtered invoice list must stay within active workspace context | pass | pass | Spec lines 495, 572; verification (r) 12 checks two-workspace isolation and RLS | no |
| FE-05 / `FRONTEND_STANDARDS.md` §3 | yes — badge and dashboard count/link add UI requirements | pass | pass | Badge is visible text; count label is a link; verification (r) 8–9 covers label, roles and destination | no |
| UNI-02 | n-a — no business value or threshold is introduced | pass | n-a | Draft state and count are derived without a new threshold or monetary value | no |
| UNI-07 / UNI-12 | yes — hard secret and repository scope rules apply to all changes | pass | pass | Exact-head Secret scan passed; changed files are in the repository | no |
| UNI-13 | yes — prior Round 6 audit blocker must be cleared for this head | pass | pass | `main` includes PR #7 merge `908093c`; exact-head dependency audit passed | no |
| UNI-14 | n-a — no package resolution or lockfile change is introduced by this PR's diff against `main` | n-a | n-a | Three-file docs diff | no |
| Lock order / `agents/PROJECT.md` §9 | yes — existing proposal and invoice money invariants remain part of the v4.6 spec amendment | pass, unverified at runtime | pass as specification text; runtime unverified | Spec retains the established lock chains and explicitly states no new locks for the derived signal | no |

### Verification performed
| Command / check | Result |
|---|---|
| `git diff --stat` / `git diff --name-status` from merge base to head | 3 files: `agents/PROJECT.md`, `docs/DECISIONS.md`, spec; 320 insertions, 25 deletions |
| `git diff --check 908093c...f53d41c` | pass |
| Exact-head CI (`gh pr checks 6`, head `f53d41c…`) | Dependency audit pass; Typecheck, lint, test (workflow also runs build) pass; Secret scan pass (run `37492618922`) |
| PR head re-read after review | still `f53d41c24ddd7b53f9a074866963f6c9e62abbe7` |
| Detached checkout tracked status | clean |

### Residual risks and test gaps
- No application behavior was executed; this PR changes specification and decision records. The specified badge, dashboard count, role behavior, and workspace isolation remain to be verified in the implementing Phase 5 work.
- This PR review does not replace the separate `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` approval or Charlie's approval of v4.6; v4.5 remains the approved specification until those gates are complete.

### Required before merge
-

### Deferred conditions
-

### Optional improvements
-
