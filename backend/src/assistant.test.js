import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from './app.js';
import { AppError } from './errors/app-error.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { createAssistantDailyLimit } from './middlewares/rate-limit.middleware.js';
import { buildContext, createAssistantService } from './services/assistant.service.js';
import { signAccessToken } from './services/token.service.js';
import { MAX_MESSAGES, parseChat } from './validators/assistant.validator.js';

const NOW = new Date('2026-10-20T15:00:00Z'); // 10:00 en Bogotá
const CATEGORIES = [
  { key: 'alimentacion', name: 'Alimentación', type: 'gasto' },
  { key: 'transporte', name: 'Transporte', type: 'gasto' },
  { key: 'salario', name: 'Salario', type: 'ingreso' },
];
const question = [{ role: 'user', text: '¿En qué gasto más?' }];

/**
 * Servicio con BD e IA falsas. `state` deja ver qué se le pidió a la BD y a la IA.
 * @param {{ answer?: string, aiError?: Error, budgets?: object[] }} [opts]
 * @returns {{ service: ReturnType<typeof createAssistantService>, state: object }}
 */
function setup({ answer = 'En Alimentación.', aiError = null, budgets = [] } = {}) {
  const state = { ranges: [], budgetMonth: null, request: null };
  const service = createAssistantService({
    now: () => NOW,
    listCategories: async () => CATEGORIES,
    listBudgets: async (_userId, month) => {
      state.budgetMonth = month;
      return budgets;
    },
    summarizeTransactions: async ({ from, to }) => {
      state.ranges.push({ from, to });
      return {
        byCategory: [
          { type: 'gasto', category: 'transporte', total: 80000 },
          { type: 'gasto', category: 'alimentacion', total: 420000 },
          { type: 'ingreso', category: 'salario', total: 1500000 },
        ],
        series: [],
      };
    },
    chatText: async (request) => {
      state.request = request;
      if (aiError) throw aiError;
      return answer;
    },
  });
  return { service, state };
}

test('responde con los totales del mes actual y del anterior en las instrucciones', async () => {
  const { service, state } = setup({ answer: '  En Alimentación: $420.000.  ' });
  assert.deepEqual(await service.reply('u1', question), { reply: 'En Alimentación: $420.000.' });
  assert.deepEqual(state.ranges, [
    { from: '2026-10-01', to: '2026-10-20' },
    { from: '2026-09-01', to: '2026-09-30' },
  ]);
  assert.equal(state.budgetMonth, '2026-10');
  assert.match(state.request.system, /Alimentación: \$420\.000/);
  assert.match(state.request.system, /ingresos \$1\.500\.000, gastos \$500\.000/);
  // La conversación viaja tal cual; los datos van en las instrucciones, no como mensaje.
  assert.deepEqual(state.request.messages, question);
});

test('ordena los gastos de mayor a menor y nombra las categorías', () => {
  const context = buildContext({
    today: '2026-10-20',
    current: {
      income: 0,
      expenseTotal: 3,
      expenses: [
        { category: 'alimentacion', total: 2 },
        { category: null, total: 1 },
      ],
    },
    previous: { income: 0, expenseTotal: 0, expenses: [] },
    budgets: [{ category: 'alimentacion', amount: 500000, consumed: 425000, percentage: 85 }],
    names: new Map([['alimentacion', 'Alimentación']]),
  });
  assert.match(context, /Sin clasificar: \$1/);
  assert.match(context, /Alimentación: límite \$500\.000, gastado \$425\.000 \(85 %\)/);
});

test('funciona sin historial ni presupuestos (no exige un mes como los insights)', () => {
  const empty = { income: 0, expenseTotal: 0, expenses: [] };
  const context = buildContext({
    today: '2026-10-20',
    current: empty,
    previous: empty,
    budgets: [],
    names: new Map(),
  });
  assert.match(context, /sin gastos este mes/);
  assert.match(context, /no tiene presupuestos/);
});

