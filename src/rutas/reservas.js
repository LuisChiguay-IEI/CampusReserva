/**
 * Rutas de estudiantes y docentes: consultar disponibilidad (RF-03), reservar (RF-04)
 * y consultar o cancelar reservas propias (RF-05).
 */
'use strict';

const express = require('express');
const { ErrorValidacion, ErrorApp } = require('../lib/errores');
const { requiereRol } = require('../middleware/autorizacion');
const { tiposReservables, diasAnticipacion, limiteReservasVigentes } = require('../lib/politicas');

/**
 * Construye la URL de regreso a la consulta con los mismos filtros.
 * @param {number|null} sedeId
 * @param {string} [fecha]
 * @returns {string}
 */
function urlConsulta(sedeId, fecha) {
  const params = new URLSearchParams();
  if (sedeId) params.set('sede', String(sedeId));
  if (fecha) params.set('fecha', fecha);
  return `/disponibilidad?${params.toString()}`;
}

/**
 * @param {{servicios: object, repos: object, reloj: object}} deps
 */
function crearRutasReservas(deps) {
  const { servicios, repos, reloj, config } = deps;
  const router = express.Router();
  router.use(['/disponibilidad', '/reservas', '/mis-reservas'], requiereRol(deps, 'ESTUDIANTE', 'DOCENTE', 'ADMINISTRADOR'));

  // ------------------------------------------------------------ RF-03 Consultar disponibilidad

  router.get('/disponibilidad', (req, res, next) => {
    const tipos = tiposReservables(req.usuario.rol);
    const sedes = repos.espacios.listarSedes();
    const espaciosPorSede = sedes.map((s) => ({
      sede: s,
      espacios: repos.espacios.listarEspaciosDeSede(s.id).filter((e) => tipos.includes(e.tipo)),
    }));
    const hoy = reloj.local().fecha;
    const filtros = {
      sede: typeof req.query.sede === 'string' ? req.query.sede : '',
      fecha: typeof req.query.fecha === 'string' ? req.query.fecha : hoy,
      espacio: typeof req.query.espacio === 'string' ? req.query.espacio : '',
    };
    const politica = {
      esEstudiante: req.usuario.rol === 'ESTUDIANTE',
      dias: diasAnticipacion(req.usuario.rol, config),
      limite: limiteReservasVigentes(req.usuario.rol, config),
    };
    const vista = { titulo: 'Consultar disponibilidad', sedes, espaciosPorSede, filtros, hoy, politica, errores: {}, consulta: null };

    // Sin sede todavía: solo se muestra el formulario.
    if (!filtros.sede) return res.render('reservas/disponibilidad', vista);

    try {
      vista.consulta = servicios.disponibilidad.consultar(req.usuario, filtros);
      res.render('reservas/disponibilidad', vista);
    } catch (error) {
      if (!(error instanceof ErrorValidacion)) return next(error);
      res.status(422).render('reservas/disponibilidad', { ...vista, errores: error.errores });
    }
  });

  // ------------------------------------------------------------ RF-04 Reservar espacio

  // Paso 1: revisar la selección (no escribe nada).
  router.get('/reservas/nueva', (req, res, next) => {
    try {
      const seleccion = servicios.reservas.revisar(req.usuario, req.query);
      res.render('reservas/revisar', { titulo: 'Revisar reserva', ...seleccion });
    } catch (error) {
      if (error instanceof ErrorApp) error.volverA = urlConsulta(Number(req.query.sede) || null, req.query.fecha);
      next(error);
    }
  });

  // Paso 2: confirmar. El servicio vuelve a comprobar la disponibilidad dentro de una transacción.
  router.post('/reservas', (req, res, next) => {
    try {
      const { id, codigo } = servicios.reservas.confirmar(req.usuario, req.body);
      req.flash('exito', `Reserva ${codigo} confirmada.`);
      res.redirect(303, `/reservas/${id}`);
    } catch (error) {
      if (error instanceof ErrorApp) {
        const espacio = repos.espacios.buscarEspacio(Number(req.body.espacio) || 0);
        error.volverA = urlConsulta(espacio ? espacio.sede_id : null, req.body.fecha);
      }
      next(error);
    }
  });

  // ------------------------------------------------------------ RF-05 Mis reservas

  router.get('/mis-reservas', (req, res) => {
    const { proximas, historial } = servicios.reservas.listarPropias(req.usuario);
    res.render('reservas/mis-reservas', { titulo: 'Mis reservas', proximas, historial });
  });

  router.get('/reservas/:id', (req, res) => {
    const reserva = servicios.reservas.obtenerPropia(req.usuario, req.params.id);
    res.render('reservas/detalle', { titulo: `Reserva ${reserva.codigo}`, reserva });
  });

  // La cancelación requiere confirmación explícita: primero una página de confirmación (GET)…
  router.get('/reservas/:id/cancelar', (req, res) => {
    const reserva = servicios.reservas.obtenerPropia(req.usuario, req.params.id);
    res.render('reservas/cancelar', { titulo: 'Cancelar reserva', reserva });
  });

  // …y luego el envío del formulario (POST) con token CSRF.
  router.post('/reservas/:id/cancelar', (req, res, next) => {
    try {
      const { codigo } = servicios.reservas.cancelar(req.usuario, req.params.id);
      req.flash('exito', `Reserva ${codigo} cancelada. El horario quedó disponible para otras personas.`);
      res.redirect(303, '/mis-reservas');
    } catch (error) {
      if (error instanceof ErrorApp) error.volverA = '/mis-reservas';
      next(error);
    }
  });

  return router;
}

module.exports = { crearRutasReservas };
