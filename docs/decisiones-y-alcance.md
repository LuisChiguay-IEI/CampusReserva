# Alcance, requerimientos y decisiones — CampusReserva (Sumativa 3)

Fuente de antecedentes: *Informe EV2 CampusReserva* (Sumativa 2, entregado el 29-10-2026), actividad Spike/ADR
(31-10-2026) e instrucciones del usuario para la Sumativa 3.

## 1. Trazabilidad con la Sumativa 2

La Sumativa 2 definió seis requerimientos funcionales, siete no funcionales, seis historias de usuario con criterios
Dado/Cuando/Entonces, seis casos de alto nivel (AN-01 a AN-06) y veintidós comportamientos detallados (DET-01 a DET-22),
organizados en Jira (proyecto KAN) y modelados en Enterprise Architect. **La numeración se mantiene sin cambios** en el MVP.

| RF | Nombre | Historia | Jira | Caso | Detalles (DET) | Estado en el MVP |
|---|---|---|---|---|---|---|
| RF-01 | Registro de usuario | HU-01 | KAN-1 | AN-01 | DET-01, DET-02 | Implementado y probado (correo simulado) |
| RF-02 | Inicio de sesión | HU-02 | KAN-2 | AN-02 | DET-03 a DET-05 | Implementado y probado |
| RF-03 | Consulta de disponibilidad | HU-03 | KAN-5 | AN-03 | DET-06 a DET-08 | Implementado y probado |
| RF-04 | Reserva de espacio | HU-04 | KAN-6 | AN-04 | DET-09 a DET-11 | Implementado y probado |
| RF-05 | Consulta de reservas propias | HU-05 | KAN-7 | AN-05 | DET-12 a DET-14 | Implementado y probado |
| RF-06 | Administración de espacios | HU-06 | KAN-8 | AN-06 | DET-15 a DET-22 | Implementado y probado |

Epics de Jira: KAN-42 *Requisitos de CampusReserva* y KAN-43 *Diseño transversal del sistema*. Cronograma de la
Sumativa 2: KAN-35 (entrega 29-10), KAN-36 (revisión y ajustes, 30-10 al 12-11), KAN-37 (profundización, 13 al 26-11),
KAN-38 (validación), KAN-39 (cierre). La Unidad 3 exigió además programar el MVP, por lo que el periodo de KAN-36 se
destinó a la implementación (ver `docs/jira-actualizaciones.md`).

## 2. Resolución de las observaciones abiertas de la Sumativa 2 (su Tabla 22)

| Tema abierto en la ES2 | Resolución en el MVP | Evidencia |
|---|---|---|
| Roles y clases: retirar *gestionarHorarios* de Docente | Solo ADMINISTRADOR accede a RF-06; el servidor lo verifica en la ruta y en el servicio | CP-06-01, CP-04-06 |
| Cuentas y verificación: estado pendiente, hash y datos del enlace | `usuario.estado` PENDIENTE/ACTIVA, `password_hash` scrypt, tabla `token_confirmacion` (hash SHA-256, vence a las 24 h, un solo uso; una nueva emisión invalida la anterior) | CP-01-01, CP-01-07, CP-01-08 |
| Cancelación: plazo y condiciones | **Propuesta**: hasta 60 minutos antes del inicio del bloque (D-08; sigue pendiente de acuerdo institucional) | CP-05-05, CP-U-24 |
| Inhabilitación de espacios con reservas futuras | **Propuesta**: se rechaza la operación e informa las reservas afectadas; no hay cancelación automática | CP-06-05 |
| Actividad y filtro opcional | El filtro por sala o laboratorio es opcional en la interfaz y en el servidor | CP-03-04, captura 09 |
| Concurrencia e historial | Transacción `BEGIN IMMEDIATE` + índice único parcial (solo reservas CONFIRMADAS): impide duplicados y conserva el historial de canceladas | CP-04-03, CP-04-07, CP-04-08 |
| Cliente y usuarios: revisión guiada | Las 8 tareas de usuario se verificaron con pruebas automatizadas (`docs/pruebas-usuario.md`); la revisión con personas y con la institución queda como mejora | T1 a T8 |
| Planificación y estimación | Plan reorientado a la implementación en Jira (KAN-36) | `docs/jira-actualizaciones.md` |

Refinamiento del modelo de clases: en la ES2 la clase *Horario* tenía `fecha`. En el MVP el horario es un **bloque semanal
recurrente** (día de la semana, inicio y fin) y la fecha se registra en la *Reserva* y en el *Bloqueo*; así un mismo
bloque se reutiliza cada semana y la multiplicidad Horario 1–0..1 Reserva se cumple por fecha mediante el índice único parcial.

