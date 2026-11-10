import type { CSSProperties } from "react";
import { formatDuration, formatMiles } from "@/lib/time";
import type { Incident, IncidentCategory, NowResponse } from "@/lib/traffic/types";
import { AlertIcon, CheckIcon, ClosedIcon, ConeIcon, JamIcon } from "./icons";
import { levelColor } from "./palette";

const TITLES: Record<IncidentCategory, string> = {
  jam: "Queueing traffic",
  roadworks: "Roadworks",
  closure: "Road closed",
  other: "Traffic incident",
};

const ICONS: Record<IncidentCategory, typeof JamIcon> = {
  jam: JamIcon,
  roadworks: ConeIcon,
  closure: ClosedIcon,
  other: AlertIcon,
};

function IncidentRow({ incident }: { incident: Incident }) {
  const Icon = ICONS[incident.category];
  const details = [
    incident.delaySec >= 30 ? `+${formatDuration(incident.delaySec)}` : null,
    incident.lengthM >= 100 ? `${formatMiles(incident.lengthM)} long` : null,
    `${formatMiles(incident.startM)} into your drive`,
  ].filter(Boolean);
  return (
    <li className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-2xl"
        style={
          {
            "--lv": levelColor(incident.level),
            color: "var(--lv)",
            background: "color-mix(in oklab, var(--lv) 15%, transparent)",
          } as CSSProperties
        }
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug">
          {TITLES[incident.category]}
          {incident.road && <span className="font-normal text-muted"> on {incident.road}</span>}
        </p>
        <p className="tnum mt-1 text-xs leading-relaxed text-muted">{details.join(" · ")}</p>
      </div>
    </li>
  );
}

/** Incidents TomTom reports on the route right now. */
export function Incidents({ data }: { data: NowResponse }) {
  return (
    <section className="card rise p-5" style={{ animationDelay: "240ms" }}>
      <h2 className="eyebrow">On your route</h2>
      {data.incidents.length === 0 ? (
        <p className="mt-3.5 flex items-center gap-3 text-[15px] font-medium">
          <span className="grid size-10 place-items-center rounded-2xl bg-clear/15 text-clear">
            <CheckIcon size={20} />
          </span>
          No incidents reported
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10">
          {data.incidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </ul>
      )}
    </section>
  );
}
