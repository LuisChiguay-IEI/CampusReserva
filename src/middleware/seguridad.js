/**
 * Middleware de seguridad HTTP: cabeceras defensivas, protección CSRF y límite de intentos.
 */
'use strict';

const { rateLimit } = require('express-rate-limit');
const { tokenAleatorio, compararSeguro } = require('../lib/seguridad');
const { ErrorApp } = require('../lib/errores');

/**
 * Cabeceras de seguridad (equivalentes a las que aplicaría helmet).
 * CSP estricta: solo recursos propios, sin scripts ni estilos en línea.
 * @param {{esProduccion: boolean}} config
 */
function cabecerasSeguridad(config) {
  const politicaContenido = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  return function cabeceras(req, res, next) {
    res.setHeader('Content-Security-Policy', politicaContenido);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Las páginas dinámicas contienen datos personales: no deben quedar en caché.
    res.setHeader('Cache-Control', 'no-store');
    if (config.esProduccion) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

/**
 * Protección CSRF con token sincronizado: cada sesión tiene un token aleatorio que se
 * incluye como campo oculto en todos los formularios y se verifica en cada POST.
 * Se complementa con la cookie SameSite=Lax.
 */
function proteccionCsrf() {
  return function csrf(req, res, next) {
    if (!req.sesion.datos.csrf) req.sesion.datos.csrf = tokenAleatorio(32);
    res.locals.csrfToken = req.sesion.datos.csrf;

    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const enviado = req.body && typeof req.body._csrf === 'string' ? req.body._csrf : '';
    if (enviado && compararSeguro(enviado, req.sesion.datos.csrf)) return next();

    return next(
      new ErrorApp(
        403,
        'No fue posible verificar la solicitud (token CSRF inválido o sesión expirada). Recarga la página e inténtalo nuevamente.',
        'CSRF',
      ),
    );
  };
}

/**
 * Límite de intentos por IP para frenar ataques de fuerza bruta (OWASP A07).
 * @param {{ventanaMs:number, maximo:number}} opciones
 * @param {boolean} [soloFallidos=true] Si es true, solo cuentan las respuestas con error.
 */
function limiteIntentos({ ventanaMs, maximo }, soloFallidos = true) {
  return rateLimit({
    windowMs: ventanaMs,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: soloFallidos,
    handler: (req, res, next) =>
      next(
        new ErrorApp(
          429,
          'Demasiados intentos en poco tiempo. Espera unos minutos antes de volver a intentarlo.',
          'LIMITE_INTENTOS',
        ),
      ),
  });
}

module.exports = { cabecerasSeguridad, proteccionCsrf, limiteIntentos };
