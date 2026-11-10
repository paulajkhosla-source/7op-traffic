import { describe, expect, it } from "vitest";
import { activeCourt, courtSlots, forecastWindow } from "./planning";

describe("activeCourt", () => {
  const now = new Date("2026-11-10T19:10:00Z");

  it("keeps a court that started within the grace period", () => {
    expect(activeCourt("2026-11-10T19:00:00.000Z", now)?.toISOString()).toBe("2026-11-10T19:00:00.000Z");
  });

  it("drops a court that is over, unset, or unreadable", () => {
    expect(activeCourt("2026-11-10T18:30:00.000Z", now)).toBeNull();
    expect(activeCourt(null, now)).toBeNull();
    expect(activeCourt("not a date", now)).toBeNull();
  });
});

describe("forecastWindow", () => {
  it("covers the next three hours when no arrival is set", () => {
    const window = forecastWindow(new Date("2026-11-10T17:02:00Z"), null);
    expect(window?.start.toISOString()).toBe("2026-11-10T17:15:00.000Z");
    expect(window?.count).toBe(12);
  });

  it("moves to the following step when now sits exactly on one", () => {
    expect(forecastWindow(new Date("2026-11-10T17:15:00Z"), null)?.start.toISOString()).toBe("2026-11-10T17:30:00.000Z");
  });

  it("stops before the target arrival", () => {
    const window = forecastWindow(new Date("2026-11-10T17:02:00Z"), new Date("2026-11-10T18:50:00Z"));
    expect(window?.start.toISOString()).toBe("2026-11-10T17:15:00.000Z");
    // 17:15 through 18:45.
    expect(window?.count).toBe(7);
  });

  it("excludes a slot that coincides with the target", () => {
    const window = forecastWindow(new Date("2026-11-10T17:02:00Z"), new Date("2026-11-10T18:00:00Z"));
    // 17:15, 17:30, 17:45.
    expect(window?.count).toBe(3);
  });

  it("reaches back three hours from a distant target", () => {
    const window = forecastWindow(new Date("2026-11-10T09:00:00Z"), new Date("2026-11-10T18:50:00Z"));
    expect(window?.start.toISOString()).toBe("2026-11-10T16:00:00.000Z");
    expect(window?.count).toBe(12);
  });

  it("has nothing to chart once the target is closer than the next slot", () => {
    expect(forecastWindow(new Date("2026-11-10T18:40:00Z"), new Date("2026-11-10T18:45:00Z"))).toBeNull();
    expect(forecastWindow(new Date("2026-11-10T18:40:00Z"), new Date("2026-11-10T18:30:00Z"))).toBeNull();
  });
});

describe("courtSlots", () => {
  it("lists the remaining half-hour starts today", () => {
    const slots = courtSlots(new Date("2026-11-10T20:40:00Z"), 0).map((slot) => slot.toISOString());
    expect(slots).toEqual(["2026-11-10T21:00:00.000Z", "2026-11-10T21:30:00.000Z", "2026-11-10T22:00:00.000Z"]);
  });

  it("lists the whole day tomorrow, from 07:00 to 22:00", () => {
    const slots = courtSlots(new Date("2026-11-10T20:40:00Z"), 1);
    expect(slots).toHaveLength(31);
    expect(slots[0]?.toISOString()).toBe("2026-11-11T07:00:00.000Z");
    expect(slots.at(-1)?.toISOString()).toBe("2026-11-11T22:00:00.000Z");
  });

  it("uses club wall time in summer", () => {
    const slots = courtSlots(new Date("2026-07-01T03:00:00Z"), 0);
    expect(slots[0]?.toISOString()).toBe("2026-07-01T06:00:00.000Z");
  });

  it("is empty once the last court has started", () => {
    expect(courtSlots(new Date("2026-11-10T22:05:00Z"), 0)).toEqual([]);
  });
});
