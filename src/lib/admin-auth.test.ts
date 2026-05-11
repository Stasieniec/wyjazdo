import { describe, it, expect } from "vitest";
import {
  signAdminSession,
  verifyAdminSession,
  constantTimeStringEq,
} from "./admin-auth";

const SECRET = "test-secret-please-rotate-abcdef1234567890";

describe("admin session cookie", () => {
  it("signs and verifies a fresh cookie", async () => {
    const issuedAtMs = 1_700_000_000_000;
    const cookie = await signAdminSession(issuedAtMs, SECRET);
    const result = await verifyAdminSession(cookie, SECRET, issuedAtMs + 1000);
    expect(result).toEqual({ issuedAtMs });
  });

  it("rejects a cookie past 7-day TTL", async () => {
    const issuedAtMs = 1_700_000_000_000;
    const cookie = await signAdminSession(issuedAtMs, SECRET);
    const sevenDaysOneSecondLater = issuedAtMs + 7 * 86_400_000 + 1000;
    expect(await verifyAdminSession(cookie, SECRET, sevenDaysOneSecondLater)).toBeNull();
  });

  it("rejects a cookie with a tampered signature", async () => {
    const cookie = await signAdminSession(1_700_000_000_000, SECRET);
    const [body] = cookie.split(".");
    const tampered = `${body}.deadbeef`;
    expect(await verifyAdminSession(tampered, SECRET, 1_700_000_000_001)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = await signAdminSession(1_700_000_000_000, SECRET);
    expect(await verifyAdminSession(cookie, "other-secret-xyz", 1_700_000_000_001)).toBeNull();
  });

  it("rejects malformed cookies", async () => {
    expect(await verifyAdminSession("", SECRET, 1)).toBeNull();
    expect(await verifyAdminSession("no-dot", SECRET, 1)).toBeNull();
    expect(await verifyAdminSession(".only-sig", SECRET, 1)).toBeNull();
    expect(await verifyAdminSession("only-body.", SECRET, 1)).toBeNull();
  });
});

describe("constantTimeStringEq", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeStringEq("abc", "abc")).toBe(true);
  });
  it("returns false for differing strings of same length", () => {
    expect(constantTimeStringEq("abc", "abd")).toBe(false);
  });
  it("returns false for strings of different length", () => {
    expect(constantTimeStringEq("abc", "abcd")).toBe(false);
  });
});
