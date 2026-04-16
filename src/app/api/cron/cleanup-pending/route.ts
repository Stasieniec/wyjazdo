import { and, eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(schema.payments.status, "pending"), lt(schema.payments.expiresAt, now)));
  return new Response("ok");
}
