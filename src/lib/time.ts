import { CLUB } from "./club";

const MINUTE = 60_000;

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLUB.timeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ClubDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  weekday: number;
};

/** Wall-clock fields of an instant, as seen at the club. */
export function clubParts(date: Date): ClubDateParts {
  const map: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS.indexOf(map.weekday ?? ""),
  };
}

function offsetMs(date: Date): number {
  const p = clubParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the club's clocks read the given wall time. */
export function clubTimeToInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wall - offsetMs(new Date(wall));
  // Second pass settles times that land the other side of a clock change.
  return new Date(wall - offsetMs(new Date(firstGuess)));
}

/** Calendar date at the club, `dayOffset` days after the date of `from`. */
export function clubDay(from: Date, dayOffset: number): { year: number; month: number; day: number } {
  const p = clubParts(from);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** Whole days between the club's calendar dates of two instants. */
export function clubDaysBetween(from: Date, to: Date): number {
  const a = clubParts(from);
  const b = clubParts(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLUB.timeZone,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

/** 24-hour club time, e.g. "18:24". */
export function formatClock(date: Date | string): string {
  return clockFormat.format(typeof date === "string" ? new Date(date) : date);
}

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: CLUB.timeZone, weekday: "short" });

export function formatDayLabel(date: Date, now: Date): string {
  const days = clubDaysBetween(now, date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return weekdayFormat.format(date);
}

/** "24 min", "1 h 05 min". Rounds to the nearest minute, never below 1. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")} min`;
}

export function formatMiles(metres: number): string {
  const miles = metres / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

/** Next instant on a `stepMin` boundary at or after `date`. */
export function ceilToStep(date: Date, stepMin: number): Date {
  const step = stepMin * MINUTE;
  return new Date(Math.ceil(date.getTime() / step) * step);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

/** Whole minutes from `from` to `to`, rounded down; negative once `to` has passed. */
export function minutesUntil(to: Date, from: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MINUTE);
}

/** RFC 3339 in UTC with a numeric offset and no fractional seconds. */
export function toRfc3339(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}
