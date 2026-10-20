import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/`.
// Si la tabla `transacciones` no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query("SELECT to_regclass('public.transacciones') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const PASSWORD = 'clave-segura-1';
const TEST_DOMAIN = '@reports-test.fintrack.test';
const EXPORT_OCT = '/reports/export?format=csv&from=2026-10-01&to=2026-10-31';

// Borra los usuarios de prueba; sus movimientos caen por ON DELETE CASCADE.
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre y ejecuta `fn` con un cliente de la API.
 * A diferencia de otras pruebas, devuelve también los encabezados y el texto crudo (es un archivo).
 * @param {(api: Function) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const isJson = res.headers.get('content-type')?.includes('application/json');
    return { status: res.status, headers: res.headers, text, body: isJson && text ? JSON.parse(text) : null };
  };
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

/**
 * Crea un usuario nuevo y devuelve su access token.
 * @param {Function} api
 * @returns {Promise<string>}
 */
async function newUser(api) {
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { email: `u-${randomUUID()}${TEST_DOMAIN}`, password: PASSWORD },
  });
  return body.accessToken;
}

/**
 * Registra un movimiento con categoría elegida (sin pasar por la IA).
 * @returns {Promise<string>} Id del movimiento.
 */
async function addTransaction(api, token, data) {
  const res = await api('/transactions', { method: 'POST', token, body: data });
  assert.equal(res.status, 201, `no se pudo crear el movimiento: ${res.text}`);
  return res.body.transaction.id;
}

test('exporta los movimientos del periodo como CSV descargable, en orden cronológico', options, async () => {
  await withApi(async (api) => {
    const token = await newUser(api);
    await addTransaction(api, token, { type: 'gasto', amount: 18000, description: 'Almuerzo; con postre', category: 'alimentacion', date: '2026-10-17' });
    await addTransaction(api, token, { type: 'ingreso', amount: 350000.5, description: 'Pago monitoría', category: 'salario', date: '2026-10-02' });
    await addTransaction(api, token, { type: 'gasto', amount: 5000, description: 'Fuera del rango', category: 'transporte', date: '2026-11-01' });

    const res = await api(EXPORT_OCT, { token });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="fintrack_2026-10.csv"');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(res.text.replace(/^﻿/, '').split('\r\n'), [
      'Fecha;Tipo;Categoría;Descripción;Monto;Origen',
      '2026-10-02;Ingreso;Salario;Pago monitoría;350000,50;Manual',
      '2026-10-17;Gasto;Alimentación;"Almuerzo; con postre";18000;Manual',
      '',
    ]);
  });
});

test('no incluye movimientos eliminados ni de otros usuarios', options, async () => {
  await withApi(async (api) => {
    const token = await newUser(api);
    const other = await newUser(api);
    await addTransaction(api, token, { type: 'gasto', amount: 1000, description: 'Mío', category: 'otros', date: '2026-10-05' });
    const removed = await addTransaction(api, token, { type: 'gasto', amount: 2000, description: 'Borrado', category: 'otros', date: '2026-10-06' });
    await api(`/transactions/${removed}`, { method: 'DELETE', token });
    await addTransaction(api, other, { type: 'gasto', amount: 3000, description: 'De otro', category: 'otros', date: '2026-10-07' });

    const { text } = await api(EXPORT_OCT, { token });
    assert.match(text, /Mío/);
    assert.doesNotMatch(text, /Borrado/);
    assert.doesNotMatch(text, /De otro/);
  });
});

test('responde 422 NO_DATA si no hay movimientos en el periodo (REQ-033)', options, async () => {
  await withApi(async (api) => {
    const token = await newUser(api);
    const res = await api(EXPORT_OCT, { token });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'NO_DATA');
  });
});

test('responde 422 si el PDF aún no está disponible o los parámetros no son válidos', options, async () => {
  await withApi(async (api) => {
    const token = await newUser(api);
    await addTransaction(api, token, { type: 'gasto', amount: 1000, description: 'Algo', category: 'otros', date: '2026-10-05' });

    const pdf = await api('/reports/export?format=pdf&from=2026-10-01&to=2026-10-31', { token });
    assert.equal(pdf.status, 422);
    assert.deepEqual(pdf.body.error.details.map((d) => d.field), ['format']);

    const bad = await api('/reports/export?format=csv&from=2026-10-31&to=2026-10-01', { token });
    assert.equal(bad.status, 422);
    assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
  });
});

test('exige un access token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api(EXPORT_OCT)).status, 401);
  });
});
