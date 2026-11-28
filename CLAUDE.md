# CRM — Project Root

Charlie's CRM for selling and getting paid (quotes, invoices, proposals, agreements) for small and
medium creative agencies. Dogfooded by Charlie's studio. Sold as hosted SaaS and as a self-host product.

- **Source of truth:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, spec **v4.7** (revision 13; latest version in its Status line).
- **Builder role (Andy):** `agents/roles/builder.md`. **Reviewer role (Bob):** `agents/roles/reviewer.md`. Commands and ground rules: `agents/START.md`. Project facts: `agents/PROJECT.md`.
- **Repo root = this folder.** Monorepo: `apps/web`, `packages/core`. `packages/extensions/*` is created in the SaaS part (Part 3, spec Appendix A), not in Part 1.
- **UI work:** follow `FRONTEND_STANDARDS.md` (semantic HTML, WCAG 2.2, Tailwind + shadcn, `cn()`/`cva()`, semantic tokens).
- **Handoff:** `.agent/handoff.md` (gitignored) holds in-flight task state.

## Status

- Spec v4.7 (revision 13, bank audit keeps the last 4 characters; Admins may view bank details and the QR) approved by Charlie on 2026-11-28 (merged as PR #81, `826f70d`; revisions 10-12 were reviewed, never approved). It builds on revision 9 (MY default date format `dd-mmm-yyyy`, approved 2026-11-20, PR #66, `b926fd6`) and revision 8 (Phase 1 plan alignment, approved 2026-10-22, PR #36, `36b5592`) and revision 7 (the five Phase 1 plan gates, approved 2026-10-20, PR #31, `7f7178a`) and revision 6 (hosting wording only, approved 2026-10-16, PR #29, `cc3afd7`) and revision 4, approved by Charlie on 2026-10-11 (reviewed blob merged at `9b95910`, PR #18; approval recorded by the PR #19 merge `98f8675`), and supersedes v4.6 (approved 2026-10-09) and v4.5 (approved 2026-09-30 at `8989d59`, PR #2). Both Phase 1 spikes passed on 2026-09-29.
- Phase 0 PRs 1-3 merged: PR 1 (Tasks 1-5, tooling) on 2026-09-30 (`97cfaab`), PR 2 (Tasks 6-10, env, DB, Better Auth) as PR #22 on 2026-10-13 (`ce4bbf2`), PR 3 (Tasks 11-14, health, auth UI, 2FA, workspaces) as PR #26 on 2026-10-15 (`074018f`). PR 4 (Tasks 15-17: worker stub, Docker image, CI image job) as PR #27 on 2026-10-15 (`b90dc48`). Phase 0 is complete.
- The Phase 0 plan (`docs/superpowers/plans/2026-09-29-phase-0-foundation.md`) is patched for v4.5; v4.6 and v4.7 change no Phase 0 task. The Phase 1 plan (`docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md`, tenancy, five roles, RLS, pg-boss + transactional events) is merged (PR #33, `999b9c4`). All eight Phase 1 plan PRs are merged: PR 1 (database roles) #39, PR 2 (RLS, `withWorkspace()`) #41, PR 3 (system module) #43, PR 4 (`audit_log`, `action()`, `auth_audit_log`) #44, PR 5 (pg-boss, `crm_worker` grants measured) #45, PR 6 (`domain_event`, pooler gate) #46, PR 7 (rate limits, auth surface) #48, PR 8 (headers, email, Phase 1 close) #49 (`516c6ec`). Phase 1 is complete.
- The Phase 2 plan (`docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md`, settings, branding, numbering, catalog, email templates) is merged (PR #52, `592eab6`). All Phase 2 plan PRs are merged: PR 1 #53, PR 2 #54 and #55, PR 3 #56 and #57, PR 4 #62, PR 5 #68, #70 and #71, PR 6 #72, PR 7 #74, PR 8 #75 and #76 (`0b7a04c`), with #59, #60 and #73 (country defaults, date format, short code), and the two follow-ups approved before the close: workspace binding #77 (`6926c5d`) and catalog refusal echo #78 (`ffa616e`), both 2026-11-26. Phase 2 closed with PR #79 (`8c75b01`, 2026-11-26; `docs/DECISIONS.md` 2026-11-26 "Phase 2 close"). Phase 2 is complete. The CI browser tests run as one job per screen size (PR #80, `b0dbc52`, 2026-11-27). The bank settings Admin-view and QR revalidation change (spec revision 13) merged as PR #83 (`83cea46`, 2026-11-28). The Phase 3 plan (`docs/superpowers/plans/2026-11-28-phase-3-customers-team.md`, customers and team) is a draft in review; no Phase 3 code is written.

## Commands

Node 24.21.0 (`.nvmrc`) and pnpm 11.6.0. Node is managed per folder with fnm. In a non-interactive shell (agents), run
`eval "$(fnm env --use-on-cd --shell zsh)"` first, and check `node --version` prints `v24.21.0`.
The single `.env` lives at the repo root (copy `.env.example`; `AUTH_SECRET` via `openssl rand -base64 32`).

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Typecheck | `pnpm typecheck` |
| Lint (incl. boundaries) | `pnpm lint` |
| Unit + integration tests (Docker running) | `pnpm test` · one file: `pnpm vitest run <path>` |
| Gate tests (pg-boss through PgBouncer, 60 s+; Docker running; in CI) | `pnpm test:gates` |
| Production build (Next + worker/migrate bundles) | `pnpm build` |
| E2E vs dev server (starts `pnpm dev` and `pnpm worker:dev`) | `pnpm test:e2e`. Without `E2E_BASE_URL` it needs Mailpit on `127.0.0.1:1025` (SMTP) and `127.0.0.1:8025` (API; `MAILPIT_URL` overrides the API address only) and `DATABASE_WORKER_URL` in the root `.env` |
| E2E vs the image | `pnpm stack:up` then `E2E_BASE_URL=http://localhost:3000 E2E_RATE_LIMITED=1 pnpm test:e2e` |
| Auth route smoke check (`pnpm dev`, root `.env` only) | `pnpm smoke:auth-route` |
| Dev Postgres only | `docker compose -f docker/compose.dev.yml up -d --wait postgres` |
| Create or repair the five DB roles (once per cluster, before migrations; needs the `DATABASE_ADMIN_URL` and `CRM_*_PASSWORD` lines of `.env`) | `pnpm db:bootstrap` |
| Apply migrations (host) | `pnpm db:migrate` |
| Redrive a failed job from its dead-letter queue (needs `DATABASE_WORKER_URL`) | `pnpm --filter @crm/web jobs:retry -- --queue <queue> --id <dead-letter job id>` |
| New migration after schema change | `pnpm db:generate --name <change>` |
| Regenerate Better Auth schema | `pnpm --filter @crm/web auth:generate` then `pnpm db:generate --name <change>` |
| Dev server / worker | `pnpm dev` · `pnpm worker:dev` |
| Full stack (migrations → web + worker) | `pnpm stack:up` (= `docker compose -f docker/compose.dev.yml up --build -d --wait`) · stop: `pnpm stack:down` |

## Model routing (pick per task)

| Task | Model |
|---|---|
| Default: design, security, RLS, money, auth, extensions, review gates | Opus 5.5 |
| Mechanical edits, copy, small UI tweaks, status checks | Sonnet 5 |
| Only with Charlie's explicit OK (state the reason vs Opus) | Fable 5.1 |

<!-- agent-kit:start -->
# Agent setup

This project uses the agent kit in `agents/`.

At the start of every session, read `agents/START.md` and follow it: it defines the commands
(setup, spec, build, review, review spec, fix, approved, merged, handoff, status), the trust boundary, and what
to do when my message isn't a command.

All project facts are in `agents/PROJECT.md`. Don't restate or change project rules in this file.
<!-- agent-kit:end -->
