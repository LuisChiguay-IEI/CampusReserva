# Plan de Pruebas Integral — CampusReserva (MVP)

Versión 1.1 · 11-11-2026 · Responsable: Luis Santiago Chiguay Espinoza
(1.1: se agregan CP-U-29/30, las pruebas de aceptación sobre el despliegue en Render y sus tiempos de respuesta)

## 1. Objetivo y alcance

Verificar que los requerimientos RF-01 a RF-06, el cierre de sesión y los requerimientos no funcionales de
seguridad, rendimiento y protección de datos se cumplen en el MVP, con evidencia reproducible.

Fuera de alcance: pruebas de carga sobre el despliegue gratuito (se evitaron para no saturar el servicio), medición
de disponibilidad, pruebas de penetración externas, auditoría formal de accesibilidad y pruebas con usuarios reales
(procedimiento preparado, ejecución **pendiente**).

## 2. Estrategia

| Nivel | Qué verifica | Herramienta | Cantidad | Estado |
|---|---|---|---|---|
| Unitarias | Funciones puras: validaciones, fechas, hash y tokens, cálculo de disponibilidad, reglas de cancelación, reversión de transacciones, configuración por entorno | `node:test` + `node:assert` | 30 | Ejecutadas: 30/30 aprobadas |
| Integración | Recorridos HTTP completos contra una instancia real (Express + SQLite temporal): cuentas, sesión, roles, disponibilidad, reservas, administración | `node:test` + `fetch` nativo con cookies y CSRF | 49 | Ejecutadas: 49/49 aprobadas |
| Concurrencia | 8 procesos independientes sobre el mismo archivo SQLite compiten por el mismo bloque | `child_process.fork` | 2 | Ejecutadas: 2/2 aprobadas |
| Aceptación sobre el despliegue | Flujos RF-01 a RF-06 y cierre de sesión, HTTPS y redirección, cabeceras, cookie `__Host-`/Secure, CSRF, roles y 10 reservas simultáneas contra https://campusreserva.onrender.com | `scripts/pruebas-despliegue.js` | 17 | Ejecutadas: 17/17 aprobadas |
| Carga / rendimiento | Latencia y errores con 4 servidores y 50 usuarios simultáneos; revalidación del ADR-001 | `scripts/carga-concurrente.js` | 1 corrida (5 rondas) | Ejecutada |
| Cobertura de código | Líneas, ramas y funciones de `src/` ejercitadas por las pruebas | `--experimental-test-coverage` de Node.js | — | Ejecutada |
| Interfaz (evidencia) | Recorridos visuales reales en Edge, incluida vista móvil | `scripts/capturas.js` (playwright-core) | 27 capturas | Generadas |
| Usuario (UAT) | Tareas reales con estudiantes, docentes y un administrador representativo | Guion en `docs/pruebas-usuario.md` | 8 tareas | **Pendiente de ejecución** |

**Entorno de ejecución:** Windows 11 (10.0.26200), AMD Ryzen 9 8940HX (32 núcleos lógicos), 63 GB RAM,
Node.js 24.21.0, SQLite 3.53.4, Microsoft Edge (capturas). Cliente y servidor en el mismo equipo (localhost).

**Entorno desplegado:** Render (PaaS), plan gratuito, región Virginia (EE. UU.), Node.js 24, `NODE_ENV=production`,
TLS en el proxy de Render, disco efímero (la base vuelve a los datos ficticios al reiniciar). Las pruebas sobre el
despliegue se ejecutan desde el equipo de desarrollo en Chile, por lo que sus tiempos incluyen la latencia de red.

**Datos de prueba:** datos ficticios del seed (`src/db/seed.js`): 2 sedes, 7 espacios (1 deshabilitado), 249 bloques
horarios, 4 cuentas, 6 correos en el listado institucional, 6 reservas (1 cancelada, 1 pasada) y 1 bloqueo.
Las pruebas fijan el reloj en **lunes 16-11-2026 10:00 (America/Santiago)** y crean una base temporal por archivo,
por lo que el resultado no depende del día en que se ejecuten.

**Criterios de entrada:** código compila, dependencias instaladas, base temporal creada.
**Criterios de salida:** 100 % de las pruebas automatizadas aprobadas, cada criterio de aceptación cubierto por al
menos una prueba, cobertura de líneas ≥ 80 % y umbrales del ADR-001 cumplidos.

## 3. Procedimientos de ejecución

```bash
npm install
npm test                    # 81 pruebas (unitarias + integración + concurrencia)
npm run test:coverage       # mismas pruebas con informe de cobertura
npm run metricas            # carga concurrente (≈ 15 s); guarda docs/evidencias/metricas/
npm run capturas            # capturas reales (requiere Edge)
npm run pruebas:despliegue -- https://campusreserva.onrender.com   # 17 pruebas sobre el despliegue
```

Para guardar evidencia completa (como se hizo en esta entrega):

```bash
node --test --experimental-test-coverage --test-coverage-include="src/**/*.js" \
  --test-reporter=spec --test-reporter-destination=docs/evidencias/pruebas/salida-pruebas-cobertura.txt \
  --test-reporter=junit --test-reporter-destination=docs/evidencias/pruebas/resultados-junit.xml \
  "test/**/*.test.js"
```

