/* eslint-disable no-undef */

// Minimal SW to satisfy installability (manifest + SW w/ fetch handler).
// Cache strategy: cache-first for static assets; network-first for navigations.

const CACHE_NAME = "converge-pwa-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up older caches if we change CACHE_NAME.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/auth/")) return false;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;

  const url = new URL(request.url);
  const isNav = request.mode === "navigate" || (request.destination === "" && request.headers.get("accept")?.includes("text/html"));
  const isStaticAsset =
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/onboarding/");

  if (isNav) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        // Only cache successful, same-origin basic responses.
        if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // Default: network-first with cache fallback.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || new Response("", { status: 504 });
      }
    })()
  );
});

