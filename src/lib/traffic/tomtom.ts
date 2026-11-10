import { cumulativeDistances } from "../geo";
import { toRfc3339 } from "../time";
import { classifyTraffic } from "./level";
import type { Incident, IncidentCategory, LatLon, RouteSegment, RouteShape, TrafficLevel, Trip } from "./types";

const DEFAULT_BASE_URL = "https://api.tomtom.com";
const REQUEST_TIMEOUT_MS = 9_000;

export class TomTomError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TomTomError";
  }
}

export type TomTomRequest = {
  from: LatLon;
  to: LatLon;
  key: string;
  /** Omit both for a departure right now on live traffic. */
  departAt?: Date;
  arriveAt?: Date;
  /** Include route geometry and traffic sections, not just the summary. */
  detail: boolean;
  fetchImpl?: typeof fetch;
};

export type TomTomRoute = {
  trip: Trip;
  /** Present when `detail` was requested. */
  route?: RouteShape;
  incidents: Incident[];
};

type RawSummary = {
  lengthInMeters?: number;
  travelTimeInSeconds?: number;
  trafficDelayInSeconds?: number;
  noTrafficTravelTimeInSeconds?: number;
  departureTime?: string;
  arrivalTime?: string;
};

type RawSection = {
  startPointIndex?: number;
  endPointIndex?: number;
  sectionType?: string;
  simpleCategory?: string;
  delayInSeconds?: number;
  magnitudeOfDelay?: number;
  eventId?: string;
  streetName?: { text?: string };
  roadNumbers?: { text?: string }[];
};

type RawRoute = {
  summary?: RawSummary;
  legs?: { points?: { latitude?: number; longitude?: number }[] }[];
  sections?: RawSection[];
};

