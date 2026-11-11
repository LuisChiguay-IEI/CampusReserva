# Pruebas de las tareas de usuario — CampusReserva

> **Estado: las 8 tareas del guion se verificaron con pruebas automatizadas** que recorren los mismos pasos que haría
> cada perfil, en local y sobre el despliegue en Render, con capturas reales de la interfaz (sección 5).
> **No se realizaron sesiones con personas**, por lo que no se informan tiempos humanos, errores observados ni
> satisfacción: esas métricas quedan como mejora futura (sección 6).

## 1. Objetivo

Comprobar que los recorridos principales de cada perfil (registrarse, iniciar sesión, consultar, reservar, cancelar y
administrar) se completan de principio a fin y que el sistema muestra los mensajes esperados.

## 2. Perfiles

| Perfil | Cuenta usada | Recorridos |
|---|---|---|
| Estudiante | `ana.estudiante@campus.test`; registro de `nuevo.estudiante@campus.test` | T1 a T4 |
| Docente | `diego.docente@campus.test` | T5 |
| Administrador | `admin@campus.test` | T6 a T8 |

Todas las cuentas y los datos son ficticios (dominio reservado `campus.test`).

## 3. Entornos

- **Local:** pruebas de integración (`npm test`) sobre una base temporal con el reloj fijado en el lunes 16-11-2026
  10:00, y capturas reales con Microsoft Edge (`npm run capturas`).
- **Desplegado:** https://campusreserva.onrender.com con `npm run pruebas:despliegue -- https://campusreserva.onrender.com`
  (ver [plan-pruebas.md](plan-pruebas.md), sección 6.1).

## 4. Tareas

| ID | Perfil | Tarea | Criterio de éxito | RF |
|---|---|---|---|---|
| T1 | Estudiante | Crear una cuenta con `nuevo.estudiante@campus.test` y activarla desde el Buzón de demostración | Cuenta activa e inicio de sesión exitoso | RF-01, RF-02 |
| T2 | Estudiante | Buscar una sala de estudio libre en Sede Maipú para el próximo día hábil | Llega a la lista de bloques disponibles | RF-03 |
| T3 | Estudiante | Reservar un bloque libre de una sala de estudio y obtener el código | Reserva confirmada con código | RF-04 |
| T4 | Estudiante | Encontrar la reserva y cancelarla | Reserva en estado Cancelada en el historial | RF-05 |
| T5 | Docente | Buscar disponibilidad un domingo | El sistema informa que no hay bloques disponibles | RF-03 |
| T6 | Administrador | Registrar un espacio y crear un bloque horario | Espacio y bloque creados; datos inválidos y superposiciones rechazados | RF-06 |
| T7 | Administrador | Bloquear un horario con un motivo | El bloque desaparece de la disponibilidad y vuelve al quitar el bloqueo | RF-06 |
| T8 | Administrador | Intentar deshabilitar "Sala A-101", que tiene reservas vigentes | El sistema lo rechaza indicando las reservas afectadas | RF-06 |

## 5. Resultados: verificación automatizada de las tareas

| Tarea | Pruebas que la ejecutan (local) | Prueba sobre Render | Evidencia visual | Resultado |
|---|---|---|---|---|
| T1 | CP-01-01, CP-01-06, CP-01-07 | DEP-16 (registro, enlace con la URL pública, activación e inicio de sesión) | Capturas 02 a 07; dep-05 | Completada |
| T2 | CP-03-01, CP-03-09 | DEP-07, DEP-17 | Captura 28; dep-02 | Completada |
| T3 | CP-04-01, CP-04-02 | DEP-08, DEP-09 | Capturas 11, 12 y 13 | Completada |
| T4 | CP-05-01, CP-05-03, CP-05-04 | DEP-12 | Capturas 14, 15 y 16; dep-03 | Completada |
| T5 | CP-03-05 | — | Captura 10 | Completada |
| T6 | CP-06-02, CP-06-07 | DEP-15 (registro del espacio) | Capturas 19, 20 y 22; dep-04 | Completada |
| T7 | CP-06-10 | — | Captura 21 | Completada |
| T8 | CP-06-05 | — | Captura 24 | Completada |

**Tasa de éxito: 8 de 8 tareas completadas** en la ejecución automatizada (87/87 pruebas locales y 18/18 sobre Render).
Las capturas se tomaron con Microsoft Edge sobre la interfaz real; las del despliegue (`dep-*`) están en
`docs/evidencias/despliegue/` y las locales en `docs/evidencias/capturas/`.

Alcance de esta verificación: comprueba que cada tarea **se puede completar** y que el sistema **muestra el mensaje
esperado**. No mide si una persona entiende los mensajes sin ayuda, cuánto tarda ni qué tan satisfecha queda.

## 6. Mejora futura: sesiones con usuarios

Si se realizan sesiones con personas (2 estudiantes, 1 docente y 1 administrador), usar las mismas tareas T1 a T8 en
la demo en línea o en local, sin explicar la interfaz, y registrar:

- Éxito por tarea (sin ayuda / con ayuda / no completada) y tiempo por tarea en segundos.
- Errores observados y comentarios.
- Satisfacción final de 1 a 5 ("¿Qué tan fácil fue usar CampusReserva?").

Solo cuentas y datos ficticios; participación voluntaria y sin registrar datos personales más allá del perfil.
