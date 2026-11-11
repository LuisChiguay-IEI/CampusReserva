'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calcularDisponibilidad } = require('../../src/servicios/disponibilidad');
const { presentarReserva } = require('../../src/servicios/reservas');
const { describirReservas } = require('../../src/servicios/administracion');
const { codigoReserva } = require('../../src/repositorios/reservas');

describe('Cálculo de disponibilidad (RF-03)', () => {
  const espacios = [{ id: 1 }, { id: 2 }];
  const horarios = [
    { id: 10, espacio_id: 1, hora_inicio: '08:30' },
    { id: 11, espacio_id: 1, hora_inicio: '10:15' },
    { id: 12, espacio_id: 1, hora_inicio: '12:00' },
    { id: 20, espacio_id: 2, hora_inicio: '08:30' },
  ];

  it('CP-U-20 excluye bloques reservados y bloqueados', () => {
    const r = calcularDisponibilidad({
      espacios,
      horarios,
      ocupados: new Set([10]),
      bloqueados: new Set([20]),
      horaMinima: null,
    });
    assert.deepEqual(r.map((x) => [x.espacio.id, x.bloques.map((b) => b.id)]), [[1, [11, 12]]]);
  });

  it('CP-U-21 si la fecha es hoy, excluye bloques que ya comenzaron', () => {
    const r = calcularDisponibilidad({ espacios, horarios, ocupados: new Set(), bloqueados: new Set(), horaMinima: '10:15' });
    assert.deepEqual(r[0].bloques.map((b) => b.id), [12]);
    assert.equal(r.length, 1, 'el espacio 2 no tiene bloques posteriores a las 10:15');
  });

  it('CP-U-22 devuelve lista vacía cuando no hay disponibilidad', () => {
    const r = calcularDisponibilidad({
      espacios,
      horarios,
      ocupados: new Set([10, 11, 12, 20]),
      bloqueados: new Set(),
      horaMinima: null,
    });
    assert.deepEqual(r, []);
  });
});

describe('Presentación y reglas de cancelación de reservas (RF-05)', () => {
  const base = { id: 7, fecha: '2026-11-17', hora_inicio: '10:15', hora_fin: '11:45', estado: 'CONFIRMADA' };

  it('CP-U-23 una reserva futura confirmada es próxima y cancelable', () => {
    const r = presentarReserva(base, { fecha: '2026-11-16', hora: '10:00' });
    assert.equal(r.codigo, 'CR-000007');
    assert.equal(r.estadoVisible, 'Confirmada');
    assert.equal(r.esProxima, true);
    assert.equal(r.cancelable, true);
  });

  it('CP-U-24 se cancela hasta 60 minutos antes; en curso no es cancelable y terminada pasa al historial', () => {
    assert.equal(presentarReserva(base, { fecha: '2026-11-17', hora: '09:15' }).cancelable, true, 'faltan 60 minutos');
    const faltan45 = presentarReserva(base, { fecha: '2026-11-17', hora: '09:30' });
    assert.equal(faltan45.estadoVisible, 'Confirmada');
    assert.equal(faltan45.cancelable, false, 'faltan 45 minutos');
    const enCurso = presentarReserva(base, { fecha: '2026-11-17', hora: '10:30' });
    assert.equal(enCurso.estadoVisible, 'En curso');
    assert.equal(enCurso.cancelable, false);
    const terminada = presentarReserva(base, { fecha: '2026-11-17', hora: '12:00' });
    assert.equal(terminada.estadoVisible, 'Finalizada');
    assert.equal(terminada.esProxima, false);
  });

  it('CP-U-25 una reserva cancelada no es cancelable ni próxima', () => {
    const r = presentarReserva({ ...base, estado: 'CANCELADA' }, { fecha: '2026-11-16', hora: '10:00' });
    assert.equal(r.estadoVisible, 'Cancelada');
    assert.equal(r.cancelable, false);
    assert.equal(r.esProxima, false);
  });

  it('CP-U-26 describe reservas afectadas con código y fecha, resumiendo sobre 5', () => {
    const lista = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, fecha: '2026-11-17', hora_inicio: '08:30' }));
    const texto = describirReservas(lista);
    assert.match(texto, /^CR-000001 \(Martes 17-11-2026 08:30\)/);
    assert.match(texto, /y 2 más$/);
    assert.equal(codigoReserva(123456), 'CR-123456');
  });
});
