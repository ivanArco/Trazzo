// Service Worker de Trazzo · Centro de Control
// Sube la versión cada vez que publiques cambios para que los usuarios reciban la nueva interfaz.
const CACHE = 'trazzo-v2.10';
// Caché de las consultas a la API: la llena la página (js/trazzo-core.js) y se conserva entre versiones
const CACHE_API = 'trazzo-api';

const ARCHIVOS = [
  './',
  './index.html',
  './rastreo.html',
  './css/styles.css',
  './manifest.json',
  './js/app.js',
  './js/trazzo-core.js',
  './partials/header.html',
  './partials/main.html',
  './partials/footer.html',
  './partials/login.html',
  './partials/dialogs.html',
  './partials/chatbot.html',
  './partials/toast.html',
  './partials/panico.html',
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

// Activación: borra cachés de versiones anteriores (menos la de la API)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE && k !== CACHE_API).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Páginas: primero la red (para ver siempre la versión nueva) y, sin conexión, la caché.
// Demás archivos: primero la caché y, si no está, la red.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || request.headers.has('range')) return; // el video se pide por partes

  // La API (backend) siempre va a la red; la copia sin conexión la maneja la página con la Cache API
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    // Sin conexión: la misma página guardada (rastreo.html?t=... se busca sin el ?t=) o, si no, la app
    e.respondWith(fetch(request).catch(() =>
      caches.match(request, { ignoreSearch: true }).then((pagina) => pagina || caches.match('./index.html'))
    ));
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
