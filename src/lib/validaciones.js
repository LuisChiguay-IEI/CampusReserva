/**
 * Validación de entradas en el servidor.
 *
 * Son funciones puras: reciben los datos del formulario (siempre texto no confiable) y
 * devuelven { ok, errores, datos }, donde `datos` contiene los valores ya normalizados y
 * tipados. Ninguna operación de negocio usa directamente `req.body`.
 * Se aplica el criterio de lista blanca (formatos y valores permitidos) en lugar de
 * intentar "limpiar" entradas peligrosas.
 */
'use strict';

const { esFechaValida, esHoraValida, aMinutos, sumarDias } = require('./fechas');

const ROLES_RESERVA = Object.freeze(['ESTUDIANTE', 'DOCENTE']);
const TIPOS_ESPACIO = Object.freeze(['SALA', 'LABORATORIO']);

// HU-01 (Sumativa 2): contraseña de 15 a 128 caracteres, con espacios permitidos y
// rechazo de contraseñas comunes o predecibles.
const LARGO_MIN_CONTRASENA = 15;
const LARGO_MAX_CONTRASENA = 128;

/**
 * Lista local de contraseñas comunes (normalizadas: minúsculas y sin espacios).
 * Es una protección básica; la verificación contra bases de contraseñas filtradas
 * queda pendiente (requiere un servicio externo).
 */
const CONTRASENAS_COMUNES = new Set([
  '123456789012345', '1234567890123456', '123456789123456', '012345678901234',
  'contraseña12345', 'contrasena12345', 'contraseñasegura', 'contrasenasegura',
  'password1234567', 'passwordpassword', 'password12345678', 'qwertyuiopasdfg',
  'qwerty123456789', 'abcdefghijklmno', 'abc123abc123abc', 'iloveyou1234567',
  'administrador123', 'estudiante12345', 'docente12345678', 'inacap123456789',
  'inacap2026inacap', 'campusreserva2026', 'campusreserva123', 'bienvenido12345',
]);

/**
 * Indica si una contraseña es común o predecible (lista local, un solo carácter repetido
 * o solo dígitos).
 * @param {string} contrasena
 * @returns {boolean}
 */
function esContrasenaComun(contrasena) {
  const normalizada = contrasena.toLowerCase().replace(/\s+/g, '');
  return CONTRASENAS_COMUNES.has(normalizada) || /^(.)\1+$/.test(normalizada) || /^\d+$/.test(normalizada);
}
const CAPACIDAD_MAXIMA = 200;
const HORA_APERTURA = '07:00';
const HORA_CIERRE = '23:00';
const DURACION_MIN_BLOQUE = 30;
const DURACION_MAX_BLOQUE = 240;

