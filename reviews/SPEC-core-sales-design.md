# Review — spec `core-sales-design`

## Round 29 — 2026-11-27 · scope: v4.7 revision 10, bank audit and Admin payment details view

- **Spec:** `.agent/worktrees/build-docs-spec-bank-audit-qr-view/docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 10 (draft).
- **Spec hash:** `7bb8bc0736ce817801bcacf5d0efdeffa06eb116`. The supplied file and commit `721f90d` have the same blob. Rechecked at the end.
- **Approved comparison:** revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca` on main at `b0dbc52`.
- **Reviewer:** Bob · **Builder:** Andy.

### Findings

#### [P1] Record the Bank QR preview as a scoped FILE-04 alternative

- Category: guardrail mismatch.
- Rule: FILE-04, AUTH-03, TEN-11. The files pack requires a documented alternative and evidence when signed URLs are replaced.
- Evidence: Draft spec lines 860–861 retain the general signed-URL rule and add the session-checked Bank QR route with a one-hour browser cache. Draft `docs/DECISIONS.md:45,70–72` treats this as outside FILE-04. `agents/PROJECT.md:244` records the separate FILE-03 key exception. The existing preview route serves an attachment through the app and sets `Cache-Control: private, max-age=3600` without a session-specific cache key (`apps/web/src/app/(app)/files/payment-qr/route.ts:30–38`). The 2026-11-11 storage decision and `docs/runbooks/phase-2-storage.md:78–83` document the current delivery mechanism.
- Failure scenario: The widened route’s origin correctly refuses a viewer whose role or 2FA state no longer qualifies. A private browser cache can still reuse a fresh response without contacting the origin. The directive scopes caching to a private cache, which can persist across app sessions in the same browser profile. Draft spec line 97 gives a categorical statement about refusing the QR while lines 96 and 861 allow cached reuse. [RFC 9111 §§4–4.2](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.2), [RFC 9111 §5.2.2.7](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.7)
- Why it matters: The ten-minute limit measures signed-link validity. The one-hour window measures freshness of an authenticated image response. The Bank preview uses a different delivery mechanism, so the draft must state where each rule applies. The owner’s recorded answer supports retaining a one-hour private QR cache and reviewing the Admin audience at Phase 4.
- Required correction: State the Bank preview alternative explicitly in the spec and decisions. Preserve ten-minute expiry for signed downloads. Document authenticated same-origin delivery with the active session workspace, current key, role and 2FA checks at the origin, attachment and nosniff headers, and the scope of the accepted private cache. Clarify how reuse in the same browser profile is handled when authorization changes, and describe one hour as freshness rather than guaranteed deletion. Record the compensating controls and Phase 4 review in the decision, and list the alternative and test evidence for `setup` to reconcile under PROJECT §9. The implementation check should separately verify the origin’s allow/refuse cases and the cache policy.
- Owner: builder, with the owner deciding any cache behavior beyond the recorded acceptance.
- Verification: Read the amended file rules, access matrix and decision together. Confirm the code follow-up verifies the authorized origin response, refused principals with workspace 2FA off, tenant and current-key checks, and the documented cache and response headers.
- Status: open.

#### [P2] Correct the claim that the audit already stores digits only

- Category: defect in the implementation handoff.
- Rule: owner decision Q26, revised Authorization (`docs/superpowers/specs/2026-09-27-core-sales-design.md:813`), UNI-09 and UNI-10.
- Evidence: Draft spec line 96 says the current audit already stores the last four only, and draft `docs/DECISIONS.md:65` says the code needs no change. `apps/web/src/app/(app)/settings/payment/actions.ts:73–88` accepts the bank account number through `requiredText`. `apps/web/src/db/settings/workspace-settings.ts:27–32` stores `value.slice(-4)`, which takes four characters. The fixture that currently tests the mask ends in digits (`settings/payment/actions.test.ts:151–170`).
- Failure scenario: A supported account-number value with a non-digit in its last four characters can place that character in the audit’s masked value. The supplied decisions say digits only and carry the bank-input change separately.
- Why it matters: The last-four rule is correct as drafted. The follow-up list would leave the mismatch in an append-only audit trail if it is used as written.
- Required correction: Record the currently shipped behavior accurately in item 11 and the decision. Carry the digits-only audit requirement into the reviewed code work, including masking older accepted input when it appears on the before side of a new entry. If a format decision is needed, keep it separate from Q26. Keep historical audit rows append-only.
- Owner: builder.
- Verification: Review the corrected handoff. The implementation review should require fixture coverage for valid current numbers and previously accepted values containing separators or non-digits, with only the approved digit fragment and no hash in new entries.
- Disposition: before merge.
- Status: open.

### Applicability and spec checks

| Rule or scope | Review result |
|---|---|
| AUTH-02, AUTH-03, AUTH-07, AUTH-09 and TEN-11 | Spec separates role, 2FA enrollment and fresh step-up. The recorded Owner restriction covers the direct QR route. The draft leaves Owner access to bank text without 2FA outside this change. Admin viewing stays read-only. Owner mutations, Staff permissions and issued-invoice audiences are preserved. The origin/cache distinction needs the P1 correction. |
| FILE-01 to FILE-04 | Upload restrictions and FILE-03 retention remain as approved. The current preview and signed downloads need distinct FILE-04 rules. |
| UNI-09, UNI-10 | The specification adopts digits only and no hash. The handoff needs to cover the current character-based mask. |
| FE-32, FE-70 | The view uses the existing Bank page with a menu link. The draft decision names view-only UI and an E2E test. No UI implementation is in this review. |
| REC-01 and Phase 4 | The issued invoice retains its frozen bank details and snapshot key. Phase 4 review of the QR audience remains documented. |

### Verification performed

- Compared the exact rev 10 file and companion decisions against rev 9. The tracked diff contains only the spec and decisions. `git diff --check b0dbc52...721f90d` passed.
- Cross-checked the draft’s owner-answer record against the companion decision, Q26 and the Phase 2 close. Confirmed the revision 9 approval labels, the audit policy and the read/write split. The builder’s session itself was not available.
- Read the route, page, audit mask, input validation and cited tests to verify statements about shipped behavior. Checked HTTP cache semantics against RFC 9111.
- Rechecked the candidate spec and companion decision hashes and the clean builder worktree. Spec review only. Browser caching and changed application behavior were not exercised.

### Required before merge

- Close both findings and send the updated spec hash for re-review.

### Deferred conditions

- None. The draft’s existing Phase 4 check stays at that gate.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for the scoped text corrections. The project's deep tier applies to the security re-review.

**Verdict:** Revision required

## Round 28 — 2026-11-15 · scope: slice — v4.7 revision 9, MY default date format
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 9 (draft) · hash (`git hash-object`) `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`.
- **Selected source:** `.agent/worktrees/build-docs-spec-my-date-format/docs/superpowers/specs/2026-09-27-core-sales-design.md`, branch `docs/spec-my-date-format`, local commit `e22bc6bd7c5db11cefd9eb55b014eb771b956227`. No path was supplied; this is the newest revision of the sole spec in the configured folder, identified in handoff §5. Root main still contains revision 8; this approval does not apply to that older copy.
- **Baseline:** Round 27's approved revision 8 blob `733cc0e9ce4af0771bdd2769720e3f228caf8855`. Effective change: one spec file, +10/-6 lines. Reviewed immutable commit/blob text and confirmed the selected working file exactly matches it, with a clean tracked worktree, at completion.
- **Mode:** spec review only. No PR is open for this draft according to the handoff; no PR review, CI pass, runtime pass, owner approval, merge permission or setup reconciliation is implied.

### Findings

No blocking findings in revision 9. The requirement and provenance are consistent:
- Spec `:86-88` and Onboarding `:734` change MY's default from `dd/mm/yyyy` to `dd-mmm-yyyy`; `mmm` explicitly means an English three-letter month regardless of locale, with `08-Nov-2026` as an unambiguous example.
- The date format remains editable; existing workspaces retain their stored values. This agrees with DECISIONS 2026-11-08 and 2026-11-09 (`docs/DECISIONS.md:63-80`) and PR #59 review Round 1's recorded direct owner confirmation, retained below Round 2 in `.agent/reviews/PR-59.md`.
- Revision 8 approval labels at `:1`, `:3`, `:11`, `:61`, `:1186` now agree with Round 27 and DECISIONS 2026-10-22 (`docs/DECISIONS.md:472-480`). Revision 9 remains explicitly unapproved pending the owner and subsequent workflow steps.
- An exact comparison with the approved blob confirms no changes to money, security, auth, tenancy, tax rates, numbering, professional gates, or other business requirements. The Phase 2 done-when at `:1142` still requires country defaults on sign-up, and the existing plan Task 8 tests (`:173`) name the date value.

#### [P3] Handoff fixed sections retain the merged PR as the active target
- Category: documentation inconsistency.
- Rule: reviewer §2 (report handoff drift; git wins for code state).
- Evidence: `.agent/handoff.md:9-10` retains active PR 65 and its removed worktree, §2 says PR 65 is in progress, and §3 retains main `107163b`; `git worktree list` shows root main `c5e4649` and the spec worktree at `e22bc6b`. Handoff §1 records PR 65 merged and its worktree removed; §5 correctly identifies revision 9, its branch, commit and hash.
- Failure scenario: a new builder uses the fixed active-target fields and resumes a removed checkout or an already merged PR.
- Why it matters: resume ambiguity, isolated from this exact-hash spec assessment; §5 provides enough evidence to identify the intended revision.
- Required correction: Andy should refresh the active-target, milestone and git-state fields to this spec revision, retaining merged PR information as history.
- Owner: builder (Andy).
- Verification: compare the fixed sections with git state and the spec hash before the next builder command resumes work.
- Status: open; nonblocking documentation maintenance.

### Self-check audit

Independent applicability for this incremental spec slice: reviewer §4 consistency, concrete/testable values, approved owner provenance, scope, milestone preservation and ambiguity; UNI-02 (configuration/provenance), UNI-07 (hard, added text), UNI-12 (review output location), and PROJECT.md §2/§11 spec hash/approval/reconcile rules. No PR self-check table is required to conduct this standalone spec review; one is assessed in the later PR review. No table absence is treated as an implementation failure here.

| Rule / review criterion | Applies? | Builder statement | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| Spec consistency / provenance | yes | records Charlie's existing decision | pass | spec :86; DECISIONS 2026-11-08/09; PR-59 review confirmation | no |
| Concrete values / ambiguity | yes | `dd-mmm-yyyy`, English month, example | pass | spec :87, :734; old value is historical, new default is explicit | no |
| Scope / milestones | yes | only MY default and approval labels | pass | exact blob diff; unchanged Phase 2 done-when and plan test expectations | no |
| UNI-02 | yes, country default is configured rather than an invented value | existing country-defaults module | pass at specification level | recorded decision; `packages/core/src/settings/country-defaults.ts` contains the date format and allowed-format examples | no |
| UNI-07 (hard) | yes, added spec content | no secrets introduced | pass for added content | project secret-pattern scan of added lines: zero hits | no |
| UNI-12 / reviewer Rule 0 | yes | n-a to builder's spec claims | reviewer writes only this local review file | output path resolved and symlinks rejected; no source/hand-off edits | no |
| PROJECT.md §2 and §11 / START spec gates | yes | revision 9 draft, exact-hash review and owner approval then reconciliation | conforming; reconciliation remains pending | spec :3, :86, :1186; current project hash remains revision 8 as expected | no |
| UNI-13 | later PR delivery gate | no CI claim for local-only draft | not assessed as a runtime/PR approval | no PR review requested and no CI required to establish this textual decision's consistency | no |
| UNI-01/03-06/08-11/14-19 | no changed implementation, dependency, boundary, logging, deployment, migration or platform behavior | unchanged | n-a to this delta | exact one-file diff | no |
| Frontend pack and FRONTEND_STANDARDS | no changed component, page structure, styling or interaction; readable example/provenance checked | default only | browser/a11y implementation checks are outside this slice | existing settings UI unchanged; no runtime pass inferred | no |
| Tenancy, money, finalized records, auth, public links, files, jobs, payments packs | no changed domain/security requirements | unchanged | n-a to this delta; prior approved baseline is retained | exact blob comparison | no |

### Verification performed

