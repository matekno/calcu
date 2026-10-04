// Funciones especiales en doble precisión, sin dependencias.
// Fuentes: Cody (1969, 1993) para erf y la normal; Wichura (AS241) para la
// inversa normal; Loader (2000) para densidades con stirlerr + bd0 (como
// dbinom/dpois de R); serie y fracción continua de Lentz para la gamma
// incompleta; fracción continua BFRAC de TOMS 708 para la beta incompleta.

const EPS = 2.220446049250313e-16;
const MIN_NORMAL = 2.2250738585072014e-308;
const DIMINUTO = 1e-300;
const MAX_ITER = 1000000;

export const LN_2PI = 1.8378770664093454835606594728112;
export const LN_SQRT_2PI = 0.91893853320467274178032973640562;
export const INV_SQRT_2PI = 0.39894228040143267793994605993438;
const INV_SQRT_PI = 0.56418958354775628694807945156077;
const SQRT_32 = 5.6568542494923801952067548968388;
const EULER = 0.57721566490153286060651209008240;

export const log1p = Math.log1p;
export const expm1 = Math.expm1;

// ---------------------------------------------------------------------------
// Gamma, Stirling y Loader

// B_2k / (2k (2k-1)), k = 1..10
const COEF_STIRLING = [
  1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156,
  -3617 / 122400, 43867 / 244188, -174611 / 125400,
];

// Serie asintótica de lgamma(x) − Stirling; error < 1e-19 para x ≥ 10.
function serieStirling(x) {
  const z = 1 / (x * x);
  let s = COEF_STIRLING[9];
  for (let k = 8; k >= 0; k--) s = s * z + COEF_STIRLING[k];
  return s / x;
}

// stirlerr(n) = lgamma(n+1) − (n+½)·log n + n − log √(2π), para n > 0 real.
export function stirlerr(n) {
  if (n >= 10) return serieStirling(n);
  if (!(n > 0)) return n === 0 ? 0 : NaN;
  // stirlerr(m) − stirlerr(m+1) = (m+½)·log1p(1/m) − 1, sin cancelación grave
  let s = 0;
  let m = n;
  while (m < 10) {
    s += (m + 0.5) * Math.log1p(1 / m) - 1;
    m += 1;
  }
  return s + serieStirling(m);
}

export function lgamma(x) {
  if (Number.isNaN(x)) return NaN;
  if (x <= 0) return x === 0 ? Infinity : NaN;
  if (x === Infinity) return Infinity;
  if (x < 1e-8) return -Math.log(x) - EULER * x;
  if (x >= 10) return (x - 0.5) * Math.log(x) - x + LN_SQRT_2PI + serieStirling(x);
  return stirlerr(x) + (x - 0.5) * Math.log(x) - x + LN_SQRT_2PI;
}

const FACTORIALES = (() => {
  const f = [1];
  for (let i = 1; i <= 170; i++) f.push(f[i - 1] * i);
  return f;
})();

// Γ(x) para x > 0
export function gammaFn(x) {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return Infinity;
  if (Number.isInteger(x) && x <= 171) return FACTORIALES[x - 1];
  if (x > 171.7) return Infinity;
  return Math.exp(lgamma(x));
}

// log B(a, b) sin restar logaritmos grandes (como lbeta de R).
export function lbeta(a, b) {
  const p = Math.min(a, b);
  const q = Math.max(a, b);
  if (Number.isNaN(p) || p < 0) return NaN;
  if (p === 0) return Infinity;
  if (q === Infinity) return -Infinity;
  if (p >= 10) {
    const corr = serieStirling(p) + serieStirling(q) - serieStirling(p + q);
    return -0.5 * Math.log(q) + LN_SQRT_2PI + corr + (p - 0.5) * Math.log(p / (p + q)) +
      q * Math.log1p(-p / (p + q));
  }
  if (q >= 10) {
    const corr = serieStirling(q) - serieStirling(p + q);
    return lgamma(p) + corr + p - p * Math.log(p + q) + (q - 0.5) * Math.log1p(-p / (p + q));
  }
  return lgamma(p) + lgamma(q) - lgamma(p + q);
}

