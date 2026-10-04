// Notación de la cátedra: F acumulada a izquierda, G a derecha (en las discretas G incluye a r),
// y fractiles nombrados por el nivel acumulado a IZQUIERDA: Z(0,975), t(0,975 ; 15).
import { numTex } from '../formato.js';

export const corto = (x) => numTex(x, { sig: 10 });
const sep = '\\,;\\,';

const ARGS = {
  t: (p) => [`${corto(p.nu)}`],
  chi2: (p) => [`${corto(p.nu)}`],
  f: (p) => [`${corto(p.nu1)}`, `${corto(p.nu2)}`],
  binomial: (p) => [`${corto(p.n)}`, `${corto(p.p)}`],
  poisson: (p) => [`${corto(p.m)}`],
  hipergeometrica: (p) => [`${corto(p.N)}`, `${corto(p.R)}`, `${corto(p.n)}`],
  geometrica: (p) => [`${corto(p.p)}`],
  pascal: (p) => [`${corto(p.r)}`, `${corto(p.p)}`],
  exponencial: (p) => [`${corto(p.lambda)}`],
  uniforme: (p) => [`${corto(p.a)}`, `${corto(p.b)}`],
  gamma: (p) => [`${corto(p.r)}`, `${corto(p.lambda)}`],
  beta: (p) => [`${corto(p.alfa)}`, `${corto(p.beta)}`],
  weibull: (p) => [`${corto(p.k)}`, `${corto(p.lambda)}`],
  lognormal: (p) => [`${corto(p.mu)}`, `${corto(p.sigma)}`],
  normal: (p) => [`${corto(p.mu)}`, `${corto(p.sigma)}`],
};

const SUBINDICE = {
  t: 't', chi2: '\\chi^2', f: 'F', binomial: 'b', poisson: 'p', hipergeometrica: 'h', geometrica: 'g', pascal: 'pa',
  exponencial: 'e', uniforme: 'u', gamma: '\\gamma', beta: '\\beta', weibull: 'w', lognormal: 'LN', normal: 'N',
};

export function esNormalEstandar(id, p) {
  return id === 'normal' && p.mu === 0 && p.sigma === 1;
}

export function notacion(id, p, discreta) {
  const args = ARGS[id](p);
  const sub = SUBINDICE[id];
  // Discretas: P_b(r | n ; p). Continuas: F_t(x ; nu).
  const fun = (letra) => (x) => discreta
    ? `${letra}_{${sub}}(${corto(x)}\\mid ${args.join(sep)})`
    : `${letra}_{${sub}}(${corto(x)}${sep}${args.join('\\,,\\,')})`;

  let F = fun('F'), G = fun('G');
  if (id === 'normal') {
    F = (z) => `\\Phi(${corto(z)})`;
    G = (z) => `1-\\Phi(${corto(z)})`;
  }

  const nivel = (q) => corto(q);
  const fractil = {
    normal: (q) => `Z_{(${nivel(q)})}`,
    t: (q) => `t_{(${nivel(q)}${sep}${args[0]})}`,
    chi2: (q) => `\\chi^2_{(${nivel(q)}${sep}${args[0]})}`,
    f: (q) => `F_{(${nivel(q)}${sep}${args[0]}\\,,\\,${args[1]})}`,
  }[id] ?? ((q) => `x_{(${nivel(q)})}`);

  return {
    variable: esNormalEstandar(id, p) ? 'Z' : 'X',
    F, G,
    P: (r) => `P_{${sub}}(${corto(r)}\\mid ${args.join(sep)})`,
    fractil,
    catedra: ['normal', 't', 'chi2', 'f', 'binomial', 'poisson', 'hipergeometrica', 'pascal', 'geometrica', 'gamma', 'exponencial'].includes(id),
  };
}
