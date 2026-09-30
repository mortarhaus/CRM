# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Patched for spec v4.5 (2026-09-30).** Phase 0 does not build RLS/roles (Phase 1); spikes passed 2026-09-29; see spec v4.5 "Checks before the Phase 1 plan". Tasks 1–5 are DONE (PR #1, merged 2026-09-30). The patch applies the v4.5 connection rules (Task 7 `prepare: false`, Task 9 direct migrator connection) and the preflight rulings for Tasks 6–13, 15.

**Goal:** Stand up the CRM monorepo so that a person can sign up, turn on TOTP 2FA, create two workspaces and switch between them, and so that `docker compose -f docker/compose.dev.yml up` runs migrations, `web` and `worker` from one image. CI must gate every PR on typecheck, lint + boundaries, tests, `pnpm audit`, secret scan and Trivy.

**Architecture:** This is a pnpm-workspaces monorepo. `packages/core` holds pure TypeScript rules and has no framework or DB imports. In Phase 0 it holds Argon2id password hashing and workspace-slug generation. `apps/web` holds the Next.js 16 App Router app, a Drizzle + `postgres` (TCP) DB client, Better Auth (email + password with an Argon2id override, the `twoFactor` plugin and the `organization` plugin), `/api/health`, and two Node entries (`migrate.ts`, `worker.ts`). esbuild bundles both entries into `dist/*.mjs`. One multi-stage Docker image runs `web` or `worker`. Its entrypoint applies migrations under a Postgres advisory lock before either command starts.

**Deliberate sequencing — read before reviewing (Charlie, Bob):** The spec's phase table puts the tenancy and security spine in **Phase 1**, and Phase 0's deliverable line does not mention it. So Phase 0 does **not** build any of the following:
- the five DB roles (`crm_migrator` / `crm_app` / `crm_link_resolver` / `crm_purge` / `crm_worker`)
- RLS, `withWorkspace()` and the `db.` lint rule
- `action()` and `requireWorkspaceMember`
- the `billing_account` table and `workspace_settings` (country, currency, tax, bank details, …)
- audit log and domain events (the extension contract moved to Part 3 in spec v4.5)
- pg-boss and Pino
- the email adapter and Mailpit, and MinIO
- nonce CSP and security headers
- DB-backed rate limits, `require_2fa` and Sentry

Instead, Phase 0 uses Better Auth's **unmodified** `organization` / `member` / `invitation` tables with **one dev Postgres user**. `DATABASE_URL` and `DATABASE_MIGRATOR_URL` both exist and are validated now, but point at the same user. Phase 1 splits them into `crm_app` and `crm_migrator` with no code-path change. Two Phase 1 changes are prepared here so they do not need a migration later: IDs are generated as Postgres `uuid` (`advanced.database.generateId: "uuid"`) so Phase 1 RLS can use `::uuid`, and all timestamps are `timestamptz`. `worker.ts` is intentionally a stub: it connects, logs readiness and stays alive. pg-boss and Pino are **not** dependencies in Phase 0. `/api/health` reports DB status only, and the queue check arrives with pg-boss in Phase 1.

**Tech Stack:** Node 24.21.0 · pnpm 11.6.0 · TypeScript 6.0.3 · Next.js 16.3.6 / React 19.3.0 · Tailwind CSS 4.3.3 (CSS-first) · Better Auth 1.7.6 (+ `auth` CLI 1.7.6) · Drizzle ORM 0.45.3 / drizzle-kit 0.31.11 · `postgres` 3.4.9 · Zod 4.6.5 · @node-rs/argon2 2.2.1 · Vitest 5.0.2 · Testcontainers 12.2.0 · Playwright 1.63.0 · ESLint 10.11.0 + typescript-eslint 8.71.0 + eslint-plugin-boundaries 7.2.0 · esbuild 0.28.2 · tsx 4.23.15 · Postgres 17 · GitHub Actions · Trivy · gitleaks.

**Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (written against v4.4; patched for v4.5, approved 2026-09-30). The Phase 0 row of "Build phases for Part 1" (v4.5):
> **Deliverable:** Monorepo (pnpm workspaces), Next.js + TS + Drizzle + Postgres + Better Auth, Docker image (`web`/`worker`), dev compose, CI (typecheck, lint + boundaries, tests, `pnpm audit`, secret scan, Trivy). Both spikes; postgres.js `prepare: false`; migrator on a direct connection
> **Done when:** Sign up, 2FA, create 2 workspaces, switch; `docker compose up` runs web + worker + migrations; spikes passed (2026-09-29)

**Facts verified on 2026-09-29 against the published tarballs** (Task 8 re-checks them in the installed tree):
- `emailAndPassword.password.verify` is typed `(data: { hash: string; password: string }) => Promise<boolean>`, and `hash` is `(password: string) => Promise<string>`.
- `twoFactor.enable` returns `{ method: "totp"; totpURI: string; backupCodes: string[] }` (or `{ method: "otp" }` for email OTP). The TOTP row stays `verified: false`, and `user.twoFactorEnabled` stays false, until `verifyTOTP` succeeds.
- `twoFactorPage` is a **client** option (`twoFactorClient({ twoFactorPage })`), not a server option.
- `organization.setActive` for a non-member throws `403 FORBIDDEN` and resets the caller's active org to `null`. `organization.create` makes the new org active unless `keepCurrentActiveOrganization` is passed.
- Sign-up with an existing email returns `422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` unless `autoSignIn: false` (or email verification) is set. In that case it returns an identical-shape synthetic success and still spends the hashing time.
- **`@better-auth/cli@1.4.21` is deprecated on npm and bundles `better-auth@1.4.21`.** The CLI now ships as the **`auth`** package, version-locked to `better-auth` (`auth@1.7.6` depends on `better-auth@1.7.6`, bin `auth`). This plan uses `auth@1.7.6`.
- The CLI generates snake_case tables `user`, `session`, `account`, `verification`, `two_factor`, `organization`, `member`, `invitation`. The export names are `user, session, account, verification, twoFactor, organization, member, invitation`. It emits `timestamp` **without** time zone, and Task 9 rewrites that to `timestamptz`.
- Better Auth's built-in rate limiter (on only when `NODE_ENV=production`) allows **3 requests per 10 s** on `/sign-in*`, `/sign-up*` and `/two-factor/*`.
- TOTP verification uses a ±1-step window with **no replay protection**.
- pnpm 11 **fails** `pnpm install` on unapproved build scripts. `esbuild` needs `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`. pnpm 11 also appends `minimumReleaseAgeExclude` entries for pinned versions younger than its release-age gate.
- eslint-plugin-boundaries 7.2.0 uses `boundaries/dependencies` with `policies`, and element `mode` is deprecated. The config in Task 4 was dry-run and flags a `core → web` import.

## Global Constraints

- **Node 24.21.0** everywhere: `.nvmrc` = `24.21.0`, root `engines.node` = `>=24.21.0 <25`, Docker base `node:24.21.0-alpine`, CI via `node-version-file: .nvmrc`. (The spec's Decisions table says Node 24 LTS, changed by Charlie on 2026-09-29.)
- **pnpm 11.6.0** (`"packageManager": "pnpm@11.6.0"`). Every dependency is an **exact** version, with no `^` or `~`. `pnpm-workspace.yaml` sets `savePrefix: ""` and `engineStrict: true`.
- **TypeScript 6.0.3**, not 7.x, because typescript-eslint 8.71.0 peers `typescript <6.1.0`. `strict` everywhere. No `any` without a justifying comment.
- **Exact versions (do not change):**
  - Runtime: next 16.3.6, react 19.3.0, react-dom 19.3.0, better-auth 1.7.6, drizzle-orm 0.45.3, postgres 3.4.9, zod 4.6.5, @node-rs/argon2 2.2.1, clsx 2.1.1, tailwind-merge 3.7.0, class-variance-authority 0.7.1, @next/env 16.3.6.
  - Dev: auth 1.7.6, drizzle-kit 0.31.11, tailwindcss 4.3.3, @tailwindcss/postcss 4.3.3, vitest 5.0.2, @playwright/test 1.63.0, otpauth 9.5.2, testcontainers 12.2.0, @testcontainers/postgresql 12.2.0, tsx 4.23.15, esbuild 0.28.2.
  - Lint and types: eslint 10.11.0, @eslint/js 10.0.1, typescript-eslint 8.71.0, eslint-plugin-boundaries 7.2.0, @next/eslint-plugin-next 16.3.6, eslint-plugin-react-hooks 7.1.1, globals 17.12.0, @types/node 24.19.0, @types/react 19.3.0, @types/react-dom 19.3.0.
- **Not in Phase 0:** pg-boss, pino, nodemailer, Resend, AWS SDK, Sentry. Their phase adds them.
- **`packages/core` imports no framework, DB, auth or extension code** (spec, "Boundaries"). ESLint `boundaries/dependencies` + `no-restricted-imports` enforce this, and CI fails on violation.
- **Postgres only through the `postgres` TCP driver** (spec, "Database"). Never `pg`, never a provider HTTP driver. (Spec v4.5 allows `pg` only inside pg-boss, from Phase 1; nothing in Phase 0 uses it.)
- **One Docker image, two commands** (`web`, `worker`). Migrations run from the image entrypoint before either command starts (spec, "Runtime", "Migrations").
- **No secrets in the repo.** Only `.env.example` is committed. The dev compose uses fixed, dev-only DB credentials bound to `127.0.0.1`.
- **Logs carry no PII or tokens.** The Better Auth logger stays at `warn`, and `/api/health` never echoes DB errors.
- **Only unauthenticated app surface:** `/api/health` plus Better Auth's own `/api/auth/*` endpoints.
- **UI follows `FRONTEND_STANDARDS.md`**: semantic HTML, one `<h1>`, labelled controls, keyboard operable, Tailwind utilities, `cn()`, `cva()` for variants, and semantic tokens only. Tailwind v4 is CSS-first, so tokens live in `apps/web/src/app/globals.css` (`@theme inline`). There is **no `tailwind.config.ts`**, which is a stack-version difference from the standards doc's wording.
- **Import style:** `src/lib/**`, `src/db/**`, `src/worker/**`, `src/test/**`, `scripts/**`, `worker.ts` and `migrate.ts` use **relative** imports, because they are loaded by tsx, esbuild and the `auth` CLI. The `@/` alias is used only under `src/app/**` and `src/components/**`.
- **Comments:** none by default. Add one only where the *why* is non-obvious.
- **Git:** Conventional Commits with one logical change each. Every commit ends with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`, where `<model>` is the executing model's name (e.g. `Claude Sonnet 5.5` when Sonnet does the work); the `Claude Opus 5.5` text in the commit steps below is an example. Never commit to `main`, never `--no-verify`, never force-push.
- **Commands:**
  - Unit and integration tests: `pnpm test` (Vitest projects; integration tests need Docker running).
  - Single file: `pnpm vitest run <path>`.
  - E2E: `pnpm test:e2e`.

## Review Focus

1. **Signing up with an email that already has an account.** Expected: the response is identical to a fresh sign-up (no account enumeration), no second user row is created, the original password still works, and the attacker's password does not. Owner: Task 10 (API test, which also drives the `autoSignIn: false` change) and Task 12 (E2E).
2. **A wrong TOTP code during 2FA enrolment.** Expected: a clear "That code didn't work" error, 2FA stays **off** (`user.two_factor_enabled` false, `two_factor.verified` false), and a correct code afterwards still completes enrolment. Owner: Task 10 (API test on DB state) and Task 13 (E2E).
3. **Switching to a workspace the user is not a member of** (a crafted `organizationId`). Expected: `403`, and the caller's session never points at the foreign workspace. Owner: Task 10.
4. **`docker compose up` with no `.env`, or with a blank `AUTH_SECRET`.** Expected: the command fails immediately, naming the missing file or the invalid variable **names** and never their values. It must never boot with a default secret. Owner: Task 6 (env unit tests) and Task 16 (compose check).
5. **First boot against an empty database while `web` and `worker` start at the same time.** Expected: both containers apply migrations safely (one waits on the advisory lock, the other no-ops), every auth table exists, and no container crash-loops. Owner: Task 9 (concurrent-migration integration test) and Task 16 (`down -v` then `up`).

---

## File Structure

```
.nvmrc                                   Node 24.21.0 pin
package.json                             root scripts, root dev deps (TS, Vitest, ESLint stack), engines, packageManager
pnpm-workspace.yaml                      workspaces + pnpm 11 settings (savePrefix, engineStrict, allowBuilds)
pnpm-lock.yaml                           generated
tsconfig.base.json                       shared strict compiler options
vitest.config.mts                        Vitest projects (packages/*/vitest.config.{ts,mts}, apps/*/vitest.config.{ts,mts})
eslint.config.mjs                        flat config: TS strict, Next, react-hooks, boundaries, core import ban
.env.example                             every env var, no real values
.dockerignore                            keeps secrets / build output out of the build context
.gitignore                               (modify) add next-env.d.ts, *.tsbuildinfo
CLAUDE.md                                (modify) "Commands" section
.github/workflows/ci.yml                 checks, audit, secret scan, image (build + Trivy + compose + E2E)
docker/Dockerfile                        multi-stage build → one runtime image
docker/entrypoint.sh                     migrate, then exec web | worker
docker/compose.dev.yml                   postgres + web + worker (dev)
packages/core/
  package.json                           @crm/core, exports ./password and ./workspace
  tsconfig.json
  vitest.config.ts
  src/password/index.ts                  hashPassword / verifyPassword (Argon2id)
  src/password/password.test.ts
  src/workspace/slug.ts                  toWorkspaceSlug
  src/workspace/slug.test.ts
apps/web/
  package.json                           @crm/web
  tsconfig.json
  next.config.ts                         standalone output, monorepo tracing root, root .env loading
  postcss.config.mjs                     Tailwind v4 PostCSS plugin
  vitest.config.mts                      .mts: apps/web is not "type": "module" (next.config.ts uses CJS __dirname)
  playwright.config.ts
  drizzle.config.ts
  drizzle/                               generated SQL migrations (committed)
  migrate.ts                             node entry: apply migrations
  worker.ts                              node entry: worker stub
  scripts/build-node.mjs                 esbuild → dist/worker.mjs, dist/migrate.mjs
  scripts/timestamptz.ts                 pure rewrite: timestamp(...) → timestamptz
  scripts/timestamptz.test.ts
  scripts/apply-timestamptz.ts           CLI wrapper used after `auth generate`
  e2e/helpers.ts                         Playwright helpers
  e2e/auth.spec.ts                       sign-up / sign-in / duplicate email
  e2e/two-factor.spec.ts                 2FA enrolment + 2FA sign-in
  e2e/workspaces.spec.ts                 Phase 0 done-when journey
  src/types/css.d.ts                     side-effect CSS import typing
  src/app/globals.css                    Tailwind import + design tokens
  src/app/layout.tsx                     root layout
  src/app/page.tsx                       redirect to /workspaces or /sign-in
  src/app/(auth)/layout.tsx              centred <main> for auth pages
  src/app/(auth)/sign-up/page.tsx, sign-up-form.tsx
  src/app/(auth)/sign-in/page.tsx, sign-in-form.tsx
  src/app/(auth)/two-factor/page.tsx, two-factor-forms.tsx
  src/app/(app)/layout.tsx               session guard + header (nav, switcher, sign out) + <main>
  src/app/(app)/nav-links.tsx            nav with aria-current
  src/app/(app)/sign-out-button.tsx
  src/app/(app)/workspace-switcher.tsx
  src/app/(app)/workspaces/page.tsx, create-workspace-form.tsx
  src/app/(app)/settings/security/page.tsx, two-factor-setup.tsx
  src/app/api/auth/[...all]/route.ts     Better Auth handler
  src/app/api/health/route.ts            GET /api/health
  src/components/ui/button.tsx, input.tsx, label.tsx
  src/lib/utils.ts                       cn()
  src/lib/env.ts, env.test.ts            Zod env validation
  src/lib/health.ts, health.test.ts      checkHealth()
  src/lib/auth/config.ts                 createAuth() factory
  src/lib/auth/server.ts                 getAuth() lazy singleton
  src/lib/auth/cli-config.ts             options-only instance for `auth generate`
  src/lib/auth/client.ts                 authClient (React)
  src/lib/auth/session.ts                getCurrentSession / listWorkspaces (request-cached)
  src/lib/auth/messages.ts               shared user-facing auth messages
  src/lib/auth/auth.test.ts              Better Auth behaviour against real Postgres
  src/db/client.ts, client.test.ts       createDb()
  src/db/index.ts                        getDb() process singleton
  src/db/schema/index.ts                 schema barrel
  src/db/schema/auth.ts                  generated by `auth generate` (+ timestamptz rewrite)
  src/db/migrate.ts, migrate.test.ts     runMigrations() with advisory lock
  src/test/postgres.ts                   Testcontainers helper + MIGRATIONS_DIR
  src/test/totp.ts                       totpFromUri / wrongTotpCode (Vitest + Playwright)
  src/worker/start.ts, start.test.ts     startWorker()
```

## PR checkpoints

`init_andy.md` asks for one logical change per PR, and Phase 0 is too large for one. Stop at each checkpoint: push the branch, open the PR (what + why + test plan + drafting model), and wait for Bob's review and Charlie's merge before starting the next branch from the updated `main`. Charlie may instead ask for stacked branches.

| PR | Branch | Tasks |
|---|---|---|
| 1 | `feat/p0-tooling` | 1–5 (workspace, core password, web shell, lint + boundaries, CI checks) |
| 2 | `feat/p0-auth-db` | 6–10 (env, DB, Better Auth, schema + migrations, auth behaviour tests) |
| 3 | `feat/p0-auth-ui` | 11–14 (health, sign-up/in, 2FA, workspaces) |
| 4 | `feat/p0-runtime` | 15–17 (worker, Docker + compose, E2E in CI + Trivy) |

No GitHub remote exists yet. Before the first push, ask Charlie which account or org should own the private repo (see `init_andy.md` → "GitHub repo"), then record the URL in `init_andy.md`.

---

### Task 1: Root workspace and toolchain

> **DONE** (PR #1, merged 2026-09-30). Branch already existed, so no `switch -c`; Node 24.21.0 via fnm instead of `pnpm env use --global`; the `minimumReleaseAgeExclude` entries were removed before push (`8a70d62`).

**Files:**
- Create: `.nvmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: the root scripts `typecheck`, `lint`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `worker:dev`, `stack:up`, `stack:down`, `dev` and `build`. Also `tsconfig.base.json`, which every package extends, and the pnpm workspace globs `apps/*` and `packages/*`.

- [ ] **Step 1: Create the branch and check the Node version**

```bash
cd /Users/charlie/Documents/Projects/Personal/CRM
git switch -c feat/p0-tooling
node --version
```

Expected: `v24.21.0`. On 2026-09-29 this Mac reported `v26.3.0`. If the major version is not 24, **stop and ask Charlie** before running `pnpm env use --global 24.21.0`, because that changes his global Node. With `engineStrict: true`, `pnpm install` will refuse to run on Node 26.

- [ ] **Step 2: Write `.nvmrc`**

```
24.21.0
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*
savePrefix: ""
engineStrict: true
allowBuilds:
  esbuild: true
```

- [ ] **Step 4: Write the root `package.json`**

```json
{
  "name": "crm",
  "private": true,
  "packageManager": "pnpm@11.6.0",
  "engines": {
    "node": ">=24.21.0 <25"
  },
  "scripts": {
    "dev": "pnpm --filter @crm/web dev",
    "build": "pnpm --filter @crm/web build",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "pnpm --filter @crm/web test:e2e",
    "db:generate": "pnpm --filter @crm/web db:generate",
    "db:migrate": "pnpm --filter @crm/web db:migrate",
    "worker:dev": "pnpm --filter @crm/web worker:dev",
    "stack:up": "docker compose -f docker/compose.dev.yml up --build -d --wait",
    "stack:down": "docker compose -f docker/compose.dev.yml down"
  },
  "devDependencies": {
    "@types/node": "24.19.0",
    "typescript": "6.0.3",
    "vitest": "5.0.2"
  }
}
```

- [ ] **Step 5: Write `tsconfig.base.json`**

TS 6 defaults `types` to `[]`, so Node types are listed explicitly.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "noEmit": true
  }
}
```

- [ ] **Step 6: Add Next's generated files to `.gitignore`**

Append these two lines to `.gitignore`:

```
next-env.d.ts
*.tsbuildinfo
```

- [ ] **Step 7: Install and verify the toolchain**

Run: `pnpm install && pnpm exec tsc --version && pnpm exec vitest --version`
Expected: install succeeds, then `Version 6.0.3` and `vitest/5.0.2`. If pnpm appended `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml`, keep them; they record reviewed exceptions for freshly released pinned versions.

- [ ] **Step 8: Commit**

```bash
git add .nvmrc package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore
git commit -m "chore: add pnpm workspace root with pinned Node 24 and TypeScript 6 toolchain" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `@crm/core` — Argon2id password hashing

