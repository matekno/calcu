// Worker de la calculadora: si una cuenta se cuelga, la interfaz lo termina y crea otro.
import { resolver } from './motor.js';

let generarPasos = null;
const cargaPasos = import('./pasos.js')
  .then((m) => { generarPasos = m.generarPasos; })
  .catch(() => { generarPasos = null; });

self.onmessage = async ({ data }) => {
  const { id, latex, angulo, conPasos } = data;
  try {
    if (conPasos) await cargaPasos;
    const r = resolver(latex, { angulo, conPasos, generarPasos });
    self.postMessage({ id, ok: true, r });
  } catch (e) {
    self.postMessage({ id, ok: false, mensaje: String(e?.message ?? e) });
  }
};

self.postMessage({ listo: true });
