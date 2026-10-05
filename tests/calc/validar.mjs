// Motor de la calculadora: qué tipo de problema detecta y qué respuesta principal da.
import { resolver } from '../../js/calc/motor.js';

const casos = [
  // [entrada, angulo, tipo, principal esperada]
  ['\\frac34+\\frac56', 'deg', 'numero', '\\frac{19}{12}'],
  ['\\frac{1}{2}+\\frac{1}{3}', 'deg', 'numero', '\\frac{5}{6}'],
  ['2{,}5+\\frac14', 'deg', 'numero', '2.75'],
  ['0{,}5\\times4', 'deg', 'numero', '2'],
  ['\\sqrt{72}', 'deg', 'numero', '6\\sqrt{2}'],
  ['\\sqrt{\\left(12\\right)}', 'deg', 'numero', '2\\sqrt{3}'],
  ['\\sin\\left(30\\right)', 'deg', 'numero', '\\frac{1}{2}'],
  ['\\sin\\left(30\\degree\\right)+\\cos\\left(60\\degree\\right)', 'deg', 'numero', '1'],
  ['\\sin\\left(30\\degree\\right)', 'rad', 'numero', '\\frac{1}{2}'],
  ['\\cos\\left(\\pi\\right)', 'rad', 'numero', '-1'],
  ['\\tan\\left(45\\right)', 'deg', 'numero', '1'],
  ['\\arcsin\\left(\\frac12\\right)', 'deg', 'numero', '30'],
  ['\\log_{2}\\left(32\\right)', 'deg', 'numero', '5'],
  ['\\log\\left(1000\\right)', 'deg', 'numero', '3'],
  ['\\binom{10}{3}', 'deg', 'numero', '120'],
  ['5!', 'deg', 'numero', '120'],
  ['\\left(\\frac{2}{3}\\right)^{2}\\cdot9-4', 'deg', 'numero', '0'],
  ['2^{-3}', 'deg', 'numero', '\\frac{1}{8}'],
  ['\\left|-7\\right|', 'deg', 'numero', '7'],
  ['12\\%\\cdot50', 'deg', 'numero', '6'],
  ['\\int_{0}^{1}x^{2}\\,dx', 'deg', 'numero', '\\frac{1}{3}'],
  ['2x+3=7', 'deg', 'ecuacion', 'x=2'],
  ['\\frac{x}{3}+\\frac{1}{2}=\\frac{5}{6}', 'deg', 'ecuacion', 'x=1'],
  ['x^{2}-5x+6=0', 'deg', 'ecuacion', 'x_{1}=2,\\quad x_{2}=3'],
  ['x^2-2=0', 'deg', 'ecuacion', 'x_{1}=-\\sqrt{2},\\quad x_{2}=\\sqrt{2}'],
  ['2x+3=2x+3', 'deg', 'ecuacion', 'x\\in\\mathbb{R}'],
  ['2x+3=2x+4', 'deg', 'ecuacion', '\\text{Sin solución}'],
  ['\\sin\\left(x\\right)=\\frac12', 'deg', 'ecuacion', 'x_{1}=30^{\\circ},\\quad x_{2}=150^{\\circ}'],
  ['x^{2}-4<0', 'deg', 'inecuacion', 'x\\in \\left(-2,\\,2\\right)'],
  ['2x+1\\ge5', 'deg', 'inecuacion', 'x\\in \\left[2,\\,\\infty\\right)'],
  ['x^2\\ge4', 'deg', 'inecuacion', 'x\\in \\left(-\\infty,\\,-2\\right]\\cup \\left[2,\\,\\infty\\right)'],
  ['\\frac{d}{dx}\\left(x^{3}\\right)', 'deg', 'expresion', '3x^2'],
  ['\\int x^2\\,dx', 'deg', 'expresion', '\\frac{x^3}{3}+C'],
  ['\\int_{0}^{1}t\\,dt', 'deg', 'numero', '\\frac{1}{2}'],
  ['2t+3=7', 'deg', 'ecuacion', 't=2'],
  ['x^2-4', 'deg', 'expresion', '(x-2)(x+2)'],
  ['3>5', 'deg', 'logico', '\\text{Falso}'],
  ['\\begin{cases}x+y=3\\\\x-y=1\\end{cases}', 'deg', 'sistema', 'x=2,\\quad y=1'],
  ['\\begin{cases}2x+3y=8\\\\x-y=-1\\end{cases}', 'deg', 'sistema', 'x=1,\\quad y=2'],
  ['\\begin{cases}x+y=1\\\\2x+2y=2\\end{cases}', 'deg', 'sistema', '\\text{Infinitas soluciones}'],
  ['\\begin{cases}x+y=1\\\\x+y=2\\end{cases}', 'deg', 'sistema', 'S=\\varnothing'],
  ['\\sin\\left(x\\right)=0.3', 'deg', 'ecuacion', 'x_{1}\\approx 17.45760312^{\\circ},\\quad x_{2}\\approx 162.5423969^{\\circ}'],
  ['\\mathrm{e}^{x}=x+2', 'deg', 'ecuacion', 'x_{1}\\approx -1.84140566,\\quad x_{2}\\approx 1.146193221'],
  ['\\frac{1}{0}', 'deg', 'error', undefined],
  ['2^{\\placeholder{}}', 'deg', 'incompleto', undefined],
  ['', 'deg', 'vacio', undefined],
];

