// Pasos didácticos ("Mostrar los pasos", estilo Photomath) para:
//   1. aritmética (enteros, decimales, fracciones, números mixtos, potencias, raíces y
//      racionalización, porcentajes, valores notables de seno, coseno y tangente),
//   2. ecuaciones lineales en una variable,
//   3. ecuaciones cuadráticas,
//   4. sistemas 2×2 lineales escritos con \begin{cases}…\\…\end{cases}.
// Si el caso no está soportado devuelve null y la UI muestra sólo el resultado de Compute Engine.
//
// generarPasos(latex, { ce, angulo: 'rad' | 'deg', verificar = true }) →
//   null | { titulo, pasos: [{ texto, tex }], resultado }
// Con `ce`, antes de devolver los pasos se comprueba que Compute Engine entienda la entrada igual
// y que el resultado coincida (si no, null). `verificar: false` sólo lo usan los tests.
// Aritmética exacta con BigInt; los tex usan punto decimal y \textcolor{#e8590c}{…} para resaltar.

const RESALTE = '#e8590c';
const LIMITE = 10n ** 40n;
const MENOS = '−';

class NoSoportado extends Error {}
const noSop = (m) => {
  throw new NoSoportado(m);
};

// ───────────────────────── Racionales exactos ─────────────────────────

const absB = (a) => (a < 0n ? -a : a);
function mcd(a, b) {
  a = absB(a);
  b = absB(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
const mcm = (a, b) => (a / mcd(a, b)) * b;

function Q(n, d = 1n) {
  n = BigInt(n);
  d = BigInt(d);
  if (d === 0n) noSop('división por cero');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = mcd(n, d);
  if (g > 1n) {
    n /= g;
    d /= g;
  }
  if (absB(n) > LIMITE || d > LIMITE) noSop('números demasiado grandes');
  return { n, d };
}
const Q0 = Q(0);
const Q1 = Q(1);
const qSum = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const qMul = (a, b) => Q(a.n * b.n, a.d * b.d);
const qDiv = (a, b) => Q(a.n * b.d, a.d * b.n);
const qNeg = (a) => ({ n: -a.n, d: a.d });
const qAbs = (a) => ({ n: absB(a.n), d: a.d });
const qEnt = (a) => a.d === 1n;
const qCero = (a) => a.n === 0n;
const qSig = (a) => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0);
const qIg = (a, b) => a.n === b.n && a.d === b.d;
const qNumero = (a) => Number(a.n) / Number(a.d);

function qPot(a, k) {
  if (k === 0) return Q1;
  if (k < 0) return qPot(qDiv(Q1, a), -k);
  return Q(a.n ** BigInt(k), a.d ** BigInt(k));
}

// Decimal exacto (con punto) o null si el desarrollo no es finito (o tiene más de maxDig decimales).
function qDecimal(a, maxDig = 10) {
  let d = a.d;
  let k2 = 0;
  let k5 = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    k2++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    k5++;
  }
  if (d !== 1n) return null;
  const k = Math.max(k2, k5);
  if (k > maxDig) return null;
  const n = (a.n * 10n ** BigInt(k)) / a.d;
  let s = absB(n).toString();
  if (k > 0) {
    s = s.padStart(k + 1, '0');
    s = s.slice(0, -k) + '.' + s.slice(-k);
  }
  return (n < 0n ? '-' : '') + s;
}

// Aproximación redondeada a `dig` decimales (con punto, sin ceros de más).
function qAprox(a, dig = 4) {
  const esc = 10n ** BigInt(dig);
  const r = (absB(a.n) * esc * 2n + a.d) / (2n * a.d);
  let s = r.toString().padStart(dig + 1, '0');
  s = s.slice(0, -dig) + '.' + s.slice(-dig);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return (a.n < 0n && s !== '0' ? '-' : '') + s;
}

function decimalAQ(s) {
  const [ent, dec = ''] = s.split('.');
  return Q(BigInt((ent || '0') + dec), 10n ** BigInt(dec.length));
}

function raizEntera(n, k) {
  if (n < 0n) return null;
  if (n < 2n) return n;
  const aprox = BigInt(Math.round(Math.pow(Number(n), 1 / k)));
  for (const c of [aprox - 1n, aprox, aprox + 1n]) if (c >= 0n && c ** BigInt(k) === n) return c;
  return null;
}

// n = k²·m con m libre de cuadrados.
function extraerCuadrado(n) {
  if (n > 10n ** 12n) noSop('número demasiado grande para factorizar');
  let r = Number(n);
  let k = 1;
  let m = 1;
  for (let p = 2; p * p <= r; p += p === 2 ? 1 : 2) {
    let e = 0;
    while (r % p === 0) {
      r /= p;
      e++;
    }
    if (e) {
      k *= p ** (e >> 1);
      if (e & 1) m *= p;
    }
  }
  m *= r;
  return { k: BigInt(k), m: BigInt(m) };
}
const libreDeCuadrados = (n) => n > 0n && n <= 10n ** 12n && extraerCuadrado(n).k === 1n;

// ───────────────────────── Texto plano ─────────────────────────

const coma = (s) => s.replace('-', MENOS).replace('.', ',');
const fmtEnt = (b) => (b < 0n ? MENOS : '') + absB(b).toString();
function txtQ(q, dec = false) {
  const s = dec ? qDecimal(q) : null;
  if (s !== null) return coma(s);
  if (qEnt(q)) return fmtEnt(q.n);
  return (q.n < 0n ? MENOS : '') + `${absB(q.n)}/${q.d}`;
}
const txtDivisor = (q, dec = false) => (qSig(q) < 0 ? `(${txtQ(q, dec)})` : txtQ(q, dec));
function txtMixto(q) {
  const a = qAbs(q);
  const w = a.n / a.d;
  return (q.n < 0n ? MENOS : '') + `${w} ${a.n - w * a.d}/${a.d}`;
}
function txtValor(v) {
  if (v.r === 1n) return txtQ(v.q, v.dec);
  const a = qAbs(v.q);
  let s = (a.n === 1n ? '' : a.n.toString()) + '√' + v.r;
  if (a.d !== 1n) s += '/' + a.d;
  return (v.q.n < 0n ? MENOS : '') + s;
}
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
function supTxt(e) {
  const v = valor(e);
  if (v && v.r === 1n && qEnt(v.q) && absB(v.q.n) < 1000n) {
    return v.q.n
      .toString()
      .split('')
      .map((c) => SUP[c])
      .join('');
  }
  return '^(' + txt(e) + ')';
}
const NOMBRE_FN = { sin: 'sen', cos: 'cos', tan: 'tan' };

function precTxt(n) {
  switch (n.t) {
    case 'sum':
      return n.ts.length === 1 && n.ts[0].s === 1 ? precTxt(n.ts[0].e) : 1;
    case 'neg':
      return 1;
    case 'chain':
      return 2;
    case 'imp':
    case 'mixed':
      return 3;
    case 'frac':
      return 4;
    default:
      return 5;
  }
}
const txtEnv = (n, nivel) => (precTxt(n) < nivel ? '(' + txt(n) + ')' : txt(n));

function txt(n) {
  switch (n.t) {
    case 'num':
      return coma(n.src ?? numStr(n));
    case 'var':
      return n.n;
    case 'pi':
      return 'π';
    case 'paren':
      return '(' + txt(n.e) + ')';
    case 'sum':
      return n.ts
        .map(({ s, e }, i) => {
          let sg = s;
          let nd = e;
          if (nd.t === 'neg') {
            sg = -sg;
            nd = nd.e;
          }
          const t = txtEnv(nd, 2);
          return (i === 0 ? (sg < 0 ? MENOS : '') : sg < 0 ? ' − ' : ' + ') + t;
        })
        .join('');
    case 'neg':
      return MENOS + txtEnv(n.e, 2);
    case 'chain':
      return n.fs.map((f, i) => (i ? (n.ops[i - 1] === '\\div' ? ' ÷ ' : '·') : '') + txtEnv(f, 2)).join('');
    case 'imp':
      return n.fs.map((f, i) => (i && necesitaPunto(f) ? '·' : '') + txtEnv(f, 3)).join('');
    case 'frac':
      return (n.a.t === 'imp' ? txt(n.a) : txtEnv(n.a, 5)) + '/' + txtEnv(n.b, 5);
    case 'pow':
      return txtEnv(n.b, 5) + supTxt(n.e);
    case 'root':
      return (n.n === 2 ? '√' : n.n === 3 ? '∛' : `${n.n}√`) + txtEnv(n.e, 5);
    case 'mixed':
      return `${n.w} ${n.a}/${n.b}`;
    case 'pct':
      return txt(n.e) + '%';
    case 'deg':
      return txt(n.e) + '°';
    case 'fn':
      return `${NOMBRE_FN[n.f]} ${txtEnv(n.a, 5)}`;
    default:
      return '?';
  }
}

// ───────────────────────── AST ─────────────────────────
// num   { v: Q ≥ 0, dec, src? }      var { n }        pi
// paren { e, k }                     sum { ts: [{ s: ±1, e }] }      neg { e }
// chain { fs, ops }  (·, ×, ÷ explícitos)            imp { fs }  (yuxtaposición)
// frac  { a, b, amp? }               pow { b, e }     root { e, n }
// mixed { w, a, b } (BigInt)         pct { e }        deg { e }        fn { f, a }
// m: true marca el nodo recién calculado (se resalta).

const num = (q, dec = false) => ({ t: 'num', v: qAbs(q), dec: dec && !qEnt(q) });
const entero = (b) => num(Q(b));
const neg = (e) => ({ t: 'neg', e });
const frac = (a, b, amp = false) => (amp ? { t: 'frac', a, b, amp: true } : { t: 'frac', a, b });
const raiz = (e, n = 2) => ({ t: 'root', e, n });
const imp = (fs) => ({ t: 'imp', fs });
const cadena = (fs, ops) => ({ t: 'chain', fs, ops });
const pot = (b, e) => ({ t: 'pow', b, e });
const marcar = (n) => ({ ...n, m: true });

function numStr(n) {
  if (n.dec) {
    const d = qDecimal(n.v);
    if (d !== null) return d;
  }
  return qEnt(n.v) ? n.v.n.toString() : `${n.v.n}/${n.v.d}`;
}

function desmarcar(n) {
  if (!n || typeof n !== 'object') return n;
  if (Array.isArray(n)) return n.map(desmarcar);
  const r = {};
  for (const k of Object.keys(n)) {
    if (k === 'm') continue;
    const v = n[k];
    r[k] = v && typeof v === 'object' && !('n' in v && 'd' in v && typeof v.n === 'bigint') ? desmarcar(v) : v;
  }
  return r;
}

function variables(n, out = new Set()) {
  if (!n || typeof n !== 'object') return out;
  if (n.t === 'var') out.add(n.n);
  for (const k of ['e', 'a', 'b']) if (n[k] && typeof n[k] === 'object' && n[k].t) variables(n[k], out);
  if (n.fs) n.fs.forEach((f) => variables(f, out));
  if (n.ts) n.ts.forEach((t) => variables(t.e, out));
  return out;
}

// ───────────────────────── Lexer y parser ─────────────────────────

const CMD_ESPACIO = new Set(['\\,', '\\;', '\\:', '\\!', '\\ ', '\\quad', '\\qquad', '\\enspace', '\\thinspace', '\\medspace', '\\thickspace', '\\space']);
const CMD_IGNORAR = new Set(['\\left', '\\right', '\\mleft', '\\mright', '\\bigl', '\\bigr', '\\Bigl', '\\Bigr', '\\big', '\\Big', '\\bigg', '\\Bigg', '\\displaystyle', '\\textstyle']);
const FUNCIONES = { '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan' };
const NOMBRES_OPERADOR = { sin: 'sin', cos: 'cos', tan: 'tan' };

function lexer(fuente) {
  const s = fuente
    .replace(/−/g, '-')
    .replace(/·/g, '\\cdot ')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/π/g, '\\pi ')
    .replace(/°/g, '\\degree ')
    .replace(/(\d)\{[.,]\}(?=\d)/g, '$1.')
    .replace(/(\d)\\,(?=\d{3}(?!\d))/g, '$1');
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === '~') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) noSop('número mal escrito');
      toks.push({ k: 'num', s: m[1].replace(/\.$/, '') });
      i += m[1].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      toks.push({ k: 'id', s: c });
      i++;
      continue;
    }
    if (c === '\\') {
      const op = /^\\(?:operatorname|mathrm|text|textrm)\{\s*([a-zA-Z]+)\s*\}/.exec(s.slice(i));
      if (op) {
        i += op[0].length;
        const nombre = op[1];
        if (NOMBRES_OPERADOR[nombre]) toks.push({ k: 'cmd', s: '\\' + NOMBRES_OPERADOR[nombre] });
        else noSop('función no soportada');
        continue;
      }
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (!m) noSop('comando mal escrito');
      i += m[0].length;
      let cmd = m[0];
      if (CMD_ESPACIO.has(cmd)) continue;
      if (CMD_IGNORAR.has(cmd)) {
        if (s[i] === '.') noSop('delimitador invisible');
        continue;
      }
      if (cmd === '\\dfrac' || cmd === '\\tfrac' || cmd === '\\cfrac') cmd = '\\frac';
      if (cmd === '\\lparen') toks.push({ k: 'ch', s: '(' });
      else if (cmd === '\\rparen') toks.push({ k: 'ch', s: ')' });
      else if (cmd === '\\lbrack') toks.push({ k: 'ch', s: '[' });
      else if (cmd === '\\rbrack') toks.push({ k: 'ch', s: ']' });
      else if (cmd === '\\ast') toks.push({ k: 'cmd', s: '\\cdot' });
      else if (cmd === '\\circ') toks.push({ k: 'cmd', s: '\\circ' });
      else toks.push({ k: 'cmd', s: cmd });
      continue;
    }
    toks.push({ k: 'ch', s: c });
    i++;
  }
  return toks;
}

function numLit(s) {
  const v = decimalAQ(s);
  return { t: 'num', v, dec: s.includes('.') && !qEnt(v), src: s };
}
const esEntLit = (n) => !!n && n.t === 'num' && qEnt(n.v);
const esFracLit = (n) => n.t === 'frac' && esEntLit(n.a) && esEntLit(n.b) && !n.a.dec && !n.b.dec && !(n.a.src || '').includes('.') && !(n.b.src || '').includes('.');
const OPS_MUL = new Set(['\\cdot', '\\times', '\\div']);
const INICIO_PRIMARIO = new Set(['\\frac', '\\sqrt', '\\pi', '\\sin', '\\cos', '\\tan']);

class Parser {
  constructor(toks) {
    this.toks = toks;
    this.i = 0;
  }
  es(k, s) {
    const t = this.toks[this.i];
    return !!t && t.k === k && (s === undefined || t.s === s);
  }
  fin() {
    return this.i >= this.toks.length;
  }
  tomar() {
    const t = this.toks[this.i++];
    if (!t) noSop('expresión incompleta');
    return t;
  }
  esperar(k, s) {
    if (!this.es(k, s)) noSop(`falta ${s}`);
    return this.tomar();
  }

  suma() {
    const ts = [];
    let s = 1;
    if (this.es('ch', '+')) this.tomar();
    else if (this.es('ch', '-')) {
      this.tomar();
      s = -1;
    }
    ts.push({ s, e: this.termino() });
    while (this.es('ch', '+') || this.es('ch', '-')) {
      s = this.tomar().s === '+' ? 1 : -1;
      let e;
      if (this.es('ch', '-')) {
        this.tomar();
        e = { t: 'paren', e: neg(this.termino()), k: '(' };
      } else {
        if (this.es('ch', '+')) this.tomar();
        e = this.termino();
      }
      ts.push({ s, e });
    }
    return ts.length === 1 && ts[0].s === 1 ? ts[0].e : { t: 'sum', ts };
  }

