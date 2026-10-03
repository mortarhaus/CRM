# Decisions log

<!-- Committed. Newest at the top. One entry per decision. A settled decision is reopened only by the owner. -->


## 2026-10-03 — Owner-approved migration: two stale lines in CLAUDE.md
- **Decision:** `CLAUDE.md` line 7 (builder and reviewer roles) and line 10 (handoff path) are edited to point at `agents/roles/builder.md`, `agents/roles/reviewer.md`, `agents/START.md`, `agents/PROJECT.md` and `.agent/handoff.md`. This is a **separate migration**, not part of setup Part A. Part A only appended the kit block; the migration edits two lines outside the block.
- **Why:** The old lines named `init_andy.md` and `init_bob.md`, which this PR deletes, and `.andy/handoff.md`, which the kit replaces. Left alone they would send agents to missing or stale rules.
- **Alternatives rejected:** Restoring the old lines (they would point at deleted files); leaving the files and the lines (stale rules conflict with the kit).
- **Scope / affects:** `CLAUDE.md` lines 7 and 10; deleted `init_andy.md`, `init_bob.md`.
- **Versions:** kit 1.7.1
- **Exception to a rule?** START.md Part A step 1 (text outside the markers stays byte-for-byte unchanged applies to setup, not to this migration). Compensating control: the edit is two lines, listed here and in the PR.
- **Decided by:** owner (Charlie, 2026-10-03: "I approve the CLAUDE.md two-line edit as a separate migration")

## 2026-10-03 — Proposed exception to AUTH-01 (hard): anonymous client link actions (PROPOSED, NOT APPROVED — awaiting Bob's ruling)
- **Decision:** Proposed, not approved — awaiting Bob's ruling. Anonymous client link actions (OTP request/verify, approve, decline, sign, download) do not go through `action()`: they have no session or role. Each request re-resolves the token through `resolve_share_link()`, runs under `withWorkspace(<resolved workspace>)`, acts only on the resolved target and version, validates input with Zod, and uses idempotency keys on approve and sign.
- **Why:** Spec v4.5 "Anonymous access (client link pages)" and "Reliability" design client links without a session. AUTH-01 (hard) requires every mutating entry point to go through the action wrapper in the order session → tenant → role → schema → idempotency → handler.
- **Alternatives rejected:** none recorded yet; Bob to rule.
- **Scope / affects:** `guardrails/auth.md` AUTH-01, `agents/PROJECT.md` §9, client link routes (Phase 7).
- **Versions:** spec v4.5
- **Exception to a rule?** AUTH-01 (hard), proposed. Compensating controls per spec: token hash lookup, per-request re-resolve, OTP before approve/sign, per-link and per-IP rate limits, Zod, idempotency keys. Review date: Bob's ruling; at the latest before the Phase 7 plan.
- **Decided by:** not decided — proposed by the builder from the spec; awaiting Bob's ruling, then Charlie

## 2026-10-03 — Proposed exception to REC-01 (hard): lifecycle columns and PDPA purge of unreferenced versions (PROPOSED, NOT APPROVED — awaiting Bob's ruling)
- **Decision:** Proposed, not approved — awaiting Bob's ruling. (a) The frozen snapshot, hash, number, lines and totals of an issued record never change; its lifecycle columns change only through the spec's named transitions: invoice status recompute (`issued` / `part-paid` / `paid` / `credited` / `overdue` / `void`), `sent_at`, `einvoice_*`, reminder state; credit note `void`; signed agreement → `superseded`; refund one-time void. (b) The PDPA purge (`crm_purge`, Phase 9) may DELETE sent `quotation_version` / `proposal_sent_version` rows that no invoice references and that have no `version_retention` row, with their `document_artifact` rows, PDF files, share links, OTP challenges and signatures.
- **Why:** Spec v4.5 "Refunds and invoice status", "Agreements: creation and signing", "Immutability rules" and "Audit, logging, privacy" → Customer purge (narrow purge scope accepted by Charlie 2026-09-30). REC-01 (hard) says an issued/signed/paid record is immutable.
- **Alternatives rejected:** none recorded yet; Bob to rule.
- **Scope / affects:** `guardrails/finalized-records.md` REC-01, `agents/PROJECT.md` §9, invoice / credit note / agreement / refund tables (Phases 4–8), purge (Phase 9).
- **Versions:** spec v4.5
- **Exception to a rule?** REC-01 (hard), proposed. Compensating controls per spec: snapshot + SHA-256 hash never change; status recomputed only inside the invoice lock; purge only under `crm_purge` with parent-row locking and retention re-check, audited; issued financial documents and agreements never purged. Review date: Bob's ruling; at the latest before the Phase 4 plan.
- **Decided by:** not decided — proposed by the builder from the spec; awaiting Bob's ruling, then Charlie

## 2026-10-03 — Proposed exception to TEN-02 (hard): runtime roles besides crm_app (PROPOSED, NOT APPROVED — awaiting Bob's ruling)
- **Decision:** Proposed, not approved — awaiting Bob's ruling. Besides `crm_app`, the running system uses `crm_worker` (the worker's pg-boss instance, rights on `pgboss.*` only), `crm_purge` (PDPA purge path only, under `withWorkspace()`) and `crm_link_resolver` (`NOLOGIN`, reached only through the `SECURITY DEFINER` function `resolve_share_link()`). All tenant work in requests and job handlers runs as `crm_app` (or `crm_purge` for the purge).
- **Why:** Spec v4.5 "Decisions" → Database and "Tenancy" define five roles. TEN-02 (hard) says `crm_app` is the only role the running app uses.
- **Alternatives rejected:** none recorded yet; Bob to rule.
- **Scope / affects:** `guardrails/tenancy-rls.md` TEN-02, `agents/PROJECT.md` §9, DB roles and grants (Phase 1).
- **Versions:** spec v4.5
- **Exception to a rule?** TEN-02 (hard), proposed. Unchanged hard part: no role is superuser or has `BYPASSRLS` (test on `pg_roles`). Review date: Bob's ruling; at the latest before the Phase 1 plan.
- **Decided by:** not decided — proposed by the builder from the spec; awaiting Bob's ruling, then Charlie

