// Upload validation (Phase 2 plan Task 12; FILE-01, FILE-02). The type is read from the file's first bytes against an
// allow-list; the client's MIME type and file name are never looked at. Nothing else is accepted, so SVG, HTML and
// any other text format are always refused. Callers validate before anything is stored.

export type UploadType = "png" | "jpeg" | "pdf";

export const UPLOAD_CONTENT_TYPES: Record<UploadType, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

// PNG: the full 8-byte signature. JPG: SOI plus the first marker's FF. PDF: "%PDF".
const MAGIC: Record<UploadType, readonly number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  pdf: [0x25, 0x50, 0x44, 0x46],
};

export type UploadCheck =
  | { ok: true; type: UploadType; contentType: string }
  | { ok: false; reason: "EMPTY" | "TOO_LARGE" | "TYPE_NOT_ALLOWED" };

const startsWith = (bytes: Uint8Array, magic: readonly number[]) =>
  bytes.length >= magic.length && magic.every((byte, index) => bytes[index] === byte);

export function validateUpload(bytes: Uint8Array, options: { allowed: readonly UploadType[]; maxBytes: number }): UploadCheck {
  if (bytes.length === 0) return { ok: false, reason: "EMPTY" };
  if (bytes.length > options.maxBytes) return { ok: false, reason: "TOO_LARGE" };
  const type = options.allowed.find((candidate) => startsWith(bytes, MAGIC[candidate]));
  return type ? { ok: true, type, contentType: UPLOAD_CONTENT_TYPES[type] } : { ok: false, reason: "TYPE_NOT_ALLOWED" };
}

// The content types an allow-list can produce: what a serve route may answer with.
export function allowedContentType(contentType: string, allowed: readonly UploadType[]): boolean {
  return allowed.some((type) => UPLOAD_CONTENT_TYPES[type] === contentType);
}
