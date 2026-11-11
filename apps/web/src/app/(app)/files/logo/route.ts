import { getStorage } from "@/adapters/storage";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { LOGO_TYPES, logoKeyFor } from "@/lib/uploads/logo";
import { allowedContentType } from "@/lib/uploads/validate";

// The workspace logo, streamed from storage through this same-origin route (plan Q13), so the page CSP keeps
// img-src 'self' and the bucket stays private. Any member of the workspace may read it. It answers only for the
// current logo of the caller's active workspace (the id is checked against workspace_settings under RLS), so a
// member of another workspace, a signed-out visitor and an old or unknown id all get the same 404 (TEN-05).
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireWorkspaceMember("staff"));
  } catch (error) {
    if (error instanceof ActionRefusedError) return notFound();
    throw error;
  }
  const storage = getStorage();
  const key = logoKeyFor(workspaceId, new URL(request.url).searchParams.get("id"));
  if (!storage || key === null) return notFound();
  const { logoKey } = await withWorkspace(workspaceId, (tx) => getSettings(tx));
  if (logoKey !== key) return notFound();

  const object = await storage.get(key);
  // Only what the upload validated can be served; anything else in the bucket under this key is not answered.
  if (!object || !allowedContentType(object.contentType, LOGO_TYPES)) {
    await object?.body.cancel();
    return notFound();
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.contentLength),
      // An <img> ignores this; opening the URL itself downloads the file instead of rendering it (FILE-04).
      "Content-Disposition": "attachment",
      "X-Content-Type-Options": "nosniff",
      // The URL changes with every upload, so it can be cached; only by this browser, since it needs a session.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
