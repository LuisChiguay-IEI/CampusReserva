'use strict';

/**
 * Prueba de concurrencia REAL entre procesos (ADR-001: transacción + restricción única).
 *
 * Se lanzan varios procesos de Node.js independientes, cada uno con su propia conexión al mismo
 * archivo SQLite. Todos esperan una señal común y luego intentan reservar el mismo bloque y fecha.
 * Resultado esperado: exactamente una reserva confirmada; el resto, rechazadas por duplicado.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fork } = require('node:child_process');
const { crearEntorno, idEspacio, idHorario, FECHAS, AHORA_PRUEBAS, CORREOS } = require('../ayudante');

const SCRIPT = path.join(__dirname, '..', 'fixtures', 'proceso-reserva.js');
const PROCESOS = 8;

/**
 * Lanza N procesos, espera que todos estén listos y les da la orden simultánea.
 * @returns {Promise<string[]>} resultado de cada proceso
 */
async function competir(e, modo, horarioId, espacioId, usuarios) {
  const hijos = usuarios.map((u) =>
    fork(SCRIPT, [e.rutaBaseDatos, modo, AHORA_PRUEBAS, String(u.id), u.rol, String(espacioId), String(horarioId), FECHAS.dia2], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    }),
  );
  const resultados = hijos.map(
    (hijo) => new Promise((resolve) => hijo.on('message', (m) => m !== 'listo' && resolve(m))),
  );
  await Promise.all(hijos.map((hijo) => new Promise((resolve) => hijo.once('message', resolve))));
  hijos.forEach((hijo) => hijo.send('ya'));
  return Promise.all(resultados);
}

describe('ADR-001 Concurrencia entre procesos sobre el mismo bloque', () => {
  let e;
  let usuarios;
  before(async () => {
    e = await crearEntorno();
    const ana = e.uno('SELECT id, rol FROM usuario WHERE correo = ?', CORREOS.ana);
    const diego = e.uno('SELECT id, rol FROM usuario WHERE correo = ?', CORREOS.diego);
    usuarios = Array.from({ length: PROCESOS }, (_, i) => (i % 2 === 0 ? ana : diego));
  });
  after(async () => e.cerrar());

  const confirmadas = (horarioId) =>
    e.uno("SELECT COUNT(*) AS n FROM reserva WHERE horario_id = ? AND fecha = ? AND estado = 'CONFIRMADA'", horarioId, FECHAS.dia2).n;

  it(`CP-04-07 ${PROCESOS} procesos usando el servicio real: exactamente 1 reserva confirmada`, async () => {
    const espacio = idEspacio(e, 'Sala A-102');
    const horario = idHorario(e, espacio, 3, '08:30');
    const resultados = await competir(e, 'servicio', horario, espacio, usuarios);
    assert.equal(resultados.filter((r) => r === 'CONFIRMADA').length, 1, JSON.stringify(resultados));
    assert.equal(resultados.filter((r) => r === 'RECHAZADA_DUPLICADO').length, PROCESOS - 1, JSON.stringify(resultados));
    assert.equal(confirmadas(horario), 1);
  });

  it(`CP-04-08 ${PROCESOS} procesos insertando sin verificar: el índice único de la base deja solo 1`, async () => {
    const espacio = idEspacio(e, 'Sala A-102');
    const horario = idHorario(e, espacio, 3, '10:15');
    const resultados = await competir(e, 'insercion-directa', horario, espacio, usuarios);
    assert.equal(resultados.filter((r) => r === 'CONFIRMADA').length, 1, JSON.stringify(resultados));
    assert.equal(confirmadas(horario), 1);
  });
});
