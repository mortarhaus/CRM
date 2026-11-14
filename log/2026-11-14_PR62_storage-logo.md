# PR 62 — feat: Phase 2 PR 4: storage adapter, MinIO fork in compose, logo upload

- **Merged:** 2026-11-14T12:36:31Z · **Merge commit:** 8a1e95cb06403d21fad6df768eabb8bab2c75d46 · **Branch:** feat/p2-storage-logo
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-62.receipt` on agent-logs (log-branch commit 2d6eedb9 holds the review; written 2026-11-14T12:34:16Z, before the merge; head 1c48a22, review-file hash da40329c…)
- **Merge evidence:** `gh pr view 62` state MERGED with the time and commit above; commit reachable from fetched `origin/main`. Final head 1c48a22 equals the reviewed head. All five CI jobs green on 1c48a22 (run 43467901105, re-run after the repo was made public; image job 51m25s).
- **Drafted by:** Sonnet 5.5 builder (Opus 5.5 subagent built the code and the R1 fixes) · **Final verdict:** Approved (round 4)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 rev 8) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` Tasks 10-12 · **Milestone:** Phase 2, PR 4

## What changed
S3-compatible storage adapter (`put`, `get`, `head`; no delete, no signed URLs), all-or-none `STORAGE_*` settings, MinIO (`pgsty/minio` community fork pinned by digest) in dev compose and Testcontainers, upload validation by magic bytes, and logo upload on `/settings/branding` (Admin and Owner, through `action()`, audited, works without JavaScript) with a same-origin `GET /files/logo?id=` route. `LOGO_MAX_BYTES` = 2 MiB; server-action body limit raised to fit it. One new dependency, `@aws-sdk/client-s3` exact `3.1158.0`. Runbook `docs/runbooks/phase-2-storage.md`, DECISIONS 2026-11-11.

## Why
Phase 2 plan PR 4; Q12 (2 MB PNG/JPG) and Q13 (same-origin route); spec Branding lines 846 and 1138.

## Review rounds
- R1: [P1] conflict with main → merged main, DECISIONS keeps both sides.
- R1: [P1] R2 provider reopened without a spec revision → docs state Cloudflare R2 as selected (approved spec), R2 verification is a pre-deployment check; Charlie's 2026-11-12 "R2 or S3" wording kept as recorded, owner can reopen only by a spec revision.
- R1: [P1] logo `<img>` without dimensions and incomplete self-check → `width=192 height=96` + e2e assertion; full self-check table.
- R1: [P2] signed URL cannot guarantee FILE-04 `nosniff` → `signedGetUrl` and the presigner dependency removed (plan Task 10 deviation recorded).
- R1: [P2] any 404 treated as a missing object → only `NoSuchKey` is `null`; missing bucket throws `StorageError`; HEAD falls back to GET to tell them apart; contract tests.
- R1: [P3] reviewer-addressed prose → role-neutral wording.
- R2: [P1] CI did not run (billing failure on the org) → repo made public, checks re-run, all five green.
- R2/R3: [P1] self-check missing FE-05, FE-34, A11Y-02 → rows added to the PR body with evidence (no code change).
- R4: Approved.

## Deferred conditions
none

## Decisions worth keeping
- Cloudflare R2 is the production provider (approved spec); the adapter stays S3-compatible; R2 verification (conditional put, headers, bucket errors) is a pre-deployment check. A signed download path needs a controlled same-origin or edge response (expiry ≤ 10 min, attachment, `nosniff`) and is built when first needed.
- MinIO community fork is dev and test only; revisit before the first real deployment.
- Repo hosting: Charlie's standing rule is to make the repo public while a PR needs CI and private again after merge (Actions quota).

## Follow-ups
- Make the repo private (done at `merged 62`); update `agents/PROJECT.md` §4 Remote (now `https://github.com/mortarhaus/CRM`) and add a DECISIONS entry for the public-during-PR rule, in the next docs PR.
- Deflake `apps/web/src/jobs/boss.test.ts:118` (own PR; diagnose first).
- Spec line 730 (MY `dd/mm/yyyy` to `dd-mmm-yyyy`) before Phase 2 closes.
- Remaining Phase 2 plan PRs 5-8.
- Charlie's decisions still open: ASK 7 (`EMAIL_FROM`/SPF/DKIM/DMARC), ASK 9 (`require_2fa` timing).

