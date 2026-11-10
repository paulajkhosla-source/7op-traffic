import { getIdentity } from "../../../cursor/identity";
import { isInGreatBritain } from "../geo";
import type { ApiError, LatLon, UnavailableReason } from "../traffic/types";

export type Access = { live: true; key: string } | { live: false; reason: UnavailableReason };

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 90;
const RATE_MAX_CLIENTS = 5_000;

const NO_STORE = { "cache-control": "private, no-store" };

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function apiError(status: number, error: string, message: string): Response {
  return json<ApiError>({ error, message }, status);
}

/**
 * Live traffic comes from a metered API paid for with the owner's key, so it
 * is only fetched for a viewer the Cursor apps gate has signed in.
 */
export async function resolveAccess(request: Request): Promise<Access> {
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return { live: false, reason: "no_key" };
  const identity = await getIdentity(request);
  if (!identity.verified) return { live: false, reason: "signed_out" };
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

const clients = new Map<string, { count: number; resetAt: number }>();

/**
 * Per-instance request cap by client address, so one caller cannot run up the
 * traffic provider's bill or hammer the postcode service.
 */
export function rateLimit(request: Request): Response | null {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = clients.get(client);
  if (!entry || entry.resetAt <= now) {
    if (clients.size >= RATE_MAX_CLIENTS) {
      for (const [key, value] of clients) {
        if (value.resetAt <= now) clients.delete(key);
      }
      if (clients.size >= RATE_MAX_CLIENTS) clients.clear();
    }
    clients.set(client, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }
  entry.count += 1;
  if (entry.count <= RATE_MAX_REQUESTS) return null;
  return Response.json(
    { error: "rate_limited", message: "Too many requests. Try again in a minute." } satisfies ApiError,
    { status: 429, headers: { ...NO_STORE, "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)) } },
  );
}

export function upstreamFailure(scope: string, error: unknown): Response {
  console.error(`[api] ${scope} failed: ${error instanceof Error ? error.message : "unknown error"}`);
  return apiError(502, "upstream_unavailable", "The routing service could not be reached. Try again shortly.");
}
