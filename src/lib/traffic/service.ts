import { TtlCache } from "../cache";
import { CLUB } from "../club";
import { originKey } from "../geo";
import { addMinutes } from "../time";
import { FORECAST_STEP_MIN } from "./constants";
import { fetchTomTomRoute, TomTomError, type TomTomRequest, type TomTomRoute } from "./tomtom";
import type { ForecastResponse, LatLon, NowResponse, PlanResponse, Trip } from "./types";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
/** TomTom's free tier allows only a few routing calls per second. */
const LIVE_CONCURRENCY = 3;
const RATE_LIMIT_RETRY_MS = 700;

export type TrafficService = {
  getNow(origin: LatLon, key: string, now?: Date): Promise<NowResponse>;
  getForecast(origin: LatLon, start: Date, count: number, key: string, now?: Date): Promise<ForecastResponse>;
  getPlan(origin: LatLon, arriveBy: Date, key: string, now?: Date): Promise<PlanResponse>;
};

async function mapWithLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

export function createTrafficService(deps: { fetchImpl?: typeof fetch } = {}): TrafficService {
  const fetchImpl = deps.fetchImpl;
  const liveNowCache = new TtlCache<NowResponse>(200);
  const liveTripCache = new TtlCache<Trip>(2_000);
  const destination = CLUB.entrance;

  async function tomtom(request: Omit<TomTomRequest, "to" | "fetchImpl">): Promise<TomTomRoute> {
    const full: TomTomRequest = { ...request, to: destination, fetchImpl };
    try {
      return await fetchTomTomRoute(full);
    } catch (error) {
      if (!(error instanceof TomTomError) || error.status !== 429) throw error;
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
      return fetchTomTomRoute(full);
    }
  }

  return {
    async getNow(origin, key, now = new Date()) {
      const cacheKey = originKey(origin);
      const cached = liveNowCache.get(cacheKey, now.getTime());
      if (cached) return cached;
      try {
        const result = await tomtom({ from: origin, key, detail: true });
        if (!result.route) throw new TomTomError(502, "TomTom routing returned no route geometry");
        const response: NowResponse = {
          source: "live",
          generatedAt: now.toISOString(),
          trip: result.trip,
          route: result.route,
          incidents: result.incidents,
        };
        liveNowCache.set(cacheKey, response, 45 * SECOND, now.getTime());
        return response;
      } catch (error) {
        console.error(`[traffic] live route failed: ${describeError(error)}`);
        throw error;
      }
    },

    async getForecast(origin, start, count, key, now = new Date()) {
      const slotTimes = Array.from({ length: count }, (_, i) => addMinutes(start, i * FORECAST_STEP_MIN));
      const keyPrefix = `slot|${originKey(origin)}|`;
      try {
        const slots = await mapWithLimit(slotTimes, LIVE_CONCURRENCY, async (time) => {
          const cacheKey = keyPrefix + time.toISOString();
          const cached = liveTripCache.get(cacheKey, now.getTime());
          if (cached) return cached;
          const leadMs = time.getTime() - now.getTime();
          const result = await tomtom({
            from: origin,
            key,
            detail: false,
            departAt: leadMs > MINUTE ? time : undefined,
          });
          // Departures within the hour move with live traffic; later ones rest on historic profiles and change slowly.
          liveTripCache.set(cacheKey, result.trip, leadMs > 60 * MINUTE ? 20 * MINUTE : 4 * MINUTE, now.getTime());
          return result.trip;
        });
        return { source: "live", generatedAt: now.toISOString(), stepMin: FORECAST_STEP_MIN, slots };
      } catch (error) {
        // One failed slot sinks the set: a chart mixing a failed slot with the others would mislead.
        console.error(`[traffic] live forecast failed: ${describeError(error)}`);
        throw error;
      }
    },

    async getPlan(origin, arriveBy, key, now = new Date()) {
      const cacheKey = `plan|${originKey(origin)}|${arriveBy.toISOString()}`;
      try {
        let trip = liveTripCache.get(cacheKey, now.getTime());
        if (!trip) {
          trip = (await tomtom({ from: origin, key, detail: false, arriveAt: arriveBy })).trip;
          liveTripCache.set(cacheKey, trip, 3 * MINUTE, now.getTime());
        }
        const tooLate = new Date(trip.departAt).getTime() < now.getTime() - MINUTE;
        return {
          source: "live",
          generatedAt: now.toISOString(),
          arriveBy: arriveBy.toISOString(),
          trip: tooLate ? null : trip,
        };
      } catch (error) {
        console.error(`[traffic] live arrival plan failed: ${describeError(error)}`);
        throw error;
      }
    },
  };
}

export const trafficService = createTrafficService();
