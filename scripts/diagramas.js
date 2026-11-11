/**
 * Genera los diagramas UML del informe como SVG (fuente versionable) y PNG.
 *
 * Los diagramas se describen con primitivas UML mínimas (componentes, nodos, actores, casos de uso,
 * clases, líneas de vida y mensajes) y se exportan a PNG con playwright-core + Microsoft Edge.
 * Reflejan la arquitectura REALMENTE implementada en este repositorio.
 * Uso: npm run diagramas  ->  docs/diagramas/*.svg y *.png
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const DESTINO = path.join(__dirname, '..', 'docs', 'diagramas');
const COLOR = { borde: '#1e3a8a', relleno: '#f5f8ff', texto: '#1c2430', suave: '#5a6576', acento: '#0f766e', propuesto: '#8a94a6' };
const FUENTE = "font-family='Segoe UI, system-ui, sans-serif'";

// ------------------------------------------------------------------ primitivas

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function t(x, y, texto, { size = 13, weight = 400, anchor = 'start', fill = COLOR.texto, italic = false } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}"${italic ? " font-style='italic'" : ''} ${FUENTE}>${esc(texto)}</text>`;
}

const DEFS = `<defs>
  <marker id="abierta" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
    <path d="M1,1 L11,6 L1,11" fill="none" stroke="${COLOR.texto}" stroke-width="1.4"/></marker>
  <marker id="llena" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
    <path d="M1,1 L11,6 L1,11 Z" fill="${COLOR.texto}"/></marker>
  <marker id="hueca" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" orient="auto-start-reverse">
    <path d="M1,1 L13,7 L1,13 Z" fill="#fff" stroke="${COLOR.texto}" stroke-width="1.3"/></marker>
</defs>`;

function linea(puntos, { marcador = 'abierta', punteada = false, color = COLOR.texto, ancho = 1.4 } = {}) {
  const d = puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}"${punteada ? " stroke-dasharray='6 4'" : ''}${marcador ? ` marker-end="url(#${marcador})"` : ''}/>`;
}

function etiqueta(x, y, texto, opciones = {}) {
  const ancho = texto.length * 6.6 + 10;
  const anchor = opciones.anchor || 'middle';
  const x0 = anchor === 'middle' ? x - ancho / 2 : anchor === 'end' ? x - ancho : x;
  return `<rect x="${x0}" y="${y - 13}" width="${ancho}" height="18" fill="#fff" opacity="0.92"/>` + t(x, y, texto, { size: 12, anchor, fill: COLOR.suave, ...opciones });
}

function componente({ x, y, w, h, titulo, estereotipo = 'component', lineas = [], relleno = COLOR.relleno, punteado = false, color = COLOR.borde }) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${relleno}" stroke="${color}" stroke-width="1.5"${punteado ? " stroke-dasharray='7 4'" : ''}/>`;
  // Ícono UML de componente
  s += `<rect x="${x + w - 26}" y="${y + 8}" width="16" height="20" fill="#fff" stroke="${color}" stroke-width="1.2"/>`;
  s += `<rect x="${x + w - 30}" y="${y + 12}" width="8" height="4" fill="#fff" stroke="${color}" stroke-width="1.2"/>`;
  s += `<rect x="${x + w - 30}" y="${y + 20}" width="8" height="4" fill="#fff" stroke="${color}" stroke-width="1.2"/>`;
  s += t(x + 12, y + 20, `«${estereotipo}»`, { size: 11, italic: true, fill: COLOR.suave });
  s += t(x + 12, y + 38, titulo, { weight: 700 });
  lineas.forEach((l, i) => { s += t(x + 12, y + 57 + i * 17, l, { size: 12, fill: COLOR.suave }); });
  return s;
}

function contenedor({ x, y, w, h, titulo, estereotipo, punteado = false, color = COLOR.borde }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${color}" stroke-width="1.6"${punteado ? " stroke-dasharray='8 5'" : ''}/>` +
    (estereotipo ? t(x + 14, y + 20, `«${estereotipo}»`, { size: 11, italic: true, fill: COLOR.suave }) : '') +
    t(x + 14, y + (estereotipo ? 38 : 24), titulo, { weight: 700, size: 14, fill: color });
}

function nodo({ x, y, w, h, titulo, estereotipo, lineas = [], punteado = false, color = COLOR.borde, relleno = '#fff' }) {
  const d = 12;
  const dash = punteado ? " stroke-dasharray='7 4'" : '';
  let s = `<polygon points="${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}" fill="#e9eef9" stroke="${color}" stroke-width="1.4"${dash}/>`;
  s += `<polygon points="${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}" fill="#dfe6f5" stroke="${color}" stroke-width="1.4"${dash}/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${relleno}" stroke="${color}" stroke-width="1.4"${dash}/>`;
  s += t(x + 12, y + 20, `«${estereotipo}»`, { size: 11, italic: true, fill: COLOR.suave });
  s += t(x + 12, y + 38, titulo, { weight: 700, fill: color === COLOR.propuesto ? COLOR.suave : COLOR.texto });
  lineas.forEach((l, i) => { s += t(x + 12, y + 57 + i * 17, l, { size: 12, fill: COLOR.suave }); });
  return s;
}

function artefacto({ x, y, w, h, titulo, lineas = [], estereotipo = 'artifact', punteado = false, color = COLOR.borde }) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${COLOR.relleno}" stroke="${color}" stroke-width="1.3"${punteado ? " stroke-dasharray='7 4'" : ''}/>`;
  s += `<path d="M${x + w - 22},${y + 7} h10 l6,6 v14 h-16 Z M${x + w - 12},${y + 7} v6 h6" fill="#fff" stroke="${color}" stroke-width="1.1"/>`;
  s += t(x + 10, y + 18, `«${estereotipo}»`, { size: 11, italic: true, fill: COLOR.suave });
  s += t(x + 10, y + 36, titulo, { weight: 700, size: 12.5 });
  lineas.forEach((l, i) => { s += t(x + 10, y + 53 + i * 16, l, { size: 11.5, fill: COLOR.suave }); });
  return s;
}

function cilindro({ x, y, w, h, titulo, lineas = [] }) {
  const ry = 12;
  let s = `<path d="M${x},${y + ry} v${h - 2 * ry} a${w / 2},${ry} 0 0 0 ${w},0 v${-(h - 2 * ry)}" fill="${COLOR.relleno}" stroke="${COLOR.borde}" stroke-width="1.5"/>`;
  s += `<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="#e3eafb" stroke="${COLOR.borde}" stroke-width="1.5"/>`;
  s += t(x + w / 2, y + 44, '«database»', { size: 11, italic: true, fill: COLOR.suave, anchor: 'middle' });
  s += t(x + w / 2, y + 62, titulo, { weight: 700, anchor: 'middle' });
  lineas.forEach((l, i) => { s += t(x + w / 2, y + 81 + i * 16, l, { size: 11.5, fill: COLOR.suave, anchor: 'middle' }); });
  return s;
}

function actor({ x, y, nombre }) {
  const c = COLOR.texto;
  return `<circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="${c}" stroke-width="1.6"/>` +
    `<path d="M${x},${y + 11} v26 M${x - 18},${y + 20} h36 M${x},${y + 37} l-15,24 M${x},${y + 37} l15,24" stroke="${c}" stroke-width="1.6" fill="none"/>` +
    t(x, y + 80, nombre, { anchor: 'middle', weight: 600 });
}

function casoUso({ cx, cy, rx = 120, ry = 30, lineas }) {
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${COLOR.relleno}" stroke="${COLOR.borde}" stroke-width="1.5"/>`;
  const y0 = cy - ((lineas.length - 1) * 16) / 2 + 4;
  lineas.forEach((l, i) => { s += t(cx, y0 + i * 16, l, { anchor: 'middle', size: 12.5, weight: i === 0 ? 600 : 400, fill: i === 0 ? COLOR.texto : COLOR.suave }); });
  return s;
}

/** Clase UML con compartimento de atributos. Devuelve { svg, caja }. */
function clase({ x, y, w, nombre, atributos, estereotipo }) {
  const cab = estereotipo ? 44 : 30;
  const h = cab + atributos.length * 17 + 10;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${COLOR.borde}" stroke-width="1.5"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${cab}" fill="${COLOR.relleno}" stroke="${COLOR.borde}" stroke-width="1.5"/>`;
  if (estereotipo) s += t(x + w / 2, y + 17, `«${estereotipo}»`, { anchor: 'middle', size: 11, italic: true, fill: COLOR.suave });
  s += t(x + w / 2, y + (estereotipo ? 36 : 20), nombre, { anchor: 'middle', weight: 700 });
  atributos.forEach((a, i) => { s += t(x + 10, y + cab + 16 + i * 17, a, { size: 12 }); });
  return { svg: s, caja: { x, y, w, h } };
}

function documento(ancho, alto, titulo, cuerpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
${DEFS}
<rect width="${ancho}" height="${alto}" fill="#ffffff"/>
${t(20, 28, titulo, { size: 16, weight: 700, fill: COLOR.borde })}
${cuerpo}
</svg>`;
}

