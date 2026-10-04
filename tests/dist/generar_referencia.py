#!/usr/bin/env python3
"""Genera tests/dist/referencia.json con valores de scipy para validar js/dist.

Uso (desde la raíz del proyecto calcu):
    /ruta/a/python-con-scipy tests/dist/generar_referencia.py
"""
import json
import math
import os
import sys
from decimal import Decimal, localcontext
from fractions import Fraction
from math import comb

import numpy as np
import scipy
from scipy import optimize, special, stats

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, 'referencia.json')

# Misma tolerancia de empate que distribuciones.js para cuantiles discretos
TOL_DISCRETA = 1e-12

NIVELES_X = [1e-300, 1e-200, 1e-100, 1e-50, 1e-20, 1e-12, 1e-8, 1e-5, 1e-3,
             0.01, 0.05, 0.2, 0.4]
QS = [1e-300, 1e-100, 1e-12, 1e-6, 0.001, 0.025, 0.05, 0.1, 0.3, 0.5, 0.7,
      0.9, 0.95, 0.975, 0.99, 0.999, 1 - 1e-6]


def L(**kw):
    return kw


# (parámetros, ordinario). "ordinario" = caso de cátedra que debe dar 1e-10.
CASOS = {
    'normal': [(L(mu=0, sigma=1), True), (L(mu=100, sigma=15), True),
               (L(mu=-2.5, sigma=0.3), True), (L(mu=1e4, sigma=250), True)],
    't': [(L(nu=v), v in (1, 2, 3.7, 10, 30))
          for v in (0.5, 1, 2, 3.7, 10, 30, 1e4, 1e6)],
    'chi2': [(L(nu=v), v in (1, 2, 5, 10, 150, 200))
             for v in (0.5, 1, 2, 5, 10, 150, 200, 1000, 1e5)],
    'f': [(L(nu1=a, nu2=b), (a, b) in ((2, 3), (5, 10), (30, 40), (100, 100)))
          for a, b in ((1, 1), (2, 3), (5, 10), (30, 40), (1, 1e4), (100, 100),
                       (0.7, 2.5))],
    'binomial': [(L(n=n, p=p), n <= 1000 and 0.01 <= p <= 0.99)
                 for n, p in ((1, 0.5), (1, 0.001), (10, 0.5), (10, 0.0),
                              (10, 1.0), (10, 0.999), (30, 0.1), (100, 0.001),
                              (100, 0.25), (1000, 0.5), (1000, 0.999),
                              (100000, 0.001), (100000, 0.5), (100000, 0.999))],
    'poisson': [(L(m=v), v in (1, 4, 50, 1000))
                for v in (0.01, 1, 4, 50, 1000, 1e5)],
    'hipergeometrica': [(L(N=N, R=R, n=n), False)
                        for N, R, n in ((20, 7, 5), (50, 10, 20), (1000, 300, 100),
                                        (1000, 500, 900), (1000, 7, 500), (10, 10, 3),
                                        (10, 0, 3), (5, 2, 5))],
    'geometrica': [(L(p=v), False) for v in (0.3, 0.5, 0.01, 0.999, 1.0, 1e-4)],
    'pascal': [(L(r=r, p=p), False)
               for r, p in ((3, 0.4), (1, 0.5), (10, 0.05), (50, 0.9), (5, 1.0),
                            (200, 0.3))],
    'exponencial': [({'lambda': v}, False) for v in (1, 0.25, 30)],
    'uniforme': [(L(a=0, b=1), False), (L(a=-3, b=7), False), (L(a=2.5, b=2.6), False)],
    'gamma': [({'r': r, 'lambda': l}, False)
              for r, l in ((2, 1), (0.05, 1), (0.5, 3), (5, 0.2), (150, 2), (1e4, 1),
                           (1, 1))],
    'beta': [(L(alfa=a, beta=b), False)
             for a, b in ((2, 5), (0.5, 0.5), (0.1, 3), (1, 1), (50, 200),
                          (1000, 1000), (5, 0.2), (2000, 3))],
    'weibull': [({'k': k, 'lambda': l}, False)
                for k, l in ((1.5, 1), (0.5, 2), (5, 10), (1, 1))],
    'lognormal': [(L(mu=m, sigma=s), False)
                  for m, s in ((0, 0.5), (1, 1), (-2, 0.1), (3, 2))],
}

