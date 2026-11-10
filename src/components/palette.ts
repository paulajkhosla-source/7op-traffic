import type { TrafficLevel } from "@/lib/traffic/types";

/** Hex values for places CSS variables cannot reach (map layers). Keep in step with globals.css. */
export const LEVEL_HEX: Record<TrafficLevel, string> = {
  clear: "#3ee6a8",
  moderate: "#ffc94a",
  heavy: "#ff8b3d",
  severe: "#ff4f6d",
};

const LEVEL_VAR: Record<TrafficLevel, string> = {
  clear: "var(--color-clear)",
  moderate: "var(--color-moderate)",
  heavy: "var(--color-heavy)",
  severe: "var(--color-severe)",
};

export function levelColor(level: TrafficLevel): string {
  return LEVEL_VAR[level];
}
