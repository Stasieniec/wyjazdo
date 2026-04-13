import { describe, it, expect } from "vitest";
import { computeSpotsTaken, type CountableParticipant } from "./capacity";

const now = 1_700_000_000_000;

const p = (
  status: CountableParticipant["status"],
  expiresAt: number | null = null,
): CountableParticipant => ({ status, expiresAt });

describe("computeSpotsTaken", () => {
  it("counts paid", () => {
    expect(computeSpotsTaken([p("paid"), p("paid")], now)).toBe(2);
  });

  it("counts pending that hasn't expired", () => {
    expect(computeSpotsTaken([p("pending", now + 10_000)], now)).toBe(1);
  });

  it("ignores expired pending", () => {
    expect(computeSpotsTaken([p("pending", now - 10_000)], now)).toBe(0);
  });

  it("ignores cancelled and waitlisted", () => {
    expect(computeSpotsTaken([p("cancelled"), p("waitlisted"), p("refunded")], now)).toBe(0);
  });

  it("mixed example", () => {
    expect(
      computeSpotsTaken(
        [
          p("paid"),
          p("pending", now + 1000),
          p("pending", now - 1000),
          p("waitlisted"),
          p("cancelled"),
        ],
        now,
      ),
    ).toBe(2);
  });
});
