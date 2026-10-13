import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors/app-error.js';
import {
  parseCreateTransaction,
  parseListQuery,
  parseUpdateTransaction,
} from './validators/transactions.validator.js';
import { createTransactionService } from './services/transactions.service.js';

const VALID = { amount: 25000.5, description: ' Almuerzo ', type: 'gasto', date: '2026-10-12' };

/**
 * @param {() => unknown} fn
 * @param {string} field Campo que debe aparecer en `details`.
 * @returns {void}
 */
function assertInvalid(fn, field) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 422);
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.ok(
      err.details.some((d) => d.field === field),
      `falta detalle de ${field}`,
    );
    return true;
  });
}

test('parseCreateTransaction acepta datos válidos, recorta texto y deja category en null', () => {
  assert.deepEqual(parseCreateTransaction(VALID), {
    amount: 25000.5,
    description: 'Almuerzo',
    type: 'gasto',
    date: '2026-10-12',
    category: null,
  });
});

test('parseCreateTransaction rechaza monto <= 0 (REQ-007) y campos obligatorios ausentes', () => {
  assertInvalid(() => parseCreateTransaction({ ...VALID, amount: 0 }), 'amount');
  assertInvalid(() => parseCreateTransaction({ ...VALID, amount: -5 }), 'amount');
  assertInvalid(() => parseCreateTransaction({ ...VALID, amount: '10' }), 'amount');
  assertInvalid(() => parseCreateTransaction({ ...VALID, amount: 0.001 }), 'amount');
  assertInvalid(() => parseCreateTransaction({}), 'amount');
  assertInvalid(() => parseCreateTransaction(undefined), 'date');
});

test('parseCreateTransaction rechaza tipo, fecha y descripción inválidos', () => {
  assertInvalid(() => parseCreateTransaction({ ...VALID, type: 'otro' }), 'type');
  assertInvalid(() => parseCreateTransaction({ ...VALID, date: '2026-02-30' }), 'date');
  assertInvalid(() => parseCreateTransaction({ ...VALID, date: '12/10/2026' }), 'date');
  assertInvalid(() => parseCreateTransaction({ ...VALID, description: '   ' }), 'description');
  assertInvalid(
    () => parseCreateTransaction({ ...VALID, description: 'x'.repeat(201) }),
    'description',
  );
});

test('parseUpdateTransaction exige al menos un campo y solo devuelve los enviados', () => {
  assertInvalid(() => parseUpdateTransaction({}), 'body');
  assert.deepEqual(parseUpdateTransaction({ amount: 10 }), { amount: 10 });
  assert.deepEqual(parseUpdateTransaction({ category: null }), { category: null });
  assertInvalid(() => parseUpdateTransaction({ amount: -1 }), 'amount');
});

test('parseListQuery aplica valores por defecto y valida filtros', () => {
  assert.deepEqual(parseListQuery({}), { page: 1, pageSize: 20 });
  assert.deepEqual(
    parseListQuery({
      type: 'gasto',
      from: '2026-10-01',
      to: '2026-10-31',
      page: '2',
      pageSize: '50',
    }),
    { type: 'gasto', from: '2026-10-01', to: '2026-10-31', page: 2, pageSize: 50 },
  );
  assertInvalid(() => parseListQuery({ type: 'x' }), 'type');
  assertInvalid(() => parseListQuery({ pageSize: '500' }), 'pageSize');
  assertInvalid(() => parseListQuery({ page: '0' }), 'page');
  assertInvalid(() => parseListQuery({ from: '2026-10-31', to: '2026-10-01' }), 'from');
});

const CATALOG = [
  { id: 1, key: 'alimentacion', name: 'Alimentación', type: 'gasto' },
  { id: 2, key: 'salario', name: 'Salario', type: 'ingreso' },
];
const ID = '11111111-1111-4111-8111-111111111111';

/**
 * Servicio con dobles: registra lo que se guarda y cuántas veces se consultó la IA.
 * @param {{ current?: object|null }} [options]
 * @returns {{ service: ReturnType<typeof createTransactionService>, saved: object[], asked: object[] }}
 */
