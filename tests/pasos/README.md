# Validación de los pasos (`js/calc/pasos.js`)

```sh
node tests/pasos/validar.mjs                 # corre las ~2000 entradas (unos 5 s)
node tests/pasos/validar.mjs --verbose       # además imprime todos los pasos
node tests/pasos/validar.mjs --solo "\frac{1}{2}+\frac{1}{3}"   # prueba una sola entrada
```

Corre una lista a mano (todas tienen que dar pasos), una lista de casos que tienen que dar `null`, y expresiones, ecuaciones y sistemas generados al azar con semilla fija.
Para cada resultado verifica con Compute Engine que cada paso se pueda leer y valga lo mismo que la entrada (cálculos), que las soluciones coincidan con `solve` y que cada ecuación intermedia sea equivalente a la original (ecuaciones y sistemas). También dibuja cada paso con MathLive SSR y busca `NaN`, `undefined`, basura de coma flotante, pasos repetidos o `\textcolor` mal cerrados.
Sale con código 1 si hay alguna falla y la muestra con la entrada y el paso.
`--modulo otra/ruta/pasos.js` valida otra copia del motor (sirve para inyectar errores a propósito y comprobar que el validador los detecta).
