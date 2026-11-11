/**
 * Consulta de disponibilidad (RF-03). Solo lee datos: no crea ni modifica reservas.
 */
'use strict';

const { validarConsulta } = require('../lib/validaciones');
const { diaSemana } = require('../lib/fechas');
const { tiposReservables, diasAnticipacion } = require('../lib/politicas');
const { ErrorValidacion } = require('../lib/errores');

/**
 * Cálculo puro de disponibilidad: dado el catálogo y lo ocupado, devuelve por espacio
 * los bloques libres. Se separa del acceso a datos para poder probarlo de forma unitaria.
 *
 * Un bloque está disponible si: pertenece a un espacio habilitado, está activo, no tiene
 * reserva confirmada, no está bloqueado y (si la fecha es hoy) aún no ha comenzado.
 *
 * @param {object} p
 * @param {Array<{id:number}>} p.espacios Espacios habilitados a considerar.
 * @param {Array<{id:number, espacio_id:number, hora_inicio:string}>} p.horarios Bloques activos del día.
 * @param {Set<number>} p.ocupados Ids de horarios con reserva confirmada.
 * @param {Set<number>} p.bloqueados Ids de horarios bloqueados.
 * @param {string|null} p.horaMinima Si la fecha es hoy, hora actual 'HH:MM'; si no, null.
 * @returns {Array<{espacio: object, bloques: object[]}>} Solo espacios con al menos un bloque libre.
 */
function calcularDisponibilidad({ espacios, horarios, ocupados, bloqueados, horaMinima }) {
  return espacios
    .map((espacio) => ({
      espacio,
      bloques: horarios.filter(
        (h) =>
          h.espacio_id === espacio.id &&
          !ocupados.has(h.id) &&
          !bloqueados.has(h.id) &&
          (horaMinima === null || h.hora_inicio > horaMinima),
      ),
    }))
    .filter((resultado) => resultado.bloques.length > 0);
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../repositorios').crearRepositorios>} deps.repos
 * @param {object} deps.config
 * @param {ReturnType<import('./reloj').crearReloj>} deps.reloj
 */
function crearServicioDisponibilidad({ repos, config, reloj }) {
  /**
   * RF-03: consulta espacios y bloques disponibles por sede y fecha (espacio opcional).
   * Solo muestra los tipos de espacio que el rol puede reservar y dentro de su ventana
   * de anticipación (estudiantes: salas de estudio, 7 días; docentes y administración: todo, 30 días).
   * @param {{rol: string}} usuario
   * @param {{sede?:string, fecha?:string, espacio?:string}} filtros
   */
  function consultar(usuario, filtros) {
    const { fecha: hoy, hora } = reloj.local();
    const tipos = tiposReservables(usuario.rol);
    const { ok, errores, datos } = validarConsulta(filtros, { hoy, maxDiasAnticipacion: diasAnticipacion(usuario.rol, config) });
    if (!ok) throw new ErrorValidacion(errores);

    const sede = repos.espacios.buscarSede(datos.sedeId);
    if (!sede) throw new ErrorValidacion({ sede: 'La sede seleccionada no existe.' });

    if (datos.espacioId) {
      const espacio = repos.espacios.buscarEspacio(datos.espacioId);
      if (!espacio || espacio.sede_id !== sede.id) {
        throw new ErrorValidacion({ espacio: 'El espacio no pertenece a la sede seleccionada.' });
      }
      if (!tipos.includes(espacio.tipo)) {
        throw new ErrorValidacion({ espacio: 'Como estudiante solo puedes consultar y reservar salas de estudio.' });
      }
    }

    const resultados = calcularDisponibilidad({
      espacios: repos.espacios.listarHabilitadosDeSede(sede.id, datos.espacioId).filter((e) => tipos.includes(e.tipo)),
      horarios: repos.espacios.horariosActivosDeSedeYDia(sede.id, diaSemana(datos.fecha)),
      ocupados: repos.reservas.horariosOcupados(sede.id, datos.fecha),
      bloqueados: repos.espacios.horariosBloqueados(sede.id, datos.fecha),
      horaMinima: datos.fecha === hoy ? hora : null,
    });

    const totalBloques = resultados.reduce((suma, r) => suma + r.bloques.length, 0);
    return { sede, fecha: datos.fecha, espacioId: datos.espacioId, resultados, totalBloques };
  }

  return { consultar };
}

module.exports = { crearServicioDisponibilidad, calcularDisponibilidad };
