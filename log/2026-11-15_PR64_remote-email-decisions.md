# PR 64 — docs: remote back to mortarhaus/CRM, public-during-PR rule, email and 2FA decisions

- **Merged:** 2026-11-15T07:50:31Z · **Merge commit:** 107163bdbcba20f0ca9228225b4566acf64d19d2 · **Branch:** docs/remote-email-decisions
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-64.receipt` on agent-logs (log-branch commit 28537ff1 holds the review; written 2026-11-15T07:50:07Z, before the merge; head 7a463cd, review-file hash ac3238da…)
- **Merge evidence:** `gh pr view 64` state MERGED with the time and commit above; commit reachable from fetched `origin/main`. Final head 7a463cd equals the reviewed head. Checks green on 7a463cd (run 43683816029); the image job was skipped by the docs-only rule.
- **Drafted by:** Sonnet 5.5 builder · **Final verdict:** Approved (round 3)
- **Spec:** none (no spec text changed) · **Plan:** `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md` Q19 · **Milestone:** Phase 2 (housekeeping)

## What changed
Docs only. Two DECISIONS entries: 2026-11-15 (ASK 7: email through Resend, DNS on Cloudflare, sender `no-reply@mortarhaus.com`, owner sets SPF/DKIM/DMARC before the first real send; ASK 9: `require_2fa` enforced in Phase 2 PR 5 with step-up) and 2026-11-14 (remote back to `mortarhaus/CRM`; repo private by default, public while a PR needs CI, private again in `merged <n>`). `agents/PROJECT.md` §4 Remote updated; `docs/runbooks/phase-1-security.md` carries the settled ASK 7 values and a pre-send DNS gate.

## Why
Charlie's answers of 2026-11-14 and 2026-11-15. Phase 2 PR 5 needs ASK 7 and ASK 9 settled; PR #62's deferred remote-line follow-up closes here.

## Review rounds
- R1: [P2] secret-scan scope misdescribed (said no history-wide scan) → DECISIONS describes the full-history gitleaks scan with observed runs (566 commits on 2026-11-12 while private, 580 on PR 64), separates timing from coverage, and says a pattern scan proves nothing about other confidential data.
- R1: [P2] email runbook still left ASK 7 open (UNI-16 marked n-a) → runbook updated with Resend, the mailbox, Cloudflare DNS and a no-send-before-DNS gate; UNI-16 applicable in the self-check.
- R2: same two findings carried (head unchanged); R3: Approved.

## Deferred conditions
none

## Decisions worth keeping
- Repo hosting rule: private by default; public while any PR needs CI; private after the last open PR merges. While public, source and history can be cloned; going private does not recall copies. No scan is run as a gate before a flip; CI's gitleaks scans full history on every run.
- Production email: Resend, `no-reply@mortarhaus.com`; display name and exact DNS record values still pending.
- First observed docs-only skip: the image job was skipped on this PR's runs (proof for DECISIONS 2026-11-12).

## Follow-ups
- Repo made private again at `merged 64` (no other PR open).
- Deflake `apps/web/src/jobs/boss.test.ts:118` (failed CI again on this PR's first run; own PR, diagnose first).
- Spec line 730 revision before Phase 2 closes.
- Phase 2 PR 5 (EMAIL_FROM from `no-reply@mortarhaus.com`, `require_2fa` enforcement with step-up); the `EMAIL_FROM` display name is still undecided (Charlie).
- Remove merged worktrees (`build-feat-p2-storage-logo`, `build-ci-skip-image-docs`, `build-docs-remote-email`) once Charlie agrees.

## Appendix — final review round
## Round 3 — 2026-11-15 · scope: slice
- **Code review:** base (merge base) `8a1e95cb06403d21fad6df768eabb8bab2c75d46` · head `7a463cd809ab8ccc685c7571c293dec426de47d5` · head re-checked at end: yes
- **Spec review:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · approved v4.7 revision 8 · hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`

**Verdict:** Approved
**Model used:** GPT-6.1 Sol · **Switch model next step?** No — next step is the mechanical approval archive/receipt procedure.

### Findings

