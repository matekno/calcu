// Gráfico de la densidad (o de las barras de la discreta) con la zona sombreada, en canvas.
import { numTexto } from '../formato.js';

function color(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function marcasLindas(lo, hi, cantidad = 6) {
  const rango = hi - lo;
  if (!(rango > 0)) return [lo];
  const paso0 = rango / cantidad;
  const pot = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => rango / p <= cantidad) ?? 10 * pot;
  const marcas = [];
  for (let v = Math.ceil(lo / paso) * paso; v <= hi + paso * 1e-9; v += paso) marcas.push(Math.abs(v) < paso * 1e-9 ? 0 : v);
  return marcas;
}

const etiquetaEje = (v) => numTexto(Number(v.toPrecision(6)), { sig: 6 });

// Dentro de la zona sombreada según el modo.
export function dentro(v, { modo, x, a, b }) {
  if (modo === 'izq') return v <= x;
  if (modo === 'der') return v >= x;
  if (modo === 'entre') return v >= a && v <= b;
  return v <= a || v >= b;
}

export function crearGrafico(canvas, { alMover }) {
  let ultimo = null;
  let escala = null;

  const dibujar = (datos) => {
    ultimo = datos;
    const { dist, params, modo, x, a, b, prob } = datos;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const cTexto = color('--suave'), cCurva = color('--curva'), cArea = color('--area'), cAcento = color('--acento'), cRejilla = color('--rejilla'), cTenue = color('--tenue');
    const fuente = getComputedStyle(document.body).fontFamily;

    let [lo, hi] = dist.rango(params);
    const [sLo, sHi] = dist.soporte(params);
    const cortes = (modo === 'izq' || modo === 'der') ? [x] : [a, b];
    for (const c of cortes) {
      if (!Number.isFinite(c)) continue;
      const ancho = hi - lo;
      if (c < lo && c >= sLo) lo = Math.max(sLo, Math.max(c - 0.08 * ancho, lo - 0.6 * ancho));
      if (c > hi && c <= sHi) hi = Math.min(sHi, Math.min(c + 0.08 * ancho, hi + 0.6 * ancho));
    }
    if (dist.discreta) { lo = Math.floor(lo); hi = Math.ceil(hi); }

    const m = { izq: 14, der: 14, arr: 26, aba: 30 };
    const anchoUtil = W - m.izq - m.der, altoUtil = H - m.arr - m.aba;
    const desde = dist.discreta ? lo - 0.6 : lo, hasta = dist.discreta ? hi + 0.6 : hi;
    const px = (v) => m.izq + ((v - desde) / (hasta - desde)) * anchoUtil;
    const vx = (p) => desde + ((p - m.izq) / anchoUtil) * (hasta - desde);
    escala = { vx, discreta: dist.discreta, sLo, sHi };

    // Valores
    let puntos = [];
    if (dist.discreta) {
      for (let k = lo; k <= hi; k++) puntos.push([k, dist.pdf(k, params)]);
    } else {
      const N = Math.max(200, Math.min(700, Math.round(anchoUtil * 1.5)));
      for (let i = 0; i <= N; i++) {
        const v = lo + ((hi - lo) * i) / N;
        puntos.push([v, dist.pdf(v, params)]);
      }
    }
    const finitos = puntos.map((p) => p[1]).filter((y) => Number.isFinite(y)).sort((u, w) => u - w);
    let ymax = finitos.at(-1) ?? 1;
    // Densidades que se van a infinito (χ² con ν < 2, Beta con α < 1): recorte para que se vea el resto.
    const p95 = finitos[Math.floor(finitos.length * 0.95)] ?? ymax;
    if (!dist.discreta && ymax > 4 * p95) ymax = 2.2 * p95;
    if (!(ymax > 0)) ymax = 1;
    const py = (y) => m.arr + altoUtil - (Math.min(y, ymax * 1.05) / (ymax * 1.05)) * altoUtil;

    // Rejilla y eje
    g.font = `12px ${fuente}`;
    g.strokeStyle = cRejilla;
    g.lineWidth = 1;
    const marcas = dist.discreta ? marcasLindas(lo, hi, Math.min(10, hi - lo + 1)).filter((v) => Number.isInteger(v)) : marcasLindas(lo, hi);
    g.fillStyle = cTexto;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (const v of marcas) {
      const X = px(v);
      g.beginPath(); g.moveTo(X, m.arr); g.lineTo(X, m.arr + altoUtil); g.stroke();
      g.fillText(etiquetaEje(v), X, m.arr + altoUtil + 7);
    }
    g.strokeStyle = cTenue;
    g.beginPath(); g.moveTo(m.izq, m.arr + altoUtil + 0.5); g.lineTo(W - m.der, m.arr + altoUtil + 0.5); g.stroke();

    // Zona y curva
    if (dist.discreta) {
      const anchoBarra = Math.max(1, Math.min(28, (anchoUtil / (hi - lo + 1)) * 0.72));
      for (const [k, y] of puntos) {
        const X = px(k);
        const sombra = dentro(k, { modo, x, a, b });
        g.fillStyle = sombra ? cAcento : cTenue;
        g.globalAlpha = sombra ? 0.95 : 0.45;
        g.fillRect(X - anchoBarra / 2, py(y), anchoBarra, m.arr + altoUtil - py(y));
      }
      g.globalAlpha = 1;
    } else {
      g.fillStyle = cArea;
      const tramos = (modo === 'colas') ? [[lo, a], [b, hi]] : modo === 'izq' ? [[lo, x]] : modo === 'der' ? [[x, hi]] : [[a, b]];
      for (let [t0, t1] of tramos) {
        t0 = Math.max(t0, lo); t1 = Math.min(t1, hi);
        if (!(t1 > t0)) continue;
        g.beginPath();
        g.moveTo(px(t0), py(0));
        const N = 220;
        for (let i = 0; i <= N; i++) {
          const v = t0 + ((t1 - t0) * i) / N;
          const y = dist.pdf(v, params);
          g.lineTo(px(v), py(Number.isFinite(y) ? y : ymax * 2));
        }
        g.lineTo(px(t1), py(0));
        g.closePath();
        g.fill();
      }
      g.strokeStyle = cCurva;
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.beginPath();
      let empezado = false;
      for (const [v, y] of puntos) {
        if (!Number.isFinite(y)) { empezado = false; continue; }
        if (!empezado) { g.moveTo(px(v), py(y)); empezado = true; } else g.lineTo(px(v), py(y));
      }
      g.stroke();
    }

    // Líneas de corte con su valor
    g.strokeStyle = cAcento;
    g.fillStyle = cAcento;
    g.lineWidth = 1.5;
    g.font = `600 12px ${fuente}`;
    g.textBaseline = 'bottom';
    for (const c of cortes) {
      if (!Number.isFinite(c) || c < desde || c > hasta) continue;
      const X = px(c);
      g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(X, m.arr - 4); g.lineTo(X, m.arr + altoUtil); g.stroke();
      g.setLineDash([]);
      g.textAlign = X < 40 ? 'left' : X > W - 40 ? 'right' : 'center';
      g.fillText(etiquetaEje(c), X, m.arr - 6);
    }

    // Probabilidad sombreada
    if (Number.isFinite(prob)) {
      g.font = `700 14px ${fuente}`;
      g.textAlign = 'right';
      g.textBaseline = 'top';
      g.fillStyle = cTexto;
      g.fillText(`P = ${numTexto(prob, { sig: 6 })}`, W - m.der, 4);
    }
  };

  // Arrastrar sobre el gráfico mueve el corte más cercano.
  let arrastrando = false;
  const mover = (e) => {
    if (!escala || !ultimo) return;
    const r = canvas.getBoundingClientRect();
    let v = escala.vx(e.clientX - r.left);
    if (escala.discreta) v = Math.round(v);
    v = Math.min(Math.max(v, escala.sLo), escala.sHi);
    if (!escala.discreta) v = Number(v.toPrecision(4));
    let cual = 'x';
    if (ultimo.modo === 'entre' || ultimo.modo === 'colas') cual = Math.abs(v - ultimo.a) <= Math.abs(v - ultimo.b) ? 'a' : 'b';
    alMover(cual, v);
  };
  canvas.addEventListener('pointerdown', (e) => { arrastrando = true; canvas.setPointerCapture(e.pointerId); mover(e); });
  canvas.addEventListener('pointermove', (e) => { if (arrastrando) mover(e); });
  const soltar = () => { arrastrando = false; };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  new ResizeObserver(() => { if (ultimo) dibujar(ultimo); }).observe(canvas);
  return { dibujar, redibujar: () => ultimo && dibujar(ultimo) };
}