// ------------------------------------------------------------------ 1. Componentes

function diagramaComponentes() {
  const fila = (y, items) => items.map((it, i) => componente({ x: 250 + i * 178, y, w: 165, h: 82, ...it })).join('');
  const centros = [332, 510, 688, 866];
  // Rótulos de capa en vertical sobre el margen izquierdo del subsistema (no cruzan las flechas).
  const rotulos = [];
  const rotulo = (yCentro, texto) => {
    rotulos.push(`<text transform="rotate(-90 236 ${yCentro})" x="236" y="${yCentro}" font-size="11" font-weight="700" text-anchor="middle" fill="${COLOR.acento}" ${FUENTE}>${esc(texto)}</text>`);
    return '';
  };
  let c = '';
  c += componente({ x: 20, y: 120, w: 185, h: 96, titulo: 'Navegador web', estereotipo: 'cliente', lineas: ['Vistas HTML (EJS) + CSS', 'JS de mejora progresiva', 'Formularios con token CSRF'] });
  c += contenedor({ x: 218, y: 50, w: 752, h: 690, titulo: 'CampusReserva — Node.js 24 + Express 5', estereotipo: 'subsystem' });
  c += rotulo(148, 'Seguridad');
  c += componente({ x: 250, y: 120, w: 699, h: 80, titulo: 'Middleware de seguridad', lineas: ['Cabeceras (CSP, nosniff, DENY, no-store) · sesión del servidor · CSRF · carga de usuario', 'Autorización por rol (requiereRol) · límite de intentos (express-rate-limit) · manejador de errores'] });
  c += rotulo(285, 'Presentación');
  c += fila(244, [
    { titulo: 'rutas/cuentas', lineas: ['RF-01, RF-02', 'cierre de sesión'] },
    { titulo: 'rutas/reservas', lineas: ['RF-03, RF-04, RF-05'] },
    { titulo: 'rutas/administracion', lineas: ['RF-06, auditoría'] },
    { titulo: 'rutas/demo', lineas: ['Buzón de demostración', '(solo DEMO_MAILBOX)'] },
  ]);
  c += rotulo(421, 'Negocio');
  c += fila(380, [
    { titulo: 'Autenticación', estereotipo: 'service', lineas: ['registrar, confirmar', 'iniciarSesion (scrypt)'] },
    { titulo: 'Disponibilidad', estereotipo: 'service', lineas: ['consultar', 'calcularDisponibilidad'] },
    { titulo: 'Reservas', estereotipo: 'service', lineas: ['revisar, confirmar', 'listar, cancelar'] },
    { titulo: 'Administración', estereotipo: 'service', lineas: ['espacios, horarios', 'bloqueos, auditoría'] },
  ]);
  c += rotulo(557, 'Persistencia');
  c += rotulo(677, 'Común');
  c += fila(516, [
    { titulo: 'usuarios', estereotipo: 'repository', lineas: ['usuario, listado,', 'token, correo_demo'] },
    { titulo: 'espacios', estereotipo: 'repository', lineas: ['sede, espacio,', 'horario, bloqueo'] },
    { titulo: 'reservas', estereotipo: 'repository', lineas: ['reserva'] },
    { titulo: 'soporte', estereotipo: 'repository', lineas: ['sesion, auditoria'] },
  ]);
  c += componente({ x: 250, y: 640, w: 699, h: 74, titulo: 'Biblioteca común (src/lib)', estereotipo: 'library', lineas: ['validaciones (lista blanca) · seguridad (scrypt, tokens, comparación en tiempo constante) · fechas (America/Santiago) · errores'] });
  c += cilindro({ x: 1005, y: 500, w: 180, h: 150, titulo: 'SQLite (WAL)', lineas: ['data/campusreserva.db', '11 tablas', 'índice único parcial', 'ux_reserva_confirmada'] });

  c += linea([[205, 190], [250, 190]], { marcador: 'llena' });
  c += t(112, 238, 'Solicitudes HTTP', { anchor: 'middle', size: 12, fill: COLOR.suave });
  c += t(112, 254, '(GET y POST de formularios)', { anchor: 'middle', size: 12, fill: COLOR.suave });
  centros.forEach((cx) => {
    c += linea([[cx, 200], [cx, 244]]);
    c += linea([[cx, 326], [cx, 380]]);
    c += linea([[cx, 462], [cx, 516]]);
  });
  c += linea([[949, 557], [1005, 557]], { marcador: 'abierta' });
  c += etiqueta(1095, 486, 'node:sqlite · sentencias preparadas');
  c += linea([[960, 420], [990, 420], [990, 677], [949, 677]], { punteada: true });
  c += etiqueta(990, 412, '«use»');
  c += rotulos.join('');
  return documento(1210, 760, 'Diagrama de componentes — arquitectura en capas cliente-servidor (implementada)', c);
}

