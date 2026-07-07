/* Web Push service worker: shows notifications and opens the ticket on click. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Tickets', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tickets', {
      body: data.body || '',
      data,
      tag: data.ticketId || undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.ticketId
    ? `/tickets/${event.notification.data.ticketId}`
    : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
