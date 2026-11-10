import { json, parseOrigin, rateLimit, resolveAccess, upstreamFailure } from "@/lib/server/http";
import { trafficService } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const limited = rateLimit();
  if (limited) return limited;
  const origin = parseOrigin(new URL(request.url));
  if (origin instanceof Response) return origin;
  const access = resolveAccess();
  if (!access.live) {
    return json({ source: "unavailable", reason: access.reason, generatedAt: new Date().toISOString() });
  }
  try {
    return json(await trafficService.getNow(origin, access.key));
  } catch (error) {
    return upstreamFailure("commute/now", error);
  }
}
