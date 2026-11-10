import { describe, expect, it, vi } from "vitest";
import { createTrafficService } from "./service";

const origin = { lat: 51.2724, lon: 0.1909 };
const key = "test-key";
/** Same day, 17:00, in the evening peak. */
const peakNow = new Date("2026-11-10T17:00:00Z");

function osrmBody() {
  return {
    code: "Ok",
    routes: [
      {
        duration: 1200,
        distance: 15000,
        geometry: { coordinates: [[0.1909, 51.2724], [0.17, 51.3], [0.15131, 51.33008]] },
      },
    ],
  };
}

function tomtomSummary(url: URL) {
  const departAt = url.searchParams.get("departAt");
  const arriveAt = url.searchParams.get("arriveAt");
  const travel = 1500;
  const depart = arriveAt
    ? new Date(new Date(arriveAt).getTime() - travel * 1000)
    : new Date(departAt ?? "2026-11-10T17:00:00Z");
  return {
    routes: [
      {
        summary: {
          lengthInMeters: 15200,
          travelTimeInSeconds: travel,
          trafficDelayInSeconds: 300,
          noTrafficTravelTimeInSeconds: 1200,
          departureTime: depart.toISOString(),
          arrivalTime: new Date(depart.getTime() + travel * 1000).toISOString(),
        },
        legs: [
          {
            points:
              url.searchParams.get("routeRepresentation") === "polyline"
                ? [
                    { latitude: 51.2724, longitude: 0.1909 },
                    { latitude: 51.3, longitude: 0.17 },
                    { latitude: 51.33008, longitude: 0.15131 },
                  ]
                : [],
          },
        ],
        sections: [],
      },
    ],
  };
}

type Handler = (url: URL) => Response | Promise<Response>;

function fakeFetch(handlers: { osrm?: Handler; tomtom?: Handler }) {
  const calls: URL[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.hostname === "router.project-osrm.org") {
      return handlers.osrm ? handlers.osrm(url) : Response.json(osrmBody());
    }
    if (url.hostname === "api.tomtom.com") {
      return handlers.tomtom ? handlers.tomtom(url) : Response.json(tomtomSummary(url));
    }
    throw new Error(`unexpected host ${url.hostname}`);
  }) as unknown as typeof fetch;
  const count = (host: string) => calls.filter((url) => url.hostname === host).length;
  return { fetchImpl, calls, count };
}

describe("live traffic", () => {
  it("serves the provider's route and never touches the estimate router", async () => {
    const { fetchImpl, calls, count } = fakeFetch({});
    const service = createTrafficService({ fetchImpl });
    const response = await service.getNow(origin, key, peakNow);
    expect(response.source).toBe("live");
    expect(response.trip).toMatchObject({ durationSec: 1500, freeFlowSec: 1200, delaySec: 300 });
    expect(response.route.coords).toHaveLength(3);
    expect(count("router.project-osrm.org")).toBe(0);
    expect(calls[0]?.pathname).toContain("51.2724,0.1909:51.33008,0.15131");
    expect(calls[0]?.searchParams.get("key")).toBe("test-key");
  });

  it("reuses a fresh live route for the same start point", async () => {
    const { fetchImpl, count } = fakeFetch({});
    const service = createTrafficService({ fetchImpl });
    await service.getNow(origin, key, peakNow);
    await service.getNow(origin, key, new Date(peakNow.getTime() + 30_000));
    expect(count("api.tomtom.com")).toBe(1);
    await service.getNow(origin, key, new Date(peakNow.getTime() + 60_000));
    expect(count("api.tomtom.com")).toBe(2);
  });

  it("asks for each forecast slot, leaving departAt off the one that is now", async () => {
    const { fetchImpl, calls } = fakeFetch({});
    const service = createTrafficService({ fetchImpl });
    const forecast = await service.getForecast(origin, peakNow, 4, key, peakNow);
    expect(forecast.source).toBe("live");
    expect(forecast.slots.map((slot) => slot.departAt)).toEqual([
      "2026-11-10T17:00:00.000Z",
      "2026-11-10T17:15:00.000Z",
      "2026-11-10T17:30:00.000Z",
      "2026-11-10T17:45:00.000Z",
    ]);
    const departs = calls.map((url) => url.searchParams.get("departAt")).sort();
    expect(departs).toEqual(["2026-11-10T17:15:00+00:00", "2026-11-10T17:30:00+00:00", "2026-11-10T17:45:00+00:00", null]);
    expect(calls.every((url) => url.searchParams.get("routeRepresentation") === "summaryOnly")).toBe(true);
  });

  it("caches forecast slots between refreshes", async () => {
    const { fetchImpl, count } = fakeFetch({});
    const service = createTrafficService({ fetchImpl });
    await service.getForecast(origin, peakNow, 12, key, peakNow);
    expect(count("api.tomtom.com")).toBe(12);
    await service.getForecast(origin, peakNow, 12, key, new Date(peakNow.getTime() + 60_000));
    expect(count("api.tomtom.com")).toBe(12);
  });

  it("reports a provider failure instead of inventing a drive time", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchImpl } = fakeFetch({ tomtom: () => new Response("{}", { status: 403 }) });
    const service = createTrafficService({ fetchImpl });
    await expect(service.getNow(origin, key, peakNow)).rejects.toThrow(/403/);
    await expect(service.getForecast(origin, peakNow, 3, key, peakNow)).rejects.toThrow(/403/);
    const logged = errors.mock.calls.flat().join(" ");
    expect(logged).toContain("403");
    expect(logged).not.toContain("test-key");
    errors.mockRestore();
  });

  it("drops the whole forecast when one slot fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchImpl } = fakeFetch({
      tomtom: (url) =>
        url.searchParams.get("departAt") === "2026-11-10T17:30:00+00:00"
          ? new Response("{}", { status: 500 })
          : Response.json(tomtomSummary(url)),
    });
    const service = createTrafficService({ fetchImpl });
    await expect(service.getForecast(origin, peakNow, 4, key, peakNow)).rejects.toThrow(/500/);
    errors.mockRestore();
  });

  it("retries once when rate limited", async () => {
    let attempts = 0;
    const { fetchImpl } = fakeFetch({
      tomtom: (url) => (++attempts === 1 ? new Response("{}", { status: 429 }) : Response.json(tomtomSummary(url))),
    });
    const service = createTrafficService({ fetchImpl });
    const response = await service.getNow(origin, key, peakNow);
    expect(response.source).toBe("live");
    expect(attempts).toBe(2);
  });

  it("plans with arriveAt and returns the provider's departure", async () => {
    const { fetchImpl, calls } = fakeFetch({});
    const service = createTrafficService({ fetchImpl });
    const arriveBy = new Date("2026-11-10T18:50:00Z");
    const plan = await service.getPlan(origin, arriveBy, key, peakNow);
    expect(calls[0]?.searchParams.get("arriveAt")).toBe("2026-11-10T18:50:00+00:00");
    expect(plan).toMatchObject({ source: "live", arriveBy: arriveBy.toISOString() });
    expect(plan.trip?.departAt).toBe("2026-11-10T18:25:00.000Z");
  });

  it("returns no plan when the provider's departure is already past", async () => {
    const service = createTrafficService({ fetchImpl: fakeFetch({}).fetchImpl });
    const plan = await service.getPlan(origin, new Date("2026-11-10T18:50:00Z"), key, new Date("2026-11-10T18:30:00Z"));
    expect(plan.source).toBe("live");
    expect(plan.trip).toBeNull();
  });
});
