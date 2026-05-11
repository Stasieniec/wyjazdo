import { formatPlnFromCents } from "@/lib/format-currency";
import type { EventDetailParticipant } from "@/lib/db/queries/admin";

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function AdminParticipantRow({ p }: { p: EventDetailParticipant }) {
  return (
    <details className="border-b border-border last:border-b-0">
      <summary className="grid cursor-pointer grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
        <span>
          <span className="font-medium">
            {p.firstName} {p.lastName}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
        </span>
        <span className="text-xs text-muted-foreground">{p.lifecycleStatus}</span>
        <span className="tabular-nums text-xs">{p.activeAttendeeCount} os.</span>
        <span className="tabular-nums text-xs">{formatPlnFromCents(p.paidCents)}</span>
        <span className="tabular-nums text-xs text-amber-700">
          {p.outstandingCents > 0 ? formatPlnFromCents(p.outstandingCents) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
      </summary>
      <div className="space-y-3 bg-muted/20 px-6 py-3 text-xs">
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Telefon
          </div>
          <div>{p.phone ?? "—"}</div>
        </div>
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Uczestnicy ({p.attendees.length})
          </div>
          {p.attendees.length === 0 ? (
            <div className="text-muted-foreground">Brak.</div>
          ) : (
            <ul className="space-y-0.5">
              {p.attendees.map((a) => (
                <li key={a.id}>
                  {a.firstName} {a.lastName} · {a.attendeeTypeId}
                  {a.cancelledAt ? (
                    <span className="ml-2 text-amber-700">
                      anulowany {formatDate(a.cancelledAt)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Płatności ({p.payments.length})
          </div>
          {p.payments.length === 0 ? (
            <div className="text-muted-foreground">Brak.</div>
          ) : (
            <ul className="space-y-0.5">
              {p.payments.map((pay) => (
                <li key={pay.id} className="tabular-nums">
                  {pay.kind} · {formatPlnFromCents(pay.amountCents)} · {pay.status}
                  {pay.paidAt ? ` · opłacono ${formatDate(pay.paidAt)}` : ""}
                  {pay.dueAt ? ` · termin ${formatDate(pay.dueAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