## 2026-10-03 — Phase 0 uses one dev DB user for runtime and migrations (TEN-01 / TEN-02 exception, expiring)
- **Decision:** During Phase 0 only, the app and the migration runner use one dev DB user (as in the Phase 0 plan's `.env.example` notes). **Expiry: removed before any Phase 1 data** — Phase 1 creates the five roles (`crm_migrator`, `crm_app`, `crm_link_resolver`, `crm_purge`, `crm_worker`) and splits runtime from migrations.
- **Why:** Phase 0 has no tenant tables or RLS; the spec puts the five DB roles in Phase 1.
- **Alternatives rejected:** creating the five roles in Phase 0 (pulls Phase 1 scope forward).
- **Scope / affects:** `guardrails/tenancy-rls.md` TEN-01, TEN-02; `.env.example`, `docker/compose.dev.yml`, migration runner (Phase 0 PRs 2–4).
- **Versions:** spec v4.5; plan `docs/superpowers/plans/2026-09-29-phase-0-foundation.md`
- **Exception to a rule?** TEN-01 and TEN-02 (hard). Compensating control: dev-only credentials bound to `127.0.0.1`, no real or tenant data in Phase 0. Review date: before any Phase 1 data is written (hard expiry).
- **Decided by:** owner (Charlie, 2026-10-03)

## 2026-10-03 — Spec exception to FILE-03: content-addressed DuitNow QR keys
- **Decision:** DuitNow QR images are stored at `ws/{workspace_id}/duitnow/{sha256}.{ext}` (content-addressed, not a random uuid) and never deleted while the workspace exists. All other uploads keep `ws/{workspace_id}/{uuid}`.
- **Why:** Spec v4.5 "Input, templates, files": each issued invoice's snapshot references the QR's hash key, so old invoices keep rendering after a replacement. FILE-03 asks for random-id keys.
- **Alternatives rejected:** none recorded.
- **Scope / affects:** `guardrails/files-templates.md` FILE-03, `agents/PROJECT.md` §9, storage adapter and DuitNow upload (Phase 2).
- **Versions:** spec v4.5
- **Exception to a rule?** FILE-03. Compensating control: still namespaced by workspace; no user-supplied filename in the key; owner-only step-up upload with magic-byte check. Review date: Phase 2 gate.
- **Decided by:** owner (Charlie, 2026-10-03)

## 2026-10-03 — Spec exception to LINK-09: SOW freeze and MSA provisioning run after the approval transaction
- **Decision:** The approval transaction creates exactly one agreement (a frozen Service Agreement, or an unfrozen draft SOW). MSA linking or creation, the SOW freeze and the pair's auto-send run afterwards in the provisioning job under the customer lock. MSA and SOW are signed in separate transactions within one OTP session, MSA first.
- **Why:** Spec v4.5 revisions 2–3 ("Agreements: creation and signing") moved this out of the locked approval transaction to serialise MSA provisioning with MSA signing. LINK-09 asks for one atomic approval transaction.
- **Alternatives rejected:** creating the MSA inside the approval transaction (v4.4 design, replaced in v4.5).
- **Scope / affects:** `guardrails/public-links.md` LINK-09, `agents/PROJECT.md` §9, approval and agreements (Phases 7–8).
- **Versions:** spec v4.5
- **Exception to a rule?** LINK-09. Compensating control: CHECK forbids sending or signing an unfrozen/unlinked SOW; provisioning job idempotent by event id and retried; interleaving and race tests (spec Phase 8, Verification). Review date: Phase 8 gate.
- **Decided by:** owner (Charlie, 2026-10-03)

## 2026-10-03 — Spec exception to TEN-06 / TEN-07: link-resolver policy
- **Decision:** `share_link` carries one non-tenant policy, `share_link_resolve` (`FOR SELECT TO crm_link_resolver USING (revoked_at IS NULL AND expires_at > clock_timestamp())`), keyed on link state, not `app.workspace_id`, and SELECT-only so it has no `WITH CHECK`. No other table has a policy for `crm_link_resolver`.
- **Why:** Spec v4.5 "Anonymous access (client link pages)": a link request has no session, so the workspace comes from the link through this one narrow lookup under `FORCE ROW LEVEL SECURITY`. TEN-06 asks every policy to be keyed on the tenant setting with `USING` and `WITH CHECK`; TEN-07 forbids blanket permissive policies.
- **Alternatives rejected:** an RLS bypass (`BYPASSRLS`) for the lookup (spec v4.1 rejected it).
- **Scope / affects:** `guardrails/tenancy-rls.md` TEN-06, TEN-07; `agents/PROJECT.md` §9; `resolve_share_link()` (Phase 7).
- **Versions:** spec v4.5
- **Exception to a rule?** TEN-06, TEN-07. Compensating control: `crm_link_resolver` is `NOLOGIN` with column SELECT on `share_link` only; the function returns one row by token hash; `EXECUTE` granted to `crm_app` only; tests per spec "Anonymous access". Whether this counts as a bypass under TEN-12 is open for Bob. Review date: Phase 7 gate.
- **Decided by:** owner (Charlie, 2026-10-03)
