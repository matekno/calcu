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

let fallas = 0;
for (const [entrada, angulo, tipo, principal] of casos) {
  const r = resolver(entrada, { angulo });
  const ok = r.tipo === tipo && (principal === undefined || r.principal === principal);
  if (!ok) { fallas++; console.log(`FALLA ${entrada} [${angulo}] → ${r.tipo} ${r.principal ?? r.mensaje ?? ''} (esperaba ${tipo} ${principal ?? ''})`); }
}
console.log(`${casos.length} casos, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
