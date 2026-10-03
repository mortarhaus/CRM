# PROJECT.md — the only file you fill in per project

- **Kit version used:** 1.7.1 <!-- from agents/README.md; tells you which master changes this project hasn't picked up -->

Every project fact lives here and nowhere else. The role files (`roles/`) and the
guardrail packs (`guardrails/`) never change between projects; they read this file.

`setup` fills this file with you. Every double-braced field must end up resolved: a real value,
`none` for an optional field, or `pending scaffold` for a command that doesn't exist yet. A completed
setup leaves no double braces anywhere in this file.

---

## 1. Identity

- **Project name:** CRM (Part 1 "Core Sales")
- **What it is (one sentence):** A CRM for selling and getting paid ("quote-to-cash for agencies": quotes, proposals, agreements, invoices, receipts, credit notes, refunds), dogfooded by Charlie's studio and sold as hosted SaaS and as a self-host product.
- **Target users / segment:** Small and medium creative/dev agencies, roughly 5–15 people, annual turnover under RM3 million; Malaysia first, Singapore second, other countries only where nothing country-specific is required. Not an accounting system, no e-invoice integration in Part 1, no enterprise features (spec "Target segment"). <!-- reviewer uses this to catch scope creep -->
- **Markets / currencies / locales:** Malaysia (MYR) first, Singapore (SGD) second. Multi-currency per document (currency exponent table; USD/SGD billing is common), one base currency per workspace. Timezone, locale and date format per workspace (MY default `Asia/Kuala_Lumpur`, dd/mm/yyyy; SG `Asia/Singapore`). Bilingual PDFs are a later feature.
- **Owner (final approver, merges PRs):** Charlie
- **Builder role name:** Andy <!-- the agent that writes code; follows roles/builder.md -->
- **Reviewer role name:** Bob <!-- the agent that reviews; follows roles/reviewer.md -->

## 2. Sources of truth

