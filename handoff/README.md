# Handoff copy

`handoff.md` is a byte-for-byte copy of the builder's `.agent/handoff.md` (git-ignored on the working branches), saved here so a second Mac can pick up the work.

- Source of truth for code state is git and the pull request host, not this file.
- To resume on another Mac: `git fetch origin agent-logs`. If `.agent/handoff.md` is missing, copy `handoff/handoff.md` from the `agent-logs` branch to it. If both exist and differ, do not overwrite either: compare the two "Just finished" entries and ask the owner which is newer. Then read it with `git status` before trusting it (builder role, "Resume").
- Before leaving a Mac: push every branch, then ask the builder to refresh this copy (`handoff`).
- A refresh never overwrites a newer remote copy: the builder compares the remote file's hash with `.agent/handoff.synced` (the hash this Mac last pushed or restored) first, and asks the owner if they differ.
- Never put secrets in the handoff.
- The full refresh and restore steps are in `agents/PROJECT.md` §2 "Handoff copy (two Macs)" (added by PR #34).