En el reporte JUnit se reemplazó el nombre del equipo (`hostname`) por `equipo-desarrollo` antes de publicarlo.

**Pruebas sobre el despliegue:** el script reutiliza el cliente HTTP de las pruebas de integración (cookies y CSRF).
Para no saturar el plan gratuito, la concurrencia usa solo 10 solicitudes, las muestras de tiempo son secuenciales,
no se prueba el bloqueo por intentos fallidos y las reservas de prueba se cancelan al terminar. Deja un espacio
"Sala Prueba Despliegue" y una cuenta de prueba activada, que desaparecen cuando el servicio se reinicia.

## 4. Criterios de aceptación por requerimiento

Los criterios derivan de los escenarios Dado/Cuando/Entonces de las historias HU-01 a HU-06 de la Sumativa 2 (RF-01 → HU-01 … RF-06 → HU-06) y de las reglas confirmadas para la Sumativa 3.

| RF | ID | Criterio de aceptación |
|---|---|---|
| RF-01 (HU-01) | CA-01.1 | Un correo del listado crea una cuenta PENDIENTE con el rol del listado, la contraseña queda con hash y se genera un enlace |
| | CA-01.2 | Un correo ya registrado es rechazado |
| | CA-01.3 | Un correo fuera del listado o de otro dominio es rechazado |
| | CA-01.4 | No es posible obtener el rol Administrador mediante el registro |
| | CA-01.5 | Datos inválidos (incluida una contraseña de menos de 15 caracteres o común) se rechazan con un mensaje por campo y sin crear la cuenta |
| | CA-01.6 | Una cuenta pendiente no puede iniciar sesión |
| | CA-01.7 | Un enlace válido activa la cuenta; uno inexistente, usado o expirado es rechazado; una nueva emisión invalida la anterior |
| RF-02 (HU-02) | CA-02.1 | Con credenciales válidas cada rol accede solo a su página de inicio y funciones |
| | CA-02.2 | Credenciales inválidas reciben un mensaje genérico y no se crea sesión |
| | CA-02.3 | Las funciones de otro rol se rechazan en el servidor (403) y quedan auditadas |
| | CA-02.4 | La sesión se regenera al iniciar, expira por inactividad, se invalida al cerrar y en la base solo hay su hash |
| | CA-02.5 | Se exige token CSRF, se envían cabeceras de seguridad y se limitan los intentos fallidos |
| RF-03 (HU-03) | CA-03.1 | Con sede y fecha se muestran los bloques libres de los espacios habilitados |
| | CA-03.2 | Se excluyen bloques reservados, bloqueados, de espacios deshabilitados y ya iniciados |
| | CA-03.3 | El filtro por sala o laboratorio es opcional y se valida contra la sede |
| | CA-03.4 | Una consulta sin resultados lo informa claramente |
| | CA-03.5 | Fechas pasadas, fuera de la ventana o sedes inválidas se rechazan |
| | CA-03.6 | La consulta no modifica datos |
| RF-04 (HU-04) | CA-04.1 | La revisión no escribe; la confirmación crea la reserva asociada a la cuenta con identificador |
| | CA-04.2 | Un bloque ya reservado se rechaza (409) |
| | CA-04.3 | Ante solicitudes simultáneas por el mismo bloque se confirma exactamente una |
| | CA-04.4 | Bloques bloqueados, espacios deshabilitados y bloques iniciados se rechazan |
| | CA-04.5 | Selecciones manipuladas (otro día, otro espacio, fechas pasadas, texto) se rechazan |
| | CA-04.6 | El administrador no puede reservar |
| RF-05 (HU-05) | CA-05.1 | Solo se listan las reservas de la cuenta autenticada |
| | CA-05.2 | Ver o cancelar una reserva ajena responde 404 y no cambia nada |
| | CA-05.3 | La cancelación exige una confirmación explícita |
| | CA-05.4 | Cancelar conserva el registro (historial) y libera el horario |
| | CA-05.5 | No se cancela dos veces ni una reserva cuyo bloque ya comenzó |
| RF-06 (HU-06) | CA-06.1 | Solo el administrador accede a la administración |
| | CA-06.2 | Registrar y editar espacios valida sede, nombre, tipo y capacidad; el nombre es único por sede |
| | CA-06.3 | Habilitar/deshabilitar funciona; deshabilitar con reservas vigentes se rechaza indicando cuáles |
| | CA-06.4 | Crear o modificar bloques valida la configuración y rechaza superposiciones |
| | CA-06.5 | No se modifican ni desactivan bloques con reservas vigentes |
| | CA-06.6 | Bloquear un horario lo quita de la disponibilidad; quitar el bloqueo lo repone; no se bloquea un horario con reserva |

## 5. Casos de prueba de integración (detalle)

Todos se ejecutaron el 11-11-2026. Resultado obtenido = resultado esperado salvo indicación.
Evidencia general: `docs/evidencias/pruebas/salida-pruebas-cobertura.txt` y `resultados-junit.xml`.
Precondición común: base con datos ficticios y reloj en lunes 16-11-2026 10:00.

