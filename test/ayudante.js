/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * - Cada archivo de prueba levanta su propia instancia de la aplicación con una base SQLite
 *   temporal y datos ficticios, en un puerto libre.
 * - El reloj se fija en una fecha conocida (lunes 16-11-2026 10:00, hora de Chile) para que
 *   los resultados sean reproducibles. Puede moverse con `entorno.fijarAhora(iso)`.
 * - `Cliente` simula un navegador: guarda cookies, extrae el token CSRF de los formularios y
 *   no sigue redirecciones automáticamente (para poder verificarlas).
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cargarConfig } = require('../src/config');
const { abrirBaseDatos, aplicarEsquema } = require('../src/db/conexion');
const { sembrar } = require('../src/db/seed');
const { crearApp } = require('../src/app');

/** Lunes 16-11-2026 a las 10:00 en Chile continental (UTC-3 en horario de verano). */
const AHORA_PRUEBAS = '2026-11-16T13:00:00.000Z';
const FECHAS = Object.freeze({
  hoy: '2026-11-16', // lunes
  dia1: '2026-11-17', // martes: primer día hábil siguiente (reservas del seed)
  dia2: '2026-11-18', // miércoles
  domingo: '2026-11-22',
  pasada: '2026-11-09',
});
const PASSWORD = 'Demo Campus 2026';
const CORREOS = Object.freeze({
  ana: 'ana.estudiante@campus.test',
  diego: 'diego.docente@campus.test',
  admin: 'admin@campus.test',
  pedro: 'pedro.pendiente@campus.test',
});

/**
 * Crea una instancia aislada de la aplicación.
 * @param {object} [sobrescribir] Valores de configuración a reemplazar.
 */
async function crearEntorno(sobrescribir = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusreserva-test-'));
  const rutaBaseDatos = path.join(dir, 'prueba.db');
  let ahora = new Date(AHORA_PRUEBAS);

  const config = cargarConfig(
    { NODE_ENV: 'test', SESSION_SECRET: 'secreto-solo-para-pruebas-automatizadas', DEMO_MAILBOX: 'true' },
    {
      rutaBaseDatos,
      urlBase: 'http://localhost',
      passwordDemo: PASSWORD,
      limiteLogin: { ventanaMs: 15 * 60 * 1000, maximo: 1000 },
      ahora: () => ahora,
      ...sobrescribir,
    },
  );

  const db = abrirBaseDatos(rutaBaseDatos);
  aplicarEsquema(db);
  await sembrar(db, config);
  const app = crearApp({ db, config });

  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;

  return {
    url,
    db,
    config,
    rutaBaseDatos,
    /** Cambia la hora "actual" de la aplicación. */
    fijarAhora(iso) {
      ahora = new Date(iso);
    },
    /** Consulta de apoyo para verificar el estado de la base en las aserciones. */
    consultar(sql, ...params) {
      return db.prepare(sql).all(...params);
    },
    uno(sql, ...params) {
      return db.prepare(sql).get(...params);
    },
    cliente() {
      return new Cliente(url);
    },
    async cerrar() {
      await new Promise((resolve) => servidor.close(resolve));
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Cliente HTTP mínimo con manejo de cookies y token CSRF. */
class Cliente {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
    this.csrf = null;
  }

  encabezadoCookies() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  guardarCookies(respuesta) {
    for (const linea of respuesta.headers.getSetCookie()) {
      const [par, ...atributos] = linea.split(';');
      const [nombre, ...valor] = par.split('=');
      const expirada = atributos.some((a) => /max-age=0/i.test(a.trim()));
      if (expirada) this.cookies.delete(nombre.trim());
      else this.cookies.set(nombre.trim(), valor.join('='));
    }
  }

  async solicitar(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, redirect: 'manual', headers: { cookie: this.encabezadoCookies() } };
    if (cuerpo) {
      opciones.body = new URLSearchParams(cuerpo).toString();
      opciones.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    const respuesta = await fetch(this.base + ruta, opciones);
    this.guardarCookies(respuesta);
    const html = await respuesta.text();
    const token = html.match(/name="_csrf" value="([^"]+)"/);
    if (token) this.csrf = token[1];
    return {
      estado: respuesta.status,
      ubicacion: respuesta.headers.get('location'),
      cabeceras: respuesta.headers,
      html,
    };
  }

  get(ruta) {
    return this.solicitar('GET', ruta);
  }

  /** Envía un formulario incluyendo el token CSRF (obtiene uno si aún no lo tiene). */
  async post(ruta, campos = {}, { conCsrf = true } = {}) {
    if (conCsrf && !this.csrf) await this.get('/login');
    const cuerpo = conCsrf ? { _csrf: this.csrf, ...campos } : campos;
    return this.solicitar('POST', ruta, cuerpo);
  }

  /** Sigue una redirección (GET a la ubicación indicada). */
  seguir(respuesta) {
    return this.get(respuesta.ubicacion);
  }

  /**
   * Inicia sesión como lo haría un navegador: carga el formulario, lo envía y sigue la
   * redirección (así obtiene el token CSRF de la nueva sesión regenerada).
   * Devuelve la respuesta del POST /login.
   */
  async iniciarSesion(correo, contrasena = PASSWORD) {
    await this.get('/login');
    const respuesta = await this.post('/login', { correo, contrasena });
    if (respuesta.estado === 303) await this.seguir(respuesta);
    return respuesta;
  }
}

/** Busca el id de un espacio por nombre. */
function idEspacio(entorno, nombre) {
  return entorno.uno('SELECT id FROM espacio WHERE nombre = ?', nombre).id;
}

/** Busca el id de un bloque horario por espacio, día de semana y hora de inicio. */
function idHorario(entorno, espacioId, dia, inicio) {
  return entorno.uno(
    'SELECT id FROM horario WHERE espacio_id = ? AND dia_semana = ? AND hora_inicio = ?',
    espacioId,
    dia,
    inicio,
  ).id;
}

module.exports = { crearEntorno, Cliente, idEspacio, idHorario, AHORA_PRUEBAS, FECHAS, PASSWORD, CORREOS };