  termino() {
    const fs = [this.factorConSigno()];
    const ops = [];
    for (;;) {
      if (this.toks[this.i] && this.toks[this.i].k === 'cmd' && OPS_MUL.has(this.toks[this.i].s)) ops.push(this.tomar().s);
      else if (this.es('ch', '*')) {
        this.tomar();
        ops.push('\\cdot');
      } else if (this.es('ch', '/')) {
        this.tomar();
        ops.push('\\div');
      } else break;
      fs.push(this.factorConSigno());
    }
    return fs.length === 1 ? fs[0] : cadena(fs, ops);
  }

  factorConSigno(sinFunciones = false) {
    if (this.es('ch', '-')) {
      this.tomar();
      return neg(this.implicito(sinFunciones));
    }
    if (this.es('ch', '+')) this.tomar();
    return this.implicito(sinFunciones);
  }

  esFuncion(i) {
    const t = this.toks[i];
    return !!t && t.k === 'cmd' && !!FUNCIONES[t.s];
  }

  empiezaPrimario() {
    const t = this.toks[this.i];
    if (!t) return false;
    if (t.k === 'num' || t.k === 'id') return true;
    if (t.k === 'ch') return t.s === '(' || t.s === '[' || t.s === '{';
    return t.k === 'cmd' && INICIO_PRIMARIO.has(t.s);
  }

  implicito(sinFunciones = false) {
    const fs = [this.postfijo()];
    while (this.empiezaPrimario() && !(sinFunciones && this.esFuncion(this.i))) fs.push(this.postfijo());
    if (fs.length === 1) return fs[0];
    for (let j = 0; j + 1 < fs.length; j++) {
      const a = fs[j];
      const b = fs[j + 1];
      if (a.t === 'num' && b.t === 'num') noSop('dos números seguidos');
      if (esEntLit(a) && !(a.src || '').includes('.') && esFracLit(b)) {
        if (fs.length !== 2) noSop('número mixto ambiguo');
        return { t: 'mixed', w: a.v.n, a: b.a.v.n, b: b.b.v.n };
      }
    }
    return imp(fs);
  }

  postfijo() {
    let b = this.primario();
    for (;;) {
      if (this.es('ch', '^')) {
        this.tomar();
        if (this.es('cmd', '\\circ')) {
          this.tomar();
          b = { t: 'deg', e: b };
          continue;
        }
        if (this.es('ch', '{') && this.toks[this.i + 1]?.k === 'cmd' && this.toks[this.i + 1].s === '\\circ' && this.toks[this.i + 2]?.s === '}') {
          this.i += 3;
          b = { t: 'deg', e: b };
          continue;
        }
        b = pot(b, this.argumento());
      } else if (this.es('cmd', '\\%')) {
        this.tomar();
        b = { t: 'pct', e: b };
      } else if (this.es('cmd', '\\degree')) {
        this.tomar();
        b = { t: 'deg', e: b };
      } else if (this.es('ch', '!') || this.es('ch', '_') || this.es('ch', "'")) {
        noSop('notación no soportada');
      } else break;
    }
    return b;
  }

  // Argumento de \frac, \sqrt o ^: {grupo} o un solo carácter (\frac34, x^2).
  argumento() {
    if (this.es('ch', '{')) {
      this.tomar();
      const e = this.suma();
      this.esperar('ch', '}');
      return e;
    }
    const t = this.tomar();
    if (t.k === 'num') {
      if (t.s[0] === '.') noSop('argumento raro');
      if (t.s.length > 1) {
        this.i--;
        this.toks[this.i] = { k: 'num', s: t.s.slice(1) };
        if (this.toks[this.i].s[0] === '.') noSop('argumento raro');
        return numLit(t.s[0]);
      }
      return numLit(t.s);
    }
    if (t.k === 'id') return this.variable(t.s);
    if (t.k === 'cmd' && t.s === '\\pi') return { t: 'pi' };
    noSop('argumento no soportado');
  }

  variable(s) {
    if (!/^[a-df-hj-z]$/.test(s)) noSop('letra no soportada');
    return { t: 'var', n: s };
  }

  primario() {
    const t = this.tomar();
    if (t.k === 'num') return numLit(t.s);
    if (t.k === 'id') return this.variable(t.s);
    if (t.k === 'ch') {
      if (t.s === '(' || t.s === '[') {
        const e = this.suma();
        this.esperar('ch', t.s === '(' ? ')' : ']');
        return { t: 'paren', e, k: t.s };
      }
      if (t.s === '{') {
        const e = this.suma();
        this.esperar('ch', '}');
        return e;
      }
      noSop(`símbolo ${t.s}`);
    }
    if (t.s === '\\frac') {
      const a = this.argumento();
      const b = this.argumento();
      return frac(a, b);
    }
    if (t.s === '\\sqrt') {
      let n = 2;
      if (this.es('ch', '[')) {
        this.tomar();
        const idx = this.suma();
        this.esperar('ch', ']');
        if (!esEntLit(idx) || idx.v.n < 2n || idx.v.n > 20n) noSop('índice de raíz');
        n = Number(idx.v.n);
      }
      return raiz(this.argumento(), n);
    }
    if (t.s === '\\pi') return { t: 'pi' };
    if (FUNCIONES[t.s]) return this.funcion(FUNCIONES[t.s]);
    noSop(`comando ${t.s}`);
  }

  funcion(f) {
    let exp = null;
    if (this.es('ch', '^')) {
      this.tomar();
      exp = this.argumento();
    }
    let a;
    if (this.es('ch', '(') || this.es('ch', '[')) {
      const ab = this.tomar().s;
      a = this.suma();
      this.esperar('ch', ab === '(' ? ')' : ']');
      if (this.es('cmd', '\\degree')) noSop('grados fuera del paréntesis');
    } else {
      // Como Compute Engine: sin paréntesis, el argumento abarca toda la cadena de productos
      // y cocientes, hasta otra función (\sin 30° \cdot 2 = sen 60°).
      const fs = [this.implicito(true)];
      const ops = [];
      while (this.toks[this.i]?.k === 'cmd' && OPS_MUL.has(this.toks[this.i].s) && !this.esFuncion(this.i + 1)) {
        ops.push(this.tomar().s);
        fs.push(this.factorConSigno(true));
      }
      a = fs.length === 1 ? fs[0] : cadena(fs, ops);
    }
    let n = { t: 'fn', f, a };
    if (exp) n = pot(n, exp);
    return n;
  }
}

function parsear(latex) {
  const toks = lexer(latex);
  if (!toks.length) noSop('vacío');
  const p = new Parser(toks);
  const izq = p.suma();
  if (p.es('ch', '=')) {
    p.tomar();
    const der = p.suma();
    if (!p.fin()) noSop('sobra algo después de la ecuación');
    return { tipo: 'ecuacion', izq, der };
  }
  if (!p.fin()) noSop('sobra algo');
  return { tipo: 'expresion', e: izq };
}

// ───────────────────────── LaTeX de salida ─────────────────────────

function prec(n) {
  switch (n.t) {
    case 'sum':
      return n.ts.length === 1 && n.ts[0].s === 1 ? prec(n.ts[0].e) : 1;
    case 'neg':
      return 1;
    case 'chain':
      return 2;
    case 'imp':
    case 'mixed':
      return 3;
    case 'pow':
      return 4;
    default:
      return 5;
  }
}
const envolver = (s) => `\\left(${s}\\right)`;

// En una yuxtaposición, ¿hace falta un · explícito antes de f?
function necesitaPunto(f) {
  if (prec(f) < 3) return false;
  switch (f.t) {
    case 'num':
    case 'frac':
    case 'mixed':
    case 'pct':
    case 'deg':
    case 'imp':
      return true;
    case 'pow':
      return necesitaPunto(f.b) || f.b.t === 'num';
    default:
      return false;
  }
}

function tex(n) {
  let s;
  switch (n.t) {
    case 'num':
      s = n.src ?? numStr(n);
      break;
    case 'var':
      s = n.n;
      break;
    case 'pi':
      s = '\\pi';
      break;
    case 'paren':
      s = n.k === '[' ? `\\left[${tex(n.e)}\\right]` : envolver(tex(n.e));
      break;
    case 'sum':
      s = texSuma(n);
      break;
    case 'neg':
      s = '-' + (prec(n.e) <= 1 ? envolver(tex(n.e)) : tex(n.e));
      break;
    case 'chain':
      s = n.fs
        .map((f, i) => {
          let t = tex(f);
          const op = n.ops[i - 1];
          if (prec(f) < 2 || (i > 0 && (prec(f) === 2 || (op === '\\div' && (f.t === 'mixed' || (f.t === 'imp' && f.fs.slice(1).some(necesitaPunto))))))) t = envolver(t);
          return i === 0 ? t : `${op} ${t}`;
        })
        .join('');
      break;
    case 'imp':
      s = '';
      n.fs.forEach((f, i) => {
        let t = tex(f);
        if (prec(f) < 3 || (i > 0 && f.t === 'mixed')) t = envolver(t);
        if (i > 0) {
          if (necesitaPunto(f) && !t.startsWith('\\left(')) s += '\\cdot ';
          else if (/^[a-zA-Z]/.test(t) && /\\[a-zA-Z]+$/.test(s)) s += ' ';
        }
        s += t;
      });
      break;
    case 'frac':
      s = `\\frac{${tex(n.a)}}{${tex(n.b)}}`;
      break;
    case 'pow':
      s = texPot(n);
      break;
    case 'root':
      s = n.n === 2 ? `\\sqrt{${tex(n.e)}}` : `\\sqrt[${n.n}]{${tex(n.e)}}`;
      break;
    case 'mixed':
      s = `${n.w}\\frac{${n.a}}{${n.b}}`;
      break;
    case 'pct':
      s = tex(n.e) + '\\%';
      break;
    case 'deg':
      s = tex(n.e) + '^{\\circ}';
      break;
    case 'fn':
      s = `\\${n.f}\\left(${tex(n.a)}\\right)`;
      break;
    default:
      noSop('nodo desconocido');
  }
  return n.m ? `\\textcolor{${RESALTE}}{${s}}` : s;
}

function texSuma(n) {
  let out = '';
  n.ts.forEach(({ s, e }, i) => {
    let signo = s;
    let nodo = e;
    const negInterno = nodo.t === 'neg' ? nodo.e : nodo.t === 'sum' && nodo.ts.length === 1 && nodo.ts[0].s === -1 ? nodo.ts[0].e : null;
    if (negInterno) {
      signo = -signo;
      nodo = nodo.m ? marcar(negInterno) : negInterno;
    }
    let t = tex(nodo);
    if (prec(nodo) <= 1) t = envolver(t);
    out += i === 0 ? (signo < 0 ? '-' : '') + t : (signo < 0 ? '-' : '+') + t;
  });
  return out;
}

function texPot(n) {
  const b = n.b;
  if (b.t === 'fn') {
    const s = `\\${b.f}^{${tex(n.e)}}\\left(${tex(b.a)}\\right)`;
    return b.m ? `\\textcolor{${RESALTE}}{${s}}` : s;
  }
  let tb = tex(b);
  if (prec(b) < 5 || ['frac', 'root', 'pct', 'deg', 'mixed'].includes(b.t)) tb = envolver(tb);
  return `${tb}^{${tex(n.e)}}`;
}

// Quita los \\textcolor{…}{…} dejando el contenido.
function sinColor(s) {
  const marca = '\\textcolor{';
  let i;
  while ((i = s.indexOf(marca)) >= 0) {
    const finHex = s.indexOf('}', i);
    let prof = 0;
    let j = finHex + 1;
    for (; j < s.length; j++) {
      if (s[j] === '{') prof++;
      else if (s[j] === '}' && --prof === 0) break;
    }
    s = s.slice(0, i) + s.slice(finHex + 2, j) + s.slice(j + 1);
  }
  return s;
}

function texQ(q, dec = false) {
  const s = dec ? qDecimal(q) : null;
  if (s !== null) return s;
  if (qEnt(q)) return q.n.toString();
  return (q.n < 0n ? '-' : '') + `\\frac{${absB(q.n)}}{${q.d}}`;
}

// ───────────────────────── Valores atómicos ─────────────────────────
// Valor = { q: Q, r: BigInt (1 = racional), dec }  →  q·√r

function negLit(n) {
  if (n.t === 'neg') return n.e;
  if (n.t === 'sum' && n.ts.length === 1 && n.ts[0].s === -1) return n.ts[0].e;
  return null;
}

function valorRadicalLit(n) {
  if (n.t === 'root' && n.n === 2 && esEntLit(n.e) && n.e.v.n > 1n && libreDeCuadrados(n.e.v.n)) return { k: 1n, m: n.e.v.n };
  if (n.t === 'imp' && n.fs.length === 2 && esEntLit(n.fs[0]) && n.fs[0].v.n >= 2n) {
    const r = valorRadicalLit(n.fs[1]);
    if (r && r.k === 1n) return { k: n.fs[0].v.n, m: r.m };
  }
  return null;
}

function valor(n) {
  switch (n.t) {
    case 'num':
      return { q: n.v, r: 1n, dec: n.dec };
    case 'paren':
      return valor(n.e);
    case 'neg':
    case 'sum': {
      const e = negLit(n);
      if (!e) return null;
      const v = valor(e);
      if (!v || qSig(v.q) < 0) return null;
      return { ...v, q: qNeg(v.q) };
    }
    case 'frac': {
      if (!esEntLit(n.b) || n.b.v.n < 1n) return null;
      const d = n.b.v.n;
      let a = n.a;
      let sg = 1n;
      const nl = negLit(a);
      if (nl) {
        a = nl;
        sg = -1n;
      }
      if (esEntLit(a)) {
        const k = a.v.n;
        if (n.amp || (d > 1n && mcd(k, d) === 1n)) return { q: Q(sg * k, d), r: 1n, dec: false };
        return null;
      }
      if (d > 1n && !n.amp) {
        const vr = valorRadicalLit(a);
        if (vr && mcd(vr.k, d) === 1n) return { q: Q(sg * vr.k, d), r: vr.m, dec: false };
      }
      return null;
    }
    case 'root':
    case 'imp': {
      const vr = valorRadicalLit(n);
      return vr ? { q: Q(vr.k), r: vr.m, dec: false } : null;
    }
    default:
      return null;
  }
}

const esDecV = (v) => v.r === 1n && v.dec && !qEnt(v.q);
const esFracV = (v) => v.r === 1n && !v.dec && !qEnt(v.q);

function deValor({ q, r = 1n, dec = false }) {
  const a = qAbs(q);
  let n;
  if (r === 1n) {
    if (qEnt(a)) n = num(a);
    else if (dec && qDecimal(a) !== null) n = num(a, true);
    else n = frac(entero(a.n), entero(a.d));
  } else {
    const core = a.n === 1n ? raiz(entero(r)) : imp([entero(a.n), raiz(entero(r))]);
    n = a.d === 1n ? core : frac(core, entero(a.d));
  }
  return q.n < 0n ? neg(n) : n;
}

// Como deValor, pero el radicando puede no estar simplificado.
function deValorCrudo(q, R) {
  const a = qAbs(q);
  const core = a.n === 1n ? raiz(entero(R)) : imp([entero(a.n), raiz(entero(R))]);
  const n = a.d === 1n ? core : frac(core, entero(a.d));
  return q.n < 0n ? neg(n) : n;
}

