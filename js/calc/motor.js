// Resuelve lo que se escribe en la calculadora con Compute Engine. Corre en el worker y en Node (tests).
// Devuelve LaTeX con punto decimal: la interfaz lo pasa a coma al dibujarlo.

import { ComputeEngine, compile } from '../../vendor/compute-engine/compute-engine.js';
import { reemplazarDistribuciones } from './fractiles.js';

let ce = null;
export function motor() {
  ce ??= new ComputeEngine();
  return ce;
}

const RELACIONES = { Equal: '=', Less: '<', LessEqual: '\\le', Greater: '>', GreaterEqual: '\\ge', NotEqual: '\\ne' };
const FUNCIONES_SIN_EVALUAR = /"(Sin|Cos|Tan|Cot|Sec|Csc|Arcsin|Arccos|Arctan|Ln|Log|Lb|Lg|Exp|Integrate|D|Limit|Sum|Product|Gamma)"/;

export function normalizar(latex) {
  return latex
    .replace(/\{,\}/g, '.')
    .replace(/(\d),(?=\d)/g, '$1.')
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\\tfrac/g, '\\frac')
    .trim();
}

export function incompleto(latex) {
  return /\\placeholder/.test(latex) || /\[\s*\]|\{\s*\}\s*$/.test(latex);
}

function decimal(expr) {
  const n = expr.N();
  const re = n.re, im = n.im ?? 0;
  if (!Number.isFinite(re) && !Number.isFinite(im)) return null;
  return { re, im };
}

// LaTeX de un decimal con hasta 10 cifras (sin los separadores de miles de CE).
function texDecimal({ re, im }) {
  const f = (x) => {
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e12 || ax < 1e-6) {
      const [m, e] = x.toExponential(9).split('e');
      return `${m.replace(/\.?0+$/, '')}\\cdot 10^{${Number(e)}}`;
    }
    let s = x.toPrecision(10);
    if (s.includes('e')) s = x.toFixed(12);
    return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  };
  if (Math.abs(im) < 1e-14 * Math.max(1, Math.abs(re))) return f(re);
  const r = Math.abs(re) < 1e-14 * Math.abs(im) ? '' : f(re);
  const signo = im < 0 ? '-' : r ? '+' : '';
  const mod = Math.abs(im) === 1 ? '' : f(Math.abs(im));
  return `${r}${signo}${mod}i`;
}

// 0.75 -> 3/4 si el decimal es exacto y corto.
function fraccionDeDecimal(texto) {
  const m = /^(-?)(\d+)\.(\d{1,9})$/.exec(texto);
  if (!m) return null;
  let num = BigInt(m[2] + m[3]);
  let den = 10n ** BigInt(m[3].length);
  const mcd = (a, b) => (b ? mcd(b, a % b) : a);
  const g = mcd(num, den);
  num /= g;
  den /= g;
  if (den === 1n) return null;
  return { signo: m[1], num, den };
}

function mixto(signo, num, den) {
  if (num < den) return null;
  const entero = num / den, resto = num % den;
  if (resto === 0n) return null;
  return `${signo}${entero}\\frac{${resto}}{${den}}`;
}

// Notación de CE -> notación de la app.
export function prolijo(tex) {
  return tex
    .replace(/\\,/g, '')
    .replace(/\\imaginaryI/g, '\\mathrm{i}')
    .replace(/\\exponentialE/g, '\\mathrm{e}')
    .replace(/(\d)\.0(?![\d])/g, '$1');
}

function enteroGrande(json) {
  const t = typeof json === 'number' ? String(json) : json?.num;
  const m = /^(-?)(\d+)(?:e\+?(\d+))?$/.exec(t ?? '');
  if (!m) return null;
  const digitos = m[2] + '0'.repeat(Number(m[3] ?? 0));
  return m[1] + digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
}

function esLindo(json) {
  return !FUNCIONES_SIN_EVALUAR.test(JSON.stringify(json));
}

