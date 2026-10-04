// Compara js/dist contra tests/dist/referencia.json (scipy) y chequea identidades.
// Uso: node tests/dist/validar.mjs   (sale con código 1 si algo no cumple)

import fs from 'node:fs';
import { DISTRIBUCIONES, LISTA } from '../../js/dist/distribuciones.js';
import * as E from '../../js/dist/especiales.js';

const inicio = performance.now();
const REF = JSON.parse(fs.readFileSync(new URL('./referencia.json', import.meta.url), 'utf8'));

const TOL = 1e-9; // general
const TOL_CATEDRA = 1e-10; // casos "ordinarios" de la cátedra, q ∈ [1e-6, 1 − 1e-6]
const PISO = 1e-300; // debajo de esto se compara en absoluto
const TOL_ESPECIALES = 1e-10;
const TOL_ALTA = 1e-12; // contra el árbitro decimal de 60 dígitos

// Excepciones explícitas: [dist, función, predicado(params, arg), tolerancia, motivo]
const EXCEPCIONES = [];

// Convenciones en las que se difiere de scipy a propósito: [dist, función, predicado, valor esperado, motivo]
const CONVENCIONES = [
  ['t', 'media', (p) => p.nu <= 1, NaN, 'la media de t con ν ≤ 1 no existe (scipy devuelve inf)'],
];

const num = (v) => (typeof v === 'string' ? { inf: Infinity, '-inf': -Infinity, nan: NaN }[v] : v);

// escala para la tolerancia absoluta de cuantiles cerca de 0 (distribuciones en toda la recta)
function escala(dist, p) {
  if (dist === 'normal') return p.sigma;
  if (dist === 't') return 1;
  if (dist === 'uniforme') return p.b - p.a;
  return 0;
}

const filas = new Map(); // clave "dist función" -> { peor, caso, n, fallas }
const fallas = [];

function registrar(dist, fn, err, ok, detalle) {
  const k = `${dist}\t${fn}`;
  let f = filas.get(k);
  if (!f) {
    f = { dist, fn, peor: 0, caso: '', n: 0, fallas: 0 };
    filas.set(k, f);
  }
  f.n++;
  if (Number.isNaN(err) || err > f.peor) {
    if (!(f.peor !== f.peor)) {
      f.peor = err;
      f.caso = detalle;
    }
  }
  if (!ok) {
    f.fallas++;
    fallas.push(`${dist} ${fn}: ${detalle}`);
  }
}

function seguro(fn) {
  try {
    return fn();
  } catch (e) {
    return { excepcion: String(e && e.stack ? e.stack.split('\n')[0] : e) };
  }
}

function excepcion(dist, fn, p, arg) {
  for (const [d, f, pred, tol, motivo] of EXCEPCIONES) {
    if (d === dist && f === fn && pred(p, arg)) return { tol, motivo };
  }
  return null;
}

// error relativo (absoluto si la referencia es diminuta) y si cumple
function compararValor(obt, esp, tol) {
  if (typeof obt === 'object') return [Infinity, false];
  if (Number.isNaN(esp)) return Number.isNaN(obt) ? [0, true] : [Infinity, false];
  if (obt === esp) return [0, true];
  if (!Number.isFinite(esp) || !Number.isFinite(obt)) return [Infinity, false];
  const d = Math.abs(obt - esp);
  if (Math.abs(esp) < PISO) return [d <= PISO ? 0 : d / PISO, d <= PISO];
  const e = d / Math.abs(esp);
  return [e, e <= tol];
}

const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toPrecision(6)) : String(v));
const fmtP = (p) => Object.entries(p).map(([k, v]) => `${k}=${fmt(v)}`).join(',');

// ---------------------------------------------------------------------------
// 1. Comparación contra scipy

