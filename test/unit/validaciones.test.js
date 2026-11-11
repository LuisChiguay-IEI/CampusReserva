'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../src/lib/validaciones');

const OPC = { dominioInstitucional: 'campus.test' };
const registroValido = {
  nombre: 'Camila Torres Vega',
  correo: 'Camila.Estudiante@Campus.test ',
  contrasena: 'SalaEstudio26',
  confirmacion: 'SalaEstudio26',
};

describe('Validación de registro (RF-01)', () => {
  it('CP-U-01 acepta datos válidos y normaliza el correo a minúsculas', () => {
    const r = v.validarRegistro(registroValido, OPC);
    assert.equal(r.ok, true);
    assert.equal(r.datos.correo, 'camila.estudiante@campus.test');
    assert.equal(r.datos.nombre, 'Camila Torres Vega');
  });

  it('CP-U-02 rechaza correos de un dominio no institucional', () => {
    const r = v.validarRegistro({ ...registroValido, correo: 'camila@gmail.com' }, OPC);
    assert.equal(r.ok, false);
    assert.match(r.errores.correo, /institucional/);
  });

  it('CP-U-03 rechaza correo con formato inválido y nombre con caracteres no permitidos', () => {
    const r = v.validarRegistro({ ...registroValido, correo: 'no-es-correo', nombre: '<script>' }, OPC);
    assert.equal(r.ok, false);
    assert.ok(r.errores.correo);
    assert.ok(r.errores.nombre);
  });

  it('CP-U-04 exige contraseña de 8 a 64 caracteres con letra y número, sin espacios, y confirmación coincidente', () => {
    const error = (contrasena) => v.validarRegistro({ ...registroValido, contrasena, confirmacion: contrasena }, OPC).errores.contrasena;
    assert.match(error('Corta12'), /entre 8 y 64/);
    assert.match(error(`a1${'x'.repeat(63)}`), /entre 8 y 64/);
    assert.match(error('Sala Estudio 26'), /espacios/);
    assert.match(error('SoloLetrasAqui'), /una letra y un número/);
    assert.match(error('2026202620'), /una letra y un número/);
    assert.equal(error('Clave2026'), undefined, '8 a 64 con letra y número es válida');
    assert.ok(v.validarRegistro({ ...registroValido, confirmacion: 'OtraClave99' }, OPC).errores.confirmacion);
  });

  it('CP-U-05 rechaza una contraseña igual al correo', () => {
    const correo = 'camila.estudiante@campus.test';
    const r = v.validarRegistro({ ...registroValido, correo, contrasena: correo, confirmacion: correo }, OPC);
    assert.ok(r.errores.contrasena);
  });

  it('CP-U-27 rechaza contraseñas comunes aunque cumplan el largo y tengan letra y número (D-15)', () => {
    for (const comun of ['Password123', 'abc12345', 'Qwerty123', 'Admin1234', 'Campus2026']) {
      const r = v.validarRegistro({ ...registroValido, contrasena: comun, confirmacion: comun }, OPC);
      assert.match(r.errores.contrasena || '', /demasiado común/, comun);
    }
    assert.equal(v.esContrasenaComun('aaaaaaaa'), true, 'un solo carácter repetido');
    assert.equal(v.esContrasenaComun('SalaEstudio26'), false);
  });

  it('CP-U-06 ignora entradas que no son texto (p. ej. arreglos) sin lanzar excepciones', () => {
    const r = v.validarRegistro({ nombre: ['a'], correo: { $ne: '' }, contrasena: 123 }, OPC);
    assert.equal(r.ok, false);
  });
});

describe('Validación de consulta de disponibilidad (RF-03)', () => {
  const opciones = { hoy: '2026-11-16', maxDiasAnticipacion: 30 };

  it('CP-U-07 acepta sede y fecha válidas; el espacio es opcional', () => {
    const r = v.validarConsulta({ sede: '1', fecha: '2026-11-20' }, opciones);
    assert.deepEqual(r, { ok: true, errores: {}, datos: { sedeId: 1, fecha: '2026-11-20', espacioId: null } });
  });

  it('CP-U-08 rechaza fechas pasadas, inexistentes o fuera de la ventana de 30 días', () => {
    assert.ok(v.validarConsulta({ sede: '1', fecha: '2026-11-15' }, opciones).errores.fecha);
    assert.ok(v.validarConsulta({ sede: '1', fecha: '2026-02-30' }, opciones).errores.fecha);
    assert.ok(v.validarConsulta({ sede: '1', fecha: '2026-12-17' }, opciones).errores.fecha);
    assert.equal(v.validarConsulta({ sede: '1', fecha: '2026-12-16' }, opciones).ok, true);
  });

  it('CP-U-09 rechaza identificadores no numéricos (intento de inyección)', () => {
    const r = v.validarConsulta({ sede: "1 OR 1=1", fecha: '2026-11-20', espacio: '2;DROP TABLE reserva' }, opciones);
    assert.ok(r.errores.sede);
    assert.ok(r.errores.espacio);
  });
});

describe('Validación de espacios y horarios (RF-06)', () => {
  it('CP-U-10 valida sede, nombre, tipo y capacidad de un espacio', () => {
    assert.equal(v.validarEspacio({ sede: '1', nombre: 'Sala Z-10', tipo: 'sala', capacidad: '25' }).ok, true);
    const r = v.validarEspacio({ sede: '', nombre: 'A', tipo: 'AUDITORIO', capacidad: '0' });
    assert.deepEqual(Object.keys(r.errores).sort(), ['capacidad', 'nombre', 'sede', 'tipo']);
    assert.ok(v.validarEspacio({ sede: '1', nombre: 'Sala', tipo: 'SALA', capacidad: '201' }).errores.capacidad);
  });

  it('CP-U-11 valida día, formato de hora, orden, rango 07:00–23:00 y duración 30–240 min', () => {
    assert.equal(v.validarHorario({ dia: '1', inicio: '08:30', fin: '10:00' }).ok, true);
    assert.ok(v.validarHorario({ dia: '8', inicio: '08:30', fin: '10:00' }).errores.dia);
    assert.ok(v.validarHorario({ dia: '1', inicio: '8:30', fin: '10:00' }).errores.inicio);
    assert.ok(v.validarHorario({ dia: '1', inicio: '10:00', fin: '09:00' }).errores.fin);
    assert.ok(v.validarHorario({ dia: '1', inicio: '06:00', fin: '07:30' }).errores.inicio);
    assert.ok(v.validarHorario({ dia: '1', inicio: '10:00', fin: '10:15' }).errores.fin);
    assert.ok(v.validarHorario({ dia: '1', inicio: '08:00', fin: '13:00' }).errores.fin);
  });

  it('CP-U-12 valida bloqueos: horario, fecha no pasada y motivo', () => {
    assert.equal(v.validarBloqueo({ horario: '3', fecha: '2026-11-17', motivo: 'Mantención' }, { hoy: '2026-11-16' }).ok, true);
    const r = v.validarBloqueo({ horario: 'x', fecha: '2026-11-01', motivo: '' }, { hoy: '2026-11-16' });
    assert.deepEqual(Object.keys(r.errores).sort(), ['fecha', 'horario', 'motivo']);
  });
});