function formasNumero(exacto, entradaCanonica) {
  const formas = [];
  const json = exacto.json;
  if (json === 'ComplexInfinity' || json === 'Indeterminate' || json === 'NaN' || exacto.isNaN) {
    return { principal: null, formas, aviso: 'El resultado no está definido (por ejemplo, una división por cero).' };
  }
  if (json === 'PositiveInfinity' || json === 'NegativeInfinity') {
    const t = json === 'PositiveInfinity' ? '\\infty' : '-\\infty';
    return { principal: t, formas: [{ etiqueta: 'Resultado', tex: t, texto: 'Tiende a infinito: no es un número.' }] };
  }
  const dec = decimal(exacto);
  if (!dec) return { principal: null, formas, aviso: 'No pude calcular un valor numérico.' };
  const texDec = texDecimal(dec);
  if (exacto.isInteger && Math.abs(dec.re) >= 1e15) {
    const todos = enteroGrande(json);
    formas.push({ etiqueta: 'Decimal', tex: texDec, aprox: true });
    if (todos) formas.push({ etiqueta: 'Entero exacto', tex: todos, largo: true });
    return { principal: texDec, formas, valor: dec };
  }
  // Un decimal con más de 10 cifras (por ejemplo, con un fractil adentro) se muestra redondeado.
  if (decimalLargo(exacto)) {
    formas.push({ etiqueta: 'Decimal', tex: texDec, aprox: true });
    return { principal: texDec, principalAprox: true, formas, valor: dec };
  }
  const lindo = esLindo(json);
  let principal;
  if (lindo) {
    principal = prolijo(exacto.latex);
    formas.push({ etiqueta: 'Resultado exacto', tex: principal });
    const decimalDistinto = principal !== texDec && principal !== texDec.replace(/i$/, '\\mathrm{i}');
    if (decimalDistinto) {
      const repetido = exacto.isRational && !exacto.isInteger ? prolijo(exacto.N().latex) : null;
      formas.push({ etiqueta: 'Decimal', tex: repetido && /overline/.test(repetido) ? `${repetido} \\approx ${texDec}` : texDec, aprox: !(repetido && !/overline/.test(repetido)) });
    }
    if (exacto.operator === 'Rational') {
      const [n, d] = exacto.json.slice(1).map((v) => BigInt(v));
      const m = mixto(n < 0n ? '-' : '', n < 0n ? -n : n, d);
      if (m) formas.push({ etiqueta: 'Número mixto', tex: m });
    } else if (typeof json === 'number' || (json && json.num)) {
      const texto = String(typeof json === 'number' ? json : json.num).replace(/\.0+$/, '');
      const fr = fraccionDeDecimal(texto);
      if (fr && fr.den <= 1000n && fr.num < 100000n) {
        formas.push({ etiqueta: 'Fracción', tex: `${fr.signo}\\frac{${fr.num}}{${fr.den}}` });
        const m = mixto(fr.signo, fr.num, fr.den);
        if (m) formas.push({ etiqueta: 'Número mixto', tex: m });
      }
    }
  } else {
    principal = texDec;
    formas.push({ etiqueta: 'Decimal', tex: texDec, aprox: true });
    if (exacto.latex !== entradaCanonica) formas.push({ etiqueta: 'Forma exacta', tex: prolijo(exacto.latex) });
  }
  return { principal, formas, aprox: lindo ? texDec : null, valor: dec };
}

function decimalLargo(e) {
  if (!e.isNumberLiteral || e.isInteger || e.operator === 'Rational') return false;
  const json = e.json;
  const t = String(typeof json === 'number' ? json : json?.num ?? '');
  return /^-?\d*\.\d+$/.test(t) && t.replace(/^-?0*\.?0*/, '').replace('.', '').length > 10;
}

function texSolucion(sol, grados) {
  const dec = decimal(sol);
  if (dec && decimalLargo(sol)) {
    return { tex: texDecimal(dec) + (grados ? '^{\\circ}' : ''), aprox: null, valor: dec, rel: '\\approx ' };
  }
  let exacto = prolijo(sol.latex);
  const texDec = dec ? texDecimal(dec) : null;
  const igual = !texDec || texDec === exacto || texDec.replace(/i$/, '\\mathrm{i}') === exacto;
  if (grados && dec && Math.abs(dec.im) < 1e-12) exacto += '^{\\circ}';
  return { tex: exacto, aprox: igual ? null : texDec + (grados ? '^{\\circ}' : ''), valor: dec };
}

