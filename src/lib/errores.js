/**
 * Errores de dominio. Permiten que los servicios expresen el motivo de un rechazo
 * y que la capa web lo traduzca al código HTTP y mensaje adecuados, sin exponer
 * detalles internos (trazas, SQL) al usuario.
 */
'use strict';

/** Error controlado de la aplicación con código HTTP y mensaje seguro para mostrar. */
class ErrorApp extends Error {
  /**
   * @param {number} estado Código HTTP sugerido.
   * @param {string} mensaje Mensaje apto para el usuario final.
   * @param {string} [codigo] Código interno estable (útil en pruebas y auditoría).
   */
  constructor(estado, mensaje, codigo = 'ERROR') {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.codigo = codigo;
  }
}

/** Datos de entrada inválidos: incluye los errores por campo para re-mostrar el formulario. */
class ErrorValidacion extends ErrorApp {
  /**
   * @param {Record<string,string>} errores Mensaje por nombre de campo.
   * @param {string} [mensaje]
   */
  constructor(errores, mensaje = 'Revisa los datos ingresados.') {
    super(422, mensaje, 'VALIDACION');
    this.name = 'ErrorValidacion';
    this.errores = errores;
  }
}

/** Conflicto de negocio: horario ocupado, superposición, reservas afectadas, etc. */
class ErrorConflicto extends ErrorApp {
  constructor(mensaje, codigo = 'CONFLICTO') {
    super(409, mensaje, codigo);
    this.name = 'ErrorConflicto';
  }
}

/** Recurso inexistente o que no pertenece al usuario (no se revela cuál de los dos). */
class ErrorNoEncontrado extends ErrorApp {
  constructor(mensaje = 'El recurso solicitado no existe.') {
    super(404, mensaje, 'NO_ENCONTRADO');
    this.name = 'ErrorNoEncontrado';
  }
}

/** Autenticación fallida o cuenta no habilitada. */
class ErrorAutenticacion extends ErrorApp {
  constructor(mensaje, codigo = 'CREDENCIALES') {
    super(401, mensaje, codigo);
    this.name = 'ErrorAutenticacion';
  }
}

/** Usuario autenticado sin permiso para la operación. */
class ErrorPermiso extends ErrorApp {
  constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
    super(403, mensaje, 'SIN_PERMISO');
    this.name = 'ErrorPermiso';
  }
}

module.exports = {
  ErrorApp,
  ErrorValidacion,
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorAutenticacion,
  ErrorPermiso,
};
