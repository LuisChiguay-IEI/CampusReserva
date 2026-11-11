/**
 * Primitivas criptográficas: hash de contraseñas, tokens aleatorios y comparación segura.
 *
 * Contraseñas: scrypt (función de derivación resistente a fuerza bruta por uso intensivo de
 * memoria), con los parámetros mínimos recomendados por el OWASP Password Storage Cheat Sheet
 * (N = 2^17, r = 8, p = 1) y una sal aleatoria de 16 bytes por contraseña.
 * Se usa el módulo `crypto` integrado en Node.js, sin dependencias nativas externas.
 */
'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const PARAMETROS_SCRYPT = Object.freeze({ N: 2 ** 17, r: 8, p: 1 });
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;

/** Memoria máxima que scrypt puede usar (128 * N * r bytes, con holgura). */
function memoriaMaxima({ N, r }) {
  return 256 * N * r;
}

/**
 * Genera el hash de una contraseña. El resultado incluye algoritmo, parámetros y sal,
 * de modo que en el futuro se pueden endurecer los parámetros sin invalidar hashes antiguos.
 * Formato: scrypt$N$r$p$sal_base64$clave_base64
 * @param {string} contrasena
 * @returns {Promise<string>}
 */
async function hashContrasena(contrasena) {
  const { N, r, p } = PARAMETROS_SCRYPT;
  const sal = crypto.randomBytes(LARGO_SAL);
  const clave = await scrypt(contrasena, sal, LARGO_CLAVE, { N, r, p, maxmem: memoriaMaxima({ N, r }) });
  return ['scrypt', N, r, p, sal.toString('base64'), clave.toString('base64')].join('$');
}

/**
 * Verifica una contraseña contra un hash almacenado en tiempo constante.
 * @param {string} contrasena
 * @param {string} hashAlmacenado
 * @returns {Promise<boolean>}
 */
async function verificarContrasena(contrasena, hashAlmacenado) {
  const partes = String(hashAlmacenado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const N = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  const sal = Buffer.from(partes[4], 'base64');
  const esperado = Buffer.from(partes[5], 'base64');
  if (esperado.length === 0) return false;
  try {
    const obtenido = await scrypt(contrasena, sal, esperado.length, { N, r, p, maxmem: memoriaMaxima({ N, r }) });
    return crypto.timingSafeEqual(obtenido, esperado);
  } catch {
    // Parámetros corruptos en el hash almacenado: se trata como credencial inválida.
    return false;
  }
}

/**
 * Token aleatorio criptográficamente seguro, apto para URL.
 * @param {number} [bytes=32]
 * @returns {string}
 */
function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Hash SHA-256 en hexadecimal. Se usa para guardar tokens (confirmación, sesión)
 * sin almacenar su valor original.
 * @param {string} valor
 * @returns {string}
 */
function sha256(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex');
}

/**
 * Compara dos textos en tiempo constante (evita ataques de temporización).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  PARAMETROS_SCRYPT,
  hashContrasena,
  verificarContrasena,
  tokenAleatorio,
  sha256,
  compararSeguro,
};
