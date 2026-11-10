import type { Trip, TrafficLevel } from "./traffic/types";

const MINUTE = 60_000;

export type PlanStatus =
  /** Still waiting on the data needed to say anything. */
  | { kind: "pending" }
  /** There is time: leave by `leaveBy`. */
  | {
      kind: "countdown";
      leaveBy: Date;
      minutesLeft: number;
      urgency: "relaxed" | "soon" | "go";
      trip: Trip;
    }
  /** Leaving this instant still misses the target arrival. */
  | {
      kind: "late";
      trip: Trip;
      arriveAt: Date;
      /** Minutes past the court start; zero or negative means still in time to play. */
      minutesAfterCourt: number;
    };

export type PlanInput = {
  now: Date;
  courtAt: Date;
  bufferMin: number;
  /** Trip that arrives at the target time, or null when no such departure is left. */
  planTrip: Trip | null | undefined;
  /** Trip leaving right now. */
  nowTrip: Trip | undefined;
};

export function targetArrival(courtAt: Date, bufferMin: number): Date {
  return new Date(courtAt.getTime() - bufferMin * MINUTE);
}

export function planStatus({ now, courtAt, bufferMin, planTrip, nowTrip }: PlanInput): PlanStatus {
  const target = targetArrival(courtAt, bufferMin);

  if (nowTrip) {
    // Project the measured drive from the current moment; the trip may be a minute or two old.
    const arriveAt = new Date(now.getTime() + nowTrip.durationSec * 1000);
    if (arriveAt.getTime() > target.getTime() + MINUTE) {
      return {
        kind: "late",
        trip: nowTrip,
        arriveAt,
        minutesAfterCourt: Math.ceil((arriveAt.getTime() - courtAt.getTime()) / MINUTE),
      };
    }
  }

  if (planTrip) {
    const leaveBy = new Date(planTrip.departAt);
    const minutesLeft = Math.max(0, Math.floor((leaveBy.getTime() - now.getTime()) / MINUTE));
    return {
      kind: "countdown",
      leaveBy,
      minutesLeft,
      urgency: minutesLeft <= 2 ? "go" : minutesLeft <= 15 ? "soon" : "relaxed",
      trip: planTrip,
    };
  }

  // No departure makes the target any more, yet leaving now still does: the margin is all but gone.
  if (planTrip === null && nowTrip) {
    return { kind: "countdown", leaveBy: now, minutesLeft: 0, urgency: "go", trip: nowTrip };
  }

  return { kind: "pending" };
}

export type DepartureAdvice =
  | { kind: "go"; quietest: Trip }
  | { kind: "wait"; slot: Trip; savingSec: number };

/**
 * With no court time set: is it worth holding off? Waiting is only suggested
 * for a saving of at least three minutes and 8% of the drive.
 */
export function departureAdvice(nowTrip: Trip, slots: Trip[]): DepartureAdvice {
  let best = nowTrip;
  for (const slot of slots) {
    if (slot.durationSec < best.durationSec) best = slot;
  }
  const savingSec = nowTrip.durationSec - best.durationSec;
  if (best !== nowTrip && savingSec >= 180 && savingSec >= nowTrip.durationSec * 0.08) {
    return { kind: "wait", slot: best, savingSec };
  }
  return { kind: "go", quietest: best };
}

/** Index of the shortest drive; the earliest wins a tie. -1 for an empty list. */
export function quickestIndex(slots: Trip[]): number {
  let best = -1;
  slots.forEach((slot, index) => {
    const current = slots[best];
    if (!current || slot.durationSec < current.durationSec) best = index;
  });
  return best;
}

const LEVEL_LABELS: Record<TrafficLevel, string> = {
  clear: "Roads are clear",
  moderate: "Some traffic",
  heavy: "Heavy traffic",
  severe: "Severe delays",
};

export function levelLabel(level: TrafficLevel): string {
  return LEVEL_LABELS[level];
}
