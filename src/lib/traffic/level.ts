import type { TrafficLevel } from "./types";

/**
 * Grades a journey by how much slower it is than on empty roads. Delays under
 * 90 seconds count as clear whatever the ratio, so a short hop is not called
 * heavy over one red light.
 */
export function classifyTraffic(durationSec: number, freeFlowSec: number): TrafficLevel {
  const delay = durationSec - freeFlowSec;
  const ratio = freeFlowSec > 0 ? durationSec / freeFlowSec : 1;
  if (delay < 90 || ratio < 1.1) return "clear";
  if (ratio < 1.3) return "moderate";
  if (ratio < 1.6) return "heavy";
  return "severe";
}

export const LEVEL_ORDER: Record<TrafficLevel, number> = { clear: 0, moderate: 1, heavy: 2, severe: 3 };
