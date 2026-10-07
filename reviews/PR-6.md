# Review — PR #6

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

## Round 6 — 2026-10-06 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · head `d888cc8adf1716d743e80c1666f2f45b06c2b11f` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 6 · hash (`git hash-object`) `1185ad44b2aeae5731207f8f8389302f1c5059bc`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps deep money/spec review to Opus 5.5; this session cannot select that project model.

### Findings

### [P1] Required dependency audit fails on a high severity advisory
- Category: guardrail mismatch
- Rule: UNI-13
- Evidence: exact-head CI run `37424639003`, job `112141411729` (`Dependency audit`) fails at `pnpm audit --audit-level high`: `source-map-js@1.2.1` is affected by GHSA-68fv-2mgg-jv7q (event-loop denial of service through indexed source-map section offsets; affected `<1.2.2`, patched `>=1.2.2`), with seven dependency paths including `apps__web>next>postcss>source-map-js`. The lockfile pins `source-map-js@1.2.1` at `pnpm-lock.yaml:1606,3157`. CI reports two high advisories, one ignored; the remaining unignored advisory makes the required job fail. The PR diff does not modify dependencies, but the required check fails at this head.
- Failure scenario: PR #6 cannot pass its required CI checks while this vulnerable resolution remains in the dependency tree.
- Why it matters: project rule UNI-13 requires a passing dependency audit; failing CI blocks merge. The flagged package also has a high severity denial-of-service advisory.
- Required correction: update the affected transitive resolution to a patched version (`>=1.2.2`) through a compatible dependency or override, then rerun the audit and exact-head CI. If the project intends an exception instead, record the narrowly scoped owner-approved exception and its evidence before treating this check as passing.
- Owner: builder
- Verification: exact-head `pnpm audit --audit-level high` and CI dependency-audit job pass with no unapproved high advisory.
- Status: open

### [P2] The no-notification choice for waiting recurring invoices is unapproved
- Category: material risk
- Rule: MON-06; recurring-run behavior (revision 6)
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:484-487` says a foreign-currency `auto_send` run remains an unsent draft, adds no event or notification, and appears in the invoice list. The PR description and decision record identify the no-notification behavior as Andy's detailed specification of Charlie's D3 choice, not a separate owner decision.
- Failure scenario: a recurring period becomes due in a foreign currency; the worker creates a draft and sends nothing, but no notification tells the owner that automatic billing is waiting for a rate confirmation.
- Why it matters: this changes an `auto_send` workflow into a manual follow-up. A draft's presence in the ordinary invoice list may not alert the owner that a recurring invoice was missed.
- Required correction: Charlie should explicitly accept no notification or choose an owner notification/in-app signal for a recurring invoice waiting for a confirmed rate; update the spec and verification cases to match.
- Owner: owner
- Disposition: before merge
- Status: open

### Applicability and self-check audit

Applicable: MON-02, MON-04, MON-05, MON-06; REC-01 and REC-06; EVT-01 and EVT-06; proposal/quote lock-order constraints in `agents/PROJECT.md` §9; UNI-02, UNI-07, UNI-12 and UNI-13. Frontend, auth, public-links, files/templates and payment-provider packs do not apply to this docs-only diff. The current PR self-check covers the applicable money, finalized-record, event/job, lock-order and universal rules; however, its `UNI-13 pass` conflicts with the failed dependency-audit job above. Its no-notification behavior is described as an assumption rather than an owner decision.

### Verification and residual risks
- Exact-head diff reviewed in detached checkout `.agent/worktrees/review-6-d888cc8a`; merge base `8b1795cb3b0ee5b9513186920ec1d2e5ba922730`.
- `git diff --check 8b1795cb3b0ee5b9513186920ec1d2e5ba922730...d888cc8adf1716d743e80c1666f2f45b06c2b11f` — passed.
- GitHub CI at the start of review: typecheck/lint/test passed; secret scan passed; dependency audit failed (run `37424639003`). Audit log inspected to identify `source-map-js@1.2.1` and GHSA-68fv-2mgg-jv7q.
- Runtime behavior was not exercised; this PR changes documentation only. Builder's 30,000-sequence arithmetic claim in the PR body was not independently reproduced.
- R5 decisions are reflected in the revision 6 spec and decision log. The handoff and PR body are current. v4.6 remains a draft; this PR review is not the kit-format spec-review round required by the later `build` gate.
- Model used: GPT-6.1-sol. Switch model next step: Yes — use the project's deep tier (Opus 5.5) for remaining money/spec review.

**Verdict:** Revision required

## Round 5 — 2026-10-06 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · head `a8078a50d618b5253b69bbf221da2b11dde84f08` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 5 · hash (`git hash-object`) `3dc9dd59d4012eabba449735968928e9955326f3`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps deep money/spec review to Opus 5.5; this session cannot select that project model.

### Findings

### [P2] Post-void rounding can leave the receivable one minor unit wrong
- Category: material risk
- Rule: MON-04, MON-06; Charlie's Decision B on Bob R4
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:503-509` permits a series to remain off target after a void. Verification (q)4 at line 977 gives a concrete state: on a $0.10 invoice at 0.51 MYR/USD, credit notes A and B are each $0.01; A stores 0, B stores 1 sen; voiding A leaves the $0.09 receivable at base outstanding `5 − 1 = 4` sen, while `conv($0.09) = 5` sen. The decision record says this gap rule is Andy's specification, pending Charlie's confirmation.
- Failure scenario: an owner voids an earlier credit note after a later credit note has been issued. Until a later row in that series moves the cumulative target enough, dashboard and export understate the open base receivable by one sen; multiple non-latest voids can accumulate the difference.
- Why it matters: Charlie chose cumulative rounding with rows summing to the invoice base total. This documented exception means the totals do not always reconcile after voids, and the owner has not accepted that limit.
- Required correction: obtain Charlie's explicit acceptance of the per-void discrepancy and its possible accumulation, or specify a reconciliation rule that preserves the chosen invariant without changing frozen rows; keep a test for the voided-row case and dashboard/export result.
- Owner: owner
- Disposition: before merge
- Status: open

