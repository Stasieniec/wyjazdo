import { runBalanceReminders } from "@/lib/cron/balance-reminders";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runBalanceReminders();
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
}