const REGEX_CORREO = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const REGEX_NOMBRE_PERSONA = /^[\p{L}][\p{L} '.-]*[\p{L}.]$/u;
const REGEX_NOMBRE_ESPACIO = /^[\p{L}\d][\p{L}\d .()/-]*$/u;
const REGEX_ENTERO = /^\d{1,9}$/;

/**
 * Normaliza texto libre: convierte a string, recorta y colapsa espacios repetidos.
 * @param {unknown} valor
 * @returns {string}
 */
function texto(valor) {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Convierte a entero positivo si el texto contiene solo dígitos; si no, devuelve null.
 * @param {unknown} valor
 * @returns {number|null}
 */
function enteroPositivo(valor) {
  const t = typeof valor === 'number' ? String(valor) : texto(valor);
  if (!REGEX_ENTERO.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/**
 * Normaliza un correo: minúsculas y sin espacios.
 * @param {unknown} valor
 * @returns {string}
 */
function normalizarCorreo(valor) {
  return texto(valor).toLowerCase();
}

/**
 * Valida el formulario de registro (RF-01).
 * El rol NO se recibe del formulario: se obtiene del listado institucional en el servicio.
 * @param {{nombre?: string, correo?: string, contrasena?: string, confirmacion?: string}} entrada
 * @param {{dominioInstitucional: string}} opciones
 */
function validarRegistro(entrada, { dominioInstitucional }) {
  const errores = {};
  const nombre = texto(entrada.nombre);
  const correo = normalizarCorreo(entrada.correo);
  const contrasena = typeof entrada.contrasena === 'string' ? entrada.contrasena : '';
  const confirmacion = typeof entrada.confirmacion === 'string' ? entrada.confirmacion : '';

  if (nombre.length < 3 || nombre.length > 80) {
    errores.nombre = 'Ingresa tu nombre completo (entre 3 y 80 caracteres).';
  } else if (!REGEX_NOMBRE_PERSONA.test(nombre)) {
    errores.nombre = 'El nombre solo puede contener letras, espacios, apóstrofos, puntos y guiones.';
  }

  if (!correo) {
    errores.correo = 'Ingresa tu correo institucional.';
  } else if (correo.length > 254 || !REGEX_CORREO.test(correo)) {
    errores.correo = 'El correo no tiene un formato válido.';
  } else if (correo.split('@')[1] !== dominioInstitucional) {
    errores.correo = `Debes usar tu correo institucional (@${dominioInstitucional}).`;
  }

  if (contrasena.length < LARGO_MIN_CONTRASENA || contrasena.length > LARGO_MAX_CONTRASENA) {
    errores.contrasena = `La contraseña debe tener entre ${LARGO_MIN_CONTRASENA} y ${LARGO_MAX_CONTRASENA} caracteres.`;
  } else if (contrasena.toLowerCase() === correo || contrasena.toLowerCase() === correo.split('@')[0]) {
    errores.contrasena = 'La contraseña no puede ser igual a tu correo.';
  } else if (esContrasenaComun(contrasena)) {
    errores.contrasena = 'Esa contraseña es demasiado común o predecible. Usa una frase propia.';
  }

  if (!errores.contrasena && confirmacion !== contrasena) {
    errores.confirmacion = 'Las contraseñas no coinciden.';
  }

  return { ok: Object.keys(errores).length === 0, errores, datos: { nombre, correo, contrasena } };
}

/**
 * Valida el formulario de inicio de sesión (RF-02). Solo comprueba presencia y largo;
 * la verificación real de credenciales ocurre en el servicio.
 * @param {{correo?: string, contrasena?: string}} entrada
 */
function validarLogin(entrada) {
  const correo = normalizarCorreo(entrada.correo);
  const contrasena = typeof entrada.contrasena === 'string' ? entrada.contrasena : '';
  const errores = {};
  if (!correo || correo.length > 254) errores.correo = 'Ingresa tu correo.';
  if (!contrasena || contrasena.length > LARGO_MAX_CONTRASENA) errores.contrasena = 'Ingresa tu contraseña.';
  return { ok: Object.keys(errores).length === 0, errores, datos: { correo, contrasena } };
}

/**
 * Valida los filtros de la consulta de disponibilidad (RF-03).
 * @param {{sede?: string, fecha?: string, espacio?: string}} entrada
 * @param {{hoy: string, maxDiasAnticipacion: number}} opciones
 */
function validarConsulta(entrada, { hoy, maxDiasAnticipacion }) {
  const errores = {};
  const sedeId = enteroPositivo(entrada.sede);
  const fecha = texto(entrada.fecha);
  const espacioTexto = texto(entrada.espacio);
  const espacioId = espacioTexto ? enteroPositivo(espacioTexto) : null;
  const fechaMaxima = sumarDias(hoy, maxDiasAnticipacion);

  if (!sedeId) errores.sede = 'Selecciona una sede.';
  if (!esFechaValida(fecha)) {
    errores.fecha = 'Selecciona una fecha válida.';
  } else if (fecha < hoy) {
    errores.fecha = 'No es posible consultar fechas pasadas.';
  } else if (fecha > fechaMaxima) {
    errores.fecha = `Solo se puede reservar con hasta ${maxDiasAnticipacion} días de anticipación.`;
  }
  if (espacioTexto && !espacioId) errores.espacio = 'El espacio seleccionado no es válido.';

  return { ok: Object.keys(errores).length === 0, errores, datos: { sedeId, fecha, espacioId } };
}

/**
 * Valida la selección de una reserva (RF-04): identificadores numéricos y fecha.
 * @param {{espacio?: string, horario?: string, fecha?: string}} entrada
 */
function validarSeleccionReserva(entrada) {
  const errores = {};
  const espacioId = enteroPositivo(entrada.espacio);
  const horarioId = enteroPositivo(entrada.horario);
  const fecha = texto(entrada.fecha);
  if (!espacioId) errores.espacio = 'Espacio inválido.';
  if (!horarioId) errores.horario = 'Horario inválido.';
  if (!esFechaValida(fecha)) errores.fecha = 'Fecha inválida.';
  return { ok: Object.keys(errores).length === 0, errores, datos: { espacioId, horarioId, fecha } };
}

/**
 * Valida los datos de una sala o laboratorio (RF-06).
 * @param {{sede?: string, nombre?: string, tipo?: string, capacidad?: string}} entrada
 * @param {{exigirSede?: boolean}} [opciones]
 */
function validarEspacio(entrada, { exigirSede = true } = {}) {
  const errores = {};
  const sedeId = enteroPositivo(entrada.sede);
  const nombre = texto(entrada.nombre);
  const tipo = texto(entrada.tipo).toUpperCase();
  const capacidad = enteroPositivo(entrada.capacidad);

  if (exigirSede && !sedeId) errores.sede = 'Selecciona una sede.';
  if (nombre.length < 3 || nombre.length > 60) {
    errores.nombre = 'El nombre debe tener entre 3 y 60 caracteres.';
  } else if (!REGEX_NOMBRE_ESPACIO.test(nombre)) {
    errores.nombre = 'El nombre solo admite letras, números, espacios y los signos . - ( ) /';
  }
  if (!TIPOS_ESPACIO.includes(tipo)) errores.tipo = 'Selecciona si es sala o laboratorio.';
  if (!capacidad || capacidad > CAPACIDAD_MAXIMA) {
    errores.capacidad = `La capacidad debe ser un número entero entre 1 y ${CAPACIDAD_MAXIMA}.`;
  }

  return { ok: Object.keys(errores).length === 0, errores, datos: { sedeId, nombre, tipo, capacidad } };
}

/**
 * Valida la configuración de un bloque horario semanal (RF-06).
 * @param {{dia?: string, inicio?: string, fin?: string}} entrada
 */
function validarHorario(entrada) {
  const errores = {};
  const diaSemana = enteroPositivo(entrada.dia);
  const horaInicio = texto(entrada.inicio);
  const horaFin = texto(entrada.fin);

  if (!diaSemana || diaSemana > 7) errores.dia = 'Selecciona un día de la semana.';
  if (!esHoraValida(horaInicio)) errores.inicio = 'Ingresa una hora de inicio válida (HH:MM).';
  if (!esHoraValida(horaFin)) errores.fin = 'Ingresa una hora de término válida (HH:MM).';

  if (!errores.inicio && !errores.fin) {
    const duracion = aMinutos(horaFin) - aMinutos(horaInicio);
    if (duracion <= 0) {
      errores.fin = 'La hora de término debe ser posterior a la de inicio.';
    } else if (horaInicio < HORA_APERTURA || horaFin > HORA_CIERRE) {
      errores.inicio = `El bloque debe estar entre las ${HORA_APERTURA} y las ${HORA_CIERRE}.`;
    } else if (duracion < DURACION_MIN_BLOQUE || duracion > DURACION_MAX_BLOQUE) {
      errores.fin = `El bloque debe durar entre ${DURACION_MIN_BLOQUE} y ${DURACION_MAX_BLOQUE} minutos.`;
    }
  }

  return { ok: Object.keys(errores).length === 0, errores, datos: { diaSemana, horaInicio, horaFin } };
}

/**
 * Valida un bloqueo de horario en una fecha (RF-06).
 * @param {{horario?: string, fecha?: string, motivo?: string}} entrada
 * @param {{hoy: string}} opciones
 */
function validarBloqueo(entrada, { hoy }) {
  const errores = {};
  const horarioId = enteroPositivo(entrada.horario);
  const fecha = texto(entrada.fecha);
  const motivo = texto(entrada.motivo);

  if (!horarioId) errores.horario = 'Selecciona el bloque horario a bloquear.';
  if (!esFechaValida(fecha)) {
    errores.fecha = 'Selecciona una fecha válida.';
  } else if (fecha < hoy) {
    errores.fecha = 'No es posible bloquear fechas pasadas.';
  }
  if (motivo.length < 3 || motivo.length > 120) errores.motivo = 'Indica el motivo (entre 3 y 120 caracteres).';

  return { ok: Object.keys(errores).length === 0, errores, datos: { horarioId, fecha, motivo } };
}

module.exports = {
  ROLES_RESERVA,
  TIPOS_ESPACIO,
  LARGO_MIN_CONTRASENA,
  CAPACIDAD_MAXIMA,
  esContrasenaComun,
  texto,
  enteroPositivo,
  normalizarCorreo,
  validarRegistro,
  validarLogin,
  validarConsulta,
  validarSeleccionReserva,
  validarEspacio,
  validarHorario,
  validarBloqueo,
};
