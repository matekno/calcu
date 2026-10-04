import { MathfieldElement, convertLatexToMarkup } from '../../vendor/mathlive/mathlive.min.mjs';
import { texACom } from '../formato.js';
import { crearTeclado } from './teclado.js';
import { leer, guardar } from '../almacen.js';

MathfieldElement.decimalSeparator = ',';
MathfieldElement.soundsDirectory = null;
MathfieldElement.keypressSound = null;
MathfieldElement.plonkSound = null;
MathfieldElement.fontsDirectory = new URL('../../vendor/mathlive/fonts/', import.meta.url).href;

const EJEMPLOS = [
  '\\frac{3}{4}+\\frac{5}{6}',
  '\\left(\\frac{2}{3}\\right)^{2}\\cdot9-4',
  '\\sqrt{72}',
  '\\sin\\left(30\\degree\\right)+\\cos\\left(60\\degree\\right)',
  '2x+3=7',
  '\\frac{x}{3}+\\frac{1}{2}=\\frac{5}{6}',
  'x^{2}-5x+6=0',
  'x^{2}-4<0',
  '\\log_{2}\\left(32\\right)',
  '\\frac{d}{dx}\\left(x^{3}\\cdot\\sin\\left(x\\right)\\right)',
  '\\int_{0}^{1}x^{2}\\,dx',
  '\\binom{10}{3}',
  '\\begin{cases}2x+3y=8\\\\x-y=-1\\end{cases}',
];

const TITULOS = {
  numero: 'Calcular', expresion: 'Simplificar', ecuacion: 'Resolver la ecuación',
  inecuacion: 'Resolver la inecuación', sistema: 'Resolver el sistema', logico: 'Comparar', error: 'No se pudo resolver',
};

const mathHTML = (tex) => convertLatexToMarkup(texACom(tex));

// ---- Worker con tiempo límite ----
function crearCalculista() {
  let worker = null;
  let siguiente = 1;
  const pendientes = new Map();
  const arrancar = () => {
    worker = new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.listo) return;
      const p = pendientes.get(data.id);
      if (!p) return;
      clearTimeout(p.reloj);
      pendientes.delete(data.id);
      data.ok ? p.resolve(data.r) : p.reject(new Error(data.mensaje));
    };
    worker.onerror = (e) => {
      for (const p of pendientes.values()) { clearTimeout(p.reloj); p.reject(new Error(e.message || 'Error en el cálculo')); }
      pendientes.clear();
    };
  };
  arrancar();
  return (latex, opciones, limite) => new Promise((resolve, reject) => {
    const id = siguiente++;
    const reloj = setTimeout(() => {
      pendientes.delete(id);
      worker.terminate();
      for (const p of pendientes.values()) { clearTimeout(p.reloj); p.reject(new Error('cancelado')); }
      pendientes.clear();
      arrancar();
      reject(new Error('tiempo'));
    }, limite);
    pendientes.set(id, { resolve, reject, reloj });
    worker.postMessage({ id, latex, ...opciones });
  });
}

