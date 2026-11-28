# Phase 3 — Customers and Team Implementation Plan

> This plan is task data. Implementation follows `agents/START.md`, `agents/roles/builder.md` and the owner's instructions.
>
> **Status: DRAFT for Bob's plan review (2026-11-28).** Charlie approved starting this plan on 2026-11-28 (`docs/DECISIONS.md` 2026-11-28, "Phase 3 plan started"). No question in §7 is answered. Drafted by an Opus 5.5 sub-agent for the builder (Sonnet 5.5), who checked a sample of the spec, code, decision and Better Auth references and corrected three points (the bank settings work already merged in PR #83, CI job times, the composite-key line numbers).

- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 (revision 13). Phase 3 row at line 1157. Dependencies at lines 466, 476–485, 698, 725, 749, 789–808, 819–827, 863, 887–913, 1018, 1034, 1275, 1300.
- **Milestone:** Phase 3, target "late Nov" (spec line 1157). It cannot be met (nothing is built on 2026-11-28); Charlie sets the new one.
- **Target LOC:** 400 per PR (`agents/PROJECT.md` §4). Generated migration SQL counted but called out in each PR body.
- **Base:** `main` = `83cea46`. Migrations end at `apps/web/drizzle/0038_rls_email_template.sql`, so Phase 3 starts at **0039**.
- **Model:** Opus 5.5 deep tier for every PR (RLS, auth, roles and the purge grants run through all of them; `PROJECT.md` §6). Sonnet 5 may take copy-only fixes.

**Goal (spec line 1157):** "Customer (incl. TIN/BRN/SST) + contact CRUD, search, archive rules, CSV import, invitations."

**Done when (spec line 1157, verbatim):** "CRUD E2E; CSV import rejects invalid rows with a preview and commits valid ones atomically; invited admin sees permission matrix enforced; each `crm_purge` SELECT grant added by this phase's migrations has its real-role two-workspace isolation test passing (allowed A, denied B, no context returns 0 rows; revision 7 proposal, TEN-08)."

Plus, placed in this phase by the owner: the `require_2fa` switch, Owner only, with step-up (DECISIONS 2026-11-26 "Phase 2 close", answer "1 yes, 2 yes"; source rule 2026-11-22 PR 5b).

---

## 0. Gates and needed spec revisions (read first)

Nothing below is approved. Each gate names the PR it blocks.

- **G1. `crm_purge` column list for `customer` and `contact` is undefined (blocks PR 1).** Spec line 905–906 grants SELECT on "`id`, `workspace_id` and the redacted columns", and line 887 says only "personal fields replaced". No list exists, so the TEN-08 grant "exactly as the design target lists them" cannot be written. Needs a spec revision (Q1).
- **G2. Spec says the invitation stores a "token hash" (line 476); Better Auth stores none (blocks PR 6).** Better Auth 1.7.14 uses the invitation `id` (a v4 UUID, stored plain) as the credential (`crud-invites.mjs:248`, body `invitationId`), and `apps/web/src/db/schema/auth.ts:150-172` has no token column. Either the spec changes or the app adds its own hashed token (Q8). Spec revision needed whichever way.
- **G3. Matrix ambiguity on invitations (blocks PR 5 and PR 6).** Line 807 "Manage staff members" is Admin and Owner; line 808 "Manage admins, roles, invitations" is Owner only. Can an Admin invite a Staff member? Change a Staff member to Admin? The spec cannot be implemented exactly (AUTH-03) until this is read one way (Q6). Spec wording fix needed.
- **G4. Invitation email is the first email to someone outside the workspace (blocks PR 6).** DECISIONS 2026-11-01 (line 696): "a delivery ledger keyed by job id is required before any customer-facing email kind." An invitee is not a customer, but is not the signed-in user either. Owner decides whether the ledger is built first (Q9).
- **G5. The Phase 3 target date cannot be met (no PR blocked).** Charlie sets a new target.
- **Label only, not a gate:** spec "Current gates" (line ~1200) still calls revision 13 draft; `PROJECT.md` §11 says the next spec PR fixes the label. The G1–G3 spec PR is that PR.
- `builder.md` §8: stop and ask before the first PR of the milestone (PR 1).

---

## 1. Facts verified (file:line read by the drafter)

