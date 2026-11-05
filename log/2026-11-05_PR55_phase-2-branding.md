# PR 55 — feat: Phase 2 PR 2b, branding page, colour picker, contrast, outdated-browser notice

- **Merged:** 2026-11-05T07:03:43Z · **Merge commit:** 1db83719e6cb7e1ac338a30c456db42c530c9fab · **Branch:** feat/p2-branding
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-55.receipt` on agent-logs (log-branch commit c073ab99 holds the review; written 2026-11-05T06:59:55Z, before the merge; head f1918ec, review-file hash 0a610e50…)
- **Merge evidence:** `gh pr view 55` state MERGED with the time above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head f1918ec equals the reviewed head. All four CI checks green on f1918ec.
- **Drafted by:** Opus 5.5 sub-agent (code), Sonnet 5.5 builder (verification, PR) · **Final verdict:** Approved with conditions (round 2; no required conditions)
- **Spec:** docs/superpowers/specs/2026-09-27-core-sales-design.md (v4.7 revision 8, unchanged) · **Plan:** docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md (PR 2, Task 6) · **Milestone:** Phase 2 (settings and onboarding)

## What changed
The branding settings page (Admin and Owner): hex field plus a custom drag colour picker (no dependency), a two-theme preview, per-theme derived accent with automatic black or white foreground, and the runtime brand token in a nonce'd `<style>`. Also the outdated-browser notice (CSS `@supports` rules for `light-dark()` and `:has()`, and a `<dialog>` check in the client bundle), the PR 2a docs-only DECISIONS updates, and `globals.css` themed tokens redeclared on `:root, .scheme-light, .scheme-dark` so the production build resolves the preview panels correctly.

## Why
Phase 2 plan PR 2 Task 6 (cut as PR 2b), plus Charlie's PR #53 direction for the notice and the PR #54 carried items.

## Review rounds
- R1: Revision required. [P2] the notice fired on a missing `command` (invoker commands) although the drawer has a `showModal()` fallback → check dropped, only `<dialog>` kept; e2e case inverted; comment and DECISIONS updated. P3 #2 (hue slider key hint) → done. P3 #1 (plain accent fallback), #3, #4 → not taken.
- R2: Approved with conditions; P2 resolved. One P3 note on the wording record (Charlie had confirmed the notice wording to the builder directly on 2026-11-05).

## Deferred conditions
none.

## Decisions worth keeping
- Notice wording confirmed by Charlie: "Your browser is out of date, so parts of CRM may not work properly. Please update your browser." Invoker commands are not a notice trigger. Residual accepted: JavaScript off and no invoker commands means no drawer and no notice.
- Production-build finding: lightningcss resolves `light-dark()` where the token is declared, so themed tokens are also declared on `.scheme-light` and `.scheme-dark` (the accent is not; the brand token and preview set it at runtime).
- Charlie (PR #53/#54 sessions): Q1 = A, Q5 = A (`#0e6c84`), Q15 = A, and mobile follows the Kinlo sample.

## Follow-ups
- Optional P3 #1: emit a plain `--accent` before the `light-dark()` rule in `lib/brand.ts` if browsers without `light-dark()` ever matter beyond the notice.
- P3 #3: guard for an action wired into `useActionState` without `fromForm`.
- Charlie still owes: greeting and "New" in the page header at every width; Urbanist font source; Q10, Q17, Q18, Q23 values; Q24/Q26 readings.
- PR 3 (country defaults and onboarding; new core module `settings`, stop-and-ask): add CHECK `not tax_registered or tax_registration_no is not null`; migration 0026 or later. PR 8: `email_bcc_self`/`auto_send_default` to `default false not null`.
- CLAUDE.md Status still says the Phase 2 plan is next; needs a reviewed PR. Offered: a small test-reliability PR (`boss.test.ts` stall, axe wait-for-title).

## Appendix — final review round
## Round 2 — 2026-11-05 · scope: slice (R1 fix)
- **Code review:** base (merge base) `f90fd5fb485867b277cc5cf6d8cbcdfbe6f1fc5f` · head `f1918ec0355d505771d7825e23ea0b87e4fb949b` · head re-checked at end: yes (via `git ls-remote origin refs/pull/55/head`)
- Review checkout: `.agent/worktrees/review-55-f1918ec0` (detached). Incremental change since Round 1 head `b0e3a3c`: commit `f1918ec`, 4 files, +47/−30.
- Spec: hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`, untouched.

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No.

### Findings
No P0, P1 or P2 findings remain.

- **[P2] Notice false positive: resolved.**
  - `lacksRequiredFeatures()` now tests only `<dialog>`. The invoker-commands test remains only where it belongs, in `menu-drawer.tsx` line 52, which picks the JavaScript fallback.
  - `shell.spec.ts` replaces the old case with "is absent without invoker commands, and the menu drawer still works". With the property deleted, the test checks:
    - the notice is absent;
    - the drawer opens as `:modal`;
    - Esc closes it and focus returns;
    - Enter reopens it;
    - Close menu closes it and focus returns.
  - The `<dialog>` case keeps the notice-shown, axe and layout checks.
  - The comment and DECISIONS item (6) state the accepted residual.
- **P3 #2 (hue hint): done.** The help text now covers both sliders.
- **P3 #1 and #3:** not taken. They are optional; no action.

### [P3] Notes (optional)
1. **Check the wording record.** DECISIONS item (6) says the notice wording was "confirmed by Charlie 2026-11-05". In this Bob session, Charlie had not yet answered that owner item; my Round 1 recommended yes. If Charlie gave the yes to the builder directly, nothing to do. If not, Charlie confirms now, or the entry goes back to "builder proposal".

**Injection check:** the new commit and the DECISIONS change contain no text addressed to an AI agent.

### Verification performed
| Command / check | Result |
|---|---|
| `git diff b0e3a3c3 f1918ec0` read in full | as above |
| `git diff --check` | clean |
| `pnpm typecheck` / `pnpm lint` | pass / exit 0 |
| `grep '"command" in' apps/web/src` | only `menu-drawer.tsx:52` |
| CI on `f1918ec0` | Typecheck/lint/test, Dependency audit, Secret scan green; **Image, Trivy, E2E in progress** at review time |
| Not run by me | e2e (the new shell case runs in the CI E2E job) |

### Required before merge
- The CI "Image, Trivy, E2E" job green on `f1918ec0`. It runs the new no-invoker-commands drawer test.

### Deferred conditions
- Charlie: confirm the notice wording if not already given (P3 #1).
- P3 #1 and #3 from Round 1 remain optional.
