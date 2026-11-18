/* WGS admin service worker: installs the panel like an app and shows order notifications,
   including push messages that arrive while the panel is closed. It caches nothing. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "New order", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "New order", {
    body: d.body || "",
    icon: "../img/icon-192.png",
    badge: "../img/favicon.png",
    tag: d.tag || "order",
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: d.url || "./#orders" }
  }));
});

// Tapping a notification opens (or focuses) the panel on the Orders tab.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#orders", self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.postMessage({ open: "orders" }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
