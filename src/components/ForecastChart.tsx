"use client";

import { useState } from "react";
import { departureAdvice, quickestIndex } from "@/lib/advice";
import type { Polled } from "@/lib/client/usePolled";
import { clubParts, formatClock, formatDuration } from "@/lib/time";
import type { ForecastResponse, NowResponse, Trip, UnavailableResponse } from "@/lib/traffic/types";
import { ArrowRightIcon } from "./icons";
import { levelColor } from "./palette";

const MINUTE = 60_000;

type ForecastChartProps = {
  now: Date;
  nowQ: Polled<NowResponse | UnavailableResponse>;
  forecastQ: Polled<ForecastResponse | UnavailableResponse>;
  courtAt: Date | null;
  /** Arrival to aim for: the court time less the early-arrival buffer. */
  target: Date | null;
};

type Bar = {
  key: string;
  trip: Trip;
  isNow: boolean;
  departAt: Date;
  arriveAt: Date;
  /** Null when there is no target to be on time for. */
  onTime: boolean | null;
};

function buildBars(now: Date, nowTrip: Trip | undefined, slots: Trip[], target: Date | null): Bar[] {
  const toBar = (trip: Trip, isNow: boolean): Bar => {
    const departAt = isNow ? now : new Date(trip.departAt);
    const arriveAt = new Date(departAt.getTime() + trip.durationSec * 1000);
    return {
      key: isNow ? "now" : trip.departAt,
      trip,
      isNow,
      departAt,
      arriveAt,
      onTime: target ? arriveAt.getTime() <= target.getTime() + MINUTE : null,
    };
  };
  const upcoming = slots.filter((slot) => new Date(slot.departAt).getTime() > now.getTime() + 4 * MINUTE);
  const first = upcoming[0];
  const startsNow = first !== undefined && new Date(first.departAt).getTime() - now.getTime() <= 16 * MINUTE;
  return [...(nowTrip && startsNow ? [toBar(nowTrip, true)] : []), ...upcoming.map((slot) => toBar(slot, false))];
}

function insight(bars: Bar[], target: Date | null): string {
  if (target) {
    return bars.some((bar) => bar.onTime)
      ? `Striped departures get you there after ${formatClock(target)}, your target arrival.`
      : `Every departure from now gets you there after ${formatClock(target)}.`;
  }
  const nowBar = bars.find((bar) => bar.isNow);
  const later = bars.filter((bar) => !bar.isNow).map((bar) => bar.trip);
  if (!nowBar) {
    const best = bars[quickestIndex(bars.map((bar) => bar.trip))];
    return best ? `Quickest departure: ${formatClock(best.departAt)}, ${formatDuration(best.trip.durationSec)}.` : "";
  }
  const advice = departureAdvice(nowBar.trip, later);
  if (advice.kind === "wait") {
    const saving = Math.round(advice.savingSec / 60);
    const when = formatClock(advice.slot.departAt);
    return `Traffic should ease by ${when}: about ${saving} min quicker than leaving now.`;
  }
  return "Leaving now is about as quick as it gets for the next three hours.";
}

function defaultBar(bars: Bar[], target: Date | null): Bar | undefined {
  if (target) return bars.findLast((bar) => bar.onTime) ?? bars[0];
  const nowBar = bars.find((bar) => bar.isNow);
  if (!nowBar) return bars[quickestIndex(bars.map((bar) => bar.trip))];
  const advice = departureAdvice(
    nowBar.trip,
    bars.filter((bar) => !bar.isNow).map((bar) => bar.trip),
  );
  return advice.kind === "wait" ? bars.find((bar) => bar.trip === advice.slot) : nowBar;
}

function axisLabel(bar: Bar, previous: Bar | undefined, sparse: boolean): string {
  if (bar.isNow) return "Now";
  if (sparse) return formatClock(bar.departAt);
  if (previous?.isNow) return "";
  return clubParts(bar.departAt).minute === 0 ? formatClock(bar.departAt) : "";
}