| ID | RF / CA | Precondición y datos | Pasos | Resultado esperado | Estado | Evidencia adicional |
|---|---|---|---|---|---|---|
| CP-01-01 | RF-01 / CA-01.1 | `camila.estudiante@campus.test` en el listado (ESTUDIANTE) | Enviar registro válido | 303 a /registro/enviado; usuario PENDIENTE, rol ESTUDIANTE, hash scrypt sin la contraseña; correo en buzón con enlace | Aprobado | Capturas 03, 04 |
| CP-01-02 | RF-01 / CA-01.2 | `ana.estudiante@campus.test` ya registrado | Registrar el mismo correo | 422 "Ya existe una cuenta"; cantidad de usuarios sin cambio | Aprobado | — |
| CP-01-03 | RF-01 / CA-01.3 | `intruso@campus.test` (no listado), `...@gmail.com` | Registrar ambos | 422 en ambos con mensaje de listado / dominio | Aprobado | Captura 02 |
| CP-01-04 | RF-01 / CA-01.4 | `nueva.docente@campus.test` listado como DOCENTE | Registrar enviando además `rol=ADMINISTRADOR`; registrar `otro.admin@...` | Rol asignado DOCENTE; el segundo, 422 | Aprobado | — |
| CP-01-05 | RF-01 / CA-01.5 | Nombre "A", contraseña "corta", confirmación distinta | Enviar registro | 422 con mensajes por campo; no se crea la cuenta | Aprobado | Captura 02 |
| CP-01-06 | RF-01 / CA-01.6 | Cuenta recién registrada (PENDIENTE) | Iniciar sesión | 401 "pendiente de confirmación" | Aprobado | Captura 05 |
| CP-01-07 | RF-01 / CA-01.7 | Enlace del buzón | Abrir enlace (GET), confirmar (POST), iniciar sesión, reutilizar enlace | GET no activa; POST activa (303); login 303; reutilización 400 | Aprobado | Capturas 06, 07 |
| CP-01-08 | RF-01 / CA-01.7 | Token inexistente; enlace de otra cuenta con reloj +25 h | Confirmar ambos; iniciar sesión con la cuenta expirada | 400 y 400; cuenta sigue PENDIENTE; el login emite un enlace nuevo | Aprobado | — |
| CP-02-01 | RF-02 / CA-02.1 | Cuentas de estudiante, docente y administrador | Iniciar sesión con cada una y seguir la redirección | Estudiante/docente → /disponibilidad; administrador → /admin/espacios (200) | Aprobado | Capturas 09, 19 |
| CP-02-02 | RF-02 / CA-02.2 | Contraseña errónea; correo inexistente | Iniciar sesión con ambos y acceder a /mis-reservas | 401 con el mismo mensaje genérico; sin sesión (303 a /login); eventos LOGIN_FALLIDO | Aprobado | Captura 08 |
| CP-02-03 | RF-02 / CA-01.6 | `pedro.pendiente@campus.test` (seed) | Iniciar sesión | 401 "pendiente de confirmación" | Aprobado | — |
| CP-02-04 | RF-02 / CA-02.4 | Cookie de sesión anónima previa | Iniciar sesión y comparar cookies | Identificador distinto tras autenticarse | Aprobado | — |
| CP-02-05 | RF-02 / CA-02.4 | Sesión de Ana | Copiar cookie, cerrar sesión, reutilizar cookie en otro cliente | 303 a /login: la sesión antigua no sirve | Aprobado | — |
| CP-02-06 | RF-02 / CA-02.4 | Sesión de Diego | Avanzar el reloj 31 min y acceder | 303 a /login | Aprobado | — |
| CP-02-07 | RF-02 / CA-02.5 | Formulario de login | Enviar sin token y con token falso | 403 en ambos | Aprobado | — |
| CP-02-08 | RF-02 / CA-02.5 | — | GET /login | CSP, nosniff, DENY, no-store, sin X-Powered-By; cookie HttpOnly y SameSite=Lax | Aprobado | — |
| CP-02-09 | RF-02 / CA-02.4 | Sesión de Ana | Buscar el valor de la cookie en la tabla `sesion` | No existe: solo se guarda su hash | Aprobado | — |
| CP-02-10 | RF-02 / CA-02.5 | Límite configurado en 3 | 3 intentos fallidos y luego uno correcto | 401 ×3 y 429 "Demasiados intentos" | Aprobado | — |
| CP-03-01 | RF-03 / CA-03.1, 03.2 | Martes 17-11, Sede Maipú | Consultar | 200; ofrece A-101 12:00; no ofrece A-101 08:30/10:15 (reservados); ofrece A-102 08:30 (reserva cancelada) | Aprobado | Captura 09 |
| CP-03-02 | RF-03 / CA-03.2 | Bloqueo L-202 12:00; B-105 deshabilitada | Consultar | No ofrece L-202 12:00 ni 19:00 ni ningún bloque de B-105 | Aprobado | Captura 09 |
| CP-03-03 | RF-03 / CA-03.2 | Hoy lunes 10:00 | Consultar hoy | No ofrece 08:30; sí 10:15 | Aprobado | — |
| CP-03-04 | RF-03 / CA-03.3 | Espacio A-102 | Filtrar por A-102; luego A-102 con sede Centro | Solo bloques de A-102; con otra sede 422 | Aprobado | — |
| CP-03-05 | RF-03 / CA-03.4 | Domingo 22-11, Sede Centro | Consultar | 200 "No hay espacios disponibles" | Aprobado | Captura 10 |
| CP-03-06 | RF-03 / CA-03.5 | Fecha pasada, +44 días, sede 999, `1 OR 1=1` | Consultar cada una | 422 en todas | Aprobado | — |
| CP-03-07 | RF-03 / CA-03.6 | Copia de la tabla `reserva` | Hacer dos consultas | Tabla idéntica antes y después | Aprobado | — |
| CP-03-08 | RF-03 / CA-02.3 | Administrador; usuario anónimo | Acceder a /disponibilidad | 403; anónimo 303 a /login | Aprobado | — |
| CP-04-01 | RF-04 / CA-04.1 | A-101 martes 12:00 libre | Abrir revisión; confirmar | Revisión 200 sin escribir; confirmación 303 a /reservas/:id; "Reserva CR-… confirmada"; asociada a Ana | Aprobado | Capturas 11, 12 |
| CP-04-02 | RF-04 / CA-04.2 | Bloque reservado en CP-04-01 | Diego confirma el mismo bloque | 409 "acaba de ser reservado"; sigue 1 reserva | Aprobado | Captura 13 |
| CP-04-03 | RF-04 / CA-04.3 | A-101 martes 14:30 libre | 20 confirmaciones HTTP simultáneas (Ana y Diego) | 1 × 303 y 19 × 409; 1 reserva en la base | Aprobado | — |
| CP-04-04 | RF-04 / CA-04.4 | L-202 bloqueado; B-105 deshabilitada; lunes 08:30 iniciado | Confirmar cada uno | 409 con mensaje específico en los tres | Aprobado | — |
| CP-04-05 | RF-04 / CA-04.5 | Horario de miércoles con fecha martes; horario de otro espacio; fecha pasada; `1' OR '1'='1` | Confirmar cada uno | 422, 404, 422 y 422 | Aprobado | — |
| CP-04-06 | RF-04 / CA-04.6 | Sesión de administrador | Confirmar una reserva | 403; sin reserva; evento ACCESO_DENEGADO | Aprobado | — |
| CP-04-07 | RF-04 / CA-04.3 | A-102 miércoles 08:30 libre | 8 procesos con conexión propia ejecutan el servicio real a la vez | 1 CONFIRMADA y 7 rechazadas; 1 en la base | Aprobado | — |
| CP-04-08 | RF-04 / CA-04.3 | A-102 miércoles 10:15 libre | 8 procesos insertan **sin verificar** a la vez | El índice único deja solo 1 | Aprobado | — |
| CP-05-01 | RF-05 / CA-05.1 | Reservas de Ana y Diego | Ana abre Mis reservas | Ve sus códigos, no los de Diego; historial con Cancelada y Finalizada | Aprobado | Captura 14 |
| CP-05-02 | RF-05 / CA-05.2 | Reserva de Diego | Ana abre el detalle, la confirmación y envía la cancelación | 404, 404 y 404; la reserva sigue CONFIRMADA | Aprobado | Captura 17 |
| CP-05-03 | RF-05 / CA-05.3 | Reserva de Ana | Abrir /reservas/:id/cancelar | Página de confirmación; sin cambios | Aprobado | Captura 15 |
| CP-05-04 | RF-05 / CA-05.4 | Reserva de Ana martes 10:15 | Confirmar cancelación; Diego consulta y reserva ese bloque | Estado CANCELADA con fecha; el bloque vuelve a ofrecerse y Diego lo reserva (303) | Aprobado | Captura 16 |
| CP-05-05 | RF-05 / CA-05.5 | Reserva ya cancelada; reloj martes 08:45 | Cancelar de nuevo; Diego cancela su bloque de 08:30 | 409 y 409 "aún no ha comenzado"; sin cambios | Aprobado | — |
| CP-06-01 | RF-06 / CA-06.1 | Estudiante, docente, anónimo | Acceder y enviar operaciones de administración | 403/403/303 a /login; sin cambios; ≥ 3 eventos ACCESO_DENEGADO | Aprobado | Captura 18 |
| CP-06-02 | RF-06 / CA-06.2 | — | Registrar "Sala D-210"; registrar datos inválidos; sede 999 | 303 y espacio habilitado; 422 con mensajes; 422 "La sede no existe" | Aprobado | Captura 20 |
| CP-06-03 | RF-06 / CA-06.2 | "Sala A-101" existe en Maipú | Registrar "sala a-101" en Maipú y "Sala A-101" en Centro | 422 duplicado; 303 en otra sede | Aprobado | — |
| CP-06-04 | RF-06 / CA-06.2 | Sala A-102 | Editar nombre y capacidad; luego capacidad "muchos" | Cambios guardados; luego 422 sin cambios | Aprobado | — |
| CP-06-05 | RF-06 / CA-06.3 | A-101 con reservas vigentes | Deshabilitar | Mensaje "No se puede deshabilitar" con código CR-…; sigue habilitado | Aprobado | Captura 24 |
| CP-06-06 | RF-06 / CA-06.3 | A-102 sin reservas vigentes | Deshabilitar, consultar, habilitar | Deshabilitado y fuera de la disponibilidad; luego habilitado | Aprobado | — |
| CP-06-07 | RF-06 / CA-06.4 | Bloques de A-101 los lunes | Crear 09:00–10:30, 18:00–17:00 y 22:15–23:00 | 409 superposición; 422 orden inválido; 303 bloque contiguo | Aprobado | Captura 22 |
| CP-06-08 | RF-06 / CA-06.5 | A-101 martes 10:15 reservado | Modificar y desactivar el bloque | 409 "no cancela reservas automáticamente"; bloque sin cambios y activo | Aprobado | — |
| CP-06-09 | RF-06 / CA-06.4 | A-101 jueves 16:15 sin reservas | Modificar a 15:30–17:00, luego a 16:15–18:00, luego desactivar | 409 superposición; 303 guardado; desactivado | Aprobado | — |
| CP-06-10 | RF-06 / CA-06.6, CA-04.4 | A-101 martes 12:00 libre | Bloquear; Ana consulta y reserva; quitar bloqueo; consultar | Desaparece de la disponibilidad, reserva 409; reaparece al quitar el bloqueo | Aprobado | Captura 21 |
| CP-06-11 | RF-06 / CA-06.6 | A-101 martes 10:15 reservado | Bloquear ese bloque; bloquear un bloque de martes con fecha miércoles | 409 "existe la reserva confirmada CR-…"; 422 día incorrecto | Aprobado | Captura 23 |
| CP-06-12 | RF-06 / CA-06.1 | Eventos previos | Administrador y estudiante abren /admin/auditoria | 200 con ESPACIO_CREADO y ACCESO_DENEGADO; estudiante 403 | Aprobado | Captura 25 |

