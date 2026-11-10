"use client";

import type { CSSProperties, ReactNode } from "react";
import { levelLabel, planStatus } from "@/lib/advice";
import type { Polled } from "@/lib/client/usePolled";
import { formatClock, formatDuration, formatMiles } from "@/lib/time";
import type { DataSource, NowResponse, PlanResponse, Trip } from "@/lib/traffic/types";
import { Dial } from "./Dial";
import { AlertIcon, OfflineIcon, RefreshIcon } from "./icons";
import { JourneyRail, type RailLeg, type RailStop } from "./JourneyRail";
import { levelColor } from "./palette";

type HeroProps = {
  now: Date;
  nowQ: Polled<NowResponse>;
  planQ: Polled<PlanResponse>;
  courtAt: Date | null;
  bufferMin: number;
  online: boolean;
  onRefresh: () => void;
};

type View = {
  eyebrow: string;
  time: string;
  note: ReactNode;
  trip: Trip;
  source: DataSource;
  stops: RailStop[];
  legs: RailLeg[];
};

function buildView({ now, nowQ, planQ, courtAt, bufferMin }: HeroProps): View | null {
  const nowTrip = nowQ.data?.trip;
  const nowSource = nowQ.data?.source;

  if (!courtAt) {
    if (!nowTrip || !nowSource) return null;
    const arriveAt = new Date(now.getTime() + nowTrip.durationSec * 1000);
    return {
      eyebrow: "Leave now · arrive",
      time: formatClock(arriveAt),
      note: <span className="text-muted">{formatDuration(nowTrip.durationSec)} door to club</span>,
      trip: nowTrip,
      source: nowSource,
      stops: [
        { time: formatClock(now), label: "Now", kind: "start" },
        { time: formatClock(arriveAt), label: "At the club", kind: "court" },
      ],
      legs: [{ label: `${formatDuration(nowTrip.durationSec)} drive` }],
    };
  }

  // No plan request means the target arrival is too close to bother planning: treat it as settled
  // with no departure left. A request still in flight, or one that failed, is not settled.
  const planTrip = planQ.data !== undefined ? planQ.data.trip : planQ.loading || planQ.error ? undefined : null;
  const status = planStatus({ now, courtAt, bufferMin, planTrip, nowTrip });
  const courtClock = formatClock(courtAt);

  if (status.kind === "late" && nowSource) {
    const late = status.minutesAfterCourt;
    const note =
      late > 0 ? (
        <span className="font-medium text-severe">
          {late} min after your {courtClock} court starts
        </span>
      ) : late === 0 ? (
        <span className="font-medium text-moderate">Right as your {courtClock} court starts</span>
      ) : (
        <span className="font-medium text-moderate">
          Only {-late} min before your {courtClock} court
        </span>
      );
    const stops: RailStop[] = [
      { time: formatClock(now), label: "Now", kind: "start" },
      { time: formatClock(status.arriveAt), label: "Arrive", kind: late < 0 ? "arrive" : "court" },
    ];
    const legs: RailLeg[] = [{ label: `${formatDuration(status.trip.durationSec)} drive` }];
    if (late < 0) {
      stops.push({ time: courtClock, label: "Court", kind: "court" });
      legs.push({ label: `${-late} min`, waiting: true });
    }
    return { eyebrow: "Leave now · arrive", time: formatClock(status.arriveAt), note, trip: status.trip, source: nowSource, stops, legs };
  }

  if (status.kind === "countdown") {
    const usesPlan = status.trip === planQ.data?.trip;
    const source = usesPlan ? planQ.data?.source : nowSource;
    if (!source) return null;
    const arriveAt = new Date(status.leaveBy.getTime() + status.trip.durationSec * 1000);
    const note =
      status.urgency === "go" ? (
        <span className="font-semibold text-ball">Time to go</span>
      ) : status.urgency === "soon" ? (
        <span className="font-medium text-ink">in {status.minutesLeft} min · get ready</span>
      ) : (
        <span className="text-muted">in {formatDuration(status.minutesLeft * 60)}</span>
      );
    const stops: RailStop[] = [{ time: formatClock(status.leaveBy), label: "Leave", kind: "start" }];
    const legs: RailLeg[] = [{ label: `${formatDuration(status.trip.durationSec)} drive` }];
    const spareMin = Math.round((courtAt.getTime() - arriveAt.getTime()) / 60_000);
    if (spareMin >= 2) {
      stops.push({ time: formatClock(arriveAt), label: "Arrive", kind: "arrive" });
      legs.push({ label: `${spareMin} min`, waiting: true });
    }
    stops.push({ time: courtClock, label: "Court", kind: "court" });
    return {
      eyebrow: status.urgency === "go" ? "Leave now" : "Leave by",
      time: formatClock(status.leaveBy),
      note,
      trip: status.trip,
      source,
      stops,
      legs,
    };
  }

  // The leave-by time is still being worked out. Show the drive from now rather than an empty card.
  if (nowTrip && nowSource) {
    const arriveAt = new Date(now.getTime() + nowTrip.durationSec * 1000);
    return {
      eyebrow: "Leave now · arrive",
      time: formatClock(arriveAt),
      note: (
        <span className="text-muted">{planQ.error ? "Couldn't check the best time to leave." : "Checking the best time to leave…"}</span>
      ),
      trip: nowTrip,
      source: nowSource,
      stops: [
        { time: formatClock(now), label: "Now", kind: "start" },
        { time: courtClock, label: "Court", kind: "court" },
      ],
      legs: [{ label: `${formatDuration(nowTrip.durationSec)} drive` }],
    };
  }

  return null;
}

