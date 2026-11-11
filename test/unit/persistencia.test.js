'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { abrirBaseDatos, transaccion, esErrorUnico } = require('../../src/db/conexion');

describe('Consistencia de la persistencia (RNF-05 de la Sumativa 2)', () => {
  it('CP-U-28 ante un fallo dentro de la transacción no queda ningún estado parcial (ROLLBACK)', () => {
    const db = abrirBaseDatos(':memory:');
    db.exec('CREATE TABLE prueba (id INTEGER PRIMARY KEY, valor TEXT NOT NULL)');
    assert.throws(
      () =>
        transaccion(db, () => {
          db.prepare("INSERT INTO prueba (valor) VALUES ('primera')").run();
          throw new Error('fallo simulado al guardar');
        }),
      /fallo simulado/,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM prueba').get().n, 0);

    // Una transacción exitosa sí confirma los cambios.
    transaccion(db, () => db.prepare("INSERT INTO prueba (valor) VALUES ('ok')").run());
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM prueba').get().n, 1);

    // Los errores de unicidad se reconocen para responder con un conflicto controlado.
    db.exec('CREATE UNIQUE INDEX ux ON prueba (valor)');
    let capturado;
    try {
      db.prepare("INSERT INTO prueba (valor) VALUES ('ok')").run();
    } catch (error) {
      capturado = error;
    }
    assert.equal(esErrorUnico(capturado), true);
    assert.equal(esErrorUnico(new Error('otro')), false);
    db.close();
  });
});
