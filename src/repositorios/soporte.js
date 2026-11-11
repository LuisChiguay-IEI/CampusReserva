/**
 * Repositorios de soporte: sesiones del servidor y registro de auditoría.
 */
'use strict';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function crearRepositorioSesiones(db) {
  const sql = {
    buscar: db.prepare('SELECT datos, expira FROM sesion WHERE sid_hash = ? AND expira > ?'),
    guardar: db.prepare(
      `INSERT INTO sesion (sid_hash, datos, expira) VALUES (?, ?, ?)
       ON CONFLICT(sid_hash) DO UPDATE SET datos = excluded.datos, expira = excluded.expira`,
    ),
    eliminar: db.prepare('DELETE FROM sesion WHERE sid_hash = ?'),
    limpiar: db.prepare('DELETE FROM sesion WHERE expira <= ?'),
  };
  return {
    /** @returns {{datos: string, expira: number}|undefined} */
    buscar: (sidHash, ahoraMs) => sql.buscar.get(sidHash, ahoraMs),
    guardar: (sidHash, datos, expiraMs) => sql.guardar.run(sidHash, datos, expiraMs),
    eliminar: (sidHash) => sql.eliminar.run(sidHash),
    /** @returns {number} sesiones expiradas eliminadas */
    limpiarExpiradas: (ahoraMs) => Number(sql.limpiar.run(ahoraMs).changes),
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function crearRepositorioAuditoria(db) {
  const sql = {
    registrar: db.prepare('INSERT INTO auditoria (fecha, usuario_id, accion, detalle) VALUES (?, ?, ?, ?)'),
    recientes: db.prepare(
      `SELECT a.*, u.correo AS usuario_correo, u.rol AS usuario_rol
       FROM auditoria a LEFT JOIN usuario u ON u.id = a.usuario_id
       ORDER BY a.id DESC LIMIT ?`,
    ),
    contarPorAccion: db.prepare('SELECT COUNT(*) AS total FROM auditoria WHERE accion = ?'),
  };
  return {
    /**
     * Registra un evento. No se guardan contraseñas, tokens ni direcciones IP (minimización de datos).
     * @param {{fecha:string, usuarioId?:number|null, accion:string, detalle?:string}} evento
     */
    registrar: (evento) =>
      sql.registrar.run(evento.fecha, evento.usuarioId ?? null, evento.accion, evento.detalle ?? null),
    recientes: (limite = 100) => sql.recientes.all(limite),
    contarPorAccion: (accion) => Number(sql.contarPorAccion.get(accion).total),
  };
}

module.exports = { crearRepositorioSesiones, crearRepositorioAuditoria };
