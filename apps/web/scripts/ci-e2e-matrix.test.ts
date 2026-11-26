import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../playwright.config";

// CI runs one E2E job per Playwright project (.github/workflows/ci.yml, job `e2e`; DECISIONS 2026-11-26). A project
// missing from the matrix would never run in CI, and a matrix entry with no project would fail or run nothing, so the
// two lists must be the same, each name once.
const workflow = readFileSync(path.resolve(__dirname, "../../../.github/workflows/ci.yml"), "utf8");

function e2eJob(): string {
  const start = workflow.indexOf("\n  e2e:\n");
  if (start === -1) throw new Error("no e2e job in ci.yml");
  const next = workflow.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
}

function matrixProjects(): string[] {
  const line = /^ {8}project: \[([^\]]*)\]$/m.exec(e2eJob());
  if (!line?.[1]) throw new Error("no `project: [...]` matrix line in the e2e job");
  return line[1].split(",").map((name) => name.trim());
}

describe("CI E2E matrix", () => {
  it("lists every Playwright project exactly once", () => {
    const projects = (config.projects ?? []).map((project) => project.name);
    const matrix = matrixProjects();
    expect(new Set(matrix).size).toBe(matrix.length);
    expect([...matrix].sort()).toEqual([...projects].sort());
  });

  it("passes the matrix project to Playwright with no stray `--`", () => {
    expect(e2eJob()).toContain("run: pnpm test:e2e --project=${{ matrix.project }}\n");
  });
});