## 3. Requerimientos funcionales (sin cambios de alcance respecto de la ES2)

| ID | Descripción | Prioridad | Cumplimiento |
|---|---|---|---|
| RF-01 | Estudiantes y docentes se registran con nombre, correo institucional y contraseña. Se validan los datos, se impiden correos duplicados, el rol se asigna desde el listado institucional autorizado (sin opción Administrador) y la cuenta queda pendiente hasta confirmar el correo con un enlace válido. | Alta | Sí. El envío de correo se reemplaza por el Buzón de demostración (limitación declarada) |
| RF-02 | Estudiantes, docentes y administradores se autentican; el sistema valida la cuenta y habilita solo las funciones de su rol. Las cuentas administrativas se crean fuera del registro público. | Alta | Sí |
| RF-03 | Estudiantes y docentes seleccionan sede y fecha (sala o laboratorio opcional) y ven espacios y horarios disponibles considerando reservas, bloqueos y espacios habilitados. La consulta no modifica datos. | Alta | Sí |
| RF-04 | Estudiantes y docentes eligen espacio y horario, revisan y confirman. Al guardar se comprueba otra vez la disponibilidad y se impiden duplicados aun con solicitudes concurrentes. La reserva queda asociada a la cuenta y obtiene un identificador. | Alta | Sí. Estudiantes: solo salas de estudio (D-16); docentes y administración (D-17): cualquier espacio |
| RF-05 | Estudiantes y docentes consultan solo sus reservas y cancelan las propias que cumplan las condiciones. La cancelación requiere confirmación y conserva el historial. | Alta | Sí; cancelación hasta 60 minutos antes (D-08) |
| RF-06 | Solo el administrador registra y edita salas y laboratorios, los habilita o deshabilita y crea, modifica o bloquea horarios. Se validan sede, nombre, tipo, capacidad y configuración horaria, sin superposiciones ni efectos silenciosos sobre reservas confirmadas. | Alta | Sí |
| Apoyo | Cerrar sesión (invalida la sesión en el servidor). | Media | Sí |

## 4. Requerimientos no funcionales

RNF-01 a RNF-07 provienen de la Sumativa 2 (con la "forma de comprobación prevista" que allí se definió, ahora
ejecutada). RNF-08 y RNF-09 provienen del Spike/ADR. RNF-10 y RNF-11 se agregan en esta entrega.

| ID | Origen | Atributo | Criterio verificable | Verificación ejecutada | Resultado |
|---|---|---|---|---|---|
| RNF-01 | ES2 | Seguridad de acceso | Toda operación protegida verifica sesión válida y permiso del rol en el servidor; ocultar opciones no reemplaza la autorización | CP-03-08, CP-04-06, CP-06-01, CP-06-12 | Cumple |
| RNF-02 | ES2 | Protección de credenciales | Transmisión por HTTPS; contraseñas con hash y sal; nunca en texto legible ni en registros | CP-U-17, CP-01-01; revisión de la auditoría; DEP-02 a DEP-04 en Render | Cumple: hash scrypt y registros sin credenciales; en el despliegue, HTTP redirige a HTTPS (301), HSTS activo y cookie `__Host-` con Secure |
| RNF-03 | ES2 | Privacidad de reservas | Consulta y cancelación limitadas a la identidad autenticada; un identificador enviado por el cliente no da acceso a reservas ajenas | CP-05-01, CP-05-02 | Cumple |
| RNF-04 | ES2 | Integridad de reservas | La comprobación final y el guardado impiden reservas confirmadas superpuestas aun ante solicitudes simultáneas | CP-04-03, CP-04-07, CP-04-08, `npm run metricas` | Cumple: 0 duplicados en 250 solicitudes |
| RNF-05 | ES2 | Consistencia | Las modificaciones se completan o revierten sin estados parciales | CP-U-28 (fallo simulado), CP-04-07 | Cumple |
| RNF-06 | ES2 | Claridad de interfaz | Distingue obligatorios y opcionales, errores de campo, ausencia de resultados y fallos técnicos; muestra resumen antes de reservar o cancelar; usable en 390 px | CP-03-05, CP-05-03; capturas 02, 10, 11, 13, 15, 26, 27 | Cumple (verificación visual y tareas de usuario automatizadas; sin sesiones con personas) |
| RNF-07 | ES2 | Mantenibilidad | Presentación, negocio y persistencia separadas; la interfaz no accede a la base; cobertura de líneas ≥ 80 % | Estructura `src/`; `npm run test:coverage` | Cumple: 97,07 % |
| RNF-08 | Spike RNF1 + nuevo | Rendimiento | Confirmación de reserva: p95 ≤ 800 ms con 50 solicitudes simultáneas y errores técnicos < 1 %. Consulta de disponibilidad: p95 ≤ 500 ms con 20 concurrentes | `npm run metricas` | Cumple: 116,7 ms y 0 %; 234,0 ms |
| RNF-09 | Spike RNF2 | Disponibilidad | ≥ 99,5 % durante el período académico | Requiere monitoreo continuo en un plan sin suspensión | **No verificado**: el despliegue de demostración usa el plan gratuito, que se suspende tras 15 min sin tráfico |
| RNF-10 | Nuevo | Protección de datos personales | Minimización (nombre, correo, rol); sin IP en auditoría; tokens y sesiones guardados como hash; páginas `no-store`; datos de demostración ficticios | CP-02-08, CP-02-09; revisión del esquema | Cumple |
| RNF-11 | Spike RNF3 + nuevo | Seguridad de sesión y entradas | Sesión de 256 bits regenerada al autenticar; expira a los 30 min de inactividad y 8 h absolutas; CSRF en todo formulario; validación en servidor; SQL parametrizado; ≤ 10 intentos fallidos por IP en 15 min; secretos fuera del código | CP-02-04 a CP-02-10, CP-U-09, CP-04-05 | Cumple |

