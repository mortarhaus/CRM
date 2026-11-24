# PR 72 — feat(settings): Phase 2 PR 6: invoice numbering (core module, doc_sequence, settings page)

- **Merged:** 2026-11-24T09:18:32Z · **Merge commit:** ccbe01243cd883a31420a150f6e42fb9f1306e67 · **Branch:** feat/p2-numbering
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-72.receipt` on agent-logs (receipt commit a6e39fe, review commit 4d93639; written 2026-11-24T09:13:04Z, 5 minutes before the merge; head 7fa6584, review-file hash 80925603…)
- **Merge evidence:** `gh pr view 72` state MERGED at the time above; merge commit reachable from fetched `origin/main`. Final head 7fa6584 equals the reviewed head. All five CI jobs SUCCESS (image job 1h8m15s on the reviewed run, after one re-run: the first attempt was cancelled at the 90-minute limit while still installing Playwright, a runner stall, not a test failure).
- **Drafted by:** Opus 5.5 helper under Andy (Sonnet 5.5) · **Final verdict:** Approved (round 2; round 1 Revision required)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 9 (hash `b8e5a758`) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` (PR 6, Tasks 17-19) · **Milestone:** Phase 2

## What changed
New core module `@crm/core/numbering` (pattern parser, one formatter, period key, next sequence). New tenant table `doc_sequence` (migrations 0033, 0034, RLS template). `allocateNumber` (row lock, database clock read after the lock, returns number and issue time) and a lock-free `previewNumber`. The MY and SG invoice sequence is seeded at onboarding (yearly reset). Settings page `/settings/numbering` for Admin and Owner: pattern, reset rule (never, yearly, monthly; default yearly), live preview, "new documents only" copy.

## Why
Spec "Numbering" and `doc_sequence`, plan Tasks 17-19, Q20 and Q21. Owner decisions 2026-11-23 and 2026-11-24 (new module, user-selectable reset rule default yearly, limits 50 and 9, exactly one `{SEQ}`, period-token rules).

