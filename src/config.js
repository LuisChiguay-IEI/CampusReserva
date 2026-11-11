/**
 * Configuración centralizada de CampusReserva.
 *
 * Todos los valores sensibles o dependientes del entorno se leen desde variables
 * de entorno (ver .env.example). Así el mismo código funciona en local y en un
 * PaaS sin modificar archivos ni subir secretos al repositorio.
 */
'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Convierte un texto "true"/"false" en booleano, usando un valor por defecto.
 * @param {string|undefined} valor
 * @param {boolean} porDefecto
 * @returns {boolean}
 */
function aBooleano(valor, porDefecto) {
  if (valor === undefined || valor === '') return porDefecto;
  return String(valor).toLowerCase() === 'true';
}

/**
 * Convierte un texto en entero positivo, usando un valor por defecto si no es válido.
 * @param {string|undefined} valor
 * @param {number} porDefecto
 * @returns {number}
 */
function aEntero(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
}

/**
 * Construye el objeto de configuración.
 * @param {NodeJS.ProcessEnv} [env=process.env] Variables de entorno.
 * @param {object} [sobrescribir] Valores que reemplazan a los calculados (útil en pruebas).
 * @returns {object} Configuración inmutable de la aplicación.
 */
function cargarConfig(env = process.env, sobrescribir = {}) {
  const esProduccion = env.NODE_ENV === 'production';
  const puerto = aEntero(env.PORT, 3000);

  let secretoSesion = env.SESSION_SECRET;
  if (!secretoSesion || secretoSesion.startsWith('reemplazar')) {
    if (esProduccion) {
      throw new Error('SESSION_SECRET es obligatorio en producción (ver .env.example).');
    }
    // En desarrollo se genera uno aleatorio por arranque: nunca queda escrito en el código.
    secretoSesion = crypto.randomBytes(32).toString('hex');
  }

  const config = {
    entorno: env.NODE_ENV || 'development',
    esProduccion,
    puerto,
    urlBase: (env.BASE_URL || `http://localhost:${puerto}`).replace(/\/$/, ''),
    rutaBaseDatos: env.DB_PATH || path.join(__dirname, '..', 'data', 'campusreserva.db'),
    secretoSesion,
    minutosInactividadSesion: aEntero(env.SESSION_IDLE_MINUTES, 30),
    zonaHoraria: env.APP_TZ || 'America/Santiago',
    dominioInstitucional: (env.INSTITUTIONAL_DOMAIN || 'campus.test').toLowerCase(),
    maxDiasAnticipacion: aEntero(env.MAX_DIAS_ANTICIPACION, 30),
    horasValidezEnlace: 24,
    limiteLogin: { ventanaMs: 15 * 60 * 1000, maximo: aEntero(env.LOGIN_MAX_INTENTOS, 10) },
    buzonDemo: aBooleano(env.DEMO_MAILBOX, !esProduccion),
    seedDemo: aBooleano(env.SEED_DEMO, !esProduccion),
    passwordDemo: env.DEMO_PASSWORD || 'CampusDemo2026',
    confiarEnProxy: aBooleano(env.TRUST_PROXY, false),
    /** Reloj inyectable: permite pruebas deterministas sobre fechas y horas. */
    ahora: () => new Date(),
    ...sobrescribir,
  };

  return Object.freeze(config);
}

module.exports = { cargarConfig };