function potValor(v, k) {
  if (v.r === 1n) return { q: qPot(v.q, k), r: 1n, dec: v.dec };
  const q = qMul(qPot(v.q, k), Q(v.r ** BigInt(k >> 1)));
  return { q, r: k & 1 ? v.r : 1n, dec: false };
}

function evalValor(v) {
  return qNumero(v.q) * Math.sqrt(Number(v.r));
}

// ───────────────────────── Trigonometría: valores notables ─────────────────────────

function anguloNotable(a, angulo) {
  let x = a;
  if (x.t === 'paren') x = x.e;
  let sg = 1;
  const nl = negLit(x);
  if (nl) {
    sg = -1;
    x = nl.t === 'paren' ? nl.e : nl;
  }
  const signoTxt = sg < 0 ? MENOS : '';
  if (x.t === 'deg') {
    if (!esEntLit(x.e) || (x.e.src || '').includes('.')) return null;
    return { g: sg * Number(x.e.v.n), txt: `${signoTxt}${x.e.v.n}°` };
  }
  if (angulo === 'deg') {
    if (!esEntLit(x) || (x.src || '').includes('.')) return null;
    return { g: sg * Number(x.v.n), txt: `${signoTxt}${x.v.n}°` };
  }
  if (esEntLit(x) && qCero(x.v)) return { g: 0, txt: '0' };
  let k = 1n;
  let d = 1n;
  const multPi = (m) => {
    if (m.t === 'pi') return 1n;
    if (m.t === 'imp' && m.fs.length === 2 && esEntLit(m.fs[0]) && m.fs[1].t === 'pi') return m.fs[0].v.n;
    return null;
  };
  if (multPi(x) !== null) k = multPi(x);
  else if (x.t === 'frac' && esEntLit(x.b) && multPi(x.a) !== null) {
    k = multPi(x.a);
    d = x.b.v.n;
  } else return null;
  if (d === 0n) return null;
  const g = Q(180n * k, d);
  if (!qEnt(g) || absB(g.n) > 100000n) return null;
  return { g: sg * Number(g.n), txt: signoTxt + txt(x), rad: true, grados: `${signoTxt}${g.n}°` };
}

const SENO_BASE = { 0: [Q0, 1n], 30: [Q(1, 2), 1n], 45: [Q(1, 2), 2n], 60: [Q(1, 2), 3n], 90: [Q1, 1n] };
function senoNotable(g) {
  g = ((g % 360) + 360) % 360;
  if (g >= 180) {
    const v = senoNotable(g - 180);
    return v && { q: qNeg(v.q), r: v.r };
  }
  if (g > 90) g = 180 - g;
  const b = SENO_BASE[g];
  return b ? { q: b[0], r: b[1] } : null;
}
function trigNotable(f, g) {
  if (f === 'sin') return senoNotable(g);
  if (f === 'cos') return senoNotable(90 - g);
  const s = senoNotable(g);
  const c = senoNotable(90 - g);
  if (!s || !c || qCero(c.q)) return null;
  if (qCero(s.q)) return { q: Q0, r: 1n };
  const { k, m } = extraerCuadrado(s.r * c.r);
  return { q: qDiv(qMul(s.q, Q(k)), qMul(c.q, Q(c.r))), r: m };
}

// ───────────────────────── Aritmética paso a paso ─────────────────────────

function obtener(n, path) {
  return path.reduce((a, k) => a[k], n);
}
function reemplazar(n, path, nuevo) {
  if (!path.length) return nuevo;
  const [k, ...resto] = path;
  const copia = Array.isArray(n) ? n.slice() : { ...n };
  copia[k] = reemplazar(n[k], resto, nuevo);
  return copia;
}

function sumaReducible(n, vs) {
  if (vs.some((v) => qSig(v.q) < 0)) return true;
  if (n.ts.length === 1) return false;
  const vistos = new Set();
  for (const v of vs) {
    const k = v.r.toString();
    if (vistos.has(k)) return true;
    vistos.add(k);
  }
  return false;
}

function buscar(n, path, prof, out, ctx) {
  if (valor(n)) return;
  const push = (clase) => out.push({ path, clase, prof, nodo: n });
  switch (n.t) {
    case 'num':
      return;
    case 'mixed':
      return push('conv');
    case 'pct':
      if (n.e.t !== 'num') noSop('porcentaje de una expresión');
      return push('conv');
    case 'fn': {
      const ang = anguloNotable(n.a, ctx.angulo);
      if (!ang || !trigNotable(n.f, ang.g)) noSop('ángulo no notable');
      return push('conv');
    }
    case 'paren':
      return buscar(n.e, [...path, 'e'], prof + 1, out, ctx);
    case 'neg':
      if (valor(n.e)) return push('conv');
      return buscar(n.e, [...path, 'e'], prof, out, ctx);
    case 'frac': {
      const nl = negLit(n.a);
      if (esEntLit(n.b) && (esEntLit(n.a) || (nl && esEntLit(nl)))) {
        if (qCero(n.b.v)) noSop('división por cero');
        return push('conv');
      }
      const va = valor(n.a);
      const vb = valor(n.b);
      if (va && vb) return push('mul');
      if (!va) buscar(n.a, [...path, 'a'], prof + 1, out, ctx);
      if (!vb) buscar(n.b, [...path, 'b'], prof + 1, out, ctx);
      return;
    }
    case 'pow': {
      const vb = valor(n.b);
      const ve = valor(n.e);
      if (vb && ve) return push('pot');
      if (!vb) buscar(n.b, [...path, 'b'], prof, out, ctx);
      if (!ve) buscar(n.e, [...path, 'e'], prof + 1, out, ctx);
      return;
    }
    case 'root':
      if (valor(n.e)) return push('pot');
      return buscar(n.e, [...path, 'e'], prof + 1, out, ctx);
    case 'chain':
    case 'imp': {
      const vs = n.fs.map(valor);
      if (vs.every(Boolean)) return push('mul');
      n.fs.forEach((f, i) => {
        if (!vs[i]) buscar(f, [...path, 'fs', i], prof, out, ctx);
      });
      return;
    }
    case 'sum': {
      const vs = n.ts.map((t) => valor(t.e));
      if (vs.every(Boolean)) {
        if (sumaReducible(n, vs)) push('suma');
        return;
      }
      n.ts.forEach((t, i) => {
        if (!vs[i]) buscar(t.e, [...path, 'ts', i, 'e'], prof, out, ctx);
      });
      return;
    }
    default:
      noSop('no es un cálculo numérico');
  }
}

function elegirGrupo(cands) {
  const conv = cands.filter((c) => c.clase === 'conv');
  if (conv.length) return conv;
  const pmax = Math.max(...cands.map((c) => c.prof));
  const enProf = cands.filter((c) => c.prof === pmax);
  for (const cl of ['pot', 'mul', 'suma']) {
    const g = enProf.filter((c) => c.clase === cl);
    if (g.length) return g;
  }
  return enProf;
}

// Resultado de una acción: { clave, subpasos: [{ nodo, texto }], plural?, det? }
const accion = (clave, nodo, texto, extra = {}) => ({ clave, subpasos: [{ nodo, texto }], ...extra });

function txtDecAFrac(v) {
  const d = qDecimal(qAbs(v.q), Infinity);
  const k = d.includes('.') ? d.split('.')[1].length : 0;
  const crudo = `${d.replace('.', '').replace(/^0+(?=\d)/, '')}/${10n ** BigInt(k)}`;
  const red = txtQ(qAbs(v.q));
  return `${coma(d)} = ${crudo}` + (crudo !== red ? ` = ${red}` : '');
}

function accionConv(n, ctx) {
  switch (n.t) {
    case 'mixed': {
      const numer = n.w * n.b + n.a;
      const det = `${n.w} ${n.a}/${n.b} = (${n.w}·${n.b} + ${n.a})/${n.b} = ${numer}/${n.b}`;
      return accion('mixto', marcar(frac(entero(numer), entero(n.b))), `Convertí el número mixto en fracción: ${det}`, {
        plural: 'Convertí los números mixtos en fracciones',
        det,
      });
    }
    case 'pct': {
      const q = qDiv(n.e.v, Q(100));
      const exacto = qDecimal(q, Infinity);
      const det = `${txt(n.e)}% = ${txt(n.e)}/100 = ${coma(exacto)}`;
      return accion('pct', marcar({ ...num(q, true), src: exacto }), `Pasá el porcentaje a número decimal: ${det}`, {
        plural: 'Pasá los porcentajes a números decimales',
        det,
      });
    }
    case 'fn': {
      const ang = anguloNotable(n.a, ctx.angulo);
      const v = trigNotable(n.f, ang.g);
      const nombre = NOMBRE_FN[n.f];
      const arg = ang.rad || ang.g < 0 ? `(${ang.txt})` : ` ${ang.txt}`;
      let det = `${nombre}${arg} = ${txtValor({ ...v, dec: false })}`;
      if (ang.rad && ang.txt !== '0') det += ` (${ang.txt} = ${ang.grados})`;
      return accion('trig', marcar(deValor(v)), `Usá el valor notable: ${det}`, { plural: 'Usá los valores notables', det });
    }
    case 'neg': {
      const v = valor(n.e);
      return accion('signos', marcar(deValor({ ...v, q: qNeg(v.q) })), 'Menos por menos da más: ' + `${MENOS}(${txtValor(v)}) = ${txtValor({ ...v, q: qNeg(v.q) })}`);
    }
    case 'frac': {
      let a = n.a;
      let sg = 1n;
      const nl = negLit(a);
      if (nl) {
        a = nl;
        sg = -1n;
      }
      const an = a.v.n;
      const bn = n.b.v.n;
      if (an === 0n) return accion('simp', marcar(entero(0)), 'Cero dividido cualquier número da cero');
      const g = mcd(an, bn);
      const det = `${sg < 0 ? MENOS : ''}${an}/${bn} = ${txtQ(Q(sg * an, bn))}`;
      if (bn / g === 1n) {
        return accion('simp', marcar(deValor({ q: Q(sg * an, bn) })), `Calculá la división: ${an} ÷ ${bn} = ${an / bn}`, {
          plural: 'Simplificá las fracciones',
          det,
        });
      }
      const nodo = frac(entero(an / g), entero(bn / g));
      return accion('simp', marcar(sg < 0 ? neg(nodo) : nodo), `Simplificá la fracción dividiendo numerador y denominador por ${g}`, {
        plural: 'Simplificá las fracciones',
        det: `${det} (dividiendo por ${g})`,
      });
    }
    default:
      noSop('conversión desconocida');
  }
}

function accionPot(n) {
  if (n.t === 'root') return accionRaiz(n);
  const vb = valor(n.b);
  const ve = valor(n.e);
  if (ve.r !== 1n || !qEnt(ve.q) || ve.dec) noSop('exponente no entero');
  const k = Number(ve.q.n);
  if (Math.abs(k) > 64) noSop('exponente demasiado grande');
  if (k === 0) {
    if (qCero(vb.q)) noSop('0^0');
    return accion('pot0', marcar(entero(1)), 'Todo número distinto de cero elevado a la 0 da 1');
  }
  if (k < 0) {
    if (qCero(vb.q)) noSop('división por cero');
    let nodo;
    if (esFracV(vb)) {
      const inv = deValor({ q: qDiv(Q1, vb.q) });
      nodo = k === -1 ? inv : pot(inv, entero(-k));
    } else {
      const base = n.b.t === 'paren' ? n.b.e : n.b;
      nodo = frac(entero(1), k === -1 ? base : pot(base, entero(-k)));
    }
    return accion('expNeg', marcar(nodo), 'Con exponente negativo, invertí la base y cambiá el signo del exponente');
  }
  const res = potValor(vb, k);
  const det = `${txt(n)} = ${txtValor(res)}`;
  let texto = `Calculá la potencia: ${det}`;
  if (esFracV(vb)) texto = `Elevá el numerador y el denominador: ${det}`;
  else if (vb.r !== 1n && k === 2 && qIg(qAbs(vb.q), Q1)) texto = `Una raíz cuadrada al cuadrado da el número de adentro: ${det}`;
  return accion('pot', marcar(deValor(res)), texto, { plural: 'Calculá las potencias', det });
}

function accionRaiz(n) {
  const v = valor(n.e);
  const k = n.n;
  if (v.r !== 1n) noSop('raíz de un radical');
  let q = v.q;
  let sg = 1n;
  if (qSig(q) < 0) {
    if (k % 2 === 0) noSop('raíz par de un negativo');
    sg = -1n;
    q = qAbs(q);
  }
  const rn = raizEntera(q.n, k);
  const rd = raizEntera(q.d, k);
  if (rn !== null && rd !== null) {
    const res = Q(sg * rn, rd);
    const det = `${txt(n)} = ${txtQ(res, v.dec)}`;
    let texto = `Calculá la raíz: ${det}`;
    if (sg < 0) texto = `La raíz de índice impar de un negativo es negativa: ${det}`;
    else if (!qEnt(q) && !v.dec) texto = `Calculá la raíz del numerador y la del denominador: ${det}`;
    return accion('raiz', marcar(deValor({ q: res, dec: v.dec })), texto, { plural: 'Calculá las raíces', det });
  }
  if (k === 2 && !qEnt(q) && !v.dec) {
    const parte = (b) => (raizEntera(b, 2) !== null ? entero(raizEntera(b, 2)) : raiz(entero(b)));
    const nodo = frac(parte(q.n), parte(q.d));
    return accion('raizFrac', marcar(nodo), `La raíz de una fracción es la raíz del numerador dividida por la raíz del denominador: ${txt(n)} = ${txt(nodo)}`);
  }
  if (k === 2 && qEnt(q) && !v.dec) {
    const { k: c, m } = extraerCuadrado(q.n);
    if (c === 1n) noSop('raíz ya simplificada');
    const cc = c * c;
    return {
      clave: 'raizDesc',
      subpasos: [
        { nodo: raiz(cadena([marcar(entero(cc)), entero(m)], ['\\cdot'])), texto: `Descomponé ${q.n} = ${cc}·${m}, donde ${cc} es un cuadrado perfecto` },
        { nodo: marcar(imp([entero(c), raiz(entero(m))])), texto: `Sacá la raíz del cuadrado perfecto: √${cc} = ${c}. Queda ${c}√${m}` },
      ],
    };
  }
  noSop('raíz no exacta');
}

function conversionDecimales(nodos, vs) {
  const dets = [];
  const nuevos = nodos.map((f, i) => {
    if (!esDecV(vs[i])) return f;
    dets.push(txtDecAFrac(vs[i]));
    return marcar(deValor({ ...vs[i], dec: false }));
  });
  const texto = dets.length === 1 ? `Pasá el decimal a fracción: ${dets[0]}` : `Pasá los decimales a fracciones: ${dets.join('; ')}`;
  return { nuevos, texto };
}

