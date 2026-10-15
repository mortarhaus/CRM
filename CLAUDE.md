# CRM — Project Root

Charlie's CRM for selling and getting paid (quotes, invoices, proposals, agreements) for small and
medium creative agencies. Dogfooded by Charlie's studio. Sold as hosted SaaS and as a self-host product.

- **Source of truth:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, spec **v4.7** (revision 4; latest version in its Status line).
- **Builder role (Andy):** `agents/roles/builder.md`. **Reviewer role (Bob):** `agents/roles/reviewer.md`. Commands and ground rules: `agents/START.md`. Project facts: `agents/PROJECT.md`.
- **Repo root = this folder.** Monorepo: `apps/web`, `packages/core`. `packages/extensions/*` is created in the SaaS part (Part 3, spec Appendix A), not in Part 1.
- **UI work:** follow `FRONTEND_STANDARDS.md` (semantic HTML, WCAG 2.2, Tailwind + shadcn, `cn()`/`cva()`, semantic tokens).
- **Handoff:** `.agent/handoff.md` (gitignored) holds in-flight task state.

## Status

- Spec v4.7 (revision 4) approved by Charlie on 2026-10-11 (reviewed blob merged at `9b95910`, PR #18; approval recorded by the PR #19 merge `98f8675`). It supersedes v4.6 (approved 2026-10-09) and v4.5 (approved 2026-09-30 at `8989d59`, PR #2). Both Phase 1 spikes passed on 2026-09-29.
- Phase 0 PRs 1-3 merged: PR 1 (Tasks 1-5, tooling) on 2026-09-30 (`97cfaab`), PR 2 (Tasks 6-10, env, DB, Better Auth) as PR #22 on 2026-10-13 (`ce4bbf2`), PR 3 (Tasks 11-14, health, auth UI, 2FA, workspaces) as PR #26 on 2026-10-15 (`074018f`). PR 4 (Tasks 15-17: worker stub, Docker image, CI image job) is on `feat/p0-runtime`; Phase 0 is complete once it merges.
- The Phase 0 plan (`docs/superpowers/plans/2026-09-29-phase-0-foundation.md`) is patched for v4.5; v4.6 and v4.7 change no Phase 0 task. Next after Phase 0: the Phase 1 plan (tenancy, five roles, RLS, pg-boss + transactional events), written only after the Phase 1 gates in the spec are met ("Next steps after approval" → Current gates (b), incl. Charlie's VPS provider choice).

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
| Production build (Next + worker/migrate bundles) | `pnpm build` |
| E2E vs dev server (starts `pnpm dev`) | `pnpm test:e2e` |
| E2E vs the image | `pnpm stack:up` then `E2E_BASE_URL=http://localhost:3000 E2E_RATE_LIMITED=1 pnpm test:e2e` |
| Auth route smoke check (`pnpm dev`, root `.env` only) | `pnpm smoke:auth-route` |
| Dev Postgres only | `docker compose -f docker/compose.dev.yml up -d --wait postgres` |
| Apply migrations (host) | `pnpm db:migrate` |
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
