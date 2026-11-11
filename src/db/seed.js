/**
 * Datos ficticios de demostración (solo desarrollo y pruebas).
 *
 * Todas las personas, correos y sedes son inventados; el dominio por defecto `campus.test`
 * está reservado para pruebas (RFC 2606) y no corresponde a ninguna institución real.
 * Las fechas de las reservas se calculan respecto de "hoy" para que la demo funcione
 * cualquier día en que se ejecute.
 */
'use strict';

const { transaccion } = require('./conexion');
const { hashContrasena, tokenAleatorio, sha256 } = require('../lib/seguridad');
const { fechaHoraEnZona, diaSemana, sumarDias } = require('../lib/fechas');

/** Bloques de lunes a viernes (jornada diurna y vespertina). */
const BLOQUES_SEMANA = [
  ['08:30', '10:00'],
  ['10:15', '11:45'],
  ['12:00', '13:30'],
  ['14:30', '16:00'],
  ['16:15', '17:45'],
  ['19:00', '20:30'],
  ['20:45', '22:15'],
];
const BLOQUES_SABADO = [
  ['09:00', '10:30'],
  ['10:45', '12:15'],
];

const SEDES = [
  { clave: 'maipu', nombre: 'Sede Maipú', direccion: 'Dirección ficticia de demostración 100' },
  { clave: 'centro', nombre: 'Sede Santiago Centro', direccion: 'Dirección ficticia de demostración 200' },
];

const ESPACIOS = [
  { clave: 'a101', sede: 'maipu', nombre: 'Sala A-101', tipo: 'SALA', capacidad: 40, sabado: true },
  { clave: 'a102', sede: 'maipu', nombre: 'Sala A-102', tipo: 'SALA', capacidad: 30, sabado: true },
  { clave: 'l201', sede: 'maipu', nombre: 'Laboratorio de Redes L-201', tipo: 'LABORATORIO', capacidad: 24 },
  { clave: 'l202', sede: 'maipu', nombre: 'Laboratorio de Programación L-202', tipo: 'LABORATORIO', capacidad: 30 },
  { clave: 'b105', sede: 'maipu', nombre: 'Sala B-105', tipo: 'SALA', capacidad: 35, deshabilitado: true },
  { clave: 'c301', sede: 'centro', nombre: 'Sala C-301', tipo: 'SALA', capacidad: 45 },
  { clave: 'cl1', sede: 'centro', nombre: 'Laboratorio C-L1', tipo: 'LABORATORIO', capacidad: 20 },
  // Salas de estudio: las únicas que pueden reservar los estudiantes.
  { clave: 'e01', sede: 'maipu', nombre: 'Sala de estudio E-01', tipo: 'SALA_ESTUDIO', capacidad: 6 },
  { clave: 'e02', sede: 'maipu', nombre: 'Sala de estudio E-02', tipo: 'SALA_ESTUDIO', capacidad: 8 },
  { clave: 'ce1', sede: 'centro', nombre: 'Sala de estudio CE-1', tipo: 'SALA_ESTUDIO', capacidad: 6 },
];

/**
 * Cuentas ficticias. Los correos se completan con el dominio institucional configurado.
 * Pedro queda PENDIENTE para demostrar el bloqueo de cuentas sin confirmar.
 */
const USUARIOS = [
  { clave: 'ana', nombre: 'Ana Rivas Fuentes', local: 'ana.estudiante', rol: 'ESTUDIANTE', estado: 'ACTIVA' },
  { clave: 'diego', nombre: 'Diego Soto Mella', local: 'diego.docente', rol: 'DOCENTE', estado: 'ACTIVA' },
  { clave: 'admin', nombre: 'Administración CampusReserva', local: 'admin', rol: 'ADMINISTRADOR', estado: 'ACTIVA' },
  { clave: 'pedro', nombre: 'Pedro Lagos Vera', local: 'pedro.pendiente', rol: 'ESTUDIANTE', estado: 'PENDIENTE' },
];

/** Listado institucional autorizado (incluye correos aún no registrados para probar RF-01). */
const LISTADO = [
  ['ana.estudiante', 'ESTUDIANTE'],
  ['diego.docente', 'DOCENTE'],
  ['pedro.pendiente', 'ESTUDIANTE'],
  ['nuevo.estudiante', 'ESTUDIANTE'],
  ['camila.estudiante', 'ESTUDIANTE'],
  ['nueva.docente', 'DOCENTE'],
];

/**
 * Próximo día hábil (lunes a viernes) estrictamente posterior a `fecha`.
 * @param {string} fecha
 */
function siguienteDiaHabil(fecha) {
  let f = sumarDias(fecha, 1);
  while (diaSemana(f) > 5) f = sumarDias(f, 1);
  return f;
}

/**
 * Inserta el conjunto completo de datos de demostración.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {object} config
 */
