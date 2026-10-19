import { desc, sql } from "drizzle-orm";
import { getDb } from "../client";
import { leads, type Lead } from "../schema";

export async function listLeads(limit = 200): Promise<Lead[]> {
  return getDb().select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
}

export async function countLeads(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(leads);
  return Number(row?.n ?? 0);
}
