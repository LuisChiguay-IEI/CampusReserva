/**
 * Servicio de cuentas: registro (RF-01), confirmación de correo (RF-01) e inicio de sesión (RF-02).
 */
'use strict';

const { transaccion, esErrorUnico } = require('../db/conexion');
const {
  hashContrasena,
  verificarContrasena,
  tokenAleatorio,
  sha256,
} = require('../lib/seguridad');
const { validarRegistro, validarLogin } = require('../lib/validaciones');
const { ErrorValidacion, ErrorAutenticacion, ErrorApp } = require('../lib/errores');

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';

/**
 * @param {object} deps
 * @param {import('node:sqlite').DatabaseSync} deps.db
 * @param {ReturnType<import('../repositorios').crearRepositorios>} deps.repos
 * @param {object} deps.config
 * @param {ReturnType<import('./reloj').crearReloj>} deps.reloj
 */
function crearServicioAutenticacion({ db, repos, config, reloj }) {
  /** Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe. */
  let hashFicticio = null;
  async function obtenerHashFicticio() {
    if (!hashFicticio) hashFicticio = await hashContrasena(tokenAleatorio(16));
    return hashFicticio;
  }

  /**
   * Genera un token de confirmación (se guarda solo su hash) y deja el correo en el
   * buzón de demostración. No se envían correos reales.
   * @returns {string} enlace de confirmación
   */
  function emitirEnlaceConfirmacion(usuario) {
    const token = tokenAleatorio(32);
    const expira = new Date(reloj.ahoraMs() + config.horasValidezEnlace * 3600 * 1000).toISOString();
    repos.usuarios.insertarToken(usuario.id, sha256(token), expira);
    const enlace = `${config.urlBase}/confirmar?token=${encodeURIComponent(token)}`;
    repos.usuarios.insertarCorreo({
      destinatario: usuario.correo,
      asunto: 'Confirma tu cuenta de CampusReserva',
      cuerpo:
        `Hola ${usuario.nombre}: para activar tu cuenta abre el siguiente enlace. ` +
        `Es válido por ${config.horasValidezEnlace} horas y se puede usar una sola vez.`,
      enlace,
      creadoEn: reloj.ahoraIso(),
    });
    return enlace;
  }

  /**
   * RF-01: registra una cuenta de estudiante o docente en estado PENDIENTE.
   * El rol se toma del listado institucional; nunca del formulario.
   * @param {{nombre:string, correo:string, contrasena:string, confirmacion:string}} entrada
   * @returns {Promise<{usuarioId:number, correo:string, rol:string}>}
   */
  async function registrar(entrada) {
    const { ok, errores, datos } = validarRegistro(entrada, config);
    if (!ok) throw new ErrorValidacion(errores);

    const rol = repos.usuarios.rolAutorizado(datos.correo);
    if (!rol) {
      throw new ErrorValidacion({
        correo: 'Este correo no figura en el listado institucional autorizado. Contacta a la administración de tu sede.',
      });
    }
    if (repos.usuarios.buscarPorCorreo(datos.correo)) {
      throw new ErrorValidacion({ correo: 'Ya existe una cuenta registrada con este correo.' });
    }

    // El hash se calcula fuera de la transacción para no retener el bloqueo de escritura.
    const passwordHash = await hashContrasena(datos.contrasena);

    try {
      return transaccion(db, () => {
        const usuarioId = repos.usuarios.insertar({
          nombre: datos.nombre,
          correo: datos.correo,
          passwordHash,
          rol,
          estado: 'PENDIENTE',
          creadoEn: reloj.ahoraIso(),
        });
        emitirEnlaceConfirmacion({ id: usuarioId, nombre: datos.nombre, correo: datos.correo });
        repos.auditoria.registrar({ fecha: reloj.ahoraIso(), usuarioId, accion: 'REGISTRO', detalle: `rol=${rol}` });
        return { usuarioId, correo: datos.correo, rol };
      });
    } catch (error) {
      // Dos registros simultáneos con el mismo correo: la restricción UNIQUE decide.
      if (esErrorUnico(error)) {
        throw new ErrorValidacion({ correo: 'Ya existe una cuenta registrada con este correo.' });
      }
      throw error;
    }
  }

  /**
   * RF-01: confirma el correo con un token válido, vigente y no usado; activa la cuenta.
   * @param {string} token
   * @returns {{usuarioId:number}}
   */
  function confirmarCorreo(token) {
    const invalido = new ErrorApp(400, 'El enlace de confirmación no es válido, ya fue usado o expiró.', 'TOKEN_INVALIDO');
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw invalido;

    return transaccion(db, () => {
      const registro = repos.usuarios.buscarToken(sha256(token));
      if (!registro || registro.usado_en || registro.expira_en <= reloj.ahoraIso()) throw invalido;
      if (!repos.usuarios.marcarTokenUsado(registro.id, reloj.ahoraIso())) throw invalido;
      repos.usuarios.activar(registro.usuario_id, reloj.ahoraIso());
      repos.auditoria.registrar({
        fecha: reloj.ahoraIso(),
        usuarioId: registro.usuario_id,
        accion: 'CORREO_CONFIRMADO',
      });
      return { usuarioId: registro.usuario_id };
    });
  }

  /**
   * RF-02: valida credenciales. Devuelve el usuario si la cuenta está activa.
   * Ante correo inexistente o contraseña errónea se responde con el mismo mensaje genérico
   * y un tiempo de cálculo similar, para no revelar qué cuentas existen.
   * @param {{correo:string, contrasena:string}} entrada
   */
  async function iniciarSesion(entrada) {
    const { ok, datos } = validarLogin(entrada);
    if (!ok) throw new ErrorAutenticacion(MENSAJE_CREDENCIALES);

    const usuario = repos.usuarios.buscarPorCorreo(datos.correo);
    const hash = usuario ? usuario.password_hash : await obtenerHashFicticio();
    const coincide = await verificarContrasena(datos.contrasena, hash);

    if (!usuario || !coincide) {
      repos.auditoria.registrar({
        fecha: reloj.ahoraIso(),
        usuarioId: usuario ? usuario.id : null,
        accion: 'LOGIN_FALLIDO',
        detalle: usuario ? 'contraseña incorrecta' : 'cuenta inexistente',
      });
      throw new ErrorAutenticacion(MENSAJE_CREDENCIALES);
    }

    if (usuario.estado !== 'ACTIVA') {
      let mensaje =
        'Tu cuenta está pendiente de confirmación. Abre el enlace que enviamos a tu correo institucional.';
      if (!repos.usuarios.tieneTokenVigente(usuario.id, reloj.ahoraIso())) {
        emitirEnlaceConfirmacion(usuario);
        mensaje += ' Como el enlace anterior expiró, generamos uno nuevo.';
      }
      repos.auditoria.registrar({ fecha: reloj.ahoraIso(), usuarioId: usuario.id, accion: 'LOGIN_PENDIENTE' });
      throw new ErrorAutenticacion(mensaje, 'CUENTA_PENDIENTE');
    }

    repos.auditoria.registrar({ fecha: reloj.ahoraIso(), usuarioId: usuario.id, accion: 'LOGIN_OK' });
    return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol };
  }

  return { registrar, confirmarCorreo, iniciarSesion };
}

module.exports = { crearServicioAutenticacion, MENSAJE_CREDENCIALES };