/** TOMTOM_BASE_URL exists so tests can point the client at a local stand-in. */
function baseUrl(): string {
  return (process.env.TOMTOM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function buildRouteUrl(request: TomTomRequest): string {
  const { from, to } = request;
  const params = new URLSearchParams({
    key: request.key,
    traffic: "true",
    travelMode: "car",
    routeType: "fastest",
    computeTravelTimeFor: "all",
    routeRepresentation: request.detail ? "polyline" : "summaryOnly",
  });
  if (request.detail) {
    params.append("sectionType", "traffic");
    params.append("sectionType", "importantRoadStretch");
  }
  if (request.arriveAt) params.set("arriveAt", toRfc3339(request.arriveAt));
  else if (request.departAt) params.set("departAt", toRfc3339(request.departAt));
  const locations = `${from.lat},${from.lon}:${to.lat},${to.lon}`;
  return `${baseUrl()}/routing/1/calculateRoute/${locations}/json?${params.toString()}`;
}

export async function fetchTomTomRoute(request: TomTomRequest): Promise<TomTomRoute> {
  const fetchImpl = request.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(buildRouteUrl(request), {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // The request URL carries the API key, so the underlying error is not rethrown or logged.
    throw new TomTomError(0, "TomTom routing request did not complete");
  }
  if (!response.ok) {
    throw new TomTomError(response.status, `TomTom routing responded with HTTP ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new TomTomError(502, "TomTom routing returned a body that is not JSON");
  }
  return parseTomTomRoute(body, request.departAt ?? new Date());
}

function magnitudeLevel(magnitude: number | undefined): TrafficLevel {
  if (magnitude === 2) return "heavy";
  if (magnitude === 3 || magnitude === 4) return "severe";
  return "moderate";
}

function sectionCategory(simpleCategory: string | undefined): IncidentCategory {
  if (simpleCategory === "JAM") return "jam";
  if (simpleCategory === "ROAD_WORK") return "roadworks";
  if (simpleCategory === "ROAD_CLOSURE") return "closure";
  return "other";
}

function validDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function roadNameFor(section: { start: number; end: number }, stretches: RawSection[]): string | undefined {
  let best: { overlap: number; name: string } | undefined;
  for (const stretch of stretches) {
    const start = stretch.startPointIndex;
    const end = stretch.endPointIndex;
    if (typeof start !== "number" || typeof end !== "number") continue;
    const overlap = Math.min(end, section.end) - Math.max(start, section.start);
    if (overlap < 0) continue;
    const name = stretch.roadNumbers?.find((road) => road.text)?.text ?? stretch.streetName?.text;
    if (name && (!best || overlap > best.overlap)) best = { overlap, name };
  }
  return best?.name;
}

export function parseTomTomRoute(body: unknown, requestedDeparture: Date): TomTomRoute {
  const raw = (body as { routes?: RawRoute[] } | null)?.routes?.[0];
  const summary = raw?.summary;
  const durationSec = summary?.travelTimeInSeconds;
  const distanceM = summary?.lengthInMeters;
  if (typeof durationSec !== "number" || typeof distanceM !== "number") {
    throw new TomTomError(502, "TomTom routing returned no usable route");
  }

  const reportedFreeFlow = summary?.noTrafficTravelTimeInSeconds;
  const freeFlowSec = Math.min(
    durationSec,
    typeof reportedFreeFlow === "number" && reportedFreeFlow > 0
      ? reportedFreeFlow
      : Math.max(1, durationSec - (summary?.trafficDelayInSeconds ?? 0)),
  );
  const departAt = validDate(summary?.departureTime) ?? requestedDeparture;
  const arriveAt = validDate(summary?.arrivalTime) ?? new Date(departAt.getTime() + durationSec * 1000);

  const trip: Trip = {
    departAt: departAt.toISOString(),
    arriveAt: arriveAt.toISOString(),
    durationSec,
    freeFlowSec,
    delaySec: durationSec - freeFlowSec,
    distanceM,
    level: classifyTraffic(durationSec, freeFlowSec),
  };

  const coords: [number, number][] = [];
  for (const leg of raw?.legs ?? []) {
    for (const point of leg.points ?? []) {
      if (typeof point.latitude !== "number" || typeof point.longitude !== "number") continue;
      coords.push([point.longitude, point.latitude]);
    }
  }
  if (coords.length < 2) return { trip, incidents: [] };

  const distances = cumulativeDistances(coords);
  const lastIndex = coords.length - 1;
  const sections = raw?.sections ?? [];
  const stretches = sections.filter((section) => section.sectionType === "IMPORTANT_ROAD_STRETCH");

  const segments: RouteSegment[] = [];
  const incidents: Incident[] = [];
  const usedIds = new Set<string>();

  for (const section of sections) {
    if (section.sectionType !== "TRAFFIC") continue;
    const start = section.startPointIndex;
    const end = section.endPointIndex;
    if (typeof start !== "number" || typeof end !== "number") continue;
    if (start < 0 || end > lastIndex || end < start) continue;

    const delaySec = Math.max(0, section.delayInSeconds ?? 0);
    const level = magnitudeLevel(section.magnitudeOfDelay);
    const startM = distances[start] ?? 0;
    const endM = distances[end] ?? startM;
    const hasKnownImpact = (section.magnitudeOfDelay ?? 0) > 0 || delaySec >= 30;

    if (hasKnownImpact && end > start) {
      segments.push({ startIndex: start, endIndex: end, startM, endM, level });
    }

    let id = section.eventId ?? `${start}-${end}`;
    while (usedIds.has(id)) id = `${id}'`;
    usedIds.add(id);

    incidents.push({
      id,
      category: sectionCategory(section.simpleCategory),
      level,
      delaySec,
      startM,
      lengthM: endM - startM,
      road: roadNameFor({ start, end }, stretches),
      at: coords[start] ?? [0, 0],
    });
  }

  segments.sort((a, b) => a.startIndex - b.startIndex);
  incidents.sort((a, b) => a.startM - b.startM);

  return { trip, route: { coords, distanceM, segments }, incidents };
}
