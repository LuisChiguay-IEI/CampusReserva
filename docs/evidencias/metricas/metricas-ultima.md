# Métricas de rendimiento y concurrencia — CampusReserva

Fecha de medición (UTC): 2026-11-11T03:22:10.670Z

## Entorno
- Sistema: Windows_NT 10.0.26200 (x64)
- CPU: AMD Ryzen 9 8940HX with Radeon Graphics (32 núcleos lógicos), RAM 63.1 GB
- Node.js v24.21.0, SQLite 3.53.4
- 4 procesos de servidor compartiendo el mismo archivo SQLite (WAL)
- Red: localhost (cliente y servidores en el mismo equipo). **No representa un entorno de producción.**

## Procedimiento
`npm run metricas` (scripts/carga-concurrente.js): 50 usuarios ficticios autenticados;
200 consultas de disponibilidad con 20 concurrentes;
5 rondas en que los 50 usuarios confirman simultáneamente el mismo bloque.
Latencia medida en el cliente (performance.now) desde el envío hasta recibir la respuesta completa.

## Resumen
| Operación | n | Promedio (ms) | p50 (ms) | p95 (ms) | Máx. (ms) | Errores |
|---|---|---|---|---|---|---|
| Inicio de sesión (scrypt N=2^17) | 50 | 1354.2 | 1415.1 | 1491.3 | 1606.1 | 0 |
| Consulta de disponibilidad | 200 | 58.4 | 43.4 | 164.4 | 186 | 0 (0.00 %) |
| Confirmación de reserva concurrente | 250 | 57.6 | 51.9 | 119.2 | 131.1 | 0 (0.00 %) |

## Revalidación del ADR-001 (umbrales del Spike)
| Criterio | Umbral | Resultado | Estado |
|---|---|---|---|
| Reservas duplicadas | 0 | 0 | Cumple |
| p95 confirmación con 50 concurrentes | ≤ 800 ms | 119.2 ms | Cumple |
| Errores técnicos inesperados | < 1 % | 0.00 % | Cumple |

## Detalle por ronda
| Ronda | Fecha | Solicitudes | Confirmadas (HTTP 303) | Conflictos (HTTP 409) | Errores técnicos | Confirmadas en base | p50 (ms) | p95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-12 | 50 | 1 | 49 | 0 | 1 | 50.4 | 120.8 | 124.1 |
| 2 | 2026-11-13 | 50 | 1 | 49 | 0 | 1 | 56.8 | 117.6 | 120.8 |
| 3 | 2026-11-16 | 50 | 1 | 49 | 0 | 1 | 46.7 | 128 | 131.1 |
| 4 | 2026-11-17 | 50 | 1 | 49 | 0 | 1 | 48.1 | 105.1 | 116.5 |
| 5 | 2026-11-18 | 50 | 1 | 49 | 0 | 1 | 45.7 | 106.3 | 109.5 |
