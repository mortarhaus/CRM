# CRM — Part 1 "Core Sales" Design Spec (v4.5)

**Status:** v4.5 **draft for Bob review** (revision 2: MSA + SOW kept, NDA deferred, spike results recorded), 2026-09-30. Merges approved v4.4 (Bob: Approve; Charlie: Approved 2026-09-29) with the parallel "v4" draft (strategy, hosting, scope), following the reset analysis §3 route and Charlie's relayed scope picks. **Not yet approved**: Bob reviews, then Charlie approves. Until then v4.4 (commit on `main`) remains the approved text. Phase 0 stays authorised.

## Changes in v4.5 revision 2 (on top of the first v4.5 draft)

1. **Agreements: MSA + SOW kept, NDA deferred** (Charlie's decision, relayed; reverses the first draft's cut). Part 1 types: Service Agreement, MSA, SOW, Change order, Sign-off. NDA becomes a later template on the same engine (no redesign). Only v4.4 flow step 2 (NDA) is removed; the flow is **13 steps** (v4.4 had 14).
2. **Agreement pattern moves to the customer**: new `customer.agreement_pattern` (`service_agreement` | `msa_sow`); `workspace_settings.default_agreement_pattern` is the default for new customers. v4.4 had it per workspace only.
3. **Approval transaction simplified**: it creates exactly one agreement (Service Agreement, or a SOW pointing at the customer's signed MSA or at none) and emits `agreement.created`. v4.4's "MSA-if-missing" creation inside the locked approval transaction is replaced by a post-commit job that creates a draft MSA (one open MSA per customer, unique partial index) and links the SOW. Lock order unchanged.
4. **SOW signing requires a signed MSA**: the signing link signs the MSA first, then the SOW, in one OTP session. `parent_msa_id` is kept and used; new `agreement.parent_agreement_id` lets change orders and sign-offs reference the SOW (`msa_sow` customers) or the Service Agreement; `agreement.status` gains `void`. New event `agreement.created`. Phase 8 done-when and Verification add: one MSA under concurrent approvals, SOW blocked until MSA signed, race test still passing.
5. **Spike results recorded** (both PASSED, 2026-09-29): "Checks before the Phase 1 plan" now holds results, versions and decisions instead of conditions.
6. **Transactional enqueue is the design**: `boss.send(…, { db: fromDrizzle(tx, sql), id: event.id })` inside the business transaction. The outbox + relay fallback, `domain_event.relayed_at`, its index and the relay job are **dropped** (one history line kept).
7. **`nullif` in every policy is required**, backed by a policy lint/test; RLS tests must seed rows in other workspaces (the missing-`nullif` error appears only when rows exist).
8. **postgres.js `prepare: false`** on the app client (non-overridable when `DATABASE_URL` points at a pooler).
9. **`pgboss` grants for `crm_app`** recorded (USAGE; SELECT on `version`, `queue`; INSERT + column SELECT on `job_common`); `crm_app` still cannot read job payloads. Grants are per queue table (`ALTER DEFAULT PRIVILEGES` or re-grant per queue). pg-boss installed and upgraded by `crm_migrator` in migrations; app instances run with `migrate/createSchema: false`.
10. **Fifth role `crm_worker`** (spike recommendation): owns the worker-side pg-boss rights (fetch, complete, maintenance) on `pgboss.*`; exact grants measured in Phase 1.
11. **Pools and connections**: starting pool sizes recorded; pooler must be transaction mode; LISTEN/NOTIFY needs a direct connection; queue `notify` stays off in Phase 1 (polling) and `notify` changes happen only in migrations.
12. **Known risks updated**: R1 confirmed and fixed; untested items added (pg-boss maintenance through the pooler over a full cycle, `crm_worker` exact grants, DO Managed PG pooler run, 60 s web queue-cache lag). `pg`-driver question stays open, now noting the web-side pg-boss instance opens a small `pg` pool.

## Changes in v4.5 (from v4.4) — merge with the parallel "v4" draft

*(Items 5, 9 and 11 are superseded by revision 2 above; they are shown as corrected.)*

All v4.1–v4.4 fixes are kept: `document_artifact` (no `pdf_key` anywhere), Resend + `crm_link_resolver`, lock order `proposal` → `share_link` → `quotation`, `clock_timestamp()`, exact money rules (3-decimal quantities, worked examples), Phase 4 first invoice / Phase 5 first quote, Node 24 LTS, `crm_app` INSERT + SELECT on append-only tables. Where the other draft disagreed on these, v4.4 wins.

1. **`account` → `billing_account`** (bug): Better Auth creates its own `account` table; the billing owner table would collide in Phase 1.
2. **Workspace context set with `select set_config('app.workspace_id', $1, true)`** (bug): `SET LOCAL` cannot take a bind parameter. Policies use `workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid)`: the sub-select reads the setting once per query, and `nullif` makes a reused pooled connection return 0 rows instead of failing on `''::uuid`.
3. **New role `crm_purge`** (no `BYPASSRLS`; four roles in the first draft, five after revision 2 adds `crm_worker`): may DELETE only `quotation_version` / `proposal_sent_version` rows whose parent never led to an issued invoice, plus their `document_artifact` rows and files. Issued documents are retained. Reason: PDPA purge vs append-only tables.
4. **Better Auth tables get no RLS**: reached only through the allow-listed system module, guarded by the lint rule. Workspace config (bank details, DuitNow QR, own tax IDs, branding, country/currency/tax defaults) moves off Better Auth's `organization` into a new **`workspace_settings`** table under RLS, so sensitive data never sits in a table without RLS.
5. **Events → jobs**: pg-boss job enqueued in the same transaction as the change (`send` with a `db` executor), replacing the v4.4 outbox + relay (Spike 2 passed; the fallback is dropped in revision 2). `domain_event` stays as append-only history. Job payloads carry IDs only (the `pgboss` tables have no RLS).
6. **Extension system moved to Part 3 (SaaS)**: contract, `ctx`, `workspace_extension`, fan-out dispatcher, `_fixture` extension and Settings → Extensions page are no longer built in Part 1. The v4.4 text is kept as design in **Appendix A**. Part 1 keeps domain events and the e-invoice stub columns. Adds the three-test extension rule and the payments split (recording payments, receipts and refunds is core; collecting money is an extension).
7. **Hosting staged**: laptop (Phases 0–3) → one Singapore VPS behind Cloudflare Tunnel, nightly encrypted backups to R2 (Phase 4 on) → DigitalOcean Managed PostgreSQL, Singapore (at first sale). Replaces v4.4's "Fly.io / Railway / Hetzner, Neon allowed". Cloudflare Workers/Pages, Cloudflare Containers, Neon free and Supabase free listed as rejected with reasons.
8. **PostgreSQL 17** (18 allowed), was "16+". Dev and tests pin 17.
9. **Agreements** (corrected in revision 2): **NDA deferred** to a later template; **MSA and SOW kept**; v4.4 flow **step 2 (NDA) removed**, so the flow is **13 steps** and the full E2E is the 13-step flow; the approval transaction is simplified and the agreement pattern is per customer (see revision 2, items 1–4). The first draft's cut of MSA, SOW and `parent_msa_id` is withdrawn.
10. **New "Business and sequencing" section**: own use first, Gates A–D with measurable exit criteria, demo rounds instead of design partners, Sdn Bhd at first sale, part order 1 → 3 → 2 → 4, "quote-to-cash for agencies" positioning.
11. **Checks before the Phase 1 plan**: Spike 1 (RLS + `set_config` through a transaction-mode pool), Spike 2 (pg-boss `send` inside the Drizzle transaction), and "host/provider chosen". Both spikes passed on 2026-09-29 (revision 2); Phase 0 done-when records "spikes passed".
12. **Phase scope merged**: the other draft's phase scope with v4.4's done-when tests kept; target dates added as estimates only.
13. **Phase 5 trimmed**: adds **recurring invoices** and **manual refunds**. **Removed from Part 1 phases**: customer credit balance and statement of account (never in v4.4; proposed by the other draft) → "after Gate A, only if own use needs them, as derived views". Reason: closest to building an accounting system.
14. **Malaysian market**: Share to WhatsApp (`wa.me`, OTP still required) on client links; after a Resend the UI offers "Share new link to WhatsApp" as well as the email. DuitNow QR on invoices, stored content-addressed and never deleted; the invoice snapshot references its hash key. CSV import of customers and contacts (Phase 3).
15. **Own SST/GST registration no., TIN and BRN** on `workspace_settings`. SST/GST question stays default **No** (v4.4 text kept, incl. SG GST 9%).
16. **`fx_rate`**: manual entry, defaulting to the last rate used for that currency pair in the workspace.
17. **PDPA-safe audit log**: personal-data fields in before/after JSON stored as `"[pii]"`; `domain_event` payloads carry IDs and amounts only.
18. **Product additions**: `notification` table (Phase 1); pipeline board and proposal branding (Phase 6); owner notifications, mobile-first client pages, Turnstile on OTP requests (Phase 7); workspace offboarding and customer purge (Phase 9). Outbound webhooks and Google login move to Part 3.
19. **"Later features" no longer lists recurring invoices** (now Phase 5).
20. **Line discounts stay percentage-only** (bps); a fixed-amount discount exists only at document level. The other draft's per-line fixed amount is not merged.
21. **Known risks section added**: empty-string setting → `nullif`; `pgboss` tables have no RLS; `pg` driver brought by pg-boss (open); connection budget and direct connections; exact pins for pg-boss and drizzle.

### Open questions for Charlie

1. **`pg` driver.** pg-boss depends on `pg` (8.23.0 with pg-boss 12.35.0) and always opens its own node-postgres pool — in the worker **and** in the web-side instance used only for `send` (a small pool, `max: 2`, that reads `pgboss.version` / `pgboss.queue`; Spike 2). The transactional `send` itself runs through the app's postgres.js transaction. The Phase 0 plan says "`postgres` driver only, never `pg`". Accept `pg` only as pg-boss's transitive dependency (the spike note recommends this; app code stays on `postgres`), or give pg-boss a postgres.js-backed `db` adapter (loses LISTEN and transactional workers)? Not decided here.
2. **WhatsApp for invoices in Phase 4.** The other draft puts "send by email + Share to WhatsApp" in Phase 4, but share links and `resolve_share_link()` arrive in Phase 7. This draft puts Share to WhatsApp in Phase 7 for all client links; Phase 4 invoices go by email with the PDF. Alternative: pull a minimal invoice link page (and the resolver) into Phase 4.
3. **Part 2 scope.** The other draft cuts the Gantt editor permanently (Part 2 = milestone tracker + read-only timeline + one-way `projects-sync` extension). Not among the relayed picks, so v4.4's Part 2 text is kept with a note.
4. **VPS provider for Phase 4** (host/provider chosen line): which Singapore VPS (e.g. a DigitalOcean Droplet, to ease the later move to DO Managed PG, or another provider)?
5. **`crm_purge` scope beyond the versions.** Signatures, OTP challenges, share links and agreements attached to never-invoiced proposals also hold personal data, and `signature` is append-only. Purge them too? And for a customer with issued documents, redact the customer and contact rows or keep them archived?
6. **Workspace offboarding retention.** What deletion removes vs keeps, given issued documents are retained for the statutory period (~7 years, to verify)?
7. **Part 3 first payment gateway.** The other draft names `payments-stripe` (Stripe Connect on SaaS, restricted key on self-host); v4.4 left Stripe / Billplz / Curlec to the Part 3 spec. Kept open here.
8. **How `crm_purge` connects** (own login + env var, or `SET ROLE` from the worker). To settle in the Phase 1 plan with Bob.
9. **Turnstile on self-host.** It needs a Cloudflare account; this draft makes it on by default on SaaS and optional on self-host.

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

- It is a **CRM for selling and getting paid** ("quote-to-cash for agencies"), not an accounting system. A tax row on documents is sufficient; ledgers, journals, chart of accounts and period close are out of scope permanently. Accounting software receives data via export (Part 1) or sync (later extension).
- **E-invoicing is not built in Part 1.** Businesses under the current Malaysian exemption threshold (RM3M as of Guideline v4.8, 30 Aug 2026; the threshold has moved four times in two years) are *generally* exempt, **unless an exception in Guideline v4.8 §1.6.10 applies**: non-individual shareholders, a qualifying holding company, or related companies / joint ventures at or above the threshold. Some target customers will therefore need e-invoicing even under RM3M. The system keeps a cheap seam so it can be added as an extension when a customer needs it.
- **Onboarding must be trivial**: sensible defaults, first invoice sent within 5 minutes of sign-up (Phase 4), first quote within 5 minutes (Phase 5).
- Multi-currency stays (agencies bill USD/SGD often enough). Workspaces stay (Charlie needs them). Roles stay.

The product is split into 4 sub-projects, each with its own spec → plan → build cycle, **built in the order 1 → 3 → 2 → 4**:

1. **Core Sales** (this spec)
2. Projects: Gantt chart, fed by the proposal timeline block *(scope open; see Open question 3)*
3. SaaS layer: sign-up, plans, billing per `billing_account` (covering N workspaces); extension contract (Appendix A) built with its first consumer, a payment-links extension
4. Self-host pack: Docker kit, signed offline license with extension entitlements, private registry updates gated by support subscription, buyer setup guide, setup-fee service. Built only once 3 buyers have prepaid.

Folder: `/Users/charlie/Documents/Projects/Personal/CRM`.

## Business and sequencing

- **Own use first, then sell.** The studio (sole proprietorship) runs on the product from Phase 4. Selling starts only when the stability exit criteria (Gate D) are met.
- **Sdn Bhd at first sale**: incorporated before any other agency's data enters the system.
- **Outside signal without selling**: demo rounds with 5 agency owners on Charlie's own screen (no accounts, no data), after Phase 5 and again after Phase 8. Replaces design partners. Answers recorded in `docs/research/demos.md`.
- **Positioning**: "quote-to-cash for agencies", not "CRM". Pipeline board in Phase 6.

### Release gates

| Gate | When | Exit criteria |
|---|---|---|
| A — Own use starts | End of Phase 4 | Studio issues all its invoices and receipts through the product; nightly backup to R2 running; one restore tested. |
| B — Demo round 1 | End of Phase 5 | 5 agency owners have seen a demo; answers in `docs/research/demos.md`; price hypothesis tested. |
| C — Demo round 2 | End of Phase 8 | At least 3 say they would pay the hypothesised price. |
| D — Stability exit | After Phase 9 and at least 8 weeks of own use | 8 consecutive weeks with all studio documents through the product; ≥ 30 invoices including ≥ 3 credit notes and ≥ 1 foreign-currency invoice; zero wrong totals, numbering errors or data loss in the last 4 weeks; one timed full restore; proposal → agreement → invoice → receipt completed with ≥ 2 real clients. |

## Decisions

| Topic | Decision |
|---|---|
| Framework | Next.js (App Router) + TypeScript, `output: 'standalone'`. Node 24 LTS (changed from 22 by Charlie, 2026-09-29: Node 22 security support ends April 2027), pnpm workspaces, TypeScript 6.0 (typescript-eslint does not support 7 yet), all pinned. |
| Repo layout | Monorepo: `packages/core` (pure rules, interfaces, events), `apps/web` (Next.js app, worker entry, UI). `packages/extensions/*` is created in Part 3 with the first extension. |
| Boundaries | `core` imports no framework, DB or extension code. Extensions (Part 3) import only `core` types and use the `ctx` handed to them. Enforced by ESLint boundary rules + package `exports`; CI fails on violation. |
| Runtime | **One Docker image, two commands**: `web` (`next start`) and `worker` (pg-boss consumer). Identical image for SaaS and self-host. `DEPLOYMENT_MODE=saas\|selfhost` env flag. |
| Hosting (own SaaS) | Staged (see "Runtime and hosting"): laptop dev compose (Phases 0–3) → one Singapore VPS behind Cloudflare Tunnel, nightly encrypted backups to R2 (Phase 4 → first sale) → DigitalOcean Managed PostgreSQL, Singapore (from first sale). Cloudflare R2 for files. Resend for email. Rejected: Cloudflare Workers/Pages for the app, Cloudflare Containers, Neon free, Supabase free. |
| Database | PostgreSQL 17 (18 allowed; dev and tests pin 17), Drizzle ORM, plain TCP driver (`postgres`), never a provider-specific HTTP driver (pg-boss's internal `pg` pool: open question 1). postgres.js runs with **`prepare: false`** (Spike 1). **Five roles, none with `BYPASSRLS`**: `crm_migrator` (owns schema, runs migrations, installs and upgrades pg-boss, connects directly), `crm_app` (runtime; on `audit_log`, `domain_event`, `document_artifact` and the version tables it may INSERT and SELECT but never UPDATE or DELETE; minimal enqueue-only grants on `pgboss`), `crm_link_resolver` (`NOLOGIN`, owns `resolve_share_link()` only), `crm_purge` (PDPA purge only; see "Audit, logging, privacy") and `crm_worker` (the worker's pg-boss instance: fetch, complete and maintenance rights on `pgboss.*`; exact grants set in Phase 1). |
| Tenancy | `billing_account` (billing owner) → `organization` (= workspace, Better Auth) → tenant data. Workspace configuration lives in `workspace_settings` (RLS), not on `organization`. One login, many workspaces, switcher in header. Zero data shared across workspaces. RLS on every tenant table; Better Auth tables carry no RLS and are reached only through the system module. |
| Auth | Better Auth: email + password (Argon2id), TOTP 2FA with recovery codes, organization plugin, rate limiting with `storage: "database"`. Passkeys in Phase 9. Google login in Part 3. |
| Money | `bigint` minor units + per-currency exponent. Multi-currency per document. Workspace base currency; `fx_rate` (manual, default = last rate used for the pair) and base totals frozen on issue. Tax **off unless the workspace is registered**; when on, workspace default tax name/rate, per-line taxable flag and rate override. Exact rules in "Money rules". **No accounting features.** |
| Approval / signature | Link issued to a named contact → email OTP → typed name + "I agree" → signature record with verified email, IP, UA, timestamp, document hash → audit certificate page in PDF. |
| Agreements | Template engine; editable starter templates with `{{field}}` placeholders; single-pass substitution, no code execution; drafted for Malaysia with `{{governing_law}}`. **Part 1 types: Service Agreement (default), MSA, SOW, Change order, Sign-off.** Pattern per customer (`service_agreement` or `msa_sow`), defaulted from the workspace setting. NDA is a later template on the same engine. Lawyer reviews final text. |
| PDF | `@react-pdf/renderer`, rendered in the worker. Canonical artifact is the frozen JSON snapshot; hash = SHA-256 of canonical JSON. PDF rendered once at first send (see PDF timing), stored, never regenerated; recorded only in `document_artifact`. Merged PDFs via `pdf-lib`. |
| Jobs / events | pg-boss in the `worker`: retries with backoff, dead-letter, cron schedules. **Domain events** written to `domain_event` (append-only history) and their pg-boss job enqueued **in the same transaction** (`send` with `{ db: fromDrizzle(tx, sql), id: event.id }`; proven by Spike 2). No outbox relay. Dispatched to core handlers; extension fan-out arrives in Part 3. |
| Extensions | **Deferred to Part 3** (Appendix A kept as design). Extension rule (three tests): it talks to an external system; it is country- or customer-specific; some workspaces must be unable to use it. Anything failing the tests is core, optionally behind a per-workspace setting. Payments split: recording payments, receipts and refunds is core; collecting money (checkout, webhooks) is an extension. |
| E-invoice | Stub only in Part 1: customer TIN/BRN/SST, `einvoice_*` fields, PDF gate, `EInvoiceProvider` interface type. `einvoice-my` is a future extension. |
| Email | Adapter: SMTP (nodemailer) or Resend, chosen by env. React Email templates. |
| Files | S3-compatible via AWS SDK v3 (S3 / R2 / MinIO), path-style toggle. Private bucket, signed URLs only. |
| Validation | Zod everywhere. One `action()` wrapper: session → active workspace (from session) → role → Zod → idempotency → handler. |
| UI | Tailwind + shadcn/ui (vendored), TanStack Table + Form, dnd-kit (block reorder), Tiptap (rich-text blocks). Client link pages mobile-first. |
| Testing | Vitest, Testcontainers Postgres, Playwright, adapter contract tests. |
| Observability | Pino JSON logs (no PII, no tokens), Sentry with scrubbing on SaaS; opt-in on self-host. `/api/health` returns DB + queue status. |
| Migrations | Run by the image entrypoint before `web` starts, as `crm_migrator` over a **direct** (not pooled) connection (the runner holds a session-level advisory lock). Migrations also install/upgrade the `pgboss` schema, create queues and apply its grants. Additive / expand-contract only. |
| Secrets at rest | Stored credentials (extension settings from Part 3) encrypted with AES-256-GCM under `APP_ENCRYPTION_KEY`; key rotation procedure documented (re-encrypt job). |

## Threat model

| Actor | Access | Main risks | Primary controls |
|---|---|---|---|
| Anonymous with a share link | Client link pages | Token guessing, link leakage (incl. forwarded WhatsApp messages), forged approvals, scraping | 32-byte token (hash stored), expiry, revoke, per-link + per-IP rate limits, Turnstile + OTP before sign, `no-referrer`, `noindex`, `no-store` |
| Authenticated tenant user | Own workspace(s) | IDOR into other workspaces, privilege escalation | RLS + `withWorkspace()` + role checks per action; workspace never from client input |
| Insider (staff/admin) | Workspace data | Invoice redirection (bank details, DuitNow QR), data theft, silent edits | Permission matrix, step-up 2FA on high-risk actions, owner notifications, append-only audit log, immutable issued documents, content-addressed QR |
| Extension code (Part 3) | `ctx` only | Cross-workspace access, invariant bypass, credential leakage | See Appendix A: no DB access; all writes through core `ctx`; settings encrypted; handlers run post-commit in the worker |
| Supply chain / infra | Dependencies, image, secrets | Malicious package, leaked secret, unpatched CVE | Lockfile, Renovate, `pnpm audit`, secret scan, Trivy image scan, non-root read-only container, env-only secrets |

## Scope — Part 1

Documents: Customer, Quote, Proposal, Invoice, Receipt, Credit note, Refund, Service Agreement, MSA, SOW, Change order, Sign-off.

Also: recurring invoices, CSV import of customers and contacts, pipeline board, owner notifications, dashboard v1, accounting-period export, full workspace export, workspace offboarding, customer purge. **Not in Part 1**: extension contract (Part 3, Appendix A), NDA template, customer credit balance and statement of account (after Gate A, only if own use needs them, as derived views over documents and payments, never stored balances).

## Data model (main tables)

Every tenant table carries `workspace_id` + RLS policy. Every user-editable draft carries `version` (optimistic lock). Timestamps stored in UTC; displayed in workspace timezone.

**Accounts and workspaces**

- `billing_account` (billing owner; named to avoid Better Auth's own `account` table): owner_user_id, name, plan (`free` only in Part 1), status, `stripe_customer_id` (nullable, Part 3), limits JSON. System table, reached only through the system module.
- `organization` (= workspace; Better Auth organization plugin): Better Auth's own columns (name, slug, …) + `billing_account_id`. **No workspace settings here and no RLS** (see Tenancy).
- `member` (role: owner / admin / staff), `invitation` (email, role, token hash, expires_at): Better Auth organization plugin tables, no RLS, system module only.
- **`workspace_settings`** (tenant table, RLS; one row per workspace, `workspace_id` primary key): short code, logo key, branding (brand colour, proposal cover options), address, **country (ISO 3166-1 alpha-2)**, timezone, locale, date format, base_currency, default_currency, tax_registered (bool, default false), tax_registration_no (own SST/GST no.), own_tin, own_brn, default tax name/rate (used only when tax_registered), tax_rounding (`rate_group`), bank details, `duitnow_qr_key` (content-addressed, see Files), email settings (from name, reply-to, bcc_self), auto_send default, `default_agreement_pattern` (`service_agreement` default | `msa_sow`; applied to new customers), require_2fa, version.
- `email_template`: event, subject, body, version.
- `notification`: user_id, kind, target_type, target_id, created_at, read_at. IDs only, no personal data; read and marked per user under `withWorkspace()`.

**Customers**

- `customer`: name, address (structured), currency default, tax_identification_no (TIN), business_reg_no, sst_reg_no, po_required, `agreement_pattern` (`service_agreement` | `msa_sow`; set from `workspace_settings.default_agreement_pattern` on creation, editable per customer), archived_at. Cannot be deleted once it has issued documents (archive only).
- `contact`: customer_id, name, email, phone, role, is_primary.
- CSV import (customers + contacts): upload → validate every row with Zod → preview with errors → commit in one transaction; duplicate detection by customer name and contact email.

**Catalog**

- `service`: name, default description, default unit price (minor), unit, default_taxable.

**Sales documents**

- `quotation`: customer, contact, currency, tax name/rate, valid_until, status (draft / sent / accepted / declined / expired), version (optimistic lock of the editable draft), document discount, draft totals, number, issued_at, current_version_id, accepted_version_id.
- `quotation_version` (**append-only**, no UPDATE or DELETE grants to `crm_app`; DELETE only by `crm_purge` under the purge rule): quotation_id, version_no, frozen snapshot (lines, totals, tax, currency, fx_rate, base totals), snapshot_hash, created_at, created_by. A new row is written each time the quote is sent — directly, or inside a proposal send — if the draft differs from `current_version_id`. Old versions are never changed, so any version a client saw or accepted stays stored; its PDF is recorded in `document_artifact`. Quote → invoice copies from `accepted_version_id`, else from `current_version_id`.
- `invoice`: optional quotation_id, optional proposal_id, optional recurring_invoice_id, customer, contact, currency, fx_rate, tax, due date, status (draft / issued / part-paid / paid / overdue / void), po_number + po_file_key, document discount, totals, number, issued_at, sent_at, bank_details_snapshot (includes the DuitNow QR hash key when one is set), reminder settings, **einvoice_status** (`not_required` default / pending / validated / rejected / cancelled), einvoice_uuid, einvoice_validation_url, einvoice_submitted_at, frozen_snapshot, snapshot_hash.
- `recurring_invoice`: customer, contact, currency, line items (template), document discount, schedule (monthly / quarterly / yearly + day), next_run_at, end_after (date or count, optional), auto_send, status (active / paused / ended), version. A daily job creates one invoice per due period under `withWorkspace()` — a draft, or issued and sent when `auto_send` — idempotent by (recurring_invoice_id, period). All money rules apply at creation; `fx_rate` defaults to the last rate used for the pair.
- `line_item`: parent (quotation | invoice | credit_note | recurring_invoice), sort, service_id, description, qty_milli (bigint, qty × 1000), unit, unit_amount (minor), line_discount_bps, taxable, tax_rate_override_bps, line_total (minor), doc_discount_alloc (minor), tax_base (minor).
- `payment`: invoice_id, amount (minor), currency, received_at, method, reference, recorded_by, external_ref (for payment-link extensions, Part 3).
- `receipt`: payment_id, number.
- `credit_note`: invoice_id, reason, line items, totals, number, status, einvoice fields as on invoice.
- `refund` (manual; no gateway): credit_note_id or payment_id (overpayment), amount (minor), currency, refunded_at, method, reference, recorded_by, voided_at, void_reason. Never edited; a mistaken refund is voided with a reason (audited). Refund ≤ the credit note's unrefunded amount or the payment's overpaid amount.

**Proposals**

- `proposal`: customer, contact, linked quotation_id, status (draft / sent / viewed / approved / declined), ordered `blocks` JSON, branding options (cover, colours from `workspace_settings`), auto_send override, current_sent_version_id, approved_sent_version_id, number.
- `proposal_sent_version` (**append-only**, no UPDATE or DELETE grants to `crm_app`; no mutable columns; DELETE only by `crm_purge` under the purge rule): proposal_id, version_no, frozen snapshot of the proposal blocks, `quotation_version_id` (the exact quote version shown), snapshot_hash (covers blocks + the quote version's hash), sent_at, sent_by. "Superseded" is derived (`id ≠ proposal.current_sent_version_id`), never stored. Approval writes nothing to this table; it sets `proposal.approved_sent_version_id`.
- Block types: scope of work (from `service`), deliverables, exclusions, revisions, notes (rich text), pricing (renders linked quote live), payment schedule (milestones by % or amount), timeline (phases with dates → Part 2).
- **Pipeline board**: proposals and quotes grouped by status (draft / sent / viewed / approved / declined), values in base currency. Derived from document status; no separate stage table in Part 1.

**Agreements**

- `agreement_template`: type (service_agreement / msa / sow / change_order / sign_off), version, body with `{{fields}}`, governing_law default, is_default. (`nda` is added later on the same engine.)
- `agreement`: type, customer, optional proposal, `parent_msa_id` (SOW only: the customer's MSA; null until one is linked), `parent_agreement_id` (change order and sign-off: the SOW for `msa_sow` customers, otherwise the Service Agreement), frozen rendered body, body_hash, status (draft / sent / signed / void), signed_at, number. A signed agreement never changes; corrections are a new agreement (the old one voided).
- **One open MSA per customer**: unique partial index `agreement (workspace_id, customer_id) WHERE type = 'msa' AND status IN ('draft', 'sent')` (open = unsigned and not void).
- Agreement creation, MSA linking and signing order: see "Agreements: creation and signing".

**Client links and signatures**

- `share_link`: token_hash (unique), workspace_id, target (doc type + id), document_version (e.g. `proposal_sent_version.id`), issued_to_contact_id, expires_at (default 30 days; extendable for agreements), revoked_at, view_count, last_viewed_at.
- `otp_challenge`: share_link_id, code_hash, expires_at (10 min), attempts (max 5), verified_at.
- `signature`: doc ref, typed_name, verified_email, verification_method (`email_otp`), ip, user_agent, signed_at, document_hash (append-only; the certificate PDF is recorded in `document_artifact`).

**System**

- `doc_sequence`: per workspace per doc type: pattern, reset rule, counter, last_reset_period.
- `idempotency_key`: key, action, workspace, response hash, expires_at.
- `audit_log` (append-only): actor, workspace, action, target, before/after JSON (personal-data fields stored as `"[pii]"`), ip, created_at.
- **`domain_event`** (append-only history and replay record): name, version, workspace_id, payload JSON (IDs and amounts only), created_at. No `relayed_at`: the job is enqueued in the same transaction.
- `workspace_export`: kind (`full` | `accounting_period`), period, requested_by, status, file_key, expires_at.
- **`document_artifact`** (append-only: `crm_app` writes by INSERT only and may SELECT; no UPDATE or DELETE; DELETE only by `crm_purge` for artifacts of purgeable versions): workspace_id, target_type (`quotation_version` / `proposal_sent_version` / `invoice` / `credit_note` / `receipt` / `agreement` / `signature`), target_id, kind (`pdf` / `merged_pdf` / `certificate_pdf`), storage_key, file_sha256, renderer_version, created_at. Unique (target_type, target_id, kind). **The only place a stored PDF is recorded**; no document or version table has a `pdf_key` column.
- pg-boss owns its own `pgboss` schema (installed and upgraded by `crm_migrator` in migrations; owner = `crm_migrator`). Its tables have **no RLS** and one shared `job_common` table holds every workspace's jobs, so job payloads hold IDs only. `crm_app` gets exactly the enqueue grants proven by Spike 2 and **cannot read job payloads** (`SELECT` on `pgboss.job` / `job_common` payload columns stays denied):
  ```sql
  GRANT USAGE ON SCHEMA pgboss TO crm_app;
  GRANT SELECT ON pgboss.version, pgboss.queue TO crm_app;                -- web instance start() + queue cache
  GRANT INSERT, SELECT (id, start_after) ON pgboss.job_common TO crm_app; -- RETURNING id; start_after only if a queue has notify on
  -- pgboss.job_now() is executable through the PUBLIC default.
  ```
  Grants are **per queue table**: a queue created with its own partition gets a new table, so migrations use `ALTER DEFAULT PRIVILEGES` for `crm_migrator` or re-grant in the migration that creates the queue. `crm_worker` gets the fetch/complete/maintenance rights (measured in Phase 1).
- `workspace_extension` is **not** in Part 1 (Appendix A, Part 3).

### Numbering

Tokens: `{CODE}`, `{YYYY}`, `{YY}`, `{MM}`, `{SEQ:n}` + free text. Live preview in settings. Number assigned only on **issue/send** (drafts show "DRAFT") → no gaps. Period tokens use the workspace timezone. Assigned inside `SELECT … FOR UPDATE` on the sequence row. Pattern changes affect only new documents. Voided documents keep their number.

### Money rules (`packages/core/src/money`)

**Representation**

- Amounts: `bigint` minor units; currency exponent from a static table. No floats anywhere (DB, code, JSON — serialise as strings).
- Quantity: `qty_milli` = quantity × 1000 (3 decimal places, e.g. 1.5 h = 1500). Entry with more than 3 decimals is rejected.
- Percentages (discounts, tax rates): basis points, integer (8% = 800, 12.5% = 1250).
- Line discount: **percentage only** (`line_discount_bps`). A fixed-amount discount exists only at document level.
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
   - `fx_rate` = how many **major** units of the workspace base currency equal **one major** unit of the document currency (e.g. 1 JPY = 0.03 MYR → `0.03`). Stored as `numeric(20,10)`, carried in code as a decimal string parsed to an exact `bigint` rational. Entered manually by the user, prefilled from the last rate used for that currency pair in the workspace; `1` when currencies match.
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

- Issued documents are never edited or hard-deleted. Corrections: quote → new version; invoice → credit note + new invoice (and a refund if money goes back); agreement → new agreement.
- Void keeps the number and stays visible.
- Drafts may be hard-deleted. Customers with issued documents can only be archived.
- The frozen JSON snapshot is the legal record; its short hash appears on the client page and in the PDF footer.
- The only deletion of append-only rows is the `crm_purge` rule (versions that never led to an issued invoice).

### PDF timing

- Draft previews render on demand with a DRAFT watermark and are not stored.
- **Storing a rendered PDF never updates the source row.** The worker uploads the file to `ws/{workspace_id}/pdf/{uuid}.pdf` (a prefix used only for rendered PDFs), then inserts one `document_artifact` row (`INSERT … ON CONFLICT (target_type, target_id, kind) DO NOTHING`). A retried job that finds an existing row stops and deletes its own orphan upload. The version and signature rows stay untouched and append-only.
- **Orphan sweep:** if a worker crashes after upload but before the insert, the file is an orphan. A daily pg-boss job fans out one sub-job per workspace. Each sub-job runs under `withWorkspace(workspace_id)`, lists only `ws/{workspace_id}/pdf/` objects older than 24 hours, deletes any whose key has no `document_artifact` row in that workspace, and logs the count. It never lists across workspaces and never touches user uploads, DuitNow QR images or exports.
- A download that arrives before the artifact exists shows "Preparing your PDF…" and polls; it never renders on the fly.
- Quotes, proposals, agreements: rendered by `pdf.render` when each version is first sent (a proposal resend renders the new sent version) (agreements again at sign, with certificate page); stored; never regenerated.
- **Invoices and credit notes**: `pdf.render` runs only when `einvoice_status ∈ {not_required, validated}`. In Part 1 there are no extensions, so core sets `not_required` at issue and the PDF renders immediately. Once an e-invoice extension exists and is enabled (Part 3 onward), status is `pending` until it emits `einvoice.validated`, so the stored PDF can carry the validation QR/link.

## Domain events and jobs

Emitted by core, written to `domain_event` (append-only history) in the **same transaction** as the change. Payloads carry `version`, IDs and amounts only; handlers ignore unknown fields.

**Enqueue:** in the same transaction, the pg-boss job is enqueued with `boss.send('domain_event', { eventId }, { db: fromDrizzle(tx, sql), id: eventId })`, so a rolled-back change leaves neither event nor job, the job is invisible to other connections until commit, and a repeat send with the same event id creates one job (all proven by Spike 2 on drizzle-orm 0.45.3). The web process holds a send-only `PgBoss` instance as `crm_app` with `migrate`, `supervise`, `schedule` and `createSchema` all `false` and `max: 2`; the worker holds its own instance as `crm_worker`. Queue `notify` stays **off** in Phase 1 (polling); turning it on changes the SQL `send` emits and the grants it needs, so it is only changed in a migration. *(History: v3–v4.4 used a transactional outbox + relay job; dropped in v4.5 after Spike 2.)*

Part 1 event set: `customer.created`, `quotation.sent`, `quotation.accepted`, `quotation.expired`, `proposal.sent`, `proposal.approved`, `proposal.declined`, `invoice.issued`, `invoice.sent`, `invoice.paid`, `invoice.overdue`, `invoice.voided`, `payment.recorded`, `refund.recorded`, `credit_note.issued`, `agreement.created`, `agreement.sent`, `agreement.signed`. Reserved for the e-invoice extension (Part 3 onward): `einvoice.validated`, `einvoice.rejected`.

**Dispatch (in the worker):** core handlers only in Part 1 (e.g. `invoice.issued` → set `einvoice_status` → enqueue `pdf.render`; `proposal.approved` → owner notification; `agreement.created` → MSA provisioning for a SOW, see "Agreements: creation and signing"). Per-workspace fan-out to extensions is added in Part 3 (Appendix A). Failures retry with backoff and dead-letter; a "failed, retry" badge shows in the UI.

## Dashboard v1

Workspace home, all figures in workspace base currency using frozen `fx_rate`:

- Invoiced, paid, outstanding, overdue: this month, last month, year to date.
- Overdue list (oldest first) with one-click reminder.
- Quotes sent vs accepted (count and value), last 90 days.
- Top customers by invoiced value, year to date.
- Recent activity feed from `audit_log` (sends, views, approvals, payments).

No aging buckets beyond "overdue", no P&L, no tax reports, no customer balances or statements. Queries hit composite indexes; no materialised views in Part 1.

## Accounting handoff

- **Period export** (`workspace_export.kind = accounting_period`): CSV + JSON of invoices, line items, payments, credit notes and refunds for a date range, in document currency with base-currency columns. Owner/admin action, generated by a job, downloadable via signed URL, 7-day expiry.
- API sync is a later `AccountingSync` extension; the export exists so "not accounting" is a workable positioning from day one.

## The flow (one project, end to end)

| # | Who | Step | Document |
|---|---|---|---|
| 1 | You | Add client + contacts (or CSV import) | — |
| 2 | You | Create quote | Quote |
| 3 | You | Create proposal; while it is a draft, the pricing block shows the linked quote live ("Add pricing" makes a new linked quote) | Proposal |
| 4 | You → Client | Send one link issued to a specific contact, by email and optionally **Share to WhatsApp** (`wa.me` with the link prefilled; OTP still required). Sending freezes a **sent version** (proposal + quote snapshot + hash); the link shows only that version. Single **Download ▾** button (hover + click/tap + keyboard): *Proposal + Quote (merged PDF)*, *Proposal*, *Quote* | Proposal + Quote |
| 5 | Client | Enters OTP sent to their email; approves (typed name + "I agree") or declines with reason | — |
| 6 | App | One transaction (see "Approval and Resend concurrency"): lock the proposal, then the link; recheck the link is live and names `current_sent_version_id` (else the generic page), then set `proposal.approved_sent_version_id` (that sent version's snapshot + hash are the record), set `quotation.accepted_version_id` = the `quotation_version_id` inside that sent version and quote → accepted, move any unsent quote edits to a new draft quote, record signature, create **exactly one** agreement per the customer's pattern (**Service Agreement**, or a **SOW** pointing at the customer's signed MSA or at none); write events (incl. `agreement.created`) and enqueue jobs; owner notified; enqueue emails if auto-send. After commit, a job creates a draft **MSA** if the SOW has no signed one (see "Agreements: creation and signing") | Agreement (+ MSA by job) |
| 7 | Client | Signs by link (OTP): an unsigned MSA first, then the SOW, in the same OTP session; or the Service Agreement. Downloads PDFs with certificate page | — |
| 8 | You | "Create invoices from payment schedule" (e.g. 50% deposit) as drafts. PO number + PO file if the client requires it. DuitNow QR and bank details printed from the frozen snapshot | Invoice |
| 9 | You | Record payment (full/part) — or, with a payments extension (Part 3), the client pays via link and the payment is recorded from the webhook event | — |
| 10 | App | Auto-create + send receipt (job) | Receipt |
| 11 | You → Client | Change order for extra work (references the SOW, or the Service Agreement) → client signs → invoice it | Change order |
| 12 | You | Final invoice → payment → receipt | Invoice + Receipt |
| 13 | You → Client | Sign-off (references the SOW, or the Service Agreement): client accepts work; IP transfers after final payment | Sign-off |

Any time: quick invoice; quote → invoice in one click; credit note (and manual refund if money goes back); recurring invoices for retainers. Scheduled jobs mark overdue invoices and expired quotes daily, run recurring invoices, and send reminders (+3, +7 days, configurable).

If the quote or proposal changes after sending, the client link keeps showing the sent version. The owner sees "Changed since sent — resend to update the client". **Resend** creates a new sent version and a new link, revokes the old link, and emails the contact the new link ("This proposal has been updated — here is the latest version"). After a Resend the UI also offers **"Share new link to WhatsApp"**, because a client who received the first link on WhatsApp would otherwise tap the revoked one. The old link then shows the same generic "This link is not available" page as any revoked link (see Anonymous access) and cannot approve. The client can only ever approve exactly what was sent to them.

If the client approves a sent version while the owner has **unsent** edits to the quote, the approval stands on the sent terms: the quote version inside that sent version becomes the accepted one. The unsent edits are kept as a new **draft quote** (a copy, linked to the original, labelled "Changes after approval") so no work is lost; it can be sent as a new quote or used for a change order.

## Onboarding

- Sign-up → workspace created with country-based defaults in `workspace_settings` (MY: MYR, `INV-{CODE}-{YYYY}-{SEQ:4}`, Asia/Kuala_Lumpur, dd/mm/yyyy; SG: SGD, Asia/Singapore). **Tax is off by default.**
- Sign-up asks one question: "Are you registered for SST (MY) / GST (SG)?" — **No** (default): `tax_registered = false`, documents show no tax row. **Yes**: registration number required; tax name and rate preselected (MY: Service Tax 8%; SG: GST 9%), editable, other rates selectable per line. Changeable later in settings (admin); the change applies only to new documents. Own TIN and BRN optional in settings.
- First-run checklist: logo, bank details (step-up), optional DuitNow QR (step-up), first customer, first invoice (Phase 4) / first quote (Phase 5). Everything else has defaults.
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
| CSV import of customers and contacts | — | ✔ | ✔ |
| Issue invoices, record payments, void, credit notes, refunds, recurring invoices | — | ✔ | ✔ |
| Templates, numbering, email settings, catalog | — | ✔ | ✔ |
| Period export | — | ✔ | ✔ |
| Manage staff members | — | ✔ | ✔ |
| Manage admins, roles, invitations | — | — | ✔ |
| Bank details, DuitNow QR (step-up) | — | — | ✔ |
| Full workspace export (step-up) | — | — | ✔ |
| Customer purge (step-up) | — | — | ✔ |
| Delete / offboard workspace, billing (Part 3) (step-up) | — | — | ✔ |
| Enable/disable extensions, extension settings (Part 3, step-up) | — | — | ✔ |

- Step-up: fresh TOTP within the last 5 minutes for high-risk actions.
- Bank-details or DuitNow QR change: step-up, audit (account numbers stored in the audit entry as last 4 digits + SHA-256 of the full value; QR as its hash key), email to all owners, "Bank details updated on {date}" printed on invoices for 60 days. Issued invoices carry a frozen bank-details snapshot including the QR hash key.

### Tenancy

- RLS on all tenant tables with `ENABLE` + `FORCE ROW LEVEL SECURITY`; workspace policies are `TO crm_app` (and `TO crm_purge` for the purge tables) and define `USING` and `WITH CHECK` as `workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid)`. The sub-select evaluates the setting once per query. **`nullif` is required** (Spike 1): a fresh connection returns NULL for the setting, but once a transaction-local `set_config` has run on a server connection it returns `''` afterwards (directly and through PgBouncer), and `''::uuid` fails with `22P02`. The failure only shows when the table has rows (on an empty table the sub-select is never evaluated), so a policy lint/test fails any policy that casts `current_setting` without `nullif`, and **RLS tests always seed rows in other workspaces**, including a bare query on a reused connection.
- Runtime connects as `crm_app`; migrations as `crm_migrator`; the worker's pg-boss instance as `crm_worker`. **No role in the system has `BYPASSRLS`** (checked by a test on `pg_roles`).
- `crm_link_resolver` (`NOLOGIN`, no `BYPASSRLS`) exists only to own `resolve_share_link()` — see "Anonymous access". `crm_purge` (no `BYPASSRLS`) exists only for the purge path — see "Audit, logging, privacy". `crm_worker` (no `BYPASSRLS`) has rights on `pgboss.*` only; job handlers do their tenant work through `withWorkspace()` as `crm_app`.
- Every request and every job runs `withWorkspace(workspaceId, tx => …)`: transaction, `select set_config('app.workspace_id', $1, true)` (bound parameter, transaction-local), work, commit. `SET` and `SET LOCAL` for the workspace context are banned (`SET LOCAL app.workspace_id = $1` fails with `42601` in both postgres.js and Drizzle; `set_config` works — Spike 1).
- **Better Auth tables** (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, two-factor and rate-limit tables) and `billing_account` carry **no RLS**: they are read before any workspace is chosen (sign-in lookups by email). They are reached only through the allow-listed system module; the lint rule forbids access from anywhere else. No workspace settings or other sensitive tenant data live in them (hence `workspace_settings`).
- Lint rule: no `db.` access outside `withWorkspace` except the allow-listed system module. Integration test proves workspace A cannot read or write workspace B via every tenant table. A schema test asserts that the set of tables without RLS equals the allow-list (Better Auth tables, `billing_account`, `pgboss.*`) exactly.

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
- **Share to WhatsApp**: a `wa.me` link with the client link prefilled, opened from the owner's device; the app sends nothing to WhatsApp itself. A WhatsApp-shared link carries the same token rules; OTP (to the named contact's email) is still required before approve or sign.
- Cloudflare Turnstile on OTP requests (on by default on SaaS; optional on self-host, see Open question 9).
- OTP: 6 digits, HMAC-hashed, 10-minute expiry, 5 attempts, then re-issue required.
- Signature record + certificate page: signer name, verified email, IP, user agent, timestamp, document hash, method.
- Client link pages are mobile-first (most links open on a phone from WhatsApp or email).

### Input, templates, files

- Zod on every input (including every CSV import row); templates single-pass substitution only; all output escaped.
- Uploads: magic-byte allow-list (PDF, PNG, JPG), size limits, keys `ws/{workspace_id}/{uuid}`, signed URLs ≤ 10 min, `Content-Disposition: attachment`, `nosniff`. SVG/HTML never accepted. ClamAV optional in self-host compose.
- **DuitNow QR**: uploaded image (PNG/JPG, step-up owner action), stored **content-addressed** at `ws/{workspace_id}/duitnow/{sha256}.{ext}` and **never deleted** while the workspace exists (not by replacement, orphan sweep or purge). `workspace_settings.duitnow_qr_key` points to the current one; each issued invoice's snapshot references the hash key it was issued with, so old invoices keep rendering after a replacement.

### Transport and headers

- Nonce CSP (Phase 1), HSTS, `frame-ancestors 'none'`, secure/httpOnly/sameSite cookies. TLS terminates at Cloudflare (Tunnel) on own SaaS; Caddy terminates TLS on self-host.
- Sending domain must have SPF, DKIM and DMARC; self-host guide covers it.

### Secrets, supply chain, image

- Env-only secrets; documented rotation for session secret, encryption key, S3, email keys, Cloudflare Tunnel token.
- Lockfile, Renovate, `pnpm audit`, secret scanning, Trivy image scan, SBOM per release. Non-root, read-only filesystem. pg-boss and drizzle-orm pinned to exact versions.
- No cron endpoints (worker owns schedules). Only unauthenticated HTTP surface: `/api/health` (and client link routes, which require a token).

### Audit, logging, privacy

- Audit log append-only; records logins, 2FA, sends, views, approvals, signatures, payments, refunds, voids, settings changes, exports, purges, member changes. Personal-data fields in before/after JSON are stored as `"[pii]"`; entries reference IDs. `domain_event` payloads carry IDs and amounts only; pg-boss job payloads carry IDs only.
- Pino JSON logs, no PII/tokens; Sentry scrubbing; 90-day retention on SaaS.
- PDPA (MY/SG): workspace export, customer purge path, retention statement, workspace offboarding.
- **Customer purge** (owner, step-up, Phase 9) runs under `withWorkspace()` as `crm_purge`. `crm_purge` may DELETE `quotation_version` and `proposal_sent_version` rows **only where the parent quotation/proposal never led to an issued invoice** (no invoice with that `quotation_id` / `proposal_id` in a non-draft status), plus those versions' `document_artifact` rows; the job deletes the matching PDF files. It has no DELETE on invoices, credit notes, receipts, payments, refunds, their artifacts, `audit_log` or `domain_event`. **Issued financial documents are retained** for the statutory period (~7 years; verify). The purge is audited. Scope for signatures, agreements, links and customer/contact rows: Open question 5.
- **Workspace offboarding** (owner, step-up, Phase 9): full export first, then deletion; what is retained follows the statutory retention answer (Open question 6).

### Backups

- Phase 4 → first sale (VPS): nightly encrypted `pg_dump` + bucket sync to R2 (separate bucket and credentials from the app), monthly restore test.
- From first sale: DigitalOcean Managed PostgreSQL PITR, plus the nightly encrypted dump to R2.
- Self-host: daily encrypted `pg_dump` + bucket sync, off-site copy.
- Restore tested in Phase 4 (Gate A), drilled in Phase 9 and in the self-host guide; one timed full restore for Gate D.

## Reliability

- Money, approval and event writes, and their job enqueue, in single DB transactions.
- Idempotency keys on issue / approve / pay / refund / convert / sign; recurring invoice creation idempotent by (recurring_invoice_id, period).

### Approval and Resend concurrency

Approve, decline, Resend, revoke and proposal edits all run in one transaction under `withWorkspace()` and take row locks in **one fixed order: `proposal` → `share_link` → `quotation`**. No path takes them in another order, so they serialise without deadlock.

**Approve / decline** (client, by link):

1. Resolve the token (read-only, outside the lock) to get `workspace_id`, `share_link_id`, `target_id`.
2. `SELECT … FROM proposal WHERE id = target_id FOR UPDATE`.
3. `SELECT … FROM share_link WHERE id = share_link_id FOR UPDATE`.
4. Recheck **inside the lock**: `revoked_at IS NULL`, `expires_at > clock_timestamp()` (wall-clock time read **after** the locks are held — never `now()`, which is frozen at transaction start), `share_link.document_version = proposal.current_sent_version_id`, `proposal.approved_sent_version_id IS NULL`, status ∈ {sent, viewed}, OTP verified for this link within 10 minutes of `clock_timestamp()`. Any failure → roll back, show the generic "link not available" page (or "already approved" for a repeat by the same verified signer, via the idempotency key).
5. `SELECT … FROM quotation … FOR UPDATE`; write approval, acceptance, signature, **exactly one** agreement (Service Agreement, or SOW with `parent_msa_id` = the customer's signed MSA or null; no MSA is created or locked here), `domain_event` rows (incl. `agreement.created`) and their jobs; commit.

**Resend / revoke** (owner): lock `proposal FOR UPDATE`, then the current `share_link FOR UPDATE`; refuse if `approved_sent_version_id IS NOT NULL` ("Already approved — create a new quote or change order"); then lock `quotation FOR UPDATE`; otherwise insert the new quote version (if changed) and the new sent version, set `current_sent_version_id`, revoke the old link, insert the new link; commit. The UI then offers email (sent automatically) and "Share new link to WhatsApp".

The same pattern applies to agreement signing (lock `agreement` → `share_link`; see "Agreements: creation and signing" for MSA + SOW) and to direct quote acceptance (lock `quotation` → `share_link`).

**Race test (required, Testcontainers, two real connections as `crm_app`):** start approve and Resend on the same proposal concurrently, many iterations with randomised delays. Exactly one wins every time. If Resend wins: approve fails with the generic page, no signature or acceptance row exists. If approve wins: Resend is refused, the old link stays the approved version, no new sent version exists. Also: two concurrent approvals of the same link → one signature row. **Expiry-under-lock test:** hold the proposal lock in one connection, let the link's `expires_at` pass, then release; the waiting approval must fail with the generic page. The race test runs against the simplified approval transaction (one agreement, no MSA work) and must still pass.

### Agreements: creation and signing

Each customer has `agreement_pattern` (`service_agreement` | `msa_sow`), defaulted from `workspace_settings.default_agreement_pattern`.

1. **In the approval transaction** (lock order unchanged: `proposal` → `share_link` → `quotation`): create exactly one agreement. `service_agreement` → a Service Agreement. `msa_sow` → a SOW whose `parent_msa_id` is the customer's signed MSA (latest signed, if several), or null if none is signed. The transaction never creates, locks or branches on an unsigned MSA. It commits and emits `agreement.created`.
2. **Post-commit job on `agreement.created`** (worker, under `withWorkspace()`, idempotent by event id), only for a SOW with `parent_msa_id IS NULL`:
   - If the customer now has a signed MSA, use it. Otherwise `INSERT` a draft MSA for the customer `ON CONFLICT DO NOTHING` against the unique partial index "one open MSA per customer" (open = unsigned and not void), then select the customer's open MSA. Two concurrent jobs for the same customer therefore end with one MSA.
   - Link without a race: `SELECT … FROM agreement WHERE id = sow_id FOR UPDATE`, then `UPDATE agreement SET parent_msa_id = $msa WHERE id = sow_id AND parent_msa_id IS NULL AND status <> 'signed'`. A SOW already linked or already signed is left alone. Auto-send of a `msa_sow` pair happens after this link is set.
3. **Signing link** (`share_link` targets the SOW; the public read model includes its parent MSA): if the MSA is unsigned, the client signs the MSA first, then the SOW, in the same OTP session. Signing the MSA locks `agreement` (SOW) → `share_link` → `agreement` (MSA), in that order. **A SOW signature is refused unless its parent MSA is signed.** Signing the SOW locks the SOW row (then `share_link`) and checks that `parent_msa_id` is set and that MSA's status is `signed`. Holding the SOW's lock is sufficient: the SOW's `parent_msa_id` cannot change while it is locked (the linking job takes the same lock), and a signed MSA is immutable — it can never become unsigned, voided or edited — so the check cannot be invalidated before commit.
4. **Change orders and sign-offs** reference, via `parent_agreement_id`, the SOW for `msa_sow` customers and the Service Agreement otherwise.

### Jobs and errors

- pg-boss: retries with exponential backoff, dead-letter; "failed, retry" badge in UI; enqueue idempotent by event id (job `id` = `domain_event.id`).
- Friendly user messages; details in logs and Sentry.
- `/api/health` checks DB and queue.

## Scalability

- `web` stateless → N replicas; `worker` scales independently.
- App connections go through the pooled connection string; the pooler **must be transaction mode**, and postgres.js runs with `prepare: false` (non-overridable when `DATABASE_URL` points at a pooler). Spike 1: only `prepare: true` with a pooler that has `max_prepared_statements=0` broke (~60% of transactions failed with `26000`, no leak); Drizzle already runs unprepared, so the flag only affects raw tagged calls, and DO's pooler settings are not under our control. Migrations always go **direct** (session-level advisory lock, DDL). pg-boss uses advisory *transaction* locks, so it works through the pooler with polling; LISTEN/NOTIFY needs a **direct** connection (through the pooler the channel registration is lost and it falls back to polling). PgBouncer on self-host when needed.
- Starting pool sizes per process (Spike 1/2; correctness was proven at 2, throughput is not): web postgres.js `max` 5–10 via the pooler; web pg-boss `max: 2`; worker pg-boss `max` 3–5; PgBouncer `default_pool_size` sized to the DB plan.
- Composite indexes: `(workspace_id, created_at)`, `(workspace_id, status)`, `(workspace_id, customer_id)`.
- Numbering lock serialises only one workspace.
- `audit_log`, `domain_event`, share-link views: monthly archive job when they grow.
- Plan limits become columns on `billing_account` in Part 3.
- PDF, recurring invoices and (from Part 3) all extension work happen in the worker.

## Known risks

- **R1 empty-string setting — confirmed and fixed.** Spike 1 reproduced it (`22P02` without `nullif`, 0 rows with it). Guarded by the required `nullif`, the policy lint/test and RLS tests that seed rows in other workspaces.
- **R2 `pg` driver.** pg-boss depends on `pg` and opens its own node-postgres pool in the worker and, small (`max: 2`), in the web-side send-only instance; this conflicts with the "`postgres` driver only" rule in the Phase 0 plan. **Open question 1 for Charlie**; not decided here.
- **R3 `pgboss` tables have no RLS — mitigated.** Job rows from every workspace share `job_common`. Payloads hold IDs only; `crm_app` has enqueue-only grants and cannot read payloads (Spike 2). Grants are per queue table, so a new partitioned queue needs `ALTER DEFAULT PRIVILEGES` or a re-grant in its migration.
- **R4 connection budget.** Each process opens the app pool (postgres.js) and pg-boss's pool; Better Auth uses the app pool. Small DO Managed PG plans allow a few tens of connections, and migrations (and LISTEN, if ever enabled) need direct connections. Starting sizes are under Scalability; final sizes in the Phase 1 plan.
- **R5 pins.** pg-boss releases often and its Drizzle adapter targets drizzle 1.0 RC; pin pg-boss 12.35.0 exactly and keep drizzle-orm 0.45.3 until a planned upgrade (Spike 2 proved `fromDrizzle` on 0.45.3).
- **R6 untested by the spikes:** pg-boss maintenance/supervise through the pooler over a full cycle (60 s+); the exact grants of `crm_worker` (the spike used the schema owner as worker); a run against the DO Managed PG pooler. Each is checked in Phase 1 before the worker role is fixed.
- **R7 web queue cache lag.** The web pg-boss instance caches queue options for up to 60 s (`queueCacheIntervalSeconds`); a queue option changed after start is not seen until refresh. Queue options (including `notify`) change only in migrations, followed by a restart. With `notify` on, a backlog tail can wait for the 30 s backstop poll; `notify` stays off in Phase 1.

## Runtime and hosting

- Image: multi-stage Dockerfile → Next.js standalone + worker entry. Entrypoint runs migrations, then `web` or `worker`.
- Dev compose: `web`, `worker`, `postgres`, `minio`, `mailpit`.
- **Stage 1 — Phases 0–3: laptop.** Dev compose only; no hosting.
- **Stage 2 — Phase 4 → first sale: one Singapore VPS** running prod compose (`web`, `worker`, `postgres`, `cloudflared`), files on R2, email via Resend. Cloudflare in front (DNS + proxy, Tunnel so the VPS exposes no inbound ports, R2, Turnstile). Nightly encrypted backups to R2. VPS provider: Open question 4.
- **Stage 3 — from first sale: DigitalOcean Managed PostgreSQL, Singapore** (PITR, pool port in transaction mode for the app with `prepare: false`, direct port for migrations and for any LISTEN/NOTIFY user). App containers stay on the VPS (or move later) behind the Tunnel.
- **Rejected, with reasons:**
  - *Cloudflare Workers / Pages for the app*: not a long-running Node process; the pg-boss worker, TCP Postgres and the one-image rule (same image for SaaS and self-host) don't fit.
  - *Cloudflare Containers*: would split SaaS from the self-host deployment model and doesn't give an always-on worker as simply as a VPS.
  - *Neon (free)*: compute suspends when idle, and pg-boss's polling and maintenance fight scale-to-zero; the free tier is not a place for real financial records.
  - *Supabase (free)*: pauses inactive projects; its platform auth and RLS conventions would sit alongside Better Auth unused.
- Prod compose (self-host, Part 4): `caddy`, `web`, `worker`, `postgres`, `minio` (or buyer's S3), optional `clamav`.
- Env: `DATABASE_URL` (pooled, `crm_app`), `DATABASE_MIGRATOR_URL` (**direct**, not pooled, `crm_migrator`), a worker connection for `crm_worker` (pooled with polling; direct if LISTEN/NOTIFY is ever turned on; exact variable name set in the Phase 0 plan patch), `DEPLOYMENT_MODE`, `APP_URL`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `EMAIL_PROVIDER=smtp|resend` + keys, `STORAGE_*`, `TURNSTILE_*` (optional on self-host), `SENTRY_DSN` (optional), `ERROR_REPORTING_OPTIN` (self-host).

## Planned structure

```
apps/
  web/
    src/app/             # (app) authenticated UI, (public)/l/[token] client link pages, api/health, api/webhooks (Part 3)
    src/db/              # Drizzle schema, migrations, RLS policies, withWorkspace(), system module (Better Auth, billing_account, resolver)
    src/adapters/        # email (smtp|resend), storage (s3), pdf
    src/jobs/            # pg-boss handlers: event dispatch, pdf.render, email.send, scans, recurring, exports, purge
    src/pdf/             # react-pdf templates + certificate page
    src/emails/          # React Email templates
    src/lib/auth/        # Better Auth config, action() wrapper, requireWorkspaceMember, stepUp()
    worker.ts            # worker entry
packages/
  core/                  # money, numbering, documents, agreements, signatures, events
  # extensions/*         # Part 3 (Appendix A), with apps/web/src/extensions/
templates/agreements/    # Service Agreement (default), MSA, SOW, change order, sign-off — Malaysia (NDA later)
docker/                  # Dockerfile, compose.dev.yml, compose.prod.yml (completed in Part 4)
docs/superpowers/specs/2026-09-27-core-sales-design.md
```

## Checks before the Phase 1 plan is written

These ran in Phase 0 as throwaway code in a folder outside the repo (`CRM-spikes/`, deleted afterwards; only `CRM-spikes/RESULTS.md` is kept). They gate the **Phase 1 plan**, not the Phase 0 build.

**Run 2026-09-29. Versions:** Node 24.21.0, PostgreSQL 17.11 (`postgres:17-alpine`), PgBouncer 1.25.2 (`edoburu/pgbouncer`, pinned by digest), postgres.js 3.4.9, drizzle-orm 0.45.3, pg-boss 12.35.0 (pulls `pg` 8.23.0).

1. **Spike 1 — RLS + `set_config` through a transaction-mode pool: PASSED.** Two PgBouncers in transaction mode (`default_pool_size=2`; `max_prepared_statements` 0 and 200), real `crm_migrator` / `crm_app` roles (NOSUPERUSER, NOBYPASSRLS), `FORCE ROW LEVEL SECURITY`. 18,000 postgres.js + 5,400 Drizzle concurrent transactions over 3 workspaces (direct / both poolers × `prepare` true/false, 3 runs each), multiplexed over 2 reused server connections: **0 leaked rows, 0 setting mismatches, every cross-workspace INSERT refused (`42501`), 0 cross-workspace UPDATE rows**; bare queries on reused connections returned 0 rows and bare inserts failed. **Decisions:** `nullif` in every policy is **required** (without it `22P02` on `''`, and only when rows exist — see Tenancy); postgres.js uses **`prepare: false`** (only `prepare: true` + `max_prepared_statements=0` failed, ~60% `26000` errors, no leak); `SET LOCAL … = $1` fails with `42601`, `set_config` works; migrator and any LISTEN user connect **direct**. Not run: the optional DO Managed PG trial (R6).
2. **Spike 2 — pg-boss `send` inside the Drizzle transaction: PASSED.** `send(name, data, { db: fromDrizzle(tx, sql), id })` as `crm_app` under `withWorkspace()` (set_config + RLS on `domain_event`), app direct and via the pooler, worker direct and via the pooler, LISTEN off and on: 100/100 commits → event + job, received by the worker; **100/100 rollbacks → neither event nor job**; job invisible to other connections and the worker before commit; same `id` sent twice → one job; `fromDrizzle` works unchanged on drizzle-orm 0.45.3 + postgres.js. `crm_app` needed only the grants listed under Data model → System, and `SELECT` on job payloads stayed denied. LISTEN/NOTIFY through the pooler loses its channel and falls back to polling (no jobs lost). **Decision:** transactional enqueue is the design; the outbox + relay fallback is dropped.
3. **Host/provider chosen.** The Phase 4 VPS provider (Open question 4) and the Phase 4 file/email providers (R2, Resend) are confirmed by Charlie and recorded in Decisions, so no hosting item is left uncovered.

## Build phases for Part 1

Target dates are **estimates only**, counted from 5 Oct 2026.

| Phase | Deliverable | Done when | Target (estimate) |
|---|---|---|---|
| 0. Foundation | Monorepo (pnpm workspaces), Next.js + TS + Drizzle + Postgres + Better Auth, Docker image (`web`/`worker`), dev compose, CI (typecheck, lint + boundaries, tests, `pnpm audit`, secret scan, Trivy). **Both spikes** (see "Checks before the Phase 1 plan"); postgres.js `prepare: false`; migrator on a direct connection | Sign up, 2FA, create 2 workspaces, switch; `docker compose up` runs web + worker + migrations; **spikes passed (2026-09-29)** | mid Oct |
| 1. Tenancy, security, jobs | `billing_account` / `organization` / `member` (Better Auth system module, no RLS) + `workspace_settings` (RLS), five DB roles (`crm_migrator`, `crm_app`, `crm_link_resolver`, `crm_purge`, `crm_worker`), RLS with `nullif` policies + `withWorkspace()` (`set_config`) + lint rule + policy lint, `action()`, audit log (PII-redacted), nonce CSP + headers, DB-backed rate limits, pg-boss installed by migrations with `pgboss` grants, web send-only instance + worker, `domain_event` + transactional enqueue, `notification` table, email adapter + React Email, `/api/health` | Isolation test (rows seeded in other workspaces) passes on every tenant table; no-RLS allow-list test passes; rolled-back transaction leaves no event and no job; `crm_app` cannot read job payloads; `crm_worker` grants measured and pg-boss maintenance runs a full cycle through the pooler; test email flows web → job → Mailpit | early Nov |
| 2. Workspace settings + onboarding defaults | Branding, country defaults, SST/GST question, own SST/GST no., TIN, BRN, timezone/locale, bank details + DuitNow QR (step-up + notification, content-addressed QR), currency/tax, numbering + preview, catalog, email templates | Pattern preview matches issued numbers; concurrency test passes; MY and SG defaults applied on sign-up; replacing the QR leaves the old file in place | mid Nov |
| 3. Customers + team | Customer (incl. TIN/BRN/SST) + contact CRUD, search, archive rules, CSV import, invitations | CRUD E2E; CSV import rejects invalid rows with a preview and commits valid ones atomically; invited admin sees permission matrix enforced | late Nov |
| 4. **Vertical slice: real invoice + onboarding** | Money core (all money rules + worked example), onboarding tax question, quick invoice (line items, discounts, tax, PO, bank + DuitNow snapshot), issue/lock, `einvoice_status = not_required`, PDF at send via worker, send by email, record payment, auto receipt. **Deployed to the Singapore VPS behind Cloudflare Tunnel; nightly backup to R2; one restore tested.** | Charlie issues a real invoice, gets paid, receipt sent; worked money example passes as a fixture; new-user **invoice**-in-5-minutes E2E passes; **Gate A** | mid Dec |
| 5. Quotes, conversions, jobs, dashboard | Quotes, versions, quote → invoice, credit notes, manual refunds, recurring invoices, overdue/expiry scans, reminders, dashboard v1, period export | Status transitions unit-tested; recurring job creates exactly one invoice per period under retries; refunds capped and voidable; reminders fire in staging; dashboard totals match a hand-computed fixture; new-user **quote**-in-5-minutes E2E passes; **Gate B** | mid Jan 2027 |
| 6. Proposals | Block editor (8 types, reorder), proposal branding, linked live quote in the editor, "Add pricing", payment schedule → draft invoices, sent versions + "changed since sent", pipeline board | Draft proposal reflects quote changes live; sending creates an immutable sent version; board totals match document statuses | mid Feb |
| 7. Client link pages | `resolve_share_link()`, public read models, share links to named contacts, Share to WhatsApp (incl. after Resend), Turnstile, OTP, view tracking, Download ▾, approve/decline on current sent version only, resend revokes old link, owner notifications, mobile-first pages | Client approves via OTP; hash on page matches PDF; anonymous-access tests pass (other document, other workspace, tampered IDs, revoked, expired, superseded); approve-vs-Resend race test passes; owner notified on view/approve/decline | early Mar |
| 8. Agreements | Template engine + Malaysia starter templates (Service Agreement default, MSA, SOW, change order, sign-off), per-customer agreement pattern, one agreement created on approval, MSA provisioning job + one-open-MSA index, MSA-before-SOW signing, auto-send, sign by link, certificate page | Full 13-step E2E passes (Service Agreement and MSA + SOW customers); two concurrent approvals for one `msa_sow` customer create exactly one MSA; SOW signing is refused until its MSA is signed; approve-vs-Resend race test still passes with the shorter transaction; **Gate C** | late Mar |
| 9. Hardening | Security review against this spec, a11y, performance, backup + restore drill, passkeys, full workspace export + re-import, workspace offboarding, customer purge (`crm_purge`), SaaS deploy docs | Restore drill passes; export re-imports into a fresh workspace in a test; purge test passes (never-invoiced versions, their artifacts and files deleted; issued documents untouched; `crm_purge` refused on anything else) | mid Apr |
| Own-use period | Studio runs on the product | **Gate D** | ≥ 8 weeks after Phase 4 |

## Roadmap for later parts (outline only)

Order: Part 1 → Part 3 → Part 2 → Part 4.

**Part 3 — SaaS layer** (next after Part 1, after Gate D and the Sdn Bhd): public sign-up, trial, plans on `billing_account` covering N workspaces; Stripe billing via Better Auth's Stripe plugin; usage limits; admin console; Google login; outbound webhooks. **Extension contract built here** (Appendix A) with its first consumer, **payment links** on invoices (gateway chosen in that spec; see Open question 7) using `PaymentGateway` + webhook → `payment.received` event.

**Part 2 — Projects / Gantt**: project from approved proposal; timeline phases → Gantt bars; drag to reschedule; milestones linked to payment schedule and invoices; change orders and sign-off attach to the project. *(The other draft proposes cutting the Gantt editor: milestone tracker + read-only timeline + one-way `projects-sync` extension. Open question 3.)*

**Part 4 — Self-host product** (only with 3 prepaid buyers): same image; prod compose with Caddy; Ed25519-signed license file verified offline, carrying **extension entitlements**; private registry gated by support subscription; backup/restore + upgrade scripts; buyer setup guide (DNS/DMARC, restore drill). *Re-confirm the buyer segment before building.*

**Later extensions**: `einvoice-my` (manual / middleware / intermediary modes; triggered by a customer above the exemption threshold or a threshold change), `einvoice-sg`, `accounting-*`. **Later features**: NDA template (same engine, no redesign), bilingual PDFs, `/api/v1` + Expo app. **After Gate A, only if own use needs them**: customer credit balance and statement of account, as derived views over documents and payments.

## Decided points

- Jurisdiction: Malaysia templates; `{{governing_law}}` for SG. Lawyer reviews once.
- Link expiry: 30 days; agreement links extendable.
- **Resend:** approved by Charlie on 2026-09-29, given directly in the Andy spec session ("ok with resend"); Bob recommended it as reviewer in R2–R4. Sent links are locked to the sent version; a change needs Resend (new version + new link, old link revoked).
- Payment-schedule invoices as drafts.
- Google login: Part 3; passkeys in Phase 9.
- Node 24 LTS (Charlie, 2026-09-29).
- E-invoice: stub only; extension when needed.
- UI direction: decide before Phase 3; prototype the block editor before Phase 6.
- **Charlie's scope picks (relayed 2026-09-30; confirmed when he approves v4.5):** extensions deferred to Part 3; hosting laptop → Singapore VPS + Cloudflare → DigitalOcean; Part 1 agreements = Service Agreement, MSA, SOW, change order, sign-off, NDA deferred (revised by Charlie 2026-09-30, reversing the earlier 3-type pick), agreement pattern per customer; Gates A–D and the business section merged; Phase 5 adds recurring invoices and refunds, credit balance and statements deferred to after Gate A; `crm_purge` rule; content-addressed DuitNow QR; WhatsApp after Resend; no RLS on Better Auth tables with `workspace_settings` under RLS.

## Verify with professionals before Phase 4 goes live

- **Accountant**: confirm the studio is exempt under the current threshold (RM3M, Guideline v4.8) and that **none of the §1.6.10 exceptions** apply: (a) non-individual shareholders, (b) a qualifying holding company, (c) related companies or joint ventures at or above the threshold. Also confirm whether the RM10,000 single-transaction rule applies to exempt taxpayers, and whether the studio is liable to register for SST (this sets the studio's own onboarding answer; book this week). Also the statutory retention period for issued documents (~7 years).
- **Lawyer**: OTP + typed name + certificate page satisfies Electronic Commerce Act 2006 reliability for agreements; review starter templates (Service Agreement, MSA, SOW, change order, sign-off).
- **SST**: current service-tax rates and exempt line types (defaults only; model supports per-line rates).
- **PDPA**: retention statement, purge path and offboarding wording.

## Next steps after approval

1. Bob reviews v4.5 (merged sections, roles incl. `crm_worker`, `workspace_settings`, purge rule, MSA + SOW design, spike decisions); Charlie approves.
2. ~~Run Spike 1 and Spike 2~~ — done, both passed 2026-09-29. Charlie confirms host/provider.
3. Patch the Phase 0 plan (Task 7 `prepare: false` default, Task 9 direct migrator connection and pg-boss install there, pooled vs direct URLs, spike rows, done-when) and update `init_andy.md` and `CLAUDE.md` to v4.5 (five roles, `set_config` + `nullif`, `billing_account`, extensions in Part 3, transactional enqueue).
4. Invoke `superpowers:writing-plans` for the Phase 1 plan, only after steps 1–2.

## Verification (for the build)

- Vitest: money (incl. the worked mixed-rate example, the cross-exponent FX fixtures, allocation tie-breaks, qty precision rejection, percentage-only line discounts, tax-off workspaces, `fx_rate` default from last used pair), numbering (workspace tz, concurrency), status transitions, sent-version rules, recurring schedule periods, refund caps, template substitution, event payload versioning, CSV row validation.
- Anonymous access: `resolve_share_link()` grants, one-document scope, tampered IDs, revoked / expired / superseded links, cross-workspace attempts.
- Concurrency: approve-vs-Resend race (with the simplified one-agreement approval transaction), double approval, sign-vs-revoke; two concurrent approvals for one `msa_sow` customer create exactly one MSA (unique partial index + `ON CONFLICT DO NOTHING`); MSA-link job vs SOW signing; `document_artifact` insert-once under retried `pdf.render` jobs (no UPDATE on version or signature rows); recurring invoice idempotency per period.
- Agreements: SOW signature refused until its parent MSA is signed; MSA then SOW signed in one OTP session; change order and sign-off reference the SOW or the Service Agreement per customer pattern.
- Testcontainers Postgres: RLS isolation on every tenant table (read/write) with rows seeded in other workspaces, policy lint (no `current_setting` cast without `nullif`), no-RLS allow-list test, `set_config` + `nullif` bare-query test on a reused connection, `withWorkspace` lint rule, transactional approval + event + job atomicity (rollback leaves no job), `crm_app` denied `SELECT` on job payloads, idempotency replay, pg-boss retry and dead-letter, `crm_purge` limited to never-invoiced versions and their artifacts, DuitNow QR files never deleted on replacement.
- Adapter contract tests: SMTP vs Resend, S3 vs MinIO.
- Playwright: full 13-step flow incl. OTP, Share to WhatsApp link (and after Resend), Download ▾ (mouse, tap, keyboard), mobile viewport for client pages, certificate page, bank-details and DuitNow step-up, onboarding invoice-in-5-minutes (Phase 4) and quote-in-5-minutes (Phase 5), dashboard totals, pipeline board, CSV import.
- Run via `pnpm dev` and `docker compose up`; PDFs and emails (Mailpit) verified in both.
- CI: typecheck, lint + boundaries, tests, `pnpm audit`, secret scan, Trivy on the built image.

## Appendix A — Extension contract (design kept; built in Part 3, not Part 1)

Carried over from v4.4 unchanged in substance. Nothing here is built in Part 1; Part 1 only keeps domain events and the e-invoice stub columns so the seam stays cheap.

Purpose: country- or customer-specific behaviour (e-invoicing, payment links, accounting sync) without touching core, and without a plugin framework. Something is an extension only if it passes all three tests: it talks to an external system; it is country- or customer-specific; some workspaces must be unable to use it. Otherwise it is core, optionally behind a per-workspace setting. Recording payments, receipts and refunds is core; collecting money (checkout, webhooks) is an extension (Stripe Connect on SaaS, restricted key on self-host, if Stripe is chosen).

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

### Data

- **`workspace_extension`** (tenant table, RLS): name, enabled, settings_enc (AES-GCM), settings_version, enabled_by, enabled_at. Unique (workspace_id, name).

### Dispatch (in the worker)

1. Domain event jobs arrive as in Part 1 ("Domain events and jobs").
2. Core handlers run first (e.g. `invoice.issued` → decide `einvoice_status` → enqueue `pdf.render` or wait).
3. Fan-out: read `workspace_extension` for the event's workspace; for each enabled extension with a handler for this event, enqueue `ext.<name>.<event>` with the payload (IDs only). Each runs as its own job with retries, backoff and dead-letter.
4. Failures never block core. Dead-lettered extension jobs surface in the extension's `invoicePanel` slot with a "retry" action.

### Registry and enablement (in `apps/web`)

- `src/extensions/registry.ts`: static object of imported manifests. Compile-time only; every extension ships in the image.
- Settings → Extensions: lists `registry` filtered by `availableFor(workspace)` and by entitlements (`DEPLOYMENT_MODE` / license in Part 4). Enabling is a step-up action (owner). Settings form generated from `settingsSchema`; stored encrypted in `workspace_extension`.
- UI slots: `settings` (extension settings page) and `invoicePanel` (badge/panel on the invoice view). Resolved by name with dynamic import. No other slots initially.

### Rules

- No extension-to-extension imports or calls; coordination only via events.
- No extension code in request handlers; only jobs, `provides.*` factories called by core, and the two UI slots.
- No runtime loading, sandboxing or third-party plugins until a paying buyer asks.
- Adding an extension = new package + one registry line + release. Self-host buyers receive it via image update; entitlement decides whether they may enable it.

### Security

- Settings encrypted (AES-256-GCM, `APP_ENCRYPTION_KEY`, versioned for rotation). Decrypted only inside the worker for the job's workspace.
- Extension jobs run under `withWorkspace` for their event's workspace; `ctx` exposes no cross-workspace capability.
- Enabling an extension is a step-up owner action and audited. Entitlement check on enable and on each job.
- Webhook routes for payment extensions: signature verification, replay protection, mapped to events, never direct writes.

### Part 3 deliverable

Contract types, `ctx` implementation, per-workspace fan-out dispatcher, `workspace_extension` table + encryption, the two UI slots, the Settings → Extensions page, and the first real extension (payment links). Test: a fixture extension in `packages/extensions/_fixture` proves enable/disable, availability by country, settings encryption round-trip and key rotation, event fan-out per workspace, isolation via `ctx`, retry and dead-letter, UI slot rendering.

### Planned extensions

Payment links (`payments-stripe` / `payments-billplz` / `payments-curlec`; Part 3, first), `einvoice-my` (MyInvois; manual, middleware and intermediary modes), `einvoice-sg` (InvoiceNow/Peppol), `accounting-xero`, `accounting-quickbooks`, `accounting-bukku`.