// a ÷ b con a, b valores. Devuelve { tipo: 'resultado', nodo } | { tipo: 'inversa', inv } | { tipo: 'conv', nuevos }.
function dividir(A, B, enFraccion) {
  const va = valor(A);
  const vb = valor(B);
  if (qCero(vb.q)) noSop('división por cero');
  if ((va.r !== 1n || vb.r !== 1n) && (esDecV(va) || esDecV(vb))) {
    const { nuevos, texto } = conversionDecimales([A, B], [va, vb]);
    return { tipo: 'conv', clave: 'decAFrac', nuevos, texto };
  }
  if (vb.r !== 1n) {
    if (va.r === vb.r) {
      const q = qDiv(va.q, vb.q);
      const det = `${txt(A)} ÷ ${txt(B)} = ${txtQ(q)}`;
      return { tipo: 'resultado', clave: 'div', nodo: marcar(deValor({ q })), texto: `Las raíces iguales se simplifican: ${det}`, det };
    }
    if (!enFraccion) return { tipo: 'aFraccion', clave: 'aFraccion', texto: 'Escribí la división como fracción para racionalizar' };
    const rr = () => marcar(raiz(entero(vb.r)));
    const esUno = va.r === 1n && qIg(va.q, Q1);
    const numer = esUno ? rr() : cadena([A, rr()], ['\\cdot']);
    return {
      tipo: 'resultado',
      clave: 'racionalizar',
      nodo: frac(numer, cadena([B, rr()], ['\\cdot'])),
      texto: `Racionalizá: multiplicá el numerador y el denominador por √${vb.r} para sacar la raíz del denominador`,
    };
  }
  if (va.r !== 1n) {
    const res = { q: qDiv(va.q, vb.q), r: va.r };
    const det = `${txt(A)} ÷ ${txt(B)} = ${txtValor(res)}`;
    return { tipo: 'resultado', clave: 'div', nodo: marcar(deValor(res)), texto: enFraccion ? `Simplificá: ${txt(A)}/${txt(B)} = ${txtValor(res)}` : `Dividí: ${det}`, det };
  }
  const hayDec = va.dec || vb.dec;
  const hayFrac = esFracV(va) || esFracV(vb);
  if (hayDec && hayFrac) {
    const { nuevos, texto } = conversionDecimales([A, B], [va, vb]);
    return { tipo: 'conv', clave: 'decAFrac', nuevos, texto };
  }
  if (!hayFrac) {
    const q = qDiv(va.q, vb.q);
    const det = `${txtQ(va.q, va.dec)} ÷ ${txtDivisor(vb.q, vb.dec)} = ${txtQ(q, hayDec)}`;
    if (hayDec || qEnt(q)) {
      const exacto = qDecimal(q) !== null;
      const texto = exacto || qEnt(q) ? `Dividí: ${det}` : `Dividí: ${det} (no da un decimal exacto, queda como fracción)`;
      return { tipo: 'resultado', clave: 'div', nodo: marcar(deValor({ q, dec: hayDec })), texto, det };
    }
    const nodo = frac(entero(absB(va.q.n)), entero(absB(vb.q.n)));
    const negativo = qSig(va.q) * qSig(vb.q) < 0;
    return {
      tipo: 'resultado',
      clave: 'div',
      nodo: marcar(negativo ? neg(nodo) : nodo),
      texto: `Dividí: ${txtQ(va.q)} ÷ ${txtDivisor(vb.q)} no da exacto, así que queda la fracción ${negativo ? MENOS : ''}${absB(va.q.n)}/${absB(vb.q.n)}`,
      det: `${txtQ(va.q)} ÷ ${txtDivisor(vb.q)} = ${negativo ? MENOS : ''}${absB(va.q.n)}/${absB(vb.q.n)}`,
    };
  }
  const inv = deValor({ q: qDiv(Q1, vb.q) });
  const texto = enFraccion
    ? `Una fracción es una división: multiplicá el numerador por la inversa del denominador, ${txt(inv)}`
    : `Dividir por ${txt(B)} es multiplicar por su inversa, ${txt(inv)}`;
  return { tipo: 'inversa', clave: 'inversa', inv: marcar(inv), texto };
}

function multiplicar(grupo) {
  const vs = grupo.map(valor);
  const hayDec = vs.some(esDecV);
  const hayFrac = vs.some(esFracV);
  const hayRad = vs.some((v) => v.r !== 1n);
  if (hayDec && (hayFrac || hayRad)) {
    const { nuevos, texto } = conversionDecimales(grupo, vs);
    return { tipo: 'conv', clave: 'decAFrac', nuevos, texto };
  }
  let q = Q1;
  let R = 1n;
  for (const v of vs) {
    q = qMul(q, v.q);
    R *= v.r;
    if (R > 10n ** 12n) noSop('radicando enorme');
  }
  const signo = vs.filter((v) => qSig(v.q) < 0).length % 2 ? -1 : 1;
  const det = `${grupo.map((f) => txtEnv(f, 3)).join('·')}`;
  if (qCero(q)) return { tipo: 'resultado', clave: 'mul', nodo: marcar(entero(0)), texto: `Si un factor es cero, el producto da cero: ${det} = 0`, det: `${det} = 0` };
  if (hayRad) {
    const nRad = vs.filter((v) => v.r !== 1n).length;
    const rR = raizEntera(R, 2);
    const nodo = rR !== null ? deValor({ q: qMul(q, Q(rR)) }) : deValorCrudo(q, R);
    const res = rR !== null ? (R === 1n ? txtQ(q) : `${txtNodoPlano(deValorCrudo(q, R))} = ${txtQ(qMul(q, Q(rR)))}`) : txtNodoPlano(nodo);
    const texto = nRad >= 2 ? `Multiplicá las raíces (√a·√b = √(a·b)): ${det} = ${res}` : `Multiplicá: ${det} = ${res}`;
    return { tipo: 'resultado', clave: 'mulRad', nodo: marcar(nodo), texto, det: `${det} = ${res}` };
  }
  if (hayFrac) {
    let N = 1n;
    let D = 1n;
    for (const v of vs) {
      N *= absB(v.q.n);
      D *= v.q.d;
    }
    if (absB(N) > LIMITE || D > LIMITE) noSop('números demasiado grandes');
    const nodo = frac(entero(N), entero(D));
    const res = `${signo < 0 ? MENOS : ''}${N}/${D}`;
    return {
      tipo: 'resultado',
      clave: 'mulFrac',
      nodo: marcar(signo < 0 ? neg(nodo) : nodo),
      texto:
        vs.filter(esFracV).length === 1
          ? `Multiplicá el numerador por ${vs.length === 2 ? 'el número' : 'los números'}: ${det} = ${res}`
          : `Multiplicá los numeradores entre sí y los denominadores entre sí: ${det} = ${res}`,
      det: `${det} = ${res}`,
    };
  }
  const res = txtQ(q, hayDec);
  return { tipo: 'resultado', clave: 'mul', nodo: marcar(deValor({ q, dec: hayDec })), texto: `Multiplicá: ${det} = ${res}`, det: `${det} = ${res}` };
}

const txtNodoPlano = (n) => txt(desmarcar(n));

function accionMul(n) {
  if (n.t === 'frac') {
    const r = dividir(n.a, n.b, true);
    if (r.tipo === 'resultado') return accion(r.clave, r.nodo, r.texto, { plural: 'Dividí', det: r.det });
    if (r.tipo === 'conv') return accion(r.clave, frac(r.nuevos[0], r.nuevos[1]), r.texto);
    return accion(r.clave, cadena([n.a, r.inv], ['\\cdot']), r.texto);
  }
  const fs = n.fs;
  const ops = n.t === 'imp' ? fs.slice(1).map(() => '\\cdot') : n.ops;
  const rearmar = (nuevosFs, nuevosOps) => {
    if (nuevosFs.length === 1) return nuevosFs[0];
    return n.t === 'imp' && nuevosOps.every((o) => o === '\\cdot') ? imp(nuevosFs) : cadena(nuevosFs, nuevosOps);
  };
  if (ops[0] === '\\div') {
    const r = dividir(fs[0], fs[1], false);
    if (r.tipo === 'resultado') return accion(r.clave, rearmar([r.nodo, ...fs.slice(2)], ops.slice(1)), r.texto, { plural: 'Dividí', det: r.det });
    if (r.tipo === 'conv') return accion(r.clave, rearmar([...r.nuevos, ...fs.slice(2)], ops), r.texto);
    if (r.tipo === 'aFraccion') return accion(r.clave, rearmar([marcar(frac(fs[0], fs[1])), ...fs.slice(2)], ops.slice(1)), r.texto);
    return accion(r.clave, cadena([fs[0], r.inv, ...fs.slice(2)], ['\\cdot', ...ops.slice(1)]), r.texto);
  }
  let j = 1;
  while (j < ops.length && ops[j] !== '\\div') j++;
  const grupo = fs.slice(0, j + 1);
  const r = multiplicar(grupo);
  if (r.tipo === 'conv') {
    const nuevos = [...r.nuevos, ...fs.slice(j + 1)];
    return accion(r.clave, n.t === 'imp' ? imp(nuevos) : cadena(nuevos, ops), r.texto);
  }
  return accion(r.clave, rearmar([r.nodo, ...fs.slice(j + 1)], ops.slice(j)), r.texto, {
    plural: r.clave === 'mulFrac' ? 'Multiplicá las fracciones' : 'Multiplicá',
    det: r.det,
  });
}

function verbo(signos) {
  const resto = signos.slice(1);
  const hayMas = resto.some((s) => s > 0);
  const hayMenos = resto.some((s) => s < 0);
  if (!hayMenos) return 'Sumá';
  if (!hayMas) return 'Restá';
  return 'Sumá y restá';
}

function partesFraccion(e, v) {
  let x = e;
  if (x.t === 'paren') x = x.e;
  if (x.t === 'frac' && x.amp) return { n: x.a.v.n, d: x.b.v.n };
  return { n: absB(v.q.n), d: v.q.d };
}

function accionSuma(n) {
  const ts = n.ts;
  const vs = ts.map((t) => valor(t.e));
  if (vs.some((v) => qSig(v.q) < 0)) {
    const dets = [];
    const nuevos = ts.map((t, i) => {
      if (qSig(vs[i].q) >= 0) return t;
      const abs = { ...vs[i], q: qAbs(vs[i].q) };
      const antes = i === 0 && t.s > 0 ? '' : t.s < 0 ? MENOS : '+';
      dets.push(`${antes}(${txtValor(vs[i])}) = ${-t.s < 0 ? MENOS : '+'}${txtValor(abs)}`);
      return { s: -t.s, e: marcar(deValor(abs)) };
    });
    let nodo = { t: 'sum', ts: nuevos };
    if (nuevos.length === 1 && nuevos[0].s === 1) nodo = nuevos[0].e;
    const soloParentesis = ts.every((t, i) => qSig(vs[i].q) >= 0 || (i === 0 && t.s > 0));
    const texto = ts.length === 1 ? `Menos por menos da más: ${dets[0]}` : soloParentesis ? `Quitá los paréntesis: ${dets.join('; ')}` : `Aplicá la regla de los signos: ${dets.join('; ')}`;
    return accion('signos', nodo, texto);
  }
  const hayDec = vs.some(esDecV);
  const hayFrac = vs.some(esFracV);
  const hayRad = vs.some((v) => v.r !== 1n);
  if (hayDec && (hayFrac || hayRad)) {
    const { nuevos, texto } = conversionDecimales(
      ts.map((t) => t.e),
      vs,
    );
    return accion('decAFrac', { t: 'sum', ts: ts.map((t, i) => ({ s: t.s, e: nuevos[i] })) }, texto);
  }
  const signos = ts.map((t) => t.s);
  if (hayRad) {
    const grupos = new Map();
    ts.forEach((t, i) => {
      const k = vs[i].r;
      const acc = grupos.get(k) || Q0;
      grupos.set(k, qSum(acc, t.s > 0 ? vs[i].q : qNeg(vs[i].q)));
    });
    const nuevos = [];
    for (const [r, q] of grupos) if (!qCero(q)) nuevos.push({ s: qSig(q), e: marcar(deValor({ q: qAbs(q), r })) });
    let nodo;
    if (!nuevos.length) nodo = marcar(entero(0));
    else if (nuevos.length === 1 && nuevos[0].s === 1) nodo = nuevos[0].e;
    else nodo = { t: 'sum', ts: nuevos };
    return accion('sumaRad', nodo, 'Agrupá los términos semejantes: sumá los números por un lado y las raíces iguales por otro');
  }
  if (!hayFrac) {
    let total = Q0;
    ts.forEach((t, i) => {
      total = qSum(total, t.s > 0 ? vs[i].q : qNeg(vs[i].q));
    });
    const res = txtQ(total, hayDec);
    const det = `${txt(n)} = ${res}`;
    return accion('suma', marcar(deValor({ q: total, dec: hayDec })), `${verbo(signos)} los números`, {
      plural: 'Resolvé las sumas y restas',
      det,
    });
  }
  const partes = ts.map((t, i) => partesFraccion(t.e, vs[i]));
  const dens = partes.map((p) => p.d);
  if (dens.every((d) => d === dens[0])) {
    let N = 0n;
    partes.forEach((p, i) => {
      N += BigInt(ts[i].s) * p.n;
    });
    const d = dens[0];
    let nodo = N === 0n ? entero(0) : frac(entero(absB(N)), entero(d));
    if (N < 0n) nodo = neg(nodo);
    const det = `${txt(n)} = ${N < 0n ? MENOS : ''}${absB(N)}/${d}`;
    return accion('sumaFrac', marcar(nodo), `${verbo(signos)} los numeradores y dejá el mismo denominador`, {
      plural: 'Resolvé las sumas y restas de fracciones',
      det,
    });
  }
  const L = dens.reduce(mcm);
  const distintos = [...new Set(dens.map(String))];
  const nuevos = ts.map((t, i) => {
    const f = L / partes[i].d;
    const e = frac(entero(partes[i].n * f), entero(L), true);
    return { s: t.s, e: partes[i].d === L ? e : marcar(e) };
  });
  const texto =
    distintos.length === 1 || dens.includes(1n)
      ? `Escribí todos los términos con denominador común ${L}`
      : `Buscá el denominador común: mcm(${distintos.join(', ')}) = ${L}. Amplificá cada fracción para que tenga denominador ${L}`;
  return accion('ampl', { t: 'sum', ts: nuevos }, texto, { plural: 'Escribí cada suma con denominador común', det: `denominador ${L}` });
}

function aplicar(c, ctx) {
  switch (c.clase) {
    case 'conv':
      return accionConv(c.nodo, ctx);
    case 'pot':
      return accionPot(c.nodo);
    case 'mul':
      return accionMul(c.nodo);
    case 'suma':
      return accionSuma(c.nodo);
    default:
      noSop('clase desconocida');
  }
}

function normalizar(n) {
  switch (n.t) {
    case 'paren': {
      const e = normalizar(n.e);
      const v = e.m ? valor(e) : null;
      if (v && qSig(v.q) >= 0) return e;
      if (e.m && e.t === 'frac' && esEntLit(e.a) && esEntLit(e.b)) return e;
      return { ...n, e };
    }
    case 'sum': {
      const ts = n.ts.map(({ s, e }) => {
        let ee = normalizar(e);
        let ss = s;
        const nl = ee.t === 'neg' ? ee.e : null;
        if (nl && s < 0 && ee.m) {
          // restar un negativo: se deja entre paréntesis y la regla de los signos va en su propio paso
          ee = { t: 'paren', e: { ...ee, m: false }, k: '(', m: true };
        } else if (nl) {
          ss = -ss;
          ee = ee.m ? marcar(nl) : nl;
        }
        return { s: ss, e: ee };
      });
      if (ts.length === 1 && ts[0].s === 1) return ts[0].e;
      return { ...n, ts };
    }
    case 'chain':
    case 'imp': {
      const fs = n.fs.map(normalizar);
      return fs.length === 1 ? fs[0] : { ...n, fs };
    }
    case 'neg':
    case 'pct':
    case 'deg':
    case 'root':
      return { ...n, e: normalizar(n.e) };
    case 'frac':
      return { ...n, a: normalizar(n.a), b: normalizar(n.b) };
    case 'pow':
      return { ...n, b: normalizar(n.b), e: normalizar(n.e) };
    case 'fn':
      return { ...n, a: normalizar(n.a) };
    default:
      return n;
  }
}

function esFinal(n) {
  if (valor(n)) return true;
  if (n.t === 'sum') {
    const vs = n.ts.map((t) => valor(t.e));
    return vs.every(Boolean) && !sumaReducible(n, vs);
  }
  return false;
}