// ------------------------------------------------------------------ 2. Despliegue

function diagramaDespliegue() {
  let c = '';
  c += nodo({ x: 30, y: 250, w: 260, h: 150, titulo: 'Equipo del usuario', estereotipo: 'device', lineas: ['PC o teléfono'] });
  c += artefacto({ x: 50, y: 320, w: 220, h: 64, titulo: 'Navegador web', lineas: ['Edge / Chrome / Firefox'] });

  c += nodo({ x: 380, y: 70, w: 470, h: 300, titulo: 'Equipo de desarrollo (Windows 11) — entorno verificado', estereotipo: 'device' });
  c += nodo({ x: 405, y: 130, w: 410, h: 135, titulo: 'Node.js 24 LTS', estereotipo: 'execution environment', relleno: COLOR.relleno });
  c += artefacto({ x: 425, y: 183, w: 370, h: 68, titulo: 'campusreserva (src/server.js) — Express 5 + EJS', lineas: ['puerto 3000 · variables en .env'] });
  c += artefacto({ x: 405, y: 282, w: 410, h: 70, titulo: 'data/campusreserva.db', estereotipo: 'file', lineas: ['SQLite 3.53 en modo WAL · sesiones, reservas y auditoría'] });

  c += linea([[290, 300], [380, 220]], { marcador: null, ancho: 1.8 });
  c += etiqueta(335, 248, 'HTTP · localhost:3000');

  c += nodo({ x: 380, y: 440, w: 560, h: 220, titulo: 'Plataforma PaaS (propuesta, NO desplegada)', estereotipo: 'cloud PaaS', punteado: true, color: COLOR.propuesto, lineas: ['Proveedor por definir (ej.: Render, Railway, Azure App Service)'] });
  c += artefacto({ x: 405, y: 515, w: 250, h: 86, titulo: 'campusreserva', punteado: true, color: COLOR.propuesto, lineas: ['runtime Node.js administrado', 'NODE_ENV=production'] });
  c += artefacto({ x: 670, y: 515, w: 250, h: 86, titulo: 'Disco persistente / BD', estereotipo: 'storage', punteado: true, color: COLOR.propuesto, lineas: ['SQLite en volumen o', 'PostgreSQL gestionado (futuro)'] });
  c += t(405, 620, 'TLS en el proxy del proveedor · TRUST_PROXY=true · cookie __Host-, Secure · HSTS', { size: 12, fill: COLOR.suave });
  c += t(405, 640, 'Secretos (SESSION_SECRET) en variables del proveedor · DEMO_MAILBOX=false', { size: 12, fill: COLOR.suave });

  c += linea([[290, 360], [380, 520]], { marcador: null, punteada: true, color: COLOR.propuesto, ancho: 1.8 });
  c += etiqueta(330, 460, 'HTTPS (443)');

  c += `<rect x="900" y="80" width="290" height="120" rx="8" fill="#fbfcfe" stroke="#d9dfe8"/>`;
  c += t(915, 104, 'Convenciones', { weight: 700 });
  c += linea([[915, 128], [965, 128]], { marcador: null, ancho: 1.8 });
  c += t(975, 132, 'Implementado y probado', { size: 12 });
  c += linea([[915, 158], [965, 158]], { marcador: null, punteada: true, color: COLOR.propuesto, ancho: 1.8 });
  c += t(975, 162, 'Propuesto, no desplegado', { size: 12 });
  c += t(915, 188, 'Modelo cloud seleccionado: PaaS', { size: 12, weight: 600, fill: COLOR.acento });
  return documento(1210, 690, 'Diagrama de despliegue — entorno verificado y propuesta PaaS', c);
}