function Detail({ bar, courtAt }: { bar: Bar; courtAt: Date | null }) {
  const delayMin = Math.round(bar.trip.delaySec / 60);
  const spareMin = courtAt ? Math.floor((courtAt.getTime() - bar.arriveAt.getTime()) / MINUTE) : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] leading-none text-muted">{bar.isNow ? "Leave now" : "Leave"}</p>
            <p className="tnum mt-1.5 text-2xl font-semibold leading-none tracking-tight">{formatClock(bar.departAt)}</p>
          </div>
          <ArrowRightIcon size={18} className="mt-4 text-faint" />
          <div>
            <p className="text-[11px] leading-none text-muted">Arrive</p>
            <p className="tnum mt-1.5 text-2xl font-semibold leading-none tracking-tight">{formatClock(bar.arriveAt)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] leading-none text-muted">Drive</p>
          <p className="tnum mt-1.5 text-2xl font-semibold leading-none tracking-tight">{formatDuration(bar.trip.durationSec)}</p>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <span className="chip tnum" style={{ color: levelColor(bar.trip.level) }}>
          {delayMin > 0 ? `+${delayMin} min delay` : "No delay"}
        </span>
        {spareMin !== null && courtAt && (
          <span className={`chip tnum ${spareMin < 0 ? "text-severe" : bar.onTime ? "text-ink" : "text-moderate"}`}>
            {spareMin < 0
              ? `${-spareMin} min late for ${formatClock(courtAt)}`
              : `${spareMin} min before ${formatClock(courtAt)} court`}
          </span>
        )}
      </div>
    </div>
  );
}

export function ForecastChart({ now, nowQ, forecastQ, courtAt, target }: ForecastChartProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const forecast = forecastQ.data?.source === "live" ? forecastQ.data : undefined;
  const nowTrip = nowQ.data?.source === "live" && forecast?.source === "live" ? nowQ.data.trip : undefined;
  const bars = forecast ? buildBars(now, nowTrip, forecast.slots, target) : [];
  const selected = bars.find((bar) => bar.key === picked) ?? defaultBar(bars, target);
  const best = target ? undefined : bars[quickestIndex(bars.map((bar) => bar.trip))];
  const longest = Math.max(1, ...bars.map((bar) => bar.trip.durationSec));
  const sparse = bars.length <= 5;

  return (
    <section className="card rise p-5" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow">{target ? "Departure options" : "Best time to leave"}</h2>
        {forecast && (
          <span className="chip text-clear">Live + forecast</span>
        )}
      </div>

      {bars.length > 0 && selected ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">{insight(bars, target)}</p>
          <div className="mt-4">
            <Detail bar={selected} courtAt={courtAt} />
          </div>

          <div className="mt-5 flex h-36 items-end gap-1" role="group" aria-label="Drive time by departure">
            {bars.map((bar) => {
              const isSelected = bar === selected;
              const late = bar.onTime === false;
              const height = Math.max(8, (bar.trip.durationSec / longest) * 100);
              const delayShare = bar.trip.durationSec > 0 ? (bar.trip.delaySec / bar.trip.durationSec) * 100 : 0;
              return (
                <button
                  key={bar.key}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Leave ${bar.isNow ? "now" : formatClock(bar.departAt)}: ${formatDuration(bar.trip.durationSec)} drive, arrive ${formatClock(bar.arriveAt)}${late ? ", after your target" : ""}`}
                  onClick={() => setPicked(bar.key)}
                  className="group relative flex h-full min-w-0 flex-1 flex-col items-stretch justify-end rounded-lg"
                >
                  {bar === best && (
                    <span
                      className="mx-auto mb-1.5 size-1.5 shrink-0 rounded-full bg-ball shadow-[0_0_8px_var(--color-ball)]"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`flex flex-col overflow-hidden rounded-md transition-[height,opacity,box-shadow] duration-500 ${
                      late ? "opacity-45" : ""
                    } ${isSelected ? "opacity-100 shadow-[0_0_0_1.5px_var(--color-ink)]" : "group-hover:opacity-90"}`}
                    style={{ height: `${height}%` }}
                  >
                    <span
                      className="shrink-0"
                      style={{ height: `${delayShare}%`, background: levelColor(bar.trip.level) }}
                    />
                    <span className={`flex-1 ${late ? "bar-late" : isSelected ? "bg-white/30" : "bg-white/[0.13]"}`} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {bars.map((bar, index) => (
              <span
                key={bar.key}
                className={`tnum flex min-w-0 flex-1 justify-center whitespace-nowrap text-[10px] leading-none ${
                  bar === selected ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                {axisLabel(bar, bars[index - 1], sparse)}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-white/20" /> Drive on empty roads
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: levelColor("heavy") }} />
              Traffic delay
            </span>
            {best && (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-ball" /> Quickest
              </span>
            )}
          </div>
        </>
      ) : forecastQ.error ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-muted">Couldn&apos;t load departure times. {forecastQ.error}</p>
          <button type="button" onClick={forecastQ.refresh} className="mt-3 text-sm font-semibold text-ball">
            Try again
          </button>
        </div>
      ) : (
        <div aria-hidden="true">
          <div className="skeleton mt-3 h-4 w-3/4" />
          <div className="skeleton mt-4 h-24 w-full rounded-2xl" />
          <div className="mt-5 flex h-36 items-end gap-1">
            {[62, 70, 78, 88, 96, 100, 92, 84, 76, 70, 66, 62, 60].map((height, index) => (
              <div key={index} className="skeleton flex-1 rounded-md" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
