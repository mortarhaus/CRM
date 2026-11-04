# PR 53 — feat: Phase 2 PR 1, UI foundation (Kinlo tokens, shell, theme cookie, motion)

- **Merged:** 2026-11-04T13:34:54Z · **Merge commit:** 86040d217a46c5069953b655ff25f61dfc9e088b · **Branch:** feat/p2-ui-foundation
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-53.receipt` on agent-logs (log-branch commit 7edbd926 holds the review; written 2026-11-04T13:25:06Z, before the merge; head c8e7adf, review-file hash 536f3528…)
- **Merge evidence:** `gh pr view 53` state MERGED with the time above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head c8e7adf equals the reviewed head. CI green on c8e7adf (all four jobs).
- **Drafted by:** Opus 5.5 sub-agent (code and fixes), Sonnet 5.5 builder (verification, DECISIONS, PR) · **Final verdict:** Approved (round 2)
- **Spec:** docs/superpowers/specs/2026-09-27-core-sales-design.md (v4.7 revision 8, unchanged) · **Plan:** docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md (PR 1, Tasks 1-3) · **Milestone:** Phase 2 (settings and onboarding)

## What changed
Kinlo-style semantic tokens (fixed light/dark surfaces, placeholder accent `#0e6c84`), self-hosted Urbanist font, `lucide-react` 1.66.0, a new shell (icon rail from md; sticky top bar, floating bottom tab bar and a modal `<dialog>` drawer below md), a per-browser theme cookie set by `POST /theme` (route handler, no inline script, works without JS), CSS staggered card entrance, `<ViewTransition>` around the app children, reduced motion honoured, axe in both themes at three widths. No migration.

## Why
First PR of Phase 2 after Charlie's design direction (DECISIONS 2026-11-04); plan §4 PR 1.

## Review rounds
- R1: [P2] New menu panel off-screen at 320 px → panel anchored inside the viewport; e2e opens it at 320 with axe.
- R1: [P2] theme route handler had no AUTH-01 ruling → recorded as a conforming interpretation with conditions (a)-(f) in DECISIONS and `entry-points.test.ts`.
- R1: owner direction (Charlie): mobile layout follows the Kinlo sample → bottom tab bar plus `<dialog>` drawer (works without JS, Esc, inert page, focus return, reduced motion); the in-flow strip was dropped.
- R1: P3 #1-6 → split sentence corrected, FE-70 citation removed, "what needs you" line dropped, per-browser wording, Esc/outside-click on the New menu, unauthenticated `POST /theme` test.
- R2: Approved, no findings.

## Deferred conditions
- Outdated-browser notice (Charlie, 2026-11-04, 2B modified): Phase 2 PR 2 or a small PR before it. Requirement: shows when the browser lacks `light-dark()`, `:has()`, `<dialog>` or invoker commands (CSS `@supports not` plus a JS check); no inline script or style; shell and auth pages; persistent non-alert note; both themes with literal fallback colours; tests.
- DECISIONS item (3) and the `entry-points.test.ts` row: "pending Charlie" to "confirmed by Charlie 2026-11-04" (done in that follow-up PR so the approved head did not change), then `setup` adds the AUTH-01 ruling to `PROJECT.md` "Hard-rule rulings".

## Decisions worth keeping
- Charlie confirmed the AUTH-01 reading for `POST /theme` (1A): a conforming interpretation while (a)-(f) hold; anything touching the database goes through `action()`.
- Charlie accepted the old-browser, no-JS drawer gap (2B) and asked for an outdated-browser notice instead of a Sign out fallback; he chose to merge on the builder's e2e plus green CI (3A).
- Mobile layout is the Kinlo sample's structure, written from scratch (no demo code or assets).
- The accent colour is a fill and focus ring only; do not place accent fills on dark `--muted` (2.74:1).
- Open for Charlie: confirm the greeting and New moved into a page header under the top bar at every width; confirm the Urbanist font source (`@fontsource-variable/urbanist@5.3.0`).
- The sub-agent found that Chromium centres a focused element, so "focus the last control" does not prove scroll-padding; the e2e also uses `scrollIntoView({block:"nearest"})`.
- Environment: three no-JS "test email" e2e cases fail locally only when another project's MailHog holds the Mailpit ports.