Observación medida sin umbral: 50 inicios de sesión simultáneos tienen p95 = 1,36 s por el costo deliberado de scrypt
(≈ 230 ms por verificación aislada); compromiso aceptado entre seguridad y rendimiento. En el despliegue gratuito de
Render un inicio de sesión tarda ≈ 3 s en la mediana (p95 5,7 s), porque el plan entrega solo una fracción de CPU.

## 5. Riesgos iniciales

| ID | Riesgo | Prob. | Impacto | Mitigación aplicada | Estado |
|---|---|---|---|---|---|
| R1 | Dos usuarios reservan el mismo bloque al mismo tiempo | Alta | Alto | ADR-001: transacción + índice único parcial; pruebas multiproceso y de carga | Mitigado y verificado |
| R2 | Acceso a funciones de otro rol o a reservas ajenas | Media | Alto | Autorización por rol en servidor; pertenencia verificada en SQL; 404 ante reservas ajenas | Mitigado y verificado |
| R3 | Robo o adivinación de contraseñas | Media | Alto | scrypt, 8 a 64 caracteres con letra y número, rechazo de contraseñas comunes, mensaje genérico, límite de intentos | Mitigado y verificado |
| R4 | Exposición de datos personales | Media | Alto | Minimización, hash de tokens y sesiones, auditoría sin datos sensibles, `no-store` | Mitigado (sin auditoría externa) |
| R5 | No hay servicio de correo para confirmar cuentas | Alta | Medio | Buzón de demostración rotulado; enlace de un solo uso con vencimiento | Aceptado como limitación |
| R6 | Plazo acotado y desarrollo individual | Alta | Medio | Kanban con WIP 1/1, alcance MVP, automatización de pruebas y evidencias | Gestionado |
| R7 | Paquetes no aprobados en el registro corporativo (express-session, helmet, supertest) | Ocurrió | Medio | Implementación propia y probada de sesión, cabeceras y CSRF; pruebas con `fetch` nativo | Resuelto |
| R8 | Cambios administrativos que alteren reservas confirmadas | Media | Alto | Regla de rechazo con detalle de reservas afectadas | Mitigado y verificado |
| R9 | Reglas institucionales sin validar (plazos de cancelación, listado, inhabilitación) | Alta | Medio | Se implementan como propuestas explícitas y configurables; validación con la institución pendiente | Abierto |
| R10 | El despliegue gratuito está suspendido o se reinicia durante una revisión | Alta | Bajo | Abrir el enlace un minuto antes; los datos ficticios se recargan solos; el MVP también corre en local con `npm start` | Aceptado |
| R11 | Un estudiante ocupa una sala de clases o un laboratorio que un docente necesita | Alta | Alto | Estudiantes solo reservan salas de estudio, hasta 7 días antes y con 2 reservas vigentes como máximo (D-16) | Mitigado y verificado |

## 6. Reglas y decisiones

### 6.1 Heredadas de la Sumativa 2 o del ADR-001 (propuestas de diseño que la ES2 dejó sujetas a aceptación institucional)

- Roles Estudiante, Docente y Administrador; cuentas administrativas creadas fuera del registro público (RF-02).
- Rol asignado desde el listado institucional; cuenta pendiente hasta confirmar el correo (RF-01, HU-01).
- Rechazo de contraseñas comunes (HU-01). La regla de largo de la HU-01 (15 a 128 caracteres con espacios) se
  reemplazó por la decisión D-15 tras revisar la coherencia del prototipo.
