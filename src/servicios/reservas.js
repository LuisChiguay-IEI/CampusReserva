/**
 * Servicio de reservas: revisar y confirmar una reserva (RF-04) y consultar o cancelar
 * las reservas propias (RF-05).
 *
 * Control de concurrencia (ADR-001): la verificación y la inserción se ejecutan en una
 * transacción BEGIN IMMEDIATE y, como respaldo final, el índice único parcial
 * `ux_reserva_confirmada` impide dos reservas confirmadas para el mismo bloque y fecha,
 * incluso si varios procesos del servidor escriben en la misma base.
 */
'use strict';

const { transaccion, esErrorUnico } = require('../db/conexion');
const { validarSeleccionReserva, ROLES_RESERVA } = require('../lib/validaciones');
const { diaSemana, sumarDias } = require('../lib/fechas');
const { codigoReserva } = require('../repositorios/reservas');
const {
  ErrorValidacion,
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorPermiso,
  ErrorApp,
} = require('../lib/errores');

const MENSAJE_OCUPADO =
  'Ese horario acaba de ser reservado por otra persona. Consulta nuevamente la disponibilidad y elige otra alternativa.';

/**
 * Agrega a una reserva leída de la base los campos derivados que usa la interfaz.
 * @param {object} reserva Fila de la tabla reserva con datos de espacio y sede.
 * @param {{fecha:string, hora:string}} ahora Fecha y hora locales actuales.
 */
function presentarReserva(reserva, ahora) {
  const comenzo = reserva.fecha < ahora.fecha || (reserva.fecha === ahora.fecha && reserva.hora_inicio <= ahora.hora);
  const termino = reserva.fecha < ahora.fecha || (reserva.fecha === ahora.fecha && reserva.hora_fin <= ahora.hora);
  let estadoVisible = reserva.estado === 'CANCELADA' ? 'Cancelada' : 'Confirmada';
  if (reserva.estado === 'CONFIRMADA' && termino) estadoVisible = 'Finalizada';
  else if (reserva.estado === 'CONFIRMADA' && comenzo) estadoVisible = 'En curso';
  return {
    ...reserva,
    codigo: codigoReserva(reserva.id),
    estadoVisible,
    esProxima: reserva.estado === 'CONFIRMADA' && !termino,
    cancelable: reserva.estado === 'CONFIRMADA' && !comenzo,
  };
}

/**
 * @param {object} deps
 * @param {import('node:sqlite').DatabaseSync} deps.db
 * @param {ReturnType<import('../repositorios').crearRepositorios>} deps.repos
 * @param {object} deps.config
 * @param {ReturnType<import('./reloj').crearReloj>} deps.reloj
 */