> **DONE** (PR #1, merged 2026-09-30). The root config is `vitest.config.mts` (ESM without a root `"type": "module"`); the fix wave widened the project globs to `vitest.config.{ts,mts}`.

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/password/index.ts`, `vitest.config.ts` (root)
- Test: `packages/core/src/password/password.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1).
- Produces: from `@crm/core/password`, `hashPassword(password: string): Promise<string>` returns a PHC string starting `$argon2id$v=19$m=19456,t=2,p=1$`. `verifyPassword(storedHash: string, password: string): Promise<boolean>` never throws, and returns `false` for non-Argon2id or corrupt hashes.

- [ ] **Step 1: Create the package scaffolding**

`packages/core/package.json`:

```json
{
  "name": "@crm/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./password": "./src/password/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@node-rs/argon2": "2.2.1"
  },
  "devDependencies": {
    "@types/node": "24.19.0",
    "typescript": "6.0.3",
    "vitest": "5.0.2"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Root `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts", "apps/*/vitest.config.ts"],
  },
});
```

Run: `pnpm install`
Expected: succeeds and links `@node-rs/argon2` for this platform.

- [ ] **Step 2: Write the failing test**

`packages/core/src/password/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./index";

describe("hashPassword", () => {
  it("produces an Argon2id PHC string with the OWASP minimum parameters", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("salts every hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("accepts the password that produced the hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "Correct horse battery staple")).resolves.toBe(false);
  });

  it("returns false for a non-Argon2id hash instead of throwing", async () => {
    await expect(verifyPassword("a1b2c3:d4e5f6", "anything")).resolves.toBe(false);
  });

  it("returns false for a corrupted Argon2id hash instead of throwing", async () => {
    await expect(verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$broken", "anything")).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run packages/core/src/password/password.test.ts`
Expected: FAIL. The module fails to resolve, with an error like `Failed to resolve import "./index"`.

- [ ] **Step 4: Write the implementation**

`packages/core/src/password/index.ts`:

```ts
import { hash, verify, type Algorithm } from "@node-rs/argon2";

// `Algorithm` is an ambient const enum, which isolatedModules forbids as a value; 2 is Argon2id.
const ARGON2ID: Algorithm.Argon2id = 2;

// OWASP Password Storage Cheat Sheet minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash.startsWith("$argon2id$")) return false;
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run the tests and typecheck to verify they pass**

Run: `pnpm vitest run packages/core/src/password/password.test.ts && pnpm --filter @crm/core typecheck`
Expected: 6 tests pass and `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts packages/core pnpm-lock.yaml
git commit -m "feat(core): add Argon2id password hashing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `apps/web` — Next.js shell, Tailwind v4 tokens, UI primitives

> **DONE** (PR #1, merged 2026-09-30). `@node-rs/argon2` 2.2.1 is also an `apps/web` dependency (a server-external package must resolve from the app); the fix wave raised `--input` border contrast to ≥ 3:1, kept a forced-colors focus outline (`outline-hidden`), added the Input ring offset and set `color-scheme`.

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/src/types/css.d.ts`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/label.tsx`

**Interfaces:**
- Consumes: `@crm/core` via `transpilePackages` (Task 2).
- Produces:
  - `cn(...inputs: ClassValue[]): string` from `src/lib/utils.ts`.
  - `Button` (props: `ButtonHTMLAttributes<HTMLButtonElement>` plus `variant?: "default" | "outline" | "ghost"`, with `type` defaulting to `"button"`).
  - `Input` (props: `InputHTMLAttributes<HTMLInputElement>`).
  - `Label` (props: `LabelHTMLAttributes<HTMLLabelElement>`).
  - The `@crm/web` scripts `dev`, `build`, `start` and `typecheck`.

No behaviour is under test in this task. Verification is `typecheck` plus a successful `next build`.

- [ ] **Step 1: Write `apps/web/package.json`**

This list includes only what this task needs. Later tasks add their own dependencies.

```json
{
  "name": "@crm/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@crm/core": "workspace:*",
    "@next/env": "16.3.6",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "next": "16.3.6",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "tailwind-merge": "3.7.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "24.19.0",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "tailwindcss": "4.3.3",
    "typescript": "6.0.3"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2023"],
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts", "e2e/**/*.ts", "*.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "dist"]
}
```

- [ ] **Step 3: Write `apps/web/next.config.ts`**

```ts
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");

// The single .env lives at the repo root (shared with docker compose), not in apps/web.
loadEnvConfig(repoRoot);

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@crm/core"],
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
};

export default config;
```

- [ ] **Step 4: Write PostCSS and the CSS module typing**

`apps/web/postcss.config.mjs`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

`apps/web/src/types/css.d.ts`. TS 6 checks side-effect imports, so `import "./globals.css"` needs a declaration:

```ts
declare module "*.css";
```

- [ ] **Step 5: Write `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222 47% 11%);
  --muted: hsl(210 40% 96%);
  --muted-foreground: hsl(215 16% 35%);
  --border: hsl(214 32% 88%);
  --input: hsl(214 32% 70%);
  --ring: hsl(222 84% 45%);
  --primary: hsl(222 47% 11%);
  --primary-foreground: hsl(210 40% 98%);
  --destructive: hsl(0 72% 42%);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: hsl(222 47% 7%);
    --foreground: hsl(210 40% 96%);
    --muted: hsl(217 33% 15%);
    --muted-foreground: hsl(215 20% 70%);
    --border: hsl(217 33% 22%);
    --input: hsl(217 33% 35%);
    --ring: hsl(213 94% 68%);
    --primary: hsl(210 40% 96%);
    --primary-foreground: hsl(222 47% 11%);
    --destructive: hsl(0 84% 65%);
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-destructive: var(--destructive);
}

@layer base {
  body {
    @apply bg-background text-foreground antialiased;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }
}
```

- [ ] **Step 6: Write `cn()` and the three UI primitives**

`apps/web/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`apps/web/src/components/ui/button.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
```

`apps/web/src/components/ui/input.tsx`:

```tsx
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
```

`apps/web/src/components/ui/label.tsx`:

```tsx
import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}
```

- [ ] **Step 7: Write the root layout and a temporary home page**

Task 12 replaces `page.tsx` with an auth redirect.

`apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">CRM</h1>
      <p className="text-muted-foreground">Foundation build.</p>
    </main>
  );
}
```

- [ ] **Step 8: Install, typecheck and build**

Run: `pnpm install && pnpm --filter @crm/web typecheck && pnpm --filter @crm/web build`
Expected: typecheck exits 0 and `next build` prints the route table with `○ /`. If `next build` rewrites `apps/web/tsconfig.json` (Next sometimes adds keys), keep its changes and re-run typecheck.

- [ ] **Step 9: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js 16 app with Tailwind v4 tokens and UI primitives" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lint and architecture boundaries

