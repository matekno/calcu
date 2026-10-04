// Números con coma decimal, en texto y en LaTeX.

export function texACom(tex) {
  return tex.replace(/(\d)\.(?=\d|\\overline)/g, '$1{,}');
}

function sinCerosFinales(s) {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

// Mantisa y exponente en base 10 con `sig` cifras significativas.
function cientifica(x, sig) {
  const [m, e] = x.toExponential(sig - 1).split('e');
  return { mantisa: sinCerosFinales(m), exponente: Number(e) };
}

// Hasta `sig` cifras significativas, sin ceros de relleno. Notación científica fuera de [1e-6, 1e12).
export function numTexto(x, { sig = 10 } = {}) {
  if (Number.isNaN(x)) return 'no definido';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e12 || ax < 1e-6) {
    const { mantisa, exponente } = cientifica(x, sig);
    return `${mantisa.replace('.', ',').replace(/^-/, '−')}·10^${exponente}`;
  }
  let s = sinCerosFinales(x.toPrecision(sig));
  if (s.includes('e')) s = sinCerosFinales(x.toFixed(Math.min(20, sig)));
  return s.replace('-', '−').replace('.', ',');
}

export function numTex(x, { sig = 10 } = {}) {
  if (Number.isNaN(x)) return '\\text{no definido}';
  if (x === Infinity) return '\\infty';
  if (x === -Infinity) return '-\\infty';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e12 || ax < 1e-6) {
    const { mantisa, exponente } = cientifica(x, sig);
    return `${mantisa.replace('.', '{,}')}\\cdot 10^{${exponente}}`;
  }
  return numTexto(x, { sig }).replace('−', '-').replace(',', '{,}');
}

// Decimales fijos (probabilidades de tabla). Por debajo de 10^-dec pasa a científica para no mostrar 0,000000.
export function fijoTexto(x, dec = 6) {
  if (!Number.isFinite(x)) return numTexto(x);
  if (x !== 0 && Math.abs(x) < 0.5 * 10 ** -dec) return numTexto(x, { sig: 4 });
  let s = x.toFixed(dec);
  if (/^-0\.0*$/.test(s)) s = s.slice(1);
  return s.replace('-', '−').replace('.', ',');
}

export function fijoTex(x, dec = 6) {
  if (!Number.isFinite(x)) return numTex(x);
  if (x !== 0 && Math.abs(x) < 0.5 * 10 ** -dec) return numTex(x, { sig: 4 });
  return fijoTexto(x, dec).replace('−', '-').replace(',', '{,}');
}

// Para los campos de entrada: lo más corto que vuelve a dar el mismo número (hasta 12 cifras).
export function valorCampo(x) {
  if (!Number.isFinite(x)) return '';
  return numTexto(x, { sig: 12 }).replace('−', '-').replace('·10^', 'e');
}
