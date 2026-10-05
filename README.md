# Calcu

Calculadora que anda **sin internet** en la compu y en el celu (es una PWA: se instala desde el navegador y queda
guardada). Dos partes:

- **Calculadora** al estilo Photomath: un teclado matemático propio con plantillas (fracción, potencia, raíz,
  valor absoluto, logaritmo en cualquier base, combinatorio, derivada, integral, límite, sumatoria), resultado en
  vivo mientras escribís y, al tocar **=**, la solución con sus formas (exacta, decimal, periódico, fracción, número
  mixto) y **los pasos** para las cuentas con fracciones y las ecuaciones de primer y segundo grado.
- **Distribuciones** al estilo de *Probability Distributions* (Bognar) y la calculadora de probabilidad de GeoGebra:
  Normal, t, χ², F, Binomial, Poisson, Hipergeométrica, Geométrica, Pascal, Exponencial, Uniforme, Gamma, Beta, Weibull
  y Lognormal, con el gráfico sombreado y el resultado en la notación de la cátedra.

## Cómo se usa

### Calculadora

- A la derecha siempre están los números y las cuatro operaciones; a la izquierda, la pestaña elegida:
  **123** (x, fracción, potencias, raíces, π, e, |x|, %, =, Ans, notación científica), **f(x)** (trigonométricas y sus
  inversas, grados °, log, ln, log en base b, eˣ, n!, combinatorio), **∫** (derivada, integrales, límite, sumatoria,
  ∞, i, número mixto, desigualdades, sistema de ecuaciones), **Z t χ²** (fractiles y normal acumulada) y **abc**
  (letras).
- **Z, t, χ², F y Φ dentro de las cuentas**, en notación de cátedra: `Z(0,975)`, `t(0,975 ; 15)`, `χ²(0,025 ; 24)`,
  `F(0,95 ; 5 ; 10)` como subíndice y `Φ(1,96)`. Los fractiles van por el nivel acumulado a **izquierda** y los datos
  se separan con punto y coma (pueden ser cuentas: `t(1 − 0,05/2 ; n − 1)` con números). Sirven en expresiones y en
  ecuaciones: `50 + Z(0,975)·10/√25`, `24·4,5²/χ²(0,975 ; 24)` o `Z(0,975)·10/√n = 2` para despejar n. La solución
  muestra los valores de tabla usados (con 6 decimales) y la cuenta se hace con el valor completo.
- La tecla de fracción toma lo que escribiste antes como numerador (como Photomath). Con **›** salís del casillero.
- En la compu se puede tipear: `/` arma la fracción, `^` la potencia, `sqrt` o `raiz` la raíz, `sen` o `sin` el
  seno, `pi` el π. **Enter** resuelve. La coma decimal es `,` (también acepta el punto).
- **DEG / RAD** arriba a la izquierda: unidad de los ángulos. En grados, `sen(x) = 1/2` da todas las soluciones de
  una vuelta (30° y 150°). Si escribís π dentro de un seno estando en grados, avisa.
- Qué resuelve: cuentas exactas (fracciones, radicales, potencias, trigonometría con valores notables, logaritmos,
  factorial, combinatorio, porcentaje, complejos), ecuaciones (también con raíces o trigonométricas; si no hay
  solución exacta, busca las aproximadas), inecuaciones, derivadas, integrales (indefinidas y definidas), límites y
  sumatorias, y simplifica, desarrolla y factoriza expresiones con letras.
- **Historial**: las últimas 60 cuentas resueltas quedan guardadas en ese navegador.

### Distribuciones

- Elegís la distribución y los parámetros; el modo: **P(X ≤ x)**, **P(X ≥ x)**, **P(a ≤ X ≤ b)** o **2 colas**.
- Funciona para los dos lados: escribís x y da la probabilidad, o escribís la probabilidad y da x (el fractil).
  En «entre» la probabilidad da el intervalo central y en «2 colas», α da los críticos de un ensayo bilateral.
- En los campos se pueden escribir cuentas: `1-0,05/2`, `68/40`, `raiz(2)`, `5%`. En el celu aparece un teclado
  numérico con signo menos, barra y paréntesis (el del sistema no los tiene).
