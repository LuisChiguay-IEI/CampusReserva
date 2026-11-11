# CampusReserva

Aplicación web para **consultar disponibilidad y reservar salas y laboratorios académicos**.
Producto Mínimo Viable (MVP) desarrollado para la Evaluación Sumativa 3 de Ingeniería de Software (TI3043, INACAP).

- Autor: Luis Santiago Chiguay Espinoza (proyecto individual, gestión con Kanban en Jira, proyecto KAN).
- Repositorio: https://github.com/LuisChiguay-IEI/CampusReserva
- Estado: **MVP funcional ejecutado y probado en entorno local**. No está desplegado en la nube (la propuesta PaaS está documentada, no implementada).
- Todos los datos son **ficticios** (dominio reservado `campus.test`).

## Antecedentes

Continúa el análisis y diseño de la Sumativa 2 (RF-01 a RF-06, RNF-01 a RNF-07, historias HU-01 a HU-06, casos AN-01 a AN-06 y
DET-01 a DET-22, modelados en Enterprise Architect) y el ADR-001 de la actividad Spike/ADR. La trazabilidad completa está en
[docs/decisiones-y-alcance.md](docs/decisiones-y-alcance.md).

## Funcionalidades

| ID | Requerimiento | Estado en el MVP |
|---|---|---|
| RF-01 | Registrar usuario (listado institucional, rol asignado, confirmación por enlace) | Implementado y probado. El correo se simula con un *Buzón de demostración* |
| RF-02 | Iniciar sesión con funciones según rol | Implementado y probado |
| RF-03 | Consultar disponibilidad por sede y fecha (espacio opcional) | Implementado y probado |
| RF-04 | Reservar espacio (revisión, confirmación, sin duplicados concurrentes) | Implementado y probado |
| RF-05 | Consultar y cancelar reservas propias (con historial) | Implementado y probado |
| RF-06 | Administrar espacios, horarios y bloqueos | Implementado y probado |
| Apoyo | Cerrar sesión · registro de auditoría | Implementado y probado |

## Requisitos

- **Node.js 24 LTS** o superior (usa el módulo integrado `node:sqlite`; no requiere compilar dependencias nativas).
- npm 10 o superior.
- Para `npm run capturas` y `npm run diagramas`: Microsoft Edge instalado (se usa mediante `playwright-core`).

## Instalación y ejecución

```bash
npm install            # instala dependencias con versiones fijadas (package-lock.json)
cp .env.example .env   # en Windows: copy .env.example .env  (opcional en desarrollo)
npm start              # http://localhost:3000
```

Al iniciar por primera vez con la base vacía se cargan automáticamente los datos ficticios (`SEED_DEMO=true`).
Para volver al estado inicial: `npm run db:reset`.

### Cuentas de demostración

Contraseña de todas las cuentas: **`Demo Campus 2026`** (con espacios; configurable con `DEMO_PASSWORD`; solo para la demo local).

| Rol | Correo | Estado |
|---|---|---|
| Estudiante | `ana.estudiante@campus.test` | Activa, con reservas próximas, cancelada y finalizada |
| Docente | `diego.docente@campus.test` | Activa, con reservas próximas |
| Administrador | `admin@campus.test` | Activa (creada fuera del registro público) |
| Estudiante | `pedro.pendiente@campus.test` | **Pendiente** de confirmación (no puede iniciar sesión) |

Correos del **listado institucional** disponibles para probar el registro: `nuevo.estudiante@campus.test`,
`camila.estudiante@campus.test` (estudiantes) y `nueva.docente@campus.test` (docente).
Cualquier otro correo es rechazado; ningún correo puede registrarse como Administrador.

### Buzón de demostración (limitación del correo)

El MVP **no envía correos reales**: no hay un servicio de correo disponible. Cuando `DEMO_MAILBOX=true`
(valor por defecto en desarrollo) los mensajes que el sistema "habría enviado" se guardan en la base y se
muestran en `http://localhost:3000/demo/buzon`, desde donde se abre el enlace de confirmación.
En producción debe ponerse `DEMO_MAILBOX=false` e integrarse un proveedor de correo (trabajo pendiente).

## Configuración

Ver [.env.example](.env.example). Variables principales:

| Variable | Uso | Por defecto |
|---|---|---|
| `NODE_ENV` | `development` o `production` | `development` |
| `PORT` / `BASE_URL` | Puerto y URL pública (para el enlace de confirmación) | `3000` / `http://localhost:3000` |
| `SESSION_SECRET` | Secreto de la aplicación. **Obligatorio en producción**; en desarrollo se genera uno aleatorio por arranque | — |
| `SESSION_IDLE_MINUTES` | Expiración de sesión por inactividad | `30` |
| `DB_PATH` | Archivo SQLite | `./data/campusreserva.db` |
| `INSTITUTIONAL_DOMAIN` | Dominio aceptado en el registro | `campus.test` |
| `MAX_DIAS_ANTICIPACION` | Ventana de reserva | `30` |
| `LOGIN_MAX_INTENTOS` | Intentos fallidos de login por IP cada 15 min | `10` |
| `DEMO_MAILBOX` / `SEED_DEMO` | Buzón de demostración / datos ficticios | `true` en desarrollo |
| `TRUST_PROXY` | `true` si corre detrás de un proxy HTTPS (PaaS) | `false` |

