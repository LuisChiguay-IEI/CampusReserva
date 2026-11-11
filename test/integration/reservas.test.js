'use strict';

/**
 * Pruebas de integración de RF-03 (consultar disponibilidad), RF-04 (reservar espacio)
 * y RF-05 (consultar y cancelar reservas propias), con las políticas por rol:
 * los estudiantes solo reservan salas de estudio (hasta 7 días antes y máximo 2 vigentes);
 * docentes y administración reservan cualquier espacio (hasta 30 días antes); se cancela
 * hasta 60 minutos antes del inicio del bloque.
 *
 * Escenario del seed con el reloj fijo (lunes 16-11-2026 10:00):
 *  - Martes 17-11: Sala A-101 08:30 y 10:15 (Diego); Sala de estudio E-01 10:15 (Ana);
 *    Sala de estudio E-02 08:30 cancelada (libre); Lab. Programación L-202 19:00 (Diego) y
 *    12:00 bloqueado; Sala B-105 deshabilitada.
 *  - Miércoles 18-11: Lab. de Redes L-201 14:30 (Diego).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearEntorno, idEspacio, idHorario, FECHAS, CORREOS } = require('../ayudante');

/** true si la página ofrece reservar ese bloque horario. */
const ofrece = (html, horarioId) => new RegExp(`horario=${horarioId}&amp;`).test(html);

/** Miércoles 25-11-2026: 9 días después del lunes 16 (fuera de la ventana del estudiante, dentro de la del docente). */
const FECHA_9_DIAS = '2026-11-25';

