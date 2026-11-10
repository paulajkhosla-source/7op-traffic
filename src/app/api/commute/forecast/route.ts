import { apiError, json, parseInstant, parseOrigin, rateLimit, resolveAccess, upstreamFailure } from "@/lib/server/http";
import { addMinutes } from "@/lib/time";
import { FORECAST_STEP_MIN, MAX_FORECAST_SLOTS } from "@/lib/traffic/constants";
import { trafficService } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";

const WEEK_MIN = 7 * 24 * 60;

export async function GET(request: Request): Promise<Response> {
  const limited = rateLimit(request);
  if (limited) return limited;
  const url = new URL(request.url);
  const origin = parseOrigin(url);
  if (origin instanceof Response) return origin;

  const now = new Date();
  const start = parseInstant(url, "start", addMinutes(now, -FORECAST_STEP_MIN), addMinutes(now, WEEK_MIN));
  if (start instanceof Response) return start;

  const count = Number(url.searchParams.get("count") ?? MAX_FORECAST_SLOTS);
  if (!Number.isInteger(count) || count < 1 || count > MAX_FORECAST_SLOTS) {
    return apiError(400, "bad_count", `count must be a whole number from 1 to ${MAX_FORECAST_SLOTS}.`);
  }

  const access = await resolveAccess(request);
  if (!access.live) {
    return json({ source: "unavailable", reason: access.reason, generatedAt: now.toISOString() });
  }
  try {
    return json(await trafficService.getForecast(origin, start, count, access.key, now));
  } catch (error) {
    return upstreamFailure("commute/forecast", error);
  }
}