// Producto exacto a·b = p + e (Dekker)
const PARTIR = 134217729;
function dosProducto(a, b) {
  const p = a * b;
  let t = PARTIR * a;
  const ah = t - (t - a);
  const al = a - ah;
  t = PARTIR * b;
  const bh = t - (t - b);
  const bl = b - bh;
  return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
}

// bd0(x, np) = x·log(x/np) + np − x, estable cuando x ≈ np.
export function bd0(x, np) {
  if (!Number.isFinite(x) || !Number.isFinite(np) || np === 0) return NaN;
  if (x === 0) return np;
  const d = x - np;
  if (Math.abs(d) < 0.1 * (x + np)) {
    let v = d / (x + np);
    let s = d * v;
    if (Math.abs(s) < MIN_NORMAL) return s;
    let ej = 2 * x * v;
    v *= v;
    for (let j = 1; j < 1000; j++) {
      ej *= v;
      const s1 = s + ej / (2 * j + 1);
      if (s1 === s) return s1;
      s = s1;
    }
  }
  const r = x / np;
  if (!(r > 0 && r < Infinity)) return x * (Math.log(x) - Math.log(np)) + np - x;
  // x·log(x/np) con el redondeo del cociente y del producto corregidos: si no,
  // el error absoluto crece como x·eps (1e-11 para x ≈ 1e5)
  const l = Math.log(r);
  const simple = x * l + np - x;
  if (!(r < 1e280 && r > 1e-280 && x < 1e280 && np < 1e280)) return simple;
  const [rn, rnErr] = dosProducto(r, np);
  const rho = ((x - rn) - rnErr) / rn; // x/np = r·(1 + rho)
  const [xl, xlErr] = dosProducto(x, l);
  const v = (xl + (np - x)) + (xlErr + x * rho);
  return Number.isFinite(v) ? v : simple;
}

// log de C(n, x)·p^x·q^(n−x) con x, n reales (dbinom_raw de R en escala log).
export function ldbinomRaw(x, n, p, q) {
  if (p === 0) return x === 0 ? 0 : -Infinity;
  if (q === 0) return x === n ? 0 : -Infinity;
  if (x === 0) {
    if (n === 0) return 0;
    return p < 0.5 ? n * Math.log1p(-p) : n * Math.log(q);
  }
  if (x === n) return q < 0.5 ? n * Math.log1p(-q) : n * Math.log(p);
  if (x < 0 || x > n) return -Infinity;
  const lc = stirlerr(n) - stirlerr(x) - stirlerr(n - x) - bd0(x, n * p) - bd0(n - x, n * q);
  const lf = LN_2PI + Math.log(x) + (x < 0.5 * n ? Math.log1p(-x / n) : Math.log((n - x) / n));
  return lc - 0.5 * lf;
}

// log de λ^x e^(−λ) / Γ(x+1), x real ≥ 0 (dpois_raw de R).
export function ldpoisRaw(x, lambda) {
  if (lambda === 0) return x === 0 ? 0 : -Infinity;
  if (!Number.isFinite(lambda) || x < 0) return -Infinity;
  if (x <= lambda * MIN_NORMAL) return -lambda;
  if (lambda < x * MIN_NORMAL) {
    if (!Number.isFinite(x)) return -Infinity;
    return -lambda + x * Math.log(lambda) - lgamma(x + 1);
  }
  return -0.5 * (LN_2PI + Math.log(x)) - stirlerr(x) - bd0(x, lambda);
}

// Densidad de Gamma(a, 1) (dgamma de R).
export function dgammaUnit(x, a) {
  if (Number.isNaN(x) || !(a > 0)) return NaN;
  if (x < 0 || x === Infinity) return 0;
  if (x === 0) return a < 1 ? Infinity : a > 1 ? 0 : 1;
  if (a < 1) {
    const r = a / x;
    return Number.isFinite(r) ? Math.exp(ldpoisRaw(a, x)) * r : Math.exp(ldpoisRaw(a, x) + Math.log(a) - Math.log(x));
  }
  return Math.exp(ldpoisRaw(a - 1, x));
}