| Fact | Source |
|---|---|
| Better Auth version is 1.7.14; read from the npm tarball whose integrity matches the pnpm store index (`sha512-QxDCI0…R9vw==`). `crud-invites.mjs` lines 85, 101, 125, 152, 228, 248 and 272 re-checked by the builder in the installed package | `pnpm-lock.yaml`; `apps/web/package.json:28` |
| Organization plugin is configured with `invitationExpiresIn` and hooks only: no `roles`, `ac`, `creatorRole`, `sendInvitationEmail` | `apps/web/src/lib/auth/config.ts:90-108` |
| IDs are UUIDs (`generateId: "uuid"`); sign-up does not auto sign in; no email verification | `config.ts:44`, `config.ts:77` |
| Any path not in the enabled list answers 404 before Better Auth runs; organization paths enabled: create, update, set-active, list | `lib/auth/enabled-paths.ts:7-26`, `config.ts:109` |
| Default roles: `admin` may update org, create/cancel invitations, create/update/delete members; `member` has nothing; `owner` all | `dist/plugins/organization/access/statement.mjs:24-71` |
| `invite-member` takes the workspace from `body.organizationId` before the session's | `routes/crud-invites.mjs:85` |
| Only a holder of `creatorRole` (default `owner`) may invite with that role; nothing stops an admin inviting an admin | `crud-invites.mjs:101,125` |
| Invitation email sent through `runInBackgroundOrAwait(sendInvitationEmail…)` | `crud-invites.mjs:152,228` |
| Accept: refused if missing, expired, not pending, or the session email differs; status moves `pending`→`accepted` with a `fromStatus` guard, member created in a transaction, rolled back to pending on failure | `crud-invites.mjs:248-353`, `adapter.mjs:797-813` |
| Email verification on accept is required only when ids are not UUIDs or the option is set; here it is not required | `crud-invites.mjs:272` (`shouldRequireVerifiedEmailForInvitationIdAction`) |
| `get-invitation` needs a session and the matching email | `crud-invites.mjs:463-527` |
| `remove-member` and `update-member-role` take `body.organizationId`; the only role guard is on the `owner` role (last owner kept); an admin may remove or demote another admin | `routes/crud-members.mjs:139-235, 236-370` |
| `remove-member` clears the active workspace only for the caller's own session | `crud-members.mjs:223` |
| Default expiry when unset is 172800 s; ours is 30 min | `adapter.mjs:734`; `packages/core/src/security/limits.ts:1` |
| `member.role` defaults to `"member"`, which `getMembership` treats as no membership | `db/schema/auth.ts:141`; `db/system/workspaces.ts:8-35`; DECISIONS 2026-10-25 line 933 |
| `crm_app` grants: `member` SELECT, INSERT (no UPDATE, no DELETE); `invitation` SELECT, INSERT, UPDATE(`expires_at`, `status`) | `apps/web/src/db/privileges.ts:72-74` |
| `crm_purge` holds only INSERT on `audit_log` | `privileges.ts:148-149` |
| `require_2fa` column exists, default false, already in crm_app's UPDATE column list | `db/schema/tenancy.ts:53`; `privileges.ts:14,42,81` |
| `requireWorkspaceMember` reads `member` on every request, so a removed or demoted user loses access on the next request | `lib/auth/action.ts:85-99` |
| `action()` order: session → rendered workspace → role → Zod → `beforeTransaction` → idempotency → handler; `echo` only for non-personal values | `action.ts:170-199` |
| `recordAudit(tx, {…, piiFields})` redacts listed fields | `lib/audit.ts:6-39` |
| Queues: `domain_event`, `email.send`, `email.bank_details_changed`, two cleanups; each from a migration | `jobs/handlers.ts:10-16` |
| `staff` today exists only through the test helper `setMemberRole` (direct SQL as migrator) | `apps/web/src/test/member-role.ts` |
| Playwright projects: `chromium`, `tablet-768`, `mobile-320` | `apps/web/playwright.config.ts:18-20` |
| Structured address columns already exist on `workspace_settings` (line1, line2, city, postcode, …) | `db/schema/tenancy.ts:28-32` |

---

## 2. Settled items (each with its source)

