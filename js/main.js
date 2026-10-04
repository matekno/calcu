import { leer, guardar } from './almacen.js';
import { iniciarCalculadora } from './calc/calculadora.js';

const ajustes = { decimales: leer('decimales', 6), tema: leer('tema', 'auto') };
const oyentesAjustes = new Set();
export const preferencias = {
  get decimales() { return ajustes.decimales; },
  alCambiar(fn) { oyentesAjustes.add(fn); },
};

function aplicarTema() {
  if (ajustes.tema === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', ajustes.tema);
}
aplicarTema();

const calc = iniciarCalculadora();
let dist = null;

async function mostrarVista(nombre) {
  for (const tab of document.querySelectorAll('.pestanas [role="tab"]')) {
    const activa = tab.dataset.vista === nombre;
    tab.setAttribute('aria-selected', String(activa));
    document.getElementById(`vista-${tab.dataset.vista}`).hidden = !activa;
  }
  guardar('vista', nombre);
  if (nombre === 'dist') {
    if (!dist) {
      const m = await import('./dist/panel.js');
      dist = m.iniciarDistribuciones(preferencias);
    }
    dist.mostrar();
  } else {
    calc.enfocar();
  }
}
document.querySelectorAll('.pestanas [role="tab"]').forEach((t) => t.addEventListener('click', () => mostrarVista(t.dataset.vista)));
mostrarVista(leer('vista', 'calc'));

// Ajustes
const dlgAjustes = document.getElementById('dlg-ajustes');
const selDec = document.getElementById('aj-decimales');
const selTema = document.getElementById('aj-tema');
selDec.value = String(ajustes.decimales);
selTema.value = ajustes.tema;
document.getElementById('btn-ajustes').addEventListener('click', () => dlgAjustes.showModal());
selDec.addEventListener('change', () => {
  ajustes.decimales = Number(selDec.value);
  guardar('decimales', ajustes.decimales);
  oyentesAjustes.forEach((fn) => fn());
});
selTema.addEventListener('change', () => {
  ajustes.tema = selTema.value;
  guardar('tema', ajustes.tema);
  aplicarTema();
  oyentesAjustes.forEach((fn) => fn());
});
document.querySelectorAll('dialog [data-cerrar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// Aviso flotante
export function avisar(texto, accion) {
  const el = document.getElementById('aviso');
  el.replaceChildren(document.createTextNode(texto));
  if (accion) {
    const b = document.createElement('button');
    b.textContent = accion.texto;
    b.addEventListener('click', () => { el.hidden = true; accion.fn(); });
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(avisar.reloj);
  if (!accion) avisar.reloj = setTimeout(() => { el.hidden = true; }, 3500);
}

// Offline: service worker que guarda toda la app la primera vez.
const estado = document.getElementById('estado-offline');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const pintar = () => {
      estado.textContent = navigator.serviceWorker.controller
        ? '✓ Lista para usar sin conexión.'
        : 'Guardando la app para usarla sin conexión…';
    };
    pintar();
    navigator.serviceWorker.addEventListener('controllerchange', pintar);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          avisar('Hay una versión nueva.', { texto: 'Actualizar', fn: () => { nuevo.postMessage('activar'); location.reload(); } });
        }
        if (nuevo.state === 'activated') pintar();
      });
    });
  }).catch(() => { estado.textContent = 'No se pudo preparar el modo sin conexión en este navegador.'; });
} else {
  estado.textContent = 'El modo sin conexión necesita abrir la app desde https (o localhost).';
}
