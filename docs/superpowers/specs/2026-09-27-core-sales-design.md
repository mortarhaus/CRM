# CRM — Part 1 "Core Sales" Design Spec (v4.4)

**Status:** v4.4, 2026-09-29. **Bob: Approve** (no blocking findings). Supersedes all earlier versions. **Charlie: Approved** 2026-09-29. Phase 0 authorised.

## Changes in v4.4 (from v4.3) — Bob final check

1. **Resolver declared `VOLATILE`** (final #1): its policy uses `clock_timestamp()`, so `STABLE` was the wrong promise.
2. **Resend approval source recorded** (final #2): Charlie approved it directly in the Andy session on 2026-09-29; Bob's window did not see that message.
3. **Orphan sweep runs per workspace** (final optional): one sub-job per workspace under `withWorkspace()`, listing only that workspace's `pdf/` prefix.

## Changes in v4.3 (from v4.2) — Bob review R4 (approve with conditions)

1. **Expiry checked with wall-clock time** (R4 medium): the approval recheck uses `clock_timestamp()` after the locks are held, not `now()`; the resolver policy and OTP window use it too. New expiry-under-lock test.
2. **Grant wording aligned** (R4 low): `crm_app` may INSERT and SELECT on append-only tables, never UPDATE or DELETE.
3. **Orphan PDF sweep** (R4 optional): rendered PDFs use the `ws/{workspace_id}/pdf/` prefix; a daily job deletes files there older than 24 h with no `document_artifact` row.
4. **Resend approved by Charlie** (recorded in Decided points).

## Changes in v4.2 (from v4.1) — Bob review R3

1. **PDFs recorded in `document_artifact`** (R3 #1): new append-only table keyed to the immutable version/document. No table has `pdf_key` any more, so the worker records a PDF by INSERT only, and version and signature rows stay untouched. Retries are insert-once.
2. **Approval vs Resend locking** (R3 #2): a fixed lock order `proposal` → `share_link` → `quotation`; approve rechecks inside the lock that the link is live and names `current_sent_version_id`; Resend is refused after approval. A required approve-vs-Resend race test is added to Phase 7.
3. **Role count** (R3 low): Decisions table and Phase 1 now say three roles (`crm_migrator`, `crm_app`, `crm_link_resolver`), none with `BYPASSRLS`.

## Changes in v4.1 (from v4) — Bob review R2

1. **Link resolver works under `FORCE ROW LEVEL SECURITY`** (R2 #1): no RLS bypass. A `NOLOGIN` role `crm_link_resolver` owns `resolve_share_link()` and gets one `SELECT` policy on `share_link` only. No role has `BYPASSRLS`. Tests use the real roles.
2. **FX conversion handles currency exponents** (R2 #2): `fx_rate` defined as major-per-major; `base_minor = round(doc_minor × fx_rate × 10^(exp_base − exp_doc))`; JPY, USD and KWD fixtures.
3. **Quote versions stored** (R2 #3): new append-only `quotation_version`; each proposal sent version points to one quote version; approval sets `quotation.accepted_version_id` to that version; unsent edits move to a new draft quote.
4. **One old-link behaviour** (R2 #4): unknown, revoked, expired and superseded links all show the same generic page; the client gets the new link by email on resend.
5. **Append-only made literal** (R2 optional): `proposal_sent_version` and `quotation_version` have no mutable columns and no UPDATE/DELETE grants; "superseded" and "approved" live on the parent row.

## Changes in v4 (from v3)

1. **Phase gates fixed** (Bob #1): Phase 4 onboarding gate is now "first *invoice* sent within 5 minutes"; "first *quote* sent within 5 minutes" moves to Phase 5, where quotes are built.
2. **Sent links are version-bound** (Bob #2): the proposal editor still shows the linked quote live while drafting. Sending freezes a *sent version* of proposal + quote; the link shows only that version. A changed quote requires **Resend**, which creates a new version and a new link and revokes the old one. Approval is only possible on the current sent version.
3. **Anonymous link access specified** (Bob #3): a narrow `resolve_share_link()` lookup resolves token → workspace + one target document, then all reads run under `withWorkspace()` for that workspace. Tests prove a token cannot reach another document or workspace.
4. **No tax by default** (Bob #4): sign-up asks "Are you registered for SST / GST?". Only a "yes" turns on tax (MY service tax 8%, SG GST 9% preselected, editable). Otherwise documents carry no tax row.
5. **Money rules made exact** (Bob #5): quantity precision, discount types, pro-rata document-discount allocation (largest remainder), per-rate-group tax rounding, and a worked mixed-rate example.
6. **E-invoice wording qualified** (Bob #6): the RM3M exemption is "generally", with all Guideline v4.8 §1.6.10 exceptions listed, and all of them added to the accountant check.

## Changes in v3 (from v2)

1. **Target segment fixed**: small and medium creative agencies, roughly 5–15 people, annual turnover under RM3 million. This decides what is refused: no accounting, no e-invoice integration in Part 1, no enterprise features.
2. **Extension architecture added** (modular monolith with extension seams). Core defines typed interfaces, domain events and a `ctx` API; extensions are packages in this repo, compiled into the same image, enabled per workspace as data. Part 1 builds the contract and ships with an empty extension list. No runtime plugin loading.
3. **E-invoice reduced to a stub**: customer TIN/BRN/SST fields, `einvoice_*` fields on invoice and credit note, PDF rendered at send gated on e-invoice status, and the `EInvoiceProvider` interface. The Malaysia implementation (`einvoice-my`) is a future extension, not a roadmap part. MSIC/classification codes removed.
4. **Monorepo layout** (pnpm workspaces): `packages/core`, `packages/extensions/*`, `apps/web`. Boundary rules become package boundaries.
5. **Domain events via transactional outbox** (`domain_event` written in the same transaction as the change, relayed to pg-boss). Core handlers and extension handlers both consume them.
6. **`organization.country`** added; drives tax defaults, formats and extension availability. **`workspace_extension`** table added with AES-GCM-encrypted settings.
7. **PDF timing changed**: rendered by a job at first send (invoices only after `einvoice_status ∈ {not_required, validated}`), stored, never regenerated. Draft previews are watermarked and not stored.
8. **Onboarding is a requirement**: MY/SG defaults, first quote sent within 5 minutes of sign-up (Phase 4 done-when). *v4: invoice in Phase 4, quote in Phase 5.*
9. **Agreement templates**: a single "Service Agreement" is the default; MSA + SOW remain available.
10. **Accounting handoff**: period export (CSV/JSON) of invoices, payments and credit notes in Part 1; API sync is a later `AccountingSync` extension.
11. **Dashboard v1** specified (Phase 5), in workspace base currency.
12. **Part 3 first extension is payment links** (Stripe / Billplz / Curlec, chosen in the Part 3 spec). **Part 4** carries license entitlements per extension and must re-confirm who the self-host buyer is.

## Changes in v2 (from v1) — kept for history

One-runtime Docker image (`web` + `worker`); pg-boss jobs instead of outbox + external cron; RLS specified mechanically; OTP-verified signatures with certificate page; money in `bigint` minor units; `account` above workspace; `DEPLOYMENT_MODE`; timezone/locale, per-line tax, discounts, email templates, invitations, optimistic locking, bank-details snapshot, workspace export; threat model, permission matrix, step-up auth, shared rate limits, session hygiene, upload rules, append-only audit, supply-chain scanning, restore drill, PDPA path, DMARC; phases reordered into a vertical slice (real invoice in Phase 4); Node 22 + pnpm, Tailwind + shadcn/ui, Testcontainers, Pino + Sentry (opt-in on self-host), nonce CSP in Phase 1, Ed25519 licensing, Stripe for Part 3.

---

## Context

Charlie runs a creative/dev studio (branding, copywriting, UI/UX, development). This CRM is built as a **product** and dogfooded by the studio from Phase 4 onward. It will be sold two ways:

- **Hosted SaaS** (Charlie's paid platform, scales by running more containers).
- **Self-host**: the buyer runs the same Docker image on their own cloud server and owns their data. Setup fee + one-off license + optional support/updates subscription. *Open question for Part 4: small agencies don't run servers, so the self-host buyer is likely a more technical sub-segment; confirm before investing.*

### Target segment

Small and medium creative/dev agencies: roughly 5–15 people, annual turnover under RM3 million, Malaysia first, Singapore second, other countries only where nothing country-specific is required. Consequences:

- It is a **CRM for selling and getting paid**, not an accounting system. A tax row on documents is sufficient; ledgers, journals, chart of accounts and period close are out of scope permanently. Accounting software receives data via export (Part 1) or sync (later extension).
- **E-invoicing is not built in Part 1.** Businesses under the current Malaysian exemption threshold (RM3M as of Guideline v4.8, 30 Aug 2026; the threshold has moved four times in two years) are *generally* exempt, **unless an exception in Guideline v4.8 §1.6.10 applies**: non-individual shareholders, a qualifying holding company, or related companies / joint ventures at or above the threshold. Some target customers will therefore need e-invoicing even under RM3M. The system keeps a cheap seam so it can be added as an extension when a customer needs it.
- **Onboarding must be trivial**: sensible defaults, first invoice sent within 5 minutes of sign-up (Phase 4), first quote within 5 minutes (Phase 5).
- Multi-currency stays (agencies bill USD/SGD often enough). Workspaces stay (Charlie needs them). Roles stay.

The product is split into 4 sub-projects, each with its own spec → plan → build cycle:

1. **Core Sales** (this spec)
2. Projects: Gantt chart, fed by the proposal timeline block
3. SaaS layer: sign-up, plans, billing per `account` (covering N workspaces); first extension = payment links
4. Self-host pack: Docker kit, signed offline license with extension entitlements, private registry updates gated by support subscription, buyer setup guide, setup-fee service

Folder: `/Users/charlie/Documents/Projects/Personal/CRM` (greenfield).

## Decisions

| Topic | Decision |
|---|---|
| Framework | Next.js (App Router) + TypeScript, `output: 'standalone'`. Node 22 LTS, pnpm workspaces, both pinned. |
| Repo layout | Monorepo: `packages/core` (pure rules, interfaces, events), `packages/extensions/*` (one package per extension; empty in Part 1), `apps/web` (Next.js app, worker entry, registry, UI). |
| Boundaries | `core` imports no framework, DB or extension code. Extensions import only `core` types and use the `ctx` handed to them. Enforced by ESLint boundary rules + package `exports`; CI fails on violation. |
| Runtime | **One Docker image, two commands**: `web` (`next start`) and `worker` (pg-boss consumer). Identical image for SaaS and self-host. `DEPLOYMENT_MODE=saas\|selfhost` env flag. |
| Hosting (own SaaS) | Container host with a Singapore region (Fly.io, Railway, or Hetzner + Coolify/Dokploy; pick in Phase 0). Managed Postgres co-located (provider's or Neon `ap-southeast-1`). Cloudflare R2 for files. Resend for email. |
| Database | PostgreSQL 16+, Drizzle ORM, plain TCP driver (`postgres`), never a provider-specific HTTP driver. Three roles, none with `BYPASSRLS`: `crm_migrator` (owns schema, runs migrations), `crm_app` (runtime; on `audit_log`, `domain_event`, `document_artifact` and the version tables it may INSERT and SELECT but never UPDATE or DELETE) and `crm_link_resolver` (`NOLOGIN`, owns `resolve_share_link()` only). |
| Tenancy | `account` (billing owner) → `organization` (= workspace) → tenant data. One login, many workspaces, switcher in header. Zero data shared across workspaces. RLS on every tenant table. |
| Auth | Better Auth: email + password (Argon2id), TOTP 2FA with recovery codes, organization plugin, rate limiting with `storage: "database"`. Passkeys in Phase 9. No Google login at launch. |
| Money | `bigint` minor units + per-currency exponent. Multi-currency per document. Workspace base currency; `fx_rate` and base totals frozen on issue. Tax **off unless the workspace is registered**; when on, workspace default tax name/rate, per-line taxable flag and rate override. Exact rules in "Money rules". **No accounting features.** |
| Approval / signature | Link issued to a named contact → email OTP → typed name + "I agree" → signature record with verified email, IP, UA, timestamp, document hash → audit certificate page in PDF. |
| Agreements | Template engine; editable starter templates with `{{field}}` placeholders; single-pass substitution, no code execution; drafted for Malaysia with `{{governing_law}}`; **default template = single "Service Agreement"**, MSA + SOW optional; lawyer reviews final text. |
| PDF | `@react-pdf/renderer`, rendered in the worker. Canonical artifact is the frozen JSON snapshot; hash = SHA-256 of canonical JSON. PDF rendered once at first send (see PDF timing), stored, never regenerated. Merged PDFs via `pdf-lib`. |
| Jobs / events | pg-boss in the `worker`: retries with backoff, dead-letter, cron schedules. **Domain events** written to `domain_event` in the same transaction as the change, relayed to pg-boss, dispatched to core handlers and to enabled extensions per workspace. |
| Extensions | Modular monolith. Core defines `ExtensionManifest`, `ExtCtx`, provider interfaces (`EInvoiceProvider`, `PaymentGateway`, `AccountingSync`) and event contracts. Extensions are compiled into the image; `apps/web` holds a static registry; enablement per workspace in `workspace_extension`. No runtime loading, no sandbox, no marketplace. |
| E-invoice | Stub only in Part 1: customer TIN/BRN/SST, `einvoice_*` fields, PDF gate, `EInvoiceProvider` interface. `einvoice-my` is a future extension. |
| Email | Adapter: SMTP (nodemailer) or Resend, chosen by env. React Email templates. |
| Files | S3-compatible via AWS SDK v3 (S3 / R2 / MinIO), path-style toggle. Private bucket, signed URLs only. |
| Validation | Zod everywhere. One `action()` wrapper: session → active workspace (from session) → role → Zod → idempotency → handler. |
| UI | Tailwind + shadcn/ui (vendored), TanStack Table + Form, dnd-kit (block reorder), Tiptap (rich-text blocks). |
| Testing | Vitest, Testcontainers Postgres, Playwright, adapter contract tests. |
| Observability | Pino JSON logs (no PII, no tokens), Sentry with scrubbing on SaaS; opt-in on self-host. `/api/health` returns DB + queue status. |
| Migrations | Run by the image entrypoint before `web` starts. Additive / expand-contract only. |
| Secrets at rest | Extension settings and any stored credentials encrypted with AES-256-GCM under `APP_ENCRYPTION_KEY`; key rotation procedure documented (re-encrypt job). |

## Threat model

| Actor | Access | Main risks | Primary controls |
|---|---|---|---|
| Anonymous with a share link | Client link pages | Token guessing, link leakage, forged approvals, scraping | 32-byte token (hash stored), expiry, revoke, per-link + per-IP rate limits, OTP before sign, `no-referrer`, `noindex`, `no-store` |
| Authenticated tenant user | Own workspace(s) | IDOR into other workspaces, privilege escalation | RLS + `withWorkspace()` + role checks per action; workspace never from client input |
| Insider (staff/admin) | Workspace data | Invoice redirection (bank details), data theft, silent edits | Permission matrix, step-up 2FA on high-risk actions, owner notifications, append-only audit log, immutable issued documents |
| Extension code | `ctx` only | Cross-workspace access, invariant bypass, credential leakage | Extensions have no DB access; all writes go through core `ctx` (RLS + audit apply); settings encrypted; handlers run post-commit in the worker |
| Supply chain / infra | Dependencies, image, secrets | Malicious package, leaked secret, unpatched CVE | Lockfile, Renovate, `pnpm audit`, secret scan, Trivy image scan, non-root read-only container, env-only secrets |

## Scope — Part 1

Documents: Customer, Quote, Proposal, Invoice, Receipt, Credit note, Service Agreement, MSA, SOW, NDA, Change order, Sign-off.

Also: dashboard v1, accounting-period export, full workspace export, extension contract (no extensions).

## Data model (main tables)

Every tenant table carries `workspace_id` + RLS policy. Every user-editable draft carries `version` (optimistic lock). Timestamps stored in UTC; displayed in workspace timezone.

**Accounts and workspaces**

- `account`: owner_user_id, name, plan (`free` only in Part 1), status, `stripe_customer_id` (nullable, Part 3), limits JSON.
- `organization` (= workspace): account_id, name, short code, logo key, address, **country (ISO 3166-1 alpha-2)**, timezone, locale, date format, base_currency, default_currency, tax_registered (bool, default false), tax_registration_no, default tax name/rate (used only when tax_registered), tax_rounding (`rate_group`), bank details, email settings (from name, reply-to, bcc_self), auto_send default, require_2fa.
- `member` (role: owner / admin / staff), `invitation` (email, role, token hash, expires_at).
- `email_template`: event, subject, body, version.
- **`workspace_extension`**: name, enabled, settings_enc (AES-GCM), settings_version, enabled_by, enabled_at. Unique (workspace_id, name).

**Customers**

- `customer`: name, address (structured), currency default, tax_identification_no (TIN), business_reg_no, sst_reg_no, po_required, archived_at. Cannot be deleted once it has issued documents (archive only).
- `contact`: customer_id, name, email, phone, role, is_primary.

**Catalog**

- `service`: name, default description, default unit price (minor), unit, default_taxable.

**Sales documents**

- `quotation`: customer, contact, currency, tax name/rate, valid_until, status (draft / sent / accepted / declined / expired), version (optimistic lock of the editable draft), document discount, draft totals, number, issued_at, current_version_id, accepted_version_id.
- `quotation_version` (**append-only**, no UPDATE or DELETE grants to `crm_app`): quotation_id, version_no, frozen snapshot (lines, totals, tax, currency, fx_rate, base totals), snapshot_hash, created_at, created_by. A new row is written each time the quote is sent — directly, or inside a proposal send — if the draft differs from `current_version_id`. Old versions are never changed, so any version a client saw or accepted stays stored; its PDF is recorded in `document_artifact`. Quote → invoice copies from `accepted_version_id`, else from `current_version_id`.
- `invoice`: optional quotation_id, optional proposal_id, customer, contact, currency, fx_rate, tax, due date, status (draft / issued / part-paid / paid / overdue / void), po_number + po_file_key, document discount, totals, number, issued_at, sent_at, bank_details_snapshot, reminder settings, **einvoice_status** (`not_required` default / pending / validated / rejected / cancelled), einvoice_uuid, einvoice_validation_url, einvoice_submitted_at, frozen_snapshot, snapshot_hash.
- `line_item`: parent (quotation | invoice | credit_note), sort, service_id, description, qty_milli (bigint, qty × 1000), unit, unit_amount (minor), line_discount_bps, taxable, tax_rate_override_bps, line_total (minor), doc_discount_alloc (minor), tax_base (minor).
- `payment`: invoice_id, amount (minor), currency, received_at, method, reference, recorded_by, external_ref (for payment-link extensions).
- `receipt`: payment_id, number.
- `credit_note`: invoice_id, reason, line items, totals, number, status, einvoice fields as on invoice.

**Proposals**

- `proposal`: customer, contact, linked quotation_id, status (draft / sent / viewed / approved / declined), ordered `blocks` JSON, auto_send override, current_sent_version_id, approved_sent_version_id, number.
- `proposal_sent_version` (**append-only**, no UPDATE or DELETE grants to `crm_app`; no mutable columns): proposal_id, version_no, frozen snapshot of the proposal blocks, `quotation_version_id` (the exact quote version shown), snapshot_hash (covers blocks + the quote version's hash), sent_at, sent_by. "Superseded" is derived (`id ≠ proposal.current_sent_version_id`), never stored. Approval writes nothing to this table; it sets `proposal.approved_sent_version_id`.
- Block types: scope of work (from `service`), deliverables, exclusions, revisions, notes (rich text), pricing (renders linked quote live), payment schedule (milestones by % or amount), timeline (phases with dates → Part 2 Gantt).

**Agreements**

- `agreement_template`: type (service_agreement / msa / sow / nda / change_order / sign_off), version, body with `{{fields}}`, governing_law default, is_default.
- `agreement`: type, customer, optional proposal, `parent_msa_id` (SOW), frozen rendered body, body_hash, status (draft / sent / signed), number.

**Client links and signatures**

- `share_link`: token_hash (unique), workspace_id, target (doc type + id), document_version (e.g. `proposal_sent_version.id`), issued_to_contact_id, expires_at (default 30 days; extendable for agreements), revoked_at, view_count, last_viewed_at.
- `otp_challenge`: share_link_id, code_hash, expires_at (10 min), attempts (max 5), verified_at.
- `signature`: doc ref, typed_name, verified_email, verification_method (`email_otp`), ip, user_agent, signed_at, document_hash (append-only; the certificate PDF is recorded in `document_artifact`).

**System**

- `doc_sequence`: per workspace per doc type: pattern, reset rule, counter, last_reset_period.
- `idempotency_key`: key, action, workspace, response hash, expires_at.
- `audit_log` (append-only): actor, workspace, action, target, before/after JSON, ip, created_at.
- **`domain_event`** (append-only, transactional outbox): name, version, workspace_id, payload JSON, created_at, relayed_at.
- `workspace_export`: kind (`full` | `accounting_period`), period, requested_by, status, file_key, expires_at.
- **`document_artifact`** (append-only: `crm_app` writes by INSERT only and may SELECT; no UPDATE or DELETE): workspace_id, target_type (`quotation_version` / `proposal_sent_version` / `invoice` / `credit_note` / `receipt` / `agreement` / `signature`), target_id, kind (`pdf` / `merged_pdf` / `certificate_pdf`), storage_key, file_sha256, renderer_version, created_at. Unique (target_type, target_id, kind). **The only place a stored PDF is recorded**; no document or version table has a `pdf_key` column.
- pg-boss owns its own `pgboss` schema.

### Numbering

Tokens: `{CODE}`, `{YYYY}`, `{YY}`, `{MM}`, `{SEQ:n}` + free text. Live preview in settings. Number assigned only on **issue/send** (drafts show "DRAFT") → no gaps. Period tokens use the workspace timezone. Assigned inside `SELECT … FOR UPDATE` on the sequence row. Pattern changes affect only new documents. Voided documents keep their number.

### Money rules (`packages/core/src/money`)

**Representation**

- Amounts: `bigint` minor units; currency exponent from a static table. No floats anywhere (DB, code, JSON — serialise as strings).
- Quantity: `qty_milli` = quantity × 1000 (3 decimal places, e.g. 1.5 h = 1500). Entry with more than 3 decimals is rejected.
- Percentages (discounts, tax rates): basis points, integer (8% = 800, 12.5% = 1250).
- Document discount: either a percentage (bps) or a fixed amount (minor units), never both.
- `round()` = round half away from zero, applied to an exact rational computed with `bigint` numerator/denominator. Only the steps below round.

**Steps (in order)**

1. **Line total** per line: `line_total = round(qty_milli × unit_amount × (10000 − line_discount_bps) / (1000 × 10000))`.
2. **Subtotal** = Σ `line_total`.
3. **Document discount** `D`: fixed amount, or `round(subtotal × doc_discount_bps / 10000)`. `D ≤ subtotal`.
4. **Allocate `D` to every line pro rata** by `line_total` (taxable and exempt lines alike), largest-remainder method:
   `share_i = floor(D × line_total_i / subtotal)`; distribute the leftover `D − Σ share_i` one minor unit at a time to lines with the largest fractional remainder; ties go to the earlier line (`sort` order). Store as `doc_discount_alloc`.
5. **Tax base** per line: `tax_base_i = line_total_i − doc_discount_alloc_i`.
6. **Group** lines by effective rate: exempt (`taxable = false`, or workspace not tax-registered) → no tax; otherwise `tax_rate_override_bps ?? document rate`.
7. **Tax per group** = `round(Σ tax_base in group × rate_bps / 10000)`. One rounding per rate group, never per line.
8. **Total** = subtotal − D + Σ group tax.
9. **Base-currency conversion** on issue (frozen, for the dashboard and exports):
   - `fx_rate` = how many **major** units of the workspace base currency equal **one major** unit of the document currency (e.g. 1 JPY = 0.03 MYR → `0.03`). Stored as `numeric(20,10)`, carried in code as a decimal string parsed to an exact `bigint` rational. Entered by the user or prefilled from the last rate used; `1` when currencies match.
   - `base_minor = round(doc_minor × fx_rate × 10^(exp_base − exp_doc))`, computed as one exact rational, rounded once (half away from zero).
   - Applied to subtotal, discount, each tax group and total separately; the stored base total is `round()` of the exact base total, not the sum of rounded parts.

**Cross-exponent fixture** (required unit test): document JPY (exp 0), base MYR (exp 2), `fx_rate = 0.03`. ¥100 → `100 × 0.03 × 10^(2−0)` = **300** MYR minor units (RM3.00). Also: USD (exp 2) → MYR (exp 2) at `4.4567`, $10.01 = `1001` → `1001 × 4.4567` = 4461.1567 → **4461** (RM44.61); and KWD (exp 3) → MYR at `14.1`, 1.005 KWD = `1005` → `1005 × 14.1 × 10^(−1)` = 1417.05 → **1417**.

**Worked example** (MYR, exponent 2; document rate 8%; fixed document discount RM100.01 = `10001`):

| Line | qty_milli | unit_amount | line disc | taxable / rate | line_total |
|---|---|---|---|---|---|
| A Design | 2000 | 100000 | 0 | yes / 8% (800) | 200000 |
| B Hosting | 1000 | 50000 | 0 | yes / override 6% (600) | 50000 |
| C Printing (exempt) | 1500 | 33333 | 0 | no | round(49999.5) = 50000 |

- Subtotal = 300000. D = 10001.
- Allocation: exact shares A 6667.33, B 1666.83, C 1666.83 → floors 6667 / 1666 / 1666 = 9999 → leftover 2 → B and C (largest remainder .83, tie → earlier line first) → **A 6667, B 1667, C 1667**.
- Tax bases: A 193333, B 48333, C 48333 (exempt).
- Tax: 8% group round(193333 × 0.08 = 15466.64) = **15467**; 6% group round(48333 × 0.06 = 2899.98) = **2900**.
- Total = 300000 − 10001 + 15467 + 2900 = **308366** (RM3,083.66).

This example is a required unit-test fixture.

### Immutability rules

- Issued documents are never edited or hard-deleted. Corrections: quote → new version; invoice → credit note + new invoice; agreement → new agreement.
- Void keeps the number and stays visible.
- Drafts may be hard-deleted. Customers with issued documents can only be archived.
- The frozen JSON snapshot is the legal record; its short hash appears on the client page and in the PDF footer.

### PDF timing

- Draft previews render on demand with a DRAFT watermark and are not stored.
- **Storing a rendered PDF never updates the source row.** The worker uploads the file to `ws/{workspace_id}/pdf/{uuid}.pdf` (a prefix used only for rendered PDFs), then inserts one `document_artifact` row (`INSERT … ON CONFLICT (target_type, target_id, kind) DO NOTHING`). A retried job that finds an existing row stops and deletes its own orphan upload. The version and signature rows stay untouched and append-only.
- **Orphan sweep:** if a worker crashes after upload but before the insert, the file is an orphan. A daily pg-boss job fans out one sub-job per workspace. Each sub-job runs under `withWorkspace(workspace_id)`, lists only `ws/{workspace_id}/pdf/` objects older than 24 hours, deletes any whose key has no `document_artifact` row in that workspace, and logs the count. It never lists across workspaces and never touches user uploads or exports.
- A download that arrives before the artifact exists shows "Preparing your PDF…" and polls; it never renders on the fly.
- Quotes, proposals, agreements: rendered by `pdf.render` when each version is first sent (a proposal resend renders the new sent version) (agreements again at sign, with certificate page); stored; never regenerated.
- **Invoices and credit notes**: `pdf.render` runs only when `einvoice_status ∈ {not_required, validated}`. With no e-invoice extension enabled in the workspace, core sets `not_required` at issue and the PDF renders immediately. With one enabled, status is `pending` until the extension emits `einvoice.validated`, so the stored PDF can carry the validation QR/link.

## Extension architecture

Purpose: country- or customer-specific behaviour (e-invoicing, payment links, accounting sync) without touching core, and without a plugin framework.

### Contract (defined in `packages/core/src/extensions`)

```ts
export interface ExtensionManifest<S> {
  name: string;                                  // 'einvoice-my'
  version: string;
  availableFor: (ws: WorkspaceInfo) => boolean;  // e.g. ws.country === 'MY'
  settingsSchema: z.ZodType<S>;                  // drives settings form, validation, encryption
  handlers?: Partial<Record<DomainEventName, (ctx: ExtCtx<S>, e: DomainEvent) => Promise<void>>>;
  provides?: {
    einvoice?: (ctx: ExtCtx<S>) => EInvoiceProvider;
    payments?: (ctx: ExtCtx<S>) => PaymentGateway;
    accounting?: (ctx: ExtCtx<S>) => AccountingSync;
  };
  ui?: {
    settings?: () => Promise<React.ComponentType>;
    invoicePanel?: () => Promise<React.ComponentType<{ invoiceId: string }>>;
  };
}

export interface ExtCtx<S> {
  workspaceId: string;
  settings: S;                                   // decrypted + validated
  invoices: {
    get(id: string): Promise<InvoiceSnapshot>;
    setEInvoiceResult(id: string, r: EInvoiceResult): Promise<void>;
    setExternalRef(id: string, system: string, ref: string): Promise<void>;
  };
  payments: { recordExternal(invoiceId: string, p: ExternalPayment): Promise<void> };
  emit(event: DomainEvent): Promise<void>;
  audit(action: string, target: string, data?: unknown): Promise<void>;
  log: Logger;
}

export interface EInvoiceProvider {
  submit(inv: InvoiceSnapshot): Promise<{ uuid: string; validationUrl: string }>;
  status(uuid: string): Promise<'pending' | 'validated' | 'rejected' | 'cancelled'>;
  cancel(uuid: string, reason: string): Promise<void>;
}

export interface PaymentGateway {
  createPaymentLink(inv: InvoiceSnapshot): Promise<{ url: string; externalId: string }>;
}

export interface AccountingSync {
  pushInvoice(inv: InvoiceSnapshot): Promise<{ externalId: string }>;
  pushPayment(p: PaymentSnapshot): Promise<{ externalId: string }>;
  pushCreditNote(cn: CreditNoteSnapshot): Promise<{ externalId: string }>;
}
```

`ctx.*` methods are core functions: RLS, audit log and invariants apply. Extensions never receive a DB handle. `ctx` grows by adding typed methods, never by exposing the database.

### Domain events

Emitted by core, written to `domain_event` in the **same transaction** as the change (transactional outbox), relayed to pg-boss by a small relay job. Payloads carry `version`; handlers ignore unknown fields.

Part 1 event set: `customer.created`, `quotation.sent`, `quotation.accepted`, `quotation.expired`, `proposal.sent`, `proposal.approved`, `proposal.declined`, `invoice.issued`, `invoice.sent`, `invoice.paid`, `invoice.overdue`, `invoice.voided`, `payment.recorded`, `credit_note.issued`, `agreement.sent`, `agreement.signed`, `einvoice.validated`, `einvoice.rejected`.

### Dispatch (in the worker)

1. Relay: unrelayed `domain_event` rows → pg-boss `domain_event` jobs (idempotent by event id).
2. Core handlers run first (e.g. `invoice.issued` → decide `einvoice_status` → enqueue `pdf.render` or wait).
3. Fan-out: read `workspace_extension` for the event's workspace; for each enabled extension with a handler for this event, enqueue `ext.<name>.<event>` with the payload. Each runs as its own job with retries, backoff and dead-letter.
4. Failures never block core. Dead-lettered extension jobs surface in the extension's `invoicePanel` slot with a "retry" action.

### Registry and enablement (in `apps/web`)

- `src/extensions/registry.ts`: static object of imported manifests. Compile-time only; every extension ships in the image.
- Settings → Extensions: lists `registry` filtered by `availableFor(workspace)` and by entitlements (`DEPLOYMENT_MODE` / license in Part 4). Enabling is a step-up action (owner). Settings form generated from `settingsSchema`; stored encrypted in `workspace_extension`.
- UI slots: `settings` (extension settings page) and `invoicePanel` (badge/panel on the invoice view). Resolved by name with dynamic import. No other slots in Part 1.

### Rules

- No extension-to-extension imports or calls; coordination only via events.
- No extension code in request handlers; only jobs, `provides.*` factories called by core, and the two UI slots.
- No runtime loading, sandboxing or third-party plugins until a paying buyer asks.
- Adding an extension = new package + one registry line + release. Self-host buyers receive it via image update; entitlement decides whether they may enable it.

### Part 1 deliverable

Contract types, `ctx` implementation, `domain_event` outbox + relay + dispatcher, `workspace_extension` table + encryption, the two UI slots, and the Settings → Extensions page showing an empty list. Test: a fixture extension in `packages/extensions/_fixture` proves enable/disable, settings encryption, event fan-out per workspace, retry and dead-letter.

### Planned future extensions (not in Part 1)

`payments-stripe` / `payments-billplz` / `payments-curlec` (Part 3, first), `einvoice-my` (MyInvois; manual, middleware and intermediary modes), `einvoice-sg` (InvoiceNow/Peppol), `accounting-xero`, `accounting-quickbooks`, `accounting-bukku`.

## Dashboard v1

Workspace home, all figures in workspace base currency using frozen `fx_rate`:

- Invoiced, paid, outstanding, overdue: this month, last month, year to date.
- Overdue list (oldest first) with one-click reminder.
- Quotes sent vs accepted (count and value), last 90 days.
- Top customers by invoiced value, year to date.
- Recent activity feed from `audit_log` (sends, views, approvals, payments).

No aging buckets beyond "overdue", no P&L, no tax reports. Queries hit composite indexes; no materialised views in Part 1.

## Accounting handoff

- **Period export** (`workspace_export.kind = accounting_period`): CSV + JSON of invoices, line items, payments, credit notes for a date range, in document currency with base-currency columns. Owner/admin action, generated by a job, downloadable via signed URL, 7-day expiry.
- API sync is a later `AccountingSync` extension; the export exists so "not accounting" is a workable positioning from day one.

## The flow (one project, end to end)

| # | Who | Step | Document |
|---|---|---|---|
| 1 | You | Add client + contacts | — |
| 2 | You → Client | (Optional) NDA link to a named contact; OTP; client signs | NDA |
| 3 | You | Create quote | Quote |
| 4 | You | Create proposal; while it is a draft, the pricing block shows the linked quote live ("Add pricing" makes a new linked quote) | Proposal |
| 5 | You → Client | Send one link issued to a specific contact. Sending freezes a **sent version** (proposal + quote snapshot + hash); the link shows only that version. Single **Download ▾** button (hover + click/tap + keyboard): *Proposal + Quote (merged PDF)*, *Proposal*, *Quote* | Proposal + Quote |
| 6 | Client | Enters OTP sent to their email; approves (typed name + "I agree") or declines with reason | — |
| 7 | App | One transaction (see "Approval and Resend concurrency"): lock the proposal, then the link; recheck the link is live and names `current_sent_version_id` (else the generic page), then set `proposal.approved_sent_version_id` (that sent version's snapshot + hash are the record), set `quotation.accepted_version_id` = the `quotation_version_id` inside that sent version and quote → accepted, move any unsent quote edits to a new draft quote, record signature, create the default agreement (**Service Agreement**, or MSA-if-missing + SOW when the workspace uses that pattern); emit events; enqueue emails if auto-send | Agreement(s) |
| 8 | Client | Signs agreement(s) by link (OTP), downloads PDFs with certificate page | — |
| 9 | You | "Create invoices from payment schedule" (e.g. 50% deposit) as drafts. PO number + PO file if the client requires it | Invoice |
| 10 | You | Record payment (full/part) — or, with a payments extension (Part 3), the client pays via link and the payment is recorded from the webhook event | — |
| 11 | App | Auto-create + send receipt (job) | Receipt |
| 12 | You → Client | Change order for extra work → client signs → invoice it | Change order |
| 13 | You | Final invoice → payment → receipt | Invoice + Receipt |
| 14 | You → Client | Sign-off: client accepts work; IP transfers after final payment | Sign-off |

Any time: quick invoice; quote → invoice in one click; credit note. Scheduled jobs mark overdue invoices and expired quotes daily and send reminders (+3, +7 days, configurable).

If the quote or proposal changes after sending, the client link keeps showing the sent version. The owner sees "Changed since sent — resend to update the client". **Resend** creates a new sent version and a new link, revokes the old link, and emails the contact the new link ("This proposal has been updated — here is the latest version"). The old link then shows the same generic "This link is not available" page as any revoked link (see Anonymous access) and cannot approve. The client can only ever approve exactly what was sent to them.

If the client approves a sent version while the owner has **unsent** edits to the quote, the approval stands on the sent terms: the quote version inside that sent version becomes the accepted one. The unsent edits are kept as a new **draft quote** (a copy, linked to the original, labelled "Changes after approval") so no work is lost; it can be sent as a new quote or used for a change order.

## Onboarding

- Sign-up → workspace created with country-based defaults (MY: MYR, `INV-{CODE}-{YYYY}-{SEQ:4}`, Asia/Kuala_Lumpur, dd/mm/yyyy; SG: SGD, Asia/Singapore). **Tax is off by default.**
- Sign-up asks one question: "Are you registered for SST (MY) / GST (SG)?" — **No** (default): `tax_registered = false`, documents show no tax row. **Yes**: registration number required; tax name and rate preselected (MY: Service Tax 8%; SG: GST 9%), editable, other rates selectable per line. Changeable later in settings (admin); the change applies only to new documents.
- First-run checklist: logo, bank details (step-up), first customer, first invoice (Phase 4) / first quote (Phase 5). Everything else has defaults.
- Done-when: **Phase 4** — a new user sends a real invoice within 5 minutes of sign-up in a Playwright test, touching no settings. **Phase 5** — the same for a quote.

## Security

### Authentication and sessions

- Argon2id; uniform responses on login/reset/signup.
- TOTP 2FA with 10 recovery codes; `require_2fa` per workspace for owner/admin. Passkeys in Phase 9.
- Rate limiting via Better Auth with `storage: "database"`; separate limits for login, OTP, share-link views.
- All sessions revoked on password, 2FA or email change. Session list with "sign out everywhere". Email change confirmed from the old address.
- Reset and invitation links: single-use, 30-minute expiry.

### Authorization

- Active workspace from the session, never from client input. Every action and read goes through `action()` → `requireWorkspaceMember(role)`.

| Action | Staff | Admin | Owner |
|---|---|---|---|
| Customers, contacts, drafts, send quotes/proposals | ✔ | ✔ | ✔ |
| Issue invoices, record payments, void, credit notes | — | ✔ | ✔ |
| Templates, numbering, email settings, catalog | — | ✔ | ✔ |
| Period export | — | ✔ | ✔ |
| Manage staff members | — | ✔ | ✔ |
| Manage admins, roles, invitations | — | — | ✔ |
| Bank details (step-up) | — | — | ✔ |
| Enable/disable extensions, extension settings (step-up) | — | — | ✔ |
| Full workspace export (step-up) | — | — | ✔ |
| Delete workspace, billing (Part 3) (step-up) | — | — | ✔ |

- Step-up: fresh TOTP within the last 5 minutes for high-risk actions.
- Bank-details change: step-up, before/after audit, email to all owners, "Bank details updated on {date}" printed on invoices for 60 days. Issued invoices carry a frozen bank-details snapshot.

### Tenancy

- RLS on all tenant tables with `ENABLE` + `FORCE ROW LEVEL SECURITY`; workspace policies are `TO crm_app` and define `USING` and `WITH CHECK` on `current_setting('app.workspace_id', true)::uuid`.
- Runtime connects as `crm_app`; migrations as `crm_migrator`. **No role in the system has `BYPASSRLS`** (checked by a test on `pg_roles`).
- A third role, `crm_link_resolver` (`NOLOGIN`, no `BYPASSRLS`), exists only to own `resolve_share_link()` — see "Anonymous access".
- Every request and every job runs `withWorkspace(workspaceId, tx => …)`: transaction, `SET LOCAL app.workspace_id`, work, commit. Plain `SET` banned.
- Lint rule: no `db.` access outside `withWorkspace` except an allow-listed system module. Integration test proves workspace A cannot read or write workspace B via every table, including through extension `ctx`.

### Anonymous access (client link pages)

Client link requests have no session, so the workspace comes from the link itself, through one narrow path:

1. The route hashes the token (SHA-256) and calls `resolve_share_link(token_hash)`. RLS is **not** bypassed; a dedicated role gets one narrow policy instead. Because `share_link` uses `FORCE ROW LEVEL SECURITY`, even its owner is subject to RLS, so the lookup must be granted by policy, not by ownership:
   - Role `crm_link_resolver`: `NOLOGIN`, no `BYPASSRLS`, no privileges except `SELECT (id, workspace_id, target_type, target_id, document_version, issued_to_contact_id, token_hash, revoked_at, expires_at)` on `share_link`. `crm_migrator` is a member of it only so migrations can set ownership.
   - Policy on `share_link`: `CREATE POLICY share_link_resolve ON share_link FOR SELECT TO crm_link_resolver USING (revoked_at IS NULL AND expires_at > clock_timestamp())`. The workspace policy stays `TO crm_app`; no other table has a policy for `crm_link_resolver`.
   - Function: `resolve_share_link(p_token_hash bytea)`, `LANGUAGE sql`, `VOLATILE` (its policy reads `clock_timestamp()`, which can change within a statement), `SECURITY DEFINER`, **owned by `crm_link_resolver`**, `SET search_path = pg_catalog, public`, body `SELECT … FROM public.share_link WHERE token_hash = p_token_hash`. `REVOKE EXECUTE … FROM PUBLIC`; `GRANT EXECUTE … TO crm_app` only.
   - It lives in the allow-listed system module; it is the only cross-workspace read in the system.
2. It returns exactly one row — `workspace_id`, `target_type`, `target_id`, `document_version`, `issued_to_contact_id`, `share_link_id` — only if the link exists, is not revoked and not expired. Otherwise it returns nothing. **Every non-resolving link (unknown, revoked, expired, or superseded by a resend) shows the same generic page:** "This link is not available. If you expected a document, please contact the person who sent it." No hint whether the token ever existed.
3. The route then runs `withWorkspace(workspace_id, tx => …)` and loads **only** `target_id` at `document_version` through a public read model (`core` function per document type) that returns client-safe fields. No list, search or other-document queries are reachable from link routes.
4. Client actions (OTP request/verify, approve, decline, sign, download) re-resolve the token on every request and act only on the resolved target and version.

Tests (Testcontainers, connecting with the **real** `crm_app` and `crm_migrator` roles, never a superuser): the function resolves a valid token as `crm_app` with `FORCE ROW LEVEL SECURITY` on; a token resolves to its own document only; tampered target IDs in form posts or URLs are ignored; revoked, expired and superseded tokens return nothing and render the identical generic page (same status code and body); a token from workspace A can never read or write workspace B; `crm_app` cannot `SELECT` from `share_link` outside `withWorkspace`; `crm_link_resolver` cannot read any other table; no role has `BYPASSRLS`; `PUBLIC` has no `EXECUTE` on the function.

### Client links and signatures

- 32-byte token, SHA-256 stored; expiry, revoke, bound to one document version (a resend revokes the old link); per-link and per-IP limits.
- `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. Tokens stripped from logs and error reports.
- OTP: 6 digits, HMAC-hashed, 10-minute expiry, 5 attempts, then re-issue required.
- Signature record + certificate page: signer name, verified email, IP, user agent, timestamp, document hash, method.

### Extensions

- Settings encrypted (AES-256-GCM, `APP_ENCRYPTION_KEY`, versioned for rotation). Decrypted only inside the worker for the job's workspace.
- Extension jobs run under `withWorkspace` for their event's workspace; `ctx` exposes no cross-workspace capability.
- Enabling an extension is a step-up owner action and audited. Entitlement check on enable and on each job.
- Webhook routes for payment extensions (Part 3): signature verification, replay protection, mapped to events, never direct writes.

### Input, templates, files

- Zod on every input; templates single-pass substitution only; all output escaped.
- Uploads: magic-byte allow-list (PDF, PNG, JPG), size limits, keys `ws/{workspace_id}/{uuid}`, signed URLs ≤ 10 min, `Content-Disposition: attachment`, `nosniff`. SVG/HTML never accepted. ClamAV optional in self-host compose.

### Transport and headers

- Nonce CSP (Phase 1), HSTS, `frame-ancestors 'none'`, secure/httpOnly/sameSite cookies. Caddy terminates TLS on self-host.
- Sending domain must have SPF, DKIM and DMARC; self-host guide covers it.

### Secrets, supply chain, image

- Env-only secrets; documented rotation for session secret, encryption key, S3, email keys.
- Lockfile, Renovate, `pnpm audit`, secret scanning, Trivy image scan, SBOM per release. Non-root, read-only filesystem.
- No cron endpoints (worker owns schedules). Only unauthenticated HTTP surface: `/api/health`.

### Audit, logging, privacy

- Audit log append-only; records logins, 2FA, sends, views, approvals, signatures, payments, voids, settings changes, exports, member and extension changes.
- Pino JSON logs, no PII/tokens; Sentry scrubbing; 90-day retention on SaaS.
- PDPA (MY/SG): workspace export, customer purge path, retention statement.

### Backups

- SaaS: provider PITR. Self-host: daily encrypted `pg_dump` + bucket sync, off-site copy.
- Restore drill in Phase 9 and in the self-host guide.

## Reliability

- Money, approval and event writes in single DB transactions.
- Idempotency keys on issue / approve / pay / convert / sign.

### Approval and Resend concurrency

Approve, decline, Resend, revoke and proposal edits all run in one transaction under `withWorkspace()` and take row locks in **one fixed order: `proposal` → `share_link` → `quotation`**. No path takes them in another order, so they serialise without deadlock.

**Approve / decline** (client, by link):

1. Resolve the token (read-only, outside the lock) to get `workspace_id`, `share_link_id`, `target_id`.
2. `SELECT … FROM proposal WHERE id = target_id FOR UPDATE`.
3. `SELECT … FROM share_link WHERE id = share_link_id FOR UPDATE`.
4. Recheck **inside the lock**: `revoked_at IS NULL`, `expires_at > clock_timestamp()` (wall-clock time read **after** the locks are held — never `now()`, which is frozen at transaction start), `share_link.document_version = proposal.current_sent_version_id`, `proposal.approved_sent_version_id IS NULL`, status ∈ {sent, viewed}, OTP verified for this link within 10 minutes of `clock_timestamp()`. Any failure → roll back, show the generic "link not available" page (or "already approved" for a repeat by the same verified signer, via the idempotency key).
5. `SELECT … FROM quotation … FOR UPDATE`; write approval, acceptance, signature, agreement(s), `domain_event` rows; commit.

**Resend / revoke** (owner): lock `proposal FOR UPDATE`, then the current `share_link FOR UPDATE`; refuse if `approved_sent_version_id IS NOT NULL` ("Already approved — create a new quote or change order"); then lock `quotation FOR UPDATE`; otherwise insert the new quote version (if changed) and the new sent version, set `current_sent_version_id`, revoke the old link, insert the new link; commit.

The same pattern applies to agreement signing (lock `agreement` → `share_link`) and to direct quote acceptance (lock `quotation` → `share_link`).

**Race test (required, Testcontainers, two real connections as `crm_app`):** start approve and Resend on the same proposal concurrently, many iterations with randomised delays. Exactly one wins every time. If Resend wins: approve fails with the generic page, no signature or acceptance row exists. If approve wins: Resend is refused, the old link stays the approved version, no new sent version exists. Also: two concurrent approvals of the same link → one signature row. **Expiry-under-lock test:** hold the proposal lock in one connection, let the link's `expires_at` pass, then release; the waiting approval must fail with the generic page.
- pg-boss: retries with exponential backoff, dead-letter; "failed, retry" badge in UI; relay is idempotent by event id.
- Friendly user messages; details in logs and Sentry.
- `/api/health` checks DB and queue.

## Scalability

- `web` stateless → N replicas; `worker` scales independently; relay job is single-instance (pg-boss singleton) to keep ordering simple.
- Pooled connection string, small per-process pool; PgBouncer on self-host when needed.
- Composite indexes: `(workspace_id, created_at)`, `(workspace_id, status)`, `(workspace_id, customer_id)`; `domain_event (relayed_at) WHERE relayed_at IS NULL`.
- Numbering lock serialises only one workspace.
- `audit_log`, `domain_event`, share-link views: monthly archive job when they grow.
- Plan limits become columns on `account` in Part 3.
- PDF and all extension work happen in the worker.

## Runtime and hosting

- Image: multi-stage Dockerfile → Next.js standalone + worker entry. Entrypoint runs migrations, then `web` or `worker`.
- Dev compose: `web`, `worker`, `postgres`, `minio`, `mailpit`.
- Prod compose (self-host, Part 4): `caddy`, `web`, `worker`, `postgres`, `minio` (or buyer's S3), optional `clamav`.
- Env: `DATABASE_URL`, `DATABASE_MIGRATOR_URL`, `DEPLOYMENT_MODE`, `APP_URL`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `EMAIL_PROVIDER=smtp|resend` + keys, `STORAGE_*`, `SENTRY_DSN` (optional), `ERROR_REPORTING_OPTIN` (self-host).
- SaaS: same image on the chosen container host, Singapore region, managed Postgres co-located, R2, Resend. Staging environment for previews.

## Planned structure

```
apps/
  web/
    src/app/             # (app) authenticated UI, (public)/l/[token] client link pages, api/health, api/webhooks (Part 3)
    src/db/              # Drizzle schema, migrations, RLS policies, withWorkspace()
    src/adapters/        # email (smtp|resend), storage (s3), pdf
    src/jobs/            # pg-boss handlers: relay, dispatcher, pdf.render, email.send, scans, exports
    src/extensions/      # registry.ts, ctx implementation, settings encryption, UI slot resolver
    src/pdf/             # react-pdf templates + certificate page
    src/emails/          # React Email templates
    src/lib/auth/        # Better Auth config, action() wrapper, requireWorkspaceMember, stepUp()
    worker.ts            # worker entry
packages/
  core/                  # money, numbering, documents, agreements, signatures, events, extension contract
  extensions/
    _fixture/            # test-only extension proving the contract
templates/agreements/    # Service Agreement (default), MSA, SOW, NDA, change order, sign-off — Malaysia
docker/                  # Dockerfile, compose.dev.yml, compose.prod.yml (completed in Part 4)
docs/superpowers/specs/2026-09-27-core-sales-design.md
```

## Build phases for Part 1

| Phase | Deliverable | Done when |
|---|---|---|
| 0. Foundation | Monorepo (pnpm workspaces), Next.js + TS + Drizzle + Postgres + Better Auth, Docker image (`web`/`worker`), dev compose, CI (typecheck, lint + boundaries, tests, `pnpm audit`, secret scan, Trivy) | Sign up, 2FA, create 2 workspaces, switch; `docker compose up` runs web + worker + migrations |
| 1. Tenancy, security, events, extension contract | `account`/`organization`(+country)/`member`, three DB roles (`crm_migrator`, `crm_app`, `crm_link_resolver`), RLS + `withWorkspace()` + lint rule, `action()`, audit log, nonce CSP + headers, DB-backed rate limits, pg-boss worker, `domain_event` outbox + relay + dispatcher, extension contract + `ctx` + `workspace_extension` + encryption + empty Settings → Extensions page, email adapter + React Email, `/api/health` | Isolation test passes on every table incl. via `ctx`; fixture extension passes enable/disable, fan-out, retry, dead-letter; test email flows web → job → Mailpit |
| 2. Workspace settings + onboarding defaults | Branding, country defaults, timezone/locale, bank details (step-up + notification), currency/tax, numbering + preview, catalog, email templates | Pattern preview matches issued numbers; concurrency test passes; MY and SG defaults applied on sign-up |
| 3. Customers + team | Customer (incl. TIN/BRN/SST) + contact CRUD, search, archive rules, invitations | CRUD E2E; invited admin sees permission matrix enforced |
| 4. **Vertical slice: real invoice + onboarding** | Money core (all money rules + worked example), onboarding tax question, quick invoice (line items, discounts, tax, PO, bank snapshot), issue/lock, `einvoice_status = not_required`, PDF at send via worker, send, record payment, auto receipt. **Deployed to production.** | Charlie issues a real invoice, gets paid, receipt sent; worked money example passes as a fixture; new-user **invoice**-in-5-minutes E2E passes |
| 5. Quotes, conversions, jobs, dashboard | Quotes, versions, quote → invoice, credit notes, overdue/expiry scans, reminders, dashboard v1, period export | Status transitions unit-tested; reminders fire in staging; dashboard totals match a hand-computed fixture; new-user **quote**-in-5-minutes E2E passes |
| 6. Proposals | Block editor (8 types, reorder), linked live quote in the editor, "Add pricing", payment schedule → draft invoices, sent versions + "changed since sent" | Draft proposal reflects quote changes live; sending creates an immutable sent version |
| 7. Client link pages | `resolve_share_link()`, public read models, share links to named contacts, OTP, view tracking, Download ▾, approve/decline on current sent version only, resend revokes old link | Client approves via OTP; hash on page matches PDF; anonymous-access tests pass (other document, other workspace, tampered IDs, revoked, expired, superseded); approve-vs-Resend race test passes |
| 8. Agreements | Template engine + Malaysia starter templates (Service Agreement default, MSA/SOW/NDA/change order/sign-off), auto-create on approval, auto-send, sign by link, certificate page | Full 14-step E2E passes |
| 9. Hardening | Security review against this spec, a11y, performance, backup + restore drill, passkeys, full workspace export, SaaS deploy docs | Restore drill passes; export re-imports into a fresh workspace in a test |

## Roadmap for later parts (outline only)

**Part 2 — Projects / Gantt**: project from approved proposal; timeline phases → Gantt bars; drag to reschedule; milestones linked to payment schedule and invoices; change orders and sign-off attach to the project.

**Part 3 — SaaS layer**: public sign-up, trial, plans on `account` covering N workspaces; Stripe billing via Better Auth's Stripe plugin; usage limits; admin console. **First extension: payment links** on invoices (Stripe / Billplz / Curlec, chosen in that spec) using `PaymentGateway` + webhook → `payment.received` event.

**Part 4 — Self-host product**: same image; prod compose with Caddy; Ed25519-signed license file verified offline, carrying **extension entitlements**; private registry gated by support subscription; backup/restore + upgrade scripts; buyer setup guide (DNS/DMARC, restore drill). *Re-confirm the buyer segment before building.*

**Later extensions**: `einvoice-my` (manual / middleware / intermediary modes; triggered by a customer above the exemption threshold or a threshold change), `einvoice-sg`, `accounting-*`. **Later features**: recurring/retainer invoices, bilingual PDFs, `/api/v1` + Expo app.

## Decided points

- Jurisdiction: Malaysia templates; `{{governing_law}}` for SG. Lawyer reviews once.
- Link expiry: 30 days; agreement links extendable.
- **Resend:** approved by Charlie on 2026-09-29, given directly in the Andy spec session ("ok with resend"); Bob recommended it as reviewer in R2–R4. Sent links are locked to the sent version; a change needs Resend (new version + new link, old link revoked).
- Payment-schedule invoices as drafts.
- Google login: no; passkeys in Phase 9.
- Default agreement pattern: single Service Agreement; MSA + SOW selectable per workspace.
- E-invoice: stub only; extension when needed.
- UI direction: decide before Phase 3; prototype the block editor before Phase 6.

## Verify with professionals before Phase 4 goes live

- **Accountant**: confirm the studio is exempt under the current threshold (RM3M, Guideline v4.8) and that **none of the §1.6.10 exceptions** apply: (a) non-individual shareholders, (b) a qualifying holding company, (c) related companies or joint ventures at or above the threshold. Also confirm whether the RM10,000 single-transaction rule applies to exempt taxpayers, and whether the studio is liable to register for SST.
- **Lawyer**: OTP + typed name + certificate page satisfies Electronic Commerce Act 2006 reliability for agreements; review starter templates.
- **SST**: current service-tax rates and exempt line types (defaults only; model supports per-line rates).
- **PDPA**: retention statement and purge path wording.

## Next steps after approval

1. `git init` in the CRM folder; commit the existing docs (this spec is already saved at `docs/superpowers/specs/2026-09-27-core-sales-design.md`).
2. Pick the container host and Postgres provider (Phase 0).
3. Invoke `superpowers:writing-plans` to write the step-by-step plan; user picks the execution method.

## Verification (for the build)

- Vitest: money (incl. the worked mixed-rate example, the cross-exponent FX fixtures, allocation tie-breaks, qty precision rejection, tax-off workspaces), numbering (workspace tz, concurrency), status transitions, sent-version rules, template substitution, event payload versioning.
- Anonymous access: `resolve_share_link()` grants, one-document scope, tampered IDs, revoked / expired / superseded links, cross-workspace attempts.
- Concurrency: approve-vs-Resend race, double approval, sign-vs-revoke; `document_artifact` insert-once under retried `pdf.render` jobs (no UPDATE on version or signature rows).
- Testcontainers Postgres: RLS isolation on every table (read/write, incl. via extension `ctx`), `withWorkspace` lint rule, transactional approval + event outbox atomicity, idempotency replay, relay idempotency, pg-boss retry and dead-letter, settings encryption round-trip and key rotation.
- Fixture extension: enable/disable, availability by country, per-workspace fan-out, UI slot rendering.
- Adapter contract tests: SMTP vs Resend, S3 vs MinIO.
- Playwright: full 14-step flow incl. OTP, Download ▾ (mouse, tap, keyboard), certificate page, bank-details step-up, onboarding invoice-in-5-minutes (Phase 4) and quote-in-5-minutes (Phase 5), dashboard totals.
- Run via `pnpm dev` and `docker compose up`; PDFs and emails (Mailpit) verified in both.
- CI: typecheck, lint + boundaries, tests, `pnpm audit`, secret scan, Trivy on the built image.
