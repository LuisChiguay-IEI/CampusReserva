/**
 * Repositorio de reservas.
 *
 * Las consultas de una reserva puntual incluyen siempre `usuario_id = ?`: la pertenencia
 * se verifica en la misma consulta, de modo que un identificador ajeno no devuelve datos
 * (prevención de IDOR, OWASP A01 Broken Access Control).
 */
'use strict';

const COLUMNAS_DETALLE = `
  r.*, e.nombre AS espacio_nombre, e.tipo AS espacio_tipo, e.capacidad AS espacio_capacidad,
  s.nombre AS sede_nombre`;

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function crearRepositorioReservas(db) {
  const sql = {
    insertar: db.prepare(
      `INSERT INTO reserva (usuario_id, espacio_id, horario_id, fecha, hora_inicio, hora_fin, estado, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?)`,
    ),
    estaOcupado: db.prepare(
      `SELECT id FROM reserva WHERE horario_id = ? AND fecha = ? AND estado = 'CONFIRMADA' LIMIT 1`,
    ),
    ocupadosDeSedeYFecha: db.prepare(
      `SELECT r.horario_id FROM reserva r JOIN espacio e ON e.id = r.espacio_id
       WHERE e.sede_id = ? AND r.fecha = ? AND r.estado = 'CONFIRMADA'`,
    ),
    listarDeUsuario: db.prepare(
      `SELECT ${COLUMNAS_DETALLE}
       FROM reserva r JOIN espacio e ON e.id = r.espacio_id JOIN sede s ON s.id = e.sede_id
       WHERE r.usuario_id = ?
       ORDER BY r.fecha DESC, r.hora_inicio DESC`,
    ),
    buscarDeUsuario: db.prepare(
      `SELECT ${COLUMNAS_DETALLE}
       FROM reserva r JOIN espacio e ON e.id = r.espacio_id JOIN sede s ON s.id = e.sede_id
       WHERE r.id = ? AND r.usuario_id = ?`,
    ),
    cancelar: db.prepare(
      `UPDATE reserva SET estado = 'CANCELADA', cancelado_en = ?
       WHERE id = ? AND usuario_id = ? AND estado = 'CONFIRMADA'`,
    ),
    futurasDeEspacio: db.prepare(
      `SELECT id, fecha, hora_inicio, hora_fin FROM reserva
       WHERE espacio_id = ?1 AND estado = 'CONFIRMADA'
         AND (fecha > ?2 OR (fecha = ?2 AND hora_fin > ?3))
       ORDER BY fecha, hora_inicio`,
    ),
    futurasDeHorario: db.prepare(
      `SELECT id, fecha, hora_inicio, hora_fin FROM reserva
       WHERE horario_id = ?1 AND estado = 'CONFIRMADA'
         AND (fecha > ?2 OR (fecha = ?2 AND hora_fin > ?3))
       ORDER BY fecha, hora_inicio`,
    ),
    confirmadaEnHorarioYFecha: db.prepare(
      `SELECT id, fecha, hora_inicio, hora_fin FROM reserva
       WHERE horario_id = ? AND fecha = ? AND estado = 'CONFIRMADA'`,
    ),
    contarConfirmadas: db.prepare(
      `SELECT COUNT(*) AS total FROM reserva WHERE horario_id = ? AND fecha = ? AND estado = 'CONFIRMADA'`,
    ),
    contarVigentesDeUsuario: db.prepare(
      `SELECT COUNT(*) AS total FROM reserva
       WHERE usuario_id = ?1 AND estado = 'CONFIRMADA'
         AND (fecha > ?2 OR (fecha = ?2 AND hora_fin > ?3))`,
    ),
  };

  return {
    /**
     * Inserta una reserva confirmada. Si ya existe otra confirmada para el mismo bloque y fecha,
     * SQLite lanza un error UNIQUE (índice ux_reserva_confirmada).
     * @returns {number} id de la reserva
     */
    insertar: (r) =>
      Number(
        sql.insertar.run(r.usuarioId, r.espacioId, r.horarioId, r.fecha, r.horaInicio, r.horaFin, r.creadoEn)
          .lastInsertRowid,
      ),
    estaOcupado: (horarioId, fecha) => Boolean(sql.estaOcupado.get(horarioId, fecha)),
    /** @returns {Set<number>} ids de horarios con reserva confirmada en esa sede y fecha */
    horariosOcupados: (sedeId, fecha) =>
      new Set(sql.ocupadosDeSedeYFecha.all(sedeId, fecha).map((f) => f.horario_id)),
    listarDeUsuario: (usuarioId) => sql.listarDeUsuario.all(usuarioId),
    buscarDeUsuario: (id, usuarioId) => sql.buscarDeUsuario.get(id, usuarioId),
    /** @returns {boolean} true si se canceló (solo reservas propias y confirmadas). */
    cancelar: (id, usuarioId, fecha) => sql.cancelar.run(fecha, id, usuarioId).changes === 1,
    /** Reservas confirmadas que aún no terminan para un espacio. */
    futurasDeEspacio: (espacioId, hoy, hora) => sql.futurasDeEspacio.all(espacioId, hoy, hora),
    /** Reservas confirmadas que aún no terminan para un bloque horario. */
    futurasDeHorario: (horarioId, hoy, hora) => sql.futurasDeHorario.all(horarioId, hoy, hora),
    confirmadaEnHorarioYFecha: (horarioId, fecha) => sql.confirmadaEnHorarioYFecha.get(horarioId, fecha),
    contarConfirmadas: (horarioId, fecha) => Number(sql.contarConfirmadas.get(horarioId, fecha).total),
    /** Reservas confirmadas del usuario que aún no terminan (vigentes). */
    contarVigentesDeUsuario: (usuarioId, hoy, hora) =>
      Number(sql.contarVigentesDeUsuario.get(usuarioId, hoy, hora).total),
  };
}

/**
 * Código legible de una reserva a partir de su id (p. ej. 42 -> "CR-000042").
 * @param {number} id
 * @returns {string}
 */
function codigoReserva(id) {
  return `CR-${String(id).padStart(6, '0')}`;
}

module.exports = { crearRepositorioReservas, codigoReserva };
