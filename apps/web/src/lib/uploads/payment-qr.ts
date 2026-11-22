import { createHash } from "node:crypto";
import type { UploadType } from "./validate";

// The payment QR (DuitNow in MY, PayNow in SG; Phase 2 plan Task 14): PNG or JPG only, never SVG or HTML.
export const PAYMENT_QR_TYPES = ["png", "jpeg"] as const satisfies readonly UploadType[];
type PaymentQrType = (typeof PAYMENT_QR_TYPES)[number];

const EXTENSIONS: Record<PaymentQrType, string> = { png: "png", jpeg: "jpg" };
const SHA256 = /^[0-9a-f]{64}$/;

// The accepted FILE-03 exception (PROJECT.md §9; spec line 847): content-addressed at
// ws/{workspace_id}/duitnow/{sha256}.{ext}, so a replaced QR keeps its object and the same image is stored once. The
// workspace_settings CHECK refuses any other shape or another workspace's prefix.
export function paymentQrKey(workspaceId: string, bytes: Uint8Array, type: PaymentQrType): string {
  return `ws/${workspaceId}/duitnow/${createHash("sha256").update(bytes).digest("hex")}.${EXTENSIONS[type]}`;
}

const hashOf = (key: string) => key.slice(key.lastIndexOf("/") + 1, key.lastIndexOf("."));

// The serve route's URL for a stored key: its hash only, which changes with the image.
export function paymentQrUrl(key: string): string {
  return `/files/payment-qr?id=${hashOf(key)}`;
}

// Whether the requested id names the current key.
export function isCurrentPaymentQr(currentKey: string | null, id: string | null): currentKey is string {
  return currentKey !== null && id !== null && SHA256.test(id) && hashOf(currentKey) === id;
}