function extraFinal(n) {
  const v = valor(n);
  if (!v) {
    const aprox = evalNum(n, 0, 'rad');
    return Number.isFinite(aprox) ? ` Aproximadamente: ${coma(redondear(aprox))}.` : '';
  }
  if (v.r !== 1n) return ` Aproximadamente: ${coma(redondear(evalValor(v)))}.`;
  if (qEnt(v.q) || v.dec) return '';
  let s = '';
  if (absB(v.q.n) > v.q.d) s += ` Como número mixto: ${txtMixto(v.q)}.`;
  const d = qDecimal(v.q, 6);
  s += d !== null ? ` En decimal: ${coma(d)}.` : ` En decimal: ≈ ${coma(qAprox(v.q, 4))}.`;
  return s;
}

function redondear(x) {
  let s = x.toFixed(4);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

function unirTextos(lote) {
  if (lote.length === 1) return lote[0].subpasos[0].texto;
  const a0 = lote[0];
  if (a0.plural && lote.every((a) => a.det)) return `${a0.plural}: ${[...new Set(lote.map((a) => a.det))].join('; ')}`;
  return [...new Set(lote.map((a) => a.subpasos[0].texto))].join('. ');
}

function pasosAritmetica(ast, ctx) {
  const pasos = [{ texto: 'Partimos de la expresión', tex: tex(ast) }];
  let arbol = ast;
  for (let ronda = 0; ; ronda++) {
    if (ronda > 80) noSop('demasiados pasos');
    const cands = [];
    buscar(arbol, [], 0, cands, ctx);
    if (!cands.length) break;
    const grupo = elegirGrupo(cands);
    const acciones = grupo.map((c) => ({ c, a: aplicar(c, ctx) }));
    const primera = acciones[0].a;
    if (primera.subpasos.length > 1) {
      for (const sp of primera.subpasos) {
        const t = normalizar(reemplazar(arbol, acciones[0].c.path, sp.nodo));
        pasos.push({ texto: sp.texto, tex: tex(t) });
        arbol = t;
      }
      arbol = desmarcar(arbol);
      continue;
    }
    const lote = acciones.filter((x) => x.a.clave === primera.clave && x.a.subpasos.length === 1);
    let nuevo = arbol;
    for (const { c, a } of lote) nuevo = reemplazar(nuevo, c.path, a.subpasos[0].nodo);
    nuevo = normalizar(nuevo);
    pasos.push({ texto: unirTextos(lote.map((x) => x.a)), tex: tex(nuevo) });
    arbol = desmarcar(nuevo);
  }
  if (!esFinal(arbol)) noSop('no se pudo llegar a un resultado simple');
  if (pasos.length < 2) return null;
  const extra = extraFinal(arbol);
  if (extra) {
    const ult = pasos[pasos.length - 1];
    ult.texto = ult.texto.replace(/\.$/, '') + '.' + extra;
  }
  return { titulo: 'Calcular', pasos, resultado: tex(arbol), final: arbol };
}

// ───────────────────────── Evaluación numérica (para verificar) ─────────────────────────

const tieneGrados = (n) => !!n && typeof n === 'object' && (n.t === 'deg' || ['e', 'a', 'b'].some((k) => n[k] && n[k].t && tieneGrados(n[k])) || (n.fs || []).some(tieneGrados) || (n.ts || []).some((t) => tieneGrados(t.e)));

// x: valor de la incógnita, o { letra: valor } si hay varias.
function evalNum(n, x, angulo) {
  const ev = (m) => evalNum(m, x, angulo);
  switch (n.t) {
    case 'num':
      return qNumero(n.v);
    case 'var':
      return typeof x === 'object' ? x[n.n] : x;
    case 'pi':
      return Math.PI;
    case 'paren':
      return ev(n.e);
    case 'sum':
      return n.ts.reduce((a, t) => a + t.s * ev(t.e), 0);
    case 'neg':
      return -ev(n.e);
    case 'chain':
      return n.fs.slice(1).reduce((a, f, i) => (n.ops[i] === '\\div' ? a / ev(f) : a * ev(f)), ev(n.fs[0]));
    case 'imp':
      return n.fs.reduce((a, f) => a * ev(f), 1);
    case 'frac':
      return ev(n.a) / ev(n.b);
    case 'pow':
      return Math.pow(ev(n.b), ev(n.e));
    case 'root': {
      const v = ev(n.e);
      return n.n % 2 === 1 && v < 0 ? -Math.pow(-v, 1 / n.n) : Math.pow(v, 1 / n.n);
    }
    case 'mixed':
      return Number(n.w) + Number(n.a) / Number(n.b);
    case 'pct':
      return ev(n.e) / 100;
    case 'deg':
      return (ev(n.e) * Math.PI) / 180;
    case 'fn': {
      let a = ev(n.a);
      if (angulo === 'deg' && !tieneGrados(n.a)) a = (a * Math.PI) / 180;
      return Math[n.f](a);
    }
    default:
      return NaN;
  }
}

// ───────────────────────── Ecuaciones ─────────────────────────
// Termino: { c: Q, g: 0|1|2, dec, fs: [{ p: [Termino simple], e: 1|2 }], m? }

const T = (c, g = 0, dec = false, fs = []) => ({ c, g, dec, fs });
const gradoP = (p) => Math.max(0, ...p.filter((t) => !qCero(t.c)).map(gradoT));
function gradoT(t) {
  return t.g + t.fs.reduce((a, f) => a + f.e * gradoP(f.p), 0);
}
const mulT = (a, b) => T(qMul(a.c, b.c), a.g + b.g, a.dec || b.dec, [...a.fs, ...b.fs]);
const negT = (t) => ({ ...t, c: qNeg(t.c) });
const esVarT = (t) => gradoT(t) > 0 && !qCero(t.c);
const esConst = (t) => t.g === 0 && !t.fs.length;
const sinMarca = (L) => L.map(({ m, ...r }) => r);

// Valor exacto de una subexpresión numérica (sin variable).
function valorExacto(n) {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'paren':
      return valorExacto(n.e);
    case 'neg':
      return qNeg(valorExacto(n.e));
    case 'sum':
      return n.ts.reduce((a, t) => qSum(a, t.s > 0 ? valorExacto(t.e) : qNeg(valorExacto(t.e))), Q0);
    case 'chain':
      return n.fs.slice(1).reduce((a, f, i) => (n.ops[i] === '\\div' ? qDiv(a, valorExacto(f)) : qMul(a, valorExacto(f))), valorExacto(n.fs[0]));
    case 'imp':
      return n.fs.reduce((a, f) => qMul(a, valorExacto(f)), Q1);
    case 'frac':
      return qDiv(valorExacto(n.a), valorExacto(n.b));
    case 'mixed':
      return Q(n.w * n.b + n.a, n.b);
    case 'pow': {
      const e = valorExacto(n.e);
      if (!qEnt(e) || absB(e.n) > 20n) noSop('exponente');
      return qPot(valorExacto(n.b), Number(e.n));
    }
    default:
      noSop('constante no soportada');
  }
}

// Simplificaciones numéricas hechas al leer la ecuación (se muestran en un paso aparte).
let notasLectura = [];

function aLado(n, x) {
  if (n.t === 'sum') return n.ts.flatMap(({ s, e }) => aLado(e, x).map((t) => (s < 0 ? negT(t) : t)));
  return [aTermino(n, x)];
}

function polinomioSimple(L) {
  if (L.some((t) => t.fs.length)) noSop('paréntesis anidados');
  return L;
}

function factorDe(n, x) {
  const L = aLado(n, x);
  if (L.length === 1) return L[0];
  return T(Q1, 0, false, [{ p: polinomioSimple(L), e: 1 }]);
}

function aTermino(n, x) {
  switch (n.t) {
    case 'num':
      return T(n.v, 0, n.dec);
    case 'var':
      if (n.n !== x) noSop('otra variable');
      return T(Q1, 1);
    case 'paren':
      return factorDe(n.e, x);
    case 'sum':
      return factorDe(n, x);
    case 'neg':
      return negT(aTermino(n.e, x));
    case 'mixed':
      notasLectura.push(`${n.w} ${n.a}/${n.b} = ${n.w * n.b + n.a}/${n.b}`);
      return T(Q(n.w * n.b + n.a, n.b));
    case 'imp': {
      const ts = n.fs.map((f) => aTermino(f, x));
      if (ts.filter((t) => !qIg(qAbs(t.c), Q1)).length >= 2) notasLectura.push(`${txt(n)} = ${txtTermino(ts.reduce(mulT), x)}`);
      return ts.reduce(mulT);
    }
    case 'chain': {
      const coefs = n.fs.map((f) => aTerminoSinNotas(f, x)).filter((t) => !qIg(qAbs(t.c), Q1));
      if (coefs.length >= 2) {
        const r = aTerminoSinNotas(n, x);
        notasLectura.push(`${txt(n)} = ${txtTermino(r, x)}`);
        return r;
      }
      let acc = aTermino(n.fs[0], x);
      n.fs.slice(1).forEach((f, i) => {
        const t = aTermino(f, x);
        if (n.ops[i] === '\\div') {
          if (!esConst(t) || qCero(t.c)) noSop('división por algo con x');
          acc = { ...acc, c: qDiv(acc.c, t.c), dec: acc.dec || t.dec };
        } else acc = mulT(acc, t);
      });
      return acc;
    }
    case 'frac': {
      if (variables(n.b).size) noSop('x en el denominador');
      const d = valorExacto(n.b);
      if (qCero(d)) noSop('división por cero');
      if (esEntLit(n.a) && esEntLit(n.b) && mcd(n.a.v.n, n.b.v.n) > 1n) notasLectura.push(`${txt(n)} = ${txtQ(qDiv(n.a.v, d))}`);
      else if (n.b.t !== 'num') notasLectura.push(`${txt(n.b)} = ${txtQ(d)}`);
      const t = aTermino(n.a, x);
      return { ...t, c: qDiv(t.c, d), dec: t.dec || esDecLiteral(n.b) };
    }
    case 'pow': {
      if (!variables(n).size) {
        const v = valorExacto(n);
        notasLectura.push(`${txt(n)} = ${txtQ(v)}`);
        return T(v);
      }
      if (variables(n.e).size) noSop('x en el exponente');
      const e = valorExacto(n.e);
      if (!qEnt(e) || e.n < 0n || e.n > 2n) noSop('exponente no soportado');
      const k = Number(e.n);
      if (k === 0) return T(Q1);
      const base = aTermino(n.b, x);
      if (k === 1) return base;
      if (base.fs.length === 1 && base.g === 0 && base.fs[0].e === 1 && qIg(base.c, Q1)) return T(Q1, 0, false, [{ p: base.fs[0].p, e: 2 }]);
      const cuad = mulT(base, base);
      if (!base.fs.length && !qIg(qAbs(base.c), Q1)) notasLectura.push(`${txt(n)} = ${txtTermino(cuad, x)}`);
      return cuad;
    }
    default:
      noSop('expresión no polinómica');
  }
}
const esDecLiteral = (n) => n.t === 'num' && n.dec;
function aTerminoSinNotas(n, x) {
  const guardadas = notasLectura;
  notasLectura = [];
  try {
    if (n.t !== 'chain') return aTermino(n, x);
    const { fs, ops } = n;
    let acc = aTermino(fs[0], x);
    fs.slice(1).forEach((f, i) => {
      const t = aTermino(f, x);
      if (ops[i] === '\\div') {
        if (!esConst(t) || qCero(t.c)) noSop('división por algo con x');
        acc = { ...acc, c: qDiv(acc.c, t.c), dec: acc.dec || t.dec };
      } else acc = mulT(acc, t);
    });
    return acc;
  } finally {
    notasLectura = guardadas;
  }
}

function texCuerpo(t, x) {
  let s = t.g === 0 ? '' : t.g === 1 ? x : `${x}^{${t.g}}`;
  for (const f of t.fs) s += envolver(texLado(f.p, x)) + (f.e === 2 ? '^{2}' : '');
  return s;
}
function texTerminoAbs(t, x) {
  const a = qAbs(t.c);
  const cuerpo = texCuerpo(t, x);
  if (!cuerpo) return texQ(a, t.dec);
  if (qEnt(a)) return (a.n === 1n ? '' : a.n.toString()) + cuerpo;
  if (t.dec && qDecimal(a) !== null) return qDecimal(a) + cuerpo;
  const soloFactor = a.n === 1n && t.g === 0 && t.fs.length === 1 && t.fs[0].e === 1;
  const numer = soloFactor ? texLado(t.fs[0].p, x) : (a.n === 1n ? '' : a.n.toString()) + cuerpo;
  return `\\frac{${numer}}{${a.d}}`;
}
function texLado(L, x) {
  if (!L.length) return '0';
  let s = '';
  L.forEach((t, i) => {
    const negativo = qSig(t.c) < 0;
    let cuerpo = qCero(t.c) ? '0' : texTerminoAbs(t, x);
    if (t.m) cuerpo = `\\textcolor{${RESALTE}}{${cuerpo}}`;
    s += i === 0 ? (negativo ? '-' : '') + cuerpo : (negativo ? '-' : '+') + cuerpo;
  });
  return s;
}
const texEc = (I, D, x) => `${texLado(I, x)}=${texLado(D, x)}`;

function txtTermino(t, x) {
  const a = qAbs(t.c);
  const cuerpo = (t.g === 0 ? '' : t.g === 1 ? x : `${x}²`) + (t.fs.length ? '(…)' : '');
  if (!cuerpo) return txtQ(a, t.dec);
  if (qIg(a, Q1)) return cuerpo;
  return txtQ(a, t.dec) + cuerpo;
}

function expandirTermino(t) {
  let acc = [T(t.c, t.g, t.dec)];
  for (const f of t.fs) {
    if (f.e === 2 && f.p.length === 2) {
      const [a, b] = f.p;
      const dosAB = mulT(a, b);
      acc = acc.flatMap((u) => [mulT(u, mulT(a, a)), mulT(u, { ...dosAB, c: qMul(Q(2), dosAB.c) }), mulT(u, mulT(b, b))]);
    } else {
      for (let k = 0; k < f.e; k++) acc = acc.flatMap((u) => f.p.map((v) => mulT(u, v)));
    }
  }
  return acc;
}
const expandirLado = (L) => L.flatMap((t) => (t.fs.length ? expandirTermino(t) : [t]));

function combinarLado(L, ordenar = false) {
  const orden = [];
  const acc = new Map();
  for (const t of L) {
    if (!acc.has(t.g)) {
      acc.set(t.g, { c: Q0, dec: false, n: 0 });
      orden.push(t.g);
    }
    const a = acc.get(t.g);
    a.c = qSum(a.c, t.c);
    a.dec = a.dec || t.dec;
    a.n++;
  }
  if (ordenar) orden.sort((p, q) => q - p);
  const out = [];
  for (const g of orden) {
    const a = acc.get(g);
    if (!qCero(a.c)) out.push({ ...T(a.c, g, a.dec), ...(a.n > 1 ? { m: true } : {}) });
  }
  return out.length ? out : [T(Q0)];
}
const necesitaCombinar = (L) => {
  if (L.length <= 1) return false;
  const gs = L.map((t) => t.g);
  return new Set(gs).size !== gs.length || L.some((t) => qCero(t.c));
};
const coefG = (L, g) => L.filter((t) => t.g === g).reduce((a, t) => qSum(a, t.c), Q0);
const ladoCero = (L) => L.every((t) => qCero(t.c) && !t.fs.length);
const todosCoefs = (L) => L.flatMap((t) => [t, ...t.fs.flatMap((f) => f.p)]);