### [P2] Credit-note component amounts may exceed its cumulative base total
- Category: material risk
- Rule: MON-04, MON-06; Charlie's Decision B on Bob R4
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:488` says credit-note subtotal, discount and tax-group base amounts are converted on their own while only the total follows cumulative rounding. Verification (q)2 at line 975 says a $0.01 note at 0.51 can have a one-sen base subtotal and a zero-sen base total.
- Failure scenario: a credit-note snapshot or any consumer of its base detail shows subtotal `1` and total `0`; the component values do not reconcile to the row amount used by the dashboard and period export.
- Why it matters: the owner approved cumulative row allocation, but this separate treatment of the credit note's component amounts was not part of that choice. It leaves different base representations of the same finalized credit note.
- Required correction: get Charlie's explicit choice on whether this component/total mismatch is acceptable. If not, define cumulative allocation for the base components too, with a fixture proving they reconcile to the credit-note base total.
- Owner: owner
- Disposition: before merge
- Status: open

### [P2] Recurring invoices reuse a confirmed FX rate indefinitely
- Category: material risk
- Rule: MON-06; Money rules, "Draft currency change"
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:355` stores a confirmed `fx_rate` on the recurring template and says each run takes it; lines 457 and 479 require a valid confirmed rate for issue, but no expiry, refresh or per-run confirmation is defined. The PR description lists reuse of the template's confirmed rate as an assumption.
- Failure scenario: a recurring template confirmed at 4.4567 continues issuing invoices at that rate after the workspace's current USD/MYR rate has materially changed; with `auto_send`, a due run can issue and send without another confirmation.
- Why it matters: the rate is frozen onto each invoice and used for base-currency reporting, so a stale template value creates a sequence of finalized documents with base totals based on a rate the owner may no longer intend.
- Required correction: Charlie must decide whether a recurring template intentionally fixes one rate for all periods or whether each run must obtain a current user-confirmed rate (with a draft-only outcome when none is confirmed); write that rule and tests into the spec.
- Owner: owner
- Disposition: before merge
- Status: open

### [P3] Handoff still reports the old spec revision and review state
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:11` calls the active spec revision 3, and line 16 still says head `fcb183e`, Round 3 findings unresolved and Charlie's choices pending; pinned PR #6 is revision 5 at `a8078a50d618b5253b69bbf221da2b11dde84f08`. Later handoff §5 notes revision 5, so the file conflicts with itself.
- Failure scenario: a resume session can repeat already answered questions or inspect the wrong review head.
- Why it matters: the file is the next session's in-flight state and currently has contradictory targets.
- Required correction: builder refreshes the active target, current PR head, last review and next steps consistently throughout the handoff.
- Owner: builder
- Status: open

### Applicability and self-check audit

Applicable: MON-02, MON-04, MON-05, MON-06; REC-01 and the proposal/quote lock-order constraints in `agents/PROJECT.md` §9; UNI-02, UNI-07, UNI-12 and UNI-13. Frontend, auth, public-links, files/templates, events/jobs and payments packs do not apply to this docs-only diff.

The current PR self-check includes these applicable money and delivery rules. Its statements about the ordinary cumulative-series identities, nonnegative row CHECKs and lock order match the spec text. The open decisions identified above are not resolved by those self-check rows; no runtime evidence is available in this docs-only PR.

### Verification and residual risks
- Exact-head diff reviewed in detached checkout `.agent/worktrees/review-6-a8078a50`; merge base `8b1795cb3b0ee5b9513186920ec1d2e5ba922730`.
- `git diff --check 8b1795cb3b0ee5b9513186920ec1d2e5ba922730...a8078a50d618b5253b69bbf221da2b11dde84f08` — passed.
- GitHub CI at exact head `a8078a50d618b5253b69bbf221da2b11dde84f08`: typecheck/lint/test, dependency audit and secret scan all passed (run `37303833100`).
- Runtime money behavior was not exercised; this PR changes documentation only. Builder's random-sequence arithmetic claim in the PR body was not independently reproduced.
- PR body is now revision 5 and records both owner choices. v4.6 remains a draft; this PR review is not the kit-format spec-review round required by the later `build` gate.
- Model used: GPT-6.1-sol. Switch model next step: Yes — use the project's deep tier (Opus 5.5) for the remaining money/spec decisions.

**Verdict:** Revision required

## Round 4 — 2026-10-05 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · head `c811294dea7c080c8464b20307bd8c8b18e3323f` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 4 · hash (`git hash-object`) `c0931c826b302deee1d9d94e584cc5fe18eaa2d6`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps deep money/spec review to Opus 5.5; this session cannot select that project model.

### Findings

### [P1] Reconciliation can store a negative base amount for a positive transaction
- Category: material risk
- Rule: MON-04, MON-06
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:476-485` assigns the settlement row the remaining base balance; line 494 explicitly permits a zero or negative result and says no CHECK forbids it. The spec permits any confirmed FX rate greater than zero at line 457.
- Failure scenario: with a USD invoice of $0.10 at `fx_rate = 0.51` MYR/USD, its frozen base total is 5 sen. Nine sequential $0.01 payments each convert to 1 sen (0.51 sen rounded half away from zero); the final $0.01 payment settles the document but receives `5 − 9 = −4` sen as its base amount. A positive payment is therefore exported and reported as a negative invoice-rate equivalent.
- Why it matters: the stored payment amount no longer represents a valid nonnegative allocation of the transaction, and an arbitrarily long sequence can make the discrepancy grow. The exact-reconciliation choice cannot make negative payment/credit/refund rows safe to report.
- Required correction: define and test a rule that prevents a positive payment, credit note, or refund from receiving a negative base amount while preserving a coherent dashboard/export total; add this concrete rate and split-payment fixture. If the invariant cannot be met with immutable earlier rows, specify and obtain owner approval for the alternative reporting/allocation behavior rather than permitting negative rows silently.
- Owner: builder
- Verification: exact-rational fixture for the stated ten-cent invoice and nine one-cent payments, plus equivalent settling credit-note/refund boundary cases; assert stored rows and dashboard/export amounts are nonnegative and totals follow the documented rule.
- Status: open