// ------------------------------------------------------------------ 3. Secuencia

function diagramaSecuencia() {
  const L = { act: 70, nav: 220, mw: 420, ruta: 610, serv: 820, db: 1070 };
  let c = '';
  const cabecera = (x, titulo, sub) =>
    `<rect x="${x - 85}" y="50" width="170" height="${sub ? 46 : 34}" rx="6" fill="${COLOR.relleno}" stroke="${COLOR.borde}" stroke-width="1.4"/>` +
    t(x, 72, titulo, { anchor: 'middle', weight: 700, size: 12.5 }) + (sub ? t(x, 89, sub, { anchor: 'middle', size: 11, fill: COLOR.suave }) : '');
  c += actor({ x: L.act, y: 52, nombre: '' }) + t(L.act, 132, 'Estudiante', { anchor: 'middle', weight: 600 });
  c += cabecera(L.nav, 'Navegador');
  c += cabecera(L.mw, 'Middleware', 'sesión · CSRF · rol');
  c += cabecera(L.ruta, 'rutas/reservas.js');
  c += cabecera(L.serv, 'Servicio de reservas', 'servicios/reservas.js');
  c += cabecera(L.db, 'SQLite', 'índice ux_reserva_confirmada');
  Object.values(L).forEach((x, i) => { c += linea([[x, i === 0 ? 140 : 96], [x, 880]], { marcador: null, punteada: true, color: '#9aa5b8', ancho: 1.2 }); });

  const act = (x, y1, y2) => `<rect x="${x - 6}" y="${y1}" width="12" height="${y2 - y1}" fill="#fff" stroke="${COLOR.borde}" stroke-width="1.2"/>`;
  c += act(L.mw, 205, 285) + act(L.ruta, 285, 840) + act(L.serv, 325, 815) + act(L.db, 360, 470);

  const msg = (de, a, y, texto, retorno = false) => {
    const izq = de < a;
    const x1 = de + (izq ? 6 : -6);
    const x2 = a + (izq ? -6 : 6);
    return linea([[x1, y], [x2, y]], { marcador: retorno ? 'abierta' : 'llena', punteada: retorno }) +
      t((x1 + x2) / 2, y - 7, texto, { anchor: 'middle', size: 12 });
  };
  c += msg(L.act, L.nav, 170, '1: Confirmar reserva');
  c += msg(L.nav, L.mw, 210, '2: POST /reservas (selección + token CSRF)');
  c += linea([[L.mw + 6, 235], [L.mw + 50, 235], [L.mw + 50, 258], [L.mw + 6, 258]], { marcador: 'llena' });
  c += t(L.mw + 56, 251, '3: valida sesión, token CSRF y rol', { size: 12 });
  c += msg(L.mw, L.ruta, 290, '4: next()');
  c += msg(L.ruta, L.serv, 330, '5: confirmar(usuario, datos)');
  c += msg(L.serv, L.db, 365, '6: BEGIN IMMEDIATE');
  c += msg(L.serv, L.db, 405, '7: SELECT espacio, horario, bloqueo, reserva');
  c += t((L.serv + L.db) / 2, 424, 'verificarReservable(): habilitado, día, no iniciado, libre', { anchor: 'middle', size: 11, fill: COLOR.suave });
  c += msg(L.db, L.serv, 452, 'filas', true);
  c += msg(L.serv, L.db, 495, '8: INSERT reserva (CONFIRMADA)');

  c += `<rect x="150" y="515" width="1000" height="345" fill="none" stroke="${COLOR.texto}" stroke-width="1.3"/>`;
  c += `<path d="M150,515 h44 l10,10 v12 h-54 Z" fill="${COLOR.relleno}" stroke="${COLOR.texto}" stroke-width="1.2"/>`;
  c += t(160, 531, 'alt', { weight: 700, size: 12 });
  c += t(215, 550, '[inserción aceptada]', { size: 12, weight: 600, fill: COLOR.acento });
  c += msg(L.db, L.serv, 575, 'id', true);
  c += msg(L.serv, L.db, 612, '9: INSERT auditoria (RESERVA_CREADA) · COMMIT');
  c += msg(L.serv, L.ruta, 650, '{ id, codigo }', true);
  c += msg(L.ruta, L.nav, 688, '10: 303 → /reservas/:id  «Reserva CR-… confirmada»', true);
  c += linea([[150, 712], [1150, 712]], { marcador: null, punteada: true, ancho: 1.2 });
  c += t(215, 734, '[otro proceso confirmó antes el mismo bloque y fecha: violación UNIQUE (2067)]', { size: 12, weight: 600, fill: '#b42318' });
  c += msg(L.db, L.serv, 760, 'error UNIQUE', true);
  c += msg(L.serv, L.db, 792, '9\': ROLLBACK');
  c += msg(L.serv, L.ruta, 822, 'ErrorConflicto (OCUPADO)', true);
  c += msg(L.ruta, L.nav, 850, '10\': 409 «Ese horario acaba de ser reservado por otra persona»', true);
  return documento(1210, 900, 'Diagrama de secuencia — confirmar reserva con control de concurrencia (ADR-001)', c);
}