// Raíces reales numéricas de f en [a, b): cambios de signo (bisección) y raíces dobles (mínimos de |f|).
function raicesNumericas(f, v, a, b, n) {
  let fn;
  try {
    const comp = compile(f);
    if (!comp.success) return null;
    fn = (x) => { const y = comp.run({ [v]: x }); return typeof y === 'number' ? y : NaN; };
  } catch {
    return null;
  }
  const xs = [], ys = [];
  for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; xs.push(x); ys.push(fn(x)); }
  const raices = [];
  const biseccion = (lo, hi) => {
    let flo = fn(lo);
    for (let k = 0; k < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo)); k++) {
      const m = (lo + hi) / 2, fm = fn(m);
      if (fm === 0) return m;
      if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m;
    }
    return (lo + hi) / 2;
  };
  const dorada = (lo, hi) => {
    const g = (Math.sqrt(5) - 1) / 2;
    let c1 = hi - g * (hi - lo), c2 = lo + g * (hi - lo);
    for (let k = 0; k < 200; k++) {
      if (Math.abs(fn(c1)) < Math.abs(fn(c2))) { hi = c2; c2 = c1; c1 = hi - g * (hi - lo); } else { lo = c1; c1 = c2; c2 = lo + g * (hi - lo); }
    }
    return (lo + hi) / 2;
  };
  for (let i = 0; i < n; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) { raices.push(xs[i]); continue; }
    if (y0 * y1 < 0) {
      const r = biseccion(xs[i], xs[i + 1]);
      if (Math.abs(fn(r)) < 1e-7) raices.push(r);
    } else if (i > 0 && Math.abs(y0) <= Math.abs(ys[i - 1]) && Math.abs(y0) <= Math.abs(y1) && Math.abs(y0) < 1e-2) {
      const r = dorada(xs[i - 1], xs[i + 1]);
      if (Math.abs(fn(r)) < 1e-10) raices.push(r);
    }
  }
  raices.sort((u, w) => u - w);
  const unicas = raices.filter((r, i) => i === 0 || Math.abs(r - raices[i - 1]) > 1e-6 * Math.max(1, Math.abs(r)));
  // Si es un entero o una fracción chica, lo da exacto.
  return unicas.filter((r) => r >= a && r < b).map((r) => {
    for (let q = 1; q <= 12; q++) {
      const pq = Math.round(r * q);
      if (Math.abs(r * q - pq) < 1e-7 * Math.max(1, Math.abs(r * q)) && Math.abs(fn(pq / q)) <= Math.abs(fn(r)) + 1e-12) {
        const g = mcdNum(Math.abs(pq), q);
        const num = pq / g, den = q / g;
        return { x: pq / q, tex: den === 1 ? String(num) : `${num < 0 ? '-' : ''}\\frac{${Math.abs(num)}}{${den}}`, exacta: true };
      }
    }
    return { x: r, tex: texDecimal({ re: r, im: 0 }), exacta: false };
  });
}

const mcdNum = (a, b) => (b ? mcdNum(b, a % b) : a);