function crearServicioReservas({ db, repos, config, reloj }) {
  /**
   * Verifica todas las reglas para reservar un bloque. Se usa al revisar la selección
   * y otra vez al confirmar (dentro de la transacción), porque la disponibilidad pudo cambiar.
   * @returns {{espacio:object, horario:object, fecha:string}}
   */
  function verificarReservable(usuario, entrada) {
    if (!ROLES_RESERVA.includes(usuario.rol)) {
      throw new ErrorPermiso('Solo estudiantes y docentes pueden reservar espacios.');
    }
    const { ok, errores, datos } = validarSeleccionReserva(entrada);
    if (!ok) throw new ErrorValidacion(errores, 'La selección de reserva no es válida.');

    const ahora = reloj.local();
    if (datos.fecha < ahora.fecha || datos.fecha > sumarDias(ahora.fecha, config.maxDiasAnticipacion)) {
      throw new ErrorApp(422, `Solo se puede reservar desde hoy y hasta ${config.maxDiasAnticipacion} días después.`, 'FUERA_DE_RANGO');
    }

    const espacio = repos.espacios.buscarEspacio(datos.espacioId);
    if (!espacio) throw new ErrorNoEncontrado('El espacio seleccionado no existe.');
    if (!espacio.habilitado) throw new ErrorConflicto('El espacio seleccionado no está habilitado para reservas.', 'ESPACIO_DESHABILITADO');

    const horario = repos.espacios.buscarHorario(datos.horarioId);
    if (!horario || horario.espacio_id !== espacio.id || !horario.activo) {
      throw new ErrorNoEncontrado('El bloque horario seleccionado no existe para este espacio.');
    }
    if (horario.dia_semana !== diaSemana(datos.fecha)) {
      throw new ErrorApp(422, 'El bloque horario no corresponde al día de la fecha seleccionada.', 'DIA_INCORRECTO');
    }
    if (datos.fecha === ahora.fecha && horario.hora_inicio <= ahora.hora) {
      throw new ErrorConflicto('Ese bloque ya comenzó o terminó. Elige un horario posterior.', 'BLOQUE_INICIADO');
    }
    if (repos.espacios.estaBloqueado(horario.id, datos.fecha)) {
      throw new ErrorConflicto('Ese horario fue bloqueado por la administración.', 'BLOQUEADO');
    }
    if (repos.reservas.estaOcupado(horario.id, datos.fecha)) {
      throw new ErrorConflicto(MENSAJE_OCUPADO, 'OCUPADO');
    }
    return { espacio, horario, fecha: datos.fecha };
  }

  /**
   * RF-04 (paso de revisión): valida la selección sin escribir nada y devuelve el resumen.
   */
  function revisar(usuario, entrada) {
    return verificarReservable(usuario, entrada);
  }

  /**
   * RF-04 (confirmación): vuelve a comprobar la disponibilidad y guarda la reserva.
   * @returns {{id:number, codigo:string}}
   */
  function confirmar(usuario, entrada) {
    try {
      return transaccion(db, () => {
        const { espacio, horario, fecha } = verificarReservable(usuario, entrada);
        const id = repos.reservas.insertar({
          usuarioId: usuario.id,
          espacioId: espacio.id,
          horarioId: horario.id,
          fecha,
          horaInicio: horario.hora_inicio,
          horaFin: horario.hora_fin,
          creadoEn: reloj.ahoraIso(),
        });
        repos.auditoria.registrar({
          fecha: reloj.ahoraIso(),
          usuarioId: usuario.id,
          accion: 'RESERVA_CREADA',
          detalle: `${codigoReserva(id)} espacio=${espacio.id} horario=${horario.id} fecha=${fecha}`,
        });
        return { id, codigo: codigoReserva(id) };
      });
    } catch (error) {
      if (esErrorUnico(error)) throw new ErrorConflicto(MENSAJE_OCUPADO, 'OCUPADO');
      throw error;
    }
  }

  /**
   * RF-05: lista solo las reservas del usuario autenticado, separadas en próximas e historial.
   */
  function listarPropias(usuario) {
    const ahora = reloj.local();
    const todas = repos.reservas.listarDeUsuario(usuario.id).map((r) => presentarReserva(r, ahora));
    const proximas = todas.filter((r) => r.esProxima).reverse(); // la más cercana primero
    const historial = todas.filter((r) => !r.esProxima);
    return { proximas, historial };
  }

  /**
   * RF-05: obtiene una reserva propia. Si no existe o es de otra persona responde 404
   * (no se revela la existencia de reservas ajenas).
   */
  function obtenerPropia(usuario, reservaId) {
    const id = Number(reservaId);
    const reserva = Number.isInteger(id) && id > 0 ? repos.reservas.buscarDeUsuario(id, usuario.id) : undefined;
    if (!reserva) throw new ErrorNoEncontrado('La reserva no existe o no pertenece a tu cuenta.');
    return presentarReserva(reserva, reloj.local());
  }

  /**
   * RF-05: cancela una reserva propia confirmada cuyo bloque aún no comienza.
   * La reserva se conserva con estado CANCELADA (historial) y el horario queda libre.
   */
  function cancelar(usuario, reservaId) {
    return transaccion(db, () => {
      const reserva = obtenerPropia(usuario, reservaId);
      if (reserva.estado !== 'CONFIRMADA') {
        throw new ErrorConflicto('La reserva ya se encuentra cancelada.', 'YA_CANCELADA');
      }
      if (!reserva.cancelable) {
        throw new ErrorConflicto('Solo se pueden cancelar reservas cuyo bloque aún no ha comenzado.', 'NO_CANCELABLE');
      }
      repos.reservas.cancelar(reserva.id, usuario.id, reloj.ahoraIso());
      repos.auditoria.registrar({
        fecha: reloj.ahoraIso(),
        usuarioId: usuario.id,
        accion: 'RESERVA_CANCELADA',
        detalle: reserva.codigo,
      });
      return { id: reserva.id, codigo: reserva.codigo };
    });
  }

  return { revisar, confirmar, listarPropias, obtenerPropia, cancelar };
}

module.exports = { crearServicioReservas, presentarReserva, MENSAJE_OCUPADO };