function StatusPill({ nowQ, online, source }: { nowQ: Polled<NowResponse>; online: boolean; source: DataSource | undefined }) {
  if (!online) {
    return (
      <span className="chip text-moderate">
        <OfflineIcon size={13} /> Offline
      </span>
    );
  }
  if (nowQ.fromCache) return <span className="chip text-muted">Saved reading</span>;
  if (source === "live") {
    return (
      <span className="chip text-clear">
        <span className="live-dot" /> Live traffic
      </span>
    );
  }
  return <span className="chip text-muted">Checking traffic…</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
      <dt className="text-[11px] leading-none text-muted">{label}</dt>
      <dd className="tnum mt-1.5 truncate text-[15px] font-semibold leading-none">{value}</dd>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-4 h-[4.2rem] w-48 rounded-2xl" />
          <div className="skeleton mt-4 h-4 w-32" />
        </div>
        <div className="skeleton size-[104px] rounded-full" />
      </div>
      <div className="skeleton mt-7 h-12 w-full rounded-2xl" />
      <div className="skeleton mt-5 h-10 w-full rounded-2xl" />
    </div>
  );
}

export function Hero(props: HeroProps) {
  const { nowQ, online, onRefresh } = props;
  const view = buildView(props);
  const failed = !view && nowQ.error;
  const tint = view ? levelColor(view.trip.level) : "var(--color-ball)";
  const delayMin = view ? Math.round(view.trip.delaySec / 60) : 0;

  return (
    <section className="card hero rise p-5 pb-6" style={{ "--lv": tint } as CSSProperties} aria-live="polite" aria-busy={nowQ.loading}>
      <div className="flex items-center justify-between gap-2">
        <StatusPill nowQ={nowQ} online={online} source={view?.source ?? nowQ.data?.source} />
        <div className="flex items-center gap-1">
          {nowQ.fetchedAt !== undefined && (
            <span className="tnum text-xs text-muted">Updated {formatClock(new Date(nowQ.fetchedAt))}</span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Refresh traffic"
          >
            <RefreshIcon size={17} className={nowQ.refreshing ? "spin" : undefined} />
          </button>
        </div>
      </div>

      <div className="mt-5">
        {view ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{view.eyebrow}</p>
                <p className="hero-time tnum mt-2.5">{view.time}</p>
                <p className="mt-3 text-[15px] leading-snug">{view.note}</p>
              </div>
              <Dial trip={view.trip} />
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full" style={{ background: "var(--lv)", boxShadow: "0 0 10px var(--lv)" }} />
              <span className="font-medium">{levelLabel(view.trip.level)}</span>
              {delayMin > 0 && <span className="tnum text-muted">· +{delayMin} min vs empty roads</span>}
            </p>

            <div className="mt-6">
              <JourneyRail stops={view.stops} legs={view.legs} />
            </div>

            <dl className="mt-6 flex divide-x divide-white/10 border-t border-white/10 pt-5">
              <Stat label="Drive" value={formatDuration(view.trip.durationSec)} />
              <Stat label="Empty roads" value={formatDuration(view.trip.freeFlowSec)} />
              <Stat label="Distance" value={formatMiles(view.trip.distanceM)} />
            </dl>
          </>
        ) : failed ? (
          <div className="py-4">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <AlertIcon size={20} className="text-moderate" /> Couldn&apos;t load your drive
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{nowQ.error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-5 rounded-full bg-ball px-5 py-2.5 text-sm font-semibold text-bg transition-transform active:scale-95"
            >
              Try again
            </button>
          </div>
        ) : (
          <HeroSkeleton />
        )}
      </div>

      {view && nowQ.error && (
        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-white/5 px-3.5 py-3 text-xs leading-relaxed text-muted">
          <AlertIcon size={15} className="mt-px shrink-0 text-moderate" />
          <span>Couldn&apos;t refresh just now, so this may be out of date. {nowQ.error}</span>
        </p>
      )}
    </section>
  );
}