// ------------------------------------------------------------------ 4. Casos de uso

function diagramaCasosUso() {
  let c = '';
  c += contenedor({ x: 270, y: 50, w: 660, h: 690, titulo: 'CampusReserva (MVP)' });
  const izq = 430;
  const der = 790;
  const centro = 610;
  const casos = [
    { cx: izq, cy: 120, lineas: ['Registrar usuario', 'RF-01'] },
    { cx: izq, cy: 200, lineas: ['Confirmar correo', 'RF-01 (enlace de un uso)'] },
    { cx: izq, cy: 280, lineas: ['Consultar disponibilidad', 'RF-03'] },
    { cx: izq, cy: 520, lineas: ['Reservar espacio', 'RF-04 (revisar y confirmar)'] },
    { cx: izq, cy: 600, lineas: ['Consultar mis reservas', 'RF-05'] },
    { cx: izq, cy: 690, lineas: ['Cancelar reserva', 'RF-05 (con confirmación)'] },
    { cx: centro, cy: 370, rx: 95, lineas: ['Iniciar sesión', 'RF-02'] },
    { cx: centro, cy: 445, rx: 95, lineas: ['Cerrar sesión', 'apoyo'] },
    { cx: der, cy: 130, rx: 125, lineas: ['Administrar espacios', 'RF-06'] },
    { cx: der, cy: 220, rx: 125, lineas: ['Gestionar horarios y bloqueos', 'RF-06'] },
    { cx: der, cy: 600, rx: 125, lineas: ['Consultar auditoría', 'soporte de seguridad'] },
  ];
  casos.forEach((k) => { c += casoUso({ rx: 125, ...k }); });

  const ua = { x: 150, y: 380 };
  c += actor({ x: ua.x, y: ua.y - 30, nombre: 'Usuario académico' });
  c += actor({ x: 75, y: 590, nombre: 'Estudiante' });
  c += actor({ x: 210, y: 590, nombre: 'Docente' });
  c += linea([[75, 578], [140, 452]], { marcador: 'hueca' });
  c += linea([[210, 578], [160, 452]], { marcador: 'hueca' });
  c += actor({ x: 1060, y: 340, nombre: 'Administrador' });

  const desde = [ua.x + 20, ua.y];
  [[305, 128], [305, 205], [305, 282], [305, 515], [305, 598]].forEach((p) => { c += linea([desde, p], { marcador: null }); });
  c += linea([desde, [515, 370]], { marcador: null });
  c += linea([desde, [515, 445]], { marcador: null });
  const adm = [1040, 380];
  c += linea([adm, [705, 370]], { marcador: null });
  c += linea([adm, [705, 445]], { marcador: null });
  [[915, 140], [915, 228], [915, 595]].forEach((p) => { c += linea([adm, p], { marcador: null }); });

  c += linea([[izq, 660], [izq, 632]], { punteada: true });
  c += etiqueta(izq + 48, 650, '«extend»');
  // Desde la consulta, el usuario puede continuar a reservar: Reservar extiende Consultar.
  c += linea([[izq, 490], [izq, 312]], { punteada: true });
  c += etiqueta(izq + 8, 336, '«extend»', { anchor: 'start' });
  return documento(1210, 760, 'Diagrama de casos de uso — alcance del MVP (RF-01 a RF-06)', c);
}

