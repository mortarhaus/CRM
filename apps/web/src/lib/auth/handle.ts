import { prepareAuthRequest } from "./client-ip";
import { getAuthHandler } from "./server";

// The one way a request reaches Better Auth's HTTP handler (plan Tasks 22-24): the /api/auth route and the form
// path (postToAuth) both call it, so both get the same client IP, the same limits and the same 429.
export async function handleAuthRequest(request: Request): Promise<Response> {
  return getAuthHandler()(prepareAuthRequest(request));
}
