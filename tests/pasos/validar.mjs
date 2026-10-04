// Validación automática de js/calc/pasos.js contra Compute Engine (y MathLive SSR).
// Uso: node tests/pasos/validar.mjs [--verbose] [--solo "<latex>"] [--modulo <ruta a otro pasos.js>]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ComputeEngine } from '../../vendor/compute-engine/compute-engine.js';

const args = process.argv.slice(2);
const opcion = (nombre) => (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : null);
const VERBOSE = args.includes('--verbose');
const SOLO = opcion('--solo');
const MODULO = opcion('--modulo');
const { generarPasos } = await import(MODULO ? pathToFileURL(resolve(MODULO)).href : '../../js/calc/pasos.js');

let mathlive = null;
try {
  mathlive = await import('../../node_modules/mathlive/mathlive-ssr.min.mjs');
} catch (e) {
  console.warn(`(MathLive SSR no disponible, no se prueba el render: ${e.message})`);
}

const ce = new ComputeEngine();
const TOL = 1e-12;

// ───────────────────────── Batería a mano ─────────────────────────

const A_MANO = [
  // enteros y orden de operaciones
  '2+3\\cdot4', '(2+3)\\cdot4', '\\left(2+3\\right)\\cdot 4', '12\\div3\\cdot2', '8\\div2\\times4', '2\\cdot3+4\\cdot5',
  '10-2\\cdot3+4', '3-2-1', '-3+4', '5-(-3)', '5+\\left(-3\\right)', '-(2+3)', '-\\left(-4\\right)', '2\\cdot\\left(-3\\right)',
  '2\\cdot -3', '(-2)^{2}', '-2^{2}', '2^{3}+3^{2}', '2^{10}', '\\left(2+3\\right)^{2}', '6\\div 2(1+2)', '7\\div 2', '100\\div 8',
  '3\\times 4\\div 2', '2^{-3}', '\\left(\\frac{1}{2}\\right)^{-2}', '5^{0}', '(-1)^{5}', '2\\cdot 3\\cdot 4', '1+2+3+4+5',
  '48\\div\\left(2+6\\right)\\cdot 3', '2\\left(3+4\\right)', '\\left(1+2\\right)\\left(3+4\\right)', '3^2-2^3', '-5-3', '-4\\cdot -2',
  '\\left(-3\\right)^{3}+20', '15-3\\cdot\\left(2-7\\right)', '2^{2^{2}}', '(2+3\\cdot(4-1))\\cdot 2', '1\\,000+2\\,500',
  // fracciones
  '\\frac{1}{2}+\\frac{1}{3}', '\\frac{3}{4}\\div\\frac{9}{8}', '2\\frac{1}{3}-\\frac{5}{6}', '\\left(\\frac{2}{3}\\right)^{2}\\cdot 9-4',
  '\\frac{2}{4}+\\frac{1}{3}', '\\frac{5}{6}-\\frac{1}{4}', '\\frac{1}{2}-\\frac{3}{4}', '\\frac{2}{3}\\cdot\\frac{9}{4}', '\\frac{3}{5}\\cdot 10',
  '1+\\frac{1}{2}', '3-\\frac{2}{5}', '\\frac{1}{5}+\\frac{2}{5}', '\\frac{6}{8}', '\\frac{12}{4}', '\\frac{0}{5}', '\\frac{-3}{6}',
  '-\\frac{4}{6}+1', '\\frac{1}{2}+\\frac{1}{3}+\\frac{1}{6}', '\\frac{\\frac{1}{2}}{3}', '\\frac{2+4}{3}', '\\frac{3}{4}\\div 3',
  '2\\div\\frac{1}{2}', '\\frac34+\\frac56', '\\frac12\\cdot\\frac23', '\\frac73-\\frac12', '\\frac{12}{5}-\\frac35', '\\frac38\\div\\frac34',
  '1\\frac{1}{2}+2\\frac{3}{4}', '3\\frac{1}{4}\\cdot 2', '\\dfrac{3}{4}+\\dfrac{1}{8}', '\\left(\\frac{1}{2}+\\frac{1}{3}\\right)\\cdot 6',
  '\\frac{1}{2}\\cdot\\left(\\frac{2}{3}-\\frac{1}{6}\\right)', '\\frac{2}{3}\\div\\frac{4}{9}+\\frac{1}{2}', '\\frac{1}{2}\\frac{1}{3}',
  '\\frac{3}{4}-\\left(-\\frac{1}{4}\\right)', '\\frac{2}{3}^{2}', '\\left(-\\frac{1}{2}\\right)^{3}', '\\frac{5}{2}\\cdot\\frac{4}{15}',
  '\\frac{1+\\frac{1}{2}}{2-\\frac{1}{2}}', '4-\\frac{1}{3}\\cdot 6', '\\frac{7}{10}+\\frac{1}{100}',
  // decimales y porcentajes
  '0.5+\\frac{1}{4}', '0.1+0.2', '1.5\\cdot 2', '2.5\\cdot 0.4', '3.6\\div 1.2', '0.1\\div 0.3', '1.25+2.5-0.75', '0.5^{2}',
  '20\\%\\cdot 30', '50\\%+\\frac{1}{4}', '15\\%\\cdot 200', '12.5\\%\\cdot 8', '0.75\\cdot\\frac{2}{3}', '0.2\\cdot\\left(3+0.5\\right)',
  '1\\div 0.25', '0.3\\cdot 0.3', '10-0.01', '2.5^{2}-1', '1.2\\div 0.5', '0.125\\cdot 8', '\\frac{1.5}{0.5}', '\\frac{0.5}{2}',
  // raíces
  '\\sqrt{72}', '\\sqrt{12}', '\\sqrt{49}', '\\sqrt{\\frac{4}{9}}', '\\sqrt[3]{8}', '\\sqrt[3]{-27}', '\\sqrt{0.25}', '2\\sqrt{3}\\cdot\\sqrt{3}',
  '\\sqrt{2}\\cdot\\sqrt{8}', '\\sqrt{12}+\\sqrt{27}', '3\\sqrt{2}+5\\sqrt{2}', '\\sqrt{16}+\\sqrt{9}', '\\sqrt{3^{2}+4^{2}}', '\\sqrt{50}-\\sqrt{18}',
  '\\left(\\sqrt{5}\\right)^{2}', '\\sqrt{2}\\cdot\\sqrt{6}', '\\frac{\\sqrt{8}}{2}', '\\sqrt{25}\\cdot\\sqrt{4}-\\sqrt{100}', '\\sqrt{200}', '\\sqrt2\\cdot\\sqrt2',
  '\\sqrt{8}+\\sqrt{2}+1', '\\sqrt{144}\\div\\sqrt{9}', '2\\sqrt{18}', '\\sqrt[4]{16}', '\\sqrt{1.44}', '\\left(2\\sqrt{3}\\right)^{2}',
  // racionalización
  '\\frac{1}{\\sqrt{2}}', '\\frac{6}{\\sqrt{3}}', '\\frac{\\sqrt{2}}{\\sqrt{8}}', '\\frac{10}{2\\sqrt{5}}', '\\frac{3}{\\sqrt{6}}', '\\sqrt{\\frac{4}{3}}',
  '\\sqrt{\\frac{1}{2}}', '4^2\\div\\sqrt{12}', '\\sqrt{2}\\div\\sqrt{3}', '\\frac{\\sqrt{6}}{\\sqrt{2}}', '\\sqrt{2}+\\frac{1}{3}\\sqrt{3}', '0.5\\sqrt{2}+\\sqrt{2}', '\\frac{1}{\\tan 60\\degree}',
  // valores notables
  '\\sin 30\\degree', '\\sin 30\\degree+\\cos 60\\degree', '\\cos\\left(45^{\\circ}\\right)', '\\tan 60\\degree', '2\\sin\\left(30^{\\circ}\\right)',
  '\\sin^{2}\\left(45^{\\circ}\\right)+\\cos^{2}\\left(45^{\\circ}\\right)', '\\sin\\frac{\\pi}{6}', '\\cos\\left(\\frac{\\pi}{3}\\right)', '\\tan\\frac{\\pi}{4}',
  '\\sin\\left(\\frac{2\\pi}{3}\\right)', '\\cos\\pi', '\\sin\\left(\\frac{3\\pi}{2}\\right)', '4\\cos 120\\degree', '\\cos\\left(120^{\\circ}\\right)\\cdot 4', '\\sin(150^\\circ)',
  '\\tan(135^{\\circ})', '\\sin 45\\degree\\cdot\\cos 45\\degree', '\\cos 0\\degree', '\\tan 30\\degree', '4\\cos^{2}\\left(30^{\\circ}\\right)',
  '\\sin(-30^{\\circ})', '\\operatorname{sin}30\\degree', '\\sin 60\\degree-\\cos 30\\degree',
  { latex: '\\sin 30', angulo: 'deg' }, { latex: '\\cos 60+\\sin 90', angulo: 'deg' }, { latex: '2\\tan 45', angulo: 'deg' },
  { latex: '\\sin 270-\\cos 180', angulo: 'deg' }, { latex: '\\cos\\left(0\\right)', angulo: 'deg' }, { latex: '2\\sin 45', angulo: 'deg' },
  { latex: '\\sin^{2}60+\\cos^{2}60', angulo: 'deg' },
  // ecuaciones lineales
  '2x+3=7', '\\frac{x}{3}+\\frac{1}{2}=\\frac{5}{6}', '3(x-2)=2(x+1)', '5x-3=2x+9', '7=2x+3', 'x+5=2', '-x+4=10', '4x=10',
  '0.5x+1.2=3', '\\frac{2x-1}{3}=\\frac{x+2}{4}', '5-2(x+1)=3x', '2(x+1)=2x+2', '2(x+1)=2x+3', '\\frac{x}{2}=3', '3x-7=-x+5',
  'x-\\frac{1}{4}=\\frac{3}{4}', '2(3x-1)-4(x+2)=0', '\\frac{3}{4}x-2=1', '1.5x-0.5=2x+1', 'y+3=8', '2t-5=t', '-(x-3)=5',
  '6=3(x-1)', 'x=5x', '\\frac{x+1}{2}+\\frac{x-1}{3}=2', '\\frac x2+\\frac x3=5', '2x-\\frac{1}{3}=\\frac{1}{2}x', '0.2x=0.05',
  '3\\left(x+\\frac{1}{3}\\right)=4', '4x+2=4x', 'x\\cdot 3+1=10', '\\frac{x}{4}-1=\\frac{x}{6}', '-2x=8', '10-x=3', '2(x-3)=0',
  // cuadráticas
  'x^2-5x+6=0', 'x^2+x+1=0', '2x^2-8=0', 'x^2=3x', 'x^2=5x-6', '(x-1)(x+2)=0', 'x(x-3)=0', 'x^2-2x-1=0', 'x^2+2x+1=0',
  'x^2-4=0', 'x^2+4=0', 'x^2=5', '3x^2-12=0', 'x^2-6x=0', '2x^2+3x-2=0', '-x^2+4x-3=0', '(x+1)^2=4', 'x^2+6x+9=0',
  'x^2-3x+5=0', '4x^2-9=0', '2x^2=18', 'x^2=\\frac{1}{4}', 'x^2-x=x+3', '(x-3)^2=0', '2x^2-4x-6=0', 'x^2+4x+1=0',
  '3x^2+2x-1=0', 'x^2=-9', '\\frac{x^2}{2}-2=0', '0.5x^2-2=0', 'x^{2}-2x=0', 'x^2-8=0', '2x^2+x=0', '(2x-1)(x+3)=0',
  'x(x+1)=6', '(x-1)(x+1)=3', 'x^2+2x=x^2+4', '5x^2=0', 'x^2=\\frac{3}{2}', '2x^2+2x+1=0', 'x^2-12=0', 't^2-t-2=0',
  '9x^2-6x+1=0', 'x^2+x=0', '(x-2)(x-2)=0', '2x(x-4)=0', 'x^2+5=1', '-2x^2+8=0',
  // sistemas 2×2
  '\\begin{cases}x+y=3\\\\x-y=1\\end{cases}', '\\begin{cases}2x+3y=12\\\\3x-2y=5\\end{cases}', '\\begin{cases}y=2x+1\\\\3x+y=11\\end{cases}',
  '\\begin{cases}x+2y=4\\\\2x+4y=5\\end{cases}', '\\begin{cases}\\frac{x}{2}+y=3 & \\\\ x-y=0 & \\end{cases}', '\\begin{cases}3x+2y=7\\\\5x-3y=-1\\end{cases}',
  '\\begin{cases}x=2y\\\\x+y=9\\end{cases}', '\\begin{cases}2(x+1)=y\\\\x-y=-5\\end{cases}', '\\begin{cases}0.5x+y=2\\\\x-y=1\\end{cases}', '\\begin{cases}4a-b=5\\\\a+b=5\\end{cases}',
  '\\begin{cases}x+y=10\\\\x-y=3\\end{cases}', '\\begin{cases}y=3\\\\x+y=5\\end{cases}', '\\begin{cases}6x-4y=2\\\\9x+10y=41\\end{cases}',
];