// ------------------------------------------------------------------ 5. Modelo de datos

function diagramaClases() {
  let c = '';
  const sede = clase({ x: 30, y: 60, w: 200, nombre: 'Sede', atributos: ['id: entero', 'nombre: texto «único»', 'direccion: texto'] });
  const espacio = clase({ x: 320, y: 60, w: 260, nombre: 'Espacio', atributos: ['id: entero', 'nombre: texto (único por sede)', 'tipo: SALA | LABORATORIO', 'capacidad: 1..200', 'habilitado: booleano'] });
  const horario = clase({ x: 670, y: 60, w: 240, nombre: 'Horario', atributos: ['id: entero', 'dia_semana: 1..7', 'hora_inicio: HH:MM', 'hora_fin: HH:MM', 'activo: booleano'] });
  const bloqueo = clase({ x: 990, y: 60, w: 200, nombre: 'Bloqueo', atributos: ['id: entero', 'fecha: AAAA-MM-DD', 'motivo: texto', '{único: horario + fecha}'] });
  const reserva = clase({ x: 600, y: 330, w: 330, nombre: 'Reserva', atributos: ['id: entero  (código CR-000000)', 'fecha: AAAA-MM-DD', 'hora_inicio, hora_fin: copia del bloque', 'estado: CONFIRMADA | CANCELADA', 'creado_en, cancelado_en', '{único parcial: espacio + horario + fecha', ' si estado = CONFIRMADA}  (ADR-001)'] });
  const usuario = clase({ x: 120, y: 330, w: 300, nombre: 'Usuario', atributos: ['id: entero', 'nombre: texto', 'correo: texto «único»', 'password_hash: scrypt (N=2^17, sal)', 'rol: ESTUDIANTE | DOCENTE | ADMINISTRADOR', 'estado: PENDIENTE | ACTIVA'] });
  const listado = clase({ x: 30, y: 600, w: 240, nombre: 'ListadoInstitucional', atributos: ['correo: texto «PK»', 'rol: ESTUDIANTE | DOCENTE'] });
  const token = clase({ x: 300, y: 600, w: 250, nombre: 'TokenConfirmacion', atributos: ['token_hash: SHA-256 «único»', 'expira_en: +24 h', 'usado_en: un solo uso'] });
  const auditoria = clase({ x: 590, y: 600, w: 250, nombre: 'Auditoria', atributos: ['fecha', 'accion: LOGIN_OK, ACCESO_DENEGADO…', 'detalle (sin contraseñas ni IP)'] });
  const sesion = clase({ x: 880, y: 600, w: 150, nombre: 'Sesion', estereotipo: 'soporte', atributos: ['sid_hash: SHA-256', 'datos: JSON', 'expira: ms'] });
  const correo = clase({ x: 1050, y: 600, w: 150, nombre: 'CorreoDemo', estereotipo: 'demo', atributos: ['destinatario', 'asunto', 'enlace'] });
  [sede, espacio, horario, bloqueo, reserva, usuario, listado, token, auditoria, sesion, correo].forEach((k) => { c += k.svg; });

  const mult = (x, y, texto, anchor = 'middle') => t(x, y, texto, { size: 12, anchor, fill: COLOR.suave });
  c += linea([[230, 100], [320, 100]], { marcador: null }) + mult(240, 93, '1', 'start') + mult(312, 93, '0..*', 'end');
  c += linea([[580, 100], [670, 100]], { marcador: null }) + mult(590, 93, '1', 'start') + mult(662, 93, '0..*', 'end');
  c += linea([[910, 100], [990, 100]], { marcador: null }) + mult(920, 93, '1', 'start') + mult(982, 93, '0..*', 'end');
  c += linea([[790, horario.caja.y + horario.caja.h], [790, 330]], { marcador: null }) + mult(800, horario.caja.y + horario.caja.h + 16, '1', 'start') + mult(800, 322, '0..*', 'start');
  c += linea([[450, espacio.caja.y + espacio.caja.h], [450, 290], [640, 290], [640, 330]], { marcador: null }) + mult(460, espacio.caja.y + espacio.caja.h + 16, '1', 'start') + mult(650, 322, '0..*', 'start');
  c += linea([[420, 400], [600, 400]], { marcador: null }) + mult(430, 393, '1', 'start') + mult(592, 393, '0..*', 'end') + t(510, 418, 'realiza', { size: 11.5, anchor: 'middle', fill: COLOR.suave, italic: true });
  c += linea([[400, usuario.caja.y + usuario.caja.h], [400, 600]], { marcador: null }) + mult(410, usuario.caja.y + usuario.caja.h + 16, '1', 'start') + mult(410, 592, '0..*', 'start');
  c += linea([[330, usuario.caja.y + usuario.caja.h], [330, 560], [700, 560], [700, 600]], { marcador: null }) + mult(340, usuario.caja.y + usuario.caja.h + 16, '0..1', 'start') + mult(710, 592, '0..*', 'start');
  c += linea([[150, 600], [150, usuario.caja.y + usuario.caja.h]], { punteada: true }) + t(158, 575, '«autoriza registro y rol»', { size: 11.5, fill: COLOR.suave });
  return documento(1210, 740, 'Modelo de datos (diagrama de clases de persistencia) — esquema SQLite implementado', c);
}

// ------------------------------------------------------------------ exportación

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const diagramas = {
    '01-componentes': diagramaComponentes(),
    '02-despliegue': diagramaDespliegue(),
    '03-secuencia-reserva': diagramaSecuencia(),
    '04-casos-de-uso': diagramaCasosUso(),
    '05-modelo-datos': diagramaClases(),
  };
  const navegador = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const pagina = await navegador.newPage({ deviceScaleFactor: 2 });
    for (const [nombre, svg] of Object.entries(diagramas)) {
      fs.writeFileSync(path.join(DESTINO, `${nombre}.svg`), svg);
      await pagina.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
      await pagina.locator('svg').first().screenshot({ path: path.join(DESTINO, `${nombre}.png`) });
      console.log(`✓ ${nombre}`);
    }
  } finally {
    await navegador.close();
  }
}

main().catch((error) => {
  console.error('No fue posible generar los diagramas:', error);
  process.exit(1);
});
