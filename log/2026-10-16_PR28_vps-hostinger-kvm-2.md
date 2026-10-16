# PR 28 — docs: record Hostinger KVM 2 as the VPS provider

- **Merged:** 2026-10-16T09:52:41Z (GitHub) · **Merge commit:** `21507058293ca5d70d62e631eac6bde8d6a134f4` · **Branch:** `docs/vps-hostinger-kvm-2` (final head `553f0b2960996bb756f1d4044b443d60e470e5b7`)
- **Gate breaches:** none. The final review round's head SHA (`553f0b2…`) equals the PR's final head SHA, and the receipt was written before the merge (receipt commit `c30ea58`, 2026-10-16T09:49:13Z; merge 2026-10-16T09:52:41Z).
- **Approval receipt:** `reviews/PR-28.receipt` on `agent-logs`, commit `c30ea58` (reviewed head `553f0b2960996bb756f1d4044b443d60e470e5b7`; review-file hash `ab23fdd762a5d6729db9925bcc0c225008ef4615`; review committed in `28a43e90d68a8b7b3ae1fd968592a3368f1b5174`).
- **Merge evidence:** `gh pr view 28` → state MERGED, merge commit above, head `553f0b2…`, base `main`; `git merge-base --is-ancestor 2150705 origin/main` confirms it is reachable from the fetched default branch (checked 2026-10-16).
- **Drafted by:** Claude Sonnet 5.5 · **Final verdict:** Approved (round 2)
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md` v4.7 rev 4 (hash `eb89f4ab817c79c536cd36f8aef7c643a059d697`, unchanged by this PR) · **Plan:** none · **Milestone:** Phase 1 gates (VPS provider)

## What changed
One new entry at the top of `docs/DECISIONS.md` (2026-10-15): the VPS provider is Hostinger KVM 2 (Malaysia), with the facts used (vendor pages of 2026-10-13, to re-check before buying), why iCore NODE2 lost, and the note that the spec still says Singapore and DigitalOcean and needs a reviewed spec revision.

## Why
Spec Open question 4 and the Phase 1 plan gate (b) wait on Charlie's VPS provider choice. Charlie answered "hostinger kvm 2 and clean up" on 2026-10-15.

## Review rounds
- R1 (Revision required): [P2] the iCore comparison said "Docker needs KVM" (true for Docker Desktop, not Docker Engine on a Linux VPS) and called backup absent when the page only links a separate backup offering → the entry now says iCore's page does not establish root access, Docker Engine/Compose support, virtualization type, backup inclusion in NODE2 or DDoS handling; optional improvement taken: dated vendor links and a note that the USD prices come from Hostinger's US page while the Malaysia page lists RM.
- R2 (**Approved**): no findings.

## Deferred conditions
- none from this review. The hosting spec revision (PR #29) is a separate required gate before the Phase 1 plan.

## Decisions worth keeping
- Hostinger KVM 2 (Malaysia) is the VPS provider; recorded in `docs/DECISIONS.md` 2026-10-15. The Stage 3 database provider is not decided (PR #29 proposes "chosen at first sale").
- Re-check Hostinger price and terms in RM before buying; USD figures in the entry are from its US-facing page.

## Follow-ups
- PR #29 (spec v4.7 revision 5, hosting wording; stacked on this PR): needs Bob's `review spec` of the new hash, Charlie's approval in his own words, then `setup` to reconcile `agents/PROJECT.md` §2 and `CLAUDE.md`. `build` stops at its reconcile gate until then.
- Phase 1 plan waits on that spec revision and the other open gates: rate-limit numbers and the OTP re-issue cap, the `crm_purge` read policies, a RESTRICTIVE tenant policy on each tenant table (TEN-07), `/api/auth/*` as unauthenticated surface (UNI-19), and the archive job (UNI-10).
- PDPA professional check due before Phase 9 (now also covers where the Malaysia host and backups sit).
- Not installed, needs Charlie's OK after a read: the emilkowalski/skills pack. Docs bundle still open: PR #21 "Exception to a rule?" wording, the UI-kit direction, the "why PostgreSQL" entry.

## Appendix — final review round
<!-- Copied in full from .agent/reviews/PR-28.md (that file is local only). -->

## Round 2 — 2026-10-16 · scope: hosting decision record
- **Code review:** merge base `b90dc480a3f8e2b9ee04e201d7ae94f5454d1791` · head `553f0b2960996bb756f1d4044b443d60e470e5b7`.
- **Spec:** `docs/superpowers/specs/2026-09-27-core-sales-design.md`, v4.7 revision 4; hash `eb89f4ab817c79c536cd36f8aef7c643a059d697`, equal to `PROJECT.md` §2. The hosting revision is a separate PR and remains a gate before the Phase 1 plan.
- **Review source:** exact-head `git archive` snapshot at `.agent/worktrees/review-28-553f0b29`; 141-file list matched `git ls-tree`, with initial fingerprint `034743c59ea91a8ecde8f2c09e84dcc125b00aaf8aec2a841457868b5ba36518`. The sandbox prevented a detached Git worktree under `.git/worktrees`.

**Verdict:** Approved — for this decision-record PR at the stated head only.
**Model used:** GPT-6 · **Switch model next step?** Yes — `PROJECT.md` §6 names Opus 5.5 for milestone gates; use it for the hosting spec review.

### Findings

- **Round 1 P2, resolved:** `docs/DECISIONS.md:7` no longer says Docker needs KVM. It separates unknown iCore Docker Engine/Compose support from unknown virtualization type and distinguishes the linked backup offering from backups included in NODE2. The owner choice, dated vendor sources and separate spec-revision gate remain. The [Hostinger Malaysia page](https://www.hostinger.com/vps/servers/malaysia), [iCore NODE2 page](https://www.icore.com.my/nvme-vps) and [Docker Engine documentation](https://docs.docker.com/engine/security/) support the corrected wording.

### [P3] Refresh the PR body's CI self-check
- Category: documentation consistency
- Rule: review provenance / UNI-13
- Evidence: PR #28 body at head `553f0b2` still says `UNI-13 | Yes | Pending CI`, while exact-head run `38879568985` has all four jobs successful, including `Image, Trivy, E2E`.
- Failure scenario: Someone reading the PR body alone thinks the required CI gate is still open.
- Why it matters: The hosted check is visible and green; this is PR-description upkeep only.
- Required correction: Change UNI-13 to Pass and cite run `38879568985`.
- Owner: builder
- Verification: The PR body names the completed run and its four successful jobs.
- Status: open; optional follow-up

### Self-check audit
I independently reapplied the Round 1 applicability list before comparing the builder table: UNI-07, UNI-12, UNI-13, decision provenance and the `PROJECT.md` §11 hosting gate apply. UNI-11 and UNI-16 remain n-a for this one-file decision record. No code, tenancy, money, frontend, migration or deployment configuration changed. No applicable implementation rule is missing from the builder table, and there is no reviewer-directed instruction attempt.

| Rule / gate | Applies? | Builder said | Reviewer found | Evidence / disagreement |
|---|---|---|---|---|
| UNI-07, UNI-12 | Yes | Pass | Pass; one docs entry and no secret in the effective diff | Three-dot diff; hosted gitleaks |
| UNI-13 | Yes | Pending CI | Pass on exact head; PR body stale P3 | Run `38879568985` |
| Decision provenance and `PROJECT.md` §11 | Yes | Pass | Owner choice is attributed; entry says spec revision still needed and Phase 1 remains gated | `docs/DECISIONS.md:5-12`; approved spec; `PROJECT.md` §11 |
| Vendor comparison | Yes | R1 P2 fixed | Resolved; accurate uncertainty about Docker support and plan-included backup | `docs/DECISIONS.md:7`; official pages above |

### Verification performed
| Command / check | Result |
|---|---|
| `git fetch origin`, host PR pin, exact commit, merge base, three-dot diff and Round 1→2 delta | Open PR; head `553f0b2960996bb756f1d4044b443d60e470e5b7`; one-file effective diff, 9 added lines; fix commit edits one decision-log line |
| `git diff --check` | Clean |
| Hosted CI run `38879568985` | Pull-request run on exact head; checks, dependency audit, full-history gitleaks and image/Trivy/E2E all passed |
| Decision entry, PR body, approved hosting spec and official vendor/Docker pages | Round 1 P2 corrected; spec remains unchanged at the reconciled hash |
| Local tests | None run; this PR changes documentation only |
| Snapshot and host head at end | All 141 files unchanged; fingerprint `034743c59ea91a8ecde8f2c09e84dcc125b00aaf8aec2a841457868b5ba36518` matched; PR remained open at `553f0b2960996bb756f1d4044b443d60e470e5b7` |

### Residual risks and test gaps
- The approved spec still calls for a Singapore VPS and DigitalOcean Managed PostgreSQL. This PR records the provider decision and explicitly leaves the hosting spec revision, approval and setup reconcile to the separate workflow before Phase 1 planning.
- Vendor pricing and terms are date-sensitive; the entry labels its 2026-10-13 source date and calls for a purchase-time recheck. It also distinguishes USD display prices from Malaysia checkout prices.

### Required before merge
None from this round.

### Deferred conditions
None from this review. The hosting spec revision is a separate gate before the Phase 1 plan.

### Optional improvements
- Refresh the PR-body UNI-13 status (P3).
