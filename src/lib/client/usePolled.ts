"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PERSIST_PREFIX = "7op:last:";
const PERSIST_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type Polled<T> = {
  data: T | undefined;
  /** When `data` was fetched (epoch ms). */
  fetchedAt: number | undefined;
  /** Message from the most recent failed attempt; cleared by the next success. */
  error: string | undefined;
  /** No data to show yet. */
  loading: boolean;
  /** A background refresh is in flight. */
  refreshing: boolean;
  /** `data` is a saved reading from an earlier visit, not yet confirmed by the network. */
  fromCache: boolean;
  refresh: () => void;
};

type State<T> = { scope: string; data?: T; fetchedAt?: number; error?: string; refreshing: boolean };

type Saved<T> = { savedAt: number; data: T };

function readSaved<T>(scope: string): Saved<T> | undefined {
  try {
    const raw = window.localStorage.getItem(PERSIST_PREFIX + scope.split("|")[0]);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as Saved<T> & { scope: string };
    if (saved.scope !== scope || Date.now() - saved.savedAt > PERSIST_MAX_AGE_MS) return undefined;
    return saved;
  } catch {
    return undefined;
  }
}

function writeSaved<T>(scope: string, data: T): void {
  try {
    const record = { scope, savedAt: Date.now(), data };
    window.localStorage.setItem(PERSIST_PREFIX + scope.split("|")[0], JSON.stringify(record));
  } catch {
    // Losing the offline copy is harmless.
  }
}

type Options = {
  /**
   * Identifies what the data is about. Data is kept across refreshes while the
   * scope is unchanged and dropped the moment it changes. The part before the
   * first "|" names the localStorage slot when `persist` is set.
   */
  scope: string;
  intervalMs: number;
  /** Keep the last good response for the next launch, so there is something to show offline. */
  persist?: boolean;
};

/**
 * Fetches JSON from `url` now, every `intervalMs` while the page is visible,
 * and again when the page returns to the foreground or the network comes back.
 */
export function usePolled<T>(url: string | null, { scope, intervalMs, persist = false }: Options): Polled<T> {
  const [state, setState] = useState<State<T>>({ scope: "", refreshing: false });
  const loadRef = useRef<((announce: boolean) => void) | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    let controller: AbortController | undefined;
    let lastAttempt = 0;

    async function load(announce: boolean) {
      controller?.abort();
      const mine = new AbortController();
      controller = mine;
      lastAttempt = Date.now();
      if (announce) setState((prev) => (prev.scope === scope ? { ...prev, refreshing: true } : prev));
      try {
        const response = await fetch(url as string, { signal: mine.signal, headers: { accept: "application/json" } });
        const body = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
        if (!response.ok || body === null) {
          throw new Error(body?.message ?? "Something went wrong fetching traffic.");
        }
        if (!active || mine.signal.aborted) return;
        setState({ scope, data: body, fetchedAt: Date.now(), refreshing: false });
        if (persist) writeSaved(scope, body);
      } catch (error) {
        if (!active || mine.signal.aborted) return;
        const message =
          error instanceof TypeError
            ? "Can't reach the server. Check your connection."
            : error instanceof Error
              ? error.message
              : "Something went wrong fetching traffic.";
        setState((prev) =>
          prev.scope === scope ? { ...prev, error: message, refreshing: false } : { scope, error: message, refreshing: false },
        );
      }
    }

    loadRef.current = load;
    void load(false);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt > Math.min(intervalMs, 60_000)) void load(true);
    };
    const onOnline = () => void load(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      active = false;
      controller?.abort();
      loadRef.current = null;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [url, scope, intervalMs, persist]);

  const saved = useMemo(() => (persist && url ? readSaved<T>(scope) : undefined), [persist, url, scope]);
  const refresh = useCallback(() => loadRef.current?.(true), []);

  const own = url && state.scope === scope ? state : undefined;
  const data = own?.data ?? saved?.data;
  return {
    data,
    fetchedAt: own?.data ? own.fetchedAt : saved?.savedAt,
    error: own?.error,
    loading: Boolean(url) && data === undefined && !own?.error,
    refreshing: Boolean(own?.refreshing),
    fromCache: !own?.data && saved !== undefined,
    refresh,
  };
}