export function iniciarCalculadora() {
  const mf = document.getElementById('mf');
  const previa = document.getElementById('previa');
  const panel = document.getElementById('panel-solucion');
  const solucion = document.getElementById('solucion');
  const vacia = document.getElementById('solucion-vacia');
  const cuerpo = document.getElementById('solucion-cuerpo');
  const titulo = document.getElementById('solucion-titulo');
  const btnAngulo = document.getElementById('btn-angulo');
  const calcular = crearCalculista();

  let angulo = leer('angulo', 'deg');
  let ans = null;
  let ultimaPrevia = 0;
  let relojPrevia = null;

  mf.inlineShortcuts = { ...mf.inlineShortcuts, sen: '\\sin', raiz: '\\sqrt{#?}', pi: '\\pi' };
  mf.smartFence = true;
  mf.popoverPolicy = 'off';
  mf.menuItems = [];

  const pintarAngulo = () => {
    btnAngulo.textContent = angulo === 'deg' ? 'DEG' : 'RAD';
    btnAngulo.title = angulo === 'deg' ? 'Ángulos en grados (tocá para radianes)' : 'Ángulos en radianes (tocá para grados)';
  };
  pintarAngulo();
  btnAngulo.addEventListener('click', () => {
    angulo = angulo === 'deg' ? 'rad' : 'deg';
    guardar('angulo', angulo);
    pintarAngulo();
    actualizarPrevia();
    mf.focus();
  });

  // ---- Vista previa en vivo ----
  const actualizarPrevia = () => {
    clearTimeout(relojPrevia);
    relojPrevia = setTimeout(async () => {
      const latex = mf.value;
      const pedido = ++ultimaPrevia;
      if (!latex.trim()) { previa.replaceChildren(); return; }
      try {
        const r = await calcular(latex, { angulo, conPasos: false }, 2500);
        if (pedido !== ultimaPrevia) return;
        previa.innerHTML = textoPrevia(r);
      } catch (e) {
        if (pedido === ultimaPrevia) previa.innerHTML = e.message === 'tiempo' ? '<span class="error">La cuenta tarda mucho: tocá = para intentarla.</span>' : '';
      }
    }, 110);
  };

  const textoPrevia = (r) => {
    if (!r || r.tipo === 'vacio' || r.tipo === 'incompleto') return '';
    if (r.tipo === 'error') return `<span class="error">${r.mensaje ?? ''}</span>`;
    if (!r.principal) return '';
    if (r.tipo === 'numero') {
      const partes = [];
      const suelto = (t) => t.replace(/\\left|\\right|[{}\s]/g, '');
      if (suelto(r.principal) !== suelto(r.entrada)) partes.push(mathHTML(`=${r.principal}`));
      const dec = r.formas.find((f) => f.etiqueta === 'Decimal');
      if (dec && dec.aprox) partes.push(mathHTML(`\\approx ${dec.tex.split('\\approx').pop()}`));
      return partes.join(' ');
    }
    return mathHTML(r.tipo === 'expresion' ? `=${r.principal}` : r.principal);
  };

  mf.addEventListener('input', actualizarPrevia);
  mf.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); resolver(); }
  }, { capture: true });

  // ---- Solución ----
  const abrirPanel = () => {
    if (!panel.classList.contains('abierta')) {
      panel.classList.add('abierta');
      if (matchMedia('(max-width: 899px)').matches) history.pushState({ solucion: true }, '');
    }
  };
  const cerrarPanel = () => {
    panel.classList.remove('abierta');
    mf.focus();
  };
  document.getElementById('btn-volver').addEventListener('click', () => {
    if (history.state?.solucion) history.back(); else cerrarPanel();
  });
  window.addEventListener('popstate', () => { if (panel.classList.contains('abierta')) cerrarPanel(); });

  const resolver = async () => {
    const latex = mf.value;
    if (!latex.trim()) return;
    vacia.hidden = true;
    solucion.hidden = false;
    titulo.textContent = 'Resolviendo…';
    cuerpo.innerHTML = `<div class="tarjeta sol-tarjeta"><p class="sol-etiqueta">Ejercicio</p><div class="sol-entrada">${mathHTML(latex)}</div></div>`;
    abrirPanel();
    try {
      const r = await calcular(latex, { angulo, conPasos: true }, 9000);
      mostrarSolucion(latex, r);
      if (r.principal && r.tipo !== 'error') {
        ans = r.principal;
        agregarHistorial(latex, r.principal);
      }
    } catch (e) {
      titulo.textContent = TITULOS.error;
      cuerpo.insertAdjacentHTML('beforeend', `<div class="tarjeta sol-tarjeta"><p class="sol-error">${e.message === 'tiempo' ? 'La cuenta tardó demasiado y la corté. Probá simplificarla o partirla en partes.' : 'Hubo un error al calcular: ' + e.message}</p></div>`);
    }
  };

  const mostrarSolucion = (latex, r) => {
    if (r.tipo === 'incompleto') r = { tipo: 'error', mensaje: 'Falta completar algún casillero.' };
    titulo.textContent = r.pasos?.titulo ?? TITULOS[r.tipo] ?? 'Solución';
    const partes = [];
    partes.push(`<div class="tarjeta sol-tarjeta"><p class="sol-etiqueta">Ejercicio</p><div class="sol-entrada">${mathHTML(latex)}</div></div>`);
    if (r.tipo === 'error') {
      partes.push(`<div class="tarjeta sol-tarjeta"><p class="sol-error">${r.mensaje}</p></div>`);
    } else {
      const [primera, ...resto] = r.formas;
      let html = `<div class="tarjeta sol-tarjeta"><p class="sol-etiqueta">Solución</p>`;
      if (r.tipo === 'sistema') {
        html += `<div class="sol-principal">${mathHTML(r.principal)}</div>`;
        if (primera?.texto) html += `<p class="paso-texto">${primera.texto}</p>`;
      } else if (r.tipo === 'ecuacion' && r.soluciones?.length) {
        html += `<div class="sol-principal">${mathHTML(r.principal)}</div>`;
        const aprox = r.formas.filter((f) => f.aprox);
        if (aprox.length) html += `<div class="sol-formas">${aprox.map((f) => fila('Decimal', `${f.tex.split('=')[0]}\\approx ${f.aprox}`)).join('')}</div>`;
      } else if (primera) {
        html += `<div class="sol-principal">${mathHTML(primera.tex)}</div>`;
        if (primera.texto) html += `<p class="paso-texto">${primera.texto}</p>`;
        if (resto.length) html += `<div class="sol-formas">${resto.map((f) => fila(f.etiqueta, f.aprox === true && !f.tex.includes('approx') ? `\\approx ${f.tex}` : f.tex, f.largo)).join('')}</div>`;
      }
      if (r.avisos?.length) html += `<ul class="sol-avisos">${r.avisos.map((a) => `<li>${a}</li>`).join('')}</ul>`;
      html += `<div class="acciones"><button class="boton secundario" data-accion="editar">Editar</button>`;
      if (r.pasos?.pasos?.length) html += `<button class="boton" data-accion="pasos">Ver los pasos</button>`;
      html += `</div></div>`;
      partes.push(html);
      if (r.pasos?.pasos?.length) partes.push(htmlPasos(r.pasos));
    }
    cuerpo.innerHTML = partes.join('');
    cuerpo.scrollTop = 0;
    cuerpo.querySelector('[data-accion="editar"]')?.addEventListener('click', () => {
      if (history.state?.solucion) history.back(); else cerrarPanel();
    });
    cuerpo.querySelector('[data-accion="pasos"]')?.addEventListener('click', () => {
      const p = cuerpo.querySelector('.tarjeta-pasos');
      p.hidden = false;
      p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    conectarPasos();
  };

  const fila = (nombre, tex, largo = false) =>
    `<div class="sol-forma${largo ? ' largo' : ''}"><span class="nombre">${nombre}</span><span class="valor">${mathHTML(tex)}</span></div>`;

  const htmlPasos = (p) => `
    <div class="tarjeta sol-tarjeta tarjeta-pasos" hidden>
      <p class="sol-etiqueta">Paso a paso</p>
      <ol class="pasos">${p.pasos.map((s) => `<li class="paso"><div class="paso-texto">${s.texto}</div><div class="paso-tex">${mathHTML(s.tex)}</div></li>`).join('')}</ol>
      <div class="pasos-control">
        <button class="boton secundario" data-pasos="uno">Ver de a un paso</button>
        <button class="boton secundario" data-pasos="siguiente" hidden>Siguiente paso</button>
        <button class="boton secundario" data-pasos="todos" hidden>Ver todos</button>
      </div>
    </div>`;

  const conectarPasos = () => {
    const t = cuerpo.querySelector('.tarjeta-pasos');
    if (!t) return;
    const pasos = [...t.querySelectorAll('.paso')];
    const uno = t.querySelector('[data-pasos="uno"]');
    const sig = t.querySelector('[data-pasos="siguiente"]');
    const todos = t.querySelector('[data-pasos="todos"]');
    let visibles = pasos.length;
    const pintar = () => {
      pasos.forEach((p, i) => p.classList.toggle('oculto', i >= visibles));
      const parcial = visibles < pasos.length;
      uno.hidden = parcial;
      sig.hidden = !parcial;
      todos.hidden = !parcial;
    };
    uno.addEventListener('click', () => { visibles = 1; pintar(); });
    sig.addEventListener('click', () => { visibles++; pintar(); pasos[visibles - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    todos.addEventListener('click', () => { visibles = pasos.length; pintar(); });
  };

  // ---- Historial ----
  const agregarHistorial = (latex, resultado) => {
    const h = leer('historial', []).filter((x) => x.latex !== latex);
    h.unshift({ latex, resultado, t: Date.now() });
    guardar('historial', h.slice(0, 60));
  };
  const dlgHist = document.getElementById('dlg-historial');
  const listaHist = document.getElementById('lista-historial');
  document.getElementById('btn-historial').addEventListener('click', () => {
    const h = leer('historial', []);
    listaHist.innerHTML = h.length
      ? h.map((x, i) => `<li><button data-i="${i}"><span>${mathHTML(x.latex)}</span><span class="res">${mathHTML(`=${x.resultado}`)}</span></button></li>`).join('')
      : '<li class="vacio">Todavía no resolviste nada.</li>';
    listaHist.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      mf.value = h[Number(b.dataset.i)].latex;
      dlgHist.close();
      actualizarPrevia();
      mf.focus();
    }));
    dlgHist.showModal();
  });
  document.getElementById('btn-borrar-historial').addEventListener('click', () => {
    guardar('historial', []);
    listaHist.innerHTML = '<li class="vacio">Historial borrado.</li>';
  });

  document.getElementById('btn-limpiar').addEventListener('click', () => {
    mf.value = '';
    previa.replaceChildren();
    mf.focus();
  });

  // ---- Ejemplos ----
  const ejemplos = document.getElementById('ejemplos');
  ejemplos.innerHTML = '<p class="ejemplos-titulo">Probá con</p>' + EJEMPLOS.map((e, i) => `<button class="ejemplo" data-i="${i}">${mathHTML(e)}</button>`).join('');
  ejemplos.querySelectorAll('.ejemplo').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      mf.value = EJEMPLOS[Number(b.dataset.i)];
      actualizarPrevia();
      mf.focus();
      mf.executeCommand('moveToMathfieldEnd');
    });
  });

  crearTeclado(document.getElementById('teclado'), mf, {
    alResolver: resolver,
    alAns: () => (ans ? (/^[\d.]+$/.test(ans) ? ans : `\\left(${ans}\\right)`) : null),
  });

  requestAnimationFrame(() => mf.focus());
  return { enfocar: () => mf.focus() };
}