> **DONE** (PR #1, merged 2026-09-30). The fix wave widened the core globs to `{ts,tsx,mts,cts,js,mjs}`, added restricted names (`@better-auth/*`, `drizzle-kit/*`, `pg-*`, `@neondatabase/*`, `@vercel/postgres`), banned dynamic `import()` of restricted modules in core and banned web deep imports into `packages/*/src`.

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (root devDependencies)

**Interfaces:**
- Consumes: the packages from Tasks 2 and 3.
- Produces: `pnpm lint`, which fails on:
  - any `packages/core` → `apps/web` import (`boundaries/dependencies`)
  - any framework, DB or auth import inside `packages/core` (`no-restricted-imports`)
  - `any` (`@typescript-eslint/no-explicit-any`)

- [ ] **Step 1: Add the lint dependencies**

Add to the root `package.json` `devDependencies`, keeping keys alphabetical:

```json
"@eslint/js": "10.0.1",
"@next/eslint-plugin-next": "16.3.6",
"eslint": "10.11.0",
"eslint-plugin-boundaries": "7.2.0",
"eslint-plugin-react-hooks": "7.1.1",
"globals": "17.12.0",
"typescript-eslint": "8.71.0"
```

Run: `pnpm install`
Expected: succeeds.

- [ ] **Step 2: Write a boundary-violation probe (this is the failing check)**

`packages/core/src/boundary-probe.ts` is a temporary file and is deleted in Step 5:

```ts
import { cn } from "../../../apps/web/src/lib/utils";
import "next/server";
import "drizzle-orm";

export const probe = cn("a");
```

- [ ] **Step 3: Write `eslint.config.mjs`**

```js
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "core", pattern: "packages/core" },
        { type: "web", pattern: "apps/web" },
      ],
      "import/resolver": { node: { extensions: [".ts", ".tsx", ".js", ".mjs"] } },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            { from: { element: { type: "web" } }, allow: { to: { element: { types: { anyOf: ["web", "core"] } } } } },
            { from: { element: { type: "core" } }, allow: { to: { element: { type: "core" } } } },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "@next/*"],
              message: "packages/core must not import framework code.",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*", "drizzle-kit", "postgres", "pg", "pg-boss", "better-auth", "better-auth/*"],
              message: "packages/core must not import database or auth code.",
            },
            {
              group: ["@crm/web", "@crm/web/*", "@crm/ext-*"],
              message: "packages/core must not import app or extension code.",
            },
          ],
        },
      ],
    },
  },
);
```

- [ ] **Step 4: Run lint on the probe to verify it fails**

Run: `pnpm exec eslint packages/core/src/boundary-probe.ts`
Expected: exit 1 with exactly these three errors:
- `There is no policy allowing dependencies from elements of type "core" to elements of type "web"` (`boundaries/dependencies`)
- `'next/server' import is restricted … must not import framework code` (`no-restricted-imports`)
- `'drizzle-orm' import is restricted … must not import database or auth code` (`no-restricted-imports`)

If the boundaries error is missing, **stop and report**. Do not weaken or remove the rule.

- [ ] **Step 5: Delete the probe and lint the whole repo**

Run: `rm packages/core/src/boundary-probe.ts && pnpm lint`
Expected: exit 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs package.json pnpm-lock.yaml
git commit -m "chore: add ESLint with boundary rules keeping packages/core framework- and DB-free" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: CI — checks, audit, secret scan

> **DONE** (PR #1, merged 2026-09-30). A committed `.gitleaks.toml` allowlists this plan's dummy test values (exact path, `generic-api-key` only); the fix wave pinned gitleaks by digest, mounted the checkout read-only, added 15-minute job timeouts and PR-only cancellation.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the root scripts `typecheck`, `lint` and `test` (Task 1).
- Produces: the jobs `checks`, `audit` and `secrets`. Task 17 adds the `image` job to the same file.

Actions are pinned by commit SHA (supply-chain control, spec "Secrets, supply chain, image"). The SHAs were resolved from the tags on 2026-09-29.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    name: Typecheck, lint, test
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  audit:
    name: Dependency audit
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm audit --audit-level high

  secrets:
    name: Secret scan
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
      - name: gitleaks (full history)
        run: >-
          docker run --rm
          -v "${{ github.workspace }}:/repo"
          -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/repo
          ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo --redact --exit-code 1
```

- [ ] **Step 2: Run the same gates locally**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm audit --audit-level high`
Expected: all exit 0. If `pnpm audit` reports a high or critical advisory, **stop and report it to Charlie** with the advisory ID and path. Do not add ignores silently.

Run: `docker run --rm -v "$PWD:/repo" -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/repo ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo --redact --exit-code 1`
Expected: `no leaks found`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: gate PRs on typecheck, lint, tests, pnpm audit and gitleaks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: PR 1 checkpoint**

Push `feat/p0-tooling` (once Charlie has provided the remote), open PR 1 with `gh pr create`, confirm the three CI jobs are green, and **stop for Bob's review and Charlie's merge.** Start Task 6 on `feat/p0-auth-db` from the updated `main`.

---

### Task 6: Environment validation

**Files:**
- Create: `apps/web/src/lib/env.ts`, `apps/web/vitest.config.mts`, `.env.example`
- Modify: `apps/web/package.json` (add `zod`, `vitest`)
- Test: `apps/web/src/lib/env.test.ts`

The Vitest config is `.mts` because `apps/web/package.json` must not become `"type": "module"` (`next.config.ts` relies on CJS `__dirname`); the root `vitest.config.mts` already picks up `apps/*/vitest.config.{ts,mts}`.

Test values must not look like keys, so gitleaks (full-history scan in CI) does not flag them. The values in this task (`"k".repeat(32)`, `short-secret-value`, the `hunter2` URL) were checked against gitleaks 8.30.1 and pass. If gitleaks still flags a new file, add an exact-path, rule-scoped allowlist entry to `.gitleaks.toml` in the same commit (never a wildcard); the reviewer checks it.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseEnv(source: Record<string, string | undefined>): Env`, which throws `EnvError` naming invalid variables, never their values.
  - `getEnv(): Env`, which memoises `parseEnv(process.env)`.
  - `type Env = { DEPLOYMENT_MODE: "saas" | "selfhost"; APP_URL: string; AUTH_SECRET: string; DATABASE_URL: string; DATABASE_MIGRATOR_URL: string }`.
  - `class EnvError extends Error`.

`APP_ENCRYPTION_KEY`, `EMAIL_PROVIDER`, `STORAGE_*`, `SENTRY_DSN` and `ERROR_REPORTING_OPTIN` are listed in the spec's env section but have no consumer in Phase 0. Each arrives with its adapter in Phase 1.

- [ ] **Step 0: Start the PR 2 branch**

The PR-checkpoint table creates one branch per PR from the updated `main`. Use `git switch -c` only if the branch does not exist yet:

```bash
git switch main && git pull --ff-only
git switch feat/p0-auth-db 2>/dev/null || git switch -c feat/p0-auth-db
git merge-base --is-ancestor main HEAD
```

Expected: the last command exits 0 (the branch contains the updated `main`). If not, **stop and ask Charlie**.

- [ ] **Step 1: Add dependencies and the Vitest project**

In `apps/web/package.json`:
- add `"zod": "4.6.5"` to `dependencies`
- add `"vitest": "5.0.2"` to `devDependencies`
- add the script `"test": "vitest run"`

`apps/web/vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "web",
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
```

Run: `pnpm install`
Expected: succeeds.

- [ ] **Step 2: Write the failing test**

`apps/web/src/lib/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

const valid = {
  DEPLOYMENT_MODE: "selfhost",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "k".repeat(32),
  DATABASE_URL: "postgres://crm:crm@localhost:5433/crm",
  DATABASE_MIGRATOR_URL: "postgres://crm:crm@localhost:5433/crm",
};

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("returns the typed values for a complete environment", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("drops unrelated variables", () => {
    expect(parseEnv({ ...valid, PATH: "/usr/bin" })).toEqual(valid);
  });

  it("names every missing variable and points at .env.example when nothing is set", () => {
    const message = messageOf(() => parseEnv({}));
    for (const name of Object.keys(valid)) {
      expect(message).toContain(name);
    }
    expect(message).toContain(".env.example");
  });

  it("rejects a blank AUTH_SECRET, as left by copying .env.example unchanged", () => {
    expect(messageOf(() => parseEnv({ ...valid, AUTH_SECRET: "" }))).toContain(
      "AUTH_SECRET: must be at least 32 characters",
    );
  });

  it("rejects a short AUTH_SECRET without echoing its value", () => {
    const message = messageOf(() => parseEnv({ ...valid, AUTH_SECRET: "short-secret-value" }));
    expect(message).toContain("AUTH_SECRET: must be at least 32 characters");
    expect(message).not.toContain("short-secret-value");
  });

  it("rejects an unknown DEPLOYMENT_MODE", () => {
    expect(messageOf(() => parseEnv({ ...valid, DEPLOYMENT_MODE: "cloud" }))).toContain("DEPLOYMENT_MODE");
  });

  it("rejects a non-Postgres DATABASE_URL without echoing the URL", () => {
    const message = messageOf(() => parseEnv({ ...valid, DATABASE_URL: "mysql://user:hunter2@db/crm" }));
    expect(message).toContain("DATABASE_URL: must be a postgres:// URL");
    expect(message).not.toContain("hunter2");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/lib/env.test.ts`
Expected: FAIL with `Failed to resolve import "./env"`.

- [ ] **Step 4: Write the implementation**

`apps/web/src/lib/env.ts`:

```ts
import { z } from "zod";

const postgresUrl = z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), {
  error: "must be a postgres:// URL",
});

const envSchema = z.object({
  DEPLOYMENT_MODE: z.enum(["saas", "selfhost"]),
  APP_URL: z.url(),
  AUTH_SECRET: z.string().min(32, { error: "must be at least 32 characters" }),
  DATABASE_URL: postgresUrl,
  DATABASE_MIGRATOR_URL: postgresUrl,
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  override name = "EnvError";
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new EnvError(
    ["Invalid environment configuration:", ...lines, "Copy .env.example to .env and set every value."].join("\n"),
  );
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run apps/web/src/lib/env.test.ts`
Expected: 7 tests pass.

- [ ] **Step 6: Write `.env.example` and a local `.env`**

`.env.example`:

```
# Copy to .env (git-ignored) and set every value. Never commit .env.

# saas | selfhost
DEPLOYMENT_MODE=selfhost

# Public URL of the web app (Better Auth base URL and trusted origin).
APP_URL=http://localhost:3000

# At least 32 characters. Generate with: openssl rand -base64 32
AUTH_SECRET=

# Host-side URLs for `pnpm dev` / `pnpm db:migrate` against the compose Postgres on 127.0.0.1:5433.
# docker/compose.dev.yml overrides both inside containers. Phase 0 uses one dev user for both;
# Phase 1 splits them into crm_app (runtime) and crm_migrator (migrations).
# DATABASE_URL may go through a transaction-mode pooler (Phase 1+). DATABASE_MIGRATOR_URL must be a
# DIRECT connection, never pooled: the migration runner holds a session-level advisory lock.
DATABASE_URL=postgres://crm:crm@localhost:5433/crm
DATABASE_MIGRATOR_URL=postgres://crm:crm@localhost:5433/crm
```

Create the local, git-ignored `.env` that later tasks use:

Run: `cp .env.example .env && sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" .env && git status --short .env`
Expected: `git status` prints nothing for `.env`, because it is ignored.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/env.ts apps/web/src/lib/env.test.ts apps/web/vitest.config.mts apps/web/package.json pnpm-lock.yaml .env.example
git commit -m "feat(web): validate environment with Zod and fail fast without echoing values" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Postgres client and Testcontainers harness

**Files:**
- Create: `apps/web/src/db/client.ts`, `apps/web/src/db/index.ts`, `apps/web/src/db/schema/index.ts`, `apps/web/src/db/schema/auth.ts`, `apps/web/src/test/postgres.ts`, `docker/compose.dev.yml` (Postgres service only; Task 16 adds `web` and `worker`)
- Modify: `apps/web/package.json`
- Test: `apps/web/src/db/client.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 6).
- Produces:
  - `createDb(url: string, options?: { max?: number }): { sql: postgres.Sql; db: PostgresJsDatabase<typeof schema> }`, always with `prepare: false` (not overridable; spec v4.5 "Scalability")
  - `type DbHandle = ReturnType<typeof createDb>` and `type Database = DbHandle["db"]`
  - `getDb(): DbHandle` (a process singleton reading `DATABASE_URL`)
  - `startPostgres(): Promise<StartedPostgreSqlContainer>` (Postgres 17)
  - `MIGRATIONS_DIR: string` (absolute path to `apps/web/drizzle`)
  - a schema barrel at `src/db/schema/index.ts`

- [ ] **Step 1: Add dependencies**

In `apps/web/package.json`:
- add `"drizzle-orm": "0.45.3"` and `"postgres": "3.4.9"` to `dependencies`
- add `"testcontainers": "12.2.0"` and `"@testcontainers/postgresql": "12.2.0"` to `devDependencies`

Run: `pnpm install`
Expected: succeeds.

- [ ] **Step 2: Create the schema barrel and the empty auth-schema module**

`src/db/schema/auth.ts` is an empty module on purpose. Task 9 overwrites it with the Better Auth CLI output. It must exist now so that the barrel, and later the auth config that the CLI loads, can import it.

`apps/web/src/db/schema/auth.ts`:

```ts
export {};
```

`apps/web/src/db/schema/index.ts`:

```ts
export * from "./auth";
```

- [ ] **Step 3: Write the Testcontainers helper**

`apps/web/src/test/postgres.ts`:

```ts
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer("postgres:17-alpine").start();
}
```

- [ ] **Step 4: Write the failing test**

`apps/web/src/db/client.test.ts`:

```ts
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres } from "../test/postgres";
import { createDb, type DbHandle } from "./client";

let container: StartedPostgreSqlContainer;
let handle: DbHandle;

beforeAll(async () => {
  container = await startPostgres();
  handle = createDb(container.getConnectionUri());
});

afterAll(async () => {
  await handle?.sql.end();
  await container?.stop();
});

describe("createDb", () => {
  it("runs queries over the postgres TCP driver", async () => {
    const rows = await handle.sql<{ ok: number }[]>`select 1 as ok`;
    expect(rows[0]?.ok).toBe(1);
  });

  it("exposes a Drizzle instance on the same pool", async () => {
    // drizzle-orm 0.45.3's postgres-js driver leaves timestamptz unparsed in raw execute(), so now() is a string.
    const rows = await handle.db.execute<{ now: string }>(sql`select now() as now`);
    expect(typeof rows[0]?.now).toBe("string");
    expect(rows[0]?.now).toMatch(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Docker Desktop must be running.

Run: `pnpm vitest run apps/web/src/db/client.test.ts`
Expected: FAIL with `Failed to resolve import "./client"`.

- [ ] **Step 6: Write the implementation**

`apps/web/src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options: { max?: number } = {}) {
  // Phase 1+ connects through a transaction-mode pooler, where server-side prepared statements break (spec v4.5, Spike 1).
  const sql = postgres(url, { max: options.max ?? 10, prepare: false });
  const db = drizzle({ client: sql, schema });
  return { sql, db };
}

export type DbHandle = ReturnType<typeof createDb>;
export type Database = DbHandle["db"];
```

`apps/web/src/db/index.ts`:

```ts
import { getEnv } from "../lib/env";
import { createDb, type DbHandle } from "./client";

const globalCache = globalThis as typeof globalThis & { crmDb?: DbHandle };

// Next dev re-evaluates modules on edit; caching on globalThis keeps one pool per process.
export function getDb(): DbHandle {
  globalCache.crmDb ??= createDb(getEnv().DATABASE_URL);
  return globalCache.crmDb;
}
```

- [ ] **Step 7: Run the test and typecheck to verify they pass**

Run: `pnpm vitest run apps/web/src/db/client.test.ts && pnpm --filter @crm/web typecheck`
Expected: 2 tests pass (the first run pulls `postgres:17-alpine`), and typecheck exits 0.

- [ ] **Step 8: Add the dev Postgres to compose**

`docker/compose.dev.yml` starts with Postgres only. Task 16 adds `web` and `worker` to it.

```yaml
name: crm-dev

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm
      POSTGRES_DB: crm
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm -d crm"]
      interval: 2s
      timeout: 3s
      retries: 30

volumes:
  pgdata:
```

Run: `docker compose -f docker/compose.dev.yml up -d --wait postgres`
Expected: `Container crm-dev-postgres-1 Healthy`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/db apps/web/src/test/postgres.ts apps/web/package.json pnpm-lock.yaml docker/compose.dev.yml
git commit -m "feat(web): add Postgres client over the postgres TCP driver with Testcontainers harness" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Better Auth server configuration

**Files:**
- Create: `apps/web/src/lib/auth/config.ts`, `apps/web/src/lib/auth/server.ts`, `apps/web/src/lib/auth/cli-config.ts`, `apps/web/src/app/api/auth/[...all]/route.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes:
  - `hashPassword` and `verifyPassword` from `@crm/core/password` (Task 2)
  - `createDb`, `Database` and the schema barrel (Task 7)
  - `getEnv()` (Task 6)
- Produces:
  - `createAuth(deps: { db: Database; secret: string; baseURL: string })`, which returns a Better Auth instance with `twoFactor` + `organization`
  - `type Auth = ReturnType<typeof createAuth>`
  - `getAuth(): Auth` (a lazy singleton, so `next build` never needs env)
  - `auth` exported from `cli-config.ts` (options-only, for `auth generate`)
  - `GET` and `POST` on `/api/auth/*`

There are no behaviour tests in this task because the schema does not exist until Task 9. Task 10 pins the behaviour, and it also drives the `autoSignIn: false` change through a failing test. The checks here are the installed-type verification and typecheck.

**Decide here (deferred from PR 1 review):** the maximum password length (unbounded input to Argon2id is a DoS lever), set via Better Auth `emailAndPassword.maxPasswordLength` or in `@crm/core/password`; record the value and why in the PR description.

- [ ] **Step 1: Add dependencies**

In `apps/web/package.json`:
- add `"better-auth": "1.7.6"` to `dependencies`
- add `"auth": "1.7.6"` to `devDependencies`

Do not use the deprecated `@better-auth/cli` package.

Run: `pnpm install`
Expected: succeeds.

- [ ] **Step 2: Verify the installed Better Auth API matches this plan**

Run from the repo root:

```bash
F=$(find node_modules/.pnpm -path "*@better-auth+core@1.7.6*/dist/types/init-options.d.mts" | head -1)
grep -n -A4 "verify?: (data" "$F"
grep -n "totpURI: string" apps/web/node_modules/better-auth/dist/plugins/two-factor/index.d.mts
grep -n "twoFactorPage?: string" apps/web/node_modules/better-auth/dist/plugins/two-factor/client.d.mts
ls -l apps/web/node_modules/.bin/auth
```

Expected:
- The first grep shows `verify?: (data: {` followed by `hash: string;` and `password: string;`.
- The second grep prints at least one `totpURI: string;` line.
- The third grep prints one `twoFactorPage?: string;` line.
- The `auth` bin exists.

If any output differs, **stop**. Record the actual shape and adjust every later use (this task's `verify`, Task 10's `enableTwoFactor` handling, and Task 13's `twoFactor.enable` handling) before continuing. Mention the change in the PR description.

- [ ] **Step 3: Write `createAuth`**

`apps/web/src/lib/auth/config.ts`:

```ts
import { hashPassword, verifyPassword } from "@crm/core/password";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import type { Database } from "../../db/client";
import * as schema from "../../db/schema";

export interface AuthDeps {
  db: Database;
  secret: string;
  baseURL: string;
}

export function createAuth({ db, secret, baseURL }: AuthDeps) {
  return betterAuth({
    appName: "CRM",
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: {
      // Postgres-generated uuids so Phase 1 RLS policies can compare against current_setting(...)::uuid.
      database: { generateId: "uuid" },
    },
    // Info-level lines include user emails (e.g. duplicate sign-up attempts); logs must carry no PII.
    logger: { level: "warn" },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
    },
    plugins: [twoFactor({ issuer: "CRM" }), organization()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

- [ ] **Step 4: Write the lazy server singleton and the CLI config**

`apps/web/src/lib/auth/server.ts`:

```ts
import { getDb } from "../../db";
import { getEnv } from "../env";
import { createAuth, type Auth } from "./config";

let instance: Auth | undefined;

export function getAuth(): Auth {
  if (!instance) {
    const env = getEnv();
    instance = createAuth({ db: getDb().db, secret: env.AUTH_SECRET, baseURL: env.APP_URL });
  }
  return instance;
}
```

`apps/web/src/lib/auth/cli-config.ts`:

```ts
import { createDb } from "../../db/client";
import { createAuth } from "./config";

// Loaded only by `auth generate` to read the options; postgres.js connects lazily, so this never opens a socket.
export const auth = createAuth({
  db: createDb("postgres://schema-generation@127.0.0.1:1/schema-generation").db,
  secret: "schema-generation-only-not-a-real-secret",
  baseURL: "http://localhost:3000",
});
```

- [ ] **Step 5: Write the route handler**

`apps/web/src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/server";

export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
```

- [ ] **Step 6: Typecheck, lint and build**

Run: `pnpm --filter @crm/web typecheck && pnpm lint && pnpm --filter @crm/web build`
Expected: all exit 0. The build does **not** need `.env`, because `getAuth()` is only called per request. The route table lists `ƒ /api/auth/[...all]`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/auth apps/web/src/app/api/auth apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): configure Better Auth with Argon2id, TOTP 2FA and organizations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Auth schema generation, migrations and the migration runner

**Files:**
- Create: `apps/web/scripts/timestamptz.ts`, `apps/web/scripts/apply-timestamptz.ts`, `apps/web/drizzle.config.ts`, `apps/web/src/db/migrate.ts`, `apps/web/migrate.ts`, `apps/web/drizzle/*` (generated)
- Modify: `apps/web/src/db/schema/auth.ts` (generated), `apps/web/package.json`
- Test: `apps/web/scripts/timestamptz.test.ts`, `apps/web/src/db/migrate.test.ts`

**Interfaces:**
- Consumes: `cli-config.ts` (Task 8), `startPostgres` and `MIGRATIONS_DIR` (Task 7), `getEnv()` (Task 6).
- Produces:
  - `toTimestamptz(source: string): string`
  - the generated tables exported from `src/db/schema`: `user`, `session`, `account`, `verification`, `twoFactor`, `organization`, `member`, `invitation`
  - `runMigrations(url: string, migrationsFolder: string): Promise<void>`, which is safe to run concurrently because it serialises on `pg_advisory_lock(hashtext('crm:migrations'))`
  - `apps/web/migrate.ts` (entry)
  - the scripts `auth:generate`, `db:generate` and `db:migrate`

**Direct connection only.** `runMigrations` takes a **session-level** advisory lock, which does not hold across a transaction-mode pooler. So `migrate.ts` always uses `DATABASE_MIGRATOR_URL`, and that URL must be a **direct** (non-pooled) connection: on DigitalOcean the direct port, never the pool port (spec v4.5, "Decisions" → Migrations). The code does not change; the rule is stated in `.env.example` (Task 6) and must hold in every deployment.

- [ ] **Step 1: Add tooling dependencies and scripts**

In `apps/web/package.json`:
- add `"drizzle-kit": "0.31.11"` and `"tsx": "4.23.15"` to `devDependencies`
- add these scripts:

```json
"auth:generate": "auth generate --config src/lib/auth/cli-config.ts --output src/db/schema/auth.ts --yes && tsx scripts/apply-timestamptz.ts src/db/schema/auth.ts",
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx --env-file=../../.env migrate.ts"
```

Run: `pnpm install`
Expected: succeeds.

- [ ] **Step 2: Write the failing timestamptz test**

`apps/web/scripts/timestamptz.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toTimestamptz } from "./timestamptz";

describe("toTimestamptz", () => {
  it("adds withTimezone to every bare timestamp column", () => {
    const source = [
      'createdAt: timestamp("created_at").defaultNow().notNull(),',
      'expiresAt: timestamp("expires_at").notNull(),',
    ].join("\n");
    expect(toTimestamptz(source)).toBe(
      [
        'createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
        'expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),',
      ].join("\n"),
    );
  });

  it("leaves the pg-core import and non-timestamp columns alone", () => {
    const source = 'import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\nname: text("name").notNull(),';
    expect(toTimestamptz(source)).toBe(source);
  });

  it("is idempotent", () => {
    const once = toTimestamptz('timestamp("created_at")');
    expect(toTimestamptz(once)).toBe(once);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/scripts/timestamptz.test.ts`
Expected: FAIL with `Failed to resolve import "./timestamptz"`.

- [ ] **Step 4: Implement the rewrite and its CLI wrapper**

`apps/web/scripts/timestamptz.ts`:

```ts
export function toTimestamptz(source: string): string {
  return source.replace(/timestamp\("([a-z_]+)"\)/g, 'timestamp("$1", { withTimezone: true })');
}
```

`apps/web/scripts/apply-timestamptz.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { toTimestamptz } from "./timestamptz";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/apply-timestamptz.ts <schema-file>");
  process.exit(1);
}
writeFileSync(file, toTimestamptz(readFileSync(file, "utf8")));
```

Run: `pnpm vitest run apps/web/scripts/timestamptz.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Generate the Better Auth Drizzle schema**

Run: `pnpm --filter @crm/web auth:generate && grep -n "^export const" apps/web/src/db/schema/auth.ts && grep -c 'withTimezone: true' apps/web/src/db/schema/auth.ts && grep -c 'timestamp("[a-z_]*")' apps/web/src/db/schema/auth.ts`

Expected:
- The CLI prints `Schema was overwritten successfully!`.
- The export list includes `user`, `session`, `account`, `verification`, `twoFactor`, `organization`, `member`, `invitation` and their `*Relations`.
- The `withTimezone` count is 17.
- The last grep prints `0` (no bare timestamps left).

The `id` columns are `uuid(...)` with a `pg_catalog.gen_random_uuid()` default.

- [ ] **Step 6: Write `drizzle.config.ts` and generate the SQL migration**

`apps/web/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
});
```

Run: `pnpm --filter @crm/web db:generate --name auth_baseline && ls apps/web/drizzle apps/web/drizzle/meta && grep -c "timestamp with time zone" apps/web/drizzle/0000_auth_baseline.sql`
Expected:
- `0000_auth_baseline.sql` exists.
- `meta/` contains `_journal.json` and `0000_snapshot.json`.
- The count is 17.

- [ ] **Step 7: Write the failing migration-runner test**

`apps/web/src/db/migrate.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { getTableName } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, startPostgres } from "../test/postgres";
import { runMigrations } from "./migrate";
import { account, invitation, member, organization, session, twoFactor, user, verification } from "./schema";

let container: StartedPostgreSqlContainer;
let url: string;

beforeAll(async () => {
  container = await startPostgres();
  url = container.getConnectionUri();
});

afterAll(async () => {
  await container?.stop();
});

function journalLength(): number {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8")) as {
    entries: unknown[];
  };
  return journal.entries.length;
}

async function appliedCount(): Promise<number> {
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{ count: number }[]>`select count(*)::int as count from drizzle.__drizzle_migrations`;
    return rows[0]?.count ?? 0;
  } finally {
    await sql.end();
  }
}

describe("runMigrations", () => {
  it("brings an empty database to the latest schema when web and worker start at the same time", async () => {
    await Promise.all([runMigrations(url, MIGRATIONS_DIR), runMigrations(url, MIGRATIONS_DIR)]);

    const sql = postgres(url, { max: 1 });
    try {
      const tables = await sql<{ name: string }[]>`
        select table_name as name from information_schema.tables where table_schema = 'public'`;
      const names = tables.map((row) => row.name);
      for (const table of [user, session, account, verification, twoFactor, organization, member, invitation]) {
        expect(names).toContain(getTableName(table));
      }

      const naiveTimestamps = await sql<{ column: string }[]>`
        select table_name || '.' || column_name as column from information_schema.columns
        where table_schema = 'public' and data_type = 'timestamp without time zone'`;
      expect([...naiveTimestamps]).toEqual([]);
    } finally {
      await sql.end();
    }

    expect(await appliedCount()).toBe(journalLength());
  });

  it("is a no-op when run again on an up-to-date database", async () => {
    await runMigrations(url, MIGRATIONS_DIR);
    expect(await appliedCount()).toBe(journalLength());
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/db/migrate.test.ts`
Expected: FAIL with `Failed to resolve import "./migrate"`.

- [ ] **Step 9: Implement the runner and its entry**

`apps/web/src/db/migrate.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(url: string, migrationsFolder: string): Promise<void> {
  // One connection so the session-level advisory lock and the migration run share a backend.
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(hashtext('crm:migrations'))`;
    try {
      await migrate(drizzle({ client: sql }), { migrationsFolder });
    } finally {
      await sql`select pg_advisory_unlock(hashtext('crm:migrations'))`;
    }
  } finally {
    await sql.end();
  }
}
```

`apps/web/migrate.ts`:

```ts
import path from "node:path";
import { runMigrations } from "./src/db/migrate";
import { getEnv } from "./src/lib/env";

async function main(): Promise<void> {
  const env = getEnv();
  await runMigrations(env.DATABASE_MIGRATOR_URL, path.resolve(process.cwd(), "drizzle"));
  console.log(JSON.stringify({ level: "info", msg: "migrations applied" }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 10: Run the tests to verify they pass, then migrate the dev database**

Run: `pnpm vitest run apps/web/src/db/migrate.test.ts`
Expected: 2 tests pass.

Run: `pnpm db:migrate`
Expected: `{"level":"info","msg":"migrations applied"}` (the compose Postgres from Task 7 must be up).

- [ ] **Step 11: Typecheck, lint and commit**

Run: `pnpm --filter @crm/web typecheck && pnpm lint`
Expected: both exit 0.

```bash
git add apps/web/scripts apps/web/drizzle.config.ts apps/web/drizzle apps/web/src/db apps/web/migrate.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): generate Better Auth schema with timestamptz and add advisory-locked migrations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Auth behaviour against real Postgres

**Files:**
- Create: `apps/web/src/test/totp.ts`
- Modify: `apps/web/src/lib/auth/config.ts` (add `autoSignIn: false`), `apps/web/package.json` (add `otpauth`)
- Test: `apps/web/src/lib/auth/auth.test.ts`

Test values must not look like keys (gitleaks scans full history in CI). `PASSWORD` and the test `secret` below use space-separated values, which gitleaks 8.30.1 does not flag (the earlier hyphenated values were flagged as `generic-api-key`). If gitleaks still flags the file, add an exact-path, rule-scoped allowlist entry to `.gitleaks.toml` in the same commit (never a wildcard); the reviewer checks it.

**Interfaces:**
- Consumes: `createAuth` (Task 8), `runMigrations` and the schema tables (Task 9), `startPostgres` and `MIGRATIONS_DIR` (Task 7).
- Produces:
  - `totpFromUri(uri: string): TOTP`
  - `wrongTotpCode(totp: TOTP): string` (a 6-digit code guaranteed invalid in the ±1-step window)
  - The Review Focus #1, #2 and #3 guarantees, pinned at the API level.

- [ ] **Step 1: Add `otpauth` and write the TOTP test helper**

In `apps/web/package.json`, add `"otpauth": "9.5.2"` to `devDependencies`, then run `pnpm install`.

`apps/web/src/test/totp.ts`:

```ts
import { TOTP, URI } from "otpauth";

export function totpFromUri(uri: string): TOTP {
  const otp = URI.parse(uri);
  if (!(otp instanceof TOTP)) throw new Error("expected an otpauth://totp/ URI");
  return otp;
}

export function wrongTotpCode(totp: TOTP): string {
  const now = Date.now();
  const accepted = new Set([-1, 0, 1].map((step) => totp.generate({ timestamp: now + step * totp.period * 1000 })));
  for (let candidate = 0; ; candidate += 1) {
    const code = String(candidate).padStart(totp.digits, "0");
    if (!accepted.has(code)) return code;
  }
}
```

- [ ] **Step 2: Write the tests**

`apps/web/src/lib/auth/auth.test.ts`:

```ts
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { account, twoFactor, user } from "../../db/schema";
import { MIGRATIONS_DIR, startPostgres } from "../../test/postgres";
import { totpFromUri, wrongTotpCode } from "../../test/totp";
import { createAuth, type Auth } from "./config";

const PASSWORD = "correct horse battery staple 42";

let container: StartedPostgreSqlContainer;
let handle: DbHandle;
let auth: Auth;

beforeAll(async () => {
  container = await startPostgres();
  await runMigrations(container.getConnectionUri(), MIGRATIONS_DIR);
  handle = createDb(container.getConnectionUri());
  auth = createAuth({
    db: handle.db,
    secret: "integration test secret, not a real key",
    baseURL: "http://localhost:3000",
  });
});

afterAll(async () => {
  await handle?.sql.end();
  await container?.stop();
});

let emailCounter = 0;
function uniqueEmail(): string {
  emailCounter += 1;
  return `user${emailCounter}-${Date.now()}@example.test`;
}

function cookieHeaders(response: Response): Headers {
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
  return new Headers({ cookie });
}

async function signUpAndSignIn(email: string, password = PASSWORD): Promise<Headers> {
  await auth.api.signUpEmail({ body: { name: "Test User", email, password } });
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(response.status).toBe(200);
  return cookieHeaders(response);
}

async function startTotpEnrolment(headers: Headers): Promise<{ totpURI: string; backupCodes: string[] }> {
  const enrolment = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
  if (!("totpURI" in enrolment)) throw new Error("expected a TOTP enrolment");
  return enrolment;
}

async function findUser(email: string) {
  const [row] = await handle.db.select().from(user).where(eq(user.email, email));
  if (!row) throw new Error(`no user ${email}`);
  return row;
}

describe("passwords", () => {
  it("stores an Argon2id hash, never scrypt or plaintext", async () => {
    const email = uniqueEmail();
    await signUpAndSignIn(email);
    const { id } = await findUser(email);
    const [credential] = await handle.db.select().from(account).where(eq(account.userId, id));
    expect(credential?.password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });
});

describe("sign-up with an email that already has an account", () => {
  it("answers exactly like a fresh sign-up, creates nothing and keeps the original password", async () => {
    const email = uniqueEmail();
    const first = await auth.api.signUpEmail({ body: { name: "Original", email, password: "original-password-123" } });
    const second = await auth.api.signUpEmail({ body: { name: "Impostor", email, password: "impostor-password-456" } });

    expect(first.token).toBeNull();
    expect(second.token).toBeNull();
    expect(Object.keys(second.user).sort()).toEqual(Object.keys(first.user).sort());

    const rows = await handle.db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Original");

    await expect(
      auth.api.signInEmail({ body: { email, password: "impostor-password-456" } }),
    ).rejects.toMatchObject({ statusCode: 401 });
    const original = await auth.api.signInEmail({
      body: { email, password: "original-password-123" },
      asResponse: true,
    });
    expect(original.status).toBe(200);
  });
});

describe("TOTP enrolment", () => {
  it("rejects a wrong code and leaves 2FA off, then accepts the right code", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const enrolment = await startTotpEnrolment(headers);
    expect(enrolment.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(enrolment.backupCodes).toHaveLength(10);
    const totp = totpFromUri(enrolment.totpURI);

    await expect(
      auth.api.verifyTOTP({ body: { code: wrongTotpCode(totp) }, headers }),
    ).rejects.toMatchObject({ statusCode: 401 });

    const afterWrong = await findUser(email);
    expect(afterWrong.twoFactorEnabled ?? false).toBe(false);
    const [pending] = await handle.db.select().from(twoFactor).where(eq(twoFactor.userId, afterWrong.id));
    expect(pending?.verified).toBe(false);

    await auth.api.verifyTOTP({ body: { code: totp.generate() }, headers });
    expect((await findUser(email)).twoFactorEnabled).toBe(true);
  });

  it("lets a recovery code finish a 2FA sign-in exactly once", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const enrolment = await startTotpEnrolment(headers);
    await auth.api.verifyTOTP({ body: { code: totpFromUri(enrolment.totpURI).generate() }, headers });
    const recoveryCode = enrolment.backupCodes[0];
    if (!recoveryCode) throw new Error("no recovery codes returned");

    async function startTwoFactorSignIn(): Promise<Headers> {
      const response = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
      const body = (await response.clone().json()) as { twoFactorRedirect?: boolean };
      expect(body.twoFactorRedirect).toBe(true);
      return cookieHeaders(response);
    }

    const firstUse = await auth.api.verifyBackupCode({
      body: { code: recoveryCode },
      headers: await startTwoFactorSignIn(),
      asResponse: true,
    });
    expect(firstUse.status).toBe(200);

    await expect(
      auth.api.verifyBackupCode({ body: { code: recoveryCode }, headers: await startTwoFactorSignIn() }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("switching workspace", () => {
  it("refuses a workspace the user is not a member of and never points the session at it", async () => {
    const ownerHeaders = await signUpAndSignIn(uniqueEmail());
    const outsiderHeaders = await signUpAndSignIn(uniqueEmail());
    const workspace = await auth.api.createOrganization({
      body: { name: "Owner Studio", slug: `owner-studio-${Date.now()}` },
      headers: ownerHeaders,
    });
    if (!workspace) throw new Error("workspace not created");

    await expect(
      auth.api.setActiveOrganization({ body: { organizationId: workspace.id }, headers: outsiderHeaders }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const outsiderSession = await auth.api.getSession({ headers: outsiderHeaders });
    expect(outsiderSession?.session.activeOrganizationId ?? null).toBeNull();

    const switched = await auth.api.setActiveOrganization({
      body: { organizationId: workspace.id },
      headers: ownerHeaders,
    });
    expect(switched?.id).toBe(workspace.id);
  });
});
```

- [ ] **Step 3: Run the tests and check which one fails**

Run: `pnpm vitest run apps/web/src/lib/auth/auth.test.ts`
Expected: exactly one test fails, "answers exactly like a fresh sign-up…". The second `signUpEmail` rejects with `statusCode: 422` (`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`), which is account enumeration. The other four tests pass; they pin behaviour already provided by Tasks 2 and 8.

- [ ] **Step 4: Make sign-up responses uniform**

In `apps/web/src/lib/auth/config.ts`, change the `emailAndPassword` block to:

```ts
    emailAndPassword: {
      enabled: true,
      // Spec: uniform responses on sign-up. With auto sign-in off, a duplicate email gets the same
      // synthetic success as a new one, and the user signs in explicitly afterwards.
      autoSignIn: false,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
    },
```

- [ ] **Step 5: Run the tests to verify they all pass**

Run: `pnpm vitest run apps/web/src/lib/auth/auth.test.ts && pnpm --filter @crm/web typecheck`
Expected: 5 tests pass and typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth apps/web/src/test/totp.ts apps/web/package.json pnpm-lock.yaml
git commit -m "fix(web): make duplicate-email sign-up indistinguishable and pin 2FA and workspace-switch rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: PR 2 checkpoint**

Run the full gate with `pnpm typecheck && pnpm lint && pnpm test`, then push `feat/p0-auth-db`, open PR 2, and **stop for review.** Task 11 starts on `feat/p0-auth-ui` from the updated `main` (its Step 0 creates the branch).

---

### Task 11: `/api/health`

**Files:**
- Create: `apps/web/src/lib/health.ts`, `apps/web/src/app/api/health/route.ts`
- Test: `apps/web/src/lib/health.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 7).
- Produces:
  - `checkHealth(pingDb: () => Promise<void>, timeoutMs?: number): Promise<HealthResult>`
  - `type HealthResult = { status: 200 | 503; body: { status: "ok" | "error"; db: "ok" | "error" } }`
  - `GET /api/health`, returning `200 {"status":"ok","db":"ok"}` or `503 {"status":"error","db":"error"}` with `Cache-Control: no-store`

The spec says health reports "DB + queue". The queue does not exist until pg-boss arrives in Phase 1, which adds a `queue` field.

- [ ] **Step 0: Start the PR 3 branch**

Use `git switch -c` only if the branch does not exist yet (one branch per PR, from the updated `main`):

```bash
git switch main && git pull --ff-only
git switch feat/p0-auth-ui 2>/dev/null || git switch -c feat/p0-auth-ui
git merge-base --is-ancestor main HEAD
```

Expected: the last command exits 0. If not, **stop and ask Charlie**.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("reports ok when the database answers", async () => {
    await expect(checkHealth(async () => {})).resolves.toEqual({
      status: 200,
      body: { status: "ok", db: "ok" },
    });
  });

  it("reports 503 without leaking the database error", async () => {
    const result = await checkHealth(async () => {
      throw new Error('password authentication failed for user "crm"');
    });
    expect(result).toEqual({ status: 503, body: { status: "error", db: "error" } });
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("reports 503 when the database does not answer in time", async () => {
    const result = await checkHealth(() => new Promise<void>(() => {}), 50);
    expect(result.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/lib/health.test.ts`
Expected: FAIL with `Failed to resolve import "./health"`.

- [ ] **Step 3: Write the implementation**

`apps/web/src/lib/health.ts`:

```ts
export interface HealthResult {
  status: 200 | 503;
  body: { status: "ok" | "error"; db: "ok" | "error" };
}

export async function checkHealth(pingDb: () => Promise<void>, timeoutMs = 2_000): Promise<HealthResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), timeoutMs);
  });
  try {
    await Promise.race([pingDb(), timeout]);
    return { status: 200, body: { status: "ok", db: "ok" } };
  } catch {
    return { status: 503, body: { status: "error", db: "error" } };
  } finally {
    clearTimeout(timer);
  }
}
```

`apps/web/src/app/api/health/route.ts`:

```ts
import { getDb } from "@/db";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await checkHealth(async () => {
    await getDb().sql`select 1`;
  });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/web/src/lib/health.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Check the endpoint against the dev database**

Start the dev server with `pnpm dev` (a long-running process, so run it in the background), wait for `Ready`, then:

Run: `curl -s -i http://localhost:3000/api/health`
Expected: `HTTP/1.1 200`, `cache-control: no-store` and body `{"status":"ok","db":"ok"}`.

Run: `docker compose -f docker/compose.dev.yml stop postgres && curl -s -i http://localhost:3000/api/health; docker compose -f docker/compose.dev.yml start postgres`
Expected: `HTTP/1.1 503` and body `{"status":"error","db":"error"}`.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/health.ts apps/web/src/lib/health.test.ts apps/web/src/app/api/health
git commit -m "feat(web): add /api/health reporting database status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Sign-up, sign-in, session guard and app shell

**Files:**
- Create:
  - `apps/web/playwright.config.ts`, `apps/web/e2e/helpers.ts`
  - `apps/web/src/lib/auth/client.ts`, `apps/web/src/lib/auth/session.ts`, `apps/web/src/lib/auth/messages.ts`
  - `apps/web/src/app/(auth)/layout.tsx`
  - `apps/web/src/app/(auth)/sign-up/page.tsx`, `apps/web/src/app/(auth)/sign-up/sign-up-form.tsx`
  - `apps/web/src/app/(auth)/sign-in/page.tsx`, `apps/web/src/app/(auth)/sign-in/sign-in-form.tsx`
  - `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/app/(app)/nav-links.tsx`, `apps/web/src/app/(app)/sign-out-button.tsx`
  - `apps/web/src/app/(app)/workspaces/page.tsx`
- Modify: `apps/web/src/app/page.tsx`, `apps/web/package.json`
- Test: `apps/web/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `getAuth()` (Task 8), `autoSignIn: false` (Task 10), `/api/health` (Task 11, used as Playwright's readiness URL), and `Button`, `Input`, `Label` and `cn` (Task 3).
- Produces:
  - `authClient` (React client with `twoFactorClient({ twoFactorPage: "/two-factor" })` and `organizationClient()`)
  - `getCurrentSession()` and `listWorkspaces()`, request-cached server helpers
  - `TOO_MANY_ATTEMPTS` and `WRONG_CODE` message constants
  - these E2E helpers: `PASSWORD`, `uniqueEmail()`, `respectRateLimit(page)`, `signUp(page, email, password?, name?)`, `signIn(page, email, password?)`, `signOut(page)`
  - the routes `/sign-up`, `/sign-in` (`?registered=1` shows a neutral status) and `/workspaces` (guarded), with `/` redirecting

Before writing any component, re-read `FRONTEND_STANDARDS.md` and run its self-check at Step 8.

**Decide before sign-up ships (deferred from PR 1 review):** the Unicode normalization policy for passwords (e.g. NFC / NFKC before hashing, or none); record the decision in the PR description and apply it consistently in sign-up and sign-in.

**Alert locators:** Next's App Router injects a route announcer with `role="alert"`, so a bare `page.getByRole("alert")` matches two elements (Playwright strict-mode violation). Scope every alert locator to the page's main landmark: `page.getByRole("main").getByRole("alert")`.

**Test values:** `PASSWORD` in `e2e/helpers.ts` is space-separated so gitleaks does not flag it (see Task 10); the same exact-path, rule-scoped allowlist rule applies if it still does.

- [ ] **Step 1: Add Playwright and its config**

In `apps/web/package.json`:
- add `"@playwright/test": "1.63.0"` to `devDependencies`
- add the script `"test:e2e": "playwright test"`

Run: `pnpm install && pnpm --filter @crm/web exec playwright install chromium`
Expected: Chromium downloads.

`apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
```

- [ ] **Step 2: Write the E2E helpers**

`apps/web/e2e/helpers.ts`:

```ts
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct horse battery staple 42";

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

// Better Auth's built-in limiter (NODE_ENV=production only) allows 3 requests per 10 s per path
// on /sign-in*, /sign-up* and /two-factor/*. Set E2E_RATE_LIMITED=1 when testing the production image.
export async function respectRateLimit(page: Page): Promise<void> {
  if (process.env.E2E_RATE_LIMITED === "1") await page.waitForTimeout(11_000);
}

export async function signUp(page: Page, email: string, password = PASSWORD, name = "E2E Owner"): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/sign-in\?registered=1$/);
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}
```

- [ ] **Step 3: Write the failing E2E test**

`apps/web/e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { PASSWORD, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
});

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a new user can sign up and then sign in", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page.getByRole("status")).toContainText("Sign in to continue");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
});

test("signing up twice with one email reveals nothing and keeps the original password", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email, PASSWORD, "Original Owner");
  await signUp(page, email, "a-different-password-99", "Impostor");

  await signIn(page, email, "a-different-password-99");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/workspaces$/);
});
```

- [ ] **Step 4: Run the E2E test to verify it fails**

The compose Postgres must be up and migrated (Task 9). Playwright starts `pnpm dev` itself.

Run: `pnpm test:e2e e2e/auth.spec.ts`
Expected: all 3 tests FAIL. `/workspaces` is not redirected, and `/sign-up` returns 404, so `getByLabel("Name")` times out.

- [ ] **Step 5: Write the auth client, session helpers and messages**

`apps/web/src/lib/auth/client.ts`:

```ts
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [twoFactorClient({ twoFactorPage: "/two-factor" }), organizationClient()],
});
```

`apps/web/src/lib/auth/session.ts`:

```ts
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./server";

export const getCurrentSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));

