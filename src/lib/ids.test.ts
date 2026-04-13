import { describe, it, expect } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("returns a 26-char ULID", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("returns sortable IDs across time", async () => {
    const a = newId();
    await new Promise((r) => setTimeout(r, 2));
    const b = newId();
    expect(a < b).toBe(true);
  });
});