No blocking findings. Both before-merge P2 findings from Rounds 1–2 are resolved.

### Previous findings rechecked

| Finding | Result and evidence |
|---|---|
| Incorrect secret-scan scope/timing | Resolved. `docs/DECISIONS.md:18` now describes full fetched-history gitleaks coverage, cites the 566-commit and 580-commit scans, distinguishes a scan preceding publication from a dedicated pre-publication gate, and states the limits of pattern-based scanning. PR body agrees. Historical run `43261080629` was independently checked: created 2026-11-12, Secret scan successful, log confirms 566 commits and no leaks. The 580-commit evidence was checked in Round 1. |
| ASK 7 missing from runbook / UNI-16 self-check | Resolved. `docs/runbooks/phase-1-security.md:168,188-192` records the selected mailbox, Resend, Charlie's Cloudflare DNS responsibility, and a pre-send verification gate. It preserves `Name <address>` formatting and explicitly leaves display name/exact DNS values pending. The PR self-check now marks UNI-16 pass and cites these updates. |

### Self-check audit

The applicability inventory from Round 1 remains valid; the added runbook correction brings UNI-16 into conformance without introducing runtime behavior.

| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-02 / UNI-07 | yes — recorded settings and potentially public documents | pass | no invented sender/display-name value and no secret in added text | owner decision, explicit pending display name, added-line scan, CI secret scan | no |
| UNI-11 | yes — authorization record for services/source visibility | pass | previously reviewed authorization/trade-off wording retained | full diff | no |
| UNI-13 | yes — delivery gate | pass | checks/audit/secrets/classifier successful at this head; image skip justified | run 43683816029 and local classifier false | no |
| UNI-14/15 | n-a — no dependency/tooling/migration change | n-a | n-a | documentation-only diff | no |
| UNI-16 | yes — operational email/domain choices | pass | runbook now agrees with decision; remaining configuration work explicit | phase-1-security.md update | resolved |
| Auth/spec consistency | timing/requirement consistency only; no auth implementation change | pass | Phase 2 PR 5 timing and unchanged spec requirements retained | original decision and prior plan/spec checks | no |
| Other runtime/domain requirements | n-a to documentation slice | unchanged | no new runtime surface | three-file diff | no |

### Verification performed

| Command / check | Result |
|---|---|
| Fetch, exact commit, merge base and detached checkout | pinned `7a463cd8…`; current main/merge base remains `8a1e95cb…` |
| Incremental fix diff plus effective diff inventory | only decisions/runbook corrections since Round 2; full PR: 3 files, 27 additions / 4 deletions |
| Updated PR body/self-check | scan claim corrected; UNI-16 applicable with runbook evidence |
| Historical Actions run/log inspection | run 43261080629: successful scan of 566 commits on 2026-11-12; matches new factual citation |
| Current Actions run metadata | run 43683816029 head equals reviewed SHA; four jobs successful; image skipped under approved docs-only policy |
| `bash .github/scripts/code-changed.sh <base> <head>` | false; skip classification correct |
| `git diff --check origin/main...HEAD` | pass |
| Added-line secret/agent-directed pattern | no matches |
| Spec hash and checkout integrity | approved hash unchanged; no tracked/staged modifications |
| Final GitHub head re-read | same SHA; OPEN, MERGEABLE/CLEAN |

No application tests were rerun locally for this documentation-only correction. CI build/test/audit/secret evidence is successful at the new head.

### Residual risks and test gaps
- Actual DNS setup, domain verification, display-name selection and production email delivery are future implementation/deployment work, explicitly pending in the corrected runbook.
- Historical repository visibility timing is a recorded project fact; the reviewer verified the cited scan dates/results, not a GitHub organization audit log of past visibility changes.
- A passing gitleaks scan does not establish that all confidential information is absent; the corrected decision states this limitation.

### Required before merge
- No remaining review corrections. Run `approved 64` to archive the whole review and create the approval receipt before Charlie merges. This approval applies only to the head above.

### Deferred conditions
- None.

### Optional improvements
- The earlier optional qualification of free public Actions to standard hosted runners remains optional; the present workflow uses standard runners.
