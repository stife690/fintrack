import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors/app-error.js';
import { groupIdeas } from './services/ideas.service.js';
import { MAX_TITLE_LENGTH, parseNewIdea } from './validators/ideas.validator.js';

test('parseNewIdea limpia los espacios del título', () => {
  assert.deepEqual(parseNewIdea({ title: '  Dividir   el arriendo ' }), { title: 'Dividir el arriendo' });
});

test('parseNewIdea rechaza títulos muy cortos, muy largos o que no son texto', () => {
  for (const title of ['hola', '   ', 'x'.repeat(MAX_TITLE_LENGTH + 1), 123, undefined]) {
    assert.throws(
      () => parseNewIdea({ title }),
      (err) => err instanceof AppError && err.statusCode === 422 && err.details[0].field === 'title',
    );
  }
});

test('parseNewIdea rechaza un cuerpo que no es un objeto', () => {
  for (const body of [null, [], 'idea']) {
    assert.throws(
      () => parseNewIdea(body),
      (err) => err instanceof AppError && err.statusCode === 400,
    );
  }
});

test('groupIdeas separa lo que viene de lo disponible y conserva el orden', () => {
  const planned = { id: '1', status: 'planeada', votes: 5 };
  const doing = { id: '2', status: 'en_progreso', votes: 3 };
  const done = { id: '3', status: 'lista', votes: 1 };
  assert.deepEqual(groupIdeas([planned, done, doing]), { upcoming: [planned, doing], done: [done] });
});
