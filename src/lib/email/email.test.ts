import { describe, it, expect, vi, beforeEach } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({
  FROM_EMAIL: "Wyjazdo <no-reply@wyjazdo.pl>",
  getResend: () => ({ emails: { send: resendSend } }),
}));

import { safeSend, sendPaymentConfirmation } from "./send";
import { registrationConfirmedHtml, newRegistrationHtml, esc } from "./templates";

beforeEach(() => resendSend.mockReset());

describe("safeSend", () => {
  it("logs when Resend returns an error object instead of throwing", async () => {
    resendSend.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "bad from" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await safeSend({ to: "a@b.pl", subject: "s", html: "h" })).toBe(false);
    expect(log).toHaveBeenCalledWith("[email] send rejected:", expect.objectContaining({ to: "a@b.pl" }));
    log.mockRestore();
  });

  it("logs a thrown error too", async () => {
    resendSend.mockRejectedValueOnce(new Error("network"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await safeSend({ to: "a@b.pl", subject: "s", html: "h" })).toBe(false);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("sets reply-to to the organizer on participant emails", async () => {
    resendSend.mockResolvedValueOnce({ data: { id: "1" }, error: null });
    await sendPaymentConfirmation({
      to: "guest@example.com",
      participantName: "Ewa",
      eventTitle: "Weekend",
      eventDate: "1 listopada 2026",
      eventLocation: null,
      eventUrl: "https://x",
      organizerName: "Dom",
      paymentKind: "deposit",
      amountCents: 50_000,
      replyTo: "mama@example.com",
    });
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "mama@example.com" }));
  });
});

describe("templates", () => {
  it("escapes user input", () => {
    const html = registrationConfirmedHtml({
      participantName: '<img src=x onerror="alert(1)">',
      eventTitle: "Joga & cisza",
      eventDate: "1 listopada",
      eventLocation: "<b>Mazury</b>",
      eventUrl: 'https://x/"><script>',
      organizerName: "Dom",
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>Mazury");
    expect(html).not.toContain('"><script>');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Joga &amp; cisza");
  });

  it("escapes the participant email in organizer notifications", () => {
    const html = newRegistrationHtml({
      participantName: "Ewa",
      participantEmail: "<x>@example.com",
      eventTitle: "W",
      spotsInfo: "1 / 16",
      isWaitlisted: false,
      dashboardUrl: "https://x",
    });
    expect(html).toContain("&lt;x&gt;@example.com");
  });

  it("esc handles null", () => {
    expect(esc(null)).toBe("");
  });
});
