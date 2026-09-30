# CRM — Project Root

Charlie's CRM for selling and getting paid (quotes, invoices, proposals, agreements) for small and
medium creative agencies. Dogfooded by Charlie's studio. Sold as hosted SaaS and as a self-host product.

- **Source of truth:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, spec **v4.5** (latest version in its Status line).
- **Builder role:** `init_andy.md`. **Reviewer role:** `init_bob.md`.
- **Repo root = this folder.** Monorepo: `apps/web`, `packages/core`. `packages/extensions/*` is created in the SaaS part (Part 3, spec Appendix A), not in Part 1.
- **UI work:** follow `FRONTEND_STANDARDS.md` (semantic HTML, WCAG 2.2, Tailwind + shadcn, `cn()`/`cva()`, semantic tokens).
- **Handoff:** `.andy/handoff.md` (gitignored) holds in-flight task state.

## Status

- Spec v4.5 approved by Charlie on 2026-09-30 at `8989d59` (PR #2). Both Phase 1 spikes passed on 2026-09-29.
- Phase 0 PR 1 (Tasks 1-5, tooling) merged on 2026-09-30 (`97cfaab`).
- The Phase 0 plan (`docs/superpowers/plans/2026-09-29-phase-0-foundation.md`) is patched for v4.5. Next: Phase 0 PR 2 (Tasks 6-10), then PRs 3-4. The Phase 1 plan is written only after Charlie picks the VPS provider.

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
