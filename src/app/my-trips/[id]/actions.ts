"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ensureBalancePayment } from "@/lib/register/ensure-balance-payment";
import {
  CheckoutBlockedError,
  openFirstPaymentCheckout,
} from "@/lib/register/first-payment";
import { getTripView } from "@/lib/db/queries/trip-view";
import { publicEventUrl } from "@/lib/urls";
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

async function authorizedTrip(form: FormData) {
  const participantId = String(form.get("participantId") ?? "");
  const token = String(form.get("token") ?? "");
  const secret = getParticipantAuthSecret();

  const trip = await getTripView(participantId);
  if (!trip) throw new Error("not found");

  let ok = false;
  if (token) ok = await verifyParticipantToken(token, participantId, secret);
  if (!ok) {
    const c = (await cookies()).get("wyjazdo_participant_email")?.value;
    if (c) {
      const session = await verifyMagicLinkCookie(c, secret, Date.now());
      if (session && session.email.toLowerCase() === trip.participant.email.toLowerCase()) {
        ok = true;
      }
    }
  }
  if (!ok) throw new Error("unauthorized");
  return { trip, token };
}

function tripPageWithError(participantId: string, token: string, reason: string): string {
  const q = new URLSearchParams({ err: reason });
  if (token) q.set("t", token);
  return `/my-trips/${participantId}?${q.toString()}`;
}

export async function payBalanceAction(form: FormData): Promise<void> {
  const { trip, token } = await authorizedTrip(form);
  let url: string;
  try {
    url = await ensureBalancePayment({
      participant: trip.participant,
      event: trip.event,
      organizer: trip.organizer,
      origin: origin(),
    });
  } catch (err) {
    if (err instanceof CheckoutBlockedError) {
      redirect(tripPageWithError(trip.participant.id, token, err.reason));
    }
    throw err;
  }
  redirect(url);
}

/**
 * For a registration that has not been paid yet: back to the open checkout,
 * or a new one if it lapsed and there is still room.
 */
export async function payFirstAction(form: FormData): Promise<void> {
  const { trip, token } = await authorizedTrip(form);
  const eventUrl = publicEventUrl(trip.organizer.subdomain, trip.event.slug);
  const tripUrl = `${origin()}/my-trips/${trip.participant.id}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
  let url: string;
  try {
    url = await openFirstPaymentCheckout({
      participant: trip.participant,
      event: trip.event,
      organizer: trip.organizer,
      successUrl: `${eventUrl}/thanks?pid=${trip.participant.id}`,
      cancelUrl: tripUrl,
      reuseOpen: true,
    });
  } catch (err) {
    if (err instanceof CheckoutBlockedError) {
      redirect(tripPageWithError(trip.participant.id, token, err.reason));
    }
    throw err;
  }
  redirect(url);
}
