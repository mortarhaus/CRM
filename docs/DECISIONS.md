# Decisions log

<!-- Committed. Newest at the top. One entry per decision. A settled decision is reopened only by the owner. -->


## 2026-10-03 — braces audit exception (GHSA-vfj7-8cjw-p6xm), expiring
- **Decision:** `pnpm audit --audit-level high` ignores only `GHSA-vfj7-8cjw-p6xm` (`braces` stack-exhaustion DoS, CVE-2026-93687, versions <= 3.0.3). The ignore lives in `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`. The CI audit job is unchanged: no `--prod`, and every other advisory at high or above still fails the job (checked 2026-10-03: with a different ID in the ignore list the audit exits 1).
- **Why:** No patched `braces` exists: the advisory lists no first patched version and the npm latest is 3.0.3 (`npm view braces versions --json`, checked 2026-10-03). `main` has failed the audit job since 2026-10-03, so every PR is blocked. `braces` is reached only through dev tooling (`eslint-plugin-boundaries` and `@next/eslint-plugin-next`, both devDependencies); it is not in the production dependency tree (`pnpm why braces --prod` prints nothing).
- **Alternatives rejected:** Leave `main` red (blocks every PR); drop the two ESLint plugins (loses the package-boundary lint rule, UNI-04); `--prod` audit (stops checking dev tooling).
- **Scope / affects:** `pnpm-workspace.yaml`, `.github/workflows/ci.yml` (audit job unchanged), rule UNI-13.
- **Versions:** braces 3.0.3; micromatch 4.0.8; pnpm 11.6.0
- **Exception to a rule?** UNI-13 (failing audit blocks merge). Compensating controls: ignore is one advisory ID; dev-only chain; production image must not contain `braces` (Phase 0 PR 4 image job asserts this once the Dockerfile exists; until then no production image exists).
- **Expiry / recheck:** Recheck at **every phase gate**, and **when a patched `braces` ships** (then remove the ignore and update the lockfile in the same PR). Remove the ignore if the advisory is withdrawn or the dependency chain changes.
- **Decided by:** owner (Charlie, 2026-10-03: "A, with conditions")
