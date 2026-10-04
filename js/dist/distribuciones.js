// Catálogo de distribuciones con las parametrizaciones de la cátedra.
// Cada función devuelve NaN ante parámetros o argumentos inválidos; nunca tira.

import {
  normAmbas, normPdf, normPpf, gammaFn, lbeta, stirlerr, bd0,
  ldbinomRaw, ldpoisRaw, dgammaUnit, dbetaUnit, lprefBeta, gammaInc, gammaIncInv,
  betaIncAmbos, betaIncInv, invertirPositiva, INV_SQRT_2PI,
} from './especiales.js';

const EPS = 2.220446049250313e-16;
// tolerancia relativa para decidir empates en cuantiles discretos
const TOL_DISCRETA = 1e-12;

// ---------------------------------------------------------------------------
// Validación de parámetros

const SUPERINDICES = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function formatear(v) {
  const e = Math.log10(v);
  if (v >= 1e6 && Number.isInteger(e)) return '10' + [...String(e)].map((c) => SUPERINDICES[c]).join('');
  return String(v).replace('.', ',');
}

function validarUno(d, v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return `Falta el valor de ${d.nombre}.`;
  if (!Number.isFinite(v)) return `${d.nombre} tiene que ser un número finito.`;
  if (d.entero && !Number.isInteger(v)) return `${d.nombre} tiene que ser un número entero.`;
  const okMin = d.minExclusivo ? v > d.min : v >= d.min;
  const okMax = v <= d.max;
  if (okMin && okMax) return null;
  const desde = d.minExclusivo ? `mayor que ${formatear(d.min)}` : `mayor o igual que ${formatear(d.min)}`;
  if (Number.isFinite(d.min) && Number.isFinite(d.max)) {
    if (!d.minExclusivo) return `${d.nombre} tiene que estar entre ${formatear(d.min)} y ${formatear(d.max)}.`;
    return `${d.nombre} tiene que ser ${desde} y menor o igual que ${formatear(d.max)}.`;
  }
  if (!okMin) return `${d.nombre} tiene que ser ${d.entero ? 'un entero ' : ''}${desde}.`;
  return `${d.nombre} tiene que ser menor o igual que ${formatear(d.max)}.`;
}

function param(id, nombre, descripcion, defecto, opciones = {}) {
  return {
    id, nombre, descripcion, defecto,
    entero: opciones.entero ?? false,
    min: opciones.min ?? -Infinity,
    minExclusivo: opciones.minExclusivo ?? false,
    max: opciones.max ?? Infinity,
  };
}

// ---------------------------------------------------------------------------
// Utilidades

// unos pocos ulps: absorbe ruido como 0.1·30 = 3.0000000000000004 sin saltar enteros
function tolEntero(x) {
  return Math.min(0.25, Math.max(1e-12, 16 * EPS * Math.abs(x)));
}

function esEnteroAprox(x) {
  return Math.abs(x - Math.round(x)) <= tolEntero(x);
}

function pisoAprox(x) {
  return Number.isFinite(x) ? Math.floor(x + tolEntero(x)) : x;
}

// Menor k en [lo, hi] con cond(k) verdadera, para cond monótona (falsa … verdadera).
function buscarMenor(cond, k0, lo, hi) {
  let k = Number.isFinite(k0) ? Math.round(k0) : lo;
  if (k < lo) k = lo;
  if (k > hi) k = hi;
  let a;
  let b;
  let paso = 1;
  if (cond(k)) {
    b = k;
    for (;;) {
      if (b <= lo) return lo;
      a = Math.max(b - paso, lo);
      if (!cond(a)) break;
      b = a;
      paso *= 2;
    }
  } else {
    a = k;
    for (let i = 0; ; i++) {
      if (a >= hi || i > 1100) return hi;
      b = Math.min(a + paso, hi);
      if (cond(b)) break;
      a = b;
      paso *= 2;
    }
  }
  while (b - a > 1) {
    const m = Math.floor(a / 2 + b / 2);
    if (m <= a || m >= b) break;
    if (cond(m)) b = m;
    else a = m;
  }
  return b;
}

