/**
 * Servicio de administración de espacios y horarios (RF-06). Solo lo usa el rol ADMINISTRADOR
 * (el control de acceso se aplica en las rutas y además aquí, como defensa en profundidad).
 *
 * Regla de diseño: ninguna operación modifica silenciosamente reservas confirmadas. Si un cambio
 * afectaría reservas que aún no terminan, se rechaza indicando cuáles son.
 */
'use strict';

const { transaccion, esErrorUnico } = require('../db/conexion');
const { validarEspacio, validarHorario, validarBloqueo, enteroPositivo } = require('../lib/validaciones');
const { diaSemana, haySuperposicion, formatearFecha, NOMBRES_DIA } = require('../lib/fechas');
const { codigoReserva } = require('../repositorios/reservas');
const { ErrorValidacion, ErrorConflicto, ErrorNoEncontrado, ErrorPermiso } = require('../lib/errores');

/**
 * Resume una lista de reservas afectadas para el mensaje de rechazo.
 * @param {Array<{id:number, fecha:string, hora_inicio:string}>} reservas
 * @returns {string}
 */
function describirReservas(reservas) {
  const primeras = reservas
    .slice(0, 5)
    .map((r) => `${codigoReserva(r.id)} (${formatearFecha(r.fecha)} ${r.hora_inicio})`);
  const resto = reservas.length > 5 ? ` y ${reservas.length - 5} más` : '';
  return primeras.join(', ') + resto;
}

/**
 * @param {object} deps
 * @param {import('node:sqlite').DatabaseSync} deps.db
 * @param {ReturnType<import('../repositorios').crearRepositorios>} deps.repos
 * @param {ReturnType<import('./reloj').crearReloj>} deps.reloj
 */
