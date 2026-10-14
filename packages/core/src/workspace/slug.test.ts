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
