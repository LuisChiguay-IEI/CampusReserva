'use strict';

/**
 * Pruebas de aceptación sobre el despliegue público de CampusReserva (PaaS Render).
 *
 * Uso:  node scripts/pruebas-despliegue.js https://<servicio>.onrender.com [--sin-capturas]
 *
 * Recorre flujos reales de RF-01 a RF-06 y controles de seguridad contra la URL indicada,
 * mide tiempos de respuesta vistos desde el cliente (incluyen la latencia de red) y guarda la
 * evidencia en docs/evidencias/despliegue/. Son pruebas automatizadas de sistema sobre el
 * entorno desplegado, NO pruebas con usuarios reales.
 *
 * Para no saturar el plan gratuito: la prueba de concurrencia usa solo 10 solicitudes, las
 * muestras de tiempo son secuenciales y no se prueba el bloqueo por intentos fallidos.
 * Las reservas de prueba se cancelan al terminar.
 */

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { Cliente, PASSWORD } = require('../test/ayudante');
const { fechaHoraEnZona } = require('../src/lib/fechas');
const { siguienteDiaHabil } = require('../src/db/seed');

const URL_BASE = (process.argv[2] || '').replace(/\/+$/, '');
const CON_CAPTURAS = !process.argv.includes('--sin-capturas');
// Se acepta http://localhost solo para ensayar el script; en ese caso DEP-02 a DEP-04 fallan
// por diseño (sin TLS ni modo producción) y la evidencia se escribe en una carpeta aparte.
const ENSAYO_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(URL_BASE);
if (!/^https:\/\/[^/]+$/.test(URL_BASE) && !ENSAYO_LOCAL) {
  console.error('Uso: node scripts/pruebas-despliegue.js https://<servicio>.onrender.com [--sin-capturas]');
  process.exit(2);
}

const DESTINO = ENSAYO_LOCAL
  ? path.join(__dirname, '..', '.tmp', 'ensayo-despliegue')
  : path.join(__dirname, '..', 'docs', 'evidencias', 'despliegue');
const ZONA = 'America/Santiago';
const CLAVE_NUEVA = 'Registro2026x';
const CORREOS_LISTADO = ['nuevo.estudiante@campus.test', 'camila.estudiante@campus.test', 'nueva.docente@campus.test'];
const RE_OFERTA = /href="\/reservas\/nueva\?espacio=(\d+)&amp;horario=(\d+)&amp;fecha=([\d-]+)&amp;sede=(\d+)"/g;

// ------------------------------------------------------------------ medición

const muestras = new Map(); // "MÉTODO /ruta" -> [ms]
let solicitudes = 0;
let errores5xx = 0;

/** Agrupa las rutas por operación: sin dominio, sin consulta y con los ids reemplazados por :id. */
function operacion(metodo, ruta) {
  const limpia = ruta.replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id');
  return `${metodo} ${limpia}`;
}

/** Cliente de las pruebas de integración que además registra el tiempo de cada solicitud. */
class ClienteMedido extends Cliente {
  async solicitar(metodo, ruta, cuerpo) {
    const inicio = performance.now();
    const respuesta = await super.solicitar(metodo, ruta, cuerpo);
    const op = operacion(metodo, ruta);
    if (!muestras.has(op)) muestras.set(op, []);
    muestras.get(op).push(performance.now() - inicio);
    solicitudes += 1;
    if (respuesta.estado >= 500) errores5xx += 1;
    return respuesta;
  }
}

const nuevoCliente = () => new ClienteMedido(URL_BASE);

async function iniciarSesion(cliente, correo, clave = PASSWORD) {
  await cliente.get('/login');
  const r = await cliente.post('/login', { correo, contrasena: clave });
  if (r.estado === 303) await cliente.seguir(r);
  return r;
}

function percentil(valores, p) {
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}
const redondear = (n) => Math.round(n * 10) / 10;

// ------------------------------------------------------------------ registro de resultados

