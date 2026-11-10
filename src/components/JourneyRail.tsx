import { Fragment } from "react";
import { BallIcon } from "./icons";

export type RailStop = { time: string; label: string; kind: "start" | "arrive" | "court" };
export type RailLeg = { label: string; waiting?: boolean };

function StopDot({ kind }: { kind: RailStop["kind"] }) {
  if (kind === "court") return <BallIcon size={20} />;
  if (kind === "arrive") {
    return (
      <span
        className="block size-5 rounded-full border-[5px]"
        style={{ borderColor: "color-mix(in oklab, var(--lv) 35%, transparent)", background: "var(--lv)", backgroundClip: "padding-box" }}
      />
    );
  }
  return <span className="block size-5 rounded-full border-[3px] border-ink bg-bg" />;
}

/** Leave, arrive and court time laid out along a line, with what happens in between. */
export function JourneyRail({ stops, legs }: { stops: RailStop[]; legs: RailLeg[] }) {
  return (
    <ol className="flex items-start" aria-label="Journey timeline">
      {stops.map((stop, index) => {
        const leg = legs[index];
        const align = index === 0 ? "items-start" : index === stops.length - 1 ? "items-end" : "items-center";
        return (
          <Fragment key={stop.label}>
            <li className={`flex shrink-0 flex-col ${align}`}>
              <StopDot kind={stop.kind} />
              <span className="tnum mt-2 text-[15px] font-semibold leading-none">{stop.time}</span>
              <span className="mt-1.5 text-[11px] leading-none text-muted">{stop.label}</span>
            </li>
            {leg && (
              <li
                className="mx-1.5 flex min-w-8 flex-col items-center"
                style={{ flexGrow: leg.waiting ? 1 : 1.7, flexBasis: 0 }}
                aria-label={leg.label}
              >
                <span
                  className="mt-[9px] block h-0.5 w-full rounded-full"
                  style={
                    leg.waiting
                      ? { backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.4) 50%, transparent 0)", backgroundSize: "8px 2px" }
                      : { background: "linear-gradient(90deg, rgba(255,255,255,0.75), var(--lv))" }
                  }
                />
                <span className="tnum mt-[9px] whitespace-nowrap text-[11px] leading-none text-muted">{leg.label}</span>
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
