import { getStorage } from "@/adapters/storage";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { isCurrentPaymentQr, PAYMENT_QR_TYPES } from "@/lib/uploads/payment-qr";
import { allowedContentType } from "@/lib/uploads/validate";

// The current payment QR, streamed from storage for the bank-details page (plan Q13, as files/logo), so img-src
// 'self' stays and the bucket stays private. Owner only, like the page. Anyone else, another workspace's id, an old
// QR and an unknown id all get the same 404 (TEN-05).
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireWorkspaceMember("owner"));
  } catch (error) {
    if (error instanceof ActionRefusedError) return notFound();
    throw error;
  }
  const storage = getStorage();
  const { duitnowQrKey } = await withWorkspace(workspaceId, (tx) => getSettings(tx));
  if (!storage || !isCurrentPaymentQr(duitnowQrKey, new URL(request.url).searchParams.get("id"))) return notFound();

  const object = await storage.get(duitnowQrKey);
  if (!object || !allowedContentType(object.contentType, PAYMENT_QR_TYPES)) {
    await object?.body.cancel();
    return notFound();
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.contentLength),
      "Content-Disposition": "attachment",
      "X-Content-Type-Options": "nosniff",
      // The URL is the image's hash, so it can be cached; only by this browser, since it needs a session.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
