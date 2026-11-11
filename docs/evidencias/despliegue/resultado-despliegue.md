# Pruebas sobre el despliegue en Render

- URL: https://campusreserva.onrender.com
- Fecha de ejecución: 2026-11-11T05:17:13.606Z (UTC)
- Cliente: equipo de desarrollo en Chile, Node.js v24.21.0
- Comando: `node scripts/pruebas-despliegue.js https://campusreserva.onrender.com`
- Tipo: pruebas automatizadas de sistema sobre el entorno desplegado (no son pruebas con usuarios).

**Resultado:** 17/17 aprobadas; 99 solicitudes HTTP; 0 respuestas 5xx.

| ID | Prueba | Resultado | Detalle |
|---|---|---|---|
| DEP-01 | El servicio responde por HTTPS (la primera solicitud puede incluir el arranque en frío) | Aprobada | 200 en 257 ms |
| DEP-02 | Las solicitudes HTTP se redirigen a HTTPS | Aprobada | 301 → https://campusreserva.onrender.com/login |
| DEP-03 | Cabeceras de seguridad en producción (HSTS, CSP, nosniff, DENY, no-store) | Aprobada | HSTS: max-age=31536000; includeSubDomains |
| DEP-04 | RF-02 Inicio de sesión de estudiante con cookie segura (__Host-, Secure, HttpOnly, SameSite=Lax) | Aprobada | Max-Age, Path, HttpOnly, Secure, SameSite |
| DEP-05 | RF-02 Contraseña incorrecta y correo inexistente reciben el mismo mensaje genérico | Aprobada | ambas responden 401 con el mismo mensaje |
| DEP-06 | RF-01 Una cuenta pendiente de confirmación no puede iniciar sesión | Aprobada | respondió 401 |
| DEP-07 | RF-03 Consulta de disponibilidad por sede y fecha (2026-11-12) | Aprobada | 23 bloques disponibles |
| DEP-08 | RF-04 Reserva con revisión previa, confirmación e identificador | Aprobada | código CR-000009 |
| DEP-09 | RF-04 Un bloque ya reservado se rechaza al confirmar (409) | Aprobada | 409 Conflict |
| DEP-10 | RF-04 / ADR-001 10 solicitudes simultáneas de 2 usuarios por el mismo bloque confirman exactamente una | Aprobada | 1 confirmada y 9 rechazadas con 409 |
| DEP-11 | RF-05 Un usuario no puede ver ni cancelar reservas ajenas (404 sin cambios) | Aprobada | 404 en lectura y cancelación |
| DEP-12 | RF-05 Cancelación con confirmación; la reserva queda en el historial | Aprobada | CR-000009 cancelada |
| DEP-13 | OWASP A01 Un formulario sin token CSRF se rechaza (403) | Aprobada | 403 Forbidden |
| DEP-14 | RF-06 / OWASP A01 Un estudiante no accede a la administración (403) | Aprobada | 403 Forbidden |
| DEP-15 | RF-06 El administrador registra un espacio y se validan los datos | Aprobada | "Sala Prueba Despliegue 0216" registrado; capacidad 0 rechazada con 422 |
| DEP-16 | RF-01 Registro con listado institucional, enlace en el buzón de demostración y activación | Aprobada | camila.estudiante@campus.test activada; el enlace apunta a https://campusreserva.onrender.com |
| DEP-17 | Cierre de sesión: la sesión se destruye en el servidor | Aprobada | Mis reservas redirige al inicio de sesión |

## Tiempos de respuesta (ms, medidos desde el cliente; incluyen la red)

| Operación | n | p50 | p95 | Máx. |
|---|---|---|---|---|
| `GET /login` | 27 | 169.9 | 224.2 | 257.4 |
| `GET /disponibilidad` | 24 | 145.8 | 205.2 | 205.2 |
| `POST /reservas` | 13 | 185.4 | 409.6 | 409.6 |
| `POST /login` | 12 | 2879.8 | 3074.8 | 3074.8 |
| `GET /reservas/:id` | 3 | 144 | 205 | 205 |
| `GET /mis-reservas` | 3 | 164.7 | 193.8 | 193.8 |
| `POST /reservas/:id/cancelar` | 3 | 162.7 | 204.5 | 204.5 |
| `GET /admin/espacios` | 3 | 147.9 | 152.5 | 152.5 |
| `POST /admin/espacios` | 2 | 162.6 | 172.2 | 172.2 |
| `POST /registro` | 2 | 205.3 | 2867.1 | 2867.1 |
| `GET /reservas/nueva` | 1 | 170.4 | 170.4 | 170.4 |
| `GET /reservas/:id/cancelar` | 1 | 144.5 | 144.5 | 144.5 |
| `GET /registro` | 1 | 196.1 | 196.1 | 196.1 |
| `GET /demo/buzon` | 1 | 204.5 | 204.5 | 204.5 |
| `GET /confirmar` | 1 | 204.8 | 204.8 | 204.8 |
| `POST /confirmar` | 1 | 205.7 | 205.7 | 205.7 |
| `POST /logout` | 1 | 204.7 | 204.7 | 204.7 |

Capturas: [dep-01-login.png](dep-01-login.png), [dep-02-disponibilidad.png](dep-02-disponibilidad.png), [dep-03-mis-reservas.png](dep-03-mis-reservas.png), [dep-04-admin-espacios.png](dep-04-admin-espacios.png), [dep-05-buzon-demo.png](dep-05-buzon-demo.png)