## Review rounds
- R1: Revision required. P1 a period earlier than the stored one restarted the counter (a repeated number: year-end race, time zone change, skewed clock); P2 ranged self-check rows and a mislabelled UNI-13; two P3s.
- R2: Approved. P1 fixed (clock read after the lock; never reset backwards, typed `PeriodBehindError`; Bob's mutation check broke 11 tests), P2 fixed, one P3 fixed, two new P3 notes.

## Deferred conditions
- Phase 4 plan: unique `(workspace_id, number)` index per issued document type; how an issue shows `PeriodBehindError`; no caller passes `clock`.
- The onboarding short-code PR (with skip) before Phase 4 issues numbers.

## Decisions worth keeping
- A pattern needs exactly one `{SEQ:n}`; a yearly reset needs a year token, a monthly one needs year and `{MM}`.
- The counter never restarts mid-period and never resets backwards. A time zone change that puts "now" behind the stored period blocks issuing (under about 26 hours) until that period starts; a pattern-only change still saves. Clamping and blocking the zone change were rejected (DECISIONS 2026-11-24).
- `doc_type` is `invoice` only for now; opening the numbering page creates the counter for older workspaces (audited, idempotent).

## Follow-ups
- Next small PR: onboarding asks for the short code, with a skip, settable later in General settings.
- [P3] `clock` option on production functions: Phase 4 review must check no caller passes it.
- [P3] Owner item: confirm the time-zone-change behaviour or ask for a warning on the time zone page.
- [P3] Preview is fixed at page render time (optional).
- Open owner asks: deleted-user wording, payment-page questions, Q23 email events, DNS option, when to shard the E2E job, older small items.
- Next: Phase 2 PR 7 (money core and catalog).

## Appendix — final review rounds
## Round 2 — 2026-11-24 · scope: slice (fixes for Round 1; plan Tasks 17–19)
- **Code review:** base (merge base) `e5efb74ed54730a22959c81006e691435865ef1b` (= origin/main) · head `7fa65848ec86dacc63dcac9a56d99256cbc6ba2c` · head re-checked at end: yes (OPEN, MERGEABLE). Changes since Round 1 (`d2d5e24`): 18 files, +398/−60, three commits.
- Review checkout: `.agent/worktrees/review-72-7fa65848` (detached). One throw-away change was made there to test the tests (see Verification) and reverted with `git checkout`; the checkout was clean at the end. Nothing was committed or pushed.
- Docker Desktop was not running at the start of this round; I started it (`open -a Docker`) to run the database tests.

**Verdict:** Approved
**Model used:** Opus 5.5 · **Switch model next step?** No.

Merge note: CI is 5/5 on this head (image job 1h8m15s; limit 90 min, see the PR 71 note on sharding).

### Round 1 findings
| Finding | Status | Evidence |
|---|---|---|
| P1 counter restarts in an earlier period | **fixed** | `allocateNumber` reads the database clock (`clock_timestamp()`) after the lock and returns `{number, issuedAt}`; `nextSequence` and `withResetRule` throw `PeriodBehindError` for an earlier period; `updateSequence` reads the clock after its lock; the action maps it to `PERIOD_BEHIND`. Tests for the year-end race, time zone change, rule change, backdated and skewed clocks. |
| P2 self-check rows | **fixed** | PR body now has one row per rule, UNI-13 relabelled, REC-07/10 re-claimed after the fix (I agree, see audit). |
| P3 preview fixed at render | open (optional, unchanged, recorded as a choice) | — |
| P3 refusal not tied to field | **fixed** | `aria-describedby` names `numbering-error` when there is one; e2e asserts the accessible description. |

### Findings

### [P3] The `clock` option on the production functions
- Category: design · Rule: REC-07 / REC-10 (future caller)
- Evidence: `allocateNumber(tx, docType, { clock })` and `updateSequence(…, { clock })` accept any clock; the comment says "for tests only". Nothing stops a Phase 4 caller passing a time from the request, which would bring back a time not read from the lock's own moment (a backdated one is now refused, a future one is not).
- Suggested correction: none needed now. When Phase 4 adds the first caller, the review should check no clock is passed (or move the option to a test-only export).
- Owner: builder (Phase 4) · Status: open (note)

### [P3] After a time zone change west, issuing stops for up to about 26 hours
- Evidence: DECISIONS 2026-11-24 "Time zone change". If the workspace moves to a zone still in the previous year or month, the allocator and preview refuse (`PeriodBehindError`) until that period starts there; the reset-rule change is refused with `PERIOD_BEHIND`; a pattern change is saved. General settings still allows the time zone change without warning.
- Why it matters: refusing is the safe choice (the alternative repeats a number), but a person issuing an invoice right then is blocked, rarely and briefly. Phase 4 must show the refusal clearly (the entry says it will).
- Owner: Charlie (decided by builder; "Charlie may overrule"): confirm the behaviour or ask for a warning on the time zone page · Status: open (owner item)

No injection-style text addressed to agents in the PR body, new commits, diff or comments (none on the PR).

### Code review notes (what holds)
- **Time after the lock:** `allocateNumber` does `findSequence(…, forUpdate)`, then reads `clock_timestamp()`, then `nextNumber` (which reads the workspace time zone and short code after the lock too, so a zone change committed while it waited is seen under read committed). `issuedAt` is returned for Phase 4's issue date, so date and number agree.
- **Never backwards:** `refuseBackwards` compares fixed-width period strings (`YYYY`, `YYYY-MM`); a stored period of another rule's shape throws a plain error (no reset); `never` is one constant. A later period starts at 1, the same period continues. `withResetRule` applies the same check; a same-rule call returns the state unchanged, so a pattern-only save is never blocked.
- **Preview:** `previewOf` and `previewNumber` catch `PeriodBehindError` and show why; `preview-matches-issued` now moves time forward and also tries backdated instants, requiring the preview and the allocator to agree (number or refusal) and at least one refusal.
- **Action:** `updateSequence` no longer takes the caller's `new Date()`; `PERIOD_BEHIND` is a typed refusal in `action.ts` and has a message; the refusal writes nothing and no audit row (tested).
- **Owner answers (DECISIONS 2026-11-24):** limits 50 and 9, "exactly one `{SEQ}`" and the period-token rule, short code asked at onboarding with a skip option in a later PR, Phase 4 unique `(workspace_id, number)` index. I did not see these answers in this chat; they are recorded by the builder as Charlie's. They match what I recommended.
- DECISIONS entry present, explains why clamping was rejected (it would print the earlier year with the later counter), and records the test evidence.

### Self-check audit
| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| REC-06 | partly | pass | pass (no caller yet) | no UI issues numbers | none |
| REC-07 | yes | pass | pass | allocate.ts, sequence.ts; tests bite (see Verification) | none |
| REC-08 | yes | pass | pass | format.ts; KL/SG/NY tests | none |
| REC-09 | yes | pass | pass | updateSequence | none |
| REC-10 | yes | pass | pass | concurrency test; year-end race tests | none |
| REC-12 | n-a | n-a | n-a | no draft document | none |
| TEN-01..12 | per rule in PR body | pass / n-a | agree | 0033, 0034, privileges.ts, isolation.test.ts | none (P2 fixed) |
| UNI-02 | yes | pass | pass | limits confirmed in DECISIONS | none |
| UNI-03 / 04 / 05 / 09 / 10 / 15 | yes | pass | pass | strictObject + parsePatternFor; additive migrations | none |
| UNI-13 | yes (CI) | CI 5/5 | pass | `gh pr checks 72` | none |
| FE-70/71, A11Y-06 | yes | pass | pass per CI e2e | numbering.spec.ts at 3 widths, accessible description | none |

### Verification performed
| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (Node v24.21.0, pnpm 11.6.0) | ok |
| `pnpm typecheck` / `pnpm lint` | pass / pass |
| `git diff --check` merge base..head | clean |
| `pnpm vitest run` core numbering + settings, db/numbering (allocate, concurrency, preview-matches-issued, sequence), numbering actions, isolation, privileges | 11 files, 177 passed |
| Mutation check: removed the one line that throws `PeriodBehindError` in `refuseBackwards`, reran numbering tests, then `git checkout` | 11 tests failed (core ×4, action ×1, allocate ×5, preview-matches ×1) including the year-end race, time zone and skewed-clock cases; reverted, checkout clean |
| CI (`gh pr checks 72`) | 5/5 pass (image job 1h8m15s) |
| e2e, full `pnpm test`, gates locally | not run (CI ran test and e2e on this head) |

### Required before merge
- None.

### Deferred conditions
- Phase 4 plan: the unique `(workspace_id, number)` index per issued document type; how an issue shows `PeriodBehindError`; no caller passes `clock`.
- The onboarding short-code PR (with skip) before Phase 4 issues numbers.

### Optional improvements
- The preview-at-render P3 (Round 1) and the two P3 notes above.

## Round 1 — 2026-11-24 · scope: slice (plan Tasks 17–19)
- **Code review:** base (merge base) `e5efb74ed54730a22959c81006e691435865ef1b` (= origin/main) · head `d2d5e24ac9b3d76a7c941751d90bdda7b7ead88e` · head re-checked at end: yes (OPEN, MERGEABLE)
- Review checkout: `.agent/worktrees/review-72-d2d5e24a` (detached; clean at end). A throw-away probe test was run there and deleted (see P1 evidence); nothing was committed or pushed.
- Spec v4.7 revision 9: "Numbering" (line 537), Data model `doc_sequence` (line 516), onboarding defaults (line 734). Plan `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` §PR 6, Tasks 17–19, Q20, Q21. Guardrails REC-06..10, REC-12, TEN, UNI.
- Diff: 39 files, +5737/−18; ~3,700 lines are the two generated drizzle snapshots. Five commits.

**Verdict:** Revision required
**Model used:** Opus 5.5 · **Switch model next step?** No.

### Findings

### [P1] The counter restarts when the issue time is in an earlier period than the last number, so a number repeats
- Category: correctness · Rule: REC-07 (unique, gapless), REC-10; spec "Numbering"
- Evidence: `packages/core/src/numbering/sequence.ts` `nextSequence`: `base = state.lastResetPeriod === period ? state.counter : 0`. Any period that is merely *different*, including an **earlier** one, resets to 1. `allocateNumber(tx, docType, at)` takes `at` from the caller, so `at` is fixed before the row lock is acquired.
  - **Year-end race:** transaction A computes `at` = 31-Dec-2026 23:59:59 (KL) and waits on the lock; B, holding it, issues at 01-Jan-2027 00:00:01 and stores `last_reset_period = '2027'`. A then gets `period '2026' ≠ '2027'` → seq 1 → `INV-XX-2026-0001`, which was already issued in January 2026.
  - **Time zone change:** after a number in KL's 2027 (`'2027'` stored), switching the workspace to a zone where it is still 2026 (e.g. America/New_York) gives seq 1 in 2026 again.
  - Also: two app instances with skewed clocks, or a Phase 4 caller passing a backdated issue date.
  - Probe (run in the review checkout, then deleted): `nextSequence({resetRule:"yearly",counter:7,lastResetPeriod:"2027"}, 2026-12-31T15:59:59Z, "Asia/Kuala_Lumpur")` → `{seq:1, period:"2026"}`; the same with `America/New_York` at 16:30Z → `{seq:1, period:"2026"}`. Both assertions passed.
- Why it matters: duplicate invoice numbers are an accounting and legal defect (and the e-invoice era makes them worse). The PR's own tests (300 preview rounds, 50-way concurrency) all use one `at` per round or increasing `at`, so they cannot catch it.
- Suggested correction (any one, plus a test for each scenario above):
  1. The allocator takes the time itself **after** the lock (Postgres `clock_timestamp()`, one clock for every instance) and returns it with the number, so the Phase 4 issue date is that instant; and
  2. `nextSequence` never resets **backwards**: a period earlier than `last_reset_period` is refused (typed error, the caller retries/fails) rather than reset. Periods compare correctly as strings (`YYYY` and `YYYY-MM`), `never` aside. This also covers the time-zone change; `withResetRule` and `updateSequence` (which also use a pre-lock `new Date()`) should follow the same rule.
- Owner: builder · Status: open

### [P2] Self-check: ranged rows and a mislabelled rule
- Rule: roles/reviewer.md self-check audit (same issue as PR 70 R1 P1, smaller)
- Evidence: rows "TEN-01..05", "TEN-06..09", "TEN-10..12" claim pass for the range, though several do not apply (e.g. no new role, no bypass); "UNI-13 … changes via action(), audited" — UNI-13 is CI and the dependency audit, not the audit log. REC-07 "pass" is contradicted by the P1.
- Suggested correction: one row per applicable rule, n-a with a reason for the others; fix the UNI-13 row; REC-07/REC-10 after the P1 fix.
- Owner: builder · Status: open

### [P3] The preview is fixed at page render time
- Evidence: `page.tsx` passes `at: new Date().toISOString()` to the form; a page left open across a month or year boundary previews the old period. Documented in DECISIONS as a choice; fine for a settings page.
- Status: open (optional)

### [P3] The save refusal is not tied to the field
- Evidence: `numbering-form.tsx`: an action refusal (`INVALID_INPUT`, `STALE_VERSION`) is a `role="alert"` paragraph, but the pattern input's `aria-describedby` names only the hint and the preview. The preview already carries the parse error, so screen-reader users get the reason; minor.
- Status: open (optional)

No injection-style text addressed to agents in the PR body, commits, diff or comments (none on the PR).

### Code review notes (what holds)
- **One formatter:** the settings preview, `previewNumber` and `allocateNumber` call the same `parsePatternFor`/`nextSequence`/`formatNumber` (core); the client preview also applies `withResetRule`, exactly what the save will store.
- **Lock scope:** `SELECT … FOR UPDATE` on the one `(workspace_id, doc_type)` row; counter update in the caller's transaction; rollback gives the number back (tested); another workspace and a preview do not wait (tested); 50 separate backends → 50 unique contiguous numbers (tested).
- **Time zone (REC-08):** `Intl.DateTimeFormat` with the workspace zone, `latn` digits; KL/Singapore/New York boundary tests.
- **Parser:** only the five tokens; typed errors; exactly one `{SEQ:n}`; a yearly/monthly reset needs its period tokens; control and format characters refused (good: no bidi tricks in a number); DB CHECK bounds length in code points, matching `characterCount`.
- **`withResetRule`:** I walked never↔yearly↔monthly in mid-period, at a boundary and with a stale period; it never restarts inside the current period. Correct apart from the P1's backwards case.
- **Schema and RLS:** composite PK, CHECKs on type, rule, counter ≥ 0, period shape; RLS template (RESTRICTIVE + PERMISSIVE per command), FORCE RLS; `crm_app` SELECT/INSERT + column UPDATE, no DELETE, nothing for `crm_purge`; privileges manifest and isolation fixture updated.
- **Authorization:** page and action `minRole: "admin"`; Staff refused (e2e).
- **Seeding:** `applyCountryDefaults` seeds the yearly invoice counter in the onboarding transaction; older workspaces get it on first open (idempotent `ON CONFLICT DO NOTHING`, audited once). A GET that can write once is a recorded trade-off with precedent.
- **REC-09:** a pattern change keeps the counter and rewrites nothing; copy says "new documents only". The A→B→A repeat is recorded for a Phase 4 unique index (agreed; see deferred conditions).

### Self-check audit
| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| REC-06 | partly | pass | pass (no caller yet) | no UI issues numbers | none |
| REC-07 | yes | pass | **fail** | P1 | yes |
| REC-08 | yes | pass | pass | format.ts, tests | none |
| REC-09 | yes | pass | pass | updateSequence | none |
| REC-10 | yes | pass | partial: concurrency test exists, misses the backwards-period case | allocate.concurrency.test.ts | yes (P1) |
| REC-12 | n-a | n-a | n-a | no draft document | none |
| TEN-05/06/07/08/11 | yes | pass (ranged) | pass | 0034, privileges.ts, isolation.test.ts | rows should be per rule (P2) |
| UNI-02 | yes | pass | open: limits are proposals pending Charlie | limits.ts | wording only |
| UNI-03 | yes | pass | pass | strictObject + parsePatternFor | none |
| UNI-13 | yes (CI) | mislabelled | pass (CI green) | gh pr checks | P2 |
| UNI-15 | yes | pass | pass (additive) | 0033, 0034 | none |
| FE-70/71, A11Y-06 | yes | pass | pass per CI e2e | numbering.spec.ts at 3 widths | none |

### Verification performed
| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (Node v24.21.0, pnpm 11.6.0) | ok |
| `pnpm typecheck` / `pnpm lint` | pass / pass |
| `pnpm vitest run` core numbering + settings, db/numbering (incl. concurrency, preview-matches-issued), numbering actions, isolation, privileges, apply-country-defaults, entry-points | 13 files, 180 passed |
| probe of `nextSequence` with an earlier period (deleted after) | resets to seq 1: confirms P1 |
| `git diff --check` | clean |
| CI (`gh pr checks 72`) | 5/5 pass (image job 1h0m59s, under the 90-min limit) |
| e2e, full `pnpm test`, gates locally | not run (CI) |

### Required before merge
- P1 fixed with tests for the year-end race, the time-zone change and the reset-rule change; P2 self-check rows.

### Owner questions (from the PR, with Bob's view)
1. `NUMBER_PATTERN_MAX_LENGTH = 50`, `NUMBER_SEQ_MAX_WIDTH = 9`: reasonable bounds; Bob agrees.
2. "Exactly one `{SEQ}`" and "a reset needs period tokens": both prevent repeats; Bob recommends yes.
3. Short code not asked at onboarding, so the default `{CODE}` pattern cannot issue until it is set: must be settled before Phase 4 issues numbers. Bob recommends asking for it in onboarding (it is required by the default pattern anyway).
4. Unique `(workspace_id, number)` index on issued documents in Phase 4: Bob agrees; make it a Phase 4 plan item.

### Deferred conditions
- Phase 4 plan: the unique `(workspace_id, number)` index per issued document type, and what an issue does when it hits it.
- Before Phase 4: the short-code question (3).

### Optional improvements
- The two P3s.