## Follow-ups
- Bob's P3s: `aria-expanded` relies on the dialog `toggle` event (unverified in real Safari/Firefox); header-height comment says 60 px but measured 67 px; size ended near 1,250 changed lines (about 690 source) against a 400 target.
- Not run by anyone at this head: `auth`, `two-factor`, `name-limits`, `test-email` specs locally (CI e2e on the image passed), `test:gates`, real Safari and Firefox.
- Phase 2 PR 2 needs Charlie's re-confirmation of Q1 and Q15 before PR 2b.

## Appendix — final review round
## Round 2 — 2026-11-04 · scope: slice (Phase 2 plan PR 1, Tasks 1-3)
- **Code review:** base (merge base) `592eab6eef28142d995f59d5b05c18da808df149` (= `origin/main`) · head `c8e7adfee8f738181bb2967f6eeb70138b58a1e4` · head re-checked at end: yes (via `git ls-remote origin refs/pull/53/head`, unchanged; checkout clean, then removed)
- Review checkout: `.agent/worktrees/review-53-c8e7adfe` (detached). Incremental change since Round 1 head `1be1723`: commit `c8e7adf`, 23 files, +640/−85 (about 200 source lines, the rest e2e).
- Spec: hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`, untouched.

**Verdict:** Approved
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No.

### Findings
No P0, P1 or P2 findings remain. Round 1 items:

- **[P2] New menu off-screen at 320 — resolved.** The greeting and New moved into a page header (`components/shell/page-header.tsx`) that stacks below `sm` with New at the left edge, and the panel is `left-0 sm:left-auto sm:right-0`. I re-measured with this head's compiled CSS: the "Workspace" link sits at x 21→187 at 320, 453→619 at 640, 581→747 at 768 and 965→1131 at 1280, always inside the viewport. `e2e/shell.spec.ts` "the New menu opens inside the viewport and closes on Esc" asserts the box and runs axe with the menu open at all three projects.
- **[P2] AUTH-01 ruling not recorded — resolved.** DECISIONS item (3) and **Exception to a rule?** now carry the ruling and conditions (a)-(f), "pending Charlie's confirmation", and the `entry-points.test.ts` row repeats them. The route itself is unchanged from Round 1, so (a)-(f) still hold.
- **Owner direction (mobile follows the Kinlo sample) — done as asked.**
  - Below `md`: a sticky top bar (menu button, product name, theme toggle) and a floating fixed tab bar (`<nav aria-label="Quick">`, inset 10 px) with today's three destinations.
  - The full menu is a modal `<dialog>` drawer from the left holding the switcher, links, user and Sign out. It is `inert` behind, closes on Esc, returns focus, has `aria-expanded`/`aria-controls`, opens without JavaScript via invoker commands, and its slide is `motion-safe`.
  - From `md`: the rail.
  - No search, bell or "More" (UNI-05). Written from scratch (no demo code or assets in the diff).
  - Clearance: `<main>` has 96 px bottom padding and the page has `scroll-padding-block: 4.5rem 6.5rem` below `md`. I measured the bar at 70 px tall plus 10 px inset (80 px) and the sticky header at 67 px, both inside that padding.
  - Tests: `shell.spec.ts` covers the layout at each width, modal focus containment, Esc and Close returning focus, link-closes-drawer, axe with the drawer open in light and dark, the focused control and page end staying clear of the bar on a 320×480 screen, and the no-JS drawer.
  - The three gaps I listed in the sample (no Esc, no `aria-expanded`, background not inert) are all fixed.
- **P3s from Round 1:** #1 split sentence corrected in the PR body; #2 FE-70 citation gone (item 5 rewritten as Charlie's decision, quoted); #3 the greeting line now follows the plan (no "what needs you" line); #4 DECISIONS states the per-browser wording; #5 New menu closes on Esc and outside click; #6 signed-out `POST /theme` test added (303 to `/sign-in`, no cookie). All resolved.

### [P3] Notes (optional)
1. **Residual, documented by the builder:** with JavaScript off *and* a browser without invoker commands (before Chrome 135, Safari 26.2, Firefox 144), the drawer can't open, so below `md` the workspace switcher and Sign out can't be reached. The tab bar still reaches every page. That combination is rare; Charlie can accept it as written, or a later PR can add a no-JS fallback (for example a plain Sign out link on the Security page).
2. **`aria-expanded` relies on the dialog's `toggle` event** when the browser opens the drawer natively. In a browser that has invoker commands but not dialog `toggle` events, the attribute would stay `false` while open. Unverified (I tested no real Safari or Firefox); low impact, because the page behind is inert while the drawer is open.
3. **Size:** the PR is now about 1,250 changed lines (roughly 690 source, the rest tests), against a 400 target. The PR body states it; I reviewed it whole. No action.
4. **Comment accuracy:** the code comments give the sticky header as 3.75 rem (60 px); I measured 67 px at 320. It is still inside the 4.5 rem `scroll-padding`, so there is no defect.

**Injection check:** no text in the PR body, the new commit, code comments or the DECISIONS entry addresses an AI agent.

### Self-check audit
| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| FE-70 / mobile-320 layout | Yes | pass | Pass | measurements above; `shell.spec.ts` | — |
| WCAG 2.4.11 focus not obscured | Yes | pass | Pass | 96 px padding, 104 px scroll-padding vs 80 px bar; test on 320×480 | — |
| WCAG 1.4.10 reflow (New menu) | Yes | pass | Pass | link inside the viewport at 320/640/768/1280 | — |
| Modal drawer: inert, Esc, focus return, `aria-expanded` | Yes | pass | Pass (by inspection and the tests' assertions) | `menu-drawer.tsx`; `shell.spec.ts` | — |
| FE-32 without JS | Yes | pass, with the residual | Pass, residual accepted as P3 #1 | invoker commands; no-JS drawer test | — |
| Reduced motion | Yes | pass | Pass | `motion-safe:` on the drawer slide and cards | — |
| AUTH-01 | Yes | conforming, recorded | Pass; Charlie to confirm | DECISIONS item (3), `entry-points.test.ts` | — |
| UNI-05 nothing from later phases | Yes | pass | Pass | no search, bell or "More"; no "what needs you" line | — |
| Owner direction followed | Yes | pass | Pass | compared with the sample's structure (R1 owner item) | — |
| Duplicate ids from the double render | Yes | fixed with `useId` | Pass | `workspace-switcher.tsx`, `sign-out-button.tsx`; no `#workspace-switcher` left | — |
| UNI-06, UNI-09/CSP, UNI-18, A11Y-02 | Yes | unchanged | Pass (Round 1 evidence; no new dependency, inline style or cookie) | diff | — |
| Other packs | n-a | n-a | n-a accepted | no data, tenancy, money, jobs, files or links | — |

