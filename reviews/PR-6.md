# Review — PR #6

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
