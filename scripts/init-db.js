/**
 * Reinicia la base de datos local y carga los datos ficticios de demostración.
 * Uso: npm run db:reset
 * Se niega a ejecutarse con NODE_ENV=production para no borrar datos reales.
 */
'use strict';

const fs = require('node:fs');
const { cargarConfig } = require('../src/config');
const { abrirBaseDatos, aplicarEsquema } = require('../src/db/conexion');
const { sembrar } = require('../src/db/seed');

async function main() {
  const config = cargarConfig();
  if (config.esProduccion) {
    console.error('db:reset está deshabilitado en producción.');
    process.exit(1);
  }
  for (const sufijo of ['', '-wal', '-shm']) {
    fs.rmSync(config.rutaBaseDatos + sufijo, { force: true });
  }
  const db = abrirBaseDatos(config.rutaBaseDatos);
  aplicarEsquema(db);
  await sembrar(db, config);
  db.close();
  console.log(`Base reiniciada con datos de demostración en ${config.rutaBaseDatos}`);
}

main().catch((error) => {
  console.error('No fue posible reiniciar la base:', error.message);
  process.exit(1);
});
