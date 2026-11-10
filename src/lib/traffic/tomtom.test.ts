import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRouteUrl, fetchTomTomRoute, parseTomTomRoute, TomTomError } from "./tomtom";

const from = { lat: 51.2724, lon: 0.1909 };
const to = { lat: 51.33008, lon: 0.15131 };

/** Shaped like the Calculate Route response in TomTom's Routing API v1 documentation. */
function documentedBody() {
  return {
    formatVersion: "0.0.12",
    routes: [
      {
        summary: {
          lengthInMeters: 8600,
          travelTimeInSeconds: 900,
          trafficDelayInSeconds: 240,
          trafficLengthInMeters: 1500,
          departureTime: "2026-11-10T17:02:00+00:00",
          arrivalTime: "2026-11-10T17:17:00+00:00",
          noTrafficTravelTimeInSeconds: 600,
          historicTrafficTravelTimeInSeconds: 780,
          liveTrafficIncidentsTravelTimeInSeconds: 900,
        },
        legs: [
          {
            summary: {},
            points: [
              { latitude: 51.2724, longitude: 0.1909 },
              { latitude: 51.28, longitude: 0.185 },
              { latitude: 51.29, longitude: 0.178 },
              { latitude: 51.3, longitude: 0.17 },
              { latitude: 51.315, longitude: 0.16 },
              { latitude: 51.33008, longitude: 0.15131 },
            ],
          },
        ],
        sections: <Record<string, unknown>[]>[
          { startPointIndex: 0, endPointIndex: 5, sectionType: "TRAVEL_MODE", travelMode: "car" },
          {
            startPointIndex: 1,
            endPointIndex: 3,
            sectionType: "TRAFFIC",
            simpleCategory: "JAM",
            effectiveSpeedInKmh: 18,
            delayInSeconds: 200,
            magnitudeOfDelay: 2,
            tec: { effectCode: 4, causes: [{ mainCauseCode: 1 }] },
            eventId: "TTL-1",
          },
          {
            startPointIndex: 4,
            endPointIndex: 5,
            sectionType: "TRAFFIC",
            simpleCategory: "ROAD_WORK",
            delayInSeconds: 0,
            magnitudeOfDelay: 0,
          },
          {
            startPointIndex: 0,
            endPointIndex: 3,
            sectionType: "IMPORTANT_ROAD_STRETCH",
            importantRoadStretchIndex: 0,
            streetName: { text: "London Road" },
            roadNumbers: [{ text: "A224" }],
          },
          {
            startPointIndex: 3,
            endPointIndex: 5,
            sectionType: "IMPORTANT_ROAD_STRETCH",
            importantRoadStretchIndex: 1,
            streetName: { text: "Polhill" },
          },
        ],
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildRouteUrl", () => {
  it("asks for a live-traffic route with geometry and traffic sections", () => {
    const url = new URL(buildRouteUrl({ from, to, key: "k", detail: true }));
    expect(url.origin).toBe("https://api.tomtom.com");
    expect(url.pathname).toBe("/routing/1/calculateRoute/51.2724,0.1909:51.33008,0.15131/json");
    expect(url.searchParams.get("traffic")).toBe("true");
    expect(url.searchParams.get("computeTravelTimeFor")).toBe("all");
    expect(url.searchParams.get("routeRepresentation")).toBe("polyline");
    expect(url.searchParams.getAll("sectionType")).toEqual(["traffic", "importantRoadStretch"]);
    expect(url.searchParams.has("departAt")).toBe(false);
    expect(url.searchParams.has("arriveAt")).toBe(false);
  });

  it("asks for summaries only when geometry is not needed", () => {
    const url = new URL(buildRouteUrl({ from, to, key: "k", detail: false, departAt: new Date("2026-11-10T18:15:00Z") }));
    expect(url.searchParams.get("routeRepresentation")).toBe("summaryOnly");
    expect(url.searchParams.has("sectionType")).toBe(false);
    expect(url.searchParams.get("departAt")).toBe("2026-11-10T18:15:00+00:00");
  });

  it("sends arriveAt instead of departAt, never both", () => {
    const url = new URL(
      buildRouteUrl({
        from,
        to,
        key: "k",
        detail: false,
        departAt: new Date("2026-11-10T18:15:00Z"),
        arriveAt: new Date("2026-11-10T18:50:00Z"),
      }),
    );
    expect(url.searchParams.get("arriveAt")).toBe("2026-11-10T18:50:00+00:00");
    expect(url.searchParams.has("departAt")).toBe(false);
  });

  it("percent-encodes the offset sign", () => {
    expect(buildRouteUrl({ from, to, key: "k", detail: false, arriveAt: new Date("2026-11-10T18:50:00Z") })).toContain(
      "arriveAt=2026-11-10T18%3A50%3A00%2B00%3A00",
    );
  });

  it("honours the base URL override", () => {
    vi.stubEnv("TOMTOM_BASE_URL", "http://127.0.0.1:4010/");
    expect(buildRouteUrl({ from, to, key: "k", detail: false })).toMatch(/^http:\/\/127\.0\.0\.1:4010\/routing\/1\//);
  });
});

describe("parseTomTomRoute", () => {
  const requested = new Date("2026-11-10T17:00:00Z");

  it("reads the trip summary", () => {
    const { trip } = parseTomTomRoute(documentedBody(), requested);
    expect(trip).toEqual({
      departAt: "2026-11-10T17:02:00.000Z",
      arriveAt: "2026-11-10T17:17:00.000Z",
      durationSec: 900,
      freeFlowSec: 600,
      delaySec: 300,
      distanceM: 8600,
      level: "heavy",
    });
  });

  it("returns geometry in [lon, lat] order", () => {
    const { route } = parseTomTomRoute(documentedBody(), requested);
    expect(route?.coords).toHaveLength(6);
    expect(route?.coords[0]).toEqual([0.1909, 51.2724]);
    expect(route?.distanceM).toBe(8600);
  });

  it("colours only stretches with a known impact", () => {
    const { route } = parseTomTomRoute(documentedBody(), requested);
    expect(route?.segments).toHaveLength(1);
    expect(route?.segments[0]).toMatchObject({ startIndex: 1, endIndex: 3, level: "heavy" });
    expect(route?.segments[0]?.endM).toBeGreaterThan(route?.segments[0]?.startM ?? Infinity);
  });

  it("lists every traffic section as an incident, in route order, with a road name", () => {
    const { incidents } = parseTomTomRoute(documentedBody(), requested);
    expect(incidents.map((i) => [i.id, i.category, i.road, i.delaySec])).toEqual([
      ["TTL-1", "jam", "A224", 200],
      ["4-5", "roadworks", "Polhill", 0],
    ]);
    expect(incidents[0]?.at).toEqual([0.185, 51.28]);
    expect(incidents[0]?.lengthM).toBeGreaterThan(2000);
  });

  it("falls back to the reported delay when no free-flow time is given", () => {
    const body = documentedBody();
    delete (body.routes[0]!.summary as Record<string, unknown>).noTrafficTravelTimeInSeconds;
    const { trip } = parseTomTomRoute(body, requested);
    expect(trip.freeFlowSec).toBe(660);
    expect(trip.delaySec).toBe(240);
  });

  it("derives times when the summary omits them", () => {
    const body = documentedBody();
    delete (body.routes[0]!.summary as Record<string, unknown>).departureTime;
    delete (body.routes[0]!.summary as Record<string, unknown>).arrivalTime;
    const { trip } = parseTomTomRoute(body, requested);
    expect(trip.departAt).toBe("2026-11-10T17:00:00.000Z");
    expect(trip.arriveAt).toBe("2026-11-10T17:15:00.000Z");
  });

  it("returns the summary alone for a summaryOnly response", () => {
    const body = documentedBody();
    const route = body.routes[0]!;
    route.legs = [{ summary: {}, points: [] }];
    const parsed = parseTomTomRoute(body, requested);
    expect(parsed.route).toBeUndefined();
    expect(parsed.incidents).toEqual([]);
    expect(parsed.trip.durationSec).toBe(900);
  });

  it("ignores sections whose indexes fall outside the route", () => {
    const body = documentedBody();
    body.routes[0]!.sections.push({ startPointIndex: 4, endPointIndex: 99, sectionType: "TRAFFIC", simpleCategory: "JAM" });
    expect(parseTomTomRoute(body, requested).incidents).toHaveLength(2);
  });

  it("rejects a body with no route", () => {
    expect(() => parseTomTomRoute({ routes: [] }, requested)).toThrow(TomTomError);
    expect(() => parseTomTomRoute(null, requested)).toThrow(TomTomError);
  });
});

describe("fetchTomTomRoute", () => {
  it("surfaces the upstream status without the request URL", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    const error = await fetchTomTomRoute({ from, to, key: "secret-key", detail: false, fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(TomTomError);
    expect(error.status).toBe(403);
    expect(error.message).not.toContain("secret-key");
  });

  it("does not leak the key when the network fails", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      throw new Error(`connect failed for ${url}`);
    }) as unknown as typeof fetch;
    const error = await fetchTomTomRoute({ from, to, key: "secret-key", detail: false, fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(TomTomError);
    expect(error.message).not.toContain("secret-key");
  });
});
