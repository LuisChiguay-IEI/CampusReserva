/**
 * Acceso a la base de datos SQLite mediante el módulo integrado `node:sqlite`.
 *
 * Todas las consultas del proyecto usan sentencias preparadas con parámetros (`?`),
 * nunca concatenación de texto, para prevenir inyección SQL (OWASP A05:2025 Injection).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const RUTA_ESQUEMA = path.join(__dirname, 'schema.sql');

/**
 * Abre (o crea) la base de datos y aplica la configuración de integridad y concurrencia.
 * @param {string} rutaArchivo Ruta del archivo .db o ':memory:'.
 * @returns {DatabaseSync}
 */
function abrirBaseDatos(rutaArchivo) {
  if (rutaArchivo !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(rutaArchivo)), { recursive: true });
  }
  const db = new DatabaseSync(rutaArchivo);
  // WAL: lectores y escritor concurrentes. busy_timeout: espera ordenada si otro proceso escribe.
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

/**
 * Crea las tablas e índices si no existen (idempotente).
 * @param {DatabaseSync} db
 */
function aplicarEsquema(db) {
  db.exec(fs.readFileSync(RUTA_ESQUEMA, 'utf8'));
}

/**
 * Ejecuta `fn` dentro de una transacción `BEGIN IMMEDIATE`.
 *
 * IMMEDIATE toma el bloqueo de escritura al iniciar, de modo que la verificación de
 * disponibilidad y la inserción se ejecutan como una sola unidad atómica (ADR-001).
 * Si `fn` lanza un error se revierte todo.
 *
 * @template T
 * @param {DatabaseSync} db
 * @param {() => T} fn Función síncrona con las operaciones de la transacción.
 * @returns {T}
 */
function transaccion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // La transacción ya pudo haber sido revertida por SQLite; no hay nada más que hacer.
    }
    throw error;
  }
}

/**
 * Indica si un error de SQLite corresponde a una violación de restricción UNIQUE.
 * @param {unknown} error
 * @returns {boolean}
 */
function esErrorUnico(error) {
  return Boolean(error && typeof error === 'object' && error.errcode === 2067);
}

module.exports = { abrirBaseDatos, aplicarEsquema, transaccion, esErrorUnico };
