# Pruebas sobre el despliegue en Render

- URL: https://campusreserva.onrender.com
- Fecha de ejecución: 2026-11-11T05:57:24.430Z (UTC)
- Cliente: equipo de desarrollo en Chile, Node.js v24.21.0
- Comando: `node scripts/pruebas-despliegue.js https://campusreserva.onrender.com`
- Tipo: pruebas automatizadas de sistema sobre el entorno desplegado (no son pruebas con usuarios).

**Resultado:** 17/17 aprobadas; 98 solicitudes HTTP; 0 respuestas 5xx.

| ID | Prueba | Resultado | Detalle |
|---|---|---|---|
| DEP-01 | El servicio responde por HTTPS (la primera solicitud puede incluir el arranque en frío) | Aprobada | 200 en 217 ms |
| DEP-02 | Las solicitudes HTTP se redirigen a HTTPS | Aprobada | 301 → https://campusreserva.onrender.com/login |
| DEP-03 | Cabeceras de seguridad en producción (HSTS, CSP, nosniff, DENY, no-store) | Aprobada | HSTS: max-age=31536000; includeSubDomains |
| DEP-04 | RF-02 Inicio de sesión de estudiante con cookie segura (__Host-, Secure, HttpOnly, SameSite=Lax) | Aprobada | Max-Age, Path, HttpOnly, Secure, SameSite |
| DEP-05 | RF-02 Contraseña incorrecta y correo inexistente reciben el mismo mensaje genérico | Aprobada | ambas responden 401 con el mismo mensaje |
| DEP-06 | RF-01 Una cuenta pendiente de confirmación no puede iniciar sesión | Aprobada | respondió 401 |
| DEP-07 | RF-03 Consulta de disponibilidad por sede y fecha (2026-11-12) | Aprobada | 24 bloques disponibles |
| DEP-08 | RF-04 Reserva con revisión previa, confirmación e identificador | Aprobada | código CR-000007 |
| DEP-09 | RF-04 Un bloque ya reservado se rechaza al confirmar (409) | Aprobada | 409 Conflict |
| DEP-10 | RF-04 / ADR-001 10 solicitudes simultáneas de 2 usuarios por el mismo bloque confirman exactamente una | Aprobada | 1 confirmada y 9 rechazadas con 409 |
| DEP-11 | RF-05 Un usuario no puede ver ni cancelar reservas ajenas (404 sin cambios) | Aprobada | 404 en lectura y cancelación |
| DEP-12 | RF-05 Cancelación con confirmación; la reserva queda en el historial | Aprobada | CR-000007 cancelada |
| DEP-13 | OWASP A01 Un formulario sin token CSRF se rechaza (403) | Aprobada | 403 Forbidden |
| DEP-14 | RF-06 / OWASP A01 Un estudiante no accede a la administración (403) | Aprobada | 403 Forbidden |
| DEP-15 | RF-06 El administrador registra un espacio y se validan los datos | Aprobada | "Sala Prueba Despliegue 0256" registrado; capacidad 0 rechazada con 422 |
| DEP-16 | RF-01 Registro con listado institucional, enlace en el buzón de demostración y activación | Aprobada | nuevo.estudiante@campus.test activada; el enlace apunta a https://campusreserva.onrender.com |
| DEP-17 | Cierre de sesión: la sesión se destruye en el servidor | Aprobada | Mis reservas redirige al inicio de sesión |

## Tiempos de respuesta (ms, medidos desde el cliente; incluyen la red)

| Operación | n | p50 | p95 | Máx. |
|---|---|---|---|---|
| `GET /login` | 27 | 204.7 | 229.8 | 241.5 |
| `GET /disponibilidad` | 24 | 145.9 | 248.3 | 250.9 |
| `POST /reservas` | 13 | 170.8 | 511.2 | 511.2 |
| `POST /login` | 12 | 2786.1 | 5427.4 | 5427.4 |
| `GET /reservas/:id` | 3 | 155.9 | 204.8 | 204.8 |
| `GET /mis-reservas` | 3 | 171.2 | 213.2 | 213.2 |
| `POST /reservas/:id/cancelar` | 3 | 151.3 | 203.5 | 203.5 |
| `GET /admin/espacios` | 3 | 150.3 | 175.6 | 175.6 |
| `POST /admin/espacios` | 2 | 204.3 | 264.4 | 264.4 |
| `GET /reservas/nueva` | 1 | 204.1 | 204.1 | 204.1 |
| `GET /reservas/:id/cancelar` | 1 | 158.8 | 158.8 | 158.8 |
| `GET /registro` | 1 | 233.7 | 233.7 | 233.7 |
| `POST /registro` | 1 | 2662.4 | 2662.4 | 2662.4 |
| `GET /demo/buzon` | 1 | 173.9 | 173.9 | 173.9 |
| `GET /confirmar` | 1 | 148.2 | 148.2 | 148.2 |
| `POST /confirmar` | 1 | 189.6 | 189.6 | 189.6 |
| `POST /logout` | 1 | 205 | 205 | 205 |

Capturas: [dep-01-login.png](dep-01-login.png), [dep-02-disponibilidad.png](dep-02-disponibilidad.png), [dep-03-mis-reservas.png](dep-03-mis-reservas.png), [dep-04-admin-espacios.png](dep-04-admin-espacios.png), [dep-05-buzon-demo.png](dep-05-buzon-demo.png)
