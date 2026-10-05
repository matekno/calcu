import { convertLatexToMarkup } from '../../vendor/mathlive/mathlive.min.mjs';
import { LISTA, DISTRIBUCIONES } from './distribuciones.js';
import { notacion, esNormalEstandar, corto } from './notacion.js';
import { crearGrafico } from './grafico.js';
import { evaluarCampo } from '../expresion.js';
import { fijoTex, fijoTexto, numTex, texACom } from '../formato.js';
import { leer, guardar } from '../almacen.js';
import { crearTecladoNum } from '../teclado-num.js';
import { calcular, cdfDisc, G } from './calculo.js';

const MODOS = [
  { id: 'izq', tex: 'P(X\\le x)', titulo: 'Acumulada a izquierda' },
  { id: 'der', tex: 'P(X\\ge x)', titulo: 'Acumulada a derecha' },
  { id: 'entre', tex: 'P(a\\le X\\le b)', titulo: 'Entre dos valores' },
  { id: 'colas', tex: '\\text{2 colas}', titulo: 'Fuera de dos valores (dos colas)' },
];
const P_DEFECTO = { izq: 0.95, der: 0.05, entre: 0.95, colas: 0.05 };
const CORTOS = {
  normal: 'Normal', t: 't', chi2: 'χ²', f: 'F', binomial: 'Binomial', poisson: 'Poisson', hipergeometrica: 'Hipergeométrica',
  geometrica: 'Geométrica', pascal: 'Pascal', exponencial: 'Exponencial', uniforme: 'Uniforme', gamma: 'Gamma', beta: 'Beta',
  weibull: 'Weibull', lognormal: 'Lognormal',
};

const html = (tex) => convertLatexToMarkup(texACom(tex));

function paramsPorDefecto(d) {
  return Object.fromEntries(d.params.map((p) => [p.id, p.defecto]));
}