function pasosEcuacion(izq, der, x) {
  const pasos = [{ texto: 'Partimos de la ecuación', tex: `${tex(izq)}=${tex(der)}` }];
  notasLectura = [];
  let I = aLado(izq, x);
  let D = aLado(der, x);
  const notas = [...new Set(notasLectura)];
  for (const t of [...I, ...D]) if (gradoT(t) > 2) noSop('grado mayor que 2');
  const resuelta = (A, B) => A.length === 1 && A[0].g === 1 && qIg(A[0].c, Q1) && !A[0].fs.length && B.length === 1 && esConst(B[0]);
  if (resuelta(I, D) || resuelta(D, I)) return null;
  const agregar = (texto, I2, D2) => {
    const t = texEc(I2, D2, x);
    if (sinColor(t) !== sinColor(pasos[pasos.length - 1].tex)) pasos.push({ texto, tex: t });
    I = sinMarca(I2);
    D = sinMarca(D2);
  };
  if (notas.length) agregar(`Simplificá los números: ${notas.join('; ')}`, I, D);
  const dif = combinarLado([...expandirLado(I), ...expandirLado(D).map(negT)]);
  const grado = Math.max(0, ...dif.filter((t) => !qCero(t.c)).map((t) => t.g));
  const pura = grado === 2 && qCero(coefG(dif, 1));

  if (grado === 2) {
    const r = productoCero(I, D, x, pasos);
    if (r) return r;
  }

  // Decimales → fracciones (si se mezclan con fracciones o la ecuación es cuadrática)
  const coefs = todosCoefs([...I, ...D]);
  const hayFrac = coefs.some((t) => !qEnt(t.c) && !t.dec);
  const hayDec = coefs.some((t) => !qEnt(t.c) && t.dec);
  if (hayDec && (hayFrac || (grado === 2 && !pura))) {
    const ejemplos = [...new Set(coefs.filter((t) => !qEnt(t.c) && t.dec).map((t) => txtDecAFrac({ q: t.c, r: 1n, dec: true })))];
    const quitar = (L) => L.map((t) => ({ ...t, dec: false, fs: t.fs.map((f) => ({ ...f, p: f.p.map((u) => ({ ...u, dec: false })) })) }));
    agregar(ejemplos.length === 1 ? `Pasá el decimal a fracción: ${ejemplos[0]}` : `Pasá los decimales a fracciones: ${ejemplos.join('; ')}`, quitar(I), quitar(D));
  }

  const distribuir = () => {
    if (![...I, ...D].some((t) => t.fs.length)) return;
    const conFs = [...I, ...D].filter((t) => t.fs.length);
    let texto = 'Aplicá la propiedad distributiva';
    if (conFs.some((t) => t.fs.some((f) => f.e === 2 && f.p.length === 2)) && conFs.every((t) => t.fs.length === 1 && t.fs[0].e === 2)) texto = 'Desarrollá el cuadrado del binomio: (a + b)² = a² + 2ab + b²';
    else if (conFs.some((t) => t.fs.reduce((a, f) => a + f.e, 0) >= 2)) texto = 'Aplicá la propiedad distributiva: multiplicá cada término por cada término';
    else if (conFs.every((t) => t.g === 0 && t.fs.length === 1 && qIg(t.c, Q1))) texto = 'Quitá los paréntesis';
    else if (conFs.every((t) => t.g === 0 && t.fs.length === 1 && qIg(qAbs(t.c), Q1))) texto = 'Quitá los paréntesis: el signo menos de adelante cambia el signo de cada término';
    const exp = (L) => L.flatMap((t) => (t.fs.length ? expandirTermino(t).map((u) => ({ ...u, m: true })) : [t]));
    agregar(texto, exp(I), exp(D));
  };
  const quitarDenominadores = () => {
    const dens = [...I, ...D].filter((t) => !t.dec && !qCero(t.c)).map((t) => t.c.d);
    const L = dens.reduce(mcm, 1n);
    if (L === 1n) return;
    if (pura && !todosCoefs([...I, ...D]).some((t) => gradoT(t) > 0 && !qEnt(t.c) && !t.dec)) return;
    const unico = new Set(dens.filter((d) => d > 1n).map(String)).size === 1;
    const mult = (Ld) => Ld.map((t) => ({ ...t, c: qMul(t.c, Q(L)) }));
    agregar(
      unico ? `Multiplicá ambos lados por ${L} para sacar el denominador` : `Multiplicá ambos lados por ${L} (el mcm de los denominadores) para sacar las fracciones`,
      mult(I),
      mult(D),
    );
  };
  const fracInterna = [...I, ...D].some((t) => t.fs.some((f) => f.p.some((u) => !qEnt(u.c) && !u.dec)));
  if (fracInterna) {
    distribuir();
    quitarDenominadores();
  } else {
    quitarDenominadores();
    distribuir();
  }
  if (necesitaCombinar(I) || necesitaCombinar(D)) {
    const ambos = necesitaCombinar(I) && necesitaCombinar(D);
    agregar(ambos ? 'Agrupá los términos semejantes en cada lado' : 'Agrupá los términos semejantes', necesitaCombinar(I) ? combinarLado(I) : I, necesitaCombinar(D) ? combinarLado(D) : D);
  }
  if (grado < 2) return lineal(I, D, x, pasos, agregar);
  return pura ? cuadraticaPura(I, D, x, pasos, agregar) : cuadratica(I, D, x, pasos, agregar);
}

// Deja los términos con x a la izquierda y los números a la derecha, y agrupa.
function moverYAgrupar(I0, D0, x, agregar) {
  let I = I0;
  let D = D0;
  const sync = (I2, D2, texto) => {
    agregar(texto, I2, D2);
    I = sinMarca(I2);
    D = sinMarca(D2);
  };
  if (!I.some(esVarT) && D.some(esVarT)) sync(D, I, 'Intercambiá los lados de la ecuación');
  const varD = D.filter(esVarT);
  if (varD.length) {
    const movidos = varD.map((t) => ({ ...negT(t), m: true }));
    let D2 = D.filter((t) => !esVarT(t));
    if (!D2.length) D2 = [T(Q0)];
    const I2 = [...I.filter((t) => !qCero(t.c)), ...movidos];
    const t0 = varD[0];
    const texto = varD.length === 1 ? `Pasá ${txtTermino(t0, x)} ${qSig(t0.c) > 0 ? 'restando' : 'sumando'} al lado izquierdo` : `Pasá los términos con ${x} al lado izquierdo, cambiándoles el signo`;
    sync(I2.length ? I2 : [T(Q0)], D2, texto);
  }
  const ctesI = I.filter((t) => !esVarT(t) && !qCero(t.c));
  if (ctesI.length) {
    const movidos = ctesI.map((t) => ({ ...negT(t), m: true }));
    const D2 = [...D.filter((t) => !qCero(t.c)), ...movidos];
    let I2 = I.filter(esVarT);
    if (!I2.length) I2 = [T(Q0)];
    const t0 = ctesI[0];
    const texto = ctesI.length === 1 ? `Pasá el ${txtTermino(t0, x)} ${qSig(t0.c) > 0 ? 'restando' : 'sumando'} al lado derecho` : 'Pasá los números al lado derecho, cambiándoles el signo';
    sync(I2, D2, texto);
  }
  if (I.length > 1 || D.length > 1) {
    const texto = I.length > 1 ? (D.length > 1 ? 'Agrupá los términos semejantes y operá con los números' : 'Agrupá los términos semejantes') : 'Operá con los números';
    sync(I.length > 1 ? combinarLado(I) : I, D.length > 1 ? combinarLado(D) : D, texto);
  }
  return { I, D };
}

function lineal(I0, D0, x, pasos, agregar) {
  const { I, D } = moverYAgrupar(I0, D0, x, agregar);
  const a = coefG(I, 1);
  const b = coefG(D, 0);
  const dec = I.some((t) => t.dec) || D.some((t) => t.dec);
  if (qCero(a)) {
    if (qCero(b)) {
      pasos.push({ texto: `La igualdad 0 = 0 se cumple siempre: cualquier número es solución. La ecuación tiene infinitas soluciones`, tex: 'S=\\mathbb{R}' });
      return { titulo: 'Resolver la ecuación', pasos, resultado: 'S=\\mathbb{R}', sol: { tipo: 'todas' } };
    }
    pasos.push({ texto: `La igualdad 0 = ${txtQ(b, dec)} es falsa: la ecuación no tiene solución`, tex: 'S=\\varnothing' });
    return { titulo: 'Resolver la ecuación', pasos, resultado: 'S=\\varnothing', sol: { tipo: 'ninguna' } };
  }
  const sol = qDiv(b, a);
  const decSol = dec && qDecimal(sol) !== null;
  if (!qIg(a, Q1)) {
    if (qIg(a, qNeg(Q1))) {
      agregar('Multiplicá ambos lados por −1', [T(Q1, 1)], [{ ...T(sol, 0, decSol), m: true }]);
    } else {
      const crudoN = b.n * a.d;
      const crudoD = b.d * a.n;
      const g = mcd(crudoN, crudoD);
      const reducible = !decSol && !qEnt(sol) && qEnt(a) && qEnt(b) && g > 1n;
      const aTxt = txtQ(a, dec);
      if (reducible) {
        const sg = (crudoN < 0n) !== (crudoD < 0n) ? '-' : '';
        pasos.push({ texto: `Dividí ambos lados por ${aTxt}`, tex: `${x}=\\textcolor{${RESALTE}}{${sg}\\frac{${absB(crudoN)}}{${absB(crudoD)}}}` });
        pasos.push({ texto: `Simplificá la fracción dividiendo numerador y denominador por ${mcd(crudoN, crudoD)}`, tex: `${x}=\\textcolor{${RESALTE}}{${texQ(sol)}}` });
      } else {
        agregar(`Dividí ambos lados por ${aTxt}`, [T(Q1, 1)], [{ ...T(sol, 0, decSol), m: true }]);
      }
    }
  }
  const resultado = `${x}=${texQ(sol, decSol)}`;
  if (!qEnt(sol) && !decSol) {
    const d = qDecimal(sol, 6);
    pasos[pasos.length - 1].texto += d !== null ? `. En decimal: ${x} = ${coma(d)}` : `. En decimal: ${x} ≈ ${coma(qAprox(sol, 4))}`;
  }
  return { titulo: 'Resolver la ecuación', pasos, resultado, sol: { tipo: 'finitas', valores: [{ re: qNumero(sol), im: 0 }] } };
}

function resolverLineal(p) {
  const L = combinarLado(p);
  const a = coefG(L, 1);
  const b = coefG(L, 0);
  return qDiv(qNeg(b), a);
}

function productoCero(I, D, x, pasos) {
  let prod = null;
  if (ladoCero(D) && I.length === 1) prod = I[0];
  else if (ladoCero(I) && D.length === 1) prod = D[0];
  if (!prod || qCero(prod.c)) return null;
  const factores = [];
  for (let i = 0; i < prod.g; i++) factores.push([T(Q1, 1)]);
  for (const f of prod.fs) {
    if (gradoP(f.p) !== 1) return null;
    for (let j = 0; j < f.e; j++) factores.push(f.p);
  }
  if (factores.length !== 2) return null;
  const unicos = [];
  for (const p of factores) if (!unicos.some((u) => texLado(u, x) === texLado(p, x))) unicos.push(p);
  const yaDespejadas = unicos.every((p) => p.length === 1 && p[0].g === 1 && qIg(p[0].c, Q1));
  if (yaDespejadas && unicos.length === 1) {
    pasos.push({ texto: `Un cuadrado da cero sólo si la base es cero: ${x} = 0 (raíz doble)`, tex: `${x}=0` });
    return { titulo: 'Resolver la ecuación', pasos, resultado: `${x}=0`, sol: { tipo: 'finitas', valores: [{ re: 0, im: 0 }] } };
  }
  pasos.push({
    texto: unicos.length === 1 ? 'Un cuadrado da cero sólo si la base es cero' : 'Si un producto da cero, alguno de los factores tiene que ser cero',
    tex: unicos.map((p) => `${texLado(p, x)}=0`).join('\\lor '),
  });
  const raices = unicos.map((p) => ({ q: resolverLineal(p), dec: p.some((t) => t.dec) }));
  const fmt = (r) => texQ(r.q, r.dec && qDecimal(r.q) !== null);
  const distintas = [];
  for (const r of raices) if (!distintas.some((d) => qIg(d.q, r.q))) distintas.push(r);
  const resultado = distintas.length === 1 ? `${x}=${fmt(distintas[0])}` : `${x}_1=${fmt(distintas[0])},\\quad ${x}_2=${fmt(distintas[1])}`;
  let texto = distintas.length === 1 ? (unicos.length === 1 ? `Despejá ${x}: es una raíz doble` : `Despejá ${x} en cada ecuación: las dos dan lo mismo (raíz doble)`) : `Despejá ${x} en cada ecuación`;
  if (yaDespejadas) texto = 'Las soluciones son';
  texto += textoAprox(distintas.map((r) => r.q), x);
  pasos.push({ texto, tex: resultado });
  return { titulo: 'Resolver la ecuación', pasos, resultado, sol: { tipo: 'finitas', valores: distintas.map((r) => ({ re: qNumero(r.q), im: 0 })) } };
}

function textoAprox(qs, x) {
  if (qs.every((q) => qEnt(q) || qDecimal(q, 6) !== null)) return '';
  const partes = qs.map((q, i) => `${qs.length > 1 ? x + (i ? '₂' : '₁') : x} ${qDecimal(q, 6) !== null ? '=' : '≈'} ${coma(qDecimal(q, 6) ?? qAprox(q, 4))}`);
  return `. En decimal: ${partes.join('; ')}`;
}

// a ± b·√m sobre c (todo entero, c > 0). imag: la raíz lleva i.
function texPM(p, k, m, c, signo, imag) {
  const radical = (m === 1n ? (imag ? '' : k.toString()) : (k === 1n ? '' : k.toString()) + `\\sqrt{${m}}`) + (imag ? (m === 1n && k !== 1n ? k.toString() + 'i' : 'i') : '');
  const rad = imag && m === 1n ? (k === 1n ? 'i' : `${k}i`) : radical;
  let numer;
  if (p === 0n) numer = (signo === '\\pm' ? '\\pm ' : signo === '-' ? '-' : '') + rad;
  else numer = `${p}${signo === '\\pm' ? '\\pm ' : signo}${rad}`;
  return c === 1n ? numer : `\\frac{${numer}}{${c}}`;
}

function raizRacional(q) {
  const rn = raizEntera(q.n, 2);
  const rd = raizEntera(q.d, 2);
  if (rn !== null && rd !== null) return { exacta: Q(rn, rd) };
  const { k, m } = extraerCuadrado(q.n * q.d);
  return { coef: Q(k, q.d), m };
}

// Ecuación sin término en x: se despeja x² y se aplica raíz cuadrada.
function cuadraticaPura(I0, D0, x, pasos, agregar) {
  const { I, D } = moverYAgrupar(I0, D0, x, agregar);
  const a = coefG(I, 2);
  const b = coefG(D, 0);
  if (qCero(a) || I.some((t) => t.g === 1 && !qCero(t.c))) noSop('no es una cuadrática pura');
  const dec = I.some((t) => t.dec) || D.some((t) => t.dec);
  const k = qDiv(b, a);
  const decK = dec && qDecimal(k) !== null;
  if (!qIg(a, Q1)) {
    const sim = !decK && !qEnt(k) && qEnt(a) && qEnt(b) && mcd(a.n, b.n) > 1n ? ' y simplificá' : '';
    pasos.push({ texto: `Dividí ambos lados por ${txtQ(a, dec)}${sim}`, tex: `${x}^{2}=\\textcolor{${RESALTE}}{${texQ(k, decK)}}` });
  }
  return raicesDeCuadrado(k, x, pasos, decK);
}

