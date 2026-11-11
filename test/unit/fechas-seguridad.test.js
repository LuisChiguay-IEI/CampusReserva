'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const f = require('../../src/lib/fechas');
const s = require('../../src/lib/seguridad');

describe('Utilidades de fecha', () => {
  it('CP-U-13 calcula fecha y hora en America/Santiago', () => {
    assert.deepEqual(f.fechaHoraEnZona(new Date('2026-11-16T13:00:00Z'), 'America/Santiago'), {
      fecha: '2026-11-16',
      hora: '10:00',
    });
    // Cerca de medianoche UTC sigue siendo el día anterior en Chile.
    assert.equal(f.fechaHoraEnZona(new Date('2026-11-17T02:30:00Z'), 'America/Santiago').fecha, '2026-11-16');
  });

  it('CP-U-14 obtiene el día ISO de la semana y suma días', () => {
    assert.equal(f.diaSemana('2026-11-16'), 1); // lunes
    assert.equal(f.diaSemana('2026-11-22'), 7); // domingo
    assert.equal(f.sumarDias('2026-11-30', 1), '2026-12-01');
    assert.equal(f.sumarDias('2026-01-01', -1), '2025-12-31');
  });

  it('CP-U-15 detecta superposición de intervalos (los contiguos no se superponen)', () => {
    assert.equal(f.haySuperposicion({ inicio: '08:30', fin: '10:00' }, { inicio: '09:00', fin: '09:30' }), true);
    assert.equal(f.haySuperposicion({ inicio: '08:30', fin: '10:00' }, { inicio: '09:59', fin: '11:00' }), true);
    assert.equal(f.haySuperposicion({ inicio: '08:30', fin: '10:00' }, { inicio: '10:00', fin: '11:00' }), false);
    assert.equal(f.haySuperposicion({ inicio: '12:00', fin: '13:00' }, { inicio: '08:00', fin: '12:00' }), false);
  });

  it('CP-U-16 valida fechas y horas reales', () => {
    assert.equal(f.esFechaValida('2028-02-29'), true);
    assert.equal(f.esFechaValida('2026-02-29'), false);
    assert.equal(f.esHoraValida('23:59'), true);
    assert.equal(f.esHoraValida('24:00'), false);
    assert.equal(f.formatearFecha('2026-11-16'), 'Lunes 16-11-2026');
  });
});

describe('Primitivas de seguridad', () => {
  it('CP-U-17 el hash de contraseña usa scrypt con sal y no contiene la contraseña', async () => {
    const hash = await s.hashContrasena('una frase segura 2026');
    assert.match(hash, /^scrypt\$131072\$8\$1\$/);
    assert.ok(!hash.includes('una frase segura'));
    const otro = await s.hashContrasena('una frase segura 2026');
    assert.notEqual(hash, otro, 'la sal aleatoria debe producir hashes distintos');
  });

  it('CP-U-18 verifica la contraseña correcta y rechaza la incorrecta o un hash corrupto', async () => {
    const hash = await s.hashContrasena('una frase segura 2026');
    assert.equal(await s.verificarContrasena('una frase segura 2026', hash), true);
    assert.equal(await s.verificarContrasena('otra frase', hash), false);
    assert.equal(await s.verificarContrasena('x', 'texto-plano'), false);
    assert.equal(await s.verificarContrasena('x', 'scrypt$3$8$1$AAAA$BBBB'), false);
  });

  it('CP-U-19 genera tokens aleatorios de 256 bits y compara en tiempo constante', () => {
    const a = s.tokenAleatorio(32);
    assert.equal(a.length, 43);
    assert.notEqual(a, s.tokenAleatorio(32));
    assert.equal(s.sha256('abc').length, 64);
    assert.equal(s.compararSeguro('abc', 'abc'), true);
    assert.equal(s.compararSeguro('abc', 'abd'), false);
    assert.equal(s.compararSeguro('abc', 'abcd'), false);
  });
});