## 6. Casos de prueba unitarios

| ID | Objeto | Verifica | Estado |
|---|---|---|---|
| CP-U-01 a CP-U-06 | `validarRegistro` | Normalización, dominio, formato, largo y confirmación de contraseña, entradas no textuales | Aprobados |
| CP-U-07 a CP-U-09 | `validarConsulta` | Espacio opcional, fechas pasadas/inexistentes/fuera de ventana, identificadores no numéricos | Aprobados |
| CP-U-10 a CP-U-12 | `validarEspacio`, `validarHorario`, `validarBloqueo` | Campos obligatorios, rangos, duración, orden de horas | Aprobados |
| CP-U-13 a CP-U-16 | `fechas` | Zona horaria de Chile, día de semana, superposición (contiguos no se superponen), fechas reales | Aprobados |
| CP-U-17 a CP-U-19 | `seguridad` | Hash scrypt con sal, verificación y hash corrupto, tokens de 256 bits, comparación en tiempo constante | Aprobados |
| CP-U-20 a CP-U-22 | `calcularDisponibilidad` | Excluye reservados y bloqueados, bloques ya iniciados hoy, resultado vacío | Aprobados |
| CP-U-23 a CP-U-26 | `presentarReserva`, `describirReservas` | Estados Confirmada/En curso/Finalizada/Cancelada, cancelable, mensaje de reservas afectadas | Aprobados |
| CP-U-27 | `validarRegistro`, `esContrasenaComun` | Rechazo de contraseñas comunes o predecibles y aceptación de frases con espacios (HU-01) | Aprobado |
| CP-U-28 | `transaccion` | Un fallo simulado dentro de la transacción no deja estado parcial (ROLLBACK, RNF-05) | Aprobado |
| CP-U-29 | `cargarConfig` | La URL pública usa `BASE_URL`, luego `RENDER_EXTERNAL_URL` (definida por Render) y por último localhost | Aprobado |
| CP-U-30 | `cargarConfig` | En producción exige `SESSION_SECRET` y solo activa el buzón y los datos de demostración si se piden explícitamente | Aprobado |

