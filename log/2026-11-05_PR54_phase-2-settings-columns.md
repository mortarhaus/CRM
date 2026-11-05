# PR 54 — feat: Phase 2 PR 2a, workspace_settings columns and settings data layer

- **Merged:** 2026-11-05T03:03:15Z · **Merge commit:** f90fd5fb485867b277cc5cf6d8cbcdfbe6f1fc5f · **Branch:** feat/p2-settings-columns
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-54.receipt` on agent-logs (log-branch commit 7bf51c7b holds the review; written 2026-11-05T01:49:22Z, before the merge; head 5537c6a, review-file hash 11493a67…)
- **Merge evidence:** `gh pr view 54` state MERGED with the time above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head 5537c6a equals the reviewed head. CI green on 5537c6a after two flake re-runs.
- **Drafted by:** Opus 5.5 sub-agent (code), Sonnet 5.5 builder (verification, PR) · **Final verdict:** Approved (round 1, re-checked 2026-11-05)
- **Spec:** docs/superpowers/specs/2026-09-27-core-sales-design.md (v4.7 revision 8, unchanged) · **Plan:** docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md (PR 2, Tasks 4-5) · **Milestone:** Phase 2 (settings and onboarding)

## What changed
Migration 0024 (the spec line-460 `workspace_settings` columns without bank/QR and proposal cover, with CHECKs) and 0025 (REVOKE table-wide UPDATE, per-column UPDATE grants to `crm_app`); `getSettings`/`updateSettings` with optimistic concurrency and one audit row (PII fields redacted); `updateBrandingSettings` and `updateGeneralSettings` actions (Admin and Owner); a `STALE_VERSION` refusal in `action()`; the AUTH-01 text for `POST /theme` changed to "confirmed by Charlie". No UI.

## Why
Phase 2 plan PR 2 Tasks 4-5: storage and write path for branding and settings before the branding page (PR 2b).

## Review rounds
- R1: Approved, no P0-P2 findings; six P3 notes (below). Re-check 2026-11-05: head unchanged, all four CI checks green, verdict stands.

## Deferred conditions
- PR 3: CHECK and Zod requiring `tax_registration_no` when `tax_registered` (spec line 731); PR 3 migration is 0026 or later.
- PR 2b at the latest: the outdated-browser notice (Charlie's PR #53 direction).
- Docs-only in PR 2b: DECISIONS moves the length limits (200 / 100 / 254) and `default_tax_rate_bps` from builder proposal to "confirmed by Charlie"; also Q1 = A, Q5 = A (`#0e6c84`), Q15 = A recorded as confirmed and the plan's "pending re-confirmation" text changed.

## Decisions worth keeping
- Charlie (Bob session, 2026-11-04): "yes to a and b" — length limits 200/100/254 and the tax rate in basis points confirmed.
- Charlie (Bob session, 2026-11-05): "1A, 2A, 3A" — Q1 revised contrast rule with fixed dark tokens; default accent `#0e6c84`; `step_up` as a tenant table (or a session column if the Task 13 spike prefers). PR 2b is unblocked.
- Plan deviations accepted: `default_tax_rate_bps integer` (spec basis-points rule), five flat address columns (Q11), `country` shape-only CHECK with MY/SG in Zod at PR 3, `STALE_VERSION` refusal, actor argument on `updateSettings`, grants in their own migration 0025.
- Two flaky tests seen in CI on this PR (not caused by it): `src/jobs/boss.test.ts` "sends inside a held auth transaction" (30 s timeout; third occurrence) and the axe `document-title` check at `/two-factor` mobile-320. Offered to Charlie as a small test-reliability PR.

## Follow-ups
- P3: `text()` lets format/bidi characters (`\p{Cf}`) through; short code `""` is refused instead of cleared; `email_bcc_self`/`auto_send_default` nullable with no default (make `default false not null` when PR 8 first reads them); size ~590 hand-written lines over the 400 target.
- Next: Phase 2 PR 2b (branding page, colour picker, contrast, brand token, outdated-browser notice).

## Appendix — final review round
**Re-check 2026-11-05 (no new round):** the head is still `5537c6a4871b83196531087a6470a8130e2b150c`, with no new commits since Round 1. All four CI checks on it are green: Typecheck, lint, test; Dependency audit; Secret scan; Image, Trivy, E2E. That covers the full suite, build and e2e that Round 1 did not run locally. The Round 1 verdict (Approved) stands, and its "green CI" condition is met.

## Round 1 — 2026-11-04 · scope: slice (Phase 2 plan PR 2, Tasks 4-5; Task 6 is PR 2b)
- **Code review:** base (merge base) `86040d217a46c5069953b655ff25f61dfc9e088b` (= `origin/main`) · head `5537c6a4871b83196531087a6470a8130e2b150c` · head re-checked at end: yes (via `git ls-remote origin refs/pull/54/head`, unchanged)
- Review checkout: `.agent/worktrees/review-54-5537c6a4` (detached). One commit, 17 files, +4195/−19 (about 3,540 of that is the two Drizzle snapshots; about 590 hand-written lines).
- Spec: `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 revision 8, hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`, untouched.