function buildService({ current = null } = {}) {
  const saved = [];
  const asked = [];
  const service = createTransactionService({
    listCategories: async () => CATALOG,
    resolveCategory: async (input) => {
      asked.push(input);
      return input.category
        ? { category: input.category, source: 'manual' }
        : { category: 'alimentacion', source: 'ia' };
    },
    repository: {
      insertTransaction: async (data) => {
        saved.push(data);
        return { id: ID, ...data, deletedAt: null };
      },
      findTransaction: async () => current,
      listTransactions: async (filters) => {
        saved.push(filters);
        return { rows: [], total: 0 };
      },
      updateTransaction: async (_id, _user, changes) => {
        saved.push(changes);
        return { ...current, ...changes };
      },
      softDeleteTransaction: async () => current !== null,
    },
  });
  return { service, saved, asked };
}

test('create sin categoría la pide a la IA y guarda origen "ia"', async () => {
  const { service, saved } = buildService();
  const result = await service.create('u1', { ...VALID, category: null });
  assert.equal(saved[0].category, 'alimentacion');
  assert.equal(saved[0].source, 'ia');
  assert.equal(result.deletedAt, null);
});

test('create con categoría válida la respeta como "manual" sin consultar la IA', async () => {
  const { service, saved } = buildService();
  await service.create('u1', { ...VALID, category: 'alimentacion' });
  assert.equal(saved[0].source, 'manual');
});

test('create rechaza una categoría inexistente o de otro tipo (RN-02)', async () => {
  const { service } = buildService();
  await assert.rejects(service.create('u1', { ...VALID, category: 'inventada' }), {
    statusCode: 422,
  });
  await assert.rejects(service.create('u1', { ...VALID, category: 'salario' }), {
    statusCode: 422,
  });
});

test('list traduce la página a limit/offset', async () => {
  const { service, saved } = buildService();
  const result = await service.list('u1', { page: 3, pageSize: 10, type: 'gasto' });
  assert.deepEqual(saved[0], { type: 'gasto', userId: 'u1', limit: 10, offset: 20 });
  assert.equal(result.page, 3);
});

test('update responde 404 si el id no es UUID o la transacción no es del usuario', async () => {
  await assert.rejects(buildService().service.update('u1', 'abc', { amount: 5 }), {
    statusCode: 404,
  });
  await assert.rejects(buildService().service.update('u1', ID, { amount: 5 }), { statusCode: 404 });
});

test('update sin tocar categoría ni tipo no vuelve a consultar la IA', async () => {
  const current = { id: ID, type: 'gasto', description: 'Almuerzo', category: 'alimentacion' };
  const { service, saved, asked } = buildService({ current });
  await service.update('u1', ID, { amount: 99 });
  assert.deepEqual(saved[0], { amount: 99 });
  assert.equal(asked.length, 0);
});

test('update que cambia el tipo sin categoría vuelve a categorizar', async () => {
  const current = { id: ID, type: 'gasto', description: 'Pago', category: 'alimentacion' };
  const { service, asked } = buildService({ current });
  await service.update('u1', ID, { type: 'ingreso' });
  assert.equal(asked.length, 1);
  assert.equal(asked[0].type, 'ingreso');
});

test('update con categoría explícita la valida contra el tipo resultante', async () => {
  const current = { id: ID, type: 'gasto', description: 'Pago', category: null };
  const { service } = buildService({ current });
  await assert.rejects(service.update('u1', ID, { category: 'salario' }), { statusCode: 422 });
});

test('remove responde 404 si no existe y no devuelve nada si se borra', async () => {
  await assert.rejects(buildService().service.remove('u1', ID), { statusCode: 404 });
  await assert.rejects(buildService().service.remove('u1', 'no-uuid'), { statusCode: 404 });
  const ok = buildService({ current: { id: ID } });
  assert.equal(await ok.service.remove('u1', ID), undefined);
});