// Sistemas lineales: si CE no da una solución única, se distingue incompatible de indeterminado (2×2).
function resolverSistema(c, expr, res) {
  const ecuaciones = expr.ops;
  const vars = [...(expr.unknowns ?? [])].sort();
  res.tipo = 'sistema';
  let sol = null;
  try { sol = expr.solve(vars); } catch { sol = null; }
  if (sol && !Array.isArray(sol) && typeof sol === 'object' && Object.keys(sol).length) {
    const partes = vars.map((v) => {
      const val = sol[v];
      const tex = val?.latex !== undefined ? prolijo(val.latex) : String(val);
      return `${v}=${tex}`;
    });
    res.principal = partes.join(',\\quad ');
    partes.forEach((t) => res.formas.push({ etiqueta: 'Solución', tex: t }));
    return res;
  }
  if (ecuaciones.length === 2 && vars.length === 2) {
    const fs = ecuaciones.map((e) => c.box(['Subtract', e.op1.json, e.op2.json]));
    const en = (f, x, y) => f.subs({ [vars[0]]: c.number(x), [vars[1]]: c.number(y) }).N().re;
    const coef = fs.map((f) => { const k = en(f, 0, 0); return [en(f, 1, 0) - k, en(f, 0, 1) - k, k]; });
    const lineal = fs.every((f, i) => Math.abs(en(f, 2, 3) - (2 * coef[i][0] + 3 * coef[i][1] + coef[i][2])) < 1e-9);
    if (lineal) {
      const [[a1, b1, c1], [a2, b2, c2]] = coef;
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-12) {
        const compatible = Math.abs(a1 * c2 - a2 * c1) < 1e-12 && Math.abs(b1 * c2 - b2 * c1) < 1e-12;
        res.principal = compatible ? '\\text{Infinitas soluciones}' : 'S=\\varnothing';
        res.formas.push({ etiqueta: 'Solución', tex: res.principal, texto: compatible
          ? 'Las dos ecuaciones son la misma recta (una es múltiplo de la otra): sistema compatible indeterminado.'
          : 'Las rectas son paralelas: sistema incompatible, no tiene solución.' });
        return res;
      }
    }
  }
  return { tipo: 'error', mensaje: 'No pude resolver este sistema.' };
}

function elegirIncognita(unknowns) {
  if (unknowns.includes('x')) return 'x';
  for (const v of ['y', 't', 'n', 'z', 'a']) if (unknowns.includes(v)) return v;
  return unknowns[0];
}

function raicesReales(c, f, v) {
  const sols = c.box(['Equal', f.json, 0]).solve(v) ?? [];
  const reales = [];
  for (const s of sols) {
    const d = decimal(s);
    if (d && Math.abs(d.im) < 1e-12 && Number.isFinite(d.re)) reales.push({ expr: s, x: d.re });
  }
  reales.sort((a, b) => a.x - b.x);
  return reales.filter((r, i) => i === 0 || Math.abs(r.x - reales[i - 1].x) > 1e-12);
}

function valorEn(c, f, v, x) {
  const r = f.subs({ [v]: c.number(x) }).N();
  return r.re;
}

// Inecuaciones: raíces de f = lado izq − lado der y signo de f entre ellas.
function resolverInecuacion(c, expr, v) {
  const op = expr.operator;
  const f = c.box(['Subtract', expr.op1.json, expr.op2.json]).simplify();
  const raices = raicesReales(c, f, v);
  const cumple = (y) => (op === 'Less' ? y < 0 : op === 'LessEqual' ? y <= 0 : op === 'Greater' ? y > 0 : y >= 0);
  const cerrado = op === 'LessEqual' || op === 'GreaterEqual';
  const cortes = [-Infinity, ...raices.map((r) => r.x), Infinity];
  const tramos = [];
  for (let i = 0; i < cortes.length - 1; i++) {
    const a = cortes[i], b = cortes[i + 1];
    const medio = a === -Infinity ? (b === Infinity ? 0 : b - 1 - Math.abs(b)) : b === Infinity ? a + 1 + Math.abs(a) : (a + b) / 2;
    const y = valorEn(c, f, v, medio);
    if (!Number.isFinite(y)) return null;
    tramos.push(cumple(y));
  }
  const texDe = (i) => (i === 0 ? '-\\infty' : i === cortes.length - 1 ? '\\infty' : prolijo(raices[i - 1].expr.latex));
  const intervalos = [];
  let i = 0;
  while (i < tramos.length) {
    if (!tramos[i]) { i++; continue; }
    let j = i;
    while (j + 1 < tramos.length && tramos[j + 1] && cerrado) j++;
    const izq = i === 0 ? '(' : cerrado ? '[' : '(';
    const der = j + 1 === cortes.length - 1 ? ')' : cerrado ? ']' : ')';
    intervalos.push(`\\left${izq}${texDe(i)},\\,${texDe(j + 1)}\\right${der}`);
    i = j + 1;
  }
  if (cerrado) {
    raices.forEach((r, k) => {
      if (!tramos[k] && !tramos[k + 1]) intervalos.push(`\\left\\{${r.expr.latex}\\right\\}`);
    });
  }
  if (!intervalos.length) return { tex: '\\varnothing', texto: 'No tiene solución.' };
  if (intervalos.length === 1 && intervalos[0].startsWith('\\left(-\\infty') && intervalos[0].endsWith('\\infty\\right)')) {
    return { tex: `${v}\\in\\mathbb{R}`, texto: 'Se cumple para todos los reales.' };
  }
  return { tex: `${v}\\in ${intervalos.join('\\cup ')}`, texto: null };
}