**Verdict:** Approved
**Model used:** Opus 5.5 (deep tier) · **Switch model next step?** No.

### Findings
No P0, P1 or P2 findings.

What "Bob looks first at" (plan PR 2) found:
- **CSS injection through the hex:** closed at both layers. Zod trims, lower-cases and matches `^#[0-9a-f]{6}$`. The column has CHECK `brand_colour ~ '^#[0-9a-f]{6}$'`, and a test proves storage refuses a bad value with 23514. Nothing renders the colour yet (that is PR 2b).
- **RLS on the new columns:** the table's RLS policies are unchanged and cover every column. `0025` revokes the table-wide UPDATE from `crm_app` and grants UPDATE only on the 27 settings columns plus `version` and `updated_at`. `workspace_id` and `created_at` are not writable (42501 test). `crm_purge` gets nothing (spec line 897). `isolation.test.ts` now proves workspace A cannot update B's `brand_colour`. The only other writer, `ensureWorkspaceSettings`, uses `INSERT … ON CONFLICT DO NOTHING`, so it needs no UPDATE grant.
- **Who may write branding (Q2):** `minRole: "admin"` on both actions (Admin and Owner), as Charlie confirmed. Staff gets `FORBIDDEN` (test).
- **Contrast (Q1):** not in this PR (Task 6, PR 2b, still gated on Charlie's Q1 re-confirmation).

### [P3] Notes (optional)
1. **`text()` lets bidi and invisible format characters through.** The rule `/^\P{Cc}*$/u` blocks control characters, but not format characters (`\p{Cf}`) such as U+202E (right-to-left override) or U+200B (zero width space). An address or name containing them can display reversed or confusingly on a quote or invoice. Suggest `/^[^\p{Cc}\p{Cf}]*$/u`, or at least the bidi range U+202A–U+202E and U+2066–U+2069, before these fields reach a document (PR 3 or the PDF PR).
2. **Short code can't be cleared with an empty string.** `text()` turns `""` into `null`, but `shortCode` runs the `{2,6}` regex on `""` and refuses it. A cleared form field gives INVALID_INPUT instead of clearing the code. Fine if the UI will send `null`. Otherwise match `text()`. Note: the spec may want the short code to be required once numbering uses it (PR 6); decide then.
3. **`email_bcc_self` and `auto_send_default` are nullable booleans with no default.** The other flags (`tax_registered`, `require_2fa`) are `default false not null`. Every reader must then treat `null` as `false`. Suggest the same `default false not null` when PR 8 (email) first reads them.
4. **"Registration number required when tax_registered" (spec line 731) is not enforced in storage yet.** The PR body defers it to PR 3, which is where `tax_registered` first becomes writable (no action here writes tax fields). I agree, but PR 3 must add the CHECK `not tax_registered or tax_registration_no is not null` together with the Zod rule.
5. **Size:** about 590 hand-written lines against a 400 target. The split the builder offers (Task 4 / Task 5) would leave a schema PR nothing uses. I reviewed it whole. No action.
6. **Plan deviations, all written up in the PR body and DECISIONS 2026-11-04 (Phase 2 PR 2a):**
   - `default_tax_rate_bps integer` instead of the plan's `numeric`. This matches the spec's own `tax_rate_override_bps` and `line_discount_bps` style, so it is the better choice.
   - The five flat address columns match Q11's recommendation, which Charlie adopted, so it is not really a deviation.
   - `STALE_VERSION` added to `action()`'s refusals. A handler throws it, and `action()` catches it and rolls the transaction back (`action.ts` lines 143-144).
   - The actor argument on `updateSettings`, and grants in their own migration `0025`.
   - The 200/100 length limits are invented and need Charlie's OK (see owner items).
7. **`idempotent: false` on both settings actions is acceptable.** The version check already makes a double-submit safe: the second submit gets `STALE_VERSION` and writes nothing.

**Carried from PR #53 (not a finding on this PR):** the outdated-browser notice that Charlie asked for is not in PR 2a. The PR #53 deferral said "Phase 2 PR 2 or a small PR before it". Since PR 2 is now split, it should land in PR 2b at the latest.

**Owner items for Charlie:**
- (a) Confirm the length limits: 200 characters per address line, 100 for city, postcode, state, tax number, TIN, BRN, tax name and sender name, 254 for the reply-to email. These are builder values, not from the spec.
- (b) Confirm the tax rate is stored in basis points (8% = 800), the same way line discounts already are.

**Owner decisions (Charlie, 2026-11-04, Bob session: "yes to a and b"):** (a) the length limits 200 / 100 / 254 are confirmed. (b) The tax rate stored in basis points (`default_tax_rate_bps`) is confirmed. The builder records both in the DECISIONS 2026-11-04 (Phase 2 PR 2a) entry, which moves them from "builder proposal" to "confirmed by Charlie". This is a docs-only change, so it can go in PR 2b rather than changing the approved head.

**Owner decisions for PR 2b and PR 5 (Charlie, 2026-11-05, Bob session: "1A, 2A, 3A"):** these settle the plan's (PR #52) items that were pending re-confirmation.
- **Q1 = A.** Accent text is automatically black or white. In Phase 2 the accent is used only as a fill and focus ring (never as text or link colour) and needs 3:1. A stored colour is never refused for contrast. A per-theme variant is derived and previewed so it reaches 3:1 on that theme's surfaces. Dark tokens are fixed (`--background` `#080c10`, `--card` `#0c1218`).
- **Q5 = A.** The default accent is `#0e6c84`.
- **Q15 = A.** A tenant table `step_up(workspace_id, session_id, verified_at)` under the RLS template. The builder may use a column on Better Auth `session` instead if the Task 13 spike prefers it. No spec revision.

The builder records all three in `docs/DECISIONS.md` as confirmed by Charlie, and changes the plan's "pending re-confirmation" text to confirmed. PR 2b's contrast work is now unblocked.

**Injection check:** no text in the PR body, the commit, code comments or the DECISIONS entry addresses an AI agent.

### Self-check audit
Built before reading the builder's table.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| AUTH-01 action() order | Yes, two new mutating actions | pass | Pass | both use `action()` with `minRole`, strict Zod; refusal caught in `action.ts` 143-144 | — |
| AUTH (role per group, Q2/Q9) | Yes | pass | Pass | `minRole: "admin"`; Staff FORBIDDEN test | — |
| TEN-01 RLS on tenant table | Yes | pass | Pass | policies unchanged; isolation case on `brand_colour` | — |
| TEN per-column grants (Phase 1 pattern) | Yes | pass | Pass | `0025`; `privileges.ts` manifest; 42501 tests | — |
| TEN `crm_purge` no read (spec 897) | Yes | pass | Pass | no grant in 0024/0025; manifest | — |
| TEN-10 no raw db in app code | Yes | pass | Pass | data layer takes `tx`; lint clean | — |
| UNI-03 input validated server-side + storage | Yes | pass | Pass, P3 #1 #2 | Zod + CHECKs, 23514 tests | format chars (P3) |
| UNI audit trail, PII redaction | Yes | pass | Pass | `recordAudit` `workspace_settings.updated`, `piiFields` → `[pii]` test | — |
| Optimistic concurrency | Yes (plan Task 5) | pass | Pass | `FOR UPDATE` + version compare; stale test; no-op writes nothing | — |
| MON (tax rate ≥ 0, spec 550) | Yes | pass | Pass | CHECK `default_tax_rate_bps >= 0`; name/rate null unless registered | — |
| Migrations + snapshot consistent | Yes | pass | Pass | `drizzle-kit generate` → "No schema changes" | — |
| Spec conformance (line 460) | Yes | pass | Pass | columns match; bank/QR in PR 5, `proposal_cover` deferred (Q24) | — |
| FE / A11Y | n/a, no UI in 2a | n/a | n/a | — | — |
| LINK / FILE / EVT / PAY / REC | n/a, not touched | n/a | n/a | `logo_key` CHECK only; upload is later | — |
| PR size | Yes | flagged | P3 #5 | ~590 hand-written | — |

### Verification performed
| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (Node v24.21.0) | OK |
| `pnpm typecheck` | pass |
| `pnpm lint` (incl. boundaries) | exit 0 |
| `pnpm vitest run` on `workspace-settings.test.ts`, `settings/actions.test.ts`, `isolation.test.ts`, `privileges.test.ts`, `entry-points.test.ts` | 5 files, 91 passed |
| `packages/core` `vitest run src/security` (limits) | 13 passed |
| `drizzle-kit generate` against the PR schema | "No schema changes, nothing to migrate"; tree clean afterwards |
| `git diff --check` | clean |
| Spec hash | unchanged |
| Read `action.ts` refusal path, `ensureWorkspaceSettings`/`healWorkspaceSettings`, `audit.ts` `piiFields` | as described above |
| Not run by me | full `pnpm test`, `pnpm test:gates`, `pnpm build`, e2e (builder reports full suite 1022 passed after one `boss.test.ts` timeout flake; CI to confirm) |

### Residual risks and test gaps
- Format and bidi characters accepted in text fields (P3 #1).
- The tax-registration-number rule is not yet enforced in storage (P3 #4, due in PR 3).
- I did not re-run the full suite or the build; merge on green CI.

### Required before merge
- None. Green CI on `5537c6a4`.

### Deferred conditions
- PR 3: CHECK and Zod requiring `tax_registration_no` when `tax_registered` (spec line 731).
- PR 2b at the latest: the outdated-browser notice (Charlie's PR #53 direction).
- Charlie: owner items (a) and (b).

### Optional improvements
- P3 #1, #2 and #3.
