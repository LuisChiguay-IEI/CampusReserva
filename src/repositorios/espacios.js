/**
 * Repositorio de sedes, espacios (salas y laboratorios), horarios y bloqueos.
 */
'use strict';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function crearRepositorioEspacios(db) {
  const sql = {
    listarSedes: db.prepare('SELECT * FROM sede ORDER BY nombre'),
    buscarSede: db.prepare('SELECT * FROM sede WHERE id = ?'),

    listarEspacios: db.prepare(
      `SELECT e.*, s.nombre AS sede_nombre,
              (SELECT COUNT(*) FROM horario h WHERE h.espacio_id = e.id AND h.activo = 1) AS bloques_activos
       FROM espacio e JOIN sede s ON s.id = e.sede_id
       WHERE (?1 IS NULL OR e.sede_id = ?1)
       ORDER BY s.nombre, e.tipo, e.nombre`,
    ),
    listarEspaciosDeSede: db.prepare('SELECT id, nombre, tipo FROM espacio WHERE sede_id = ? ORDER BY tipo, nombre'),
    listarHabilitadosDeSede: db.prepare(
      `SELECT * FROM espacio
       WHERE sede_id = ?1 AND habilitado = 1 AND (?2 IS NULL OR id = ?2)
       ORDER BY tipo, nombre`,
    ),
    buscarEspacio: db.prepare(
      `SELECT e.*, s.nombre AS sede_nombre FROM espacio e JOIN sede s ON s.id = e.sede_id WHERE e.id = ?`,
    ),
    insertarEspacio: db.prepare(
      `INSERT INTO espacio (sede_id, nombre, tipo, capacidad, habilitado, creado_en)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ),
    actualizarEspacio: db.prepare(
      'UPDATE espacio SET nombre = ?, tipo = ?, capacidad = ?, actualizado_en = ? WHERE id = ?',
    ),
    cambiarHabilitado: db.prepare('UPDATE espacio SET habilitado = ?, actualizado_en = ? WHERE id = ?'),

    listarHorarios: db.prepare(
      'SELECT * FROM horario WHERE espacio_id = ? ORDER BY dia_semana, hora_inicio',
    ),
    listarHorariosActivosDelDia: db.prepare(
      `SELECT * FROM horario WHERE espacio_id = ? AND dia_semana = ? AND activo = 1 ORDER BY hora_inicio`,
    ),
    horariosActivosDeSedeYDia: db.prepare(
      `SELECT h.* FROM horario h JOIN espacio e ON e.id = h.espacio_id
       WHERE e.sede_id = ? AND h.dia_semana = ? AND h.activo = 1
       ORDER BY h.hora_inicio`,
    ),
    buscarHorario: db.prepare('SELECT * FROM horario WHERE id = ?'),
    insertarHorario: db.prepare(
      'INSERT INTO horario (espacio_id, dia_semana, hora_inicio, hora_fin, activo) VALUES (?, ?, ?, ?, 1)',
    ),
    actualizarHorario: db.prepare(
      'UPDATE horario SET dia_semana = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?',
    ),
    cambiarActivoHorario: db.prepare('UPDATE horario SET activo = ? WHERE id = ?'),

    listarBloqueosFuturos: db.prepare(
      `SELECT b.*, h.hora_inicio, h.hora_fin, h.dia_semana
       FROM bloqueo b JOIN horario h ON h.id = b.horario_id
       WHERE h.espacio_id = ? AND b.fecha >= ?
       ORDER BY b.fecha, h.hora_inicio`,
    ),
    bloqueosDeSedeYFecha: db.prepare(
      `SELECT b.horario_id FROM bloqueo b
       JOIN horario h ON h.id = b.horario_id JOIN espacio e ON e.id = h.espacio_id
       WHERE e.sede_id = ? AND b.fecha = ?`,
    ),
    buscarBloqueo: db.prepare(
      `SELECT b.*, h.espacio_id FROM bloqueo b JOIN horario h ON h.id = b.horario_id WHERE b.id = ?`,
    ),
    existeBloqueo: db.prepare('SELECT id FROM bloqueo WHERE horario_id = ? AND fecha = ?'),
    insertarBloqueo: db.prepare(
      'INSERT INTO bloqueo (horario_id, fecha, motivo, creado_por, creado_en) VALUES (?, ?, ?, ?, ?)',
    ),
    eliminarBloqueo: db.prepare('DELETE FROM bloqueo WHERE id = ?'),
  };

  return {
    listarSedes: () => sql.listarSedes.all(),
    buscarSede: (id) => sql.buscarSede.get(id),

    /** @param {number|null} sedeId null = todas las sedes */
    listarEspacios: (sedeId = null) => sql.listarEspacios.all(sedeId),
    listarEspaciosDeSede: (sedeId) => sql.listarEspaciosDeSede.all(sedeId),
    /** Espacios habilitados de una sede; si `espacioId` viene, filtra por ese espacio. */
    listarHabilitadosDeSede: (sedeId, espacioId = null) => sql.listarHabilitadosDeSede.all(sedeId, espacioId),
    buscarEspacio: (id) => sql.buscarEspacio.get(id),
    /** @returns {number} id del espacio creado */
    insertarEspacio: (e) =>
      Number(sql.insertarEspacio.run(e.sedeId, e.nombre, e.tipo, e.capacidad, e.creadoEn).lastInsertRowid),
    actualizarEspacio: (id, e) => sql.actualizarEspacio.run(e.nombre, e.tipo, e.capacidad, e.actualizadoEn, id),
    cambiarHabilitado: (id, habilitado, fecha) => sql.cambiarHabilitado.run(habilitado ? 1 : 0, fecha, id),

    listarHorarios: (espacioId) => sql.listarHorarios.all(espacioId),
    listarHorariosActivosDelDia: (espacioId, dia) => sql.listarHorariosActivosDelDia.all(espacioId, dia),
    horariosActivosDeSedeYDia: (sedeId, dia) => sql.horariosActivosDeSedeYDia.all(sedeId, dia),
    buscarHorario: (id) => sql.buscarHorario.get(id),
    /** @returns {number} id del horario creado */
    insertarHorario: (espacioId, h) =>
      Number(sql.insertarHorario.run(espacioId, h.diaSemana, h.horaInicio, h.horaFin).lastInsertRowid),
    actualizarHorario: (id, h) => sql.actualizarHorario.run(h.diaSemana, h.horaInicio, h.horaFin, id),
    cambiarActivoHorario: (id, activo) => sql.cambiarActivoHorario.run(activo ? 1 : 0, id),

    listarBloqueosFuturos: (espacioId, desde) => sql.listarBloqueosFuturos.all(espacioId, desde),
    /** @returns {Set<number>} ids de horarios bloqueados en esa sede y fecha */
    horariosBloqueados: (sedeId, fecha) =>
      new Set(sql.bloqueosDeSedeYFecha.all(sedeId, fecha).map((f) => f.horario_id)),
    buscarBloqueo: (id) => sql.buscarBloqueo.get(id),
    estaBloqueado: (horarioId, fecha) => Boolean(sql.existeBloqueo.get(horarioId, fecha)),
    insertarBloqueo: (b) =>
      Number(sql.insertarBloqueo.run(b.horarioId, b.fecha, b.motivo, b.creadoPor, b.creadoEn).lastInsertRowid),
    eliminarBloqueo: (id) => sql.eliminarBloqueo.run(id).changes === 1,
  };
}

module.exports = { crearRepositorioEspacios };
