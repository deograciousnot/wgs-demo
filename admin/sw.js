/* WGS admin service worker: lets the admin panel install like an app and show order notifications.
   It caches nothing, so the panel always loads fresh data. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Tapping a notification opens (or focuses) the orders tab.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if (c.url.includes("/admin")) { c.focus(); c.postMessage({ open: "orders" }); return; } }
    await self.clients.openWindow("./#orders");
  })());
});

// Ready for real push messages later (phone notifications when the panel is closed).
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "New order", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "New order", { body: d.body || "", icon: "../img/icon-192.png", badge: "../img/favicon.png", tag: d.tag || "order" }));
});