| What | Path | Wins over |
|---|---|---|
| Product spec / proposal (latest) | `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.5, approved by Charlie 2026-09-30) | everything except the owner |
| Spec hash at last reconcile | `27b43efceb97a4f2724e0c6f07ba8882db87efc5` <!-- git hash-object of the spec when setup last filled this file --> | |
| Decisions log (committed) | `docs/DECISIONS.md` (default `docs/DECISIONS.md`) | handoff, chat history |
| Durable notes (other lasting facts) | Claude Code auto-memory for this project (`MEMORY.md` index under `~/.claude/projects/`, outside the repo) <!-- e.g. tool memory folder, or docs/NOTES.md --> | handoff, chat history |
| Review files | `.agent/reviews/` (reviewer writes, builder reads; local only — the final round is copied into each PR log) | |
| In-flight task state (handoff) | `.agent/handoff.md` (default `.agent/handoff.md`) | nothing — repo wins for code state |
| Extra frontend standard (on top of `guardrails/frontend.md`) | `FRONTEND_STANDARDS.md` <!-- or "none" --> | |
| Other standards | The active per-phase plan in `docs/superpowers/plans/` (exact version pins, global constraints for that phase) | |
| Notes the reviewer must always load | none | |
| Extra in-flight files (checklists, cutover plans) | none. The old `.andy/` folder is superseded by `.agent/handoff.md`; it stays on disk, git-ignored, only as the archive of Bob's R6–R13 reviews. | |

**Conflict rule:** repo state wins for *what the code is*. Handoff wins for *what we were doing*.
Spec wins for *what we should build*. If two of these disagree, stop and ask Charlie.

## 3. Paths and layout

- **Project root:** `/Users/charlie/Documents/Projects/Personal/CRM`
- **Repo root:** same as project root <!-- same as project root, or a subfolder like app/ -->
- **Code must live under:** `apps/`, `packages/`, `docker/`, `templates/agreements/` (spec "Planned structure")
- **Layout:**
  - `apps/web` — Next.js app (App Router): UI, client link pages, `api/health`, DB schema + migrations + RLS + `withWorkspace()` + system module, adapters, pg-boss job handlers, PDF and email templates, `action()` wrapper, worker entry (`worker.ts`)
  - `packages/core` — pure business rules, interfaces and events (money, numbering, documents, agreements, signatures, events); imports no framework, DB, auth or extension code
  - `packages/extensions/*` — **not in Part 1**; created in Part 3 with the extension contract (spec Appendix A)
  - `docker/` — Dockerfile, entrypoint, `compose.dev.yml` (and `compose.prod.yml`, completed in Part 4)
  - `templates/agreements/` — Malaysia starter templates (Service Agreement, MSA, SOW, change order, sign-off)
- **Specs:** `docs/superpowers/specs`/YYYY-MM-DD-<topic>-design.md <!-- default: docs/specs -->
- **Per-PR plans:** `docs/superpowers/plans`/YYYY-MM-DD-<topic>.md
- **Per-PR logs:** one file per merged PR, `<log folder>/YYYY-MM-DD_PR<N>_<slug>.md`, committed on
  the **log branch** — never on the default branch or a feature branch. The owner may merge the log
  branch into the default branch whenever they like; agents never do.
  - Log branch: `agent-logs` <!-- default: agent-logs -->
  - Log folder: `log` <!-- default: log -->
  - Review archive folder (same branch): `reviews` <!-- default: reviews -->
  - Log tracking starts at: `df24b195787a431022b965e985b86aa00805f52c` (`origin/main`), 2026-10-03. PRs #1, #2 and #3 merged before this point. PR #1 is covered by the legacy log `log/2026-09-30_PR1_tooling.md` (committed on `main` before the kit; to be copied to the log branch later); #2 and #3 (docs only) predate tracking. <!-- default-branch SHA + date when setup ran; earlier PRs are covered by migrated legacy logs or not at all -->
- **Runbooks:** `docs/runbooks/` (created during Phase 0)

## 4. Repository

- **Remote:** https://github.com/charliekhc/CRM (private) <!-- `pending remote` is a valid value until the owner creates the repository; the builder asks for it before the first PR -->
- **Default branch:** `main` <!-- usually main -->
- **Merge policy:** Bob approves → Charlie merges. The builder never merges. The reviewer never merges.
- **Commit trailer:** `Co-Authored-By: Claude <model> <noreply@anthropic.com>` — `<model>` is the name of the model that actually did the work (e.g. `Claude Opus 5.5`, `Claude Sonnet 5`), never fixed text copied from a plan. <!-- e.g. "Co-Authored-By: <agent> <model> <email>", or "none" -->
- **PR size target:** 400 LOC (default 400)

## 5. Milestones

- **Unit name:** Phase <!-- "Phase", "Stage", "Sprint" -->
- **Milestone list lives in:** spec "Build phases for Part 1" (Phases 0–9, then the own-use period); release gates A–D in spec "Business and sequencing"; per-phase plans in `docs/superpowers/plans/`
- **Scaffold milestone:** Phase 0 (Foundation), delivered as four PRs per `docs/superpowers/plans/2026-09-29-phase-0-foundation.md` ("PR checkpoints"). PR 1 (`feat/p0-tooling`: monorepo, toolchain, lint boundaries, CI) merged 2026-09-30 as `97cfaab`, so the repo layout, git setup and toolchain are already settled and are never re-proposed; PRs 2–4 complete the milestone and fill in §7. <!-- after this merges, never re-scaffold, re-init git, or redo its paperwork -->

## 6. Model tiers

Role files talk in tiers, never in model names. Map them here.

| Tier | Use for | Model(s) this project uses |
|---|---|---|
| deep | spec design, architecture, security, auth, data isolation, money, milestone gates, implementation plans | Opus 5.5 |
| standard | normal feature work, most reviews | Opus 5.5 (the project's default model) |
| fast | mechanical edits, copy, status checks | Sonnet 5 |

- **Needs owner confirmation before use (cost):** Fable 5.1 — the agent must name why the cheaper deep option isn't enough.

## 7. Commands

Leave a command out if the project doesn't have it yet; the scaffold milestone fills them in.

Agent shells first run `eval "$(fnm env --use-on-cd --shell zsh)"; fnm use 24.21.0` and check that
`node --version` prints `v24.21.0` (Node via fnm, `.nvmrc`; pnpm 11.6.0). Never change the global Node.

```bash
# install
pnpm install
# fast checks (run before every push)
pnpm typecheck
pnpm lint
pnpm test
# database: start, migrate, run isolation tests
docker compose -f docker/compose.dev.yml up -d --wait postgres   # named by the Phase 0 plan; works from Phase 0 PR 2 (Task 7)
pnpm db:migrate                                                   # named by the Phase 0 plan; works from Phase 0 PR 2 (Task 9)
pending scaffold                                                  # isolation tests arrive in Phase 1 and run under `pnpm test` (Docker running); no separate command yet
# end-to-end
pnpm test:e2e                                                     # named by the Phase 0 plan; works from Phase 0 PR 3 (Task 12)
```

**Secret-scan pattern** (base pattern + this project's key prefixes):
```bash
rg -n "SECRET|TOKEN|PASSWORD|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|sk_live|re_[A-Za-z0-9]{10,}|APP_ENCRYPTION_KEY=" .
```

## 8. Active guardrail packs

Tick what applies. Unticked packs are ignored by both roles.
Every rule has an ID (`TEN-09`, `FE-05`). Self-checks and findings cite IDs. Rules marked **(hard)**
are never downgraded below P1.

- [x] `guardrails/universal.md` — always on, do not untick
- [x] `guardrails/frontend.md` — any UI (semantics, layout, components, WCAG 2.2 AA)
- [x] `guardrails/tenancy-rls.md` — multi-tenant data isolation
- [x] `guardrails/money.md` — any stored or computed money
- [x] `guardrails/finalized-records.md` — issued/signed/legal documents, sequential numbering
- [x] `guardrails/auth.md` — login, sessions, roles, OAuth
- [x] `guardrails/public-links.md` — unauthenticated share links, OTP, signatures
- [x] `guardrails/files-templates.md` — uploads, generated PDFs, user templates
- [x] `guardrails/events-jobs.md` — background jobs, queues, domain events
- [x] `guardrails/payments.md` — payment providers, checkout, webhooks

Why each pack is ticked:
- **universal:** always on.
- **frontend:** authenticated app UI and mobile-first client link pages (Tailwind + shadcn/ui, `FRONTEND_STANDARDS.md`).
- **tenancy-rls:** PostgreSQL RLS on every tenant table, one workspace per tenant, five DB roles (spec "Tenancy").
- **money:** `bigint` minor units, multi-currency, tax, discounts, FX, refunds (spec "Money rules").
- **finalized-records:** issued invoices, credit notes, receipts, sent quote/proposal versions and signed agreements are immutable with frozen snapshots and gapless numbering (spec "Immutability rules", "Numbering").
- **auth:** Better Auth email + password, TOTP 2FA, roles and permission matrix, step-up (spec "Authentication and sessions", "Authorization"). AUTH-10 (OAuth) is n-a until Google login in Part 3.
- **public-links:** anonymous client links, email OTP, typed-name signatures and certificate page (spec "Anonymous access", "Client links and signatures").
- **files-templates:** uploads (PO files, logo, DuitNow QR, CSV import) on S3-compatible storage with signed URLs; PDFs rendered in the worker; agreement and email templates with single-pass field-placeholder substitution (FILE-05).
- **events-jobs:** pg-boss worker, domain events, cron schedules. Events and their jobs are enqueued transactionally (`boss.send(…, { db: fromDrizzle(tx, sql), id })`), which EVT-01 allows; EVT-02 is n-a (no relay). EVT-04 and EVT-07…EVT-12 (extensions) are n-a until Part 3.
- **payments:** Part 1 records payments, receipts and manual refunds (no gateway); PAY-01 (audited, server-side writes to payment/financial tables) applies now. PAY-02…PAY-06 (checkout, provider interface, webhooks, stock/vouchers, checkout switches) are n-a until payment collection arrives in Part 3.

**Pack parameters** (packs refer to these by name):
- Tenant key column: `workspace_id` <!-- e.g. workspace_id, org_id -->
- Tenant session setting: `app.workspace_id` <!-- e.g. app.workspace_id -->
- Runtime DB role: `crm_app` · Migration DB role: `crm_migrator`
- Scoped transaction helper: `withWorkspace(workspaceId, tx => …)` — opens a transaction and runs `select set_config('app.workspace_id', $1, true)` (the function form of `SET LOCAL`: bound and transaction-local) <!-- e.g. withWorkspace(id, tx => …) -->
- Admin/bypass helper (if any): none — no role has `BYPASSRLS` and the spec defines no bypass helper.
- Server action wrapper: `action()` — session → active workspace (from session) → role (`requireWorkspaceMember(role)`) → Zod → idempotency → handler; `stepUp()` for step-up actions (`apps/web/src/lib/auth/`)
- Where configurable business values live: `workspace_settings` (one row per workspace, under RLS: tax, currency, timezone/locale, bank details, email settings, auto-send, agreement pattern default, `require_2fa`), `doc_sequence` (numbering patterns), `email_template`, reminder settings on the invoice, and country defaults (MY/SG) applied to `workspace_settings` at sign-up; plan limits on `billing_account` from Part 3 <!-- settings table, platform_config, … -->

## 9. Project-specific hard constraints

Things unique to this product. Generic rules belong in a guardrail pack, not here.

**Out of scope (reviewer rejects scope creep):**
- Accounting: ledgers, journals, chart of accounts, period close, P&L, tax reports, aging buckets beyond "overdue", stored customer balances. Accounting gets data by period export (Part 1) or a later `AccountingSync` extension. Customer credit balance and statement of account come only after Gate A, only if own use needs them, as derived views.
- E-invoice integration (MyInvois, `einvoice-my`, `einvoice-sg`) in Part 1.
- The extension system in Part 1: contract, `ctx`, `workspace_extension`, fan-out dispatcher, `packages/extensions/*`, Settings → Extensions (Part 3, spec Appendix A). No runtime plugin loading.
- Payment collection (checkout, payment links, gateway webhooks), Google login, outbound webhooks, plans and billing (Part 3); Projects / Gantt (Part 2); self-host pack and licensing (Part 4).
- NDA template (later, same engine); fixed-amount line discounts (line discounts are percentage only); enterprise features.

**Stubs only (interface, no implementation yet):**
- E-invoice: customer TIN/BRN/SST fields, `einvoice_*` fields on invoice and credit note, the PDF gate on `einvoice_status`, and the `EInvoiceProvider` interface type. Core sets `einvoice_status = not_required` at issue in Part 1.
- `payment.external_ref` and `billing_account.stripe_customer_id` (nullable, used from Part 3).

**Architecture rules:**
- `packages/core` imports no framework, DB, auth or extension code. Enforced by ESLint (`boundaries/dependencies`, `no-restricted-imports`, dynamic-import ban) and package `exports`; CI fails on violation (UNI-04).
- Extensions are deferred to Part 3. Part 1 keeps domain events and the e-invoice stub columns only. Something is an extension only if it passes the spec's three tests; recording payments, receipts and refunds is core, collecting money is an extension.
- One Docker image, two commands: `web` (`next start`) and `worker` (pg-boss consumer). Identical image for SaaS and self-host; `DEPLOYMENT_MODE=saas|selfhost`. Migrations run from the image entrypoint as `crm_migrator` over a direct connection. No cron endpoints; the worker owns schedules.
- App queries use postgres.js (`postgres`) + Drizzle with `prepare: false` (non-overridable when `DATABASE_URL` points at a pooler). `pg` is allowed only inside pg-boss (Charlie, 2026-09-30); never a provider HTTP driver. `packages/core` already bans `pg` by lint; a ban in `apps/web` outside pg-boss is not in place yet.
- PostgreSQL 17 (18 allowed; dev and tests pin 17). pg-boss 12.35.0 and drizzle-orm 0.45.3 pinned exactly; every dependency is an exact version.
- App connects through a transaction-mode pooler; migrations and any LISTEN/NOTIFY user connect direct. pg-boss is installed and upgraded by `crm_migrator` in migrations; app instances run with `migrate`/`createSchema` false; queue options (including `notify`) change only in migrations.
- Every FK between two tenant tables is composite on `(workspace_id, <key>)`; polymorphic references have a same-workspace insert trigger and immutable target columns (spec "Tenancy").
- Better Auth tables and `billing_account` have no RLS and are reached only through the allow-listed system module (lint rule, no-RLS allow-list test, two-workspace authorization tests). Workspace configuration lives in `workspace_settings` (RLS), never on `organization`.
- Multi-row locks follow exactly one of the spec's two lock chains (A: proposal chain, B: quote chain); never mix them in one transaction.
- Invoice status, `credited`, refunds, refund voids and credit-note voids follow spec "Refunds and invoice status" exactly; don't re-derive the rules.
- Job payloads carry IDs only; `domain_event` payloads carry IDs and amounts only (`pgboss` tables have no RLS).

**Database roles (five, none with `BYPASSRLS`; spec "Decisions" → Database, "Tenancy"):**
- `crm_migrator` — owns the schema (including `pgboss`), runs migrations over a direct connection, installs and upgrades pg-boss.
- `crm_app` — runtime role for all requests and job handlers' tenant work; INSERT + SELECT (never UPDATE/DELETE) on its append-only tables; enqueue-only grants on `pgboss`, cannot read job payloads.
- `crm_link_resolver` — `NOLOGIN`; owns `resolve_share_link()` only; one SELECT policy on `share_link`, no other privileges.
- `crm_purge` — PDPA customer purge only, under `withWorkspace()`, limited to the spec's purge rule.
- `crm_worker` — the worker's pg-boss instance: fetch, complete and maintenance rights on `pgboss.*` only (exact grants measured in Phase 1).

**Workspace context (complies with TEN-09):** `withWorkspace()` sets the workspace with `select set_config('app.workspace_id', $1, true)`, the function form of `SET LOCAL` (bound, transaction-local); `SET` and `SET LOCAL … = $1` are not used (the latter fails with `42601`; Spike 1). Policies read `(select nullif(current_setting('app.workspace_id', true), '')::uuid)`; `nullif` is required (policy lint/test) and RLS tests seed rows in other workspaces. The TEN-10 allow-list is exactly the spec's system module (Better Auth tables, `billing_account`, `resolve_share_link()`).

**Accepted spec exceptions to kit rules** (each has an entry in `docs/DECISIONS.md`; the spec wins on what to build):
- **TEN-06 / TEN-07** — the one non-tenant policy is `share_link_resolve` (`FOR SELECT TO crm_link_resolver USING (revoked_at IS NULL AND expires_at > clock_timestamp())`): keyed on link state, not the workspace setting, and SELECT-only so it has no `WITH CHECK`. It is the only cross-workspace read in the system; the workspace policy stays `TO crm_app`, and no other table has a policy for `crm_link_resolver`.
- **LINK-09** — the approval transaction creates exactly one agreement (a frozen Service Agreement, or an **unfrozen draft SOW**); MSA linking or creation, the SOW freeze and the pair's auto-send happen afterwards in the provisioning job under the customer lock. An unfrozen SOW cannot be sent or signed (CHECK). MSA and SOW are signed in separate transactions within one OTP session, MSA first.
- **FILE-03** — DuitNow QR images are stored content-addressed at `ws/{workspace_id}/duitnow/{sha256}.{ext}` (not a random uuid) and never deleted while the workspace exists. All other uploads use `ws/{workspace_id}/{uuid}`; rendered PDFs use `ws/{workspace_id}/pdf/{uuid}.pdf`.
- **TEN-01 / TEN-02 (Phase 0 only, owner decision 2026-10-03)** — Phase 0 uses one dev DB user for both runtime and migrations. Expires: removed before any Phase 1 data (Phase 1 creates the five roles). See `docs/DECISIONS.md`.

**Proposed, not approved — awaiting Bob's ruling** (hard rules; until Bob rules, treat each as an open question, not as an accepted exception; entries in `docs/DECISIONS.md` carry the same status):
- **TEN-02 (hard)** — besides `crm_app`, the running system uses `crm_worker` (pg-boss internals on `pgboss.*` only), `crm_purge` (purge path only) and `crm_link_resolver` (through the `SECURITY DEFINER` function only). No role is superuser or has `BYPASSRLS` (tested on `pg_roles`), and all tenant work runs as `crm_app` (or `crm_purge` for the purge) under `withWorkspace()`.
- **REC-01 (hard)** — (a) the frozen snapshot, hash, number, lines and totals of an issued record never change, but its lifecycle columns change through the spec's named transitions only: invoice status recompute (`issued` / `part-paid` / `paid` / `credited` / `overdue` / `void`), `sent_at`, `einvoice_*`, reminder state; credit note `void`; signed agreement → `superseded`; refund one-time void. (b) The PDPA purge (`crm_purge`, Phase 9, narrow scope accepted by Charlie 2026-09-30) may DELETE sent `quotation_version` / `proposal_sent_version` rows that no invoice references and that have no `version_retention` row, with their `document_artifact` rows, PDF files, share links, OTP challenges and signatures. Nothing else append-only is ever deleted.
- **AUTH-01 (hard)** — anonymous client link actions (OTP request/verify, approve, decline, sign, download) have no session or role. They re-resolve the token on every request through `resolve_share_link()`, run under `withWorkspace(<resolved workspace>)`, act only on the resolved target and version, validate input with Zod, and use idempotency keys on approve and sign.

**Open for Bob** (one line each; not decided here):
- MON-02 — DECIDED (spec v4.6 draft revision 2): the `service` default price currency and its edit rule, stored `line_item.currency` and `credit_note.currency`, the frozen `base_currency` on finalized snapshots, and the draft currency-change rule (`docs/DECISIONS.md` 2026-10-03 "Service default price carries its own currency (MON-02)" and "Stored currency on line items and credit notes, frozen base currency, and draft currency-change refusal (MON-02)"). Open question 15 (reporting when frozen base currencies differ) is now DECIDED (spec v4.6 draft revision 3; `docs/DECISIONS.md` 2026-10-03 "FX source for credit notes, payments and refunds, reporting by frozen base currency, and proposal/FX guards on currency change (MON-02, MON-05, MON-06)"). Still open: spec Open question 16 — rounding across rows of one invoice (per-row rounding, no reconciliation to the invoice base total), default pending Charlie.
- TEN-07 — the spec doesn't say the tenant policy is RESTRICTIVE; how to scope a restrictive policy so it doesn't block `share_link_resolve`.
- UNI-10 — the spec's monthly archive job for `audit_log` / `domain_event` has no role or mechanism and conflicts with append-only.
- UNI-19 / AUTH-01 — Better Auth's own `/api/auth/*` endpoints don't go through `action()`, and the spec's unauthenticated-surface list omits them (the Phase 0 plan lists them).
- UNI-02 — where country defaults (MY/SG tax, numbering, timezone) and the spec's fixed security values (link 30 d, OTP 10 min / 5, step-up 5 min, reset 30 min, sweep 24 h, export 7 d, bank notice 60 d) live.
- REC-11 — "agreements rendered again at sign" may mean a separate certificate artifact or a regeneration; the spec is ambiguous.
- UNI-04 — `pg` is lint-banned only in `packages/core`; nothing yet bans it in `apps/web` outside pg-boss.
- FE-13 — `FRONTEND_STANDARDS.md` names `tailwind.config.ts` and HSL tokens; the Phase 0 plan uses Tailwind v4 CSS-first tokens with no config file.

**Locked switches (must stay in this state until the condition is met):**
| Switch | Must stay | Until | Evidence lives in |
|---|---|---|---|
| pg-boss queue `notify` | off (polling) | a migration turns it on, with grants updated, a direct connection for LISTEN, and a restart | spec "Domain events and jobs", Known risks R7 |
| Web-side pg-boss instance `migrate`, `supervise`, `schedule`, `createSchema` | `false` | never in Part 1 | spec "Domain events and jobs" |
| `einvoice_status` set by core at issue | `not_required` | an e-invoice extension exists and is enabled (Part 3 onward) | spec "PDF timing", "E-invoice" |
| Payment collection (checkout, payment links, gateway webhooks) | off — manual payment and refund recording only | Part 3 spec chooses the gateway | spec "Extensions", Appendix A |
| `billing_account.plan` | `free` only | Part 3 | spec Data model → Accounts and workspaces |
| Selling to, or holding data of, any agency other than the studio | not allowed | Gate D met and the Sdn Bhd incorporated | spec "Business and sequencing" |

## 10. Never commit

`.agent/` (handoff, review files, worktrees), `.env*` (except `.env.example`), agent tool folders (`.claude/`, `.superpowers/`), and:
- `.andy/` (legacy pre-kit handoff and review drafts; local only, for now)

## 11. Extra approval gates

On top of the gates in `roles/builder.md`:
- Before writing the Phase 1 plan: Charlie's VPS provider choice (spec Status line, Open question 4, "Checks before the Phase 1 plan" item 3).
- Before Phase 4 goes live: the professional checks in spec "Verify with professionals before Phase 4 goes live" (accountant, lawyer, SST, PDPA), with results confirmed by Charlie.
- Any change to a spec default still marked "pending Charlie" (spec "Open questions for Charlie") needs Charlie's explicit choice; Bob's recommendation is not Charlie's approval.