// Envoltorio común: valida, maneja bordes y q ∈ {0, 1}.
function crear(def) {
  const params = def.params;
  const validar = (p) => {
    if (p === null || typeof p !== 'object') return 'Faltan los parámetros.';
    for (const d of params) {
      const e = validarUno(d, p[d.id]);
      if (e) return e;
    }
    return def.cruzada ? def.cruzada(p) : null;
  };
  const invalido = (p) => validar(p) !== null;
  const qInvalida = (q) => typeof q !== 'number' || !(q >= 0 && q <= 1);
  const comun = {
    id: def.id,
    nombre: def.nombre,
    discreta: def.discreta,
    params,
    validar,
    soporte(p) {
      return invalido(p) ? [NaN, NaN] : def.soporte(p);
    },
    media(p) {
      return invalido(p) ? NaN : def.media(p);
    },
    varianza(p) {
      return invalido(p) ? NaN : def.varianza(p);
    },
  };

  if (!def.discreta) {
    const obj = {
      ...comun,
      pdf(x, p) {
        if (typeof x !== 'number' || Number.isNaN(x) || invalido(p)) return NaN;
        const [lo, hi] = def.soporte(p);
        if (x < lo || x > hi || !Number.isFinite(x)) return 0;
        return def.pdf(x, p);
      },
      cdf(x, p) {
        if (typeof x !== 'number' || Number.isNaN(x) || invalido(p)) return NaN;
        const [lo, hi] = def.soporte(p);
        if (x <= lo) return 0;
        if (x >= hi) return 1;
        return def.ambas(x, p)[0];
      },
      sf(x, p) {
        if (typeof x !== 'number' || Number.isNaN(x) || invalido(p)) return NaN;
        const [lo, hi] = def.soporte(p);
        if (x <= lo) return 1;
        if (x >= hi) return 0;
        return def.ambas(x, p)[1];
      },
      // def.inv(q, superior, p) resuelve cdf = q (o sf = q) con q ≤ ½; 1 − q es exacto para q ≥ ½.
      ppf(q, p) {
        if (qInvalida(q) || invalido(p)) return NaN;
        const [lo, hi] = def.soporte(p);
        if (q === 0) return lo;
        if (q === 1) return hi;
        return q <= 0.5 ? def.inv(q, false, p) : def.inv(1 - q, true, p);
      },
      isf(q, p) {
        if (qInvalida(q) || invalido(p)) return NaN;
        const [lo, hi] = def.soporte(p);
        if (q === 0) return hi;
        if (q === 1) return lo;
        return q <= 0.5 ? def.inv(q, true, p) : def.inv(1 - q, false, p);
      },
      rango(p) {
        if (invalido(p)) return [NaN, NaN];
        const [s0, s1] = def.soporte(p);
        let lo = obj.ppf(0.0005, p);
        let hi = obj.isf(0.0005, p);
        const med = obj.ppf(0.5, p);
        const q1 = obj.ppf(0.25, p);
        const q3 = obj.isf(0.25, p);
        const iqr = q3 - q1;
        // cola pesada (t con ν chico, F, lognormal con σ grande): el cuantil 0,9995 queda
        // mucho más lejos que el 0,99 y se recorta a la mediana ± 10 IQR
        if (iqr > 0 && Number.isFinite(iqr)) {
          if (hi - med > 4 * (obj.isf(0.01, p) - med)) hi = Math.min(hi, med + 10 * iqr);
          if (med - lo > 4 * (med - obj.ppf(0.01, p))) lo = Math.max(lo, med - 10 * iqr);
        }
        // casos absurdos (t con ν ≈ 0) con cuantiles infinitos: algo finito igual
        if (!Number.isFinite(lo)) lo = Number.isFinite(s0) ? s0 : Number.isFinite(q1) ? q1 : -1;
        if (!Number.isFinite(hi)) hi = Number.isFinite(s1) ? s1 : Number.isFinite(q3) ? q3 : 1;
        const ancho = hi - lo;
        if (Number.isFinite(s0) && lo - s0 < 0.05 * ancho) lo = s0;
        if (Number.isFinite(s1) && s1 - hi < 0.05 * ancho) hi = s1;
        if (!(hi > lo)) hi = Number.isFinite(s1) ? s1 : lo + Math.max(Math.abs(lo), 1e-300);
        return [lo, hi];
      },
    };
    return obj;
  }

  // cdf y sf en enteros, sin volver a validar
  const ambasK = (k, p, lo, hi) => (k < lo ? [0, 1] : k >= hi ? [1, 0] : def.ambas(k, p));
  const obj = {
    ...comun,
    pdf(x, p) {
      if (typeof x !== 'number' || Number.isNaN(x) || invalido(p)) return NaN;
      if (!Number.isFinite(x) || !esEnteroAprox(x)) return 0;
      const k = Math.round(x);
      const [lo, hi] = def.soporte(p);
      if (k < lo || k > hi) return 0;
      return def.pmf(k, p);
    },
    cdf(x, p) {
      if (typeof x !== 'number' || Number.isNaN(x) || invalido(p)) return NaN;
      return ambasK(pisoAprox(x), p, ...def.soporte(p))[0];
    },
    sf(x, p) {
      if (typeof x !== 'number' || Number.isNaN(x) || invalido(p)) return NaN;
      return ambasK(pisoAprox(x), p, ...def.soporte(p))[1];
    },
    // menor k con cdf(k) ≥ q
    ppf(q, p) {
      if (qInvalida(q) || invalido(p)) return NaN;
      const [lo, hi] = def.soporte(p);
      if (q === 0) return lo;
      if (q === 1) return hi;
      const cond = q <= 0.5
        ? (k) => ambasK(k, p, lo, hi)[0] >= q * (1 - TOL_DISCRETA)
        : (k) => ambasK(k, p, lo, hi)[1] <= (1 - q) * (1 + TOL_DISCRETA);
      return buscarMenor(cond, def.semilla(q, p), lo, hi);
    },
    // menor k con sf(k) ≤ q
    isf(q, p) {
      if (qInvalida(q) || invalido(p)) return NaN;
      const [lo, hi] = def.soporte(p);
      if (q === 0) return hi;
      if (q === 1) return lo;
      const cond = q <= 0.5
        ? (k) => ambasK(k, p, lo, hi)[1] <= q * (1 + TOL_DISCRETA)
        : (k) => ambasK(k, p, lo, hi)[0] >= (1 - q) * (1 - TOL_DISCRETA);
      return buscarMenor(cond, def.semilla(1 - q, p), lo, hi);
    },
    rango(p) {
      if (invalido(p)) return [NaN, NaN];
      const [s0, s1] = def.soporte(p);
      let lo = obj.ppf(0.00005, p);
      let hi = obj.isf(0.00005, p);
      while (hi - lo < 4 && (lo > s0 || hi < s1)) {
        if (hi < s1) hi++;
        if (hi - lo < 4 && lo > s0) lo--;
      }
      return [lo, hi];
    },
  };
  return obj;
}

