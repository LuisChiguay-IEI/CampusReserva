-- =====================================================================
-- Esquema relacional de CampusReserva (SQLite)
-- Deriva del modelo de clases del informe de la Sumativa 2:
-- Usuario, Sede, Espacio, Horario y Reserva, más las tablas de soporte
-- necesarias para el MVP (listado institucional, confirmación de correo,
-- bloqueos, sesiones y auditoría).
-- =====================================================================

CREATE TABLE IF NOT EXISTS sede (
  id        INTEGER PRIMARY KEY,
  nombre    TEXT NOT NULL UNIQUE,
  direccion TEXT
);

-- Listado institucional autorizado: define quién puede registrarse y con qué rol.
-- El rol Administrador no existe aquí: esas cuentas se crean fuera del registro público.
CREATE TABLE IF NOT EXISTS listado_institucional (
  correo TEXT PRIMARY KEY,
  rol    TEXT NOT NULL CHECK (rol IN ('ESTUDIANTE', 'DOCENTE'))
);

CREATE TABLE IF NOT EXISTS usuario (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('ESTUDIANTE', 'DOCENTE', 'ADMINISTRADOR')),
  estado        TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ACTIVA')),
  creado_en     TEXT NOT NULL,
  confirmado_en TEXT
);

-- Solo se guarda el hash SHA-256 del token; el enlace real nunca queda en la base.
CREATE TABLE IF NOT EXISTS token_confirmacion (
  id         INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_en  TEXT NOT NULL,
  usado_en   TEXT
);

-- Buzón de demostración: reemplaza al servicio de correo (no se envían correos reales).
CREATE TABLE IF NOT EXISTS correo_demo (
  id           INTEGER PRIMARY KEY,
  destinatario TEXT NOT NULL,
  asunto       TEXT NOT NULL,
  cuerpo       TEXT NOT NULL,
  enlace       TEXT,
  creado_en    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS espacio (
  id             INTEGER PRIMARY KEY,
  sede_id        INTEGER NOT NULL REFERENCES sede(id),
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('SALA', 'LABORATORIO', 'SALA_ESTUDIO')),
  capacidad      INTEGER NOT NULL CHECK (capacidad BETWEEN 1 AND 200),
  habilitado     INTEGER NOT NULL DEFAULT 1 CHECK (habilitado IN (0, 1)),
  creado_en      TEXT NOT NULL,
  actualizado_en TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_espacio_sede_nombre ON espacio (sede_id, nombre COLLATE NOCASE);

-- Bloque horario semanal recurrente de un espacio (día 1 = lunes ... 7 = domingo).
CREATE TABLE IF NOT EXISTS horario (
  id          INTEGER PRIMARY KEY,
  espacio_id  INTEGER NOT NULL REFERENCES espacio(id),
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio TEXT NOT NULL,
  hora_fin    TEXT NOT NULL,
  activo      INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  CHECK (hora_inicio < hora_fin)
);
CREATE INDEX IF NOT EXISTS ix_horario_espacio_dia ON horario (espacio_id, dia_semana);

-- Bloqueo de un bloque horario en una fecha puntual (mantención, evento, etc.).
CREATE TABLE IF NOT EXISTS bloqueo (
  id         INTEGER PRIMARY KEY,
  horario_id INTEGER NOT NULL REFERENCES horario(id),
  fecha      TEXT NOT NULL,
  motivo     TEXT NOT NULL,
  creado_por INTEGER NOT NULL REFERENCES usuario(id),
  creado_en  TEXT NOT NULL,
  UNIQUE (horario_id, fecha)
);

-- La hora de inicio/fin se copia al reservar para conservar el historial
-- aunque el administrador modifique después el bloque horario.
CREATE TABLE IF NOT EXISTS reserva (
  id           INTEGER PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuario(id),
  espacio_id   INTEGER NOT NULL REFERENCES espacio(id),
  horario_id   INTEGER NOT NULL REFERENCES horario(id),
  fecha        TEXT NOT NULL,
  hora_inicio  TEXT NOT NULL,
  hora_fin     TEXT NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'CONFIRMADA' CHECK (estado IN ('CONFIRMADA', 'CANCELADA')),
  creado_en    TEXT NOT NULL,
  cancelado_en TEXT
);
-- ADR-001: como máximo UNA reserva confirmada por espacio + fecha + bloque.
-- La base de datos rechaza el duplicado aunque lleguen solicitudes simultáneas.
-- Las reservas canceladas quedan fuera del índice: liberan el horario y se conservan como historial.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reserva_confirmada
  ON reserva (espacio_id, horario_id, fecha) WHERE estado = 'CONFIRMADA';
CREATE INDEX IF NOT EXISTS ix_reserva_usuario ON reserva (usuario_id);
CREATE INDEX IF NOT EXISTS ix_reserva_fecha ON reserva (fecha);

-- Sesiones del lado del servidor: se guarda el hash del identificador, no el valor de la cookie.
CREATE TABLE IF NOT EXISTS sesion (
  sid_hash TEXT PRIMARY KEY,
  datos    TEXT NOT NULL,
  expira   INTEGER NOT NULL
);

-- Registro de auditoría de eventos de seguridad y operaciones relevantes.
CREATE TABLE IF NOT EXISTS auditoria (
  id         INTEGER PRIMARY KEY,
  fecha      TEXT NOT NULL,
  usuario_id INTEGER,
  accion     TEXT NOT NULL,
  detalle    TEXT
);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria (fecha);
