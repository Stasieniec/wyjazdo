"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ensureBalancePayment } from "@/lib/register/ensure-balance-payment";
import { getTripView } from "@/lib/db/queries/trip-view";
import {
  verifyParticipantToken,
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";

function origin() {
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${proto}//${host}`;
}

export async function payBalanceAction(form: FormData): Promise<void> {
  const participantId = String(form.get("participantId") ?? "");
  const token = String(form.get("token") ?? "");

  const secret = getParticipantAuthSecret();
  const now = Date.now();

  const trip = await getTripView(participantId);
  if (!trip) throw new Error("not found");

  let ok = false;
  if (token) ok = await verifyParticipantToken(token, participantId, secret);
  if (!ok) {
    const c = (await cookies()).get("wyjazdo_participant_email")?.value;
    if (c) {
      const session = await verifyMagicLinkCookie(c, secret, now);
      if (session && session.email.toLowerCase() === trip.participant.email.toLowerCase()) {
        ok = true;
      }
    }
  }
  if (!ok) throw new Error("unauthorized");

  const url = await ensureBalancePayment({
    participant: trip.participant,
    event: trip.event,
    organizer: trip.organizer,
    origin: origin(),
  });
  redirect(url);
}
