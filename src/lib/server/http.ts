import { isInGreatBritain } from "../geo";
import type { ApiError, LatLon, UnavailableReason } from "../traffic/types";

export type Access = { live: true; key: string } | { live: false; reason: UnavailableReason };

const RATE_WINDOW_MS = 60_000;
/** Shared by every caller on this instance. A forecast spends one unit per slot. */
const RATE_BUDGET = 36;

const NO_STORE = { "cache-control": "private, no-store" };

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function apiError(status: number, error: string, message: string): Response {
  return json<ApiError>({ error, message }, status);
}

/** Reads the server key at request time. A static `process.env.NAME` can be baked in at build. */
function serverKey(): string {
  return process.env["TOMTOM_API_KEY"]?.trim() ?? "";
}

/** Live traffic is public. The key stays on the server and is never sent to the browser. */
export function resolveAccess(): Access {
  const key = serverKey();
  if (!key) return { live: false, reason: "no_key" };
  return { live: true, key };
}

/** Parses `from=lat,lon`. Returns a 400 response for anything that is not a point in Great Britain. */
export function parseOrigin(url: URL): LatLon | Response {
  const raw = url.searchParams.get("from") ?? "";
  const match = /^(-?\d{1,2}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)$/.exec(raw);
  if (!match) return apiError(400, "bad_origin", "Start point must be given as from=lat,lon.");
  const origin = { lat: Number(match[1]), lon: Number(match[2]) };
  if (!isInGreatBritain(origin)) {
    return apiError(400, "origin_out_of_range", "Start point must be in Great Britain.");
  }
  return origin;
}

/** Parses an ISO instant query parameter that must fall inside [earliest, latest]. */
export function parseInstant(url: URL, name: string, earliest: Date, latest: Date): Date | Response {
  const raw = url.searchParams.get(name) ?? "";
  const date = new Date(raw);
  if (raw.length > 40 || Number.isNaN(date.getTime())) {
    return apiError(400, `bad_${name}`, `${name} must be an ISO date-time.`);
  }
  if (date < earliest || date > latest) {
    return apiError(400, `${name}_out_of_range`, `${name} must be within the next seven days.`);
  }
  return date;
}

const bucket = { used: 0, resetAt: 0 };

/**
 * Instance-wide cap on calls to paid and upstream services. It does not trust
 * a client address header, so changing that header cannot reset the budget.
 * `cost` is how many provider calls this request will make.
 */
export function rateLimit(cost = 1): Response | null {
  const spend = Math.max(1, Math.min(12, Math.floor(cost)));
  const now = Date.now();
  if (bucket.resetAt <= now) {
    bucket.used = spend;
    bucket.resetAt = now + RATE_WINDOW_MS;
    return null;
  }
  if (bucket.used + spend > RATE_BUDGET) {
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Try again in a minute." } satisfies ApiError,
      { status: 429, headers: { ...NO_STORE, "retry-after": String(Math.ceil((bucket.resetAt - now) / 1000)) } },
    );
  }
  bucket.used += spend;
  return null;
}

export function upstreamFailure(scope: string, error: unknown): Response {
  console.error(`[api] ${scope} failed: ${error instanceof Error ? error.message : "unknown error"}`);
  return apiError(502, "upstream_unavailable", "The routing service could not be reached. Try again shortly.");
}