export function iniciarDistribuciones(preferencias) {
  const vista = document.getElementById('vista-dist');
  const elSelector = document.getElementById('dist-selector');
  const elParams = document.getElementById('dist-params');
  const elResumen = document.getElementById('dist-resumen');
  const elModo = document.getElementById('dist-modo');
  const elValores = document.getElementById('dist-valores');
  const elResultado = document.getElementById('dist-resultado');
  const canvas = document.getElementById('dist-grafico');

  const guardado = leer('dist', {});
  const estado = {
    dist: DISTRIBUCIONES[guardado.dist] ? guardado.dist : 'normal',
    params: Object.fromEntries(LISTA.map((d) => [d.id, { ...paramsPorDefecto(d), ...(guardado.params?.[d.id] ?? {}) }])),
    modo: MODOS.some((m) => m.id === guardado.modo) ? guardado.modo : 'izq',
    origen: guardado.origen ?? 'p',
    p: Number.isFinite(guardado.p) ? guardado.p : 0.95,
    x: guardado.x ?? 0, a: guardado.a ?? -1, b: guardado.b ?? 1,
    tabla: false,
  };
  let calculo = null;
  const dec = () => preferencias.decimales;
  const dist = () => DISTRIBUCIONES[estado.dist];
  const params = () => estado.params[estado.dist];
  const persistir = () => guardar('dist', { dist: estado.dist, params: estado.params, modo: estado.modo, origen: estado.origen, p: estado.p, x: estado.x, a: estado.a, b: estado.b });

  const tecladoNum = crearTecladoNum(document.getElementById('teclado-num'), {
    alMostrar: () => vista.classList.add('con-teclado'),
    alOcultar: () => vista.classList.remove('con-teclado'),
  });

  const grafico = crearGrafico(canvas);

  // ---- Selector de distribución ----
  const dibujarSelector = () => {
    elSelector.innerHTML = LISTA.map((d) => `<button class="dist-chip" role="radio" aria-checked="${d.id === estado.dist}" data-id="${d.id}">${CORTOS[d.id] ?? d.nombre}</button>`).join('');
    elSelector.querySelectorAll('.dist-chip').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.id === estado.dist) return;
      estado.dist = b.dataset.id;
      estado.origen = 'p';
      estado.p = P_DEFECTO[estado.modo];
      dibujarSelector();
      dibujarParams();
      dibujarValores();
      recalcular({ refrescarCampos: true });
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }));
  };

  // ---- Campos ----
  const campo = ({ id, simbolo, nombre, valor, clase = '' }) => `
    <label class="campo ${clase}">
      <span class="campo-etiqueta"><span class="simbolo">${simbolo}</span>${nombre ? `<span>${nombre}</span>` : ''}</span>
      <input id="${id}" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" value="${valor}">
      <span class="campo-error" data-error-de="${id}"></span>
    </label>`;

  const mostrarError = (id, texto) => {
    const input = document.getElementById(id);
    input?.classList.toggle('invalido', Boolean(texto));
    const el = document.querySelector(`[data-error-de="${id}"]`);
    if (el) el.textContent = texto ?? '';
  };

  const valorParam = (v) => texACom(String(v)).replace('{,}', ',');

  const dibujarParams = () => {
    const d = dist();
    elParams.innerHTML = d.params.map((p) => campo({ id: `par-${p.id}`, simbolo: p.nombre, nombre: p.descripcion, valor: valorParam(params()[p.id]) })).join('');
    for (const p of d.params) {
      const input = document.getElementById(`par-${p.id}`);
      tecladoNum.conectar(input);
      input.addEventListener('input', () => {
        const v = evaluarCampo(input.value);
        let error = null;
        if (!Number.isFinite(v)) error = 'Escribí un número.';
        else if (p.entero && !Number.isInteger(v)) error = 'Tiene que ser entero.';
        else if (v < p.min || (p.minExclusivo && v === p.min)) error = `Tiene que ser ${p.minExclusivo ? 'mayor que' : 'al menos'} ${String(p.min).replace('.', ',')}.`;
        else if (v > p.max) error = `Tiene que ser como mucho ${String(p.max).replace('.', ',')}.`;
        mostrarError(input.id, error);
        if (error) { calculo = null; return; }
        params()[p.id] = v;
        recalcular({ refrescarCampos: true });
      });
    }
  };

  const dibujarModo = () => {
    elModo.innerHTML = MODOS.map((m) => `<button role="radio" aria-checked="${m.id === estado.modo}" data-id="${m.id}" title="${m.titulo}">${html(m.tex)}</button>`).join('');
    elModo.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const nuevo = b.dataset.id;
      if (nuevo === estado.modo) return;
      const conX = (m) => m === 'izq' || m === 'der';
      if (!(estado.origen === 'x' && conX(nuevo) && conX(estado.modo))) {
        estado.origen = 'p';
        estado.p = P_DEFECTO[nuevo];
      }
      estado.modo = nuevo;
      dibujarModo();
      dibujarValores();
      recalcular({ refrescarCampos: true });
    }));
  };

  const etiquetaProb = () => ({
    izq: 'P(X\\le x)', der: 'P(X\\ge x)', entre: 'P(a\\le X\\le b)', colas: '\\alpha',
  }[estado.modo]);

  const dibujarValores = () => {
    const dos = estado.modo === 'izq' || estado.modo === 'der';
    elValores.className = `valores${dos ? '' : ' tres'}`;
    const probEtq = `<span class="simbolo">${html(etiquetaProb())}</span>`;
    elValores.innerHTML = (dos
      ? campo({ id: 'val-x', simbolo: 'x', nombre: dist().discreta ? 'valor (entero)' : 'valor', valor: '' })
      : campo({ id: 'val-a', simbolo: 'a', nombre: '', valor: '' }) + campo({ id: 'val-b', simbolo: 'b', nombre: '', valor: '' }))
      + campo({ id: 'val-p', simbolo: '', nombre: '', valor: '', clase: 'prob' }).replace('<span class="simbolo"></span>', probEtq)
      + `<p class="ayuda-valores">${dos
        ? 'Escribí x para obtener la probabilidad, o la probabilidad para obtener x (el fractil).'
        : estado.modo === 'entre'
          ? 'Con a y b da la probabilidad del medio. Con la probabilidad da el intervalo central (mitad de lo que sobra en cada cola).'
          : 'Con a y b da la suma de las dos colas. Con α da los críticos de un ensayo bilateral (α/2 en cada cola).'}</p>`;
    for (const id of ['val-x', 'val-a', 'val-b', 'val-p']) {
      const input = document.getElementById(id);
      if (!input) continue;
      tecladoNum.conectar(input);
      input.addEventListener('input', () => {
        const v = evaluarCampo(input.value);
        let error = Number.isFinite(v) ? null : 'Escribí un número.';
        if (!error && id === 'val-p' && !(v >= 0 && v <= 1)) error = 'Entre 0 y 1.';
        if (!error && id !== 'val-p' && dist().discreta && !Number.isInteger(v)) error = 'Tiene que ser entero.';
        mostrarError(id, error);
        if (error) return;
        if (id === 'val-p') { estado.p = v; estado.origen = 'p'; }
        else {
          estado[id.slice(4)] = v;
          estado.origen = 'x';
        }
        recalcular({ refrescarCampos: true, salvo: id });
      });
    }
  };

  const recalcular = ({ refrescarCampos = false, salvo = null } = {}) => {
    const d = dist(), P = params();
    const error = d.validar(P);
    if (error) {
      calculo = null;
      elResultado.innerHTML = `<p class="sol-error">${error}</p>`;
      elResumen.textContent = '';
      return;
    }
    const { modo, p } = estado;
    const { x, a, b, prob } = calcular(d, P, estado);
    Object.assign(estado, { x, a, b });
    calculo = { d, P, modo, x, a, b, p, prob, origen: estado.origen };
    persistir();
    if (refrescarCampos) refrescar(salvo);
    dibujarResumen();
    grafico.dibujar({ dist: d, params: P, modo, x, a, b, prob });
    dibujarResultado();
  };

  const textoValor = (v) => {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '-∞' : '';
    if (dist().discreta) return String(v);
    return fijoTexto(Number(v.toFixed(dec())), dec()).replace(/,?0+$/, (m) => (m.startsWith(',') ? '' : m)).replace('−', '-');
  };

  const refrescar = (salvo) => {
    const poner = (id, texto, calculado) => {
      const input = document.getElementById(id);
      if (!input || id === salvo) return;
      input.value = texto;
      input.classList.toggle('calculado', calculado);
      mostrarError(id, null);
    };
    const { modo, origen } = estado;
    if (modo === 'izq' || modo === 'der') poner('val-x', textoValor(estado.x), origen === 'p');
    else { poner('val-a', textoValor(estado.a), origen === 'p'); poner('val-b', textoValor(estado.b), origen === 'p'); }
    const mostrada = origen === 'p' ? estado.p : calculo?.prob;
    poner('val-p', Number.isFinite(mostrada) ? (origen === 'p' ? valorParam(estado.p) : fijoTexto(mostrada, dec())) : '', origen !== 'p');
  };

  const dibujarResumen = () => {
    const d = dist(), P = params();
    const media = d.media(P), varianza = d.varianza(P);
    const f = (v) => (Number.isFinite(v) ? fijoTex(v, Math.min(dec(), 6)).replace(/(\{,\}\d*?)0+$/, '$1').replace(/\{,\}$/, '') : v === Infinity ? '\\infty' : '\\text{no existe}');
    elResumen.innerHTML = [
      `<span>Media ${html(`\\mu=${f(media)}`)}</span>`,
      `<span>Desvío ${html(`\\sigma=${f(Math.sqrt(varianza))}`)}</span>`,
      `<span>Varianza ${html(`\\sigma^2=${f(varianza)}`)}</span>`,
    ].join('');
  };

  // ---- Resultado en notación de cátedra ----
  const dibujarResultado = () => {
    if (!calculo) return;
    const { d, P, modo, x, a, b, p, prob, origen } = calculo;
    const n = notacion(d.id, P, d.discreta);
    const D = dec();
    const fp = (v) => fijoTex(v, D);
    // Lo que escribió el usuario va tal cual; lo calculado, con los decimales elegidos.
    const fx = (v) => {
      if (d.discreta) return String(v);
      if (!Number.isFinite(v)) return v > 0 ? '\\infty' : '-\\infty';
      return origen === 'x' ? corto(v) : fijoTex(v, D);
    };
    const V = n.variable;
    const normal = d.id === 'normal';
    const estandar = esNormalEstandar(d.id, P);
    const zTex = (v) => fijoTex((v - P.mu) / P.sigma, Math.max(D, 4));
    const parentesis = (t) => (t.startsWith('-') ? `\\left(${t}\\right)` : t);
    // F y G de cátedra en un valor; la normal general pasa por Z.
    const Ftex = (v) => (!normal ? n.F(v) : estandar ? `\\Phi(${fx(v)})`
      : `\\Phi\\left(\\frac{${fx(v)}-${parentesis(corto(P.mu))}}{${corto(P.sigma)}}\\right)=\\Phi(${zTex(v)})`);
    const Gtex = (v) => (!normal ? n.G(v) : estandar ? `1-\\Phi(${fx(v)})` : `1-\\Phi(${zTex(v)})`);
    const fractilTex = (q, valor) => {
      if (d.discreta) return null;
      if (normal && !estandar) {
        const zq = d.ppf(q, { mu: 0, sigma: 1 });
        return `x=\\mu+Z_{(${corto(q)})}\\cdot\\sigma=${corto(P.mu)}+${parentesis(fijoTex(zq, D))}\\cdot ${corto(P.sigma)}=${fx(valor)}`;
      }
      return `${n.fractil(q)}=${fx(valor)}`;
    };
    const Fv = (v) => (d.discreta ? cdfDisc(d, P, v) : d.cdf(v, P));
    const Gv = (v) => G(d, P, v);

    let principal = '';
    const lineas = [];
    const notas = [];

    if (modo === 'izq' || modo === 'der') {
      const izq = modo === 'izq';
      if (d.discreta) {
        principal = izq ? `P(${V}\\le ${x})=${n.F(x)}=${fp(Fv(x))}` : `P(${V}\\ge ${x})=${n.G(x)}=${fp(Gv(x))}`;
        if (origen === 'p') {
          if (izq) {
            lineas.push(`${n.F(x - 1)}=${fp(Fv(x - 1))}<${corto(p)}\\le ${n.F(x)}`);
            notas.push('Variable discreta: casi nunca se alcanza la probabilidad exacta. Se da el menor r con F(r) ≥ p; el anterior queda por debajo.');
          } else {
            lineas.push(`${n.G(x)}\\le ${corto(p)}<${n.G(x - 1)}=${fp(Gv(x - 1))}`);
            notas.push('Variable discreta: se da el menor r con G(r) = P(X ≥ r) ≤ p (zona de rechazo a derecha que no pasa de p). G incluye a r.');
          }
        }
        lineas.push(`P(${V}=${x})=${n.P(x)}=${fp(d.pdf(x, P))}`);
        lineas.push(izq ? `P(${V}\\ge ${x})=${n.G(x)}=${fp(Gv(x))}` : `P(${V}\\le ${x})=${n.F(x)}=${fp(Fv(x))}`);
        lineas.push(izq ? `P(${V}>${x})=1-${n.F(x)}=${fp(1 - Fv(x))}` : `P(${V}<${x})=1-${n.G(x)}=${fp(1 - Gv(x))}`);
      } else {
        if (origen === 'p') lineas.push(fractilTex(izq ? p : 1 - p, x));
        principal = izq ? `P(${V}\\le ${fx(x)})=${fp(d.cdf(x, P))}` : `P(${V}\\ge ${fx(x)})=${fp(d.sf(x, P))}`;
        lineas.push(izq ? `${Ftex(x)}=${fp(d.cdf(x, P))}` : `${Gtex(x)}=${fp(d.sf(x, P))}`);
        lineas.push(izq ? `P(${V}>${fx(x)})=${Gtex(x)}=${fp(d.sf(x, P))}` : `P(${V}<${fx(x)})=${Ftex(x)}=${fp(d.cdf(x, P))}`);
        if (origen === 'p' && !izq) notas.push(`El fractil se nombra por lo acumulado a izquierda: dejar ${fijoTexto(p, D)} a la derecha es el fractil ${fijoTexto(1 - p, D)}.`);
        notas.push(...extrasFractil(d, P, origen === 'p' ? (izq ? p : 1 - p) : null, D));
      }
    } else if (modo === 'entre') {
      principal = `P(a\\le ${V}\\le b)=${fp(prob)}`;
      if (d.discreta) {
        lineas.push(`P(${a}\\le ${V}\\le ${b})=${n.F(b)}-${n.F(a - 1)}`, `=${fp(Fv(b))}-${fp(Fv(a - 1))}=${fp(prob)}`);
        if (origen === 'p') notas.push(`Intervalo central: cada cola queda con a lo sumo ${fijoTexto((1 - p) / 2, D)}; por ser discreta, la probabilidad del medio es ${fijoTexto(prob, D)} (al menos ${fijoTexto(p, D)}).`);
      } else {
        if (origen === 'p') lineas.push(`a=${fractilTex((1 - p) / 2, a).replace(/^x=/, '')}`, `b=${fractilTex((1 + p) / 2, b).replace(/^x=/, '')}`);
        lineas.push(`P(${fx(a)}\\le ${V}\\le ${fx(b)})=${fp(d.cdf(b, P))}-${fp(d.cdf(a, P))}=${fp(prob)}`);
        if (origen === 'p') notas.push(`Intervalo central: ${fijoTexto((1 - p) / 2, D)} en cada cola.`);
      }
      lineas.push(`\\text{Afuera: }1-${fp(prob)}=${fp(1 - prob)}`);
    } else {
      principal = `P(${V}\\le a)+P(${V}\\ge b)=${fp(prob)}`;
      if (d.discreta) {
        lineas.push(`P(${V}\\le ${a})=${n.F(a)}=${fp(Fv(a))}`, `P(${V}\\ge ${b})=${n.G(b)}=${fp(Gv(b))}`);
        if (origen === 'p') notas.push(`Críticos de un ensayo bilateral: cada cola con a lo sumo α/2 = ${fijoTexto(p / 2, D)}. El α real queda en ${fijoTexto(prob, D)}.`);
      } else {
        if (origen === 'p') lineas.push(`a=${fractilTex(p / 2, a).replace(/^x=/, '')}`, `b=${fractilTex(1 - p / 2, b).replace(/^x=/, '')}`);
        lineas.push(`P(${V}\\le ${fx(a)})=${fp(d.cdf(a, P))}`, `P(${V}\\ge ${fx(b)})=${fp(d.sf(b, P))}`);
        if (origen === 'p') notas.push(`Ensayo bilateral: α/2 = ${fijoTexto(p / 2, D)} en cada cola.`);
      }
      lineas.push(`\\text{Adentro: }1-${fp(prob)}=${fp(1 - prob)}`);
    }

    let tabla = '';
    if (d.discreta) {
      const [lo, hi] = d.soporte(P);
      const centro = modo === 'izq' || modo === 'der' ? x : Math.round((a + b) / 2);
      const desde = Math.max(lo, centro - 8), hasta = Math.min(hi, Math.max(centro + 8, desde + 8));
      const marcas = new Set(modo === 'izq' || modo === 'der' ? [x] : [a, b]);
      let filas = '';
      for (let r = desde; r <= hasta; r++) {
        filas += `<tr class="${marcas.has(r) ? 'marcada' : ''}"><td>${r}</td><td>${fijoTexto(d.pdf(r, P), D)}</td><td>${fijoTexto(Fv(r), D)}</td><td>${fijoTexto(Gv(r), D)}</td></tr>`;
      }
      tabla = `<div class="tabla-envoltura" ${estado.tabla ? '' : 'hidden'}><table class="tabla-dist"><thead><tr><th>r</th><th>P(X = r)</th><th>F(r) = P(X ≤ r)</th><th>G(r) = P(X ≥ r)</th></tr></thead><tbody>${filas}</tbody></table></div>`;
    }

    elResultado.innerHTML = `
      <p class="res-titulo">Resultado <span class="espacio"></span>${d.discreta ? `<button class="mini" data-tabla>${estado.tabla ? 'Ocultar tabla' : 'Ver tabla'}</button>` : ''}</p>
      <div class="res-principal">${html(principal)}</div>
      <div class="res-lineas">${lineas.filter(Boolean).map((l) => `<div class="res-linea">${html(l)}</div>`).join('')}</div>
      ${tabla}
      ${notas.map((t) => `<p class="res-nota">${t}</p>`).join('')}`;
    elResultado.querySelector('[data-tabla]')?.addEventListener('click', () => { estado.tabla = !estado.tabla; dibujarResultado(); });
  };

  // Aproximación de cátedra para χ² con ν > 150 y propiedad recíproca de F.
  const extrasFractil = (d, P, q, D) => {
    const notas = [];
    if (q === null) return notas;
    if (d.id === 'chi2' && P.nu > 150) {
      const zq = DISTRIBUCIONES.normal.ppf(q, { mu: 0, sigma: 1 });
      const aprox = 0.5 * (zq + Math.sqrt(2 * P.nu - 1)) ** 2;
      notas.push(`Con ν > 150 la cátedra aproxima ${'χ²'}(${fijoTexto(q, 4)} ; ${corto(P.nu).replace('{,}', ',')}) ≈ ½·[Z(${fijoTexto(q, 4)}) + √(2ν − 1)]² = ${fijoTexto(aprox, D)}. Exacto: ${fijoTexto(d.ppf(q, P), D)}.`);
    }
    if (d.id === 'f') {
      const recip = d.ppf(1 - q, { nu1: P.nu2, nu2: P.nu1 });
      notas.push(`Propiedad recíproca: F(${fijoTexto(q, 4)} ; ν₁, ν₂) = 1 / F(${fijoTexto(1 - q, 4)} ; ν₂, ν₁) = 1 / ${fijoTexto(recip, D)}. El orden de los grados de libertad importa (ν₁ numerador).`);
    }
    if (d.id === 't' || (d.id === 'normal' && P.mu === 0 && P.sigma === 1)) {
      notas.push(`Simetría: el fractil ${fijoTexto(1 - q, 4)} es el mismo con signo cambiado.`);
    }
    return notas;
  };

  preferencias.alCambiar(() => { refrescar(null); dibujarResumen(); grafico.redibujar(); dibujarResultado(); });

  dibujarSelector();
  dibujarParams();
  dibujarModo();
  dibujarValores();
  recalcular({ refrescarCampos: true });

  return {
    mostrar() {
      requestAnimationFrame(() => grafico.redibujar());
    },
  };
}