// log( x^a · y^b / B(a,b) ) con y = 1 − x dado aparte, por Loader.
export function lprefBeta(x, y, a, b) {
  const n = a + b;
  const nx = n * x;
  const ny = n * y;
  if (nx > 0 && ny > 0 && Number.isFinite(n) && Number.isFinite(nx) && Number.isFinite(ny)) {
    return stirlerr(n) - stirlerr(a) - stirlerr(b) - bd0(a, nx) - bd0(b, ny) +
      0.5 * (Math.log(a) + Math.log(b) - Math.log(n)) - LN_SQRT_2PI;
  }
  return a * Math.log(x) + b * Math.log(y) - lbeta(a, b);
}

// Densidad Beta(a, b)
export function dbetaUnit(x, a, b) {
  if (Number.isNaN(x) || !(a > 0) || !(b > 0)) return NaN;
  if (x < 0 || x > 1) return 0;
  if (x === 0) return a < 1 ? Infinity : a > 1 ? 0 : b;
  if (x === 1) return b < 1 ? Infinity : b > 1 ? 0 : a;
  const y = 1 - x;
  return Math.exp(lprefBeta(x, y, a, b)) / (x * y);
}

// ---------------------------------------------------------------------------
// Función de error (Cody, CALERF)

const ERF_A = [3.16112374387056560e00, 1.13864154151050156e02, 3.77485237685302021e02,
  3.20937758913846947e03, 1.85777706184603153e-1];
const ERF_B = [2.36012909523441209e01, 2.44024637934444173e02, 1.28261652607737228e03,
  2.84423683343917062e03];
const ERF_C = [5.64188496988670089e-1, 8.88314979438837594e00, 6.61191906371416295e01,
  2.98635138197400131e02, 8.81952221241769090e02, 1.71204761263407058e03,
  2.05107837782607147e03, 1.23033935479799725e03, 2.15311535474403846e-8];
const ERF_D = [1.57449261107098347e01, 1.17693950891312499e02, 5.37181101862009858e02,
  1.62138957456669019e03, 3.29079923573345963e03, 4.36261909014324716e03,
  3.43936767414372164e03, 1.23033935480374942e03];
const ERF_P = [3.05326634961232344e-1, 3.60344899949804439e-1, 1.25781726111229246e-1,
  1.60837851487422766e-2, 6.58749161529837803e-4, 1.63153871373020978e-2];
const ERF_Q = [2.56852019228982242e00, 1.87295284992346725e00, 5.27905102951428412e-1,
  6.05183413124413191e-2, 2.33520497626869185e-3];

// exp(−y²·c) partiendo y para que y² no pierda bits
function expCuadrado(y, c) {
  const yh = Math.trunc(y * 16) / 16;
  const del = (y - yh) * (y + yh);
  return Math.exp(-yh * yh * c) * Math.exp(-del * c);
}

function erfcPositivo(y) {
  let r;
  if (y <= 4) {
    let num = ERF_C[8] * y;
    let den = y;
    for (let i = 0; i < 7; i++) {
      num = (num + ERF_C[i]) * y;
      den = (den + ERF_D[i]) * y;
    }
    r = (num + ERF_C[7]) / (den + ERF_D[7]);
  } else {
    if (y >= 27.3) return 0;
    const z = 1 / (y * y);
    let num = ERF_P[5] * z;
    let den = z;
    for (let i = 0; i < 4; i++) {
      num = (num + ERF_P[i]) * z;
      den = (den + ERF_Q[i]) * z;
    }
    r = z * (num + ERF_P[4]) / (den + ERF_Q[4]);
    r = (INV_SQRT_PI - r) / y;
  }
  return expCuadrado(y, 1) * r;
}