| Item | Source |
|---|---|
| `customer` fields: name, structured address, currency default, TIN, BRN, SST no., `po_required`, `agreement_pattern`, `archived_at`; `contact`: customer_id, name, email, phone, role, is_primary | spec lines 483–484 |
| `agreement_pattern` set from `workspace_settings.default_agreement_pattern` on creation, editable | spec lines 483, 1018 |
| A customer that has issued documents cannot be deleted (archive only) | spec line 483; REC-04 |
| Pattern-change refusal while an unfrozen SOW exists: no SOW table until Phase 7, so Phase 3 has nothing to refuse; the check lands with agreements | spec line 1034 (Open question 10 resolved) |
| CSV import: upload → Zod per row → preview with errors → commit in one transaction; duplicates by customer name and contact email | spec line 485 |
| CSV import is Admin and Owner; customers and contacts Staff and up | spec lines 801–802 |
| Invitation and reset links single-use, 30 minutes | spec line 793; `limits.ts:1` |
| Invitations and member management enabled with their feature; every other path stays disabled | spec line 791 |
| System-module two-workspace authorization tests on `organization`, `member`, `invitation` | spec lines 827, 1275 |
| Every FK between tenant tables composite on `(workspace_id, id)` | spec lines 470, 828; `PROJECT.md` §9 |
| Each migration that creates a design-target table adds its `crm_purge` SELECT grant and `FOR SELECT TO crm_purge` policy plus a real-role isolation test | spec lines 892–913; `PROJECT.md` §9 |
| `customer.created` is in the Part 1 event set | spec line 698 |
| Forms work without JavaScript; a refused post echoes no personal text | DECISIONS 2026-11-26 (catalog refusal echo, PR #78) |
| Every `action()` is workspace-bound; `entry-points.test.ts` requires a row per `"use server"` export | DECISIONS 2026-11-25 |
| List UI is a plain HTML table, archive via `?show=archived`, no TanStack Table | DECISIONS 2026-11-24 (Phase 2 PR 7) |
| Audit entries hold no free text that may be personal data | DECISIONS 2026-11-25 (PR 8a) |
| Design direction (Kinlo look, top-bar search); search box hidden "until Phase 3" | DECISIONS 2026-11-04; Phase 2 plan Q7 |
| `require_2fa`: only the Owner may switch it on, with step-up | DECISIONS 2026-11-22 (PR 5b), 2026-11-26 |
| Admin/Owner without 2FA in a `require_2fa` workspace gets `TWO_FACTOR_REQUIRED`; settings pages send them to `/settings/security` | DECISIONS 2026-11-20 |
| Fixed security values live in `packages/core/src/security/limits.ts` | UNI-02; `limits.ts` |

---

## 3. PR checkpoints

| PR | Tasks | Scope | Migrations | Stop-and-ask |
|---|---|---|---|---|
| 1 | 1–4 | `customer`, `contact` schema, RLS, `crm_purge` SELECT grants, data layer | 0039 tables, 0040 RLS, 0041 purge grants | G1/Q1 before; milestone start |
| 2 | 5–7 | Customer list, create, edit, archive, search, audit, `customer.created` | none (0042 only if Q4 = delete) | Q2–Q5 |
| 3 | 8–9 | Contacts on the customer page, one primary contact | none | Q10 |
| 4 | 10–12 | CSV import: parse, validate, preview, atomic commit | none | Q11–Q14 |
| 5 | 13–15 | Team page: members, role change, removal, last-owner rule | 0042 `member` grants | G3/Q6, Q7 |
| 6a | 16–18 | Invitations: create, list, cancel, resend; email queue | 0043 invitation token, 0044 `email.invitation` queue | G2/Q8, G4/Q9, Q15 |
| 6b | 19–20 | Accept page, sign-up from an invitation, acceptance | none | Q16 |
| 7 | 21–23 | `require_2fa` switch, Phase 3 close | none | Q17; Phase 3 gate |

Migration numbers move up by one per earlier PR that adds one (PR 2 if Q4 = delete).

---

## 4. Tasks

### PR 1: customer and contact tables (≈390 LOC excl. generated SQL)

**Guardrails:** TEN-02, TEN-04 to TEN-11, UNI-02, UNI-03, UNI-15, REC-04.
**Bob looks first at:** the composite FKs, the `crm_purge` column list against Q1's answer, the catalog test that the grants equal the manifest.

- **Task 1. Schema.** Files: `apps/web/src/db/schema/customers.ts` (new), `drizzle/0039_customer_contact.sql`.
  - [ ] `customer` with `workspace_id` not null, FK to `organization`, unique `(workspace_id, id)`, `version` (for `STALE_VERSION`), the spec fields, `archived_at`, timestamps. Field rules from Q2.
  - [ ] `contact` with composite FK `(workspace_id, customer_id)` → `customer (workspace_id, id)`; partial unique index `(workspace_id, customer_id) where is_primary` (Q10).
  - [ ] `agreement_pattern` check constraint `in ('service_agreement','msa_sow')`; not null.
  - [ ] Text length limits as constants in `limits.ts` (Q2 gives values).
- **Task 2. RLS.** `drizzle/0040_rls_customer_contact.sql`.
  - [ ] ENABLE + FORCE; RESTRICTIVE `<table>_workspace` `TO crm_app, crm_purge`; PERMISSIVE SELECT, INSERT, UPDATE for `crm_app`; DELETE only if Q4 = delete (then in PR 2).
  - [ ] Add both tables to `privileges.ts` and to `isolation.test.ts` `TENANT_FIXTURES`.
- **Task 3. `crm_purge` grants.** `drizzle/0041_purge_customer_contact.sql`.
  - [ ] SELECT on exactly the columns Q1 settles; PERMISSIVE `FOR SELECT TO crm_purge` with the workspace predicate only (spec line 913). No UPDATE (Phase 9).
  - [ ] `privileges.ts` `crm_purge` entries; the manifest test checks `column_privileges` equality.
- **Task 4. Data layer.** `apps/web/src/db/customers/{customers,contacts}.ts`, `packages/core/src/customers/schema.ts`.
  - [ ] Zod input schemas in core (shared by the forms and CSV rows).
  - [ ] Create reads `default_agreement_pattern` inside the same `withWorkspace` transaction.

**Tests:** `isolation.test.ts` (A reads/writes A, cannot read or write B, no context 0 rows) for both tables as `crm_app`; new `purge-grants.test.ts` connecting as the real `crm_purge` login (allowed A, denied B, no context 0 rows, any non-listed column refused with `42501`); composite FK test (a contact naming B's customer fails `23503`); `rls.test.ts` allow-list unchanged.
**Done when:** migrations apply on a fresh and an upgraded DB; all four tests pass; `pnpm lint` (TEN-10) clean.

### PR 2: customers UI (≈400 LOC)

**Guardrails:** AUTH-01, AUTH-02, AUTH-03, TEN-11, UNI-02, UNI-05, UNI-09, UNI-10, EVT-01, REC-04, FE-01 to FE-14, FE-31, FE-32, A11Y-01 to A11Y-06.
**Bob looks first at:** the audit `piiFields` list, the search query (no `ilike` built from unescaped `%`/`_`), the no-JS refusal echo.

- **Task 5. Actions.** `apps/web/src/app/(app)/customers/actions.ts`.
  - [ ] `customer.create`, `customer.update` (version check → `STALE_VERSION`), `customer.archive`, `customer.unarchive`; `minRole: "staff"`; idempotent create.
  - [ ] Audit `customer.created|updated|archived|unarchived` with `piiFields` from Q3; no free text.
  - [ ] `emitEvent(tx, "customer.created", { customerId })` if Q5 = emit.
  - [ ] Delete (only if Q4 = allow): refused once any issued document references the customer; Phase 3 has none, so the check is a stub that Phase 4 fills. Recommend archive only (Q4).
- **Task 6. Pages.** `customers/page.tsx` (table, `?show=archived`, `?q=` search), `customers/new`, `customers/[id]`.
  - [ ] Nav link in `components/shell/nav-links.tsx`; top-bar search box shown (Q3 scope).
  - [ ] Address uses the Phase 2 structured address fields and country list.
  - [ ] Currency default select from the same list as workspace settings (MYR, SGD today; DECISIONS 2026-11-26 Q6 "widen later").
  - [ ] Onboarding checklist "first customer" item links here (spec line 749).
- **Task 7. Entry points.** `entry-points.test.ts` rows for each new export.

**Tests:** `actions.test.ts` (Staff allowed; no session `UNAUTHENTICATED`; wrong rendered workspace `WORKSPACE_CHANGED`; ID of B's customer → `NOT_FOUND`; two parallel updates with the same version → one `STALE_VERSION`); `e2e/customers.spec.ts` on all three projects: create, edit, archive, show archived, search, no-JS create, axe light and dark, no horizontal overflow at 320 px.
**Done when:** CRUD E2E passes on `chromium`, `tablet-768`, `mobile-320`.

### PR 3: contacts (≈330 LOC)

**Guardrails:** as PR 2, plus TEN-08 (write through the composite FK).

- **Task 8. Actions.** `contact.create|update|remove|setPrimary` (remove is a hard delete of the contact unless Q10 says archive; contacts are never on an issued document in Phase 3. Recommend archive to match REC-04 later; Q10).
  - [ ] `setPrimary` clears the old primary and sets the new in one transaction, locking the customer row `FOR UPDATE`.
  - [ ] Contact email lower-cased and checked against `EMAIL_ADDRESS_MAX_LENGTH`.
- **Task 9. UI.** Contacts section on `customers/[id]` (list, add, edit, make primary).

**Tests:** concurrency: two parallel `setPrimary` calls leave exactly one primary; contact under B's customer refused; E2E add/edit/primary on three projects; axe.
**Done when:** the customer page covers contacts and the concurrency test passes.

### PR 4: CSV import (≈400 LOC; split parser into its own PR if over)

**Guardrails:** UNI-03, UNI-06 (parser choice), UNI-02, FILE-02, AUTH-01, AUTH-03, TEN-09, EVT-01, A11Y-03, FE-32.
**Bob looks first at:** atomicity, the size and row limits, CSV formula-injection handling, the dependency ladder entry if a parser is added.

- **Task 10. Parser and row schema.** `packages/core/src/customers/csv.ts`.
  - [ ] RFC 4180 parse; UTF-8 only (BOM stripped); header names from Q11; size and row limits from Q12 in `limits.ts`, checked server-side before parsing.
  - [ ] Each row through the core Zod schema from Task 4; errors as `{row, field, code}` with no cell values.
  - [ ] Duplicates: within the file and against the workspace, by customer name (case-folded) and contact email (Q13).
- **Task 11. Preview.** `customers/import/page.tsx` + action `customer.importPreview` (`minRole: "admin"`).
  - [ ] File not stored (Q14). The preview is recomputed on commit from a re-upload or from a short-lived server copy (Q14), never trusted from the client.
  - [ ] Table of rows with errors; values rendered escaped; cells starting `= + - @` shown as text.
- **Task 12. Commit.** `customer.importCommit`: re-validates every row, then inserts all valid rows in one `withWorkspace` transaction; any insert error rolls back all; audit one `customer.imported` entry with counts only; `customer.created` per row if Q5 = emit.

**Tests:** Vitest "CSV row validation" (spec Verification): quoted commas, newlines in quotes, BOM, wrong header, oversize, too many rows, duplicate name, duplicate email, bad TIN; integration: one failing insert rolls back the whole batch; Staff → `FORBIDDEN`; rows land only in workspace A; Playwright "CSV import": upload a file with 2 valid, 1 invalid row → preview shows the error → commit → 2 customers; three projects.
**Done when:** the CSV done-when line holds and the tests pass.

### PR 5: team members (≈380 LOC)

**Guardrails:** AUTH-01, AUTH-03, AUTH-12, TEN-10, TEN-11, UNI-10, A11Y-01 to A11Y-06.
**Bob looks first at:** that no Better Auth member endpoint is enabled (Q7 recommendation), the last-owner rule under concurrency, Admin acting on an Admin.

- **Task 13. System module.** `apps/web/src/db/system/members.ts`: `listMembers(workspaceId)`, `changeRole`, `removeMember`, each taking the workspace from the caller's `ActionContext`, never input.
  - [ ] `drizzle/0042_member_grants.sql`: `crm_app` UPDATE(`role`) and DELETE on `member`; manifest updated.
  - [ ] Last-owner rule: lock the workspace's owner rows `FOR UPDATE`, refuse if the change leaves zero owners.
- **Task 14. Actions.** `settings/team/actions.ts`: `member.changeRole`, `member.remove`; who may act on whom from Q6.
  - [ ] Audit `member.role_changed`, `member.removed` (user ids, roles; no email).
  - [ ] Role change or removal of oneself: Q7.
- **Task 15. Page.** `settings/team/page.tsx`: members (name, email, role), actions per row as Q6 allows.

**Tests:** system-module two-workspace tests (spec line 1275): list, change role and remove refused for a member id from B and for a stale session whose active workspace is B; two parallel demotions of the last two owners → exactly one refused; removed user's next action → `FORBIDDEN`; Admin on Admin per Q6; Better Auth `/organization/update-member-role`, `/remove-member`, `/leave` still 404; E2E three projects.
**Done when:** the matrix rows 807–808 are enforced for member changes, as Q6 reads them.

### PR 6a: invitations, send side (≈400 LOC)

**Guardrails:** AUTH-01, AUTH-03, AUTH-06, AUTH-08, TEN-10, TEN-11, UNI-02, UNI-09, EVT-01, EVT-03, EVT-05, FILE-05, FILE-06.
**Bob looks first at:** token generation and hashing, that the job payload holds only the invitation id, the rate limit.

- **Task 16. Token and storage.** `drizzle/0043_invitation_token.sql` (Q8 option B): `token_hash bytea unique` on `invitation` via Better Auth `additionalFields` or a plain column read only by the system module; `crm_app` grant; `db/system/invitations.ts`: `createInvitation`, `listInvitations`, `cancelInvitation`, `resendInvitation` (new token, new expiry, old token dead).
  - [ ] 32 random bytes, base64url in the link, SHA-256 stored (same as `share_link`, spec line 840).
  - [ ] Refuse: invitee already a member; a pending invite exists (resend instead); role not allowed for the inviter (Q6); pending cap (Q15).
- **Task 17. Actions and page.** `settings/team` "Invite" form (email, role) and pending list with cancel and resend.
  - [ ] Rate limit per workspace and per user (Q15) with `consumeUnit` on the limiter pool, like the test email.
  - [ ] Audit `invitation.created|cancelled|resent` (invitation id, role; email as `[pii]`).
- **Task 18. Email.** `drizzle/0044_email_invitation_queue.sql` (queue + dead-letter); `jobs/invitation-email.ts` loads the invitation by id. A token cannot be rebuilt from its hash and may not ride in the payload (IDs only), so the job generates the token, stores its hash and sends; the action only creates the row (Risk R3). Template wording from Q16; single-pass substitution.

**Tests:** the job payload has no token or email; two-workspace: cancel or resend of B's invitation refused; Staff invite refused; Admin inviting Admin per Q6; 11th invite in the window `RATE_LIMITED` (value per Q15); Mailpit E2E receives one email with a link; Better Auth `/organization/invite-member`, `/cancel-invitation`, `/list-invitations` still 404.
**Done when:** an Owner can invite, resend and cancel; the email arrives.

### PR 6b: accepting an invitation (≈350 LOC)

**Guardrails:** AUTH-05, AUTH-07, AUTH-08, AUTH-12, TEN-11, UNI-09, UNI-16, UNI-19, FE-32, A11Y-03.

- **Task 19. Accept route.** `app/(auth)/invite/[token]/page.tsx` + server action outside `action()` (no workspace yet; an `entry-points.test.ts` exempt row with reason).
  - [ ] Hash the token, load by hash; refuse with one neutral message if missing, expired, cancelled or used (AUTH-05).
  - [ ] Signed in with the invited email (case-insensitive): mark `accepted` with `where status = 'pending'` and create the member with the invited role in one system transaction; set the active workspace.
  - [ ] Not signed in: offer sign-in or sign-up with the email prefilled; after sign-up the user signs in and returns to the link (Q16 covers the 30-minute window).
  - [ ] Signed in with another email: neutral refusal, no hint of the invited address.
- **Task 20. Tests.** Two parallel accepts → one member; a token for workspace B never adds to A; expired after 30 min (clock moved in test) refused; used token refused; E2E: invited Admin signs up, accepts, then sees the matrix enforced (CSV import allowed; bank details edit and team role change refused per Q6) on three projects.

**Done when:** "invited admin sees permission matrix enforced" passes.

### PR 7: `require_2fa` switch and Phase 3 close (≈250 LOC)

**Guardrails:** AUTH-03, AUTH-09, UNI-10, A11Y-03.

- **Task 21. Switch.** On `settings/security` (Q17): `workspace.setRequire2fa` with `minRole: "owner"`, step-up (`requireStepUp`), audit `workspace.require_2fa_changed`. Turning it off: Q17.
  - [ ] The page lists Admins and Owners without 2FA before the Owner confirms.
- **Task 22. Tests.** Admin refused; Owner without step-up `STEP_UP_REQUIRED`; after switching on, an Admin without 2FA gets `TWO_FACTOR_REQUIRED` and lands on `/settings/security`; E2E three projects.
- **Task 23. Close.** Done-when map (§5) evidenced; DECISIONS "Phase 3 close"; CLAUDE.md Status; Build Progress artifact (memory note).

---

**Every PR that changes auth, roles or a queue (5, 6a, 6b, 7)** updates its runbook in the same PR (UNI-16).

---

## 5. Done-when and verification map

| Done-when item | PR | Test |
|---|---|---|
| CRUD E2E (customers) | 2 | `e2e/customers.spec.ts` × 3 projects |
| CRUD E2E (contacts) | 3 | `e2e/customers.spec.ts` contacts block × 3 |
| CSV rejects invalid rows with a preview | 4 | `csv.test.ts`; `e2e/customer-import.spec.ts` |
| CSV commits valid rows atomically | 4 | `import.test.ts` rollback case; E2E count |
| Invited admin sees the matrix enforced | 5, 6a, 6b | `e2e/invitations.spec.ts` invited-Admin case |
| `crm_purge` grants: allowed A, denied B, no context 0 | 1 | `purge-grants.test.ts` (real role) |
| System-module two-workspace tests (spec 1275) | 5, 6a, 6b | `members.test.ts`, `invitations.test.ts` |
| Search (deliverable) | 2 | `e2e/customers.spec.ts` search case |
| Archive rules (deliverable) | 2 | `actions.test.ts` archive; E2E show archived |
| `require_2fa` switch (owner placement) | 7 | `security/actions.test.ts`; E2E |

---

## 6. Guardrail rule table (rule · PR · applies? · reason for n-a)

| Rule | PR | Applies | Note |
|---|---|---|---|
| TEN-02, TEN-04–TEN-07 | 1 | yes | new tenant tables |
| TEN-08 | 1, 3, 5, 6 | yes | read and write, incl. Better Auth paths and the real `crm_purge` role |
| TEN-09, TEN-11 | all | yes | workspace from session only; the accept route uses the token, never a body workspace |
| TEN-10 | 1, 5, 6 | yes | `member`/`invitation` only via `db/system` |
| TEN-12 | — | n-a | no bypass helper |
| AUTH-01–AUTH-03 | 2–7 | yes | accept route is the one exempt entry point, with a reason row |
| AUTH-04 | — | n-a | sign-up from an invitation uses the existing password hashing; no change |
| AUTH-05 | 6b | yes | neutral refusals |
| AUTH-06 | 6a | yes | DB counters |
| AUTH-07 | — | n-a | no password, 2FA or email change here |
| AUTH-08 | 6a, 6b | yes | single use, 30 min |
| AUTH-09 | 7 | yes | require_2fa switch |
| AUTH-10 | — | n-a | no OAuth (`PROJECT.md` §8) |
| AUTH-11, AUTH-13 | — | n-a | no middleware or sign-out change |
| AUTH-12 | 5, 6b | yes | role read per request; test after demotion |
| FILE-01 | 4 | n-a for magic bytes | CSV is text; replaced by a UTF-8 + size + header check (recorded as a FILE-01 exception, Q14) |
| FILE-02 | 4 | yes | size limit server-side |
| FILE-03, FILE-04 | 4 | n-a if not stored | Q14 |
| FILE-05, FILE-06 | 6a | yes | invitation email template |
| EVT-01, EVT-03, EVT-05 | 2, 4, 6a | yes | event and job in the same transaction; DLQ |
| UNI-16 | 5, 6a, 6b, 7 | yes | each updates its runbook in the same PR (`docs/runbooks/phase-1-security.md`; the new queue and its redrive in 6a) |
| UNI-19 | 6b | yes | the accept page is new signed-out surface: listed in the runbook and `entry-points.test.ts`; Better Auth member and invitation paths stay 404 (Q7) |
| EVT-04, EVT-07–EVT-12 | — | n-a | `PROJECT.md` §8 |
| REC-04 | 2, 3 | yes | archive; delete only per Q4 |
| REC-02, REC-03, REC-05–REC-12 | — | n-a | no finalized records in Phase 3 |
| MON-*, PAY-*, LINK-* | — | n-a | no money, payments or public links (currency default is a code, not an amount) |
| UNI-02, UNI-03, UNI-05, UNI-06, UNI-09, UNI-10, UNI-15 | all | yes | limits in `limits.ts`; parser ladder; no PII in logs |
| FE-01–FE-14, FE-20–FE-23, FE-31, FE-32, A11Y-01–A11Y-06 | 2–7 | yes | three Playwright projects, axe light and dark |

---

## 7. Questions for Charlie

Each has options, a recommendation and the reason. None is answered.

1. **Q1 (G1). Which customer and contact columns does the purge redact?** A: every personal field: customer name, address lines, TIN, BRN, SST no.; contact name, email, phone, role. B: grant only the key columns now and list the redacted ones in the Phase 9 spec revision. **Recommend A**, written into the spec now: the Phase 3 migration must match the design target exactly, and a later change would need a second grant migration. Business name and tax numbers of a company may not be personal data, but a sole trader's are.
2. **Q2. Customer fields.** Which are required (recommend: name only)? `po_required` default (recommend false)? TIN/BRN/SST format checks (recommend length and character set only, no country rules, because the formats change)? Length limits (recommend name 200, others 50, address lines reuse `ADDRESS_LINE_MAX_LENGTH`)? Recommend these because the spec gives no values and loose checks avoid refusing real data.
3. **Q3. Search: which fields and where?** A: customer name, contact name, contact email, on the customers page and the top-bar box. B: customer name only. **Recommend A**: that is what a user types; the top-bar box was hidden "until Phase 3". Audit `piiFields`: recommend all customer and contact personal fields from Q1.
4. **Q4. May a customer with no issued documents be deleted?** A: archive only (as the catalog). B: allow delete until the first issued document. **Recommend A**: Phase 3 cannot see issued documents yet, so a delete rule would be rewritten in Phase 4, and archive keeps references safe (REC-04).
5. **Q5. Emit `customer.created` now?** A: yes, with no handler (the event row only). B: wait for the first consumer. **Recommend A**: the spec lists it in the Part 1 set and emitting it later would miss early customers; the row is small. Bob may call it dead code (UNI-05); if so, B.
6. **Q6 (G3). Who manages whom?** A: Owner invites any role and changes any role; Admin invites and removes Staff only, cannot change roles. B: Owner only for everything about members. **Recommend A**: it reads lines 807 ("Manage staff members": Admin) and 808 ("roles, invitations": Owner) together, with "invitations" meaning admin invitations. Needs a spec wording fix either way.
7. **Q7. Better Auth endpoints or our own actions for member and invitation management?** A: our own actions through `action()` and the system module; Better Auth member and invitation paths stay 404. B: enable Better Auth paths and restrict with custom roles and hooks. **Recommend A**: the Better Auth paths take the workspace from the request body (`crud-invites.mjs:85`, `crud-members.mjs` same), let an Admin act on Admins, and bypass `action()`'s binding, idempotency and audit. Spec line 791 allows either. Also: may a member leave a workspace, and may the Owner demote themselves when another Owner exists? Recommend leave allowed except for the last Owner; self-demotion allowed under the same rule.
8. **Q8 (G2). Invitation credential.** A: spec changes to accept Better Auth's plain UUID id. B: own 32-byte token, SHA-256 stored, like `share_link`. **Recommend B**: it matches the spec text, and a stored plain id is a usable credential to anyone who reads the table or a log.
9. **Q9 (G4). Delivery ledger before the invitation email?** A: build the ledger first (a small table keyed by job id, checked before send). B: send through the pg-boss job alone; a retry may send a duplicate. **Recommend A** if the owner reads "customer-facing" as "anyone outside the workspace"; a duplicate invitation is harmless, but the ledger will be needed in Phase 4 anyway. Adds about 150 LOC to PR 6a (or its own PR).
10. **Q10. Contacts.** Exactly one primary per customer, or at most one (recommend at most one, set on the first contact)? Role: free text or a list (recommend free text, ≤ 50; no list in the spec)? Remove: delete or archive (recommend archive, so later documents can keep pointing at it)?
11. **Q11. CSV format.** One file with one row per contact, customer fields repeated (recommend), or two files? Header names: English, fixed (recommend; a template file to download)? May the file set TIN, BRN, SST, `po_required` and `agreement_pattern` (recommend yes for the first three, workspace default for the pattern)?
12. **Q12. CSV limits.** Recommend 1 MB and 2,000 rows: enough for a small agency's client list and small enough to preview in one page. Values are the owner's.
13. **Q13. Duplicates.** A: a row matching an existing customer name or contact email is an error in the preview and is not imported. B: merge into the existing customer. **Recommend A**: merging edits existing data from a file and needs its own rules.
14. **Q14. CSV upload handling.** Not stored; the commit re-parses the same file posted again (recommend; no storage, FILE-03/04 n-a), or stored for 15 minutes in tenant storage. Record the FILE-01 exception (no magic bytes for text) in DECISIONS.
15. **Q15. Invitation limits.** Recommend 20 pending per workspace and 10 sends per user per hour, in `limits.ts`. Spec has no invitation rate row (Better Auth default 100/60 s/IP applies only to `/api/auth/*`).
16. **Q16. Accept flow and email wording.** The 30-minute expiry includes sign-up and sign-in time: keep 30 minutes (recommend; it is the spec value) and offer resend. Sign-up from an invitation does not verify the email beyond holding the link: accept that (recommend; the link was sent to that address). Email subject and body: builder drafts, Charlie approves.
17. **Q17. `require_2fa` switch.** On the Security settings page (recommend; enrolment is there). Turning it off: Owner with step-up too (recommend; same risk the other way). Members without 2FA are refused on their next action, with no grace period (recommend; that is today's enforcement).
18. **Q18. Phase 3 target date.** "Late Nov" cannot be met. Charlie sets a new one.
19. **Q19. Currency default list.** Same list as workspace settings (MYR, SGD) until the multi-currency work (recommend; DECISIONS 2026-11-26 Q6 "widen later").

---

## 8. Gates and stop-and-ask points

- Before PR 1: milestone stop (`builder.md` §8); G1 answered and the spec PR (G1–G3, plus the revision 13 label) approved.
- Before PR 5: Q6, Q7. Before PR 6a: Q8, Q9, Q15, Q16.
- Any PR over 400 LOC: split at the task line shown and ask.
- Any finding that a Better Auth path other than those listed is reachable: stop.
- Phase 3 gate: §5 all green on three Playwright projects in CI; Charlie confirms close.

---

## 9. Risks (Bob reviews these first)

- **R1. Better Auth paths reachable by mistake.** Enabling any organization member or invitation path brings body `organizationId` and default roles. Mitigation: Q7 A; a test that every listed path answers 404.
- **R2. Last-owner race.** Two Owners demote each other at once. Mitigation: lock owner rows `FOR UPDATE`; concurrency test.
- **R3. Token in a job payload.** IDs only (`PROJECT.md` §9). The job must generate and hash the token itself; a retry after a send makes a new token, so an earlier email's link stops working. Acceptable if Q9 = A (ledger stops a second send).
- **R4. CSV size and formula injection.** Limits before parse; cells escaped and shown as text; no export of imported data in Phase 3.
- **R5. Stale active workspace after removal.** A removed user's session still names the workspace; `requireWorkspaceMember` refuses (`action.ts:91-92`); pages must redirect, not error. Test it.
- **R6. Search leaking across workspaces.** Search runs inside `withWorkspace`; the isolation test covers it.
- **R7. Spec Playwright project names.** Spec line 1300 names `chromium` and `mobile-chrome` (Pixel 5); the repo runs `chromium`, `tablet-768`, `mobile-320`. Phase 3 uses the repo's three; the spec PR should record that.

---

## 10. Facts the drafter could not verify

- Whether Better Auth `additionalFields` on `invitation` survive `auth:generate` without other schema churn (Q8 B); not tried.
- `has-permission.mjs` and `organization.mjs` option handling were not read line by line; the plan avoids them under Q7 A.
- The `isolation.test.ts` fixture shape and the existing `crm_purge` test helper (only `bootstrap.test.ts` connects as `crm_purge` today) were not read in full.
- LOC estimates are from the Phase 2 PR sizes, not measured.
- Whether a CSV parser dependency is needed (UNI-06) or a small RFC 4180 parser in core is enough; not measured.
- Whether CI time holds with the new E2E specs: since PR #80 each screen size runs as its own job (limit 40 minutes, `ci.yml`), and each took about 22 to 24 minutes on PR #83.

---

## 11. Self-check (plan level)

- [x] Every done-when item maps to a PR and a test (§5).
- [x] Gates and needed spec revisions at the top (§0: G1–G3 need the spec PR).
- [x] No owner choice invented: every value is in §7 with a recommendation.
- [x] No owner approval claimed beyond repository records; the start approval is the builder's instruction, to be recorded.
- [x] Library behaviour cited with file:line and version (Better Auth 1.7.14).
- [x] Each PR ≤ 400 LOC estimate, with split points.
- [x] Two-workspace, concurrency and three-screen browser tests named per PR.
- [ ] Bob: confirm G1–G4 are gates and not plan choices.
