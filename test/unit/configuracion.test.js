'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cargarConfig } = require('../../src/config');

describe('Configuración por entorno (despliegue PaaS)', () => {
  it('CP-U-29 la URL pública usa BASE_URL, luego RENDER_EXTERNAL_URL y por último localhost', () => {
    assert.equal(cargarConfig({ PORT: '4000' }).urlBase, 'http://localhost:4000');
    assert.equal(
      cargarConfig({ RENDER_EXTERNAL_URL: 'https://campusreserva.onrender.com' }).urlBase,
      'https://campusreserva.onrender.com',
    );
    // BASE_URL explícita tiene prioridad y se quita la barra final.
    assert.equal(
      cargarConfig({ BASE_URL: 'https://reservas.campus.test/', RENDER_EXTERNAL_URL: 'https://x.onrender.com' }).urlBase,
      'https://reservas.campus.test',
    );
  });

  it('CP-U-30 en producción exige SESSION_SECRET y solo activa la demo si se pide explícitamente', () => {
    assert.throws(() => cargarConfig({ NODE_ENV: 'production' }), /SESSION_SECRET es obligatorio/);
    assert.throws(
      () => cargarConfig({ NODE_ENV: 'production', SESSION_SECRET: 'reemplazar-por-un-secreto' }),
      /SESSION_SECRET es obligatorio/,
    );

    const base = { NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(64) };
    const porDefecto = cargarConfig(base);
    assert.equal(porDefecto.esProduccion, true);
    assert.equal(porDefecto.buzonDemo, false);
    assert.equal(porDefecto.seedDemo, false);
    assert.equal(porDefecto.confiarEnProxy, false);

    const demoPublica = cargarConfig({ ...base, DEMO_MAILBOX: 'true', SEED_DEMO: 'true', TRUST_PROXY: 'true' });
    assert.equal(demoPublica.buzonDemo, true);
    assert.equal(demoPublica.seedDemo, true);
    assert.equal(demoPublica.confiarEnProxy, true);
    assert.equal(Object.isFrozen(demoPublica), true);
  });
});
