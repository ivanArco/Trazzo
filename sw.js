// Service Worker de Trazzo · Centro de Control
// Sube la versión cada vez que publiques cambios para que los usuarios reciban la nueva interfaz.
const CACHE = 'trazzo-v2.4';

const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.json',
  './img/patio-carga.svg',
  './img/seguimiento-poster.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

// Instalación: guarda la interfaz en caché.
// La versión nueva espera a que el usuario toque "Actualizar" (así no cambia la app a media tarea).
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
});

self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

// Activación: borra cachés de versiones anteriores
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Páginas: primero la red (para ver siempre la versión nueva) y, sin conexión, la caché.
// Demás archivos: primero la caché y, si no está, la red.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || request.headers.has('range')) return; // el video se pide por partes

  // La API (backend) siempre va a la red: sus datos cambian y no deben quedarse guardados
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  e.respondWith(
    caches.match(request).then((guardado) => guardado || fetch(request).then((respuesta) => {
      if (respuesta.ok) {
        const copia = respuesta.clone();
        caches.open(CACHE).then((c) => c.put(request, copia));
      }
      return respuesta;
    }))
  );
});
