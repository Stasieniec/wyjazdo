// Custom Worker entry that composes OpenNext's default fetch handler
// with a scheduled handler for D1 cleanup.
//
// The import below uses @ts-ignore (not @ts-expect-error) because the file
// is generated at build time by opennextjs-cloudflare: it doesn't exist in
// dev (where the line errors and @ts-ignore suppresses), but does exist
// after a build (where @ts-expect-error would itself fail).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ) {
    if (controller.cron === "0 8 * * *") {
      // Nightly balance-reminder emails.
      ctx.waitUntil((async () => {
        try {
          const { runBalanceReminders } = await import("./src/lib/cron/balance-reminders");
          await runBalanceReminders();
        } catch (err) {
          console.error("balance reminders cron failed", err);
        }
      })());
      return;
    }

    // Default: call our own cleanup endpoint, authenticated with CRON_SECRET.
    const res = await fetch(
      `https://${env.NEXT_PUBLIC_ROOT_DOMAIN}/api/cron/cleanup-pending`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      },
    );
    if (!res.ok) {
      console.error("cleanup-pending failed", res.status, await res.text());
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