### [P2] Quote unlink and hard-delete policy exceeds the recorded owner decision
- Category: spec/guardrail mismatch
- Rule: owner decision 2026-10-05, Decision 1; MON-02
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:445-456` makes unlinking and deleting a quote with a fixed-amount milestone refuse, while line 456 itself says those refusals await Charlie's confirmation. The recorded choice in `docs/DECISIONS.md` covers refusing a link to a quote of another currency; it does not choose what unlink/delete should do.
- Failure scenario: a user must remove or convert every amount milestone before unlinking a proposal or deleting its draft quote, even when the user intends to discard the proposal/quote; that extra restriction has not been approved.
- Why it matters: this adds product behavior and blocks draft cleanup beyond the explicit owner decision. The spec also labels this as awaiting confirmation, so the intended behavior is unresolved.
- Required correction: obtain Charlie's explicit choice for unlinking and quote deletion, then align the spec, decision record and verification cases with that choice.
- Owner: owner
- Disposition: before merge
- Status: open

### [P3] PR description still documents revision 3
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: PR #6 description says the spec is “draft, revision 3” and describes Open question 16 as pending, while pinned head `c811294` is revision 4 and resolves it. Its change list and self-check also omit the revision 4 proposal-link guard and reconciliation rules.
- Failure scenario: readers use the PR description to review or resume work and rely on superseded requirements and tests.
- Why it matters: the description is materially stale, though the source spec is current.
- Required correction: refresh the PR title/body to identify revision 4, Charlie's two choices, the reconciliation behavior and its remaining edge case; update the self-check against the current diff.
- Owner: builder
- Status: open

### Applicability and self-check audit

Applicable: MON-02, MON-04, MON-05, MON-06; REC-01 and the proposal/quote lock-order constraints in `agents/PROJECT.md` §9; UNI-02, UNI-07, UNI-12 and UNI-13. Frontend, auth, public-links, files/templates, events/jobs and payments packs do not apply to this docs-only diff.

The PR body contains a self-check table, but it is stale for this head: it identifies revision 3 as current, marks Open question 16 pending, and has no row/evidence for the new settlement remainders or proposal link/relink/unlink rules. Re-read the applicable money and lock-order requirements above; this audit does not rely on that prior self-check as evidence.

### Verification and residual risks
- Exact-head diff reviewed in detached checkout `.agent/worktrees/review-6-c811294d`; merge base `8b1795cb3b0ee5b9513186920ec1d2e5ba922730`.
- `git diff --check 8b1795cb3b0ee5b9513186920ec1d2e5ba922730...c811294dea7c080c8464b20307bd8c8b18e3323f` — passed.
- GitHub CI at exact head `c811294dea7c080c8464b20307bd8c8b18e3323f`: typecheck/lint/test, dependency audit and secret scan all passed (run `37277742485`). These checks validate the repository state, not the proposed financial semantics.
- PR head re-read at end: still `c811294dea7c080c8464b20307bd8c8b18e3323f`. Detached checkout tracked status is clean.
- Runtime behavior was not exercised; this PR changes documentation only. The negative-row example is specification arithmetic and must be covered in the implementing phase.
- Model used: GPT-6.1-sol. Switch model next step: Yes — use the project's deep tier (Opus 5.5) for money/spec review.

**Verdict:** Revision required

## Round 3 — 2026-10-04 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · head `fcb183ea21eddb325762c33e061adb49bf9b4385` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 3 · hash (`git hash-object`) `b750c9c9fd15612e047528fdef0709feecd0b9c8`

**Verdict:** Revision required
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps deep money and spec reviews to Opus 5.5; this session cannot select that project model.

### Findings

### [P1] Re-linking a fixed-amount proposal can silently change the milestone currency
- Category: material risk
- Rule: MON-02, MON-05; spec Money rules, proposal payment schedule
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:337` says a milestone by amount is read in the linked quote's currency. The guard at lines 427–429 checks a **quote currency change** against currently linked proposals, but the reverse action at lines 429 and 667 only locks the proposal and target quote `FOR SHARE`; it does not check a milestone when setting or changing `proposal.quotation_id`. The PR body lists this gap. Verification line 872(h) claims that a link-vs-currency-change race can never let both transactions commit, although the link can proceed after the currency change commits.
- Failure scenario: a proposal has a `500000` fixed milestone linked to a MYR quote. An owner links it to an otherwise eligible USD quote, or a quote changes to USD before the proposal link transaction obtains its quote lock. The same stored number is then displayed as USD without repricing.
- Why it matters: this is the same silent reinterpretation that the owner-approved currency-change refusal is intended to prevent; the new locks alone do not enforce the invariant.
- Required correction: define and enforce the inverse guard when a proposal with a current fixed-amount milestone is linked or re-linked to a quote, including a currency compatibility rule or an explicit repricing flow chosen by the owner. Keep the proposal-to-quote lock order. Correct line 872(h) and add sequential re-link and forced interleaving tests that prove no amount is reinterpreted.
- Owner: builder; owner for any product choice beyond the existing refusal policy
- Verification: trace a MYR fixed milestone through a link to a USD quote, then force both orders of link versus quote currency change under the specified locks; the system must refuse or explicitly reprice rather than silently keep `500000`.
- Status: open

