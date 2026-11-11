# Actualizaciones sugeridas para el tablero Kanban en Jira (proyecto KAN)

Columnas del tablero (según la Sumativa 2): **Por hacer → En curso → En revisión → Finalizado**.
Política de trabajo en curso de la Sumativa 2: **1 tarea En curso y 1 En revisión**.
Estas actualizaciones **no se aplicaron automáticamente**: deben registrarse a mano en Jira. Agregue la etiqueta `ES3`,
enlace el commit indicado y adjunte o enlace la evidencia (captura, salida de pruebas o archivo del repositorio).

## Definición de Finalizado propuesta para tareas de implementación (extiende el criterio de cierre de la ES2)

1. Código en el repositorio con JSDoc y sin secretos.
2. Validación de entradas y control de acceso en el servidor.
3. Pruebas automatizadas de los criterios de aceptación (Dado/Cuando/Entonces de la HU) aprobadas con `npm test`.
4. Revisión de seguridad básica (OWASP A01, A05 y A07 cuando corresponda).
5. Evidencia guardada y relacionada con el requisito (regla de cierre de la ES2).

## Historias funcionales existentes: comentar evidencia y mover a Finalizado

| Clave | Historia | Comentario sugerido (evidencia) | Commit |
|---|---|---|---|
| KAN-1 | RF-01 — Registrar usuario | Implementado: listado institucional, rol asignado, contraseña 15–128 con rechazo de comunes, enlace de un uso (24 h) en Buzón de demostración. Pruebas CP-01-01 a CP-01-08, CP-U-01 a CP-U-06 y CP-U-27. Capturas 02–07 | a0edf81, 14bec2a |
| KAN-2 | RF-02 — Iniciar sesión | Implementado con sesión del servidor, regeneración, expiración, límite de intentos y funciones por rol; cierre de sesión. Pruebas CP-02-01 a CP-02-10. Capturas 01, 08, 18 | a0edf81 |
| KAN-5 | RF-03 — Consultar disponibilidad | Implementado: sede y fecha obligatorias, espacio opcional, exclusiones, sin resultados, sin modificar datos. Pruebas CP-03-01 a CP-03-08. Capturas 09, 10 | a0edf81 |
| KAN-6 | RF-04 — Reservar espacio | Implementado: revisión, confirmación, transacción + índice único (ADR-001), código CR-000000. Pruebas CP-04-01 a CP-04-08; carga: 0 duplicados, p95 119,2 ms. Capturas 11–13 | a0edf81, 9ec4281 |
| KAN-7 | RF-05 — Consultar reservas propias | Implementado: solo propias, 404 ante ajenas, confirmación, historial y liberación del bloque. Pruebas CP-05-01 a CP-05-05. Capturas 14–17 | a0edf81 |
| KAN-8 | RF-06 — Administración de espacios | Implementado: espacios, bloques horarios y bloqueos; superposición y cambios con reservas vigentes rechazados. Pruebas CP-06-01 a CP-06-12. Capturas 19–25 | a0edf81, 9ec4281 |

Las subtareas abiertas de cada historia (por ejemplo, 1/3) deben cerrarse solo si su evidencia existe; si alguna
subtarea era de "validación con cliente", déjela abierta (sigue pendiente).

## Tareas nuevas sugeridas (crearlas en los epics indicados)

| Tarea | Epic | Estado sugerido | Evidencia |
|---|---|---|---|
| Configurar repositorio Git y proyecto Node.js | KAN-43 Diseño transversal | Finalizado | README, package-lock.json (a0edf81) |
| Implementar modelo de datos SQLite y datos ficticios | KAN-43 | Finalizado | src/db/schema.sql, diagrama 05 |
| Implementar seguridad transversal (sesión, CSRF, cabeceras, auditoría) | KAN-43 | Finalizado | CP-02-07, CP-02-08, CP-U-17 a 19 |
| Pruebas unitarias, de integración y de concurrencia | KAN-43 | Finalizado | 79/79 aprobadas, cobertura 96,58 % (docs/evidencias/pruebas) |
| Revalidar ADR-001 con mediciones reales | KAN-43 | Finalizado | docs/evidencias/metricas (9ec4281) |
| Capturas reales y diagramas UML de la implementación | KAN-43 | Finalizado | docs/evidencias/capturas, docs/diagramas (f9c8bf1) |
| Investigación normativa chilena y OWASP Top 10:2025 | Entrega ES3 | Finalizado | docs/investigacion-normativa.md |
| Alinear implementación con HU-01 de la ES2 (contraseña 15+, enlaces) | KAN-42 Requisitos | Finalizado | CP-U-27, CP-01-08 (14bec2a) |
| Informe final ES3 (Word) | Entrega ES3 | **En revisión** | dist/Informe_Final_CampusReserva_ES3_Luis_Chiguay.docx |
| Publicar repositorio en GitHub y enlazarlo en el informe (V.d) | Entrega ES3 | Finalizado | https://github.com/LuisChiguay-IEI/CampusReserva |
| Pruebas de usuario (UAT) | KAN-38 Validación | **Por hacer** | docs/pruebas-usuario.md |
| Firmar declaración de originalidad (Anexo D) | Entrega ES3 | Por hacer | Informe |
| Entregar en Ambiente de Aprendizaje | Entrega ES3 | Por hacer | — |

## Cronograma

- **KAN-36** (Revisión y ajustes, 30-10 al 12-11): actualizar su descripción indicando que el periodo se usó para
  implementar el MVP exigido por la Unidad 3; cerrarlo con la entrega del 12-11.
- **KAN-37** (Profundización, 13 al 26-11) y **KAN-38** (Validación): mantener; KAN-38 debe incluir la validación
  institucional de las reglas propuestas (plazo de cancelación, inhabilitación de espacios) y las pruebas de usuario.

## Backlog (fuera del alcance del MVP)

- Despliegue en PaaS con HTTPS y disco persistente o PostgreSQL gestionado (completa RNF-02 y permite medir RNF-09).
- Integración con un proveedor real de correo (reemplazar el Buzón de demostración).
- Verificación de contraseñas contra bases de contraseñas filtradas.
- Recuperación de contraseña; gestión de sedes y del listado institucional desde la interfaz.
- Interfaz para derechos de acceso y rectificación de datos (Ley 19.628 art. 12; Ley 21.719 desde el 01-12-2026).
- Cubrir las ramas de error de producción (hallazgo H-04).