- Enlace de confirmación de **un solo uso, vigente 24 horas**; una nueva emisión invalida la anterior (HU-01).
- La consulta no modifica reservas; considera habilitación, horarios, bloqueos y reservas confirmadas (RF-03).
- Revisión del resumen, nueva comprobación al guardar e identificador de la reserva (RF-04, HU-04).
- Solo reservas propias; cancelación con confirmación y conservación del historial (RF-05, HU-05).
- Validación de sede, nombre, tipo, capacidad y configuración horaria; sin efectos silenciosos sobre reservas (RF-06, HU-06).
- ADR-001: transacción + restricción única sobre espacio + fecha + bloque.

### 6.2 Decisiones nuevas de esta entrega (deben validarse con el docente o la institución)

| ID | Decisión | Motivo |
|---|---|---|
| D-01 | Correo institucional = dominio configurable (`INSTITUTIONAL_DOMAIN`) **y** presencia en el listado | Mensajes claros y autorización explícita |
| D-02 | Rechazo de contraseñas comunes mediante lista local y patrones (repetidas, solo dígitos); la consulta a bases de contraseñas filtradas queda pendiente | Implementación posible sin servicios externos |
| D-03 | Del enlace se guarda solo el hash SHA-256; si expiró, iniciar sesión emite uno nuevo | Evita el robo del token y las cuentas bloqueadas |
| D-04 | Buzón de demostración en lugar de correo real, activable solo con `DEMO_MAILBOX=true` | No hay servicio de correo disponible |
| D-05 | El enlace abre una página con botón; la activación ocurre por POST | Los escáneres de enlaces no consumen el token |
| D-06 | Horario = bloque semanal recurrente entre 07:00 y 23:00, de 30 a 240 min (refina la clase *Horario* de la ES2) | Modelo simple, validable y reutilizable |
| D-07 | Reservas desde hoy: docentes y administración hasta 30 días, estudiantes hasta 7; no se reservan bloques ya iniciados | Las clases se planifican primero; ventana acotada |
| D-08 | Cancelación permitida hasta 60 minutos antes del inicio del bloque | La ES2 dejó el plazo abierto; evita liberar un espacio cuando ya no se puede reutilizar |
| D-09 | Bloqueo = bloque horario en una fecha con motivo; se puede quitar | Mantenciones y eventos puntuales |
| D-10 | Deshabilitar un espacio, modificar o desactivar un bloque o bloquear un horario con reservas vigentes se **rechaza** listando las reservas | La ES2 exigía no afectar reservas y no asumir cancelación automática |
| D-11 | La sede de un espacio no se edita después de crearlo | Evita mover reservas existentes a otra sede |
| D-12 | Registro de auditoría de eventos de seguridad, visible solo para el administrador | Trazabilidad y detección (OWASP A09) |
| D-13 | Las reservas ajenas responden 404 (no 403) | No revelar la existencia de reservas de otras personas |
| D-14 | Despliegue de demostración en Render (PaaS, plan gratuito) definido en `render.yaml`, con `DEMO_MAILBOX=true` y datos ficticios que se restablecen al reiniciar | Permite revisar el MVP desde un enlace público y verificar HTTPS; el buzón se mantiene porque no hay servicio de correo |
| D-15 | Contraseña de 8 a 64 caracteres, con al menos una letra y un número, sin espacios y sin contraseñas comunes (reemplaza el largo de la HU-01) | Regla habitual para los usuarios; mínimo de 8 de OWASP ASVS, reforzado con letra, número y lista de comunes |
| D-16 | Nuevo tipo de espacio «Sala de estudio». Los estudiantes solo reservan salas de estudio, con un máximo de 2 reservas vigentes | Un estudiante no puede dejar sin sala de clases o laboratorio a un docente que la necesita para una clase |
| D-17 | La administración también puede reservar cualquier espacio (por ejemplo, para eventos) | Antes el administrador solo gestionaba espacios |

## 7. Alcance y limitaciones del MVP

**Incluido:** los seis RF, cierre de sesión, auditoría, datos ficticios, pruebas automatizadas, métricas, capturas, diagramas
y un despliegue de demostración en Render (https://campusreserva.onrender.com) probado con 17 pruebas de aceptación.

**Fuera de alcance / limitaciones:** envío real de correos; despliegue productivo (el de demostración usa el plan gratuito:
se suspende tras 15 min sin tráfico, tarda en despertar y pierde los cambios al reiniciar) y por lo tanto disponibilidad
no medida (RNF-09); notificaciones; reportes; gestión de sedes y del
listado institucional desde la interfaz; recuperación de contraseña; verificación contra contraseñas filtradas; sesiones
con personas reales (las tareas de usuario se verificaron con pruebas automatizadas); validación institucional de las
reglas propuestas (pendiente desde la ES2).
