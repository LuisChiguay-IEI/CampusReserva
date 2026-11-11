'use strict';

/**
 * Pruebas de integración de RF-01 (registrar usuario), RF-02 (iniciar sesión),
 * cierre de sesión y controles de seguridad transversales (sesión, CSRF, cabeceras, límite de intentos).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearEntorno, Cliente, CORREOS, PASSWORD } = require('../ayudante');

const NUEVA_CLAVE = 'MiClave2026x';

describe('RF-01 Registrar usuario', () => {
  let e;
  before(async () => { e = await crearEntorno(); });
  after(async () => e.cerrar());

  const registrar = (cliente, datos) =>
    cliente.post('/registro', { nombre: 'Camila Estudiante Demo', contrasena: NUEVA_CLAVE, confirmacion: NUEVA_CLAVE, ...datos });

  it('CP-01-01 registra un correo autorizado como cuenta PENDIENTE con el rol del listado y contraseña con hash', async () => {
    const c = e.cliente();
    const r = await registrar(c, { correo: 'camila.estudiante@campus.test' });
    assert.equal(r.estado, 303);
    assert.equal(r.ubicacion, '/registro/enviado');
    const pagina = await c.seguir(r);
    assert.match(pagina.html, /Revisa tu correo/);

    const u = e.uno('SELECT * FROM usuario WHERE correo = ?', 'camila.estudiante@campus.test');
    assert.equal(u.estado, 'PENDIENTE');
    assert.equal(u.rol, 'ESTUDIANTE');
    assert.match(u.password_hash, /^scrypt\$/);
    assert.ok(!u.password_hash.includes(NUEVA_CLAVE));
    const correo = e.uno('SELECT * FROM correo_demo WHERE destinatario = ? ORDER BY id DESC', u.correo);
    assert.match(correo.enlace, /\/confirmar\?token=/);
  });

  it('CP-01-02 rechaza un correo ya registrado', async () => {
    const antes = e.uno('SELECT COUNT(*) AS n FROM usuario').n;
    const r = await registrar(e.cliente(), { correo: CORREOS.ana });
    assert.equal(r.estado, 422);
    assert.match(r.html, /Ya existe una cuenta/);
    assert.equal(e.uno('SELECT COUNT(*) AS n FROM usuario').n, antes);
  });

  it('CP-01-03 rechaza correos fuera del listado institucional o de otro dominio', async () => {
    const r1 = await registrar(e.cliente(), { correo: 'intruso@campus.test' });
    assert.equal(r1.estado, 422);
    assert.match(r1.html, /listado institucional autorizado/);
    const r2 = await registrar(e.cliente(), { correo: 'nuevo.estudiante@gmail.com' });
    assert.equal(r2.estado, 422);
    assert.match(r2.html, /correo institucional/);
  });

  it('CP-01-04 no permite elegir el rol: un campo "rol=ADMINISTRADOR" se ignora', async () => {
    const r = await registrar(e.cliente(), { correo: 'nueva.docente@campus.test', rol: 'ADMINISTRADOR' });
    assert.equal(r.estado, 303);
    assert.equal(e.uno('SELECT rol FROM usuario WHERE correo = ?', 'nueva.docente@campus.test').rol, 'DOCENTE');
    // Un administrador tampoco puede registrarse por el formulario público (no está en el listado).
    const r2 = await registrar(e.cliente(), { correo: 'otro.admin@campus.test', rol: 'ADMINISTRADOR' });
    assert.equal(r2.estado, 422);
  });

  it('CP-01-05 rechaza datos inválidos con mensajes por campo y sin crear la cuenta', async () => {
    const r = await e.cliente().post('/registro', {
      nombre: 'A', correo: 'nuevo.estudiante@campus.test', contrasena: 'corta', confirmacion: 'otra',
    });
    assert.equal(r.estado, 422);
    assert.match(r.html, /entre 3 y 80 caracteres/);
    assert.match(r.html, /entre 8 y 64 caracteres/);
    assert.equal(e.uno('SELECT COUNT(*) AS n FROM usuario WHERE correo = ?', 'nuevo.estudiante@campus.test').n, 0);
  });

  it('CP-01-06 la cuenta pendiente no puede iniciar sesión hasta confirmar el correo', async () => {
    const c = e.cliente();
    const r = await c.iniciarSesion('camila.estudiante@campus.test', NUEVA_CLAVE);
    assert.equal(r.estado, 401);
    assert.match(r.html, /pendiente de confirmación/);
  });

  it('CP-01-07 el enlace válido activa la cuenta y luego permite iniciar sesión', async () => {
    const { enlace } = e.uno(
      'SELECT enlace FROM correo_demo WHERE destinatario = ? ORDER BY id DESC',
      'camila.estudiante@campus.test',
    );
    const token = new URL(enlace).searchParams.get('token');
    const c = e.cliente();
    const pagina = await c.get(`/confirmar?token=${encodeURIComponent(token)}`);
    assert.equal(pagina.estado, 200);
    assert.equal(e.uno('SELECT estado FROM usuario WHERE correo = ?', 'camila.estudiante@campus.test').estado, 'PENDIENTE',
      'abrir el enlace (GET) no debe activar la cuenta por sí solo');

    const r = await c.post('/confirmar', { token });
    assert.equal(r.estado, 303);
    assert.equal(e.uno('SELECT estado FROM usuario WHERE correo = ?', 'camila.estudiante@campus.test').estado, 'ACTIVA');

    const login = await e.cliente().iniciarSesion('camila.estudiante@campus.test', NUEVA_CLAVE);
    assert.equal(login.estado, 303);
    assert.equal(login.ubicacion, '/disponibilidad');

    // Reutilizar el mismo enlace se rechaza (un solo uso).
    const reuso = await e.cliente().post('/confirmar', { token });
    assert.equal(reuso.estado, 400);
  });

  it('CP-01-08 rechaza enlaces inexistentes o expirados', async () => {
    const r = await e.cliente().post('/confirmar', { token: 'x'.repeat(43) });
    assert.equal(r.estado, 400);

    await registrar(e.cliente(), { correo: 'nuevo.estudiante@campus.test' });
    const { enlace } = e.uno('SELECT enlace FROM correo_demo WHERE destinatario = ? ORDER BY id DESC', 'nuevo.estudiante@campus.test');
    e.fijarAhora('2026-11-17T14:00:01.000Z'); // 25 horas después
    try {
      const r2 = await e.cliente().post('/confirmar', { token: new URL(enlace).searchParams.get('token') });
      assert.equal(r2.estado, 400);
      assert.equal(e.uno('SELECT estado FROM usuario WHERE correo = ?', 'nuevo.estudiante@campus.test').estado, 'PENDIENTE');
      // Al iniciar sesión con el enlace expirado se emite uno nuevo.
      const login = await e.cliente().iniciarSesion('nuevo.estudiante@campus.test', NUEVA_CLAVE);
      assert.equal(login.estado, 401);
      assert.match(login.html, /generamos uno nuevo/);
      // HU-01: la nueva emisión invalida la anterior; queda un solo enlace sin usar.
      const usuarioId = e.uno('SELECT id FROM usuario WHERE correo = ?', 'nuevo.estudiante@campus.test').id;
      assert.equal(e.uno('SELECT COUNT(*) AS n FROM token_confirmacion WHERE usuario_id = ? AND usado_en IS NULL', usuarioId).n, 1);
    } finally {
      e.fijarAhora('2026-11-16T13:00:00.000Z');
    }
  });
});

describe('RF-02 Iniciar sesión, cierre de sesión y seguridad de la sesión', () => {
  let e;
  before(async () => { e = await crearEntorno(); });
  after(async () => e.cerrar());

  it('CP-02-01 cada rol inicia sesión y es dirigido a sus funciones', async () => {
    const casos = [
      [CORREOS.ana, '/disponibilidad', /Consultar disponibilidad/],
      [CORREOS.diego, '/disponibilidad', /Consultar disponibilidad/],
      [CORREOS.admin, '/admin/espacios', /Espacios y horarios/],
    ];
    for (const [correo, destino, texto] of casos) {
      const c = e.cliente();
      const r = await c.iniciarSesion(correo);
      assert.equal(r.estado, 303, correo);
      assert.equal(r.ubicacion, destino);
      const pagina = await c.seguir(r);
      assert.equal(pagina.estado, 200);
      assert.match(pagina.html, texto);
    }
  });

  it('CP-02-02 rechaza contraseña incorrecta y correo inexistente con el mismo mensaje genérico', async () => {
    const c1 = e.cliente();
    const r1 = await c1.iniciarSesion(CORREOS.ana, 'contraseña equivocada');
    const c2 = e.cliente();
    const r2 = await c2.iniciarSesion('no.existe@campus.test', 'contraseña equivocada');
    for (const r of [r1, r2]) {
      assert.equal(r.estado, 401);
      assert.match(r.html, /Correo o contraseña incorrectos/);
    }
    const protegida = await c1.get('/mis-reservas');
    assert.equal(protegida.estado, 303);
    assert.equal(protegida.ubicacion, '/login');
    assert.ok(e.uno("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'LOGIN_FALLIDO'").n >= 2);
  });

  it('CP-02-03 rechaza la cuenta pendiente de confirmación (seed)', async () => {
    const r = await e.cliente().iniciarSesion(CORREOS.pedro);
    assert.equal(r.estado, 401);
    assert.match(r.html, /pendiente de confirmación/);
  });

  it('CP-02-04 emite un nuevo identificador de sesión al autenticarse (anti fijación)', async () => {
    const c = e.cliente();
    await c.get('/login');
    const antes = c.cookies.get('cr_sesion');
    assert.ok(antes);
    await c.post('/login', { correo: CORREOS.ana, contrasena: PASSWORD });
    const despues = c.cookies.get('cr_sesion');
    assert.ok(despues);
    assert.notEqual(despues, antes);
  });

  it('CP-02-05 cerrar sesión invalida la sesión en el servidor (la cookie antigua deja de servir)', async () => {
    const c = e.cliente();
    await c.iniciarSesion(CORREOS.ana);
    await c.get('/mis-reservas');
    const cookieAntigua = c.cookies.get('cr_sesion');
    const r = await c.post('/logout');
    assert.equal(r.estado, 303);
    assert.equal(r.ubicacion, '/login');

    const atacante = new Cliente(e.url);
    atacante.cookies.set('cr_sesion', cookieAntigua);
    const intento = await atacante.get('/mis-reservas');
    assert.equal(intento.estado, 303);
    assert.equal(intento.ubicacion, '/login');
  });

  it('CP-02-06 la sesión expira tras 30 minutos de inactividad', async () => {
    const c = e.cliente();
    await c.iniciarSesion(CORREOS.diego);
    assert.equal((await c.get('/mis-reservas')).estado, 200);
    e.fijarAhora('2026-11-16T13:31:00.000Z');
    try {
      const r = await c.get('/mis-reservas');
      assert.equal(r.estado, 303);
      assert.equal(r.ubicacion, '/login');
    } finally {
      e.fijarAhora('2026-11-16T13:00:00.000Z');
    }
  });

  it('CP-02-07 rechaza formularios sin token CSRF válido', async () => {
    const c = e.cliente();
    await c.get('/login');
    const sinToken = await c.post('/login', { correo: CORREOS.ana, contrasena: PASSWORD }, { conCsrf: false });
    assert.equal(sinToken.estado, 403);
    const tokenFalso = await c.solicitar('POST', '/login', { _csrf: 'falso', correo: CORREOS.ana, contrasena: PASSWORD });
    assert.equal(tokenFalso.estado, 403);
  });

  it('CP-02-08 envía cabeceras de seguridad y cookie HttpOnly + SameSite', async () => {
    const r = await e.cliente().get('/login');
    assert.match(r.cabeceras.get('content-security-policy'), /default-src 'self'/);
    assert.equal(r.cabeceras.get('x-content-type-options'), 'nosniff');
    assert.equal(r.cabeceras.get('x-frame-options'), 'DENY');
    assert.equal(r.cabeceras.get('cache-control'), 'no-store');
    assert.equal(r.cabeceras.get('x-powered-by'), null);
    const cookie = r.cabeceras.getSetCookie().find((l) => l.startsWith('cr_sesion='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });

  it('CP-02-09 guarda solo el hash del identificador de sesión en la base', async () => {
    const c = e.cliente();
    await c.iniciarSesion(CORREOS.ana);
    await c.get('/mis-reservas');
    const valorCookie = c.cookies.get('cr_sesion');
    assert.equal(e.uno('SELECT COUNT(*) AS n FROM sesion WHERE sid_hash = ?', valorCookie).n, 0);
  });
});

describe('RF-02 Límite de intentos de inicio de sesión', () => {
  let e;
  before(async () => { e = await crearEntorno({ limiteLogin: { ventanaMs: 15 * 60 * 1000, maximo: 3 } }); });
  after(async () => e.cerrar());

  it('CP-02-10 bloquea temporalmente tras superar los intentos fallidos permitidos', async () => {
    const c = e.cliente();
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await c.iniciarSesion(CORREOS.ana, 'clave incorrecta')).estado, 401);
    }
    const bloqueado = await c.iniciarSesion(CORREOS.ana, PASSWORD);
    assert.equal(bloqueado.estado, 429);
    assert.match(bloqueado.html, /Demasiados intentos/);
  });
});
