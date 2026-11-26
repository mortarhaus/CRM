# PR 78 — fix: stop a refused catalog save sending typed text back

- **Merged:** 2026-11-26T11:58:10Z · **Merge commit:** ffa616e757d6dcac7fb9e566bab2ca4e56414be5 · **Branch:** fix/catalog-refusal-echo
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-78.receipt` on agent-logs (review commit 42852f3; written 2026-11-26T11:56:09Z, two minutes before the merge; head 6d11ee3, review-file hash 1fe4e544…)
- **Merge evidence:** `gh pr view 78` state MERGED at the time above; merge commit equals fetched `origin/main`, with 6d11ee3 as its second parent. Final head 6d11ee3 equals the reviewed head. All five CI jobs SUCCESS on that head, the last at 11:29:18Z, before the receipt.
- **Drafted by:** Opus 5.5 sub-agent under Andy (Sonnet 5.5) · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** none (owner decision 2026-11-26) · **Milestone:** Phase 2

## What changed
A refused catalog save returns the failed field names and, for a refused price, only a closed reason code and an allow-listed currency; no typed text. With JavaScript the browser keeps the draft, also after an earlier successful save, and a currency-lock refusal puts only the currency back to the stored one. Without JavaScript the page shows the stored or initial values and says the typed values were not kept.

## Why
Free text (name, description) can hold personal data; the same rule as the email templates page. Raised by Bob in PR #77; Charlie chose it on 2026-11-26.

## Review rounds
- R1: Revision required.
  - [P1] Preserve the JavaScript draft when a refusal follows a successful save → stable field keys; reset only on a successful save or another service; browser regression (5682b64).
  - [P3] Remove the wrong direction from the no-JavaScript alert → location wording removed (70d5991).
  - Owner decision added in the same round: currency back to the stored value after a lock refusal (6d11ee3).
- R2: Approved.

## Deferred conditions
none

## Decisions worth keeping
- Refusals return no free text; the browser keeps the draft with JavaScript.
- Currency lock refusal: the currency select shows the stored currency, other typed fields stay (Charlie, "B"). The first question put to Charlie described main wrongly (main reverted every field in some sequences); it was re-asked with the measured behaviour.

## Follow-ups
- Pre-existing, from source reading by builder and reviewer, not reproduced in a browser: the catalog form keys by workspace only, so action result state (error or saved message, and the carried version number) may follow an Edit link to another service.
- Unverified: two flaky local runs showed "We couldn't save the service" for a post that should have saved, before the test waited for the refresh; not reproduced since.
- New browser regressions run on desktop Chromium only; no screen-reader check.
- "Image, Trivy, E2E" took about 69 minutes (limit 90; split suggested before about 75).

## Appendix — final review round
## Round 2 — 2026-11-26 · scope: slice

- **Code review:** merge base `6926c5dc4d43ed4294e9e8f72fef61807d0b6211` · head `6d11ee3b90b7c5a3b08644fcfa4f72b163039c32` · head re-checked at end: yes, open and unchanged.
- **Spec:** Core Sales v4.7 revision 9, blob `b8e5a758ced6738217b8c98aa3bc9e40376a6eca`. Spec “Validation”, “Authorization”, “Service currency edit” and the two 2026-11-26 catalog decisions.
- **Checkout:** detached `.agent/worktrees/review-78-6d11ee3b`. Final status was clean, including untracked files.

### Findings

No blocking findings. Both Round 1 findings are resolved and option B is implemented.

| Item | Status | Verification |
|---|---|---|
| P1, preserve JavaScript drafts when a refusal follows a success | Resolved | `service-form.tsx:162`–`:170` now keeps the general input key through refusals. The reset count advances on a successful save, and the field key includes the service ID and version. `service-form.tsx:247`–`:252` stores the posted draft in the browser above the failure boundary. The production Chromium regression at `catalog.spec.ts:148` passed. It checks all six fields through successful create and edit, subsequent invalid submissions, repeated errors, network failure, stale and wrong-workspace refusals, and corrected retries. |
| P3, no-JavaScript alert points to the wrong location | Resolved | `messages.ts:299`–`:300` explains which values are shown without a directional reference. The production Chromium case at `catalog.spec.ts:296` passed for create and edit, including currency lock and successful re-entry. |
| Option B, restore the saved currency after a currency-lock refusal | Verified | `service-form.tsx:207`–`:215` remounts only the currency selector and defaults it to the saved currency. `catalog.spec.ts:250` verifies the reset after opening Edit, repeat lock, validation refusal, save and reload, preserving the other fields and saving a corrected post. It passed against the production image. The database currency lock remains in place. |

### Self-check audit

| Applicable rules | Re-reviewed result |
|---|---|
| UNI-01–05, UNI-07/09/13 | Typecheck, lint, build and scan passed. Draft values are held in browser state. Refused actions still return field names and at most the closed price reason and allow-listed currency. Catalog actions and money parser are byte-identical to Round 1. |
| AUTH-01–03, TEN-02/08–11, PROJECT §9 | Session, role and workspace checks remain in the same paths. CI passed the action wrapper, catalog actions and workspace-binding browser case at three widths. |
| MON-01/02/07 and service currency edit | Server minor-unit parsing and its currency checks remain intact. The currency reset is a UI recovery action. No conversion or new write path. |
| FE-22/31/32/70/71 and applicable A11Y rules | Revised alert copy and native form fallback verified. Exact-head image browser tests cover the new desktop sequences. Existing catalog tests, including accessibility assertions, passed at all three widths. No full screen-reader check was performed. |
| Reviewer §7 | The diff changes no operator procedure. DECISIONS records the updated behavior and the approved no-JavaScript fallback. |

Reassessed the Round 1 applicability list and the follow-up diff before reading the builder's self-check. Reviewed new commits, PR description and diff for instructions directed at the reviewer. GitHub reported zero discussion comments, reviews and inline comments.

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`, `git merge-base origin/main HEAD`, `gh pr view 78` | Pinned exact head and merge base. GitHub head remained open and unchanged at the final check. |
| Effective three-dot diffs, `git diff --check`, project secret scan | 12 files overall and three follow-up commits. Clean diff, zero added-line matches. CI full-history gitleaks passed. |
| Independent isolated Node 24.21.0 / TypeScript 6.0.3 render probe | Executed the checked-out component with fixture action states and stubbed hooks. General field keys stayed stable after success followed by a validation refusal. A currency lock advanced only the select key, used the saved currency and kept draft defaults for other inputs. Browser behavior was verified separately through CI. |
| Exact-head CI run 45799683831 | All five jobs passed. Typecheck, lint, production build, dependency audit, secret scan, pooler gate, image, Trivy and startup passed. Unit/integration suite: 1,529 passed and one skipped across 81 files. Catalog actions 22, money parser 44 and action wrapper 47 passed. |
| Exact-head production image browser logs | 255 passed and 18 skipped. Verified both new Chromium regressions and the desktop no-JavaScript retry test individually. The existing owner and Staff catalog cases and cross-tab workspace case passed at desktop, tablet and mobile. |
| Checkout integrity | HEAD matched GitHub and `git status --porcelain --untracked-files=all` was empty. |

### Residual risks and test gaps

- The two new browser regressions and the no-JavaScript fallback case run on desktop Chromium only. I used CI for full browser and database checks and ran the render-state probe locally.
- The builder reports unexplained generic failures in two earlier test runs before the fixture began waiting for refresh. The cause is unverified. Exact-head image CI passed.
- The existing page keys the form by workspace, so action result state may carry between two services in that workspace. The new input subtree key and draft check identify the service, while the outer action result is still shared. This pre-existing caveat was reviewed in source and not reproduced in the browser in this round.

### Required before merge

- No code corrections.

### Deferred conditions

- None.

**Model used:** GPT-6 (Codex). **Switch model next step?** No for recording the approval receipt.

**Verdict: Approved.**

