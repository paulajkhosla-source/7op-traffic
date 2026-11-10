"use client";

import { useEffect } from "react";
import { haversineM, isInGreatBritain } from "../geo";
import { chooseOrigin, type Origin } from "./settings";

const STALE_AFTER_MS = 3 * 60_000;
/** Smaller moves are GPS jitter, and would only refetch the same route. */
const MOVED_M = 150;

/**
 * Keeps a GPS start point current: re-reads the position on launch, every few
 * minutes while open, and each time the app returns to the foreground. A
 * typed-in postcode is left alone.
 */
export function useGpsRefresh(origin: Origin | null): void {
  const gps = origin?.kind === "gps" ? origin : null;
  const lat = gps?.lat;
  const lon = gps?.lon;
  const fixedAt = gps?.fixedAt;

  useEffect(() => {
    if (lat === undefined || lon === undefined || fixedAt === undefined || !("geolocation" in navigator)) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - new Date(fixedAt).getTime() < STALE_AFTER_MS) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = { lat: position.coords.latitude, lon: position.coords.longitude };
          if (!isInGreatBritain(point)) return;
          const moved = haversineM(point, { lat, lon }) > MOVED_M;
          chooseOrigin({
            kind: "gps",
            lat: moved ? point.lat : lat,
            lon: moved ? point.lon : lon,
            accuracyM: position.coords.accuracy,
            fixedAt: new Date().toISOString(),
          });
        },
        () => {
          // Keep the last fix; the hero still shows a drive from there.
        },
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
      );
    };
    refresh();
    const timer = window.setInterval(refresh, STALE_AFTER_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [lat, lon, fixedAt]);
}
