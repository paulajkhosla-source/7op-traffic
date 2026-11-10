import { TtlCache } from "@/lib/cache";
import { apiError, json, rateLimit, upstreamFailure } from "@/lib/server/http";
import type { PostcodeResponse } from "@/lib/traffic/types";

export const dynamic = "force-dynamic";

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const cache = new TtlCache<PostcodeResponse>(500);

type PostcodesIoBody = {
  result?: {
    postcode?: string;
    latitude?: number | null;
    longitude?: number | null;
    admin_ward?: string | null;
    admin_district?: string | null;
  };
};

export async function GET(request: Request): Promise<Response> {
  const limited = rateLimit();
  if (limited) return limited;

  const compact = (new URL(request.url).searchParams.get("q") ?? "").replace(/\s+/g, "").toUpperCase();
  if (!UK_POSTCODE.test(compact)) {
    return apiError(400, "bad_postcode", "Enter a full UK postcode, like TN13 1XR.");
  }
  const cached = cache.get(compact);
  if (cached) return json(cached);

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404) {
      return apiError(404, "postcode_not_found", "That postcode wasn't found. Check it and try again.");
    }
    if (!response.ok) throw new Error(`postcodes.io responded with HTTP ${response.status}`);
    const result = ((await response.json()) as PostcodesIoBody).result;
    if (typeof result?.latitude !== "number" || typeof result.longitude !== "number") {
      return apiError(404, "postcode_not_found", "That postcode has no known location.");
    }
    const found: PostcodeResponse = {
      postcode: result.postcode ?? compact,
      lat: result.latitude,
      lon: result.longitude,
      place: result.admin_ward ?? result.admin_district ?? undefined,
    };
    cache.set(compact, found, 24 * 60 * 60 * 1000);
    return json(found);
  } catch (error) {
    return upstreamFailure("postcode", error);
  }
}
