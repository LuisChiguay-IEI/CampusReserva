/**
 * Ensamblado de la aplicación web (arquitectura en capas):
 *   rutas (presentación) -> servicios (reglas de negocio) -> repositorios (persistencia) -> SQLite
 *
 * `crearApp` recibe la base de datos y la configuración por parámetro (inyección de
 * dependencias), lo que permite levantar instancias aisladas en las pruebas de integración.
 */
'use strict';

const path = require('node:path');
const express = require('express');

const { crearRepositorios } = require('./repositorios');
const { crearReloj } = require('./servicios/reloj');
const { crearServicioAutenticacion } = require('./servicios/autenticacion');
const { crearServicioDisponibilidad } = require('./servicios/disponibilidad');
const { crearServicioReservas } = require('./servicios/reservas');
const { crearServicioAdministracion } = require('./servicios/administracion');
const { crearMiddlewareSesion } = require('./middleware/sesion');
const { cabecerasSeguridad, proteccionCsrf } = require('./middleware/seguridad');
const { cargarUsuario } = require('./middleware/autorizacion');
const { crearRutasCuentas } = require('./rutas/cuentas');
const { crearRutasReservas } = require('./rutas/reservas');
const { crearRutasAdministracion } = require('./rutas/administracion');
const { crearRutasDemo } = require('./rutas/demo');
const { ErrorApp } = require('./lib/errores');
const { formatearFecha, fechaHoraEnZona, NOMBRES_DIA } = require('./lib/fechas');
const { NOMBRES_TIPO } = require('./lib/politicas');

const ROLES_LEGIBLES = Object.freeze({
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  ADMINISTRADOR: 'Administrador',
});

const TITULOS_ERROR = Object.freeze({
  400: 'Solicitud no válida',
  401: 'Sesión requerida',
  403: 'Acceso denegado',
  404: 'No encontrado',
  409: 'No fue posible completar la operación',
  422: 'Datos no válidos',
  429: 'Demasiados intentos',
  500: 'Error interno',
});

/**
 * @param {{db: import('node:sqlite').DatabaseSync, config: object}} opciones
 * @returns {import('express').Express}
 */
function crearApp({ db, config }) {
  const repos = crearRepositorios(db);
  const reloj = crearReloj(config);
  const servicios = {
    autenticacion: crearServicioAutenticacion({ db, repos, config, reloj }),
    disponibilidad: crearServicioDisponibilidad({ repos, config, reloj }),
    reservas: crearServicioReservas({ db, repos, config, reloj }),
    administracion: crearServicioAdministracion({ db, repos, reloj }),
  };
  const deps = { servicios, repos, config, reloj };

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'vistas'));
  app.disable('x-powered-by');
  if (config.confiarEnProxy) app.set('trust proxy', 1);

  // Archivos estáticos (CSS, JS, íconos) antes de la sesión: no la necesitan.
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: false }));

  // Variables disponibles en todas las vistas (se definen primero para que incluso la
  // página de error pueda mostrarse si algo falla antes de cargar la sesión).
  app.use((req, res, next) => {
    res.locals.rutaActual = req.path;
    res.locals.usuario = null;
    res.locals.csrfToken = '';
    res.locals.buzonDemo = config.buzonDemo;
    res.locals.dominioInstitucional = config.dominioInstitucional;
    res.locals.formatearFecha = formatearFecha;
    res.locals.formatearInstante = (iso) => {
      const { fecha, hora } = fechaHoraEnZona(new Date(iso), config.zonaHoraria);
      return `${fecha.split('-').reverse().join('-')} ${hora}`;
    };
    res.locals.nombresDia = NOMBRES_DIA;
    res.locals.rolLegible = (rol) => ROLES_LEGIBLES[rol] || rol;
    res.locals.tipoLegible = (tipo) => NOMBRES_TIPO[tipo] || tipo;
    res.locals.minutosLimiteCancelacion = config.minutosLimiteCancelacion;
    // Los mensajes flash se leen (y eliminan) solo cuando una vista los muestra.
    res.locals.tomarMensajes = () => {
      if (!req.sesion) return [];
      const mensajes = req.sesion.datos.flash || [];
      delete req.sesion.datos.flash;
      return mensajes;
    };
    next();
  });

  app.use(cabecerasSeguridad(config));
  app.use(express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 50 }));
  app.use(crearMiddlewareSesion({ repos, config, reloj }));
  app.use(cargarUsuario({ repos }));
  app.use(proteccionCsrf());

  app.use(crearRutasCuentas(deps));
  app.use(crearRutasReservas(deps));
  app.use(crearRutasAdministracion(deps));
  if (config.buzonDemo) app.use(crearRutasDemo(deps));

  // 404 para cualquier ruta no definida.
  app.use((req, res) => {
    res.status(404).render('error', {
      titulo: TITULOS_ERROR[404],
      estado: 404,
      mensaje: 'La página que buscas no existe.',
      volverA: null,
    });
  });

  // Manejador central de errores: mensajes seguros, sin trazas ni SQL (OWASP A10:2025).
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    const controlado = error instanceof ErrorApp;
    const estado = controlado ? error.estado : 500;
    if (!controlado) {
      console.error(`[error] ${req.method} ${req.originalUrl}:`, error);
      try {
        repos.auditoria.registrar({
          fecha: reloj.ahoraIso(),
          usuarioId: req.usuario ? req.usuario.id : null,
          accion: 'ERROR_INTERNO',
          detalle: `${req.method} ${req.path}`,
        });
      } catch {
        // Si la base no está disponible no se puede auditar; el error ya quedó en consola.
      }
    } else if (estado === 403 && req.usuario && !error.auditado) {
      // Permiso denegado por una regla de negocio (p. ej., un estudiante que intenta reservar una
      // sala de clases manipulando la solicitud). Se audita aquí, fuera de la transacción revertida.
      repos.auditoria.registrar({
        fecha: reloj.ahoraIso(),
        usuarioId: req.usuario.id,
        accion: 'ACCESO_DENEGADO',
        detalle: `${req.method} ${req.path}`,
      });
    }
    if (res.headersSent) return;
    res.status(estado).render('error', {
      titulo: TITULOS_ERROR[estado] || 'Error',
      estado,
      mensaje: controlado ? error.message : 'Ocurrió un error inesperado. Inténtalo nuevamente en unos minutos.',
      volverA: error.volverA || null,
    });
  });

  return app;
}

module.exports = { crearApp };