export const listWorkspaces = cache(async () => getAuth().api.listOrganizations({ headers: await headers() }));
```

`apps/web/src/lib/auth/messages.ts`:

```ts
export const TOO_MANY_ATTEMPTS = "Too many attempts. Wait a moment and try again.";
export const WRONG_CODE = "That code didn't work. Check your authenticator app and try again.";
```

- [ ] **Step 6: Write the auth pages**

`apps/web/src/app/(auth)/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      {children}
    </main>
  );
}
```

`apps/web/src/app/(auth)/sign-up/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account · CRM" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="underline underline-offset-4" href="/sign-in">
          Sign in
        </Link>
      </p>
    </>
  );
}
```

`apps/web/src/app/(auth)/sign-up/sign-up-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY_ATTEMPTS } from "@/lib/auth/messages";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (signUpError) {
      setError(
        signUpError.status === 429
          ? TOO_MANY_ATTEMPTS
          : "We couldn't create your account. Check your details and try again.",
      );
      return;
    }
    router.push("/sign-in?registered=1");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          At least 8 characters.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Create account
      </Button>
    </form>
  );
}
```

`apps/web/src/app/(auth)/sign-in/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · CRM" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const { registered } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {registered === "1" && (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          If this email wasn&apos;t registered before, your account is ready. Sign in to continue.
        </p>
      )}
      <SignInForm />
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link className="underline underline-offset-4" href="/sign-up">
          Create an account
        </Link>
      </p>
    </>
  );
}
```

`apps/web/src/app/(auth)/sign-in/sign-in-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY_ATTEMPTS } from "@/lib/auth/messages";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (signInError) {
      setPending(false);
      setError(signInError.status === 429 ? TOO_MANY_ATTEMPTS : "Email or password is incorrect.");
      return;
    }
    // twoFactorClient navigates to /two-factor itself when a second factor is required.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    router.push("/workspaces");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: Write the guarded app shell, the workspaces placeholder heading and the home redirect**

