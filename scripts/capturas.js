/**
 * Genera capturas de pantalla REALES de la aplicación para el informe (evidencia reproducible).
 *
 * Levanta el servidor con una base temporal y datos ficticios, recorre los flujos principales
 * con Microsoft Edge (playwright-core, modo sin interfaz) y guarda las imágenes en
 * docs/evidencias/capturas. Uso: npm run capturas
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { chromium } = require('playwright-core');
const { fechaHoraEnZona, sumarDias, diaSemana } = require('../src/lib/fechas');
const { siguienteDiaHabil } = require('../src/db/seed');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'docs', 'evidencias', 'capturas');
const PUERTO = Number(process.env.CAPTURAS_PUERTO || 3300);
const URL_BASE = `http://127.0.0.1:${PUERTO}`;
const PASSWORD = 'Reserva2026';
const CLAVE_NUEVA = 'MiClave2026x';
const C = {
  ana: 'ana.estudiante@campus.test',
  diego: 'diego.docente@campus.test',
  admin: 'admin@campus.test',
  pedro: 'pedro.pendiente@campus.test',
};

async function esperarServidor() {
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await fetch(`${URL_BASE}/login`)).ok) return;
    } catch {
      // aún no escucha
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('El servidor no respondió');
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusreserva-capturas-'));
  const servidor = fork(path.join(RAIZ, 'src', 'server.js'), [], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PUERTO),
      BASE_URL: URL_BASE,
      DB_PATH: path.join(dir, 'capturas.db'),
      SEED_DEMO: 'true',
      DEMO_MAILBOX: 'true',
      DEMO_PASSWORD: PASSWORD,
      LOGIN_MAX_INTENTOS: '1000',
    },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });

  const navegador = await chromium.launch({ channel: 'msedge', headless: true });
  const indice = [];
  try {
    await esperarServidor();
    const hoy = fechaHoraEnZona(new Date(), 'America/Santiago').fecha;
    const dia1 = siguienteDiaHabil(hoy);
    let domingo = sumarDias(hoy, 1);
    while (diaSemana(domingo) !== 7) domingo = sumarDias(domingo, 1);

    const nuevoContexto = (ancho = 1280, alto = 820) =>
      navegador.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-CL', deviceScaleFactor: 1 });

    const capturar = async (pagina, nombre, descripcion, completa = true) => {
      const archivo = `${nombre}.png`;
      await pagina.screenshot({ path: path.join(DESTINO, archivo), fullPage: completa });
      indice.push({ archivo, descripcion, url: pagina.url().replace(URL_BASE, '') });
      console.log(`✓ ${archivo}`);
    };

    const iniciarSesion = async (pagina, correo, clave = PASSWORD) => {
      await pagina.goto(`${URL_BASE}/login`);
      await pagina.fill('#correo', correo);
      await pagina.fill('#contrasena', clave);
      await Promise.all([pagina.waitForLoadState('load'), pagina.click('form[action="/login"] button[type=submit]')]);
    };

    // ---------------------------------------------------------------- RF-01 / RF-02
    const anonimo = await (await nuevoContexto()).newPage();
    await anonimo.goto(`${URL_BASE}/login`);
    await capturar(anonimo, '01-login', 'RF-02 Pantalla de inicio de sesión con correo institucional y contraseña.');

    await anonimo.goto(`${URL_BASE}/registro`);
    await anonimo.fill('#nombre', 'A');
    await anonimo.fill('#correo', 'intruso@gmail.com');
    await anonimo.fill('#contrasena', 'corta');
    await anonimo.fill('#confirmacion', 'otra');
    await anonimo.click('form[action="/registro"] button[type=submit]');
    await capturar(anonimo, '02-registro-validaciones', 'RF-01 Validación en servidor: nombre, dominio institucional y contraseña.');

    await anonimo.goto(`${URL_BASE}/registro`);
    await anonimo.fill('#nombre', 'Camila Torres Vega');
    await anonimo.fill('#correo', 'camila.estudiante@campus.test');
    await anonimo.fill('#contrasena', CLAVE_NUEVA);
    await anonimo.fill('#confirmacion', CLAVE_NUEVA);
    await anonimo.click('form[action="/registro"] button[type=submit]');
    await capturar(anonimo, '03-registro-pendiente', 'RF-01 Cuenta creada en estado pendiente de confirmación.');

    await anonimo.goto(`${URL_BASE}/demo/buzon`);
    await capturar(anonimo, '04-buzon-demostracion', 'RF-01 Buzón de demostración: correo simulado con enlace de confirmación (no se envían correos reales).');

    await iniciarSesion(anonimo, 'camila.estudiante@campus.test', CLAVE_NUEVA);
    await capturar(anonimo, '05-login-cuenta-pendiente', 'RF-01/RF-02 Una cuenta pendiente no puede iniciar sesión.');

    await anonimo.goto(`${URL_BASE}/demo/buzon`);
    await anonimo.click('a.boton:has-text("Abrir enlace de confirmación") >> nth=0');
    await capturar(anonimo, '06-confirmar-cuenta', 'RF-01 Confirmación de cuenta desde el enlace (requiere presionar el botón).');
    await anonimo.click('form[action="/confirmar"] button[type=submit]');
    await capturar(anonimo, '07-cuenta-confirmada', 'RF-01 Cuenta activada: ya puede iniciar sesión.');

    await iniciarSesion(anonimo, C.ana, 'clave equivocada');
    await capturar(anonimo, '08-login-credenciales-invalidas', 'RF-02 Rechazo de credenciales inválidas con mensaje genérico.');

    // ---------------------------------------------------------------- RF-03 / RF-04 / RF-05
    const ctxAna = await nuevoContexto();
    const ana = await ctxAna.newPage();
    const ctxDiego = await nuevoContexto();
    const diego = await ctxDiego.newPage();
    await iniciarSesion(ana, C.ana);
    await iniciarSesion(diego, C.diego);

    await diego.goto(`${URL_BASE}/disponibilidad?sede=1&fecha=${dia1}`);
    await capturar(diego, '09-disponibilidad-resultados', 'RF-03 Disponibilidad de un docente por sede y fecha (excluye reservados, bloqueados y espacios deshabilitados).');

    await ana.goto(`${URL_BASE}/disponibilidad?sede=1&fecha=${dia1}`);
    await capturar(ana, '28-disponibilidad-estudiante', 'RF-03 Disponibilidad de un estudiante: solo salas de estudio, hasta 7 días y máximo 2 reservas vigentes.');

    await ana.goto(`${URL_BASE}/disponibilidad?sede=2&fecha=${domingo}`);
    await capturar(ana, '10-disponibilidad-sin-resultados', 'RF-03 Consulta sin resultados.');

    // Ana y Diego abren la revisión del mismo bloque de una sala de estudio; Ana confirma primero.
    await ana.goto(`${URL_BASE}/disponibilidad?sede=1&fecha=${dia1}`);
    const enlace = await ana.locator('article:has-text("Sala de estudio E-01") a.bloque').filter({ hasText: '12:00' }).first().getAttribute('href');
    await ana.goto(URL_BASE + enlace);
    await diego.goto(URL_BASE + enlace);
    await capturar(ana, '11-revisar-reserva', 'RF-04 Revisión de la selección antes de confirmar.');
    await ana.click('form[action="/reservas"] button[type=submit]');
    await ana.waitForLoadState('load');
    await capturar(ana, '12-reserva-confirmada', 'RF-04 Reserva confirmada con identificador único.');
    await diego.click('form[action="/reservas"] button[type=submit]');
    await diego.waitForLoadState('load');
    await capturar(diego, '13-reserva-conflicto', 'RF-04 Segundo intento sobre el mismo horario: la disponibilidad se verifica nuevamente y se rechaza.');

    await ana.goto(`${URL_BASE}/mis-reservas`);
    await capturar(ana, '14-mis-reservas', 'RF-05 Mis reservas: próximas e historial (solo reservas propias).');

    await ana.locator('a:has-text("Cancelar")').first().click();
    await ana.waitForLoadState('load');
    await capturar(ana, '15-cancelar-confirmacion', 'RF-05 La cancelación pide confirmación explícita.');
    await ana.click('form[action$="/cancelar"] button[type=submit]');
    await ana.waitForLoadState('load');
    await capturar(ana, '16-reserva-cancelada', 'RF-05 Reserva cancelada: se conserva en el historial y libera el horario.');

    const idDiego = await diego.evaluate(async () => {
      const r = await fetch('/mis-reservas');
      const m = (await r.text()).match(/href="\/reservas\/(\d+)"/);
      return m ? m[1] : null;
    });
    await ana.goto(`${URL_BASE}/reservas/${idDiego}`);
    await capturar(ana, '17-reserva-ajena-404', 'RF-05 Intento de ver una reserva ajena: el servidor responde 404.');

    await ana.goto(`${URL_BASE}/admin/espacios`);
    await capturar(ana, '18-acceso-denegado-403', 'RF-02 Restricción por rol: un estudiante no accede a la administración (403).');

    // ---------------------------------------------------------------- RF-06
    const admin = await (await nuevoContexto()).newPage();
    await iniciarSesion(admin, C.admin);
    await capturar(admin, '19-admin-espacios', 'RF-06 Panel de espacios del administrador.');

    await admin.goto(`${URL_BASE}/admin/espacios/nuevo`);
    await admin.selectOption('#sede', '1');
    await admin.fill('#nombre', 'X');
    await admin.fill('#capacidad', '0');
    await admin.click('form[action="/admin/espacios"] button[type=submit]');
    await capturar(admin, '20-admin-espacio-validaciones', 'RF-06 Validación de nombre, tipo y capacidad.');

    // Pantallas de horarios: se captura el área visible (la tabla completa tiene 37 bloques).
    await admin.goto(`${URL_BASE}/admin/espacios/1/horarios`);
    await capturar(admin, '21-admin-horarios', 'RF-06 Bloques horarios, formulario de bloqueo y bloqueos vigentes.', false);

    await admin.selectOption('#dia', '1');
    await admin.fill('#inicio', '09:00');
    await admin.fill('#fin', '10:30');
    await admin.click('form[action$="/horarios"] button[type=submit]');
    await capturar(admin, '22-admin-superposicion', 'RF-06 Rechazo de un bloque superpuesto.', false);

    // El bloque de las 08:30 del primer día hábil sigue reservado por Diego (seed).
    await admin.goto(`${URL_BASE}/admin/espacios/1/horarios`);
    await admin.fill('#fecha-bloqueo', dia1);
    const nombreDia = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][diaSemana(dia1)];
    const opcion = await admin.locator('#horario-bloqueo option').filter({ hasText: `${nombreDia} 08:30` }).getAttribute('value');
    await admin.selectOption('#horario-bloqueo', opcion);
    await admin.fill('#motivo', 'Evento institucional');
    await admin.click('form[action$="/bloqueos"] button[type=submit]');
    await capturar(admin, '23-admin-bloqueo-rechazado', 'RF-06 No se bloquea un horario con reserva confirmada (no se afectan reservas en silencio).', false);

    await admin.goto(`${URL_BASE}/admin/espacios`);
    await admin.locator('tr:has-text("Sala A-101") button:has-text("Deshabilitar")').click();
    await admin.waitForLoadState('load');
    await capturar(admin, '24-admin-deshabilitar-rechazado', 'RF-06 No se deshabilita un espacio con reservas vigentes.');

    await admin.goto(`${URL_BASE}/admin/auditoria`);
    await capturar(admin, '25-auditoria', 'Registro de auditoría: inicios de sesión, accesos denegados, reservas y cambios administrativos.');

    // ---------------------------------------------------------------- Vista móvil
    const movil = await (await nuevoContexto(390, 844)).newPage();
    await iniciarSesion(movil, C.diego);
    await movil.goto(`${URL_BASE}/disponibilidad?sede=1&fecha=${dia1}`);
    await capturar(movil, '26-movil-disponibilidad', 'Diseño responsive: disponibilidad en un teléfono (390 px).');
    await movil.goto(`${URL_BASE}/mis-reservas`);
    await capturar(movil, '27-movil-mis-reservas', 'Diseño responsive: tablas convertidas en tarjetas apiladas.');

    const md = ['# Índice de capturas (generadas con `npm run capturas`)', '', `Fecha: ${new Date().toISOString()}`, '',
      '| Archivo | Descripción | Ruta |', '|---|---|---|',
      ...indice.map((i) => `| ${i.archivo} | ${i.descripcion} | ${i.url} |`)].join('\n');
    fs.writeFileSync(path.join(DESTINO, 'INDICE.md'), md + '\n');
  } finally {
    await navegador.close();
    servidor.kill();
    await new Promise((r) => setTimeout(r, 300));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('No fue posible generar las capturas:', error);
  process.exit(1);
});