for (const c of REF.casos) {
  const D = DISTRIBUCIONES[c.dist];
  const p = c.params;
  if (!D) {
    fallas.push(`falta la distribución ${c.dist}`);
    continue;
  }
  const xs = c.x.map(num);
  const cdfs = c.cdf.map(num);
  const sfs = c.sf.map(num);
  for (const fn of ['pdf', 'cdf', 'sf']) {
    const esp = c[fn].map(num);
    xs.forEach((x, i) => {
      const central = Math.min(cdfs[i], sfs[i]) >= 1e-6;
      let tol = c.ordinario && central ? TOL_CATEDRA : TOL;
      const exc = excepcion(c.dist, fn, p, x);
      if (exc) tol = exc.tol;
      const obt = seguro(() => D[fn](x, p));
      const [e, ok] = compararValor(obt, esp[i], tol);
      registrar(c.dist, fn, e, ok, `${fmtP(p)} x=${fmt(x)} obt=${fmt(obt)} ref=${fmt(esp[i])}`);
    });
  }
  const sc = escala(c.dist, p);
  for (const fn of ['ppf', 'isf']) {
    const esp = c[fn].map(num);
    c.q.forEach((q, i) => {
      if (esp[i] === null) return; // scipy no dio un valor confiable (ver generador)
      const obt = seguro(() => D[fn](q, p));
      let e;
      let ok;
      if (D.discreta) {
        ok = obt === esp[i];
        e = ok ? 0 : Infinity;
      } else {
        let tol = c.ordinario && q >= 1e-6 && q <= 1 - 1e-6 ? TOL_CATEDRA : TOL;
        const exc = excepcion(c.dist, fn, p, q);
        if (exc) tol = exc.tol;
        [e, ok] = compararValor(obt, esp[i], tol);
        if (!ok && Number.isFinite(obt) && Math.abs(obt - esp[i]) <= 1e-12 * sc) {
          ok = true;
          e = Math.abs(obt - esp[i]) / Math.max(Math.abs(esp[i]), sc);
        }
      }
      registrar(c.dist, fn, e, ok, `${fmtP(p)} q=${fmt(q)} obt=${fmt(obt)} ref=${fmt(esp[i])}`);
    });
  }
  for (const fn of ['media', 'varianza']) {
    const conv = CONVENCIONES.find(([d, f, pred]) => d === c.dist && f === fn && pred(p));
    const esp = conv ? conv[3] : num(c[fn]);
    const obt = seguro(() => D[fn](p));
    const [e, ok] = compararValor(obt, esp, 1e-12);
    registrar(c.dist, fn, e, ok, `${fmtP(p)} obt=${fmt(obt)} ref=${fmt(esp)}`);
  }

  // 2. cdf + sf = 1 y vuelta ppf(cdf(x)) = x
  xs.forEach((x) => {
    const F = D.cdf(x, p);
    const S = D.sf(x, p);
    const e = Math.abs(F + S - 1);
    registrar(c.dist, 'cdf+sf=1', e, e <= 1e-13, `${fmtP(p)} x=${fmt(x)} cdf=${fmt(F)} sf=${fmt(S)}`);
    const [lo, hi] = D.soporte(p);
    if (D.discreta) {
      if (!Number.isInteger(x) || x < lo || x >= hi) return;
      const masa = D.pdf(x, p);
      const usarCdf = F <= 0.5;
      const cola = usarCdf ? F : S;
      if (!(cola > 1e-290) || masa < 1e-11 * cola) return;
      const k = usarCdf ? D.ppf(F, p) : D.isf(S, p);
      registrar(c.dist, 'ida y vuelta', k === x ? 0 : Infinity, k === x,
        `${fmtP(p)} x=${x} ${usarCdf ? 'ppf(cdf)' : 'isf(sf)'}=${k}`);
    } else {
      if (x <= lo || x >= hi) return;
      const usarCdf = F <= 0.5;
      const cola = usarCdf ? F : S;
      if (!(cola > 1e-290)) return;
      const y = usarCdf ? D.ppf(F, p) : D.isf(S, p);
      const [e2, ok2] = compararValor(y, x, TOL);
      const okAbs = Math.abs(y - x) <= 1e-12 * sc;
      registrar(c.dist, 'ida y vuelta', okAbs ? 0 : e2, ok2 || okAbs,
        `${fmtP(p)} x=${fmt(x)} ${usarCdf ? 'ppf(cdf)' : 'isf(sf)'}=${fmt(y)}`);
    }
  });
}

// ---------------------------------------------------------------------------
// 2b. Árbitro de alta precisión (decimal, 60 dígitos): casos donde scipy no alcanza

