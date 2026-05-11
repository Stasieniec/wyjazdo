import Link from "next/link";
import { formatPlnFromCents } from "@/lib/format-currency";
import type { RecentPayment } from "@/lib/db/queries/admin";

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentPaymentsList({ rows }: { rows: RecentPayment[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak płatności.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-background">
      {rows.map((r) => (
        <li key={r.paymentId} className="grid grid-cols-[1fr_auto] gap-2 p-3 text-sm">
          <div className="min-w-0">
            <div className="font-medium tabular-nums text-primary">
              {formatPlnFromCents(r.amountCents)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              <Link
                href={`/admin/organizers/${r.organizerId}`}
                className="hover:underline"
              >
                {r.organizerDisplayName}
              </Link>{" "}
              ·{" "}
              <Link
                href={`/admin/organizers/${r.organizerId}/events/${r.eventId}`}
                className="hover:underline"
              >
                {r.eventTitle}
              </Link>{" "}
              · {r.participantName} ({r.participantEmail})
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {r.paidAt ? formatDateTime(r.paidAt) : "—"}
          </div>
        </li>
      ))}
    </ul>
  );
}
