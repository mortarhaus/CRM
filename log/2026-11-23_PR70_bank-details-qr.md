# PR 70 — feat(settings): Phase 2 PR 5b: bank details, payment QR and the step-up prompt

- **Merged:** 2026-11-23T01:06:18Z · **Merge commit:** a3ee9d51aad643da9925b3b25692faa84a01f396 · **Branch:** feat/p2-bank-qr
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-70.receipt` on agent-logs (log-branch commit cf384351; review archived in cff6ec61; written 2026-11-23T01:05:45Z, 33 s before the merge; head 771dd7e, review-file hash e37b37aa…)
- **Merge evidence:** `gh pr view 70` state MERGED with the time and commit above; commit reachable from fetched `origin/main`. Final head 771dd7e equals the reviewed head. All five CI jobs SUCCESS on that head (Changed files, Dependency audit, Secret scan, Typecheck/lint/test, Image/Trivy/E2E).
- **Drafted by:** Opus 5.5 helper under Andy (Sonnet 5.5); review fixes by an Opus 5.5 helper and Andy · **Final verdict:** Approved with conditions (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` (PR 5, Tasks 14-15) · **Milestone:** Phase 2

## What changed
`/settings/payment` (Owner only, step-up required): bank form (bank name, holder, account number required; SWIFT optional) and a DuitNow/PayNow QR upload, on six new `workspace_settings` columns (migrations 0030, 0031, per-column grants). Each change writes an audit entry (account number as last 4 only, holder `[pii]`, QR as its key) and an in-app notification to every Owner, in one transaction. The QR is content-addressed, a replaced QR stays in storage, and `/files/payment-qr` serves it to the Owner only. Also: the step-up per-user limit counts failures only, 5 per 15 minutes, and a Better Auth 5xx is no longer shown as a wrong code (PR 68 P2 and P3).

## Why
Spec "Authorization" and the bank/QR rule (lines 796, 803), Phase 2 plan Tasks 14-15, Charlie's owner answers of 2026-11-22 (Q17, Q26, step-up limit, `require_2fa` decision), and Bob's PR 68 conditions.

## Review rounds
- R1: Revision required. [P1] self-check per pack, not per rule → one row per applicable rule, A11Y-06 and FE-70 marked deferred. [P2] conflict with main (DECISIONS) → merged main (2b7e35d). [P2] expired step-up never brought the prompt back → page refreshes, prompt returns, focus to the code field, typed values kept (20b9ea8). [P2] audit differs from spec line 803 → recorded as a deviation, pointer in PROJECT.md §11 (771dd7e). Also fixed: the "Decided by" line, Next 16.4.6 text in the runbook and a test comment.
- R2: Approved with conditions.

## Deferred conditions
- PR 5c: `e2e/bank-details.spec.ts` covers step-up (wrong code, right code, expiry while open, focus, typed values kept), save, QR upload and replace (old file kept), Admin sees no Bank link, keyboard and axe at desktop and mobile-chrome, no horizontal overflow (A11Y-06, FE-70). Plus a non-square QR (see below).
- Next spec PR: spec line 803 (and 799 if repeated) drops "SHA-256" to match Q26 (PROJECT.md §11).

## Decisions worth keeping
- Charlie's answers recorded in DECISIONS 2026-11-22: Q17 fields, failures-only limit 5 per 900 s, Q26 last 4 only, `require_2fa` Owner only with step-up (toggle not built yet).
- **Owner answers after Round 2 (2026-11-23, in the Bob session, per the review file), NOT yet in DECISIONS:** QR file size 2 MB max confirmed (`PAYMENT_QR_MAX_BYTES` = logo limit, UNI-02 closed); any QR shape accepted; the preview should fit the image's own proportions, not a forced square.
- Bank details are six columns, not a jsonb field (recorded in DECISIONS).

## Follow-ups
- Builder, in PR 5c: record the two owner answers above in DECISIONS; change the `settings/payment/page.tsx` preview from the fixed `size-40` square to a bounded box at the image's aspect ratio without layout shift (Bob recommends PR 5c with the e2e covering a non-square QR).
- Optional P3s still open: `docs/runbooks/phase-1-security.md:80` still says `base-server.js:567` (now 604); the "expired" message stays after a fresh confirmation until the next save; QR put inside the locked transaction; last-4 of formatted numbers (waits on the account-number characters ASK).
- Open owner asks: DuitNow/PayNow text ID field, account-number character rules, clearing details or removing the QR, Admin viewing the QR.
- The new step-up screen and forms were never run in a browser before merge; PR 5c's e2e is the first real check.
- Next: Phase 2 PR 5c (owner email on a bank or QR change, Q18 wording drafted 2026-11-22, editable later through the PR 8 email templates).