export function erf(x) {
  if (Number.isNaN(x)) return NaN;
  const y = Math.abs(x);
  if (y <= 0.46875) {
    const z = y > 1.11e-16 ? y * y : 0;
    let num = ERF_A[4] * z;
    let den = z;
    for (let i = 0; i < 3; i++) {
      num = (num + ERF_A[i]) * z;
      den = (den + ERF_B[i]) * z;
    }
    return x * (num + ERF_A[3]) / (den + ERF_B[3]);
  }
  const r = (0.5 - erfcPositivo(y)) + 0.5;
  return x < 0 ? -r : r;
}

export function erfc(x) {
  if (Number.isNaN(x)) return NaN;
  const y = Math.abs(x);
  if (y <= 0.46875) return 1 - erf(x);
  const r = erfcPositivo(y);
  return x < 0 ? 2 - r : r;
}

// ---------------------------------------------------------------------------
// Normal estándar (Cody, ANORM; misma estructura que pnorm de R)

const PN_A = [2.2352520354606839287, 161.02823106855587881, 1067.6894854603709582,
  18154.981253343561249, 0.065682337918207449113];
const PN_B = [47.20258190468824187, 976.09855173777669322, 10260.932208618978205,
  45507.789335026729956];
const PN_C = [0.39894151208813466764, 8.8831497943883759412, 93.506656132177855979,
  597.27027639480026226, 2494.5375852903726711, 6848.1904505362823326,
  11602.651437647350124, 9842.7148383839780218, 1.0765576773720192317e-8];
const PN_D = [22.266688044328115691, 235.38790178262499861, 1519.377599407554805,
  6485.558298266760755, 18615.571640885098091, 34900.952721145977266,
  38912.003286093271411, 19685.429676859990727];
const PN_P = [0.21589853405795699, 0.1274011611602473639, 0.022235277870649807,
  0.001421619193227893466, 2.9112874951168792e-5, 0.02307344176494017303];
const PN_Q = [1.28426009614491121, 0.468238212480865118, 0.0659881378689285515,
  0.00378239633202758244, 7.29751555083966205e-5];

// [Φ(z), 1 − Φ(z)], cada una con precisión relativa completa
export function normAmbas(z) {
  if (Number.isNaN(z)) return [NaN, NaN];
  const y = Math.abs(z);
  if (y <= 0.67448975) {
    let num = 0;
    let den = 0;
    if (y > EPS * 0.5) {
      const w = z * z;
      num = PN_A[4] * w;
      den = w;
      for (let i = 0; i < 3; i++) {
        num = (num + PN_A[i]) * w;
        den = (den + PN_B[i]) * w;
      }
    }
    const t = z * (num + PN_A[3]) / (den + PN_B[3]);
    return [0.5 + t, 0.5 - t];
  }
  let chica;
  if (y <= SQRT_32) {
    let num = PN_C[8] * y;
    let den = y;
    for (let i = 0; i < 7; i++) {
      num = (num + PN_C[i]) * y;
      den = (den + PN_D[i]) * y;
    }
    chica = expCuadrado(y, 0.5) * ((num + PN_C[7]) / (den + PN_D[7]));
  } else if (y < 38.5) {
    const w = 1 / (z * z);
    let num = PN_P[5] * w;
    let den = w;
    for (let i = 0; i < 4; i++) {
      num = (num + PN_P[i]) * w;
      den = (den + PN_Q[i]) * w;
    }
    const t = (INV_SQRT_2PI - w * (num + PN_P[4]) / (den + PN_Q[4])) / y;
    chica = expCuadrado(y, 0.5) * t;
  } else {
    chica = 0;
  }
  return z > 0 ? [1 - chica, chica] : [chica, 1 - chica];
}

export function normCdf(z) {
  return normAmbas(z)[0];
}

export function normSf(z) {
  return normAmbas(z)[1];
}

export function normPdf(z) {
  if (Number.isNaN(z)) return NaN;
  const y = Math.abs(z);
  if (y > 40) return 0;
  return INV_SQRT_2PI * expCuadrado(y, 0.5);
}