DISCRETAS = {'binomial', 'poisson', 'hipergeometrica', 'geometrica', 'pascal'}


def congelada(dist, p):
    if dist == 'normal':
        return stats.norm(loc=p['mu'], scale=p['sigma'])
    if dist == 't':
        return stats.t(df=p['nu'])
    if dist == 'chi2':
        return stats.chi2(df=p['nu'])
    if dist == 'f':
        return stats.f(dfn=p['nu1'], dfd=p['nu2'])
    if dist == 'binomial':
        return stats.binom(n=p['n'], p=p['p'])
    if dist == 'poisson':
        return stats.poisson(mu=p['m'])
    if dist == 'hipergeometrica':
        return stats.hypergeom(M=p['N'], n=p['R'], N=p['n'])
    if dist == 'geometrica':
        return stats.geom(p=p['p'])  # scipy ya cuenta pruebas
    if dist == 'pascal':
        return stats.nbinom(n=p['r'], p=p['p'], loc=p['r'])  # fracasos + r = pruebas
    if dist == 'exponencial':
        return stats.expon(scale=1 / p['lambda'])
    if dist == 'uniforme':
        return stats.uniform(loc=p['a'], scale=p['b'] - p['a'])
    if dist == 'gamma':
        return stats.gamma(a=p['r'], scale=1 / p['lambda'])
    if dist == 'beta':
        return stats.beta(p['alfa'], p['beta'])
    if dist == 'weibull':
        return stats.weibull_min(c=p['k'], scale=p['lambda'])
    if dist == 'lognormal':
        return stats.lognorm(s=p['sigma'], scale=math.exp(p['mu']))
    raise ValueError(dist)


def soporte(dist, p):
    if dist == 'binomial':
        if p['p'] == 0:
            return 0, 0
        if p['p'] == 1:
            return p['n'], p['n']
        return 0, p['n']
    if dist == 'poisson':
        return 0, math.inf
    if dist == 'hipergeometrica':
        return max(0, p['n'] - (p['N'] - p['R'])), min(p['n'], p['R'])
    if dist == 'geometrica':
        return (1, 1) if p['p'] == 1 else (1, math.inf)
    if dist == 'pascal':
        return (p['r'], p['r']) if p['p'] == 1 else (p['r'], math.inf)
    if dist in ('normal', 't'):
        return -math.inf, math.inf
    if dist == 'uniforme':
        return p['a'], p['b']
    if dist == 'beta':
        return 0.0, 1.0
    return 0.0, math.inf


def f(v):
    v = float(v)
    if math.isnan(v):
        return 'nan'
    if math.isinf(v):
        return 'inf' if v > 0 else '-inf'
    return v


def buscar_menor(cond, k0, lo, hi):
    k = lo if not math.isfinite(k0) else int(round(k0))
    k = min(max(k, lo), hi)
    if cond(k):
        b, paso = k, 1
        while True:
            if b <= lo:
                return lo
            a = max(b - paso, lo)
            if not cond(a):
                break
            b, paso = a, paso * 2
    else:
        a, paso = k, 1
        while True:
            if a >= hi:
                return hi
            b = min(a + paso, hi)
            if cond(b):
                break
            a, paso = b, paso * 2
    while b - a > 1:
        m = (a + b) // 2
        if cond(m):
            b = m
        else:
            a = m
    return b


def grilla_x_continua(fr, lo, hi):
    xs = set()
    for nivel in NIVELES_X:
        for x, cola in ((fr.ppf(nivel), fr.cdf), (fr.isf(nivel), fr.sf)):
            x = float(x)
            # sólo donde scipy es coherente consigo mismo (p. ej. t.cdf da 0 si t² desborda)
            if math.isfinite(x) and abs(float(cola(x)) / nivel - 1) < 1e-6:
                xs.add(x)
                xs.add(float('%.3g' % x))
    xs.add(float(fr.median()))
    if math.isfinite(lo):
        xs.add(lo)
    if math.isfinite(hi):
        xs.add(hi)
    return sorted(x for x in xs if lo <= x <= hi and math.isfinite(x))


