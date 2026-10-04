// Generado por herramientas/armar-sw.mjs: no editar a mano.
const VERSION = '439191628180';
const CACHE = `calcu-${VERSION}`;
const ARCHIVOS = [
  "./",
  "./css/estilos.css",
  "./iconos/apple-touch-icon.png",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/icono-maskable-512.png",
  "./iconos/icono.svg",
  "./index.html",
  "./js/almacen.js",
  "./js/calc/calculadora.js",
  "./js/calc/motor.js",
  "./js/calc/pasos.js",
  "./js/calc/teclado.js",
  "./js/calc/trabajador.js",
  "./js/dist/calculo.js",
  "./js/dist/distribuciones.js",
  "./js/dist/especiales.js",
  "./js/dist/grafico.js",
  "./js/dist/notacion.js",
  "./js/dist/panel.js",
  "./js/expresion.js",
  "./js/formato.js",
  "./js/main.js",
  "./js/teclado-num.js",
  "./manifest.webmanifest",
  "./vendor/compute-engine/chunks/chunk-GW4FGFKS.js",
  "./vendor/compute-engine/chunks/chunk-ZPQEMZU3.js",
  "./vendor/compute-engine/compute-engine.js",
  "./vendor/mathlive/fonts/KaTeX_AMS-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Caligraphic-Bold.woff2",
  "./vendor/mathlive/fonts/KaTeX_Caligraphic-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Fraktur-Bold.woff2",
  "./vendor/mathlive/fonts/KaTeX_Fraktur-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Main-Bold.woff2",
  "./vendor/mathlive/fonts/KaTeX_Main-BoldItalic.woff2",
  "./vendor/mathlive/fonts/KaTeX_Main-Italic.woff2",
  "./vendor/mathlive/fonts/KaTeX_Main-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Math-BoldItalic.woff2",
  "./vendor/mathlive/fonts/KaTeX_Math-Italic.woff2",
  "./vendor/mathlive/fonts/KaTeX_SansSerif-Bold.woff2",
  "./vendor/mathlive/fonts/KaTeX_SansSerif-Italic.woff2",
  "./vendor/mathlive/fonts/KaTeX_SansSerif-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Script-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Size1-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Size2-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Size3-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Size4-Regular.woff2",
  "./vendor/mathlive/fonts/KaTeX_Typewriter-Regular.woff2",
  "./vendor/mathlive/mathlive-fonts.css",
  "./vendor/mathlive/mathlive-static.css",
  "./vendor/mathlive/mathlive.min.mjs"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => {
    if (!self.registration.active) return self.skipWaiting();
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('calcu-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'activar') self.skipWaiting(); });

// Primero lo guardado (anda sin conexión); si no está, la red.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    if (req.mode === 'navigate') {
      const inicio = await cache.match('./');
      if (inicio) return inicio;
    }
    return fetch(req);
  })());
});
