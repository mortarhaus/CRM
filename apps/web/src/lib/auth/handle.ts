import { prepareAuthRequest } from "./client-ip";
import { getAuth } from "./server";

// The one way a request reaches Better Auth's HTTP handler (plan Tasks 22-24): the /api/auth route and the form
// path (postToAuth) both call it, so both get the same client IP and the same limits.
export async function handleAuthRequest(request: Request): Promise<Response> {
  return getAuth().handler(prepareAuthRequest(request));
}