def grilla_x_discreta(fr, lo, hi):
    if hi - lo <= 100:
        xs = set(range(int(lo), int(hi) + 1))
    else:
        xs = set(range(int(lo), int(lo) + 6))
        med = int(fr.median())
        xs.update(range(med - 3, med + 4))
        if math.isfinite(hi):
            xs.update(range(int(hi) - 5, int(hi) + 1))
        for nivel in NIVELES_X:
            for x in (fr.ppf(nivel), fr.isf(nivel)):
                if math.isfinite(x):
                    xs.add(int(x))
                    xs.add(int(x) + 1)
    xs = {int(x) for x in xs if lo <= x <= hi}
    extra = {int(lo) - 1, int(lo) + 0.5, sorted(xs)[len(xs) // 2] + 0.25}
    if math.isfinite(hi):
        extra.add(int(hi) + 1)
    return sorted(list(xs) + [float(x) for x in extra])


def _cola(fr, x, superior):
    return float(fr.sf(x) if superior else fr.cdf(x))


def _consistente(fr, x, objetivo, superior, lo, hi):
    """¿x está a menos de 1e-12 (relativo) de la raíz de cola(x) = objetivo, según scipy?

    Se mira que el objetivo quede entre cola(x·(1 − 1e-12)) y cola(x·(1 + 1e-12)).
    Si x es un borde del soporte (0, 1, ±inf), basta con que la raíz quede más allá
    del double vecino: el borde es entonces el valor correctamente redondeado.
    """
    if x is None or math.isnan(x):
        return False
    creciente = not superior
    if x <= lo or x >= hi:
        if x <= lo:
            vecino = 5e-324 if lo == 0 else (-1.7976931348623157e308 if lo == -math.inf else math.nextafter(lo, math.inf))
        else:
            vecino = 1.7976931348623157e308 if hi == math.inf else math.nextafter(hi, -math.inf)
        c = _cola(fr, vecino, superior)
        if math.isnan(c):
            return False
        borde_abajo = x <= lo
        return (c >= objetivo) == (creciente == borde_abajo)
    # paso relativo a la distancia al borde más cercano (importa en beta cerca de 1)
    dist_borde = min(abs(x - lo) if math.isfinite(lo) else abs(x), hi - x)
    d = max(1e-12 * min(abs(x), dist_borde), 4 * math.ulp(x))
    c1, c2 = _cola(fr, x - d, superior), _cola(fr, x + d, superior)
    if not (c1 > 0 and c2 > 0):  # nan o 0: scipy no da un valor usable acá
        return False
    # un salto grande entre c1 y c2 delata una discontinuidad numérica de scipy
    return min(c1, c2) <= objetivo <= max(c1, c2) and abs(math.log(c1 / c2)) < 0.01


def _refinar(fr, x0, objetivo, superior, lo, hi):
    """Raíz de log(cola(x)) = log(objetivo) con brentq sobre la cdf/sf de scipy."""
    def g(x):
        c = _cola(fr, x, superior)
        if math.isnan(c):
            raise ValueError('scipy devolvió nan')
        return math.log(max(c, 1e-320)) - math.log(objetivo)

    if not math.isfinite(x0) or not (lo < x0 < hi):
        x0 = float(fr.median())
    def escalar(v, k):
        try:
            return math.ldexp(v, k)
        except OverflowError:
            return math.copysign(1.7e308, v)

    positiva = lo == 0
    for k in range(1, 2200):
        if positiva:
            a, b = max(escalar(x0, -k), 5e-324), min(escalar(x0, k), 1.7e308)
        else:
            d = escalar(max(1.0, abs(x0)), k)
            a, b = max(x0 - d, -1.7e308), min(x0 + d, 1.7e308)
        if math.isfinite(hi):
            b = min(b, hi)
        if math.isfinite(lo):
            a = max(a, lo)
        if g(a) * g(b) < 0:
            break
    else:
        return math.nan
    x = optimize.brentq(g, a, b, xtol=1e-320, rtol=8.9e-16, maxiter=2000)
    signo = -1 if superior else 1
    for _ in range(4):  # Newton para pulir el último bit
        c = _cola(fr, x, superior)
        d = float(fr.pdf(x))
        if not (d > 0 and c > 0):
            break
        xn = x - signo * (c - objetivo) / d
        if abs(math.log(_cola(fr, xn, superior) / objetivo)) < abs(math.log(c / objetivo)):
            x = xn
        else:
            break
    return x


def cuantil_continuo(fr, q, inferior, lo, hi):
    """ppf (inferior) o isf de scipy, verificado contra su propia cdf/sf.

    Si scipy no es consistente consigo mismo (pasa en colas extremas de t, F y
    beta), se recalcula con brentq sobre la cdf/sf de scipy; si tampoco se puede,
    el punto se descarta.
    """
    x = float(fr.ppf(q) if inferior else fr.isf(q))
    # se verifica con la cola chica: 1 − q es exacto para q ≥ ½
    if q <= 0.5:
        objetivo, superior = q, not inferior
    else:
        objetivo, superior = 1 - q, inferior
    if _consistente(fr, x, objetivo, superior, lo, hi):
        return x, None
    try:
        x2 = _refinar(fr, x, objetivo, superior, lo, hi)
    except (ValueError, RuntimeError):
        x2 = math.nan
    if _consistente(fr, x2, objetivo, superior, lo, hi):
        return x2, f'scipy={x!r} corregido a {x2!r}'
    return None, f'descartado (scipy={x!r})'


def cuantiles_discretos(fr, lo, hi, q, inferior):
    """Menor k del soporte con cdf(k) ≥ q (inferior) o con sf(k) ≤ q.

    Se usa la cdf/sf de scipy con la misma tolerancia de empate que el código JS;
    el punto de partida es ppf/isf de scipy.
    """
    def cdf(k):
        return 1.0 if k >= hi else float(fr.cdf(k))

    def sf(k):
        return 0.0 if k >= hi else float(fr.sf(k))

    # para q > ½ se usa la otra cola con 1 − q, que es exacto
    if inferior:
        if q <= 0.5:
            cond = lambda k: cdf(k) >= q * (1 - TOL_DISCRETA)
        else:
            cond = lambda k: sf(k) <= (1 - q) * (1 + TOL_DISCRETA)
    elif q <= 0.5:
        cond = lambda k: sf(k) <= q * (1 + TOL_DISCRETA)
    else:
        cond = lambda k: cdf(k) >= (1 - q) * (1 - TOL_DISCRETA)
    k0 = float(fr.ppf(q) if inferior else fr.isf(q))
    k = buscar_menor(cond, k0, lo, hi)
    return k, k0


def caso(dist, p, ordinario):
    fr = congelada(dist, p)
    lo, hi = soporte(dist, p)
    discreta = dist in DISCRETAS
    xs = grilla_x_discreta(fr, lo, hi) if discreta else grilla_x_continua(fr, lo, hi)
    if discreta:
        # hypergeom de scipy da nan en x no entero; cdf(x) = cdf(⌊x⌋)
        pdfs = [fr.pmf(x) if x == int(x) else 0.0 for x in xs]
        cdfs = [fr.cdf(math.floor(x)) for x in xs]
        sfs = [fr.sf(math.floor(x)) for x in xs]
    elif dist == 'uniforme':
        # cuentas exactas: scipy calcula sf = 1 − cdf y pierde dígitos cerca de b
        a, b = Fraction(p['a']), Fraction(p['b'])
        pdfs = [fr.pdf(x) for x in xs]
        cdfs = [float((Fraction(x) - a) / (b - a)) for x in xs]
        sfs = [float((b - Fraction(x)) / (b - a)) for x in xs]
    else:
        pdfs = [fr.pdf(x) for x in xs]
        cdfs = [fr.cdf(x) for x in xs]
        sfs = [fr.sf(x) for x in xs]
    salida = {
        'dist': dist, 'params': p, 'ordinario': ordinario,
        'x': [f(x) for x in xs],
        'pdf': [f(v) for v in pdfs],
        'cdf': [f(v) for v in cdfs],
        'sf': [f(v) for v in sfs],
    }
    qs, ppf, isf, avisos = [], [], [], []
    for q in QS:
        if discreta:
            if q < 1e-200:
                continue
            k1, s1 = cuantiles_discretos(fr, lo, hi, q, True)
            k2, s2 = cuantiles_discretos(fr, lo, hi, q, False)
            if k1 != s1 or k2 != s2:
                avisos.append(f'q={q}: ppf scipy={s1} ref={k1}; isf scipy={s2} ref={k2}')
            qs.append(q)
            ppf.append(f(k1))
            isf.append(f(k2))
        elif dist == 'uniforme':
            a, b = Fraction(p['a']), Fraction(p['b'])
            qs.append(q)
            ppf.append(float(a + Fraction(q) * (b - a)))
            isf.append(float(b - Fraction(q) * (b - a)))
        else:
            x1, n1 = cuantil_continuo(fr, q, True, lo, hi)
            x2, n2 = cuantil_continuo(fr, q, False, lo, hi)
            for nombre, nota in (('ppf', n1), ('isf', n2)):
                if nota:
                    avisos.append(f'{nombre}(q={q}): {nota}')
            qs.append(q)
            ppf.append(f(x1) if x1 is not None else None)
            isf.append(f(x2) if x2 is not None else None)
    salida.update(q=qs, ppf=ppf, isf=isf)
    m, v = fr.stats('mv')
    salida['media'] = f(m)
    salida['varianza'] = f(v)
    if avisos:
        salida['avisos'] = avisos
    return salida


# ---------------------------------------------------------------------------
# Árbitro de alta precisión (decimal, 60 dígitos), independiente de scipy.
# scipy calcula varias densidades restando log-gammas grandes (χ² con ν = 1e5,
# Poisson con m = 1e5, …) y algunos cuantiles extremos le fallan; para esos
# casos se agrega esta segunda referencia. Mismos algoritmos clásicos (Stirling,
# serie y fracción continua), pero con 60 dígitos el redondeo no influye.

PREC = 60
PI = Decimal('3.14159265358979323846264338327950288419716939937510582097494459230781640628620899863')
UMBRAL = Decimal(10) ** -58
DIMINUTO = Decimal(10) ** -900


def _ctx():
    return localcontext(prec=PREC, Emin=-999999, Emax=999999)


def _bernoulli_pares(n):
    B = [Fraction(1)]
    for m in range(1, 2 * n + 1):
        B.append(-sum(comb(m + 1, k) * B[k] for k in range(m)) / (m + 1))
    return [B[2 * k] for k in range(1, n + 1)]


with _ctx():
    LN_SQRT_2PI = (2 * PI).ln() / 2
    COEF_STIRLING = [Decimal(b.numerator) / Decimal(b.denominator) / (2 * k * (2 * k - 1))
                     for k, b in enumerate(_bernoulli_pares(25), 1)]


def ap_lgam(z):
    z = Decimal(z)
    corr = Decimal(0)
    while z < 60:
        corr -= z.ln()
        z += 1
    s = (z - Decimal('0.5')) * z.ln() - z + LN_SQRT_2PI
    z2, pot = z * z, z
    for c in COEF_STIRLING:
        s += c / pot
        pot *= z2
    return s + corr


def ap_gamma(a, x):
    """[P(a,x), Q(a,x)] regularizadas."""
    if x <= 0:
        return Decimal(0), Decimal(1)
    if x < a + 1:
        lpre = a * x.ln() - x - ap_lgam(a + 1)
        term = suma = Decimal(1)
        n = 1
        while True:
            term *= x / (a + n)
            suma += term
            if term * x <= suma * UMBRAL * (a + n + 1 - x):
                break
            n += 1
        p = lpre.exp() * suma
        return p, 1 - p
    lpre = a * x.ln() - x - ap_lgam(a)
    b = x + 1 - a
    c, d = 1 / DIMINUTO, 1 / b
    h, i = d, 1
    while True:
        an = -i * (i - a)
        b += 2
        d = an * d + b
        d = d if abs(d) > DIMINUTO else DIMINUTO
        c = b + an / c
        c = c if abs(c) > DIMINUTO else DIMINUTO
        d = 1 / d
        de = d * c
        h *= de
        if abs(de - 1) < UMBRAL:
            break
        i += 1
    q = lpre.exp() * h
    return 1 - q, q


def _ap_fcbeta(x, y, a, b):
    lpre = a * x.ln() + b * y.ln() - (ap_lgam(a) + ap_lgam(b) - ap_lgam(a + b))
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = Decimal(1), 1 - qab * x / qap
    d = 1 / (d if abs(d) > DIMINUTO else DIMINUTO)
    h, m = d, 1
    while True:
        m2 = 2 * m
        for aa in (m * (b - m) * x / ((qam + m2) * (a + m2)),
                   -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))):
            d = 1 + aa * d
            d = d if abs(d) > DIMINUTO else DIMINUTO
            c = 1 + aa / c
            c = c if abs(c) > DIMINUTO else DIMINUTO
            d = 1 / d
            de = d * c
            h *= de
        if abs(de - 1) < UMBRAL:
            break
        m += 1
    return lpre.exp() * h / a