// Z, t, χ², F y Φ: el valor tiene que coincidir con scipy (stats.norm.ppf(0.975), t.ppf(0.975,15), chi2.ppf(0.025,24),
// f.ppf(0.95,5,10), norm.cdf(1.96), t.ppf(0.95,9), 1-norm.cdf(2/(10/5)), (norm.ppf(0.975)*10/2)**2, 24*4.5**2/chi2.ppf(0.975,24)).
const conTablas = [
  ['Z_{\\left(0{,}975\\right)}', 'numero', 1.959963984540054],
  ['t_{\\left(0{,}975;15\\right)}', 'numero', 2.131449545559776],
  ['\\chi_{\\left(0{,}025;24\\right)}^2', 'numero', 12.401150217444433],
  ['\\chi^2_{\\left(0{,}025;24\\right)}', 'numero', 12.401150217444433],
  ['F_{\\left(0{,}95;5;10\\right)}', 'numero', 3.3258345304130104],
  ['\\Phi\\left(1{,}96\\right)', 'numero', 0.9750021048517795],
  ['t_{\\left(1-\\frac{0{,}1}{2};10-1\\right)}', 'numero', 1.8331129326562368],
  ['T_{(0.975;15)}', 'numero', 2.131449545559776],
  ['1-\\Phi\\left(\\frac{52-50}{10/\\sqrt{25}}\\right)', 'numero', 0.15865525393145707],
  ['\\left(\\frac{Z_{\\left(0{,}975\\right)}\\cdot10}{2}\\right)^2', 'numero', 96.03647051735311],
  ['\\frac{24\\cdot4{,}5^2}{\\chi_{\\left(0{,}975;24\\right)}^2}', 'numero', 12.346282110756482],
  ['Z_{\\left(0{,}975\\right)}\\cdot\\frac{10}{\\sqrt{n}}=2', 'ecuacion', 96.03647051735311],
];
const errores = [
  ['Z_{\\left(1{,}2\\right)}', /entre 0 y 1/],
  ['t_{\\left(0{,}975\\right)}', /2 datos/],
  ['t_{\\left(0{,}975;n\\right)}', /números/],
  ['\\chi^2_{\\left(0{,}5;-3\\right)}', /grados de libertad/],
];

let fallas = 0;
for (const [entrada, tipo, esperado] of conTablas) {
  const r = resolver(entrada, { angulo: 'deg' });
  const v = tipo === 'ecuacion' ? r.soluciones?.[0]?.valor?.re : r.valor?.re;
  if (r.tipo !== tipo || !(Math.abs(v - esperado) <= 1e-12 * Math.abs(esperado)) || !r.tablas?.length) {
    fallas++;
    console.log(`FALLA ${entrada} → ${r.tipo} ${v} (esperaba ${tipo} ${esperado})`);
  }
}
for (const [entrada, mensaje] of errores) {
  const r = resolver(entrada, { angulo: 'deg' });
  if (r.tipo !== 'error' || !mensaje.test(r.mensaje)) { fallas++; console.log(`FALLA ${entrada} → ${r.tipo} ${r.mensaje}`); }
}
for (const [entrada, angulo, tipo, principal] of casos) {
  const r = resolver(entrada, { angulo });
  const ok = r.tipo === tipo && (principal === undefined || r.principal === principal);
  if (!ok) { fallas++; console.log(`FALLA ${entrada} [${angulo}] → ${r.tipo} ${r.principal ?? r.mensaje ?? ''} (esperaba ${tipo} ${principal ?? ''})`); }
}
console.log(`${casos.length + conTablas.length + errores.length} casos, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
