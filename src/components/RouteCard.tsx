"use client";

import dynamic from "next/dynamic";
import { CLUB } from "@/lib/club";
import { originLabel, type Origin } from "@/lib/client/settings";
import { formatMiles } from "@/lib/time";
import type { Incident, NowResponse, RouteShape } from "@/lib/traffic/types";
import { BallIcon, NavigateIcon } from "./icons";
import { levelColor } from "./palette";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" aria-hidden="true" />,
});

const DEST = `${CLUB.entrance.lat},${CLUB.entrance.lon}`;

function navigationLinks(origin: Origin) {
  // A typed-in start is passed along; for a GPS start the maps app uses the phone's own position.
  const from = origin.kind === "postcode" ? `&origin=${origin.lat},${origin.lon}` : "";
  return [
    { name: "Google Maps", href: `https://www.google.com/maps/dir/?api=1&destination=${DEST}&travelmode=driving${from}` },
    { name: "Waze", href: `https://waze.com/ul?ll=${DEST}&navigate=yes` },
    { name: "Apple Maps", href: `https://maps.apple.com/?daddr=${DEST}&dirflg=d` },
  ];
}

/** The drive drawn as a straight line: where along it the traffic is, in proportion. */
function RouteStrip({ route, incidents }: { route: RouteShape; incidents: Incident[] }) {
  const length = Math.max(route.distanceM, route.segments.at(-1)?.endM ?? 0, 1);
  const percent = (metres: number) => `${Math.min(100, Math.max(0, (metres / length) * 100))}%`;
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <span className="size-3.5 shrink-0 rounded-full border-[3px] border-ink" />
      <div
        className="relative h-2.5 flex-1 overflow-hidden rounded-full"
            style={{ background: `color-mix(in oklab, ${levelColor("clear")} 78%, transparent)` }}
      >
        {route.segments.map((segment) => (
            <span
              key={`${segment.startIndex}-${segment.endIndex}`}
              className="absolute inset-y-0 min-w-1.5 rounded-full"
              style={{
                left: percent(segment.startM),
                width: percent(segment.endM - segment.startM),
                background: levelColor(segment.level),
              }}
            />
          ))}
        {incidents
            .filter((incident) => incident.category !== "jam")
            .map((incident) => (
              <span
                key={incident.id}
                className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg"
                style={{ left: percent(incident.startM) }}
              />
            ))}
      </div>
      <BallIcon size={18} className="shrink-0" />
    </div>
  );
}

type RouteCardProps = { origin: Origin; data: NowResponse | undefined };

export function RouteCard({ origin, data }: RouteCardProps) {
  return (
    <section className="card rise overflow-hidden" style={{ animationDelay: "180ms" }}>
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Your route</h2>
          {data && <span className="tnum text-xs text-muted">{formatMiles(data.route.distanceM)}</span>}
        </div>
        <div className="mt-3.5">
          {data ? (
            <RouteStrip route={data.route} incidents={data.incidents} />
          ) : (
            <div className="skeleton h-3.5 w-full" aria-hidden="true" />
          )}
        </div>
        <div className="mt-2.5 flex items-start justify-between gap-4 text-xs">
          <span className="min-w-0 truncate font-medium">{originLabel(origin)}</span>
          <span className="shrink-0 text-right font-medium">{CLUB.shortName}</span>
        </div>
        {data && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {data.route.segments.length > 0
              ? "Coloured stretches are where traffic is slowing you down right now."
              : "Traffic is flowing freely the whole way."}
          </p>
        )}
      </div>

      <div className="h-60 border-y border-white/10 bg-[#080c18]">
        {data ? (
          <RouteMap route={data.route} incidents={data.incidents} origin={origin} />
        ) : (
          <div className="skeleton h-full w-full rounded-none" aria-hidden="true" />
        )}
      </div>

      <div className="p-5 pt-4">
        <p className="flex items-center gap-2 text-xs text-muted">
          <NavigateIcon size={14} /> Start navigation to {CLUB.venue}, {CLUB.postcode}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {navigationLinks(origin).map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center text-[13px] font-semibold transition-colors hover:border-white/25 active:scale-[0.97]"
            >
              {link.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
