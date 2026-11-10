import { json, parseInstant, parseOrigin, rateLimit, resolveAccess, upstreamFailure } from "@/lib/server/http";
import { addMinutes } from "@/lib/time";
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
  const arriveBy = parseInstant(url, "arriveBy", now, addMinutes(now, WEEK_MIN));
  if (arriveBy instanceof Response) return arriveBy;

  const access = await resolveAccess(request);
  if (!access.live) {
    return json({ source: "unavailable", reason: access.reason, generatedAt: now.toISOString() });
  }
  try {
    return json(await trafficService.getPlan(origin, arriveBy, access.key, now));
  } catch (error) {
    return upstreamFailure("commute/plan", error);
  }
}