// Deben devolver null (no soportado) sin romperse.
const NULOS = [
  '\\sqrt{-4}', 'x^3=8', '\\ln 2', '\\sqrt{2}+\\sqrt{3}', 'x+y=3', '\\sin 20\\degree', '\\frac{1}{0}', '\\frac{1}{1+\\sqrt{2}}', 'e^2',
  '\\mathrm{e}^{2}', '\\frac{1}{x}=2', '2^{0.5}', '\\placeholder{}+1', '3+', '\\frac{1}{', '2x+3', 'x^2', '5', '\\frac{1}{2}', '2+3=5',
  '\\tan 90\\degree', '\\sin 30', '\\sqrt{x}=2', '|x|=2', 'x^2+y^2=1', '\\pi+1', '10!', '\\log 100', '\\sqrt[3]{2}+1', '0^0', 'x=5', 'x=\\frac{3}{4}', 'y=-2', '\\frac{x}{x}=1', 'x^2+x^3=1',
  '2(1+\\sqrt{3})', '', '   ',
  { latex: '\\sin\\frac{\\pi}{6}', angulo: 'deg' }, { latex: '\\tan 45\\cdot 2', angulo: 'deg' },
  '\\begin{cases}x+y=3\\\\2x+2y=6\\end{cases}', '\\begin{cases}x+y=3\\\\x^2-y=1\\end{cases}', '\\begin{cases}x+y+z=3\\\\x-y=1\\end{cases}', '\\begin{cases}x+y=3\\end{cases}',
  '\\cos 120\\degree\\cdot 4', '\\operatorname{sen}30\\degree', '\\sin 30\\degree\\cdot 2',
];

