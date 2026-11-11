/**
 * Punto de entrada: carga la configuración, prepara la base de datos y levanta el servidor HTTP.
 * Uso: npm start   (lee variables desde .env si existe)
 */
'use strict';

const { cargarConfig } = require('./config');
const { abrirBaseDatos, aplicarEsquema } = require('./db/conexion');
const { sembrarSiVacia } = require('./db/seed');
const { crearApp } = require('./app');

async function iniciar() {
  const config = cargarConfig();
  const db = abrirBaseDatos(config.rutaBaseDatos);
  aplicarEsquema(db);

  if (config.seedDemo) {
    const sembrado = await sembrarSiVacia(db, config);
    if (sembrado) console.log('[seed] Base vacía: se cargaron datos ficticios de demostración (ver README).');
  }

  const app = crearApp({ db, config });
  const servidor = app.listen(config.puerto, () => {
    console.log(`CampusReserva escuchando en ${config.urlBase} (entorno: ${config.entorno})`);
    if (config.buzonDemo) {
      console.log(`[demo] Buzón de demostración activo en ${config.urlBase}/demo/buzon — no se envían correos reales.`);
    }
  });

  // Cierre ordenado (Ctrl+C o señal del PaaS).
  const cerrar = () => {
    servidor.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

iniciar().catch((error) => {
  console.error('No fue posible iniciar CampusReserva:', error.message);
  process.exit(1);
});
