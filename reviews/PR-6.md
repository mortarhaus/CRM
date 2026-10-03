# Review — PR #6

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