## 6.1 Pruebas de aceptación sobre el despliegue (Render)

Ejecutadas el 11-11-2026 a las 02:17 (hora de Chile) contra https://campusreserva.onrender.com con
`npm run pruebas:despliegue`. Evidencia: `docs/evidencias/despliegue/resultado-despliegue.md` y `.json`, y 5 capturas.
Son pruebas automatizadas de sistema sobre el entorno desplegado; **no** son pruebas con usuarios.

| ID | Verifica | Resultado esperado | Obtenido | Estado |
|---|---|---|---|---|
| DEP-01 | El servicio responde por HTTPS | 200 con el inicio de sesión | 200 en 257 ms | Aprobado |
| DEP-02 | Redirección de HTTP a HTTPS | 3xx hacia https:// | 301 → https://campusreserva.onrender.com/login | Aprobado |
| DEP-03 | Cabeceras en producción | HSTS, CSP `default-src 'self'`, nosniff, DENY, no-store, sin X-Powered-By | Todas presentes; HSTS `max-age=31536000; includeSubDomains` | Aprobado |
| DEP-04 | RF-02 inicio de sesión y cookie | 303 a /disponibilidad; cookie `__Host-cr_sesion` con Secure, HttpOnly, SameSite=Lax, Path=/ y sin Domain | Igual | Aprobado |
| DEP-05 | RF-02 credenciales inválidas | Mismo mensaje genérico para contraseña errónea y correo inexistente | 401 y 401 con el mismo mensaje | Aprobado |
| DEP-06 | RF-01 cuenta pendiente | No inicia sesión; "pendiente de confirmación" | 401 | Aprobado |
| DEP-07 | RF-03 consulta por sede y fecha | 200 con bloques disponibles | 23 bloques (12-11-2026, Sede Maipú) | Aprobado |
| DEP-08 | RF-04 reserva | Revisión 200; confirmación 303 con código; aparece en Mis reservas | CR-000009 | Aprobado |
| DEP-09 | RF-04 bloque ocupado | 409 "acaba de ser reservado" | 409 | Aprobado |
| DEP-10 | RF-04 / ADR-001 concurrencia | 10 solicitudes simultáneas de 2 usuarios: 1 confirmada y 9 con 409 | 1 y 9 | Aprobado |
| DEP-11 | RF-05 reservas ajenas | 404 al ver y al cancelar; sin cambios | 404 y 404 | Aprobado |
| DEP-12 | RF-05 cancelación | Confirmación previa; 303 a Mis reservas; queda en el historial | CR-000009 cancelada | Aprobado |
| DEP-13 | OWASP A01 CSRF | Formulario sin token: 403 | 403 | Aprobado |
| DEP-14 | RF-06 / OWASP A01 roles | Estudiante en /admin/espacios: 403 | 403 | Aprobado |
| DEP-15 | RF-06 espacios | Capacidad 0 rechazada (422); espacio válido registrado y listado | 422; "Sala Prueba Despliegue 0216" registrado | Aprobado |
| DEP-16 | RF-01 registro y confirmación | Correo del listado registrado; enlace del buzón con la URL pública; activación; inicio de sesión | `camila.estudiante@campus.test` activada | Aprobado |
| DEP-17 | Cierre de sesión | 303; luego Mis reservas redirige al login | Igual | Aprobado |

