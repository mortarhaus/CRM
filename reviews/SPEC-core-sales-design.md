# Review — spec `core-sales-design`

## Round 13 — 2026-10-16 · scope: revision 5 hosting slice (PR #29)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 5 draft · hash (`git hash-object`) `3c2df1a0d8b3a61b7b387c2faee635514b5021f9`.
- **Pin:** PR #29 base `21507058293ca5d70d62e631eac6bde8d6a134f4`, head `0b907991be0d34d8ec538018b397a8dca4a18c56`, merge base `553f0b2960996bb756f1d4044b443d60e470e5b7`. The working spec in the clean builder worktree and the blob at that head have the same hash. Diff: this spec and `docs/DECISIONS.md` only. The unchanged body keeps Round 11's deep-tier technical review and Round 12's exact-hash approval follow-up as its baseline.

**Verdict:** Revision required  
**Model used:** GPT-6 · **Switch model next step?** No. Round 11 was the independent Opus 5.5 full-spec pass; this is a narrow hosting revision review.

### Findings

#### [P1] The chosen-provider Phase 1 test is impossible on the revised schedule
- Category: objective spec contradiction; gate and verification timing.
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:48`, `:259`, `:962` defer the Stage 3 provider and region until first sale. Known risks R6 at `:953` still requires a run against **the chosen managed PostgreSQL provider's pooler**, with *each* R6 item checked in Phase 1 before the worker role is fixed. Phase 1 done-when at `:1009` requires the worker grants and pooler cycle, but has no later provider-specific acceptance gate.
- Failure scenario: Phase 1 either cannot be marked complete until a provider is chosen much earlier than Charlie decided, or is marked complete while its explicit chosen-provider test has never run. A provider can then be selected at first sale without a named test of its pooler, direct connection, role/grant support and pg-boss lifecycle.
- Why it matters: this is a delivery gate for the RLS connection and job system; leaving it contradictory makes a production cutover untestable.
- Required correction: keep the generic local pooler, grant and maintenance checks in Phase 1. Move the **chosen provider** run to a gate after selection and **before** Stage 3 cutover / the first sale's live traffic. Name the provider-specific connection, role/grant, pg-boss and PITR/restore acceptance checks there. This preserves Charlie's choice to defer the provider.
- Owner: builder. Verification: R6, Phase 1 done-when, Stage 3 and the first-sale gate agree on who tests what and when.

#### [P1] Applicable database and job rules are absent from the PR self-check
- Category: guardrail review coverage.
- Evidence: PR #29's self-check lists UNI-07, UNI-12, UNI-13 and owner provenance only. Moving from a named managed service to an as-yet-unknown one directly affects `TEN-01` (migrator ownership/direct migration), `TEN-02` (runtime role without BYPASSRLS), `TEN-09` (tenant transaction context over a transaction pooler), and `EVT-01` (transactional enqueue through that connection). The spec's existing contracts are at `:380`, `:953`, `:962` and `:1009`; `agents/PROJECT.md` §9 names the five roles and pooled/direct connection contract.
- Failure scenario: a candidate satisfies “managed PostgreSQL with PITR and a transaction-mode pool” but cannot grant the required role/schema privileges or maintain transactional pg-boss jobs; the self-check reports no rule to check before selection.
- Why it matters: reviewer rule §3 makes a missing applicable rule in a builder self-check a P1. This is a coverage finding, separate from the timing contradiction above.
- Required correction: add rows for TEN-01, TEN-02, TEN-09 and EVT-01 in the PR self-check, citing the spec's existing provider acceptance requirements and the revised pre-cutover gate. Mark future provider-specific results pending rather than pass.
- Owner: builder. Verification: each applicable row has evidence or an explicit future gate; no unsupported pass claim.

#### [P2 · before merge] Cross-border and backup-location check is assigned the wrong deadline
- Category: privacy gate consistency.
- Evidence: revision 5 item 7 at `:48` and the new `docs/DECISIONS.md` entry at `:8` say the PDPA cross-border and backup-location check is due “before Phase 9.” The spec's professional-check heading at `:1044` and `agents/PROJECT.md` §11 require the PDPA professional check **before Phase 4 goes live**. Stage 2 stores live data on the Malaysia VPS and sends nightly encrypted database dumps to R2 beginning in Phase 4 (`:803`, `:961`, `:1012`); the R2 backup location is unspecified here. Stage 3 introduces another provider and region at first sale.
- Failure scenario: the builder treats Phase 9 as permission to postpone the location/transfer review through Phase 4, even while live data and backups already exist.
- Why it matters: the revision weakens the apparent timing of an existing pre-live professional gate; this is a wording conflict with potential privacy consequences, not a legal conclusion about any specific transfer.
- Required correction: align item 7 and the decision entry with the existing **before Phase 4 live** professional check for the Stage 2 host and R2 backups; require the chosen Stage 3 provider and backup locations to be checked before its cutover. Preserve the separate Phase 9 purge-specific PDPA check.
- Owner: builder. Verification: the hosting item, decision entry, professional-check section and Stage 3 gate have compatible deadlines.

#### [P2 · before merge] The VPS gate is both met and unmet in the same section
- Category: documentation consistency.
- Evidence: the introduction to “Checks before the Phase 1 plan is written” at `:994` says item 3 “is still unmet”; revised item 3 at `:1000` says “MET for the VPS provider.” The current-gates paragraph at `:1053` labels itself revision 5 yet says Round 11 approval completes gate (a), and says `setup` still must record hard-rule rulings that `agents/PROJECT.md` §9 already records. Round 12 flagged the latter stale status text as a P3 follow-up.
- Failure scenario: the owner or next builder reads the introduction as a blocking host decision or reads revision 4's approval as approval of revision 5.
- Why it matters: this revision exists to close precisely that VPS gate. Its live status must be unambiguous before approval and reconciliation.
- Required correction: make the item 3 introduction say the two spikes passed and the VPS gate is now met; keep the prior “NOT MET” statement explicitly as history. In Current gates, distinguish revision 4's completed review, approval and setup from revision 5's pending review, owner approval and later reconcile. Leave other Phase 1/4/5/7 gates open.
- Owner: builder. Verification: no live gate claims the VPS choice is open and no prior approval is attributed to revision 5.

### Applicability and self-check audit

I built the applicability list from the hosting diff before comparing the PR self-check. UNI-07, UNI-12 and UNI-13 apply to the document PR and are covered; the four database/job rules above apply to the provider change and are missing. `UNI-08` and `UNI-16` become live at implementation of the new host, but this PR changes only the spec and makes no production secret or deployed runbook change. Other ticked UI, money, record, auth, link, file and payment rules have no changed behavior in this slice. The provider requirements already in the spec remain binding; an unspecified provider is not a waiver. Charlie's VPS decision is recorded; this review does not reopen it.

### Verification performed and limits

| Check | Result |
|---|---|
| GitHub PR #29 head/base and four CI jobs | Head `0b907991`; all four jobs pass on that head. This is document CI, not proof that any managed provider was exercised. |
| `git diff --name-status` and `git diff --check` for the exact PR head | Only spec and decisions entry changed; no whitespace errors. |
| `git hash-object` on the clean builder worktree and `git show <head>:<spec> \| git hash-object --stdin` | Both `3c2df1a0d8b3a61b7b387c2faee635514b5021f9`; review is pinned to that blob. |
| Hostinger's own Malaysia VPS page, checked 2026-10-16 | Confirms KVM 2's 2 vCPU, 8 GB RAM, 100 GB NVMe and weekly backups, and shows the quoted US-dollar promotional and renewal figures; purchase terms still need rechecking. https://www.hostinger.com/vps/servers/malaysia |
| Code tests, deployment or restore exercise | Not run; this is a spec review. Provider-specific evidence does not exist yet by design. |

### Required before approval

Resolve both P1s and the two before-merge P2s in a new spec/PR head, then request `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again. Charlie's approval of revision 4 and the present CI checks do not approve this revision 5 blob. After an approved review and Charlie's own approval, `setup` reconciles its new hash before `build` uses it.

## Round 12 — 2026-10-14 · scope: exact-hash approval-record follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 APPROVED revision 4 · hash (`git hash-object`) `eb89f4ab817c79c536cd36f8aef7c643a059d697` · same blob on fetched `origin/main`
- **Prior rule-body review:** Round 11, v4.7 revision 4, hash `521a70979f48329363f6154a1f73687d9a82e03f`, Approved with conditions (Opus 5.5)

**Verdict:** Approved with conditions
**Model used:** GPT-6 · **Switch model next step?** No — Round 11 supplied the independent deep-tier rule-body review; this round checks the approval record and its exact final hash.

### Findings

No P0, P1 or before-plan P2 was introduced by the approval-record changes. The three diff hunks from the Round 11 blob change the title, Status paragraph and Current gates paragraph only. The substantive v4.7 rules and verification cases are byte-identical to the reviewed blob. The current gate list carries all Round 11 phase conditions; `setup` has now reconciled the exact spec hash and recorded Charlie's hard-rule confirmations.