## Appendix — final review round
## Round 2 — 2026-11-23 · scope: delta since Round 1 (merge of main + two fix commits)
- **Code review:** base (merge base) `c0738e497a7203aa868c45ab8b59e59d239a21b5` (= origin/main, PR #69) · head `771dd7eb29a2da3d5f09a8101d3fc5d86e64a3e8` · previous head `73b26aeb` · head re-checked at end: yes (OPEN, MERGEABLE)
- Delta: `2b7e35d` (merge c0738e4), `20b9ea8` (step-up expiry prompt), `771dd7e` (DECISIONS, PROJECT.md §11, runbook/test comment).
- Review checkout: `.agent/worktrees/review-70-771dd7eb` (detached; `git status --untracked-files=no` clean at end).

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 · **Switch model next step?** No.

### Round 1 findings, re-checked
| R1 finding | Status | Evidence |
|---|---|---|
| P1 self-check per pack | fixed | PR body now one row per applicable rule (AUTH-01/02/03/06/09, TEN-04..08/10/11, EVT-01, FILE-01..04, UNI-01/02/03/05/09/10/15/16, A11Y-03/05/06, FE-70); A11Y-06 and FE-70 marked **deferred**, UNI-02 marked **open**. Matches what I found. |
| P2 conflict with main | fixed | merge `2b7e35d`; every R1 file has the same blob at `73b26ae` and `2b7e35d` except `docs/DECISIONS.md`, whose only change is the PR 69 entry inserted whole. `mergeable: MERGEABLE`. |
| P2 step-up expiry: prompt never returns | fixed (code), browser check deferred to PR 5c | `use-save-follow-up.ts`: `STEP_UP_REQUIRED` → `router.refresh()` in a transition, then focus to `STEP_UP_INPUT_ID` (fallback: submit button). Page tree is stable (`steppedUp ? status : prompt` stays in one slot before the form), so form state survives the refresh. Bank form dispatches through `onSubmit` + `preventDefault` + `startTransition(formAction)`, React's documented way to avoid the post-action form reset, so typed values are kept; the `action` prop stays for the no-JS post. Message is `STEP_UP_EXPIRED` when the page had said "Confirmed", else `STEP_UP_NEEDED`. QR form keeps the default reset (the file must be picked again; PR body says so). Unit test covers only the pure decision functions. |
| P2 audit vs spec line 803 | recorded | DECISIONS "Exception to a rule?" names the deviation and Charlie's Q26; PROJECT.md §11 gets a pointer for the next spec PR (same pattern as the revision 9 label item already there). Spec unchanged, as it should be in a code PR. Stays deferred. |
| P2 no browser / e2e / axe | deferred | PR 5c `e2e/bank-details.spec.ts`, now also listing the expiry case. |
| P3 storage put inside the locked transaction | open (optional) | unchanged; fine to leave. |
| P3 `last4` of short/formatted numbers | open (optional) | waits on the account-number ASK. |
| P3 "Decided by" line | fixed | added. |
| PR 69 P3 (runbook / test comment version) | partly fixed | test comment now 16.4.x/16.4.6 and line 604; runbook `docs/runbooks/phase-1-security.md:80` still says `base-server.js:567` (version on line 79 fixed). See new P3. |

### New findings

### [P3] Runbook still cites the old line number
- Category: documentation · Rule: UNI-16 spirit
- Evidence: `docs/runbooks/phase-1-security.md:80` "`next/dist/server/base-server.js:567`"; in 16.4.6 it is line 604 (checked in the review checkout's `node_modules`). The PR body says this was fixed.
- Suggested correction: change 567 to 604 (or drop the number), in this PR or the next that touches the runbook.
- Owner: builder · Status: open (optional)

### [P3] Stale refusal text after a fresh confirmation
- Evidence: after the expiry refusal the bank/QR form keeps its last `result`, so once the Owner enters a code and the page shows "Confirmed", the form still shows "Your confirmation expired…" until the next save. The text ends "then save again", so it is not wrong, only stale.
- Suggested correction: optional; cover in PR 5c's e2e or clear the message when `steppedUp` turns true.
- Owner: builder · Status: open (optional)

(Cosmetic: DECISIONS.md has a double blank line after the PR 69 entry. No action needed.)

No injection-style text addressed to agents in the new commits, PR body or comments (no comments on the PR).

### Verification performed
| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (Node v24.21.0, pnpm 11.6.0) | ok |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm vitest run` payment dir, step-up, rate-limit, privileges, entry-points, limits | 7 files, 100 passed, 1 skipped |
| blob comparison `73b26ae` vs `2b7e35d` for all R1 files | identical except DECISIONS (PR 69 entry only) |
| `git diff --check c0738e4 HEAD` | clean |
| CI (`gh pr checks 70`) | all 5 pass, incl. Image, Trivy, E2E |
| browser, axe, full `pnpm test`, gates locally | not run (CI ran test, gates and existing e2e; new e2e is PR 5c) |

### Owner answers after Round 2 (2026-11-23, in chat with Bob)
- QR shape: **option 1**: accept any image shape, show it in the fixed square box (current code, no change). Andy should record this in DECISIONS with the size answer.
- Then refined: the preview should **fit the image's own proportions** (not a forced square box); any shape accepted. **File size: 2 MB max confirmed** (`PAYMENT_QR_MAX_BYTES` = logo limit; UNI-02 closed). The merge condition is met.
- Builder change needed: `settings/payment/page.tsx` preview drops the fixed `size-40` square for a bounded box at the image's aspect ratio, without layout shift (e.g. store width/height at upload, or a max-width with height auto and a reserved space). Can go before merge or in PR 5c (Bob recommends PR 5c, with the e2e covering a non-square QR); record both answers in DECISIONS.

### Required before merge
- Charlie answers the owner question: `PAYMENT_QR_MAX_BYTES` = 2 MB (logo limit) — confirm or give a number (UNI-02, still **open** in the self-check). If the number changes, that commit needs a short re-review.

### Deferred conditions
- PR 5c: `e2e/bank-details.spec.ts` covers step-up (wrong code, right code, **expiry while the page is open**, focus to the code field, typed values kept), save, QR upload and replace (old file kept), Admin sees no Bank link, keyboard + axe at desktop and mobile-chrome, no horizontal overflow (A11Y-06, FE-70).
- Next spec PR: spec line 803 (and 799 if repeated) drops "SHA-256" to match Q26 (tracked in PROJECT.md §11).

### Optional improvements
- The two new P3s; R1's two optional P3s.
