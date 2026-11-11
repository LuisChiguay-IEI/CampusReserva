/**
 * Reloj de la aplicación: centraliza "ahora", "hoy" y la hora local para que todas las
 * reglas de negocio usen la misma referencia (y para poder fijarla en las pruebas).
 */
'use strict';

const { fechaHoraEnZona } = require('../lib/fechas');

/**
 * @param {{ahora: () => Date, zonaHoraria: string}} config
 */
function crearReloj(config) {
  return {
    /** Instante actual en ISO-8601 UTC (para columnas de auditoría y timestamps). */
    ahoraIso: () => config.ahora().toISOString(),
    /** Instante actual en milisegundos. */
    ahoraMs: () => config.ahora().getTime(),
    /** Fecha y hora locales actuales: { fecha: 'AAAA-MM-DD', hora: 'HH:MM' }. */
    local: () => fechaHoraEnZona(config.ahora(), config.zonaHoraria),
  };
}

module.exports = { crearReloj };
