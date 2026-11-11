/**
 * Medición de rendimiento y concurrencia (RNF de rendimiento y revalidación del ADR-001).
 *
 * Procedimiento:
 *  1. Crea una base temporal con los datos de demostración y 50 cuentas ficticias de docente
 *     (las salas de clases solo las reservan docentes y administración).
 *  2. Levanta N procesos del servidor (por defecto 4) que comparten el mismo archivo SQLite,
 *     como lo harían varias instancias detrás de un balanceador.
 *  3. Inicia sesión con los 50 usuarios (mide la latencia del login con scrypt).
 *  4. Escenario A: 200 consultas de disponibilidad con 20 solicitudes concurrentes.
 *  5. Escenario B: 5 rondas; en cada una los 50 usuarios envían AL MISMO TIEMPO la confirmación
 *     de reserva del mismo bloque y fecha. Se mide latencia y se verifica en la base que exista
 *     una sola reserva confirmada por bloque (0 duplicados).
 *  6. Guarda los resultados en docs/evidencias/metricas (JSON y Markdown) con el entorno de medición.
 *
 * Uso: npm run metricas      (variables opcionales: CARGA_PROCESOS, CARGA_USUARIOS, CARGA_RONDAS)
 * Importante: mide un entorno local (cliente y servidores en el mismo equipo); no representa producción.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const { cargarConfig } = require('../src/config');
const { abrirBaseDatos, aplicarEsquema } = require('../src/db/conexion');
const { sembrar, siguienteDiaHabil } = require('../src/db/seed');
const { hashContrasena, tokenAleatorio } = require('../src/lib/seguridad');
const { fechaHoraEnZona } = require('../src/lib/fechas');
const { Cliente } = require('../test/ayudante');

const PROCESOS = Number(process.env.CARGA_PROCESOS || 4);
const USUARIOS = Number(process.env.CARGA_USUARIOS || 50);
const RONDAS = Number(process.env.CARGA_RONDAS || 5);
const CONSULTAS = 200;
const CONCURRENCIA_CONSULTAS = 20;
const PUERTO_BASE = Number(process.env.CARGA_PUERTO || 3400);
const CONTRASENA = 'CargaClave2026';
const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'docs', 'evidencias', 'metricas');

/** Percentil por rango más cercano. */
function percentil(valores, p) {
  const orden = [...valores].sort((a, b) => a - b);
  const indice = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[indice];
}

function resumen(latencias) {
  const redondear = (n) => Math.round(n * 10) / 10;
  const suma = latencias.reduce((a, b) => a + b, 0);
  return {
    n: latencias.length,
    promedio_ms: redondear(suma / latencias.length),
    p50_ms: redondear(percentil(latencias, 50)),
    p95_ms: redondear(percentil(latencias, 95)),
    max_ms: redondear(Math.max(...latencias)),
  };
}

async function medir(fn) {
  const inicio = performance.now();
  const resultado = await fn();
  return { resultado, ms: performance.now() - inicio };
}

