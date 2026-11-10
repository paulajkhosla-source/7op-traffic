export type LatLon = { lat: number; lon: number };

export type TrafficLevel = "clear" | "moderate" | "heavy" | "severe";

/** Every drive time this app shows is a live reading. There is no guessed fallback. */
export type DataSource = "live";

export type SourceInfo = {
  source: DataSource;
};

/** Why a live reading could not be made. The response then carries no drive time. */
export type UnavailableReason = "no_key";

export type UnavailableResponse = {
  source: "unavailable";
  reason: UnavailableReason;
  generatedAt: string;
};

export type Trip = {
  /** ISO instants. */
  departAt: string;
  arriveAt: string;
  durationSec: number;
  /** Duration on empty roads. */
  freeFlowSec: number;
  delaySec: number;
  distanceM: number;
  level: TrafficLevel;
};

export type IncidentCategory = "jam" | "roadworks" | "closure" | "other";

export type Incident = {
  id: string;
  category: IncidentCategory;
  level: TrafficLevel;
  delaySec: number;
  /** Distance along the route at which the incident starts, and its length. */
  startM: number;
  lengthM: number;
  /** Road number or street name, when the provider reports one. */
  road?: string;
  /** [lon, lat] of the start of the incident. */
  at: [number, number];
};

export type RouteSegment = {
  /** Indexes into `coords`, inclusive. */
  startIndex: number;
  endIndex: number;
  startM: number;
  endM: number;
  level: TrafficLevel;
};

export type RouteShape = {
  /** GeoJSON order: [lon, lat]. */
  coords: [number, number][];
  distanceM: number;
  /** Congested stretches only; anything not covered is flowing freely. */
  segments: RouteSegment[];
};

export type NowResponse = SourceInfo & {
  generatedAt: string;
  trip: Trip;
  route: RouteShape;
  incidents: Incident[];
};

export type ForecastResponse = SourceInfo & {
  generatedAt: string;
  stepMin: number;
  slots: Trip[];
};

export type PlanResponse = SourceInfo & {
  generatedAt: string;
  arriveBy: string;
  /** Null when no departure from now on can make the arrival time. */
  trip: Trip | null;
};

export type PostcodeResponse = {
  postcode: string;
  lat: number;
  lon: number;
  place?: string;
};

export type ApiError = { error: string; message: string };
