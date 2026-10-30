// Keep model downloads across shell updates; refresh local code safely.
const SHELL_CACHE = "vision-shell-v2";
const MODEL_CACHE = "vision-runtime-v1"; // Retains previously downloaded large model files.
const HOME = ["./index.html", "./app.js", "./model-worker.js", "./style.css", "./visual-tags.js"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(HOME))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("vision-shell-") && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("authorization")) return;
  const url = new URL(request.url);
  const local = url.origin === self.location.origin && url.pathname.startsWith("/vision/");
  const provider =
    url.protocol === "https:" &&
    (url.hostname === "cdn.jsdelivr.net" ||
      url.hostname === "huggingface.co" ||
      url.hostname.endsWith(".huggingface.co") ||
      url.hostname === "cas-bridge.xethub.hf.co" ||
      url.hostname === "cdn-lfs.hf.co");
  if (!local && !provider) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(local ? SHELL_CACHE : MODEL_CACHE);
      const saved = await cache.match(request);
      // Versioned public model files can be cached first. Local app code checks for updates online.
      if (provider && saved) return saved;
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== "opaque")
          event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
        return response;
      } catch (error) {
        // Offline fallback is always scoped to the shell or already-downloaded model files.
        if (saved) return saved;
        throw error;
      }
    })(),
  );
});
