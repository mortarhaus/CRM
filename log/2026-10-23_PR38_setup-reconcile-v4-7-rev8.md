# PR 38 — chore: setup reconcile for spec v4.7 revision 8

- **Merged:** 2026-10-23T16:55:02Z · **Merge commit:** 065d9a244e1eda1a741e254ca6ee412532ab4eb2 · **Branch:** chore/setup-reconcile-v4-7-rev8
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-38.receipt` on `agent-logs` (written 2026-10-23T16:42:58Z, about 12 minutes before the merge; reviewed head `cb20fc65209e0d969cd0496c9b20f09dae94cf74`; review file hash `c544dd8052e4b17bf93d9ed1c38d8864b2246877`, equal to the local review file; log-branch commit holding the review `6a4afb6`).
- **Merge evidence:** `gh pr view 38 --repo mortarhaus/CRM` state MERGED, mergedAt 2026-10-23T16:55:02Z, merge commit above; `git merge-base --is-ancestor` shows it reachable from the fetched `origin/main`. Final head `cb20fc6` equals the head in Bob's Round 1. All CI jobs passed on that head.
- **Drafted by:** Sonnet 5.5 (builder; not the deep tier that `setup` asks for, stated to Charlie) · **Final verdict:** Approved with conditions (round 1)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` (v4.7 revision 8, `733cc0e9…`, unchanged by this PR) · **Plan:** `docs/superpowers/plans/2026-10-20-phase-1-tenancy-security-jobs.md` · **Milestone:** Phase 1 prep (reconcile before Phase 1 PR 1)