export function resolver(latexOriginal, { angulo = 'deg', conPasos = false, generarPasos = null } = {}) {
  const c = motor();
  c.angularUnit = angulo;
  const escrito = normalizar(latexOriginal);
  if (!escrito) return { tipo: 'vacio' };
  if (incompleto(escrito)) return { tipo: 'incompleto' };

  // Z, t, χ², F y Φ se reemplazan por su valor antes de que los vea Compute Engine.
  const tablas = reemplazarDistribuciones(escrito, (arg) => {
    const e = c.parse(arg);
    if (!e.isValid || (e.unknowns ?? []).length) return NaN;
    const n = e.N();
    return Math.abs(n.im ?? 0) > 0 ? NaN : n.re;
  });
  if (tablas.error) return { tipo: 'error', mensaje: tablas.error };
  const latex = tablas.latex;

  const expr = c.parse(latex);
  if (!expr.isValid) return { tipo: 'error', mensaje: 'La expresión está incompleta o tiene un error de escritura.' };

  const res = { tipo: 'numero', entrada: escrito, formas: [], avisos: [], tablas: tablas.usados };
  if (angulo === 'deg' && /\\pi/.test(latex) && /\\(sin|cos|tan|cot|sec|csc)/.test(latex)) {
    res.avisos.push('Estás en grados (DEG) y el ángulo tiene π: si era en radianes, cambiá a RAD.');
  }
  const unknowns = expr.unknowns ?? [];

  if (expr.operator === 'List' && expr.ops?.length > 1 && expr.ops.every((e) => e.operator === 'Equal')) {
    const r = resolverSistema(c, expr, res);
    if (r.tipo === 'error') return r;
  } else if (expr.operator in RELACIONES) {
    if (!unknowns.length) {
      const v = expr.evaluate();
      res.tipo = 'logico';
      res.principal = v.symbol === 'True' ? '\\text{Verdadero}' : v.symbol === 'False' ? '\\text{Falso}' : v.latex;
      res.formas.push({ etiqueta: 'Resultado', tex: res.principal });
    } else if (expr.operator === 'Equal') {
      const v = elegirIncognita(unknowns);
      res.tipo = 'ecuacion';
      res.incognita = v;
      if (unknowns.length > 1) res.avisos.push(`Hay más de una letra: despejo ${v}.`);
      const trigo = /"(Sin|Cos|Tan|Cot|Sec|Csc)"/.test(JSON.stringify(expr.json));
      const f = c.box(['Subtract', expr.op1.json, expr.op2.json]);
      const conNombre = (i, n) => `${v}${n > 1 ? `_{${i + 1}}` : ''}`;
      const ponerNumericas = (raices, grados, aviso) => {
        res.soluciones = raices.map((r) => ({ tex: r.exacta ? r.tex + grados : `${r.tex}${grados}`, aprox: null, valor: { re: r.x, im: 0 } }));
        res.principal = raices.map((r, i) => `${conNombre(i, raices.length)}${r.exacta ? '=' : '\\approx '}${r.tex}${grados}`).join(',\\quad ');
        raices.forEach((r, i) => res.formas.push({ etiqueta: raices.length > 1 ? `Solución ${i + 1}` : 'Solución', tex: `${conNombre(i, raices.length)}${r.exacta ? '=' : '\\approx '}${r.tex}${grados}` }));
        res.avisos.push(aviso);
      };
      // En grados, CE da una sola solución de sen x = 1/2: se buscan todas en una vuelta.
      const enVuelta = trigo && angulo === 'deg' && unknowns.length === 1 ? raicesNumericas(f, v, 0, 360, 7200) : null;
      if (enVuelta && enVuelta.length) {
        ponerNumericas(enVuelta, '^{\\circ}', 'Ecuación trigonométrica: son las soluciones entre 0° y 360°. Se repiten cada 360° (cada 180° si es con tangente): sumá 360°·k.');
      } else {
        const sols = [...(expr.solve(v) ?? [])].map((s) => ({ s, d: decimal(s) }))
          .sort((u, w) => (u.d && w.d ? (Math.abs(u.d.im) - Math.abs(w.d.im)) || (u.d.re - w.d.re) || (w.d.im - u.d.im) : 0))
          .map((u) => u.s);
        res.soluciones = sols.map((s) => texSolucion(s, trigo && angulo === 'deg'));
        if (sols.length) {
          res.principal = res.soluciones.map((s, i) => `${conNombre(i, sols.length)}${s.rel ?? '='}${s.tex}`).join(',\\quad ');
          res.soluciones.forEach((s, i) => {
            res.formas.push({ etiqueta: sols.length > 1 ? `Solución ${i + 1}` : 'Solución', tex: `${conNombre(i, sols.length)}${s.rel ?? '='}${s.tex}`, aprox: s.aprox });
          });
          if (trigo) res.avisos.push('Ecuación trigonométrica: son las soluciones principales; se repiten cada período (2π, o π con tangente).');
        } else if (f.simplify().is(0)) {
          res.principal = `${v}\\in\\mathbb{R}`;
          res.formas.push({ etiqueta: 'Solución', tex: res.principal, texto: 'Es una identidad: vale para cualquier valor.' });
        } else {
          const numericas = unknowns.length === 1 ? raicesNumericas(f, v, -100, 100, 20000) : null;
          if (numericas && numericas.length) {
            ponerNumericas(numericas, '', 'No encontré la solución exacta: son aproximaciones numéricas buscadas entre −100 y 100.');
          } else {
            res.principal = '\\text{Sin solución}';
            res.formas.push({ etiqueta: 'Solución', tex: '\\varnothing', texto: unknowns.length === 1 ? 'No tiene soluciones reales (busqué también numéricamente entre −100 y 100).' : 'No encontré soluciones.' });
          }
        }
      }
    } else {
      const v = elegirIncognita(unknowns);
      res.tipo = 'inecuacion';
      const r = unknowns.length === 1 ? resolverInecuacion(c, expr, v) : null;
      if (!r) return { tipo: 'error', mensaje: 'No sé resolver esta inecuación.' };
      res.principal = r.tex;
      res.formas.push({ etiqueta: 'Solución', tex: r.tex, texto: r.texto });
    }
  } else if (unknowns.length || (expr.evaluate().unknowns ?? []).length) {
    res.tipo = 'expresion';
    const evaluada = expr.evaluate();
    const simple = evaluada.simplify();
    const vistos = new Set([expr.latex]);
    const agregar = (etiqueta, e) => {
      const t = prolijo(e.latex);
      if (!vistos.has(t)) { vistos.add(t); res.formas.push({ etiqueta, tex: t }); }
    };
    const integral = expr.operator === 'Integrate';
    agregar(integral ? 'Primitiva' : expr.operator === 'D' ? 'Derivada' : 'Simplificada', simple);
    try { agregar('Desarrollada', c.box(['Expand', simple.json]).evaluate()); } catch { /* sin forma desarrollada */ }
    try { agregar('Factorizada', c.box(['Factor', simple.json]).evaluate()); } catch { /* sin forma factorizada */ }
    if (integral && res.formas.length) res.formas[0].tex += '+C';
    res.principal = res.formas[0]?.tex ?? null;
    if (!res.formas.length) res.formas.push({ etiqueta: 'Expresión', tex: expr.latex });
  } else {
    const exacto = expr.evaluate();
    Object.assign(res, formasNumero(exacto, expr.latex));
    if (res.aviso) { res.tipo = 'error'; res.mensaje = res.aviso; }
  }

  if (conPasos && generarPasos && !tablas.usados.length) {
    try {
      res.pasos = generarPasos(latex, { ce: c, angulo });
    } catch (e) {
      res.pasos = null;
    }
  }
  return res;
}