// semilla normal con corrección de asimetría (Cornish-Fisher)
function semillaCF(q, media, desvio, asimetria) {
  const z = normPpf(q);
  return media + desvio * (z + asimetria * (z * z - 1) / 6);
}

// ---------------------------------------------------------------------------
// t de Student

// I_x(a,b) ≈ x^a / (a·B(a,b)) para x < 1e-250, con lx = log x (x puede no ser representable)
function betaIncDiminuta(lx, a, b) {
  return Math.exp(a * lx - Math.log(a) - lbeta(a, b));
}

function tAmbas(t, nu) {
  if (t === 0) return [0.5, 0.5];
  const t2 = t * t;
  let cola;
  let resto;
  if (t2 === Infinity || nu / t2 < 1e-250) {
    cola = 0.5 * betaIncDiminuta(Math.log(nu) - 2 * Math.log(Math.abs(t)), nu / 2, 0.5);
    resto = 1 - cola;
  } else {
    const den = nu + t2;
    const [I, Ic] = betaIncAmbos(nu / den, nu / 2, 0.5, t2 / den);
    cola = 0.5 * I;
    resto = 0.5 + 0.5 * Ic;
  }
  return t > 0 ? [resto, cola] : [cola, resto];
}

// P(|T| < s)
function tCentral(s, nu) {
  const t2 = s * s;
  if (t2 === Infinity || nu / t2 < 1e-250) return 1 - 2 * tAmbas(s, nu)[1];
  const den = nu + t2;
  return betaIncAmbos(nu / den, nu / 2, 0.5, t2 / den)[1];
}

