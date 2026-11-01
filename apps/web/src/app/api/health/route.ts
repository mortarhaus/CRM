import { pingDatabase, pingQueue } from "@/db/system";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await checkHealth(pingDatabase, pingQueue);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
