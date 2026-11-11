# Procedimiento de pruebas de usuario (UAT) — CampusReserva

> **Estado: PENDIENTE.** Este procedimiento está preparado pero **no se ha ejecutado** con personas reales.
> No existen resultados de pruebas de usuario en esta entrega. Si se realiza, completar la sección 6 con datos reales.

## 1. Objetivo

Comprobar con usuarios representativos que los recorridos principales (registrarse, iniciar sesión, consultar,
reservar, cancelar y administrar) se completan sin ayuda y que los mensajes se entienden.

## 2. Participantes sugeridos

| Perfil | Cantidad | Requisito |
|---|---|---|
| Estudiante | 2 | Uso habitual de salas o laboratorios |
| Docente | 1 | Reserva espacios para clases |
| Administrador (o funcionario de sede) | 1 | Conoce la gestión de espacios |

Se usan solo cuentas y datos ficticios del sistema. No se registran datos personales de los participantes más allá
del perfil; la participación es voluntaria y puede interrumpirse en cualquier momento (consentimiento verbal o escrito).

## 3. Preparación

1. `npm run db:reset` y `npm start` en el equipo de prueba, **o** usar la demo en línea
   https://campusreserva.onrender.com (abrirla un minuto antes: el plan gratuito se suspende sin tráfico y, al
   reiniciarse, vuelve a los datos ficticios iniciales; si varias personas prueban a la vez comparten los mismos datos).
2. Navegador en `http://localhost:3000` o en la demo en línea, ventana limpia.
3. Cronómetro y planilla de observación (sección 6).
4. El facilitador lee cada tarea sin explicar la interfaz; observa y anota.

## 4. Tareas

| ID | Perfil | Tarea | Criterio de éxito | RF |
|---|---|---|---|---|
| T1 | Estudiante | Crear una cuenta con `nuevo.estudiante@campus.test` y activarla desde el Buzón de demostración | Cuenta activa e inicio de sesión exitoso | RF-01, RF-02 |
| T2 | Estudiante | Buscar una sala libre en Sede Maipú para el próximo día hábil | Llega a la lista de bloques disponibles | RF-03 |
| T3 | Estudiante | Reservar un laboratorio de 14:30 y anotar el código | Reserva confirmada y código anotado | RF-04 |
| T4 | Estudiante | Encontrar la reserva y cancelarla | Reserva en estado Cancelada en el historial | RF-05 |
| T5 | Docente | Buscar disponibilidad un domingo e interpretar el resultado | Entiende que no hay bloques disponibles | RF-03 |
| T6 | Administrador | Registrar la "Sala Z-01" (Sede Centro, 25 personas) y crear un bloque lunes 10:00–11:30 | Espacio y bloque creados | RF-06 |
| T7 | Administrador | Bloquear un horario con motivo "Mantención" | Bloqueo visible en "Bloqueos vigentes" | RF-06 |
| T8 | Administrador | Intentar deshabilitar "Sala A-101" e interpretar el mensaje | Entiende que hay reservas vigentes que lo impiden | RF-06 |

## 5. Métricas

- Tasa de éxito por tarea (completada sin ayuda / con ayuda / no completada).
- Tiempo por tarea (segundos).
- Errores observados y comentarios textuales.
- Satisfacción al final: escala de 1 a 5 ("¿Qué tan fácil fue usar CampusReserva?").

## 6. Planilla de resultados (completar solo con datos reales)

| Participante (perfil) | Tarea | Resultado | Tiempo (s) | Errores / comentarios |
|---|---|---|---|---|
| | | | | |

Fecha de ejecución: ______ · Facilitador: ______ · Versión (commit): ______