// Inversa de Φ (Wichura, AS241 PPND16)
const IN_A = [3.387132872796366608, 133.14166789178437745, 1971.5909503065514427,
  13731.693765509461125, 45921.953931549871457, 67265.770927008700853,
  33430.575583588128105, 2509.0809287301226727];
const IN_B = [1, 42.313330701600911252, 687.1870074920579083, 5394.1960214247511077,
  21213.794301586595867, 39307.89580009271061, 28729.085735721942674,
  5226.495278852545925];
const IN_C = [1.42343711074968357734, 4.6303378461565452959, 5.7694972214606914055,
  3.64784832476320460504, 1.27045825245236838258, 0.24178072517745061177,
  0.0227238449892691845833, 7.7454501427834140764e-4];
const IN_D = [1, 2.05319162663775882187, 1.6763848301838038494, 0.68976733498510000455,
  0.14810397642748007459, 0.0151986665636164571966, 5.475938084995344946e-4,
  1.05075007164441684324e-9];
const IN_E = [6.6579046435011037772, 5.4637849111641143699, 1.7848265399172913358,
  0.29656057182850489123, 0.026532189526576123093, 0.0012426609473880784386,
  2.71155556874348757815e-5, 2.01033439929228813265e-7];
const IN_F = [1, 0.59983220655588793769, 0.13692988092273580531, 0.0148753612908506148525,
  7.868691311456132591e-4, 1.8463183175100546818e-5, 1.4215117583164458887e-7,
  2.04426310338993978564e-15];

function horner(c, x) {
  let s = c[c.length - 1];
  for (let i = c.length - 2; i >= 0; i--) s = s * x + c[i];
  return s;
}

export function normPpf(p) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return q * horner(IN_A, r) / horner(IN_B, r);
  }
  let r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let x;
  if (r <= 5) {
    r -= 1.6;
    x = horner(IN_C, r) / horner(IN_D, r);
  } else {
    r -= 5;
    x = horner(IN_E, r) / horner(IN_F, r);
  }
  return q < 0 ? -x : x;
}

// ---------------------------------------------------------------------------
// Gamma incompleta regularizada: [P(a,x), Q(a,x)]

function serieGammaP(a, x) {
  // P = x^a e^−x / Γ(a+1) · Σ x^n / ((a+1)…(a+n))
  const lpre = ldpoisRaw(a, x);
  if (lpre === -Infinity) return 0;
  let term = 1;
  let suma = 1;
  for (let n = 1; n < MAX_ITER; n++) {
    term *= x / (a + n);
    suma += term;
    if (term * x <= suma * EPS * 0.5 * (a + n + 1 - x)) break;
  }
  return Math.exp(lpre) * suma;
}

function fcGammaQ(a, x) {
  // Q = x^a e^−x / Γ(a) · 1/(x+1−a− 1(1−a)/(x+3−a− 2(2−a)/(x+5−a− …)))
  const lpre = ldpoisRaw(a, x) + Math.log(a);
  if (lpre === -Infinity) return 0;
  let b = x + 1 - a;
  let c = 1 / DIMINUTO;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < DIMINUTO) d = DIMINUTO;
    c = b + an / c;
    if (Math.abs(c) < DIMINUTO) c = DIMINUTO;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) <= EPS) break;
  }
  return Math.exp(lpre) * h;
}

export function gammaInc(a, x) {
  if (Number.isNaN(a) || Number.isNaN(x) || !(a > 0)) return [NaN, NaN];
  if (x <= 0) return [0, 1];
  if (x === Infinity) return [1, 0];
  if (a === Infinity) return [0, 1];
  if (x < a + 1) {
    const p = serieGammaP(a, x);
    return [p, 1 - p];
  }
  const q = fcGammaQ(a, x);
  return [1 - q, q];
}

export function gammaP(a, x) {
  return gammaInc(a, x)[0];
}

export function gammaQ(a, x) {
  return gammaInc(a, x)[1];
}

// ---------------------------------------------------------------------------
// Beta incompleta regularizada: [I_x(a,b), 1 − I_x(a,b)]

