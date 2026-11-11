# Pruebas sobre el despliegue en Render

- URL: https://campusreserva.onrender.com
- Fecha de ejecución: 2026-11-11T06:20:53.627Z (UTC)
- Cliente: equipo de desarrollo en Chile, Node.js v24.21.0
- Comando: `node scripts/pruebas-despliegue.js https://campusreserva.onrender.com`
- Tipo: pruebas automatizadas de sistema sobre el entorno desplegado (no son pruebas con usuarios).

**Resultado:** 17/17 aprobadas; 98 solicitudes HTTP; 0 respuestas 5xx.

| ID | Prueba | Resultado | Detalle |
|---|---|---|---|
| DEP-01 | El servicio responde por HTTPS (la primera solicitud puede incluir el arranque en frío) | Aprobada | 200 en 203 ms |
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
| DEP-15 | RF-06 El administrador registra un espacio y se validan los datos | Aprobada | "Sala E-0320" registrado; capacidad 0 rechazada con 422 |
| DEP-16 | RF-01 Registro con listado institucional, enlace en el buzón de demostración y activación | Aprobada | nuevo.estudiante@campus.test activada; el enlace apunta a https://campusreserva.onrender.com |
| DEP-17 | Cierre de sesión: la sesión se destruye en el servidor | Aprobada | Mis reservas redirige al inicio de sesión |

## Tiempos de respuesta (ms, medidos desde el cliente; incluyen la red)

| Operación | n | p50 | p95 | Máx. |
|---|---|---|---|---|
| `GET /login` | 27 | 168.9 | 233.6 | 303 |
| `GET /disponibilidad` | 24 | 150.3 | 232.8 | 235.6 |
| `POST /reservas` | 13 | 184 | 204.6 | 204.6 |
| `POST /login` | 12 | 2836.1 | 5635.8 | 5635.8 |
| `GET /reservas/:id` | 3 | 169.7 | 228.8 | 228.8 |
| `GET /mis-reservas` | 3 | 190.2 | 205 | 205 |
| `POST /reservas/:id/cancelar` | 3 | 145.6 | 146.9 | 146.9 |
| `GET /admin/espacios` | 3 | 147.9 | 205.3 | 205.3 |
| `POST /admin/espacios` | 2 | 204.6 | 260.9 | 260.9 |
| `GET /reservas/nueva` | 1 | 204.1 | 204.1 | 204.1 |
| `GET /reservas/:id/cancelar` | 1 | 149.4 | 149.4 | 149.4 |
| `GET /registro` | 1 | 172.4 | 172.4 | 172.4 |
| `POST /registro` | 1 | 2818.7 | 2818.7 | 2818.7 |
| `GET /demo/buzon` | 1 | 183 | 183 | 183 |
| `GET /confirmar` | 1 | 147.9 | 147.9 | 147.9 |
| `POST /confirmar` | 1 | 148.7 | 148.7 | 148.7 |
| `POST /logout` | 1 | 264.4 | 264.4 | 264.4 |

Capturas: [dep-01-login.png](dep-01-login.png), [dep-02-disponibilidad.png](dep-02-disponibilidad.png), [dep-03-mis-reservas.png](dep-03-mis-reservas.png), [dep-04-admin-espacios.png](dep-04-admin-espacios.png), [dep-05-buzon-demo.png](dep-05-buzon-demo.png)
