// Teclado matemático propio (estilo Photomath): los números siempre a la derecha y a la izquierda la pestaña elegida.
import { convertLatexToMarkup } from '../../vendor/mathlive/mathlive.min.mjs';

const ICONOS = {
  izq: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  der: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8.6 18.6 10 20l8-8-8-8-1.4 1.4 6.6 6.6z"/></svg>',
  borrar: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M21 5H9.2a2 2 0 0 0-1.5.7L2.4 12l5.3 6.3c.4.5.9.7 1.5.7H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Zm-3.3 10.3-1.4 1.4-2.8-2.8-2.8 2.8-1.4-1.4 2.8-2.8-2.8-2.8 1.4-1.4 2.8 2.8 2.8-2.8 1.4 1.4-2.8 2.8 2.8 2.8Z"/></svg>',
  enter: '<span style="font-family:KaTeX_Main,serif">=</span>',
};

// k = etiqueta en LaTeX; h = etiqueta HTML; ins = LaTeX a insertar; esc = texto tipeado; cmd = comando de MathLive.
const T = (k, accion, clase = '', titulo = '') => ({ k, ...accion, clase, titulo });
const dig = (d) => T(d, { esc: d });

const DERECHA = [
  dig('7'), dig('8'), dig('9'), T('\\div', { ins: '\\div' }, 'op', 'Dividir'),
  dig('4'), dig('5'), dig('6'), T('\\times', { ins: '\\times' }, 'op', 'Multiplicar'),
  dig('1'), dig('2'), dig('3'), T('-', { ins: '-' }, 'op', 'Restar'),
  dig('0'), T(',', { esp: 'coma' }, '', 'Coma decimal'), T('+', { ins: '+' }, 'op', 'Sumar'), { h: ICONOS.enter, esp: 'resolver', clase: 'acento', titulo: 'Resolver' },
];

