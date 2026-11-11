# Índice de capturas (generadas con `npm run capturas`)

Fecha: 2026-11-11T07:20:25.125Z

| Archivo | Descripción | Ruta |
|---|---|---|
| 01-login.png | RF-02 Pantalla de inicio de sesión con correo institucional y contraseña. | /login |
| 02-registro-validaciones.png | RF-01 Validación en servidor: nombre, dominio institucional y contraseña. | /registro |
| 03-registro-pendiente.png | RF-01 Cuenta creada en estado pendiente de confirmación. | /registro/enviado |
| 04-buzon-demostracion.png | RF-01 Buzón de demostración: correo simulado con enlace de confirmación (no se envían correos reales). | /demo/buzon |
| 05-login-cuenta-pendiente.png | RF-01/RF-02 Una cuenta pendiente no puede iniciar sesión. | /login |
| 06-confirmar-cuenta.png | RF-01 Confirmación de cuenta desde el enlace (requiere presionar el botón). | /confirmar?token=tfGPzqukgKsMs8V_NGYuuwRNyRqcGEuyxMu5exhxlFs |
| 07-cuenta-confirmada.png | RF-01 Cuenta activada: ya puede iniciar sesión. | /login |
| 08-login-credenciales-invalidas.png | RF-02 Rechazo de credenciales inválidas con mensaje genérico. | /login |
| 09-disponibilidad-resultados.png | RF-03 Disponibilidad de un docente por sede y fecha (excluye reservados, bloqueados y espacios deshabilitados). | /disponibilidad?sede=1&fecha=2026-11-12 |
| 28-disponibilidad-estudiante.png | RF-03 Disponibilidad de un estudiante: solo salas de estudio, hasta 7 días y máximo 2 reservas vigentes. | /disponibilidad?sede=1&fecha=2026-11-12 |
| 10-disponibilidad-sin-resultados.png | RF-03 Consulta sin resultados. | /disponibilidad?sede=2&fecha=2026-11-15 |
| 11-revisar-reserva.png | RF-04 Revisión de la selección antes de confirmar. | /reservas/nueva?espacio=8&horario=273&fecha=2026-11-12&sede=1 |
| 12-reserva-confirmada.png | RF-04 Reserva confirmada con identificador único. | /reservas/8 |
| 13-reserva-conflicto.png | RF-04 Segundo intento sobre el mismo horario: la disponibilidad se verifica nuevamente y se rechaza. | /reservas |
| 14-mis-reservas.png | RF-05 Mis reservas: próximas e historial (solo reservas propias). | /mis-reservas |
| 15-cancelar-confirmacion.png | RF-05 La cancelación pide confirmación explícita. | /reservas/1/cancelar |
| 16-reserva-cancelada.png | RF-05 Reserva cancelada: se conserva en el historial y libera el horario. | /mis-reservas |
| 17-reserva-ajena-404.png | RF-05 Intento de ver una reserva ajena: el servidor responde 404. | /reservas/4 |
| 18-acceso-denegado-403.png | RF-02 Restricción por rol: un estudiante no accede a la administración (403). | /admin/espacios |
| 19-admin-espacios.png | RF-06 Panel de espacios del administrador. | /admin/espacios |
| 20-admin-espacio-validaciones.png | RF-06 Validación de nombre, tipo y capacidad. | /admin/espacios |
| 21-admin-horarios.png | RF-06 Bloques horarios, formulario de bloqueo y bloqueos vigentes. | /admin/espacios/1/horarios |
| 22-admin-superposicion.png | RF-06 Rechazo de un bloque superpuesto. | /admin/espacios/1/horarios |
| 23-admin-bloqueo-rechazado.png | RF-06 No se bloquea un horario con reserva confirmada (no se afectan reservas en silencio). | /admin/espacios/1/bloqueos |
| 24-admin-deshabilitar-rechazado.png | RF-06 No se deshabilita un espacio con reservas vigentes. | /admin/espacios |
| 25-auditoria.png | Registro de auditoría: inicios de sesión, accesos denegados, reservas y cambios administrativos. | /admin/auditoria |
| 26-movil-disponibilidad.png | Diseño responsive: disponibilidad en un teléfono (390 px). | /disponibilidad?sede=1&fecha=2026-11-12 |
| 27-movil-mis-reservas.png | Diseño responsive: tablas convertidas en tarjetas apiladas. | /mis-reservas |