async function sembrar(db, config) {
  const ahora = config.ahora();
  const ahoraIso = ahora.toISOString();
  const hoy = fechaHoraEnZona(ahora, config.zonaHoraria).fecha;
  const dominio = config.dominioInstitucional;
  const hash = await hashContrasena(config.passwordDemo); // misma contraseña de demo para todas las cuentas

  transaccion(db, () => {
    const ids = { sede: {}, espacio: {}, usuario: {} };

    for (const s of SEDES) {
      ids.sede[s.clave] = Number(
        db.prepare('INSERT INTO sede (nombre, direccion) VALUES (?, ?)').run(s.nombre, s.direccion).lastInsertRowid,
      );
    }

    const insertarHorario = db.prepare(
      'INSERT INTO horario (espacio_id, dia_semana, hora_inicio, hora_fin, activo) VALUES (?, ?, ?, ?, 1)',
    );
    for (const e of ESPACIOS) {
      const id = Number(
        db
          .prepare(
            `INSERT INTO espacio (sede_id, nombre, tipo, capacidad, habilitado, creado_en) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(ids.sede[e.sede], e.nombre, e.tipo, e.capacidad, e.deshabilitado ? 0 : 1, ahoraIso).lastInsertRowid,
      );
      ids.espacio[e.clave] = id;
      for (let dia = 1; dia <= 5; dia += 1) {
        for (const [inicio, fin] of BLOQUES_SEMANA) insertarHorario.run(id, dia, inicio, fin);
      }
      if (e.sabado) {
        for (const [inicio, fin] of BLOQUES_SABADO) insertarHorario.run(id, 6, inicio, fin);
      }
    }

    const insertarListado = db.prepare('INSERT INTO listado_institucional (correo, rol) VALUES (?, ?)');
    for (const [local, rol] of LISTADO) insertarListado.run(`${local}@${dominio}`, rol);

    for (const u of USUARIOS) {
      ids.usuario[u.clave] = Number(
        db
          .prepare(
            `INSERT INTO usuario (nombre, correo, password_hash, rol, estado, creado_en, confirmado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(u.nombre, `${u.local}@${dominio}`, hash, u.rol, u.estado, ahoraIso, u.estado === 'ACTIVA' ? ahoraIso : null)
          .lastInsertRowid,
      );
    }

    // Enlace de confirmación vigente para la cuenta pendiente (queda en el buzón de demostración).
    const token = tokenAleatorio(32);
    const expira = new Date(ahora.getTime() + config.horasValidezEnlace * 3600 * 1000).toISOString();
    db.prepare('INSERT INTO token_confirmacion (usuario_id, token_hash, expira_en) VALUES (?, ?, ?)').run(
      ids.usuario.pedro,
      sha256(token),
      expira,
    );
    db.prepare(
      'INSERT INTO correo_demo (destinatario, asunto, cuerpo, enlace, creado_en) VALUES (?, ?, ?, ?, ?)',
    ).run(
      `pedro.pendiente@${dominio}`,
      'Confirma tu cuenta de CampusReserva',
      'Hola Pedro Lagos Vera: para activar tu cuenta abre el siguiente enlace. Es válido por 24 horas y se puede usar una sola vez.',
      `${config.urlBase}/confirmar?token=${token}`,
      ahoraIso,
    );

    // Reservas de ejemplo en los dos próximos días hábiles y una ya realizada.
    const buscarHorario = db.prepare(
      'SELECT id, hora_inicio, hora_fin FROM horario WHERE espacio_id = ? AND dia_semana = ? AND hora_inicio = ?',
    );
    const insertarReserva = db.prepare(
      `INSERT INTO reserva (usuario_id, espacio_id, horario_id, fecha, hora_inicio, hora_fin, estado, creado_en, cancelado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const reservar = (usuario, espacio, fecha, inicio, estado = 'CONFIRMADA') => {
      const h = buscarHorario.get(ids.espacio[espacio], diaSemana(fecha), inicio);
      insertarReserva.run(
        ids.usuario[usuario], ids.espacio[espacio], h.id, fecha, h.hora_inicio, h.hora_fin,
        estado, ahoraIso, estado === 'CANCELADA' ? ahoraIso : null,
      );
      return h.id;
    };

    const dia1 = siguienteDiaHabil(hoy);
    const dia2 = siguienteDiaHabil(dia1);
    let pasada = sumarDias(hoy, -7);
    while (diaSemana(pasada) > 5) pasada = sumarDias(pasada, -1);

    // Estudiante: solo salas de estudio (una vigente, una cancelada y una ya realizada).
    reservar('ana', 'e01', dia1, '10:15');
    reservar('ana', 'e02', dia1, '08:30', 'CANCELADA');
    reservar('ana', 'e01', pasada, '08:30');
    // Docente: salas de clases y laboratorios para sus clases.
    reservar('diego', 'a101', dia1, '08:30');
    reservar('diego', 'a101', dia1, '10:15');
    reservar('diego', 'l201', dia2, '14:30');
    reservar('diego', 'l202', dia1, '19:00');

    const horarioBloqueado = buscarHorario.get(ids.espacio.l202, diaSemana(dia1), '12:00');
    db.prepare('INSERT INTO bloqueo (horario_id, fecha, motivo, creado_por, creado_en) VALUES (?, ?, ?, ?, ?)').run(
      horarioBloqueado.id,
      dia1,
      'Mantención de equipos',
      ids.usuario.admin,
      ahoraIso,
    );

    db.prepare('INSERT INTO auditoria (fecha, usuario_id, accion, detalle) VALUES (?, NULL, ?, ?)').run(
      ahoraIso,
      'SEED',
      'Carga de datos ficticios de demostración',
    );
  });
}

/**
 * Siembra los datos solo si la base no tiene usuarios.
 * @returns {Promise<boolean>} true si se cargaron datos
 */
async function sembrarSiVacia(db, config) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuario').get();
  if (Number(total) > 0) return false;
  await sembrar(db, config);
  return true;
}

module.exports = { sembrar, sembrarSiVacia, siguienteDiaHabil, BLOQUES_SEMANA, USUARIOS, ESPACIOS };