Resumen: **17/17 aprobadas**, 99 solicitudes HTTP y 0 respuestas 5xx. DEP-07 mostró 23 bloques y no 24 porque
quedó activa una reserva de una ejecución anterior (ver H-07).

## 7. Matriz de trazabilidad RF → criterio de aceptación → prueba

| RF (HU) | Criterio | Pruebas automatizadas | Evidencia visual | Cubierto |
|---|---|---|---|---|
| RF-01 (HU-01) | CA-01.1 | CP-01-01, CP-U-01, CP-U-17 | 03, 04 | Sí |
| RF-01 (HU-01) | CA-01.2 | CP-01-02 | — | Sí |
| RF-01 (HU-01) | CA-01.3 | CP-01-03, CP-U-02 | 02 | Sí |
| RF-01 (HU-01) | CA-01.4 | CP-01-04 | — | Sí |
| RF-01 (HU-01) | CA-01.5 | CP-01-05, CP-U-03, CP-U-04, CP-U-05, CP-U-06, CP-U-27 | 02 | Sí |
| RF-01 (HU-01) | CA-01.6 | CP-01-06, CP-02-03 | 05 | Sí |
| RF-01 (HU-01) | CA-01.7 | CP-01-07, CP-01-08 | 06, 07 | Sí |
| RF-02 (HU-02) | CA-02.1 | CP-02-01 | 09, 19 | Sí |
| RF-02 (HU-02) | CA-02.2 | CP-02-02, CP-U-18 | 08 | Sí |
| RF-02 (HU-02) | CA-02.3 | CP-03-08, CP-04-06, CP-06-01 | 18 | Sí |
| RF-02 (HU-02) | CA-02.4 | CP-02-04, CP-02-05, CP-02-06, CP-02-09, CP-U-19 | — | Sí |
| RF-02 (HU-02) | CA-02.5 | CP-02-07, CP-02-08, CP-02-10 | — | Sí |
| RF-03 (HU-03) | CA-03.1 | CP-03-01 | 09 | Sí |
| RF-03 (HU-03) | CA-03.2 | CP-03-01, CP-03-02, CP-03-03, CP-06-06, CP-U-20, CP-U-21 | 09 | Sí |
| RF-03 (HU-03) | CA-03.3 | CP-03-04, CP-U-07 | — | Sí |
| RF-03 (HU-03) | CA-03.4 | CP-03-05, CP-U-22 | 10 | Sí |
| RF-03 (HU-03) | CA-03.5 | CP-03-06, CP-U-08, CP-U-09 | — | Sí |
| RF-03 (HU-03) | CA-03.6 | CP-03-07 | — | Sí |
| RF-04 (HU-04) | CA-04.1 | CP-04-01 | 11, 12 | Sí |
| RF-04 (HU-04) | CA-04.2 | CP-04-02 | 13 | Sí |
| RF-04 (HU-04) | CA-04.3 | CP-04-03, CP-04-07, CP-04-08, CP-U-28, métricas de carga | — | Sí |
| RF-04 (HU-04) | CA-04.4 | CP-04-04, CP-06-10 | — | Sí |
| RF-04 (HU-04) | CA-04.5 | CP-04-05 | — | Sí |
| RF-04 (HU-04) | CA-04.6 | CP-04-06 | — | Sí |
| RF-05 (HU-05) | CA-05.1 | CP-05-01 | 14, 27 | Sí |
| RF-05 (HU-05) | CA-05.2 | CP-05-02 | 17 | Sí |
| RF-05 (HU-05) | CA-05.3 | CP-05-03 | 15 | Sí |
| RF-05 (HU-05) | CA-05.4 | CP-05-04 | 16 | Sí |
| RF-05 (HU-05) | CA-05.5 | CP-05-05, CP-U-23, CP-U-24, CP-U-25 | — | Sí |
| RF-06 (HU-06) | CA-06.1 | CP-06-01, CP-06-12 | 18, 25 | Sí |
| RF-06 (HU-06) | CA-06.2 | CP-06-02, CP-06-03, CP-06-04, CP-U-10 | 20 | Sí |
| RF-06 (HU-06) | CA-06.3 | CP-06-05, CP-06-06 | 24 | Sí |
| RF-06 (HU-06) | CA-06.4 | CP-06-07, CP-06-09, CP-U-11, CP-U-15 | 22 | Sí |
| RF-06 (HU-06) | CA-06.5 | CP-06-08, CP-U-26 | — | Sí |
| RF-06 (HU-06) | CA-06.6 | CP-06-10, CP-06-11, CP-U-12 | 21, 23 | Sí |

