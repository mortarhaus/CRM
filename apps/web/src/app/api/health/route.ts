import { getDb } from "@/db";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await checkHealth(async () => {
    await getDb().sql`select 1`;
  });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
