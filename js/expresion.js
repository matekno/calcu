// Cuentas en los campos numéricos: "1/40", "1-0,05/2", "raiz(2)", "2,5e-3", "-1,96". Devuelve NaN si no se entiende.

const FUNCIONES = {
  raiz: Math.sqrt, sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
};
const CONSTANTES = { pi: Math.PI, 'π': Math.PI, e: Math.E };

export function evaluarCampo(texto) {
  const s = String(texto ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'raiz')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/^,/, '0.')
    .replace(/,/g, '.');
  if (!s) return NaN;
  let i = 0;

  const ver = () => s[i];
  const comer = (c) => (s[i] === c ? (i++, true) : false);

  function numero() {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    let v = Number(m[0]);
    if (comer('%')) v /= 100;
    return v;
  }

  function primario() {
    if (comer('(')) {
      const v = suma();
      if (!comer(')')) throw new Error(')');
      return v;
    }
    const n = numero();
    if (n !== null) return n;
    const m = /^[a-zπ]+/.exec(s.slice(i));
    if (m) {
      const nombre = m[0];
      if (nombre in FUNCIONES) {
        i += nombre.length;
        const arg = comer('(') ? (() => { const v = suma(); if (!comer(')')) throw new Error(')'); return v; })() : potencia();
        return FUNCIONES[nombre](arg);
      }
      if (nombre in CONSTANTES) {
        i += nombre.length;
        return CONSTANTES[nombre];
      }
    }
    throw new Error('símbolo');
  }

  function potencia() {
    const base = primario();
    if (comer('^')) return base ** unario();
    return base;
  }

  function unario() {
    if (comer('-')) return -unario();
    if (comer('+')) return unario();
    return potencia();
  }

  function producto() {
    let v = unario();
    for (;;) {
      if (comer('*')) v *= unario();
      else if (comer('/')) v /= unario();
      else if (ver() === '(' || /[a-zπ]/.test(ver() ?? '')) v *= unario();
      else return v;
    }
  }

  function suma() {
    let v = producto();
    for (;;) {
      if (comer('+')) v += producto();
      else if (comer('-')) v -= producto();
      else return v;
    }
  }

  try {
    const v = suma();
    return i === s.length && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}
