import { describe, expect, it } from "vitest";
import { classifyTraffic } from "./level";

describe("classifyTraffic", () => {
  it("grades by slowdown against empty roads", () => {
    expect(classifyTraffic(1200, 1200)).toBe("clear");
    expect(classifyTraffic(1300, 1200)).toBe("clear");
    expect(classifyTraffic(1500, 1200)).toBe("moderate");
    expect(classifyTraffic(1800, 1200)).toBe("heavy");
    expect(classifyTraffic(2400, 1200)).toBe("severe");
  });

  it("calls a short delay clear even when the ratio is high", () => {
    expect(classifyTraffic(260, 180)).toBe("clear");
  });

  it("copes with a missing free-flow time", () => {
    expect(classifyTraffic(600, 0)).toBe("clear");
  });
});
