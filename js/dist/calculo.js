// De lo que escribió el usuario (x, a, b o la probabilidad) a la zona y su probabilidad.
// En las discretas G(r) = P(X ≥ r) incluye a r, como en la cátedra.

export const cdfDisc = (d, P, k) => (k < d.soporte(P)[0] ? 0 : d.cdf(k, P));
const sfDisc = (d, P, k) => (k < d.soporte(P)[0] ? 1 : d.sf(k, P));
export const G = (d, P, x) => (d.discreta ? sfDisc(d, P, x - 1) : d.sf(x, P));
export const F = (d, P, x) => (d.discreta ? cdfDisc(d, P, x) : d.cdf(x, P));

// Menor r del soporte con G(r) ≤ q (si ninguno alcanza, el siguiente al máximo).
export function menorRConG(d, P, q) {
  const [lo, hi] = d.soporte(P);
  let r = d.ppf(1 - q, P);
  if (!Number.isFinite(r)) r = Number.isFinite(hi) && q < 1 ? hi : lo;
  r = Math.max(lo, Math.min(hi, r));
  let vueltas = 0;
  while (r > lo && G(d, P, r - 1) <= q && vueltas++ < 1e6) r--;
  while (r <= hi && G(d, P, r) > q && vueltas++ < 1e6) r++;
  return r;
}

// Mayor k con F(k) ≤ q (puede ser lo − 1 si ni el mínimo alcanza).
export function mayorKConF(d, P, q) {
  const [lo] = d.soporte(P);
  let k = d.ppf(q, P);
  if (!Number.isFinite(k)) k = lo;
  let vueltas = 0;
  while (k >= lo && cdfDisc(d, P, k) > q && vueltas++ < 1e6) k--;
  while (cdfDisc(d, P, k + 1) <= q && vueltas++ < 1e6) k++;
  return k;
}

export function calcular(d, P, { modo, origen, x, a, b, p }) {
  if (origen === 'p') {
    if (modo === 'izq') x = d.ppf(p, P);
    else if (modo === 'der') x = d.discreta ? menorRConG(d, P, p) : d.isf(p, P);
    else if (modo === 'entre') {
      if (d.discreta) { a = mayorKConF(d, P, (1 - p) / 2) + 1; b = menorRConG(d, P, (1 - p) / 2) - 1; }
      else { a = d.ppf((1 - p) / 2, P); b = d.isf((1 - p) / 2, P); }
    } else if (d.discreta) { a = mayorKConF(d, P, p / 2); b = menorRConG(d, P, p / 2); }
    else { a = d.ppf(p / 2, P); b = d.isf(p / 2, P); }
  }
  let prob;
  if (modo === 'izq') prob = F(d, P, x);
  else if (modo === 'der') prob = G(d, P, x);
  else if (modo === 'entre') {
    if (b < a) prob = 0;
    else if (d.discreta) prob = cdfDisc(d, P, b) - cdfDisc(d, P, a - 1);
    else prob = d.cdf(a, P) > 0.5 ? d.sf(a, P) - d.sf(b, P) : d.cdf(b, P) - d.cdf(a, P);
  } else if (d.discreta ? b <= a + 1 : b <= a) prob = 1;
  else prob = F(d, P, a) + G(d, P, b);
  return { x, a, b, prob };
}
