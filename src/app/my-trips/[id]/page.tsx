import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTripView } from "@/lib/db/queries/trip-view";
import {
  verifyParticipantToken,
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { derivedStatus } from "@/lib/participant-status";
import { payBalanceAction } from "./actions";

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

  const fmt = (cents: number) => (cents / 100).toFixed(2);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{trip.event.title}</h1>
        <p className="text-neutral-600">{trip.organizer.displayName}</p>
        <p className="text-sm mt-2">
          {new Date(trip.event.startsAt).toLocaleString("pl-PL")}
          {trip.event.location ? ` · ${trip.event.location}` : ""}
        </p>
      </div>

      <section className="rounded border p-4 space-y-2">
        <h2 className="font-semibold">Płatność</h2>
        {full && (
          <p className="text-sm">
            {full.status === "succeeded" ? "Opłacone" : "Oczekuje"}:{" "}
            {fmt(full.amountCents)} zł
          </p>
        )}
        {deposit && (
          <p className="text-sm">
            Zaliczka: {fmt(deposit.amountCents)} zł —{" "}
            {deposit.status === "succeeded" ? "opłacona" : "oczekuje"}
          </p>
        )}
        {balance && (
          <p className="text-sm">
            Dopłata: {fmt(balance.amountCents)} zł —{" "}
            {balance.status === "succeeded" ? "opłacona" : "oczekuje"}
          </p>
        )}
        {balanceDue && (
          <p className="text-sm">
            Termin dopłaty: {new Date(balanceDue).toLocaleDateString("pl-PL")}
          </p>
        )}
        <p className="text-xs text-neutral-500">Status: {status}</p>

        {showPayBalance && (
          <form action={payBalanceAction} className="pt-2">
            <input type="hidden" name="participantId" value={trip.participant.id} />
            <input type="hidden" name="token" value={t ?? ""} />
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-neutral-800"
            >
              Opłać dopłatę
            </button>
          </form>
        )}
      </section>

      {trip.organizer.contactEmail && (
        <p className="text-sm">
          Pytanie?{" "}
          <a className="underline" href={`mailto:${trip.organizer.contactEmail}`}>
            Skontaktuj się z organizatorem
          </a>
        </p>
      )}
    </div>
  );
}
