"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { targetArrival } from "@/lib/advice";
import { CLUB } from "@/lib/club";
import { originLabel, originParam, useHydrated, useSettings, type Origin, type Settings } from "@/lib/client/settings";
import { useGpsRefresh } from "@/lib/client/useGpsRefresh";
import { useNow } from "@/lib/client/useNow";
import { useOnline } from "@/lib/client/useOnline";
import { usePolled, type Polled } from "@/lib/client/usePolled";
import { activeCourt, forecastWindow } from "@/lib/planning";
import { FORECAST_STEP_MIN } from "@/lib/traffic/constants";
import type { ForecastResponse, NowResponse, PlanResponse, UnavailableReason, UnavailableResponse } from "@/lib/traffic/types";
import { ForecastChart } from "./ForecastChart";
import { Hero } from "./Hero";
import { BallIcon, ChevronDownIcon, LocateIcon, PinIcon } from "./icons";
import { Incidents } from "./Incidents";
import { InstallCard } from "./InstallCard";
import { OriginPicker } from "./OriginPicker";
import { OriginSheet } from "./OriginSheet";
import { Planner } from "./Planner";
import { RouteCard } from "./RouteCard";

const STEP_MS = FORECAST_STEP_MIN * 60_000;

function liveOnly<T extends { source: "live" }>(polled: Polled<T | UnavailableResponse>): Polled<T> {
  if (polled.data?.source === "unavailable") return { ...polled, data: undefined };
  return polled as Polled<T>;
}

function NeedsLiveKey({ reason }: { reason: UnavailableReason }) {
  const signedOut = reason === "signed_out";
  return (
    <section className="card hero rise p-6" style={{ "--lv": "var(--color-ball)" } as CSSProperties}>
      <p className="eyebrow">Live traffic</p>
      <h2 className="mt-3 text-[28px] font-semibold leading-[1.1] tracking-tight">
        {signedOut ? "Sign in to see the roads" : "Waiting on a TomTom key"}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {signedOut
          ? "Drive times, delays and the best time to leave all come from TomTom’s live traffic. That service is metered, so it only runs for a signed-in viewer of this app."
          : "Drive times, delays and the best time to leave all come from TomTom’s live traffic on the roads to the club. Nothing here is a guess. It starts once this app has a TomTom API key named TOMTOM_API_KEY. A free key from TomTom’s developer portal is enough, and Cursor asks for it with the app’s secrets. Don’t paste the key into the chat."}
      </p>
      {!signedOut && (
        <a
          href="https://developer.tomtom.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex rounded-full bg-ball px-5 py-2.5 text-sm font-semibold text-bg"
        >
          Get a free TomTom key
        </a>
      )}
    </section>
  );
}

function Header({ origin, onChangeOrigin }: { origin: Origin | null; onChangeOrigin: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <BallIcon size={38} className="shrink-0 drop-shadow-[0_0_14px_rgba(214,255,63,0.45)]" />
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight">{CLUB.shortName}</h1>
          <p className="mt-0.5 truncate text-xs text-muted">Polhill · {CLUB.postcode}</p>
        </div>
      </div>
      {origin && (
        <button
          type="button"
          onClick={onChangeOrigin}
          className="chip h-10 shrink-0 pl-3 pr-2.5 text-[13px] transition-colors hover:border-white/25"
          aria-label={`Driving from ${originLabel(origin)}. Change start point`}
        >
          {origin.kind === "gps" ? <LocateIcon size={15} className="text-ball" /> : <PinIcon size={15} className="text-ball" />}
          <span className="tnum max-w-28 truncate font-semibold">{origin.kind === "gps" ? "My location" : origin.label}</span>
          <ChevronDownIcon size={15} className="text-muted" />
        </button>
      )}
    </header>
  );
}

