/**
 * Autenticación y autorización por rol en el servidor (OWASP A01 Broken Access Control).
 *
 * El rol se lee desde la base en cada solicitud (no desde la cookie ni el formulario), de modo
 * que ocultar un botón en la interfaz nunca es el único control: toda ruta protegida exige
 * sesión y rol válidos.
 */
'use strict';

const { ErrorPermiso } = require('../lib/errores');

/** Página de inicio de cada rol. */
const INICIO_POR_ROL = Object.freeze({
  ESTUDIANTE: '/disponibilidad',
  DOCENTE: '/disponibilidad',
  ADMINISTRADOR: '/admin/espacios',
});

/**
 * Carga el usuario de la sesión desde la base. Si la cuenta ya no existe o no está activa,
 * la sesión se invalida.
 * @param {{repos: object, reloj: object}} deps
 */
function cargarUsuario({ repos }) {
  return function usuarioDeSesion(req, res, next) {
    const usuarioId = req.sesion.datos.usuarioId;
    if (usuarioId) {
      const usuario = repos.usuarios.buscarPorId(usuarioId);
      if (usuario && usuario.estado === 'ACTIVA') {
        req.usuario = { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol };
      } else {
        req.sesion.destruir();
      }
    }
    res.locals.usuario = req.usuario || null;
    next();
  };
}

/** Exige una sesión iniciada; si no existe, redirige al inicio de sesión. */
function requiereSesion(req, res, next) {
  if (req.usuario) return next();
  req.flash('info', 'Inicia sesión para continuar.');
  return res.redirect(303, '/login');
}

/**
 * Exige que el usuario autenticado tenga uno de los roles indicados.
 * Los intentos rechazados quedan registrados en la auditoría.
 * @param {{repos: object, reloj: object}} deps
 * @param {...string} roles
 */
function requiereRol({ repos, reloj }, ...roles) {
  return function verificarRol(req, res, next) {
    if (!req.usuario) return requiereSesion(req, res, next);
    if (roles.includes(req.usuario.rol)) return next();
    repos.auditoria.registrar({
      fecha: reloj.ahoraIso(),
      usuarioId: req.usuario.id,
      accion: 'ACCESO_DENEGADO',
      detalle: `${req.method} ${req.originalUrl.split('?')[0]}`,
    });
    return next(new ErrorPermiso('Tu rol no tiene permiso para acceder a esta sección.'));
  };
}

module.exports = { INICIO_POR_ROL, cargarUsuario, requiereSesion, requiereRol };
