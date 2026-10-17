import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSyncBatch } from './validators/sync.validator.js';

const SERVER_ID = '8c2a3646-1181-42d3-9505-a25f6bb07d65';
const AT = '2026-10-17T20:00:00Z';
const TRANSACTION = { amount: 10, description: 'cafe', type: 'gasto', date: '2026-10-15' };

/**
 * Comprueba que el lote se rechace con ese código HTTP y, si se indican, esos campos en `details`.
 * @param {unknown} body
 * @param {number} statusCode
 * @param {string[]} [fields]
 * @returns {void}
 */
function assertRejects(body, statusCode, fields) {
  assert.throws(
    () => parseSyncBatch(body),
    (err) => {
      assert.equal(err.statusCode, statusCode);
      assert.equal(err.code, 'VALIDATION_ERROR');
      if (fields) {
        assert.deepEqual(
          err.details.map((d) => d.field),
          fields,
        );
      }
      return true;
    },
  );
}

test('un lote vacío es válido: sirve para pedir solo los cambios del servidor', () => {
  assert.deepEqual(parseSyncBatch({ lastSyncedAt: null, operations: [] }), {
    lastSyncedAt: null,
    operations: [],
  });
});

test('acepta las tres operaciones y convierte las fechas a Date', () => {
  const batch = parseSyncBatch({
    lastSyncedAt: AT,
    operations: [
      { op: 'create', localId: 'a', transaction: TRANSACTION },
      {
        op: 'update',
        localId: 'b',
        serverId: SERVER_ID,
        updatedAt: AT,
        transaction: { amount: 20 },
      },
      { op: 'delete', localId: 'c', serverId: SERVER_ID, updatedAt: AT },
    ],
  });
  assert.ok(batch.lastSyncedAt instanceof Date);
  assert.deepEqual(
    batch.operations.map((o) => o.op),
    ['create', 'update', 'delete'],
  );
  assert.equal(batch.operations[0].transaction.category, null, 'create sin categoría → IA');
  assert.ok(batch.operations[1].updatedAt instanceof Date);
  assert.deepEqual(batch.operations[1].transaction, { amount: 20 });
  assert.equal(batch.operations[2].transaction, undefined, 'delete no lleva transacción');
});

test('lastSyncedAt es obligatorio: una fecha y hora ISO, o null', () => {
  assertRejects({ operations: [] }, 422, ['lastSyncedAt']);
  assertRejects({ lastSyncedAt: '2026-10-17', operations: [] }, 422, ['lastSyncedAt']);
  assertRejects({ lastSyncedAt: 'ayer', operations: [] }, 422, ['lastSyncedAt']);
});

test('operations debe ser una lista de máximo 200', () => {
  assertRejects({ lastSyncedAt: null, operations: 'x' }, 422, ['operations']);
  const many = Array.from({ length: 201 }, (_, i) => ({ op: 'delete', localId: String(i) }));
  assertRejects({ lastSyncedAt: null, operations: many }, 422, ['operations']);
});

test('reúne los problemas de varias operaciones, indicando cuál es cada una', () => {
  assertRejects({ lastSyncedAt: null, operations: [5, { op: 'borrar', localId: '' }] }, 422, [
    'operations[0]',
    'operations[1].op',
    'operations[1].localId',
  ]);
});

test('localId es un texto de 1 a 64 caracteres (lo que cabe en la columna)', () => {
  const op = (localId) => ({ op: 'delete', localId, serverId: SERVER_ID, updatedAt: AT });
  assert.doesNotThrow(() =>
    parseSyncBatch({ lastSyncedAt: null, operations: [op('x'.repeat(64))] }),
  );
  assertRejects({ lastSyncedAt: null, operations: [op('x'.repeat(65))] }, 422, [
    'operations[0].localId',
  ]);
});

test('update y delete exigen serverId (UUID) y updatedAt (fecha y hora)', () => {
  assertRejects(
    {
      lastSyncedAt: null,
      operations: [{ op: 'delete', localId: 'a', serverId: 'hola', updatedAt: 'ayer' }],
    },
    422,
    ['operations[0].serverId', 'operations[0].updatedAt'],
  );
});

test('reutiliza las reglas de transacciones y nombra la operación del problema', () => {
  assertRejects(
    {
      lastSyncedAt: null,
      operations: [
        { op: 'create', localId: 'a', transaction: TRANSACTION },
        { op: 'create', localId: 'b', transaction: { ...TRANSACTION, amount: -1 } },
      ],
    },
    422,
    ['operations[1].transaction.amount'],
  );
  assertRejects(
    {
      lastSyncedAt: null,
      operations: [
        { op: 'update', localId: 'a', serverId: SERVER_ID, updatedAt: AT, transaction: {} },
      ],
    },
    422,
    ['operations[0].transaction'],
  );
});

test('un cuerpo que no es un objeto responde 400', () => {
  for (const body of [null, [1, 2], 'texto']) {
    assertRejects(body, 400);
  }
});
