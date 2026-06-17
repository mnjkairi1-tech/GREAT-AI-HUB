const CACHE_NAME = 'smart-menu-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch for the service worker to be valid for PWA installation criteria
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
