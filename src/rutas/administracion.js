/**
 * Rutas del administrador: espacios, horarios, bloqueos (RF-06) y registro de auditoría.
 * Todas exigen el rol ADMINISTRADOR en el servidor.
 */
'use strict';

const express = require('express');
const { ErrorApp, ErrorValidacion } = require('../lib/errores');
const { requiereRol } = require('../middleware/autorizacion');
const { NOMBRES_DIA } = require('../lib/fechas');

/**
 * @param {{servicios: object, repos: object, reloj: object}} deps
 */
function crearRutasAdministracion(deps) {
  const { servicios, repos, reloj } = deps;
  const admin = servicios.administracion;
  const router = express.Router();
  router.use('/admin', requiereRol(deps, 'ADMINISTRADOR'));

  /** Renderiza la página de horarios de un espacio, opcionalmente con errores de un formulario. */
  function renderHorarios(res, espacioId, extra = {}, estado = 200) {
    const datos = admin.obtenerHorariosYBloqueos(espacioId);
    res.status(estado).render('admin/horarios', {
      titulo: `Horarios — ${datos.espacio.nombre}`,
      ...datos,
      hoy: reloj.local().fecha,
      dias: NOMBRES_DIA,
      formHorario: { valores: {}, errores: {}, mensaje: null },
      formBloqueo: { valores: {}, errores: {}, mensaje: null },
      ...extra,
    });
  }

  /** Convierte un error de negocio en { errores, mensaje } para re-mostrar un formulario. */
  function errorDeFormulario(error) {
    if (error instanceof ErrorValidacion) return { errores: error.errores, mensaje: error.message };
    return { errores: {}, mensaje: error.message };
  }

  router.get('/admin', (req, res) => res.redirect(303, '/admin/espacios'));

  // ------------------------------------------------------------ Espacios

  router.get('/admin/espacios', (req, res) => {
    const sedeFiltro = typeof req.query.sede === 'string' ? req.query.sede : '';
    res.render('admin/espacios', {
      titulo: 'Administrar espacios',
      sedes: repos.espacios.listarSedes(),
      sedeFiltro,
      espacios: admin.listarEspacios(sedeFiltro),
    });
  });

  router.get('/admin/espacios/nuevo', (req, res) => {
    res.render('admin/espacio-form', {
      titulo: 'Registrar espacio',
      sedes: repos.espacios.listarSedes(),
      espacio: null,
      valores: { sede: typeof req.query.sede === 'string' ? req.query.sede : '' },
      errores: {},
    });
  });

  router.post('/admin/espacios', (req, res, next) => {
    try {
      const { id } = admin.crearEspacio(req.usuario, req.body);
      req.flash('exito', 'Espacio registrado. Ahora configura sus bloques horarios.');
      res.redirect(303, `/admin/espacios/${id}/horarios`);
    } catch (error) {
      if (!(error instanceof ErrorValidacion)) return next(error);
      res.status(422).render('admin/espacio-form', {
        titulo: 'Registrar espacio',
        sedes: repos.espacios.listarSedes(),
        espacio: null,
        valores: req.body,
        errores: error.errores,
      });
    }
  });

  router.get('/admin/espacios/:id/editar', (req, res) => {
    const espacio = admin.obtenerEspacio(req.params.id);
    res.render('admin/espacio-form', {
      titulo: `Editar ${espacio.nombre}`,
      sedes: repos.espacios.listarSedes(),
      espacio,
      valores: { nombre: espacio.nombre, tipo: espacio.tipo, capacidad: espacio.capacidad },
      errores: {},
    });
  });

  router.post('/admin/espacios/:id', (req, res, next) => {
    try {
      admin.editarEspacio(req.usuario, req.params.id, req.body);
      req.flash('exito', 'Cambios guardados.');
      res.redirect(303, '/admin/espacios');
    } catch (error) {
      if (!(error instanceof ErrorValidacion)) return next(error);
      const espacio = admin.obtenerEspacio(req.params.id);
      res.status(422).render('admin/espacio-form', {
        titulo: `Editar ${espacio.nombre}`,
        sedes: repos.espacios.listarSedes(),
        espacio,
        valores: req.body,
        errores: error.errores,
      });
    }
  });

  router.post('/admin/espacios/:id/estado', (req, res, next) => {
    try {
      const habilitar = req.body.accion === 'habilitar';
      const { nombre } = admin.cambiarEstadoEspacio(req.usuario, req.params.id, habilitar);
      req.flash('exito', `"${nombre}" quedó ${habilitar ? 'habilitado' : 'deshabilitado'}.`);
    } catch (error) {
      if (!(error instanceof ErrorApp) || error.estado === 403) return next(error);
      req.flash('error', error.message);
    }
    res.redirect(303, '/admin/espacios');
  });

  // ------------------------------------------------------------ Horarios y bloqueos

  router.get('/admin/espacios/:id/horarios', (req, res) => renderHorarios(res, req.params.id));

  router.post('/admin/espacios/:id/horarios', (req, res, next) => {
    try {
      admin.crearHorario(req.usuario, req.params.id, req.body);
      req.flash('exito', 'Bloque horario creado.');
      res.redirect(303, `/admin/espacios/${req.params.id}/horarios`);
    } catch (error) {
      if (!(error instanceof ErrorApp) || [403, 404].includes(error.estado)) return next(error);
      renderHorarios(res, req.params.id, { formHorario: { valores: req.body, ...errorDeFormulario(error) } }, error.estado);
    }
  });

  router.get('/admin/horarios/:id/editar', (req, res) => {
    const horario = admin.obtenerHorario(req.params.id);
    res.render('admin/horario-form', {
      titulo: 'Modificar bloque horario',
      horario,
      espacio: admin.obtenerEspacio(horario.espacio_id),
      dias: NOMBRES_DIA,
      valores: { dia: horario.dia_semana, inicio: horario.hora_inicio, fin: horario.hora_fin },
      errores: {},
      mensaje: null,
    });
  });

  router.post('/admin/horarios/:id', (req, res, next) => {
    try {
      const { espacioId } = admin.editarHorario(req.usuario, req.params.id, req.body);
      req.flash('exito', 'Bloque horario modificado.');
      res.redirect(303, `/admin/espacios/${espacioId}/horarios`);
    } catch (error) {
      if (!(error instanceof ErrorApp) || [403, 404].includes(error.estado)) return next(error);
      const horario = admin.obtenerHorario(req.params.id);
      res.status(error.estado).render('admin/horario-form', {
        titulo: 'Modificar bloque horario',
        horario,
        espacio: admin.obtenerEspacio(horario.espacio_id),
        dias: NOMBRES_DIA,
        valores: req.body,
        ...errorDeFormulario(error),
      });
    }
  });

  router.post('/admin/horarios/:id/estado', (req, res, next) => {
    let espacioId;
    try {
      const activar = req.body.accion === 'activar';
      ({ espacioId } = admin.cambiarEstadoHorario(req.usuario, req.params.id, activar));
      req.flash('exito', `Bloque horario ${activar ? 'activado' : 'desactivado'}.`);
    } catch (error) {
      if (!(error instanceof ErrorApp) || [403, 404].includes(error.estado)) return next(error);
      espacioId = admin.obtenerHorario(req.params.id).espacio_id;
      req.flash('error', error.message);
    }
    res.redirect(303, `/admin/espacios/${espacioId}/horarios`);
  });

  router.post('/admin/espacios/:id/bloqueos', (req, res, next) => {
    try {
      admin.crearBloqueo(req.usuario, req.params.id, req.body);
      req.flash('exito', 'Horario bloqueado para la fecha indicada.');
      res.redirect(303, `/admin/espacios/${req.params.id}/horarios`);
    } catch (error) {
      if (!(error instanceof ErrorApp) || [403, 404].includes(error.estado)) return next(error);
      renderHorarios(res, req.params.id, { formBloqueo: { valores: req.body, ...errorDeFormulario(error) } }, error.estado);
    }
  });

  router.post('/admin/bloqueos/:id/eliminar', (req, res) => {
    const { espacioId } = admin.eliminarBloqueo(req.usuario, req.params.id);
    req.flash('exito', 'Bloqueo eliminado: el horario vuelve a estar disponible.');
    res.redirect(303, `/admin/espacios/${espacioId}/horarios`);
  });

  // ------------------------------------------------------------ Auditoría

  router.get('/admin/auditoria', (req, res) => {
    res.render('admin/auditoria', { titulo: 'Registro de auditoría', eventos: admin.listarAuditoria(req.usuario, 150) });
  });

  return router;
}

module.exports = { crearRutasAdministracion };
