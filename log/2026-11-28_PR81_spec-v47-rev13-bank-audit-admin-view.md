# PR 81 — docs: spec v4.7 revision 13: bank audit keeps the last 4 characters, Admins may view bank details and the QR

- **Merged:** 2026-11-28T03:19:01Z · **Merge commit:** 826f70dbc22cda53990849b95120b689e0dc5b55 · **Branch:** docs/spec-bank-audit-qr-view
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-81.receipt` on agent-logs (review commit ca44b51, receipt commit bbeca0f; written 2026-11-28T03:16:25Z, 2 minutes 36 seconds before the merge; head 733aae4, review-file hash 882cb297…)
- **Merge evidence:** `gh pr view 81` state MERGED at the time above; the merge commit is reachable from fetched `origin/main`, has parents b0dbc52 and 733aae4, and has the same tree as 733aae4. Final head 733aae4109fc5525401275bef028d71c944b8fea equals the reviewed head. CI run 46012894436 on that head: the docs-only jobs passed, image and E2E skipped.
- **Drafted by:** Of the 13 commits, 10 name Opus 5.5, 2 name Sonnet 5.5 and 1 names both (trailers); revisions 12 and 13 were drafted by an Opus 5.5 sub-agent, then checked and committed by Andy (Sonnet 5.5) · **Final verdict:** Approved with conditions (round 3)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 13 (hash `bf633eb3850c101134e682d4cea21dcc19cd93af`) · **Plan:** none · **Milestone:** between Phase 2 and Phase 3

## What changed
Spec revision 13 and its decisions log entries; documents only, no code. The bank-details change audit entry keeps the account number's last 4 characters (4 or fewer are kept whole), with no hash. Admins may view, not change, the bank details and the payment QR with 2FA turned on; the QR preview is a scoped FILE-04 alternative with a 1-hour private browser copy that must be revalidated once stale. The client link 30-day default stays, to be confirmed before the Phase 7 plan.

## Why
Brings the owner's answers on the bank audit and on Admin viewing into the spec before the Bank settings follow-up is built. Spec reviews: Round 29 (rev 10), Round 30 (rev 11) and Round 31 (rev 12) returned Revision required; Round 32 returned Approved with conditions for revision 13.

## Review rounds
- R1: [P1] Add the missing delivery, secret-scan and client-link self-check rows → UNI-07, UNI-13 and LINK-02 rows added to the PR description; head unchanged.
- R1: [P2] Carry forward the Unicode audit-mask fix → deferred (below).
- R2: Approved with conditions; R1 P1 resolved; no new findings.
- R3: Approved with conditions, same head; no new findings.

## Deferred conditions
- Unicode audit mask (PR R1 and spec Round 32, P2): `value.slice(-4)` can split a character, so the audit write and settings save can fail. Use the last 4 whole code points, keep the `last4` shape and no hash, add a synthetic regression test on a settings change. To the Bank settings Admin-view and QR revalidation implementation PR.

## Decisions worth keeping
- Owner approval of spec revision 13: Charlie, 2026-11-28, "I approve spec revision 13", in the Andy session after `approved 81` and before the merge. Not yet in `docs/DECISIONS.md`; the spec's Status text on `main` still says draft.
- The 2026-11-27 decisions log entries hold the owner's replies on the audit mask and both expiries.
- Round 32 rulings: no new `"[pii]"` exception for the 4-character fragment; the stale-copy test method is chosen in the code PR if it exercises a stale response and an unreachable origin and asserts the route header.

## Follow-ups
- Next reviewed PR: record the approval in `docs/DECISIONS.md` and relabel the spec Status.
- `setup`: reconcile `agents/PROJECT.md` (including the §11 "line 803" item and the Phase 7 gate) and `CLAUDE.md` to the approved spec before `build`.
- Implementation PR: QR route `must-revalidate`; Admin view of bank details and QR with the 2FA check; Unicode-safe mask; owner email job reads changed column names only; their tests.

## Appendix — final review round

## Round 3 — 2026-11-28 · scope: confirm the approved docs-only head

- **Code review:** base and merge base `b0dbc52579fb7492571fa2e6e56e0466c62636b8` · head `733aae4109fc5525401275bef028d71c944b8fea` · head re-checked at end: yes.
- **Spec:** CRM v4.7 revision 13, blob `bf633eb3850c101134e682d4cea21dcc19cd93af`. Companion decision blob `b3902cd5613ff01686f0c0bd1b687e619d732e93`. The PR is open.
- **Reviewer:** Bob · **Builder:** Andy.

### Findings

The Round 1 P1 remains resolved. The Unicode audit-mask P2 remains deferred to the Bank settings Admin-view and QR revalidation implementation PR. This recheck found no new issues.

### Self-check audit

The PR description still has the UNI-07, UNI-13 and LINK-02 rows and names the Unicode follow-up. Other applicability judgments carry forward from Round 2.

### Verification performed

- Re-fetched the base and head, checked their merge base and verified the spec and decisions in a clean detached checkout. The two hashes match Round 2. `git diff --check` and change-filter syntax passed. The filter returned `false` for the Markdown-only diff.
- Exact-head CI run `46012894436` remains successful. All required docs-only jobs passed. Image and browser checks skipped under the docs-only filter. Used CI for executable verification and did not rerun application or browser tests locally.

### Required before merge

- Owner approval of revision 13 and an `approved 81` receipt. No pre-merge receipt was found on the fetched log branch at review time.

### Deferred conditions

- Use the last four whole Unicode code points and verify the audit write with a synthetic regression case in the Bank settings Admin-view and QR revalidation implementation PR.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for recording the receipt.

**Verdict:** Approved with conditions