**Cobertura de requerimientos:** 35 de 35 criterios de aceptación (100 %) tienen al menos una prueba automatizada aprobada.

### 7.1 Cobertura de los requerimientos no funcionales

| RNF | Verificación | Estado |
|---|---|---|
| RNF-01 Seguridad de acceso (ES2) | CP-03-08, CP-04-06, CP-06-01, CP-06-12 | Cumple |
| RNF-02 Protección de credenciales (ES2) | CP-U-17, CP-01-01; DEP-02, DEP-03 y DEP-04 (HTTPS, HSTS y cookie Secure en Render) | Cumple |
| RNF-03 Privacidad de reservas (ES2) | CP-05-01, CP-05-02 | Cumple |
| RNF-04 Integridad de reservas (ES2) | CP-04-03, CP-04-07, CP-04-08, carga | Cumple |
| RNF-05 Consistencia (ES2) | CP-U-28, CP-04-07 | Cumple |
| RNF-06 Claridad de interfaz (ES2) | CP-03-05, CP-05-03, capturas 02, 10, 11, 13, 15, 26, 27 | Cumple (visual) |
| RNF-07 Mantenibilidad (ES2) | Cobertura 96,79 % de líneas; capas separadas | Cumple |
| RNF-08 Rendimiento | `npm run metricas` (carga local); tiempos sobre el despliegue como referencia (8.4) | Cumple (local) |
| RNF-09 Disponibilidad | El plan gratuito de Render suspende el servicio tras 15 min sin tráfico; no se monitoreó | No verificado |
| RNF-10 Protección de datos | CP-02-08, CP-02-09 | Cumple |
| RNF-11 Seguridad de sesión y entradas | CP-02-04 a CP-02-10, CP-U-09, CP-04-05, DEP-04, DEP-13 | Cumple |

## 8. Resultados

### 8.1 Ejecución de pruebas

| Indicador | Valor |
|---|---|
| Pruebas ejecutadas | 81 (30 unitarias, 49 de integración HTTP, 2 de concurrencia multiproceso) |
| Aprobadas / fallidas / omitidas | 81 / 0 / 0 |
| Duración total | ≈ 7 s |
| Pruebas sobre el despliegue (Render) | 17 / 17 aprobadas; 0 respuestas 5xx |

### 8.2 Cobertura de código (`src/`, instrumento integrado de Node.js)

| Métrica | Valor |
|---|---|
| Líneas | 96,79 % |
| Ramas | 88,27 % |
| Funciones | 93,48 % |

Zonas no cubiertas relevantes: ramas de error interno inesperado del manejador central (`src/app.js`) y algunos
caminos de rechazo de administración por datos inexistentes (`src/rutas/administracion.js`). La validación de
`SESSION_SECRET` en producción quedó cubierta por CP-U-30. No se consideran críticos para el MVP; se registran como mejora.

### 8.3 Rendimiento y concurrencia (`npm run metricas`, 11-11-2026)

