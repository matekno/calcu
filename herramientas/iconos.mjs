// Dibuja los PNG de los íconos a partir de iconos/icono.svg con Chrome headless.
import { readFileSync } from 'node:fs';
import { abrirChrome } from '../tests/ui/cdp.mjs';

const raiz = new URL('..', import.meta.url).pathname;
const svg = readFileSync(`${raiz}iconos/icono.svg`, 'utf8');
const chrome = await abrirChrome({ puerto: 9334 });
const t = await chrome.pestana();
const salidas = [
  ['icono-192.png', 192, false], ['icono-512.png', 512, false], ['apple-touch-icon.png', 180, true], ['icono-maskable-512.png', 512, true],
];
for (const [nombre, lado, sinBorde] of salidas) {
  await t.tamano(lado, lado, { escala: 1 });
  const contenido = sinBorde
    ? svg.replace('rx="112"', 'rx="0"').replace('<path d="M96', '<g transform="translate(51 51) scale(.8)"><path d="M96').replace('</svg>', '</g></svg>')
    : svg;
  const pagina = `<html><body style="margin:0;background:transparent">${contenido.replace('<svg ', `<svg width="${lado}" height="${lado}" `)}</body></html>`;
  await t.ir(`data:text/html;base64,${Buffer.from(pagina).toString('base64')}`, 300);
  await t.enviar('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await t.captura(`${raiz}iconos/${nombre}`, { clip: { x: 0, y: 0, width: lado, height: lado, scale: 1 } });
  console.log('ícono', nombre);
}
chrome.cerrar();
process.exit(0);
