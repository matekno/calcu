// Genera sw.js con la lista de todo lo que hay que guardar para usar la app sin conexión.
// La versión es un hash del contenido: si cambia cualquier archivo, el navegador ofrece actualizar.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const incluir = ['index.html', 'manifest.webmanifest', 'css', 'js', 'iconos', 'vendor'];
const excluir = /(^|\/)(\.DS_Store|LICENSE.*)$/;

function listar(ruta) {
  const abs = join(raiz, ruta);
  if (statSync(abs).isDirectory()) return readdirSync(abs).flatMap((n) => listar(join(ruta, n)));
  return excluir.test(ruta) ? [] : [ruta];
}

const archivos = incluir.flatMap(listar).sort();
const hash = createHash('sha256');
for (const a of archivos) hash.update(a).update(readFileSync(join(raiz, a)));
const version = hash.digest('hex').slice(0, 12);
const lista = ['./', ...archivos.map((a) => `./${relative(raiz, join(raiz, a))}`)];

const sw = `// Generado por herramientas/armar-sw.mjs: no editar a mano.
const VERSION = '${version}';
const CACHE = \`calcu-\${VERSION}\`;
const ARCHIVOS = ${JSON.stringify(lista, null, 2)};

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
`;
writeFileSync(join(raiz, 'sw.js'), sw);
console.log(`sw.js: ${archivos.length} archivos, versión ${version}`);