## What changed
`agents/PROJECT.md` follows spec hash `733cc0e9…` (§2 spec row and reconcile hash) and gets plan items P3, P5, P8 and P9 (`crm_purge` own login; Phase 1 plan settled items; `auth_audit_log` in the system-module and TEN-10 lines; UNI-10 names `auth_audit_log`). The handoff-copy procedure gains a newer-copy check (`.agent/handoff.synced`) and a corrected restore reference (Bob's PR #34 Round 2 P2 and P3, in part). `CLAUDE.md` Status and `docs/DECISIONS.md` (revision 8 approval record and scope line) are refreshed. `handoff/README.md` on `agent-logs` was updated separately.

## Why
`setup` reconciles `PROJECT.md` after a spec revision is approved and merged. `build`'s reconcile gate needs §2 to equal the approved spec hash.

## Review rounds
- R1: Approved with conditions (head `cb20fc6`). No finding fixed before merge; two deferred (below).

## Deferred conditions
- [P2] After the owner says the remote handoff copy is newer, nothing copies it into `.agent/handoff.md`, so the next refresh overwrites it. Fix: in the restore step, copy the remote over the local file when the owner says the remote is newer (keep the local if it is newer), then write the remote hash to `.agent/handoff.synced`, and restart the interrupted refresh from step 1; same text in `handoff/README.md`. → next PR that edits `agents/PROJECT.md`, no later than **2026-11-06**. Interim: when a builder asks "which is newer?" and the remote is newer, tell it to copy the remote into `.agent/handoff.md` first.
- [P3] Three spots still call revision 7 current or revision 8 pending: `CLAUDE.md` line 6; `agents/PROJECT.md` §11 "Except the five Phase 1 items decided in revision 7…"; the revision 8 decision entry's Decision and Scope lines ("still needs Bob's review and Charlie's approval") → same PR, same deadline.

## Decisions worth keeping
- The spec file still labels revision 8 a draft; changing it would change the approved hash, so the first later spec PR fixes it (`PROJECT.md` §2 says so).
- The `crm_worker` grants stay "method and test gate specified, measurement pending" until Phase 1 PR 5 merges; P4, P6 and P7 wait for PRs 5 and 6.
- Open questions are now 2, 3, 6, 7 and 9 (8 resolved).

## Follow-ups
- Next PR that edits `agents/PROJECT.md`: fix the P2 and P3 above (due 2026-11-06), together with `handoff/README.md`.
- `build`: Phase 1 PR 1 (database roles) per the plan. Ask Charlie first; ASK 4 to 9 are asked at the task that needs each.
- Repo visibility rule undecided (builder recommends keeping it private). `docker/sync-export.sh` and `docker/sync-import.sh` are untracked on `main`; Charlie decides.

## Appendix — final review round

## Round 1 — 2026-10-24 · scope: slice (setup reconcile for spec v4.7 revision 8; docs only)
- **Code review:** base (merge base) `9e965f18a2160eccba55d3a38c3254fdf3850079` (= `origin/main`, PR #34 merge) · head `cb20fc65209e0d969cd0496c9b20f09dae94cf74` · head re-checked at end: yes (still `cb20fc6`, OPEN, MERGEABLE)
- **Spec reference:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` · v4.7 revision 8 · hash `733cc0e9ce4af0771bdd2769720e3f228caf8855` (same blob at head and on `main`; this PR does not change it). Approved exact-hash round: `SPEC-core-sales-design.md` Round 27.
- **Checkout mode:** detached worktree `.agent/worktrees/review-38-cb20fc65` at the exact head; no build output; clean at the end; removed without `--force`.

**Verdict:** Approved with conditions
**Model used:** Opus 5.5 (deep tier; the builder did this `setup` on Sonnet 5.5 and said so) · **Switch model next step?** No — `approved 38` / `merged 38` are builder procedures.

### Inventory: plan P-items vs this diff

| Item (plan "Spec / PROJECT.md edits this plan needs") | Delivered? | Evidence |
|---|---|---|
| P1 §2 spec row → revision 8 + approval record | yes | Charlie's "I approve spec revision 8" matches the PR #36 body "Owner approval"; Round 27 approved `733cc0e9`; PR #36 Round 1 approved `5748d9b`; merge `36b5592`. The old "still says draft" sentence is replaced by one that is still true for the file's revision 8 label. |
| P2 spec hash | yes | `733cc0e9…` = `git hash-object` at head and on `main` |
| P3 `crm_purge` own login | yes | matches spec Open question 8 "RESOLVED (Charlie, 2026-10-20…): own login" |
| P4, P6, P7 | correctly not done | each is gated on Phase 1 PR 5 or PR 6 merging |
| P5 §11 first bullet | yes | `crm_worker`: "method and test gate are specified … actual grants stay pending … Nothing here says the grants were measured" (matches P5 text). Open questions "2, 3, 6, 7 and 9" match the spec list (8 resolved; 1, 4, 5, 10–16 resolved). |
| P8 system-module line + TEN-10 allow-list | yes | wording equals P8 |
| P9 UNI-10 line | yes | wording equals P9 |
| PR #36 Round 1 P3 (decision "Scope / affects") | yes | now "the spec and the merged Phase 1 plan (Task 31 and the rows that cite it)" |
| PR #34 Round 2 P3 (restore cite) | **resolved** | "before `roles/builder.md` §1 step 2, 'load the handoff'" and Resume cited as §2 |
| PR #34 Round 2 P2 (refresh overwrites a newer copy) | **partly resolved** | see P2 below |

The reconcile gate will pass after merge: `build` needs an Approved spec round for `733cc0e9` (Round 27) and §2 = that hash. `agents/PROJECT.md` has no double braces.

### Findings

### [P2] After the owner says the remote copy is newer, nothing adopts it, so the next refresh overwrites it
- Category: defect (carries PR #34 Round 2 P2, partly resolved)
- Rule: `agents/PROJECT.md` §2 "Handoff copy (two Macs)", refresh step 3 and the restore step; UNI-11 data handling
- Evidence: the new step 3 correctly stops a refresh when the remote hash ≠ `.agent/handoff.synced`, and sends the builder to the restore step's "both exist and differ" path. That path says "don't overwrite either … ask which is newer, and after the owner answers write the hash of the remote file to `.agent/handoff.synced`". It never says to copy the remote file into `.agent/handoff.md` when the owner picks the remote. `handoff/README.md` on `agent-logs` (`038d8fa`) has the same gap.
- Failure scenario: the MacBook pushes copy B. On the Mac mini (local copy L is older, synced = A), a refresh sees remote B ≠ A and asks. Charlie answers "the remote is newer". The builder writes synced = B and, as told, does not overwrite L. It keeps working from L. At the next refresh, remote B = synced B, so step 4 copies L over B and pushes. The newer state is gone from the mirror. Only the MacBook's local file still has it.
- Why it matters: this is the exact race PR #34 Round 2 P2 asked to close. The check now catches it, but the owner's answer leads straight back to the overwrite.
- Required correction: in the restore step, after the owner answers: if the remote is newer, copy `handoff/handoff.md` over `.agent/handoff.md` byte-for-byte (keeping the old local file as `.agent/handoff.local-<date>.md` is optional); if the local is newer, keep it. In both cases, then write the remote hash to `.agent/handoff.synced`. Say where the interrupted refresh goes next (restart from step 1). Make the same change in `handoff/README.md` on `agent-logs`.
- Owner: builder
- Verification: trace the scenario above through the new text. With "remote is newer", the local file must become B before any later push.
- Disposition: deferred to 2026-11-06, the same deadline as PR #34 Round 2 P2, in the next PR that edits `agents/PROJECT.md`. This PR does not make things worse than `main`, which has no check at all. Interim: when a builder asks "which is newer?" and the remote is newer, Charlie tells it to copy the remote into `.agent/handoff.md` first.
- Status: open

### [P3] Three spots still describe revision 7 as current or revision 8 as pending
- Category: defect (wording)
- Evidence:
  - `CLAUDE.md:6`: "spec **v4.7** (revision 7; latest version in its Status line)". The Status section below it now says revision 8.
  - `agents/PROJECT.md:282`: "Except the five Phase 1 items decided in revision 7, none of the items above is decided". The first §11 bullet now also lists items settled by the plan and revision 8.
  - `docs/DECISIONS.md` revision 8 entry: the heading now says "(approved by Charlie 2026-10-22)". But the Decision line still says "revision 8 (draft) … **This revision still needs Bob's exact-hash spec review … until then revision 7 is the approved text.**", and the Scope line says "revision 8 still needs Bob's exact-hash review and Charlie's approval".
- Failure scenario: a fresh session reads `CLAUDE.md` or the decision body first and treats revision 7 as the approved text.
- Required correction: name revision 8 in `CLAUDE.md:6`; add "and those settled by revision 8" in §11 l.282; in the decision entry, mark the two pending sentences as history (for example "(at writing; approved 2026-10-22, see Decided by)").
- Owner: builder · Fix with the P2 above, or now.
- Status: open

### Self-check audit

Independent applicability list: UNI-07, UNI-11, UNI-12, UNI-13; TEN-02, TEN-10, UNI-10 (wording only); decision provenance; command authority; `setup` Part B reconcile rules (START.md). n-a: every rule touching code, schema, UI, money, records, links, files, jobs or payments (no such change).

| Rule | Applies? | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| UNI-07 | yes | pass | pass | added lines: 0 secret-pattern hits; CI Secret scan pass | no |
| UNI-11 | yes | pass | pass for scope and destination; the P2 gap remains | §2 procedure; README on `agent-logs` | partly (P2) |
| UNI-12 | yes | pass | pass | 3 files in repo | no |
| UNI-13 | yes | CI pending | pass | all four CI jobs green on `cb20fc6` | no |
| TEN-02, TEN-10, UNI-10 | wording | pass | pass | match plan P8/P9 and spec revision 8 | no |
| Decision provenance | yes | pass | pass for the approval record; P3 for stale body lines | PR #36 body "Owner approval"; Round 27; PR-36 Round 1 | partly (P3) |
| Command authority | yes | pass | pass | steps stay in `agents/PROJECT.md` §2 | no |
| `setup` Part B reconcile | yes (not in the table) | — | pass: only spec-backed values changed; hash updated; no double braces | diff vs plan P1–P9 | minor; not a finding, since the row content is covered by the rows above |

No injection text found in the diff or the PR body.

### Verification performed

| Command / check | Result |
|---|---|
| `git fetch origin`; `git cat-file -e`; merge base | commit present; merge base `9e965f1` = `origin/main` |
| Three-dot stat, log, word diff | 3 files, +31 −21; 1 commit (trailer: Claude Sonnet 5.5); reviewed in full |
| `git diff --check` | clean |
| Spec blob at head / on `main` | both `733cc0e9…`; Round 27 Approved that hash |
| PR #36 body / merge | "I approve spec revision 8" quoted in "Owner approval"; merge `36b5592` |
| Plan §"Spec / PROJECT.md edits" P1–P9 | each checked against the diff (table above) |
| Spec "Open questions for Charlie" | open: 2, 3, 6, 7, 9 |
| `grep "{{" agents/PROJECT.md` | 0 |
| Handoff procedure trace | refresh race closed at the check; reopens after a "remote is newer" answer (P2) |
| `origin/agent-logs:handoff/README.md` (`038d8fa`) | updated with the check; same P2 gap |
| CI on `cb20fc6` | Typecheck/lint/test, Dependency audit, Secret scan, Image/Trivy/E2E: all pass |
| End check | host head unchanged; review checkout clean, removed |

### Residual risks and test gaps
- The first refresh on each Mac after merge has no `.agent/handoff.synced` yet. If the remote copy differs from the local file, the builder will ask once. That is safe, and expected.
- The `setup` was done below the deep tier. This review is the deep-tier check of its content.

### Required before merge
- None.

### Deferred conditions
- P2 above: by 2026-11-06, in the next PR that edits `agents/PROJECT.md` (with the README on `agent-logs`).
- P3 above: same PR.

### Optional improvements
- None.
