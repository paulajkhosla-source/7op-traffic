import type { Trip } from "@/lib/traffic/types";

const SIZE = 104;
const RADIUS = 42;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SWEEP = 0.75;
/** A drive 80% slower than on empty roads fills the dial. */
const FULL_SCALE_SLOWDOWN = 0.8;

/** Arc gauge of how much traffic is slowing the drive. Colour comes from the surrounding `--lv`. */
export function Dial({ trip }: { trip: Trip }) {
  const slowdown = trip.freeFlowSec > 0 ? trip.durationSec / trip.freeFlowSec - 1 : 0;
  const fraction = Math.min(1, Math.max(0.035, slowdown / FULL_SCALE_SLOWDOWN));
  const delayMin = Math.round(trip.delaySec / 60);
  const track = CIRCUMFERENCE * SWEEP;

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={delayMin > 0 ? `${delayMin} minutes of traffic delay` : "No traffic delay"}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-[225deg]" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${track} ${CIRCUMFERENCE}`}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--lv)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${track * fraction} ${CIRCUMFERENCE}`}
          style={{
            filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--lv) 70%, transparent))",
            transition: "stroke-dasharray 900ms cubic-bezier(0.2, 0.8, 0.2, 1), stroke 600ms ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="tnum text-[26px] font-semibold leading-none tracking-tight">
          {delayMin > 0 ? `+${delayMin}` : "0"}
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">min delay</span>
      </div>
    </div>
  );
}
