// Service worker: keeps the app shell and its static assets available offline.
// Traffic data is never cached here; the page shows its own last-known reading when offline.

const VERSION = "v1";
const SHELL_CACHE = `7op-shell-${VERSION}`;
const STATIC_CACHE = `7op-static-${VERSION}`;
const SHELL_URL = "/";
const STATIC_CACHE_LIMIT = 150;

// A sign-in redirect or an error page must never be stored as the app shell.
function isCacheable(response) {
  return response.status === 200 && response.type === "basic" && !response.redirected;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - STATIC_CACHE_LIMIT))) {
    await cache.delete(key);
  }
}

// On a first visit the page loads its scripts before this worker controls it, so they are
// read out of the shell HTML and fetched here; otherwise the first offline launch has no code.
async function precacheShell() {
  const response = await fetch(SHELL_URL, { credentials: "same-origin", cache: "no-store" });
  if (!isCacheable(response)) return;
  const html = await response.clone().text();
  await (await caches.open(SHELL_CACHE)).put(SHELL_URL, response);

  const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) ?? []);
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assets].map(async (path) => {
      try {
        const asset = await fetch(path, { credentials: "same-origin" });
        if (isCacheable(asset)) await cache.put(path, asset);
      } catch {
        // One missing asset should not fail the install.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("7op-") && !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

async function navigate(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response) && new URL(request.url).pathname === SHELL_URL) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw error;
  }
}

async function staticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(staticAsset(request));
  }
});