// densidad t (dt de R, sin restar log-gammas grandes)
function tPdf(x, n) {
  const t = -bd0(n / 2, (n + 1) / 2) + stirlerr((n + 1) / 2) - stirlerr(n / 2);
  const x2n = x * x / n;
  let lx2n;
  let u;
  const grande = x2n > 1 / EPS;
  const ax = Math.abs(x);
  if (grande) {
    lx2n = Math.log(ax) - Math.log(n) / 2;
    u = n * lx2n;
  } else if (x2n > 0.2) {
    lx2n = Math.log(1 + x2n) / 2;
    u = n * lx2n;
  } else {
    lx2n = Math.log1p(x2n) / 2;
    u = -bd0(n / 2, (n + x * x) / 2) + x * x / 2;
  }
  const factor = grande ? Math.sqrt(n) / ax : Math.exp(-lx2n);
  return Math.exp(t - u) * INV_SQRT_2PI * factor;
}

function tInv(q, superior, nu) {
  if (q === 0.5) return 0;
  const z = -normPpf(q);
  let s0 = z + (z * z * z + z) / (4 * nu) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * nu * nu);
  // P(T > s) ≤ K s^−ν / ν: esta cota da una semilla por encima de la raíz
  const st = Math.exp(((nu / 2) * Math.log(nu) - lbeta(nu / 2, 0.5) - Math.log(nu * q)) / nu);
  if (!(s0 > 0) || st < s0) s0 = st;
  let s;
  if (q >= 0.25) {
    s = invertirPositiva((v) => tCentral(v, nu), (v) => 2 * tPdf(v, nu), 1 - 2 * q, s0, true);
  } else {
    s = invertirPositiva((v) => tAmbas(v, nu)[1], (v) => tPdf(v, nu), q, s0, false);
  }
  return superior ? s : -s;
}

// ---------------------------------------------------------------------------
// F de Fisher-Snedecor

function fXY(f, n1, n2) {
  const a = n1 * f;
  if (a === Infinity) return [1, 0];
  const den = a + n2;
  return [a / den, n2 / den];
}

function fAmbas(f, n1, n2) {
  const [x, y] = fXY(f, n1, n2);
  if (y < 1e-250) {
    const a = n1 * f;
    const ly = Math.log(n2) - (a === Infinity ? Math.log(n1) + Math.log(f) : Math.log(a + n2));
    const s = betaIncDiminuta(ly, n2 / 2, n1 / 2);
    return [1 - s, s];
  }
  if (x < 1e-250) {
    const c = betaIncDiminuta(Math.log(n1) + Math.log(f) - Math.log(n1 * f + n2), n1 / 2, n2 / 2);
    return [c, 1 - c];
  }
  return betaIncAmbos(x, n1 / 2, n2 / 2, y);
}

function fPdf(f, n1, n2) {
  if (f === 0) return n1 < 2 ? Infinity : n1 > 2 ? 0 : 1;
  const [x, y] = fXY(f, n1, n2);
  if (y === 0) return 0;
  return Math.exp(lprefBeta(x, y, n1 / 2, n2 / 2)) / f;
}