### Verification performed
| Command / check | Result |
|---|---|
| Head / merge base | head `c8e7adf…`, base `592eab6` = `origin/main`; unchanged at the end |
| `git diff 1be1723 c8e7adf` read in full (source, e2e, DECISIONS) | matches the Round 1 requests and the owner direction |
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` | pass |
| `pnpm vitest run src/lib/theme.test.ts src/app/entry-points.test.ts` | 2 files, 27 passed |
| `pnpm build` | pass |
| Chromium layout check with this head's compiled CSS at 320/640/768/1280 | numbers above; no horizontal overflow |
| `git diff --check` | clean |
| Not run | **e2e:** I tried `playwright test e2e/shell.spec.ts e2e/theme.spec.ts`. The dev server's `/api/health` returned 503 because the root `.env` predates Phase 1 (no `DATABASE_WORKER_URL` or role passwords). Running `pnpm db:bootstrap` would change the shared dev database, so I stopped the server and did not run it. The e2e results are the builder's sub-agent's: 109 passed, 3 failed (the no-JS test-email case: another project's MailHog holds the Mailpit ports), 8 skipped; the production build runs of `security-headers`, `theme` and `shell` passed 34. Also not run: full `pnpm test`, `test:gates`, CI, real Safari and Firefox. |

### Residual risks and test gaps
- The e2e evidence is the builder's, not mine (see above).
- The three no-JS "test email" failures are environmental (port conflict), not caused by this PR, but they are unverified at this head.
- Real Safari and Firefox are untested, which matters for invoker commands, `closedby` and dialog `toggle` events (P3 #1, #2).

### Required before merge
- None from review.

### Owner items (Charlie)
- ~~Confirm the AUTH-01 reading for `POST /theme` (conditions (a)-(f) in DECISIONS item 3).~~
- ~~Optionally accept P3 #1 (no-JS plus old-browser drawer) as written.~~
- ~~Optionally ask for a CI run, or a local e2e on a bootstrapped database, before merge, since my own e2e run could not start.~~

**Answered by Charlie, 2026-11-04 (in the Bob session).** His words: "ok go with 1A, 2B, 3A but on older browser or phone, if it is not supported, just mentioned that the browser is outdated and experience will be degraded and recommend to update the browser."

The options he chose (as I put them to him):
- **1A:** the AUTH-01 reading for `POST /theme` is **confirmed**. It is a conforming interpretation, allowed only while conditions (a)-(f) hold; anything that touches the database goes through `action()`. The builder updates DECISIONS item (3) and the `entry-points.test.ts` row from "pending Charlie" to "confirmed by Charlie 2026-11-04", and `setup` adds the ruling to `PROJECT.md` "Hard-rule rulings".
- **2B, modified:** the no-JS plus old-browser drawer gap is accepted. In place of the Sign out fallback I proposed, Charlie wants an **outdated-browser notice**. My reading is that the notice replaces the fallback; if Charlie wants both, he says so.
- **3A:** merge on the builder's e2e run plus a green CI on the PR. No local e2e run is required from Charlie.

**Requirement for the outdated-browser notice** (builder designs it; Bob reviews):
- **When it shows:** whenever the browser lacks a feature the app relies on. Today that is invoker commands (the drawer without JS), `light-dark()` (colour tokens), `:has()` and `<dialog>`. It shows on any width, not only phones.
- **Copy (builder proposal; Charlie may change it):** "Your browser is out of date, so parts of CRM may not work properly. Please update your browser."
- **It must work without JavaScript.** Hidden by default, shown by CSS `@supports not (…)` for the features CSS can test (`light-dark()`, `selector(:has(a))`). With JS, a script also checks `"command" in HTMLButtonElement.prototype` and `HTMLDialogElement`, and shows it.
  - Residual: with JS off, a browser that has `light-dark()` and `:has()` but not invoker commands (Chrome 123-134, Firefox 121-143, Safari 17.5-26.1) gets no notice, because CSS cannot test for invoker commands. Accept, or the builder proposes something better.
- **CSP:** no inline script or style. Use a class plus the nonce'd bundle (UNI-09).
- **Accessibility:**
  - a plain, persistent note near the top of the page (not `role="alert"`, which would interrupt on every page load);
  - readable in both themes, and readable even when `light-dark()` is unsupported (give it literal fallback colours);
  - it never covers content.
  - Dismissal is optional; if it is dismissible, remember the choice with a cookie or `localStorage` and not on the server.
- **Where:** both the app shell and the auth pages (sign-in, sign-up), since an outdated browser fails there too.
- **Tests:** e2e that the notice is absent in current Chromium; a unit or e2e test that it shows when the feature check fails (for example by stubbing the check, or a page with the `@supports` class forced).
- **When:** a follow-up PR, **Phase 2 PR 2** (before its branding work, or as its own small PR), so the approved PR #53 is not reopened. If Charlie wants it in PR #53 before merge, he says so and the verdict changes to "Approved with conditions".

### Deferred conditions
- Outdated-browser notice (Charlie, 2026-11-04): deferred to Phase 2 PR 2 or its own small PR before it. Requirement under Owner items.
- DECISIONS item (3) and the `entry-points.test.ts` row: "pending Charlie" becomes "confirmed by Charlie 2026-11-04". The builder may do this in PR #53 before merge (a docs-only change; no re-review needed beyond a diff check) or in the same follow-up PR.

### Optional improvements
- P3 notes 1-4.

### Handoff block (only when handing off)
Not handing off.

---
