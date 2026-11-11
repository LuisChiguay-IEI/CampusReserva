'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../src/lib/validaciones');

const OPC = { dominioInstitucional: 'campus.test' };
const registroValido = {
  nombre: 'Camila Estudiante Demo',
  correo: 'Camila.Estudiante@Campus.test ',
  contrasena: 'una frase segura 2026',
  confirmacion: 'una frase segura 2026',
};

describe('Validación de registro (RF-01)', () => {
  it('CP-U-01 acepta datos válidos y normaliza el correo a minúsculas', () => {
    const r = v.validarRegistro(registroValido, OPC);
    assert.equal(r.ok, true);
    assert.equal(r.datos.correo, 'camila.estudiante@campus.test');
    assert.equal(r.datos.nombre, 'Camila Estudiante Demo');
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

  it('CP-U-04 exige contraseña de 15 a 128 caracteres (HU-01) y confirmación coincidente', () => {
    assert.ok(v.validarRegistro({ ...registroValido, contrasena: 'corta', confirmacion: 'corta' }, OPC).errores.contrasena);
    assert.ok(v.validarRegistro({ ...registroValido, contrasena: 'x'.repeat(129), confirmacion: 'x'.repeat(129) }, OPC).errores.contrasena);
    assert.ok(v.validarRegistro({ ...registroValido, confirmacion: 'otra frase distinta' }, OPC).errores.confirmacion);
  });

  it('CP-U-05 rechaza una contraseña igual al correo', () => {
    const correo = 'camila.estudiante@campus.test';
    const r = v.validarRegistro({ ...registroValido, correo, contrasena: correo, confirmacion: correo }, OPC);
    assert.ok(r.errores.contrasena);
  });

  it('CP-U-27 rechaza contraseñas comunes o predecibles y permite frases con espacios (HU-01)', () => {
    for (const comun of ['123456789012345', 'Password 1234567', 'aaaaaaaaaaaaaaaa', 'Contraseña Segura', '999999999999999999']) {
      const r = v.validarRegistro({ ...registroValido, contrasena: comun, confirmacion: comun }, OPC);
      assert.match(r.errores.contrasena || '', /común o predecible/, comun);
    }
    const frase = 'mi sala favorita es la 101';
    assert.equal(v.validarRegistro({ ...registroValido, contrasena: frase, confirmacion: frase }, OPC).ok, true);
    assert.equal(v.esContrasenaComun(frase), false);
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
