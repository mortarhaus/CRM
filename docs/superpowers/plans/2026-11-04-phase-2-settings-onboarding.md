# Phase 2 — Settings, Branding, Numbering, Catalog, Templates Implementation Plan

> This plan is task data. Implementation follows `agents/START.md`, `agents/roles/builder.md` and the owner's instructions.
>
> **Status: DRAFT for Bob's plan review (2026-11-04). Charlie answered "use your recommendations for all of them" the same day: §7 records which questions that settles and which three still need a value from him (Q10, Q17, Q18, plus the event list in Q23).** Drafted by an Opus 5.5 sub-agent (read-only) for the builder (Sonnet 5.5, builder §3); the builder spot-checked the file, line and migration citations against `main` at `8a3c461`. Nothing in it is approved until Bob reviews it and Charlie approves. Facts the drafter could not verify are in §10.

- **Spec section:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 (revision 8). Phase 2 row at line 1138. Dependencies are at lines 460–462, 472, 512, 533, 730–740, 782–799, 846–847 and 1191/1280/1282.
- **Milestone:** Phase 2 (target mid-November, spec line 1138).
- **Target LOC:** 400 per PR (`agents/PROJECT.md` §4). Generated migration SQL and lockfile churn are counted but called out separately in each PR body.
- **Base:** `main` = `8a3c461`. Migrations 0000–0023 exist (latest `apps/web/drizzle/0023_password_change_grant.sql`), so Phase 2 starts at **0024**.
- **Model:** Opus 5.5 (deep tier) for PR 2, PR 3, PR 5, PR 6 and PR 7, because they touch RLS, auth, money and records. Standard tier (Opus 5.5) for PR 1, PR 4 and PR 8 (`PROJECT.md` §6).

**Goal (spec line 1138):** "Branding, country defaults, SST/GST question, own SST/GST no., TIN, BRN, timezone/locale, bank details + DuitNow QR (step-up + notification, content-addressed QR), currency/tax, numbering + preview, catalog, email templates."

**Done when (spec line 1138, verbatim):** "Pattern preview matches issued numbers; concurrency test passes; MY and SG defaults applied on sign-up; replacing the QR leaves the old file in place."

---

## 0. Gate before anything (read first)