| Check | Result |
|---|---|
| Identify selected revision | Sole configured spec; active worktree contains revision 9; root still revision 8 |
| Exact pin | Working-file hash `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`, equals the spec in commit `e22bc6bd7c5db11cefd9eb55b014eb771b956227` |
| Prior review | Round 27 approved baseline hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`; this round preserves all earlier review text |
| Full effective change comparison | Changed lines inspected, long status/gate paragraphs compared sentence by sentence; all other spec lines identical to baseline |
| Decision and plan cross-check | DECISIONS 2026-11-08/09 and 2026-10-22; PR #59 reviewer record; Phase 2 plan Q10 and Task 8 expectations agree |
| Existing implementation/test evidence read | Country defaults and allowed formats; test assertions in country-defaults.test.ts, apply-country-defaults.test.ts and onboarding.spec.ts; no tests executed or pass claimed |
| `git diff --check <old-blob> <new-blob>` | PASS, exit 0 |
| Added-line project secret-pattern scan | Zero hits |
| Final spec hash / worktree state | Unchanged hash; pinned branch HEAD unchanged; no tracked changes |
| Local source edits / installs / tests / network mutations | None performed for this spec review |

### Residual risks and test gaps
- Incremental approval of revision 9 against Round 27, not a fresh full-product or production-security certification. Existing professional and later-phase design gates remain in force.
- SG's additional defaults and the MY/SG locale values remain recorded in Q10 and DECISIONS; this revision deliberately resolves only the MY value that contradicted the old spec. No SG or locale policy is invented or reversed by omission here.
- Existing test source corroborates the intended defaults, but tests and browser behavior were not rerun for this Markdown-only change. End-to-end date rendering is not established by this review.
- The draft is local-only and has no PR CI evidence in this round. The later PR review must cover its final head and applicable CI gates.
- The revision 8 labels are corrected without altering the previously reviewed blob. To preserve this revision 9 hash, record the owner's revision 9 approval in DECISIONS/PR metadata rather than editing the spec's draft labels solely to acknowledge this review.

### Required before merge
- No spec corrections required by this round.
- Charlie's explicit approval of revision 9, followed by the ordinary PR review and approval-receipt steps. The spec-hash reconciliation through `setup` remains required before `build`, following the established approved/merged-spec sequence.

### Deferred conditions
- None. The handoff P3 is nonblocking maintenance, not a P2 condition.

### Optional improvements
- Refresh the handoff fixed fields as described above; no spec hash change is needed.

**Model used:** GPT-6 (Codex). **Switch model next step?** No — this narrow exact-hash spec review is complete; preserve the hash through owner approval and run `setup` for reconciliation in the established sequence.

**Verdict:** Approved

## Round 27 — 2026-10-22 · scope: v4.7 revision 8, Round 26 fixes (PR #36)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash (`git hash-object`) `733cc0e9ce4af0771bdd2769720e3f228caf8855`.
- **Pin:** PR #36 base and merge base `999b9c4397fd76aaaa97297e8e0a71975f2ad735`, head `4714f04ef55316d864707a9cc621065febf7654c` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-36-4714f04e` (`git worktree add --detach` worked this time); its spec blob hash matches. Round 26 reviewed hash `846b772e493464672f103c99bf8a4c39a9627085`. Fix diff `40f2777..4714f04`: three docs files, +33/−31. Main→head: three files, +106/−65 (matches the PR body's Size).

**Verdict:** Approved  
**Model used:** Opus 5.5 (deep tier, as Rounds 25–26 asked) · **Switch model next step?** No — `review 36` of the final head should also run on Opus 5.5.

This verdict applies only to spec hash `733cc0e9…`. It is not Charlie's approval of revision 8 and does not approve PR #36's final head; `review 36` does that.

### Round 26 disposition rechecked

| Round 26 finding | Result | Evidence |
|---|---|---|
| P1: regeneration can race an old recovery-code sign-in | Resolved at requirement and test level. Binding outcome in both commit orders, "a sign-in authorized from the pre-regeneration code set never inserts a usable session after the regeneration commits", audit rows and consumption must match the winner. T5 (c4) forces both orders with a pause after code check and before session insert, asserts the wait where the design serialises, and runs an unprotected control that must reproduce the defect. T5 (c4) is in the exit criteria. Candidate mechanism classes are listed but not chosen (scope choice B). F=A is unchanged. | Spec `:73`, `:515`, `:775`, `:862`, `:1137`; plan R5 `:737`, T5 (c4) `:759`, exit criteria `:780`, 31.E `:879`. |
| P1: UNI-15 and UNI-16 missing from the self-check | Resolved. Both rows are in the PR self-check and in PR 4's self-check list (`plan:798`). UNI-16 deliverables: a runbook section "Upgrading a Phase 0 database to Phase 1: every user is signed out once" with user effect, operator steps and an after-check, copied into the PR 4 body, both landing in PR 4 (`plan:789`). Ruling on UNI-15 below. | PR #36 body Self-check; plan `:789`, `:798`, `:1606`. |
| P2: plan still called F/G proposals; wrong open-point reference | Resolved for the cited places: `:729` now names open point D for event names and says F is decided; R15, 31.D G, Risk 18 and the spec say "decided by Charlie on 2026-10-22" and "owner-rejected alternative". One leftover dead clause in T15; P3 below. | Plan `:729`, `:747`, `:813`, `:1578`. |
| P2: R13 "no personal data in a row" | Resolved. Exact column allow-list (`id`, `user_id`, `event`, `detail`, `ip`, `created_at`), exact `detail` key allow-list, a stated rule for adding a key through the spike round, a prohibited list, and IP kept out of logs. T13 asserts a catalog column list, a row-content scan and log capture. Spec, plan and the Phase 4 professional gate use the same list. | Spec `:515`, `:862`, `:1137`, `:1178`; plan R13 `:745`, T13 `:767`, open point E `:811`. |
| P2: stale PR body | Resolved. The head, hash, Size, owner-decision provenance and AUTH-07/UNI-15/UNI-16 rows match the exact diff. | PR #36 body. |

### Reviewer rulings

- **UNI-15 (the R15 cutover): conforming. No owner exception is needed.** UNI-15 protects running code from a schema change it cannot handle ("never a destructive change in the same release as the code that stops using the old shape"). The cutover deletes rows of short-lived credentials and changes no table, column, type, constraint or grant. Phase 0 code and Phase 1 code both work against the result, and a rollback restores nothing (users sign in again). It is a documented security cutover under UNI-16. The same reading covers the candidate trusted-device `verification` row delete (Risk 15), as long as it also changes no shape.
- **UNI-16: conforming at plan level.** Implementation is pending in PR 4 and is checked in that PR's review.
- **Open point B (R1–R15 completeness): complete at spec level** for this hash. The PR 4 spike can still surface a requirement under the existing stop rule.

### Findings

#### [P3] T15 keeps a pass condition for an alternative the owner rejected
- Evidence: plan `:769` (T15) says "no `session` row remains (or, if Bob rules the alternative, every remaining row has its audit row)". G is decided as option A; option B is owner-rejected (`:813`). The clause is dead, but it leaves a second pass condition in a binding test of a security cutover. The same text is already on `main`.
- Required correction: delete the parenthesis so T15 asserts only "no `session` row remains". Plan only; the spec hash does not change. Owner: builder. Fix before `review 36`. Status: open.

#### [P3] A decisions-log sentence is written to bind later reviews
- Evidence: `docs/DECISIONS.md:13` adds "These decisions are final and are not reopened by later review rounds." It is not a reviewer instruction to approve or skip a gate, and it had no effect on this round. But reviewer role §3 says security, data isolation, money, privacy and legal exposure are flagged "even inside an approved decision". As written, the sentence claims to limit that.
- Required correction: reword it to "Owner decisions; changing them needs a new owner decision." Plan/decisions only; the spec hash does not change. Owner: builder. Fix before `review 36`. Status: open.

No P0, P1 or P2 finding.

### Self-check audit

Independent applicable list before reading the PR body: UNI-07/09/10/12/13/15/16; TEN-02/03/06/07/08/09/10; AUTH-06/07/12; the project's own-login `crm_purge` and no-RLS system-table rules. The PR self-check now covers every one. Its rows mark implementation evidence pending, with no runtime pass claimed from prose. Besides the `DECISIONS.md:13` sentence above, no text in the PR, spec, plan or decisions log addresses an AI agent.

### Verification performed

| Check | Result |
|---|---|
| Exact-head pin | Host PR #36 base `999b9c4…`, head `4714f04…`; merge base matches; host head re-read at the end, unchanged. |
| Spec hash | `git hash-object` in the review checkout = `733cc0e9ce4af0771bdd2769720e3f228caf8855`, matching the PR body and handoff. |
| Effective diff and hygiene | `git diff --check origin/main...4714f04` clean. Three docs files only. |
| Label sweep (plan) | Searched for "builder proposal", "rejected for now", "Bob rules", "open point B)". The remaining hits are unrelated items (31.E candidates, other spike rulings) except T15 `:769` (P3). |
| Review checkout | `git status --untracked-files=no` clean at the end. |
| CI on exact head | Dependency audit, secret scan, typecheck/lint/test pass; Image/Trivy/E2E pending when checked. No local tests were run for this docs review. |

### Residual risks and test gaps

- T5 (c4)'s pause comes after the code check (and consumption, where the design does it there). The window between reading the code set and writing the consumption relies on the stock compare-and-set the plan cites (`verify-backup-code` line 216, `incrementOne`, plan `:842`). I did not verify that Better Auth 1.7.6 fact. PR 4's code review must confirm the chosen mechanism keeps it, or T5 (c4) adds a pause in that window.
- Candidate 3 of open point A ("restartable enrolment", `plan:804`) asks Bob to rule whether it weakens 2FA. I rule on it only if the spike chooses it; it must never apply to a completed enrolment.
- The auth-audit retention period stays the professional gate before Phase 4 goes live.
- **To avoid another hash loop:** record Charlie's approval of revision 8 in `docs/DECISIONS.md` and the PR body, not in the spec. Mark revision 8 "approved and merged" in the spec in the next spec PR, as was done for revision 7.

### Handoff block

- Current objective: PR #36 final-head review after the two P3 fixes.
- Completed checks: Round 26 disposition, UNI-15/16 rulings, R13/T13 consistency, F/G labels, PR body, diff hygiene, pin and head recheck.
- Pending checks: the P3 fixes; Charlie's approval of revision 8; `review 36` on the final head with Image/Trivy/E2E green; then `approved 36` before merge.
- Key decisions / assumptions: F=A, G=A and scope choice B are binding owner decisions. UNI-15 conforms for the R15 row delete.
- Open risks: the code-read-to-consumption window (residual above); mechanism not yet chosen (PR 4 spike).
- Next exact files: plan `:769` (T15), `docs/DECISIONS.md:13`, PR #36 body.
- Suggested model tier for next step: deep (Opus 5.5) for `review 36`, because it gates an auth contract.

## Round 26 — 2026-10-22 · scope: v4.7 revision 8, Round 25 fixes and owner decisions F/G (PR #36)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash (`git hash-object`) `846b772e493464672f103c99bf8a4c39a9627085`.
- **Pin:** PR #36 base and merge base `999b9c4397fd76aaaa97297e8e0a71975f2ad735`, head `40f27772567b06efa48e377468d4b935bee66d7a`; host head re-read at the end and unchanged. Exact-head archive snapshot `.agent/worktrees/review-spec-rev8-40f2777` (the sandbox denied `git fetch` and `git worktree add` writes under `.git`; the exact commit was already local).

**Verdict:** Revision required  
**Model used:** GPT-5 (below this project's named deep tier, Opus 5.5) · **Switch model next step?** Yes — use Opus 5.5 for the next exact-hash auth/security review.

### Round 25 disposition

| Round 25 finding | Result |
|---|---|
| P1: regeneration kept the changer's old session | Resolved at the stated requirement level. Spec `:73`, `:515`, `:775`, `:862`, `:1137` and plan R5/T5 `:737`, `:759` now end every pre-change session, issue a fresh audited session, and make regeneration all-or-nothing. A new concurrency gap is below. |
| P1: TEN-09 and AUTH-06 absent from self-check | Resolved. Both have explicit spec/plan evidence and identify implementation work still unproved. |
| P2: open point A contradicted scope choice B | Resolved. The no-lockout outcome binds; PR 4 chooses a conforming mechanism; only a weaker outcome returns to Charlie. |
| P2: stale purge connection choice | Resolved in the spec. Item 8(b1), Open question 8, the home rule and Phase 1 done-when all require the own login. |
| P2: no pre-live auth-audit retention gate | Resolved. Spec `:1178` makes the first retention/erasure decision a before-Phase-4-live launch gate and invents no retention period. |
| P3: reviewer-directed wording | Resolved in the spec and plan status line. |

Charlie's F=A and G=A decisions are recorded in spec `:75`, `:79–80`, the home rules and `docs/DECISIONS.md`. **Ruling:** F=A is a conforming reading of AUTH-07: consuming a recovery code is a login event, while configuring/regenerating the codes is the 2FA change. G=A is a valid product policy: the cutover invalidates the old sessions and invents no history; the delivery treatment under UNI-15/16 still needs the missing self-check below.

### Findings

#### [P1] Regeneration can race an old recovery-code sign-in past the revocation
- Category: material security risk / incomplete requirement. Rule: AUTH-07; spec's old-code refusal and session-revocation outcome.
- Evidence: plan R5/T5 (`:737`, `:759`) tests regeneration, failures and interruption, and proves an old code is refused after regeneration. R6/T6 and R7/T7 (`:738–739`, `:760–761`) orchestrate concurrent sign-in only for enable/disable state changes. Neither the spec's Phase 1 done-when (`:1137`) nor T1–T15 forces regeneration against a recovery-code sign-in.
- Failure scenario: device B validates or consumes an old recovery code and pauses before storing its session; device A regenerates codes, revokes every session that exists and commits; B then stores a new session after the revocation. An old code has effectively authorized a usable session after the regeneration, and that session never existed when A performed the required revocation.
- Why it matters: Charlie's F=A choice says a completed recovery-code login does not end other devices. It does not say an old code may finish authenticating across a regeneration. Without a serialisation outcome, regeneration cannot reliably invalidate leaked recovery codes.
- Required correction: add a binding outcome and forced two-order test for recovery-code sign-in versus regeneration. If the sign-in commits first, regeneration revokes its session; if regeneration commits first, the old code cannot create a session; a sign-in authorized from the pre-regeneration code set may never insert a usable session after regeneration. Audit rows and code consumption must match the winning order. Put this in R5/R6 (or a new requirement), T5/T6 and the spec Phase 1 done-when. This does not change F=A.
- Owner: builder. Verification: a controlled pause after old-code validation/consumption and before session insert, run in both commit orders, proves the stated outcomes and reproduces the unsafe result on an unprotected control.
- Status: open.

#### [P1] The final G decision makes UNI-15 and UNI-16 applicable, but the PR self-check omits both
- Category: guardrail mismatch. Rules: reviewer §3, UNI-15, UNI-16.
- Evidence: R15 (`plan:747`) now requires a migration to lock `session` and delete every Phase 0 session; the runbook/upgrade notice is required at `plan:788`. Charlie has now decided G=A. PR #36's current self-check contains neither UNI-15 nor UNI-16.
- Failure scenario: the final security cutover is treated as settled without assessing the project's expand/migrate/contract rule or the same-PR runbook requirement.
- Required correction: add both rows. For UNI-15, state and support whether this intentional session invalidation is conforming because it changes no database shape and is a documented security cutover; if that interpretation is not supportable, redesign the cutover or record the required owner exception. For UNI-16, cite the exact PR 4 runbook and upgrade-notice deliverables and mark implementation pending. Do not call either implemented from this docs PR.
- Owner: builder; owner only if an exception is proposed. Verification: independent applicability list matches the revised table and the cited PR 4 deliverables remain in the binding plan.
- Status: open.

#### [P2 · before merge] The binding plan still calls decided F/G policies proposals
- Category: consistency.
- Evidence: the binding definition at plan `:729` calls F “a builder proposal” and sends it to Charlie; R15 at `:747` calls G a “builder proposal; open point G” and its alternative “rejected for now”. The same plan correctly records both as decided at `:799`, `:811–812`, and the spec at `:75`, `:79–80`. Plan `:729` also says the event names are open point B, while their gate is open point D (`:809`).
- Failure scenario: an implementer following 31.A treats a settled owner policy as reopenable or sends event vocabulary through the wrong gate.
- Required correction: make `:729` and R15 state the 2026-10-22 decisions, change “rejected for now” to the owner-rejected alternative, and correct the event-name reference to D.
- Owner: builder. Verification: a sweep for `builder proposal`, `open point F/G`, `rejected for now` and the wrong B reference leaves no contradictory live label.
- Disposition: before merge. Status: open.

#### [P2 · before merge] R13 says an audit row contains no personal data although the schema deliberately stores it
- Category: privacy-control ambiguity. Rule: UNI-09 / revision 8 privacy gate.
- Evidence: `auth_audit_log` intentionally stores `user_id` and raw client `ip` (spec `:515`, `:862`, `:1178`; plan open point E `:810`). Binding R13 says “No personal data or secret in a row” (`plan:745`), while T13 merely says it scans every row and separately excludes IP from captured logs (`:767`).
- Failure scenario: one builder removes or hashes the required IP to satisfy R13; another treats any additional personal field as allowed because the row already contains personal data. Both can claim the text supports them.
- Required correction: state an exact row allow-list: `user_id`, client `ip`, event/time and the fixed-label/ID detail allowed by the schema; prohibit every other personal datum and every secret. Keep IP out of application/error logs. Make T13 assert the allow-list rather than the impossible “no personal data in a row” formulation.
- Owner: builder. Verification: schema, R13, T13, the spec privacy wording and the professional retention gate use the same allow-list.
- Disposition: before merge. Status: open.

#### [P2 · before merge] PR #36's body is stale after the two fix commits
- Category: review-evidence accuracy.
- Evidence: the top E12 summary still says the three changes end only the user's “other sessions”; the AUTH-07 self-check says F is pending; Owner decision provenance says F and G remain proposals; Size says two files and +54/−23, while the exact head changes three files and +95/−56 from main. The appended reply records the newer policy, so the body contradicts itself.
- Failure scenario: a final-head reviewer or owner relies on the earlier self-check and reviews a different policy/scope from the exact diff.
- Required correction: refresh the main summary, owner-decision row, file/line counts and self-check in place; remove superseded pending labels. Keep the Round 25 response as history if useful, but make the current-state sections authoritative and internally consistent.
- Owner: builder. Verification: compare the body with `git diff --stat origin/main...40f2777`, the exact spec hash and decisions F/G.
- Disposition: before merge. Status: open.

### Self-check audit

Independent applicable list before comparing the PR body: UNI-07/09/10/12/13/15/16; TEN-02/03/06/07/08/09/10; AUTH-06/07/12; project rules for own-login `crm_purge`, no-RLS system tables and the spec-change gate. The body covers the Round 25 additions TEN-09 and AUTH-06 and correctly leaves implementation evidence pending. UNI-15/16 are absent (P1); the AUTH-07 and owner-provenance rows retain superseded F/G text (P2). The spec remains a draft and does not claim implementation is complete.

### Reviewer rulings on open points B–E

- **B (R1–R15 completeness): not yet complete** because the regeneration/sign-in race and R13 ambiguity above are missing from the binding contract. Recheck on the corrected exact hash; the spike may still surface a requirement that needs a later spec revision under the existing stop rule.
- **C (password-step residual): correctly assigned to the PR 4 spike.** Acceptance requires real evidence that the token reaches no response or enabled endpoint, the row is audited with a non-login reason and the runbook records it. No policy choice is needed now.
- **D (event names): correctly assigned to the PR 4 spike.** The spec fixes categories; the spike fixes and records the closed vocabulary.
- **E (retention/erasure): correctly assigned to the before-Phase-4 professional gate.** The launch control is concrete; no legal period is invented. The implementation mechanism remains a later reviewed change.

### Verification performed

| Check | Result |
|---|---|
| Exact-head pin | Host PR #36 base `999b9c4…`, head `40f27772567b06efa48e377468d4b935bee66d7a`; host head re-read unchanged. Local merge base matches host base. |
| Spec hash | `git hash-object` in the exact-head snapshot = `846b772e493464672f103c99bf8a4c39a9627085`, matching the PR body/handoff. |
| Snapshot integrity | 142 Git-tree, archive and snapshot files; 0 missing/extra/changed; fingerprint before and after `7e07f03409a3a199f451d7e2f7297a2f68bed61d304fcc1ac655eddc5b765517`. |
| Effective diff and hygiene | Main→head: three docs files, +95/−56. Round 25 fix diff: three files, +56/−48. `git diff --check` clean. |
| CI on exact head | Dependency audit, Secret scan, Typecheck/lint/test, and Image/Trivy/E2E all pass. No local test suite was run for this docs review. |

### Residual risks and test gaps

- The PR 4 spike remains responsible for proving the mechanism against Better Auth 1.7.6 and every R/T outcome. This review approves no candidate trigger or hook design.
- The professional must still decide the auth-audit retention period and erasure treatment before Phase 4 has live users; this is an intentional later gate, not a defect in this revision.

### Required before merge

1. Close the old-code sign-in versus regeneration race in the binding requirements and tests.
2. Add UNI-15/16 to the PR self-check and settle the cutover's guardrail disposition.
3. Remove stale F/G proposal labels, correct R13/T13's personal-data allow-list, and refresh the PR body.
4. Repeat `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` on the new exact hash. After spec approval and Charlie's approval, run `review 36` on the final PR head.

### Handoff block

- Current objective: approve v4.7 revision 8 at PR #36's exact spec hash.
- Completed checks: Round 25 fix disposition, F/G provenance, requirements/tests, guardrail applicability, decisions/spec/plan consistency, CI, diff hygiene, exact-head integrity and host recheck.
- Pending checks: the five corrections above, a new exact-hash spec round, Charlie's approval, then the final-head PR round.
- Key decisions / assumptions: F=A is conforming under AUTH-07; G=A is the intended cutover policy; A remains a PR 4 mechanism choice under a binding no-lockout outcome; C/D are spike gates; E is the pre-Phase-4 professional gate.
- Open risks: old recovery-code race, UNI-15 disposition, and the contradictory privacy allow-list wording.
- Next exact files: spec `:73`, `:515`, `:862`, `:1137`; plan Task 31 `:729`, R5–R7 `:737–739`, R13/R15 `:745–747`, T5–T7/T13 `:759–767`, open points `:799–812`; PR #36 self-check/body.
- Suggested model tier for next step: deep (project mapping: Opus 5.5), because the remaining correction is auth concurrency and migration security policy.

## Round 25 — 2026-10-22 · scope: v4.7 revision 8, Phase 1 plan alignment (PR #36)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash (`git hash-object`) `132747c701604754aafad92fe03e1f8cc1bd6625`.
- **Pin:** PR #36, base and merge base `999b9c4397fd76aaaa97297e8e0a71975f2ad735`, head `3ec71a4c7f020096b73847dd499ec08661c9e338`; host head re-read at the end and unchanged. Exact-head archive snapshot `.agent/worktrees/review-spec-rev8-3ec71a4c` (the sandbox denied `git worktree add` under `.git/worktrees`).

**Verdict:** Revision required  
**Model used:** GPT-6 (below this project's named deep tier, Opus 5.5) · **Switch model next step?** Yes — have the security and auth corrections checked in Opus 5.5 before a new exact-hash review.

### Findings

#### [P1] Recovery-code regeneration keeps a session that the approved rule revokes
- Category: spec/guardrail mismatch. Rule: AUTH-07.
- Evidence: the approved Authentication and sessions rule still says “All sessions revoked on password, 2FA or email change” (spec `:770`; `agents/guardrails/auth.md:18`). Revision 8 says regeneration of recovery codes ends only “other sessions” (spec `:73`, `:510`, `:857`, `:1132`). The binding Phase 1 plan explicitly keeps the changer's **existing** session after regeneration (Task 31 R5 `:737`, T5 `:759`).
- Failure scenario: a session issued before recovery codes were replaced remains valid after that 2FA credential change.
- Why it matters: two different session policies can be built and tested as compliant; the narrower one conflicts with the approved rule. The spec itself acknowledges this conflict as open point B (`:79`) but states the narrower rule in its normative sections.
- Required correction: make the active spec, Task 31 R5/T5 and its tests one policy. To retain AUTH-07, end **every pre-change session** on regeneration; if the changer should remain signed in, issue a fresh audited session after the change, without a failure or lockout window. A weaker policy needs an explicit owner decision and reviewed rule change.
- Owner: builder for the aligned text; owner if choosing the weaker policy. Verification: a regeneration test with changer and second device proves neither pre-change session works; any replacement session has its own audit row, and failure leaves old codes and sessions usable.
- Status: open.

#### [P1] Applicable guardrails are absent from the PR self-check
- Category: guardrail mismatch. Rule: reviewer §3; TEN-09 (hard), AUTH-06.
- Evidence: PR #36 body, “Self-check”, covers TEN-02/03/06/07/08/10 and AUTH-07/12, but omits TEN-09 while revision 8 gives `crm_purge` its own connection and requires transaction-local `withWorkspace()` (spec `:868`), and omits AUTH-06 while E6 corrects the Better Auth limiter fallback (spec `:70`, `:740`). The independent applicable list also included UNI-07/09/10/12/13, TEN-02/03/06/07/08/10 and AUTH-07/12; the existing rows cover these at spec level. This is a self-check completeness finding, not evidence that the named controls fail at runtime.
- Failure scenario: the builder's gate does not explicitly assess the tenant context of the newly settled purge connection or the limiter affected by E6.
- Required correction: add TEN-09 and AUTH-06 rows with exact spec and plan evidence, state what remains to be proved in implementation, and do not mark implementation tests as passing from prose alone.
- Owner: builder. Verification: compare the revised table with the independent applicable list and recheck the cited clauses.
- Status: open.

#### [P2 · before merge] Open point A makes the PR 4 mechanism an owner decision again
- Category: consistency. Rule: Charlie's 2026-10-21 scope choice B.
- Evidence: revision 8 says E12 states requirements, not mechanism, and PR 4's reviewed spike chooses the mechanism (spec `:65`, decisions log `:14–21`, plan Task 31.C `:719–723`). The same revision labels the recovery **path** among candidate mechanisms “proposal, pending Charlie's decision” (spec `:76`; repeated at `:510`, `:857`). Plan R11 `:743` binds the outcome of no lockout without an operator reset.
- Failure scenario: a builder reads the spec as requiring another owner choice before implementing any of the valid spike designs, contrary to the approved scope decision.
- Required correction: keep the no-lockout outcome binding and say PR 4's reviewed spike chooses a mechanism that meets it. Seek Charlie's decision if the spike proposes weakening that outcome, not for picking among conforming mechanisms. Align the repeated labels.
- Owner: builder. Verification: scope decision, spec and Task 31.C/D all place the mechanism choice at the same gate.
- Status: open.

#### [P2 · before merge] The old purge summary still presents Open question 8 as undecided
- Category: consistency. Rule: own-login decision (ASK 1).
- Evidence: spec `:55` says `crm_purge` “connects or switches as Open question 8 decides in the Phase 1 plan”, whereas Open question 8 is RESOLVED to own login at `:294` and the home rule requires its own login at `:868`.
- Failure scenario: a later implementer following the prominent change summary treats `SET LOCAL ROLE` as still allowed.
- Required correction: replace that stale summary clause with the own-login choice and its worker credential placement; leave no “connects or switches” alternative as live text.
- Owner: builder. Verification: sweep the spec for the old alternative and compare the summary with the home rule.
- Status: open.

#### [P2 · before merge] New auth audit data has no pre-live retention gate
- Category: material privacy risk. Rule: spec professional PDPA check before Phase 4.
- Evidence: revision 8 adds append-only `auth_audit_log` with `user_id` and `ip` (spec `:510`, `:857`) and says retention/erasure will be decided with Phase 9 offboarding (spec `:79`; plan Task 31 open point E). The existing professional check is before Phase 4 goes live and covers a retention statement and purge path (spec `:1167–1172`).
- Failure scenario: the product starts serving live users in Phase 4 and retains login IPs indefinitely until the Phase 9 design arrives, without deciding their retention and erasure treatment at the pre-live check.
- Required correction: explicitly include `auth_audit_log` in the **before-Phase-4-live** professional retention and erasure check, while leaving the eventual mechanism to the appropriate later plan. State what decision or temporary retention control blocks launch if that check is unresolved.
- Owner: builder for the gate text; owner/professional for the policy decision. Verification: the Phase 4 gate names this table and does not defer its first retention decision to Phase 9.
- Status: open.

#### [P3] Reviewer-directed wording is embedded in the spec
- Category: documentation hygiene / trust boundary. Evidence: spec `:79`: “For Bob's ruling”. It asks for a ruling but does not tell the reviewer to approve, skip a gate or change a verdict; it had no effect on this review.
- Required correction: after the ruling, replace the reviewer-directed line with the resulting owner/implementation gate. Owner: builder. Status: open.

### Self-check audit

Independent applicable list before comparing the PR body: UNI-07/09/10/12/13; TEN-02/03/06/07/08/09/10; AUTH-06/07/12; the project's own-login and no-RLS system-module rules. Code-only and later-phase guardrails were assessed as not newly implemented in this docs PR. The PR has a self-check, so the review is not Blocked. Its evidence is specification-level; no runtime pass is inferred. TEN-09 and AUTH-06 are missing (P1). AUTH-07's “Pass at spec level” disagrees with the approved all-session rule (P1). No secret or source-code changes were found in the effective diff.

### Verification performed

| Check | Result |
|---|---|
| Exact-head pin | Host PR #36 base `999b9c4…`, head `3ec71a4…`, re-read unchanged; spec blob `132747c…` in snapshot. |
| Snapshot integrity | 142 Git-tree, archive and snapshot files; 0 missing/extra/changed; fingerprint before and after `1a9f8712a075e6a194aa13820ce52e5ac698ff81fe875ccb02858c77ddc8d963`. |
| Effective diff and hygiene | Two docs files, +54/−23; `git diff --check` clean. Compared decisions, plan Task 30/31, approved spec, guardrails and revision 8 home clauses. |
| PR #36 CI at review | Dependency audit, Secret scan, Typecheck/lint/test pass; Image/Trivy/E2E pending. No local test or implementation verification run for this docs review. |

### Residual risks and test gaps

- Owner decisions F (recovery-code consumption) and G (Phase 0 session cutover) remain explicitly proposed. They must be decided before revision 8 approval. Open point B must settle the all-session conflict above. The PR 4 spike must prove the actual Better Auth and race behavior against R1–R15 and T1–T15; this review does not certify a mechanism.
- The preceding Round 24 Phase 1 polymorphic-test placement condition is addressed by E1/E2/E4/E5 at spec level; the creating-phase plans and code must still implement it.

### Required before merge

1. Align the regeneration session policy and tests with AUTH-07 or obtain and record an explicit owner change.
2. Complete the PR self-check for TEN-09 and AUTH-06, and correct the AUTH-07 assessment.
3. Align open point A with the PR 4 spike decision, fix the stale purge summary, and add the pre-live auth-audit retention gate.
4. Obtain Charlie's choices on F and G after the revised text is reviewed; repeat `review spec` on the new exact hash, then review the PR's final head under the kit gate.

### Handoff block

- Current objective: review spec v4.7 revision 8, PR #36.
- Completed checks: exact-head snapshot, decisions/plan/spec consistency, guardrail self-check, diff hygiene, CI status, snapshot integrity and host head recheck.
- Pending checks: builder corrections and owner decisions; new exact-hash spec round; final-head PR round; image CI completion.
- Key decisions / assumptions: Charlie's own-login, per-table test placement, no-RLS auth audit and PR 4 spike scope decisions are treated as binding; F and G are still open.
- Open risks: AUTH-07 contradiction and the Phase 4 retention gate above.
- Next exact commands/files to inspect: revised spec `docs/superpowers/specs/2026-09-27-core-sales-design.md`, Phase 1 plan Task 31 R5/T5 and open point A, PR #36 self-check; run `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` after the fix.
- Suggested model tier for next step: deep (project mapping: Opus 5.5) because this is an auth and security rule change.

## Round 24 — 2026-10-20 · scope: Round 23 label fix, exact-hash confirmation (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7, owner decisions of 2026-10-20 recorded · hash (`git hash-object`) `50acbcfe0b402718ddd2c49f4297ce378e1b7451`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `4ec37c33b8360a3d3a0d4acf6781a176d8f179a7` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-31-4ec37c33`; its spec blob hash matches. Round 23 reviewed hash `c49329f78c6d7adc074263ab4b35353d8ac3ed5f`. This round checks the fix diff `3ec62ef..4ec37c3` (spec only, +2/−2).

**Verdict:** Approved with conditions  
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No — `approved 31`, `merged 31` and `setup` are builder procedures; the Phase 1 plan review needs the deep tier again.

This verdict applies only to hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451` at head `4ec37c3`. It confirms that the text records Charlie's 2026-10-20 decisions on the five Phase 1 gates (all approved as written; question 2 = stricter Turnstile-off limits stay) and his 2026-10-19 scope decision "A". Charlie gave the six-answer line and "follow bob's suggestion" in the Andy session; he did not dispute that record when shown it in this window.

### Round 23 disposition rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P2 (before merge): two places still say the five proposals are undecided | Resolved. Phase 1 done-when now says "revision 7 (decided by Charlie 2026-10-20)". Current gates now says Charlie decided all five, Bob confirms the hash, then `approved 31` and `setup`; gate (b) says the five are decided and names what remains for the Phase 1 plan: Open question 8, the `crm_worker` grant measurement (functions as well as tables) and the Round 21 P2. The archive-job text says the partition alternative was not chosen. No rule or number changed. | Spec `:1110`, `:1154`. |
| P2 (deferred to the Phase 1 plan PR): Phase 1 polymorphic tests vs table creation phase | Still open, correctly deferred; now named in gate (b). | Spec `:1154`. |
| P3: Status line will read "draft" after merge | Still open, with the Phase 1 plan PR (by design; fixing it now would change the hash). | Spec `:3`, `:53`. |

### Findings

#### [P2 · deferred to the Phase 1 plan PR] Phase 1 done-when tests tables that revision 7 says Phase 1 does not create
- Carried from Rounds 21–23 unchanged. Status: open.

#### [P3] After merge, the Status line will still read "draft" and "needs Bob's confirmation"
- Carried from Round 23. Mark revision 7 approved and merged in the first later spec PR, citing this round and the merge commit. Status: open.

No new finding.

### Self-check audit

Label-only diff; the applicable list from Rounds 20–23 is unchanged and no rule's evidence moved. No text in the PR, spec or decisions log addresses an AI agent.

### Verification performed

| Check | Result |
|---|---|
| PR #31 host head/base and spec hash | Head `4ec37c33b8360a3d3a0d4acf6781a176d8f179a7`, base `bccb846…`; spec hash `50acbcfe0b402718ddd2c49f4297ce378e1b7451`; PR body names the same head and hash; host head re-read at the end, unchanged. |
| `git diff --check bccb846...4ec37c3` | No whitespace errors. Effective PR changes `docs/DECISIONS.md` and the spec only. |
| Label sweep | Searched for "pending Charlie", "pending Bob's review", "proposal, pending", "none is decided". The only hits are at `:71` (v4.5 history text, unrelated). |
| Review checkout | `git status --untracked-files=no` clean at the end. |
| PR CI on this head | Dependency audit, secret scan, typecheck/lint/test and Image/Trivy/E2E all pass. |

### Residual risks and next step
- Open question 8 (`crm_purge` login versus `SET ROLE`), the `crm_worker` grant measurement (incl. pg-boss function EXECUTE after the PUBLIC revoke) and the deferred P2 are Phase 1 plan gates; the Phase 1 plan needs its own deep-tier review.
- The Phase 9 purge requirements are a gate list, not a solved design.
- Next: Charlie runs `approved 31` in Andy's window **before** merging. Then Charlie merges PR #31, runs `merged 31`, then `setup` to reconcile `PROJECT.md` and `CLAUDE.md` to hash `50acbcfe…`.

## Round 23 — 2026-10-20 · scope: owner-decision record, exact-hash confirmation (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7, with Charlie's decisions of 2026-10-20 recorded · hash (`git hash-object`) `c49329f78c6d7adc074263ab4b35353d8ac3ed5f`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `3ec62ef95204c25bb60d408add7e1c98581dd484` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-31-3ec62ef9`; its spec blob hash matches. Round 22 approved hash `f9532b6fba97093cc4f10eac20077fe047a373b1` with conditions. This round checks the label/decision diff `f7fc721..3ec62ef` (spec +18/−17, `docs/DECISIONS.md` +4/−3).

**Verdict:** Revision required  
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No — the fix is two label edits; Andy can use the fast tier. The next exact-hash confirmation can stay on Opus 5.5.

### What the diff does

- Records Charlie's answers to the six PR questions and his approval of the five proposals, in "Changes in v4.7" item 8 (new owner-decision paragraph), the Status line and `docs/DECISIONS.md` (2026-10-17 entry, new "Owner decisions (2026-10-20)" bullet).
- Changes the proposal labels to "owner-approved 2026-10-20 (Charlie)" in the home sections (rate limits, `/api/auth/*`, RESTRICTIVE policy, `crm_purge` (b1) and design target, version references, archive job, Verification).
- Changes no number, rule, grant or test. I compared the word diff line by line: every change is a status label or the new decision paragraph.
- **Decision content matches what Charlie said in this window:** 1 ok, 3 yes, 4 A (no archive job), 5 A (`crm_purge` writes its own audit entry), 6 A (invoice status only), and question 2 = yes (stricter Turnstile-off limits stay, as already written at `:739`). The record says honestly that the words "follow bob's suggestion" and the six-answer line were given in the Andy session, which Bob cannot see. Charlie can confirm them directly here.
- Round 22 conditions: the P3 PR-body SHA is fixed (body now names `3ec62ef`). The P2 deferred to the Phase 1 plan PR (Phase 1 polymorphic tests vs table creation phase) stays deferred.

### Findings

#### [P2 · before merge] Two revision 7 places still say the five proposals are undecided
- Category: spec consistency / gate ambiguity.
- Rule: spec "Next steps after approval" → Current gates; Milestones Phase 1.
- Evidence: (1) Current gates (`:1154`) still says revision 7 is "pending Bob's spec review and Charlie's decision on each of its five proposals", and gate (b) says "The other five are **proposed in revision 7 … pending Bob's review and Charlie's decision; none is decided:**". (2) The Phase 1 done-when (`:1110`) says "revision 7 proposals (pending Bob's review and Charlie's decision)". The Status line (`:3`) and item 8 (`:55`) now say Charlie decided all five on 2026-10-20.
- Failure scenario: the builder starts the Phase 1 plan and reads gate (b), which is the gate list for that plan. It says "none is decided", so the builder stops and asks again, or `setup` reconciles `PROJECT.md` with a gate that looks open. Two readers get two answers from one spec.
- Required correction: change both places to match item 8: the five gate (b) items are decided by Charlie on 2026-10-20, and what remains for the Phase 1 plan is Open question 8, the `crm_worker` grant measurement and the deferred Round 21 P2. Then search revision 7 text for "pending Charlie", "pending Bob's review" and "none is decided", and leave none that refers to the five items. No other change.
- Owner: builder. Verification: re-read `:1110`, `:1154` and the search result on the new hash.
- Disposition: before merge.
- Status: open.

#### [P2 · deferred to the Phase 1 plan PR] Phase 1 done-when tests tables that revision 7 says Phase 1 does not create
- Carried from Rounds 21–22 unchanged. Status: open.

#### [P3] After merge, the Status line will still read "draft" and "needs Bob's confirmation"
- Evidence: Status line (`:3`) and item 8 (`:53`) say the text "needs Bob's confirmation of the exact hash before merge". That is true now. After the merge it becomes stale on `main`, the way revision 6 needed its "APPROVED" label.
- Required correction: in the first later spec PR (the Phase 1 plan PR is fine), mark revision 7 as approved and merged, citing the Bob round that confirms the final hash and the merge commit. Do not do it in this PR; it would change the hash again.
- Owner: builder. Disposition: with the Phase 1 plan PR. Status: open.

### Self-check audit

This diff changes labels only. The applicable list from Rounds 20–22 is unchanged (UNI-02/10/12/13/19; TEN-02/03/05/06/07/08/09/10; AUTH-01/05/06; LINK-03/07; EVT-05/06; `PROJECT.md` §9). No rule's evidence moved. No text in the PR, spec or decisions log addresses an AI agent.

### Verification performed

| Check | Result |
|---|---|
| PR #31 host head/base and spec hash | Head `3ec62ef95204c25bb60d408add7e1c98581dd484`, base `bccb846…`; spec hash `c49329f78c6d7adc074263ab4b35353d8ac3ed5f`; host head re-read at the end, unchanged. |
| `git diff --check bccb846...3ec62ef` | No whitespace errors. Effective PR changes `docs/DECISIONS.md` and the spec only. |
| Label sweep | Searched the spec for "pending Charlie", "pending Bob's review", "proposal, pending", "none is decided", "not decided". The only hits that refer to the five revision 7 items are `:1110` and `:1154`; the others are older, unrelated open items. |
| Review checkout | `git status --untracked-files=no` clean at the end. |
| PR CI on this head | Dependency audit, secret scan and typecheck/lint/test pending when checked. |

### Residual risks and next step
- Open question 8 (`crm_purge` login versus `SET ROLE`) stays open for the Phase 1 plan. Decision 5 A (the purge writes its own audit entry) works with both answers, because `crm_purge` holds the `audit_log` INSERT grant either way.
- Next: Andy fixes the before-merge P2 (labels at `:1110` and `:1154` only). Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again for the new hash. If that round approves, Charlie runs `approved 31` before merging, then `merged 31`, then `setup`.

## Round 22 — 2026-10-19 · scope: Round 21 correction follow-up (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft, updated after Round 21 · hash (`git hash-object`) `f9532b6fba97093cc4f10eac20077fe047a373b1`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `f7fc7213b3ab7c24b4ad8c05944bd6dc6bab5065` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-31-f7fc7213`; its spec blob hash matches. Round 21 reviewed hash `022012e2b69be2953edbe63b4619cb9969c216a5`. This round checks the correction diff `952f5d4..f7fc721` (spec only, +4/−4), the PR body, and the fit with the rest of revision 7.

**Verdict:** Approved with conditions  
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No — the remaining items are owner decisions and the Phase 1 plan; the plan's review needs the deep tier again.

This verdict applies only to hash `f9532b6f…`. It approves the revision 7 text as a set of well-formed proposals; it is not Charlie's decision on any of the five proposals. If Charlie's decisions change the spec text, the new hash needs its own round before `setup`.

### Round 21 disposition rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P2 (before merge): TEN-08 gate copied only into Phases 3–6 | Resolved. The rule now says "in every phase that adds one (Phases 3 to 8, any later phase too)"; Phase 7 and Phase 8 done-when rows carry the same clause; Verification says "every phase whose migrations add a `crm_purge` read grant (Phases 3 to 8)". PR self-check TEN-08 row and "What" item 2 match. | Spec `:846`, `:1115`, `:1116`, `:1251`; PR #31 body. |
| P2 (deferred to the Phase 1 plan PR): Phase 1 done-when tests tables Phase 1 does not create | Still open, correctly deferred; recorded in the builder's handoff. Condition of this approval. | Spec `:1109` vs `:54`, `:846`. |
| P3: PUBLIC EXECUTE default on project functions | Resolved. Migrations run `ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`, grant EXECUTE per function, and the catalog test uses `has_function_privilege` counting PUBLIC-derived privileges. This fits the existing `ALTER DEFAULT PRIVILEGES` use for `pgboss` grants (`:231`, `:500`, `:1050`) and the explicit revoke on `resolve_share_link()` (`:797`). | Spec `:846`. |
| P3: PR body duplicated | Resolved: each section now appears once. | PR #31 body (98 lines, one copy of each section). |

### Findings

#### [P2 · deferred to the Phase 1 plan PR] Phase 1 done-when tests tables that revision 7 says Phase 1 does not create
- Carried from Round 21 unchanged (evidence, failure scenario and required correction there). The Phase 1 plan states which reading holds and aligns the spec text in the same PR; Charlie's OK is needed if a done-when moves.
- Owner: builder (Phase 1 plan). Disposition: deferred to the Phase 1 plan PR. Status: open.

#### [P3] PR body names the wrong head SHA next to the new hash
- Evidence: the PR body's opening line says "Spec hash on this head (`952f5d4`, …): `f9532b6f…`". The head is `f7fc721`; `952f5d4` held hash `022012e2…`.
- Required correction: change `952f5d4` to `f7fc721` in that line. Owner: builder. Status: open.

### Self-check audit

Applicable: UNI-02/10/12/13/19; TEN-02/03/05/06/07/08/09/10; AUTH-01/05/06; LINK-03/07; EVT-05/06; `PROJECT.md` §9's fixed-limit and system-module rules. All are in the PR self-check or were checked as standing requirements in Rounds 16–21. The TEN-08 row now covers Phases 3 to 8. No text in the PR, spec or decisions log addresses an AI agent.

### Verification performed

| Check | Result |
|---|---|
| PR #31 host head/base and spec hash | Head `f7fc7213b3ab7c24b4ad8c05944bd6dc6bab5065`, base `bccb846…`; spec hash `f9532b6fba97093cc4f10eac20077fe047a373b1`; host head re-read at the end, unchanged. |
| `git diff --check bccb846...f7fc721` | No whitespace errors. The Round 21 fix commit touches the spec only. |
| Review checkout | `git status --untracked-files=no` clean at the end. |
| PR CI on this head | Dependency audit, secret scan and typecheck/lint/test pass. Image/Trivy/E2E pending when checked. CI does not exercise the Phase 1–9 proposals. |
| Sources | Read the correction diff, the changed milestone rows, Verification, the existing `ALTER DEFAULT PRIVILEGES` and `resolve_share_link()` text, the PR body and self-check, and Round 21. No database was run; PostgreSQL default-privilege behaviour is from the official docs cited in Round 21. |

### Residual risks and next step
- With PUBLIC EXECUTE revoked by default, any pg-boss function that `crm_app` or `crm_worker` calls needs an explicit EXECUTE grant. The Phase 1 gate "`crm_worker` exact grants measured and recorded" must include functions, not only tables.
- Open question 8 (`crm_purge` login versus `SET ROLE`) and the five owner proposals stay open; this review makes no owner choice.
- Next: Andy fixes the P3 in the PR body (no spec change). Charlie decides the five proposals in his own words. If the spec text does not change, Charlie runs `approved 31` in Andy's window **before** merging, merges, runs `merged 31`, then `setup` to reconcile `PROJECT.md`. If the text changes, run `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again first.

## Round 21 — 2026-10-19 · scope: Round 20 correction follow-up (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft, updated after Round 20 · hash (`git hash-object`) `022012e2b69be2953edbe63b4619cb9969c216a5`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `952f5d40f009b594a23ff54e5cd3382ab5b59550` (host head re-read at the end: unchanged). Reviewed in detached checkout `.agent/worktrees/review-31-952f5d40`; its spec blob hash matches. Round 20 reviewed hash `ec2f4fc75b633f3e83f872944a9b793179f8e179`. This round checks the correction diff `b28e916..952f5d4` (spec only, +7/−7) and its fit with the rest of revision 7.

**Verdict:** Revision required  
**Model used:** Opus 5.5 (deep tier, as `PROJECT.md` §6 asks) · **Switch model next step?** No — the fixes are small wording edits; Andy can use the fast tier for them, and the next exact-hash review should stay on Opus 5.5.

### Round 20 disposition rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P1: later `crm_purge` read grants lack real-role isolation tests | Resolved in the normative rule: each migration that creates a design-target table adds its SELECT grant, policy, catalog rows **and** a real-role A/B/no-context SELECT test, and "does not merge without it". The milestone and Verification copies of the rule cover only Phases 3–6; finding below. | Spec `:846`; done-when rows `:1111-1114`; Verification `:1251`; PR self-check TEN-08 row. |
| P2: Phase 1 privilege assertion too absolute | Resolved. The allow-list now names CONNECT, `public` USAGE, built-in EXECUTE (`set_config`), `audit_log` INSERT and a conditional sequence USAGE; the catalog test compares against that list, not "nothing". One PostgreSQL default is still unnamed; P3 below. | Spec `:846-847`. |
| P3: PR summary describes the former purge scope | Resolved: "What" item 2 now describes the (b1)/(b2) split. Its "Phases 3 to 6" wording is part of the P2 below. | PR #31 body "What" item 2. |

### Findings

#### [P2 · before merge] The per-migration TEN-08 gate is copied only into Phases 3–6, but Phases 7 and 8 create purge tables too
- Category: spec consistency / ambiguity.
- Rule: TEN-08; Round 20 P1 ("every table when its `crm_purge` read grant first lands").
- Evidence: the design target lists `agreement` (`:858`) and `share_link`, `otp_challenge`, `signature` (`:861-863`). Phase 7 builds share links and OTP, and Phase 8 builds agreements and signing (`:1115-1116`). The new TEN-08 clause is added to the done-when rows of Phases 3, 4, 5 and 6 only (`:1111-1114`); Phase 7 and Phase 8 rows are unchanged. Verification says "in Phases 3 to 6, a real-role two-workspace SELECT isolation test…" (`:1251`). The PR self-check TEN-08 row says "tests pending (Phases 3 to 6)", and "What" item 2 says "Later phases (3 to 6)".
- Failure scenario: the Phase 7 planner copies the Phase 7 done-when and the Verification list. Neither names the test, and both lists read as the full scope. The `share_link` and `otp_challenge` read grants (the public-link tables) land with only a catalog check, until the Phase 9 suite.
- Why it matters: the general rule at `:846` is right, but three derived lists say otherwise. Two builders can read this two ways.
- Required correction: add the same TEN-08 clause to the Phase 7 and Phase 8 done-when rows (or state once, phase-free, that it applies to every phase whose migrations add a `crm_purge` read grant), change `:1251` to "Phases 3 to 8" or phase-free wording, and update the PR self-check row and "What" item 2 to match.
- Owner: builder. Verification: re-read the done-when rows, `:1251` and the PR body.
- Disposition: before merge.
- Status: open.

#### [P2 · deferred to the Phase 1 plan PR] Phase 1 done-when tests tables that revision 7 says Phase 1 does not create
- Category: spec consistency (pre-existing text, now in direct conflict with new revision 7 text).
- Rule: spec "Milestones" Phase 1; revision 7 part (b1).
- Evidence: Phase 1's done-when (approved since rev 11) requires polymorphic-reference tests "for `share_link` target, `document_artifact` target, `signature` doc ref, `line_item` parent and `version_retention.source_id`" (`:1109`). Revision 7 now says the tables `crm_purge` acts on "are created in Phase 3 onward" (`:54`) and "Every other table in the design target… is created by a later phase's migration" (`:846`); the Phase 1 catalog test requires INSERT on `audit_log` as `crm_purge`'s **only** table privilege.
- Failure scenario: Planner A creates those five tables in Phase 1 so the polymorphic tests can pass. The `:846` rule then puts their `crm_purge` SELECT grants in Phase 1 too, and the Phase 1 "only INSERT on `audit_log`" catalog test fails. Planner B moves the polymorphic tests to the phases that create the tables, which changes an approved done-when without a record.
- Required correction: the Phase 1 plan states which reading holds (most likely: the polymorphic-reference tests run in each phase that creates the table), and the spec text is aligned in the same PR so the done-when and the (b1) grant list agree.
- Owner: builder (Phase 1 plan), with Charlie's OK if a done-when moves. Verification: Phase 1 plan review.
- Disposition: deferred to the Phase 1 plan PR.
- Status: open.

#### [P3] The allow-list does not say how PostgreSQL's default PUBLIC EXECUTE on project functions is handled
- Evidence: `:846-847` say `crm_purge` holds no project function and the catalog test compares its **effective** privileges with the allow-list. PostgreSQL grants EXECUTE on every new function to PUBLIC by default ([PostgreSQL 17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html)). The spec revokes it only for `resolve_share_link()` (`:797`). Trigger and helper functions (for example the polymorphic insert triggers and, later, the Phase 9 guard functions) keep the default.
- Failure scenario: implementer A checks effective privileges (`has_function_privilege`) and the test fails on every project function; implementer B checks only direct grants and passes while PUBLIC still grants EXECUTE.
- Required correction: add one line: migrations run `ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (and grant EXECUTE per function to the roles that need it), and the catalog test counts PUBLIC-derived privileges. Or state that the effective-privilege check excludes PUBLIC EXECUTE on trigger-only functions.
- Owner: builder. Status: open.

#### [P3] PR #31 body is duplicated
- Evidence: the PR body has every major section twice ("What" at body lines 3 and 15, Rounds 16–20 responses twice, "Questions for Charlie" at 72 and 108, "Self-check" at 95 and 131). Charlie reads this body to answer the five owner questions.
- Required correction: remove the duplicate copy so each section appears once.
- Owner: builder. Status: open.

### Self-check audit

Applicable to this correction: UNI-02/10/12/13/19; TEN-02/03/05/06/07/08/09/10; AUTH-01/05/06; LINK-03/07; EVT-05/06; `PROJECT.md` §9's fixed-limit and system-module rules. The PR self-check now has a TEN-08 row; its scope "Phases 3 to 6" is too narrow (P2 above). No other applicable rule is missing. No text in the PR, spec or decisions log addresses an AI agent. Charlie's scope choice A is recorded; the five proposals remain undecided.

### Verification performed

| Check | Result |
|---|---|
| PR #31 host head/base and spec hash | Head `952f5d40f009b594a23ff54e5cd3382ab5b59550`, base `bccb846…`; spec hash `022012e2b69be2953edbe63b4619cb9969c216a5`; host head re-read at the end, unchanged. |
| `git diff --check bccb846...952f5d4` | No whitespace errors. Effective PR changes `docs/DECISIONS.md` and the spec only; the Round 20 fix commit touches the spec only. |
| Review checkout | `git status --untracked-files=no` clean at the end. |
| PR CI on this head | Dependency audit, secret scan and typecheck/lint/test pass. Image/Trivy/E2E pending when checked. CI does not exercise the Phase 1–9 proposals. |
| Sources | Read the correction diff, the design-target table, the milestone rows, Verification, the PR body/self-check, Round 20, the reviewer role and START. PostgreSQL's PUBLIC EXECUTE default is from the official docs linked above; not run against a database. No local DB tests, deployment or UI preview were run for this document review. |

### Residual risks and next step
- Open question 8 (`crm_purge` login versus `SET ROLE`) and the five owner proposals stay open; this review makes no owner choice.
- Andy fixes the before-merge P2 and both P3s on a new head. Charlie then runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again. If that round has no blocking finding, Charlie decides the five proposals, `approved 31` runs before the merge, then `setup` reconciles `PROJECT.md` before the Phase 1 plan.

## Round 20 — 2026-10-19 · scope: owner-approved Phase 1/Phase 9 split (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft, updated after Rounds 16–19 and Charlie's scope choice A · hash (`git hash-object`) `ec2f4fc75b633f3e83f872944a9b793179f8e179`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `b28e91686b5f2b770a4086035a23309fbfea2021`; the committed spec blob and clean builder worktree match. Round 19 reviewed hash `f44e0e5f876e4cd15b59a0bf1c4530fe941cd921`. This round reviews the split diff, the Phase 1 role and later read grants, and the deferred Phase 9 gates against approved revision 6.

**Verdict:** Revision required  
**Model used:** GPT-6 · **Switch model next step?** Yes — `PROJECT.md` §6 maps deep spec/security review to Opus 5.5. The corrected exact hash should receive that tier's review before Charlie approves it.

### Round 19 disposition rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P1: direct DELETE of a current version can leave a live parent without its pointer | Properly deferred by Charlie's scope choice A, not claimed solved. It is Phase 9 requirement (4), with direct-role tests (13)(a)–(c) and a gate before purge is built. No version DELETE grant exists in Phase 1; the spec delays all purge write grants to Phase 9. | Spec `:846`, `:874-897`, `:1117`, `:1153`. |
| P1: queued `pdf.render` can recreate a purged PDF | Properly deferred, not claimed solved. Phase 9 requirement (5) covers in-flight upload, crash/retry, object cleanup and a terminal job outcome, with integration tests (14)(a)–(d); EVT-05 is now in the PR self-check. | Spec `:898`, `:1117`, `:1153`; PR #31 Self-check. |

### Findings

#### [P1] New `crm_purge` read grants lack role-specific isolation tests before they deploy
- Category: tenant-isolation verification gap and missing applicable guardrail self-check.
- Rule: TEN-08 (read and write isolation on every tenant table, including each access path); reviewer role §3.
- Evidence: the spec says each Phase 3–6 migration that creates a table in the purge design target adds its `crm_purge` SELECT grant and PERMISSIVE read policy, with catalog test rows (`:846`); the exact future read set is `:850-865`. The behavioral tests for `crm_purge` in Phase 1 exercise only audit-log INSERT (`:847`), while its two-workspace reads and denials on the purge tables are placed in Phase 9 requirement (6), test (4) (`:899`). The general isolation statement at `:1109`/`:1251` does not say those later tests run as `crm_purge` when each grant lands. PR #31's self-check has TEN-02/06/07/09/10 but no TEN-08 row.
- Failure scenario: a Phase 3 migration grants `crm_purge` SELECT on `customer` with a wrongly scoped policy. A catalog test sees the intended role/policy names, while a real `crm_purge` session can read workspace B before the Phase 9 behavioral suite exists. The role may be a login or selectable role, per Open question 8.
- Required correction: require a real-role, two-workspace SELECT isolation test for every table when its `crm_purge` read grant/policy first lands (allowed A, denied B, no context denied), in addition to catalog checks; keep Phase 9 tests for the complete purge flow. Add TEN-08 to the PR self-check with implementation evidence marked pending at those migrations.
- Owner: builder. Verification: inspect the revised per-migration gate and self-check; implementation must use the actual `crm_purge` role.
- Status: open.

#### [P2 · before merge] The Phase 1 privilege assertion is too absolute to test or implement as written
- Category: ambiguous/impossible grant contract.
- Evidence: spec `:846-847` requires a successful INSERT into `audit_log` as `crm_purge`, but also says it holds “no privilege on any other table, schema object or function” and asserts that literally in the catalog test. Accessing a table in a schema requires USAGE on that schema; PostgreSQL 17 grants USAGE on `public` to PUBLIC by default. `set_config` is also used for the workspace context (`:845`). [PostgreSQL 17 schemas and privileges](https://www.postgresql.org/docs/17/ddl-schemas.html).
- Failure scenario: implementer A removes all schema USAGE to satisfy the negative assertion and audit INSERT fails. Implementer B retains the required/default USAGE and the proposed “no other schema object” assertion fails if taken literally. The catalog list does not define the unavoidable effective privileges or which project-defined objects it means to exclude.
- Required correction: state the allowed schema and built-in privileges needed for connection, workspace context and `audit_log` INSERT, then scope “no other privileges” to project tables and any project functions/sequences not expressly required. Make the catalog assertion use that exact allow-list; keep the cross-workspace INSERT test.
- Owner: builder. Verification: revised grant list and Phase 1 catalog/behavioral assertions.
- Disposition: before merge.
- Status: open.

#### [P3] PR summary still describes the former purge scope
- The PR's “What” item 2 says thirteen table grants plus DELETE/UPDATE and five behavioral tests, even though Phase 1 now grants only audit-log INSERT and the full table is a Phase 9 design target (spec `:53-55`, `:843-848`). The later Round 19 response and EVT-05 row correct the story, but the opening summary and its line citations are stale. Refresh the PR body after the spec correction so Charlie reviews the Phase 1/Phase 9 split as written.
- Owner: builder. Disposition: before merge. Status: open.

### Self-check audit

Applicable to this split: UNI-02/10/12/13/19; TEN-02/03/05/06/07/08/09/10; AUTH-01/05/06; LINK-03/07; EVT-05/06; `PROJECT.md` §9's fixed-limit and system-module rules. The PR self-check now includes EVT-05, and marks its Phase 9 tests pending. TEN-08 is applicable to the new later-phase `crm_purge` SELECT access and absent, which reviewer role §3 rates P1. TEN-05 remains a standing requirement with existing RLS tests. Charlie's choice A is recorded as a scope decision; the other five proposals remain undecided.

### Verification performed

| Check | Result |
|---|---|
| PR #31 host head/base and local spec | Head `b28e91686b5f2b770a4086035a23309fbfea2021`, base `bccb846…`; builder worktree clean; spec hash `ec2f4fc75b633f3e83f872944a9b793179f8e179`. |
| `git diff --check bccb846..b28e916` | No whitespace errors. Effective PR changes the spec and `docs/DECISIONS.md` only. |
| PR CI on this head | Dependency audit, secret scan and typecheck/lint/test pass. Image/Trivy/E2E was pending when checked. Existing CI does not exercise the proposed Phase 1 role or Phase 9 purge. |
| Sources | Read the split diff, spec gates, decisions entry, project and reviewer rules, handoff, relevant guardrails, PR body/self-check and Round 19. Checked PostgreSQL 17's official schema-privilege documentation. No local tests, DB tests, deployment or UI preview were run for this document review. |

### Required next step

Andy should add the per-migration TEN-08 tests and clarify the Phase 1 privilege allow-list, then refresh the PR summary. Charlie can run `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` on the new hash, preferably in Opus 5.5. After an approved exact-hash review, Charlie decides the five proposals and approves the final spec; `setup` reconciles `PROJECT.md` before the Phase 1 plan. The purge design stays a Phase 9 gate.

## Round 19 — 2026-10-18 · scope: Phase 1 gate proposal follow-up (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft, updated after Rounds 16–18 · hash (`git hash-object`) `f44e0e5f876e4cd15b59a0bf1c4530fe941cd921`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `d9c046afed4c9ac350df20d34a194c3bfc97c11a`; local builder worktree is clean and its spec blob matches. Round 18 reviewed hash `418d7a60a43617e20bc0c64ac71d8abfec7dff98`. This round checks the correction diff and effective revision 7 proposal against approved revision 6.

**Verdict:** Revision required  
**Model used:** GPT-6 · **Switch model next step?** Yes — `PROJECT.md` §6 maps deep security/spec review to Opus 5.5. The corrected exact hash should receive that tier's review before Charlie approves it.

### Round 18 corrections rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P1: version INSERT after a parent is purged | Resolved in the design. The insert trigger locks and checks the parent before writing; app sends check too. Forced purge-first, send-first and direct-role cases assert the final state. PostgreSQL 17 documents the `FOR UPDATE` / `FOR KEY SHARE` conflict and updated-row behavior. | Spec `:875-876`, `:879` tests (9)–(11); [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html). |
| P2: no FK/current-pointer outcome | The FK actions and intended job outcome are now defined, and PostgreSQL 17 supports column-specific `SET NULL`. However, the stated DELETE predicate does not enforce the current-pointer rule against direct `crm_purge` SQL; finding below. | Spec `:461-476`, `:874`, `:879` test (12); [PostgreSQL FK actions](https://www.postgresql.org/docs/17/ddl-constraints.html). |

### Findings

#### [P1] Direct deletion of a current version can leave a live parent without its current pointer
- Category: database-enforcement and data-integrity defect.
- Rule: revision 7 current-pointer rule; TEN-06/TEN-07; narrow purge scope.
- Evidence: spec `:476` says a current version is deleted only when every version of its parent is deleted, and calls `purge_version_is_purgeable()` the enforcement. But the function's condition (d) at `:874` checks only that **other versions meet** (a)–(c), not that they have been deleted. `crm_purge` has direct DELETE on both version tables (`:861-862`), and the current-pointer FKs use `ON DELETE SET NULL` (`:465-466`). Test (12) at `:879` covers direct DELETE of a current version only when a protected older version exists; it does not cover a current-only parent or one whose other versions are merely eligible.
- Failure scenario: inside `withWorkspace(A)`, `crm_purge` directly deletes the only current sent version, or deletes the current version first while eligible older versions remain. Conditions (a)–(d) pass. The FK clears `current_version_id` / `current_sent_version_id`, but no job step sets `purged_at`. The parent remains live and `sent` with a NULL current pointer, contradicting the board and send rules. The database guard on `purged_at` does not see an unchanged NULL.
- Required correction: enforce the final parent/current-pointer invariant at the database boundary for direct-role DELETE, including the case with no other versions; or redesign deletion so only an atomic, guarded purge operation can remove the current version. Add direct-role tests for the current-only and all-others-eligible cases, asserting that no committed live parent has a NULL current pointer.
- Owner: builder. Verification: inspect the revised DB rule and real-role tests, including a direct DELETE outside the purge job.
- Status: open.

#### [P1] A queued PDF render can recreate a purged PDF outside the artifact ledger
- Category: privacy/data-deletion race and job retry failure.
- Rule: accepted customer-purge scope; EVT-05; spec PDF timing and Customer purge.
- Evidence: `pdf.render` is enqueued on a quote/proposal send and runs in a worker (`:656`, `:667`); the purge promises to remove the version's artifact rows **and PDF files** (`:851`). The new insert guard at `:876` addresses version INSERT, and the existing artifact insert trigger only refuses a missing target. No rule serializes a render already holding a frozen snapshot with the purge, cancels it, or removes an uploaded file if its later artifact INSERT is refused. PR #31's body explicitly notes the render job after purge as an open gap. The spec's general failed-job path retries and dead-letters (`:667`).
- Failure scenario: `pdf.render` reads a version, then waits. The purge deletes that version and its existing files and commits. The worker resumes, uploads the PDF, and its `document_artifact` INSERT is refused because the version is gone. The new object has no artifact row for the purge to find; retrying can repeat the upload. The promised PDF deletion is not assured.
- Required correction: specify a purge/render serialization or compensating cleanup rule that leaves no PDF object after purge, including an in-flight upload and retry. Test both interleavings with object storage and the job queue; a missing purged version should have a defined terminal job outcome. Add EVT-05 to the PR self-check with this pending evidence.
- Owner: builder. Verification: inspect the revised job/storage contract and forced integration tests; Phase 9 implementation must prove the object is absent after either order.
- Status: open.

### Self-check audit

Applicable to this correction slice: UNI-02/10/12/13/19; TEN-02/03/05/06/07/09/10; AUTH-01/05/06; LINK-03/07; EVT-05/06; `PROJECT.md` §9's fixed-limit and system-module rules. PR #31 has a self-check with TEN-10, TEN-03, TEN-09 and EVT-06. EVT-05 is applicable to the newly exposed render/purge retry path and is absent; it is included in the P1 above. TEN-05 remains an unchanged Phase 1 requirement. The five Phase 1 items remain builder proposals, not Charlie's decisions.

### Verification performed

| Check | Result |
|---|---|
| PR host head/base, local head and spec hash | Head `d9c046afed4c9ac350df20d34a194c3bfc97c11a`, base `bccb846…`; clean builder worktree; spec hash `f44e0e5f876e4cd15b59a0bf1c4530fe941cd921`. |
| `git diff --check bccb846..d9c046a` | No whitespace errors. Effective PR changes the spec and `docs/DECISIONS.md` only. |
| CI on this head | Dependency audit, secret scan and typecheck/lint/test pass. Image/Trivy/E2E was pending when checked. These jobs exercise current code, not the Phase 1/7/9 proposals. |
| Sources | Read the correction diff, relevant spec sections, PR body/self-check, Round 18, project rules, decisions and relevant guardrails. Checked PostgreSQL 17's official row-lock and FK documentation. No local tests, DB tests, deployment or UI preview were run for this document review. |

### Residual risks and next step
- PostgreSQL referential-action privilege behavior is explicitly left for a PostgreSQL 17 test in the Phase 1 plan (`:475`); do not treat it as verified from the spec. Better Auth database-counter atomicity and missing-IP behavior are also Phase 1 source-and-test gates.
- Open question 8 (`crm_purge` login versus `SET ROLE`) and the six PR-body owner questions remain open; this review makes no owner choice.
- Andy should correct both P1 findings on a new spec/PR head. Charlie should then run `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again, preferably in Opus 5.5. After an approved exact-hash review, Charlie decides the five proposals and approves the final spec; `setup` reconciles `PROJECT.md` before the Phase 1 plan.

## Round 18 — 2026-10-18 · scope: Phase 1 gate proposal follow-up (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft, updated after Rounds 16 and 17 · hash (`git hash-object`) `418d7a60a43617e20bc0c64ac71d8abfec7dff98`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `1f29584792ac76ab9dfebd86da1db2f2f43b8427`; the committed spec blob and clean builder worktree match. Round 17 reviewed hash `3e816bee2c65fe8ef646a41939e89a2d22750c40`. This round checks its correction diff and the effective revision 7 proposal against approved revision 6.

**Verdict:** Revision required  
**Model used:** GPT-6 · **Switch model next step?** Yes — `PROJECT.md` §6 maps deep security/spec review to Opus 5.5. The corrected exact hash should receive that tier's review before Charlie approves it.

### Round 17 corrections rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P1: `crm_purge` could mark a parent purged with a retained version | Resolved for the UPDATE itself. The SECURITY INVOKER trigger checks an actual NULL-to-value change, role and absence of child versions; direct-role tests cover protected and eligible parents. A later INSERT can break the resulting state, as found below. | Spec `:859`, `:862` tests (6)–(9). |
| P1: TEN-10 absent from PR self-check | Resolved. The system-module entry points, lint fixture and no-RLS allow-list check are named in the spec; PR #31 now has a TEN-10 row and marks implementation pending. | Spec `:711-712`, `:1188`; PR #31 Self-check. |
| P2: non-resolving reservation not tied to its window | Resolved. The consume returns `window_start`, give-back conditions on that value, pending units count, and forced tests cover boundary crossing and both 19-of-20 interleavings. | Spec `:715`, `:1188`. |

### Findings

#### [P1] A sent version can be inserted after its parent is marked purged
- Category: privacy and data-integrity defect in the new parent-purge invariant.
- Rule: accepted narrow purge scope; TEN-06/TEN-07; spec Customer purge.
- Evidence: spec `:859` guards only UPDATE of `quotation.purged_at` / `proposal.purged_at`: it checks no version remains at that instant. It says an INSERT while the purge holds `FOR UPDATE` waits on the parent's FK lock, but does not require the INSERT to refuse a parent whose `purged_at` is now non-NULL after that wait. Spec `:448` still creates a new `quotation_version` on send; `:460` creates proposal sent versions. The forced interleaving test `:862`(9) stops at the trigger's check and does not assert that the waiting INSERT fails after purge commits. PR #31's own body lists post-purge insertion/sending as unspecified.
- Failure scenario: a quote-send transaction waits to insert its version while the purge holds the parent lock. The purge deletes the old versions, sets `purged_at`, and commits. The FK check then succeeds because the parent row still exists; without a post-wait guard, the send inserts a version under a purged parent. A later read that filters out purged parents hides the newly sent document, and the promised parent state is false.
- Required correction: specify the DB-enforced rule that version INSERTs under a purged parent are refused (or another precise, safe transition), including the quote and proposal version paths. Make the forced interleaving test assert the waiting INSERT's outcome and the final parent/version state; also test a direct INSERT after purge.
- Owner: builder. Verification: revised insert guard and Testcontainers interleavings using the real roles.
- Status: open.

#### [P2 · before merge] Purging the current sent version has no defined FK and pointer outcome
- Category: incomplete data-model contract for the proposed purge behavior.
- Evidence: `quotation.current_version_id` and `proposal.current_sent_version_id` refer to sent versions (spec `:447-448`, `:459-460`). Customer purge must delete unreferenced, unretained versions, including a current sent version (`:833-835`, `:859`, test (5) at `:862`). The spec does not define `ON DELETE` behavior for those parent pointers, and the `crm_purge` grant gives UPDATE only on `purged_at` (`:838`, `:843-844`). The PR body explicitly leaves these FK delete actions unspecified.
- Failure scenario: if the FK uses PostgreSQL's default NO ACTION, deletion of a current version fails and the purge transaction cannot achieve the specified result. If it uses SET NULL, a partially retained parent may remain `sent` with no current version, while flows and the pipeline board select `current_version_id` (`:448`, `:462`). These are materially different outcomes for the same accepted narrow purge.
- Required correction: define the FK action and the resulting parent status/current-version behavior for fully purged and partially retained parents. Include a test where the only current version is purgeable and one where a retained older version coexists with a purgeable current one. Keep the role grants and immutable retained versions consistent with that outcome.
- Owner: builder. Verification: revised schema/flow rule and purge tests for those two cases.
- Disposition: before merge.
- Status: open.

### Self-check audit

Applicable to this slice: UNI-02/10/12/13/19; TEN-02/03/05/06/07/09/10; AUTH-01/05/06; LINK-03/07; EVT-06; `PROJECT.md` §9's fixed-limit and system-module rules. PR #31's self-check includes the formerly missing TEN-10 row with named entry points and pending lint evidence. Its TEN-03, TEN-09 and EVT-06 rows remain present. TEN-05 remains an unchanged Phase 1 requirement. No new money or UI rule is proposed. The five Phase 1 items are still builder proposals; Charlie has not decided them.

### Verification performed

| Check | Result |
|---|---|
| Host PR head/base, local head and spec blob | PR #31 head `1f29584792ac76ab9dfebd86da1db2f2f43b8427`, base `bccb846…`; clean builder worktree and spec hash `418d7a60a43617e20bc0c64ac71d8abfec7dff98`. |
| `git diff --check bccb846..1f29584` | No whitespace errors. PR changes the spec and `docs/DECISIONS.md` only. |
| CI on this head | Dependency audit, secret scan, typecheck/lint/test and Image/Trivy/E2E pass. They exercise existing code, not the proposed Phase 1/7/9 controls. |
| Sources | Read `PROJECT.md`, `START.md`, reviewer role, decisions, handoff, relevant guardrails, prior review, spec and PR self-check. No local tests, DB migration, deployment or UI preview were run for this document review. |

### Residual risks and next step
- Better Auth's database-counter atomicity and missing-IP behavior remain source-and-test gates for the Phase 1 plan. Open question 8 (`crm_purge` login versus `SET ROLE`) and the six PR-body owner questions remain open; this review does not decide them.
- The handoff is append-only and its initial fixed sections are stale, but its latest entry pins this same PR head. Repo and host state take precedence for the reviewed target.
- Andy should resolve the P1 and before-merge P2 on a new spec head. Charlie should then run `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again, preferably in Opus 5.5. After an approved exact-hash review, Charlie decides the five proposals and approves the final spec; `setup` reconciles `PROJECT.md` before the Phase 1 plan.

## Round 17 — 2026-10-17 · scope: Phase 1 gate proposal follow-up (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft, updated after Round 16 · hash (`git hash-object`) `3e816bee2c65fe8ef646a41939e89a2d22750c40`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `01a99591fbad27d374a35f624f29f8d5ef7969d5`; the committed blob and clean builder worktree match. Head rechecked at end: yes. Round 16 reviewed hash `03e64025ffa5db54cd4428c1c02fcb7be581b832`; this round checks the correction diff and the effective revision 7 slice against revision 6.

**Verdict:** Revision required  
**Model used:** GPT-6 · **Switch model next step?** Yes — `PROJECT.md` §6 maps deep security/spec review to Opus 5.5. This is a review record, but the corrected exact hash should receive that tier's review before Charlie approves it.

### Round 16 corrections rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P1: SaaS IP header absent from form forwarding | Resolved in the design. Phase 1 must change `forward.ts` to use one derived, edge-set IP, stripping all caller forwarding headers; direct and form requests share a key, with spoofing and missing-header tests. Current code still has the Phase 0 forwarding behavior, which is appropriately named as future work. | Spec `:712`, `:739`, `:1186`; code `apps/web/src/lib/auth/forward.ts:8-17`. Caddy's documented default ignores incoming `X-Forwarded-*` values, matching the stated self-host assumption: [Caddy reverse-proxy docs](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). |
| P1: app OTP counter not atomic | Resolved for app-owned keys. The spec now requires an atomic upsert/conditional update, fixed key order, a single transaction with challenge creation, rollback on any refused key and concurrent tests. Better Auth storage atomicity is an explicit Phase 1 source-and-test gate. | Spec `:713`, `:1186`. |
| P1: TEN-03/TEN-09/EVT-06 absent from self-check | Those three rows are present in PR #31's current self-check with pending implementation tests. The worker schedule, tenant transaction and runtime-role grant test are now named in the spec. A separate TEN-10 omission remains below. | PR #31 body, Self-check; spec `:711`, `:838`, `:1005`, `:1186`, `:1214`. |
| P2: unresolved-link threshold order | Partially resolved. All token states use a pre-resolution gate and the generic-page/429 boundary is explicit. The new reserve/refund algorithm has a concurrency and window-boundary gap below. | Spec `:714`, `:729`, `:794`, `:1186`. |

### Findings

#### [P1] `crm_purge` can mark retained quotation or proposal parents as purged
- Category: security and data-integrity defect; narrow-purge scope mismatch.
- Rule: spec Audit, logging, privacy → Customer purge; TEN-06/TEN-07.
- Evidence: spec `:833` protects any version referenced by an invoice or `version_retention`; `:842-843` grants `crm_purge` UPDATE on `quotation.purged_at` and `proposal.purged_at`; `:857` explicitly gives those UPDATE policies only the workspace predicate, with no purge eligibility condition. The job rechecks under a parent lock at `:861`, but direct role SQL is not bound by that application-level recheck. The behavioural tests at `:860` cover direct DELETE of protected versions and direct UPDATE of customers, not direct UPDATE of these parents.
- Failure scenario: under `withWorkspace(A)`, `crm_purge` runs `UPDATE quotation SET purged_at = now() WHERE id = <quote with a retained, invoice-sourced version>`. The grant and policy allow the update, even though the version is not purgeable. The same holds for a proposal with an approved version.
- Why it matters: the dedicated purge role can falsely mark a live or legally retained parent as purged, outside the accepted narrow purge scope. A later read that filters on `purged_at` may hide it or invalidate a live flow while the protected version still exists.
- Required correction: constrain the `purged_at` transition at the database boundary to the intended purge outcome, including the case where some versions of a parent must be retained; preserve the parent-row lock used for race safety. Add direct-role tests for a retained/invoice-referenced version and an eligible parent, asserting the former update is refused and the latter works only in the permitted purge transaction.
- Owner: builder. Verification: inspect grants, policy/trigger or narrow function, and the forced direct-role tests in the revised spec; implementation tests use the real `crm_purge` role.
- Status: open.

#### [P1] TEN-10 is still absent from the PR self-check
- Category: guardrail review coverage.
- Rule: reviewer role §3; TEN-10.
- Evidence: the new app limiter and cleanup job access the no-RLS rate-limit table through the allow-listed system module (spec `:711`); `PROJECT.md` §9 defines the lint-enforced system-module exception, and TEN-10 requires it. PR #31's updated self-check adds TEN-03, TEN-09 and EVT-06, but has no TEN-10 row. Round 16's independent applicability list already included TEN-10; this omission was not called out in that round.
- Failure scenario: the Phase 1 plan treats the counter table as generally accessible outside `withWorkspace()` instead of limiting direct access to the named system module; the project-specific lint boundary is not reviewed for the new path.
- Why it matters: reviewer role §3 makes an applicable rule missing from the self-check a P1, regardless of whether the spec text itself appears compliant.
- Required correction: add a TEN-10 row that names the limiter/cleanup system-module entry points, the lint-enforced allow-list and the Phase 1 test or lint evidence; mark future checks pending.
- Owner: builder. Verification: compare the updated self-check with the spec and TEN-10.
- Status: open.

#### [P2 · before merge] The non-resolving gate's reservation is not tied to its window
- Category: resilience and testability defect.
- Rule: Security → Rate limits → Order on client link requests.
- Evidence: spec `:714` says every link request consumes one unit of a 20/hour non-resolving-IP counter before resolution, then gives it back with an atomic decrement when a token resolves. It does not require the decrement to address the same window that was consumed. The `:1186` concurrency test covers bursts one below the cap and a window boundary for app counters, but not a valid-link resolution delayed across that boundary or concurrent valid and invalid requests while the provisional count is full.
- Failure scenario: a valid request reserves the last slot in window W, resolution waits until W+1 starts, and another request opens W+1's counter. A decrement by IP key alone can subtract from W+1, leaving an extra allowance there. While the valid request is pending, an invalid request can also get `429` even though fewer than 20 non-resolving attempts have completed.
- Why it matters: the stated 20/hour bound and the test's exact threshold behavior depend on how provisional reservations are accounted for under concurrency and expiry.
- Required correction: specify a reservation or counter update scoped to the original window, and define whether pending valid requests may temporarily occupy capacity. Test a valid resolution delayed across the boundary and a valid/invalid interleaving at 19 of 20; assert the chosen counting and response behavior exactly.
- Owner: builder. Verification: revised algorithm and forced Testcontainers interleavings at the threshold/window boundary.
- Disposition: before merge.
- Status: open.

### Self-check audit

Applicable to this correction slice: UNI-02/10/12/13/19; TEN-02/03/05/06/07/09/10; AUTH-01/05/06; LINK-03/07; EVT-06; `PROJECT.md` §9's fixed-limit and system-module rules. PR #31 has a self-check. Its new TEN-03/TEN-09/EVT-06 rows match the revised spec and mark tests pending. TEN-10 is applicable and missing as found above. TEN-05, RLS `ENABLE` and `FORCE`, remains an unchanged requirement with the existing schema/Phase 1 test; no new deviation was found. No money, payment, file or UI rule changes in this slice. Charlie has not accepted any of the five proposals; the review does not decide them.

### Verification performed

| Check | Result |
|---|---|
| PR #31 host head/base and local committed blob | Head `01a99591fbad27d374a35f624f29f8d5ef7969d5`, base `bccb846…`; spec blob and clean builder worktree both hash to `3e816bee2c65fe8ef646a41939e89a2d22750c40`. Head rechecked at the end. |
| `git diff ed0ead7..01a9959` and `git diff --check bccb846...01a9959` | Inspected correction hunks; no whitespace errors. Effective PR changes only the spec and decisions log. |
| PR #31 CI on this head | Dependency audit, secret scan, typecheck/lint/test and Image/Trivy/E2E pass. They exercise current code, not the proposed Phase 1/7/9 controls. |
| Project, prior review, guardrails, spec, decisions and Phase 0 auth forwarding | Read; compared each Round 16 finding with the new lines. No local tests, DB tests, deployment or UI preview were run for this document review. |

### Residual risks and test gaps
- Better Auth 1.7.6's database-counter implementation and missing-IP behavior remain source checks in the Phase 1 plan; the installed package was unavailable in this checkout. The spec provides a custom-storage fallback and test gate.
- Open question 8 (`crm_purge` login versus `SET ROLE`) is explicitly due in the Phase 1 plan. The six PR-body owner questions on limits, archiving and purge behavior remain unanswered. They cannot be treated as approved values.
- This is a revision 7 slice review. The revision 6 approval at hash `0b406896…` remains valid; no production behavior was verified.

### Required before approval
- Andy resolves both P1s and the before-merge P2 on a new spec/PR head. Charlie then runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again, preferably in the project's Opus 5.5 deep tier. After an approved exact-hash review, Charlie decides the five proposals and approves the final spec; `setup` reconciles `PROJECT.md` before the Phase 1 plan.

## Round 16 — 2026-10-17 · scope: Phase 1 gate proposal slice (PR #31)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 7 draft · hash (`git hash-object`) `03e64025ffa5db54cd4428c1c02fcb7be581b832`.
- **Pin:** PR #31 base `bccb846248f4d21f62c4dc21a3e5a15eef415b89`, head `ed0ead751e68d827c7620cfdd4c397ccd110bd86`; committed blob and clean builder worktree have the same spec hash. Head rechecked at end: yes. Diff: spec and `docs/DECISIONS.md` only. Revision 6 at hash `0b4068967dd767addfcc791587317d4445ee4159` remains the approved baseline.

**Verdict:** Revision required  
**Model used:** GPT-6 · **Switch model next step?** Yes — the project maps deep spec/security review to Opus 5.5; use it for the revised exact hash before Charlie approves.

### Findings

#### [P1] The selected SaaS client-IP header is absent from the form forwarding path
- Category: spec/implementation mismatch; rate-limit security.
- Rule: AUTH-06, LINK-03; spec Security → Rate limits.
- Evidence: spec `:711` chooses `CF-Connecting-IP` behind the Cloudflare Tunnel and states that the server-action path `apps/web/src/lib/auth/forward.ts` forwards the selected header. That file `:8-17` forwards `x-forwarded-for` but not `cf-connecting-ip`; `:33-45` passes only that selected list into Better Auth's handler. The new verification paragraph at spec `:1183` tests counters across processes, but not parity between direct `/api/auth/*` requests and the form path or spoofed headers.
- Failure scenario: Phase 1 configures Better Auth to key SaaS auth limits from `CF-Connecting-IP`. Direct auth requests have that header, while form submissions forwarded by `postToAuth` do not; they are keyed differently or fall back to an absent/shared IP. If a deployment instead accepts a caller-supplied `X-Forwarded-For`, an attacker can rotate it to evade the per-IP cap.
- Why it matters: the proposed numbers are not a reliable bound unless both entry paths derive the same canonical, trusted client address.
- Required correction: make the spec explicitly require the Phase 1 change to `forward.ts`, define the trusted proxy/header configuration for SaaS and self-host, discard caller-supplied forwarding headers at the edge, and test a direct auth request and a form submit from the same IP against one counter, including a forged-header attempt.
- Owner: builder. Verification: inspect the revised contract and its named integration tests; at implementation, run both paths behind the configured proxies.
- Status: open.

#### [P1] Concurrent requests can exceed the app-owned OTP caps
- Category: material security risk; incomplete testable control.
- Rule: AUTH-06, LINK-03, LINK-07; spec Security → Rate limits.
- Evidence: spec `:711` assigns per-account, per-link and per-contact limits to a new app limiter sharing Better Auth's table; `:727-734` caps OTP challenges and guesses, and `:1183` tests persistence across two processes and restart. It does not require atomic check-and-increment or a concurrent-request test. Better Auth's own rate-limit documentation explicitly requires a custom storage `consume` operation to check and increment atomically; that does not establish atomicity for this separate app limiter. [Better Auth rate-limit documentation](https://better-auth.com/docs/concepts/rate-limit).
- Failure scenario: two web processes read a per-link count of 2 under a cap of 3 at the same time; both permit an OTP issue and each writes 3. Repeated parallel requests can issue more challenges than the stated 10/day bound.
- Why it matters: the OTP re-issue cap and stated guessing bound rely on the counter being a real concurrent bound, not only a sequential one.
- Required correction: specify an atomic database consume operation for every app-owned key, with all relevant keys (link, contact, IP and spacing) checked consistently before issuing a challenge; add forced concurrent requests from two web processes at each cap, asserting at most the remaining allowance succeeds.
- Owner: builder. Verification: revised spec names the atomic operation and race cases; Phase 7 tests exercise them with a real database.
- Status: open.

#### [P1] Applicable guardrails are missing from PR #31's self-check
- Category: guardrail review coverage.
- Rule: reviewer role §3; TEN-03, TEN-09, EVT-06.
- Evidence: PR #31's self-check covers UNI-10, TEN-02/06/07 and auth/link rules but has no row for TEN-03 (the new no-DELETE/UPDATE archive decision at spec `:1002`), TEN-09 (the new `crm_purge` policy and `withWorkspace()` contract at `:835-857`) or EVT-06 (the new daily counter-cleanup worker job at `:711`). These are applicable to the changed scope, even if the proposed behavior appears consistent with them.
- Failure scenario: the Phase 1 plan copies the table as proof and omits the tenant transaction context or schedules the cleanup through HTTP; an unreviewed grants design also weakens the append-only guarantee.
- Why it matters: reviewer role §3 classifies a missing applicable rule in the builder's self-check as P1; the table is part of the gate evidence.
- Required correction: add those three rows with exact spec evidence and phase timing; mark future implementation tests pending, not passed.
- Owner: builder. Verification: recheck the PR's self-check against the revised spec and the relevant guardrail packs.
- Status: open.

#### [P2 · before merge] The link-limit promise conflicts with the separate unresolved-link threshold
- Category: spec consistency and testability.
- Rule: Security → Rate limits; Anonymous access.
- Evidence: spec `:724-726` gives valid link views 60 per 10 minutes per IP and 200 per day per link, but unresolved links 20 per hour per IP. At `:735` it says counting never depends on whether a link exists and that the `429` reveals nothing; `:791` and `:795` require every unresolved link to show the same generic page/status; `:1183` checks only the `429` body. After 21 requests in an hour, an unknown token can return `429` while a revoked/superseded or valid token may be subject to another counter depending on resolution.
- Failure scenario: two builders put the unresolved-link limit before versus after resolution and produce different statuses for unknown, revoked and expired tokens, while each can claim to follow one part of the spec. The proposed test does not settle which behavior is required.
- Why it matters: the anonymous-link response and rate-limit requirements cannot be implemented or verified consistently as written.
- Required correction: define which IP counter runs before token resolution, how all non-resolving states share it, and whether the generic-page guarantee excludes rate-limited requests. Make the response/status test cover the threshold transition, not just body equality.
- Owner: builder. Verification: a test forces unknown, revoked and expired tokens past the same threshold and checks their exact statuses and bodies.
- Disposition: before merge.
- Status: open.

### Self-check audit

Applicable to this slice: UNI-02/10/12/13/19; TEN-02/03/05/06/07/09/10; AUTH-01/05/06; LINK-03/07; EVT-06; the project's fixed-limit location and Phase 1 plan gate. No new money, payment, file or UI rule is proposed. PR #31 has a self-check, so it is not Blocked; the three omissions above are the P1 coverage finding. The TEN-07 restrictive-plus-permissive shape agrees with PostgreSQL's policy-combination semantics, and the `share_link_resolve` role remains outside the restrictive policy. [PostgreSQL 17 row-security documentation](https://www.postgresql.org/docs/17/ddl-rowsecurity.html). The archive-job removal resolves the identified append-only conflict in principle. Charlie has not decided the five proposals; this review makes no owner choice.

### Verification performed

| Check | Result |
|---|---|
| `gh pr view 31 --json …` at start and end | Open; head remained `ed0ead751e68d827c7620cfdd4c397ccd110bd86`, base `bccb846…`. |
| `git hash-object` on the builder worktree and `git show ed0ead7:<spec> \| git hash-object --stdin` | Both `03e64025ffa5db54cd4428c1c02fcb7be581b832`; builder worktree clean. |
| `git diff --check bccb846...ed0ead7` | Clean. Diff is two document files, +90/−15 lines. |
| GitHub PR #31 checks | Dependency audit, image/Trivy/E2E, secret scan and typecheck/lint/test pass on this head. These validate current code, not the proposed Phase 1 controls. |
| Spec/decisions/guardrails/current auth forwarding | Read the changed sections, `PROJECT.md` §9/§11, prior spec Round 15, relevant packs and `forward.ts`. No code tests or deployment check were run for this document review. |

### Residual risks and test gaps
- The six PR-body questions about OTP volumes, Turnstile-off limits, link views, archiving, purge audit writer and issued-document checks still require Charlie's own decisions after the blocking corrections. This round does not approve the proposed values.
- The installed Better Auth 1.7.6 source was unavailable in this checkout. Current official documentation supports database storage and custom path rules, but version-specific behavior remains to be pinned in the Phase 1 plan.
- The prior Round 15 approval of revision 6 remains valid for its exact hash. This round reviews only revision 7's Phase 1 gate slice, not the unchanged full spec or production behavior.

### Required before approval
- Andy addresses the three P1 findings and the before-merge P2 in a new spec/PR head, then Charlie runs `review spec docs/superpowers/specs/2026-09-27-core-sales-design.md` again. Use the project's deep model tier (Opus 5.5) for the revised security/RLS review. Charlie then decides the proposals and approves the final exact hash before `setup` reconciles it.

## Round 15 — 2026-10-16 · scope: exact-hash approval-record follow-up (PR #29)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 6 APPROVED · hash (`git hash-object`) `0b4068967dd767addfcc791587317d4445ee4159`.
- **Pin:** PR #29 base and merge base `21507058293ca5d70d62e631eac6bde8d6a134f4`, head `24317ab7168746cf686c84e32583215dcb9f2cc2`. The clean builder worktree and committed head have the same spec hash. Round 14 approved the rule body at `c826f3ad87558ca9b1d8de2125569ad24fe6a464`; this round checks the four approval-record edits between those blobs.

**Verdict:** Approved  
**Model used:** GPT-6 · **Switch model next step?** No; this is an exact-hash approval-record check, and Round 11 was the independent Opus 5.5 full-spec review.

### Findings

No new P0, P1 or P2 finding. The spec diff from Round 14 changes exactly the title (`:1`), Status approval record (`:3`) and Current gates paragraph (`:1053`); `docs/DECISIONS.md` adds one approval line. R6, Stage 3's pre-cutover gate, the Phase 4 professional-check deadline, data model, flows, milestones and verification cases are unchanged. The new Status quotes Charlie's “yes” to the builder's explicit “Do you approve revision 6?” question after Round 14. The decisions entry and handoff give the same provenance; Bob cannot independently see that Andy-session exchange, so this check rests on the recorded owner answer rather than an invented one. The current gate text correctly puts merge after green CI and `setup` after merge to reconcile the final hash.

#### [P3] PR body has stale hash and revision labels
- Category: documentation polish.
- Rule: exact revision and gate provenance.
- Evidence: PR #29's top status block names head `24317ab` and hash `0b406896…`, but its “Gates” section still says `c826f3ad…` is the hash “on this head”; its “What” section still says the Current gates label is revision 5. The spec itself now labels Current gates revision 6 (`:1053`) and has the new hash above. The PR title also still says revision 5, reflecting the first hosting draft. The old approval-record clause at spec `:3` says the 2026-10-11 record changed only gate (a), while that older amendment actually touched gates (a)–(e) (Round 12 P3); it is historical and does not alter this approval.
- Failure scenario: a reader using the PR body alone cites the prior reviewed blob or an old revision label. The current head/status block and spec record the correct hash and approval.
- Why it matters: provenance is easier to follow when every PR summary names the final blob consistently; this is not a change to an operative rule.
- Required correction: refresh the PR body before merge to identify the final hash and revision 6 throughout. Leave the historical spec clause for a later reviewed spec edit if desired; changing it now would create another hash and require another spec review.
- Owner: builder.
- Verification: PR body hash, title and revision labels match the final head and spec.
- Status: open, nonblocking.

### Applicability and verification

- Scope is approval provenance and exact-hash consistency. The Round 14 applicability check of UNI-07, UNI-12, UNI-13, TEN-01, TEN-02, TEN-09 and EVT-01 remains valid because the hosting rule body and PR self-check table did not change. The phase-specific owner choices remain deferred at their named gates.
- `git diff 223c6ee..24317ab` contains three spec-line replacements and one decisions-log line; `git diff --check` passes. `git show 24317ab:<spec> | git hash-object --stdin` and the clean builder worktree both return `0b4068967dd767addfcc791587317d4445ee4159`.
- GitHub PR #29 still has its current head at `24317ab`. At the final check, dependency audit, secret scan and typecheck/lint/test pass; Image/Trivy/E2E is pending. No code tests or deployment checks were run locally for this document-only follow-up. Required CI must be green before merge (UNI-13).

### Next step

The owner approval is recorded. Once PR #29's required CI is green, Charlie can merge it. Then run `setup` to reconcile `agents/PROJECT.md` and `CLAUDE.md` to this exact final spec hash before `build` relies on the hosting revision.

## Round 14 — 2026-10-16 · scope: revision 6 follow-up to hosting slice (PR #29)
- **Spec reviewed:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 6 draft · hash (`git hash-object`) `c826f3ad87558ca9b1d8de2125569ad24fe6a464`.
- **Pin:** PR #29 base `21507058293ca5d70d62e631eac6bde8d6a134f4`, head `223c6ee8dc7eb4c9db060ee4f817d1abb8525747`, merge base `21507058293ca5d70d62e631eac6bde8d6a134f4`. The clean builder worktree and committed head have the same spec hash. The effective diff is only the spec and `docs/DECISIONS.md`.

**Verdict:** Approved  
**Model used:** GPT-6 · **Switch model next step?** No for the approval-record and setup steps; Round 11 supplied the Opus 5.5 full-body review. This is a narrow follow-up, not a new pre-production review.

### Round 13 findings rechecked

| Prior finding | Result | Evidence |
|---|---|---|
| P1: chosen-provider test impossible in Phase 1 | Resolved. R6 now puts only the local PgBouncer maintenance cycle and `crm_worker` grant checks in Phase 1. Stage 3 has a named provider-specific gate on a staging instance before live traffic moves; it checks pooled/direct connections, migrations, roles/grants and RLS isolation, pg-boss and rollback behavior, PITR and restore, and the privacy locations. | Spec `:953`, `:962`, Phase 1 done-when `:1009`; revision 5 → 6 diff. |
| P1: database/job rules missing from PR self-check | Resolved. The PR table now includes TEN-01, TEN-02, TEN-09 and EVT-01, each explicitly pending the chosen-provider gate rather than claiming a passed test. Existing contracts remain in the spec. | PR #29 body, Self-check; spec `:380`, `:962`. |
| P2: cross-border and backup-location deadline | Resolved. The hosting item and both decisions entries refer to the existing professional check before Phase 4 goes live for the Malaysia host and R2 backup location; the Stage 3 location is checked before cutover; the separate Phase 9 purge check remains. The R2 backup location must be stated for the professional check. | Spec `:48`, `:962`, `:1044-1049`; decisions entries dated 2026-10-15 and 2026-10-16. |
| P2: VPS gate simultaneously met and unmet | Resolved in the live spec text. The introduction and item 3 both say the VPS choice is met; old unmet text is identified as history. Current gates distinguish revision 4's completed review, approval and setup from revisions 5–6, which still need review, owner approval and reconcile. | Spec `:994`, `:1000`, `:1053`. |

### [P3] The PR description and one gate label still carry revision 5 wording
- Category: documentation polish.
- Rule: exact revision and gate provenance.
- Evidence: PR #29's latest status block identifies the current head and Round 13 fixes, but its “What” section still calls the spec revision 5 and its “Not changed / not decided” section still says the PDPA check is due before Phase 9. The current-gates paragraph in the spec at `:1053` labels itself “v4.7 revision 5” before correctly describing pending revisions 5 and 6. The older approval-record line at `:3` also retains Round 12's P3 wording about changing only gate (a).
- Failure scenario: a reader skimming the PR body or the gate label misses the corrected deadline or mistakes the reviewed revision number. The current spec's operative Stage 2/3 gates and professional-check deadline are clear.
- Why it matters: the PR and status text should match the exact reviewed blob, but this does not change the deployment criteria or the spec approval gate.
- Required correction: refresh the PR body to revision 6 and the pre-Phase-4/pre-cutover privacy deadlines; change the current-gates label to revision 6 and clean up Round 12's approval-record provenance when the spec next needs a reviewed edit. A spec-file edit creates a new hash and needs another spec review.
- Owner: builder.
- Verification: compare the updated description/labels with this head and the operative spec sections.
- Status: open, nonblocking.

### Applicability, checks and limits

- Applicable to this hosting revision: UNI-07, UNI-12, UNI-13, TEN-01, TEN-02, TEN-09, EVT-01, the recorded owner decision, the Phase 4 professional gate and the Stage 3 cutover gate. PR #29's self-check covers these. Other ticked UI, money, record, auth, link, file and payment behavior is unchanged from the reviewed revision 4 body. UNI-08 and UNI-16 apply when the host is actually deployed; this document PR changes no production secrets or runbook. There is no Stage 2/3 runbook yet; the only current runbook is the Phase 0 auth/database runbook.
- `git diff --name-status` shows only the spec and decisions log; `git diff --check` is clean. The spec blob at the PR head and in the clean builder worktree both hash to `c826f3ad87558ca9b1d8de2125569ad24fe6a464`.
- GitHub checks on this head: dependency audit, secret scan, and typecheck/lint/test pass; Image/Trivy/E2E remains pending at review time. Do not merge while required CI is pending or failing (UNI-13). No code tests, deployment or provider restore were run in this document review; the provider remains unchosen by Charlie's decision.
- Phase 1, 4, 5 and 7 decisions previously deferred by Round 11 remain open at their named plan gates. This verdict approves this hosting spec slice only; it does not decide them or choose a Stage 3 provider.

### Next step

Charlie can approve revision 6 in his own words after this review. Then run `setup` to reconcile `agents/PROJECT.md` and `CLAUDE.md` to this exact spec hash before `build`. PR #29 merge still requires its CI to finish green and the normal owner merge action.

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
