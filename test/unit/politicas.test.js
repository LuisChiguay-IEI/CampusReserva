'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../src/lib/politicas');
const { minutosHasta } = require('../../src/lib/fechas');

const CONFIG = { maxDiasAnticipacion: 30, maxDiasAnticipacionEstudiante: 7, maxReservasVigentesEstudiante: 2 };

describe('Políticas de reserva por rol', () => {
  it('CP-U-31 el estudiante solo reserva salas de estudio; docente y administración reservan todo', () => {
    assert.deepEqual(p.tiposReservables('ESTUDIANTE'), ['SALA_ESTUDIO']);
    assert.deepEqual(p.tiposReservables('DOCENTE'), ['SALA', 'LABORATORIO', 'SALA_ESTUDIO']);
    assert.deepEqual(p.tiposReservables('ADMINISTRADOR'), ['SALA', 'LABORATORIO', 'SALA_ESTUDIO']);
    assert.deepEqual(p.tiposReservables('DESCONOCIDO'), []);
    assert.equal(p.puedeReservarTipo('ESTUDIANTE', 'SALA'), false);
    assert.equal(p.puedeReservarTipo('ESTUDIANTE', 'LABORATORIO'), false);
    assert.equal(p.puedeReservarTipo('ESTUDIANTE', 'SALA_ESTUDIO'), true);
    assert.equal(p.puedeReservarTipo('DOCENTE', 'LABORATORIO'), true);
    assert.equal(p.NOMBRES_TIPO.SALA_ESTUDIO, 'Sala de estudio');
  });

  it('CP-U-32 anticipación y límite de reservas vigentes dependen del rol', () => {
    assert.equal(p.diasAnticipacion('ESTUDIANTE', CONFIG), 7);
    assert.equal(p.diasAnticipacion('DOCENTE', CONFIG), 30);
    assert.equal(p.diasAnticipacion('ADMINISTRADOR', CONFIG), 30);
    assert.equal(p.limiteReservasVigentes('ESTUDIANTE', CONFIG), 2);
    assert.equal(p.limiteReservasVigentes('DOCENTE', CONFIG), null);
  });

  it('CP-U-33 calcula los minutos hasta el inicio, también entre días, para la regla de cancelación', () => {
    assert.equal(minutosHasta('2026-11-17', '10:15', { fecha: '2026-11-17', hora: '09:15' }), 60);
    assert.equal(minutosHasta('2026-11-17', '08:30', { fecha: '2026-11-16', hora: '23:30' }), 540);
    assert.equal(minutosHasta('2026-11-17', '08:30', { fecha: '2026-11-17', hora: '09:00' }), -30);
    const reserva = { estado: 'CONFIRMADA', fecha: '2026-11-17', hora_inicio: '10:15' };
    assert.equal(p.esCancelable(reserva, { fecha: '2026-11-17', hora: '09:15' }, 60), true);
    assert.equal(p.esCancelable(reserva, { fecha: '2026-11-17', hora: '09:16' }, 60), false);
    assert.equal(p.esCancelable({ ...reserva, estado: 'CANCELADA' }, { fecha: '2026-11-16', hora: '10:00' }, 60), false);
  });
});