def ap_beta(x, y, a, b):
    """[I_x(a,b), 1 − I_x(a,b)] con x + y = 1 exactos en decimal."""
    if x <= 0:
        return Decimal(0), Decimal(1)
    if y <= 0:
        return Decimal(1), Decimal(0)
    if x > (a + 1) / (a + b + 2):
        w = _ap_fcbeta(y, x, b, a)
        return 1 - w, w
    w = _ap_fcbeta(x, y, a, b)
    return w, 1 - w


def ap_valores(dist, p, x):
    """(pdf, cdf, sf) en alta precisión, o None si la distribución no está cubierta."""
    with _ctx():
        D = Decimal
        x = D(x)
        if dist == 't':
            nu = D(p['nu'])
            t2 = x * x
            pdf = (ap_lgam((nu + 1) / 2) - ap_lgam(nu / 2) - (nu * PI).ln() / 2
                   - (nu + 1) / 2 * (1 + t2 / nu).ln()).exp()
            if x == 0:
                return pdf, D('0.5'), D('0.5')
            I, _ = ap_beta(nu / (nu + t2), t2 / (nu + t2), nu / 2, D('0.5'))
            cola = I / 2
            return (pdf, cola, 1 - cola) if x < 0 else (pdf, 1 - cola, cola)
        if dist in ('chi2', 'gamma'):
            a, lam = (D(p['nu']) / 2, D('0.5')) if dist == 'chi2' else (D(p['r']), D(p['lambda']))
            if x <= 0:
                return None
            z = lam * x
            pdf = lam * ((a - 1) * z.ln() - z - ap_lgam(a)).exp()
            P, Q = ap_gamma(a, z)
            return pdf, P, Q
        if dist in ('f', 'beta'):
            if dist == 'f':
                n1, n2 = D(p['nu1']), D(p['nu2'])
                if x <= 0:
                    return None
                u, v = n1 * x / (n1 * x + n2), n2 / (n1 * x + n2)
                a, b = n1 / 2, n2 / 2
                jac = n1 * n2 / (n1 * x + n2) ** 2
            else:
                a, b = D(p['alfa']), D(p['beta'])
                if not (0 < x < 1):
                    return None
                u, v, jac = x, 1 - x, D(1)
            lB = ap_lgam(a) + ap_lgam(b) - ap_lgam(a + b)
            pdf = ((a - 1) * u.ln() + (b - 1) * v.ln() - lB).exp() * jac
            I, Ic = ap_beta(u, v, a, b)
            return pdf, I, Ic
        if dist in ('binomial', 'poisson', 'pascal', 'hipergeometrica'):
            if x != x.to_integral_value():
                return None
            k = int(x)
            if dist == 'binomial':
                n, pr = p['n'], D(p['p'])
                if not (0 < pr < 1) or not (0 <= k < n):
                    return None
                q = 1 - pr
                pmf = (ap_lgam(n + 1) - ap_lgam(k + 1) - ap_lgam(n - k + 1)
                       + k * pr.ln() + (n - k) * q.ln()).exp()
                cdf, sf = ap_beta(q, pr, D(n - k), D(k + 1))
                return pmf, cdf, sf
            if dist == 'poisson':
                m = D(p['m'])
                if k < 0:
                    return None
                pmf = (k * m.ln() - m - ap_lgam(k + 1)).exp()
                P, Q = ap_gamma(D(k + 1), m)
                return pmf, Q, P
            if dist == 'pascal':
                r, pr = p['r'], D(p['p'])
                if not (0 < pr < 1) or k < r:
                    return None
                q = 1 - pr
                pmf = (ap_lgam(k) - ap_lgam(r) - ap_lgam(k - r + 1)
                       + r * pr.ln() + (k - r) * q.ln()).exp()
                cdf, sf = ap_beta(pr, q, D(r), D(k - r + 1))
                return pmf, cdf, sf
            N, R, n = p['N'], p['R'], p['n']
            lo, hi = max(0, n - (N - R)), min(n, R)
            if not (lo <= k <= hi):
                return None
            tot = comb(N, n)
            masa = [Fraction(comb(R, j) * comb(N - R, n - j), tot) for j in range(lo, hi + 1)]
            cdf = sum(masa[: k - lo + 1], Fraction(0))
            frac = lambda f: D(f.numerator) / D(f.denominator)
            return frac(masa[k - lo]), frac(cdf), frac(1 - cdf)
    return None


