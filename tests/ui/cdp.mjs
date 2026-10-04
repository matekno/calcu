// Chrome headless por CDP (sin tomar la pantalla): abrir páginas, evaluar JS, tocar y sacar capturas.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirChrome({ puerto = 9333 } = {}) {
  const perfil = mkdtempSync(join(tmpdir(), 'calcu-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/json/version`);
      if (r.ok) break;
    } catch { /* todavía no */ }
    await esperar(100);
  }
  return {
    async pestana() {
      const r = await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: 'PUT' });
      const { webSocketDebuggerUrl } = await r.json();
      return conectar(webSocketDebuggerUrl);
    },
    cerrar() { proc.kill('SIGKILL'); },
  };
}

async function conectar(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pendientes = new Map();
  const consola = [];
  const eventos = new Map();
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pendientes.has(m.id)) {
      const { r, j } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? j(new Error(m.error.message)) : r(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      consola.push(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consola.push(`[excepción] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    } else if (m.method === 'Log.entryAdded') {
      consola.push(`[${m.params.entry.level}] ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
    }
    eventos.get(m.method)?.forEach((f) => f(m.params));
  };
  const enviar = (method, params = {}) => new Promise((r, j) => {
    const n = ++id;
    pendientes.set(n, { r, j });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await enviar('Runtime.enable');
  await enviar('Page.enable');
  await enviar('Log.enable');
  const t = {
    consola,
    enviar,
    async tamano(ancho, alto, { movil = false, escala = 2 } = {}) {
      await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: escala, mobile: movil });
      await enviar('Emulation.setTouchEmulationEnabled', movil ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    },
    async ir(url, espera = 1500) {
      const cargado = new Promise((r) => { eventos.set('Page.loadEventFired', [r]); });
      await enviar('Page.navigate', { url });
      await cargado;
      await esperar(espera);
    },
    async eval(expr) {
      const r = await enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async captura(archivo, opciones = {}) {
      const r = await enviar('Page.captureScreenshot', { format: 'png', ...opciones });
      writeFileSync(archivo, Buffer.from(r.data, 'base64'));
    },
    async tocar(selector) {
      const caja = await t.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await enviar('Input.dispatchMouseEvent', { type, x: caja.x, y: caja.y, button: 'left', clickCount: 1 });
      }
      await esperar(60);
    },
    async teclear(texto) {
      await enviar('Input.insertText', { text: texto });
      await esperar(50);
    },
    // Tecleo real (keydown con texto), como un teclado físico.
    async escribirTeclas(texto) {
      for (const ch of texto) {
        const code = /[a-z]/i.test(ch) ? `Key${ch.toUpperCase()}` : /\d/.test(ch) ? `Digit${ch}` : '';
        await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, code, text: ch, unmodifiedText: ch });
        await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code });
        await esperar(25);
      }
    },
    async tecla(key, code = key, keyCode = 0) {
      await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
      await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
      await esperar(50);
    },
    esperar,
  };
  return t;
}