const PESTANAS = {
  '123': [
    T('x', { esc: 'x' }), T('\\frac{\\square}{\\square}', { ins: '\\frac{#@}{#?}' }, 'fn', 'Fracción'), T('\\square^2', { ins: '#@^{2}' }, 'fn', 'Al cuadrado'), T('\\sqrt{\\square}', { ins: '\\sqrt{#0}' }, 'fn', 'Raíz cuadrada'),
    T('(', { esc: '(' }, 'fn'), T(')', { esc: ')' }, 'fn'), T('\\square^{\\square}', { ins: '#@^{#?}' }, 'fn', 'Potencia'), T('\\sqrt[n]{\\square}', { ins: '\\sqrt[#?]{#0}' }, 'fn', 'Raíz n-ésima'),
    T('\\pi', { ins: '\\pi' }, 'fn'), T('\\mathrm{e}', { ins: '\\mathrm{e}' }, 'fn', 'Número e'), T('\\left|\\square\\right|', { ins: '\\left|#0\\right|' }, 'fn', 'Valor absoluto'), T('\\%', { ins: '\\%' }, 'fn', 'Porcentaje'),
    T('=', { ins: '=' }, 'fn', 'Igual (ecuación)'), T('y', { esc: 'y' }), { h: 'Ans', esp: 'ans', clase: 'fn chica', titulo: 'Último resultado' }, T('\\square\\cdot10^{n}', { ins: '\\cdot10^{#?}' }, 'fn chica', 'Notación científica'),
  ],
  'f(x)': [
    T('\\sin', { ins: '\\sin\\left(#0\\right)' }, 'fn'), T('\\cos', { ins: '\\cos\\left(#0\\right)' }, 'fn'), T('\\tan', { ins: '\\tan\\left(#0\\right)' }, 'fn'), T('{\\square}^{\\circ}', { ins: '\\degree' }, 'fn', 'Grados'),
    T('\\sin^{-1}', { ins: '\\arcsin\\left(#0\\right)' }, 'fn chica'), T('\\cos^{-1}', { ins: '\\arccos\\left(#0\\right)' }, 'fn chica'), T('\\tan^{-1}', { ins: '\\arctan\\left(#0\\right)' }, 'fn chica'), T('\\pi', { ins: '\\pi' }, 'fn'),
    T('\\log', { ins: '\\log\\left(#0\\right)' }, 'fn chica', 'Logaritmo en base 10'), T('\\ln', { ins: '\\ln\\left(#0\\right)' }, 'fn', 'Logaritmo natural'), T('\\log_{\\square}', { ins: '\\log_{#?}\\left(#0\\right)' }, 'fn chica', 'Logaritmo en otra base'), T('\\mathrm{e}^{\\square}', { ins: '\\mathrm{e}^{#0}' }, 'fn'),
    T('n!', { ins: '!' }, 'fn', 'Factorial'), T('\\binom{n}{k}', { ins: '\\binom{#?}{#?}' }, 'fn chica', 'Combinatorio'), T('10^{\\square}', { ins: '10^{#0}' }, 'fn'), T('\\left|\\square\\right|', { ins: '\\left|#0\\right|' }, 'fn'),
  ],
  '∫': [
    T('\\frac{d}{dx}', { ins: '\\frac{d}{dx}\\left(#0\\right)' }, 'fn chica', 'Derivada'), T('\\int dx', { ins: '\\int #0\\,dx' }, 'fn chica', 'Integral'), T('\\int_{a}^{b}', { ins: '\\int_{#?}^{#?} #0\\,dx' }, 'fn chica', 'Integral definida'), T('\\lim', { ins: '\\lim_{x\\to #?} #0' }, 'fn chica', 'Límite'),
    T('\\sum', { ins: '\\sum_{n=#?}^{#?} #0' }, 'fn', 'Sumatoria'), T('\\infty', { ins: '\\infty' }, 'fn'), T('\\mathrm{i}', { ins: '\\mathrm{i}' }, 'fn', 'Unidad imaginaria'), T('a\\tfrac{b}{c}', { ins: '#?\\frac{#?}{#?}' }, 'fn chica', 'Número mixto'),
    T('<', { ins: '<' }, 'fn'), T('>', { ins: '>' }, 'fn'), T('\\le', { ins: '\\le' }, 'fn'), T('\\ge', { ins: '\\ge' }, 'fn'),
    T('\\ne', { ins: '\\ne' }, 'fn'), T('x', { esc: 'x' }), T('y', { esc: 'y' }), T('\\begin{cases}\\square\\\\\\square\\end{cases}', { ins: '\\begin{cases}#?\\\\#?\\end{cases}' }, 'fn chica', 'Sistema de ecuaciones'),
  ],
  'Z t χ²': [
    T('Z_{(p)}', { ins: 'Z_{\\left(#?\\right)}' }, 'fn chica', 'Fractil Z (p acumulado a izquierda)'),
    T('t_{(p;\\nu)}', { ins: 't_{\\left(#?;#?\\right)}' }, 'fn chica', 'Fractil t de Student'),
    T('\\chi^2_{(p;\\nu)}', { ins: '\\chi^2_{\\left(#?;#?\\right)}' }, 'fn chica', 'Fractil chi cuadrado'),
    T('F_{(p;\\nu_1;\\nu_2)}', { ins: 'F_{\\left(#?;#?;#?\\right)}' }, 'fn diminuta', 'Fractil F'),
    T('\\Phi(z)', { ins: '\\Phi\\left(#0\\right)' }, 'fn chica', 'Normal acumulada Φ(z)'), T(';', { esc: ';' }, 'fn', 'Punto y coma'),
    T('\\frac{\\square}{\\square}', { ins: '\\frac{#@}{#?}' }, 'fn', 'Fracción'), T('\\sqrt{\\square}', { ins: '\\sqrt{#0}' }, 'fn', 'Raíz cuadrada'),
    T('(', { esc: '(' }, 'fn'), T(')', { esc: ')' }, 'fn'), T('\\square^2', { ins: '#@^{2}' }, 'fn', 'Al cuadrado'), T('\\square^{\\square}', { ins: '#@^{#?}' }, 'fn', 'Potencia'),
    T('n', { esc: 'n' }), T('x', { esc: 'x' }), T('=', { ins: '=' }, 'fn', 'Igual (ecuación)'), { h: 'Ans', esp: 'ans', clase: 'fn chica', titulo: 'Último resultado' },
  ],
};

const LETRAS = [
  ...'qwertyuiop'.split(''),
  ...'asdfghjkl'.split(''), 'θ',
  ...'zxcvbnm'.split(''), 'α', 'β', 'λ',
];
const GRIEGAS = { 'θ': '\\theta', 'α': '\\alpha', 'β': '\\beta', 'λ': '\\lambda' };