def ap_cuantil(dist, p, q, inferior):
    """Cuantil extremo por bisección en log x con la cdf/sf de alta precisión."""
    with _ctx():
        q = Decimal(q)
        i = 1 if inferior else 2
        signo = -1 if (dist == 't' and inferior) else 1

        def cola(u):
            v = ap_valores(dist, p, signo * u.exp())
            if v is None:  # fuera del soporte (beta con x ≥ 1)
                return Decimal(1) if inferior else Decimal(0)
            return v[i] if inferior else v[2]

        lo, hi = Decimal(-2500), Decimal(0 if dist == 'beta' else 2500)  # en log|x|
        creciente = inferior and dist != 't'
        for _ in range(400):
            mid = (lo + hi) / 2
            c = cola(mid)
            if (c < q) == creciente:
                lo = mid
            else:
                hi = mid
            if hi - lo < Decimal(10) ** -25:
                break
        return float(signo * ((lo + hi) / 2).exp())


# casos (dist, params) de CASOS que se recalculan en alta precisión
AP_CASOS = {
    't': lambda p: True,
    'chi2': lambda p: True,
    'f': lambda p: True,
    'gamma': lambda p: True,
    'beta': lambda p: True,
    'binomial': lambda p: 0 < p['p'] < 1,
    'poisson': lambda p: True,
    'pascal': lambda p: 0 < p['p'] < 1,
    'hipergeometrica': lambda p: True,
}

