self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("ide-cache").then(cache => {
      return cache.addAll([
        "/",
        "/index.html",
        "/swahili.js"
      ]);
    })
  );
});
