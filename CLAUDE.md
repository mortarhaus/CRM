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
- Phase 0 PR 1 (Tasks 1-5, tooling) merged on 2026-09-30 (`97cfaab`).
- The Phase 0 plan (`docs/superpowers/plans/2026-09-29-phase-0-foundation.md`) is patched for v4.5; v4.6 and v4.7 change no Phase 0 task (the spec's Phase 0 row is unchanged). Next: Phase 0 PR 2 (Tasks 6-10), then PRs 3-4. The Phase 1 plan is written only after the Phase 1 gates in the spec are met ("Next steps after approval" → Current gates (b), incl. Charlie's VPS provider choice).

## Commands

Node 24.21.0 (`.nvmrc`) and pnpm 11.6.0. Node is managed per folder with fnm. In a non-interactive shell (agents), run
`eval "$(fnm env --use-on-cd --shell zsh)"` first, and check `node --version` prints `v24.21.0`.

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Typecheck | `pnpm typecheck` |
| Lint (incl. boundaries) | `pnpm lint` |
| Unit tests | `pnpm test` · one file: `pnpm vitest run <path>` |
| E2E, `db:migrate`, Docker compose | Added in Phase 0 PRs 2-4 (recorded here by Task 17) |

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
