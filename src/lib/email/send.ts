import { getResend, FROM_EMAIL } from "./client";
import {
  registrationConfirmedSubject,
  registrationConfirmedHtml,
  waitlistConfirmedSubject,
  waitlistConfirmedHtml,
  newRegistrationSubject,
  newRegistrationHtml,
  paymentConfirmedSubject,
  paymentConfirmedHtml,
  magicLinkSubject,
  magicLinkHtml,
  balanceReminderSubject,
  balanceReminderHtml,
  waitlistPromotedSubject,
  waitlistPromotedHtml,
  resendPaymentLinkSubject,
  resendPaymentLinkHtml,
  organizerAttentionSubject,
  organizerAttentionHtml,
  type AttentionReason,
  leadNotificationSubject,
  leadNotificationHtml,
} from "./templates";

/**
 * Email sends never break the request flow: failures are logged, not thrown.
 * Payment confirmation and DB writes are the source of truth; email is a
 * courtesy. The Resend SDK reports API errors in its return value instead of
 * throwing, so both paths are checked.
 */
export async function safeSend(params: {
  to: string;
  subject: string;
  html: string;
  /** Where replies go. Participant emails use the organizer's contact address. */
  replyTo?: string | null;
}): Promise<boolean> {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });
    if (error) {
      console.error("[email] send rejected:", { to: params.to, subject: params.subject, error });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] failed to send:", { to: params.to, subject: params.subject, err });
    return false;
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
  replyTo?: string | null;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: registrationConfirmedSubject(params.eventTitle),
    html: registrationConfirmedHtml(params),
    replyTo: params.replyTo,
  });
}

export async function sendWaitlistConfirmation(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  eventUrl: string;
  organizerName: string;
  myTripsUrl?: string;
  replyTo?: string | null;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: waitlistConfirmedSubject(params.eventTitle),
    html: waitlistConfirmedHtml(params),
    replyTo: params.replyTo,
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

export async function sendPaymentConfirmation(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  eventUrl: string;
  organizerName: string;
  paymentKind: "full" | "deposit" | "balance";
  amountCents: number;
  myTripsUrl?: string;
  replyTo?: string | null;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: paymentConfirmedSubject(params.eventTitle, params.paymentKind),
    html: paymentConfirmedHtml(params),
    replyTo: params.replyTo,
  });
}

export async function sendMagicLinkEmail(params: { to: string; link: string }): Promise<void> {
  await safeSend({
    to: params.to,
    subject: magicLinkSubject(),
    html: magicLinkHtml(params),
  });
}

export async function sendBalanceReminder(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  amountPln: string;
  dueDate: string;
  payUrl: string;
  organizerName: string;
  replyTo?: string | null;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: balanceReminderSubject(params.eventTitle),
    html: balanceReminderHtml(params),
    replyTo: params.replyTo,
  });
}

export async function sendWaitlistPromoted(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  expiryDate: string;
  eventDate: string;
  eventLocation: string | null;
  organizerName: string;
  replyTo?: string | null;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: waitlistPromotedSubject(params.eventTitle),
    html: waitlistPromotedHtml(params),
    replyTo: params.replyTo,
  });
}

export async function sendResendPaymentLink(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  organizerName: string;
  replyTo?: string | null;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: resendPaymentLinkSubject(params.eventTitle),
    html: resendPaymentLinkHtml(params),
    replyTo: params.replyTo,
  });
}

export async function sendOrganizerAttention(params: {
  to: string;
  reason: AttentionReason;
  participantName: string;
  participantEmail: string;
  eventTitle: string;
  amountCents: number;
  dashboardUrl: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: organizerAttentionSubject(params.reason, params.eventTitle),
    html: organizerAttentionHtml(params),
  });
}

export async function sendLeadNotification(params: {
  to: string;
  contact: string;
  contactKind: "phone" | "email";
  name: string | null;
  createdAt: number;
  adminUrl: string;
}): Promise<boolean> {
  return safeSend({
    to: params.to,
    subject: leadNotificationSubject(params.contact),
    html: leadNotificationHtml(params),
    replyTo: params.contactKind === "email" ? params.contact : null,
  });
}
