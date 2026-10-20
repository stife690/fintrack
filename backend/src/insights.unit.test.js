import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors/app-error.js';
import {
  buildPrompt,
  createInsightsService,
  oneMonthBefore,
  parseInsights,
  todayIso,
} from './services/insights.service.js';

const NOW = new Date('2026-10-20T15:00:00Z'); // 10:00 en Bogotá
const CATEGORIES = [
  { key: 'alimentacion', name: 'Alimentación', type: 'gasto' },
  { key: 'transporte', name: 'Transporte', type: 'gasto' },
];
const GOOD_ANSWER = JSON.stringify([
  {
    type: 'saving_opportunity',
    title: 'Gastas más en comida',
    detail: 'Subió 20 % frente a septiembre.',
  },
  { type: 'positive_trend', title: 'Transporte a la baja', detail: 'Bajó 10 %.' },
]);

/**
 * Servicio con repositorio e IA falsos. `state` deja ver qué se guardó y qué se le pidió a la IA.
 * @param {object} [opts] Opciones: `cached`, `first`, `answer` y `aiError`.
 */
function setup({ cached = null, first = '2026-08-01', answer = GOOD_ANSWER, aiError = null } = {}) {
  const state = { saved: null, prompts: [], aiCalls: 0, ranges: [] };
  const service = createInsightsService({
    now: () => NOW,
    listCategories: async () => CATEGORIES,
    repository: {
      findInsights: async () => cached,
      saveInsights: async (userId, month, insights) => {
        state.saved = { userId, month, insights };
      },
      findFirstTransactionDate: async () => first,
      summarizeTransactions: async ({ from, to }) => {
        state.ranges.push({ from, to });
        return {
          byCategory: [
            { type: 'gasto', category: 'alimentacion', total: 300000 },
            { type: 'gasto', category: null, total: 50000 },
            { type: 'ingreso', category: 'salario', total: 2000000 },
          ],
          series: [],
        };
      },
    },
    completeText: async ({ prompt }) => {
      state.aiCalls += 1;
      state.prompts.push(prompt);
      if (aiError) throw aiError;
      return answer;
    },
  });
  return { service, state };
}

const aiDown = () => new AppError(503, 'AI_UNAVAILABLE', 'caído');

test('todayIso usa la fecha de Bogotá, no la de UTC', () => {
  assert.equal(todayIso(new Date('2026-10-21T03:00:00Z')), '2026-10-20');
});

test('oneMonthBefore resta un mes y no desborda', () => {
  assert.equal(oneMonthBefore('2026-10-20'), '2026-09-20');
  assert.equal(oneMonthBefore('2026-03-31'), '2026-02-28');
  assert.equal(oneMonthBefore('2024-03-31'), '2024-02-29');
  assert.equal(oneMonthBefore('2026-01-15'), '2025-12-15');
});

test('parseInsights acepta bloques de código y texto alrededor', () => {
  const parsed = parseInsights('Claro:\n```json\n' + GOOD_ANSWER + '\n```');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].type, 'saving_opportunity');
});

test('parseInsights cambia tipos desconocidos, recorta y limita a 4', () => {
  const many = Array.from({ length: 6 }, (_, i) => ({
    type: 'raro',
    title: `T${i}`.padEnd(200, 'x'),
    detail: 'd'.repeat(500),
  }));
  const parsed = parseInsights(JSON.stringify(many));
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].type, 'general_tip');
  assert.equal(parsed[0].title.length, 80);
  assert.equal(parsed[0].detail.length, 300);
});

test('parseInsights devuelve null si no hay nada utilizable', () => {
  for (const text of ['sin json', '[]', '[{"type":"x"}]', '[no es json]', '{"a":1}']) {
    assert.equal(parseInsights(text), null, text);
  }
});

test('buildPrompt solo incluye agregados por categoría', () => {
  const prompt = buildPrompt({
    month: '2026-10',
    previousMonth: '2026-09',
    current: { income: 10, expenseTotal: 5, expenses: [{ category: 'alimentacion', total: 5 }] },
    previous: { income: 0, expenseTotal: 0, expenses: [] },
    names: new Map([['alimentacion', 'Alimentación']]),
  });
  assert.match(prompt, /Alimentación: 5/);
  assert.match(prompt, /sin gastos/);
});