async function esperarServidor(url, intentos = 100) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const r = await fetch(`${url}/login`);
      if (r.ok) return;
    } catch {
      // aún no escucha
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`El servidor ${url} no respondió a tiempo`);
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusreserva-carga-'));
  const rutaBaseDatos = path.join(dir, 'carga.db');
  const secreto = tokenAleatorio(32);
  const envBase = {
    NODE_ENV: 'development',
    DB_PATH: rutaBaseDatos,
    SEED_DEMO: 'false',
    DEMO_MAILBOX: 'false',
    LOGIN_MAX_INTENTOS: '100000',
    SESSION_SECRET: secreto,
  };

  // 1. Base de datos con datos de demostración + usuarios de carga.
  const config = cargarConfig({ ...envBase });
  const db = abrirBaseDatos(rutaBaseDatos);
  aplicarEsquema(db);
  await sembrar(db, config);
  const hash = await hashContrasena(CONTRASENA);
  const ahoraIso = new Date().toISOString();
  const correos = [];
  for (let i = 1; i <= USUARIOS; i += 1) {
    const correo = `carga.${String(i).padStart(3, '0')}@${config.dominioInstitucional}`;
    db.prepare(
      `INSERT INTO usuario (nombre, correo, password_hash, rol, estado, creado_en, confirmado_en)
       VALUES (?, ?, ?, 'DOCENTE', 'ACTIVA', ?, ?)`,
    ).run(`Usuario Carga ${i}`, correo, hash, ahoraIso, ahoraIso);
    correos.push(correo);
  }
  const sqlite = db.prepare('SELECT sqlite_version() AS v').get().v;
  const sedeMaipu = db.prepare("SELECT id FROM sede WHERE nombre = 'Sede Maipú'").get().id;
  const espacio = db.prepare("SELECT id FROM espacio WHERE nombre = 'Sala A-102'").get();
  db.close();

  // 2. Servidores.
  const servidores = [];
  for (let i = 0; i < PROCESOS; i += 1) {
    const puerto = PUERTO_BASE + i;
    const hijo = fork(path.join(RAIZ, 'src', 'server.js'), [], {
      env: { ...process.env, ...envBase, PORT: String(puerto), BASE_URL: `http://127.0.0.1:${puerto}` },
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    servidores.push({ hijo, url: `http://127.0.0.1:${puerto}` });
  }
  try {
    await Promise.all(servidores.map((s) => esperarServidor(s.url)));
    console.log(`${PROCESOS} procesos de servidor listos.`);

    // 3. Inicio de sesión de los usuarios (repartidos entre servidores).
    const clientes = correos.map((_, i) => new Cliente(servidores[i % PROCESOS].url));
    const login = await Promise.all(
      clientes.map((c, i) => medir(() => c.iniciarSesion(correos[i], CONTRASENA))),
    );
    const loginFallidos = login.filter((l) => l.resultado.estado !== 303).length;
    console.log(`Logins: ${USUARIOS - loginFallidos}/${USUARIOS} correctos.`);

    // Fechas hábiles futuras para los escenarios.
    const hoy = fechaHoraEnZona(new Date(), config.zonaHoraria).fecha;
    const fechas = [];
    let f = hoy;
    for (let i = 0; i < Math.max(RONDAS, 5); i += 1) {
      f = siguienteDiaHabil(f);
      fechas.push(f);
    }

    // 4. Escenario A: consultas de disponibilidad.
    const latConsultas = [];
    let erroresConsulta = 0;
    let siguiente = 0;
    const trabajador = async (indice) => {
      while (siguiente < CONSULTAS) {
        siguiente += 1;
        const c = clientes[(indice + siguiente) % clientes.length];
        const fecha = fechas[siguiente % fechas.length];
        const { resultado, ms } = await medir(() => c.get(`/disponibilidad?sede=${sedeMaipu}&fecha=${fecha}`));
        latConsultas.push(ms);
        if (resultado.estado !== 200) erroresConsulta += 1;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCIA_CONSULTAS }, (_, i) => trabajador(i)));
    console.log(`Consultas: ${latConsultas.length} realizadas, ${erroresConsulta} con error.`);

    // 5. Escenario B: reservas simultáneas sobre el mismo bloque.
    const rondas = [];
    const verificacion = abrirBaseDatos(rutaBaseDatos);
    for (let r = 0; r < RONDAS; r += 1) {
      const fecha = fechas[r];
      const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay() || 7;
      const horario = verificacion
        .prepare("SELECT id FROM horario WHERE espacio_id = ? AND dia_semana = ? AND hora_inicio = '16:15'")
        .get(espacio.id, dia);
      // Cada cliente necesita un token CSRF vigente: la página de revisión se lo entrega.
      await Promise.all(
        clientes.map((c) => c.get(`/reservas/nueva?espacio=${espacio.id}&horario=${horario.id}&fecha=${fecha}&sede=${sedeMaipu}`)),
      );
      const intentos = await Promise.all(
        clientes.map((c) => medir(() => c.post('/reservas', { espacio: espacio.id, horario: horario.id, fecha }))),
      );
      const confirmadasHttp = intentos.filter((i) => i.resultado.estado === 303).length;
      const conflictos = intentos.filter((i) => i.resultado.estado === 409).length;
      const erroresTecnicos = intentos.length - confirmadasHttp - conflictos;
      const enBase = verificacion
        .prepare("SELECT COUNT(*) AS n FROM reserva WHERE horario_id = ? AND fecha = ? AND estado = 'CONFIRMADA'")
        .get(horario.id, fecha).n;
      rondas.push({
        ronda: r + 1,
        fecha,
        bloque: '16:15-17:45',
        solicitudes: intentos.length,
        confirmadas_http: confirmadasHttp,
        conflictos_409: conflictos,
        errores_tecnicos: erroresTecnicos,
        confirmadas_en_base: Number(enBase),
        duplicados: Math.max(0, Number(enBase) - 1),
        latencia: resumen(intentos.map((i) => i.ms)),
        latencias_ms: intentos.map((i) => Math.round(i.ms * 10) / 10),
      });
      console.log(`Ronda ${r + 1}: ${confirmadasHttp} confirmada, ${conflictos} conflictos, ${erroresTecnicos} errores, en base=${enBase}`);
    }
    verificacion.close();

    // 6. Resultados.
    const todasReservas = rondas.flatMap((r) => r.latencias_ms);
    const totalSolicitudes = rondas.reduce((s, r) => s + r.solicitudes, 0);
    const totalErrores = rondas.reduce((s, r) => s + r.errores_tecnicos, 0);
    const resultados = {
      fecha_medicion: new Date().toISOString(),
      entorno: {
        sistema: `${os.type()} ${os.release()} (${os.arch()})`,
        cpu: os.cpus()[0].model.trim(),
        nucleos_logicos: os.cpus().length,
        memoria_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
        node: process.version,
        sqlite,
        procesos_servidor: PROCESOS,
        red: 'localhost (cliente y servidores en el mismo equipo)',
      },
      parametros: { usuarios: USUARIOS, rondas: RONDAS, consultas: CONSULTAS, concurrencia_consultas: CONCURRENCIA_CONSULTAS },
      login: { ...resumen(login.map((l) => l.ms)), fallidos: loginFallidos },
      consulta_disponibilidad: { ...resumen(latConsultas), errores: erroresConsulta, tasa_error_pct: (erroresConsulta / latConsultas.length) * 100 },
      reserva_concurrente: {
        ...resumen(todasReservas),
        solicitudes: totalSolicitudes,
        duplicados_totales: rondas.reduce((s, r) => s + r.duplicados, 0),
        errores_tecnicos: totalErrores,
        tasa_error_tecnico_pct: (totalErrores / totalSolicitudes) * 100,
        rondas,
      },
      umbrales_adr001: { duplicados: 0, p95_ms_max: 800, tasa_error_tecnico_pct_max: 1 },
    };

    const sello = resultados.fecha_medicion.slice(0, 19).replace(/[:T]/g, '-');
    fs.writeFileSync(path.join(DESTINO, `metricas-${sello}.json`), JSON.stringify(resultados, null, 2));
    fs.writeFileSync(path.join(DESTINO, 'metricas-ultima.json'), JSON.stringify(resultados, null, 2));
    fs.writeFileSync(path.join(DESTINO, 'metricas-ultima.md'), aMarkdown(resultados));
    console.log(aMarkdown(resultados));
  } finally {
    for (const s of servidores) s.hijo.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function aMarkdown(r) {
  const rc = r.reserva_concurrente;
  const cumple = (ok) => (ok ? 'Cumple' : 'No cumple');
  const filas = rc.rondas
    .map((x) => `| ${x.ronda} | ${x.fecha} | ${x.solicitudes} | ${x.confirmadas_http} | ${x.conflictos_409} | ${x.errores_tecnicos} | ${x.confirmadas_en_base} | ${x.latencia.p50_ms} | ${x.latencia.p95_ms} | ${x.latencia.max_ms} |`)
    .join('\n');
  return `# Métricas de rendimiento y concurrencia — CampusReserva

Fecha de medición (UTC): ${r.fecha_medicion}

## Entorno
- Sistema: ${r.entorno.sistema}
- CPU: ${r.entorno.cpu} (${r.entorno.nucleos_logicos} núcleos lógicos), RAM ${r.entorno.memoria_gb} GB
- Node.js ${r.entorno.node}, SQLite ${r.entorno.sqlite}
- ${r.entorno.procesos_servidor} procesos de servidor compartiendo el mismo archivo SQLite (WAL)
- Red: ${r.entorno.red}. **No representa un entorno de producción.**

## Procedimiento
\`npm run metricas\` (scripts/carga-concurrente.js): ${r.parametros.usuarios} usuarios ficticios autenticados;
${r.parametros.consultas} consultas de disponibilidad con ${r.parametros.concurrencia_consultas} concurrentes;
${r.parametros.rondas} rondas en que los ${r.parametros.usuarios} usuarios confirman simultáneamente el mismo bloque.
Latencia medida en el cliente (performance.now) desde el envío hasta recibir la respuesta completa.

## Resumen
| Operación | n | Promedio (ms) | p50 (ms) | p95 (ms) | Máx. (ms) | Errores |
|---|---|---|---|---|---|---|
| Inicio de sesión (scrypt N=2^17) | ${r.login.n} | ${r.login.promedio_ms} | ${r.login.p50_ms} | ${r.login.p95_ms} | ${r.login.max_ms} | ${r.login.fallidos} |
| Consulta de disponibilidad | ${r.consulta_disponibilidad.n} | ${r.consulta_disponibilidad.promedio_ms} | ${r.consulta_disponibilidad.p50_ms} | ${r.consulta_disponibilidad.p95_ms} | ${r.consulta_disponibilidad.max_ms} | ${r.consulta_disponibilidad.errores} (${r.consulta_disponibilidad.tasa_error_pct.toFixed(2)} %) |
| Confirmación de reserva concurrente | ${rc.n} | ${rc.promedio_ms} | ${rc.p50_ms} | ${rc.p95_ms} | ${rc.max_ms} | ${rc.errores_tecnicos} (${rc.tasa_error_tecnico_pct.toFixed(2)} %) |

## Revalidación del ADR-001 (umbrales del Spike)
| Criterio | Umbral | Resultado | Estado |
|---|---|---|---|
| Reservas duplicadas | 0 | ${rc.duplicados_totales} | ${cumple(rc.duplicados_totales === 0)} |
| p95 confirmación con ${r.parametros.usuarios} concurrentes | ≤ 800 ms | ${rc.p95_ms} ms | ${cumple(rc.p95_ms <= 800)} |
| Errores técnicos inesperados | < 1 % | ${rc.tasa_error_tecnico_pct.toFixed(2)} % | ${cumple(rc.tasa_error_tecnico_pct < 1)} |

## Detalle por ronda
| Ronda | Fecha | Solicitudes | Confirmadas (HTTP 303) | Conflictos (HTTP 409) | Errores técnicos | Confirmadas en base | p50 (ms) | p95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|---|---|---|---|
${filas}
`;
}

main().catch((error) => {
  console.error('La medición falló:', error);
  process.exit(1);
});
