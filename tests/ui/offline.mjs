// La app tiene que andar entera sin red después de la primera visita (calculadora, worker y distribuciones).
import { abrirChrome } from './cdp.mjs';

const URL_APP = process.argv[2] ?? 'http://localhost:8790/';
const chrome = await abrirChrome({ puerto: 9340 });
let ok = true;
const chequear = (nombre, cond, detalle = '') => { console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre} ${detalle}`); ok &&= cond; };
try {
  const t = await chrome.pestana();
  await t.tamano(390, 844, { movil: true });
  await t.ir(URL_APP, 1500);
  const listo = await t.eval(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
    return Boolean(navigator.serviceWorker.controller);
  })()`);
  chequear('service worker controla la página', listo);
  await t.enviar('Network.enable');
  await t.enviar('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await t.ir(URL_APP, 2500);
  chequear('carga sin red', await t.eval('Boolean(document.getElementById("mf") && customElements.get("math-field"))'));
  await t.eval(`(() => { const mf = document.getElementById('mf'); mf.value = '\\\\frac{1}{2}+\\\\frac{1}{3}'; mf.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  await t.esperar(1500);
  const previa = await t.eval('document.getElementById("previa").textContent');
  chequear('el worker calcula sin red', previa.includes('5') && previa.includes('6'), JSON.stringify(previa));
  await t.eval(`document.querySelector('#teclado [aria-label="Resolver"]').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}))`);
  await t.esperar(2000);
  const pasos = await t.eval('document.querySelectorAll(".tarjeta-pasos .paso").length');
  chequear('pasos sin red', pasos > 0, `(${pasos} pasos)`);
  await t.eval('document.getElementById("tab-dist").click()');
  await t.esperar(1500);
  const res = await t.eval('document.getElementById("dist-resultado").innerText');
  chequear('distribuciones sin red', /0,95/.test(res), JSON.stringify(res.slice(0, 60)));
  const fuentes = await t.eval(`document.fonts.check('20px KaTeX_Main')`);
  chequear('fuentes de las fórmulas sin red', fuentes);
  if (t.consola.length) console.log(t.consola.join('\n'));
} finally {
  chrome.cerrar();
  process.exit(ok ? 0 : 1);
}