// Desde x² = k.
function raicesDeCuadrado(k, x, pasos, dec) {
  const x1 = `${x}_1`;
  const x2 = `${x}_2`;
  const fin = (resultado, valores, texto) => {
    pasos.push({ texto, tex: resultado });
    return { titulo: 'Resolver la ecuación', pasos, resultado, sol: { tipo: 'finitas', valores } };
  };
  const fmt = (q) => texQ(q, dec && qDecimal(q) !== null);
  const fmtTxt = (q) => txtQ(q, dec && qDecimal(q) !== null);
  const raizTxt = (q) => (qEnt(q) || (dec && qDecimal(q) !== null) ? `√${fmtTxt(q)}` : `√(${fmtTxt(q)})`);
  if (qCero(k)) return fin(`${x}=0`, [{ re: 0, im: 0 }], 'Si el cuadrado da cero, la base es cero (raíz doble)');
  const ka = qAbs(k);
  const rr = raizRacional(ka);
  if (qSig(k) > 0) {
    pasos.push({ texto: 'Aplicá raíz cuadrada en ambos lados. Hay dos soluciones: una positiva y una negativa', tex: `${x}=\\pm\\sqrt{${fmt(ka)}}` });
    if (rr.exacta) {
      const r = rr.exacta;
      pasos.push({ texto: `Calculá la raíz: ${raizTxt(ka)} = ${fmtTxt(r)}`, tex: `${x}=\\pm ${fmt(r)}` });
      return fin(`${x1}=${fmt(r)},\\quad ${x2}=${fmt(qNeg(r))}`, [{ re: qNumero(r), im: 0 }, { re: -qNumero(r), im: 0 }], 'Separá las dos soluciones' + (dec ? '' : textoAprox([r, qNeg(r)], x)));
    }
    const v = { q: rr.coef, r: rr.m };
    const t = tex(deValor(v));
    if (!(qEnt(ka) && qIg(rr.coef, Q1))) {
      const txtR = qEnt(ka) ? `Simplificá la raíz: ${raizTxt(ka)} = ${txtValor(v)}` : `Separá la raíz y racionalizá: ${raizTxt(ka)} = ${txtValor(v)}`;
      pasos.push({ texto: txtR, tex: `${x}=\\pm ${t}` });
    }
    const val = evalValor(v);
    const tn = tex(deValor({ ...v, q: qNeg(v.q) }));
    return fin(`${x1}=${t},\\quad ${x2}=${tn}`, [{ re: val, im: 0 }, { re: -val, im: 0 }], `Separá las dos soluciones. En decimal: ${x}₁ ≈ ${coma(redondear(val))}; ${x}₂ ≈ ${coma(redondear(-val))}`);
  }
  pasos.push({ texto: 'Ningún número real al cuadrado da negativo: no hay soluciones reales. En los números complejos, aplicá raíz cuadrada en ambos lados', tex: `${x}=\\pm\\sqrt{${fmt(k)}}` });
  let t;
  let val;
  if (rr.exacta) {
    t = texImag(rr.exacta, 1n);
    val = qNumero(rr.exacta);
  } else {
    t = texImag(rr.coef, rr.m);
    val = evalValor({ q: rr.coef, r: rr.m });
  }
  pasos.push({ texto: `Usá que √(−1) = i: √(${fmtTxt(k)}) = ${raizTxt(ka)}·i`, tex: `${x}=\\pm ${t}` });
  return fin(`${x1}=${t},\\quad ${x2}=-${t}`, [{ re: 0, im: val }, { re: 0, im: -val }], 'No tiene soluciones reales. Las dos soluciones complejas son');
}

function cuadratica(I0, D0, x, pasos, agregar) {
  let I = I0;
  let D = D0;
  const sync = (I2, D2, texto) => {
    agregar(texto, I2, D2);
    I = sinMarca(I2);
    D = sinMarca(D2);
  };
  if (!ladoCero(D)) sync([...I.filter((t) => !qCero(t.c)), ...D.filter((t) => !qCero(t.c)).map((t) => ({ ...negT(t), m: true }))], [T(Q0)], 'Pasá todos los términos al lado izquierdo para igualar a cero');
  const ord = combinarLado(I, true);
  if (texLado(sinMarca(ord), x) !== texLado(I, x)) sync(ord, D, necesitaCombinar(I) ? 'Agrupá los términos semejantes y ordená de mayor a menor grado' : 'Ordená los términos de mayor a menor grado');
  let a = coefG(I, 2);
  let b = coefG(I, 1);
  let c = coefG(I, 0);
  if (qSig(a) < 0) {
    sync(
      I.map((t) => negT(t)),
      D,
      'Multiplicá ambos lados por −1 para que el término con x² quede positivo',
    );
    a = qNeg(a);
    b = qNeg(b);
    c = qNeg(c);
  }
  if (![a, b, c].every(qEnt)) noSop('coeficientes no enteros');
  const fin = (resultado, valores, texto) => {
    pasos.push({ texto, tex: resultado });
    return { titulo: 'Resolver la ecuación', pasos, resultado, sol: { tipo: 'finitas', valores } };
  };
  const x1 = `${x}_1`;
  const x2 = `${x}_2`;

  // ax² = 0
  if (qCero(b) && qCero(c)) {
    if (!qIg(a, Q1)) pasos.push({ texto: `Dividí ambos lados por ${txtQ(a)}`, tex: `${x}^{2}=0` });
    return fin(`${x}=0`, [{ re: 0, im: 0 }], 'Si el cuadrado da cero, la base es cero (raíz doble)');
  }
  // ax² + bx = 0 → factor común
  if (qCero(c)) {
    const lin = [T(a, 1), T(b, 0)];
    pasos.push({ texto: `Sacá factor común ${x}`, tex: `${x}${envolver(texLado(lin, x))}=0` });
    pasos.push({ texto: 'Si un producto da cero, alguno de los factores tiene que ser cero', tex: `${x}=0\\lor ${texLado(lin, x)}=0` });
    const r = qDiv(qNeg(b), a);
    return fin(`${x1}=0,\\quad ${x2}=${texQ(r)}`, [{ re: 0, im: 0 }, { re: qNumero(r), im: 0 }], `Despejá ${x} en la segunda ecuación` + textoAprox([Q0, r], x));
  }
  if (qCero(b)) noSop('sin término en x: va por cuadraticaPura');

  // Fórmula resolvente
  const A = a.n;
  const Bv = b.n;
  const C = c.n;
  pasos.push({ texto: 'Identificá los coeficientes a, b y c', tex: `a=${A},\\quad b=${Bv},\\quad c=${C}` });
  const disc = Bv * Bv - 4n * A * C;
  const cuatroAC = 4n * A * C;
  const par = (v) => (v < 0n ? envolver(v.toString()) : v.toString());
  pasos.push({
    texto: 'Calculá el discriminante: Δ = b² − 4ac',
    tex: `\\Delta=${par(Bv)}^{2}-4\\cdot ${A}\\cdot ${par(C)}=${Bv * Bv}${cuatroAC < 0n ? '+' + -cuatroAC : '-' + cuatroAC}=${disc}`,
  });
  const menosB = Bv < 0n ? `-${envolver(Bv.toString())}` : `-${Bv}`;
  const dosA = 2n * A;
  if (disc === 0n) {
    pasos.push({ texto: 'Como Δ = 0, hay una sola solución (raíz doble): x = −b/(2a)', tex: `${x}=\\frac{${menosB}}{2\\cdot ${A}}` });
    const r = Q(-Bv, dosA);
    return fin(`${x}=${texQ(r)}`, [{ re: qNumero(r), im: 0 }], 'Calculá' + textoAprox([r], x));
  }
  const imag = disc < 0n;
  const ad = absB(disc);
  pasos.push({
    texto: imag ? 'Como Δ < 0, no hay soluciones reales. En los números complejos, aplicá la fórmula resolvente: x = (−b ± √Δ)/(2a)' : 'Como Δ > 0, hay dos soluciones. Aplicá la fórmula resolvente: x = (−b ± √Δ)/(2a)',
    tex: `${x}=\\frac{${menosB}\\pm\\sqrt{${disc}}}{2\\cdot ${A}}`,
  });
  const rexacta = raizEntera(ad, 2);
  if (rexacta !== null && !imag) {
    const s = rexacta;
    pasos.push({ texto: `Calculá: −b = ${fmtEnt(-Bv)}, √${disc} = ${s} y 2a = ${dosA}`, tex: `${x}=\\frac{${-Bv}\\pm ${s}}{${dosA}}` });
    const r1 = Q(-Bv + s, dosA);
    const r2 = Q(-Bv - s, dosA);
    const sep = `${x1}=\\frac{${-Bv}+${s}}{${dosA}}=${texQ(r1)},\\quad ${x2}=\\frac{${-Bv}-${s}}{${dosA}}=${texQ(r2)}`;
    pasos.push({ texto: 'Separá las dos soluciones: una con + y otra con −' + textoAprox([r1, r2], x), tex: sep });
    return {
      titulo: 'Resolver la ecuación',
      pasos,
      resultado: `${x1}=${texQ(r1)},\\quad ${x2}=${texQ(r2)}`,
      sol: { tipo: 'finitas', valores: [{ re: qNumero(r1), im: 0 }, { re: qNumero(r2), im: 0 }] },
    };
  }
  // √Δ irracional (o imaginaria)
  const { k, m } = extraerCuadrado(ad);
  const descr = imag ? `√(${fmtEnt(disc)}) = ${m === 1n ? (k === 1n ? '' : k) : (k === 1n ? '' : k) + '√' + m}${m === 1n ? '' : '·'}i` : `√${disc} = ${k === 1n ? '' : k}√${m}`;
  const simplificaRaiz = k !== 1n || imag;
  pasos.push({
    texto: `Calculá: −b = ${fmtEnt(-Bv)} y 2a = ${dosA}` + (simplificaRaiz ? `; además ${descr}` : ''),
    tex: `${x}=${texPM(-Bv, k, m, dosA, '\\pm', imag)}`,
  });
  let p = -Bv;
  let kk = k;
  let cc = dosA;
  const g = mcd(mcd(p, kk), cc);
  if (g > 1n) {
    p /= g;
    kk /= g;
    cc /= g;
    pasos.push({ texto: `Simplificá dividiendo todo por ${g}`, tex: `${x}=${texPM(p, kk, m, cc, '\\pm', imag)}` });
  }
  const t1 = texPM(p, kk, m, cc, '+', imag);
  const t2 = texPM(p, kk, m, cc, '-', imag);
  const re = Number(p) / Number(cc);
  const im = (Number(kk) * Math.sqrt(Number(m))) / Number(cc);
  const valores = imag ? [{ re, im }, { re, im: -im }] : [{ re: re + im, im: 0 }, { re: re - im, im: 0 }];
  const resultado = `${x1}=${t1},\\quad ${x2}=${t2}`;
  const texto = imag
    ? 'Separá las dos soluciones complejas (no hay soluciones reales)'
    : `Separá las dos soluciones. En decimal: ${x}₁ ≈ ${coma(redondear(valores[0].re))}; ${x}₂ ≈ ${coma(redondear(valores[1].re))}`;
  return fin(resultado, valores, texto);
}

function texImag(coef, m) {
  // coef·√m·i con coef > 0
  const a = qAbs(coef);
  let core = m === 1n ? 'i' : `\\sqrt{${m}}i`;
  if (a.n !== 1n) core = `${a.n}${core}`;
  return a.d === 1n ? core : `\\frac{${core}}{${a.d}}`;
}

// ───────────────────────── Sistemas 2×2 ─────────────────────────
// Entrada: \begin{cases} ecuación \\ ecuación \end{cases} (como la escribe MathLive).

const RE_SISTEMA = /^\s*\\begin\{cases\}([\s\S]*)\\end\{cases\}\s*$/;

function parsearSistema(latex) {
  const m = RE_SISTEMA.exec(latex);
  if (!m) return null;
  const partes = m[1]
    .split('\\\\')
    .map((t) => t.replace(/&/g, ' ').trim())
    .filter(Boolean);
  if (partes.length !== 2) noSop('el sistema tiene que tener dos ecuaciones');
  const ecs = partes.map((t) => {
    const p = parsear(t);
    if (p.tipo !== 'ecuacion') noSop('falta el igual');
    return p;
  });
  return { ecs, partes };
}

// Forma lineal { k: Q, letra: Q, ... }
const esConstLin = (l) => Object.keys(l).every((k) => k === 'k' || qCero(l[k]));
function escalarLin(a, q) {
  const r = {};
  for (const k of Object.keys(a)) r[k] = qMul(a[k], q);
  return r;
}
function sumaLin(a, b) {
  const r = { ...a };
  for (const k of Object.keys(b)) r[k] = r[k] ? qSum(r[k], b[k]) : b[k];
  return r;
}
function mulLin(a, b) {
  if (esConstLin(a)) return escalarLin(b, a.k);
  if (esConstLin(b)) return escalarLin(a, b.k);
  noSop('no es lineal');
}
function lin(n) {
  switch (n.t) {
    case 'num':
      return { k: n.v };
    case 'var':
      return { k: Q0, [n.n]: Q1 };
    case 'paren':
      return lin(n.e);
    case 'sum':
      return n.ts.reduce((acc, t) => sumaLin(acc, t.s > 0 ? lin(t.e) : escalarLin(lin(t.e), qNeg(Q1))), { k: Q0 });
    case 'neg':
      return escalarLin(lin(n.e), qNeg(Q1));
    case 'mixed':
      return { k: Q(n.w * n.b + n.a, n.b) };
    case 'imp':
      return n.fs.map(lin).reduce(mulLin);
    case 'chain': {
      let acc = lin(n.fs[0]);
      n.fs.slice(1).forEach((f, i) => {
        const l = lin(f);
        if (n.ops[i] === '\\div') {
          if (!esConstLin(l) || qCero(l.k)) noSop('división por una variable');
          acc = escalarLin(acc, qDiv(Q1, l.k));
        } else acc = mulLin(acc, l);
      });
      return acc;
    }
    case 'frac': {
      const d = lin(n.b);
      if (!esConstLin(d) || qCero(d.k)) noSop('variable en el denominador');
      return escalarLin(lin(n.a), qDiv(Q1, d.k));
    }
    case 'pow':
      if (!variables(n).size) return { k: valorExacto(n) };
      if (!variables(n.e).size && qIg(valorExacto(n.e), Q1)) return lin(n.b);
      noSop('no es lineal');
    // falls through
    default:
      noSop('no es lineal');
  }
}

function ordenVariables(latex) {
  const letras = [];
  for (const c of latex.replace(/\\[a-zA-Z]+/g, ' ')) if (/[a-z]/.test(c) && !letras.includes(c)) letras.push(c);
  return letras;
}

const ORDINAL = ['primera', 'segunda'];
const texSistema = (a, b) => `\\begin{cases}${a}\\\\${b}\\end{cases}`;

