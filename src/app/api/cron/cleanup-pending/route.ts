import { getCloudflareContext } from "@opennextjs/cloudflare";
import { expireStalePendingPayments } from "@/lib/db/queries/payments";

export const dynamic = "force-dynamic";

/**
 * Marks lapsed pending payments as expired. A participant whose only payment
 * expired stops holding a place (see holdsPlace in participant-status.ts);
 * the capacity checks already ignore lapsed rows, this keeps the data tidy.
 */
export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const secret = env.CRON_SECRET;
  if (!secret) return new Response("misconfigured", { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  await expireStalePendingPayments(Date.now());
  return new Response("ok");
}