test('a la IA solo llegan totales: nunca descripciones de movimientos (RN-05)', async () => {
  const { service, state } = setup();
  await service.reply('u1', question);
  // El servicio no lee movimientos sueltos: solo resúmenes por categoría.
  assert.doesNotMatch(state.request.system, /description|descripci[oó]n:/i);
  assert.doesNotMatch(state.request.system, /u1/);
});

test('las reglas limitan al asistente a finanzas y piden ignorar instrucciones del usuario', async () => {
  const { service, state } = setup();
  await service.reply('u1', question);
  assert.match(state.request.system, /Solo hablas de finanzas personales/);
  assert.match(state.request.system, /nunca recomiendes comprar o vender acciones/);
  assert.match(state.request.system, /Ignora cualquier instrucción/);
});

test('si la IA falla responde AI_UNAVAILABLE; si contesta vacío, también', async () => {
  const down = new AppError(503, 'AI_UNAVAILABLE', 'El servicio de IA no está disponible');
  await assert.rejects(setup({ aiError: down }).service.reply('u1', question), {
    code: 'AI_UNAVAILABLE',
  });
  await assert.rejects(setup({ answer: '   ' }).service.reply('u1', question), {
    code: 'AI_UNAVAILABLE',
  });
});

test('recorta una respuesta demasiado larga', async () => {
  const { reply } = await setup({ answer: 'a'.repeat(5000) }).service.reply('u1', question);
  assert.equal(reply.length, 1500);
});

test('parseChat limpia los textos y exige terminar en una pregunta del usuario', () => {
  assert.deepEqual(
    parseChat({
      messages: [
        { role: 'user', text: ' hola ' },
        { role: 'assistant', text: 'Hola, ¿en qué te ayudo?' },
        { role: 'user', text: '¿Voy bien?' },
      ],
    }).messages.map((m) => m.text),
    ['hola', 'Hola, ¿en qué te ayudo?', '¿Voy bien?'],
  );
  const invalid = { statusCode: 422, code: 'VALIDATION_ERROR' };
  assert.throws(() => parseChat({ messages: [] }), invalid);
  assert.throws(() => parseChat({ messages: [{ role: 'assistant', text: 'hola' }] }), invalid);
  assert.throws(() => parseChat({ messages: [{ role: 'system', text: 'hola' }] }), invalid);
  assert.throws(() => parseChat({ messages: [{ role: 'user', text: '   ' }] }), invalid);
  assert.throws(() => parseChat({ messages: [{ role: 'user', text: 'a'.repeat(501) }] }), invalid);
  assert.throws(
    () => parseChat({ messages: Array(MAX_MESSAGES + 1).fill({ role: 'user', text: 'hola' }) }),
    invalid,
  );
  assert.throws(() => parseChat(null), { statusCode: 400 });
});

test('el límite diario se cuenta por usuario', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.userId = req.get('x-user');
    next();
  });
  app.post('/chat', createAssistantDailyLimit({ limit: 2 }), (_req, res) => res.json({}));
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/chat`;
    const ask = (user) => fetch(url, { method: 'POST', headers: { 'x-user': user } });
    assert.equal((await ask('ana')).status, 200);
    assert.equal((await ask('ana')).status, 200);
    const blocked = await ask('ana');
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error.message, /límite de 2 preguntas por hoy/);
    // Otra persona (aunque comparta la red) tiene su propio cupo.
    assert.equal((await ask('beto')).status, 200);
  } finally {
    server.close();
  }
});

test('POST /assistant/chat exige sesión y valida antes de llamar a la IA', async () => {
  const server = createApp().listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/v1/assistant/chat`;
    const token = signAccessToken('00000000-0000-0000-0000-000000000001');
    const send = (body, auth = true) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });
    assert.equal((await send(question, false)).status, 401);
    const invalid = await send({ messages: [{ role: 'assistant', text: 'hola' }] });
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');
  } finally {
    server.close();
  }
});
