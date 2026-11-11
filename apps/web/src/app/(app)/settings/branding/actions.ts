"use server";

import { LOGO_MAX_BYTES } from "@crm/core/security";
import { z } from "zod";
import { getStorage } from "@/adapters/storage";
import { getSettings, updateSettings } from "@/db/settings/workspace-settings";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { expectedVersion } from "@/lib/settings-input";
import { LOGO_TYPES, newUploadKey } from "@/lib/uploads/logo";
import { validateUpload } from "@/lib/uploads/validate";

const REFUSAL = {
  EMPTY: "UPLOAD_EMPTY",
  TOO_LARGE: "UPLOAD_TOO_LARGE",
  TYPE_NOT_ALLOWED: "UPLOAD_TYPE_NOT_ALLOWED",
} as const;

// The logo (Phase 2 plan Task 12), Admin and Owner like the rest of branding (plan Q2). Posted as multipart form data
// from the branding page, with or without JavaScript (the server-action body limit is set in next.config.ts). In
// order: storage configured; the size the browser declared (so an oversize file is never read); onboarding and the
// expected version (so a refused save stores nothing); the bytes by magic number, ignoring the client MIME type and
// file name (FILE-01, FILE-02); then the put under a new random key, conditional so it can never overwrite (FILE-03);
// then the key, audited by updateSettings. The previous logo's object is left in place: the adapter has no delete,
// and the Phase 9 purge removes objects no row references. An error after the put leaves an orphan for the same purge.
export const uploadLogo = action({
  name: "settings.branding.logo",
  minRole: "admin",
  input: z.strictObject({ expectedVersion, logo: z.instanceof(File) }),
  fromForm: (form) => ({ expectedVersion: Number(form.get("expectedVersion")), logo: form.get("logo") }),
  idempotent: false,
  handler: async (ctx, { expectedVersion: version, logo }) => {
    const storage = getStorage();
    if (!storage) throw new ActionRefusedError("STORAGE_UNAVAILABLE");
    if (logo.size === 0) throw new ActionRefusedError("UPLOAD_EMPTY");
    if (logo.size > LOGO_MAX_BYTES) throw new ActionRefusedError("UPLOAD_TOO_LARGE");

    const before = await getSettings(ctx.tx, { forUpdate: true });
    if (before.country === null) throw new ActionRefusedError("NOT_ONBOARDED");
    if (before.version !== version) throw new ActionRefusedError("STALE_VERSION");

    const bytes = new Uint8Array(await logo.arrayBuffer());
    const checked = validateUpload(bytes, { allowed: LOGO_TYPES, maxBytes: LOGO_MAX_BYTES });
    if (!checked.ok) throw new ActionRefusedError(REFUSAL[checked.reason]);

    const key = newUploadKey(ctx.workspaceId);
    const { created } = await storage.put(key, bytes, checked.contentType, { ifNoneMatch: true });
    if (!created) throw new Error("A new upload key already exists in storage");
    const after = await updateSettings(ctx.tx, { logoKey: key }, version, ctx.userId);
    return { version: after.version };
  },
});
