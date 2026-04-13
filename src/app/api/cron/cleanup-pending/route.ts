import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { env } = getCloudflareContext();
  const token = req.headers.get("authorization");
  if (!env.CRON_SECRET || token !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const now = Date.now();
  const result = await db
    .update(schema.participants)
    .set({ status: "cancelled", updatedAt: now })
    .where(
      and(
        eq(schema.participants.status, "pending"),
        lt(schema.participants.expiresAt, now),
      ),
    );

  return Response.json({ ok: true, updatedAt: now, result });
}