El archivo `.env` está en `.gitignore`: **no se suben secretos al repositorio**.

## Pruebas y evidencias

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta las 79 pruebas automatizadas (unitarias + integración + concurrencia) |
| `npm run test:unit` | 28 pruebas unitarias de funciones puras |
| `npm run test:integration` | 51 pruebas de integración (49 HTTP y 2 de concurrencia entre procesos) con SQLite temporal |
| `npm run test:coverage` | Pruebas con cobertura de código (instrumento integrado de Node.js) |
| `npm run metricas` | Carga concurrente: 4 servidores, 50 usuarios, 5 rondas de reservas simultáneas |
| `npm run capturas` | Regenera las capturas de pantalla reales con Edge |
| `npm run diagramas` | Regenera los diagramas UML (SVG y PNG) |
| `npm run grafico` | Regenera el gráfico de latencias a partir de la última medición |

Último resultado registrado (11-11-2026, Windows 11, Node.js 24.21.0):
**79/79 pruebas aprobadas**; cobertura **96,58 % de líneas, 87,20 % de ramas, 93,48 % de funciones**;
reservas concurrentes: **0 duplicados** en 250 solicitudes, p95 = 119,2 ms. Ver [docs/evidencias](docs/evidencias).

Las pruebas usan un reloj fijo (lunes 16-11-2026 10:00, hora de Chile) y una base temporal por archivo,
por lo que son reproducibles en cualquier fecha.

## Estructura

```
src/
  server.js, app.js, config.js   arranque, ensamblado (inyección de dependencias) y configuración
  rutas/        capa de presentación (cuentas, reservas, administración, buzón demo)
  vistas/       plantillas EJS (escape automático de HTML)
  middleware/   sesión del servidor, cabeceras, CSRF, límite de intentos, autorización por rol
  servicios/    reglas de negocio (autenticación, disponibilidad, reservas, administración)
  repositorios/ acceso a datos con sentencias preparadas
  lib/          validaciones, seguridad (scrypt), fechas, errores
  db/           esquema SQL, conexión/transacciones y datos ficticios
public/         CSS, JS de mejora progresiva y logo
test/           unit/, integration/, fixtures/ y ayudante.js
scripts/        init-db, métricas de carga, capturas y diagramas
docs/           plan de pruebas, decisiones, normativa, Jira, matriz de cumplimiento, diagramas y evidencias
```

## Arquitectura y decisiones clave

- **Arquitectura en capas cliente-servidor**: rutas → servicios → repositorios → SQLite ([diagrama](docs/diagramas/01-componentes.png)).
- **ADR-001 (concurrencia)**: transacción `BEGIN IMMEDIATE` + índice único parcial
  `ux_reserva_confirmada (espacio, horario, fecha) WHERE estado='CONFIRMADA'`. Revalidado con mediciones reales.
- **Ningún cambio administrativo afecta reservas en silencio**: deshabilitar un espacio, modificar/desactivar un
  bloque o bloquear un horario con reservas vigentes se rechaza indicando las reservas afectadas.
- Detalle de reglas acordadas y decisiones nuevas: [docs/decisiones-y-alcance.md](docs/decisiones-y-alcance.md).

## Seguridad (resumen)

Contraseñas con scrypt (N=2^17, r=8, p=1, sal aleatoria) · sesiones en el servidor con cookie HttpOnly/SameSite,
regeneración al iniciar sesión, expiración por inactividad (30 min) y absoluta (8 h) · token CSRF en todo formulario ·
autorización por rol en el servidor · consultas parametrizadas · validación de entradas por lista blanca ·
CSP estricta y cabeceras defensivas · límite de intentos de login · auditoría sin datos sensibles ·
mensajes de error sin detalles internos. Mapeo a OWASP Top 10:2025 en el informe y en
[docs/plan-pruebas.md](docs/plan-pruebas.md).

## Limitaciones conocidas

- No se envían correos reales (buzón de demostración).
- No está desplegado; solo se verificó en un equipo local con HTTP. HTTPS, HSTS y cookie `Secure` quedan activos
  únicamente con `NODE_ENV=production` detrás de un proxy TLS (no probado).
- SQLite es adecuado para el MVP; con varias instancias en distintos servidores se recomienda migrar a PostgreSQL.
- Las pruebas de usuario con personas reales están **pendientes** (procedimiento en [docs/pruebas-usuario.md](docs/pruebas-usuario.md)).
- Las dependencias se instalaron desde el registro corporativo de paquetes aprobados; por eso sesión, cabeceras y
  CSRF están implementados en el propio proyecto en lugar de `express-session`/`helmet`.
