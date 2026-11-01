import { handleAuthRequest } from "@/lib/auth/handle";

// Better Auth 1.7.14's toNextJsHandler only dispatches each method to auth.handler (plan Task 22 Step 3), so the
// route calls the shared entry point directly.
export async function GET(request: Request): Promise<Response> {
  return handleAuthRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleAuthRequest(request);
}
