import { describe, expect, it } from "vitest";
import {
  ceilToStep,
  clubDay,
  clubDaysBetween,
  clubParts,
  clubTimeToInstant,
  formatClock,
  formatDayLabel,
  formatDuration,
  formatMiles,
  minutesUntil,
  toRfc3339,
} from "./time";

describe("club time", () => {
  it("reads winter wall time as GMT", () => {
    const parts = clubParts(new Date("2026-11-10T18:24:00Z"));
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 10, hour: 18, minute: 24, weekday: 2 });
  });

  it("reads summer wall time as BST", () => {
    const parts = clubParts(new Date("2026-07-01T18:24:00Z"));
    expect(parts).toMatchObject({ hour: 19, minute: 24, weekday: 3 });
  });

  it("converts wall time to an instant either side of the clock change", () => {
    expect(clubTimeToInstant(2026, 11, 10, 19, 0).toISOString()).toBe("2026-11-10T19:00:00.000Z");
    expect(clubTimeToInstant(2026, 7, 1, 19, 0).toISOString()).toBe("2026-07-01T18:00:00.000Z");
    // Clocks go forward at 01:00 on 29 March 2026 and back at 02:00 on 25 October 2026.
    expect(clubTimeToInstant(2026, 3, 29, 7, 0).toISOString()).toBe("2026-03-29T06:00:00.000Z");
    expect(clubTimeToInstant(2026, 10, 25, 7, 0).toISOString()).toBe("2026-10-25T07:00:00.000Z");
  });

  it("round-trips through clubParts", () => {
    const instant = clubTimeToInstant(2026, 8, 15, 21, 30);
    expect(clubParts(instant)).toMatchObject({ year: 2026, month: 8, day: 15, hour: 21, minute: 30 });
  });

  it("uses the club's calendar date, not UTC's", () => {
    // 23:30 UTC on 30 June is already 1 July in BST.
    const lateEvening = new Date("2026-06-30T23:30:00Z");
    expect(clubDay(lateEvening, 0)).toEqual({ year: 2026, month: 7, day: 1 });
    expect(clubDay(lateEvening, 1)).toEqual({ year: 2026, month: 7, day: 2 });
    expect(clubDay(new Date("2026-12-31T12:00:00Z"), 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it("counts calendar days between instants", () => {
    const now = new Date("2026-11-10T23:50:00Z");
    expect(clubDaysBetween(now, new Date("2026-11-11T00:10:00Z"))).toBe(1);
    expect(clubDaysBetween(now, new Date("2026-11-10T07:00:00Z"))).toBe(0);
    expect(formatDayLabel(new Date("2026-11-11T07:00:00Z"), now)).toBe("Tomorrow");
    expect(formatDayLabel(new Date("2026-11-10T07:00:00Z"), now)).toBe("Today");
    expect(formatDayLabel(new Date("2026-11-13T07:00:00Z"), now)).toBe("Fri");
  });
});

describe("formatting", () => {
  it("formats the club clock in 24-hour time", () => {
    expect(formatClock("2026-07-01T18:05:00Z")).toBe("19:05");
    expect(formatClock(new Date("2026-11-10T00:07:00Z"))).toBe("00:07");
  });

  it("formats durations", () => {
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(24 * 60 + 29)).toBe("24 min");
    expect(formatDuration(60 * 60)).toBe("1 h");
    expect(formatDuration(65 * 60)).toBe("1 h 05 min");
  });

  it("formats miles", () => {
    expect(formatMiles(1609.344 * 5.25)).toBe("5.3 mi");
    expect(formatMiles(1609.344 * 23.4)).toBe("23 mi");
  });

  it("writes RFC 3339 with a numeric offset and whole seconds", () => {
    expect(toRfc3339(new Date("2026-11-10T18:15:00.123Z"))).toBe("2026-11-10T18:15:00+00:00");
  });
});

describe("stepping", () => {
  it("rounds up to the next step and leaves exact steps alone", () => {
    expect(ceilToStep(new Date("2026-11-10T17:01:00Z"), 15).toISOString()).toBe("2026-11-10T17:15:00.000Z");
    expect(ceilToStep(new Date("2026-11-10T17:15:00Z"), 15).toISOString()).toBe("2026-11-10T17:15:00.000Z");
  });

  it("counts whole minutes remaining", () => {
    const from = new Date("2026-11-10T17:00:00Z");
    expect(minutesUntil(new Date("2026-11-10T17:12:59Z"), from)).toBe(12);
    expect(minutesUntil(new Date("2026-11-10T16:59:30Z"), from)).toBe(-1);
  });
});