// Fracción continua BFRAC de TOMS 708 (Didonato y Morris) para I_x(a,b), con
// λ = (a+b)·y − b ≥ 0 calculado aparte: así no hace falta x con precisión absoluta
// cuando x ≈ 1 (t con ν grande, binomial con p chico y n grande).
function bfrac(x, y, a, b, lambda) {
  const lpre = lprefBeta(x, y, a, b);
  if (lpre === -Infinity) return 0;
  const c = lambda + 1;
  const c0 = b / a;
  const c1 = 1 / a + 1;
  const yp1 = y + 1;
  let n = 0;
  let p = 1;
  let s = a + 1;
  let an = 0;
  let bn = 1;
  let anp1 = 1;
  let bnp1 = c / c1;
  let r = c1 / c;
  for (let it = 0; it < MAX_ITER; it++) {
    n += 1;
    let t = n / a;
    const w = n * (b - n) * x;
    let e = a / s;
    const alfa = p * (p + c0) * e * e * (w * x);
    e = (t + 1) / (c1 + t + t);
    const beta = n + w / s + e * (c + n * yp1);
    p = t + 1;
    s += 2;
    t = alfa * an + beta * anp1;
    an = anp1;
    anp1 = t;
    t = alfa * bn + beta * bnp1;
    bn = bnp1;
    bnp1 = t;
    const r0 = r;
    r = anp1 / bnp1;
    if (Math.abs(r - r0) <= EPS * r) break;
    an /= bnp1;
    bn /= bnp1;
    anp1 = r;
    bnp1 = 1;
  }
  return Math.exp(lpre) * r;
}

// y = 1 − x se puede pasar calculado aparte para no perder dígitos cerca de 1.
export function betaIncAmbos(x, a, b, y = 1 - x) {
  if (Number.isNaN(x) || Number.isNaN(y) || !(a > 0) || !(b > 0)) return [NaN, NaN];
  if (x <= 0) return [0, 1];
  if (y <= 0) return [1, 0];
  if (a === Infinity || b === Infinity) return [NaN, NaN];
  // λ < 0 si x está a la derecha de la media a/(a+b): conviene la cola de arriba
  const lambda = a > b ? (a + b) * y - b : a - (a + b) * x;
  if (lambda < 0) {
    const w = bfrac(y, x, b, a, -lambda);
    return [1 - w, w];
  }
  const w = bfrac(x, y, a, b, lambda);
  return [w, 1 - w];
}

export function betaInc(x, a, b) {
  return betaIncAmbos(x, a, b)[0];
}

export function betaIncC(x, a, b) {
  return betaIncAmbos(x, a, b)[1];
}

// ---------------------------------------------------------------------------
// Inversión

const MAX_DOUBLE = Number.MAX_VALUE;
const MIN_DOUBLE = Number.MIN_VALUE;

// Busca x en (0, sup) con cola(x) = q. cola es creciente (cdf) o decreciente (sf).
// Newton sobre log(cola) en la variable log x, acotado con bisección geométrica.
export function invertirPositiva(cola, dens, q, x0, creciente, sup = Infinity) {
  if (!(q > 0) || !(q < 1)) return NaN;
  const lq = Math.log(q);
  const s = creciente ? 1 : -1;
  let lo = 0;
  let hi = sup;
  let hayLo = false;
  let hayHi = false;
  let x = x0 > 0 && x0 < sup ? x0 : sup < Infinity ? sup / 2 : 1;
  let factor = 2;
  let mejor = x;
  let mejorG = Infinity;
  for (let it = 0; it < 400; it++) {
    const F = cola(x);
    if (Number.isNaN(F)) return NaN;
    const G = s * (Math.log(F) - lq);
    if (G === 0) return x;
    if (Math.abs(G) < mejorG) {
      mejorG = Math.abs(G);
      mejor = x;
    }
    if (G < 0) {
      lo = x;
      hayLo = true;
    } else {
      hi = x;
      hayHi = true;
    }
    let xn = NaN;
    if (F > 0 && Number.isFinite(G)) {
      const d = dens(x) * x / F;
      if (d > 0 && Number.isFinite(d)) xn = x * Math.exp(-G / d);
    }
    if (!(xn > lo && xn < hi)) {
      if (hayLo && hayHi) {
        xn = hi / lo > 4 ? Math.sqrt(lo) * Math.sqrt(hi) : 0.5 * (lo + hi);
      } else if (!hayHi) {
        if (sup < Infinity) {
          xn = sup - (sup - x) / factor;
        } else {
          if (x >= MAX_DOUBLE) return Infinity;
          xn = x * factor;
          if (!(xn < Infinity)) xn = MAX_DOUBLE;
        }
        factor = Math.min(factor * factor, 1e16);
      } else {
        if (x <= MIN_DOUBLE) return 0;
        xn = x / factor;
        if (!(xn > 0)) xn = MIN_DOUBLE;
        factor = Math.min(factor * factor, 1e16);
      }
    }
    const tol = 2 * EPS * (it < 40 ? 1 : 64);
    if (Math.abs(xn - x) <= tol * x) return xn;
    if (hayLo && hayHi && hi - lo <= tol * hi) return mejor;
    x = xn;
  }
  return mejor;
}