function Welcome({ settings }: { settings: Settings }) {
  return (
    <div className="rise">
      <div className="card hero overflow-hidden p-6" style={{ "--lv": "var(--color-ball)" } as React.CSSProperties}>
        <svg viewBox="0 0 320 120" className="-mx-1 w-[calc(100%+0.5rem)]" aria-hidden="true">
          <defs>
            <linearGradient id="welcome-flow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3ee6a8" />
              <stop offset="0.55" stopColor="#ffc94a" />
              <stop offset="1" stopColor="#ff4f6d" />
            </linearGradient>
          </defs>
          <path d="M14 96 C80 96 84 40 150 44 S232 92 286 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="22" strokeLinecap="round" />
          <path d="M14 96 C80 96 84 40 150 44 S232 92 286 40" fill="none" stroke="url(#welcome-flow)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="14" cy="96" r="7" fill="#060912" stroke="#f3f5fa" strokeWidth="3" />
          <circle cx="286" cy="40" r="15" fill="#d6ff3f" />
          <path d="M278 28c6 7 6 17 0 24M294 28c-6 7-6 17 0 24" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <h2 className="mt-5 text-[28px] font-semibold leading-[1.1] tracking-tight">When should you leave for padel?</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Tell us where you&apos;re driving from. We&apos;ll watch the road to {CLUB.name} and tell you when to set off.
        </p>
      </div>
      <div className="card mt-4 p-5">
        <OriginPicker current={null} recents={settings.recents} onChosen={() => {}} />
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="card p-5">
        <div className="skeleton h-7 w-40 rounded-full" />
        <div className="skeleton mt-6 h-[4.2rem] w-48 rounded-2xl" />
        <div className="skeleton mt-4 h-4 w-32" />
        <div className="skeleton mt-7 h-12 w-full rounded-2xl" />
        <div className="skeleton mt-5 h-10 w-full rounded-2xl" />
      </div>
      <div className="card mt-4 h-44 p-5">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-5 h-11 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function Dashboard({ origin, settings }: { origin: Origin; settings: Settings }) {
  const now = useNow(5_000);
  const online = useOnline();
  const from = originParam(origin);

  const courtAt = activeCourt(settings.courtAt, now);
  const courtMs = courtAt?.getTime() ?? null;
  const target = useMemo(
    () => (courtMs === null ? null : targetArrival(new Date(courtMs), settings.bufferMin)),
    [courtMs, settings.bufferMin],
  );
  const targetIso = target?.toISOString() ?? null;

  const nowQ = usePolled<NowResponse | UnavailableResponse>(`/api/commute/now?from=${from}`, {
    scope: `live|${from}`,
    intervalMs: 120_000,
    persist: true,
  });

  const planUrl =
    targetIso && target && target.getTime() > now.getTime() + 60_000
      ? `/api/commute/plan?from=${from}&arriveBy=${encodeURIComponent(targetIso)}`
      : null;
  const planQ = usePolled<PlanResponse | UnavailableResponse>(planUrl, { scope: `plan|${from}|${targetIso}`, intervalMs: 180_000 });

  // The slot window only moves on quarter-hour boundaries, which keeps the request URL stable in between.
  const quarter = Math.floor(now.getTime() / STEP_MS);
  const slots = useMemo(() => forecastWindow(new Date(quarter * STEP_MS), target), [quarter, target]);
  const forecastQ = usePolled<ForecastResponse | UnavailableResponse>(
    slots ? `/api/commute/forecast?from=${from}&start=${encodeURIComponent(slots.start.toISOString())}&count=${slots.count}` : null,
    { scope: `forecast|${from}|${targetIso ?? "open"}`, intervalMs: 600_000 },
  );

  const refreshAll = () => {
    nowQ.refresh();
    planQ.refresh();
    forecastQ.refresh();
  };

  if (nowQ.data?.source === "unavailable") {
    return <NeedsLiveKey reason={nowQ.data.reason} />;
  }

  const nowLive = liveOnly<NowResponse>(nowQ);
  const planLive = liveOnly<PlanResponse>(planQ);
  const forecastLive = liveOnly<ForecastResponse>(forecastQ);

  return (
    <div className="space-y-4">
      <Hero now={now} nowQ={nowLive} planQ={planLive} courtAt={courtAt} bufferMin={settings.bufferMin} online={online} onRefresh={refreshAll} />
      <Planner now={now} courtAt={courtAt} bufferMin={settings.bufferMin} />
      {slots && <ForecastChart now={now} nowQ={nowLive} forecastQ={forecastLive} courtAt={courtAt} target={target} />}
      {nowLive.data && <Incidents data={nowLive.data} />}
      <RouteCard origin={origin} data={nowLive.data} />
    </div>
  );
}

export function App() {
  const hydrated = useHydrated();
  const settings = useSettings();
  const [sheetOpen, setSheetOpen] = useState(false);
  useGpsRefresh(settings.origin);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[34rem] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <Header origin={hydrated ? settings.origin : null} onChangeOrigin={() => setSheetOpen(true)} />

      <main className="mt-5">
        {!hydrated ? (
          <ShellSkeleton />
        ) : settings.origin ? (
          <Dashboard key={originParam(settings.origin)} origin={settings.origin} settings={settings} />
        ) : (
          <Welcome settings={settings} />
        )}
      </main>

      <div className="mt-4">
        <InstallCard />
      </div>

      <footer className="mt-8 space-y-2.5 px-1 text-[11px] leading-relaxed text-faint">
        <p>
          Live traffic and forecasts by TomTom. Postcode lookup by postcodes.io. Map by OpenFreeMap © OpenMapTiles, data ©
          OpenStreetMap contributors.
        </p>
        <p>
          Your start point is sent to these services to plan the drive and is stored only on this device. Live drive
          times can change; allow extra time and never use your phone at the wheel.
        </p>
        <p>
          An independent tool for players heading to {CLUB.name}, {CLUB.venue}, {CLUB.address} {CLUB.postcode}. Not run by the
          club.
        </p>
      </footer>

      {hydrated && (
        <OriginSheet open={sheetOpen} onClose={() => setSheetOpen(false)} current={settings.origin} recents={settings.recents} />
      )}
    </div>
  );
}
