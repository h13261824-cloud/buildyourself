/* ==========================================================================
   Build Yourself — service-worker.js
   Cache-first app-shell strategy so the whole app works offline once it
   has been opened once. Bump CACHE_NAME to force clients to fetch fresh
   assets after a deploy.
   ========================================================================== */

const CACHE_NAME = "build-yourself-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/style.css",
  "./css/components.css",
  "./css/animations.css",
  "./css/responsive.css",
  "./js/utils.js",
  "./js/storage.js",
  "./js/ui.js",
  "./js/challenge.js",
  "./js/task.js",
  "./js/income.js",
  "./js/report.js",
  "./js/chat.js",
  "./js/router.js",
  "./js/app.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
