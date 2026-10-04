# Validación de `js/dist`

`validar.mjs` compara `especiales.js` y `distribuciones.js` contra `referencia.json` y sale con código 1 si algo se pasa de tolerancia:

    node tests/dist/validar.mjs

Tolerancias: 1e-9 relativo en pdf/cdf/sf (absoluto 1e-300 debajo de 1e-300) y en ppf/isf; 1e-10 en los casos de cátedra (normal, t, χ², F, binomial, Poisson con parámetros comunes, q ∈ [1e-6, 1 − 1e-6]); igualdad exacta en cuantiles discretos; 1e-12 contra el árbitro de 60 dígitos. También chequea identidades (Pascal–binomial, gamma–Poisson), cdf + sf = 1, ida y vuelta ppf(cdf(x)), bordes, parámetros inválidos y un fuzz con semilla fija.

`referencia.json` sale de scipy y se regenera con el Python del proyecto hermano (tarda ~30 s):

    /Users/matirapo/Documents/calculadora-estadistica/.venv/bin/python tests/dist/generar_referencia.py

Además de scipy, el generador calcula con `decimal` (60 dígitos) los casos donde scipy no alcanza: densidades con parámetros grandes (χ² con ν = 1e5, Poisson con m = 1e5…) y cuantiles extremos. Los cuantiles de scipy se verifican contra su propia cdf/sf; si no cierran se recalculan con brentq o se descartan, y el generador lo avisa por consola.

Las excepciones de tolerancia y las convenciones donde se difiere de scipy (media de t con ν ≤ 1) están al principio de `validar.mjs`.
