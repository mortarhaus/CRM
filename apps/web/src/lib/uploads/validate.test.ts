import { LOGO_MAX_BYTES } from "@crm/core/security";
import { describe, expect, it } from "vitest";
import { allowedContentType, validateUpload } from "./validate";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff, 0xe0];
const PDF = [...new TextEncoder().encode("%PDF-1.7\n")];

const file = (head: readonly number[], size = 64) => {
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return bytes;
};
const text = (value: string) => new TextEncoder().encode(value);

const logo = { allowed: ["png", "jpeg"], maxBytes: LOGO_MAX_BYTES } as const;

describe("validateUpload", () => {
  it("accepts a PNG and a JPG by their magic bytes, with the content type of the detected type", () => {
    expect(validateUpload(file(PNG), logo)).toEqual({ ok: true, type: "png", contentType: "image/png" });
    expect(validateUpload(file(JPG), logo)).toEqual({ ok: true, type: "jpeg", contentType: "image/jpeg" });
  });

  it("accepts a PDF only where the caller allows it", () => {
    expect(validateUpload(file(PDF), logo)).toEqual({ ok: false, reason: "TYPE_NOT_ALLOWED" });
    expect(validateUpload(file(PDF), { allowed: ["pdf", "png", "jpeg"], maxBytes: 1024 })).toEqual({
      ok: true,
      type: "pdf",
      contentType: "application/pdf",
    });
  });

  it.each([
    ["an SVG (whatever it was named)", text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["an SVG with an XML declaration", text('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["an HTML page", text("<!doctype html><html><script>alert(1)</script></html>")],
    ["HTML after a byte-order mark", new Uint8Array([0xef, 0xbb, 0xbf, ...text("<html></html>")])],
    ["a GIF", text("GIF89a......")],
    ["a truncated PNG signature", new Uint8Array(PNG.slice(0, 7))],
    ["a PNG signature that is not at the start", new Uint8Array([0x00, ...PNG])],
    ["two bytes of a JPG", new Uint8Array([0xff, 0xd8])],
  ])("refuses %s", (_name, bytes) => {
    expect(validateUpload(bytes, logo)).toEqual({ ok: false, reason: "TYPE_NOT_ALLOWED" });
  });

  it("refuses an empty file", () => {
    expect(validateUpload(new Uint8Array(0), logo)).toEqual({ ok: false, reason: "EMPTY" });
  });

  it("accepts exactly the size limit and refuses one byte more, before the type is looked at", () => {
    expect(validateUpload(file(PNG, LOGO_MAX_BYTES), logo)).toMatchObject({ ok: true });
    expect(validateUpload(file(PNG, LOGO_MAX_BYTES + 1), logo)).toEqual({ ok: false, reason: "TOO_LARGE" });
    expect(validateUpload(file([...text("<svg/>")], LOGO_MAX_BYTES + 1), logo)).toEqual({
      ok: false,
      reason: "TOO_LARGE",
    });
  });

  it("is the 2 MB the owner set (Charlie, 2026-11-11)", () => {
    expect(LOGO_MAX_BYTES).toBe(2_097_152);
  });
});

describe("allowedContentType", () => {
  it("allows only the content types of the allow-list", () => {
    expect(allowedContentType("image/png", ["png", "jpeg"])).toBe(true);
    expect(allowedContentType("image/jpeg", ["png", "jpeg"])).toBe(true);
    expect(allowedContentType("image/svg+xml", ["png", "jpeg"])).toBe(false);
    expect(allowedContentType("text/html", ["png", "jpeg"])).toBe(false);
    expect(allowedContentType("application/pdf", ["png", "jpeg"])).toBe(false);
  });
});