// ───────────────────────── Generadores con semilla ─────────────────────────

function crearRng(semilla) {
  let s = semilla >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.ent = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.elegir = (arr) => arr[Math.floor(r() * arr.length)];
  r.noCero = (a, b) => {
    let v = 0;
    while (v === 0) v = r.ent(a, b);
    return v;
  };
  return r;
}

const fracTex = (a, b, r) => (a < 10 && b < 10 && r() < 0.4 ? `\\frac${a}${b}` : `\\frac{${a}}{${b}}`);
const potTex = (b, e, r) => (e < 10 && r() < 0.5 ? `${b}^${e}` : `${b}^{${e}}`);

function hoja(r) {
  const k = r();
  if (k < 0.3) return { tex: String(r.ent(1, 15)), nivel: 3 };
  if (k < 0.5) return { tex: fracTex(r.ent(1, 9), r.ent(2, 12), r), nivel: 3 };
  if (k < 0.6) return { tex: r.elegir(['0.5', '1.5', '0.25', '2.4', '0.2', '3.75', '1.2', '0.8', '2.5', '0.05', '0.6']), nivel: 3 };
  if (k < 0.65) return { tex: `${r.ent(1, 3)}\\frac{${r.ent(1, 4)}}{${r.ent(5, 9)}}`, nivel: 2 };
  if (k < 0.74) {
    const t = r.ent(0, 2);
    if (t === 0) return { tex: `\\sqrt{${r.elegir([4, 9, 16, 25, 36, 49, 64, 81, 100, 144])}}`, nivel: 3 };
    if (t === 1) return { tex: `\\sqrt{${r.elegir([8, 12, 18, 20, 27, 32, 45, 48, 50, 72, 75, 98])}}`, nivel: 3 };
    return { tex: `\\sqrt[3]{${r.elegir([8, 27, 64, -8, 125])}}`, nivel: 3 };
  }
  if (k < 0.84) return { tex: potTex(r.ent(2, 5), r.ent(2, 3), r), nivel: 3 };
  if (k < 0.88) return { tex: `${r.ent(2, 4)}^{-${r.ent(1, 2)}}`, nivel: 3 };
  if (k < 0.93) return { tex: `\\left(${fracTex(r.ent(1, 4), r.ent(2, 5), r)}\\right)^{${r.ent(2, 3)}}`, nivel: 3 };
  if (k < 0.97) return { tex: `\\left(-${r.ent(1, 9)}\\right)`, nivel: 3 };
  return { tex: `${r.elegir([10, 20, 25, 50, 75])}\\%`, nivel: 3 };
}
const factor = (e) => (e.nivel < 2 ? `\\left(${e.tex}\\right)` : e.tex);
function exprAleatoria(r, prof) {
  if (prof <= 0 || r() < 0.2) return hoja(r);
  const a = () => exprAleatoria(r, prof - 1);
  const k = r();
  if (k < 0.28) return { tex: `${a().tex}+${a().tex}`, nivel: 1 };
  if (k < 0.42) {
    const b = a();
    return { tex: `${a().tex}-${b.nivel < 2 ? `\\left(${b.tex}\\right)` : b.tex}`, nivel: 1 };
  }
  if (k < 0.58) return { tex: `${factor(a())}\\cdot ${factor(a())}`, nivel: 2 };
  if (k < 0.65) return { tex: `${factor(a())}\\times ${factor(a())}`, nivel: 2 };
  if (k < 0.76) {
    const b = a();
    return { tex: `${factor(a())}\\div ${b.nivel <= 2 ? `\\left(${b.tex}\\right)` : b.tex}`, nivel: 2 };
  }
  if (k < 0.86) return { tex: `\\frac{${a().tex}}{${a().tex}}`, nivel: 3 };
  if (k < 0.93) return { tex: `${r.ent(2, 5)}\\left(${a().tex}\\right)`, nivel: 2 };
  return { tex: `\\left(${a().tex}\\right)^{2}`, nivel: 3 };
}

const sg = (c, primero = false) => (c < 0 ? '-' : primero ? '' : '+');
const cx = (c, v = 'x', primero = false) => `${sg(c, primero)}${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}`;
const cn = (c, primero = false) => `${sg(c, primero)}${Math.abs(c)}`;
const cx2 = (c, v = 'x', primero = true, r = null) => `${sg(c, primero)}${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}${r && r() < 0.5 ? '^2' : '^{2}'}`;

function linealAleatoria(r) {
  const v = r() < 0.85 ? 'x' : r.elegir(['y', 't', 'z', 'm', 'n', 'a']);
  const a = r.noCero(-9, 9);
  const b = r.noCero(-12, 12);
  const c = r.noCero(-9, 9);
  const d = r.noCero(-12, 12);
  const e = r.ent(2, 9);
  const f = r.ent(2, 9);
  const dec = () => r.elegir(['0.5', '1.5', '0.2', '2.5', '0.25', '1.2', '3', '0.4']);
  switch (r.ent(0, 12)) {
    case 0:
      return `${cx(a, v, true)}${cn(b)}=${cn(d, true)}`;
    case 1:
      return `${cx(a, v, true)}${cn(b)}=${cx(c, v, true)}${cn(d)}`;
    case 2:
      return `${a}\\left(${v}${cn(b)}\\right)=${cn(d, true)}`;
    case 3:
      return `${a}(${v}${cn(b)})=${c}(${v}${cn(d)})`;
    case 4:
      return `\\frac{${v}}{${e}}${sg(b)}\\frac{${Math.abs(b)}}{${f}}=\\frac{${Math.abs(d)}}{${e + 1}}`;
    case 5:
      return `\\frac{${cx(a, v, true)}${cn(b)}}{${e}}=\\frac{${cx(c, v, true)}${cn(d)}}{${f}}`;
    case 6:
      return `${dec()}${v}+${dec()}=${dec()}`;
    case 7:
      return `${Math.abs(b)}-${Math.abs(a)}\\left(${v}${cn(c)}\\right)=${cx(d, v, true)}`;
    case 8:
      return `${cn(d, true)}=${cx(a, v, true)}${cn(b)}`;
    case 9:
      return `-\\left(${v}${cn(b)}\\right)+${Math.abs(c)}=${cx(d, v, true)}`;
    case 10:
      return `${fracTex(Math.abs(a), e, r)}${v}${cn(b)}=${cn(d, true)}`;
    case 11:
      return r() < 0.5 ? `${a}(${v}${cn(b)})=${a}${v}${cn(a * b)}` : `${a}(${v}${cn(b)})=${a}${v}${cn(a * b + 1)}`;
    default:
      return `${dec()}${v}-${dec()}=${dec()}${v}+${dec()}`;
  }
}

