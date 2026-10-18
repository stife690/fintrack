import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_NAME_LENGTH, parseUpdateProfile } from './validators/users.validator.js';

/**
 * Comprueba que `fn` lance un AppError de validación con ese código HTTP.
 * @param {() => unknown} fn
 * @param {number} statusCode
 * @returns {void}
 */
function assertRejects(fn, statusCode) {
  assert.throws(fn, (err) => {
    assert.equal(err.statusCode, statusCode);
    assert.equal(err.code, 'VALIDATION_ERROR');
    if (statusCode === 422) assert.equal(err.details[0].field, 'name');
    return true;
  });
}

test('parseUpdateProfile limpia el nombre: recorta y deja un solo espacio', () => {
  assert.deepEqual(parseUpdateProfile({ name: '  María   José  ' }), { name: 'María José' });
});

test('parseUpdateProfile borra el nombre con null o con texto vacío', () => {
  assert.deepEqual(parseUpdateProfile({ name: null }), { name: null });
  assert.deepEqual(parseUpdateProfile({ name: '   ' }), { name: null });
});

test('parseUpdateProfile acepta justo el máximo y rechaza uno más (422)', () => {
  const max = 'a'.repeat(MAX_NAME_LENGTH);
  assert.deepEqual(parseUpdateProfile({ name: max }), { name: max });
  assertRejects(() => parseUpdateProfile({ name: `${max}a` }), 422);
});

test('parseUpdateProfile exige el campo name y que sea texto o null (422)', () => {
  assertRejects(() => parseUpdateProfile({}), 422);
  assertRejects(() => parseUpdateProfile({ name: 42 }), 422);
  assertRejects(() => parseUpdateProfile({ name: ['Ana'] }), 422);
});

test('parseUpdateProfile rechaza un cuerpo que no es objeto (400)', () => {
  assertRejects(() => parseUpdateProfile(null), 400);
  assertRejects(() => parseUpdateProfile('Ana'), 400);
  assertRejects(() => parseUpdateProfile([]), 400);
});
