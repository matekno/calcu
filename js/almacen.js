// Preferencias e historial en el navegador. Si el almacenamiento falla (modo privado), la app sigue sin recordar.
const PREFIJO = 'calcu.';

export function leer(clave, defecto) {
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v === null ? defecto : JSON.parse(v);
  } catch {
    return defecto;
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento */
  }
}