`apps/web/src/app/(app)/nav-links.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [{ href: "/workspaces", label: "Workspaces" }] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-4 text-sm">
        {LINKS.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current && "font-semibold",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`apps/web/src/app/(app)/sign-out-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      Sign out
    </Button>
  );
}
```

`apps/web/src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentSession } from "@/lib/auth/session";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <NavLinks />
          <div className="flex flex-wrap items-center gap-4">
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">{children}</main>
    </div>
  );
}
```

`apps/web/src/app/(app)/workspaces/page.tsx` (Task 14 completes it):

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Workspaces · CRM" };

export default function WorkspacesPage() {
  return <h1 className="text-2xl font-semibold">Workspaces</h1>;
}
```

Replace `apps/web/src/app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? "/workspaces" : "/sign-in");
}
```

- [ ] **Step 8: Run the E2E test, typecheck, lint and the frontend self-check**

Run: `pnpm test:e2e e2e/auth.spec.ts && pnpm --filter @crm/web typecheck && pnpm lint`
Expected: 3 E2E tests pass, then typecheck and lint exit 0.

Walk through the `FRONTEND_STANDARDS.md` self-check list for the new pages. Each page has one `<h1>`, one `<main>` from its layout, labelled inputs with correct `type`, errors in `role="alert"` and the neutral notice in `role="status"`, token classes only, and `gap` spacing.