### [P1] Fully settled invoices can show a false base-currency outstanding amount
- Category: spec/guardrail mismatch
- Rule: MON-04, MON-06; spec Dashboard v1 and Open question 16
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:441` says each payment is independently converted and rounded, with no reconciliation. Dashboard line 472 defines outstanding and overdue as frozen invoice base total less stored base credit and net-payment amounts. Verification line 872(n) gives an invoice base total of `4457` and four payments totalling `4456` in base units, yet asserts the paid invoice is excluded from outstanding by status. The dashboard rule only explicitly excludes `credited` invoices (line 474); Open question 16 at line 154 says the independent-rounding policy is still pending Charlie.
- Failure scenario: a USD $10 invoice is fully paid in four $2.50 payments. Its status is `paid`, but the stated dashboard subtraction reports MYR `0.01` outstanding or overdue. The implementing team could instead follow the fixture and report zero, producing two valid readings of the draft.
- Why it matters: the dashboard and export are financial handoff surfaces; a settled invoice must not appear collectible because per-row FX rounding differs from the frozen invoice total.
- Required correction: get Charlie's choice on Open question 16 before treating this money behavior as approved. If independent rounding is chosen, explicitly exclude `paid`, `credited` and `void` invoices from outstanding/overdue and define the calculation for genuinely open invoices; retain the disclosed base paid-versus-invoiced difference. If reconciliation is chosen, specify its payment/credit/refund behavior. Make the dashboard prose and fixture agree.
- Owner: owner for the rounding choice; builder for the spec and tests
- Verification: the four-payment fixture yields `paid = 4456`, `invoiced = 4457` and `outstanding = overdue = 0` if independent rounding is selected; partial-payment and fully credited cases follow the same stated status rule.
- Status: open

### [P3] Handoff still points to the old spec hash and open question
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:50` calls `ace92c176a337a3b0309644fd959a7a9e8daf840` the current spec hash, while the pinned head hashes to `b750c9c9fd15612e047528fdef0709feecd0b9c8` (also recorded at handoff line 46). Handoff line 57 calls Open question 15 open, while the spec at line 153 and `agents/PROJECT.md:204` mark it resolved. The handoff is git-ignored and outside this PR's three-file diff.
- Failure scenario: the next builder or spec-review session targets the wrong hash or repeats an answered question.
- Why it matters: the correct details are elsewhere in the handoff, so impact is limited, but this file is the resumption record.
- Required correction: builder refreshes handoff §§5–6 after the next spec edit and decision.
- Owner: builder
- Verification: compare handoff hash and open items to the new exact PR head, decisions log and spec.
- Status: open

Round 2 P1 #1 is resolved for **existing links** and the stale FX rate: lines 429–430 now guard current proposal amounts, clear a changed document's rate and require a rate for the new currency pair. The new P1 above covers the inverse link action. Round 2 P1 #2 is resolved for FX source and storage on credit notes, payments and refunds (lines 328–331 and 436–441), with the cross-row rounding/reporting conflict above still open. Round 2 P1 #3 is resolved for grouping by frozen base currency and pipeline drafts (lines 338, 434, 472 and 485). The owner's A/A/B decision is recorded and is not reopened. Round 2 P3 was partly corrected; the remaining handoff drift is above.

### Self-check audit

