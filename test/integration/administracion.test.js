'use strict';

/**
 * Pruebas de integración de RF-06 (administrar espacios y horarios) y de las restricciones por rol.
 * Reloj fijo: lunes 16-11-2026 10:00. Reservas vigentes del seed (del docente) en Sala A-101 (martes 08:30 y 10:15).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearEntorno, idEspacio, idHorario, FECHAS, CORREOS } = require('../ayudante');

describe('RF-06 Administrar espacios y horarios', () => {
  let e;
  let admin;
  let ana;
  let diego;
  let ids;
  before(async () => {
    e = await crearEntorno();
    admin = e.cliente();
    ana = e.cliente();
    diego = e.cliente();
    await admin.iniciarSesion(CORREOS.admin);
    await ana.iniciarSesion(CORREOS.ana);
    await diego.iniciarSesion(CORREOS.diego);
    const a101 = idEspacio(e, 'Sala A-101');
    const a102 = idEspacio(e, 'Sala A-102');
    ids = {
      a101,
      a102,
      a101_1015_mar: idHorario(e, a101, 2, '10:15'),
      a101_1200_mar: idHorario(e, a101, 2, '12:00'),
      a101_1615_jue: idHorario(e, a101, 4, '16:15'),
      a101_1430_jue: idHorario(e, a101, 4, '14:30'),
    };
  });
  after(async () => e.cerrar());

  const espacio = (id) => e.uno('SELECT * FROM espacio WHERE id = ?', id);
  const horario = (id) => e.uno('SELECT * FROM horario WHERE id = ?', id);

  it('CP-06-01 solo el administrador accede: estudiante y docente reciben 403 y nada cambia', async () => {
    assert.equal((await ana.get('/admin/espacios')).estado, 403);
    const antes = e.uno('SELECT COUNT(*) AS n FROM espacio').n;
    const r = await diego.post('/admin/espacios', { sede: '1', nombre: 'Sala Pirata', tipo: 'SALA', capacidad: '10' });
    assert.equal(r.estado, 403);
    assert.equal(e.uno('SELECT COUNT(*) AS n FROM espacio').n, antes);
    const r2 = await ana.post(`/admin/espacios/${ids.a101}/estado`, { accion: 'deshabilitar' });
    assert.equal(r2.estado, 403);
    assert.equal(espacio(ids.a101).habilitado, 1);
    const anonimo = await e.cliente().get('/admin/espacios');
    assert.equal(anonimo.ubicacion, '/login');
    assert.ok(e.uno("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'ACCESO_DENEGADO'").n >= 3);
  });

  it('CP-06-02 registra un espacio válido y valida sede, nombre, tipo y capacidad', async () => {
    const ok = await admin.post('/admin/espacios', { sede: '1', nombre: 'Sala D-210', tipo: 'SALA', capacidad: '28' });
    assert.equal(ok.estado, 303);
    const creado = e.uno('SELECT * FROM espacio WHERE nombre = ?', 'Sala D-210');
    assert.equal(creado.habilitado, 1);
    assert.equal(creado.capacidad, 28);
    const estudio = await admin.post('/admin/espacios', { sede: '1', nombre: 'Sala de estudio E-03', tipo: 'SALA_ESTUDIO', capacidad: '6' });
    assert.equal(estudio.estado, 303);
    assert.equal(e.uno('SELECT tipo FROM espacio WHERE nombre = ?', 'Sala de estudio E-03').tipo, 'SALA_ESTUDIO');

    const malo = await admin.post('/admin/espacios', { sede: '999', nombre: 'X', tipo: 'AUDITORIO', capacidad: '0' });
    assert.equal(malo.estado, 422);
    assert.match(malo.html, /entre 3 y 60 caracteres/);
    assert.match(malo.html, /sala de clases, laboratorio o sala de estudio/);
    assert.match(malo.html, /entre 1 y 200/);
    const sedeInexistente = await admin.post('/admin/espacios', { sede: '999', nombre: 'Sala Fantasma', tipo: 'SALA', capacidad: '10' });
    assert.equal(sedeInexistente.estado, 422);
    assert.match(sedeInexistente.html, /La sede no existe/);
  });

  it('CP-06-03 impide nombres duplicados dentro de la misma sede (sin distinguir mayúsculas)', async () => {
    const dup = await admin.post('/admin/espacios', { sede: '1', nombre: 'sala a-101', tipo: 'SALA', capacidad: '20' });
    assert.equal(dup.estado, 422);
    assert.match(dup.html, /Ya existe un espacio con ese nombre/);
    const otraSede = await admin.post('/admin/espacios', { sede: '2', nombre: 'Sala A-101', tipo: 'SALA', capacidad: '20' });
    assert.equal(otraSede.estado, 303);
  });

  it('CP-06-04 edita un espacio existente y valida los cambios', async () => {
    const r = await admin.post(`/admin/espacios/${ids.a102}`, { nombre: 'Sala A-102 Renovada', tipo: 'SALA', capacidad: '32' });
    assert.equal(r.estado, 303);
    assert.equal(espacio(ids.a102).nombre, 'Sala A-102 Renovada');
    assert.equal(espacio(ids.a102).capacidad, 32);
    const malo = await admin.post(`/admin/espacios/${ids.a102}`, { nombre: 'Sala A-102', tipo: 'SALA', capacidad: 'muchos' });
    assert.equal(malo.estado, 422);
    assert.equal(espacio(ids.a102).capacidad, 32);
  });

  it('CP-06-05 deshabilitar un espacio con reservas vigentes se rechaza indicando cuáles', async () => {
    const r = await admin.post(`/admin/espacios/${ids.a101}/estado`, { accion: 'deshabilitar' });
    assert.equal(r.estado, 303);
    const pagina = await admin.seguir(r);
    assert.match(pagina.html, /No se puede deshabilitar/);
    assert.match(pagina.html, /CR-\d{6}/);
    assert.equal(espacio(ids.a101).habilitado, 1);
  });

  it('CP-06-06 deshabilitar un espacio sin reservas vigentes lo quita de la disponibilidad; habilitar lo repone', async () => {
    await admin.post(`/admin/espacios/${ids.a102}/estado`, { accion: 'deshabilitar' });
    assert.equal(espacio(ids.a102).habilitado, 0);
    const sin = await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}&espacio=${ids.a102}`);
    assert.match(sin.html, /No hay espacios disponibles/);
    await admin.post(`/admin/espacios/${ids.a102}/estado`, { accion: 'habilitar' });
    assert.equal(espacio(ids.a102).habilitado, 1);
  });

  it('CP-06-07 crea bloques válidos y rechaza superposiciones y configuraciones inválidas', async () => {
    const superpuesto = await admin.post(`/admin/espacios/${ids.a101}/horarios`, { dia: '1', inicio: '09:00', fin: '10:30' });
    assert.equal(superpuesto.estado, 409);
    assert.match(superpuesto.html, /se superpone con el bloque existente Lunes 08:30-10:00/);

    const invertido = await admin.post(`/admin/espacios/${ids.a101}/horarios`, { dia: '1', inicio: '18:00', fin: '17:00' });
    assert.equal(invertido.estado, 422);
    assert.match(invertido.html, /posterior a la de inicio/);

    const contiguo = await admin.post(`/admin/espacios/${ids.a101}/horarios`, { dia: '1', inicio: '22:15', fin: '23:00' });
    assert.equal(contiguo.estado, 303, 'un bloque contiguo no se considera superpuesto');
    assert.ok(e.uno("SELECT id FROM horario WHERE espacio_id = ? AND dia_semana = 1 AND hora_inicio = '22:15'", ids.a101));
  });

  it('CP-06-08 no modifica ni desactiva bloques con reservas vigentes (no afecta reservas en silencio)', async () => {
    const editar = await admin.post(`/admin/horarios/${ids.a101_1015_mar}`, { dia: '2', inicio: '10:30', fin: '12:00' });
    assert.equal(editar.estado, 409);
    assert.match(editar.html, /no cancela reservas automáticamente/);
    assert.equal(horario(ids.a101_1015_mar).hora_inicio, '10:15');

    const desactivar = await admin.post(`/admin/horarios/${ids.a101_1015_mar}/estado`, { accion: 'desactivar' });
    assert.equal(desactivar.estado, 303);
    assert.equal(horario(ids.a101_1015_mar).activo, 1);
  });

  it('CP-06-09 modifica y desactiva bloques sin reservas, validando superposición al editar', async () => {
    const choque = await admin.post(`/admin/horarios/${ids.a101_1615_jue}`, { dia: '4', inicio: '15:30', fin: '17:00' });
    assert.equal(choque.estado, 409, 'chocaría con 14:30-16:00 del jueves');

    const ok = await admin.post(`/admin/horarios/${ids.a101_1615_jue}`, { dia: '4', inicio: '16:15', fin: '18:00' });
    assert.equal(ok.estado, 303);
    assert.equal(horario(ids.a101_1615_jue).hora_fin, '18:00');

    await admin.post(`/admin/horarios/${ids.a101_1615_jue}/estado`, { accion: 'desactivar' });
    assert.equal(horario(ids.a101_1615_jue).activo, 0);
  });

  it('CP-06-10 bloquear un horario libre lo quita de la disponibilidad y quitar el bloqueo lo repone', async () => {
    const ofrece = async () =>
      new RegExp(`horario=${ids.a101_1200_mar}&amp;`).test((await diego.get(`/disponibilidad?sede=1&fecha=${FECHAS.dia1}`)).html);
    assert.equal(await ofrece(), true);

    const r = await admin.post(`/admin/espacios/${ids.a101}/bloqueos`, { horario: ids.a101_1200_mar, fecha: FECHAS.dia1, motivo: 'Evento institucional' });
    assert.equal(r.estado, 303);
    assert.equal(await ofrece(), false);
    const reservar = await diego.post('/reservas', { espacio: ids.a101, horario: ids.a101_1200_mar, fecha: FECHAS.dia1 });
    assert.equal(reservar.estado, 409);

    const bloqueo = e.uno('SELECT id FROM bloqueo WHERE horario_id = ? AND fecha = ?', ids.a101_1200_mar, FECHAS.dia1);
    await admin.post(`/admin/bloqueos/${bloqueo.id}/eliminar`);
    assert.equal(await ofrece(), true);
  });

  it('CP-06-11 rechaza bloquear un horario con reserva confirmada o una fecha que no corresponde al día', async () => {
    const conReserva = await admin.post(`/admin/espacios/${ids.a101}/bloqueos`, { horario: ids.a101_1015_mar, fecha: FECHAS.dia1, motivo: 'Prueba' });
    assert.equal(conReserva.estado, 409);
    assert.match(conReserva.html, /existe la reserva confirmada CR-\d{6}/);
    assert.equal(e.uno('SELECT COUNT(*) AS n FROM bloqueo WHERE horario_id = ?', ids.a101_1015_mar).n, 0);

    const otroDia = await admin.post(`/admin/espacios/${ids.a101}/bloqueos`, { horario: ids.a101_1200_mar, fecha: FECHAS.dia2, motivo: 'Prueba' });
    assert.equal(otroDia.estado, 422);
    assert.match(otroDia.html, /no corresponde al día del bloque \(Martes\)/);
  });

  it('CP-06-12 el registro de auditoría es visible solo para el administrador', async () => {
    const r = await admin.get('/admin/auditoria');
    assert.equal(r.estado, 200);
    assert.match(r.html, /ESPACIO_CREADO/);
    assert.match(r.html, /ACCESO_DENEGADO/);
    assert.equal((await ana.get('/admin/auditoria')).estado, 403);
  });
});
