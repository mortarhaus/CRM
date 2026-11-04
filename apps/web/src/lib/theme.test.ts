import { describe, expect, it } from "vitest";
import { parseTheme, returnPath, themeClass } from "./theme";

const APP = "https://crm.example.test";

describe("parseTheme", () => {
  it.each(["light", "dark", "system"])("accepts %s", (value) => {
    expect(parseTheme(value)).toBe(value);
  });

  it.each([undefined, null, "", "Dark", "dark ", "auto", "dark;Path=/", 1])("refuses %j", (value) => {
    expect(parseTheme(value)).toBeNull();
  });
});

describe("themeClass", () => {
  it("puts the chosen theme on <html> and leaves system to the media query", () => {
    expect(themeClass("light")).toBe("light");
    expect(themeClass("dark")).toBe("dark");
    expect(themeClass("system")).toBeUndefined();
  });
});

describe("returnPath", () => {
  it("returns to the posting page with its query", () => {
    expect(returnPath(`${APP}/settings/email?tab=1`, APP)).toBe("/settings/email?tab=1");
  });

  it.each([
    ["no referer", null],
    ["an unparsable referer", "not a url"],
    ["another origin", "https://evil.example.test/workspaces"],
    ["another scheme", "http://crm.example.test/workspaces"],
    ["a protocol-relative referer", "//evil.example.test/workspaces"],
    ["a same-origin path that reads as another host", `${APP}//evil.example.test/workspaces`],
  ])("falls back to / for %s", (_case, referer) => {
    expect(returnPath(referer, APP)).toBe("/");
  });
});
