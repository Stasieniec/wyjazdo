import { describe, expect, it } from "vitest";
import {
  stepTitleSchema,
  stepDatesSchema,
  stepCapacitySchema,
  stepPaymentSchema,
} from "./event-wizard";

describe("stepTitleSchema", () => {
  it("requires a title", () => {
    const r = stepTitleSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
  });
  it("accepts a slug-like string", () => {
    const r = stepTitleSchema.safeParse({ title: "Spotkanie", slug: "spotkanie" });
    expect(r.success).toBe(true);
  });
  it("rejects an invalid slug pattern", () => {
    const r = stepTitleSchema.safeParse({ title: "Spotkanie", slug: "Bad Slug" });
    expect(r.success).toBe(false);
  });
});

describe("stepDatesSchema", () => {
  it("requires endsAt > startsAt", () => {
    const r = stepDatesSchema.safeParse({ startsAt: 200, endsAt: 100 });
    expect(r.success).toBe(false);
  });
  it("accepts a valid range", () => {
    const r = stepDatesSchema.safeParse({ startsAt: 100, endsAt: 200 });
    expect(r.success).toBe(true);
  });
});

describe("stepCapacitySchema", () => {
  it("requires capacity >= 1", () => {
    expect(stepCapacitySchema.safeParse({ capacity: 0 }).success).toBe(false);
    expect(stepCapacitySchema.safeParse({ capacity: 1 }).success).toBe(true);
  });
});

describe("stepPaymentSchema", () => {
  it("accepts no deposit (depositOn === false)", () => {
    const r = stepPaymentSchema.safeParse({ depositOn: false });
    expect(r.success).toBe(true);
  });
  it("requires deposit + balanceDueAt when depositOn", () => {
    const r = stepPaymentSchema.safeParse({ depositOn: true });
    expect(r.success).toBe(false);
  });
  it("accepts depositOn with valid deposit + balance", () => {
    const r = stepPaymentSchema.safeParse({
      depositOn: true,
      depositCents: 5000,
      balanceDueAt: 1_700_000_000_000,
    });
    expect(r.success).toBe(true);
  });
});