# cuantiles extremos que scipy no da bien: (dist, params, q, inferior)
AP_CUANTILES = [
    ('t', {'nu': 0.5}, 1e-100, True), ('t', {'nu': 0.5}, 1e-100, False),
    ('t', {'nu': 0.5}, 1e-300, False), ('t', {'nu': 1}, 1e-300, True),
    ('t', {'nu': 1}, 1e-100, False), ('t', {'nu': 3.7}, 1e-300, False),
    ('t', {'nu': 10}, 1e-300, True), ('t', {'nu': 1e6}, 1e-300, False),
    ('chi2', {'nu': 0.5}, 1e-100, True), ('chi2', {'nu': 1}, 1e-300, True),
    ('chi2', {'nu': 1}, 1e-100, True), ('chi2', {'nu': 1e5}, 1e-300, False),
    ('f', {'nu1': 1, 'nu2': 1}, 1e-300, False), ('f', {'nu1': 1, 'nu2': 1}, 1e-12, False),
    ('f', {'nu1': 5, 'nu2': 10}, 1e-300, True), ('f', {'nu1': 1, 'nu2': 1e4}, 1e-300, True),
    ('f', {'nu1': 0.7, 'nu2': 2.5}, 1e-300, True), ('f', {'nu1': 2, 'nu2': 3}, 1e-300, False),
    ('gamma', {'r': 0.05, 'lambda': 1}, 1e-100, True), ('gamma', {'r': 1e4, 'lambda': 1}, 1e-300, True),
    ('beta', {'alfa': 0.1, 'beta': 3}, 1e-100, True), ('beta', {'alfa': 2, 'beta': 5}, 1e-300, True),
    ('beta', {'alfa': 5, 'beta': 0.2}, 1e-300, True),
]


