"use client";

import { useState, type FormEvent } from "react";
import { chooseOrigin, type Origin, type PostcodeOrigin } from "@/lib/client/settings";
import { isInGreatBritain } from "@/lib/geo";
import type { ApiError, PostcodeResponse } from "@/lib/traffic/types";
import { ArrowRightIcon, LocateIcon, PinIcon } from "./icons";

type OriginPickerProps = {
  current: Origin | null;
  recents: PostcodeOrigin[];
  /** Called once a start point has been saved. */
  onChosen: () => void;
};

type Busy = "locating" | "postcode" | null;

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is blocked. Allow it in your browser settings, or enter a postcode instead.";
  }
  return "Couldn't get a location fix. Try again, or enter a postcode instead.";
}

export function OriginPicker({ current, recents, onChosen }: OriginPickerProps) {
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("This browser can't share your location. Enter a postcode instead.");
      return;
    }
    setBusy("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(null);
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        if (!isInGreatBritain(point)) {
          setError("You seem to be outside Great Britain. Enter a UK postcode to plan from.");
          return;
        }
        chooseOrigin({ kind: "gps", ...point, accuracyM: position.coords.accuracy, fixedAt: new Date().toISOString() });
        onChosen();
      },
      (failure) => {
        setBusy(null);
        setError(locationErrorMessage(failure));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  async function lookUpPostcode(event: FormEvent) {
    event.preventDefault();
    const query = postcode.trim();
    if (!query) return;
    setBusy("postcode");
    setError(null);
    try {
      const response = await fetch(`/api/postcode?q=${encodeURIComponent(query)}`, { headers: { accept: "application/json" } });
      const body = (await response.json()) as PostcodeResponse | ApiError;
      if (!response.ok || "error" in body) {
        setError("message" in body ? body.message : "That postcode couldn't be looked up.");
        return;
      }
      chooseOrigin({ kind: "postcode", label: body.postcode, place: body.place, lat: body.lat, lon: body.lon });
      setPostcode("");
      onChosen();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={busy !== null}
        className="flex w-full items-center gap-3.5 rounded-2xl bg-ball px-4 py-3.5 text-left text-bg transition-transform active:scale-[0.98] disabled:opacity-70"
      >
        <LocateIcon size={22} className={busy === "locating" ? "spin" : undefined} />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold leading-tight">
            {busy === "locating" ? "Finding you…" : "Use my current location"}
          </span>
          <span className="mt-0.5 block text-xs font-medium opacity-70">Best when you leave from different places</span>
        </span>
        {current?.kind === "gps" && <span className="text-xs font-semibold">In use</span>}
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={lookUpPostcode} noValidate>
        <label htmlFor="origin-postcode" className="text-sm font-medium">
          Start from a postcode
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="origin-postcode"
            value={postcode}
            onChange={(event) => setPostcode(event.target.value.toUpperCase())}
            placeholder="TN13 1XR"
            autoComplete="postal-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={9}
            aria-describedby={error ? "origin-error" : undefined}
            className="tnum min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base font-semibold tracking-wide placeholder:font-normal placeholder:text-faint focus:border-ball focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null || postcode.trim().length < 5}
            className="grid w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 transition-colors hover:bg-white/15 disabled:opacity-40"
            aria-label="Use this postcode"
          >
            <ArrowRightIcon size={20} className={busy === "postcode" ? "animate-pulse" : undefined} />
          </button>
        </div>
      </form>

      {error && (
        <p id="origin-error" role="alert" className="mt-3 rounded-2xl bg-severe/10 px-3.5 py-3 text-sm leading-relaxed text-severe">
          {error}
        </p>
      )}

      {recents.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">Recent</p>
          <ul className="mt-2.5 space-y-2">
            {recents.map((recent) => {
              const inUse = current?.kind === "postcode" && current.label === recent.label;
              return (
                <li key={recent.label}>
                  <button
                    type="button"
                    onClick={() => {
                      chooseOrigin(recent);
                      onChosen();
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                      inUse ? "border-ball/60 bg-ball/10" : "border-white/10 bg-white/5 hover:border-white/25"
                    }`}
                  >
                    <PinIcon size={18} className="text-muted" />
                    <span className="tnum flex-1 text-[15px] font-semibold">{recent.label}</span>
                    {recent.place && <span className="truncate text-xs text-muted">{recent.place}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Your start point is used to plan the drive and is saved only on this device.
      </p>
    </div>
  );
}