Independent applicability list, extended from Round 2 for the new milestone and FX/reporting paths: MON-01–07; REC-01; TEN-05/06/09; UNI-02/07/12/13/14; the spec lock-order rule and `PROJECT.md` §9. The builder's PR table contains these entries. No applicable rule was missing. Frontend, auth, public-link, files, events/jobs and payment-provider packs do not apply to this three-file spec amendment. The payment-provider pack is about collection, checkout and webhooks; these changes specify manual payment records.

| Rule | Builder said | Reviewer found | Evidence / disagreement |
|---|---|---|---|
| MON-01, MON-03, MON-07 | n-a | No change to amount representation, serialization or server-recompute rule | Money rules; runtime not tested in this docs PR |
| MON-02, MON-05 | pass | Existing quote links and mixed-currency reporting are specified, but re-linking a fixed-amount proposal can reinterpret its currency | spec lines 337, 427–429, 667; P1 |
| MON-04, MON-06 | pass, with open item | Per-row formula and frozen rates are specified; outstanding/overdue conflict with the rounding fixture, and the policy awaits Charlie | lines 154, 441, 472, 872(n); P1 |
| REC-01; TEN-05/06/09 | n-a / spec text | Frozen snapshot fields and equality triggers specified; no direct violation found | data model lines 323–331; implementation unverified |
| Lock order | pass, unverified at runtime | Proposal-before-quote order retained; the link path lacks a currency invariant, independent of deadlock safety | lines 429, 667; P1 |
| UNI-02, UNI-07, UNI-12 | pass | No fixed business currency invented, no secret value in changed files, all paths in repo | diff and targeted secret scan |
| UNI-13 | pass | Exact-head CI green; build is included in its checks workflow | run `37134943217` |
| UNI-14 | n-a | No dependency, lockfile or workflow change | three-file docs diff |
| `PROJECT.md` §9 | pass | Owner decisions reflected; Open question 16 is expressly undecided | `agents/PROJECT.md:204`; spec line 154 |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 6` at start and end | PR open at exact head `fcb183ea21eddb325762c33e061adb49bf9b4385`; three CI jobs successful |
| `git fetch origin`, `git cat-file`, `git merge-base` | Exact head available; merge base `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` |
| Detached checkout `.agent/worktrees/review-6-fcb183ea` | Pinned to head; no tracked or staged changes at end |
| Effective three-dot diff, `git diff --stat`, `--name-status`, `git log` | Three docs files, +100/−20; revision commits 1–3 examined |
| `git diff --check` | Pass |
| `git hash-object` on v4.6 spec | `b750c9c9fd15612e047528fdef0709feecd0b9c8` |
| Targeted secret scan on changed files | Only instruction/example mentions of secret names; CI secret scan successful |
| CI run `37134943217` | Typecheck/lint/test, dependency audit and secret scan successful for this head; no local runtime tests for docs-only diff |
| Data model, Money rules, proposal flows, dashboard, export, verification, decisions and handoff | Cross-section checks found the two money ambiguities above |

### Residual risks and test gaps
- v4.6 is still a draft; v4.5 remains approved. This PR review is not the separate kit-format `review spec` record required for the later build gate.
- Runtime concurrency and money calculations cannot be verified from this docs-only PR. The implementing phase needs the real database-role and forced-interleaving tests specified here.
- The recurring template reuses its confirmed rate for later periods. This is stated in the PR body and spec; Charlie should explicitly accept or change that policy when approving v4.6. No direct guardrail violation is established in this round.

### Required before merge
- Resolve both P1 findings, update the spec's tests and self-check, and request another review at the new exact head.

### Deferred conditions
- None.

### Optional improvements
- Refresh the git-ignored handoff details in the P3 finding.

## Round 2 — 2026-10-03 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · head `c387dde3bb6849130eae0b3c9600b2be5e5ecfe4` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 2 · hash (`git hash-object`) `ace92c176a337a3b0309644fd959a7a9e8daf840`

**Verdict:** Revision required
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps deep money and spec reviews to Opus 5.5; this session is outside that table.

### Findings

### [P1] Draft currency guard omits linked proposal amounts and an existing FX rate
- Category: material risk
- Rule: MON-02, MON-05, MON-06; spec Money rules
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:417` permits a currency change when there are no lines or fixed document discount. A linked proposal can hold a payment-schedule milestone **by amount** (line 327), outside that check. Money rules at line 392 allow a manually entered `fx_rate`; the new currency-change rule neither clears it nor requires a rate for the new currency pair. The new tests at line 850 cover lines and document discounts, not these states.
- Failure scenario: an owner deletes quote lines, changes MYR to USD and adds new lines while a linked proposal still carries a fixed MYR milestone; that number is then read as USD. An empty draft with a previously entered MYR→base rate may also retain that rate after changing to JPY.
- Why it matters: the owner-approved refusal rule is meant to prevent silent reinterpretation of every currency-denominated input, and an FX rate is defined for a specific currency pair.
- Required correction: include linked proposal fixed-amount milestones in the guard, or store and enforce their own currency with an explicit repricing rule. On every allowed document-currency change, invalidate the old `fx_rate` and require a valid rate for the new pair before send/issue (including when the document has no lines). Add server-side and test cases for both paths.
- Owner: builder; owner for any change to the chosen product behavior
- Verification: inspect the draft-change rule, proposal payment-schedule model and tests; force both cases and confirm no old amount or rate is used in the new currency.
- Status: open