{
  const AP = REF.alta_precision;
  for (const v of AP.valores) {
    const D = DISTRIBUCIONES[v.dist];
    const x = num(v.x);
    for (const fn of ['pdf', 'cdf', 'sf']) {
      const esp = num(v[fn]);
      const obt = seguro(() => D[fn](x, v.params));
      const [e, ok] = compararValor(obt, esp, TOL_ALTA);
      registrar(`${v.dist} (60 díg.)`, fn, e, ok, `${fmtP(v.params)} x=${fmt(x)} obt=${fmt(obt)} ref=${fmt(esp)}`);
    }
  }
  for (const v of AP.cuantiles) {
    const D = DISTRIBUCIONES[v.dist];
    const esp = num(v.valor);
    const obt = seguro(() => D[v.funcion](v.q, v.params));
    const [e, ok] = compararValor(obt, esp, TOL_ALTA);
    registrar('cuantil extremo', '(60 díg.)', e, ok, `${v.dist} ${fmtP(v.params)} ${v.funcion}(${v.q}) obt=${fmt(obt)} ref=${fmt(esp)}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Identidades

{
  const B = DISTRIBUCIONES.binomial;
  const P = DISTRIBUCIONES.pascal;
  for (const [r, pr] of [[1, 0.5], [3, 0.4], [10, 0.05], [50, 0.9], [200, 0.3], [7, 0.999]]) {
    for (const n of [r, r + 1, r + 2, r + 5, Math.round(r / pr), Math.round(2 * r / pr), Math.round(10 * r / pr) + 30]) {
      const a = P.cdf(n, { r, p: pr });
      const b = B.sf(r - 1, { n, p: pr });
      const [e, ok] = compararValor(a, b, TOL_CATEDRA);
      registrar('identidad', 'F_pascal(n)=P(Bin≥r)', e, ok, `r=${r} p=${pr} n=${n} ${fmt(a)} vs ${fmt(b)}`);
    }
  }
  const G = DISTRIBUCIONES.gamma;
  const Po = DISTRIBUCIONES.poisson;
  for (const r of [1, 2, 3, 5, 10, 40, 300]) {
    for (const lambda of [0.5, 1, 3]) {
      for (const f of [0.01, 0.3, 0.8, 1, 1.2, 2, 5]) {
        const x = (f * r) / lambda;
        const a = G.cdf(x, { r, lambda });
        const b = Po.sf(r - 1, { m: lambda * x });
        const [e, ok] = compararValor(a, b, TOL_CATEDRA);
        registrar('identidad', 'F_gamma(x)=P(Poi≥r)', e, ok, `r=${r} λ=${lambda} x=${fmt(x)} ${fmt(a)} vs ${fmt(b)}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Bordes: q ∈ {0, 1}, parámetros inválidos, rango

const INVALIDOS = {
  normal: [{ mu: 0, sigma: 0 }, { mu: 0, sigma: -1 }, { mu: NaN, sigma: 1 }, { sigma: 1 }],
  t: [{ nu: 0 }, { nu: -2 }, { nu: Infinity }],
  chi2: [{ nu: 0 }, {}, { nu: 2e10 }],
  f: [{ nu1: 0, nu2: 3 }, { nu1: 2, nu2: -1 }],
  binomial: [{ n: 0, p: 0.5 }, { n: 2.5, p: 0.5 }, { n: 10, p: 1.2 }, { n: 10, p: -0.1 }, { n: 2e15, p: 0.5 }],
  poisson: [{ m: 0 }, { m: -1 }, { m: 1e11 }],
  hipergeometrica: [{ N: 10, R: 11, n: 3 }, { N: 10, R: 3, n: 11 }, { N: 10, R: 3.5, n: 2 }, { N: 0, R: 0, n: 1 }],
  geometrica: [{ p: 0 }, { p: 1.5 }],
  pascal: [{ r: 0, p: 0.5 }, { r: 2, p: 0 }, { r: 1.5, p: 0.5 }],
  exponencial: [{ lambda: 0 }],
  uniforme: [{ a: 1, b: 1 }, { a: 2, b: 1 }],
  gamma: [{ r: 0, lambda: 1 }, { r: 1, lambda: 0 }],
  beta: [{ alfa: 0, beta: 1 }, { alfa: 1, beta: -1 }],
  weibull: [{ k: 0, lambda: 1 }, { k: 1, lambda: 0 }],
  lognormal: [{ mu: 0, sigma: 0 }],
};

for (const D of LISTA) {
  const pdef = Object.fromEntries(D.params.map((q) => [q.id, q.defecto]));
  const okDef = D.validar(pdef) === null;
  registrar('bordes', 'defectos válidos', okDef ? 0 : 1, okDef, `${D.id} ${D.validar(pdef)}`);
  for (const c of REF.casos.filter((c) => c.dist === D.id)) {
    const p = c.params;
    const [lo, hi] = D.soporte(p);
    const checks = [
      ['ppf(0)', D.ppf(0, p), lo], ['ppf(1)', D.ppf(1, p), hi],
      ['isf(0)', D.isf(0, p), hi], ['isf(1)', D.isf(1, p), lo],
      ['ppf(NaN)', D.ppf(NaN, p), NaN], ['ppf(1.5)', D.ppf(1.5, p), NaN],
      ['cdf(NaN)', D.cdf(NaN, p), NaN], ['cdf(-inf)', D.cdf(-Infinity, p), 0],
      ['sf(inf)', D.sf(Infinity, p), 0], ['pdf(inf)', D.pdf(Infinity, p), 0],
    ];
    for (const [nombre, obt, esp] of checks) {
      const ok = Object.is(obt, esp) || obt === esp || (Number.isNaN(esp) && Number.isNaN(obt));
      registrar('bordes', 'q∈{0,1}, NaN, ±inf', ok ? 0 : 1, ok, `${D.id} ${fmtP(p)} ${nombre}=${obt} (esperado ${esp})`);
    }
    // rango para graficar: discretas cubren ≥ 99,99 % y al menos 5 barras si el soporte da;
    // continuas no se pasan del 99,9 % central (salvo pegarse al borde del soporte) y sólo
    // las colas pesadas pueden quedar más cortas.
    const [a, b] = D.rango(p);
    let ok = Number.isFinite(a) && Number.isFinite(b) && a >= lo && b <= hi && a <= b;
    let masa = NaN;
    if (ok) {
      if (D.discreta) {
        masa = D.cdf(b, p) - D.cdf(a - 1, p);
        ok = masa >= 0.9999 - 1e-12 && (b - a >= 4 || b - a >= hi - lo);
      } else {
        masa = D.cdf(b, p) - D.cdf(a, p);
        const q1 = D.ppf(0.0005, p);
        const q2 = D.isf(0.0005, p);
        ok = a < b && masa >= 0.85 && (a === lo || a >= q1 - 1e-12 * Math.abs(q1)) &&
          (b === hi || b <= q2 + 1e-12 * Math.abs(q2));
        if (masa < 0.999 - 1e-9) ok = ok && D.isf(0.0005, p) - D.ppf(0.5, p) > 4 * (D.isf(0.01, p) - D.ppf(0.5, p));
      }
    }
    registrar('bordes', 'rango', ok ? 0 : 1, ok, `${D.id} ${fmtP(p)} rango=[${fmt(a)}, ${fmt(b)}] masa=${fmt(masa)}`);
  }
  for (const p of INVALIDOS[D.id] || []) {
    const r = seguro(() => [D.validar(p), D.pdf(1, p), D.cdf(1, p), D.sf(1, p), D.ppf(0.5, p), D.isf(0.5, p), D.media(p), D.varianza(p), ...D.rango(p), ...D.soporte(p)]);
    const ok = Array.isArray(r) && typeof r[0] === 'string' && r.slice(1).every(Number.isNaN);
    registrar('bordes', 'parámetros inválidos', ok ? 0 : 1, ok, `${D.id} ${JSON.stringify(p)} -> ${JSON.stringify(r)}`);
  }
}

// ---------------------------------------------------------------------------
// 4b. Fuzz determinístico: parámetros al azar (LCG con semilla fija) en rangos amplios

{
  let estado = 12345;
  const azar = () => {
    estado = (Math.imul(estado, 1103515245) + 12345) >>> 0;
    return (estado + 0.5) / 4294967296;
  };
  const unif = (a, b) => a + (b - a) * azar();
  const logu = (a, b) => Math.exp(unif(Math.log(a), Math.log(b)));
  const ent = (a, b) => Math.max(a, Math.min(b, Math.round(logu(a, b))));
  const GEN = {
    normal: () => ({ mu: unif(-1e3, 1e3), sigma: logu(1e-3, 1e3) }),
    t: () => ({ nu: logu(0.1, 1e7) }),
    chi2: () => ({ nu: logu(0.05, 1e6) }),
    f: () => ({ nu1: logu(0.1, 1e6), nu2: logu(0.1, 1e6) }),
    binomial: () => ({ n: ent(1, 1e7), p: azar() < 0.2 ? logu(1e-6, 1) : azar() }),
    poisson: () => ({ m: logu(1e-3, 1e7) }),
    hipergeometrica: () => {
      const N = ent(1, 1e6);
      return { N, R: Math.floor(azar() * (N + 1)), n: 1 + Math.floor(azar() * N) };
    },
    geometrica: () => ({ p: logu(1e-6, 1) }),
    pascal: () => ({ r: ent(1, 1e5), p: logu(1e-4, 1) }),
    exponencial: () => ({ lambda: logu(1e-3, 1e3) }),
    uniforme: () => {
      const a = unif(-100, 100);
      return { a, b: a + logu(1e-3, 1e3) };
    },
    gamma: () => ({ r: logu(0.01, 1e6), lambda: logu(1e-3, 1e3) }),
    beta: () => ({ alfa: logu(0.02, 1e6), beta: logu(0.02, 1e6) }),
    weibull: () => ({ k: logu(0.1, 50), lambda: logu(1e-2, 1e2) }),
    lognormal: () => ({ mu: unif(-5, 5), sigma: logu(0.01, 5) }),
  };
  const QF = [1e-200, 1e-30, 1e-9, 1e-4, 0.01, 0.05, 0.2, 0.37, 0.5, 0.63, 0.8, 0.95, 0.99, 0.9999, 1 - 1e-9];
  for (const D of LISTA) {
    for (let i = 0; i < 40; i++) {
      const p = GEN[D.id]();
      const det = `${D.id} ${fmtP(p)}`;
      const r = seguro(() => {
        const problemas = [];
        if (D.validar(p) !== null) problemas.push(`validar: ${D.validar(p)}`);
        const [lo, hi] = D.soporte(p);
        const ppf = QF.map((q) => D.ppf(q, p));
        const isf = QF.map((q) => D.isf(q, p));
        for (let j = 0; j < QF.length; j++) {
          if (!(ppf[j] >= lo && ppf[j] <= hi)) problemas.push(`ppf(${QF[j]})=${ppf[j]} fuera del soporte`);
          if (!(isf[j] >= lo && isf[j] <= hi)) problemas.push(`isf(${QF[j]})=${isf[j]} fuera del soporte`);
          if (j && !(ppf[j] >= ppf[j - 1])) problemas.push(`ppf no monótona en q=${QF[j]}`);
          if (j && !(isf[j] <= isf[j - 1])) problemas.push(`isf no monótona en q=${QF[j]}`);
          const q = QF[j];
          const x = ppf[j];
          if (D.discreta) {
            // definición: menor k con cdf(k) ≥ q
            const ok = D.cdf(x, p) >= q * (1 - 1e-12) - 1e-15 &&
              (x === lo || !(D.cdf(x - 1, p) >= q * (1 + 1e-9)));
            if (!ok) problemas.push(`ppf(${q})=${x} no cumple la definición (cdf=${D.cdf(x, p)}, cdf(k−1)=${D.cdf(x - 1, p)})`);
          } else if (Number.isFinite(x) && x > lo && x < hi && x !== 0 && Math.abs(x) > 1e-290) {
            const cola = q <= 0.5 ? D.cdf(x, p) : D.sf(x, p);
            const obj = q <= 0.5 ? q : 1 - q;
            const dens = D.pdf(x, p);
            // κ = |x·f(x)/cola|: cuánto mueve la cola un error relativo de x
            const kappa = Math.abs(x * dens / cola);
            const tolRT = 1e-9 + 1e-14 * kappa;
            if (cola > 1e-290 && Number.isFinite(kappa) && !(Math.abs(cola / obj - 1) <= tolRT)) {
              problemas.push(`ida y vuelta q=${q}: x=${x} cola=${cola}`);
            }
          }
        }
        const xs = [...ppf, ...isf].filter(Number.isFinite);
        for (const x of xs) {
          const F = D.cdf(x, p);
          const S = D.sf(x, p);
          const f = D.pdf(x, p);
          if (!(F >= 0 && F <= 1 && S >= 0 && S <= 1)) problemas.push(`cdf/sf fuera de [0,1] en x=${x}: ${F}, ${S}`);
          if (!(Math.abs(F + S - 1) <= 1e-13)) problemas.push(`cdf+sf≠1 en x=${x}: ${F}+${S}`);
          if (!(f >= 0)) problemas.push(`pdf inválida en x=${x}: ${f}`);
        }
        const [a, b] = D.rango(p);
        if (!(Number.isFinite(a) && Number.isFinite(b) && a <= b && a >= lo && b <= hi)) problemas.push(`rango=[${a}, ${b}]`);
        const m = D.media(p);
        const v = D.varianza(p);
        if (Number.isNaN(m) && D.id !== 't') problemas.push('media NaN');
        if (Number.isNaN(v) && D.id !== 't') problemas.push('varianza NaN');
        return problemas;
      });
      const ok = Array.isArray(r) && r.length === 0;
      registrar('fuzz', D.id, ok ? 0 : 1, ok, `${det}: ${Array.isArray(r) ? r.slice(0, 3).join('; ') : r.excepcion}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Funciones especiales (diagnóstico)

{
  const S = REF.especiales;
  const comp = (fn, obt, esp, tolAbs, detalle) => {
    let [e, ok] = compararValor(obt, esp, TOL_ESPECIALES);
    if (!ok && Math.abs(obt - esp) <= tolAbs) {
      ok = true;
      e = 0;
    }
    registrar('especiales', fn, e, ok, detalle);
  };
  for (const [x, r] of S.lgamma) comp('lgamma', E.lgamma(x), num(r), 1e-14, `x=${x} obt=${E.lgamma(x)} ref=${r}`);
  for (const [x, r] of S.erf) comp('erf', E.erf(x), num(r), 0, `x=${x}`);
  for (const [x, r] of S.erfc) comp('erfc', E.erfc(x), num(r), 0, `x=${x}`);
  for (const [z, r] of S.normCdf) comp('normCdf', E.normCdf(z), num(r), 0, `z=${z} obt=${E.normCdf(z)} ref=${r}`);
  for (const [z, r] of S.normCdf) comp('normSf', E.normSf(-z), num(r), 0, `z=${-z}`);
  for (const [p, r] of S.normPpf) comp('normPpf', E.normPpf(p), num(r), 0, `p=${p} obt=${E.normPpf(p)} ref=${r}`);
  for (const [a, x, P, Q] of S.gammaInc) {
    comp('gammaP', E.gammaP(a, x), num(P), 0, `a=${a} x=${x} obt=${E.gammaP(a, x)} ref=${P}`);
    comp('gammaQ', E.gammaQ(a, x), num(Q), 0, `a=${a} x=${x} obt=${E.gammaQ(a, x)} ref=${Q}`);
  }
  for (const [a, b, x, I, Ic] of S.betaInc) {
    comp('betaInc', E.betaInc(x, a, b), num(I), 0, `a=${a} b=${b} x=${x} obt=${E.betaInc(x, a, b)} ref=${I}`);
    comp('betaIncC', E.betaIncC(x, a, b), num(Ic), 0, `a=${a} b=${b} x=${x} obt=${E.betaIncC(x, a, b)} ref=${Ic}`);
  }
  for (const [a, b, r] of S.lbeta) comp('lbeta', E.lbeta(a, b), num(r), 1e-14, `a=${a} b=${b} obt=${E.lbeta(a, b)} ref=${r}`);
}

// ---------------------------------------------------------------------------
// Informe

const ancho = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
console.log(`Referencia: scipy ${REF.scipy}, ${REF.casos.length} casos\n`);
console.log(ancho('distribución', 26) + ancho('función', 22) + ancho('n', 6) + ancho('peor err', 11) + 'caso');
let total = 0;
for (const f of filas.values()) {
  total += f.n;
  const peor = f.peor === 0 ? '0' : f.peor.toExponential(2);
  const marca = f.fallas ? ` <-- ${f.fallas} FALLA(S)` : '';
  console.log(ancho(f.dist, 26) + ancho(f.fn, 22) + ancho(String(f.n), 6) + ancho(peor, 11) + (f.peor ? f.caso : '') + marca);
}
if (EXCEPCIONES.length) {
  console.log('\nExcepciones de tolerancia:');
  for (const [d, fn, , tol, motivo] of EXCEPCIONES) console.log(`  ${d} ${fn}: tol ${tol} — ${motivo}`);
}
const seg = ((performance.now() - inicio) / 1000).toFixed(2);
console.log(`\n${total} comparaciones en ${seg} s`);
if (fallas.length) {
  console.log(`\n${fallas.length} FALLAS:`);
  for (const f of fallas.slice(0, 400)) console.log('  ' + f);
  if (fallas.length > 60) console.log(`  … y ${fallas.length - 60} más`);
  process.exit(1);
}
console.log('OK: todo dentro de tolerancia.');
