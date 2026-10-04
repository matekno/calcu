// La lógica del panel: inversas discretas contra fuerza bruta y, en las continuas, que la zona tenga la probabilidad pedida.
import { LISTA, DISTRIBUCIONES } from '../../js/dist/distribuciones.js';
import { calcular, F, G } from '../../js/dist/calculo.js';

let fallas = 0, total = 0;
const falla = (msg) => { fallas++; if (fallas <= 30) console.log('FALLA', msg); };
const QS = [0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 0.8, 0.9, 0.95, 0.975, 0.99, 0.999];
const PARAMS = {
  binomial: [{ n: 20, p: 0.1 }, { n: 10, p: 0.5 }, { n: 50, p: 0.97 }, { n: 1, p: 0.3 }],
  poisson: [{ m: 4 }, { m: 0.3 }, { m: 25 }],
  hipergeometrica: [{ N: 20, R: 7, n: 5 }, { N: 50, R: 45, n: 10 }],
  geometrica: [{ p: 0.3 }, { p: 0.9 }],
  pascal: [{ r: 3, p: 0.4 }, { r: 1, p: 0.5 }],
};

for (const d of LISTA.filter((d) => d.discreta)) {
  for (const P of PARAMS[d.id]) {
    const [lo, hi0] = d.soporte(P);
    const hi = Number.isFinite(hi0) ? hi0 : d.ppf(1 - 1e-12, P) + 5;
    const todos = [];
    for (let r = lo - 1; r <= hi + 1; r++) todos.push(r);
    for (const q of QS) {
      total += 5;
      const tag = `${d.id} ${JSON.stringify(P)} q=${q}`;
      // izq: menor r con F(r) ≥ q
      const izq = calcular(d, P, { modo: 'izq', origen: 'p', p: q });
      const esperadoIzq = todos.find((r) => r >= lo && F(d, P, r) >= q - 1e-12);
      if (izq.x !== esperadoIzq) falla(`${tag} izq x=${izq.x} esperado ${esperadoIzq}`);
      // der: menor r con G(r) ≤ q
      const der = calcular(d, P, { modo: 'der', origen: 'p', p: q });
      const esperadoDer = todos.find((r) => r >= lo && G(d, P, r) <= q) ?? hi0 + 1;
      if (der.x !== esperadoDer) falla(`${tag} der x=${der.x} esperado ${esperadoDer}`);
      if (der.prob > q + 1e-12) falla(`${tag} der prob ${der.prob} > ${q}`);
      // colas: cada cola ≤ q/2 y es la mayor posible
      const colas = calcular(d, P, { modo: 'colas', origen: 'p', p: q });
      const ka = [...todos].reverse().find((k) => F(d, P, k) <= q / 2);
      const rb = todos.find((r) => r >= lo && G(d, P, r) <= q / 2) ?? hi0 + 1;
      if (colas.a !== ka || colas.b !== rb) falla(`${tag} colas a=${colas.a} b=${colas.b} esperado ${ka} ${rb}`);
      if (F(d, P, colas.a) > q / 2 + 1e-12 || G(d, P, colas.b) > q / 2 + 1e-12) falla(`${tag} colas pasan α/2`);
      // entre: intervalo central con cada cola ≤ (1-q)/2
      const entre = calcular(d, P, { modo: 'entre', origen: 'p', p: q });
      if (entre.prob < q - 1e-12) falla(`${tag} entre prob ${entre.prob} < ${q}`);
      if (F(d, P, entre.a - 1) > (1 - q) / 2 + 1e-12 || G(d, P, entre.b + 1) > (1 - q) / 2 + 1e-12) falla(`${tag} entre colas pasan`);
      // ida y vuelta con x
      const vuelta = calcular(d, P, { modo: 'izq', origen: 'x', x: izq.x });
      if (Math.abs(vuelta.prob - F(d, P, izq.x)) > 1e-15) falla(`${tag} vuelta`);
    }
  }
}

for (const d of LISTA.filter((d) => !d.discreta)) {
  const P = Object.fromEntries(d.params.map((p) => [p.id, p.defecto]));
  for (const q of QS) {
    for (const modo of ['izq', 'der', 'entre', 'colas']) {
      total++;
      const r = calcular(d, P, { modo, origen: 'p', p: q });
      if (Math.abs(r.prob - q) > 1e-10 * Math.max(1, q)) falla(`${d.id} ${modo} q=${q} prob=${r.prob}`);
      const vuelta = calcular(d, P, { modo, origen: 'x', ...r });
      if (Math.abs(vuelta.prob - q) > 1e-10) falla(`${d.id} ${modo} ida y vuelta ${vuelta.prob}`);
    }
  }
}
// Casos de tabla conocidos (valores de scipy: stats.norm.cdf(12,10,2), t.ppf(0.975,15), chi2.ppf(0.025,24), f.ppf(0.95,5,10), binom.sf(4,20,0.1), poisson.cdf(8,4))
const conocido = [
  [DISTRIBUCIONES.normal, { mu: 10, sigma: 2 }, { modo: 'izq', origen: 'x', x: 12 }, 0.8413447460685429],
  [DISTRIBUCIONES.t, { nu: 15 }, { modo: 'izq', origen: 'p', p: 0.975 }, 2.131449545559776, 'x'],
  [DISTRIBUCIONES.chi2, { nu: 24 }, { modo: 'colas', origen: 'p', p: 0.05 }, 12.401150217444433, 'a'],
  [DISTRIBUCIONES.f, { nu1: 5, nu2: 10 }, { modo: 'izq', origen: 'p', p: 0.95 }, 3.3258345304130104, 'x'],
  [DISTRIBUCIONES.binomial, { n: 20, p: 0.1 }, { modo: 'der', origen: 'x', x: 5 }, 0.04317449528446339],
  [DISTRIBUCIONES.poisson, { m: 4 }, { modo: 'izq', origen: 'x', x: 8 }, 0.9786365655120158],
];
for (const [d, P, e, esperado, campo = 'prob'] of conocido) {
  total++;
  const v = calcular(d, P, e)[campo];
  if (Math.abs(v - esperado) > 1e-12 * Math.abs(esperado)) falla(`conocido ${d.id} ${campo}=${v} esperado ${esperado}`);
}
console.log(`${total} chequeos, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