### [P1] Base values for credit notes, payments and refunds have no defined FX source
- Category: guardrail mismatch
- Rule: MON-02, MON-05, MON-06
- Evidence: the new text at `docs/superpowers/specs/2026-09-27-core-sales-design.md:421` promises frozen `base_currency`, `fx_rate` and base totals on a credit note, but its data model at line 320 names no `fx_rate` or rule for choosing one. Dashboard paid totals are net payments minus refunds by their own dates (line 454), and the revised period export promises base-currency columns on payment and refund rows (line 465), while their data-model bullets at lines 318 and 321 name no base amount, base currency or FX source. The PR body reports these gaps.
- Failure scenario: an invoice is issued in USD, then credited or paid after exchange rates or the workspace base currency change. Two builders can use different rates and produce different dashboard and export base totals for the same transactions.
- Why it matters: frozen currency labels do not define how the base numbers are calculated; money reports must be reproducible and cannot combine undefined conversions.
- Required correction: specify and store the FX source, base currency and calculated base amounts needed for credit notes, payments and refunds, including the timing of each conversion and how a credit note's currency/rate relates to its invoice. Enforce `payment.currency = invoice.currency` in the database, as the refund rule already does for its payment. Add cross-currency and later-base-currency-change fixtures for the credited and paid dashboard figures and the export.
- Owner: builder and owner for the conversion policy
- Verification: trace a foreign-currency invoice through credit note, payment, refund, dashboard and export using stated rates; the same rows yield one testable result.
- Status: open

### [P1] Reporting behavior remains undefined when frozen base currencies differ
- Category: guardrail mismatch
- Rule: MON-05; spec Dashboard v1 and Accounting handoff
- Evidence: Open question 15 at `docs/superpowers/specs/2026-09-27-core-sales-design.md:144` leaves mixed frozen base currencies undecided, while Dashboard v1 at line 452 still promises figures in workspace base currency and the period export at line 465 promises base columns. The pipeline board at line 328 promises base-currency values for draft proposals and quotes, but step 9 at line 391 freezes a conversion only on finalization, with no stated rate or base-currency policy for those drafts. The PR body acknowledges both gaps.
- Failure scenario: a workspace changes its base currency after issuing documents; the dashboard either adds old MYR base totals to new SGD base totals or cannot show the promised single figure. A draft pipeline value can likewise be shown in an undefined base currency or rate.
- Why it matters: the new per-document frozen currency makes the old single-currency reporting promise ambiguous. MON-05 forbids mixed-currency sums, and the spec must define a display and calculation behavior before the feature is built.
- Required correction: settle Open question 15 with an explicit display/aggregation policy, and specify the rate and currency used for draft pipeline values. Define what happens when currencies differ and add dashboard, board and export tests with two frozen base currencies and a draft in a foreign document currency.
- Owner: builder and owner for the reporting policy
- Verification: inspect the reporting sections and run the proposed mixed-currency fixtures; no total sums different currencies without an explicit conversion policy.
- Status: open

### [P3] Handoff still contains stale review and decision details
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:45` still says Charlie's service-currency answer is pending, while §5 and `docs/DECISIONS.md` record both choices. Line 70 says no review finding is open although PR #6 Round 1 was Revision required. Line 49 points to the old v4.5 hash for the next spec review while §5 gives the current draft hash.
- Failure scenario: the next session repeats an answered question or uses the wrong spec hash for its review gate.
- Why it matters: the current header and §5 are accurate, limiting impact, but the handoff is used to resume work.
- Required correction: builder refreshes §§4, 5 and 7 after this review.
- Owner: builder
- Verification: compare the handoff to the decisions log, current spec hash and newest PR #6 round.
- Status: open

Round 1 P1 #1 is resolved for priced quotation, draft invoice and recurring template lines and fixed document discounts: the server-side refusal, parent lock/version check and tests are specified at lines 417 and 850. Round 1 P1 #2 is resolved for the three requested storage sites: `line_item.currency`, `credit_note.currency` and frozen `base_currency` are in the data model and tests at lines 314–320, 421 and 850. The new P1 findings above cover remaining paths exposed by those changes. The owner's decisions themselves are not reopened.

### Self-check audit

The independent applicability list from Round 1 was rechecked against the new three-file diff and extended for the new trigger and immutable snapshots: MON-01–07; REC-01; TEN-05/06/09; UNI-02/07/12/13/14; `PROJECT.md` §9. No relevant active pack was omitted. The self-check contains rows for these rules. Its qualified `pass` labels for MON-05 and MON-06 cannot be accepted while the stated money/reporting paths remain undefined.

| Rule | Builder said | Reviewer found | Evidence / disagreement |
|---|---|---|---|
| MON-01, MON-03, MON-04, MON-07 | n-a | no change to representation, serialization, rounding or server recomputation rules; runtime remains unverified | Money rules; no disagreement for this diff |
| MON-02 | pass | requested currency storage now specified; proposal fixed amounts and payment/refund reporting still need currency handling | spec lines 317–321, 327, 465; P1 findings |
| MON-05 | pass, with open items | draft prefill is guarded, but mixed base totals and pipeline values have no policy | lines 144, 328, 452, 465; P1 findings |
| MON-06 | pass, with a gap | frozen codes specified; credit-note rate and payment/refund base conversion undefined | lines 318–321, 421, 454–465; P1 finding |
| REC-01; TEN-05/06/09 | n-a / spec text | new snapshot hash input and equality triggers are specified; trigger lock behavior is not runtime verified | lines 314–320, 417, 421, 850; no direct violation found |
| UNI-02, UNI-07, UNI-12 | pass | no fixed business currency invented, no secret value in diff, all changed paths inside repo | decisions and diff; targeted secret scan |
| UNI-13 | pass | exact-head CI green, including production build in the checks job | CI run `37118929864` |
| UNI-14 | n-a | no dependency, lockfile or workflow change | three-file docs diff |
| `PROJECT.md` §9 constraints | pass | owner choices reflected; Open question 15 is named but unresolved | `agents/PROJECT.md:204`; decisions log |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 6` at start and end | PR open; exact head `c387dde3bb6849130eae0b3c9600b2be5e5ecfe4`; three CI jobs successful |
| `git fetch origin`, `git cat-file`, `git merge-base` | exact head available; base `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` |
| Detached review checkout and `git status --untracked-files=no` | pinned head; no tracked or staged changes |
| `git diff --stat`, `--name-status`, effective three-dot diff | three docs files, +65/−16; two PR commits |
| `git diff --check` | pass |
| `git hash-object` on v4.6 spec | `ace92c176a337a3b0309644fd959a7a9e8daf840` |
| Targeted secret scan of changed files | only instruction/example mentions of secret names; CI secret scan success |
| CI run `37118929864` | typecheck/lint/test, dependency audit and secret scan successful for this head; no local runtime checks for docs-only diff |
| Data model, Money rules, proposal schedule, dashboard, export, decisions and handoff | checked cross-section consistency and identified the money paths above |

