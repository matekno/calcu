// Teclado numérico para los campos de las distribuciones en pantallas táctiles:
// el teclado del sistema en iPhone no tiene signo menos ni barra en modo decimal.
const TECLAS = [
  ['7', '8', '9', '/', '⌫'],
  ['4', '5', '6', '*', '('],
  ['1', '2', '3', '-', ')'],
  ['0', ',', '√', 'listo'],
];

export const esTactil = () => matchMedia('(pointer: coarse)').matches;

export function crearTecladoNum(contenedor, { alMostrar, alOcultar }) {
  let campo = null;

  const escribir = (t) => {
    if (!campo) return;
    const ini = campo.selectionStart ?? campo.value.length;
    const fin = campo.selectionEnd ?? campo.value.length;
    if (t === '⌫') {
      if (ini === fin && ini > 0) campo.setRangeText('', ini - 1, fin, 'end');
      else campo.setRangeText('', ini, fin, 'end');
    } else {
      const texto = { '*': '·', '√': 'raiz(' }[t] ?? t;
      campo.setRangeText(texto, ini, fin, 'end');
    }
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  };

  contenedor.replaceChildren();
  for (const fila of TECLAS) {
    for (const t of fila) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tecla${/[0-9,]/.test(t) ? '' : ' fn'}${t === 'listo' ? ' acento listo' : ''}`;
      b.textContent = t === 'listo' ? 'Listo' : t === '*' ? '×' : t === '/' ? '÷' : t === '-' ? '−' : t;
      b.setAttribute('aria-label', { '⌫': 'Borrar', '√': 'Raíz', listo: 'Listo' }[t] ?? t);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (t === 'listo') { campo?.dispatchEvent(new Event('change', { bubbles: true })); campo?.blur(); ocultar(); return; }
        escribir(t);
      });
      contenedor.append(b);
    }
  }

  const ocultar = () => {
    if (contenedor.hidden) return;
    contenedor.hidden = true;
    campo = null;
    alOcultar?.();
  };

  return {
    conectar(input) {
      if (!esTactil()) return;
      input.setAttribute('inputmode', 'none');
      input.addEventListener('focus', () => {
        campo = input;
        if (contenedor.hidden) { contenedor.hidden = false; alMostrar?.(contenedor.offsetHeight); }
        setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      });
      input.addEventListener('blur', () => {
        setTimeout(() => { if (document.activeElement?.tagName !== 'INPUT') ocultar(); }, 120);
      });
    },
    ocultar,
  };
}
