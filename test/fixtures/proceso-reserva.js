/**
 * Proceso hijo para la prueba de concurrencia real entre procesos (ADR-001).
 *
 * Cada proceso abre su PROPIA conexión al mismo archivo SQLite (como lo harían varias
 * instancias del servidor), avisa que está listo y espera la orden "ya" del proceso padre
 * para intentar reservar el mismo bloque al mismo tiempo que los demás.
 *
 * Modos:
 *  - "servicio": usa el flujo real (transacción BEGIN IMMEDIATE + verificación + índice único).
 *  - "insercion-directa": inserta sin verificar nada, para demostrar que el índice único de la
 *    base por sí solo impide el duplicado aunque la aplicación tuviera una condición de carrera.
 */
'use strict';

const { abrirBaseDatos, esErrorUnico } = require('../../src/db/conexion');
const { crearRepositorios } = require('../../src/repositorios');
const { crearReloj } = require('../../src/servicios/reloj');
const { crearServicioReservas } = require('../../src/servicios/reservas');

const [, , rutaBaseDatos, modo, ahoraIso, usuarioId, rol, espacioId, horarioId, fecha] = process.argv;

const db = abrirBaseDatos(rutaBaseDatos);
const repos = crearRepositorios(db);
const config = { ahora: () => new Date(ahoraIso), zonaHoraria: 'America/Santiago', maxDiasAnticipacion: 30 };
const reloj = crearReloj(config);
const reservas = crearServicioReservas({ db, repos, config, reloj });

process.on('message', (mensaje) => {
  if (mensaje !== 'ya') return;
  let resultado;
  try {
    if (modo === 'servicio') {
      reservas.confirmar({ id: Number(usuarioId), rol }, { espacio: espacioId, horario: horarioId, fecha });
    } else {
      repos.reservas.insertar({
        usuarioId: Number(usuarioId),
        espacioId: Number(espacioId),
        horarioId: Number(horarioId),
        fecha,
        horaInicio: '00:00',
        horaFin: '00:01',
        creadoEn: ahoraIso,
      });
    }
    resultado = 'CONFIRMADA';
  } catch (error) {
    resultado = esErrorUnico(error) || error.codigo === 'OCUPADO' ? 'RECHAZADA_DUPLICADO' : `ERROR: ${error.message}`;
  }
  db.close();
  process.send(resultado, () => process.exit(0));
});

process.send('listo');