def alta_precision(casos):
    filas = []
    discrepancias = {}
    for c in casos:
        dist, p = c['dist'], c['params']
        if dist not in AP_CASOS or not AP_CASOS[dist](p):
            continue
        for j, x in enumerate(c['x']):
            if not isinstance(x, float) and not isinstance(x, int):
                continue
            v = ap_valores(dist, p, x)
            if v is None:
                continue
            vals = [float(t) for t in v]
            filas.append({'dist': dist, 'params': p, 'x': x, 'pdf': f(vals[0]),
                          'cdf': f(vals[1]), 'sf': f(vals[2])})
            # cuánto se aparta scipy del árbitro (sólo informativo)
            for nombre, vap in zip(('pdf', 'cdf', 'sf'), vals):
                vs = c[nombre][j]
                if isinstance(vs, float) and vap >= 1e-300:
                    e = abs(vs - vap) / vap
                    clave = (dist, nombre)
                    if e > discrepancias.get(clave, (0,))[0]:
                        discrepancias[clave] = (e, p, x)
    cuantiles = []
    for dist, p, q, inferior in AP_CUANTILES:
        cuantiles.append({'dist': dist, 'params': p, 'q': q,
                          'funcion': 'ppf' if inferior else 'isf',
                          'valor': f(ap_cuantil(dist, p, q, inferior))})
    return {'valores': filas, 'cuantiles': cuantiles}, discrepancias


