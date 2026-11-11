/**
 * Rutas de cuentas: registro y confirmación (RF-01), inicio de sesión (RF-02) y cierre de sesión.
 */
'use strict';

const express = require('express');
const { ErrorValidacion, ErrorAutenticacion, ErrorApp } = require('../lib/errores');
const { limiteIntentos } = require('../middleware/seguridad');
const { INICIO_POR_ROL, requiereSesion } = require('../middleware/autorizacion');

/**
 * @param {{servicios: object, config: object, repos: object, reloj: object}} deps
 */
function crearRutasCuentas({ servicios, config, repos, reloj }) {
  const router = express.Router();
  const limiteLogin = limiteIntentos(config.limiteLogin, true);
  const limiteRegistro = limiteIntentos({ ventanaMs: 60 * 60 * 1000, maximo: config.limiteLogin.maximo * 2 }, false);

  router.get('/', (req, res) => {
    res.redirect(303, req.usuario ? INICIO_POR_ROL[req.usuario.rol] : '/login');
  });

  // ------------------------------------------------------------ Inicio de sesión (RF-02)

  router.get('/login', (req, res) => {
    if (req.usuario) return res.redirect(303, INICIO_POR_ROL[req.usuario.rol]);
    res.render('cuentas/login', { titulo: 'Iniciar sesión', valores: {}, error: null, pendiente: false });
  });

  router.post('/login', limiteLogin, async (req, res, next) => {
    try {
      const usuario = await servicios.autenticacion.iniciarSesion(req.body);
      // Nuevo identificador de sesión al autenticar: previene fijación de sesión.
      req.sesion.regenerar();
      req.sesion.datos.usuarioId = usuario.id;
      req.flash('exito', `Hola, ${usuario.nombre}. Sesión iniciada correctamente.`);
      res.redirect(303, INICIO_POR_ROL[usuario.rol]);
    } catch (error) {
      if (!(error instanceof ErrorAutenticacion)) return next(error);
      res.status(401).render('cuentas/login', {
        titulo: 'Iniciar sesión',
        valores: { correo: typeof req.body.correo === 'string' ? req.body.correo.slice(0, 254) : '' },
        error: error.message,
        pendiente: error.codigo === 'CUENTA_PENDIENTE',
      });
    }
  });

  router.post('/logout', requiereSesion, (req, res) => {
    repos.auditoria.registrar({ fecha: reloj.ahoraIso(), usuarioId: req.usuario.id, accion: 'LOGOUT' });
    req.sesion.destruir();
    req.flash('info', 'Cerraste sesión correctamente.');
    res.redirect(303, '/login');
  });

  // ------------------------------------------------------------ Registro (RF-01)

  router.get('/registro', (req, res) => {
    if (req.usuario) return res.redirect(303, INICIO_POR_ROL[req.usuario.rol]);
    res.render('cuentas/registro', { titulo: 'Crear cuenta', valores: {}, errores: {} });
  });

  router.post('/registro', limiteRegistro, async (req, res, next) => {
    try {
      const { correo } = await servicios.autenticacion.registrar(req.body);
      req.sesion.datos.registroCorreo = correo;
      res.redirect(303, '/registro/enviado');
    } catch (error) {
      if (!(error instanceof ErrorValidacion)) return next(error);
      res.status(422).render('cuentas/registro', {
        titulo: 'Crear cuenta',
        // Nunca se devuelve la contraseña al formulario.
        valores: { nombre: req.body.nombre, correo: req.body.correo },
        errores: error.errores,
      });
    }
  });

  router.get('/registro/enviado', (req, res) => {
    const correo = req.sesion.datos.registroCorreo;
    if (!correo) return res.redirect(303, '/registro');
    delete req.sesion.datos.registroCorreo;
    res.render('cuentas/registro-enviado', { titulo: 'Confirma tu correo', correo });
  });

  // El enlace del correo abre una página con un botón: la confirmación ocurre por POST,
  // así un escáner de enlaces o una vista previa no consume el token.
  router.get('/confirmar', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    res.render('cuentas/confirmar', { titulo: 'Confirmar cuenta', token, error: null });
  });

  router.post('/confirmar', (req, res, next) => {
    try {
      servicios.autenticacion.confirmarCorreo(req.body.token);
      req.flash('exito', 'Tu correo fue confirmado y tu cuenta está activa. Ya puedes iniciar sesión.');
      res.redirect(303, '/login');
    } catch (error) {
      if (!(error instanceof ErrorApp) || error.codigo !== 'TOKEN_INVALIDO') return next(error);
      res.status(400).render('cuentas/confirmar', { titulo: 'Confirmar cuenta', token: '', error: error.message });
    }
  });

  return router;
}

module.exports = { crearRutasCuentas };
