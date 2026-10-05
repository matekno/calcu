// Z, t, χ², F y Φ dentro de la calculadora, en notación de cátedra: Z_{(0,975)}, t_{(0,975 ; 15)},
// χ²_{(0,025 ; 24)}, F_{(0,95 ; 5 ; 10)}, Φ(1,96). Los fractiles van por el nivel acumulado a IZQUIERDA.
// Antes de pasarle la cuenta a Compute Engine se reemplaza cada uno por su valor (de js/dist, validado contra scipy).
import { DISTRIBUCIONES } from '../dist/distribuciones.js';

const D = DISTRIBUCIONES;
const ESTANDAR = { mu: 0, sigma: 1 };

const FUNCIONES = {
  Z: { args: 1, forma: 'Z_{(p)}', valor: ([p]) => D.normal.ppf(p, ESTANDAR), niveles: [0] },
  t: { args: 2, forma: 't_{(p ; ν)}', valor: ([p, nu]) => D.t.ppf(p, { nu }), niveles: [0], grados: [1] },
  chi2: { args: 2, forma: 'χ²_{(p ; ν)}', valor: ([p, nu]) => D.chi2.ppf(p, { nu }), niveles: [0], grados: [1] },
  F: { args: 3, forma: 'F_{(p ; ν₁ ; ν₂)}', valor: ([p, nu1, nu2]) => D.f.ppf(p, { nu1, nu2 }), niveles: [0], grados: [1, 2] },
  Phi: { args: 1, forma: 'Φ(z)', valor: ([z]) => D.normal.cdf(z, ESTANDAR), niveles: [] },
};

// Contenido de un grupo balanceado: s[i] es '{' (o '(' con fin ')').
function cerrar(s, i, abre = '{', cierra = '}') {
  let prof = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === '\\') { k++; continue; }
    if (s[k] === abre) prof++;
    else if (s[k] === cierra && --prof === 0) return k;
  }
  return -1;
}

// \left( ... \right) con anidados.
function cerrarLeft(s, i) {
  let prof = 0;
  for (let k = i; k < s.length; k++) {
    if (s.startsWith('\\left', k)) { prof++; k += 4; continue; }
    if (s.startsWith('\\right', k) && --prof === 0) return k;
  }
  return -1;
}

function sinParentesis(t) {
  t = t.trim();
  if (t.startsWith('\\left(') && t.endsWith('\\right)') && cerrarLeft(t, 0) === t.length - 7) return t.slice(6, -7).trim();
  if (t.startsWith('(') && t.endsWith(')') && cerrar(t, 0, '(', ')') === t.length - 1) return t.slice(1, -1).trim();
  return t;
}

// Separa por ';' de primer nivel.
function partir(t) {
  const partes = [];
  let prof = 0, desde = 0;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (c === '\\') {
      if (t.startsWith('\\left', k)) prof++;
      else if (t.startsWith('\\right', k)) prof--;
      k++;
      continue;
    }
    if (c === '{' || c === '(') prof++;
    else if (c === '}' || c === ')') prof--;
    else if (c === ';' && prof === 0) { partes.push(t.slice(desde, k)); desde = k + 1; }
  }
  partes.push(t.slice(desde));
  return partes.map((p) => p.trim());
}

const letraAntes = (s, i) => i > 0 && /[A-Za-z\\]/.test(s[i - 1]);

// Encuentra la próxima función desde i: { id, ini, fin, argumentos }.
function proxima(s, i) {
  for (let k = i; k < s.length; k++) {
    let id = null, j = -1;
    if ((s[k] === 'Z' || s[k] === 't' || s[k] === 'T' || s[k] === 'F') && s[k + 1] === '_' && !letraAntes(s, k)) {
      id = s[k] === 'T' ? 't' : s[k];
      j = k + 2;
    } else if (s.startsWith('\\chi', k) && !/[a-zA-Z]/.test(s[k + 4] ?? '')) {
      id = 'chi2';
      j = k + 4;
      const pot = /^\s*\^\s*(\{\s*2\s*\}|2)\s*/.exec(s.slice(j));
      if (pot) j += pot[0].length;
      if (s[j] !== '_') continue;
      j++;
    } else if (s.startsWith('\\Phi', k) && !/[a-zA-Z]/.test(s[k + 4] ?? '')) {
      let a = k + 4;
      while (s[a] === ' ') a++;
      let fin, contenido;
      if (s.startsWith('\\left(', a)) {
        const c = cerrarLeft(s, a);
        if (c < 0) continue;
        contenido = s.slice(a + 6, c);
        fin = c + 7;
      } else if (s[a] === '(' || s[a] === '{') {
        const c = cerrar(s, a, s[a], s[a] === '(' ? ')' : '}');
        if (c < 0) continue;
        contenido = s.slice(a + 1, c);
        fin = c + 1;
      } else continue;
      return { id: 'Phi', ini: k, fin, argumentos: partir(contenido) };
    }
    if (!id) continue;
    while (s[j] === ' ') j++;
    if (s[j] !== '{') continue;
    const c = cerrar(s, j);
    if (c < 0) continue;
    let fin = c + 1;
    if (id === 'chi2') {
      const pot = /^\s*\^\s*(\{\s*2\s*\}|2)/.exec(s.slice(fin));
      if (pot) fin += pot[0].length;
    }
    return { id, ini: k, fin, argumentos: partir(sinParentesis(s.slice(j + 1, c))) };
  }
  return null;
}

function literal(v) {
  const t = v.toPrecision(16);
  if (!t.includes('e')) return t;
  const [m, e] = t.split('e');
  return `${m}\\cdot10^{${Number(e)}}`;
}

// evaluar(latex) -> número (NaN si no es un número fijo).
export function reemplazarDistribuciones(latex, evaluar) {
  const usados = [];
  let salida = '', i = 0;
  for (;;) {
    const m = proxima(latex, i);
    if (!m) break;
    const f = FUNCIONES[m.id];
    if (m.argumentos.length !== f.args || m.argumentos.some((a) => !a)) {
      return { error: `${f.forma.split('_')[0].replace('(z)', '')} lleva ${f.args === 1 ? 'un dato' : `${f.args} datos separados por punto y coma`}: ${f.forma}.` };
    }
    const valores = [];
    for (const a of m.argumentos) {
      const interno = reemplazarDistribuciones(a, evaluar);
      if (interno.error) return interno;
      const v = evaluar(interno.latex);
      if (!Number.isFinite(v)) return { error: `Los datos de ${f.forma} tienen que ser números (sin letras).` };
      valores.push(v);
    }
    for (const k of f.niveles) {
      if (!(valores[k] > 0 && valores[k] < 1)) return { error: `En ${f.forma}, p es el nivel acumulado a izquierda: tiene que estar entre 0 y 1.` };
    }
    for (const k of f.grados ?? []) {
      if (!(valores[k] > 0)) return { error: `En ${f.forma}, los grados de libertad tienen que ser positivos.` };
    }
    const v = f.valor(valores);
    if (!Number.isFinite(v)) return { error: `No pude calcular ${f.forma}.` };
    usados.push({ tex: latex.slice(m.ini, m.fin), valor: v });
    salida += latex.slice(i, m.ini) + `\\left(${literal(v)}\\right)`;
    i = m.fin;
  }
  return { latex: salida + latex.slice(i), usados };
}