def especiales():
    """Valores de funciones especiales para diagnosticar especiales.js."""
    xs = [1e-300, 1e-10, 1e-3, 0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 2.5, 3, 3.9, 4.5,
          7.3, 9.99, 10, 15.5, 26, 100, 1e5, 1e10, 1e300]
    ex = [-30, -27, -10, -5, -4, -2, -1, -0.5, -0.46875, -0.3, -1e-5, 0, 1e-5,
          0.2, 0.46875, 0.5, 1, 2, 3.9, 4, 4.1, 6, 10, 20, 26, 27]
    zs = [-38, -37, -30, -20, -10, -8, -6, -5.6, -5, -3, -1, -0.67, -0.6, -0.1,
          -1e-9, 0, 1e-9, 0.3, 0.67448975, 0.7, 2, 5, 5.66, 6, 9, 20, 37]
    ps = [1e-300, 1e-100, 1e-20, 1e-12, 1e-11, 1e-6, 1e-3, 0.01, 0.02425, 0.07,
          0.075, 0.2, 0.3, 0.4, 0.5, 0.6, 0.9, 0.92, 0.95, 0.99, 0.999, 1 - 1e-6,
          1 - 1e-12]
    g = []
    for a in (0.01, 0.1, 0.25, 0.5, 1, 2.5, 10, 50.5, 1000, 5e4, 1e5):
        for x in (1e-5 * a, 0.1 * a, 0.5 * a, 0.9 * a, a, a + 1, 1.1 * a + 1,
                  2 * a + 2, 5 * a + 10, 30 * a + 30):
            g.append([a, x, f(special.gammainc(a, x)), f(special.gammaincc(a, x))])
    b = []
    for a, bb in ((0.5, 0.5), (0.1, 3), (2, 5), (5, 2), (50, 200), (5e4, 5e4 + 1),
                  (5e5, 0.5), (0.5, 5e5), (1000, 3), (0.25, 0.5), (1, 1)):
        m = a / (a + bb)
        for x in (1e-8, 1e-3, 0.5 * m, 0.9 * m, m, min(1.1 * m, (1 + m) / 2),
                  (1 + m) / 2, 1 - 1e-3, 1 - 1e-6):
            b.append([a, bb, x, f(special.betainc(a, bb, x)), f(special.betaincc(a, bb, x))])
    lb = [[a, bb, f(special.betaln(a, bb))]
          for a, bb in ((0.5, 0.5), (1, 1), (2.5, 7), (0.1, 30), (15, 0.3), (50, 60),
                        (1e5, 0.5), (1e6, 1e6), (3, 1e8))]
    return {
        'lgamma': [[x, f(special.gammaln(x))] for x in xs],
        'erf': [[x, f(special.erf(x))] for x in ex],
        'erfc': [[x, f(special.erfc(x))] for x in ex],
        'normCdf': [[z, f(special.ndtr(z))] for z in zs],
        'normPpf': [[p, f(special.ndtri(p))] for p in ps],
        'gammaInc': g,
        'betaInc': b,
        'lbeta': lb,
    }


def main():
    casos = []
    for dist, lista in CASOS.items():
        for p, ordinario in lista:
            c = caso(dist, p, ordinario)
            for a in c.get('avisos', []):
                print(f'  aviso {dist} {p}: {a}')
            casos.append(c)
    ap, disc = alta_precision(casos)
    print('scipy contra el árbitro de alta precisión (peor error relativo):')
    for (dist, nombre), (e, p, x) in sorted(disc.items()):
        if e > 1e-13:
            print(f'  {dist:16s} {nombre:4s} {e:.2e}  {p} x={x}')
    datos = {
        'generador': 'tests/dist/generar_referencia.py',
        'scipy': scipy.__version__,
        'numpy': np.__version__,
        'python': sys.version.split()[0],
        'casos': casos,
        'especiales': especiales(),
        'alta_precision': ap,
    }
    with open(SALIDA, 'w') as fh:
        json.dump(datos, fh, allow_nan=False, separators=(',', ':'))
    n = sum(len(c['x']) * 3 + len(c['q']) * 2 for c in casos)
    print(f'{len(casos)} casos, {n} valores -> {SALIDA}')


if __name__ == '__main__':
    main()
