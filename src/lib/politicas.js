/**
 * Políticas de reserva por rol (funciones puras, sin acceso a datos).
 *
 * Reglas de CampusReserva:
 *  - Los docentes y la administración reservan cualquier espacio (salas de clases,
 *    laboratorios y salas de estudio) con hasta 30 días de anticipación.
 *  - Los estudiantes solo reservan salas de estudio, con hasta 7 días de anticipación y
 *    un máximo de 2 reservas vigentes. Así un estudiante no ocupa una sala de clases o un
 *    laboratorio que un docente necesita para una clase.
 *  - Una reserva se puede cancelar hasta 60 minutos antes del inicio del bloque.
 * Los valores numéricos vienen de la configuración (ver src/config.js).
 */
'use strict';

const { minutosHasta } = require('./fechas');

/** Tipos de espacio y su nombre visible. */
const TIPOS_ESPACIO = Object.freeze(['SALA', 'LABORATORIO', 'SALA_ESTUDIO']);
const NOMBRES_TIPO = Object.freeze({ SALA: 'Sala de clases', LABORATORIO: 'Laboratorio', SALA_ESTUDIO: 'Sala de estudio' });

/** Roles que pueden reservar. */
const ROLES_RESERVA = Object.freeze(['ESTUDIANTE', 'DOCENTE', 'ADMINISTRADOR']);

/**
 * Tipos de espacio que puede reservar un rol.
 * @param {string} rol
 * @returns {string[]}
 */
function tiposReservables(rol) {
  if (rol === 'ESTUDIANTE') return ['SALA_ESTUDIO'];
  return ROLES_RESERVA.includes(rol) ? [...TIPOS_ESPACIO] : [];
}

/**
 * @param {string} rol
 * @param {string} tipo
 * @returns {boolean}
 */
function puedeReservarTipo(rol, tipo) {
  return tiposReservables(rol).includes(tipo);
}

/**
 * Días de anticipación con que puede reservar (y consultar) un rol.
 * @param {string} rol
 * @param {{maxDiasAnticipacion: number, maxDiasAnticipacionEstudiante: number}} config
 * @returns {number}
 */
function diasAnticipacion(rol, config) {
  return rol === 'ESTUDIANTE' ? config.maxDiasAnticipacionEstudiante : config.maxDiasAnticipacion;
}

/**
 * Máximo de reservas vigentes (confirmadas que aún no comienzan) de un rol; null = sin límite.
 * @param {string} rol
 * @param {{maxReservasVigentesEstudiante: number}} config
 * @returns {number|null}
 */
function limiteReservasVigentes(rol, config) {
  return rol === 'ESTUDIANTE' ? config.maxReservasVigentesEstudiante : null;
}

/**
 * Indica si una reserva confirmada todavía se puede cancelar: solo hasta `minutosLimite`
 * minutos antes de que comience su bloque.
 * @param {{estado: string, fecha: string, hora_inicio: string}} reserva
 * @param {{fecha: string, hora: string}} ahora
 * @param {number} minutosLimite
 * @returns {boolean}
 */
function esCancelable(reserva, ahora, minutosLimite) {
  return reserva.estado === 'CONFIRMADA' && minutosHasta(reserva.fecha, reserva.hora_inicio, ahora) >= minutosLimite;
}

module.exports = {
  TIPOS_ESPACIO,
  NOMBRES_TIPO,
  ROLES_RESERVA,
  tiposReservables,
  puedeReservarTipo,
  diasAnticipacion,
  limiteReservasVigentes,
  esCancelable,
};
