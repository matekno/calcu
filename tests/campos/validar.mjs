// Cuentas en los campos numéricos y formato con coma.
import { evaluarCampo } from '../../js/expresion.js';
import { numTexto, fijoTexto, texACom } from '../../js/formato.js';

const casos = [
  ['0,05', 0.05], ['0.05', 0.05], ['-1,96', -1.96], ['−1,96', -1.96], ['1/40', 0.025], ['1-0,05/2', 0.975],
  ['raiz(2)', Math.SQRT2], ['√2', Math.SQRT2], ['2,5e-3', 0.0025], ['1e-6', 1e-6], ['5%', 0.05], ['(1+2)·3', 9],
  ['2^10', 1024], ['2pi', 2 * Math.PI], ['ln(e)', 1], ['68/40', 1.7], ['4*60+30', 270], [',5', 0.5], ['3×2', 6],
  ['', NaN], ['abc', NaN], ['1/', NaN], ['(1', NaN], ['1,2,3', NaN],
];
let fallas = 0;
for (const [t, esperado] of casos) {
  const v = evaluarCampo(t);
  const ok = Number.isNaN(esperado) ? Number.isNaN(v) : Math.abs(v - esperado) <= 1e-12 * Math.max(1, Math.abs(esperado));
  if (!ok) { fallas++; console.log(`FALLA campo ${JSON.stringify(t)} → ${v} (esperaba ${esperado})`); }
}
const formatos = [
  [numTexto(0.975002104851780), '0,9750021049'], [numTexto(1234567.5), '1234567,5'], [numTexto(1e-8), '1·10^-8'],
  [numTexto(-1.959963984540054, { sig: 7 }), '−1,959964'], [fijoTexto(0.0249979, 6), '0,024998'], [fijoTexto(1.2e-9, 6), '1,2·10^-9'],
  [fijoTexto(-0.0000001, 6), '−1·10^-7'], [texACom('0.\\overline{3}+1.25'), '0{,}\\overline{3}+1{,}25'],
];
for (const [obtenido, esperado] of formatos) {
  if (obtenido !== esperado) { fallas++; console.log(`FALLA formato ${obtenido} (esperaba ${esperado})`); }
}
console.log(`${casos.length + formatos.length} casos, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
