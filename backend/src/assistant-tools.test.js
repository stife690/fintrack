import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cdtTerm,
  createAssistantTools,
  simulateCdt,
  summarizeCdtRates,
} from './services/assistant-tools.service.js';

const NOW = new Date('2026-10-29T15:00:00Z'); // 10:00 en Bogotá
const CATEGORIES = [
  { key: 'alimentacion', name: 'Alimentación' },
  { key: 'salario', name: 'Salario' },
];

/**
 * Herramientas con BD y datos.gov.co falsos. `calls` deja ver qué se consultó.
 * @param {{ responses?: Array<object|Error>, byCategory?: object[], series?: object[] }} [opts]
 * @returns {{ tool: (name: string) => import('./services/ai-client.service.js').AiTool, calls: object }}
 */
function setup({ responses = [], byCategory = [], series = [] } = {}) {
  const calls = { urls: [], ranges: [] };
  const tools = createAssistantTools('u1', {
    now: () => NOW,
    cache: new Map(),
    listCategories: async () => CATEGORIES,
    summarizeTransactions: async (range) => {
      calls.ranges.push(range);
      return { byCategory, series };
    },
    fetch: async (url) => {
      calls.urls.push(decodeURIComponent(url));
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify(next), { status: 200 });
    },
  });
  return { tool: (name) => tools.find((t) => t.name === name), calls };
}

test('simulateCdt: interés compuesto, retención del 4 % y total al vencer', () => {
  assert.deepEqual(simulateCdt({ monto: 2_000_000, plazoDias: 365, tasaEA: 10 }), {
    monto: 2_000_000,
    plazo_dias: 365,
    tasa_ea: 10,
    interes_bruto: 200_000,
    retencion: 8_000,
    interes_neto: 192_000,
    total_al_vencer: 2_192_000,
  });
  // A 180 días rinde menos de la mitad del año por el interés compuesto.
  assert.equal(simulateCdt({ monto: 1_000_000, plazoDias: 180, tasaEA: 10 }).interes_bruto, 48_124);
});

test('cdtTerm usa los plazos que reporta la Superfinanciera', () => {
  assert.equal(cdtTerm(360).subcuenta, '130');
  assert.equal(cdtTerm(365).label, 'a más de 360 días');
  assert.equal(cdtTerm(90).label, 'a 90 días');
  assert.equal(cdtTerm(100).label, 'entre 91 y 119 días');
});

test('summarizeCdtRates: promedio ponderado por monto, extremos y las 5 que más pagan', () => {
  const summary = summarizeCdtRates([
    { nombreentidad: '"KOA CF"', tasa: '12', monto: '100' },
    { nombreentidad: 'Banco A', tasa: '10', monto: '300' },
    { nombreentidad: 'Banco B', tasa: 'x', monto: '5' },
  ]);
  assert.deepEqual(summary, {
    entidades: 2,
    promedio_ponderado: 10.5,
    minima: 10,
    maxima: 12,
    mejores: [
      { entidad: 'KOA CF', tasa_ea: 12 },
      { entidad: 'Banco A', tasa_ea: 10 },
    ],
  });
});

test('tasas_cdt busca el corte más reciente del plazo y devuelve la fuente', async () => {
  const { tool, calls } = setup({
    responses: [
      [{ max_fechacorte: '2026-10-27T00:00:00.000' }],
      [
        { nombreentidad: 'Banco Pichincha S.A.', tasa: '13.31', monto: '100' },
        { nombreentidad: 'Tuya', tasa: '13.09', monto: '100' },
      ],
    ],
  });
  const result = await tool('tasas_cdt').run({ plazo_dias: 360 });
  assert.equal(result.fecha_corte, '2026-10-27');
  assert.equal(result.plazo, 'a 360 días');
  assert.equal(result.maxima, 13.31);
  assert.match(result.fuente, /Superintendencia Financiera/);
  assert.match(calls.urls[0], /axk9-g2nh\.json/);
  assert.match(calls.urls[1], /subcuenta='130'\+AND\+fechacorte='2026-10-27T00:00:00\.000'/);
});

test('tasas_cdt y dolar_hoy usan la caché: no consultan datos.gov.co otra vez', async () => {
  const { tool, calls } = setup({
    responses: [[{ valor: '3162.35', vigenciadesde: '2026-10-29T00:00:00.000' }]],
  });
  const first = await tool('dolar_hoy').run({});
  const second = await tool('dolar_hoy').run({});
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    trm: 3162.35,
    vigente_desde: '2026-10-29',
    fuente: 'Superintendencia Financiera, datos.gov.co',
  });
  assert.equal(calls.urls.length, 1);
});

test('si datos.gov.co falla, la herramienta lanza (el cliente de IA lo convierte en "no disponible")', async () => {
  const { tool } = setup({ responses: [new TypeError('fetch failed')] });
  await assert.rejects(tool('dolar_hoy').run({}));
});

test('resumen_de_movimientos: solo totales por categoría, con nombres', async () => {
  const { tool, calls } = setup({
    byCategory: [
      { type: 'gasto', category: 'alimentacion', total: 300000 },
      { type: 'gasto', category: null, total: 50000 },
      { type: 'ingreso', category: 'salario', total: 2000000 },
    ],
  });
  const result = await tool('resumen_de_movimientos').run({
    desde: '2026-08-01',
    hasta: '2026-08-31',
  });
  assert.equal(result.gastos, 350000);
  assert.equal(result.ingresos, 2000000);
  assert.deepEqual(result.por_categoria[1], {
    tipo: 'gasto',
    categoria: 'Sin clasificar',
    total: 50000,
  });
  assert.deepEqual(calls.ranges[0], {
    userId: 'u1',
    from: '2026-08-01',
    to: '2026-08-31',
    groupBy: 'month',
  });
  // Fechas inválidas: responde el error al modelo sin tocar la BD.
  assert.ok(
    (await tool('resumen_de_movimientos').run({ desde: '2026-09-01', hasta: '2026-08-01' })).error,
  );
  assert.equal(calls.ranges.length, 1);
});

test('ahorro_promedio usa los 3 meses completos anteriores', async () => {
  const { tool, calls } = setup({
    series: [
      { date: '2026-08-01', type: 'ingreso', total: 2000000 },
      { date: '2026-08-01', type: 'gasto', total: 1500000 },
      { date: '2026-09-01', type: 'ingreso', total: 2000000 },
      { date: '2026-09-01', type: 'gasto', total: 1700000 },
    ],
  });
  const result = await tool('ahorro_promedio').run({});
  assert.deepEqual(calls.ranges[0], {
    userId: 'u1',
    from: '2026-07-01',
    to: '2026-09-30',
    groupBy: 'month',
  });
  assert.equal(result.sobrante_promedio_mensual, 400000);
  assert.deepEqual(
    result.meses.map((m) => [m.mes, m.sobrante]),
    [
      ['2026-08', 500000],
      ['2026-09', 300000],
    ],
  );
});

test('simular_cdt rechaza datos que no son números positivos', async () => {
  const { tool } = setup();
  assert.ok((await tool('simular_cdt').run({ monto: -5, plazo_dias: 360, tasa_ea: 10 })).error);
  assert.equal(
    (await tool('simular_cdt').run({ monto: 2_000_000, plazo_dias: 365, tasa_ea: 10 }))
      .interes_neto,
    192_000,
  );
});