| Operación | n | p50 (ms) | p95 (ms) | Máx. (ms) | Errores |
|---|---|---|---|---|---|
| Inicio de sesión (50 simultáneos, scrypt N=2^17) | 50 | 1415,1 | 1491,3 | 1606,1 | 0 |
| Consulta de disponibilidad (20 concurrentes) | 200 | 43,4 | 164,4 | 186,0 | 0 (0 %) |
| Confirmación de reserva (50 simultáneas por bloque, 5 rondas) | 250 | 51,9 | 119,2 | 131,1 | 0 (0 %) |

Medición realizada sobre el commit 9ec4281; los cambios posteriores (regla de contraseña e invalidación de enlaces) no modifican los flujos de consulta ni de reserva. Revalidación del ADR-001: **0 duplicados** (cada ronda: 1 confirmada, 49 conflictos controlados), **p95 119,2 ms ≤ 800 ms**,
**0 % de errores técnicos < 1 %**. Las cifras del Spike anterior eran didácticas; estas son mediciones reales en un
entorno local que no representa producción. Detalle: `docs/evidencias/metricas/metricas-ultima.md`.

### 8.4 Tiempos de respuesta sobre el despliegue (Render, 11-11-2026)

Medidos desde el equipo de desarrollo en Chile hasta Render (Virginia, EE. UU.); incluyen la latencia de red.
Las solicitudes son secuenciales, salvo las 10 simultáneas de DEP-10 incluidas en `POST /reservas`.

| Operación | n | p50 (ms) | p95 (ms) | Máx. (ms) |
|---|---|---|---|---|
| `GET /login` | 27 | 169,9 | 224,2 | 257,4 |
| `GET /disponibilidad` (consulta) | 24 | 145,8 | 205,2 | 205,2 |
| `POST /reservas` (confirmación) | 13 | 185,4 | 409,6 | 409,6 |
| `POST /login` (inicio de sesión) | 12 | 2879,8 | 3074,8 | 3074,8 |

La consulta y la confirmación de reserva quedan bajo los umbrales de RNF-08 (500 ms y 800 ms), aunque con otra
carga que la del umbral. El inicio de sesión tarda ≈ 3 s porque el plan gratuito entrega una fracción de CPU y
scrypt es costoso a propósito (H-08). Detalle: `docs/evidencias/despliegue/resultado-despliegue.md`.

## 9. Defectos y hallazgos registrados durante las pruebas

| ID | Hallazgo | Tipo | Causa | Solución | Estado |
|---|---|---|---|---|---|
| H-01 | 3 pruebas de reservas devolvían 403 en vez de 409 | Defecto del cliente de pruebas | El cliente no seguía la redirección tras el login y reutilizaba el token CSRF de la sesión anterior (el servidor lo invalida al regenerar la sesión, que es lo correcto) | El ayudante de pruebas sigue la redirección como un navegador | Cerrado |
| H-02 | La captura "bloqueo rechazado" mostraba un bloqueo aceptado | Defecto del guion de capturas | El bloque elegido había sido liberado por una cancelación previa en el mismo recorrido | Se usa un bloque que sigue reservado y se verifican visualmente todas las capturas | Cerrado |
| H-03 | 50 inicios de sesión simultáneos: p95 1,49 s | Observación de rendimiento | Costo deliberado de scrypt (128 MiB por verificación) y cola del pool de hilos | Aceptado: un login aislado tarda ≈ 230 ms; se propone monitorear y escalar horizontalmente | Aceptado |
| H-04 | Ramas de error interno sin cubrir | Brecha de cobertura | Requieren simular fallas internas | La configuración de producción quedó cubierta por CP-U-30 y por las pruebas sobre el despliegue; el resto se registra como mejora | Abierto |
| H-05 | La regla de contraseña implementada (12 caracteres) no coincidía con la HU-01 de la Sumativa 2 (15 a 128 caracteres y rechazo de comunes) | Inconsistencia de requisitos | Se tomó como base un borrador anterior del informe | Se alineó el código con la HU-01, se agregó CP-U-27 y se regeneraron las capturas | Cerrado |
| H-06 | Render no podía instalar las dependencias desde `package-lock.json` | Problema de despliegue | El archivo registra el espejo de paquetes del equipo de desarrollo, al que Render no tiene acceso | Render instala desde el registro público de npm las mismas versiones exactas fijadas en `package.json` (`render.yaml`) | Cerrado |
| H-07 | En la primera ejecución sobre el despliegue quedó activa una reserva de prueba | Defecto del script de pruebas | La reserva ganada en DEP-10 se cancelaba después de cerrar la sesión | La limpieza se movió antes del cierre de sesión y se repitió la ejecución completa (17/17); la reserva restante desaparece al reiniciarse el servicio | Cerrado |
| H-08 | Inicio de sesión de ≈ 3 s en el despliegue | Observación de rendimiento | El plan gratuito entrega una fracción de CPU y scrypt (N=2^17) es costoso a propósito | Aceptado para la demostración; en producción, instancia con CPU dedicada | Aceptado |

No se detectaron defectos funcionales en el código de la aplicación durante la ejecución final.

## 10. Pruebas de usuario

Procedimiento, tareas, métricas y formulario en [pruebas-usuario.md](pruebas-usuario.md).
**Estado: pendiente.** No se ha realizado ninguna sesión con usuarios reales; no se reportan resultados.
