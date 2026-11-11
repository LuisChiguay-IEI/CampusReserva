/**
 * Buzón de demostración: sustituye al servicio de correo, que no está disponible en el MVP.
 *
 * Solo se monta si DEMO_MAILBOX=true (por defecto en desarrollo, nunca en producción).
 * Muestra los correos que el sistema "habría enviado" para poder probar el flujo de
 * confirmación de cuenta. NO se envía ningún correo real.
 */
'use strict';

const express = require('express');

/**
 * @param {{repos: object}} deps
 */
function crearRutasDemo({ repos }) {
  const router = express.Router();
  router.get('/demo/buzon', (req, res) => {
    res.render('demo/buzon', { titulo: 'Buzón de demostración', correos: repos.usuarios.listarCorreos(50) });
  });
  return router;
}

module.exports = { crearRutasDemo };