### Residual risks and test gaps
- v4.6 remains a draft; v4.5 is the approved baseline. This PR review is not the kit-format `review spec` record required by the later `build` gate. The `PROJECT.md` §2 reconciliation hash intentionally remains at v4.5.
- The `line_item` trigger's `FOR SHARE` interaction with every parent/line edit lock order is specified conceptually but was not tested here. The implementing phase must force relevant concurrent operations under the real database roles.
- Runtime money behavior was not tested because this PR changes no runtime code. CI success validates delivery checks, not the proposed financial semantics.

### Required before merge
- Resolve the three P1 money-spec findings, update the spec and self-check, and re-review the new exact head.

### Deferred conditions
- None.

### Optional improvements
- Refresh the handoff details in the P3 finding.

## Round 1 — 2026-10-03 · scope: slice (v4.6 spec amendment)
- **Code review:** base (merge base) `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` · head `959194f16e555adc785d267796852357223abc26` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 1 · hash (`git hash-object`) `8ecf48c6837025a064c71c8d80960cd3e0784de1`

**Verdict:** Revision required
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps deep money and spec reviews to Opus 5.5; this session is outside that table.

### Findings

### [P1] Changing a priced draft's currency can silently reinterpret its amounts
- Category: material risk
- Rule: MON-02, MON-05; spec Money rules
- Evidence: the new prefill rule at `docs/superpowers/specs/2026-09-27-core-sales-design.md:402` checks currencies only when a line is created. The quote and invoice data model at lines 301 and 303 carries editable drafts with currency and amounts; the verification list at line 830 tests creation and workspace-default changes, but not changing a priced draft's document currency. The PR body itself identifies this gap.
- Failure scenario: a MYR draft line holds `unit_amount = 500000`; the user changes the document to JPY or USD and the saved number is interpreted in that new currency without an explicit reprice.
- Why it matters: the new rule prevents a wrong initial prefill but leaves a later path to a wrong quote or invoice. The document can be sent or issued with the misinterpreted amount.
- Required correction: define an atomic rule for changing a draft document's currency once monetary inputs exist. Either refuse the change until monetary inputs are removed, or clear/reprice every currency-denominated input and derived total, require explicit confirmation of new prices and FX rate, and prevent send/issue until valid. Cover manual as well as catalog-prefilled amounts, and add a test for the currency-change path. Specify what happens if a catalog service's own currency is edited while its price exists.
- Owner: builder, with owner choice if the product behavior needs one
- Verification: re-read the Money rules and draft flows; the verification list must include a priced MYR draft changed to JPY/USD and show no old amount is reused.
- Status: open

### [P1] Three known amount types still lack an authoritative stored currency
- Category: guardrail mismatch
- Rule: MON-02, MON-05, MON-06
- Evidence: Open question 14 at `docs/superpowers/specs/2026-09-27-core-sales-design.md:132` leaves `line_item`, `credit_note` and frozen base-total currency undecided. Lines 305 and 308 list amounts without a currency field. Lines 379–382 freeze converted base totals but name no frozen base-currency code; `workspace_settings.base_currency` at line 285 can later change. The new `service.currency` at line 297 resolves only the catalog amount.
- Failure scenario: a later workspace base-currency change makes a frozen dashboard/export amount ambiguous; a credit note or polymorphic line item can be read or summed under a currency inferred from a mutable or incorrectly selected parent.
- Why it matters: the draft is presented for spec review, and MON-02 requires the currency to be stored with every amount. Leaving all three as open questions sends money schema and enforcement choices into implementation without a testable answer.
- Required correction: settle Open question 14 before approving v4.6. The concrete safe design is a stored `line_item.currency` enforced equal to its parent document currency, a stored `credit_note.currency` copied from and enforced equal to its invoice currency, and a frozen `base_currency` beside every finalized base-total snapshot. Define draft currency-change handling consistently with the first finding, and add equality and later-workspace-default-change tests. If a different representation is chosen, state how it meets MON-02 and stays immutable after issue; record any actual rule exception with owner approval.
- Owner: builder and owner for any policy/exception choice
- Verification: inspect the data model, Money rules, and test list for explicit currency storage and equality/freeze checks, including a workspace base-currency change after issue.
- Status: open

