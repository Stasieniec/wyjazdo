export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listTripSummariesByEmail } from "@/lib/db/queries/participants";
import { listPaymentsForParticipants } from "@/lib/db/queries/payments";
import {
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { derivedStatus, type PaymentLike } from "@/lib/participant-status";
import { Card } from "@/components/ui";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";

const STATUS_LABELS: Record<string, string> = {
  paid: "Opłacony",
  deposit_paid: "Zaliczka opłacona",
  pending: "Oczekuje na płatność",
  overdue: "Zaległa płatność",
  waitlisted: "Lista rezerwowa",
  cancelled: "Anulowany",
  refunded: "Zwrócony",
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success/10 text-success",
  deposit_paid: "bg-success/10 text-success",
  pending: "bg-amber-50 text-amber-700",
  overdue: "bg-amber-50 text-amber-700",
  waitlisted: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

export default async function MyTripsIndex() {
  const secret = getParticipantAuthSecret();
  const now = Date.now();
  const c = (await cookies()).get("wyjazdo_participant_email")?.value;
  if (!c) redirect("/my-trips/request-link");
  const session = await verifyMagicLinkCookie(c, secret, now);
  if (!session) redirect("/my-trips/request-link?invalid=1");

  const trips = await listTripSummariesByEmail(session.email);
  const allPayments = await listPaymentsForParticipants(trips.map((t) => t.participantId));
  const byPid = new Map<string, PaymentLike[]>();
  for (const p of allPayments) {
    const list = byPid.get(p.participantId) ?? [];
    list.push({
      kind: p.kind as PaymentLike["kind"],
      status: p.status as PaymentLike["status"],
      dueAt: p.dueAt,
    });
    byPid.set(p.participantId, list);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <WyjazdoMark className="h-7 w-7 shrink-0" />
            wyjazdo
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-bold sm:text-2xl">Twoje wyjazdy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Zalogowano jako {session.email}</p>
        {trips.length === 0 && (
          <Card className="mt-6 text-center" padding="lg">
            <p className="text-sm text-muted-foreground">Nie masz jeszcze żadnych rejestracji.</p>
          </Card>
        )}
        <ul className="mt-6 space-y-3">
          {trips.map((t) => {
            const status = derivedStatus(
              { lifecycleStatus: t.lifecycleStatus },
              byPid.get(t.participantId) ?? [],
              now,
            );
            return (
              <li key={t.participantId}>
                <Card padding="sm" className="transition-all duration-150 hover:shadow-md">
                  <Link href={`/my-trips/${t.participantId}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground">{t.eventTitle}</h2>
                        <p className="text-sm text-muted-foreground">{t.organizerName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {new Date(t.eventStartsAt).toLocaleDateString("pl-PL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                          {t.eventLocation ? ` · ${t.eventLocation}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
