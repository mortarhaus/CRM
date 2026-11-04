# PR 51 — docs: record the Phase 2 design direction

- **Merged:** 2026-11-04T05:17:30Z · **Merge commit:** 8a3c461184918bf75c4124568376ea923444702e · **Branch:** docs/design-direction-phase-2
- **Gate breaches:** none
- **Approval receipt:** `reviews/PR-51.receipt` on agent-logs (log-branch commit d63775a3 holds the review; written 2026-11-04T04:26:48Z, before the merge; head a3d318c, review-file hash e9bf8aea…)
- **Merge evidence:** `gh pr view 51` state MERGED with the time above; commit reachable from fetched `origin/main` (`git merge-base --is-ancestor`). Final head a3d318c equals the reviewed head.
- **Drafted by:** Sonnet 5.5 · **Final verdict:** Approved (round 2)
- **Spec:** docs/superpowers/specs/2026-09-27-core-sales-design.md (v4.7 revision 8, unchanged) · **Plan:** none yet (Phase 2 plan not started) · **Milestone:** Phase 2 prerequisite (design direction)

## What changed
One new entry in `docs/DECISIONS.md` (2026-11-04) recording Charlie's design direction. Docs only.

## Why
Charlie's design direction was the gate before the Phase 2 plan (`CLAUDE.md` Status). Phase 2 (settings and onboarding) lists branding.

## Review rounds
- R1 (Revision required): [P2] builder additions presented as the owner's decision → the Decision now holds only Charlie's three points; contrast bar, who may set the colour, dark-mode storage and the Orvel note moved to a "Builder proposals (not decided)" line; "Decided by" says the proposals await his confirmation.
- R1: [P3] Why line cited `PROJECT.md` §11 → now `CLAUDE.md` Status.
- R1: [P3] dark-mode storage and spec silence → noted in the proposals line.
- R2: Approved, no findings.

## Deferred conditions
none

## Decisions worth keeping
- Charlie's decision: Kinlo look; all transitions (GSAP only where CSS and the View Transitions API cannot); accent colour by hex field and drag picker, stored as the workspace brand colour and applied as a token.
- Builder proposals still to confirm in the Phase 2 plan review: WCAG 2.2 AA contrast on the accent and how the picker enforces it; which role may change the colour (check the spec's permission matrix); dark-mode preference storage (the spec is silent on dark mode); Orvel used only for transition ideas.
- Both demos are paid templates: inspiration only, no copied code or assets.
- Bob reviewed on Sonnet 5.5; docs-only diff.

## Follow-ups
- Phase 2 plan: first PR of a milestone, needs Charlie's go (builder §8). Include a design-tokens task and a motion task; the brand-colour column is added with Phase 2 branding.
- Open: ASK 7, ASK 9, `RATE_LIMITED` wording and numbers.

## Appendix — final review round
## Round 2 — 2026-11-04 · scope: slice (docs-only decisions entry)
- **Code review:** base (merge base) `14851236c3fa04c4c7926966b593155503542fe8` (= `origin/main`) · head `a3d318ceb3f78a2c37ec0b655a8ed231de2f5e4f` · head re-checked at end: yes (unchanged; checkout clean, then removed)
- Incremental change since Round 1 head `4339e01`: commit `a3d318c` "Review R1 fix: separate the owner's decision from builder proposals…", `docs/DECISIONS.md` only (+10/−… within the same entry).
- Spec: hash `733cc0e9ce4af0771bdd2769720e3f228caf8855`, untouched.

**Verdict:** Approved
**Model used:** Sonnet 5.5 (fast tier) · **Switch model next step?** No — one docs entry, re-read in full against the handoff.

### Findings
No open findings. Round 1 items:

- **[P2] Builder additions presented as the owner's decision — resolved.** Re-read the whole entry at the new head against handoff §8 (Charlie's recorded words). **Decision** items (1)-(3) now contain only: the Kinlo look, all the transitions with GSAP allowed and reduced motion respected, and the hex field plus drag picker applied as a token. "Workspace owner" and "checks and adjusts or warns" are gone from it. The contrast bar, the role question, the dark-mode storage and the Orvel-as-transition-source note sit in a separate **Builder proposals… (not decided; Charlie confirms in the plan review)** line, and the contrast bar is stated as AA with enforcement left to the plan (no "or warns"). **Alternatives rejected** reads "none recorded by Charlie". **Decided by** says owner for items (1)-(3) and "the builder proposals line is pending his confirmation".
- **[P3] §11 citation — resolved.** Why now cites `CLAUDE.md` Status and the handoff.
- **[P3] Dark-mode toggle — resolved.** Now a builder proposal: per-user preference, storage decided in the plan, spec silent.

Residual nit, not a finding: in item (3), "stored as the workspace brand colour (`workspace_settings` branding, spec Phase 2 "Branding")" is a spec-derived fact the builder added to Charlie's words, not something he said. It is cited to the spec (Phase 2 row, `workspace_settings` row) and consistent with it, so I accept it.

**Injection check:** no text in the PR body, new commit or diff addresses an AI agent.

### Self-check audit
| Rule | Applies? (why / n-a reason) | Builder said | Reviewer found | Evidence | Disagreement |
|---|---|---|---|---|---|
| Decisions log entry in template shape, accurate attribution | Yes | Pass | Pass | all template fields present; Decision text matches handoff §8 (1)-(3); proposals separated | — |
| Spec unchanged / hash equals `PROJECT.md` §2 | Yes | Pass | Pass | `733cc0e9…` | — |
| UNI-06, FE rule 5 | Voluntary | Pass | Pass | as Round 1 | — |
| Other ticked packs | n-a | n-a | n-a accepted | docs-only | — |

### Verification performed
| Command / check | Result |
|---|---|
| `gh pr view 51` head, state | OPEN, head `a3d318c…`; same at the end |
| `git diff 4339e01 a3d318c`; full entry read at the new head | only the entry changed |
| `git diff --name-only` merge base → head | `docs/DECISIONS.md` |
| `git hash-object` of the spec | `733cc0e9ce4af0771bdd2769720e3f228caf8855` |
| `git diff --check`; secret-scan pattern on added lines | clean; no hits |
| Handoff §8 compared with the Decision text | matches |
| Not run | code checks (docs-only); CI for this head not read (unverified) |

### Residual risks and test gaps
- Charlie has not yet confirmed the builder proposals; the entry says so. The Phase 2 plan review is where he does.
- The demo URLs were not opened (unverified); the entry says no code or assets are copied.

### Required before merge
- None.

### Deferred conditions
- None.

### Optional improvements
- None.

### Handoff block (only when handing off)
Not handing off.

---