function semillaGamma(a, p, superior) {
  const z = superior ? -normPpf(p) : normPpf(p);
  const c = 1 / (9 * a);
  const wh = a * Math.pow(1 - c + z * Math.sqrt(c), 3);
  if (!superior) {
    // x^a / Γ(a+1) = p acota la raíz por abajo
    const xs = Math.exp((Math.log(p) + lgamma(a + 1)) / a);
    return wh > xs ? wh : xs;
  }
  return wh > 0 ? wh : a;
}

// x con P(a,x) = p, o con Q(a,x) = p si superior
export function gammaIncInv(a, p, superior = false) {
  if (Number.isNaN(p) || !(a > 0) || p < 0 || p > 1) return NaN;
  if (p === 0) return superior ? Infinity : 0;
  if (p === 1) return superior ? 0 : Infinity;
  if (p > 0.5) {
    p = 1 - p;
    superior = !superior;
  }
  const i = superior ? 1 : 0;
  return invertirPositiva((x) => gammaInc(a, x)[i], (x) => dgammaUnit(x, a), p,
    semillaGamma(a, p, superior), !superior);
}

function semillaBeta(a, b, p, superior) {
  const m = a / (a + b);
  const sd = Math.sqrt(a * b / ((a + b) * (a + b) * (a + b + 1)));
  const z = superior ? -normPpf(p) : normPpf(p);
  let x = Math.min(Math.max(m + z * sd, 1e-3), 1 - 1e-3);
  const lB = lbeta(a, b);
  if (!superior) {
    const xl = Math.exp((Math.log(p * a) + lB) / a);
    if (xl < x) x = xl;
  } else {
    const yl = Math.exp((Math.log(p * b) + lB) / b);
    if (yl < 1 - x) x = 1 - yl;
  }
  return x;
}

// x con I_x(a,b) = p, o con 1 − I_x(a,b) = p si superior
export function betaIncInv(a, b, p, superior = false) {
  if (Number.isNaN(p) || !(a > 0) || !(b > 0) || p < 0 || p > 1) return NaN;
  if (p === 0) return superior ? 1 : 0;
  if (p === 1) return superior ? 0 : 1;
  if (p > 0.5) {
    p = 1 - p;
    superior = !superior;
  }
  const x0 = semillaBeta(a, b, p, superior);
  if (x0 > 0.5) {
    // se resuelve en y = 1 − x, que es la variable chica
    const i = superior ? 0 : 1;
    const y = invertirPositiva((v) => betaIncAmbos(v, b, a)[i], (v) => dbetaUnit(v, b, a), p,
      1 - x0, superior, 1);
    return 1 - y;
  }
  const i = superior ? 1 : 0;
  return invertirPositiva((v) => betaIncAmbos(v, a, b)[i], (v) => dbetaUnit(v, a, b), p, x0,
    !superior, 1);
}