### [P3] Approval and setup prose has two stale descriptions
- Category: documentation consistency
- Rule: spec approval provenance and gate status
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:3` says the approval record changes only the title, Status text and gate (a), but the diff from the Round 11 blob also expands gates (b)–(e) at `:1051`. That Current gates paragraph still says `setup` is remaining, while `agents/PROJECT.md:29` has the same final spec hash and `docs/DECISIONS.md:67-73` records Charlie's confirmation of TEN-02, REC-01 and AUTH-01.
- Failure scenario: a reader thinks the later gate-list changes were absent from the approval-record PR, or thinks `build` still waits for `setup`.
- Why it matters: the history and current status should describe the merged, reconciled state accurately. The executable kit gate reads the hash in `PROJECT.md`, so this prose does not block Phase 0.
- Required correction: in a later reviewed spec revision, describe the amendment as gates (a)–(e) and mark `setup` complete. Keep the Phase 1, 4, 5 and 7 plan gates open.
- Owner: builder
- Verification: compare the revised Status and Current gates text with this hash's Git diff, `PROJECT.md` §2 and the decisions entry.
- Status: open; nonblocking.

### Self-check audit

Spec review has no builder self-check table. For this exact-hash slice, applicability is approval provenance, deferred gate accuracy, and the hard-rule rulings referenced by the new gate paragraph. Runtime guardrail conformance remains as assessed in Round 11 because the rule body is unchanged. I checked the named TEN-07, UNI-19, UNI-10, MON-07, REC-11, AUTH-06, LINK-03 and LINK-07 rules against the gates and `PROJECT.md` §11.

| Area | Applies? | Reviewer found | Evidence |
|---|---|---|---|
| Exact hash and approval provenance | Yes | Final hash matches `PROJECT.md` and `origin/main`; Charlie's recorded approval follows Round 11. Minor stale provenance wording above. | Spec `:1-3`; `PROJECT.md` §2; `docs/DECISIONS.md` 2026-10-11 entry |
| `setup` hard-rule rulings | Yes | Completed in `PROJECT.md` §9 and decisions log; conditions on role/grant tests, lifecycle columns, PDPA check and link wrapper remain explicit. | `PROJECT.md` §9; `docs/DECISIONS.md:67-73` |
| Phase 1, 4, 5 and 7 gates | Yes | All Round 11 deferred corrections and owner choices remain listed before their respective first plans. | Spec `:1051`; `PROJECT.md` §11; Round 11 Deferred conditions |
| Other product and technical rules | No new rule-body change | Round 11 findings and dispositions still apply; no new rule claimed by this approval-record slice. | `git diff 9b95910..HEAD -- <spec>`; Round 11 |

### Verification performed

| Command / check | Result |
|---|---|
| `git hash-object <spec>`; `git show origin/main:<spec> | git hash-object --stdin` after `git fetch origin` | Both `eb89f4ab817c79c536cd36f8aef7c643a059d697`; matches `PROJECT.md` §2 |
| `git diff 9b95910..HEAD -- <spec>` | Exactly three approval-record hunks; no body rule or verification-case edit |
| Read Round 11, PR #19 Round 2, decisions approval and hard-rule rulings, `PROJECT.md` §9/§11, current gates and relevant guardrail text | Round 11 deferred plan gates preserved; `setup` completed; P3 wording issue above |
| `git status --porcelain=v1 -- <spec> <review>` before writing | No tracked spec change; review file is local and ignored |
| Code tests / CI / UI preview | Not run; document-only exact-hash review, with no runtime code change |

### Residual risks and test gaps
- This is an exact-hash review of approval-record edits, not a fresh full technical review of the unchanged 1,200-line rule body. Round 11's deep-tier review remains the technical basis.
- The Phase 1, 4, 5 and 7 choices below remain open. This verdict does not approve their proposed values or authorize their plans before the named spec revisions.

### Required before merge
- None. This spec hash is already on `main`; the exact-hash spec and reconcile gates for Phase 0 `build` are met.

### Deferred conditions
- Before the first Phase 1 plan PR: Charlie chooses the VPS provider; decide rate-limit numbers and OTP re-issue cap, `crm_purge` read policies, restrictive tenant policies, the `/api/auth/*` public surface, and archive-job removal or partition design in a reviewed spec revision.
- Before the first Phase 4 plan PR: decide tax registration versus open drafts, invoice-void policy, four payment-void choices, credit-note tax source, zero-total credit-note refusal and refund-void step-up in a reviewed spec revision.
- Before the first Phase 5 plan PR: decide direct quote acceptance and expiry in a reviewed spec revision.
- Before the first Phase 7 plan PR: decide artifact kinds and targets at agreement and proposal signing in a reviewed spec revision.

### Optional improvements
- Correct the P3 status prose when the spec next changes; an isolated edit would create another spec hash requiring review and reconcile.

## Round 11 — 2026-10-11 · scope: feature-complete spec review (independent deep-tier confirmation of Round 10)
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 DRAFT revision 4 · hash (`git hash-object`) `521a70979f48329363f6154a1f73687d9a82e03f` · identical to the blob on `origin/main` at `9b95910d48108a026927e501e918e4fa5e05e234` (same blob as Round 10)

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 (the project's mapped deep tier) · **Switch model next step?** No — this is the deep-tier confirmation Round 10 asked for.

### Findings

No P0 or P1. Every v4.7 rule was re-read against the body: payment void (data model `:443-444`, "Voiding a payment" `:902-912`, lock order `:845`), credit-note cap (`:445`, `:922`), no-negative bounds and tax-rate bounds (`:501-509`), zero-subtotal allocation (`:519`), issue guard (`:523`) and zero-total recurring run (`:571`). I recomputed Verification "Payment void, credit-note cap…" (f), (g) and (i), including the boundary cases (`5000 ≤ max(0, 15000 − 10000)`; `5000 > max(0, 8000 − 10000)`; void-invoice case `5000 ≤ 5000`) and the (f) rounding chain (`2228`, `1115`, `3342`, `4457`): all match. `SELECT … FOR UPDATE/SHARE` on `payment` works for `crm_app` because it holds column UPDATE on the void columns (PostgreSQL needs UPDATE on at least one column), consistent with `:796`. The three Round 10 P2s are confirmed and carried. Four P2s and two P3s below are new to this file; none blocks v4.7 approval, because each concerns a phase whose plan is not yet written and each is given a plan gate.

### [P2] Credit-note tax rate and registration source are undefined
- Category: ambiguity (money)
- Rule: MON-07, REC-02; spec Money rules step 6
- Evidence: `credit_note` has no document tax rate column (`:445`), unlike `quotation` and `invoice` (`:438`, `:440`). Step 6 takes `tax_rate_override_bps ?? document rate` and treats a line as exempt when the "workspace [is] not tax-registered" (`:521`), i.e. the current setting. Onboarding lets the registration and default rate change later (`:690`). The deferred "Tax registration change vs open drafts" item (`:43`; Round 8 P2) names drafts, quotes and recurring templates only, not credit notes against already-issued invoices.
- Failure scenario: an invoice is issued with 8% Service Tax. The workspace later changes its default rate to 6%, or turns registration off. A credit note for the full line then computes 6% or 0% tax, so it does not reverse the tax that was charged. One builder reads the invoice's frozen rate; another reads the current setting.
- Why it matters: the credit note is a legal tax document; its tax must mirror the invoice it corrects.
- Required correction: state that a credit note's lines take their taxable flag and effective rate from the credited invoice's frozen snapshot (not the current workspace setting), and how that is enforced (copied rate + trigger, as for `currency` and `fx_rate`). Add a test: invoice at 8%, workspace rate changed to 6% and registration turned off, full credit note reverses exactly the invoiced tax. Confirm with the accountant check (`:1044`).
- Owner: builder (proposal), Charlie (confirm)
- Verification: the reviewed spec revision before the Phase 4 plan states the rule and the test.
- Disposition: deferred to the first Phase 4 plan PR (same spec revision as the tax-registration item)
- Status: open

### [P2] Three proposed exceptions to hard rules are still unruled
- Category: guardrail mismatch (process)
- Rule: TEN-02 (hard), REC-01 (hard), AUTH-01 (hard); `agents/PROJECT.md:206-209`; `docs/DECISIONS.md:183-210`
- Evidence: all three entries say "PROPOSED, NOT APPROVED — awaiting Bob's ruling" since 2026-10-03; no spec round ruled on them. v4.7 adds two new lifecycle transitions on finalized records (payment void, receipt `voided_at`) that the REC-01 (a) list does not name; `docs/DECISIONS.md:19` already says `setup` must add them.
- Failure scenario: Phase 1 builds five roles (TEN-02), Phase 4 builds payment voids (REC-01) and Phase 7 builds link actions outside `action()` (AUTH-01) on rules no reviewer has ruled on.
- Bob's ruling (the reviewer cannot downgrade a hard rule; Charlie decides what is recorded):
  - **TEN-02 — conforming, no exception needed**, provided: no role is superuser or `BYPASSRLS` (`pg_roles` test); `crm_worker` has no privilege on any `public` tenant table (catalog test); `crm_link_resolver` is `NOLOGIN` and reached only via `resolve_share_link()`; all tenant work runs as `crm_app` (or `crm_purge` for the purge) under `withWorkspace()`. Each extra role has fewer rights than `crm_app`, which is the rule's intent.
  - **REC-01 (a) — conforming interpretation**: the snapshot, hash, number, lines and totals never change; lifecycle columns change only through named transitions enforced by column grants plus triggers. The list must add the v4.7 payment void and receipt void.
  - **REC-01 (b) — a genuine exception** (deleting sent, hashed versions). Not the reviewer's to accept. It rests on Charlie's v4.5 approval item 1 (narrow purge scope) and must be recorded as owner-accepted, with the PDPA professional check (`:1047`) before Phase 9.
  - **AUTH-01 — conforming if implemented as a fixed wrapper**: a `linkAction()` (name the builder's choice) in the order token re-resolve → workspace from the resolver → OTP check where required → Zod → idempotency → handler, lint-enforced on link routes. Add **decline** to the idempotency list (the decision entry names only approve and sign).
- Required correction: builder records these rulings in `docs/DECISIONS.md` and `agents/PROJECT.md` §9 (moving them out of "Proposed"), with Charlie's confirmation; reviewer re-checks the wording.
- Owner: builder, then Charlie
- Verification: decisions entries no longer say "awaiting Bob's ruling"; §9 REC-01 (a) names the payment and receipt voids.
- Disposition: deferred to the `setup` reconcile after v4.7 approval, and in any case before the first Phase 1 plan PR
- Status: open

### [P2] Phase 1 spec gaps still listed as "Open for Bob": restrictive policy, auth endpoints, archive job
- Category: spec/guardrail mismatch
- Rule: TEN-07, UNI-19, UNI-10, TEN-03; `agents/PROJECT.md:213-216`
- Evidence: (1) Tenancy defines only workspace policies `TO crm_app` with `USING` and `WITH CHECK` (`:729`); TEN-07 asks for a RESTRICTIVE tenant policy plus targeted PERMISSIVE ones. (2) "Only unauthenticated HTTP surface: `/api/health` (and client link routes)" (`:783`) omits Better Auth's `/api/auth/*` (sign-in, sign-up, reset, 2FA verify), which Phase 0 already serves. (3) "`audit_log`, `domain_event`, share-link views: monthly archive job" (`:940`) has no role or mechanism; no role has DELETE on those append-only tables (`:795`).
- Failure scenario: (1) a later blanket permissive policy silently widens access; (2) a header or rate-limit test misses the auth routes; (3) a builder grants DELETE on `audit_log` to make the archive job work.
- Required correction: (1) make each tenant table's workspace policy `AS RESTRICTIVE … TO crm_app, crm_purge` (USING + WITH CHECK), plus PERMISSIVE per-operation policies for those roles; `share_link_resolve` stays PERMISSIVE `TO crm_link_resolver`, which a restrictive policy scoped to other roles does not affect. Add a catalog test that every tenant table has the restrictive policy. (2) list `/api/auth/*` as unauthenticated surface, DB-backed rate-limited (AUTH-06), with uniform responses. (3) remove the archive job from Part 1, or replace it with monthly partitions detached by `crm_migrator` in a reviewed runbook — never row deletes by a runtime role.
- Owner: builder
- Verification: the spec revision before the Phase 1 plan states all three; the Phase 1 plan carries the tests.
- Disposition: deferred to the first Phase 1 plan PR
- Status: open

### [P2] "Agreements rendered again at sign" is ambiguous against "never regenerated"
- Category: ambiguity
- Rule: REC-11; `agents/PROJECT.md:217`
- Evidence: `:631` says agreements are rendered at first send "and again at sign, with certificate page; … never regenerated". `document_artifact` is unique on `(target_type, target_id, kind)` (`:479`), with kinds `pdf`, `merged_pdf`, `certificate_pdf` and target types including `agreement` and `signature`.
- Failure scenario: one builder re-renders the agreement `pdf` at sign (blocked by the unique key, or a second file for the same record); another writes a `certificate_pdf` for the `signature`. The client's downloaded "signed agreement" differs between builds.
- Required correction: state that at sign the original agreement `pdf` is untouched and the worker renders a `certificate_pdf` (target `signature`) and, if wanted, a `merged_pdf` (target `agreement`) of agreement + certificate. Apply the same rule to the proposal approval certificate.
- Owner: builder
- Verification: the spec revision before the Phase 7 plan names the artifact kinds and targets.
- Disposition: deferred to the first Phase 7 plan PR
- Status: open

### [P2] Phase 1 security, purge, and hosting choices remain open (carried from Round 10)
- Rule, evidence, correction and verification as in Round 10. Confirmed on this blob (`:41-45`, `:998`, `:1051`).
- Disposition: deferred to the first Phase 1 plan PR
- Status: open

### [P2] Phase 4 tax and void policies remain open (carried from Round 10)
- As in Round 10 (`:37`, `:39-46`, `:1051`). The credit-note tax finding above belongs in the same spec revision.
- Disposition: deferred to the first Phase 4 plan PR
- Status: open

### [P2] Direct quote acceptance and expiry remain open (carried from Round 10)
- As in Round 10 (`:41-42`, `:1051`).
- Disposition: deferred to the first Phase 5 plan PR
- Status: open

### [P3] Zero-total credit note and refund-void step-up are not stated
- Category: consistency
- Evidence: the issue guard refuses a total `≤ 0` for invoices only (`:523`); the cap allows a credit note of total 0 (`:922`), which would use a gapless number and change nothing. A payment void needs step-up (`:713`), but a refund void, including a cross-invoice `wrong_payment` move (`:899`), does not.
- Required correction: decide whether a zero-total credit note is refused (recommended: yes, as for invoices) and whether a refund void needs step-up (recommended: yes, matching the payment void). Both are small owner choices; bundle them with the Phase 4 questions.
- Owner: Charlie, then builder
- Status: open

### [P3] Handoff Git block still stale (carried from Round 10)
- Evidence: `.agent/handoff.md` §3 still labels `dc9d1d5` as `origin/main`; actual `origin/main` is `9b95910`.
- Owner: builder
- Status: open

### Self-check audit
Spec review: no builder self-check table applies. My applicability list covered every ticked pack and `agents/PROJECT.md` §9; Round 10's table was input only.

| Rule / area | Applies? | Reviewer found | Evidence | Disagreement with Round 10 |
|---|---|---|---|---|
| MON-01–MON-07 | Yes | v4.7 rules consistent; fixtures (f), (g), (i) recomputed and correct. New gap: credit-note tax source. | `:445`, `:501-523`, `:521`, `:1130` | New P2. |
| REC-01–REC-12, PAY-01 | Yes | Payment/receipt void preserves rows and numbers, audited, locked `invoice` → `payment` → receipt; REC-01 ruling pending; REC-11 ambiguous. | `:443-444`, `:631`, `:845`, `:902-912` | New P2s. |
| TEN-01–TEN-12 | Yes | Composite FKs, `nullif`, five roles sound; TEN-07 restrictive policy not specified; TEN-02 ruling pending. | `:729-741`, `:747-756` | New P2s. |
| AUTH-01–AUTH-13 | Yes | Matrix and step-up consistent except refund-void step-up; AUTH-01 link-action ruling pending; `/api/auth/*` missing from surface list. | `:704-724`, `:783` | New P2/P3. |
| LINK, EVT, FILE, FE, UNI | Yes | No v4.7 defect; UNI-10 archive job conflicts with append-only; rate limits carried. | `:636-642`, `:760-772`, `:940` | New P2 (UNI-10). |
| Scope vs §9 | Yes | No out-of-scope feature. | Scope — Part 1 | None. |
| Milestones "done when" | Yes | Testable; plan gates explicit. | `:1000-1016`, `:1051` | None. |

### Verification performed
| Command / check | Result |
|---|---|
| `git fetch origin`; `git rev-parse origin/main HEAD` | `9b95910…`; checkout HEAD `9a94988`. |
| `git hash-object <spec>` and `git show origin/main:<spec> \| git hash-object --stdin` | Both `521a70979f48329363f6154a1f73687d9a82e03f`. |
| `git status --short` before writing | Clean. |
| Read the spec body `:328-1153`, all non-frontend packs, `agents/PROJECT.md`, `docs/DECISIONS.md` (recent and hard-rule entries), Rounds 8–10 | Findings above. |
| Hand recomputation of Verification "Payment void…" (f), (g), (i) | All values match. |
| Search of review files and decisions for prior rulings on TEN-07, UNI-10, UNI-19, REC-11, TEN-02, REC-01, AUTH-01 | None found beyond "open" mentions in `PR-4.md`. |
| Code tests / CI | Not run; document review only. |

### Residual risks and test gaps
- `guardrails/frontend.md` was not re-read this round; the v4.7 UI surface is unchanged from v4.6 (Rounds 5–8 covered it).
- Appendix A (Part 3) was not re-reviewed.
- UNI-04 and FE-13 in `PROJECT.md` "Open for Bob" are lint and plan matters, not spec text; not ruled here.
- UNI-02 (where security constants live): my view is that fixed security values (link 30 d, OTP 10 min / 5, step-up 5 min, reset 30 min) may be named constants in one core module named in the spec, while business values stay in `workspace_settings`; not raised as a finding.

### Required before merge
- None. The blob is already on `main` (PR #18). Charlie's own v4.7 approval is a separate owner gate.

### Deferred conditions
- `setup` reconcile after approval, and before the first Phase 1 plan PR: record the TEN-02 / REC-01 / AUTH-01 rulings.
- First Phase 1 plan PR: VPS choice, rate limits and OTP re-issue cap, `crm_purge` read policies (Round 10); restrictive tenant policy, `/api/auth/*` surface, archive-job removal or partition design (this round).
- First Phase 4 plan PR: tax registration vs open drafts, invoice-void policy, four payment-void choices (Round 10); credit-note tax source (this round); P3 zero-total credit note and refund-void step-up.
- First Phase 5 plan PR: direct quote acceptance and expiry.
- First Phase 7 plan PR: artifact kinds at sign (REC-11).

## Round 10 — 2026-10-11 · scope: feature-complete spec review
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 DRAFT revision 4 · hash (`git hash-object`) `521a70979f48329363f6154a1f73687d9a82e03f` · identical to the blob on `origin/main` at `9b95910d48108a026927e501e918e4fa5e05e234`

**Verdict:** Approved with conditions
**Model used:** GPT-6 (the project maps deep spec review to Opus 5.5) · **Switch model next step?** Yes, if independent confirmation on the mapped deep tier is wanted before Charlie's approval; this verdict is based on the pinned blob and the evidence below.

### Findings

The Round 9 before-approval P2 is resolved: the two completed spikes are separated from the still-unmet VPS provider choice (`docs/superpowers/specs/2026-09-27-core-sales-design.md:990-998`). The recurring-run wording is corrected (`:571`). No P0, P1, or P2 requiring correction before v4.7 approval remains.

### [P2] Phase 1 security, purge, and hosting choices remain open
- Category: ambiguity / material risk
- Rule: LINK-03, LINK-07, TEN-06, REC-04; spec "Changes in v4.7" item 5 and "Checks before the Phase 1 plan is written"
- Evidence: the spec still gates rate-limit numbers and the OTP reissue cap, `crm_purge` read policies, and Charlie's VPS provider choice before the Phase 1 plan (`docs/superpowers/specs/2026-09-27-core-sales-design.md:41-45`, `:990-998`, `:1051`). Open question 4 and `agents/PROJECT.md` §11 agree that the VPS choice is pending.
- Failure scenario: a Phase 1 plan invents security thresholds, leaves reference tables unreadable to `crm_purge`, or selects a host without the owner choice.
- Why it matters: the controls cannot be implemented or tested consistently while these values and grants are open.
- Required correction: record Charlie's VPS choice; specify numeric limits, windows and responses including OTP reissue; enumerate purge reference-table SELECT policies and tests in a reviewed spec revision before the Phase 1 plan.
- Owner: Charlie (hosting and any client-facing policy), then builder (spec and tests)
- Verification: the reviewed spec preceding the first Phase 1 plan PR states each value and policy, and that plan includes the corresponding checks.
- Disposition: deferred to the first Phase 1 plan PR
- Status: open (carried forward)

### [P2] Phase 4 tax and void policies remain open
- Category: ambiguity / material risk
- Rule: MON-07, REC-01, REC-02, PAY-01; spec "Changes in v4.7" items 1, 5 and 6
- Evidence: the effect of tax-registration changes on open drafts, invoice-void policy, and four payment-void choices are explicitly undecided and gated before the Phase 4 plan (`docs/superpowers/specs/2026-09-27-core-sales-design.md:37`, `:39-46`, `:1051`). The four choices are reason codes, void-notice content, period-export treatment, and phase placement; shown values are proposals.
- Failure scenario: a Phase 4 plan treats a proposal as an owner decision or defines incompatible money and document-lifecycle behaviour.
- Why it matters: these choices affect issued records, client notices, and accounting exports.
- Required correction: Charlie decides the open policies; the builder writes the outcomes and verification cases in a reviewed spec revision before the Phase 4 plan.
- Owner: Charlie, then builder
- Verification: the reviewed spec preceding the first Phase 4 plan PR resolves each item and the plan implements its stated tests.
- Disposition: deferred to the first Phase 4 plan PR
- Status: open (carried forward)

### [P2] Direct quote acceptance and expiry remain open
- Category: ambiguity
- Rule: LINK-09; spec "Changes in v4.7" item 5 and Phase 5 gate
- Evidence: direct quote acceptance and approval or acceptance after `valid_until` remain deferred to before the Phase 5 plan (`docs/superpowers/specs/2026-09-27-core-sales-design.md:41-42`, `:1051`).
- Failure scenario: one implementation creates an agreement through an authenticated acceptance while another accepts an expired quote or treats a click as sufficient.
- Why it matters: client consent and quote validity would differ between implementations.
- Required correction: Charlie chooses the acceptance and expiry policy; the builder specifies the flow and tests in a reviewed spec revision before the Phase 5 plan.
- Owner: Charlie, then builder
- Verification: the reviewed spec preceding the first Phase 5 plan PR covers direct acceptance and expiry, and that plan tests both.
- Disposition: deferred to the first Phase 5 plan PR
- Status: open (carried forward)

### [P3] Handoff Git block still identifies an old `origin/main`
- Category: consistency
- Evidence: `.agent/handoff.md:40` labels `dc9d1d5` as `origin/main`, and `:44` stops the log summary at PR #17, while `git rev-parse origin/main` is `9b95910d48108a026927e501e918e4fa5e05e234`. The handoff's current §5 correctly reports PR #18 merged (`.agent/handoff.md:50`).
- Failure scenario: the next agent relies on §3 instead of §5 and reviews or reconciles against the old main commit.
- Why it matters: a stale status block makes the handoff harder to trust, though the spec and current gate are clear.
- Required correction: builder refreshes §3's Git block and log summary.
- Owner: builder
- Verification: both sections name the same current main commit and PR #18 state.
- Status: open

### Self-check audit
This is a document review, so there is no builder self-check table for this command. I assessed the full spec against the applicable packs and `agents/PROJECT.md` §9; earlier PR self-checks and spec rounds were inputs, not substitutes.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| MON-01–MON-07, PAY-01, REC-01–REC-12 | Yes; invoices, FX, payment/receipt voids, refunds, credits and recurring runs. | v4.7 money changes and tests are specified. | The owner-approved void, credit cap, nonnegative amount, positive issue-total and zero-total recurring rules are internally consistent; the Phase 4 owner choices are clearly gated. | Spec items 1–3, 6; money/status, immutability and Verification sections; Decisions entries of 2026-10-10. | Deferred Phase 4 conditions. |
| TEN, AUTH, LINK, EVT, FILE, FE, UNI | Yes; full spec covers tenant isolation, auth, public links, jobs, files and UI. | Existing controls, with later policy gates. | No new v4.7 blocker found; numeric rate limits, purge reads and direct acceptance remain open for their named plans. | Spec items 5–6, security/tenancy and phase sections; prior Round 9. | Deferred Phase 1 and 5 conditions. |
| `PROJECT.md` §9/§11 and milestone gates | Yes; owner choices must not be presented as complete. | Revision 4 says spikes complete, VPS choice unmet. | The Round 9 hosting contradiction is corrected; the Phase 1/4/5 plan gates are explicit. | Spec lines 990–998, 1051; `agents/PROJECT.md` §11. | None before v4.7 approval. |
| Handoff accuracy | Yes; the next agent uses it to find current state. | §5 says PR #18 merged. | §3 has an older main and log summary. | `.agent/handoff.md:37-50`; `git rev-parse origin/main`. | P3. |

### Verification performed
| Command / check | Result |
|---|---|
| `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` | `521a70979f48329363f6154a1f73687d9a82e03f`. |
| `git show origin/main:<spec> \| git hash-object --stdin` | Same hash; this review applies to the merged main blob. |
| Read the full v4.7 revision, owner decisions, PROJECT gates, prior spec rounds and relevant guardrails | Round 9 hosting P2 and wording P3 are fixed; the remaining open policies are tied to specific later plan PRs. |
| `git rev-parse origin/main`; `git status --short` before review write | Main is `9b95910d…`; tracked builder checkout clean. No local code tests run for this document review. |

### Residual risks and test gaps
- The Phase 1, 4 and 5 policy gates above must be resolved through reviewed spec revisions before their plan PRs. No implementation tests were run or claimed for this spec review.
- `agents/PROJECT.md` §2 still points to the approved v4.6 hash; it should be reconciled only after Charlie approves v4.7 and the approval is recorded.
- This round ran on GPT-6 rather than the project's mapped Opus 5.5 deep tier.

### Required before merge
- None for this exact spec blob (already merged as PR #18). Charlie's own v4.7 approval remains a separate owner gate.

### Deferred conditions
- First Phase 1 plan PR: VPS choice, numeric rate limits and OTP reissue cap, and `crm_purge` reference-read policies, all in a reviewed spec revision first.
- First Phase 4 plan PR: tax registration vs open drafts, invoice-void policy, and four payment-void choices, all in a reviewed spec revision first.
- First Phase 5 plan PR: direct quote acceptance and expiry, in a reviewed spec revision first.

### Optional improvements
- Builder refreshes `.agent/handoff.md` §3 to match the merged main state.

## Round 9 — 2026-10-11 · scope: feature-complete spec review
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 DRAFT revision 3 · hash (`git hash-object`) `e45ef3c9b4cfdba8b8be4f9450d20f8868b0953c` · identical to the blob on `origin/main` at `dc9d1d51c57e91091f115445744268bd7c97417d`

**Verdict:** Revision required
**Model used:** GPT-6 (the project maps deep spec review to Opus 5.5) · **Switch model next step?** Yes — use the project's mapped deep tier for independent confirmation after the correction.

### Findings

### [P2] Phase 1 hosting check falsely says the owner chose a VPS provider
- Category: spec/guardrail mismatch
- Rule: `agents/PROJECT.md` §9 and §11; spec "Checks before the Phase 1 plan is written"
- Evidence: the spec says the three checks in that section "ran in Phase 0" and item 3 says the Phase 4 VPS provider was "confirmed by Charlie and recorded in Decisions" (`docs/superpowers/specs/2026-09-27-core-sales-design.md:985-993`). The same spec calls that provider Open question 4 (`:9`, `:252`, `:954`) and lists the choice as a current gate before the Phase 1 plan (`:1046`). `agents/PROJECT.md:239-241` also says Charlie's choice is still required. I found no recorded owner choice in `docs/DECISIONS.md`.
- Failure scenario: the Phase 1 planner treats item 3 as completed, selects a VPS without Charlie's answer, or skips the hosting gate.
- Why it matters: an explicit owner choice is represented both as done and as pending in the source of truth.
- Required correction: rewrite item 3 as an unmet gate, and distinguish it from the two completed spikes. Keep the VPS choice open until Charlie makes and records it. No new owner choice is needed to correct the status text.
- Owner: builder
- Verification: item 3, Open question 4, the current gates, and `PROJECT.md` agree that the VPS choice is pending before the Phase 1 plan.
- Disposition: before merge (before v4.7 approval; the draft is already on `main`)
- Status: open

### [P2] Deferred policies still need decisions before their named plan PRs
- Category: ambiguity / material risk
- Rule: prior spec review Round 8 deferred findings; spec "Changes in v4.7" items 1, 5 and 6
- Evidence: direct quote acceptance and expiry, tax-registration changes affecting open drafts, rate-limit numbers and OTP reissue cap, and `crm_purge` read policies remain open (`docs/superpowers/specs/2026-09-27-core-sales-design.md:36-41`). The invoice-void policy and four payment-void choices also remain open (`:32`, `:41`). The spec explicitly gates the Phase 1, 4 and 5 plans (`:1046`).
- Failure scenario: a phase plan or implementation fixes a security number, money policy or document lifecycle rule by inference, producing two plausible implementations of the same spec.
- Why it matters: these choices affect money correctness, data retention and public-link security, but no affected phase is ready to plan yet.
- Required correction: resolve each item in the spec with Charlie where the policy is his, then review the revised spec before the affected phase plan is written.
- Owner: Charlie (policy choices), then builder (spec text and tests)
- Verification: the first Phase 1 plan PR includes the rate-limit and `crm_purge` rules; the first Phase 4 plan PR follows the tax-registration, invoice-void and payment-void decisions; the first Phase 5 plan PR follows the quote-acceptance and expiry decisions. Each is preceded by a reviewed spec revision.
- Disposition: deferred to the first Phase 1, Phase 4 and Phase 5 plan PRs respectively, as listed above
- Status: open (carried forward, not a new block on v4.7)

### [P3] Handoff Git block and one recurring-run sentence are stale
- Category: consistency
- Evidence: `.agent/handoff.md` §1 and §5 correctly say PR #17 is merged at `dc9d1d5`, while its §3 Git block still labels `a347854` as `origin/main` and its log-branch summary stops at PR #16. The recurring zero-total rule says "the run and **never** issues or sends it" (`docs/superpowers/specs/2026-09-27-core-sales-design.md:566`).
- Required correction: builder refreshes the handoff Git block and changes the sentence to "the run never issues or sends it" in the next spec edit.
- Owner: builder
- Status: open

### Self-check audit
Spec review has no builder self-check table; this is my applicability assessment of the full spec and the v4.7 revision. The PR #17 slice self-check and Bob's Round 3 approval are inputs, not a substitute for this review.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| MON-01–MON-07, PAY-01 | Yes; invoices, FX, payments, refunds and credits. | v4.7 changes listed. | Payment void, invoice-wide refund guard, credit-note cap, nonnegative inputs, zero-subtotal allocation and positive issue guard are coherent; earlier Round 8 money blockers are addressed. | Spec lines 433–438, 491–518, 580–610, 883–920, 1125–1140. | None for these fixes. |
| REC-01–REC-12 | Yes; issued invoices, receipts and credit notes. | v4.7 changes listed. | Payment and receipt voids preserve rows and numbers, with audit and concurrency cases. Invoice-void policy is explicitly deferred before Phase 4. | Spec lines 438–440, 612–620, 897–915, Verification (a)–(i). | Deferred condition. |
| TEN-01–TEN-10, LINK-01–LINK-09, AUTH, EVT, FILE, FE | Yes; full spec includes RLS, links, auth, jobs, files and UI. | Existing spec rules. | No new blocker from the v4.7 changes. Rate-limit numbers, purge read policies and direct quote acceptance remain gated to later plan PRs. | Spec lines 36–41, 644–755, 1046; Round 8. | Deferred condition. |
| `PROJECT.md` §9/§11 and milestone gates | Yes; owner choices must remain open until recorded. | Phase 1 check says hosting confirmed. | VPS gate has contradictory completion status. Phase-specific done-when criteria otherwise remain testable. | Spec lines 9, 252, 985–1011, 1046; `PROJECT.md:239-241`. | P2 before approval. |
| Handoff accuracy | Yes. | Merged state in §1 and §5. | §3 still names an old `origin/main`. | `git rev-parse origin/main`; `.agent/handoff.md` §3. | P3. |

### Verification performed
| Command / check | Result |
|---|---|
| `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` | `e45ef3c9b4cfdba8b8be4f9450d20f8868b0953c`. |
| `git show origin/main:<spec> \| git hash-object --stdin` | Same hash; review applies to merged `main` blob. |
| Targeted read of spec data model, money rules, lock order, refunds/status, phases and Verification; comparison with Round 8 and owner decisions | Prior blocking fixes present; hosting status conflict and deferred gates recorded above. |
| `git status --short` before review write | Builder checkout clean. No code tests run for this document review. |

### Residual risks and test gaps
- No implementation of the v4.7 money rules exists to exercise here; their specified tests remain build requirements.
- This review used GPT-6; the project's deep-tier model mapping is Opus 5.5. A later review on that tier can provide the independent confirmation the handoff requested.

### Required before merge
- Correct the false completion statement about the VPS provider before v4.7 is approved. The draft is already merged, so this means a new reviewed spec PR.

### Deferred conditions
- First Phase 1 plan PR: choose and specify rate-limit numbers and OTP reissue cap; enumerate `crm_purge` read policies; obtain Charlie's VPS provider choice.
- First Phase 4 plan PR: resolve tax-registration effects on open drafts, invoice-void policy, and the four payment-void choices (reason codes, notice content, export treatment, phase placement).
- First Phase 5 plan PR: resolve direct quote acceptance and quote expiry.

### Optional improvements
- Refresh handoff §3 and correct the sentence at spec line 566 in the next spec edit.

## Round 8 — 2026-10-10 · scope: feature-complete spec review (independent deep-tier confirmation)
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 approved revision 11 · hash (`git hash-object`) `3d0d99abce0e07c7e1286f77eafd5a8fbce83791` · matches `agents/PROJECT.md` §2 · `origin/main` at `a347854`

**Verdict:** Revision required
**Model used:** Opus 5.5 (deep tier, as R5–R7 recommended) · **Switch model next step?** No — the fixes touch money rules; keep the deep tier for the builder's revision and the next spec review.

This round is the deep-tier confirmation that R5–R7 asked for. It read the full spec body (Context through Appendix A heading, lines 289–1169) fresh, not only the diff since R5. R1–R7 focused on the v4.6 currency changes. The findings below are in areas those rounds did not reopen. None of them reopens an owner decision: the excess-only refund rule, the `credited` label, the void guard and the purge scope stay as accepted.

### Findings

### [P1] No way to correct a wrongly recorded payment
- Category: material risk (money flow)
- Rule: REC-01 (hard), REC-02, PAY-01; spec "Refunds and invoice status", data model `payment`, "Immutability rules"
- Evidence: data model `payment` (spec line 404) has no void or correction columns. "Refunds and invoice status" (line 839) defines only recording a payment. "Immutability rules" (line 569) lists corrections for quotes, invoices and agreements, but not payments. A refund record can be voided when it is wrong (lines 845–849); a payment record cannot. The flow auto-sends a receipt for each payment (flow step 10).
- Failure scenario: Charlie records RM10,000.00 instead of RM1,000.00 on a RM1,000.00 invoice. The invoice becomes `paid`, a receipt for RM10,000.00 is emailed to the client, and the dashboard counts RM10,000.00 paid. The spec gives two ways out, and both are wrong: (a) record a RM9,000.00 "refund", which records money that never left the account and stays in the export; or (b) edit or delete the row in the database, which breaks the audit and REC-01.
- Why it matters: this happens in normal use from Gate A (Phase 4: "record payment, auto receipt"). Money records and client-facing receipts become false, with no audited fix.
- Required correction: add a payment-correction rule, in the same style as the refund void. At minimum, state: (1) who may do it (role, step-up or not); (2) the record (a one-time void with reason code and text, `voided_at` / `voided_by`, append-only otherwise, as on `refund`); (3) what happens to its receipt (void the receipt and keep its number, or issue a corrective receipt; what the client is sent); (4) the guard when non-voided refunds exist against the payment (refuse, as for the credit-note void guard); (5) the effect on `B_net` (the void removes the stored `base_amount`, the same as a refund void) and on status recompute; (6) the lock order (`invoice` → `payment`); (7) events (`payment.voided`) and audit; (8) tests. Choosing the policy (void vs reversal record, receipt handling, step-up) is an owner decision.
- Owner: Charlie (policy), then builder (spec text)
- Verification: the next spec round finds the rule, its data-model columns, its lock order and its Verification cases.
- Status: open

### [P1] No limit on credit notes, so the amount owed can go below zero
- Category: defect (money rule)
- Rule: MON-04, MON-07, REC-02; spec "Refunds and invoice status", "Base amounts for credit notes, payments and refunds"
- Evidence: `amount_owed = invoice_total − Σ issued credit notes` (line 842). No rule caps a credit note's total at the amount still owed or at the invoice total; a search of the spec body finds none. Verification (q) 6 says "random sequences of payments, refunds, credit notes and voids **within the caps**", but no credit-note cap is defined.
- Failure scenario: an invoice of $100.00 is paid in full; a credit note of $150.00 is issued. `amount_owed = −5000`. Status becomes `paid`. `refundable_excess = 10000 − (−5000) = 15000`, so only the per-payment cap stops a refund larger than what was paid. The credit note's base total is `B_inv − conv(−5000) − 0`, which is larger than `B_inv`. So Dashboard v1 shows "credited" above "invoiced" for that invoice. The money-rule identities in "Base amounts…" (lines 544–552) assume `0 ≤ amount_owed ≤ invoice_total`, and that assumption is never stated.
- Why it matters: a typo in a credit note produces wrong dashboard and export figures and a wrong refundable excess. The spec's own invariants and property test depend on a cap it does not define.
- Required correction: state the cap, checked under the invoice lock on credit-note issue: `credit_note.total ≤ amount_owed_before` (that is, Σ issued, non-voided credit notes ≤ `invoice_total`). Say whether a credit note on a `void` invoice is refused. Add a CHECK or a server rule, and a Verification case (over-credit refused; exact remaining amount allowed; concurrent credit notes cannot together exceed it). The bound is a business rule; Charlie confirms it.
- Owner: builder (proposal), Charlie (confirm)
- Verification: the next spec round finds the cap in "Refunds and invoice status" and a Verification case for it, and (q) 6 names the caps it means.
- Status: open

### [P2] Status rules do not cover a zero-total invoice or the invoice void itself
- Category: ambiguity (money and status)
- Rule: spec "Refunds and invoice status", "Money rules" step 3, "Immutability rules"
- Evidence: step 3 allows `D = subtotal`, and nothing bounds `line_discount_bps` to `< 10000`, so a total of 0 is possible. Status rule 3 (line 854) then gives `credited` ("only possible when issued credit notes cover the whole total"), which is false here. Status is recomputed only in payment, refund and credit-note transactions, so a zero-total invoice issued as `issued` can go `overdue` and get reminders for 0.00. Separately, `invoice.voided` exists (line 590) and Admin and Owner may "void" (line 662), but no section says when an issued invoice may be voided (with payments? with issued credit notes?), what happens to its reminders and receipts, or which locks it takes.
- Failure scenario: a fully discounted "complimentary" invoice is emailed, then the overdue scan sends it reminders, or the client sees the label "Credited" on an invoice that was never credited. Two builders write two different invoice-void preconditions.
- Required correction: either refuse issue of a zero-total invoice, or give it a defined status and no reminders. Bound `line_discount_bps` to 0…10000. Add a short "Voiding an invoice" rule: preconditions, locks (`invoice FOR UPDATE`), effect on reminders, receipts and refunds (refunds up to net paid are already defined), event and audit, and a Verification case.
- Owner: builder (proposal), Charlie (confirm the zero-total choice)
- Verification: the next spec round finds both rules and their tests.
- Disposition: before merge (same revision as the two P1s)
- Status: open

### [P2] Quote acceptance is not fully specified: direct acceptance and quote expiry
- Category: ambiguity
- Rule: spec "Lock order" chain B, "The flow", Phase 7–8; LINK-09
- Evidence: "direct quote acceptance" appears only in the lock order (lines 776, 791, 811) and in tests (lines 795, 951, 1058). No section says how a client accepts a quote directly (OTP? typed name? signature row?), which phase builds it, or whether it creates an agreement. The lock chain takes `customer FOR SHARE` "to read the pattern", which suggests it does. Bob's v4.5 R8 already noted: "the spec does not say whether direct quote acceptance creates an agreement" (`.andy/bob-review-v4.5-r8.md:21`); it is still open. Also, `quotation.valid_until` and the daily "expired quotes" scan (line 631) exist, but the approval recheck (line 806) does not check the quote's `valid_until` or `expired` status.
- Failure scenario: a client approves a proposal a week after its quote's `valid_until`; the approval sets an `expired` quote to `accepted`. Two builders build direct acceptance two ways: one with OTP + signature + agreement, one with a button.
- Required correction: add a short "Direct quote acceptance" subsection (link, OTP, signature, agreement or none, events, phase), and state whether approval and acceptance are refused after `valid_until`, and what the client sees.
- Owner: Charlie (product choice), builder (text)
- Verification: the next spec round, or the Phase 5 plan review, finds both rules.
- Disposition: deferred to the Phase 5 plan (must be in the spec before that plan is written)
- Status: open

### [P2] A change to tax registration has no defined effect on open drafts
- Category: ambiguity (money)
- Rule: MON-07; spec Money rules step 6, Onboarding
- Evidence: step 6 (line 474) treats a line as exempt when the "workspace [is] not tax-registered", which reads the current setting at compute time. Onboarding (line 640) says a change "applies only to new documents". Documents store "tax name/rate" but no tax-registered flag.
- Failure scenario: a draft invoice is created while the workspace is registered. The workspace then turns registration off. On issue, one builder recomputes with no tax (current setting); another keeps the tax (draft created before the change). The issued total differs.
- Required correction: say which rule wins for drafts, quotes with unsent edits and recurring templates (for example: the server recomputes every draft from the current setting at send / issue; or each document stores the flag when it is created), and add a unit test.
- Owner: builder (proposal), Charlie (confirm)
- Verification: the Phase 4 plan review finds the rule and its test.
- Disposition: deferred to the Phase 4 plan
- Status: open

### [P2] Rate limits have no numbers, and OTP re-issue has no limit
- Category: security control not testable
- Rule: LINK-03, LINK-07; reviewer spec-review check "security controls are testable"
- Evidence: "separate limits for login, OTP, share-link views" (line 650) and "per-link and per-IP limits" (lines 362, 709) give no numbers or windows. OTP has 5 attempts per challenge (line 713), but the spec sets no limit on how many challenges a link may request. Turnstile is optional on self-host (Open question 9).
- Failure scenario: someone with a forwarded WhatsApp link requests challenge after challenge, making 5 guesses at each, and floods the contact's inbox. Nobody can test a limit that has no number.
- Required correction: state the numbers and windows (login, password reset, OTP request per link and per IP, OTP verify, share-link views), the response when a limit is hit, and an OTP re-issue cap per link per hour/day. Add tests that hit each limit.
- Owner: builder (proposal; Charlie confirms if a value affects clients)
- Verification: the Phase 1 plan review finds the numbers and the tests.
- Disposition: deferred to the Phase 1 plan (rate limits are built in Phase 1)
- Status: open

### [P2] Purge reference checks can pass by seeing nothing
- Category: material risk (data retention)
- Rule: TEN-06, REC-04; spec Tenancy, "Audit, logging, privacy" → Customer purge
- Evidence: Tenancy (line 678) gives workspace policies "`TO crm_app` (and `TO crm_purge` for the purge tables)". The purge section (line 744) gives `crm_purge` "SELECT where it must check references", but does not list those tables. Under `FORCE ROW LEVEL SECURITY`, a table with no policy for `crm_purge` returns zero rows to it, with no error.
- Failure scenario: the builder adds `crm_purge` policies only on the tables it deletes or updates. The check "the customer has no issued documents" then reads zero invoices, credit notes, receipts and signed agreements, and the purge redacts a customer whose issued invoices must be kept. Version deletes are still saved by the composite FKs (foreign-key checks bypass RLS), but customer redaction has no such backstop. The Phase 9 purge test checks that "issued documents [are] untouched", not that the customer row is untouched.
- Required correction: list every table `crm_purge` must read, give each a `FOR SELECT TO crm_purge` workspace policy, and add tests: (a) a customer with an issued invoice, a credit note, a receipt or a signed agreement is not redacted; (b) a schema test that `crm_purge` has a SELECT policy on each listed table.
- Owner: builder
- Verification: the Phase 1 plan (when the roles and policies are first written) and the Phase 9 test list contain both.
- Disposition: deferred to the Phase 1 plan
- Status: open

### [P3] Stale "open question 1" labels and an old "Next steps" list
- Category: consistency
- Evidence: Decisions → Database (line 339) says "pg-boss's internal `pg` pool: open question 1", and Known risks R2 (line 884) says "**Open question 1 for Charlie**; not decided here." Open question 1 was resolved at the v4.5 approval (line 215). "Next steps after approval" (lines 986–991) still describes the v4.5 approval steps.
- Required correction: change both labels to "resolved at the v4.5 approval (Approval record item 3)"; mark "Next steps after approval" as v4.5 history or update it.
- Owner: builder
- Status: open

### Self-check audit
Spec review: there is no builder self-check table. This is the reviewer's own applicability list for the full spec.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| MON-01–MON-07 | Yes; money, tax, FX. | — | Fail: no credit-note cap; zero-total status; tax-registration ambiguity. The v4.6 currency rules pass (worked example and conversions rechecked). | Lines 455–565, 842, 854; (j), (n), (p), (q). | New findings P1 #2, P2 #1, P2 #3. |
| REC-01–REC-12 | Yes; issued records. | — | Fail: no payment correction path; invoice void not defined. Numbering, snapshots and PDFs pass. | Lines 404, 451–453, 567–582, 839. | New findings P1 #1, P2 #1. |
| PAY-01 | Yes; manual payments and refunds. | — | Fail: a payment error can be fixed only outside audited code. | Line 839. | P1 #1. |
| TEN-01–TEN-10 | Yes; RLS, five roles, composite FKs. | — | Pass, except `crm_purge` read policies are not listed. | Lines 676–690, 744. | P2 #5. |
| LINK-01–LINK-09 | Yes; client links, OTP, approval. | — | Pass, except no rate-limit numbers or OTP re-issue cap, and direct quote acceptance is undefined. | Lines 692–715, 776–811. | P2 #2, P2 #4. |
| AUTH | Yes; Better Auth, roles, step-up. | — | Pass for this scope; the login and reset limit numbers fall under P2 #4. | Lines 646–674. | — |
| EVT, FILE, FE | Yes. | — | Pass; carried from R5 with a fresh read of the jobs, files and "Needs rate" sections. | Lines 584–592, 717–721; (r) 13–14. | None. |
| Scope vs `PROJECT.md` §9 | Yes. | — | Pass; no out-of-scope feature found. | Scope — Part 1; §9. | None. |
| Milestones "done when" | Yes. | — | Pass; each phase has testable criteria. | Lines 941–953. | None. |
| Handoff accuracy | Yes. | — | Pass: `.agent/handoff.md` shows branch `chore/setup-reconcile-v4-6-approved` at `eb9204e`, `main` at `a347854`, matching git. | `git rev-parse HEAD origin/main`. | None. |

### Verification performed
| Command / check | Result |
|---|---|
| `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` | `3d0d99abce0e07c7e1286f77eafd5a8fbce83791`, equal to `PROJECT.md` §2. |
| Full read of spec lines 185–1072 | Done. Lines 1–184 (change history) skimmed for status only. |
| Searches over the spec body for payment void, credit-note caps, zero totals, invoice void, `valid_until`, direct quote acceptance, rate limits, tax registration | Results as cited in the findings. |
| Search of past reviews and `docs/DECISIONS.md` for the same topics | Only the direct-quote-acceptance gap was raised before (`.andy/bob-review-v4.5-r8.md:21`); it is unresolved. |
| Hand check of worked example and conversions in (j), (n), (q) 1 | Match the stated values. |
| Code tests / CI | Not run; spec review only. |

### Residual risks and test gaps
- R1–R7 used non-Opus models. This round re-read the whole body, but did not re-derive every case in Verification (o), (p), (r).
- Version deletes during purge are protected by FKs; that protection is not stated in the spec, so a later FK change (for example `ON DELETE CASCADE`) could remove it.

### Required before merge
- P1 #1 payment correction (owner decision first).
- P1 #2 credit-note cap.
- P2 #1 zero-total invoice and invoice void rules.

### Deferred conditions
- P2 #2 quote acceptance → before the Phase 5 plan.
- P2 #3 tax registration and drafts → Phase 4 plan.
- P2 #4 rate-limit numbers → Phase 1 plan.
- P2 #5 `crm_purge` read policies → Phase 1 plan.

### Optional improvements
- P3 stale labels.

### Note on the build gate
Phase 0 PR 2 (auth and DB tooling) touches none of these rules. Under `START.md`, `build` still needs an Approved round for the current hash. Whether to allow Phase 0 work while the spec is revised is Charlie's call, not the reviewer's.

## Round 7 — 2026-10-10 · scope: exact-hash re-review and Round 6 follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 approved revision 11 · hash (`git hash-object`) `3d0d99abce0e07c7e1286f77eafd5a8fbce83791` · on `origin/main` at merge `c79fd762a8cadf86249f42f04db88934ccf02cb8`

**Verdict:** Approved
**Model used:** GPT-6 · **Switch model next step?** Yes — the project maps spec review to deep tier (Opus 5.5); that remains the recommended confirmation before `build`.

### Findings
No blocking findings.

### Self-check audit
The spec hash is unchanged since R6. Applicability is carried forward from the feature-complete revision 11 review; this round rechecked the exact-hash status record and R6's handoff finding.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `MON-01`–`MON-07` | Yes; the spec defines money, currency and FX behavior. | No spec change since R6. | Pass carried forward; current hash is identical and the approval line is the only change from R5's reviewed blob. | Spec hash and blob diff; R5 and R6 audits. | None. |
| Tenancy, auth, public links, finalized records, payments and events/jobs | Yes; included in the feature-complete spec scope. | No spec change since R6. | Pass carried forward; no new requirements or changed controls. | Current spec; R5 audit; unchanged hash. | None. |
| Frontend and accessibility | Yes; the recurring-rate signal and dashboard link are specified. | No spec change since R6. | Pass carried forward; keyboard, accessible text and responsive acceptance criteria remain. | Verification (r) 12–14; R5 audit. | None. |
| Scope, security testability, milestones and open questions | Yes; feature-complete spec review. | No spec change since R6. | Pass carried forward; no spec content changed since the exact-hash approval. | Current spec hash; R5 review. | None. |
| Handoff accuracy | Yes; reviewer role §2 requires reporting repo/handoff drift. | Round 6's P3 was corrected. | Pass; handoff branch, HEAD and commit list now match current git state. | `.agent/handoff.md:15–16,26–40`; `git rev-parse HEAD` = `eb9204ec…`; `origin/main` = `a347854…`. | None. |

### Verification performed
| Command / check | Result |
|---|---|
| `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` | `3d0d99abce0e07c7e1286f77eafd5a8fbce83791`, unchanged from R6 and matching `PROJECT.md` §2. |
| Blob diff from R5-reviewed spec hash | Only the Status line differs; current spec records Charlie's approval and reconciliation. All requirements below it are unchanged. |
| Handoff vs git state | Fixed: `.agent/handoff.md` identifies branch `chore/setup-reconcile-v4-6-approved`, HEAD `eb9204e`, and `origin/main` `a347854`, matching git. |
| Local review vs archived R6 review before this round | Hashes matched (`442d031664e8981da79bed076a86413c271f7858`). |
| Code tests / CI | Not run; unchanged spec requirements and this review is documentation-only. |

### Residual risks and test gaps
- Round 5 recommended an independent confirmation in the project's configured deep tier (Opus 5.5) before `build`. This GPT-6 review does not provide that model confirmation.
- Implementation tests have not been rerun by this spec review.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.

## Round 6 — 2026-10-10 · scope: exact-hash approval record follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 approved revision 11 · hash (`git hash-object`) `3d0d99abce0e07c7e1286f77eafd5a8fbce83791` · on `origin/main` at merge `c79fd762a8cadf86249f42f04db88934ccf02cb8`

**Verdict:** Approved
**Model used:** GPT-6 · **Switch model next step?** Yes — the project maps spec review to deep tier (Opus 5.5); use it to confirm before `build`, as Round 5 recommended.

### Findings
No blocking findings.

### [P3] Handoff git state is stale
- Category: quality
- Rule: reviewer role §2 (report handoff drift)
- Evidence: `.agent/handoff.md:15–16` reports `chore/setup-reconcile-v4-6-approved` at `eb9204e` and `main` at `a347854`; `.agent/handoff.md:26–40` instead says the checkout is `docs/spec-v4.6-rev8` at `491957e`, with `origin/main` at `0e11cde`. Current git reports HEAD `eb9204ec…` and `origin/main` `a347854…`.
- Failure scenario: a later session trusts the stale Git state block and starts work from an old branch or assumes an outdated main revision.
- Why it matters: the handoff contradicts its own current branch section and repository state.
- Required correction: refresh the Git state block and commit list to match the current checkout, or clearly mark them as historical.
- Owner: builder
- Verification: compare the refreshed block with `git status`, `git rev-parse HEAD`, and `git rev-parse origin/main`.
- Status: open

### Self-check audit
This round's spec diff is only the Status line. Applicability is carried forward from Round 5's feature-complete review of revision 11; I rechecked the prior round and the changed approval record.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `MON-01`–`MON-07` | Yes; the full spec defines money, currency and FX behavior. | No rule change in this hash update. | Pass carried forward from Round 5; this update changes no money requirement. | Money rules; Round 5 self-check; blob diff between hashes. | None. |
| Tenancy, auth, public links, finalized records, payments and events/jobs | Yes; these are part of the feature-complete spec scope. | No behavior change in this hash update. | Pass carried forward from Round 5; no runtime rule changed. | Relevant spec sections; Round 5 self-check; blob diff between hashes. | None. |
| Frontend and accessibility | Yes; the spec includes the recurring-rate signal and dashboard link. | No UI change in this hash update. | Pass carried forward from Round 5; keyboard, accessible text and responsive acceptance checks remain in the spec. | Verification (r) 12–14; Round 5 self-check; blob diff between hashes. | None. |
| Approval record and source-of-truth state | Yes; exact-hash review is the build gate. | The Status line records Charlie's approval after Round 5 and says the reconciled spec is the source of truth. | Pass. The owner approval, reviewed revision, prior review hash and setup reconciliation hash are represented consistently. | Spec line 3; `docs/DECISIONS.md` approval entry; `agents/PROJECT.md` §2; `origin/main` merge `c79fd76`. | None. |
| Scope, security testability, milestones and open questions | Yes; feature-complete spec review. | No change in this hash update. | Pass carried forward from Round 5; this round makes no change to controls, scope, milestones or open choices. | Round 5 review and current lower spec content; blob diff between hashes. | None. |

### Verification performed
| Command / check | Result |
|---|---|
| `git hash-object docs/superpowers/specs/2026-09-27-core-sales-design.md` | `3d0d99abce0e07c7e1286f77eafd5a8fbce83791`. |
| `git diff 7d402bb9a79af423daa06c75de86bf2d74857b01 3d0d99abce0e07c7e1286f77eafd5a8fbce83791` | Blob diff contains only the Status line. It records the Charlie approval and review context; all spec content below it is unchanged from Round 5's approved revision 11. |
| `git rev-parse origin/main` and spec hash cross-check | `origin/main` is `a347854604081fa8cd253382c16ce7df79692d3d`; the approved spec blob is `3d0d99ab…`, matching `agents/PROJECT.md` §2. Merge `c79fd76` introduced that spec hash. |
| Prior review and approval record | Round 5 is Approved for revision 11; `docs/DECISIONS.md` records Charlie's v4.6 approval and the Status-line-only change. |
| Code tests / CI | Not run; this is a specification review and the hash update changes no requirements or implementation. |

### Residual risks and test gaps
- Round 5 recommends independent confirmation in the project's deep tier (Opus 5.5) before `build`.
- This exact-hash pass does not rerun implementation tests; the spec change contains no implementation requirements beyond the already approved revision 11.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.

## Round 5 — 2026-10-09 · scope: v4.6 revision 11 follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 11 · hash (`git hash-object`) `7d402bb9a79af423daa06c75de86bf2d74857b01` · present on `origin/main` at merge `3b0a4bf9272670243082e04857351f3f3f2992a1`

**Verdict:** Approved
**Model used:** GPT-6.1 · **Switch model next step?** Yes — the project maps deep spec review to Opus 5.5; use that tier to confirm this review before build.

### Findings

### [P2] The agreement-pattern lock during provisioning may not be owner-approved — resolved
- Category: ambiguity
- Rule: `agents/PROJECT.md` §11; spec Open question 10
- Evidence: Charlie explicitly replied in this conversation: “option 1: and approved v4.5 as a whole, and the refusal rule was in the approved spec text. Adding it explicitly to the Approval record would remove the ambiguity.” Revision 11 records that answer at `docs/superpowers/specs/2026-09-27-core-sales-design.md:13`, and the approval record at line 7 and Open question 10 at line 224 now identify both the future-only behavior and the refusal while an unfrozen SOW awaits provisioning.
- Failure scenario: without the answer, the provisioning-time refusal could be treated as approved based only on an assistant recommendation.
- Why it matters: this is an owner-controlled default previously marked “pending Charlie.”
- Required correction: keep the answer and its scope accurately recorded in the Approval record, Open question 10 and the decision log.
- Owner: builder (record); owner (decision)
- Verification: compared Charlie's direct answer with the revision 11 wording and the matching `docs/DECISIONS.md` entry; the P2 condition is satisfied.
- Disposition: before v4.6 approval
- Status: resolved by Charlie's explicit answer, verified in this review.

### [P3] Handoff still presents PR #14 as open after it merged
- Category: quality
- Rule: reviewer role §2 (report handoff drift)
- Evidence: `.agent/handoff.md:15–16` says PR #14 is open, while lines 49–53 record it as merged and then repeat pre-merge next steps. GitHub reports PR #14 `MERGED`; `origin/main` is merge `3b0a4bf` and contains this spec hash.
- Failure scenario: a later session follows the stale active-target lines and repeats PR review, approval or merge steps already completed.
- Why it matters: the handoff contradicts the repository and its own newer status entry, obscuring the actual next gate.
- Required correction: reconcile the active-target and current-state sections with the merged PR and preserve older steps only as clearly marked history.
- Owner: builder
- Verification: compare the refreshed handoff with PR #14's host state, `origin/main`, and this review.
- Status: open

### Self-check audit

Applicability was based on the full spec scope and the revision 11 change. Revisions 8–10 were checked against earlier findings; revision 11 changes only the recorded scope of an existing owner-approved default.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `MON-01`–`MON-07` | Yes; the spec defines money and FX behavior. | Revision 11 makes no money-rule change. | Pass for carried-forward decisions and rules; the owner-confirmation wording does not change calculations. | Money rules; revisions 1–7; prior review Rounds 1–4. | None. |
| Frontend and accessibility (`FE-05`, `FE-14`, `FE-70`, `A11Y-01`, `A11Y-06`) | Yes; the spec includes the recurring-rate signal and dashboard link. | Revision 11 makes no UI change. | Pass for the carried-forward keyboard, focus and responsive acceptance checks. | Verification (r) 12–14; prior review Rounds 1–4. | None. |
| Tenancy/RLS, auth/public links, `REC-01`–`REC-12`, `PAY-01`, events/jobs | Yes; these domains are in the product spec. | Revision 11 makes no runtime-rule change. | Pass for carried-forward controls; no revision 11 change to access, isolation, finalized records, payments or jobs. | Relevant spec sections; prior review Rounds 1–4. | None. |
| `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13`, `UNI-14` | Yes; product values, secret hygiene, scope, CI and pinned dependencies apply. | No business value, secret, code or dependency change. | Pass; revision 11 is documentation-only and changes no implementation or dependencies. | Revision 11 change record; merged PR #14 CI was green in PR review Round 4. | None. |
| `PROJECT.md` §11 / owner choices | Yes; Q10 previously had a pending owner default. | Pass; Charlie's exact words and source are recorded. | Pass; Charlie directly confirmed that the v4.5 approval included the provisioning refusal. | Charlie's reply; spec lines 7, 13 and 221; `docs/DECISIONS.md`. | None. |

### Verification performed

| Check | Result |
|---|---|
| Pin requested spec | v4.6 draft revision 11; hash `7d402bb9a79af423daa06c75de86bf2d74857b01`; exact file is present on `origin/main` at `3b0a4bf`. |
| Re-read prior spec review rounds | Rounds 1–3 findings are addressed in revisions 8–10. Round 4's Q10 P2 is resolved by Charlie's direct answer and revision 11; handoff status remains inconsistent (P3 above). |
| Compare revision 11 with prior finding and source decision | Approval record and Q10 now name both parts of the accepted default; no rule or behavior changed. |
| Verify PR/merge state | PR #14 is merged; merge `3b0a4bf` is `origin/main` and contains the reviewed spec hash. |
| Code tests | Not run; this is a documentation/spec review. |

### Residual risks and test gaps
- v4.6 remains a draft until Charlie explicitly approves it. After that, reconcile `agents/PROJECT.md` with `setup` before `build`.
- Existing accepted money-rounding limits remain as recorded in prior rounds and `docs/DECISIONS.md`.
- Confirm this review in the project-mapped deep tier (Opus 5.5) before build.

### Required before v4.6 approval/build
- None.

### Deferred conditions
- None.

### Optional improvements
- Refresh the contradictory in-flight handoff state (P3).

## Round 4 — 2026-10-09 · scope: v4.6 revision 10 follow-up
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 10 · hash (`git hash-object`) `c20d9ffd93eb3cee6051da804acf53ecea26204d` · present on `origin/main` at merge commit `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`

**Verdict:** Revision required
**Model used:** GPT-6 · **Switch model next step?** Yes — `agents/PROJECT.md` §6 maps spec, money, security and data-isolation reviews to deep tier (Opus 5.5); use that tier for the corrected review before build.

### Findings

### [P2] The agreement-pattern lock during provisioning may not be owner-approved
- Category: ambiguity
- Rule: `agents/PROJECT.md` §11; spec Open question 10
- Evidence: the v4.5 approval record at `docs/superpowers/specs/2026-09-27-core-sales-design.md:7` records item 2 as “a customer agreement-pattern change affects future approvals only.” Open question 10's preserved original text at line 218 also includes a separate behavior: refuse the change while an unfrozen SOW is awaiting provisioning. The live rule at line 829 keeps that refusal and revision 10 marks all of Open question 10 resolved based on approval item 2.
- Failure scenario: an owner or builder treats the provisioning-time refusal as approved even though the approval record only explicitly names the future-approvals rule.
- Why it matters: this refusal blocks an owner setting change during a provisioning window; whether that guard is required is a product choice, and `PROJECT.md` §11 requires Charlie's explicit choice for defaults still pending.
- Required correction: have Charlie confirm whether the pending-provisioning refusal was included in v4.5 approval. If yes, record that scope in the approval/decision record. If no, split the question: leave the future-approvals behavior resolved and keep the provisioning refusal open until chosen.
- Owner: owner (Charlie)
- Verification: the spec and its approval record make the status of the provisioning-time refusal unambiguous before v4.6 is approved.
- Disposition: before v4.6 approval
- Status: open

### [P3] Handoff still says PR #12 is open
- Category: material risk
- Rule: reviewer role §2; handoff current-state accuracy
- Evidence: `.agent/handoff.md:11,15–16` says PR #12 is open and `main` is at `00cffa1`. GitHub reports PR #12 merged at `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`; `origin/main` is at that merge commit and contains the reviewed spec hash.
- Failure scenario: a later session follows the handoff and repeats PR #12 review or merge steps instead of resolving the remaining v4.6 decision and review gate.
- Why it matters: the current next step and active target are misrepresented.
- Required correction: update the handoff to record PR #12 merged and the current spec review result and next step.
- Owner: builder
- Verification: compare the handoff with PR #12's host state, `origin/main`, and this review round.
- Status: open

### Self-check audit

Applicability was determined from the full v4.6 scope and the revision 10 diff before comparing earlier review notes. Revision 10 only relabels decisions; the existing money, UI, tenancy, authentication, jobs, and finalized-record requirements remain in scope and were previously checked in Rounds 1–3.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| `MON-01`–`MON-07` | Yes; the spec defines stored and computed money and v4.6 changes FX behavior. | Revision 10 makes no rule or behavior change. | Pass for carried-forward rules; the new decision-status wording does not change calculations. Open question 10 remains ambiguous as described above. | Money rules; revisions 1–7; Open question 10; Rounds 1–3. | None beyond finding above. |
| `FE-05`, `FE-14`, `FE-70`, `A11Y-01`, `A11Y-06` | Yes; v4.6 specifies the dashboard link and recurring-rate badge. | Revisions 8–10 are test/status clarifications only. | Pass for carried-forward acceptance checks: keyboard access, visible focus, responsive profiles and accessible text were specified in earlier rounds. | Verification (r) 12–14; Round 1 and Round 2 findings resolved in revisions 8–9. | None. |
| `TEN-02`, `TEN-05`–`TEN-12` | Yes; the product is multi-tenant and the spec defines workspace-scoped reads, writes and purge. | No change to tenancy in revision 10. | Pass for carried-forward controls; revision 10's purge label is consistent with the narrow-scope approval, subject to the separate Q10 finding. | Tenancy; Customer purge; Verification (r) 12; Rounds 1–3. | None. |
| `REC-01`–`REC-12` | Yes; the spec covers issued invoices, credit notes and signed agreements. | No change to finalized-record behavior in revision 10. | Pass for carried-forward snapshot, immutability, numbering and PDF rules; no revision 10 change. | Immutability rules; Numbering; PDF timing; Rounds 1–3. | None. |
| Auth and public-link controls | Yes; anonymous customer links and authentication are part of the spec scope. | No change in revision 10. | Pass for carried-forward controls; no new auth/link behavior. | Authentication and sessions; Anonymous access; Client links and signatures; Rounds 1–3. | None. |
| `PAY-01`, events/jobs | Yes; the spec covers payment records and recurring jobs, but revision 10 changes neither implementation nor behavior. | No change in revision 10. | Pass for carried-forward server-side writes, idempotency and job rules; no new requirement. | Payments and refunds; Domain events and jobs; Rounds 1–3. | None. |
| `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13`, `UNI-14` | Yes; values, secrets, scope, build gates and pinned dependencies apply to the overall spec. | No new business value, secret or dependency; v4.6 remains a draft. | Pass; no new values/secrets/dependencies in revision 10, and project approval/reconcile gates remain stated. | Revision 10 diff; current status line; `agents/PROJECT.md` §§2, 7, 11. | None. |
| `agents/PROJECT.md` §11 / owner choices | Yes; unresolved defaults must remain open until Charlie decides. | Six questions are resolved by the v4.5 approval record. | Partial: five resolutions are supported by their cited accepted defaults. For question 10, the approval record does not explicitly mention the separate refusal during pending SOW provisioning. | Approval record line 7; Open question 10 line 218; Money rule line 829; revision 10 line 13. | Yes; P2 finding. |

### Verification performed

| Check | Result |
|---|---|
| Pin current spec and main | v4.6 draft revision 10; hash `c20d9ffd93eb3cee6051da804acf53ecea26204d`; on `origin/main` at merge commit `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`. |
| Confirm PR #12 merge state | GitHub reports PR #12 merged at `a3a2394bd3fee071165aa848d2f80b69b2b2d22e`. |
| Read earlier spec review rounds | R1 and R2's test-clarity findings are resolved in revisions 8–9; R3's status-label finding is addressed in revision 10, except for the Q10 subdecision recorded above. |
| Compare approval record, question 10 and live rule | Found that the approval record names the future-approvals-only rule but not the separate pending-provisioning refusal. |
| Review revision 10 history and diff from revision 9 | Status labels and references only; no calculation, security control, test, milestone or scope change. |
| Review carried-forward consistency, security controls, scope, milestones and test criteria | No additional revision 10 defect found. Existing v4.6 behaviors and earlier resolved test findings are unchanged. |
| Code tests | Not run; this is a specification review. |

### Residual risks and test gaps
- v4.6 remains a draft; Charlie's approval and `setup` reconciliation remain gates after the spec review is approved.
- Accountant, lawyer, SST and PDPA checks remain gated before Phase 4 goes live, as stated in the spec.
- This review used GPT-6; the project's configured model for deep spec review is Opus 5.5. Use deep tier for the corrected review before build.

### Required before v4.6 approval
- Resolve whether Charlie accepted the refusal to change `customer.agreement_pattern` while an unfrozen SOW awaits provisioning. Keep that subdecision open unless the approval record confirms it.

### Deferred conditions
- None.

### Optional improvements
- None.

**Verdict:** Revision required

## Round 3 — 2026-10-09 · scope: slice (revision 9 follow-up and carried-forward decision status)
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 9 · hash (`git hash-object`) `19e7241aa37841a617f8c56aad3aede0a4c2666d` · `origin/main` commit `4feac56d6a8e473b63d4e2878641eb5e29ca39bc`

**Verdict:** Revision required
**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project maps spec review, money, security and data isolation to deep (Opus 5.5). Confirm the corrected spec in that tier before build.

### Findings

### [P2] Open questions still mark v4.5-approved defaults as pending
- Category: spec/guardrail mismatch
- Rule: `agents/PROJECT.md` §11; spec Open questions 1, 5, 10–13
- Evidence: The v4.5 approval record at spec line 7 says Charlie accepted the `pg` driver restriction, narrow purge scope, agreement-pattern rule, excess-only refunds, “Credited” label and guarded credit-note void. Open questions at lines 203, 207, and 212–215 still ask Charlie to choose or confirm those same defaults; questions 5 and 10–13 explicitly say “pending Charlie.” `PROJECT.md` §11 says a default still marked pending needs Charlie's explicit choice.
- Failure scenario: After Charlie approves v4.6, setup/build treats one of these choices as unresolved, or the builder reads the question as permission to change a behavior already accepted with v4.5.
- Why it matters: The spec presents conflicting decision status at the build gate and risks either blocking authorized work or changing an owner-approved policy.
- Required correction: Reconcile those question entries with the v4.5 approval record. Mark the accepted decisions resolved and cite the approval, or isolate any genuinely unapproved subdecision precisely. Keep the still-open questions (for example, the Phase 4 VPS provider choice) open.
- Owner: builder
- Verification: Re-read the approval record and Open questions; no accepted default is still labeled pending, and any remaining question identifies a specific choice not covered by the approval.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### Self-check audit
| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| MON-01–MON-07 | Yes — v4.6 changes currency, FX and stored money behavior | No revision 9 change | Prior v4.6 rules remain explicit about minor units, currency, exact rational conversion, frozen rates/base currency, and separate currency totals; the change under review introduces no new money rule | Spec money rules and revision history; revisions 8–9 are test clarifications | None |
| FE-14 / FE-70 | Yes — revision 9 defines responsive test profiles | Prior R2 finding addressed | Pass; cases 13–14 and the Playwright plan consistently name `chromium` and `mobile-chrome` | Spec lines 13, 1057, Verification (r) 13–14; Phase 0 plan pins Playwright 1.63.0 | None |
| FE-05 / A11Y-01 / A11Y-06 | Yes — the recurring-rate count link and badge have keyboard and accessibility acceptance criteria | Prior R1 finding addressed | Pass; tab order, visible focus, Enter activation, accessible badge text, no extra badge tab stop and an automated scan remain specified | Verification (r) 13–14 | None |
| TEN-02, TEN-05–TEN-12 | Yes — CRM is multi-tenant and the spec defines tenant storage and access | No change in revisions 8–9 | Existing spec requires RLS/default deny, server-derived tenant context and isolation tests; no inconsistency found in this follow-up | Spec “Tenancy”; Verification (r) 12 | None |
| AUTH / public-link controls | Yes — authentication and anonymous client links are in scope | No change in revisions 8–9 | Existing OTP, expiry, revocation, scoped resolution and concurrency requirements remain testable; no inconsistency found in this follow-up | Spec “Authentication and sessions,” “Anonymous access,” “Client links and signatures,” Verification (a)–(g) | None |
| UNI-13 | Yes — eventual implementation must pass delivery checks | No change in revisions 8–9 | Not an implementation change; no CI claim is needed for this spec review | Spec “Verification (for the build)” | None |
| `PROJECT.md` §11 / pending owner choices | Yes — the spec carries defaults that control later plans and implementation | Not included in the revision 9 change summary | Disagreement: the approved v4.5 record and current “pending Charlie” labels conflict (finding above) | Spec lines 7, 203, 207, 212–215; `agents/PROJECT.md` §11 | Yes |

### Verification performed
| Check | Result |
|---|---|
| Pin spec version and hash on current `origin/main` | v4.6 draft revision 9; `19e7241aa37841a617f8c56aad3aede0a4c2666d`; main at `4feac56d6a8e473b63d4e2878641eb5e29ca39bc` |
| Read previous spec review rounds | R1 fixture-isolation and keyboard/responsive findings are covered in revision 8; R2's undefined mobile-profile finding is covered in revision 9. |
| Compare v4.5 approval, current decisions, PROJECT gates and Open questions | Found the stale pending labels recorded above. The v4.6 owner choices in revisions 1–7 otherwise match the documented decision history. |
| Check revision 9 Playwright profile against pinned library | The Phase 0 plan pins Playwright 1.63.0. Its [official device registry](https://github.com/microsoft/playwright/blob/v1.63.0/packages/isomorphic/deviceDescriptorsSource.json) contains both Desktop Chrome and Pixel 5; Pixel 5 is a Chromium mobile profile with touch support and a concrete viewport. |
| Review spec structure and acceptance criteria | Reviewed money rules and examples, tenancy and access controls, links/signatures, milestones and gates, open questions, and the recurring-signal cases. No other revision 9 defect found. |
| Code tests / implementation checks | Not run; this is a specification review and no implementation change is under review. |

### Residual risks and test gaps
- This review uses GPT-6.1-sol rather than the project-mapped Opus 5.5 deep tier. Re-review the corrected revision in deep tier before build.
- Accountant, lawyer, SST and PDPA checks remain explicitly gated before Phase 4 goes live; they do not block Phase 0 work.

### Required before v4.6 approval/build
- Resolve the pending-status contradiction in Open questions 1, 5, and 10–13.

### Deferred conditions
- None.

### Optional improvements
- None.

### Handoff block
- **Current objective:** Review v4.6 revision 9 at spec hash `19e7241aa37841a617f8c56aad3aede0a4c2666d`.
- **Completed checks:** Pinned current `origin/main`; rechecked both earlier spec findings; verified the named Playwright profiles against the pinned 1.63.0 device registry; compared Open questions with the v4.5 approval record and project gates.
- **Pending checks:** Reconcile Open questions 1, 5, and 10–13 with the approved v4.5 choices; run a fresh spec review on the resulting hash.
- **Key decisions / assumptions:** Charlie's v4.5 approval remains authoritative for defaults listed in its approval record. Do not infer a new choice from Bob's recommendation.
- **Open risks:** Current spec repeats “pending Charlie” for decisions the v4.5 approval says Charlie accepted.
- **Next exact command:** `fix`, then `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md`.
- **Suggested model tier for next step:** Deep (Opus 5.5), as required for spec, money and security review by `agents/PROJECT.md` §6.

## Round 2 — 2026-10-08 · scope: spec review
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 8 · hash (`git hash-object`) `de327c9ba836c0d3a01b793d81b8394c9c3fa47e` · matches `origin/main` at `0e11cde7549a6146d0813aa454f03161d131e81c`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — the project maps spec review and money behavior to deep tier (Opus 5.5); confirm this finding in that tier before build.

### Findings

### [P2] Responsive test references a mobile viewport that is not defined
- Category: ambiguity
- Rule: Verification (r) 14; `FE-14`, `FE-70`
- Evidence: the spec says case 14 uses “the mobile viewport it uses for client pages” (`docs/superpowers/specs/2026-09-27-core-sales-design.md:1034`). The referenced Phase 0 Playwright configuration defines only `projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]` and has no mobile viewport or viewport size (`docs/superpowers/plans/2026-09-29-phase-0-foundation.md:2308`). No other `viewport` or mobile device configuration appears in that plan.
- Failure scenario: the implementer must choose an unstated width/device profile, so two test suites can claim to satisfy case 14 while testing different breakpoints; the spec's mobile overflow and full-label assertions are not reproducible from the named plan.
- Why it matters: responsive behavior is an explicit acceptance test for the new dashboard, invoice-list badge and detail header, and FE-14/FE-70 require the supported mobile width to be exercised.
- Required correction: define the mobile viewport/device profile used by the test (in the spec or the referenced Playwright plan) and have cases 13–14 refer to that same named configuration.
- Owner: builder
- Verification: the named plan or spec resolves to a concrete Playwright viewport/device configuration, and cases 13–14 unambiguously use it.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### Self-check audit

Applicable areas: money rules and `MON-02`/`MON-04`/`MON-05`/`MON-06` for the v4.6 changes; frontend `FE-05`, `FE-14`, `FE-70`, `A11Y-01`, `A11Y-06` for the new in-app signal; tenancy/RLS and auth for workspace-scoped reads; events/jobs for the recurring signal's no-event/no-job rule; universal `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13`; and `PROJECT.md` §9 owner decisions/exceptions. These were checked against the spec, decision log and prior review. No revision 8 owner choice or business value was introduced.

| Rule / area | Applies? | Reviewer found | Evidence |
|---|---|---|---|
| `MON-02`, `MON-04`, `MON-05`, `MON-06` | Yes — core v4.6 scope | Owner-decided currency and rounding rules remain consistent with their decision-log entries; revision 8 changes only test setup/assertions | Spec money rules, data model, `docs/DECISIONS.md` |
| `FE-05`, `A11Y-01` | Yes — dashboard count is a link and badge is text | Keyboard, visible focus, reading order, Enter activation and non-focusable badge are specified | Verification (r) 13 |
| `FE-14`, `FE-70`, `A11Y-06` | Yes — responsive browser acceptance | No overflow and full labels/accessible scan are specified, but the mobile viewport is undefined (finding above) | Verification (r) 14; Phase 0 Playwright plan config |
| Tenancy/RLS | Yes — count and filtered list are workspace-scoped | Workspace isolation is explicit with real `crm_app` role and RLS | Verification (r) 12; Dashboard v1 |
| Events/jobs | Yes — signal must add none | Tests distinguish signal side effects from recurring-run and issue events | Money rules; Verification (r) 10 |
| `UNI-02`, `UNI-07`, `UNI-12`, `UNI-13` | Yes | No new product values or secrets; spec is in-repo; exact-head CI on merged PR #9 had passed per PR review record | Revision 8 diff; `.agent/reviews/PR-9.md` Round 1 |
| `PROJECT.md` §9 | Yes | Revision 8 adds no exception or owner decision; existing accepted risks remain documented | `docs/DECISIONS.md`; spec change history |

### Verification performed

| Check | Result |
|---|---|
| `git fetch origin`; compare requested spec with `origin/main` | Spec hash `de327c9ba836c0d3a01b793d81b8394c9c3fa47e` matches the spec on `origin/main` (`0e11cde`) |
| Re-read prior spec-review Round 1 and PR #9 Round 1 | The fixture-isolation and keyboard/responsive findings are addressed; the handoff's stale Git-state section has since been corrected |
| Re-read revision 8 history, recurring money rules, dashboard count, authorization, tenancy/RLS, event/job rules, Phase 5 acceptance criteria and Verification (o), (p), (q), (r) | No further inconsistency found; the previously reported (r) fixture contradictions are resolved |
| Inspect the referenced Playwright plan | Desktop Chrome is configured; no mobile viewport/device or viewport size is defined, confirming the finding |
| Code tests | Not run; this is a specification review |

### Residual risks and test gaps
- The final spec approval and `PROJECT.md` reconcile remain pending. The handoff correctly requires Charlie's approval in his own words before `setup`, then `build`.
- Existing owner-accepted limits remain: cumulative-rounding void gaps can accumulate by one base minor unit per void until a new row of that series; credit-note component amounts can differ from the official base total due to rounding.
- This review used GPT-6.1-sol rather than the project-mapped Opus 5.5 deep tier. Confirm in deep tier before build.

### Required before merge / v4.6 approval
- Define the mobile viewport/device profile used by Verification (r) 13–14.

### Deferred conditions
- None.

### Optional improvements
- None.

**Verdict:** Revision required

## Round 1 — 2026-10-07 · scope: spec review
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.6 draft revision 7 · hash (`git hash-object`) `583533732daa8ac9634374514bc664c9bc73dcaa` · current on `origin/main` at `3bc4604965c03dd6d5828ed1cc8260c1aa1d4794`

**Model used:** GPT-6.1-sol · **Switch model next step?** Yes — this review covers money behavior; the project maps that work to deep tier (Opus 5.5), and the review should be confirmed in that tier before build.

### Findings

### [P2] Recurring-run verification cases need explicit fixture isolation
- Category: ambiguity
- Rule: Verification (r)
- Evidence: `docs/superpowers/specs/2026-09-27-core-sales-design.md:1014` issues and sends T1/P1; line 1017 later requires the same T1/P1 to remain a draft and unsent; line 1019 refers to the P1 draft from case 1 showing the badge; line 1022 reuses T2 from case 5 after that case has issued and sent its invoice, then describes an `auto_send`-off draft.
- Failure scenario: a reader treats cases 1–12 as one sequence and finds cases 6, 8, and 11 impossible after cases 3 and 5; another reader resets fixtures between those cases and gets a different test setup.
- Why it matters: the recurring-run behaviors are financial and idempotency-sensitive; the Phase 5 acceptance tests need an unambiguous starting state for each assertion.
- Required correction: state which cases run with isolated/reset fixtures and which intentionally share state; update cross-references so no test expects an invoice both issued and still draft.
- Owner: builder
- Verification: re-read each case in (r) as a deterministic executable sequence and confirm the referenced invoice/template states are reachable.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### [P2] The new dashboard link lacks an explicit keyboard and responsive check
- Category: guardrail mismatch
- Rule: FE-05, FE-70, `FRONTEND_STANDARDS.md` §3.4
- Evidence: the new dashboard count is a link to a filtered invoice list (`docs/superpowers/specs/2026-09-27-core-sales-design.md:572`), and cases (r) 8–9 check badge text, role visibility and the link destination (`:1019-1020`). The general Playwright plan says mobile viewport coverage for client pages and mentions dashboard totals, but does not cover keyboard navigation or mobile widths for this dashboard link and its new badge surfaces (`:1038`).
- Failure scenario: the count or badge is rendered correctly by pointer but cannot be reached or activated by keyboard, or the link/badge causes overflow at a narrow app viewport, while the specified tests still pass.
- Why it matters: this adds interactive authenticated UI; the frontend rules require keyboard operation and browser tests at desktop and mobile widths.
- Required correction: extend the recurring signal verification to exercise the dashboard link with keyboard and visible focus, and check the dashboard, invoice list row and detail header at desktop and mobile widths (including no horizontal overflow).
- Owner: builder
- Verification: the Phase 5 Playwright cases assert keyboard activation/focus and responsive rendering at the named viewports.
- Disposition: before merge; resolve before v4.6 approval/build
- Status: open

### [P3] Handoff still reports PR #6 as open and awaiting Round 6
- Category: quality
- Rule: `agents/roles/reviewer.md` §2 (report handoff drift)
- Evidence: `.agent/handoff.md:11` says PR #6 is open and awaiting review 6 on revision 6; `.agent/handoff.md:16` says PR #6 merged at `3bc4604`. The repo's `origin/main` contains that merge and the spec is revision 7.
- Failure scenario: the next session follows the stale active target and repeats completed PR review work.
- Why it matters: the handoff contradicts repository state and obscures the next gate.
- Required correction: update the handoff to reflect PR #6 merged and this formal spec review's result.
- Owner: builder
- Status: open

### Verification performed
- Confirmed the requested file hashes to `583533732daa8ac9634374514bc664c9bc73dcaa`, matching `origin/main` and `agents/PROJECT.md`.
- Reviewed v4.6 change history, data model, money rules, recurring-run behavior, dashboard, authorization, tenancy and RLS requirements, events/jobs, Phase 5 acceptance criteria, and the relevant guardrail packs.
- Confirmed the owner choices in revisions 1–7 are recorded in `docs/DECISIONS.md`; the spec continues to mark v4.6 as a draft and v4.5 as the approved source of truth.
- No code tests were run; this is a specification review.

### Residual risks and test gaps
- Existing owner-accepted limits remain documented: post-void base-currency gaps can accumulate, and credit-note parts can differ from their official base total due to rounding.
- This review used GPT-6.1-sol rather than the project-mapped Opus 5.5 deep tier. Confirm the findings in that tier before build.

### Handoff block
- **Current objective:** Obtain formal review of v4.6 revision 7 at hash `583533732daa8ac9634374514bc664c9bc73dcaa`.
- **Completed checks:** Compared requested hash with `origin/main`; checked decisions and relevant money, auth, tenancy, UI and job requirements; identified two open P2s and one handoff P3.
- **Pending checks:** Resolve the recurring-run fixture ambiguity and add keyboard/responsive assertions; refresh the handoff; re-review the exact resulting spec hash.
- **Key decisions / assumptions:** Charlie's recorded v4.6 choices stand; v4.5 remains the approved source until v4.6 is approved.
- **Open risks:** Do not use the revised spec for build while this review is Revision required.
- **Next exact command:** `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` after edits.
- **Suggested model tier:** Deep (Opus 5.5), because this spec defines financial calculations and invoice lifecycle behavior.

**Verdict:** Revision required
