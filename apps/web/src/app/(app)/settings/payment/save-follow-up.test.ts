import { describe, expect, it } from "vitest";
import { STEP_UP_EXPIRED, STEP_UP_NEEDED } from "@/lib/auth/messages";
import { saveFollowUp, stepUpRefusal } from "./save-follow-up";

describe("payment forms after a save", () => {
  it("refreshes the page to bring the prompt back when step-up expired while the page was open", () => {
    expect(saveFollowUp({ ok: false, status: "STEP_UP_REQUIRED" })).toBe("prompt");
    expect(stepUpRefusal(true)).toBe(STEP_UP_EXPIRED);
  });

  it("asks for a first confirmation when the page never showed one", () => {
    expect(stepUpRefusal(false)).toBe(STEP_UP_NEEDED);
  });

  it("refreshes after a save and does nothing for other refusals", () => {
    expect(saveFollowUp({ ok: true, status: "DONE", data: { version: 2 } })).toBe("refresh");
    expect(saveFollowUp({ ok: false, status: "STALE_VERSION" })).toBe("none");
    expect(saveFollowUp(null)).toBe("none");
  });
});
