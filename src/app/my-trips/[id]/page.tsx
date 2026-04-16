export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripView } from "@/lib/db/queries/trip-view";
import {
  verifyParticipantToken,
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { derivedStatus } from "@/lib/participant-status";
import { payBalanceAction } from "./actions";
import { formatPlnFromCents } from "@/lib/format-currency";
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

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const secret = getParticipantAuthSecret();
  const now = Date.now();

  const trip = await getTripView(id);
  if (!trip) notFound();

  const tokenOk = t ? await verifyParticipantToken(t, id, secret) : false;

  let cookieOk = false;
  if (!tokenOk) {
    const c = (await cookies()).get("wyjazdo_participant_email")?.value;
    if (c) {
      const session = await verifyMagicLinkCookie(c, secret, now);
      if (session && session.email.toLowerCase() === trip.participant.email.toLowerCase()) {
        cookieOk = true;
      }
    }
  }
  if (!tokenOk && !cookieOk) notFound();

  const status = derivedStatus(
    { lifecycleStatus: trip.participant.lifecycleStatus },
    trip.payments.map((p) => ({ kind: p.kind, status: p.status, dueAt: p.dueAt })),
    now,
  );

  const deposit = trip.payments.find((p) => p.kind === "deposit");
  const balance = trip.payments.find((p) => p.kind === "balance");
  const full = trip.payments.find((p) => p.kind === "full");
  const balanceDue = balance?.dueAt ?? trip.event.balanceDueAt ?? null;

  const showPayBalance = status === "deposit_paid" || status === "overdue";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <WyjazdoMark className="h-7 w-7 shrink-0" />
            wyjazdo
          </Link>
          <Link href="/my-trips" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Twoje wyjazdy
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold sm:text-2xl">{trip.event.title}</h1>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{trip.organizer.displayName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(trip.event.startsAt).toLocaleString("pl-PL")}
            {trip.event.location ? ` · ${trip.event.location}` : ""}
          </p>
        </div>

        <Card padding="md">
          <h2 className="font-semibold text-foreground">Płatność</h2>
          <div className="mt-3 space-y-2 text-sm">
            {full && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{full.status === "succeeded" ? "Opłacone" : "Oczekuje"}</span>
                <span className="font-medium">{formatPlnFromCents(full.amountCents)}</span>
              </div>
            )}
            {deposit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zaliczka {deposit.status === "succeeded" ? "(opłacona)" : "(oczekuje)"}</span>
                <span className="font-medium">{formatPlnFromCents(deposit.amountCents)}</span>
              </div>
            )}
            {balance && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dopłata {balance.status === "succeeded" ? "(opłacona)" : "(oczekuje)"}</span>
                <span className="font-medium">{formatPlnFromCents(balance.amountCents)}</span>
              </div>
            )}
            {balanceDue && (
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Termin dopłaty</span>
                <span className="font-medium">{new Date(balanceDue).toLocaleDateString("pl-PL")}</span>
              </div>
            )}
          </div>

          {showPayBalance && (
            <form action={payBalanceAction} className="mt-4 pt-4 border-t border-border">
              <input type="hidden" name="participantId" value={trip.participant.id} />
              <input type="hidden" name="token" value={t ?? ""} />
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
              >
                Opłać dopłatę
              </button>
            </form>
          )}
        </Card>

        {trip.organizer.contactEmail && (
          <p className="text-sm text-muted-foreground">
            Pytanie?{" "}
            <a className="text-primary underline underline-offset-2 hover:text-primary/80" href={`mailto:${trip.organizer.contactEmail}`}>
              Skontaktuj się z organizatorem
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
