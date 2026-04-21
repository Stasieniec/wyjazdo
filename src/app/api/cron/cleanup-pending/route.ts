import { and, eq, lt } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const secret = env.CRON_SECRET;
  if (!secret) return new Response("misconfigured", { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = Date.now();
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(schema.payments.status, "pending"), lt(schema.payments.expiresAt, now)));
  return new Response("ok");
}
