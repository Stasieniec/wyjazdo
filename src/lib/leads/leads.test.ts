import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));
const env = vi.hoisted(() => ({ LEADS_NOTIFY_EMAIL: "zespol@example.com" as string | undefined }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env }) }));
const sendLeadNotification = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/email/send", () => ({ sendLeadNotification }));
const headerMap = vi.hoisted(() => ({ ip: "9.9.9.9", ua: "TestBrowser/1.0" }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["cf-connecting-ip", headerMap.ip],
      ["user-agent", headerMap.ua],
    ]),
}));

import { resetTestDb, rows } from "@/test/db-mock";
import { leadInputSchema, normalizePolishPhone, parseContact, CONTACT_ERROR } from "./validate";
import { submitLead, RATE_LIMIT_ERROR } from "./submit";
import { requestCallbackAction } from "@/app/actions";
import { leadNotificationHtml } from "@/lib/email/templates";

let ipCounter = 0;
const freshIp = () => `10.1.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`;

beforeEach(() => {
  resetTestDb();
  vi.clearAllMocks();
  env.LEADS_NOTIFY_EMAIL = "zespol@example.com";
});

describe("normalizePolishPhone", () => {
  it.each([
    ["600 100 200", "+48600100200"],
    ["600-100-200", "+48600100200"],
    ["+48 600 100 200", "+48600100200"],
    ["0048600100200", "+48600100200"],
    ["48 600100200", "+48600100200"],
    ["(22) 123 45 67", "+48221234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizePolishPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "600 100 20", "600 100 2000", "+49 600 100 200", "060 010 0200", "600 100 2oo"])(
    "rejects %j",
    (input) => {
      expect(normalizePolishPhone(input)).toBeNull();
    },
  );
});

describe("parseContact", () => {
  it("lower-cases and trims emails", () => {
    expect(parseContact("  Anna.Kowalska@Poczta.PL ")).toEqual({ kind: "email", value: "anna.kowalska@poczta.pl" });
  });

  it("rejects malformed emails instead of treating them as phones", () => {
    expect(parseContact("anna@")).toBeNull();
    expect(parseContact("anna@poczta")).toBeNull();
  });

  it("recognises phones", () => {
    expect(parseContact("600100200")).toEqual({ kind: "phone", value: "+48600100200" });
  });
});

describe("leadInputSchema", () => {
  it("turns an empty name into null", () => {
    const r = leadInputSchema.parse({ contact: "600100200", name: "   " });
    expect(r.name).toBeNull();
  });

  it("reports a contact error with the Polish message", () => {
    const r = leadInputSchema.safeParse({ contact: "zadzwoń do mnie", name: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ["contact"], message: CONTACT_ERROR });
  });

  it("limits the name length", () => {
    const r = leadInputSchema.safeParse({ contact: "600100200", name: "a".repeat(101) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["name"]);
  });
});

describe("submitLead", () => {
  it("stores the normalised lead and notifies the configured address", async () => {
    const ip = freshIp();
    const result = await submitLead(
      { contact: "+48 600 100 200", name: " Ania " },
      { ip, userAgent: "UA", now: 1_700_000_000_000 },
    );
    expect(result).toEqual({ status: "success" });
    const stored = rows("SELECT * FROM leads");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      contact: "+48600100200",
      name: "Ania",
      created_at: 1_700_000_000_000,
      ip,
      user_agent: "UA",
      handled_at: null,
    });
    expect(sendLeadNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "zespol@example.com",
        contact: "+48600100200",
        contactKind: "phone",
        name: "Ania",
      }),
    );
  });

  it("still stores the lead and warns when LEADS_NOTIFY_EMAIL is missing", async () => {
    env.LEADS_NOTIFY_EMAIL = undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await submitLead({ contact: "ania@example.com", name: null }, { ip: freshIp(), userAgent: null });
    expect(result).toEqual({ status: "success" });
    expect(rows("SELECT contact, name FROM leads")).toEqual([{ contact: "ania@example.com", name: null }]);
    expect(sendLeadNotification).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("LEADS_NOTIFY_EMAIL"), expect.anything());
    warn.mockRestore();
  });

  it("returns field errors and the typed values without storing anything", async () => {
    const result = await submitLead({ contact: "123", name: "Ania" }, { ip: freshIp(), userAgent: null });
    expect(result).toEqual({
      status: "error",
      fieldErrors: { contact: CONTACT_ERROR },
      values: { contact: "123", name: "Ania" },
    });
    expect(rows("SELECT * FROM leads")).toHaveLength(0);
    expect(sendLeadNotification).not.toHaveBeenCalled();
  });

  it("treats a missing contact field as a validation error", async () => {
    const result = await submitLead({ contact: null, name: null }, { ip: freshIp(), userAgent: null });
    expect(result).toMatchObject({ status: "error", fieldErrors: { contact: CONTACT_ERROR } });
  });

  it("rate-limits per IP", async () => {
    const ip = freshIp();
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(await submitLead({ contact: `60010020${i}`, name: "" }, { ip, userAgent: null }));
    }
    expect(results.filter((r) => r.status === "success")).toHaveLength(5);
    expect(results.at(-1)).toMatchObject({ status: "error", formError: RATE_LIMIT_ERROR });
    expect(rows("SELECT * FROM leads")).toHaveLength(5);
  });

  it("quietly drops submissions that fill the hidden field", async () => {
    const result = await submitLead(
      { contact: "600100200", name: "", website: "http://spam.example" },
      { ip: freshIp(), userAgent: null },
    );
    expect(result).toEqual({ status: "success" });
    expect(rows("SELECT * FROM leads")).toHaveLength(0);
    expect(sendLeadNotification).not.toHaveBeenCalled();
  });
});

describe("requestCallbackAction", () => {
  it("reads the form and request headers", async () => {
    headerMap.ip = freshIp();
    const fd = new FormData();
    fd.set("contact", "Ania@Example.com");
    fd.set("name", "Ania");
    fd.set("website", "");
    const result = await requestCallbackAction({ status: "idle" }, fd);
    expect(result).toEqual({ status: "success" });
    expect(rows("SELECT contact, ip, user_agent FROM leads")).toEqual([
      { contact: "ania@example.com", ip: headerMap.ip, user_agent: "TestBrowser/1.0" },
    ]);
    expect(sendLeadNotification).toHaveBeenCalledWith(expect.objectContaining({ contactKind: "email" }));
  });
});

describe("leadNotificationHtml", () => {
  it("escapes the name", () => {
    const html = leadNotificationHtml({
      contact: "+48600100200",
      contactKind: "phone",
      name: "<b>Ania</b>",
      createdAt: 0,
      adminUrl: "https://wyjazdo.pl/admin/leads",
    });
    expect(html).toContain("&lt;b&gt;Ania&lt;/b&gt;");
    expect(html).toContain('href="tel:+48600100200"');
  });
});
