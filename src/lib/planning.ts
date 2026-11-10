import { CLUB } from "./club";
import { ceilToStep, clubDay, clubTimeToInstant } from "./time";
import { FORECAST_STEP_MIN, MAX_FORECAST_SLOTS } from "./traffic/constants";

const MINUTE = 60_000;
const STEP_MS = FORECAST_STEP_MIN * MINUTE;
/** A court stays "booked" this long after it starts, so a late arrival still sees their plan. */
const COURT_GRACE_MIN = 20;
/** How far ahead of the target arrival the departure chart reaches back. */
const PLAN_LOOKBACK_MIN = 180;

/** The saved court time, unless it is unset or already over. */
export function activeCourt(courtAtIso: string | null, now: Date): Date | null {
  if (!courtAtIso) return null;
  const courtAt = new Date(courtAtIso);
  if (Number.isNaN(courtAt.getTime())) return null;
  return now.getTime() > courtAt.getTime() + COURT_GRACE_MIN * MINUTE ? null : courtAt;
}

export type ForecastWindow = { start: Date; count: number };

/**
 * Departure slots worth charting. With no target: the next three hours. With
 * one: the slots before it, reaching back at most three hours. Null when no
 * slot is left before the target.
 */
export function forecastWindow(now: Date, target: Date | null): ForecastWindow | null {
  const next = new Date((Math.floor(now.getTime() / STEP_MS) + 1) * STEP_MS);
  if (!target) return { start: next, count: MAX_FORECAST_SLOTS };
  const earliest = ceilToStep(new Date(target.getTime() - PLAN_LOOKBACK_MIN * MINUTE), FORECAST_STEP_MIN);
  const start = earliest.getTime() > next.getTime() ? earliest : next;
  const count = Math.min(MAX_FORECAST_SLOTS, Math.ceil((target.getTime() - start.getTime()) / STEP_MS));
  return count >= 1 ? { start, count } : null;
}

/**
 * Half-hourly court start times on the club's calendar day `dayOffset` days
 * from now, leaving out any that have already begun.
 */
export function courtSlots(now: Date, dayOffset: number): Date[] {
  const { year, month, day } = clubDay(now, dayOffset);
  const slots: Date[] = [];
  for (let hour: number = CLUB.firstCourtHour; hour <= CLUB.lastCourtHour; hour++) {
    for (const minute of [0, 30]) {
      if (hour === CLUB.lastCourtHour && minute > 0) continue;
      const slot = clubTimeToInstant(year, month, day, hour, minute);
      if (slot.getTime() > now.getTime()) slots.push(slot);
    }
  }
  return slots;
}