- [ ] **Step 9: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e apps/web/src/lib/auth apps/web/src/app apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add sign-up, sign-in, session-guarded app shell and sign out" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 2FA enrolment and 2FA sign-in

**Files:**
- Create: `apps/web/src/app/(app)/settings/security/page.tsx`, `apps/web/src/app/(app)/settings/security/two-factor-setup.tsx`, `apps/web/src/app/(auth)/two-factor/page.tsx`, `apps/web/src/app/(auth)/two-factor/two-factor-forms.tsx`
- Modify: `apps/web/src/app/(app)/nav-links.tsx`, `apps/web/e2e/helpers.ts`
- Test: `apps/web/e2e/two-factor.spec.ts`

**Interfaces:**
- Consumes: `authClient.twoFactor.enable({ password })` → `{ data: { totpURI, backupCodes } }` (verified in Task 8), `authClient.twoFactor.verifyTOTP({ code, trustDevice })`, `authClient.twoFactor.verifyBackupCode({ code })`, `totpFromUri` and `wrongTotpCode` (Task 10), and `WRONG_CODE` and `TOO_MANY_ATTEMPTS` (Task 12).
- Produces:
  - `/settings/security`: password, then setup key, the full `otpauth://` link in `data-testid="totp-uri"`, and 10 recovery codes, then a code to confirm
  - `/two-factor`: the second step of sign-in, with an authenticator code or a recovery code
  - the E2E helpers `startTotpEnrolment(page): Promise<TOTP>`, `submitTotpCode(page, code): Promise<void>`, `enrolTotp(page): Promise<TOTP>` (built from the first two) and `completeTotpSignIn(page, totp): Promise<void>`. The spec reuses the helpers instead of repeating the enrolment steps.

There is no QR code in Phase 0. The user types the setup key, and a QR renderer is a follow-up (see the report to Charlie).

- [ ] **Step 1: Write the failing E2E test**

`apps/web/e2e/two-factor.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { wrongTotpCode } from "../src/test/totp";
import {
  completeTotpSignIn,
  respectRateLimit,
  signIn,
  signOut,
  signUp,
  startTotpEnrolment,
  submitTotpCode,
  uniqueEmail,
} from "./helpers";

test("2FA: a wrong code is refused, the right code enrols, and sign-in then asks for a code", async ({ page }) => {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  const totp = await startTotpEnrolment(page);
  await expect(page.getByRole("list", { name: "recovery codes" }).getByRole("listitem")).toHaveCount(10);

  await submitTotpCode(page, wrongTotpCode(totp));
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That code didn't work. Check your authenticator app and try again.",
  );

  await submitTotpCode(page, totp.generate());
  await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");

  await signOut(page);
  await respectRateLimit(page);
  await signIn(page, email);
  await completeTotpSignIn(page, totp);
});
```

Append to `apps/web/e2e/helpers.ts`. Add the import at the top of the file, with the other imports:

```ts
import type { TOTP } from "otpauth";
import { totpFromUri } from "../src/test/totp";
```

and these functions at the bottom:

```ts
export async function startTotpEnrolment(page: Page): Promise<TOTP> {
  await page.getByRole("link", { name: "Security" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const uri = (await page.getByTestId("totp-uri").textContent())?.trim() ?? "";
  return totpFromUri(uri);
}

export async function submitTotpCode(page: Page, code: string): Promise<void> {
  await page.getByLabel("Authentication code").fill(code);
  await page.getByRole("button", { name: "Verify and turn on" }).click();
}

export async function enrolTotp(page: Page): Promise<TOTP> {
  const totp = await startTotpEnrolment(page);
  await submitTotpCode(page, totp.generate());
  await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");
  return totp;
}

export async function completeTotpSignIn(page: Page, totp: TOTP): Promise<void> {
  await expect(page).toHaveURL(/\/two-factor$/);
  await page.getByLabel("Authentication code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
}
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `pnpm test:e2e e2e/two-factor.spec.ts`
Expected: FAIL at `getByRole("link", { name: "Security" })`, because there is no Security link yet.

- [ ] **Step 3: Add the Security nav link**

In `apps/web/src/app/(app)/nav-links.tsx`, replace the `LINKS` constant with:

```tsx
const LINKS = [
  { href: "/workspaces", label: "Workspaces" },
  { href: "/settings/security", label: "Security" },
] as const;
```

- [ ] **Step 4: Write the security page and the enrolment component**

`apps/web/src/app/(app)/settings/security/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { TwoFactorSetup } from "./two-factor-setup";

export const metadata: Metadata = { title: "Security · CRM" };

export default async function SecurityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  return (
    <>
      <h1 className="text-2xl font-semibold">Security</h1>
      <section aria-labelledby="two-factor-heading" className="flex max-w-xl flex-col gap-4">
        <h2 id="two-factor-heading" className="text-lg font-semibold">
          Two-factor authentication
        </h2>
        <TwoFactorSetup initiallyEnabled={session.user.twoFactorEnabled === true} />
      </section>
    </>
  );
}
```

`apps/web/src/app/(app)/settings/security/two-factor-setup.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY_ATTEMPTS, WRONG_CODE } from "@/lib/auth/messages";

interface Enrolment {
  totpURI: string;
  setupKey: string;
  backupCodes: string[];
}

