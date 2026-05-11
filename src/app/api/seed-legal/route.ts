import { getCloudflareContext } from "@opennextjs/cloudflare";
import { seedLegalDocuments } from "@/lib/legal/seed-documents";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const secret = env.CRON_SECRET;
  if (!secret) return new Response("misconfigured", { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const results = await seedLegalDocuments();
  return Response.json({ ok: true, results });
}
