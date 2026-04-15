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
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Jesteś na liście rezerwowej</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, miejsca na <strong>${params.eventTitle}</strong> są
      aktualnie wyprzedane. Zapisaliśmy Cię na listę rezerwową — organizator
      skontaktuje się z Tobą, jeśli zwolni się miejsce.
    </p>
    ${button(params.eventUrl, "Zobacz wydarzenie")}
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

export function paymentConfirmedHtml(params: {
  participantName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  eventUrl: string;
  organizerName: string;
  paymentKind: "full" | "deposit" | "balance";
  amountCents: number;
}) {
  const amount = (params.amountCents / 100).toFixed(2);
  const locationLine = params.eventLocation ? `<p>Miejsce: ${params.eventLocation}</p>` : "";
  const kindLabel =
    params.paymentKind === "deposit"
      ? "zaliczkę"
      : params.paymentKind === "balance"
        ? "dopłatę"
        : "płatność";

  return `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111;">Dziękujemy za ${kindLabel}!</h2>
    <p>Cześć ${params.participantName},</p>
    <p>Otrzymaliśmy Twoją ${kindLabel} w wysokości <strong>${amount} zł</strong> za <strong>${params.eventTitle}</strong>.</p>
    <p>Data: ${params.eventDate}</p>
    ${locationLine}
    <p><a href="${params.eventUrl}" style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Zobacz wydarzenie</a></p>
    <p style="color: #555; margin-top: 32px;">— ${params.organizerName}</p>
  </div>`;
}
