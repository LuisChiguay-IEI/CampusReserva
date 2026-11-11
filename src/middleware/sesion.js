/**
 * Manejo de sesiones del lado del servidor (OWASP Session Management Cheat Sheet).
 *
 * - El navegador solo recibe un identificador aleatorio de 256 bits en una cookie
 *   HttpOnly + SameSite=Lax (+ Secure y prefijo __Host- en producción).
 * - En la base se guarda el hash SHA-256 del identificador, nunca su valor.
 * - Expiración por inactividad (configurable, 30 min por defecto) y expiración absoluta (8 h).
 * - `regenerar()` emite un identificador nuevo al iniciar sesión (evita fijación de sesión).
 * - `destruir()` invalida la sesión en el servidor al cerrar sesión.
 */
'use strict';

const { parse, serialize } = require('cookie');
const { tokenAleatorio, sha256 } = require('../lib/seguridad');

const DURACION_ABSOLUTA_MS = 8 * 60 * 60 * 1000;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const INTERVALO_LIMPIEZA_MS = 15 * 60 * 1000;

/**
 * @param {object} deps
 * @param {ReturnType<import('../repositorios').crearRepositorios>} deps.repos
 * @param {object} deps.config
 * @param {ReturnType<import('../servicios/reloj').crearReloj>} deps.reloj
 */
function crearMiddlewareSesion({ repos, config, reloj }) {
  const duracionInactividadMs = config.minutosInactividadSesion * 60 * 1000;
  const nombreCookie = config.esProduccion ? '__Host-cr_sesion' : 'cr_sesion';
  const opcionesCookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.esProduccion,
    path: '/',
  };

  // Limpieza periódica de sesiones expiradas; unref() evita mantener vivo el proceso.
  repos.sesiones.limpiarExpiradas(reloj.ahoraMs());
  setInterval(() => repos.sesiones.limpiarExpiradas(reloj.ahoraMs()), INTERVALO_LIMPIEZA_MS).unref();

  /** Lee y valida la sesión asociada a la cookie, si existe y no expiró. */
  function cargar(token) {
    if (!token || !FORMATO_TOKEN.test(token)) return null;
    const fila = repos.sesiones.buscar(sha256(token), reloj.ahoraMs());
    if (!fila) return null;
    try {
      const datos = JSON.parse(fila.datos);
      if (datos.creadaEn && reloj.ahoraMs() - datos.creadaEn > DURACION_ABSOLUTA_MS) {
        repos.sesiones.eliminar(sha256(token));
        return null;
      }
      return datos;
    } catch {
      return null;
    }
  }

  return function sesion(req, res, next) {
    let token = parse(req.headers.cookie || '')[nombreCookie];
    let datosCargados = cargar(token);
    if (!datosCargados) token = null;
    let borrarCookie = false;

    const sesionActual = {
      /** Datos de la sesión (se persisten automáticamente al responder). */
      datos: datosCargados || {},
      /** Invalida el identificador actual; al responder se emite uno nuevo. */
      regenerar() {
        if (token) repos.sesiones.eliminar(sha256(token));
        token = null;
        sesionActual.datos = { creadaEn: reloj.ahoraMs() };
      },
      /** Elimina la sesión en el servidor y la cookie en el navegador. */
      destruir() {
        if (token) repos.sesiones.eliminar(sha256(token));
        token = null;
        borrarCookie = true;
        sesionActual.datos = {};
      },
    };
    req.sesion = sesionActual;

    /** Mensajes de una sola lectura (patrón "flash") para mostrar tras una redirección. */
    req.flash = (tipo, texto) => {
      sesionActual.datos.flash = [...(sesionActual.datos.flash || []), { tipo, texto }];
    };

    // Se persiste la sesión justo antes de enviar la respuesta (aún se pueden escribir cabeceras).
    const finOriginal = res.end;
    res.end = function finConSesion(...args) {
      res.end = finOriginal;
      try {
        if (Object.keys(sesionActual.datos).length > 0) {
          if (!token) token = tokenAleatorio(32);
          if (!sesionActual.datos.creadaEn) sesionActual.datos.creadaEn = reloj.ahoraMs();
          repos.sesiones.guardar(
            sha256(token),
            JSON.stringify(sesionActual.datos),
            reloj.ahoraMs() + duracionInactividadMs,
          );
          if (!res.headersSent) {
            res.append(
              'Set-Cookie',
              serialize(nombreCookie, token, { ...opcionesCookie, maxAge: duracionInactividadMs / 1000 }),
            );
          }
        } else if (borrarCookie && !res.headersSent) {
          res.append('Set-Cookie', serialize(nombreCookie, '', { ...opcionesCookie, maxAge: 0 }));
        }
      } catch (error) {
        console.error('[sesion] No fue posible guardar la sesión:', error.message);
      }
      return finOriginal.apply(this, args);
    };

    next();
  };
}

module.exports = { crearMiddlewareSesion };