export function crearTeclado(contenedor, mf, { alResolver, alAns }) {
  let pestana = '123';
  const marcado = new Map();
  const etiqueta = (t) => {
    if (t.h) return t.h;
    if (!marcado.has(t.k)) marcado.set(t.k, convertLatexToMarkup(t.k));
    return marcado.get(t.k);
  };

  const ejecutar = (t) => {
    if (t.esp === 'resolver') return alResolver();
    if (t.esp === 'ans') {
      const ans = alAns();
      if (ans) mf.insert(ans, { selectionMode: 'after', format: 'latex', focus: true });
      return;
    }
    if (t.esp === 'coma') {
      mf.executeCommand(['typedText', ',', { focus: true, feedback: false, simulateKeystroke: true }]);
      return;
    }
    if (t.cmd) mf.executeCommand(t.cmd);
    else if (t.esc) mf.executeCommand(['typedText', t.esc, { focus: true, feedback: false, simulateKeystroke: true }]);
    else if (t.ins) mf.insert(t.ins, { selectionMode: 'placeholder', format: 'latex', focus: true });
    mf.focus();
  };

  // pointerdown ejecuta sin robarle el foco al campo; click queda para el teclado físico (Tab + Enter).
  let ultimoPuntero = 0;
  const boton = (t, extra = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tecla ${t.clase ?? ''} ${extra}`.trim();
    b.innerHTML = etiqueta(t);
    if (t.titulo) { b.title = t.titulo; b.setAttribute('aria-label', t.titulo); }
    else b.setAttribute('aria-label', t.k ?? '');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ultimoPuntero = Date.now();
      b.classList.add('apretada');
      ejecutar(t);
    });
    const soltar = () => b.classList.remove('apretada');
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointerleave', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('click', () => { if (Date.now() - ultimoPuntero > 600) ejecutar(t); });
    return b;
  };

  // Borrar con repetición si se mantiene apretado.
  const botonRepetir = (html, titulo, cmd) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tecla nav-tecla';
    b.innerHTML = html;
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    let espera, intervalo;
    const parar = () => { clearTimeout(espera); clearInterval(intervalo); b.classList.remove('apretada'); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ultimoPuntero = Date.now();
      b.classList.add('apretada');
      mf.executeCommand(cmd);
      espera = setTimeout(() => { intervalo = setInterval(() => mf.executeCommand(cmd), 70); }, 420);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, parar));
    b.addEventListener('click', () => { if (Date.now() - ultimoPuntero > 600) mf.executeCommand(cmd); });
    return b;
  };

  const dibujar = () => {
    contenedor.replaceChildren();
    const tabs = document.createElement('div');
    tabs.className = 'teclado-tabs';
    tabs.setAttribute('role', 'tablist');
    for (const nombre of ['123', 'f(x)', '∫', 'Z t χ²', 'abc']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.textContent = nombre;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(nombre === pestana));
      b.title = { '123': 'Básico', 'f(x)': 'Funciones', '∫': 'Cálculo y desigualdades', 'Z t χ²': 'Estadística: fractiles Z, t, χ², F y Φ', abc: 'Letras' }[nombre];
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('click', () => { pestana = nombre; dibujar(); });
      tabs.append(b);
    }
    const nav = document.createElement('div');
    nav.className = 'nav';
    nav.append(
      botonRepetir(ICONOS.izq, 'Mover a la izquierda', 'moveToPreviousChar'),
      botonRepetir(ICONOS.der, 'Mover a la derecha', 'moveToNextChar'),
      botonRepetir(ICONOS.borrar, 'Borrar', 'deleteBackward'),
    );
    tabs.append(nav);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'teclado-cuerpo';
    if (pestana === 'abc') {
      cuerpo.classList.add('ancho');
      const bloque = document.createElement('div');
      bloque.className = 'bloque letras';
      for (const l of LETRAS) {
        bloque.append(boton(GRIEGAS[l] ? T(GRIEGAS[l], { ins: GRIEGAS[l] }) : T(l, { esc: l })));
      }
      const fila = document.createElement('div');
      fila.className = 'bloque';
      fila.append(
        boton(T('(', { esc: '(' }, 'fn')), boton(T(')', { esc: ')' }, 'fn')), boton(T('=', { ins: '=' }, 'fn')), boton(DERECHA.at(-1)),
      );
      cuerpo.append(bloque, fila);
    } else {
      const izq = document.createElement('div');
      izq.className = 'bloque';
      PESTANAS[pestana].forEach((t) => izq.append(boton(t)));
      const der = document.createElement('div');
      der.className = 'bloque';
      DERECHA.forEach((t) => der.append(boton(t)));
      cuerpo.append(izq, der);
    }
    contenedor.append(tabs, cuerpo);
  };

  dibujar();
  return { redibujar: dibujar };
}