- Resultado en notación de cátedra: `Φ(z)`, `F_t(x ; ν)`, `G_χ²`, fractiles por el nivel acumulado a **izquierda**
  (`Z(0,975)`, `t(0,975 ; 15)`, `χ²(0,025 ; 24)`, `F(0,95 ; ν₁, ν₂)`), y en las discretas `P_b`, `F_b`, `G_b` con
  **G incluyendo a r**: `G_b(r | n ; p) = P(X ≥ r)`. En la Normal con μ y σ cualesquiera muestra la estandarización.
- Discretas: con una probabilidad da el menor r con F(r) ≥ p (o, a derecha, el menor r con G(r) ≤ p) y muestra el
  vecino para justificarlo; **Ver tabla** muestra P, F y G alrededor del valor.
- χ² con ν > 150: además del exacto, la aproximación de la cátedra ½·[Z + √(2ν − 1)]². F: la propiedad recíproca.
- **Ajustes** (engranaje): cantidad de decimales (4 a 10) y tema claro/oscuro.

Convenciones de parámetros: Normal con σ (desvío, no varianza); Poisson con m (media); Pascal y Geométrica cuentan
**pruebas** (no fracasos); Hipergeométrica con N (población), R (éxitos en la población) y n (muestra); Gamma con
forma r y tasa λ; Exponencial con tasa λ.

## Instalarla en el celu y usarla sin conexión

Tiene que abrirse **una vez** desde una dirección `https` (o `localhost`): el navegador guarda todos los archivos y
después anda en modo avión. En **Ajustes** dice «✓ Lista para usar sin conexión» cuando ya quedó guardada.

- iPhone (Safari): Compartir → **Agregar a inicio**.
- Android (Chrome): menú ⋮ → **Instalar aplicación**.
- Compu (Chrome o Edge): el ícono de instalar en la barra de direcciones.

Para probarla en la compu sin publicarla:

```bash
npm run servir
```

y abrir <http://localhost:8790>. (Desde el celu por la red local no alcanza: sin `https` el navegador no guarda la
app para usarla sin conexión.)

## Precisión

Las probabilidades no salen de tablas: se calculan con las funciones exactas (gamma y beta incompletas, error
complementario) en `js/dist/`, y se validan contra scipy en miles de casos, incluidas las colas. Las cuentas de la
calculadora las hace [Compute Engine](https://cortexjs.io/compute-engine/) con aritmética exacta (fracciones y
radicales) y la entrada es [MathLive](https://cortexjs.io/mathlive/); las dos librerías están copiadas en `vendor/`,
así que no se baja nada de internet.

## Tests

```bash
node tests/dist/validar.mjs      # distribuciones contra scipy (y una referencia de 60 dígitos donde scipy falla)
node tests/dist/calculo.mjs      # inversas discretas contra fuerza bruta; en las continuas la zona da la probabilidad pedida
node tests/pasos/validar.mjs     # cada paso equivale al anterior y llega al resultado de Compute Engine
node tests/calc/validar.mjs      # qué resuelve la calculadora y con qué respuesta
node tests/campos/validar.mjs    # cuentas en los campos numéricos y formato con coma
```

Para regenerar la referencia de scipy: `tests/dist/README.md`. La interfaz se prueba con Chrome headless por CDP
(`tests/ui/cdp.mjs`), sin tomar la pantalla; `node tests/ui/offline.mjs <url>` comprueba que, después de la primera
visita, la app anda entera sin red (calculadora, pasos y distribuciones).

## Al cambiar archivos

El service worker guarda la lista de archivos con un hash de su contenido. Después de cualquier cambio:

```bash
node herramientas/armar-sw.mjs
```

Así, quien ya la tiene instalada recibe el aviso «Hay una versión nueva · Actualizar». `herramientas/iconos.mjs`
redibuja los PNG de los íconos desde `iconos/icono.svg`.

## Estructura

```
index.html, css/estilos.css, manifest.webmanifest, sw.js (generado)
js/main.js            pestañas, ajustes, modo sin conexión
js/calc/              teclado.js (teclado propio), calculadora.js (pantalla), motor.js (Compute Engine, en un worker),
                      pasos.js (paso a paso), trabajador.js (worker con tiempo límite)
js/dist/              especiales.js (funciones especiales), distribuciones.js (catálogo), calculo.js (zona e
                      inversas), panel.js, grafico.js, notacion.js (notación de cátedra)
js/expresion.js       cuentas en los campos; js/formato.js números con coma; js/teclado-num.js teclado numérico táctil
vendor/               MathLive y Compute Engine (licencia MIT)
```
