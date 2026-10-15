import { beforeEach, describe, expect, it, vi } from "vitest";

// During `next build`, reading request headers is where prerendering of a page stops. Auth (and with
// it env validation) must not start before that point, or a build without runtime secrets fails.
const prerenderStop = new Error("prerender stops at the first request-time API");

vi.mock("next/headers", () => ({ headers: vi.fn(async () => Promise.reject(prerenderStop)) }));
vi.mock("./server", () => ({ getAuth: vi.fn() }));

const { getAuth } = await import("./server");
const { getCurrentSession, listWorkspaces } = await import("./session");

describe("session helpers read request headers before starting auth", () => {
  beforeEach(() => {
    vi.mocked(getAuth).mockClear();
  });

  it("getCurrentSession does not touch auth or env while prerendering", async () => {
    await expect(getCurrentSession()).rejects.toBe(prerenderStop);
    expect(getAuth).not.toHaveBeenCalled();
  });

  it("listWorkspaces does not touch auth or env while prerendering", async () => {
    await expect(listWorkspaces()).rejects.toBe(prerenderStop);
    expect(getAuth).not.toHaveBeenCalled();
  });
});
