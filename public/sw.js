const CACHE = 'pharmacy-static-v1';
const OFFLINE = ['/ar/offline', '/fr/offline'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE))));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname.startsWith('/fr') ? '/fr/offline' : '/ar/offline')));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(event.request)) || fetch(event.request).then((response) => {cache.put(event.request, response.clone());return response;})));
  }
});