- Charlie confirmed on 2026-11-04 ("use your recommendations for all of them") the four proposals in the DECISIONS 2026-11-04 entry (PR #51): Admin and Owner may change the brand colour, dark mode as a per-user cookie, Orvel for transition ideas only (Q2–Q3), and an AA contrast control (Q1). Bob's R1 showed the contrast rule Charlie accepted can never refuse a colour, so Q1 and the step-up storage (Q15) are revised and need his re-confirmation (§7). A new DECISIONS entry on this branch records that confirmation and the other accepted recommendations.
- `builder.md` §8: stop and ask before the first PR of each milestone. That is PR 1 below.

---

## 1. Facts verified (file:line read by the drafter)

| Fact | Source |
|---|---|
| `workspace_settings` today has only `workspace_id` (PK, FK organization, restrict), `version`, `created_at` and `updated_at` | `apps/web/src/db/schema/tenancy.ts` (workspaceSettings) |
| RLS on `workspace_settings` follows the policy template. `crm_app` has SELECT, INSERT and UPDATE, and no DELETE | `apps/web/drizzle/0003_rls_workspace_settings.sql` |
| Settings row created at workspace creation | `apps/web/src/lib/auth/config.ts:98-102` (`afterCreateOrganization` → `ensureWorkspaceSettings`); `apps/web/src/db/system/workspaces.ts` (`ensureWorkspaceSettings`, `healWorkspaceSettings`) |
| Workspace creation posts only `{name, slug}`, so no country is captured | `apps/web/src/app/(app)/workspaces/actions.ts` (`createWorkspaceAction` → `postToAuth('/organization/create')`) |
| `action()` order: session → workspace → role → Zod → idempotency → handler, in one transaction. Refusal codes `UNAUTHENTICATED`, `NO_WORKSPACE`, `FORBIDDEN`, `RATE_LIMITED`, `INVALID_INPUT` and `IDEMPOTENCY_KEY_REUSED`. `RANK` staff 1 < admin 2 < owner 3 | `apps/web/src/lib/auth/action.ts` |
| `emitEvent(tx,{name,version,payload})` and `enqueueJob(tx,queue,data)` exist. `EVENT_NAMES` is closed and has no settings event | `apps/web/src/jobs/enqueue.ts`, `apps/web/src/jobs/handlers.ts` (QUEUE_NAMES) |
| Queue creation is done by migration (`pgboss.create_queue('email.send', …deadLetter 'email.send.dead')`) | `apps/web/drizzle/0016_*` |
| `email.send` means the test email only. A new email kind needs its own queue | `docs/DECISIONS.md` 2026-11-01 entries |
| UNI-02 values live in `packages/core/src/security/limits.ts`. Where country defaults live is "STILL OPEN" | `agents/PROJECT.md` §9 line 257 |
| FILE-03 accepted exception: QR key `ws/{workspace_id}/duitnow/{sha256}.{ext}`, never deleted. The exception's review date is "Phase 2 gate" | `agents/PROJECT.md` §9 line 244; `docs/DECISIONS.md:776` |
| Tailwind v4 is CSS-first with no config file (FE-13 note) | `agents/PROJECT.md` §9 line 260 |
| Tokens are HSL. Dark mode comes only from `@media (prefers-color-scheme: dark)`, with an `@theme inline` map | `apps/web/src/app/globals.css` |
| CSP `style-src 'self' 'nonce-…'`, `img-src 'self' blob: data:`, `connect-src 'self'`, `font-src 'self'`. An inline `style` attribute triggers a violation (E2E probe) | `apps/web/src/proxy.ts`; `apps/web/e2e/security-headers.spec.ts` |
| App shell: header with NavLinks (Workspaces, Security, and Email for admin/owner), WorkspaceSwitcher, SignOutButton, `main` max-w-5xl | `apps/web/src/app/(app)/layout.tsx` |
| Vendored shadcn: button (cva default, outline and ghost), input, label. No icon library, font setup, GSAP or AWS SDK | `apps/web/src/components/ui/*`, `apps/web/package.json` |
| Dev compose `crm-dev` contains postgres, bootstrap, web, worker and mailpit. It has no MinIO and no `STORAGE_*` | `docker/compose.dev.yml` |
| `stepUp()` is not built in Phase 1; its first user is Phase 2 | Phase 1 plan line 133 (Settled item 5) |
| ASK 9 (`require_2fa` timing) is open. The builder's proposal is Phase 2 | Phase 1 plan line 1562; `.agent/handoff.md` §6 item 2 |
| The S3 vs MinIO contract test was n-a in Phase 1 and deferred to Phase 2 | Phase 1 plan line 1536 |
| `notification` table, schema and RLS already exist | `apps/web/src/db/schema/events.ts:26`; migrations `0019`, `0020` (builder-checked after Bob PR #52 R1) |
| `crm_purge` must not read `service`, `workspace_settings`, `email_template` or `doc_sequence` | spec line 897 |

Builder spot-check (2026-11-04, `main` = `8a3c461`): migrations end at `0023_password_change_grant.sql`; no `stepUp`/`requireStepUp` and no `STEP_UP`/`BANK_NOTICE` in `packages/core/src/security/limits.ts`; `apps/web/src/adapters` holds only `email`; spec lines 460, 792, 847 and 1138, Phase 1 plan lines 1536 and 1562, and the FILE-03 exception at `docs/DECISIONS.md:770-776` match what is cited above. The other rows were not re-read by the builder.

---

## 2. Settled items (each with its source)

1. **Kinlo look.** Slim icon sidebar with count badges; a top bar with search, a dark-mode toggle and New; a greeting plus a "what needs you" line; rounded cards on a soft cool background; one rounded sans font; one accent colour. No code or assets copied (both demos are paid templates). Source: `docs/DECISIONS.md` 2026-11-04 (1).
2. **Motion.** All page and card transitions use view transitions, staggered card entrance, and chart/range-toggle motion. GSAP is used only where CSS and the View Transitions API cannot do the job, and is pinned exactly in the PR that adds it. `prefers-reduced-motion` turns motion off or down. Source: DECISIONS 2026-11-04 (2); FRONTEND_STANDARDS §3.9.
3. **Accent colour.** A hex field plus a drag picker, stored as the workspace brand colour and applied as a semantic token. Source: DECISIONS 2026-11-04 (3); spec line 460 ("branding (brand colour …)").
4. **Confirmed by Charlie 2026-11-04** (accepting the builder recommendations for the DECISIONS 2026-11-04 "Builder proposals"): Admin and Owner may change the colour; dark mode is a per-user cookie; Orvel for transition ideas only (Q2–Q3). The contrast rule (Q1) and the step-up storage (Q15) are revised after Bob's R1/R2 and await his re-confirmation (§7): automatic black or white text; the accent is only a fill and focus ring (3:1), never text; the owner's colour is never refused for contrast and a per-theme variant is derived and previewed; fixed dark tokens `#080c10`/`#0c1218`.
5. **Permissions.** "Templates, numbering, email settings, catalog" are Admin and Owner. "Bank details, DuitNow QR (step-up)" are Owner only. Source: spec lines 782–799.
6. **Bank or QR change consequences.** Step-up (a fresh TOTP within the last 5 minutes); an audit entry with account numbers as last-4 plus SHA-256, and the QR as its hash key; an email to all owners; a "Bank details updated on {date}" line on invoices for 60 days (printed in Phase 4). Source: spec lines 792–799.
7. **The QR is content-addressed and never deleted** (not by replacement, orphan sweep or purge). `duitnow_qr_key` points at the current file. Source: spec line 847; FILE-03 exception (PROJECT.md §9 line 244).
8. **Uploads.** Magic-byte allow-list (PDF, PNG, JPG; never SVG or HTML), `ws/{workspace_id}/{uuid}` keys, signed URLs ≤ 10 minutes, `Content-Disposition: attachment`, `nosniff`. Source: spec line 846.
9. **Storage is S3-compatible via AWS SDK v3** (S3, R2, MinIO), with a path-style toggle and a private bucket. Dev compose gets `minio`, and env gets `STORAGE_*`. Source: spec lines 427, 1087 and 1097.
10. **Numbering.** Tokens `{CODE}` `{YYYY}` `{YY}` `{MM}` `{SEQ:n}` plus free text. Assigned only on issue/send, under `SELECT … FOR UPDATE` on the `doc_sequence` row. Period tokens use the workspace timezone. A pattern change affects new documents only. Live preview in settings. Source: spec lines 512 and 533.
11. **MY defaults:** MYR, `INV-{CODE}-{YYYY}-{SEQ:4}`, Asia/Kuala_Lumpur, dd-mmm-yyyy (Q10, 2026-11-08; was dd/mm/yyyy), locale en. **SG defaults:** SGD, Asia/Singapore, the same pattern, date format and locale. Tax is off by default. One SST/GST question: Yes means a registration number is required and the tax is preselected (MY Service Tax 8%, SG GST 9%, editable). TIN and BRN are optional. The answer can be changed later by an admin and applies to new documents only. Source: spec lines 730–733.
12. **Configurable values live in `workspace_settings`, `doc_sequence` and `email_template`.** Country defaults are applied at sign-up. Settings never go on `organization`. Source: PROJECT.md §8 line 191.
13. **No `crm_purge` grants on Phase 2 tables,** but `crm_purge` stays in each RESTRICTIVE policy's role list (template). Source: spec line 897; Phase 1 plan lines 32–45.
14. **Email templates use React Email for layout.** Template substitution is single-pass `{{field}}` with escaped output. Source: spec line 426; FILE-05 and FILE-06.
15. **UI stack:** Tailwind, shadcn, TanStack Form, `cn()`/`cva()`, semantic tokens. Source: spec line 429; FRONTEND_STANDARDS.

---

## 3. PR checkpoints

| PR | Tasks | Scope | Migrations | Stop-and-ask (builder §8) |
|---|---|---|---|---|
| 1 | 1–3 | UI foundation: Kinlo tokens (v4 `@theme`), font, icons, app shell (sidebar and top bar), dark-mode toggle, motion primitives with reduced motion | none | **Yes:** first PR of the milestone, and Q4–Q7 answered |
| 2 | 4–6 | `workspace_settings` columns (all of spec line 460 except bank and QR), settings data layer, branding page (hex + drag picker + contrast), nonce'd brand token | 0024 | Q1–Q3 answered |
| 3 | 7–9 | Country defaults module (core), onboarding step (country + SST/GST), tax/TIN/BRN, timezone/locale/currency settings page | 0025 (CHECKs if needed) | **Yes:** new core module `settings`; Q8–Q11 answered |
| 4 | 10–12 | Storage adapter (S3/MinIO), MinIO in compose, upload validation, logo upload and serve route | none | **Yes:** new module `src/adapters/storage`, new dependency (UNI-06); Q12–Q14 answered |
| 5 | 13–16 | `stepUp()`, bank details and DuitNow QR (owner, step-up, audit), first `notification` producer, owner email queue | 0026 `step_up`, 0027 bank columns, 0028 queue | Q15–Q19 answered |
| 6 | 17–19 | Numbering core module, `doc_sequence` plus allocator, preview UI, concurrency test | 0029–0030 | **Yes:** new core module `numbering`; Q20–Q21 answered |
| 7 | 20–22 | Money core (currency exponent, decimal → minor), `service` table and catalog CRUD | 0031–0032 | **Yes:** new core module `money`; Q22 answered |
| 8 | 23–25 | `email_template` table, single-pass renderer, templates settings page | 0033–0034 | Q23–Q24 answered |

PR 2 is cut as 2a (Tasks 4–5) and 2b (Task 6); PR 5 is cut as 5a (Task 13), 5b (Tasks 14–15) and 5c (Task 16); the sections below keep one heading per numbered PR. The migration numbers are indicative; the builder takes the next free number when each PR is cut. Each PR's LOC is an estimate. If an estimate goes over 400, split at the task boundary shown, never mid-task.

---

## 4. Tasks

### PR 1: UI foundation (≈380 LOC)

**Guardrails:** FE-01–07, FE-10–14, FE-20–24, FE-31/32/34, FE-40–42, FE-50–52, FE-60/61, FE-70/71, A11Y-01–06, UNI-06, UNI-09.
**Bob looks first at:** CSP compliance of the theme mechanism (no inline `style`, no inline script); reduced motion; contrast of the new palette in both modes; no copied template assets.

**Task 1: tokens for Tailwind v4**
- Files: `apps/web/src/app/globals.css`; `FRONTEND_STANDARDS.md` (only the FE-13 note, if Charlie agrees).
- [ ] Replace the HSL tokens with the Kinlo palette as semantic tokens: `--background` (soft cool), `--card`, `--card-foreground`, `--muted`, `--border`, `--ring`, `--accent`, `--accent-foreground`, `--destructive`, radius scale. Map them in `@theme inline`. Keep the existing token names so `button.tsx`, `input.tsx` and `label.tsx` keep working. Fixed values the contrast control depends on: light `--background` `#f4f7fb`, `--card` `#ffffff`; dark `--background` `#080c10`, `--card` `#0c1218` (relative luminance ≤ 0.0058, so the default accent `#0e6c84` reaches 3.27:1 and 3.14:1 on them). Other tokens are chosen in the PR; these four are not changed without updating Task 6.
- [ ] Add a dark mode class strategy with `@custom-variant dark (&:where(.dark, .dark *))`. When no preference is stored, fall back to `prefers-color-scheme` (the current behaviour).
- [ ] The default accent is the placeholder `#0e6c84` (Q5, Kinlo accent) until a workspace sets one in PR 2.
- [ ] Test: extend `e2e/accessibility.spec.ts` so axe runs in light and dark at chromium, tablet-768 and mobile-320.

**Task 2: font, icons, shell**
- Files: `apps/web/src/app/layout.tsx`; `apps/web/src/app/(app)/layout.tsx`; new `apps/web/src/components/shell/{sidebar,top-bar,nav-item,theme-toggle}.tsx`; `apps/web/public/fonts/*` (if a local font is chosen).
- [ ] Font per Q4. The recommendation is a self-hosted woff2 under `font-src 'self'` via `next/font/local`, with its licence recorded in DECISIONS.
- [ ] Icons per Q6. The recommendation is `lucide-react` pinned exactly, with the UNI-06 ladder in DECISIONS.
- [ ] Sidebar as a `<nav aria-label="Main">` with icon links and visible names (`aria-label` plus tooltip). Count badges render only when a count exists; no feature has one yet, so the API is a prop only.
- [ ] Top bar: the theme toggle and a "New" menu that lists only what exists (Workspace). No search box until Phase 3 (Q7, UNI-05).
- [ ] Greeting line uses the user's name; the "what needs you" line is empty until Phase 4 or 5.
- [ ] Keep the existing NavLinks destinations (Workspaces, Security, Email) and the WorkspaceSwitcher and SignOutButton.
- [ ] Mobile-320: sidebar collapses to a bottom bar or a disclosure (FE-70).

**Task 3: dark-mode toggle and motion**
- Files: new `apps/web/src/app/(app)/theme/actions.ts`; `apps/web/src/lib/theme.ts`; `apps/web/src/components/motion/*`; `globals.css`.
- [ ] The theme toggle is a `<form>` posting to a server action that sets a cookie (`crm_theme=light|dark|system`, `SameSite=Lax`, `Secure` in production, `HttpOnly`). The root layout reads the cookie server-side and sets `class="dark"` on `<html>`, so there is no inline script and no FOUC. Settled (Q3): a per-user cookie, not a user column. Works without JS (FE-60, `no-javascript.spec.ts`).
- [ ] Motion: CSS-only staggered card entrance (`@keyframes` plus `animation-delay` from a class scale, not inline styles); `@media (prefers-reduced-motion: reduce)` disables it.
- [ ] View transitions: verify current Next 16.4.2 / React 19.3 support first (unverified, see §10) and record the finding in DECISIONS. Use `@view-transition { navigation: auto; }` CSS if that is sufficient. No GSAP in this PR.
- [ ] Tests: `e2e/theme.spec.ts` (toggle persists across reload; JS disabled works; reduced-motion emulation leaves no running animation); the existing `security-headers.spec.ts` stays green (no CSP violation).

**Done when:** the shell renders in both themes at all three widths with axe at 0 violations; no CSP violations; reduced motion is respected. (Groundwork: no spec done-when item.)

---

### PR 2: `workspace_settings` columns and branding (≈390 LOC)

**Guardrails:** TEN-01–12, AUTH-01–05 (role check), FE-05/06, A11Y-02, UNI-02/03/05, REC n-a.
**Bob looks first at:** CSS injection through the hex value; RLS on the new columns; who may write branding (Q2); contrast enforcement (Q1).

**Task 4: schema**
- Files: `apps/web/src/db/schema/tenancy.ts`; `apps/web/drizzle/0024_workspace_settings_columns.sql` (via `pnpm db:generate --name workspace_settings_columns`); `apps/web/src/db/privileges.ts`; `privileges.test.ts`.
- [ ] Add these columns from spec line 460: `short_code`, `logo_key`, `brand_colour` (text, CHECK `^#[0-9a-f]{6}$`), `address` (shape per Q11), `country` (char(2)), `timezone`, `locale`, `date_format`, `base_currency`, `default_currency` (char(3)), `tax_registered` (bool, default false), `tax_registration_no`, `own_tin`, `own_brn`, `default_tax_name`, `default_tax_rate` (numeric, CHECK `>= 0`, and CHECK that tax name and rate are null when `tax_registered` is false), `tax_rounding` (default `'rate_group'`), `email_from_name`, `email_reply_to`, `email_bcc_self`, `auto_send_default`, `default_agreement_pattern` (CHECK in `service_agreement`, `msa_sow`; default `service_agreement`), `require_2fa` (bool, default false).
- [ ] Every column is nullable or defaulted, so existing rows stay valid. The bank and QR columns come in PR 5.
- [ ] `crm_app` UPDATE grants are per column (Phase 1 pattern). There are no `crm_purge` grants (spec line 897).
- [ ] Test: `privileges.test.ts` manifest updated. `isolation.test.ts` already covers `workspace_settings`; add a case that workspace A cannot UPDATE B's `brand_colour`.

**Task 5: settings data layer**
- Files: new `apps/web/src/db/settings/workspace-settings.ts` (`getSettings(tx)`, `updateSettings(tx, patch, expectedVersion)`); new `apps/web/src/app/(app)/settings/actions.ts`.
- [ ] `updateSettings` uses optimistic concurrency (`WHERE version = $expected`, then `version + 1`) and calls `recordAudit(tx, {action:'workspace_settings.updated', before, after, …})`.
- [ ] Each settings action runs through `action()` with the role required for that group (Q2 and Q9) and a Zod schema. Hex input is lower-cased and must match `^#[0-9a-f]{6}$` (UNI-03).
- [ ] Unit tests: a stale version is refused; a staff member is refused (`FORBIDDEN`); the audit row is written.

**Task 6: branding page and brand token**
- Files: new `apps/web/src/app/(app)/settings/branding/page.tsx`; `components/settings/colour-picker.tsx`; `packages/core/src/branding/contrast.ts` plus test; `apps/web/src/app/(app)/layout.tsx`.
- [ ] Colour picker: a `<input type="text">` hex field (labelled), plus a drag picker (2D saturation/value area with a hue slider, keyboard-operable with arrow keys, `role="slider"` with `aria-valuetext`). Use a small custom picker or a pinned dependency per UNI-06 (Q6 covers the dependency question). It must work without JS through the hex field (FE-60).
- [ ] `contrast.ts`: `relativeLuminance(hex)`, `contrastRatio(a,b)`, `pickForeground(hex)` (black or white, whichever is higher), `deriveAccent(hex, surfaces, min=3)`. **Builder proposal, replaces the earlier Q1 rule (Bob PR #52 R1 P1 and R2 P2; Charlie re-confirms; confirmed, Q1 = A, Bob session 2026-11-04/05):** (a) `--accent-foreground` is derived automatically (black or white); that alone can never fail (best of the two is always ≥ 4.58:1). (b) **Where the accent is used in Phase 2:** as a fill (primary button, badge, selected state) and as the focus ring, all non-text uses, so the minimum is 3:1 against the adjacent surface (A11Y-02, UI components). It is **never** a text or link colour in Phase 2: links use `--foreground` with an underline. If a later phase colours text with it, that use needs 4.5:1 and a plan change. (c) The stored brand colour is the owner's choice and is never refused for contrast. For each theme the app derives the colour actually rendered: if the stored hex is < 3:1 against that theme's `--background` or `--card`, `deriveAccent` moves its lightness (darker on the light theme, lighter on the dark theme) in small steps until both surfaces reach ≥ 3:1 (always possible: black on light and white on dark reach far more than 3:1). The branding page previews both rendered variants so the owner sees what ships. Only invalid hex values are refused.
- [ ] Brand token: the layout renders `<style nonce={nonce}>:root{--accent:#xxxxxx;--accent-foreground:#yyyyyy}</style>`, built only from the validated DB value, never from raw input. Each value is checked again against the regex at render (defence in depth).
- [ ] Tests: `contrast.test.ts` runs against the real token values from Task 1 (light `--background` `#f4f7fb`, `--card` `#ffffff`; dark `--background` `#080c10`, `--card` `#0c1218`): known WCAG pairs; `#0e6c84` is unchanged in both themes (6.01/5.59 light, 3.27/3.14 dark); a pale hex (`#ffe066`) is darkened on the light theme to ≥ 3:1 on both surfaces; a dark navy hex is lightened on the dark theme to ≥ 3:1 on both surfaces; the derived foreground is black or white. `e2e/branding.spec.ts` (set a hex, reload, the accent applies, no CSP violation; both rendered variants are shown in the preview with a text description linked through `aria-describedby`; picker keyboard operation); unit test that a malicious value (`#fff;}body{…`) is rejected by Zod and by the CHECK.

**Done when:** branding persists per workspace, applies as a token under CSP, and passes axe in both themes. (Spec line 1138: "Branding".)

---

### PR 3: country defaults and the onboarding question (≈400 LOC; split Task 9 into its own PR if it goes over)

**Guardrails:** TEN-01–12, MON-01 (currency codes), UNI-02/03/05, AUTH-01–05, FE-20–24, A11Y-03/04.
**Bob looks first at:** invented values (the SG pattern and date format, non-MY/SG countries); that the defaults are applied in the same transaction as workspace creation, or healed; the tax CHECK.

**Task 7: the country defaults module** (stop-and-ask: new core module)
- Files: new `packages/core/src/settings/country-defaults.ts` plus test; `packages/core/package.json` exports `./settings`; DECISIONS entry closing PROJECT.md §9 "STILL OPEN: where country defaults live" (pending Charlie, Q8).
- [ ] `COUNTRY_DEFAULTS: Record<'MY'|'SG', {currency, invoicePattern, timezone, dateFormat, locale, taxName, taxRate}>`, holding only values from spec lines 730–733. Unknown SG values (pattern, date format, locale) stay `ASK` until Charlie answers Q10; ship nothing invented.
- [ ] The tax rates are labelled "pending professional check" (spec line 1176; PROJECT.md §11) in a code comment and in DECISIONS.
- [ ] Test: each value equals the spec text.

**Task 8: the onboarding step**
- Files: `apps/web/src/app/(app)/workspaces/actions.ts`; new `apps/web/src/app/(app)/onboarding/{page.tsx,actions.ts}`; `apps/web/src/db/system/workspaces.ts`.
- [ ] **Settled (Q9):** after `/organization/create` succeeds, redirect to `/onboarding`. There an owner picks a country (MY or SG) and answers "Are you registered for SST (MY) / GST (SG)?". A Yes requires the registration number and preselects the tax name and rate (editable). Optional TIN and BRN.
- [ ] `applyCountryDefaults(tx, country, answer)` writes `workspace_settings` in `withWorkspace` via `action()` (owner), audited. It only fills fields that are null, so it never overwrites an existing setting.
- [ ] The app layout redirects an owner to `/onboarding` while `country IS NULL` (the healed row case). An Admin or staff member of a not-yet-onboarded workspace sees a plain "The owner has not finished setting up this workspace" page with the workspace switcher and sign-out, and no settings.
- [ ] Tests: `e2e/onboarding.spec.ts` (MY: MYR, Asia/Kuala_Lumpur, dd-mmm-yyyy, en, invoice pattern seeded in PR 6; SG: SGD, Asia/Singapore, dd-mmm-yyyy, en; Yes without a number is refused; No leaves `tax_registered=false` and the tax fields null); unit test `apply-country-defaults.test.ts`.

**Task 9: the settings page (tax, TIN/BRN, timezone, locale, currency)**
- Files: `apps/web/src/app/(app)/settings/general/page.tsx`; `settings/actions.ts`.
- [ ] Timezone is validated against `Intl.supportedValuesOf('timeZone')`, and currency against an ISO 4217 list (from PR 7's money module; until then MYR and SGD only).
- [ ] Changing `base_currency` or the tax settings shows "applies to new documents only" (spec lines 460 and 731). There are no finalized documents yet, so this is only a copy and test hook.
- [ ] Role per Q9 (the recommendation is Admin and Owner).

**Done when:** "MY and SG defaults applied on sign-up" (spec line 1138) is proven by `e2e/onboarding.spec.ts` for both countries.

---

### PR 4: storage adapter and logo (≈380 LOC)

**Guardrails:** FILE-01–04, UNI-06/09/11/14, TEN-05, FE-61, LINK n-a.
**Bob looks first at:** magic-byte checks done before the put; key namespacing; the `img-src` decision (Q13); MinIO image pinning; secret handling for `STORAGE_*`.

**Task 10: adapter** (stop-and-ask: new module and new dependency)
- Files: new `apps/web/src/adapters/storage/{index,s3,types}.ts`; `apps/web/src/env.ts` (`STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_FORCE_PATH_STYLE`); `.env.example`; `apps/web/package.json` (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, exact pins, UNI-06 ladder in DECISIONS).
- [ ] Interface: `put(key, body, contentType, {ifNoneMatch?})`, `get(key)`, `head(key)`, `signedGetUrl(key, ttl≤600)`. There is **no** `delete` in Phase 2, so nothing can remove a QR (the purge in Phase 9 adds its own method, with the QR prefix excluded).
- [ ] Docs: verify the current AWS SDK v3 docs for the `If-None-Match` conditional put and MinIO support for it (unverified, §10).

**Task 11: MinIO in compose and the contract test**
- Files: `docker/compose.dev.yml` (service `minio`, container name `crm-minio`, image pinned by tag and digest, UNI-14); `apps/web/src/adapters/storage/s3.contract.test.ts` (Testcontainers MinIO named `crm-test-minio-<id>`); `docs/runbooks/phase-2-storage.md`.
- [ ] Contract: put/get round trip; a conditional put of an existing key does not overwrite; a signed URL expires; `Content-Disposition: attachment` and `nosniff` are set on get.

**Task 12: upload validation and logo**
- Files: new `apps/web/src/lib/uploads/validate.ts` plus test; `packages/core/src/security/limits.ts` (`LOGO_MAX_BYTES`, value per Q12); `settings/branding/actions.ts`; new route `apps/web/src/app/(app)/files/logo/route.ts`.
- [ ] `validate(bytes, allowed)` checks magic bytes (PNG `89 50 4E 47`, JPG `FF D8 FF`, PDF `25 50 44 46`) and size, and ignores the client MIME type and file name. SVG and HTML are always refused.
- [ ] The DuitNow QR (PR 5) is shown to the owner through a sibling authenticated same-origin route `files/duitnow-qr` that streams from storage, so `img-src 'self'` stays unchanged.
- [ ] Logo key `ws/{workspace_id}/{uuid}`. The server action receives the file (check the Next server-action body limit, unverified, §10) and audits the change.
- [ ] **Settled (Q13):** serve images through an authenticated same-origin route that streams from storage, so `img-src 'self'` stays unchanged.
- [ ] Tests: `validate.test.ts` (an SVG renamed to `.png` is refused; an oversize file is refused); `e2e/logo.spec.ts`; a two-workspace test that B's member gets 404 for A's logo route.

**Done when:** the logo uploads and renders under CSP, and the adapter contract passes against MinIO. (Spec lines 846 and 1138, Branding.)

---

### PR 5: `stepUp()`, bank details, DuitNow QR, notification (≈400 LOC; split Task 16 into its own PR if it goes over)

**Guardrails:** AUTH-01–13 (AUTH-09 step-up), FILE-01–04 plus the FILE-03 exception, TEN-01–12, EVT-01–12, UNI-02/04/05/09, REC-05 (snapshot data needed in Phase 4), A11Y-03.
**Bob looks first at:** step-up bypass (replay, a code reused across sessions, missing rate limit); QR never deleted; PII in the audit log, events and job data; an email sent outside the transaction.

**Task 13: `stepUp()`** (spike first)
- Files: new `apps/web/src/lib/auth/step-up.ts` plus test; `apps/web/drizzle/0026_step_up.sql` (a **tenant** table `step_up(workspace_id, session_id, verified_at)`, unique `(workspace_id, session_id)`, under the RLS template with `crm_app` SELECT/INSERT/UPDATE and no DELETE, a `privileges.ts` entry and a `TENANT_FIXTURES` isolation fixture; Q15 revised; if the spike shows a column on the Better Auth `session` table is simpler, that is the allowed alternative, because `session` is on the TEN-10 allow-list); `limits.ts` (`STEP_UP_WINDOW_SECONDS = 300`, spec line 798).
- [ ] Spike: read the current Better Auth 1.7.14 twoFactor docs for a server-side TOTP verify that does not issue a new session (unverified, §10). Record the result in DECISIONS.
- [ ] `requireStepUp(tx, session)` throws `ActionRefusedError('STEP_UP_REQUIRED')` unless a verification exists that is ≤ 300 s old and bound to this session. `verifyStepUp(code)` is rate limited with `consumeUnit` on the two-factor-verify row.
- [ ] A user without 2FA is refused and sent to enrol (Q16, settled).
- [ ] Cleanup: `step_up` rows older than `STEP_UP_WINDOW_SECONDS` are ignored on read and overwritten by the next verification for the same `(workspace_id, session_id)`; rows of ended sessions stay until a retention sweep. Name that sweep (a worker job run as `crm_worker` or the migrator) in the plan review of the phase that adds the first sweeps; it is not built in Phase 2, and the table stays tiny (one row per active session).
- [ ] Tests: no step-up → refused; 301 s → refused; another session's verification → refused; rate limit hit → `RATE_LIMITED`.

**Task 14: bank details and QR**
- Files: `tenancy.ts` plus `0027_bank_details.sql` (columns `bank_details` jsonb (fields per Q17), `duitnow_qr_key`, `bank_details_changed_at`); new `apps/web/src/app/(app)/settings/payment/{page.tsx,actions.ts}`.
- [ ] Owner only, with step-up (spec lines 788 and 798). The audit entry stores account numbers as `{last4, sha256}`, never the full value, and the QR as its key (spec line 799). Stop-and-ask before this task: an unsalted SHA-256 of a short account number is brute-forceable by anyone who can read `audit_log` (Q26).
- [ ] QR upload: PNG/JPG magic bytes; `sha256` of the bytes; key `ws/{ws}/duitnow/{sha256}.{ext}`; `put` with `If-None-Match: *`, where an existing key counts as success; set `duitnow_qr_key`. No delete call exists (Task 10).
- [ ] Set `bank_details_changed_at = now()` on each change. Add `BANK_NOTICE_DAYS = 60` to `limits.ts` (spec line 799; UNI-02 lists "bank notice 60 d").
- [ ] Test (done-when): `duitnow-qr.test.ts` with Testcontainers MinIO. Upload QR A, replace it with QR B, and A's object still exists via `head`; `duitnow_qr_key` = B (spec line 1280).

**Task 15: first producer of the existing `notification` table**
- Files: `apps/web/src/db/schema/events.ts:26` already defines `notification`, and migrations `0019_domain_event_notification.sql` and `0020_rls_domain_event_notification.sql` already create it with RLS (Phase 1, spec line 285). No new table, migration or fixture. New code: a helper that inserts the rows; extend the existing `isolation.test.ts` fixture only if it does not already cover the row shape used.
- [ ] Check the existing `crm_app` grants on `notification` in `privileges.ts` cover INSERT (and `UPDATE(read_at)` if the UI marks it read); add a grant migration only if a check shows a gap.
- [ ] Each bank or QR change inserts one row per owner (`kind='bank_details_changed'`).

**Task 16: owner email**
- Files: migration creating queue `email.bank_details_changed` with a dead-letter queue (copy the 0016 settings); `apps/web/src/jobs/handlers.ts`; new `apps/web/src/emails/bank-details-changed.tsx`.
- [ ] `enqueueJob(tx, 'email.bank_details_changed', {workspaceId, changeId})` in the same transaction. The worker loads the owners and sends one email each. The job data holds IDs only.
- [ ] Email wording per Q18 (not invented).
- [ ] Tests: unit test for the handler; `e2e/bank-details.spec.ts` (step-up prompt, save, Mailpit receives one email per owner; spec line 1282).

**Done when:** "replacing the QR leaves the old file in place" (spec line 1138) is proven by `duitnow-qr.test.ts`; step-up is enforced (E2E); owners are emailed and notified.

---

### PR 6: numbering (≈380 LOC)

**Guardrails:** REC-06–10 (REC-10 concurrency), REC-12, TEN-01–12, UNI-02/03.
**Bob looks first at:** that the preview and the allocator share one formatter; timezone edge cases at period boundaries; gaps on rollback; the lock scope.

**Task 17: core module** (stop-and-ask: new core module)
- Files: new `packages/core/src/numbering/{pattern,format,index}.ts` plus tests; `packages/core/package.json` export `./numbering`.
- [ ] `parsePattern(s)` accepts only `{CODE}` `{YYYY}` `{YY}` `{MM}` `{SEQ:n}` (1 ≤ n ≤ a limit in `limits.ts`) plus free text, and returns a typed error otherwise. `formatNumber(pattern, {code, seq, at, timeZone})` uses `Intl.DateTimeFormat` with `timeZone`. `periodKey(resetRule, at, timeZone)`.
- [ ] Tests: 31 Dec 23:30 UTC = 1 Jan in Asia/Kuala_Lumpur → `{YYYY}` is the new year; `{SEQ:4}` pads; unknown tokens are refused.

**Task 18: `doc_sequence` and the allocator**
- Files: `apps/web/src/db/schema/numbering.ts`; `0029_doc_sequence.sql` (unique `(workspace_id, doc_type)`, `pattern`, `reset_rule`, `counter`, `last_reset_period`); `0030_rls_doc_sequence.sql` (`--custom`: template, `crm_app` SELECT/INSERT/UPDATE, no DELETE, no `crm_purge`); `privileges.ts`; `TENANT_FIXTURES`; new `apps/web/src/db/numbering/allocate.ts`.
- [ ] `allocateNumber(tx, docType, at)`: `SELECT … FOR UPDATE`; reset the counter when `periodKey` ≠ `last_reset_period`; increment; return `formatNumber(...)`. It is called only on issue/send (Phase 4+), inside the issuing transaction, so a rollback leaves no gap.
- [ ] `previewNumber(tx, docType, at)` uses the same `formatNumber` with `counter + 1` and takes no lock.
- [ ] Seed the MY invoice sequence from `COUNTRY_DEFAULTS` in `applyCountryDefaults` (PR 3 hook). Other doc types and reset rules per Q20.
- [ ] Tests: `allocate.concurrency.test.ts`, with 50 parallel transactions (separate connections) giving 50 unique, contiguous numbers (REC-10; spec line 1191); `preview-matches-issued.test.ts`, where for random patterns and times `previewNumber` then `allocateNumber` are equal (done-when, via a test harness because no issuing document exists until Phase 4); two-workspace isolation.

**Task 19: preview UI**
- Files: `apps/web/src/app/(app)/settings/numbering/{page.tsx,actions.ts}`.
- [ ] Admin and Owner (spec line 788). Live preview as the user types: a client-side `formatNumber` from `@crm/core/numbering` (the same code as the server) with an `aria-live="polite"` region. A pattern change applies to new documents only (copy text).
- [ ] Re-run `e2e/onboarding.spec.ts` here: the MY invoice pattern default is seeded in this PR, so the "MY and SG defaults applied on sign-up" done-when is only complete after PR 6.
- [ ] E2E: `e2e/numbering.spec.ts` (preview updates; an invalid token shows an error; a staff member gets `FORBIDDEN`).

**Done when:** "Pattern preview matches issued numbers; concurrency test passes" (spec line 1138).

---

### PR 7: money core and catalog (≈390 LOC)

**Guardrails:** MON-01–07, TEN-01–12, AUTH-01–05, FE-20–24, UNI-03.
**Bob looks first at:** floating-point parsing; the currency-change refusal while a price is set; RLS on `service`.

**Task 20: money core** (stop-and-ask: new core module)
- Files: new `packages/core/src/money/{currency,parse,format}.ts` plus tests.
- [ ] `CURRENCY_EXPONENT` (ISO 4217; the list scope is part of Q22). `parseDecimalToMinor("1,234.50","MYR") → 123450n` uses string arithmetic only, no floats. `formatMinor(minor, currency, locale)`.
- [ ] Tests: exponent 0 and 3 currencies; rounding is refused rather than silent; huge values.

**Task 21: `service` table**
- Files: `apps/web/src/db/schema/catalog.ts`; `0031_service.sql` (`name`, `default_description`, `default_unit_price_minor` bigint, `currency` char(3), `unit`, `default_taxable`, `archived_at` timestamptz null, unique `(workspace_id, id)`, CHECK price ≥ 0); `0032_rls_service.sql` (template; `crm_app` SELECT/INSERT/UPDATE, no DELETE (Q22: archive only), no `crm_purge`); `privileges.ts`; `TENANT_FIXTURES`.
- [ ] A trigger or check in the action refuses a `currency` change while `default_unit_price_minor IS NOT NULL` (spec line 472).

**Task 22: catalog UI**
- Files: `apps/web/src/app/(app)/catalog/{page.tsx,actions.ts,service-form.tsx}`.
- [ ] Admin and Owner (spec line 788). Currency is prefilled from `default_currency`. A table (TanStack Table only if needed, UNI-06), audited create and update. Archive and unarchive actions set and clear `archived_at` (audited); archived services are hidden from the default list and shown under a filter (Q22).
- [ ] Tests: `catalog.test.ts` (currency change refused while a price is set; staff refused; archive hides from the default list and unarchive restores it; no DELETE grant, so a delete attempt as `crm_app` fails); isolation; `e2e/catalog.spec.ts`.

**Done when:** catalog items can be created and edited by admins with correct minor-unit prices. (Spec line 1138: "catalog".)

---

### PR 8: email templates (≈360 LOC)

**Guardrails:** FILE-05/06, TEN-01–12, AUTH-01–05, UNI-05.
**Bob looks first at:** recursive substitution; HTML escaping; an unknown `{{field}}`; a feature with no user in Phase 2 (UNI-05, Q23).

**Task 23: table**
- Files: `apps/web/src/db/schema/templates.ts`; `0033_email_template.sql` (`event`, `subject`, `body`, `version`, unique `(workspace_id, event)`); `0034_rls_email_template.sql` (template, no `crm_purge`); `privileges.ts`; `TENANT_FIXTURES`.

**Task 24: renderer**
- Files: new `packages/core/src/templates/render.ts` plus test.
- [ ] `render(template, fields, allowedFields)`: a single pass with the regex `/\{\{([a-z_]+)\}\}/g`; values are HTML-escaped; inserted values are never re-scanned (FILE-05); an unknown field is refused when the template is saved.
- [ ] Tests: a value containing `{{x}}` is not expanded; `<script>` is escaped; an unknown field is refused.

**Task 25: settings page**
- Files: `apps/web/src/app/(app)/settings/templates/{page.tsx,actions.ts}`.
- [ ] Admin and Owner (spec line 788). Preview with sample data, watermarked "Preview" (REC-12 by analogy).
- [ ] The event list and default texts come per Q23 (not invented).

**Done when:** templates for the agreed events can be edited and previewed safely. (Spec line 1138: "email templates".)

---

## 5. Done-when and verification map

| Spec item (line) | Proof | PR |
|---|---|---|
| Pattern preview matches issued numbers (1138) | `preview-matches-issued.test.ts` | 6 |
| Concurrency test passes (1138, 1191) | `allocate.concurrency.test.ts` | 6 |
| MY and SG defaults applied on sign-up (1138) | `e2e/onboarding.spec.ts`, `apply-country-defaults.test.ts` | 3 (complete after PR 6 seeds the invoice pattern; re-run there) |
| Replacing the QR leaves the old file in place (1138, 1280) | `duitnow-qr.test.ts` (MinIO) | 5 |
| Bank and DuitNow step-up (1282) | `e2e/bank-details.spec.ts`, `step-up.test.ts` | 5 |
| Numbering uses the workspace timezone (1191) | `packages/core/src/numbering/format.test.ts` | 6 |
| Template substitution (1191) | `render.test.ts` | 8 |
| Adapter contract S3 vs MinIO (deferred from Phase 1 line 1536) | `s3.contract.test.ts` | 4 |
| Two-workspace RLS for each new tenant table | `isolation.test.ts` fixtures: `step_up`, `doc_sequence`, `service`, `email_template` (`notification` already has one from Phase 1) | 5–8 |

---

## 6. Guardrail rule table (rule · PR · applies? · reason for n-a)

| Rule | Applies | PR / reason |
|---|---|---|
| UNI-01–19 | yes | All PRs. UNI-02 (limits), UNI-03 (Zod at boundaries), UNI-05 (no unused features: PR 8, Q23), UNI-06 (AWS SDK, icons, font, picker, GSAP), UNI-09 (security review), UNI-11 (no new external service except S3/R2, Q14), UNI-14 (MinIO digest) |
| FE-01–07, 10–14, 20–24, 31/32/34, 40–42, 50–52, 60/61, 70/71 | yes | PR 1, 2, 3, 5, 6, 7, 8 (all UI). FE-13 is the v4 token note |
| A11Y-01–06 | yes | All UI PRs. A11Y-02: contrast of the arbitrary accent (Q1). A11Y-06: axe at every width |
| TEN-01–12 | yes | PR 2, 3, 5, 6, 7, 8 (new columns and tables, RLS, isolation fixtures) |
| MON-01–07 | yes | PR 7 (minor units, exponent, parsing); PR 3 (currency codes). MON items about document totals and rounding are n-a: no documents until Phase 4 |
| REC-01–04, 11 | n-a | No finalized documents are created in Phase 2 |
| REC-05 | partial | PR 5 stores the data (bank, QR key, changed_at) that the Phase 4 snapshot freezes; the snapshot itself is Phase 4 |
| REC-06–10 | yes | PR 6 (numbering, gaplessness, concurrency) |
| REC-12 | yes | PR 6 preview "DRAFT" behaviour; PR 8 preview watermark |
| AUTH-01–13 | yes | PR 5 (AUTH-09 step-up, rate limits); role checks in every settings PR; ASK 9 `require_2fa` (Q19) |
| LINK-01–09 | n-a | No public links are created in Phase 2 (they arrive with documents in Phase 4/5) |
| FILE-01–04 (+FILE-03 exception) | yes | PR 4 (validation, keys, signed URLs), PR 5 (QR) |
| FILE-05/06 | yes | PR 8 |
| EVT-01–12 | yes | PR 5 (new queue, IDs-only job data, same-transaction enqueue). Other PRs emit no events (no settings event exists, and none is added without Q18) |
| PAY-01–06 | n-a | No payments are recorded in Phase 2. Bank details are display data for invoices, not a payment flow |

---

## 7. Questions for Charlie and how each was settled

**2026-11-04, Charlie: "use your recommendations for all of them".** That adopts the recommendation written under each question below for Q1–Q9, Q11–Q16, Q19–Q22 and Q25, and Q24 (defer: the `proposal_cover` column is not added in Phase 2; the builder takes "only if Charlie agrees" as not agreed). Two items below are **builder placeholders or readings, not Charlie's words, pending his one-line confirmation**: Q5 (the recommendation was "Charlie gives the hex"; the builder uses the placeholder default accent `#0e6c84`, the `--accent` CSS variable the builder read from the live demo https://demo.codeandchill.store/kinlo/ on 2026-11-04; white text on it is about 6:1; every workspace can change it in the picker), and Q24 (the recommendation said "only if Charlie agrees"; the builder reads that as not agreed, so the column is not added). Q1 and Q15 are revised per Bob's R1 and also need his re-confirmation (see those questions). **Confirmed by Charlie (Bob session 2026-11-04/05): Q1 = A, Q5 = A (`#0e6c84`), Q15 = A.** Q24's reading is still unconfirmed. Q14 is settled as "decide the hosted storage provider before the first non-dev deployment; dev and CI use MinIO".

**Not settled by "use your recommendations", because the recommendation was "Charlie supplies the value" and the builder will not invent it:**
- ~~**Q10**~~ **Answered by Charlie 2026-11-08** (confirmed "yes correct" in the Bob session): SG invoice pattern = MY's `INV-{CODE}-{YYYY}-{SEQ:4}`; default date format `dd-mmm-yyyy` for both countries, whatever the locale (replaces MY's `dd/mm/yyyy`); locale plain `en` for both; the owner can change the date format later (PR #59, DECISIONS 2026-11-08).
- **Q17** bank detail fields for MY and SG. Blocks PR 5 Task 14.
- **Q18** owner email wording for a bank or QR change. Blocks PR 5 Task 16.
- **Q23** the email-template event list and default texts (the table and renderer go ahead). Blocks PR 8 Task 25.

Each of these stops only the task named; the rest of its PR can proceed.


1. **Contrast on the accent** (DECISIONS 2026-11-04 proposal). Charlie's blanket "use your recommendations" was given on the rule "auto-derive black or white text, and refuse a hex where neither reaches 4.5:1". Bob (PR #52 R1 P1) showed that rule never refuses anything, and (R2 P2) that a first replacement (refuse if < 3:1 on both themes) was incomplete and would refuse the product's own default on typical dark surfaces. **Revised recommendation, confirmed by Charlie (Q1 = A, Bob session 2026-11-04/05; was pending his re-confirmation):** automatic black or white text; the accent is used only as a fill and focus ring in Phase 2 (never as text or link colour), needing 3:1; the stored colour is never refused for contrast, and a per-theme variant is derived and previewed so it reaches 3:1 on that theme's surfaces; fixed dark tokens (`--background` `#080c10`, `--card` `#0c1218`) under which the default `#0e6c84` passes unchanged.
2. **Who may change branding** (the matrix is silent, spec lines 782–799; DECISIONS proposal). Recommendation: Admin and Owner, like "email settings".
3. **Where dark mode is stored** (DECISIONS proposal). Recommendation: a per-user cookie read server-side (no DB column, works before login); a user column only if it must follow the user across devices.
4. **Font.** Recommendation: a self-hosted, OFL-licensed rounded sans (an Urbanist-like face) via `next/font/local`, so `font-src 'self'` holds and the build makes no network fetch.
5. **Default accent hex** before a workspace sets one (DECISIONS says "teal" in the handoff only). Recommendation: Charlie gives the hex. **Confirmed by Charlie (Q5 = A, Bob session 2026-11-04/05): `#0e6c84`.**
6. **New UI dependencies** (icons; colour picker; GSAP; TanStack Table and Form). Recommendation: `lucide-react` exact-pinned; a custom picker (small, accessible); no GSAP until a specific motion needs it.
7. **Top-bar search and "New"** have no backend in Phase 2. Recommendation: render "New" with only the items that exist (Workspace); hide search until Phase 3 (UNI-05).
8. **Where country defaults live** (PROJECT.md §9 line 257, "STILL OPEN"). Recommendation: `packages/core/src/settings/country-defaults.ts`, recorded in DECISIONS.
9. **Onboarding flow and roles.** Should country and the SST/GST answer be captured at workspace creation, or on a forced `/onboarding` step? Who may later change tax, timezone, locale and short code? Also, the Phase 4 row also lists the "onboarding tax question" (spec line 1140). Recommendation: a forced step right after creation (owner); later changes by Admin and Owner; Phase 2 delivers the question, and Phase 4 only consumes it.
10. **SG defaults the spec does not give:** invoice pattern, date format, locale. Also MY locale. Recommendation: Charlie supplies them; until then SG keeps the MY pattern shape only if he confirms it.
11. **Countries other than MY/SG, and the address structure.** Recommendation: only MY and SG are selectable in Phase 2; a structured address (line1, line2, city, postcode, state, country).
12. **Logo size and dimension limits.** Recommendation: 2 MB, PNG/JPG, in `limits.ts`; Charlie confirms the number.
13. **How images are served** (`img-src 'self'`). Recommendation: an authenticated same-origin streaming route; do not widen the CSP.
14. **Storage provider for hosted SaaS** (R2 vs S3) and authorising it as an external service (UNI-11). Recommendation: decide before the first non-dev deployment; dev and CI use MinIO only.
15. **Step-up storage.** The first recommendation (a no-RLS system table) breaks the TEN-10 allow-list, which only a spec revision can widen (Bob PR #52 R1 P1). **Revised recommendation, confirmed by Charlie (Q15 = A, Bob session 2026-11-04/05; was pending his re-confirmation):** a tenant table `step_up(workspace_id, session_id, verified_at)` under the RLS template; or a column on the Better Auth `session` table (already on the allow-list) if the Task 13 spike prefers it. A spec revision adding `step_up` to the system module is the third option and is not recommended.
16. **Step-up for an owner without 2FA.** Recommendation: refuse and send them to enrol.
17. **Bank detail fields for MY and SG** (bank name, account name, account number, SWIFT/BIC, branch?). Recommendation: Charlie lists them.
18. **Owner email wording, and whether a domain event `settings.bank_details_changed` is added to `EVENT_NAMES`.** Recommendation: a dedicated queue only (no new event) in Phase 2; Charlie gives the wording.
19. **ASK 9 `require_2fa` enforcement timing** (Phase 1 plan line 1562). Recommendation: the column in PR 2 and enforcement in PR 5 alongside step-up.
20. **Doc types and reset rules for `doc_sequence`,** and the defaults for doc types other than the MY invoice. Recommendation: reset rules `never | yearly | monthly`; seed only the invoice in Phase 2, and seed the others in the phase that issues them.
21. **Short code (`{CODE}`) format and uniqueness.** Recommendation: 2–6 uppercase letters or digits, unique per workspace only.
22. **Catalog details:** may services be deleted, or only archived? Which currencies are offered? Recommendation: archive only (no DELETE grant); offer ISO 4217 with MYR and SGD on top.
23. **Email template events and default texts, and whether to build the editor in Phase 2 at all** (no Phase 2 email uses it; UNI-05). Recommendation: build the table and renderer now (spec row lists it), with the event list from Charlie.
24. **Proposal cover options** (spec line 460, undefined). Recommendation: defer to Phase 6 (proposals); the column is not added in Phase 2 (UNI-05).
25. **`tax_rounding` values beyond `rate_group`.** Recommendation: only `rate_group` until Phase 4.
26. **Account-number hash in the audit entry** (spec line 799 says last 4 digits + SHA-256). The search space is small, so an unsalted hash can be brute-forced by a reader of `audit_log` (Bob PR #52 R1 P2, deferred to the PR 5 stop-and-ask). Builder proposal: HMAC-SHA-256 with a server-side secret (new env secret, UNI-08) or drop the hash and keep last 4 only. Needs Charlie's choice, recorded in DECISIONS, before Task 14.

---

## 8. Gates and stop-and-ask points

- **PROJECT.md §11:** no named gate covers Phase 2 (the named gates are Phases 4, 5, 7 and 9). Open spec questions 2, 3, 6, 7 and 9 are not touched by Phase 2. The SST rate professional check is due before Phase 4 goes live, not Phase 2 (spec line 1176), but the 8% value seeded here must carry that label.
- **FILE-03 exception review date is "Phase 2 gate"** (DECISIONS:776). Bob re-reviews it in PR 5.
- **builder §8 stop-and-ask:** before PR 1 (first PR of the milestone); before PR 3, PR 6 and PR 7 (new core modules `settings`, `numbering`, `money`); before PR 4 (new module `src/adapters/storage`, new dependency, possible external service); any deviation from the spec (for example a Phase 2 vs Phase 4 split of the tax question); any open question above that blocks its PR.
- **Design-direction confirmation** (§0) before sending this plan to review.

---

## 9. Risks (Bob reviews these first)

1. **CSS injection via the brand colour** if any path renders an unvalidated value into the nonce'd `<style>`.
2. **Step-up bypass:** Better Auth may lack a non-session-issuing verify call; a hand-rolled TOTP check must reuse its secret storage safely.
3. **QR deletion by a later feature:** the adapter has no delete in Phase 2; the Phase 9 purge must exclude the `duitnow/` prefix.
4. **The preview drifting from the allocator** if two formatters exist; there must be one `formatNumber`.
5. **Timezone period boundaries** (UTC vs workspace timezone).
6. **Invented values:** the SG defaults, the bank fields, the email wording and the limits stay ASK until answered.
7. **PR size:** PR 2 and PR 5 are cut now (2a/2b, 5a/5b/5c); PR 3 is near 400 LOC and splits at Task 9 if it goes over.
8. **Server-action body limit** too small for an upload, which would force a route handler.

---

## 10. Facts the drafter could not verify

- `agents/START.md` in full; `apps/web/src/lib/auth/session.ts`; `apps/web/src/lib/audit.ts` (the signature is taken from the Phase 1 plan).
- The full text of every guardrail pack (only the IDs and summaries were read).
- Spec Money rules (lines 535–657) in detail.
- Better Auth 1.7.14 TOTP verify APIs usable for step-up.
- Next 16.4.2 / React 19.3 View Transitions support.
- The Next server-action body size limit (assumed 1 MB default).
- AWS SDK v3 and MinIO support for `If-None-Match` conditional puts.
- Whether Charlie has confirmed the 2026-11-04 design-direction summary (handoff §6 item 5).
- That `#0e6c84` is the Kinlo accent was read once from the demo's `--accent` CSS variable on 2026-11-04; the demo can change.
- The Phase 1 composite-FK catalog rule for the new `step_up`, `doc_sequence`, `service` and `email_template` tables (not reread; the builder checks it when each table is cut).

---

## 11. Self-check (plan level)

| Check | Result |
|---|---|
| Every Phase 2 deliverable in spec line 1138 maps to a PR | yes: branding PR 2/4; country defaults, tax question, TIN/BRN, timezone/locale, currency/tax PR 3; bank, QR, step-up, notification PR 5; numbering and preview PR 6; catalog PR 7; email templates PR 8 |
| Every done-when item has a named test | yes (§5) |
| Every new tenant table has RLS, a manifest entry and an isolation fixture | yes: `step_up`, `doc_sequence`, `service`, `email_template` (`notification` exists since Phase 1) |
| No business value invented | yes: unknowns are Q4–Q25 |
| DECISIONS proposals kept labelled as proposals | yes (Settled item 4; Q1–Q3) |
| No `crm_purge` grants on Phase 2 tables | yes (Settled item 13) |
