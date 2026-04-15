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
    <div className="max-w-2xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Twoje wyjazdy</h1>
      <p className="text-sm text-neutral-600">Zalogowano jako {session.email}</p>
      {trips.length === 0 && (
        <p className="rounded border p-4 text-sm text-neutral-600">Brak rejestracji.</p>
      )}
      <ul className="space-y-3">
        {trips.map((t) => {
          const status = derivedStatus(
            { lifecycleStatus: t.lifecycleStatus },
            byPid.get(t.participantId) ?? [],
            now,
          );
          return (
            <li key={t.participantId} className="rounded border p-4">
              <Link href={`/my-trips/${t.participantId}`} className="font-medium underline">
                {t.eventTitle}
              </Link>
              <p className="text-sm text-neutral-600">{t.organizerName}</p>
              <p className="text-sm">{new Date(t.eventStartsAt).toLocaleDateString("pl-PL")}</p>
              <p className="text-xs text-neutral-500 mt-1">Status: {status}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
