/**
 * Punto único de creación de repositorios (capa de persistencia).
 */
'use strict';

const { crearRepositorioUsuarios } = require('./usuarios');
const { crearRepositorioEspacios } = require('./espacios');
const { crearRepositorioReservas } = require('./reservas');
const { crearRepositorioSesiones, crearRepositorioAuditoria } = require('./soporte');

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function crearRepositorios(db) {
  return {
    usuarios: crearRepositorioUsuarios(db),
    espacios: crearRepositorioEspacios(db),
    reservas: crearRepositorioReservas(db),
    sesiones: crearRepositorioSesiones(db),
    auditoria: crearRepositorioAuditoria(db),
  };
}

module.exports = { crearRepositorios };
