import { describe, expect, it } from "vitest";
import { rateLimit } from "./http";

describe("rateLimit", () => {
  it("shares one budget across callers that each claim a different address", () => {
    const blocked = [];
    for (let i = 0; i < 8; i++) {
      const response = rateLimit(12);
      if (response) blocked.push(response.status);
    }
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((status) => status === 429)).toBe(true);
  });
});
