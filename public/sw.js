const CACHE = 'control-chicha-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/js/main.js',
        '/js/state.js',
        '/js/api.js',
        '/js/ui.js',
        '/js/ventas.js',
        '/js/historial.js',
        '/js/reportes.js',
        '/js/inventario.js',
        '/js/receta.js',
        '/js/clientes.js',
        '/js/config.js',
        '/js/analytics.js',
        '/manifest.json',
        '/icon.svg',
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