export function TwoFactorSetup({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startEnrolment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error: enableError } = await authClient.twoFactor.enable({
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (enableError || !data || !("totpURI" in data)) {
      setError(enableError?.status === 429 ? TOO_MANY_ATTEMPTS : "Your password didn't match. Try again.");
      return;
    }
    setEnrolment({
      totpURI: data.totpURI,
      setupKey: new URL(data.totpURI).searchParams.get("secret") ?? "",
      backupCodes: data.backupCodes,
    });
  }

  async function confirmEnrolment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: verifyError } = await authClient.twoFactor.verifyTOTP({
      code: String(form.get("code") ?? "").trim(),
    });
    setPending(false);
    if (verifyError) {
      setError(verifyError.status === 429 ? TOO_MANY_ATTEMPTS : WRONG_CODE);
      return;
    }
    setEnabled(true);
    router.refresh();
  }

  if (enabled) {
    return (
      <p role="status" className="text-sm">
        Two-factor authentication is on.
      </p>
    );
  }

  if (!enrolment) {
    return (
      <form onSubmit={startEnrolment} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Protect your account with a code from an authenticator app. Confirm your password to start.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          Set up two-factor authentication
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">1. Add this account to your authenticator app</h3>
        <p className="text-sm text-muted-foreground">Enter this setup key in your authenticator app:</p>
        <code className="break-all rounded-md bg-muted p-3 font-mono text-sm">{enrolment.setupKey}</code>
        <details className="text-sm">
          <summary className="cursor-pointer">Show the full setup link</summary>
          <code data-testid="totp-uri" className="mt-2 block break-all rounded-md bg-muted p-3 font-mono">
            {enrolment.totpURI}
          </code>
        </details>
      </div>
      <div className="flex flex-col gap-2">
        <h3 id="recovery-codes-heading" className="font-medium">
          2. Save your recovery codes
        </h3>
        <p className="text-sm text-muted-foreground">
          Each code works once if you lose your authenticator. Store them somewhere safe; they are not shown again.
        </p>
        <ol aria-labelledby="recovery-codes-heading" className="grid grid-cols-2 gap-2 font-mono text-sm">
          {enrolment.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>
      </div>
      <form onSubmit={confirmEnrolment} className="flex flex-col gap-4">
        <h3 className="font-medium">3. Enter the 6-digit code from the app</h3>
        <div className="flex flex-col gap-2">
          <Label htmlFor="totp-code">Authentication code</Label>
          <Input
            id="totp-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          Verify and turn on
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write the 2FA sign-in page**

`apps/web/src/app/(auth)/two-factor/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TwoFactorForms } from "./two-factor-forms";

export const metadata: Metadata = { title: "Two-factor verification · CRM" };

export default function TwoFactorPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Two-factor verification</h1>
      <TwoFactorForms />
    </>
  );
}
```

`apps/web/src/app/(auth)/two-factor/two-factor-forms.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY_ATTEMPTS, WRONG_CODE } from "@/lib/auth/messages";

export function TwoFactorForms() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finish(result: Promise<{ error: { status: number } | null }>, wrongMessage: string) {
    setPending(true);
    setError(null);
    const { error: verifyError } = await result;
    setPending(false);
    if (verifyError) {
      setError(verifyError.status === 429 ? TOO_MANY_ATTEMPTS : wrongMessage);
      return;
    }
    router.push("/workspaces");
    router.refresh();
  }

  function submitAuthenticatorCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    void finish(authClient.twoFactor.verifyTOTP({ code, trustDevice: false }), WRONG_CODE);
  }

  function submitRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("recovery-code") ?? "").trim();
    void finish(
      authClient.twoFactor.verifyBackupCode({ code }),
      "That recovery code didn't work. Check it and try again.",
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section aria-labelledby="authenticator-heading" className="flex flex-col gap-4">
        <h2 id="authenticator-heading" className="text-lg font-semibold">
          Authenticator app
        </h2>
        <form onSubmit={submitAuthenticatorCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="totp-code">Authentication code</Label>
            <Input
              id="totp-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            Verify
          </Button>
        </form>
      </section>
      <section aria-labelledby="recovery-heading" className="flex flex-col gap-4">
        <h2 id="recovery-heading" className="text-lg font-semibold">
          Recovery code
        </h2>
        <form onSubmit={submitRecoveryCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="recovery-code">Recovery code</Label>
            <Input id="recovery-code" name="recovery-code" type="text" autoComplete="off" required />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Use recovery code
          </Button>
        </form>
      </section>
    </div>
  );
}
```

If `pnpm --filter @crm/web typecheck` rejects passing the Better Auth promise to `finish` because the `error` shape differs, inline the two calls instead. Each handler does its own `const { error } = await authClient.twoFactor.…(…)`, followed by the same `setError` and `router.push` lines. Do not cast to `any`.

- [ ] **Step 6: Run the E2E suite, typecheck and lint**

Run: `pnpm test:e2e && pnpm --filter @crm/web typecheck && pnpm lint`
Expected: 4 E2E tests pass (3 auth, 1 two-factor), then typecheck and lint exit 0. Walk the `FRONTEND_STANDARDS.md` self-check for the two new pages.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app apps/web/e2e
git commit -m "feat(web): add TOTP 2FA enrolment with recovery codes and 2FA sign-in step" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Workspaces — create, list, switch

**Files:**
- Create:
  - `packages/core/src/workspace/slug.ts`
  - `apps/web/src/app/(app)/workspaces/create-workspace-form.tsx`
  - `apps/web/src/app/(app)/workspace-switcher.tsx`
- Modify: `packages/core/package.json` (exports), `apps/web/src/app/(app)/workspaces/page.tsx`, `apps/web/src/app/(app)/layout.tsx`
- Test: `packages/core/src/workspace/slug.test.ts`, `apps/web/e2e/workspaces.spec.ts`

**Interfaces:**
- Consumes: `authClient.organization.create({ name, slug })` (the new workspace becomes active) and `authClient.organization.setActive({ organizationId })` (a non-member gets 403, pinned in Task 10). Also `getCurrentSession()` and `listWorkspaces()` (Task 12), and `enrolTotp` and `completeTotpSignIn` (Task 13).
- Produces:
  - `toWorkspaceSlug(name: string, suffix: string): string` from `@crm/core/workspace`
  - a header `<select>` labelled "Active workspace"
  - `/workspaces`, with the list "Your workspaces" and a create form

**Active-workspace design choice:** there is no `databaseHooks.session.create` default. A fresh session has no active workspace, and the header shows "Choose a workspace" until the user picks one. Creating a workspace makes it active, which is Better Auth's default. This keeps Phase 0 free of hidden session mutation. Phase 1's `action()` must refuse to act when `activeOrganizationId` is null. Phase 1 may add "restore last active workspace on sign-in" when `withWorkspace()` lands.

Slug uniqueness is global in Better Auth. A random 8-character suffix avoids collisions and avoids revealing other tenants' names through "slug taken" errors.

- [ ] **Step 1: Write the failing slug test**

`packages/core/src/workspace/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toWorkspaceSlug } from "./slug";

describe("toWorkspaceSlug", () => {
  it("lower-cases and hyphenates the name, then appends the suffix", () => {
    expect(toWorkspaceSlug("Acme Studio", "ab12cd34")).toBe("acme-studio-ab12cd34");
  });

  it("strips accents", () => {
    expect(toWorkspaceSlug("Café Déjà Vu", "ab12cd34")).toBe("cafe-deja-vu-ab12cd34");
  });

  it("trims leading and trailing separators", () => {
    expect(toWorkspaceSlug("  --Hello, World!--  ", "x1")).toBe("hello-world-x1");
  });

  it("falls back to 'workspace' when nothing Latin remains", () => {
    expect(toWorkspaceSlug("工作室", "ab12cd34")).toBe("workspace-ab12cd34");
  });

  it("caps the name part at 40 characters without a dangling hyphen", () => {
    const slug = toWorkspaceSlug(`${"a".repeat(39)} b c d`, "x1");
    expect(slug).toBe(`${"a".repeat(39)}-x1`);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core/src/workspace/slug.test.ts`
Expected: FAIL with `Failed to resolve import "./slug"`.

- [ ] **Step 3: Implement it and export it**

`packages/core/src/workspace/slug.ts`:

```ts
const MAX_NAME_LENGTH = 40;

export function toWorkspaceSlug(name: string, suffix: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/g, "");
  return `${base || "workspace"}-${suffix}`;
}
```

In `packages/core/package.json`, change `exports` to:

```json
"exports": {
  "./password": "./src/password/index.ts",
  "./workspace": "./src/workspace/slug.ts"
}
```

Run: `pnpm vitest run packages/core/src/workspace/slug.test.ts`
Expected: 5 tests pass.

- [ ] **Step 4: Commit the core change**

```bash
git add packages/core
git commit -m "feat(core): add workspace slug generation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Write the failing done-when E2E test**

`apps/web/e2e/workspaces.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { completeTotpSignIn, enrolTotp, respectRateLimit, signIn, signOut, signUp, uniqueEmail } from "./helpers";

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText(name);
}

async function expectActiveWorkspace(page: Page, name: string): Promise<void> {
  await expect(page.getByLabel("Active workspace").locator("option:checked")).toHaveText(name);
}

test("Phase 0 done-when: sign up, 2FA, create two workspaces, switch between them", async ({ page }) => {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  const totp = await enrolTotp(page);
  await signOut(page);
  await respectRateLimit(page);
  await signIn(page, email);
  await completeTotpSignIn(page, totp);

  await expect(page.getByText("You have no workspaces yet.")).toBeVisible();

  await createWorkspace(page, "Studio Alpha");
  await expectActiveWorkspace(page, "Studio Alpha");

  await createWorkspace(page, "Studio Beta");
  await expectActiveWorkspace(page, "Studio Beta");

  await page.getByLabel("Active workspace").selectOption({ label: "Studio Alpha" });
  await expectActiveWorkspace(page, "Studio Alpha");

  await page.reload();
  await expectActiveWorkspace(page, "Studio Alpha");
  await expect(page.getByRole("list", { name: "Your workspaces" }).getByRole("listitem")).toHaveCount(2);
});
```

- [ ] **Step 6: Run the E2E test to verify it fails**

Run: `pnpm test:e2e e2e/workspaces.spec.ts`
Expected: FAIL at `getByText("You have no workspaces yet.")`.

- [ ] **Step 7: Write the create form, the switcher, the page and the layout**

`apps/web/src/app/(app)/workspaces/create-workspace-form.tsx`:

```tsx
"use client";

import { toWorkspaceSlug } from "@crm/core/workspace";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const name = String(new FormData(formElement).get("name") ?? "").trim();
    if (!name) {
      setError("Enter a workspace name.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: createError } = await authClient.organization.create({
      name,
      slug: toWorkspaceSlug(name, crypto.randomUUID().slice(0, 8)),
    });
    setPending(false);
    if (createError) {
      setError("We couldn't create that workspace. Try again.");
      return;
    }
    formElement.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input id="workspace-name" name="name" type="text" autoComplete="organization" required maxLength={80} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Create workspace
      </Button>
    </form>
  );
}
```

`apps/web/src/app/(app)/workspace-switcher.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

interface WorkspaceOption {
  id: string;
  name: string;
}

