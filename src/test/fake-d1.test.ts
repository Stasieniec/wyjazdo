import { describe, it, expect } from "vitest";
import { makeTestDb } from "./fake-d1";

describe("fake D1 harness", () => {
  it("applies all migrations", () => {
    const { d1 } = makeTestDb();
    const cols = d1.sqlite
      .prepare("PRAGMA table_info(payments)")
      .all()
      .map((r: unknown) => (r as { name: string }).name);
    expect(cols).toContain("refunded_amount_cents");
  });
});
