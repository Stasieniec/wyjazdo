import { getResend, FROM_EMAIL } from "./client";
import {
  registrationConfirmedSubject,
  registrationConfirmedHtml,
  waitlistConfirmedSubject,
  waitlistConfirmedHtml,
  newRegistrationSubject,
  newRegistrationHtml,
} from "./templates";

/**
 * All email sends are fire-and-forget — we log errors but never let
 * them break the request flow. Payment confirmation and DB writes
 * are the source of truth; email is a courtesy.
 */
async function safeSend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (err) {
    console.error("[email] failed to send:", err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function sendRegistrationConfirmation(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  eventUrl: string;
  organizerName: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: registrationConfirmedSubject(params.eventTitle),
    html: registrationConfirmedHtml(params),
  });
}

export async function sendWaitlistConfirmation(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  eventUrl: string;
  organizerName: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: waitlistConfirmedSubject(params.eventTitle),
    html: waitlistConfirmedHtml(params),
  });
}

export async function sendOrganizerNewRegistration(params: {
  to: string;
  participantName: string;
  participantEmail: string;
  eventTitle: string;
  spotsInfo: string;
  isWaitlisted: boolean;
  dashboardUrl: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: newRegistrationSubject(params.eventTitle, params.participantName),
    html: newRegistrationHtml(params),
  });
}
