"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { CLUB } from "@/lib/club";
import type { Incident, LatLon, RouteShape } from "@/lib/traffic/types";
import { LEVEL_HEX } from "./palette";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const CLUB_PIN: [number, number] = [CLUB.courts.lon, CLUB.courts.lat];

type RouteMapProps = {
  route: RouteShape;
  incidents: Incident[];
  origin: LatLon;
};

type MapLibre = typeof import("maplibre-gl");

function markerElement(kind: "origin" | "club"): HTMLElement {
  const element = document.createElement("div");
  if (kind === "origin") {
    element.style.cssText =
      "width:16px;height:16px;border-radius:50%;background:#f3f5fa;border:4px solid #060912;box-shadow:0 0 0 2px rgba(243,245,250,.55)";
  } else {
    element.style.cssText =
      "width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 36% 30%,#f3ffa6,#d6ff3f 55%,#9ccc17);border:3px solid #060912;box-shadow:0 0 18px rgba(214,255,63,.65)";
  }
  return element;
}

function congestionFeatures(route: RouteShape) {
  return {
    type: "FeatureCollection" as const,
    features: route.segments.map((segment) => ({
      type: "Feature" as const,
      properties: { color: LEVEL_HEX[segment.level] },
      geometry: { type: "LineString" as const, coordinates: route.coords.slice(segment.startIndex, segment.endIndex + 1) },
    })),
  };
}

function incidentFeatures(incidents: Incident[]) {
  return {
    type: "FeatureCollection" as const,
    features: incidents.map((incident) => ({
      type: "Feature" as const,
      properties: { color: LEVEL_HEX[incident.level] },
      geometry: { type: "Point" as const, coordinates: incident.at },
    })),
  };
}

function routeFeature(route: RouteShape) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route.coords } };
}

export default function RouteMap({ route, incidents, origin }: RouteMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ lib: MapLibre; map: MapLibreMap; originMarker: Marker; fitted: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    (async () => {
      try {
        const loaded = await import("maplibre-gl");
        // The package is CommonJS; depending on the bundler its exports arrive on the namespace or on `default`.
        const lib = (loaded as { default?: MapLibre }).default ?? loaded;
        if (cancelled || !container.current) return;
        const created = new lib.Map({
          container: container.current,
          style: STYLE_URL,
          center: CLUB_PIN,
          zoom: 10,
          // Credit for the map lives in the page footer, so the control does not cover the route.
          attributionControl: false,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        map = created;
        created.touchZoomRotate.disableRotation();
        // The dark style asks for a few sprites this build of the tiles does not ship. A blank stand-in keeps the map quiet.
        created.on("styleimagemissing", (event) => {
          if (created.hasImage(event.id)) return;
          created.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
        });
        created.on("load", () => {
          if (cancelled) return;
          if (created.getLayer("background")) created.setPaintProperty("background", "background-color", "#080c18");
          if (created.getLayer("water")) created.setPaintProperty("water", "fill-color", "#0d1830");

          created.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          created.addSource("congestion", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          created.addSource("incidents", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

          const round = { "line-cap": "round", "line-join": "round" } as const;
          created.addLayer({
            id: "route-glow",
            type: "line",
            source: "route",
            layout: round,
            paint: { "line-color": LEVEL_HEX.clear, "line-width": 16, "line-blur": 12, "line-opacity": 0.4 },
          });
          created.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: round,
            paint: { "line-color": "#04060c", "line-width": 9 },
          });
          created.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: round,
            paint: { "line-color": LEVEL_HEX.clear, "line-width": 5 },
          });
          created.addLayer({
            id: "congestion-line",
            type: "line",
            source: "congestion",
            layout: round,
            paint: { "line-color": ["get", "color"], "line-width": 5 },
          });
          created.addLayer({
            id: "incident-dots",
            type: "circle",
            source: "incidents",
            paint: {
              "circle-radius": 5.5,
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#04060c",
              "circle-stroke-width": 2.5,
            },
          });

          new lib.Marker({ element: markerElement("club") }).setLngLat(CLUB_PIN).addTo(created);
          const originMarker = new lib.Marker({ element: markerElement("origin") }).setLngLat(CLUB_PIN).addTo(created);
          mapRef.current = { lib, map: created, originMarker, fitted: "" };
          setReady(true);
        });
      } catch {
        // No WebGL, or the map library failed to load. The route strip above still tells the story.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const state = mapRef.current;
    if (!ready || !state) return;
    const { lib, map, originMarker } = state;

    (map.getSource("route") as GeoJSONSource | undefined)?.setData(routeFeature(route));
    (map.getSource("congestion") as GeoJSONSource | undefined)?.setData(congestionFeatures(route));
    (map.getSource("incidents") as GeoJSONSource | undefined)?.setData(incidentFeatures(incidents));
    map.setPaintProperty("route-line", "line-color", LEVEL_HEX.clear);
    map.setPaintProperty("route-glow", "line-color", LEVEL_HEX.clear);
    originMarker.setLngLat([origin.lon, origin.lat]);

    // Refit only when the trip itself changes, so a refresh never yanks the map from under a finger.
    const fitKey = `${origin.lat.toFixed(3)},${origin.lon.toFixed(3)}`;
    if (state.fitted === fitKey) return;
    const bounds = new lib.LngLatBounds(CLUB_PIN, CLUB_PIN);
    bounds.extend([origin.lon, origin.lat]);
    for (const point of route.coords) bounds.extend(point);
    map.fitBounds(bounds, {
      padding: { top: 36, right: 36, bottom: 64, left: 28 },
      maxZoom: 14,
      duration: state.fitted ? 700 : 0,
    });
    state.fitted = fitKey;
  }, [ready, route, incidents, origin]);

  if (failed) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
        The map couldn&apos;t load on this device. Your route is summarised above.
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div ref={container} className="h-full w-full" role="application" aria-label="Map of your route to the club" />
      {!ready && <div className="skeleton absolute inset-0 rounded-none" aria-hidden="true" />}
    </div>
  );
}
