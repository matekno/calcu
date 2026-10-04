// Recorrido de la calculadora en Chrome headless: teclas, resultado, pasos y consola sin errores.
import { abrirChrome } from './cdp.mjs';

const URL_APP = process.argv[2] ?? 'http://localhost:8790/';
const chrome = await abrirChrome({ puerto: 9344 });
let ok = true;
const chequear = (nombre, cond, detalle = '') => { console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre} ${detalle}`); ok &&= cond; };
try {
  const t = await chrome.pestana();
  await t.tamano(390, 844, { movil: true });
  await t.ir(URL_APP, 2000);
  await t.eval('document.getElementById("tab-calc").click()');
  const tecla = (aria) => t.eval(`(() => { const b = [...document.querySelectorAll('#teclado .tecla, #teclado .tab')].find(b => (b.getAttribute('aria-label') ?? b.textContent) === ${JSON.stringify(aria)} || b.textContent === ${JSON.stringify(aria)}); if (!b) return false; if (b.classList.contains('tab')) { b.click(); return true; } b.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true})); b.dispatchEvent(new PointerEvent('pointerup', {bubbles: true})); return true; })()`);
  const resolver = async () => { await tecla('Resolver'); await t.esperar(1500); };
  const solucion = () => t.eval('document.querySelector(".sol-principal")?.textContent ?? document.querySelector(".sol-error")?.textContent ?? ""');
  const cantPasos = () => t.eval('document.querySelectorAll(".tarjeta-pasos .paso").length');
  const volver = async () => { await t.eval('history.state?.solucion ? history.back() : null'); await t.esperar(300); await t.eval('document.getElementById("btn-limpiar").click()'); };

  // Sistema con la tecla
  await tecla('∫');
  chequear('tecla de sistema', await tecla('Sistema de ecuaciones'));
  await tecla('123');
  for (const k of ['x', 'Sumar', 'y', 'Igual (ecuación)', '3', 'Mover a la derecha', 'x', 'Restar', 'y', 'Igual (ecuación)', '1']) await tecla(k);
  const valor = await t.eval('document.getElementById("mf").value');
  chequear('el sistema se escribe', /begin\{cases\}x\+y=3\\\\ ?x-y=1\\end\{cases\}/.test(valor), valor);
  await resolver();
  chequear('sistema resuelto', (await solucion()).includes('x=2') && (await solucion()).includes('y=1'), await solucion());
  chequear('sistema con pasos', (await cantPasos()) > 1, `(${await cantPasos()})`);
  await volver();

  const casos = [
    ['\\frac34\\div\\frac98', '2', true],
    ['3\\left(x-2\\right)=2\\left(x+1\\right)', 'x=8', true],
    ['x^2-2x-1=0', '2', true],
    ['\\sqrt{72}', '6√2', true],
    ['\\sin\\left(30\\degree\\right)+\\cos\\left(60\\degree\\right)', '1', true],
    ['\\frac{d}{dx}\\left(x^3\\right)', '3x', false],
    ['\\int_0^1x^2\\,dx', '31', false],
  ];
  for (const [latex, contiene, conPasos] of casos) {
    await t.eval(`(() => { const mf = document.getElementById('mf'); mf.value = ${JSON.stringify(latex)}; mf.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    await t.esperar(200);
    await resolver();
    const sol = (await solucion()).replace(/\s|​/g, '');
    const n = await cantPasos();
    chequear(latex, sol.includes(contiene) && (conPasos ? n > 1 : true), `→ ${sol} (${n} pasos)`);
    await volver();
  }
  const errores = t.consola.filter((l) => /error|excepción/i.test(l));
  chequear('consola sin errores', errores.length === 0, errores.join(' | '));
} finally {
  chrome.cerrar();
  process.exit(ok ? 0 : 1);
}
