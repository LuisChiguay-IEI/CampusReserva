/**
 * Genera el gráfico de latencias (p95 por operación vs. umbral del RNF) a partir de la última
 * medición real (docs/evidencias/metricas/metricas-ultima.json). Salida: SVG y PNG.
 * Uso: npm run grafico   (requiere haber ejecutado antes `npm run metricas`)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const DIR = path.join(__dirname, '..', 'docs', 'evidencias', 'metricas');
const datos = JSON.parse(fs.readFileSync(path.join(DIR, 'metricas-ultima.json'), 'utf8'));

const C = { superficie: '#ffffff', texto: '#0b0b0b', secundario: '#52514e', suave: '#8a8985', grilla: '#e6e5e1', serie: '#2a78d6' };
const FUENTE = "font-family='Segoe UI, system-ui, sans-serif'";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const filas = [
  { nombre: 'Confirmar reserva', detalle: '50 simultáneas × 5 rondas', p50: datos.reserva_concurrente.p50_ms, p95: datos.reserva_concurrente.p95_ms, umbral: 800, rnf: 'RNF-06' },
  { nombre: 'Consultar disponibilidad', detalle: '200 consultas, 20 concurrentes', p50: datos.consulta_disponibilidad.p50_ms, p95: datos.consulta_disponibilidad.p95_ms, umbral: 500, rnf: 'RNF-05' },
  { nombre: 'Iniciar sesión (scrypt)', detalle: '50 simultáneos', p50: datos.login.p50_ms, p95: datos.login.p95_ms, umbral: null, rnf: 'sin umbral' },
];

const ancho = 980;
const izquierda = 250;
const derecha = 120;
const arriba = 92;
const altoFila = 78;
const alto = arriba + filas.length * altoFila + 70;
const maximo = 1600;
const x = (v) => izquierda + (v / maximo) * (ancho - izquierda - derecha);
const t = (px, py, texto, o = {}) =>
  `<text x="${px}" y="${py}" font-size="${o.size || 13}" font-weight="${o.weight || 400}" text-anchor="${o.anchor || 'start'}" fill="${o.fill || C.texto}" ${FUENTE}>${esc(texto)}</text>`;

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Latencia p95 por operación">`;
s += `<rect width="${ancho}" height="${alto}" fill="${C.superficie}"/>`;
s += t(24, 34, 'Latencia p95 por operación (ms) frente al umbral de cada RNF', { size: 17, weight: 700 });
s += t(24, 58, `Medición real en entorno local · ${datos.entorno.procesos_servidor} procesos de servidor · ${datos.fecha_medicion.slice(0, 10)} · menor es mejor`, { size: 12.5, fill: C.secundario });

// Grilla y eje (recesivos)
for (let v = 0; v <= maximo; v += 400) {
  s += `<line x1="${x(v)}" y1="${arriba - 10}" x2="${x(v)}" y2="${arriba + filas.length * altoFila}" stroke="${C.grilla}" stroke-width="1"/>`;
  s += t(x(v), arriba + filas.length * altoFila + 20, `${v}`, { size: 11.5, anchor: 'middle', fill: C.suave });
}
s += t(x(maximo / 2), arriba + filas.length * altoFila + 42, 'milisegundos', { size: 11.5, anchor: 'middle', fill: C.suave });

filas.forEach((f, i) => {
  const yc = arriba + i * altoFila + altoFila / 2;
  const grosor = 22;
  const y0 = yc - grosor / 2;
  const x1 = x(f.p95);
  const r = 4;
  s += t(24, yc - 4, f.nombre, { weight: 600 });
  s += t(24, yc + 14, f.detalle, { size: 11.5, fill: C.secundario });
  // Barra con extremo de datos redondeado (4 px) y base recta.
  s += `<path d="M${izquierda},${y0} H${x1 - r} Q${x1},${y0} ${x1},${y0 + r} V${y0 + grosor - r} Q${x1},${y0 + grosor} ${x1 - r},${y0 + grosor} H${izquierda} Z" fill="${C.serie}"/>`;
  s += t(x1 + 8, yc + 5, `${f.p95.toLocaleString('es-CL')} ms`, { weight: 700 });
  s += t(x1 + 8, yc + 21, `p50 ${f.p50.toLocaleString('es-CL')} ms`, { size: 11, fill: C.secundario });
  if (f.umbral) {
    const xu = x(f.umbral);
    s += `<line x1="${xu}" y1="${y0 - 10}" x2="${xu}" y2="${y0 + grosor + 10}" stroke="${C.texto}" stroke-width="2" stroke-dasharray="4 3"/>`;
    s += t(xu + 6, y0 - 2, `umbral ${f.rnf}: ${f.umbral} ms`, { size: 11, fill: C.secundario });
  } else {
    s += t(x1 + 8, y0 - 4, 'sin umbral definido', { size: 11, fill: C.secundario });
  }
});
s += `<line x1="${izquierda}" y1="${arriba - 10}" x2="${izquierda}" y2="${arriba + filas.length * altoFila}" stroke="${C.secundario}" stroke-width="1"/>`;
s += '</svg>';

async function main() {
  fs.writeFileSync(path.join(DIR, 'latencias-p95.svg'), s);
  const navegador = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const pagina = await navegador.newPage({ deviceScaleFactor: 2 });
    await pagina.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${s}</body></html>`);
    await pagina.locator('svg').screenshot({ path: path.join(DIR, 'latencias-p95.png') });
    console.log('✓ latencias-p95.png');
  } finally {
    await navegador.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
