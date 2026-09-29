# CRM — Project Root

Charlie's CRM for selling and getting paid (quotes, invoices, proposals, agreements) for small and
medium creative agencies. Dogfooded by Charlie's studio. Sold as hosted SaaS and as a self-host product.

- **Source of truth:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (latest version in its Status line).
- **Builder role:** `init_andy.md`. **Reviewer role:** `init_bob.md`.
- **Repo root = this folder.** Monorepo: `apps/web`, `packages/core`, `packages/extensions/*`.
- **UI work:** follow `FRONTEND_STANDARDS.md` (semantic HTML, WCAG 2.2, Tailwind + shadcn, `cn()`/`cva()`, semantic tokens).
- **Handoff:** `.andy/handoff.md` (gitignored) holds in-flight task state.

## Status

Phase 0 authorised. Spec v4.4 approved by Bob and Charlie (2026-09-29). Next: step-by-step build plan (`docs/superpowers/plans/`), then code after Charlie approves the plan.

## Commands

Set in Phase 0 and recorded here (typecheck, lint, test, test:e2e, db:migrate, docker compose).

## Model routing (pick per task)

| Task | Model |
|---|---|
| Default: design, security, RLS, money, auth, extensions, review gates | Opus 5.5 |
| Mechanical edits, copy, small UI tweaks, status checks | Sonnet 5 |
| Only with Charlie's explicit OK (state the reason vs Opus) | Fable 5.1 |