function semillaF(q, superior, n1, n2) {
  const z = superior ? -normPpf(q) : normPpf(q);
  // Wilson-Hilferty aplicado a cada χ²
  const a = 2 / (9 * n1);
  const b = 2 / (9 * n2);
  const num = (1 - b) * (1 - a) + z * Math.sqrt((1 - a) ** 2 * b + (1 - b) ** 2 * a - a * b * z * z);
  const den = (1 - b) ** 2 - b * z * z;
  if (den > 0 && num > 0) {
    const r = num / den;
    return r * r * r;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Hipergeométrica (dhyper / phyper de R)

function hiperPmf(x, N, R, n) {
  const B = N - R;
  if (n === 0) return x === 0 ? 1 : 0;
  const p = n / N;
  const q = (N - n) / N;
  const l = ldbinomRaw(x, R, p, q) + ldbinomRaw(n - x, B, p, q) - ldbinomRaw(n, N, p, q);
  return Math.exp(l);
}

// [P(X ≤ x), P(X > x)]
function hiperAmbas(x, N, R, n) {
  let NR = R;
  let NB = N - R;
  let inferior = true;
  if (x * (NR + NB) > n * NR) {
    const t = NB;
    NB = NR;
    NR = t;
    x = n - x - 1;
    inferior = false;
  }
  let chica;
  if (x < 0 || x < n - NB) chica = 0;
  else if (x >= NR || x >= n) chica = 1;
  else {
    const d = hiperPmf(x, NR + NB, NR, n);
    let suma = 0;
    let term = 1;
    let k = x;
    while (k > 0 && term >= EPS * suma) {
      term *= k * (NB - n + k) / (n + 1 - k) / (NR + 1 - k);
      suma += term;
      k--;
    }
    chica = d * (1 + suma);
  }
  return inferior ? [chica, 1 - chica] : [1 - chica, chica];
}

// ---------------------------------------------------------------------------
// Catálogo

const P01 = { min: 0, max: 1 };
const POSITIVO = { min: 0, minExclusivo: true };
const ENTERO1 = { entero: true, min: 1 };
// Topes donde los algoritmos dejan de garantizar la precisión (la serie de la gamma
// incompleta necesita ~9·√a términos; BFRAC y los enteros exactos hasta ~1e15).
const HASTA_1E10 = { min: 0, minExclusivo: true, max: 1e10 };
const HASTA_1E15 = { min: 0, minExclusivo: true, max: 1e15 };

const defs = [
  {
    id: 'normal',
    nombre: 'Normal',
    discreta: false,
    params: [
      param('mu', 'μ', 'media', 0),
      param('sigma', 'σ', 'desvío', 1, POSITIVO),
    ],
    soporte: () => [-Infinity, Infinity],
    pdf: (x, p) => normPdf((x - p.mu) / p.sigma) / p.sigma,
    ambas: (x, p) => normAmbas((x - p.mu) / p.sigma),
    inv(q, sup, p) {
      const z = normPpf(q);
      return sup ? p.mu - p.sigma * z : p.mu + p.sigma * z;
    },
    media: (p) => p.mu,
    varianza: (p) => p.sigma * p.sigma,
  },
  {
    id: 't',
    nombre: 't de Student',
    discreta: false,
    params: [param('nu', 'ν', 'grados de libertad', 10, POSITIVO)],
    soporte: () => [-Infinity, Infinity],
    pdf: (x, p) => tPdf(x, p.nu),
    ambas: (x, p) => tAmbas(x, p.nu),
    inv: (q, sup, p) => tInv(q, sup, p.nu),
    media: (p) => (p.nu > 1 ? 0 : NaN),
    varianza: (p) => (p.nu > 2 ? p.nu / (p.nu - 2) : p.nu > 1 ? Infinity : NaN),
  },
  {
    id: 'chi2',
    nombre: 'Chi cuadrado',
    discreta: false,
    params: [param('nu', 'ν', 'grados de libertad', 5, HASTA_1E10)],
    soporte: () => [0, Infinity],
    pdf: (x, p) => 0.5 * dgammaUnit(x / 2, p.nu / 2),
    ambas: (x, p) => gammaInc(p.nu / 2, x / 2),
    inv: (q, sup, p) => 2 * gammaIncInv(p.nu / 2, q, sup),
    media: (p) => p.nu,
    varianza: (p) => 2 * p.nu,
  },
  {
    id: 'f',
    nombre: 'F de Fisher-Snedecor',
    discreta: false,
    params: [
      param('nu1', 'ν₁', 'grados de libertad del numerador', 5, HASTA_1E15),
      param('nu2', 'ν₂', 'grados de libertad del denominador', 10, HASTA_1E15),
    ],
    soporte: () => [0, Infinity],
    pdf: (x, p) => fPdf(x, p.nu1, p.nu2),
    ambas: (x, p) => fAmbas(x, p.nu1, p.nu2),
    inv(q, sup, p) {
      const i = sup ? 1 : 0;
      return invertirPositiva((v) => fAmbas(v, p.nu1, p.nu2)[i], (v) => fPdf(v, p.nu1, p.nu2), q,
        semillaF(q, sup, p.nu1, p.nu2), !sup);
    },
    media: (p) => (p.nu2 > 2 ? p.nu2 / (p.nu2 - 2) : Infinity),
    varianza(p) {
      const { nu1: a, nu2: b } = p;
      if (b > 4) return 2 * b * b * (a + b - 2) / (a * (b - 2) * (b - 2) * (b - 4));
      return Infinity;
    },
  },
  {
    id: 'binomial',
    nombre: 'Binomial',
    discreta: true,
    params: [
      param('n', 'n', 'cantidad de pruebas', 10, { ...ENTERO1, max: 1e15 }),
      param('p', 'p', 'probabilidad de éxito', 0.5, P01),
    ],
    soporte: (p) => (p.p === 0 ? [0, 0] : p.p === 1 ? [p.n, p.n] : [0, p.n]),
    pmf: (k, p) => Math.exp(ldbinomRaw(k, p.n, p.p, 1 - p.p)),
    // P(X ≤ k) = I_{1−p}(n−k, k+1)
    ambas: (k, p) => betaIncAmbos(1 - p.p, p.n - k, k + 1, p.p),
    semilla(q, p) {
      const s = Math.sqrt(p.n * p.p * (1 - p.p));
      return semillaCF(q, p.n * p.p, s, s > 0 ? (1 - 2 * p.p) / s : 0);
    },
    media: (p) => p.n * p.p,
    varianza: (p) => p.n * p.p * (1 - p.p),
  },
  {
    id: 'poisson',
    nombre: 'Poisson',
    discreta: true,
    params: [param('m', 'm', 'media', 4, HASTA_1E10)],
    soporte: () => [0, Infinity],
    pmf: (k, p) => Math.exp(ldpoisRaw(k, p.m)),
    // P(X ≤ k) = Q(k+1, m)
    ambas(k, p) {
      const [P, Q] = gammaInc(k + 1, p.m);
      return [Q, P];
    },
    semilla: (q, p) => semillaCF(q, p.m, Math.sqrt(p.m), 1 / Math.sqrt(p.m)),
    media: (p) => p.m,
    varianza: (p) => p.m,
  },
  {
    id: 'hipergeometrica',
    nombre: 'Hipergeométrica',
    discreta: true,
    params: [
      param('N', 'N', 'tamaño de la población', 20, { ...ENTERO1, max: 1e12 }),
      param('R', 'R', 'éxitos en la población', 7, { entero: true, min: 0 }),
      param('n', 'n', 'tamaño de la muestra', 5, ENTERO1),
    ],
    cruzada(p) {
      if (p.R > p.N) return 'R no puede ser mayor que N.';
      if (p.n > p.N) return 'n no puede ser mayor que N.';
      return null;
    },
    soporte: (p) => [Math.max(0, p.n - (p.N - p.R)), Math.min(p.n, p.R)],
    pmf: (k, p) => hiperPmf(k, p.N, p.R, p.n),
    ambas: (k, p) => hiperAmbas(k, p.N, p.R, p.n),
    semilla(q, p) {
      const f = p.R / p.N;
      const v = p.N > 1 ? p.n * f * (1 - f) * (p.N - p.n) / (p.N - 1) : 0;
      return semillaCF(q, p.n * f, Math.sqrt(v), 0);
    },
    media: (p) => p.n * p.R / p.N,
    varianza(p) {
      const f = p.R / p.N;
      return p.N > 1 ? p.n * f * (1 - f) * (p.N - p.n) / (p.N - 1) : 0;
    },
  },
  {
    id: 'geometrica',
    nombre: 'Geométrica',
    discreta: true,
    params: [param('p', 'p', 'probabilidad de éxito', 0.3, { min: 0, minExclusivo: true, max: 1 })],
    soporte: (p) => (p.p === 1 ? [1, 1] : [1, Infinity]),
    pmf: (k, p) => (p.p === 1 ? (k === 1 ? 1 : 0) : p.p * Math.exp((k - 1) * Math.log1p(-p.p))),
    ambas(k, p) {
      const l = k * Math.log1p(-p.p);
      return [-Math.expm1(l), Math.exp(l)];
    },
    semilla: (q, p) => Math.ceil(Math.log1p(-q) / Math.log1p(-p.p)),
    media: (p) => 1 / p.p,
    varianza: (p) => (1 - p.p) / (p.p * p.p),
  },
  {
    id: 'pascal',
    nombre: 'Pascal (binomial negativa)',
    discreta: true,
    params: [
      param('r', 'r', 'éxitos buscados', 3, { ...ENTERO1, max: 1e12 }),
      param('p', 'p', 'probabilidad de éxito', 0.4, { min: 0, minExclusivo: true, max: 1 }),
    ],
    soporte: (p) => (p.p === 1 ? [p.r, p.r] : [p.r, Infinity]),
    // P(X = k) = (r/k)·C(k, r) p^r (1−p)^(k−r)
    pmf: (k, p) => (p.r / k) * Math.exp(ldbinomRaw(p.r, k, p.p, 1 - p.p)),
    // P(X ≤ k) = I_p(r, k−r+1)
    ambas: (k, p) => betaIncAmbos(p.p, p.r, k - p.r + 1, 1 - p.p),
    semilla(q, p) {
      const m = p.r / p.p;
      const s = Math.sqrt(p.r * (1 - p.p)) / p.p;
      return semillaCF(q, m, s, s > 0 ? (2 - p.p) / Math.sqrt(p.r * (1 - p.p)) : 0);
    },
    media: (p) => p.r / p.p,
    varianza: (p) => p.r * (1 - p.p) / (p.p * p.p),
  },
  {
    id: 'exponencial',
    nombre: 'Exponencial',
    discreta: false,
    params: [param('lambda', 'λ', 'tasa', 1, POSITIVO)],
    soporte: () => [0, Infinity],
    pdf: (x, p) => p.lambda * Math.exp(-p.lambda * x),
    ambas(x, p) {
      const l = -p.lambda * x;
      return [-Math.expm1(l), Math.exp(l)];
    },
    inv: (q, sup, p) => (sup ? -Math.log(q) : -Math.log1p(-q)) / p.lambda,
    media: (p) => 1 / p.lambda,
    varianza: (p) => 1 / (p.lambda * p.lambda),
  },
  {
    id: 'uniforme',
    nombre: 'Uniforme continua',
    discreta: false,
    params: [
      param('a', 'a', 'extremo inferior', 0),
      param('b', 'b', 'extremo superior', 1),
    ],
    cruzada: (p) => (p.a < p.b ? null : 'a tiene que ser menor que b.'),
    soporte: (p) => [p.a, p.b],
    pdf: (x, p) => 1 / (p.b - p.a),
    ambas(x, p) {
      const w = p.b - p.a;
      return [(x - p.a) / w, (p.b - x) / w];
    },
    inv: (q, sup, p) => (sup ? p.b - q * (p.b - p.a) : p.a + q * (p.b - p.a)),
    media: (p) => (p.a + p.b) / 2,
    varianza: (p) => (p.b - p.a) * (p.b - p.a) / 12,
  },
  {
    id: 'gamma',
    nombre: 'Gamma',
    discreta: false,
    params: [
      param('r', 'r', 'forma', 2, HASTA_1E10),
      param('lambda', 'λ', 'tasa', 1, POSITIVO),
    ],
    soporte: () => [0, Infinity],
    pdf: (x, p) => p.lambda * dgammaUnit(p.lambda * x, p.r),
    ambas: (x, p) => gammaInc(p.r, p.lambda * x),
    inv: (q, sup, p) => gammaIncInv(p.r, q, sup) / p.lambda,
    media: (p) => p.r / p.lambda,
    varianza: (p) => p.r / (p.lambda * p.lambda),
  },
  {
    id: 'beta',
    nombre: 'Beta',
    discreta: false,
    params: [
      param('alfa', 'α', 'forma', 2, HASTA_1E15),
      param('beta', 'β', 'forma', 5, HASTA_1E15),
    ],
    soporte: () => [0, 1],
    pdf: (x, p) => dbetaUnit(x, p.alfa, p.beta),
    ambas: (x, p) => betaIncAmbos(x, p.alfa, p.beta),
    inv: (q, sup, p) => betaIncInv(p.alfa, p.beta, q, sup),
    media: (p) => p.alfa / (p.alfa + p.beta),
    varianza(p) {
      const s = p.alfa + p.beta;
      return p.alfa * p.beta / (s * s * (s + 1));
    },
  },
  {
    id: 'weibull',
    nombre: 'Weibull',
    discreta: false,
    params: [
      param('k', 'k', 'forma', 1.5, POSITIVO),
      param('lambda', 'λ', 'escala', 1, POSITIVO),
    ],
    soporte: () => [0, Infinity],
    pdf(x, p) {
      const { k, lambda } = p;
      if (x === 0) return k < 1 ? Infinity : k > 1 ? 0 : 1 / lambda;
      const u = x / lambda;
      const w = Math.pow(u, k);
      return (k / lambda) * Math.exp((k - 1) * Math.log(u) - w);
    },
    ambas(x, p) {
      const w = Math.pow(x / p.lambda, p.k);
      return [-Math.expm1(-w), Math.exp(-w)];
    },
    inv: (q, sup, p) => p.lambda * Math.pow(sup ? -Math.log(q) : -Math.log1p(-q), 1 / p.k),
    media: (p) => p.lambda * gammaFn(1 + 1 / p.k),
    varianza(p) {
      const g1 = gammaFn(1 + 1 / p.k);
      return p.lambda * p.lambda * (gammaFn(1 + 2 / p.k) - g1 * g1);
    },
  },
  {
    id: 'lognormal',
    nombre: 'Lognormal',
    discreta: false,
    params: [
      param('mu', 'μ', 'media de ln X', 0),
      param('sigma', 'σ', 'desvío de ln X', 0.5, POSITIVO),
    ],
    soporte: () => [0, Infinity],
    pdf: (x, p) => (x === 0 ? 0 : normPdf((Math.log(x) - p.mu) / p.sigma) / (p.sigma * x)),
    ambas: (x, p) => normAmbas((Math.log(x) - p.mu) / p.sigma),
    inv(q, sup, p) {
      const z = normPpf(q);
      return Math.exp(sup ? p.mu - p.sigma * z : p.mu + p.sigma * z);
    },
    media: (p) => Math.exp(p.mu + p.sigma * p.sigma / 2),
    varianza: (p) => Math.expm1(p.sigma * p.sigma) * Math.exp(2 * p.mu + p.sigma * p.sigma),
  },
];

export const LISTA = defs.map(crear);
export const DISTRIBUCIONES = Object.fromEntries(LISTA.map((d) => [d.id, d]));

// valores por defecto de los parámetros de una distribución
export function parametrosPorDefecto(id) {
  const d = DISTRIBUCIONES[id];
  return d ? Object.fromEntries(d.params.map((q) => [q.id, q.defecto])) : null;
}