test('sin transacciones responde 422 INSUFFICIENT_HISTORY y no llama a la IA', async () => {
  const { service, state } = setup({ first: null });
  await assert.rejects(service.getInsights('u1'), {
    code: 'INSUFFICIENT_HISTORY',
    statusCode: 422,
  });
  assert.equal(state.aiCalls, 0);
});

test('con menos de un mes de historial responde 422', async () => {
  const { service, state } = setup({ first: '2026-09-25' });
  await assert.rejects(service.getInsights('u1'), { code: 'INSUFFICIENT_HISTORY' });
  assert.equal(state.aiCalls, 0);
});

test('con exactamente un mes de historial sí genera', async () => {
  const { service } = setup({ first: '2026-09-20' });
  const result = await service.getInsights('u1');
  assert.equal(result.month, '2026-10');
});

test('genera, valida y guarda los insights del mes', async () => {
  const { service, state } = setup();
  const result = await service.getInsights('u1');
  assert.equal(result.month, '2026-10');
  assert.equal(result.insights.length, 2);
  assert.deepEqual(state.saved, { userId: 'u1', month: '2026-10', insights: result.insights });
  // Mes actual hasta hoy y mes anterior completo.
  assert.deepEqual(state.ranges, [
    { from: '2026-10-01', to: '2026-10-20' },
    { from: '2026-09-01', to: '2026-09-30' },
  ]);
});

test('el prompt lleva agregados y nada que identifique al usuario (RN-05)', async () => {
  const { service, state } = setup();
  await service.getInsights('usuario-secreto-123');
  const [prompt] = state.prompts;
  assert.match(prompt, /Alimentación: 300000/);
  assert.match(prompt, /Sin clasificar: 50000/);
  assert.doesNotMatch(prompt, /usuario-secreto-123/);
});

test('un resultado guardado hace menos de 24 h se devuelve sin llamar a la IA', async () => {
  const cached = {
    insights: [{ type: 'general_tip', title: 'a', detail: 'b' }],
    generatedAt: new Date(NOW.getTime() - 3 * 3_600_000),
  };
  const { service, state } = setup({ cached });
  const result = await service.getInsights('u1');
  assert.deepEqual(result.insights, cached.insights);
  assert.equal(state.aiCalls, 0);
});

test('un resultado viejo se regenera', async () => {
  const cached = {
    insights: [{ type: 'general_tip', title: 'viejo', detail: 'b' }],
    generatedAt: new Date(NOW.getTime() - 30 * 3_600_000),
  };
  const { service, state } = setup({ cached });
  const result = await service.getInsights('u1');
  assert.equal(state.aiCalls, 1);
  assert.notEqual(result.insights[0].title, 'viejo');
});

test('con la IA caída y sin caché responde 503 AI_UNAVAILABLE', async () => {
  const { service, state } = setup({ aiError: aiDown() });
  await assert.rejects(service.getInsights('u1'), { code: 'AI_UNAVAILABLE', statusCode: 503 });
  assert.equal(state.saved, null);
});

test('con la IA caída y un resultado viejo devuelve el viejo', async () => {
  const cached = {
    insights: [{ type: 'general_tip', title: 'viejo', detail: 'b' }],
    generatedAt: new Date(NOW.getTime() - 30 * 3_600_000),
  };
  const { service } = setup({ cached, aiError: aiDown() });
  const result = await service.getInsights('u1');
  assert.equal(result.insights[0].title, 'viejo');
});

test('una respuesta ilegible de la IA es 503 y no se guarda', async () => {
  const { service, state } = setup({ answer: 'Lo siento, no puedo.' });
  await assert.rejects(service.getInsights('u1'), { code: 'AI_UNAVAILABLE' });
  assert.equal(state.saved, null);
});

test('otros errores no se tragan', async () => {
  const { service } = setup({ aiError: new Error('bug') });
  await assert.rejects(service.getInsights('u1'), { message: 'bug' });
});
