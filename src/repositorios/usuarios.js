/**
 * Repositorio de cuentas: usuarios, listado institucional, tokens de confirmación
 * y buzón de demostración. Solo contiene acceso a datos (sin reglas de negocio).
 */
'use strict';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function crearRepositorioUsuarios(db) {
  const sql = {
    buscarPorCorreo: db.prepare('SELECT * FROM usuario WHERE correo = ?'),
    buscarPorId: db.prepare('SELECT * FROM usuario WHERE id = ?'),
    insertar: db.prepare(
      `INSERT INTO usuario (nombre, correo, password_hash, rol, estado, creado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    activar: db.prepare(
      "UPDATE usuario SET estado = 'ACTIVA', confirmado_en = ? WHERE id = ? AND estado = 'PENDIENTE'",
    ),
    rolAutorizado: db.prepare('SELECT rol FROM listado_institucional WHERE correo = ?'),
    insertarToken: db.prepare(
      'INSERT INTO token_confirmacion (usuario_id, token_hash, expira_en) VALUES (?, ?, ?)',
    ),
    buscarToken: db.prepare('SELECT * FROM token_confirmacion WHERE token_hash = ?'),
    marcarTokenUsado: db.prepare(
      'UPDATE token_confirmacion SET usado_en = ? WHERE id = ? AND usado_en IS NULL',
    ),
    tokenVigente: db.prepare(
      `SELECT id FROM token_confirmacion
       WHERE usuario_id = ? AND usado_en IS NULL AND expira_en > ? LIMIT 1`,
    ),
    insertarCorreo: db.prepare(
      `INSERT INTO correo_demo (destinatario, asunto, cuerpo, enlace, creado_en)
       VALUES (?, ?, ?, ?, ?)`,
    ),
    listarCorreos: db.prepare('SELECT * FROM correo_demo ORDER BY id DESC LIMIT ?'),
  };

  return {
    /** @param {string} correo */
    buscarPorCorreo: (correo) => sql.buscarPorCorreo.get(correo),
    /** @param {number} id */
    buscarPorId: (id) => sql.buscarPorId.get(id),
    /**
     * @param {{nombre:string, correo:string, passwordHash:string, rol:string, estado:string, creadoEn:string}} u
     * @returns {number} id del nuevo usuario
     */
    insertar: (u) =>
      Number(sql.insertar.run(u.nombre, u.correo, u.passwordHash, u.rol, u.estado, u.creadoEn).lastInsertRowid),
    /** @returns {boolean} true si la cuenta pasó de PENDIENTE a ACTIVA */
    activar: (id, fecha) => sql.activar.run(fecha, id).changes === 1,
    /** @returns {string|undefined} Rol definido en el listado institucional para ese correo. */
    rolAutorizado: (correo) => sql.rolAutorizado.get(correo)?.rol,
    insertarToken: (usuarioId, tokenHash, expiraEn) => sql.insertarToken.run(usuarioId, tokenHash, expiraEn),
    buscarToken: (tokenHash) => sql.buscarToken.get(tokenHash),
    /** @returns {boolean} true si el token se marcó como usado (evita doble uso). */
    marcarTokenUsado: (id, fecha) => sql.marcarTokenUsado.run(fecha, id).changes === 1,
    tieneTokenVigente: (usuarioId, ahoraIso) => Boolean(sql.tokenVigente.get(usuarioId, ahoraIso)),
    insertarCorreo: (c) => sql.insertarCorreo.run(c.destinatario, c.asunto, c.cuerpo, c.enlace, c.creadoEn),
    listarCorreos: (limite = 50) => sql.listarCorreos.all(limite),
  };
}

module.exports = { crearRepositorioUsuarios };
