# PR 20 — chore(setup): reconcile PROJECT.md to approved spec v4.7 (eb89f4ab)

- **Merged:** 2026-10-12T08:38:48Z (GitHub) · **Merge commit:** `585df094b5b59d1b7b713f794f50a445468e2545` · **Branch:** `chore/setup-reconcile-v4-7` (final head `2d842aca31a49d6414cc13c910e55035ee5181a0`)
- **Gate breaches:** none. The final review round's head SHA (`2d842ac…`) equals the PR's final head SHA. The receipt was written before the merge (receipt commit `01da24b`, 2026-10-12T08:29:56Z; merge 2026-10-12T08:38:48Z).
- **Approval receipt:** `reviews/PR-20.receipt` on `agent-logs`, commit `01da24b` (reviewed head `2d842aca31a49d6414cc13c910e55035ee5181a0`; review-file hash `af3a8fd7e11b1956a51ea8e716e3eb52951fa8d8`; review committed in `19ea1e59a089e87d622445b4c5f3944da449a970`).
- **Merge evidence:** `gh pr view 20` → state MERGED, merge commit above; `git merge-base --is-ancestor 585df09 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-12).
- **Drafted by:** Claude Sonnet 5.5 (drafting and comparison by read-only Opus 5.5 sub-agents) · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 4, approved, hash `eb89f4ab817c79c536cd36f8aef7c643a059d697` · **Plan:** `docs/superpowers/plans/2026-09-29-phase-0-foundation.md` · **Milestone:** Phase 0 (setup reconcile)

## What changed
`agents/PROJECT.md` §2 now holds the v4.7 spec hash. §9 has the new money and payment rules and the REC-01 (a) list with payment and receipt voids. §11 lists the Phase 1, 4, 5 and 7 gates. `docs/DECISIONS.md` records Charlie's 2026-10-12 confirmation of Bob's Round 11 rulings.

## Why
Kit gate order: spec approved, then `setup` reconciles `PROJECT.md`. The approved spec's Current gates item (a) says `setup` records Bob's TEN-02, REC-01 and AUTH-01 rulings with Charlie's confirmation.

## Review rounds
- R1 (2026-10-12, Revision required): [P1] the PR self-check left out the guardrail rules this reconcile changes. Fixed: rule-by-rule table in the PR body.
- R1: [P2] Charlie's confirmation of the three rulings was missing. Fixed in `2d842ac`: Charlie answered in his own words ("1 yes, 2 yes, 3 yes, with the stated safeguards and the PDPA check before Phase 9."). TEN-02, REC-01 (a) and AUTH-01 are conforming. REC-01 (b) is an owner-accepted exception.
- R1: [P3] the spec provenance said the wrong gates. Fixed in `90f3601`: gates (a)-(e).
- R2 (2026-10-12, **Approved**): no open P0-P2. One non-blocking P3: the three 2026-10-03 entries still say "Bob to rule" in "Alternatives rejected". NOT fixed (`approved` forbids changing the PR); recorded here.

## Deferred conditions
- Phase 1, 4, 5 and 7 policy gates stay due before their first plan PRs (`agents/PROJECT.md` §11).
- The PDPA professional check is due before Phase 9 (REC-01 (b)).
- An exact-hash spec review (`eb89f4ab…`) is due before ordinary `build`, unless Charlie rules otherwise. His 2026-10-10 ruling already waives it for Phase 0 PR 2, tasks 6-10.

## Decisions worth keeping
- Recorded in `docs/DECISIONS.md` (2026-10-12 entry "Charlie confirms Bob's Round 11 rulings on TEN-02, REC-01 and AUTH-01; REC-01 (b) owner-accepted"), now on `main`.
- The reviewer cannot accept a hard-rule exception. Only Charlie can, in his own words.

## Follow-ups
- Separate small PR: three `CLAUDE.md` lines (Source of truth to v4.7; Status bullet; plan and next-step bullet), with a DECISIONS entry. Charlie approved this ("3 yes"). Nothing inside the `agent-kit` markers changes.
- Refresh the three "Bob to rule" alternatives lines in `docs/DECISIONS.md` (Bob R2 P3). Bob optional: phrase `agents/PROJECT.md:213` "is implemented as one fixed link-action wrapper" as a future requirement until Phase 7.
- Then `build` (Phase 0 PR 2, tasks 6-10). Charlie must type `build`. UI tasks later: emilkowalski/skills first, then smoothui.dev, then ui.shadcn.com.
- Add the UI-kit direction and "why PostgreSQL" to `docs/DECISIONS.md` through a reviewed PR.
- Cleanup needing Charlie's OK: merged worktrees under `.agent/worktrees/` and many merged local branches (including `chore/setup-reconcile-v4-7`).

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-20.md (that file is local only). -->

## Round 2 — 2026-10-12 · scope: setup reconcile slice
- **Code review:** base (merge base) `98f8675be57a3f352580e2eff869b0996fa7ac05` · head `2d842aca31a49d6414cc13c910e55035ee5181a0` · head re-checked at end: yes, PR still open
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 approved revision 4 · hash (`git hash-object`) `eb89f4ab817c79c536cd36f8aef7c643a059d697`, matching `agents/PROJECT.md` §2

**Verdict:** Approved
**Model used:** GPT-6 (the project maps standard and deep reviews to Opus 5.5) · **Switch model next step?** Yes, if strict adherence to the project's model mapping is wanted for the next review; this round's evidence is pinned below.

### Findings

Round 1's P1 and P2 are resolved. The PR body's self-check now gives rule-specific rows for the changed tenancy, finalized-record, auth, money, payment and universal controls; open Phase 1 and 7 policies are marked OPEN. `agents/PROJECT.md:208-213` and `docs/DECISIONS.md:6-13` record the TEN-02, REC-01(a) and AUTH-01 conforming rulings with their tests and wrapper conditions, and the narrow REC-01(b) owner-accepted exception with the Phase 9 PDPA check. The former "Proposed" header is gone. Round 1's provenance P3 is also fixed in `agents/PROJECT.md:28`, and the handoff Git block matches the current head and main.

### [P3] Historical decisions entries still say "Bob to rule"
- Category: documentation consistency
- Evidence: the 2026-10-03 AUTH-01, REC-01 and TEN-02 entries now have headings, rulings and owner-confirmation fields, but each retains `- **Alternatives rejected:** none recorded yet; Bob to rule.` (`docs/DECISIONS.md:204`, `:214`, `:224`). The new 2026-10-12 entry records Bob's ruling and Charlie's confirmation (`:6-13`).
- Failure scenario: a reader of the historical entries thinks the reviewer decision is still pending.
- Why it matters: the authoritative decision and current `PROJECT.md` are clear, so the impact is limited to stale history text.
- Required correction: builder refreshes those three alternatives lines to say the proposal had no recorded alternative, with the later ruling and confirmation linked; do not change the recorded owner choice.
- Owner: builder
- Verification: no 2026-10-03 entry still asks Bob to rule on these three items.
- Status: open (non-blocking)

### Self-check audit
I compared the updated two-file diff with the approved spec, Round 11 review, decisions log and applicable universal, tenancy, money, finalized-records, auth, public-links, events-jobs and payments packs. UI, files, provider checkout and deployment implementation rules are n-a for this documentation reconcile.

| Rule / area | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| TEN-02/TEN-07, REC-01/03/11, AUTH-01/09, MON-04/07, PAY-01, UNI-10/19 | Yes; §9 and §11 restate these controls and gates. | Rule-specific pass or OPEN, with locations. | The three conforming rulings are conditional as Round 11 required; REC-01(b) is separately owner-accepted; the later phase policies remain OPEN. | `agents/PROJECT.md:180-190`, `:208-221`, `:243-247`; `docs/DECISIONS.md:6-13`; SPEC Round 11. | None. |
| MON-02/05/06 | Yes; carried currency and rounding rules are restated. | pass | Existing currency rules retained; payment void added to the accepted rounding-gap wording. | `agents/PROJECT.md:181-190`; spec Money rules. | None. |
| UNI-02, UNI-07, UNI-12 | Yes; project facts and two project-local documents changed. | pass | Values and conditions trace to the spec and owner record; no secret in the diff. | Three-dot diff; secret-scan CI pass. | None. |
| UNI-13 | Yes; exact-head CI must pass. | pending CI | Typecheck/lint/test/build, dependency audit and secret scan passed at `2d842aca`. | PR #20 check rollup; `.github/workflows/ci.yml`. | PR body row is stale, non-blocking. |
| UNI-14 | n-a; no dependency or lockfile change. | n-a | Correct. | `git diff --name-status`. | None. |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 20 --json ...`; `git fetch origin`; `git merge-base` | PR open; base and merge base `98f8675be57a3f352580e2eff869b0996fa7ac05`; head `2d842aca31a49d6414cc13c910e55035ee5181a0`. |
| Detached checkout `.agent/worktrees/review-20-2d842aca`; diff from Round 1 head and full three-dot stat/name-status/log | Three commits total; `agents/PROJECT.md` and `docs/DECISIONS.md` changed. The new commits fix provenance and record the hard-rule rulings. |
| `git hash-object <spec>`; `rg` for unresolved placeholders and pending-ruling labels | Hash `eb89f4ab817c79c536cd36f8aef7c643a059d697` matches §2; no double-brace placeholders or "awaiting Bob's ruling" labels in the current rule records. |
| Read the current §9/§11, new decision entry, revised 2026-10-03 entries, approved spec gate and Round 11 | Conditions and scope match; P3 historical alternatives text remains. |
| `gh pr checks 20`; CI workflow read | Three checks passed for this exact head. The checks job includes typecheck, lint, tests and build. No local tests run for this document review. |
| Final `gh pr view 20`; detached checkout `git status --untracked-files=no --short` | PR still open at the same head; no tracked checkout changes. |

### Residual risks and test gaps
- The recorded owner quote is attributed to Charlie's Andy session. I did not see that session directly; the quote, new decisions entry and current `PROJECT.md` agree in the available evidence.
- The ordinary `build` spec gate still needs a review round for the final approved spec hash `eb89f4ab…`, unless Charlie explicitly rules otherwise. The prior waiver covers only Phase 0 PR 2 tasks 6–10.
- No local implementation tests were run; CI results are reported for this exact PR head.

### Required before merge
- None.

### Deferred conditions
- Phase 1, 4, 5 and 7 policy gates remain due before their first respective plan PRs (`agents/PROJECT.md` §11). The Phase 9 PDPA professional check remains due before that phase. An exact-hash spec review remains due before ordinary `build`.

### Optional improvements
- Refresh the three historical "Bob to rule" alternatives lines and the PR body's UNI-13 result when convenient. In `agents/PROJECT.md:213`, "is implemented as one fixed link-action wrapper" can be phrased as a future requirement until Phase 7 implementation exists.
