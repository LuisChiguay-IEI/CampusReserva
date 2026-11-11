/**
 * Utilidades de fecha y hora.
 *
 * Las fechas se manejan como texto 'AAAA-MM-DD' y las horas como 'HH:MM'. Ese formato
 * se compara correctamente como texto y evita errores de zona horaria al guardar en SQLite.
 * "Hoy" y "ahora" se calculan en la zona horaria configurada (America/Santiago).
 */
'use strict';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const NOMBRES_DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Devuelve la fecha y hora locales de `instante` en la zona indicada.
 * @param {Date} instante
 * @param {string} zonaHoraria Identificador IANA, p. ej. 'America/Santiago'.
 * @returns {{fecha: string, hora: string}}
 */
function fechaHoraEnZona(instante, zonaHoraria) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
  };
}

/**
 * Valida que el texto sea una fecha real con formato AAAA-MM-DD (rechaza 2026-02-30).
 * @param {unknown} texto
 * @returns {boolean}
 */
function esFechaValida(texto) {
  if (typeof texto !== 'string' || !REGEX_FECHA.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

/**
 * Valida una hora con formato HH:MM de 24 horas.
 * @param {unknown} texto
 * @returns {boolean}
 */
function esHoraValida(texto) {
  return typeof texto === 'string' && REGEX_HORA.test(texto);
}

/**
 * Día de la semana ISO de una fecha: 1 = lunes ... 7 = domingo.
 * @param {string} fecha 'AAAA-MM-DD'
 * @returns {number}
 */
function diaSemana(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/**
 * Suma (o resta) días a una fecha 'AAAA-MM-DD'.
 * @param {string} fecha
 * @param {number} dias
 * @returns {string}
 */
function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(a, m - 1, d + dias));
  return resultado.toISOString().slice(0, 10);
}

/**
 * Convierte 'HH:MM' en minutos desde medianoche.
 * @param {string} hora
 * @returns {number}
 */
function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Minutos que faltan desde `ahora` hasta la fecha y hora indicadas (negativo si ya pasó).
 * Ambas en hora local de la sede.
 * @param {string} fecha 'AAAA-MM-DD'
 * @param {string} hora 'HH:MM'
 * @param {{fecha: string, hora: string}} ahora
 * @returns {number}
 */
function minutosHasta(fecha, hora, ahora) {
  const dia = (f) => {
    const [a, m, d] = f.split('-').map(Number);
    return Date.UTC(a, m - 1, d) / 86400000;
  };
  return (dia(fecha) - dia(ahora.fecha)) * 1440 + aMinutos(hora) - aMinutos(ahora.hora);
}

/**
 * Indica si dos intervalos [inicio, fin) se superponen. Bloques contiguos (10:00-11:00 y
 * 11:00-12:00) no se consideran superpuestos.
 * @param {{inicio: string, fin: string}} a
 * @param {{inicio: string, fin: string}} b
 * @returns {boolean}
 */
function haySuperposicion(a, b) {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/**
 * Formatea 'AAAA-MM-DD' como 'Lunes 16-11-2026' para la interfaz.
 * @param {string} fecha
 * @returns {string}
 */
function formatearFecha(fecha) {
  if (!esFechaValida(fecha)) return fecha;
  const [a, m, d] = fecha.split('-');
  return `${NOMBRES_DIA[diaSemana(fecha)]} ${d}-${m}-${a}`;
}

module.exports = {
  NOMBRES_DIA,
  fechaHoraEnZona,
  esFechaValida,
  esHoraValida,
  diaSemana,
  sumarDias,
  aMinutos,
  minutosHasta,
  haySuperposicion,
  formatearFecha,
};