## Appendix — final review round
## Round 4 — 2026-11-14 · scope: slice
- **Code review:** base (merge base) `9cf13937c344a9fba2ca7a1988e35103934e5e86` · head `1c48a22898b143e4e5e5b717a43293c6da81332d` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · approved v4.7 revision 8 · hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`

**Verdict:** Approved
**Model used:** GPT-6.1 Sol · **Switch model next step?** No — next step is the mechanical approval archive/receipt procedure.

### Findings

No blocking findings. Round 3's remaining P1 is resolved by the updated PR body; no source commit changed.

### Self-check audit

Applicability and prior code conclusions are carried forward from Rounds 1–3 because the head is unchanged. The revised self-check was read and its three new assessments independently checked.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| FE-05 | yes — submit action | pass | resolved; project Button renders a native button with focus-visible styling; logo E2E asserts result focus | `logo-form.tsx:105`, `components/ui/button.tsx`; successful CI logo tests | no |
| FE-34 | yes — server reads and image cache | pass | resolved; reads happen at server boundaries; private one-hour cache is explicit; replacement uses a new UUID URL; a fresh request for an old key is refused | `files/logo/route.ts:23-26,41-42`, branding page and upload key code | no |
| A11Y-02 | yes — hint/error/button states | pass | resolved; evidence matches actual light/dark axe scans with WCAG AA contrast enabled for rendered-logo and refused-logo states | `e2e/a11y.ts:5-32`, `e2e/logo.spec.ts:92,103`, existing semantic tokens; CI log confirms both tests at all three widths | no |
| UNI-13 | yes — code PR | pass | all five CI jobs successful for reviewed head | run `43467901105` | no |
| Other applicable rules | unchanged from earlier rounds | unchanged | no remaining disagreement; previous fixes remain resolved | identical head; prior source review and local checks; full CI | no |
| Other ticked packs | unchanged n-a reasons from earlier rounds | unchanged | no additional domain surface | identical head | no |

### Verification performed

| Command / check | Result |
|---|---|
| Fetch; pinned detached checkout HEAD, merge base, tracked/staged integrity | reviewed head remains `1c48a228…`; current main/merge base `9cf13937…`; tracked/staged checkout clean |
| Complete PR body read; explicit FE-05/FE-34/A11Y-02 row check | all three present with current-head evidence |
| Button/form, route/cache, axe helper, logo E2E and color-token source inspection | cited evidence matches implementation and test configuration |
| GitHub CI metadata | Typecheck/lint/test, audit, secret scan, changed-files and Image/Trivy/E2E all successful at reviewed SHA |
| CI image-job log | all 15 logo cases pass across desktop, 768 and 320; full E2E summary: 212 passed, 10 skipped |
| `git diff --check origin/main...HEAD` | pass |
| Spec hash | unchanged approved hash `733cc0e9…` |
| Final GitHub head/state check | unchanged reviewed SHA; OPEN, MERGEABLE / CLEAN |

No local tests repeated for this PR-body-only correction. Round 2's local typecheck, lint and 109 focused tests remain applicable; full CI now covers the same head.

### Residual risks and test gaps
- This is approval of the Phase 2 storage/logo slice, not production readiness. R2 verification and MinIO fork reassessment remain the documented pre-deployment checks.
- The reviewer inspected browser-test source and CI execution evidence; no additional manual browser pass was performed.
- The retained detached review checkout and its disposable cache from Round 2 remain at `.agent/worktrees/review-62-1c48a228`; tracked files are clean. No new test artifacts were created this round.

### Required before merge
- No remaining code-review corrections. Run `approved 62` to archive the complete review and write the approval receipt before Charlie merges. Approval applies only to the head recorded above.

### Deferred conditions
- None.

### Optional improvements
- Clarify the older MinIO release in the PR's historical conditional-put bullet when convenient; the current fork pin and successful contract evidence are explicit elsewhere.
