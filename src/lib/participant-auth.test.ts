import { describe, it, expect } from "vitest";
import {
  signParticipantToken,
  verifyParticipantToken,
  signMagicLinkCookie,
  verifyMagicLinkCookie,
  signMagicLinkOneTime,
  verifyMagicLinkOneTime,
} from "./participant-auth";

const SECRET = "test-secret-please-rotate";

describe("participant token", () => {
  it("signs and verifies round-trip", async () => {
    const t = await signParticipantToken("p_abc", SECRET);
    expect(await verifyParticipantToken(t, "p_abc", SECRET)).toBe(true);
  });

  it("rejects tampered payload", async () => {
    const t = await signParticipantToken("p_abc", SECRET);
    expect(await verifyParticipantToken(t, "p_xyz", SECRET)).toBe(false);
  });

  it("rejects wrong secret", async () => {
    const t = await signParticipantToken("p_abc", SECRET);
    expect(await verifyParticipantToken(t, "p_abc", "other")).toBe(false);
  });
});

describe("magic-link cookie", () => {
  it("signs and verifies email session", async () => {
    const c = await signMagicLinkCookie("user@example.com", 1000, SECRET);
    const v = await verifyMagicLinkCookie(c, SECRET, 1000 + 1);
    expect(v).toEqual({ email: "user@example.com", issuedAt: 1000 });
  });

  it("rejects cookie past 30-day TTL", async () => {
    const c = await signMagicLinkCookie("u@e.com", 0, SECRET);
    const v = await verifyMagicLinkCookie(c, SECRET, 0 + 31 * 86_400_000);
    expect(v).toBeNull();
  });

  it("rejects tampered cookie", async () => {
    const c = await signMagicLinkCookie("u@e.com", 0, SECRET);
    const tampered = c.replace(/.$/, (ch) => (ch === "a" ? "b" : "a"));
    expect(await verifyMagicLinkCookie(tampered, SECRET, 1)).toBeNull();
  });
});

describe("magic-link one-time token", () => {
  it("signs and verifies within TTL", async () => {
    const t = await signMagicLinkOneTime("u@e.com", 1000, SECRET);
    const v = await verifyMagicLinkOneTime(t, SECRET, 1000 + 1000);
    expect(v).toEqual({ email: "u@e.com", issuedAt: 1000 });
  });

  it("rejects past 15-min TTL", async () => {
    const t = await signMagicLinkOneTime("u@e.com", 0, SECRET);
    const v = await verifyMagicLinkOneTime(t, SECRET, 16 * 60_000);
    expect(v).toBeNull();
  });
});
