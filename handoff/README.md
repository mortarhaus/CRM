# Handoff copy

`handoff.md` is a byte-for-byte copy of the builder's `.agent/handoff.md` (git-ignored on the working branches), saved here so a second Mac can pick up the work.

- Source of truth for code state is git and the pull request host, not this file.
- To resume on another Mac: `git fetch origin agent-logs`, then copy `handoff/handoff.md` from the `agent-logs` branch to `.agent/handoff.md` in the project, and read it with `git status` before trusting it (builder role, "Resume").
- Before leaving a Mac: push every branch, then ask the builder to refresh this copy (`handoff`).
- Never put secrets in the handoff.