export function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: WorkspaceOption[]; activeId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (workspaces.length === 0) return null;

  async function onChange(event: ChangeEvent<HTMLSelectElement>) {
    setPending(true);
    setError(null);
    const { error: switchError } = await authClient.organization.setActive({ organizationId: event.target.value });
    setPending(false);
    if (switchError) {
      setError("Couldn't switch workspace. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="workspace-switcher">Active workspace</Label>
      <select
        key={activeId ?? "none"}
        id="workspace-switcher"
        defaultValue={activeId ?? ""}
        onChange={onChange}
        disabled={pending}
        aria-describedby={error ? "workspace-switcher-error" : undefined}
        className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {activeId === null && (
          <option value="" disabled>
            Choose a workspace
          </option>
        )}
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      {error && (
        <p id="workspace-switcher-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

Replace `apps/web/src/app/(app)/workspaces/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata: Metadata = { title: "Workspaces · CRM" };

export default async function WorkspacesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const workspaces = await listWorkspaces();
  const activeId = session.session.activeOrganizationId ?? null;

  return (
    <>
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <section aria-labelledby="your-workspaces-heading" className="flex flex-col gap-3">
        <h2 id="your-workspaces-heading" className="text-lg font-semibold">
          Your workspaces
        </h2>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no workspaces yet.</p>
        ) : (
          <ul aria-labelledby="your-workspaces-heading" className="flex flex-col gap-2">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <span>{workspace.name}</span>
                {workspace.id === activeId && <span className="text-xs text-muted-foreground">(active)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="create-workspace-heading" className="flex max-w-md flex-col gap-3">
        <h2 id="create-workspace-heading" className="text-lg font-semibold">
          Create a workspace
        </h2>
        <CreateWorkspaceForm />
      </section>
    </>
  );
}
```

Replace `apps/web/src/app/(app)/layout.tsx` with:

```tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const workspaces = await listWorkspaces();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <NavLinks />
          <div className="flex flex-wrap items-center gap-4">
            <WorkspaceSwitcher
              workspaces={workspaces.map(({ id, name }) => ({ id, name }))}
              activeId={session.session.activeOrganizationId ?? null}
            />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 8: Run the full E2E suite, typecheck, lint and tests**

Run: `pnpm test:e2e && pnpm typecheck && pnpm lint && pnpm test`
Expected:
- 5 E2E tests pass, including "Phase 0 done-when".
- typecheck and lint exit 0.
- All Vitest projects pass.

Walk the `FRONTEND_STANDARDS.md` self-check. The workspace list is a `<ul>` whose accessible name comes from its heading, and the switcher is a labelled native `<select>` that works with the keyboard.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app apps/web/e2e
git commit -m "feat(web): create, list and switch workspaces with the organization plugin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: PR 3 checkpoint**

Push `feat/p0-auth-ui`, open PR 3 (include a screenshot or short description of each page, plus the FRONTEND_STANDARDS 3-bullet summary), and **stop for review.** Task 15 starts on `feat/p0-runtime` from the updated `main`.

---

### Task 15: Worker stub and Node bundles

**Files:**
- Create: `apps/web/src/worker/start.ts`, `apps/web/worker.ts`, `apps/web/scripts/build-node.mjs`
- Modify: `apps/web/package.json`
- Test: `apps/web/src/worker/start.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 6) and `apps/web/migrate.ts` (Task 9).
- Produces:
  - `startWorker(sql: postgres.Sql, log?: (line: string) => void): Promise<WorkerHandle>`, which logs `{"level":"info","msg":"worker ready"}`
  - `interface WorkerHandle { stop(): Promise<void> }`
  - `apps/web/dist/worker.mjs` and `apps/web/dist/migrate.mjs` (self-contained ESM bundles)
  - the scripts `build` (Next + bundles), `build:node` and `worker:dev`

This is a deliberate stub. pg-boss job consumption and Pino logging are Phase 1, so neither is a dependency here. Logging is one JSON line per event through `console.log`.

- [ ] **Step 0: Start the PR 4 branch**

Use `git switch -c` only if the branch does not exist yet (one branch per PR, from the updated `main`):

```bash
git switch main && git pull --ff-only
git switch feat/p0-runtime 2>/dev/null || git switch -c feat/p0-runtime
git merge-base --is-ancestor main HEAD
```

Expected: the last command exits 0. If not, **stop and ask Charlie**.

- [ ] **Step 1: Write the failing test**

`apps/web/src/worker/start.test.ts`:

```ts
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres } from "../test/postgres";
import { startWorker } from "./start";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await startPostgres();
});

afterAll(async () => {
  await container?.stop();
});

describe("startWorker", () => {
  it("logs readiness once the database answers and stops cleanly", async () => {
    const lines: string[] = [];
    const worker = await startWorker(postgres(container.getConnectionUri(), { max: 2 }), (line) => lines.push(line));
    expect(lines).toEqual([JSON.stringify({ level: "info", msg: "worker ready" })]);

    await worker.stop();
    expect(lines.at(-1)).toBe(JSON.stringify({ level: "info", msg: "worker stopped" }));
  });

  it("fails fast instead of reporting ready when the database is unreachable", async () => {
    const lines: string[] = [];
    const sql = postgres("postgres://nobody:nothing@127.0.0.1:1/none", { max: 1, connect_timeout: 2 });
    await expect(startWorker(sql, (line) => lines.push(line))).rejects.toThrow();
    expect(lines).toEqual([]);
    await sql.end();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/worker/start.test.ts`
Expected: FAIL with `Failed to resolve import "./start"`.

- [ ] **Step 3: Write the implementation and the entry**

`apps/web/src/worker/start.ts`:

```ts
import type postgres from "postgres";

export interface WorkerHandle {
  stop(): Promise<void>;
}

type Log = (line: string) => void;

function info(log: Log, msg: string): void {
  log(JSON.stringify({ level: "info", msg }));
}

export async function startWorker(sql: postgres.Sql, log: Log = console.log): Promise<WorkerHandle> {
  await sql`select 1`;
  // No jobs until pg-boss lands in Phase 1; the timer keeps the process alive the way a consumer loop will.
  const keepAlive = setInterval(() => {}, 60_000);
  info(log, "worker ready");
  return {
    async stop() {
      clearInterval(keepAlive);
      await sql.end({ timeout: 5 });
      info(log, "worker stopped");
    },
  };
}
```

`apps/web/worker.ts`:

```ts
import postgres from "postgres";
import { getEnv } from "./src/lib/env";
import { startWorker } from "./src/worker/start";

async function main(): Promise<void> {
  const worker = await startWorker(postgres(getEnv().DATABASE_URL, { max: 2 }));
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void worker.stop().then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/web/src/worker/start.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Add the esbuild bundle step**

In `apps/web/package.json`:
- add `"esbuild": "0.28.2"` to `devDependencies`
- replace the `build` script and add two scripts:

```json
"build": "next build && node scripts/build-node.mjs",
"build:node": "node scripts/build-node.mjs",
"worker:dev": "tsx --env-file=../../.env worker.ts"
```

`apps/web/scripts/build-node.mjs`:

```js
import { build } from "esbuild";

await build({
  entryPoints: ["worker.ts", "migrate.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
```

Run: `pnpm install && pnpm --filter @crm/web build:node && ls apps/web/dist`
Expected: `migrate.mjs` and `worker.mjs`.

- [ ] **Step 6: Run the bundles against the dev database**

The compose Postgres must be running.

Run: `cd apps/web && node --env-file=../../.env dist/migrate.mjs && cd ../..`
Expected: `{"level":"info","msg":"migrations applied"}`.

Run: `cd apps/web && (node --env-file=../../.env dist/worker.mjs & PID=$!; sleep 3; kill -TERM $PID; wait $PID); cd ../..`
Expected: `{"level":"info","msg":"worker ready"}`, then `{"level":"info","msg":"worker stopped"}`, then exit 0.

- [ ] **Step 7: Typecheck, lint and commit**

Run: `pnpm --filter @crm/web typecheck && pnpm lint`
Expected: both exit 0.

```bash
git add apps/web/src/worker apps/web/worker.ts apps/web/scripts/build-node.mjs apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add worker entry stub and esbuild bundles for worker and migrations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Docker image, entrypoint and dev compose

**Files:**
- Create: `docker/Dockerfile`, `docker/entrypoint.sh`, `.dockerignore`
- Modify: `docker/compose.dev.yml` (add `web` and `worker`)

**Interfaces:**
- Consumes: the `@crm/web` `build` script (Tasks 3 and 15), `dist/migrate.mjs`, `dist/worker.mjs`, `drizzle/` and `/api/health`.
- Produces:
  - the image `crm-app:dev`, whose entrypoint takes `web | worker | migrate`
  - `docker compose -f docker/compose.dev.yml up` (postgres + web + worker; each app container migrates first)
  - Review Focus #4 and #5, verified on the real image

- [ ] **Step 1: Write `.dockerignore`**

```
**/node_modules
**/.next
**/dist
**/coverage
**/playwright-report
**/test-results
.git
.andy
.claude
.env
.env.*
!.env.example
```

- [ ] **Step 2: Write `docker/entrypoint.sh`**

```sh
#!/bin/sh
set -eu

case "${1:-web}" in
  web)
    node dist/migrate.mjs
    exec node server.js
    ;;
  worker)
    node dist/migrate.mjs
    exec node dist/worker.mjs
    ;;
  migrate)
    exec node dist/migrate.mjs
    ;;
  *)
    exec "$@"
    ;;
esac
```

- [ ] **Step 3: Write `docker/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:24.21.0-alpine AS base
RUN npm install -g pnpm@11.6.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @crm/web build

FROM node:24.21.0-alpine AS runtime
# The runtime runs only `node`; removing the bundled package managers shrinks the scanned surface.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=UTC
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/dist ./apps/web/dist
COPY --from=build /repo/apps/web/drizzle ./apps/web/drizzle
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
WORKDIR /app/apps/web
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["web"]
```

- [ ] **Step 4: Add `web` and `worker` to `docker/compose.dev.yml`**

Replace the file with:

```yaml
name: crm-dev

x-app: &app
  image: crm-app:dev
  env_file:
    - path: ../.env
      required: true
  environment:
    DATABASE_URL: postgres://crm:crm@postgres:5432/crm
    DATABASE_MIGRATOR_URL: postgres://crm:crm@postgres:5432/crm
  read_only: true
  tmpfs:
    - /tmp
  depends_on:
    postgres:
      condition: service_healthy

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm
      POSTGRES_DB: crm
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm -d crm"]
      interval: 2s
      timeout: 3s
      retries: 30

  web:
    <<: *app
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: ["web"]
    ports:
      - "127.0.0.1:3000:3000"
    tmpfs:
      - /tmp
      - /app/apps/web/.next/cache:mode=1777
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
      interval: 5s
      timeout: 5s
      retries: 24
      start_period: 10s

  worker:
    <<: *app
    pull_policy: never
    command: ["worker"]

volumes:
  pgdata:
```

- [ ] **Step 5: Build the image**

Stop any `pnpm dev` server first, because it holds port 3000.

Run: `docker compose -f docker/compose.dev.yml build`
Expected: the build succeeds and tags `crm-app:dev`.

- [ ] **Step 6: Review Focus #4 — a missing `.env` fails fast**

Run: `mv .env .env.held && docker compose -f docker/compose.dev.yml up -d; echo "exit=$?"; mv .env.held .env`
Expected: `env file …/CRM/.env not found: stat …: no such file or directory` and `exit=1`. No container starts.

- [ ] **Step 7: Review Focus #4 — a blank `AUTH_SECRET` fails fast without leaking values**

Run: `cp .env .env.held && sed -i '' 's/^AUTH_SECRET=.*/AUTH_SECRET=/' .env && docker compose -f docker/compose.dev.yml up -d --wait web; echo "exit=$?"; docker compose -f docker/compose.dev.yml logs web | tail -5; mv .env.held .env; docker compose -f docker/compose.dev.yml down`
Expected:
- `exit=1`.
- The web logs show `Invalid environment configuration:` and `AUTH_SECRET: must be at least 32 characters`.
- No secret value or DB password appears in the logs.

- [ ] **Step 8: Review Focus #5 — first boot on an empty database, `web` and `worker` racing**

Run: `docker compose -f docker/compose.dev.yml down -v && docker compose -f docker/compose.dev.yml up -d --wait && docker compose -f docker/compose.dev.yml logs web worker | grep -c '"migrations applied"' && docker compose -f docker/compose.dev.yml logs worker | grep '"worker ready"' && curl -s http://localhost:3000/api/health`
Expected:
- `up --wait` reports postgres and web `Healthy` and worker `Started`.
- The grep count is `2`.
- The worker logged `{"level":"info","msg":"worker ready"}`.
- Health returns `{"status":"ok","db":"ok"}`.

Run: `docker compose -f docker/compose.dev.yml ps --format '{{.Service}} {{.Status}}'`
Expected: all three services are `Up`, and none shows `Restarting`.

- [ ] **Step 9: Check the container is non-root and read-only**

Run: `docker compose -f docker/compose.dev.yml exec web id -u; docker compose -f docker/compose.dev.yml exec web sh -c 'touch /app/probe' ; echo "exit=$?"`
Expected: `1000`, then `touch: /app/probe: Read-only file system` and `exit=1`.

- [ ] **Step 10: Run the full E2E suite against the production image**

Run: `E2E_BASE_URL=http://localhost:3000 E2E_RATE_LIMITED=1 pnpm test:e2e`
Expected: 5 tests pass. This run is slower because of the rate-limit waits, and it proves Argon2id's native binding, sessions and 2FA inside the Alpine image.

- [ ] **Step 11: Commit**

```bash
git add docker .dockerignore
git commit -m "feat: add single runtime image for web and worker with dev compose running migrations first" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: CI image job (Trivy + compose + E2E) and project commands

**Files:**
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`

**Interfaces:**
- Consumes: the `checks` job (Task 5), the compose stack (Task 16) and the Playwright suite (Tasks 12–14).
- Produces: the CI `image` job, which builds the image, runs a Trivy scan (CRITICAL and HIGH, fixed-only, blocking), boots the stack and runs E2E against it. It also fills in the `CLAUDE.md` "Commands" section.

- [ ] **Step 1: Scan the local image with the same Trivy settings CI will use**

Run: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.74.0 image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 crm-app:dev; echo "exit=$?"`
Expected: `exit=0`. If findings are reported, **stop and list them for Charlie and Bob** (package, CVE, fixed version, and which layer brings it in). Do not add a `.trivyignore` without their approval.

- [ ] **Step 2: Add the `image` job to `.github/workflows/ci.yml`**

Append under `jobs:`:

```yaml
  image:
    name: Image, Trivy, E2E
    runs-on: ubuntu-24.04
    needs: checks
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Write CI .env
        run: |
          {
            echo "DEPLOYMENT_MODE=selfhost"
            echo "APP_URL=http://localhost:3000"
            echo "AUTH_SECRET=$(openssl rand -base64 32)"
            echo "DATABASE_URL=postgres://crm:crm@localhost:5433/crm"
            echo "DATABASE_MIGRATOR_URL=postgres://crm:crm@localhost:5433/crm"
          } > .env
      - name: Build image
        run: docker compose -f docker/compose.dev.yml build
      - name: Trivy scan
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          version: v0.74.0
          image-ref: crm-app:dev
          severity: CRITICAL,HIGH
          ignore-unfixed: true
          exit-code: "1"
          format: table
      - name: Start stack (migrations, web, worker)
        run: docker compose -f docker/compose.dev.yml up -d --wait
      - name: Install Playwright Chromium
        run: pnpm --filter @crm/web exec playwright install --with-deps chromium
      - name: E2E against the image
        env:
          E2E_BASE_URL: http://localhost:3000
          E2E_RATE_LIMITED: "1"
        run: pnpm test:e2e
      - name: Stack logs
        if: failure()
        run: docker compose -f docker/compose.dev.yml logs
      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: playwright-report
          path: apps/web/playwright-report
          retention-days: 7
```

- [ ] **Step 3: Fill in `CLAUDE.md` → "Commands"**

Replace the body of the `## Commands` section (the interim text and table added after PR 1) with:

````markdown
Node 24.21.0 (`.nvmrc`, via fnm; in agent shells run `eval "$(fnm env --use-on-cd --shell zsh)"` first) and pnpm 11.6.0. The single `.env` lives at the repo root (copy `.env.example`; `AUTH_SECRET` via `openssl rand -base64 32`).

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Typecheck | `pnpm typecheck` |
| Lint (incl. boundaries) | `pnpm lint` |
| Unit + integration tests (Docker running) | `pnpm test` · one file: `pnpm vitest run <path>` |
| E2E vs dev server (starts `pnpm dev`) | `pnpm test:e2e` |
| E2E vs the image | `pnpm stack:up` then `E2E_BASE_URL=http://localhost:3000 E2E_RATE_LIMITED=1 pnpm test:e2e` |
| Dev Postgres only | `docker compose -f docker/compose.dev.yml up -d --wait postgres` |
| Apply migrations (host) | `pnpm db:migrate` |
| New migration after schema change | `pnpm db:generate --name <change>` |
| Regenerate Better Auth schema | `pnpm --filter @crm/web auth:generate` then `pnpm db:generate --name <change>` |
| Dev server / worker | `pnpm dev` · `pnpm worker:dev` |
| Full stack (migrations → web + worker) | `pnpm stack:up` (= `docker compose -f docker/compose.dev.yml up --build -d --wait`) · stop: `pnpm stack:down` |
````

In the `## Status` section, replace the bullets with:

```markdown
Phase 0 (Foundation) implemented per `docs/superpowers/plans/2026-09-29-phase-0-foundation.md`. Next: Phase 1 plan (tenancy, five roles, RLS, pg-boss + transactional events), once Charlie has picked the VPS provider.
```

- [ ] **Step 4: Run the full local gate once more**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm audit --audit-level high`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml CLAUDE.md
git commit -m "ci: build the image, scan it with Trivy and run E2E against the compose stack" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: PR 4 checkpoint — Phase 0 done**

Push `feat/p0-runtime`, open PR 4, and confirm all four CI jobs (`checks`, `audit`, `secrets`, `image`) are green. Paste the green `Phase 0 done-when` Playwright line into the PR description. **Stop for Bob's review and Charlie's merge.** After merge, write `log/2026-09-29_PR<N>_phase-0-<slug>.md` for each merged PR (a hard gate in `init_andy.md`) and update `.andy/handoff.md`.

---

## Self-review (done while writing; kept for the reviewer)

**Spec coverage (Phase 0 row):**

| Requirement | Where it is covered |
|---|---|
| Monorepo (pnpm workspaces) | Task 1 |
| Next.js + TS | Task 3 |
| Drizzle + Postgres | Tasks 7 and 9 |
| Better Auth | Tasks 8, 10, 12, 13 and 14 |
| Docker image (`web` / `worker`) | Tasks 15 and 16 |
| Dev compose | Tasks 7 and 16 |
| CI: typecheck, lint + boundaries, tests, `pnpm audit`, secret scan | Tasks 4 and 5 |
| CI: Trivy | Task 17 |
| Done-when: sign up, 2FA, create 2 workspaces, switch | `e2e/workspaces.spec.ts` (Task 14), run in CI against the image (Task 17) |
| Done-when: `docker compose up` runs web + worker + migrations | Task 16 Step 8 and the Task 17 `image` job |

Other spec rules Phase 0 touches, and where each is honoured:
- Argon2id: Task 2, with the storage check in Task 10.
- Uniform sign-up response: Task 10.
- TOTP with 10 recovery codes: Tasks 10 and 13.
- `core` boundaries: Task 4.
- `postgres` TCP driver only: Task 7.
- Migrations run by the entrypoint: Task 16.
- Non-root, read-only runtime: Task 16.
- `/api/health` as the only unauthenticated app route: Task 11.
- No PII in logs: Task 8 logger level; Task 11 hides errors.
- Timestamps in UTC: `timestamptz` in Task 9 and `TZ=UTC` in the image.
- Env-only secrets: Task 6.

Spec items deliberately left to Phase 1 are listed under **Architecture**.

**Placeholder scan:**
- No "TBD" or "TODO" markers, and no "similar to Task N".
- `src/db/schema/auth.ts` = `export {};` in Task 7 is an intentional empty module that Task 9 overwrites. It is explained where it is created.

**Type consistency:** these names and signatures match everywhere they appear:
- `createDb` / `DbHandle` / `Database`
- `createAuth(AuthDeps)` / `Auth` / `getAuth()`
- `runMigrations(url, folder)`
- `checkHealth(ping, timeoutMs?)`
- `startWorker(sql, log?)`
- `totpFromUri` / `wrongTotpCode`
- `toWorkspaceSlug(name, suffix)`
- `getCurrentSession` / `listWorkspaces`
- the E2E helpers `signUp` / `signIn` / `signOut` / `startTotpEnrolment` / `submitTotpCode` / `enrolTotp` / `completeTotpSignIn` / `respectRateLimit`

**Review Focus:** each of the five items has its test inside the owning task:
- #1: Task 10 Step 2 and Task 12 Step 3
- #2: Task 10 Step 2 and Task 13 Step 1
- #3: Task 10 Step 2
- #4: Task 6 Step 2 and Task 16 Steps 6–7
- #5: Task 9 Step 7 and Task 16 Step 8