### [P3] Handoff details still describe the prior branch and question state
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:17` links PR #4 while its header and §1 identify PR #6; lines 24–38 say the branch is `main` at `8b1795c`, and line 53 says Charlie's catalog service currency answer is pending. Git and the committed decision record show PR #6 at `959194f` and that service currency decision made.
- Failure scenario: the next session follows the wrong PR link or repeats the already-decided catalog currency question.
- Why it matters: the correct header and §5 limit the impact, but the handoff is the next session's working context.
- Required correction: builder refreshes the PR link, Git-state details and MON-02 question status.
- Owner: builder
- Verification: compare the handoff with PR #6, Git and `docs/DECISIONS.md`.
- Status: open

The owner's Option B decision is recorded faithfully: each service price has a currency, created from the workspace default, and only matching-currency documents prefill it. No fixed currency or automatic catalog conversion was introduced. This review does not reopen that decision.

### Self-check audit

The independent applicability list for this three-file spec amendment is MON-01–07; UNI-02, UNI-07, UNI-12, UNI-13 and UNI-14; and `PROJECT.md` §9's money constraints. Other ticked packs do not govern the changed text directly. The builder's table covers the money rules and most applicable universal rules; UNI-14 is absent but no dependency or lockfile is changed, so it is n-a. The table's `UNI-13 n-a` is incorrect because CI applies to every PR; exact-head CI passes.

| Rule | Builder said | Reviewer found | Evidence / disagreement |
|---|---|---|---|
| MON-01, MON-03, MON-04 | n-a | Existing representation, serialization and rounding unchanged | spec Money rules; no disagreement |
| MON-02 | pass for service; three items open | service fixed, three amount types remain unresolved; P1 | spec lines 132, 297, 305, 308, 379–382 |
| MON-05 | pass | initial prefill protected; later draft currency change unspecified; P1 | spec line 402; no currency-change test at line 830 |
| MON-06 | n-a | base-total currency storage is an active unresolved part of the spec; P1 | spec lines 132, 379–382 |
| MON-07 | n-a | no change to recomputation rule; future runtime verification still required | spec Money rules; no disagreement for this diff |
| UNI-02, UNI-07, UNI-12 | pass | pass: no fixed price/currency invented, no secret in diff, all paths inside repo | effective diff and targeted secret scan |
| UNI-13 | n-a | applies and passes on exact head | CI run `37114978350`; builder status label is wrong |
| UNI-14 | absent | n-a: no dependency or lockfile change | three-file docs diff |
| `PROJECT.md` §9 constraints | pass | service decision accurately reflected; remaining currency questions explicit but unresolved | `agents/PROJECT.md:204`; decisions log |

### Verification performed

| Command / check | Result |
|---|---|
| `gh pr view 6` at start and end | PR open; exact head `959194f16e555adc785d267796852357223abc26`; three CI jobs successful |
| `git fetch origin`, `git cat-file`, `git merge-base` | exact head available; base `8b1795cb3b0ee5b9513186920ec1d2e5ba922730` |
| Detached review checkout and `git status --untracked-files=no` | pinned head; no tracked or staged changes |
| `git diff --stat`, `--name-status`, effective three-dot diff | three docs files, +27/−7; one commit |
| `git diff --check` | pass |
| `git hash-object` on v4.6 spec | `8ecf48c6837025a064c71c8d80960cd3e0784de1` |
| Targeted secret scan of changed files | only instruction/example mentions of secret names; no value in the diff; CI secret scan success |
| CI run `37114978350` | typecheck/lint/test, dependency audit and secret scan successful for this head; not run locally for docs-only diff |
| Data model, Money rules, verification, decisions, `PROJECT.md` and handoff | checked for cross-section consistency and missing money paths |

### Residual risks and test gaps
- v4.6 is explicitly a draft. The unchanged v4.5 spec remains the approved baseline until Charlie approves a revised v4.6. This PR review is not the kit-format `review spec` record required by the later `build` gate.
- `PROJECT.md` §2 intentionally retains the v4.5 reconciliation hash. Merging a draft v4.6 at that path will stop `build` until a final spec review and `setup` reconciliation; the PR body discloses this.
- Runtime money behavior was not tested because this PR changes no runtime code. The proposed scenarios must be tested in their implementing phase.

### Required before merge
- Resolve both P1 money-spec findings and update the self-check evidence. Re-review the new exact head.

### Deferred conditions
- None.

### Optional improvements
- Refresh the handoff as described in the P3 finding; label UNI-13 as `pass` in the self-check.
