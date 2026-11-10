"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { InstallIcon } from "./icons";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribeStandalone(listener: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function isStandalone(): boolean {
  return window.matchMedia(STANDALONE_QUERY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const agent = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(agent) || (agent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(agent);
}

/** Registers the service worker and offers to install the app where the browser allows it. */
export function InstallCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  // "unknown" on the server, so the card only ever appears after the browser has been asked.
  const mode = useSyncExternalStore(
    subscribeStandalone,
    () => (isStandalone() ? "standalone" : isIosSafari() ? "ios" : "browser"),
    () => "unknown",
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The app works without it; only offline launch is lost.
      });
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "ios") {
    return (
      <section className="card flex items-start gap-3.5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10">
          <InstallIcon size={20} />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold leading-snug">Keep it on your home screen</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            In Safari, tap Share, then <span className="text-ink">Add to Home Screen</span>.
          </p>
        </div>
      </section>
    );
  }

  if (mode !== "browser" || !installPrompt) return null;

  return (
    <section className="card flex items-center gap-3.5 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10">
        <InstallIcon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold leading-snug">Install the app</h2>
        <p className="mt-0.5 text-sm text-muted">One tap from your home screen.</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await installPrompt.prompt();
          await installPrompt.userChoice;
          setInstallPrompt(null);
        }}
        className="rounded-full bg-ball px-4 py-2 text-sm font-semibold text-bg transition-transform active:scale-95"
      >
        Install
      </button>
    </section>
  );
}