function texLin2(e, u, v) {
  let s = '';
  [
    [e.a, u],
    [e.b, v],
  ].forEach(([q, w]) => {
    if (qCero(q)) return;
    const abs = qAbs(q);
    s += (s ? (qSig(q) < 0 ? '-' : '+') : qSig(q) < 0 ? '-' : '') + (qIg(abs, Q1) ? '' : texQ(abs)) + w;
  });
  return `${s || '0'}=${texQ(e.c)}`;
}
// p + q·w (constante primero)
function texPQ(p, q, w) {
  let s = qCero(p) ? '' : texQ(p);
  if (!qCero(q)) {
    const abs = qAbs(q);
    s += (qSig(q) < 0 ? '-' : s ? '+' : '') + (qIg(abs, Q1) ? '' : texQ(abs)) + w;
  }
  return s || '0';
}
const parenSiNeg = (q) => (qSig(q) < 0 ? envolver(texQ(q)) : texQ(q));
function texPQnum(p, q, w0) {
  let s = qCero(p) ? '' : texQ(p);
  if (!qCero(q)) {
    const abs = qAbs(q);
    s += (qSig(q) < 0 ? '-' : s ? '+' : '') + (qIg(abs, Q1) ? parenSiNeg(w0) : `${texQ(abs)}\\cdot ${parenSiNeg(w0)}`);
  }
  return s || '0';
}
const txtPQ = (p, q, w) => {
  let s = qCero(p) ? '' : txtQ(p);
  if (!qCero(q)) s += (qSig(q) < 0 ? ' − ' : s ? ' + ' : '') + (qIg(qAbs(q), Q1) ? '' : txtQ(qAbs(q))) + w;
  return s.trim() || '0';
};

function pasosSistema(sis, latex, ctx) {
  const enAST = new Set(sis.ecs.flatMap((e) => [...variables(e.izq), ...variables(e.der)]));
  const vars = ordenVariables(sis.partes.join(' '))
    .filter((c) => enAST.has(c))
    .sort();
  if (vars.length !== enAST.size) noSop('variables raras');
  if (vars.length !== 2 || vars.some((c) => c === 'e' || c === 'i')) noSop('el sistema tiene que tener dos incógnitas');
  const [u, v] = vars;
  const pasos = [{ texto: 'Partimos del sistema', tex: texSistema(...sis.ecs.map((e) => `${tex(e.izq)}=${tex(e.der)}`)) }];
  const agregar = (texto, t) => {
    if (sinColor(t) !== sinColor(pasos[pasos.length - 1].tex)) pasos.push({ texto, tex: t });
  };
  let E = sis.ecs.map((e) => {
    const l = sumaLin(lin(e.izq), escalarLin(lin(e.der), qNeg(Q1)));
    for (const k of Object.keys(l)) if (k !== 'k' && k !== u && k !== v && !qCero(l[k])) noSop('otra variable');
    return { a: l[u] || Q0, b: l[v] || Q0, c: qNeg(l.k) };
  });
  if (E.some((e) => qCero(e.a) && qCero(e.b))) noSop('una ecuación no tiene incógnitas');
  if ((qCero(E[0].a) && qCero(E[1].a)) || (qCero(E[0].b) && qCero(E[1].b))) noSop('falta una incógnita');
  const sistemaTex = () => texSistema(texLin2(E[0], u, v), texLin2(E[1], u, v));
  agregar(`Ordená cada ecuación: las incógnitas a la izquierda y el número a la derecha`, sistemaTex());
  if (E.some((e) => ![e.a, e.b, e.c].every(qEnt))) {
    const mults = E.map((e) => [e.a, e.b, e.c].reduce((L, q) => mcm(L, q.d), 1n));
    E = E.map((e, i) => ({ a: qMul(e.a, Q(mults[i])), b: qMul(e.b, Q(mults[i])), c: qMul(e.c, Q(mults[i])) }));
    const desc = mults.map((m, i) => (m > 1n ? `la ${ORDINAL[i]} por ${m}` : null)).filter(Boolean);
    agregar(`Sacá las fracciones: multiplicá ${desc.join(' y ')}`, sistemaTex());
  }
  const [e1, e2] = E;
  const det = qSum(qMul(e1.a, e2.b), qNeg(qMul(e2.a, e1.b)));
  if (qCero(det)) {
    // Proporcionales: incompatible (sin solución) o indeterminado (infinitas, no lo mostramos)
    const k = !qCero(e1.a) ? qDiv(e2.a, e1.a) : qDiv(e2.b, e1.b);
    if (qIg(qMul(e1.c, k), e2.c)) noSop('sistema compatible indeterminado');
    const fin = 'Los coeficientes de las incógnitas son proporcionales pero los números no: el sistema no tiene solución (es incompatible)';
    pasos.push({ texto: fin, tex: 'S=\\varnothing' });
    return { titulo: 'Resolver el sistema', pasos, resultado: 'S=\\varnothing', sol: { tipo: 'ninguna' }, vars };
  }
  const x0 = qDiv(qSum(qMul(e1.c, e2.b), qNeg(qMul(e2.c, e1.b))), det);
  const y0 = qDiv(qSum(qMul(e1.a, e2.c), qNeg(qMul(e2.a, e1.c))), det);
  const valorDe = (w) => (w === u ? x0 : y0);
  const coef = (e, w) => (w === u ? e.a : e.b);

  // Resuelve una ecuación de una incógnita reutilizando el motor de ecuaciones.
  const resolverUna = (latexEc, w) => {
    const p = parsear(latexEc);
    const r = pasosEcuacion(p.izq, p.der, w);
    if (r) for (const paso of r.pasos.slice(1)) pasos.push(paso);
    if (r && r.sol.tipo !== 'finitas') noSop('caso degenerado');
  };
  // w = expr numérica: muestra la cuenta con el motor de aritmética.
  const calcular = (w, exprTex) => {
    const p = parsear(exprTex);
    const r = pasosAritmetica(p.e, ctx);
    if (r) for (const paso of r.pasos.slice(1)) pasos.push({ texto: paso.texto, tex: `${w}=${paso.tex}` });
  };

  let cand = null;
  E.forEach((e, i) => {
    for (const w of [u, v]) if (!cand && qIg(qAbs(coef(e, w)), Q1)) cand = { i, w };
  });
  if (cand) {
    // Sustitución
    const { i, w } = cand;
    const o = w === u ? v : u;
    const ei = E[i];
    const ej = E[1 - i];
    const cw = coef(ei, w);
    const p = qMul(cw, ei.c);
    const q = qNeg(qMul(cw, coef(ei, o)));
    pasos.push({ texto: `Despejá ${w} de la ${ORDINAL[i]} ecuación`, tex: `${w}=${texPQ(p, q, o)}` });
    const cwj = coef(ej, w);
    const coj = coef(ej, o);
    if (qCero(cwj)) {
      const t = texLin2(w === u ? { a: Q0, b: coj, c: ej.c } : { a: coj, b: Q0, c: ej.c }, u, v);
      pasos.push({ texto: `La ${ORDINAL[1 - i]} ecuación tiene sólo ${o}: resolvela`, tex: t });
      resolverUna(t, o);
    } else {
      const parte = `${qIg(cwj, Q1) ? '' : qIg(cwj, qNeg(Q1)) ? '-' : texQ(cwj)}${envolver(texPQ(p, q, o))}`;
      const resto = qCero(coj) ? '' : `${qSig(coj) < 0 ? '-' : '+'}${qIg(qAbs(coj), Q1) ? '' : texQ(qAbs(coj))}${o}`;
      const t = `${parte}${resto}=${texQ(ej.c)}`;
      pasos.push({ texto: `Reemplazá ${w} por ${txtPQ(p, q, o)} en la ${ORDINAL[1 - i]} ecuación`, tex: t });
      resolverUna(t, o);
    }
    const o0 = valorDe(o);
    if (!qCero(q)) {
      pasos.push({ texto: `Reemplazá ${o} = ${txtQ(o0)} en ${w} = ${txtPQ(p, q, o)}`, tex: `${w}=${texPQnum(p, q, o0)}` });
      calcular(w, texPQnum(p, q, o0));
    }
  } else {
    // Reducción (sumas y restas)
    const La = mcm(absB(e1.a.n), absB(e2.a.n));
    const Lb = mcm(absB(e1.b.n), absB(e2.b.n));
    const w = Lb <= La ? v : u;
    const o = w === u ? v : u;
    const L = w === u ? La : Lb;
    const m1 = Q(L / absB(coef(e1, w).n));
    const m2 = Q(L / absB(coef(e2, w).n));
    const S1 = { a: qMul(e1.a, m1), b: qMul(e1.b, m1), c: qMul(e1.c, m1) };
    const S2 = { a: qMul(e2.a, m2), b: qMul(e2.b, m2), c: qMul(e2.c, m2) };
    if (!qIg(m1, Q1) || !qIg(m2, Q1)) {
      const desc = [m1, m2].map((m, i) => (qIg(m, Q1) ? null : `la ${ORDINAL[i]} por ${txtQ(m)}`)).filter(Boolean);
      pasos.push({ texto: `Multiplicá ${desc.join(' y ')} para que los coeficientes de ${w} sean iguales en valor absoluto`, tex: texSistema(texLin2(S1, u, v), texLin2(S2, u, v)) });
    }
    const mismoSigno = qSig(coef(S1, w)) === qSig(coef(S2, w));
    const sg = mismoSigno ? qNeg(Q1) : Q1;
    const R = { a: qSum(S1.a, qMul(sg, S2.a)), b: qSum(S1.b, qMul(sg, S2.b)), c: qSum(S1.c, qMul(sg, S2.c)) };
    const tR = texLin2(R, u, v);
    pasos.push({ texto: mismoSigno ? `Restá las ecuaciones (la primera menos la segunda) para eliminar ${w}` : `Sumá las ecuaciones para eliminar ${w}`, tex: tR });
    resolverUna(tR, o);
    const o0 = valorDe(o);
    const k = qCero(coef(e1, w)) ? 1 : 0;
    const ek = E[k];
    const terminoW = `${qIg(coef(ek, w), Q1) ? '' : qIg(coef(ek, w), qNeg(Q1)) ? '-' : texQ(coef(ek, w))}${w}`;
    const co = coef(ek, o);
    const terminoO = qCero(co) ? '' : `${qSig(co) < 0 ? '-' : '+'}${qIg(qAbs(co), Q1) ? parenSiNeg(o0) : `${texQ(qAbs(co))}\\cdot ${parenSiNeg(o0)}`}`;
    const orden = w === u ? `${terminoW}${terminoO}` : `${terminoO.replace(/^\+/, '')}${terminoW.startsWith('-') ? '' : '+'}${terminoW}`;
    const t = `${orden}=${texQ(ek.c)}`;
    pasos.push({ texto: `Reemplazá ${o} = ${txtQ(o0)} en la ${ORDINAL[k]} ecuación`, tex: t });
    resolverUna(t, w);
  }
  const resultado = `${u}=${texQ(x0)},\\quad ${v}=${texQ(y0)}`;
  pasos.push({ texto: 'La solución del sistema es', tex: resultado });
  return { titulo: 'Resolver el sistema', pasos, resultado, sol: { tipo: 'finitas', valores: { [u]: x0, [v]: y0 } }, vars };
}

function guardaSistema(ce, sis, r, ctx) {
  return conAngulo(ce, ctx.angulo, () => {
    const muestras = [
      [0.37, -1.21],
      [2.3, 0.71],
      [-1.9, 3.3],
    ];
    for (let i = 0; i < 2; i++) {
      const [izqTex, derTex] = sis.partes[i].split('=');
      const lhs = ce.parse(izqTex);
      const rhs = ce.parse(derTex);
      const valor = (ex, a, b) => numCE(ex.subs({ [r.vars[0]]: ce.number(a), [r.vars[1]]: ce.number(b) })).re;
      for (const [a, b] of muestras) {
        const mio = evalNum2(sis.ecs[i].izq, r.vars, a, b) - evalNum2(sis.ecs[i].der, r.vars, a, b);
        if (!cerca(valor(lhs, a, b) - valor(rhs, a, b), mio, 1e-7)) return false;
      }
      if (r.sol.tipo === 'finitas') {
        const a = qNumero(r.sol.valores[r.vars[0]]);
        const b = qNumero(r.sol.valores[r.vars[1]]);
        if (!(Math.abs(valor(lhs, a, b) - valor(rhs, a, b)) < 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)))) return false;
      }
    }
    return true;
  });
}
const evalNum2 = (n, vars, a, b) => evalNum(n, { [vars[0]]: a, [vars[1]]: b }, 'rad');

// ───────────────────────── Verificación contra Compute Engine ─────────────────────────

function conAngulo(ce, angulo, fn) {
  const prev = ce.angularUnit;
  try {
    if (prev !== angulo) ce.angularUnit = angulo;
    return fn();
  } catch {
    return false;
  } finally {
    if (ce.angularUnit !== prev) ce.angularUnit = prev;
  }
}
const cerca = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
function numCE(expr) {
  const v = expr.N();
  return { re: typeof v.re === 'number' ? v.re : NaN, im: typeof v.im === 'number' ? v.im : 0 };
}

function guardaAritmetica(ce, latex, r, ctx) {
  return conAngulo(ce, ctx.angulo, () => {
    const v = numCE(ce.parse(latex));
    const mio = evalNum(r.final, 0, ctx.angulo);
    return cerca(v.re, mio) && Math.abs(v.im) < 1e-9;
  });
}

function guardaEcuacion(ce, latex, p, x, r, ctx) {
  return conAngulo(ce, ctx.angulo, () => {
    const partes = latex.split('=');
    if (partes.length !== 2) return false;
    const lhs = ce.parse(partes[0]);
    const rhs = ce.parse(partes[1]);
    const difCE = (v) => numCE(lhs.subs({ [x]: ce.number(v) })).re - numCE(rhs.subs({ [x]: ce.number(v) })).re;
    let comparados = 0;
    for (const x0 of [0.37, -1.73, 2.91, 5.13]) {
      const mio = evalNum(p.izq, x0, ctx.angulo) - evalNum(p.der, x0, ctx.angulo);
      const suyo = difCE(x0);
      if (!Number.isFinite(mio) && !Number.isFinite(suyo)) continue;
      if (!cerca(mio, suyo, 1e-7)) return false;
      comparados++;
    }
    if (comparados < 2) return false;
    if (r.sol.tipo === 'finitas') {
      for (const s of r.sol.valores) {
        if (s.im !== 0) continue;
        const d = difCE(s.re);
        if (!(Math.abs(d) < 1e-7 * Math.max(1, Math.abs(s.re) ** 2))) return false;
      }
    }
    return true;
  });
}

// ───────────────────────── API ─────────────────────────

export function generarPasos(latex, { ce, angulo = 'rad', verificar = true } = {}) {
  try {
    if (typeof latex !== 'string' || !latex.trim()) return null;
    const ctx = { angulo: angulo === 'deg' ? 'deg' : 'rad' };
    const sis = parsearSistema(latex);
    if (sis) {
      const r = pasosSistema(sis, latex, ctx);
      if (verificar && ce && !guardaSistema(ce, sis, r, ctx)) return null;
      return { titulo: r.titulo, pasos: r.pasos, resultado: r.resultado };
    }
    const p = parsear(latex);
    let r;
    if (p.tipo === 'expresion') {
      if (variables(p.e).size) return null;
      r = pasosAritmetica(p.e, ctx);
      if (r && verificar && ce && !guardaAritmetica(ce, latex, r, ctx)) return null;
    } else {
      const vs = new Set([...variables(p.izq), ...variables(p.der)]);
      if (vs.size !== 1) return null;
      const [x] = vs;
      r = pasosEcuacion(p.izq, p.der, x, ctx);
      if (r && verificar && ce && !guardaEcuacion(ce, latex, p, x, r, ctx)) return null;
    }
    if (!r || r.pasos.length < 2) return null;
    return { titulo: r.titulo, pasos: r.pasos, resultado: r.resultado };
  } catch (e) {
    if (e instanceof NoSoportado) return null;
    if (!verificar) throw e;
    return null;
  }
}