const resultados = [];

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function prueba(id, descripcion, fn) {
  try {
    const detalle = await fn();
    resultados.push({ id, descripcion, resultado: 'Aprobada', detalle: detalle || '' });
    console.log(`  ✔ ${id} ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  } catch (error) {
    resultados.push({ id, descripcion, resultado: 'Fallida', detalle: error.message });
    console.log(`  ✖ ${id} ${descripcion}\n      ${error.message}`);
  }
}

// ------------------------------------------------------------------ pruebas

async function ejecutarPruebas() {
  const anonimo = nuevoCliente();
  const ana = nuevoCliente();
  const diego = nuevoCliente();
  const admin = nuevoCliente();
  const fecha = siguienteDiaHabil(fechaHoraEnZona(new Date(), ZONA).fecha);
  let primera = null;
  let ofertas = [];
  let reservaAna = null;
  let ganador = null;
  let correoRegistrado = null;

  await prueba('DEP-01', 'El servicio responde por HTTPS (la primera solicitud puede incluir el arranque en frío)', async () => {
    const inicio = performance.now();
    primera = await anonimo.get('/login');
    exigir(primera.estado === 200, `GET /login respondió ${primera.estado}`);
    exigir(/<h1>Iniciar sesión<\/h1>/.test(primera.html), 'la página no muestra el inicio de sesión');
    return `200 en ${Math.round(performance.now() - inicio)} ms`;
  });

  await prueba('DEP-02', 'Las solicitudes HTTP se redirigen a HTTPS', async () => {
    const r = await fetch(`${URL_BASE.replace(/^https:/, 'http:')}/login`, { redirect: 'manual' });
    const destino = r.headers.get('location') || '';
    exigir(r.status >= 300 && r.status < 400 && destino.startsWith('https://'), `HTTP respondió ${r.status} ${destino}`);
    return `${r.status} → ${destino}`;
  });

  await prueba('DEP-03', 'Cabeceras de seguridad en producción (HSTS, CSP, nosniff, DENY, no-store)', async () => {
    exigir(primera, 'no hubo respuesta inicial');
    const esperadas = {
      'strict-transport-security': /max-age=\d+/,
      'content-security-policy': /default-src 'self'/,
      'x-content-type-options': /^nosniff$/,
      'x-frame-options': /^DENY$/,
      'cache-control': /no-store/,
    };
    for (const [nombre, patron] of Object.entries(esperadas)) {
      exigir(patron.test(primera.cabeceras.get(nombre) || ''), `${nombre}: "${primera.cabeceras.get(nombre)}"`);
    }
    exigir(!primera.cabeceras.get('x-powered-by'), 'expone X-Powered-By');
    return 'HSTS: ' + primera.cabeceras.get('strict-transport-security');
  });

  await prueba('DEP-04', 'RF-02 Inicio de sesión de estudiante con cookie segura (__Host-, Secure, HttpOnly, SameSite=Lax)', async () => {
    await ana.get('/login');
    const r = await ana.post('/login', { correo: 'ana.estudiante@campus.test', contrasena: PASSWORD });
    exigir(r.estado === 303 && r.ubicacion === '/disponibilidad', `respondió ${r.estado} → ${r.ubicacion}`);
    const cookie = r.cabeceras.getSetCookie().find((c) => c.startsWith('__Host-cr_sesion='));
    exigir(cookie, 'no se emitió la cookie __Host-cr_sesion');
    for (const atributo of [/;\s*Secure/i, /;\s*HttpOnly/i, /;\s*SameSite=Lax/i, /;\s*Path=\//i]) {
      exigir(atributo.test(cookie), `a la cookie le falta ${atributo}`);
    }
    exigir(!/;\s*Domain=/i.test(cookie), 'la cookie no debe fijar Domain');
    await ana.seguir(r);
    return cookie.split(';').slice(1).map((s) => s.trim().split('=')[0]).join(', ');
  });

  await prueba('DEP-05', 'RF-02 Contraseña incorrecta y correo inexistente reciben el mismo mensaje genérico', async () => {
    const c = nuevoCliente();
    await c.get('/login');
    const a = await c.post('/login', { correo: 'ana.estudiante@campus.test', contrasena: 'clave equivocada de prueba' });
    const b = await c.post('/login', { correo: 'no.existe@campus.test', contrasena: 'clave equivocada de prueba' });
    exigir(a.estado === b.estado && a.estado !== 303, `estados ${a.estado} y ${b.estado}`);
    exigir([a, b].every((r) => /Correo o contraseña incorrectos/.test(r.html)), 'mensaje distinto o ausente');
    return `ambas responden ${a.estado} con el mismo mensaje`;
  });

  await prueba('DEP-06', 'RF-01 Una cuenta pendiente de confirmación no puede iniciar sesión', async () => {
    const c = nuevoCliente();
    const r = await iniciarSesion(c, 'pedro.pendiente@campus.test');
    exigir(r.estado !== 303 && /pendiente de confirmación/.test(r.html), `respondió ${r.estado}`);
    return `respondió ${r.estado}`;
  });

  await prueba('DEP-07', `RF-03 Consulta de disponibilidad por sede y fecha (${fecha})`, async () => {
    const r = await ana.get(`/disponibilidad?sede=1&fecha=${fecha}`);
    exigir(r.estado === 200, `respondió ${r.estado}`);
    ofertas = [...r.html.matchAll(RE_OFERTA)].map((m) => ({ espacio: m[1], horario: m[2], fecha: m[3] }));
    exigir(ofertas.length >= 3, `solo hay ${ofertas.length} bloques disponibles`);
    return `${ofertas.length} bloques disponibles`;
  });

  await prueba('DEP-08', 'RF-04 Reserva con revisión previa, confirmación e identificador', async () => {
    exigir(ofertas.length, 'no hay bloques para reservar');
    const o = ofertas[0];
    const revision = await ana.get(`/reservas/nueva?${new URLSearchParams({ ...o, sede: '1' })}`);
    exigir(revision.estado === 200, `la revisión respondió ${revision.estado}`);
    const r = await ana.post('/reservas', o);
    exigir(r.estado === 303 && /^\/reservas\/\d+$/.test(r.ubicacion || ''), `respondió ${r.estado} → ${r.ubicacion}`);
    const detalle = await ana.seguir(r);
    const codigo = (detalle.html.match(/Reserva (CR-\d+) confirmada/) || [])[1];
    exigir(codigo, 'no se mostró el código de la reserva');
    exigir((await ana.get('/mis-reservas')).html.includes(codigo), 'la reserva no aparece en Mis reservas');
    reservaAna = { id: r.ubicacion.split('/').pop(), codigo, ...o };
    return `código ${codigo}`;
  });

  await iniciarSesion(diego, 'diego.docente@campus.test');
  await iniciarSesion(admin, 'admin@campus.test');

  await prueba('DEP-09', 'RF-04 Un bloque ya reservado se rechaza al confirmar (409)', async () => {
    exigir(reservaAna, 'no se creó la reserva previa');
    const { espacio, horario, fecha: f } = reservaAna;
    const r = await diego.post('/reservas', { espacio, horario, fecha: f });
    exigir(r.estado === 409 && /acaba de ser reservado/.test(r.html), `respondió ${r.estado}`);
    return '409 Conflict';
  });

  await prueba('DEP-10', 'RF-04 / ADR-001 10 solicitudes simultáneas de 2 usuarios (docente y administración) por el mismo bloque confirman exactamente una', async () => {
    exigir(ofertas.length >= 2, 'no hay un segundo bloque disponible');
    const o = ofertas[1];
    const clientes = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? diego : admin));
    const respuestas = await Promise.all(clientes.map((c) => c.post('/reservas', o)));
    const exitos = respuestas.map((r, i) => ({ r, c: clientes[i] })).filter(({ r }) => r.estado === 303);
    const conflictos = respuestas.filter((r) => r.estado === 409).length;
    if (exitos.length === 1) ganador = { cliente: exitos[0].c, id: exitos[0].r.ubicacion.split('/').pop() };
    exigir(exitos.length === 1 && conflictos === 9, `éxitos ${exitos.length}, conflictos ${conflictos}, otros ${10 - exitos.length - conflictos}`);
    return '1 confirmada y 9 rechazadas con 409';
  });

  await prueba('DEP-11', 'RF-05 Un usuario no puede ver ni cancelar reservas ajenas (404 sin cambios)', async () => {
    exigir(reservaAna, 'no se creó la reserva previa');
    exigir((await diego.get(`/reservas/${reservaAna.id}`)).estado === 404, 'la reserva ajena fue visible');
    exigir((await diego.post(`/reservas/${reservaAna.id}/cancelar`)).estado === 404, 'la cancelación ajena no respondió 404');
    exigir((await ana.get(`/reservas/${reservaAna.id}`)).html.includes(reservaAna.codigo), 'la reserva cambió');
    return '404 en lectura y cancelación';
  });

  await prueba('DEP-12', 'RF-05 Cancelación con confirmación; la reserva queda en el historial', async () => {
    exigir(reservaAna, 'no se creó la reserva previa');
    const confirmacion = await ana.get(`/reservas/${reservaAna.id}/cancelar`);
    exigir(confirmacion.estado === 200, `la confirmación respondió ${confirmacion.estado}`);
    const r = await ana.post(`/reservas/${reservaAna.id}/cancelar`);
    exigir(r.estado === 303 && r.ubicacion === '/mis-reservas', `respondió ${r.estado} → ${r.ubicacion}`);
    const lista = await ana.seguir(r);
    exigir(lista.html.includes(`Reserva ${reservaAna.codigo} cancelada`), 'no se informó la cancelación');
    exigir(lista.html.includes(reservaAna.codigo), 'la reserva no quedó en el historial');
    return `${reservaAna.codigo} cancelada`;
  });

  await prueba('DEP-13', 'OWASP A01 Un formulario sin token CSRF se rechaza (403)', async () => {
    const o = ofertas[2] || ofertas[0];
    exigir(o, 'no hay bloques disponibles');
    const r = await ana.post('/reservas', o, { conCsrf: false });
    exigir(r.estado === 403, `respondió ${r.estado}`);
    return '403 Forbidden';
  });

  await prueba('DEP-14', 'RF-06 / OWASP A01 Un estudiante no accede a la administración (403)', async () => {
    const r = await ana.get('/admin/espacios');
    exigir(r.estado === 403, `respondió ${r.estado}`);
    return '403 Forbidden';
  });

  await prueba('DEP-15', 'RF-06 El administrador registra un espacio y se validan los datos', async () => {
    const invalido = await admin.post('/admin/espacios', { sede: '1', nombre: 'Sala inválida', tipo: 'SALA', capacidad: '0' });
    exigir(invalido.estado === 422, `una capacidad 0 respondió ${invalido.estado}`);
    const hora = fechaHoraEnZona(new Date(), ZONA).hora.replace(':', '');
    const nombre = `Sala D-${hora}`;
    const r = await admin.post('/admin/espacios', { sede: '1', nombre, tipo: 'SALA', capacidad: '12' });
    exigir(r.estado === 303 && /^\/admin\/espacios\/\d+\/horarios$/.test(r.ubicacion || ''), `respondió ${r.estado} → ${r.ubicacion}`);
    exigir((await admin.get('/admin/espacios')).html.includes(nombre), 'el espacio no aparece en la lista');
    return `"${nombre}" registrado; capacidad 0 rechazada con 422`;
  });

  await prueba('DEP-16', 'RF-01 Registro con listado institucional, enlace en el buzón de demostración y activación', async () => {
    const c = nuevoCliente();
    await c.get('/registro');
    for (const correo of CORREOS_LISTADO) {
      const r = await c.post('/registro', { nombre: 'Tomás Fuentes Rojas', correo, contrasena: CLAVE_NUEVA, confirmacion: CLAVE_NUEVA });
      if (r.estado === 303 && r.ubicacion === '/registro/enviado') {
        correoRegistrado = correo;
        break;
      }
    }
    exigir(correoRegistrado, 'ningún correo del listado quedó libre (la base se restablece al reiniciar el servicio)');
    const buzon = await c.get('/demo/buzon');
    const desde = buzon.html.indexOf(`Para: ${correoRegistrado}`);
    exigir(desde >= 0, 'el correo no aparece en el buzón de demostración');
    const enlace = (buzon.html.slice(desde).match(/href="([^"]*\/confirmar\?token=[^"]+)"/) || [])[1];
    exigir(enlace && enlace.startsWith(`${URL_BASE}/confirmar?token=`), `el enlace no usa la URL pública: ${enlace}`);
    const token = new URL(enlace).searchParams.get('token');
    exigir((await c.get(enlace.slice(URL_BASE.length))).estado === 200, 'la página de confirmación no abrió');
    const confirmado = await c.post('/confirmar', { token });
    exigir(confirmado.estado === 303 && confirmado.ubicacion === '/login', `la confirmación respondió ${confirmado.estado}`);
    const sesion = await iniciarSesion(nuevoCliente(), correoRegistrado, CLAVE_NUEVA);
    exigir(sesion.estado === 303, `la cuenta nueva no pudo iniciar sesión (${sesion.estado})`);
    return `${correoRegistrado} activada; el enlace apunta a ${URL_BASE}`;
  });

  await prueba('DEP-17', 'Reglas por rol: el estudiante solo ve salas de estudio y no puede reservar una sala de clases (403)', async () => {
    const vistaEstudiante = await ana.get(`/disponibilidad?sede=1&fecha=${fecha}`);
    exigir(/Como estudiante puedes reservar/.test(vistaEstudiante.html), 'no se muestra la regla del estudiante');
    exigir(!/insignia-sala"/.test(vistaEstudiante.html) && !/insignia-laboratorio"/.test(vistaEstudiante.html), 'al estudiante se le ofrecen salas de clases o laboratorios');
    const vistaDocente = await diego.get(`/disponibilidad?sede=1&fecha=${fecha}`);
    const espaciosEstudiante = new Set([...vistaEstudiante.html.matchAll(RE_OFERTA)].map((m) => m[1]));
    const sala = [...vistaDocente.html.matchAll(RE_OFERTA)]
      .map((m) => ({ espacio: m[1], horario: m[2], fecha: m[3] }))
      .find((o) => !espaciosEstudiante.has(o.espacio));
    exigir(sala, 'el docente no tiene salas de clases disponibles para comparar');
    const r = await ana.post('/reservas', sala);
    exigir(r.estado === 403 && /solo puedes reservar salas de estudio/.test(r.html), `respondió ${r.estado}`);
    return '403: solo salas de estudio';
  });

  // Limpieza (antes de cerrar sesión): se cancela la reserva ganada en la prueba de concurrencia.
  if (ganador) await ganador.cliente.post(`/reservas/${ganador.id}/cancelar`);

  await prueba('DEP-18', 'Cierre de sesión: la sesión se destruye en el servidor', async () => {
    const r = await ana.post('/logout');
    exigir(r.estado === 303, `respondió ${r.estado}`);
    const despues = await ana.get('/mis-reservas');
    exigir(despues.estado === 303 && despues.ubicacion === '/login', `tras cerrar sesión respondió ${despues.estado}`);
    return 'Mis reservas redirige al inicio de sesión';
  });

  // Muestras secuenciales para las métricas de tiempo de respuesta.
  for (let i = 0; i < 15; i += 1) await anonimo.get('/login');
  for (let i = 0; i < 15; i += 1) await diego.get(`/disponibilidad?sede=1&fecha=${fecha}`);
  for (let i = 0; i < 5; i += 1) await iniciarSesion(nuevoCliente(), 'diego.docente@campus.test');

  return { fecha, correoRegistrado };
}

// ------------------------------------------------------------------ capturas del sitio desplegado

async function tomarCapturas(fecha) {
  const { chromium } = require('playwright-core');
  const navegador = await chromium.launch({ channel: 'msedge', headless: true });
  const archivos = [];
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-CL' });
    const pagina = await contexto.newPage();
    const capturar = async (archivo) => {
      await pagina.screenshot({ path: path.join(DESTINO, archivo), fullPage: false });
      archivos.push(archivo);
    };
    const entrar = async (correo) => {
      await pagina.goto(`${URL_BASE}/login`);
      await pagina.fill('#correo', correo);
      await pagina.fill('#contrasena', PASSWORD);
      await Promise.all([pagina.waitForLoadState('load'), pagina.click('form[action="/login"] button[type=submit]')]);
    };
    const salir = async () => {
      await Promise.all([pagina.waitForLoadState('load'), pagina.click('form[action="/logout"] button[type=submit]')]);
    };

    await pagina.goto(`${URL_BASE}/login`);
    await capturar('dep-01-login.png');
    await entrar('diego.docente@campus.test');
    await pagina.goto(`${URL_BASE}/disponibilidad?sede=1&fecha=${fecha}`);
    await capturar('dep-02-disponibilidad.png');
    await pagina.goto(`${URL_BASE}/mis-reservas`);
    await capturar('dep-03-mis-reservas.png');
    await salir();
    await entrar('admin@campus.test');
    await pagina.goto(`${URL_BASE}/admin/espacios`);
    await capturar('dep-04-admin-espacios.png');
    await salir();
    await pagina.goto(`${URL_BASE}/demo/buzon`);
    await capturar('dep-05-buzon-demo.png');
  } finally {
    await navegador.close();
  }
  return archivos;
}

// ------------------------------------------------------------------ informe de evidencia

function escribirEvidencia(datos) {
  const tabla = (filas) => filas.map((f) => `| ${f.join(' | ')} |`).join('\n');
  const md = [
    '# Pruebas sobre el despliegue en Render',
    '',
    `- URL: ${datos.url}`,
    `- Fecha de ejecución: ${datos.fecha} (UTC)`,
    `- Cliente: ${datos.cliente.descripcion}`,
    `- Comando: \`node scripts/pruebas-despliegue.js ${datos.url}\``,
    '- Tipo: pruebas automatizadas de sistema sobre el entorno desplegado (no son pruebas con usuarios).',
    '',
    `**Resultado:** ${datos.resumen.aprobadas}/${datos.resumen.pruebas} aprobadas; ${datos.resumen.solicitudes} solicitudes HTTP; ` +
      `${datos.resumen.errores5xx} respuestas 5xx.`,
    '',
    '| ID | Prueba | Resultado | Detalle |',
    '|---|---|---|---|',
    tabla(datos.resultados.map((r) => [r.id, r.descripcion, r.resultado, r.detalle.replace(/\|/g, '/')])),
    '',
    '## Tiempos de respuesta (ms, medidos desde el cliente; incluyen la red)',
    '',
    '| Operación | n | p50 | p95 | Máx. |',
    '|---|---|---|---|---|',
    tabla(datos.metricas.map((m) => [`\`${m.operacion}\``, m.n, m.p50, m.p95, m.max])),
    '',
    datos.capturas.length ? `Capturas: ${datos.capturas.map((c) => `[${c}](${c})`).join(', ')}` : 'Capturas: no se tomaron.',
    '',
  ].join('\n');
  fs.mkdirSync(DESTINO, { recursive: true });
  fs.writeFileSync(path.join(DESTINO, 'resultado-despliegue.json'), `${JSON.stringify(datos, null, 2)}\n`);
  fs.writeFileSync(path.join(DESTINO, 'resultado-despliegue.md'), md);
}

async function main() {
  console.log(`Pruebas de aceptación sobre ${URL_BASE}\n`);
  fs.mkdirSync(DESTINO, { recursive: true });
  const { fecha } = await ejecutarPruebas();

  let capturas = [];
  if (CON_CAPTURAS) {
    try {
      capturas = await tomarCapturas(fecha);
    } catch (error) {
      console.log(`\n(No se pudieron tomar capturas: ${error.message})`);
    }
  }

  const metricas = [...muestras]
    .map(([op, v]) => ({ operacion: op, n: v.length, p50: redondear(percentil(v, 50)), p95: redondear(percentil(v, 95)), max: redondear(Math.max(...v)) }))
    .sort((a, b) => b.n - a.n);
  const aprobadas = resultados.filter((r) => r.resultado === 'Aprobada').length;
  const datos = {
    url: URL_BASE,
    fecha: new Date().toISOString(),
    cliente: { node: process.version, descripcion: `equipo de desarrollo en Chile, Node.js ${process.version}` },
    resumen: { pruebas: resultados.length, aprobadas, fallidas: resultados.length - aprobadas, solicitudes, errores5xx },
    resultados,
    metricas,
    capturas,
  };
  escribirEvidencia(datos);

  console.log(`\n${aprobadas}/${resultados.length} aprobadas · ${solicitudes} solicitudes · ${errores5xx} respuestas 5xx`);
  for (const m of metricas.filter((x) => x.n >= 5)) console.log(`  ${m.operacion.padEnd(28)} n=${m.n} p50=${m.p50} ms p95=${m.p95} ms`);
  console.log(`\nEvidencia: ${path.relative(process.cwd(), DESTINO)}`);
  process.exitCode = aprobadas === resultados.length ? 0 : 1;
}

main().catch((error) => {
  console.error('Error inesperado:', error);
  process.exit(1);
});