describe('RF-03 Consultar disponibilidad', () => {
  let e;
  let ana;
  let diego;
  let ids;
  before(async () => {
    e = await crearEntorno();
    ana = e.cliente();
    diego = e.cliente();
    await ana.iniciarSesion(CORREOS.ana);
    await diego.iniciarSesion(CORREOS.diego);
    const a101 = idEspacio(e, 'Sala A-101');
    const a102 = idEspacio(e, 'Sala A-102');
    const l202 = idEspacio(e, 'Laboratorio de Programación L-202');
    const b105 = idEspacio(e, 'Sala B-105');
    const e01 = idEspacio(e, 'Sala de estudio E-01');
    const e02 = idEspacio(e, 'Sala de estudio E-02');
    ids = {
      a101, a102, l202, b105, e01, e02,
      a101_0830_mar: idHorario(e, a101, 2, '08:30'),
      a101_1200_mar: idHorario(e, a101, 2, '12:00'),
      a102_0830_mar: idHorario(e, a102, 2, '08:30'),
      l202_1200_mar: idHorario(e, l202, 2, '12:00'),
      l202_1900_mar: idHorario(e, l202, 2, '19:00'),
      b105_0830_mar: idHorario(e, b105, 2, '08:30'),
      a101_0830_lun: idHorario(e, a101, 1, '08:30'),
      a101_1015_lun: idHorario(e, a101, 1, '10:15'),
      e01_1015_mar: idHorario(e, e01, 2, '10:15'),
      e01_1200_mar: idHorario(e, e01, 2, '12:00'),
      e02_0830_mar: idHorario(e, e02, 2, '08:30'),
    };
  });
  after(async () => e.cerrar());

  it('CP-03-01 muestra bloques libres de la sede y fecha y excluye los ya reservados', async () => {
    const r = await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`);
    assert.equal(r.estado, 200);
    assert.match(r.html, /bloque\(s\) disponible\(s\)/);
    assert.ok(ofrece(r.html, ids.a101_1200_mar), 'bloque libre visible');
    assert.ok(!ofrece(r.html, ids.a101_0830_mar), 'reservado por Diego');
    assert.ok(!ofrece(r.html, ids.e01_1015_mar), 'reservado por Ana');
    assert.ok(ofrece(r.html, ids.e02_0830_mar), 'una reserva cancelada libera el horario');
  });

  it('CP-03-02 excluye bloques bloqueados y espacios deshabilitados', async () => {
    const r = await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`);
    assert.ok(!ofrece(r.html, ids.l202_1200_mar), 'bloqueado por mantención');
    assert.ok(!ofrece(r.html, ids.l202_1900_mar), 'reservado');
    assert.ok(!ofrece(r.html, ids.b105_0830_mar), 'espacio deshabilitado');
    assert.ok(!r.html.includes('Sala B-105</h3>'));
  });

  it('CP-03-03 para el día de hoy no ofrece bloques que ya comenzaron', async () => {
    const r = await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.hoy}`);
    assert.ok(!ofrece(r.html, ids.a101_0830_lun), '08:30 ya comenzó (son las 10:00)');
    assert.ok(ofrece(r.html, ids.a101_1015_lun));
  });

  it('CP-03-04 aplica el filtro opcional por espacio', async () => {
    const r = await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}&espacio=${ids.a102}`);
    assert.equal(r.estado, 200);
    assert.ok(ofrece(r.html, ids.a102_0830_mar));
    assert.ok(!ofrece(r.html, ids.a101_1200_mar), 'otros espacios no aparecen');
    const otraSede = await diego.get(`/disponibilidad?sede=2&fecha=${FECHAS.dia1}&espacio=${ids.a102}`);
    assert.equal(otraSede.estado, 422);
    assert.match(otraSede.html, /no pertenece a la sede/);
  });

  it('CP-03-05 informa cuando la consulta no tiene resultados', async () => {
    const r = await ana.get(`/disponibilidad?sede=2&fecha=${FECHAS.domingo}`);
    assert.equal(r.estado, 200);
    assert.match(r.html, /No hay espacios disponibles/);
  });

  it('CP-03-06 valida sede y fecha en el servidor', async () => {
    assert.equal((await ana.get(`/disponibilidad?sede=1&fecha=${FECHAS.pasada}`)).estado, 422);
    assert.equal((await diego.get('/disponibilidad?sede=1&fecha=2026-12-30')).estado, 422, 'más de 30 días');
    assert.equal((await ana.get(`/disponibilidad?sede=999&fecha=${FECHAS.dia1}`)).estado, 422);
    assert.equal((await ana.get(`/disponibilidad?sede=1%20OR%201=1&fecha=${FECHAS.dia1}`)).estado, 422);
  });

  it('CP-03-07 la consulta no modifica reservas', async () => {
    const antes = e.consultar('SELECT * FROM reserva ORDER BY id');
    await ana.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`);
    await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia2}&espacio=${ids.a101}`);
    assert.deepEqual(e.consultar('SELECT * FROM reserva ORDER BY id'), antes);
  });

  it('CP-03-08 estudiantes, docentes y administración consultan; un anónimo va al inicio de sesión', async () => {
    const admin = e.cliente();
    await admin.iniciarSesion(CORREOS.admin);
    assert.equal((await admin.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`)).estado, 200);
    const anonimo = await e.cliente().get('/disponibilidad');
    assert.equal(anonimo.estado, 303);
    assert.equal(anonimo.ubicacion, '/login');
  });

  it('CP-03-09 el estudiante solo ve salas de estudio y consulta hasta 7 días adelante', async () => {
    const r = await ana.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`);
    assert.equal(r.estado, 200);
    assert.match(r.html, /Como estudiante puedes reservar/);
    assert.ok(ofrece(r.html, ids.e01_1200_mar), 'la sala de estudio se ofrece');
    assert.ok(!ofrece(r.html, ids.a101_1200_mar), 'la sala de clases no se ofrece al estudiante');
    assert.ok(!r.html.includes('Sala A-101</h3>'));

    const filtrada = await ana.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}&espacio=${ids.a101}`);
    assert.equal(filtrada.estado, 422);
    assert.match(filtrada.html, /solo puedes consultar y reservar salas de estudio/);

    assert.equal((await ana.get(`/disponibilidad?sede=1&fecha=${FECHA_9_DIAS}`)).estado, 422);
    assert.equal((await diego.get(`/disponibilidad?sede=1&fecha=${FECHA_9_DIAS}`)).estado, 200);
  });
});

describe('RF-04 Reservar espacio', () => {
  let e;
  let ana;
  let diego;
  let admin;
  let ids;
  before(async () => {
    e = await crearEntorno();
    ana = e.cliente();
    diego = e.cliente();
    admin = e.cliente();
    await ana.iniciarSesion(CORREOS.ana);
    await diego.iniciarSesion(CORREOS.diego);
    await admin.iniciarSesion(CORREOS.admin);
    const a101 = idEspacio(e, 'Sala A-101');
    const a102 = idEspacio(e, 'Sala A-102');
    const l202 = idEspacio(e, 'Laboratorio de Programación L-202');
    const b105 = idEspacio(e, 'Sala B-105');
    const e01 = idEspacio(e, 'Sala de estudio E-01');
    const e02 = idEspacio(e, 'Sala de estudio E-02');
    ids = {
      a101, a102, l202, b105, e01, e02,
      a101_1200_mar: idHorario(e, a101, 2, '12:00'),
      a101_1430_mar: idHorario(e, a101, 2, '14:30'),
      a101_1200_mie: idHorario(e, a101, 3, '12:00'),
      a101_0830_lun: idHorario(e, a101, 1, '08:30'),
      a102_1615_mie: idHorario(e, a102, 3, '16:15'),
      l202_1200_mar: idHorario(e, l202, 2, '12:00'),
      b105_0830_mar: idHorario(e, b105, 2, '08:30'),
      e01_1200_mar: idHorario(e, e01, 2, '12:00'),
      e01_1200_mie: idHorario(e, e01, 3, '12:00'),
      e02_1200_mar: idHorario(e, e02, 2, '12:00'),
    };
  });
  after(async () => e.cerrar());

  const contar = (horarioId, fecha) =>
    e.uno("SELECT COUNT(*) AS n FROM reserva WHERE horario_id = ? AND fecha = ? AND estado = 'CONFIRMADA'", horarioId, fecha).n;

  it('CP-04-01 revisar no guarda nada; confirmar crea la reserva con identificador asociado a la cuenta', async () => {
    const q = `espacio=${ids.e01}&horario=${ids.e01_1200_mar}&fecha=${FECHAS.dia1}&sede=1`;
    const revision = await ana.get(`/reservas/nueva?${q}`);
    assert.equal(revision.estado, 200);
    assert.match(revision.html, /Revisa tu reserva/);
    assert.equal(contar(ids.e01_1200_mar, FECHAS.dia1), 0, 'la revisión no escribe');

    const r = await ana.post('/reservas', { espacio: ids.e01, horario: ids.e01_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(r.estado, 303);
    assert.match(r.ubicacion, /^\/reservas\/\d+$/);
    const detalle = await ana.seguir(r);
    assert.match(detalle.html, /Reserva CR-\d{6} confirmada/);

    const fila = e.uno('SELECT r.*, u.correo FROM reserva r JOIN usuario u ON u.id = r.usuario_id WHERE r.horario_id = ? AND r.fecha = ?',
      ids.e01_1200_mar, FECHAS.dia1);
    assert.equal(fila.correo, CORREOS.ana);
    assert.equal(fila.estado, 'CONFIRMADA');
    assert.equal(fila.hora_inicio, '12:00');
  });

  it('CP-04-02 impide reservar un bloque ya reservado', async () => {
    const r = await diego.post('/reservas', { espacio: ids.e01, horario: ids.e01_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(r.estado, 409);
    assert.match(r.html, /acaba de ser reservado/);
    assert.equal(contar(ids.e01_1200_mar, FECHAS.dia1), 1);
  });

  it('CP-04-03 ante 20 solicitudes simultáneas para el mismo bloque confirma exactamente una', async () => {
    const datos = { espacio: ids.a101, horario: ids.a101_1430_mar, fecha: FECHAS.dia1 };
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? diego : admin).post('/reservas', datos)),
    );
    const exitos = respuestas.filter((r) => r.estado === 303).length;
    const conflictos = respuestas.filter((r) => r.estado === 409).length;
    assert.equal(exitos, 1);
    assert.equal(conflictos, 19);
    assert.equal(contar(ids.a101_1430_mar, FECHAS.dia1), 1);
  });

  it('CP-04-04 rechaza bloques bloqueados, espacios deshabilitados y bloques ya iniciados', async () => {
    const bloqueado = await diego.post('/reservas', { espacio: ids.l202, horario: ids.l202_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(bloqueado.estado, 409);
    assert.match(bloqueado.html, /bloqueado por la administración/);

    const deshabilitado = await diego.post('/reservas', { espacio: ids.b105, horario: ids.b105_0830_mar, fecha: FECHAS.dia1 });
    assert.equal(deshabilitado.estado, 409);
    assert.match(deshabilitado.html, /no está habilitado/);

    const iniciado = await diego.post('/reservas', { espacio: ids.a101, horario: ids.a101_0830_lun, fecha: FECHAS.hoy });
    assert.equal(iniciado.estado, 409);
    assert.match(iniciado.html, /ya comenzó/);
  });

  it('CP-04-05 rechaza selecciones manipuladas (otro día, otro espacio, fecha pasada o no numéricas)', async () => {
    const otroDia = await diego.post('/reservas', { espacio: ids.a101, horario: ids.a101_1200_mie, fecha: FECHAS.dia1 });
    assert.equal(otroDia.estado, 422);
    const otroEspacio = await diego.post('/reservas', { espacio: ids.a102, horario: ids.a101_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(otroEspacio.estado, 404);
    const pasada = await diego.post('/reservas', { espacio: ids.a101, horario: ids.a101_0830_lun, fecha: FECHAS.pasada });
    assert.equal(pasada.estado, 422);
    const inyeccion = await diego.post('/reservas', { espacio: "1' OR '1'='1", horario: '1', fecha: FECHAS.dia1 });
    assert.equal(inyeccion.estado, 422);
  });

  it('CP-04-06 el estudiante no reserva salas de clases ni laboratorios; la administración sí puede reservar', async () => {
    const sala = await ana.post('/reservas', { espacio: ids.a102, horario: ids.a102_1615_mie, fecha: FECHAS.dia2 });
    assert.equal(sala.estado, 403);
    assert.match(sala.html, /solo puedes reservar salas de estudio/);
    const revisionLab = await ana.get(`/reservas/nueva?espacio=${ids.l202}&horario=${ids.l202_1200_mar}&fecha=${FECHAS.dia1}&sede=1`);
    assert.equal(revisionLab.estado, 403);
    assert.equal(contar(ids.a102_1615_mie, FECHAS.dia2), 0);
    assert.ok(e.uno("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'ACCESO_DENEGADO'").n >= 2, 'los intentos quedan auditados');

    const r = await admin.post('/reservas', { espacio: ids.a102, horario: ids.a102_1615_mie, fecha: FECHAS.dia2 });
    assert.equal(r.estado, 303);
    assert.equal(contar(ids.a102_1615_mie, FECHAS.dia2), 1);
  });

  it('CP-04-09 un estudiante tiene como máximo 2 reservas vigentes', async () => {
    // Ana ya tiene 2 vigentes: la del seed (E-01 10:15) y la de CP-04-01 (E-01 12:00).
    const tercera = await ana.post('/reservas', { espacio: ids.e02, horario: ids.e02_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(tercera.estado, 409);
    assert.match(tercera.html, /Ya tienes 2 reservas vigentes/);
    assert.equal(contar(ids.e02_1200_mar, FECHAS.dia1), 0);

    // Al cancelar una, puede reservar otra.
    const propia = e.uno("SELECT r.id FROM reserva r JOIN usuario u ON u.id = r.usuario_id WHERE u.correo = ? AND r.horario_id = ? AND r.fecha = ?",
      CORREOS.ana, ids.e01_1200_mar, FECHAS.dia1);
    assert.equal((await ana.post(`/reservas/${propia.id}/cancelar`)).estado, 303);
    const ahora = await ana.post('/reservas', { espacio: ids.e02, horario: ids.e02_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(ahora.estado, 303);
  });

  it('CP-04-10 la anticipación depende del rol: estudiante 7 días, docente 30 días', async () => {
    const estudiante = await ana.post('/reservas', { espacio: ids.e01, horario: ids.e01_1200_mie, fecha: FECHA_9_DIAS });
    assert.equal(estudiante.estado, 422);
    assert.match(estudiante.html, /hasta 7 días/);
    const docente = await diego.post('/reservas', { espacio: ids.a101, horario: ids.a101_1200_mie, fecha: FECHA_9_DIAS });
    assert.equal(docente.estado, 303);
  });
});

describe('RF-05 Consultar y cancelar reservas propias', () => {
  let e;
  let ana;
  let diego;
  let reservaAna;
  let reservaDiego;
  before(async () => {
    e = await crearEntorno();
    ana = e.cliente();
    diego = e.cliente();
    await ana.iniciarSesion(CORREOS.ana);
    await diego.iniciarSesion(CORREOS.diego);
    const idUsuario = (correo) => e.uno('SELECT id FROM usuario WHERE correo = ?', correo).id;
    reservaAna = e.uno("SELECT * FROM reserva WHERE usuario_id = ? AND fecha = ? AND hora_inicio = '10:15'", idUsuario(CORREOS.ana), FECHAS.dia1);
    reservaDiego = e.uno("SELECT * FROM reserva WHERE usuario_id = ? AND fecha = ? AND hora_inicio = '08:30'", idUsuario(CORREOS.diego), FECHAS.dia1);
  });
  after(async () => e.cerrar());

  const codigo = (id) => `CR-${String(id).padStart(6, '0')}`;

  it('CP-05-01 lista únicamente las reservas de la cuenta autenticada', async () => {
    const r = await ana.get('/mis-reservas');
    assert.equal(r.estado, 200);
    assert.ok(r.html.includes(codigo(reservaAna.id)));
    assert.ok(!r.html.includes(codigo(reservaDiego.id)));
    assert.match(r.html, /Historial/);
    assert.match(r.html, /Cancelada/, 'la reserva cancelada del seed se conserva en el historial');
    assert.match(r.html, /Finalizada/, 'la reserva pasada aparece en el historial');
  });

  it('CP-05-02 no permite ver ni cancelar reservas ajenas (responde 404 sin cambios)', async () => {
    assert.equal((await ana.get(`/reservas/${reservaDiego.id}`)).estado, 404);
    assert.equal((await ana.get(`/reservas/${reservaDiego.id}/cancelar`)).estado, 404);
    const r = await ana.post(`/reservas/${reservaDiego.id}/cancelar`);
    assert.equal(r.estado, 404);
    assert.equal(e.uno('SELECT estado FROM reserva WHERE id = ?', reservaDiego.id).estado, 'CONFIRMADA');
  });

  it('CP-05-03 la cancelación pide confirmación antes de modificar la reserva', async () => {
    const r = await ana.get(`/reservas/${reservaAna.id}/cancelar`);
    assert.equal(r.estado, 200);
    assert.match(r.html, /¿Confirmas la cancelación\?/);
    assert.equal(e.uno('SELECT estado FROM reserva WHERE id = ?', reservaAna.id).estado, 'CONFIRMADA');
  });

  it('CP-05-04 cancelar conserva el historial y libera el horario para otra persona', async () => {
    const r = await ana.post(`/reservas/${reservaAna.id}/cancelar`);
    assert.equal(r.estado, 303);
    assert.equal(r.ubicacion, '/mis-reservas');
    const fila = e.uno('SELECT * FROM reserva WHERE id = ?', reservaAna.id);
    assert.equal(fila.estado, 'CANCELADA');
    assert.ok(fila.cancelado_en);

    const disponibilidad = await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`);
    assert.ok(new RegExp(`horario=${reservaAna.horario_id}&amp;`).test(disponibilidad.html), 'el bloque vuelve a ofrecerse');
    const nueva = await diego.post('/reservas', { espacio: reservaAna.espacio_id, horario: reservaAna.horario_id, fecha: FECHAS.dia1 });
    assert.equal(nueva.estado, 303);
  });

  it('CP-05-05 no permite cancelar dos veces ni con menos de 60 minutos de anticipación', async () => {
    assert.equal((await ana.post(`/reservas/${reservaAna.id}/cancelar`)).estado, 409);
    const reservaA101_1015 = e.uno(
      "SELECT r.* FROM reserva r JOIN espacio s ON s.id = r.espacio_id WHERE s.nombre = 'Sala A-101' AND r.fecha = ? AND r.hora_inicio = '10:15'",
      FECHAS.dia1,
    );
    // Martes 09:30 en Chile: el bloque de las 08:30 ya comenzó y el de las 10:15 empieza en 45 minutos.
    // La sesión anterior de Diego expiró por inactividad, así que vuelve a iniciar sesión.
    e.fijarAhora('2026-11-17T12:30:00.000Z');
    try {
      await diego.iniciarSesion(CORREOS.diego);
      for (const reserva of [reservaDiego, reservaA101_1015]) {
        const r = await diego.post(`/reservas/${reserva.id}/cancelar`);
        assert.equal(r.estado, 409);
        assert.match(r.html, /hasta 60 minutos antes del inicio/);
        assert.equal(e.uno('SELECT estado FROM reserva WHERE id = ?', reserva.id).estado, 'CONFIRMADA');
      }
    } finally {
      e.fijarAhora('2026-11-16T13:00:00.000Z');
    }
  });
});
