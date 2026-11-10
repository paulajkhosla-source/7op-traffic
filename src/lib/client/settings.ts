"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "7op:settings:v1";
const MAX_RECENTS = 3;

export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

export type PostcodeOrigin = { kind: "postcode"; label: string; place?: string; lat: number; lon: number };
export type GpsOrigin = { kind: "gps"; lat: number; lon: number; accuracyM: number; fixedAt: string };
export type Origin = PostcodeOrigin | GpsOrigin;

export type Settings = {
  origin: Origin | null;
  recents: PostcodeOrigin[];
  /** ISO instant of the booked court, or null when just checking traffic. */
  courtAt: string | null;
  /** Minutes to arrive ahead of the court time. */
  bufferMin: number;
};

const DEFAULTS: Settings = { origin: null, recents: [], courtAt: null, bufferMin: 10 };

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function asPostcodeOrigin(value: unknown): PostcodeOrigin | null {
  const v = value as Partial<PostcodeOrigin> | null;
  if (!v || v.kind !== "postcode" || typeof v.label !== "string" || !isNumber(v.lat) || !isNumber(v.lon)) return null;
  return { kind: "postcode", label: v.label, place: typeof v.place === "string" ? v.place : undefined, lat: v.lat, lon: v.lon };
}

function asOrigin(value: unknown): Origin | null {
  const v = value as Partial<GpsOrigin> | null;
  if (v && v.kind === "gps" && isNumber(v.lat) && isNumber(v.lon)) {
    return {
      kind: "gps",
      lat: v.lat,
      lon: v.lon,
      accuracyM: isNumber(v.accuracyM) ? v.accuracyM : 0,
      fixedAt: typeof v.fixedAt === "string" ? v.fixedAt : new Date(0).toISOString(),
    };
  }
  return asPostcodeOrigin(value);
}

function read(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    const courtAt = typeof stored.courtAt === "string" && !Number.isNaN(Date.parse(stored.courtAt)) ? stored.courtAt : null;
    return {
      origin: asOrigin(stored.origin),
      recents: Array.isArray(stored.recents)
        ? stored.recents.map(asPostcodeOrigin).filter((o): o is PostcodeOrigin => o !== null).slice(0, MAX_RECENTS)
        : [],
      courtAt,
      bufferMin: isNumber(stored.bufferMin) && stored.bufferMin >= 0 && stored.bufferMin <= 60 ? stored.bufferMin : DEFAULTS.bufferMin,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Settings | undefined;
const listeners = new Set<() => void>();

function snapshot(): Settings {
  return (current ??= read());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...snapshot(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can be full or blocked; the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

/** Sets the start point, remembering postcodes for quick reuse. */
export function chooseOrigin(origin: Origin): void {
  if (origin.kind !== "postcode") {
    updateSettings({ origin });
    return;
  }
  const others = snapshot().recents.filter((recent) => recent.label !== origin.label);
  updateSettings({ origin, recents: [origin, ...others].slice(0, MAX_RECENTS) });
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULTS);
}

const subscribeNever = () => () => {};

/** False on the server and during hydration, true once the browser's own state can be read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function originLabel(origin: Origin): string {
  return origin.kind === "gps" ? "Current location" : origin.label;
}

export function originParam(origin: Origin): string {
  return `${origin.lat.toFixed(5)},${origin.lon.toFixed(5)}`;
}