function cuadraticaAleatoria(r) {
  const v = r() < 0.9 ? 'x' : r.elegir(['y', 't', 'z']);
  const r1 = r.ent(-7, 7);
  const r2 = r.ent(-7, 7);
  const a = r.elegir([1, 1, 1, 2, 3, -1, -2]);
  const b0 = -a * (r1 + r2);
  const c0 = a * r1 * r2;
  const term = (coef, pot, primero) => (coef === 0 ? '' : pot === 2 ? cx2(coef, v, primero, r) : pot === 1 ? cx(coef, v, primero) : cn(coef, primero));
  const poli = (A, B, C) => {
    let s = term(A, 2, true);
    if (B) s += term(B, 1, !s);
    if (C) s += term(C, 0, !s);
    return s || '0';
  };
  switch (r.ent(0, 9)) {
    case 0:
      return `${poli(a, b0, c0)}=0`;
    case 1: {
      const A = r.noCero(-4, 4);
      return `${poli(A, r.ent(-9, 9), r.ent(-9, 9))}=0`;
    }
    case 2:
      return `(${v}${cn(-r1)})(${v}${cn(-r2)})=0`.replace(/\+0\)/g, ')').replace(/-0\)/g, ')');
    case 3:
      return `${v}^2=${poli(0, -b0 / a || r.noCero(-6, 6), -c0 / a)}`;
    case 4:
      return `${poli(r.noCero(-4, 4), 0, r.noCero(-20, 20))}=0`;
    case 5:
      return `${poli(r.noCero(-4, 4), r.noCero(-9, 9), 0)}=0`;
    case 6:
      return `(${v}${cn(r.noCero(-5, 5))})^2=${r.ent(0, 16)}`;
    case 7:
      return `${v}(${v}${cn(r.noCero(-6, 6))})=${r.ent(-6, 12)}`;
    case 8:
      return `${poli(a, r.ent(-5, 5), 0)}=${poli(0, r.ent(-5, 5), r.ent(-9, 9))}`;
    default:
      return `${poli(a, b0, 0)}=${-c0 || 1}`;
  }
}

function sistemaAleatorio(r) {
  const [u, v] = r() < 0.85 ? ['x', 'y'] : r.elegir([['a', 'b'], ['m', 'n'], ['p', 'q']]);
  const x0 = r.ent(-6, 6);
  const y0 = r.ent(-6, 6);
  const a = r.noCero(-6, 6);
  const b = r.noCero(-6, 6);
  let c = r.noCero(-6, 6);
  let d = r.noCero(-6, 6);
  if (a * d === b * c && r() < 0.8) d = d === -1 ? 2 : d + 1;
  const eq = (p, q) => `${cx(p, u, true)}${cx(q, v)}=${p * x0 + q * y0}`;
  const amp = r() < 0.2 ? ' & ' : '';
  let e1 = eq(a, b);
  let e2 = eq(c, d);
  switch (r.ent(0, 5)) {
    case 0:
      e1 = `${v}=${cx(a, u, true)}${cn(y0 - a * x0)}`.replace(/\+0$|-0$/, '');
      break;
    case 1:
      e2 = `${cx(c, u, true)}=${d * y0 + c * x0}${cx(-d, v)}`;
      break;
    case 2:
      e1 = `\\frac{${u}}{2}${cx(b, v)}=${x0 / 2 + b * y0}`;
      break;
    case 3:
      e2 = `${Math.abs(c)}\\left(${u}${cn(d)}\\right)=${Math.abs(c) * (x0 + d)}+${v}${cn(-y0)}`;
      break;
    default:
      break;
  }
  return `\\begin{cases}${e1}${amp}\\\\${e2}${amp}\\end{cases}`;
}

const ANG_DEG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const ANG_RAD = ['0', '\\frac{\\pi}{6}', '\\frac{\\pi}{4}', '\\frac{\\pi}{3}', '\\frac{\\pi}{2}', '\\frac{2\\pi}{3}', '\\frac{3\\pi}{4}', '\\frac{5\\pi}{6}', '\\pi', '\\frac{3\\pi}{2}', '2\\pi'];
function trigAleatoria(r) {
  const modo = r.ent(0, 2);
  const f = () => r.elegir(['\\sin', '\\cos', '\\tan']);
  const arg = () => {
    if (modo === 0) return r() < 0.5 ? ` ${r.elegir(ANG_DEG)}\\degree` : `\\left(${r.elegir(ANG_DEG)}^{\\circ}\\right)`;
    if (modo === 1) return ` ${r.elegir(ANG_DEG)}`;
    return `\\left(${r.elegir(ANG_RAD)}\\right)`;
  };
  const t1 = `${f()}${arg()}`;
  const t2 = `${f()}${arg()}`;
  const k = r.ent(2, 4);
  const latex = r.elegir([t1, `${t1}+${t2}`, `${k}${t1}`, `${t1}\\cdot ${t2}`, `${t1}-${t2}`]);
  return { latex, angulo: modo === 1 ? 'deg' : 'rad' };
}

