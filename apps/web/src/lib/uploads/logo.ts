import { randomUUID } from "node:crypto";
import type { UploadType } from "./validate";

// The workspace logo (Phase 2 plan Task 12; Charlie 2026-11-11): PNG or JPG only, never SVG or HTML.
export const LOGO_TYPES: readonly UploadType[] = ["png", "jpeg"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// FILE-03: ws/{workspace_id}/{uuid}, a random id and nothing from the user (the file name is never used). The
// workspace_settings CHECK refuses a logo_key outside the row's own workspace prefix.
export function newUploadKey(workspaceId: string): string {
  return `ws/${workspaceId}/${randomUUID()}`;
}

// The serve route's URL for a stored logo key: the key's id only, which changes on every upload, so a browser never
// shows an old logo from its cache.
export function logoUrl(logoKey: string): string {
  return `/files/logo?id=${logoKey.slice(logoKey.lastIndexOf("/") + 1)}`;
}

// The stored key the serve route may answer for: the requested id within the caller's workspace, if it is a uuid.
export function logoKeyFor(workspaceId: string, id: string | null): string | null {
  return id !== null && UUID.test(id) ? `ws/${workspaceId}/${id}` : null;
}
