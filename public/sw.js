// Service worker for Web Push only (no caching). Registered from Settings → Notifications.
// The server sends { title, body, url } (src/lib/notifications/notify.ts).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ESP Display Portal";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/favicon.ico",
      data: { url: data.url || "/" },
    }),
  );
});

// Focus an open portal tab (and go to the notification's page), or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((c) => c.url === url) || windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        if (same.url !== url && "navigate" in same) {
          try {
            await same.navigate(url);
            return;
          } catch {
            // Not controlled by this worker: fall through and open a new tab.
          }
        } else {
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