function crearServicioAdministracion({ db, repos, reloj }) {
  /** Defensa en profundidad: el servicio también exige el rol, no solo la ruta. */
  function exigirAdministrador(usuario) {
    if (!usuario || usuario.rol !== 'ADMINISTRADOR') throw new ErrorPermiso();
  }

  function auditar(usuario, accion, detalle) {
    repos.auditoria.registrar({ fecha: reloj.ahoraIso(), usuarioId: usuario.id, accion, detalle });
  }

  function obtenerEspacio(espacioId) {
    const id = enteroPositivo(espacioId);
    const espacio = id ? repos.espacios.buscarEspacio(id) : undefined;
    if (!espacio) throw new ErrorNoEncontrado('El espacio no existe.');
    return espacio;
  }

  function obtenerHorario(horarioId) {
    const id = enteroPositivo(horarioId);
    const horario = id ? repos.espacios.buscarHorario(id) : undefined;
    if (!horario) throw new ErrorNoEncontrado('El bloque horario no existe.');
    return horario;
  }

  /** Rechaza si el bloque se superpone con otro bloque activo del mismo espacio y día. */
  function verificarSinSuperposicion(espacioId, datos, excluirId = null) {
    const conflicto = repos.espacios
      .listarHorariosActivosDelDia(espacioId, datos.diaSemana)
      .find(
        (h) =>
          h.id !== excluirId &&
          haySuperposicion({ inicio: datos.horaInicio, fin: datos.horaFin }, { inicio: h.hora_inicio, fin: h.hora_fin }),
      );
    if (conflicto) {
      throw new ErrorConflicto(
        `El bloque se superpone con el bloque existente ${NOMBRES_DIA[conflicto.dia_semana]} ` +
          `${conflicto.hora_inicio}-${conflicto.hora_fin}.`,
        'SUPERPOSICION',
      );
    }
  }

  /** Rechaza si el bloque horario tiene reservas confirmadas que aún no terminan. */
  function verificarSinReservasFuturasHorario(horarioId, accion) {
    const { fecha, hora } = reloj.local();
    const futuras = repos.reservas.futurasDeHorario(horarioId, fecha, hora);
    if (futuras.length > 0) {
      throw new ErrorConflicto(
        `No se puede ${accion}: el bloque tiene ${futuras.length} reserva(s) confirmada(s) vigente(s): ` +
          `${describirReservas(futuras)}. El sistema no cancela reservas automáticamente.`,
        'RESERVAS_AFECTADAS',
      );
    }
  }

  // ----------------------------------------------------------------- Espacios

  function listarEspacios(sedeId) {
    return repos.espacios.listarEspacios(enteroPositivo(sedeId));
  }

  function crearEspacio(usuario, entrada) {
    exigirAdministrador(usuario);
    const { ok, errores, datos } = validarEspacio(entrada);
    if (!ok) throw new ErrorValidacion(errores);
    if (!repos.espacios.buscarSede(datos.sedeId)) throw new ErrorValidacion({ sede: 'La sede no existe.' });
    try {
      const id = repos.espacios.insertarEspacio({ ...datos, creadoEn: reloj.ahoraIso() });
      auditar(usuario, 'ESPACIO_CREADO', `espacio=${id} ${datos.nombre}`);
      return { id };
    } catch (error) {
      if (esErrorUnico(error)) throw new ErrorValidacion({ nombre: 'Ya existe un espacio con ese nombre en la sede.' });
      throw error;
    }
  }

  function editarEspacio(usuario, espacioId, entrada) {
    exigirAdministrador(usuario);
    const espacio = obtenerEspacio(espacioId);
    const { ok, errores, datos } = validarEspacio(entrada, { exigirSede: false });
    if (!ok) throw new ErrorValidacion(errores);
    try {
      repos.espacios.actualizarEspacio(espacio.id, { ...datos, actualizadoEn: reloj.ahoraIso() });
      auditar(usuario, 'ESPACIO_EDITADO', `espacio=${espacio.id} ${datos.nombre}`);
      return { id: espacio.id };
    } catch (error) {
      if (esErrorUnico(error)) throw new ErrorValidacion({ nombre: 'Ya existe un espacio con ese nombre en la sede.' });
      throw error;
    }
  }

  /**
   * Habilita o deshabilita un espacio. Deshabilitar se rechaza si hay reservas vigentes.
   * @param {boolean} habilitar
   */
  function cambiarEstadoEspacio(usuario, espacioId, habilitar) {
    exigirAdministrador(usuario);
    return transaccion(db, () => {
      const espacio = obtenerEspacio(espacioId);
      if (!habilitar) {
        const { fecha, hora } = reloj.local();
        const futuras = repos.reservas.futurasDeEspacio(espacio.id, fecha, hora);
        if (futuras.length > 0) {
          throw new ErrorConflicto(
            `No se puede deshabilitar "${espacio.nombre}": tiene ${futuras.length} reserva(s) confirmada(s) vigente(s): ` +
              `${describirReservas(futuras)}. El sistema no cancela reservas automáticamente.`,
            'RESERVAS_AFECTADAS',
          );
        }
      }
      repos.espacios.cambiarHabilitado(espacio.id, habilitar, reloj.ahoraIso());
      auditar(usuario, habilitar ? 'ESPACIO_HABILITADO' : 'ESPACIO_DESHABILITADO', `espacio=${espacio.id}`);
      return { id: espacio.id, nombre: espacio.nombre };
    });
  }

  // ----------------------------------------------------------------- Horarios

  function obtenerHorariosYBloqueos(espacioId) {
    const espacio = obtenerEspacio(espacioId);
    return {
      espacio,
      horarios: repos.espacios.listarHorarios(espacio.id),
      bloqueos: repos.espacios.listarBloqueosFuturos(espacio.id, reloj.local().fecha),
    };
  }

  function crearHorario(usuario, espacioId, entrada) {
    exigirAdministrador(usuario);
    const { ok, errores, datos } = validarHorario(entrada);
    if (!ok) throw new ErrorValidacion(errores);
    return transaccion(db, () => {
      const espacio = obtenerEspacio(espacioId);
      verificarSinSuperposicion(espacio.id, datos);
      const id = repos.espacios.insertarHorario(espacio.id, datos);
      auditar(usuario, 'HORARIO_CREADO', `horario=${id} espacio=${espacio.id} ${datos.diaSemana} ${datos.horaInicio}-${datos.horaFin}`);
      return { id, espacioId: espacio.id };
    });
  }

  function editarHorario(usuario, horarioId, entrada) {
    exigirAdministrador(usuario);
    const { ok, errores, datos } = validarHorario(entrada);
    if (!ok) throw new ErrorValidacion(errores);
    return transaccion(db, () => {
      const horario = obtenerHorario(horarioId);
      verificarSinReservasFuturasHorario(horario.id, 'modificar el bloque');
      if (horario.activo) verificarSinSuperposicion(horario.espacio_id, datos, horario.id);
      repos.espacios.actualizarHorario(horario.id, datos);
      auditar(usuario, 'HORARIO_EDITADO', `horario=${horario.id} ${datos.diaSemana} ${datos.horaInicio}-${datos.horaFin}`);
      return { id: horario.id, espacioId: horario.espacio_id };
    });
  }

  /**
   * Activa o desactiva un bloque horario semanal.
   * @param {boolean} activar
   */
  function cambiarEstadoHorario(usuario, horarioId, activar) {
    exigirAdministrador(usuario);
    return transaccion(db, () => {
      const horario = obtenerHorario(horarioId);
      if (activar) {
        verificarSinSuperposicion(horario.espacio_id, {
          diaSemana: horario.dia_semana,
          horaInicio: horario.hora_inicio,
          horaFin: horario.hora_fin,
        }, horario.id);
      } else {
        verificarSinReservasFuturasHorario(horario.id, 'desactivar el bloque');
      }
      repos.espacios.cambiarActivoHorario(horario.id, activar);
      auditar(usuario, activar ? 'HORARIO_ACTIVADO' : 'HORARIO_DESACTIVADO', `horario=${horario.id}`);
      return { id: horario.id, espacioId: horario.espacio_id };
    });
  }

  // ----------------------------------------------------------------- Bloqueos

  /** Bloquea un bloque horario en una fecha puntual. Se rechaza si ya tiene una reserva confirmada. */
  function crearBloqueo(usuario, espacioId, entrada) {
    exigirAdministrador(usuario);
    const { ok, errores, datos } = validarBloqueo(entrada, { hoy: reloj.local().fecha });
    if (!ok) throw new ErrorValidacion(errores);
    return transaccion(db, () => {
      const espacio = obtenerEspacio(espacioId);
      const horario = repos.espacios.buscarHorario(datos.horarioId);
      if (!horario || horario.espacio_id !== espacio.id || !horario.activo) {
        throw new ErrorValidacion({ horario: 'El bloque horario no pertenece a este espacio o está inactivo.' });
      }
      if (horario.dia_semana !== diaSemana(datos.fecha)) {
        throw new ErrorValidacion({
          fecha: `La fecha no corresponde al día del bloque (${NOMBRES_DIA[horario.dia_semana]}).`,
        });
      }
      if (repos.espacios.estaBloqueado(horario.id, datos.fecha)) {
        throw new ErrorConflicto('Ese bloque ya está bloqueado en la fecha indicada.', 'YA_BLOQUEADO');
      }
      const reserva = repos.reservas.confirmadaEnHorarioYFecha(horario.id, datos.fecha);
      if (reserva) {
        throw new ErrorConflicto(
          `No se puede bloquear: existe la reserva confirmada ${describirReservas([reserva])}. ` +
            'El sistema no cancela reservas automáticamente.',
          'RESERVAS_AFECTADAS',
        );
      }
      const id = repos.espacios.insertarBloqueo({ ...datos, creadoPor: usuario.id, creadoEn: reloj.ahoraIso() });
      auditar(usuario, 'BLOQUEO_CREADO', `bloqueo=${id} horario=${horario.id} fecha=${datos.fecha}`);
      return { id, espacioId: espacio.id };
    });
  }

  function eliminarBloqueo(usuario, bloqueoId) {
    exigirAdministrador(usuario);
    const id = enteroPositivo(bloqueoId);
    const bloqueo = id ? repos.espacios.buscarBloqueo(id) : undefined;
    if (!bloqueo) throw new ErrorNoEncontrado('El bloqueo no existe.');
    repos.espacios.eliminarBloqueo(bloqueo.id);
    auditar(usuario, 'BLOQUEO_ELIMINADO', `bloqueo=${bloqueo.id} horario=${bloqueo.horario_id} fecha=${bloqueo.fecha}`);
    return { espacioId: bloqueo.espacio_id };
  }

  function listarAuditoria(usuario, limite = 100) {
    exigirAdministrador(usuario);
    return repos.auditoria.recientes(limite);
  }

  return {
    listarEspacios,
    obtenerEspacio,
    crearEspacio,
    editarEspacio,
    cambiarEstadoEspacio,
    obtenerHorariosYBloqueos,
    obtenerHorario,
    crearHorario,
    editarHorario,
    cambiarEstadoHorario,
    crearBloqueo,
    eliminarBloqueo,
    listarAuditoria,
  };
}

module.exports = { crearServicioAdministracion, describirReservas };
