# Métricas de rendimiento y concurrencia — CampusReserva

Fecha de medición (UTC): 2026-11-11T07:20:37.638Z

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
| Inicio de sesión (scrypt N=2^17) | 50 | 1238.1 | 1254.4 | 1355.4 | 1531.8 | 0 |
| Consulta de disponibilidad | 200 | 65.5 | 41.2 | 234 | 274.6 | 0 (0.00 %) |
| Confirmación de reserva concurrente | 250 | 58.7 | 55.3 | 116.7 | 128.9 | 0 (0.00 %) |

## Revalidación del ADR-001 (umbrales del Spike)
| Criterio | Umbral | Resultado | Estado |
|---|---|---|---|
| Reservas duplicadas | 0 | 0 | Cumple |
| p95 confirmación con 50 concurrentes | ≤ 800 ms | 116.7 ms | Cumple |
| Errores técnicos inesperados | < 1 % | 0.00 % | Cumple |

## Detalle por ronda
| Ronda | Fecha | Solicitudes | Confirmadas (HTTP 303) | Conflictos (HTTP 409) | Errores técnicos | Confirmadas en base | p50 (ms) | p95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-12 | 50 | 1 | 49 | 0 | 1 | 59.8 | 118 | 121 |
| 2 | 2026-11-13 | 50 | 1 | 49 | 0 | 1 | 58.6 | 116.2 | 119.6 |
| 3 | 2026-11-16 | 50 | 1 | 49 | 0 | 1 | 55.3 | 103.7 | 114.3 |
| 4 | 2026-11-17 | 50 | 1 | 49 | 0 | 1 | 47.6 | 125.9 | 128.9 |
| 5 | 2026-11-18 | 50 | 1 | 49 | 0 | 1 | 49 | 107.9 | 110.9 |