function bateria() {
  const out = [];
  for (const c of A_MANO) out.push({ ...(typeof c === 'string' ? { latex: c } : c), grupo: 'a mano' });
  for (const c of NULOS) out.push({ ...(typeof c === 'string' ? { latex: c } : c), grupo: 'nulos', nulo: true });
  const r = crearRng(20261004);
  for (let i = 0; i < 900; i++) out.push({ latex: exprAleatoria(r, r.ent(1, 3)).tex, grupo: 'aritmética aleatoria' });
  for (let i = 0; i < 300; i++) out.push({ latex: linealAleatoria(r), grupo: 'lineal aleatoria' });
  for (let i = 0; i < 300; i++) out.push({ latex: cuadraticaAleatoria(r), grupo: 'cuadrática aleatoria' });
  for (let i = 0; i < 120; i++) out.push({ ...trigAleatoria(r), grupo: 'trigonometría aleatoria' });
  for (let i = 0; i < 150; i++) out.push({ latex: sistemaAleatorio(r), grupo: 'sistemas aleatorios' });
  const vistos = new Set();
  return out.filter((c) => {
    const k = `${c.latex}|${c.angulo || 'rad'}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// ───────────────────────── Utilidades de verificación ─────────────────────────

function conAngulo(angulo, fn) {
  const prev = ce.angularUnit;
  ce.angularUnit = angulo;
  try {
    return fn();
  } finally {
    ce.angularUnit = prev;
  }
}

function quitarColor(s) {
  const marca = '\\textcolor{';
  let i;
  while ((i = s.indexOf(marca)) >= 0) {
    const finHex = s.indexOf('}', i);
    if (s[finHex + 1] !== '{') throw new Error('\\textcolor mal formado');
    let prof = 0;
    let j = finHex + 1;
    for (; j < s.length; j++) {
      if (s[j] === '{') prof++;
      else if (s[j] === '}' && --prof === 0) break;
    }
    if (j >= s.length) throw new Error('\\textcolor sin cerrar');
    s = s.slice(0, i) + s.slice(finHex + 2, j) + s.slice(j + 1);
  }
  return s;
}

function chequeoSintactico(tex) {
  const errores = [];
  let prof = 0;
  for (const ch of tex) {
    if (ch === '{') prof++;
    if (ch === '}') prof--;
    if (prof < 0) break;
  }
  if (prof !== 0) errores.push('llaves desbalanceadas');
  const izq = (tex.match(/\\left[([]/g) || []).length;
  const der = (tex.match(/\\right[)\]]/g) || []).length;
  if (izq !== der) errores.push('\\left/\\right desbalanceados');
  const colores = (tex.match(/\\textcolor/g) || []).length;
  const coloresBien = (tex.match(/\\textcolor\{#[0-9a-fA-F]{6}\}\{/g) || []).length;
  if (colores !== coloresBien) errores.push('\\textcolor mal formado');
  try {
    quitarColor(tex);
  } catch (e) {
    errores.push(e.message);
  }
  return errores;
}

const BASURA = /NaN|undefined|Infinity|null|\[object|function/;
const DECIMAL_LARGO = /\d[.,]\d{12,}/;

function valorCE(tex) {
  const e = ce.parse(tex);
  if (!e.isValid) return { re: NaN, im: NaN, invalido: true };
  const v = e.N();
  return { re: typeof v.re === 'number' ? v.re : NaN, im: typeof v.im === 'number' ? v.im : 0 };
}
const iguales = (a, b, tol = TOL) => {
  if (![a.re, a.im, b.re, b.im].every(Number.isFinite)) return false;
  const esc = Math.max(1, Math.hypot(a.re, a.im), Math.hypot(b.re, b.im));
  return Math.hypot(a.re - b.re, a.im - b.im) <= tol * esc;
};

function partirTop(s, sep) {
  const out = [];
  let prof = 0;
  let ini = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') prof++;
    else if (s[i] === '}') prof--;
    else if (prof === 0 && s.startsWith(sep, i)) {
      out.push(s.slice(ini, i));
      ini = i + sep.length;
      i += sep.length - 1;
    }
  }
  out.push(s.slice(ini));
  return out;
}

// Reemplaza x por un número (real o complejo) y evalúa.
function evaluarEn(texExpr, x, valor) {
  const e = ce.parse(texExpr);
  if (!e.isValid) return { re: NaN, im: NaN };
  const sust = valor.im ? ce.expr(['Complex', valor.re, valor.im]) : ce.number(valor.re);
  const v = e.subs({ [x]: sust }).N();
  return { re: typeof v.re === 'number' ? v.re : NaN, im: typeof v.im === 'number' ? v.im : 0 };
}
function esConstante(texExpr, x) {
  const a = evaluarEn(texExpr, x, { re: 1.37, im: 0 });
  const b = evaluarEn(texExpr, x, { re: -2.71, im: 0 });
  return iguales(a, b, 1e-12) && Number.isFinite(a.re);
}
// Valores de una expresión constante, abriendo ±.
function valoresPM(texExpr) {
  if (!texExpr.includes('\\pm')) return [valorCE(texExpr)];
  return [valorCE(texExpr.replace(/\\pm/g, '+')), valorCE(texExpr.replace(/\\pm/g, '-'))];
}
const contiene = (lista, v, tol = 1e-9) => lista.some((w) => iguales(w, v, tol));
const mismoConjunto = (A, B, tol = 1e-9) => A.every((a) => contiene(B, a, tol)) && B.every((b) => contiene(A, b, tol));

// ───────────────────────── Validación de un caso ─────────────────────────

function validarComun(r, fallas) {
  if (typeof r.titulo !== 'string' || !r.titulo) fallas.push('sin título');
  if (!Array.isArray(r.pasos) || r.pasos.length < 2) fallas.push('menos de dos pasos');
  if (typeof r.resultado !== 'string' || !r.resultado) fallas.push('sin resultado');
  let anterior = null;
  r.pasos.forEach((p, i) => {
    const donde = `paso ${i}`;
    if (typeof p.texto !== 'string' || !p.texto.trim()) fallas.push(`${donde}: texto vacío`);
    if (typeof p.tex !== 'string' || !p.tex.trim()) return fallas.push(`${donde}: tex vacío`);
    if (BASURA.test(p.texto) || BASURA.test(p.tex)) fallas.push(`${donde}: contiene basura (NaN/undefined/…)`);
    if (DECIMAL_LARGO.test(p.tex) || DECIMAL_LARGO.test(p.texto)) fallas.push(`${donde}: decimal con basura de coma flotante`);
    for (const e of chequeoSintactico(p.tex)) fallas.push(`${donde}: ${e}`);
    const sinColor = (() => {
      try {
        return quitarColor(p.tex);
      } catch {
        return p.tex;
      }
    })();
    if (anterior !== null && sinColor === anterior) fallas.push(`${donde}: repite el tex del paso anterior`);
    anterior = sinColor;
    const exp = ce.parse(p.tex);
    if (!exp.isValid) fallas.push(`${donde}: Compute Engine no lo entiende (${JSON.stringify(exp.json).slice(0, 120)})`);
    if (mathlive) {
      const errs = mathlive.validateLatex(p.tex);
      if (errs.length) fallas.push(`${donde}: MathLive marca errores ${JSON.stringify(errs)}`);
      const markup = mathlive.convertLatexToMarkup(p.tex);
      if (/ML__error/.test(markup)) fallas.push(`${donde}: MathLive no lo puede dibujar`);
    }
  });
  for (const e of chequeoSintactico(r.resultado)) fallas.push(`resultado: ${e}`);
  if (!ce.parse(r.resultado).isValid) fallas.push('resultado: Compute Engine no lo entiende');
  if (mathlive && (mathlive.validateLatex(r.resultado).length || /ML__error/.test(mathlive.convertLatexToMarkup(r.resultado)))) fallas.push('resultado: MathLive no lo puede dibujar');
  if (BASURA.test(r.resultado) || DECIMAL_LARGO.test(r.resultado)) fallas.push('resultado con basura');
}

function validarAritmetica(caso, r, fallas) {
  const ref = valorCE(caso.latex);
  const exacto = ce.parse(caso.latex).evaluate();
  r.pasos.forEach((p, i) => {
    const t = quitarColor(p.tex);
    if (t.includes('=')) return fallas.push(`paso ${i}: un cálculo no debería tener "="`);
    const v = valorCE(t);
    if (!iguales(v, ref)) fallas.push(`paso ${i}: vale ${v.re}${v.im ? `+${v.im}i` : ''} y la entrada vale ${ref.re} → ${p.tex}`);
  });
  const fin = ce.parse(r.resultado).evaluate();
  if (!iguales(valorCE(r.resultado), ref)) fallas.push(`resultado ${r.resultado} ≠ ${exacto.latex}`);
  const j = exacto.json;
  const esRacionalExacto = typeof j === 'number' || (Array.isArray(j) && j[0] === 'Rational');
  if (esRacionalExacto && !fin.isSame(exacto)) fallas.push(`resultado ${r.resultado} no coincide exactamente con ${exacto.latex}`);
  if (Array.isArray(j) && (j[0] === 'Sqrt' || (j[0] === 'Multiply' && JSON.stringify(j).includes('Sqrt')) || (j[0] === 'Divide' && JSON.stringify(j).includes('Sqrt')))) {
    if (!fin.isSame(exacto) && !fin.isEqual(exacto)) fallas.push(`resultado ${r.resultado} no es igual a ${exacto.latex}`);
  }
}

function solucionesCE(latex, x) {
  const s = ce.parse(latex).solve(x);
  if (!Array.isArray(s)) return null;
  const vals = s.map((e) => {
    const v = e.N();
    return { re: typeof v.re === 'number' ? v.re : NaN, im: typeof v.im === 'number' ? v.im : 0 };
  });
  const unicos = [];
  for (const v of vals) if (!contiene(unicos, v, 1e-9)) unicos.push(v);
  return unicos;
}

function variableDe(latex) {
  const sinCmd = latex.replace(/\\[a-zA-Z]+/g, ' ');
  const letras = new Set((sinCmd.match(/[a-z]/g) || []).filter((c) => c !== 'e' && c !== 'i'));
  return letras.size === 1 ? [...letras][0] : null;
}

function solucionesDelResultado(res, x, fallas) {
  if (res === 'S=\\varnothing') return { tipo: 'ninguna', valores: [] };
  if (res === 'S=\\mathbb{R}') return { tipo: 'todas', valores: [] };
  const valores = [];
  for (const seg of partirTop(res, ',\\quad')) {
    const m = new RegExp(`^${x}(?:_[12])?=(.+)$`).exec(seg.trim());
    if (!m) {
      fallas.push(`resultado con forma inesperada: ${res}`);
      return { tipo: 'finitas', valores };
    }
    valores.push(valorCE(m[1]));
  }
  return { tipo: 'finitas', valores };
}

function validarEcuacion(caso, r, fallas) {
  const x = variableDe(caso.latex);
  if (!x) return fallas.push('no se pudo identificar la variable');
  const sol = solucionesDelResultado(r.resultado, x, fallas);
  const ceSol = solucionesCE(caso.latex, x);
  const [lhs0, rhs0] = caso.latex.split('=');
  const muestras = [0.37, -1.73, 2.91, 5.13];
  const difOriginal = muestras.map((m) => {
    const a = evaluarEn(lhs0, x, { re: m, im: 0 });
    const b = evaluarEn(rhs0, x, { re: m, im: 0 });
    return { re: a.re - b.re, im: a.im - b.im };
  });
  if (sol.tipo === 'finitas') {
    if (!ceSol) fallas.push('Compute Engine no pudo resolver la ecuación');
    else if (!mismoConjunto(sol.valores, ceSol)) fallas.push(`soluciones ${JSON.stringify(sol.valores)} ≠ las de Compute Engine ${JSON.stringify(ceSol)}`);
    for (const s of sol.valores) {
      const a = evaluarEn(lhs0, x, s);
      const b = evaluarEn(rhs0, x, s);
      if (!iguales(a, b, 1e-9)) fallas.push(`la solución ${s.re}${s.im ? `+${s.im}i` : ''} no verifica la ecuación original`);
    }
  } else {
    if (ceSol && ceSol.length) fallas.push(`dice "${sol.tipo}" pero Compute Engine encontró ${JSON.stringify(ceSol)}`);
    const ceros = difOriginal.every((d) => Math.abs(d.re) < 1e-9);
    const constante = difOriginal.every((d) => Math.abs(d.re - difOriginal[0].re) < 1e-9) && Math.abs(difOriginal[0].re) > 1e-9;
    if (sol.tipo === 'todas' && !ceros) fallas.push('dice infinitas soluciones pero la ecuación no es una identidad');
    if (sol.tipo === 'ninguna' && !constante) fallas.push('dice sin solución pero la ecuación no es contradictoria');
  }

  let abc = null;
  r.pasos.forEach((p, i) => {
    const donde = `paso ${i}`;
    const t = quitarColor(p.tex).trim();
    if (/^S=/.test(t)) {
      if (i !== r.pasos.length - 1) fallas.push(`${donde}: S=… sólo puede ir al final`);
      return;
    }
    const chequearEcuacion = (L, R, etiqueta) => {
      if (sol.tipo === 'finitas') {
        for (const s of sol.valores) {
          const a = evaluarEn(L, x, s);
          const b = evaluarEn(R, x, s);
          if (!iguales(a, b, 1e-9)) return `${etiqueta}: con ${x}=${s.re}${s.im ? `+${s.im}i` : ''} da ${a.re} ≠ ${b.re}`;
        }
        // Además tiene que ser equivalente a la original: L − R = k·(L₀ − R₀) con k constante ≠ 0.
        const razones = [];
        muestras.forEach((m, j) => {
          const d0 = difOriginal[j].re;
          if (!Number.isFinite(d0) || Math.abs(d0) < 1e-9) return;
          const d = evaluarEn(L, x, { re: m, im: 0 }).re - evaluarEn(R, x, { re: m, im: 0 }).re;
          razones.push(d / d0);
        });
        if (razones.length >= 2 && !(razones.every((k) => Number.isFinite(k) && Math.abs(k - razones[0]) <= 1e-9 * Math.max(1, Math.abs(k))) && Math.abs(razones[0]) > 1e-12)) {
          // Transformación no lineal (p. ej. "un cuadrado es cero si la base es cero"): mismo conjunto solución.
          const propias = solucionesCE(`${L}=${R}`, x);
          if (!propias || !mismoConjunto(propias, sol.valores)) return `${etiqueta}: la ecuación ${L}=${R} no es equivalente a la original`;
        }
        return null;
      }
      const difs = muestras.map((m) => {
        const a = evaluarEn(L, x, { re: m, im: 0 });
        const b = evaluarEn(R, x, { re: m, im: 0 });
        return a.re - b.re;
      });
      if (!difs.every(Number.isFinite)) return `${etiqueta}: no se puede evaluar`;
      if (sol.tipo === 'todas' && !difs.every((d) => Math.abs(d) < 1e-9)) return `${etiqueta}: debería ser una identidad`;
      if (sol.tipo === 'ninguna' && !(difs.every((d) => Math.abs(d - difs[0]) < 1e-9) && Math.abs(difs[0]) > 1e-9)) return `${etiqueta}: debería ser una igualdad falsa`;
      return null;
    };
    if (t.includes('\\lor')) {
      const ramas = partirTop(t, '\\lor').map((s) => partirTop(s.trim(), '='));
      if (ramas.some((rm) => rm.length !== 2)) return fallas.push(`${donde}: rama sin forma A=B`);
      if (sol.tipo !== 'finitas') return fallas.push(`${donde}: disyunción en una ecuación sin soluciones finitas`);
      for (const s of sol.valores) {
        const ok = ramas.some(([L, R]) => iguales(evaluarEn(L, x, s), evaluarEn(R, x, s), 1e-9));
        if (!ok) fallas.push(`${donde}: ${x}=${s.re} no cumple ninguna rama`);
      }
      for (const [L, R] of ramas) {
        if (!sol.valores.some((s) => iguales(evaluarEn(L, x, s), evaluarEn(R, x, s), 1e-9))) fallas.push(`${donde}: la rama ${L}=${R} no tiene ninguna de las soluciones`);
      }
      return;
    }
    const mAbc = /^a=([^,]+),\\quad b=([^,]+),\\quad c=(.+)$/.exec(t);
    if (mAbc) {
      abc = mAbc.slice(1).map((s) => valorCE(s).re);
      const [a, b, c] = abc;
      if (sol.tipo === 'finitas') {
        for (const s of sol.valores) {
          const re = a * (s.re * s.re - s.im * s.im) + b * s.re + c;
          const im = a * 2 * s.re * s.im + b * s.im;
          if (Math.hypot(re, im) > 1e-8 * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c))) fallas.push(`${donde}: con a, b, c así, ${s.re} no es raíz`);
        }
      }
      return;
    }
    if (t.startsWith('\\Delta=')) {
      const partes = partirTop(t, '=').slice(1);
      const vals = partes.map((s) => valorCE(s));
      if (!vals.every((v) => iguales(v, vals[0]))) fallas.push(`${donde}: la cadena del discriminante no es consistente`);
      if (abc && !iguales(vals[0], { re: abc[1] * abc[1] - 4 * abc[0] * abc[2], im: 0 })) fallas.push(`${donde}: Δ no es b²−4ac`);
      return;
    }
    const segs = partirTop(t, ',\\quad');
    const etiquetados = [];
    let hayEtiquetados = false;
    for (const seg of segs) {
      const partes = partirTop(seg.trim(), '=');
      if (partes.length < 2) {
        fallas.push(`${donde}: segmento sin "=": ${seg}`);
        continue;
      }
      const etiqueta = partes[0].trim();
      const esEtiqueta = etiqueta === x || etiqueta === `${x}_1` || etiqueta === `${x}_2`;
      const resto = partes.slice(1);
      if (esEtiqueta && resto.every((s) => esConstante(s.replace(/\\pm/g, '+'), x))) {
        hayEtiquetados = true;
        const conjuntos = resto.map(valoresPM);
        for (const c of conjuntos) {
          if (!mismoConjunto(c, conjuntos[0])) fallas.push(`${donde}: la cadena ${seg} no es consistente`);
        }
        if (sol.tipo !== 'finitas') {
          fallas.push(`${donde}: da valores pero la ecuación no tiene soluciones finitas`);
          continue;
        }
        for (const v of conjuntos[0]) {
          if (!contiene(sol.valores, v)) fallas.push(`${donde}: ${v.re}${v.im ? `+${v.im}i` : ''} no es solución`);
          etiquetados.push(v);
        }
        continue;
      }
      if (partes.length !== 2) {
        fallas.push(`${donde}: cadena de igualdades con ${x}: ${seg}`);
        continue;
      }
      const err = chequearEcuacion(partes[0], partes[1], donde);
      if (err) fallas.push(err);
    }
    if (hayEtiquetados && sol.tipo === 'finitas' && !mismoConjunto(etiquetados, sol.valores)) fallas.push(`${donde}: los valores no cubren todas las soluciones`);
  });
}

function evaluarEn2(texExpr, vars, a, b) {
  const e = ce.parse(texExpr);
  if (!e.isValid) return { re: NaN, im: NaN };
  const v = e.subs({ [vars[0]]: ce.number(a), [vars[1]]: ce.number(b) }).N();
  return { re: typeof v.re === 'number' ? v.re : NaN, im: typeof v.im === 'number' ? v.im : 0 };
}

function validarSistema(caso, r, fallas) {
  const m = /^\s*\\begin\{cases\}([\s\S]*)\\end\{cases\}\s*$/.exec(caso.latex);
  if (!m) return fallas.push('no parece un sistema');
  const ecs = m[1]
    .split('\\\\')
    .map((t) => t.replace(/&/g, ' ').trim())
    .filter(Boolean);
  const vars = [...new Set(ecs.join(' ').replace(/\\[a-zA-Z]+/g, ' ').match(/[a-z]/g))].sort();
  if (vars.length !== 2 || ecs.length !== 2) return fallas.push('el validador no entiende el sistema');
  // Coeficientes de cada ecuación (lineal): f(u, v) = A·u + B·v + C, evaluando con Compute Engine.
  const coefs = ecs.map((ec) => {
    const [L, R] = ec.split('=');
    const f = (a, b) => evaluarEn2(L, vars, a, b).re - evaluarEn2(R, vars, a, b).re;
    const C = f(0, 0);
    return { A: f(1, 0) - C, B: f(0, 1) - C, C, f };
  });
  const det = coefs[0].A * coefs[1].B - coefs[1].A * coefs[0].B;
  let sol = null;
  if (r.resultado === 'S=\\varnothing') {
    if (Math.abs(det) > 1e-9) fallas.push('dice que no tiene solución pero el determinante no es cero');
    const k = Math.abs(coefs[0].A) > 1e-12 ? coefs[1].A / coefs[0].A : coefs[1].B / coefs[0].B;
    if (Math.abs(coefs[1].C - k * coefs[0].C) < 1e-9) fallas.push('dice que no tiene solución pero las ecuaciones son equivalentes');
  } else {
    const mm = new RegExp(`^${vars[0]}=(.+),\\\\quad ${vars[1]}=(.+)$`).exec(r.resultado);
    if (!mm) return fallas.push(`resultado con forma inesperada: ${r.resultado}`);
    sol = [valorCE(mm[1]).re, valorCE(mm[2]).re];
    for (const c of coefs) if (Math.abs(c.f(sol[0], sol[1])) > 1e-9) fallas.push('la solución no verifica el sistema original');
    const s = ce.parse(caso.latex.replace(/&/g, ' ')).solve(vars);
    if (!s || typeof s !== 'object' || !s[vars[0]]) fallas.push('Compute Engine no resolvió el sistema');
    else if (!cerca(s[vars[0]].N().re, sol[0]) || !cerca(s[vars[1]].N().re, sol[1])) fallas.push(`Compute Engine da ${s[vars[0]].latex}, ${s[vars[1]].latex}`);
  }
  r.pasos.forEach((p, i) => {
    const t = quitarColor(p.tex).trim();
    if (t === 'S=\\varnothing') return;
    const mc = /^\\begin\{cases\}([\s\S]*)\\end\{cases\}$/.exec(t);
    const segs = mc ? mc[1].split('\\\\') : partirTop(t, ',\\quad');
    for (const seg of segs) {
      const partes = partirTop(seg.trim(), '=');
      if (partes.length < 2) {
        fallas.push(`paso ${i}: segmento sin "=": ${seg}`);
        continue;
      }
      if (!sol) continue;
      const vals = partes.map((q) => evaluarEn2(q, vars, sol[0], sol[1]));
      if (!vals.every((w) => iguales(w, vals[0], 1e-9))) fallas.push(`paso ${i}: ${seg} no se cumple con ${vars[0]}=${sol[0]}, ${vars[1]}=${sol[1]}`);
    }
  });
}
const cerca = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// ───────────────────────── Corrida ─────────────────────────

const casos = SOLO ? [{ latex: SOLO, grupo: 'solo' }] : bateria();
const porGrupo = {};
const listaFallas = [];
let entradas = 0;
let soportadas = 0;
let saltadas = 0;
const t0 = Date.now();

for (const caso of casos) {
  const angulo = caso.angulo || 'rad';
  const g = (porGrupo[caso.grupo] ||= { entradas: 0, soportadas: 0, saltadas: 0 });
  // Las aleatorias que Compute Engine no puede evaluar (división por cero, números enormes…) no cuentan.
  if (caso.grupo === 'aritmética aleatoria' || caso.grupo === 'trigonometría aleatoria') {
    const ref = conAngulo(angulo, () => valorCE(caso.latex));
    if (!Number.isFinite(ref.re) || Math.abs(ref.im) > 1e-12 || Math.abs(ref.re) > 1e12) {
      saltadas++;
      g.saltadas++;
      continue;
    }
  }
  entradas++;
  g.entradas++;
  const fallas = [];
  let r = null;
  try {
    r = generarPasos(caso.latex, { ce, angulo, verificar: false });
  } catch (e) {
    fallas.push(`excepción: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
  if (caso.nulo && r) fallas.push('debería devolver null');
  if (caso.grupo === 'a mano' && !r && !fallas.length) fallas.push('no tiene pasos (todas las de la lista a mano tienen que estar soportadas)');
  if (r && !caso.nulo) {
    soportadas++;
    g.soportadas++;
    try {
      conAngulo(angulo, () => {
        validarComun(r, fallas);
        if (r.titulo === 'Calcular') validarAritmetica(caso, r, fallas);
        else if (r.titulo === 'Resolver el sistema') validarSistema(caso, r, fallas);
        else validarEcuacion(caso, r, fallas);
      });
    } catch (e) {
      fallas.push(`el validador explotó: ${e.message}`);
    }
    // Con la verificación interna (como en la UI) tiene que dar exactamente lo mismo.
    let r2 = null;
    try {
      r2 = generarPasos(caso.latex, { ce, angulo });
    } catch (e) {
      fallas.push(`excepción con verificación: ${e.message}`);
    }
    if (!r2) fallas.push('la verificación interna contra Compute Engine lo rechazó');
    else if (JSON.stringify(r2) !== JSON.stringify(r)) fallas.push('con verificación interna da otra cosa');
    if (ce.angularUnit !== 'rad') fallas.push('generarPasos dejó cambiada la unidad de ángulo de Compute Engine');
  } else if (!caso.nulo) {
    try {
      if (generarPasos(caso.latex, { ce, angulo }) !== null) fallas.push('sin verificación da null pero con verificación no');
    } catch (e) {
      fallas.push(`excepción: ${e.message}`);
    }
  }
  if (fallas.length) listaFallas.push({ caso, fallas, r });
  if (VERBOSE || SOLO) {
    console.log(`\n${r ? '✔' : '·'} ${caso.latex}${angulo === 'deg' ? '  [grados]' : ''}`);
    if (r) {
      for (const p of r.pasos) console.log(`    ${p.texto}\n        ${p.tex}`);
      console.log(`    ⇒ ${r.resultado}`);
    }
  }
}

console.log('\n══════ Validación de pasos ══════');
for (const [nombre, g] of Object.entries(porGrupo)) {
  const pct = g.entradas ? ((100 * g.soportadas) / g.entradas).toFixed(1) : '—';
  console.log(`  ${nombre.padEnd(26)} entradas: ${String(g.entradas).padStart(4)}   con pasos: ${String(g.soportadas).padStart(4)} (${pct}%)${g.saltadas ? `   descartadas: ${g.saltadas}` : ''}`);
}
console.log(`  ${'TOTAL'.padEnd(26)} entradas: ${String(entradas).padStart(4)}   con pasos: ${String(soportadas).padStart(4)}   fallas: ${listaFallas.length}   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (saltadas) console.log(`  (${saltadas} expresiones aleatorias descartadas porque Compute Engine no da un número real finito)`);
if (!mathlive) console.log('  (sin prueba de render: MathLive SSR no cargó)');

if (VERBOSE) {
  const noSop = casos.filter((c) => c.grupo === 'a mano').filter((c) => !generarPasos(c.latex, { ce, angulo: c.angulo || 'rad' }));
  if (noSop.length) console.log(`\nA mano sin pasos (${noSop.length}): ${noSop.map((c) => c.latex).join('   ')}`);
}

if (listaFallas.length) {
  console.log('\n══════ FALLAS ══════');
  for (const { caso, fallas, r } of listaFallas.slice(0, 60)) {
    console.log(`\n✘ ${caso.latex}  (${caso.grupo}${caso.angulo === 'deg' ? ', grados' : ''})`);
    for (const f of fallas.slice(0, 8)) console.log(`    - ${f}`);
    if (r && VERBOSE) for (const p of r.pasos) console.log(`        · ${p.texto} → ${p.tex}`);
  }
  if (listaFallas.length > 60) console.log(`\n… y ${listaFallas.length - 60} más`);
  process.exit(1);
}
console.log('\nTodo bien ✔');
