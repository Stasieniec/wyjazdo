/**
 * Minimal, inline-styled HTML emails. No external CSS — email clients strip it.
 * All emails are in Polish.
 */

const BRAND_COLOR = "#1E3A5F";
const ACCENT_COLOR = "#E8683A";

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">wyjazdo</span>
        </td></tr>
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;">
            Wysłano przez <a href="https://wyjazdo.pl" style="color:${BRAND_COLOR};text-decoration:none;">wyjazdo.pl</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT_COLOR};color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">${text}</a>`;
}

// ─── Registration Confirmed ─────────────────────────────────────────────────

export function registrationConfirmedSubject(eventTitle: string): string {
  return `Potwierdzenie zapisu — ${eventTitle}`;
}

export function registrationConfirmedHtml(params: {
  participantName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  eventUrl: string;
  organizerName: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Dziękujemy za zapis!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, Twoje miejsce zostało potwierdzone.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Wydarzenie</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">${params.eventTitle}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Termin</p>
        <p style="margin:0 0 12px;font-size:15px;color:#111827;">${params.eventDate}</p>
        ${params.eventLocation ? `
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Miejsce</p>
        <p style="margin:0;font-size:15px;color:#111827;">${params.eventLocation}</p>
        ` : ""}
      </td></tr>
    </table>
    ${button(params.eventUrl, "Zobacz wydarzenie")}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}

// ─── Waitlist Confirmed ─────────────────────────────────────────────────────

export function waitlistConfirmedSubject(eventTitle: string): string {
  return `Lista rezerwowa — ${eventTitle}`;
}

export function waitlistConfirmedHtml(params: {
  participantName: string;
  eventTitle: string;
  eventUrl: string;
  organizerName: string;
  myTripsUrl?: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Jesteś na liście rezerwowej</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, miejsca na <strong>${params.eventTitle}</strong> są
      aktualnie wyprzedane. Zapisaliśmy Cię na listę rezerwową — organizator
      skontaktuje się z Tobą, jeśli zwolni się miejsce.
    </p>
    ${params.myTripsUrl ? button(params.myTripsUrl, "Sprawdź status") : button(params.eventUrl, "Zobacz wydarzenie")}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}

// ─── Organizer Notification ─────────────────────────────────────────────────

export function newRegistrationSubject(eventTitle: string, participantName: string): string {
  return `Nowy zapis: ${participantName} — ${eventTitle}`;
}

export function newRegistrationHtml(params: {
  participantName: string;
  participantEmail: string;
  eventTitle: string;
  spotsInfo: string;
  isWaitlisted: boolean;
  dashboardUrl: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">
      ${params.isWaitlisted ? "Nowy zapis na listę rezerwową" : "Nowy uczestnik!"}
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      <strong>${params.participantName}</strong> (${params.participantEmail})
      ${params.isWaitlisted ? "dołączył/a do listy rezerwowej" : "zapisał/a się na wydarzenie"}
      <strong>${params.eventTitle}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Miejsca: ${params.spotsInfo}
    </p>
    ${button(params.dashboardUrl, "Otwórz panel")}
  `);
}

// ─── Payment Confirmed ──────────────────────────────────────────────────────

export function paymentConfirmedSubject(eventTitle: string, kind: "full" | "deposit" | "balance") {
  switch (kind) {
    case "deposit":
      return `Potwierdzenie zaliczki — ${eventTitle}`;
    case "balance":
      return `Potwierdzenie pełnej płatności — ${eventTitle}`;
    case "full":
    default:
      return `Potwierdzenie płatności — ${eventTitle}`;
  }
}

// ─── Magic Link ────────────────────────────────────────────────────────────

export function magicLinkSubject() {
  return "Twój link do wyjazdo.pl";
}

export function magicLinkHtml(params: { link: string }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Twój link logowania</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Kliknij poniżej, aby zobaczyć swoje wyjazdy:
    </p>
    ${button(params.link, "Otwórz moje wyjazdy")}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      Link wygaśnie za 15 minut. Jeśli nie prosiłeś/aś o ten link, zignoruj wiadomość.
    </p>
  `);
}

export function balanceReminderSubject(eventTitle: string) {
  return `Przypomnienie o dopłacie — ${eventTitle}`;
}

export function balanceReminderHtml(params: {
  participantName: string;
  eventTitle: string;
  amountPln: string;
  dueDate: string;
  payUrl: string;
  organizerName: string;
}) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Przypomnienie o dopłacie</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, do opłacenia pozostało <strong>${params.amountPln} zł</strong>
      za <strong>${params.eventTitle}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Termin dopłaty: <strong>${params.dueDate}</strong>
    </p>
    ${button(params.payUrl, "Opłać teraz")}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}

// ─── Waitlist Promoted ─────────────────────────────────────────────────────

export function waitlistPromotedSubject(eventTitle: string): string {
  return `Zwolniło się miejsce — ${eventTitle}`;
}

export function waitlistPromotedHtml(params: {
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  expiryDate: string;
  eventDate: string;
  eventLocation: string | null;
  organizerName: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Zwolniło się miejsce!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, mamy dobrą wiadomość — zwolniło się miejsce
      na <strong>${params.eventTitle}</strong>. Aby potwierdzić udział, opłać rezerwację
      klikając poniższy przycisk.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Wydarzenie</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">${params.eventTitle}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Termin</p>
        <p style="margin:0 0 12px;font-size:15px;color:#111827;">${params.eventDate}</p>
        ${params.eventLocation ? `
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Miejsce</p>
        <p style="margin:0;font-size:15px;color:#111827;">${params.eventLocation}</p>
        ` : ""}
      </td></tr>
    </table>
    ${button(params.paymentUrl, "Opłać i potwierdź udział")}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Link ważny do: <strong>${params.expiryDate}</strong>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}

// ─── Resend Payment Link ───────────────────────────────────────────────────

export function resendPaymentLinkSubject(eventTitle: string): string {
  return `Nowy link do płatności — ${eventTitle}`;
}

export function resendPaymentLinkHtml(params: {
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  organizerName: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Nowy link do płatności</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, wygenerowaliśmy nowy link do płatności
      za <strong>${params.eventTitle}</strong>. Kliknij poniższy przycisk, aby dokończyć płatność.
    </p>
    ${button(params.paymentUrl, "Opłać teraz")}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Link wygaśnie za 30 minut.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}

export function paymentConfirmedHtml(params: {
  participantName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  eventUrl: string;
  organizerName: string;
  paymentKind: "full" | "deposit" | "balance";
  amountCents: number;
  myTripsUrl?: string;
}) {
  const amount = (params.amountCents / 100).toFixed(2);
  const kindLabel =
    params.paymentKind === "deposit"
      ? "zaliczkę"
      : params.paymentKind === "balance"
        ? "dopłatę"
        : "płatność";

  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Dziękujemy za ${kindLabel}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, otrzymaliśmy Twoją ${kindLabel} w wysokości <strong>${amount} zł</strong>
      za <strong>${params.eventTitle}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Wydarzenie</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">${params.eventTitle}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Termin</p>
        <p style="margin:0;font-size:15px;color:#111827;">${params.eventDate}</p>
        ${params.eventLocation ? `
        <p style="margin:12px 0 4px;font-size:13px;color:#6b7280;">Miejsce</p>
        <p style="margin:0;font-size:15px;color:#111827;">${params.eventLocation}</p>
        ` : ""}
      </td></tr>
    </table>
    ${params.myTripsUrl ? button(params.myTripsUrl, "Zarządzaj wyjazdem") : button(params.eventUrl, "Zobacz wydarzenie")}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}
