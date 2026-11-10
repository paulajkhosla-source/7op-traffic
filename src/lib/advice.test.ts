import { describe, expect, it } from "vitest";
import { departureAdvice, levelLabel, planStatus, quickestIndex, targetArrival } from "./advice";
import type { Trip } from "./traffic/types";

function trip(departIso: string, durationMin: number, freeFlowMin = durationMin): Trip {
  const depart = new Date(departIso);
  return {
    departAt: depart.toISOString(),
    arriveAt: new Date(depart.getTime() + durationMin * 60_000).toISOString(),
    durationSec: durationMin * 60,
    freeFlowSec: freeFlowMin * 60,
    delaySec: (durationMin - freeFlowMin) * 60,
    distanceM: 12_000,
    level: "clear",
  };
}

const courtAt = new Date("2026-11-10T19:00:00Z");

describe("planStatus", () => {
  it("targets the buffer before the court time", () => {
    expect(targetArrival(courtAt, 10).toISOString()).toBe("2026-11-10T18:50:00.000Z");
  });

  it("counts down to the leave-by time", () => {
    const now = new Date("2026-11-10T17:00:30Z");
    const status = planStatus({
      now,
      courtAt,
      bufferMin: 10,
      planTrip: trip("2026-11-10T18:24:00Z", 26),
      nowTrip: trip("2026-11-10T17:00:00Z", 30),
    });
    expect(status).toMatchObject({ kind: "countdown", minutesLeft: 83, urgency: "relaxed" });
  });

  it("escalates as the leave-by time nears", () => {
    const planTrip = trip("2026-11-10T18:24:00Z", 26);
    const base = { courtAt, bufferMin: 10, planTrip, nowTrip: undefined };
    expect(planStatus({ ...base, now: new Date("2026-11-10T18:10:00Z") })).toMatchObject({ urgency: "soon", minutesLeft: 14 });
    expect(planStatus({ ...base, now: new Date("2026-11-10T18:22:30Z") })).toMatchObject({ urgency: "go", minutesLeft: 1 });
    expect(planStatus({ ...base, now: new Date("2026-11-10T18:25:00Z") })).toMatchObject({ urgency: "go", minutesLeft: 0 });
  });

  it("reports being late once leaving now misses the target", () => {
    const now = new Date("2026-11-10T18:40:00Z");
    const status = planStatus({ now, courtAt, bufferMin: 10, planTrip: null, nowTrip: trip("2026-11-10T18:39:00Z", 30) });
    expect(status).toMatchObject({ kind: "late", minutesAfterCourt: 10 });
    if (status.kind === "late") expect(status.arriveAt.toISOString()).toBe("2026-11-10T19:10:00.000Z");
  });

  it("distinguishes missing the buffer from missing the court", () => {
    const now = new Date("2026-11-10T18:25:00Z");
    const status = planStatus({ now, courtAt, bufferMin: 10, planTrip: null, nowTrip: trip("2026-11-10T18:25:00Z", 30) });
    expect(status).toMatchObject({ kind: "late", minutesAfterCourt: -5 });
  });

  it("says go when no later departure works but leaving now still does", () => {
    const now = new Date("2026-11-10T18:20:00Z");
    const status = planStatus({ now, courtAt, bufferMin: 10, planTrip: null, nowTrip: trip("2026-11-10T18:20:00Z", 30) });
    expect(status).toMatchObject({ kind: "countdown", urgency: "go", minutesLeft: 0 });
  });

  it("is pending until data arrives", () => {
    const now = new Date("2026-11-10T17:00:00Z");
    expect(planStatus({ now, courtAt, bufferMin: 10, planTrip: undefined, nowTrip: undefined })).toEqual({ kind: "pending" });
    expect(planStatus({ now, courtAt, bufferMin: 10, planTrip: undefined, nowTrip: trip("2026-11-10T17:00:00Z", 30) })).toEqual({
      kind: "pending",
    });
  });
});

describe("departureAdvice", () => {
  const nowTrip = trip("2026-11-10T17:00:00Z", 40, 25);

  it("suggests waiting for a worthwhile saving", () => {
    const slots = [trip("2026-11-10T17:15:00Z", 41), trip("2026-11-10T18:30:00Z", 30), trip("2026-11-10T19:00:00Z", 27)];
    const advice = departureAdvice(nowTrip, slots);
    expect(advice).toMatchObject({ kind: "wait", savingSec: 13 * 60 });
    if (advice.kind === "wait") expect(advice.slot.departAt).toBe("2026-11-10T19:00:00.000Z");
  });

  it("says go when the saving is marginal", () => {
    expect(departureAdvice(nowTrip, [trip("2026-11-10T18:00:00Z", 38)])).toMatchObject({ kind: "go" });
  });

  it("says go when now is already the quietest", () => {
    const advice = departureAdvice(nowTrip, [trip("2026-11-10T18:00:00Z", 45)]);
    expect(advice).toEqual({ kind: "go", quietest: nowTrip });
  });
});

describe("quickestIndex", () => {
  it("finds the shortest drive, earliest first on a tie", () => {
    const slots = [trip("2026-11-10T17:00:00Z", 30), trip("2026-11-10T17:15:00Z", 24), trip("2026-11-10T17:30:00Z", 24)];
    expect(quickestIndex(slots)).toBe(1);
    expect(quickestIndex([])).toBe(-1);
  });
});

describe("levelLabel", () => {
  it("names the live traffic level", () => {
    expect(levelLabel("heavy")).toBe("Heavy traffic");
    expect(levelLabel("clear")).toBe("Roads are clear");
  });
});
