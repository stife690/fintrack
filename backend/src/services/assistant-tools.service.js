import { listCategories } from '../repositories/categories.repository.js';
import { summarizeTransactions } from '../repositories/transactions.repository.js';
import { todayIso } from './insights.service.js';
import { periodRange } from './transactions.service.js';

/** Datos abiertos del Estado colombiano (Socrata). */
const DATOS_GOV = 'https://www.datos.gov.co/resource';
/** TRM diaria (Superintendencia Financiera). */
const TRM_DATASET = '32sa-8pi3';
/** Tasas de captación por entidad, incluidos los CDT por plazo (Superintendencia Financiera). */
const RATES_DATASET = 'axk9-g2nh';
/** En el dataset de tasas, la unidad de captura de los CDT. */
const CDT_UNIT = '1';

/**
 * Tarifa general de retención en la fuente sobre rendimientos financieros. Es una constante del
 * simulador: verificar con la DIAN si cambia.
 */
export const RETENCION_RENDIMIENTOS = 0.04;

/** Cuánto se guarda una respuesta de datos.gov.co: la TRM y las tasas cambian una vez al día. */
const CACHE_MS = 60 * 60 * 1000;
const EXTERNAL_TIMEOUT_MS = 8000;

/**
 * Plazos de CDT tal como los reporta la Superfinanciera (subcuenta del formato de tasas).
 * Cada entrada: hasta cuántos días cubre, su subcuenta y cómo se llama.
 */
const CDT_TERMS = [
  { maxDays: 30, subcuenta: '10', label: 'a 30 días' },
  { maxDays: 44, subcuenta: '20', label: 'entre 31 y 44 días' },
  { maxDays: 45, subcuenta: '30', label: 'a 45 días' },
  { maxDays: 60, subcuenta: '50', label: 'a 60 días' },
  { maxDays: 89, subcuenta: '60', label: 'entre 61 y 89 días' },
  { maxDays: 90, subcuenta: '70', label: 'a 90 días' },
  { maxDays: 119, subcuenta: '80', label: 'entre 91 y 119 días' },
  { maxDays: 120, subcuenta: '90', label: 'a 120 días' },
  { maxDays: 179, subcuenta: '100', label: 'entre 121 y 179 días' },
  { maxDays: 180, subcuenta: '110', label: 'a 180 días' },
  { maxDays: 359, subcuenta: '120', label: 'entre 181 y 359 días' },
  { maxDays: 360, subcuenta: '130', label: 'a 360 días' },
  { maxDays: Infinity, subcuenta: '140', label: 'a más de 360 días' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Plazo de CDT que reporta la Superfinanciera para una cantidad de días.
 * @param {number} days
 * @returns {{ subcuenta: string, label: string }}
 */
export function cdtTerm(days) {
  return CDT_TERMS.find((term) => days <= term.maxDays);
}

/**
 * Cuánto rinde un CDT con interés compuesto (base 365 días) y la retención en la fuente.
 * @param {{ monto: number, plazoDias: number, tasaEA: number }} input `tasaEA` en porcentaje (10 = 10 % E.A.).
 * @returns {{ monto: number, plazo_dias: number, tasa_ea: number, interes_bruto: number, retencion: number, interes_neto: number, total_al_vencer: number }}
 */
export function simulateCdt({ monto, plazoDias, tasaEA }) {
  const round = (n) => Math.round(n);
  const bruto = monto * ((1 + tasaEA / 100) ** (plazoDias / 365) - 1);
  const retencion = bruto * RETENCION_RENDIMIENTOS;
  return {
    monto: round(monto),
    plazo_dias: plazoDias,
    tasa_ea: tasaEA,
    interes_bruto: round(bruto),
    retencion: round(retencion),
    interes_neto: round(bruto - retencion),
    total_al_vencer: round(monto + bruto - retencion),
  };
}

/**
 * Resume las tasas de CDT de un corte: promedio ponderado por monto, mínima, máxima y las cinco
 * entidades que más pagan.
 * @param {Array<{ nombreentidad: string, tasa: string, monto: string }>} rows
 * @returns {{ entidades: number, promedio_ponderado: number, minima: number, maxima: number, mejores: Array<{ entidad: string, tasa_ea: number }> }}
 */
export function summarizeCdtRates(rows) {
  const items = rows
    .map((r) => ({
      entidad: r.nombreentidad.replace(/"/g, '').trim(),
      tasa: Number(r.tasa),
      monto: Number(r.monto),
    }))
    .filter((r) => Number.isFinite(r.tasa) && r.tasa > 0);
  const weight = items.reduce((acc, r) => acc + (r.monto > 0 ? r.monto : 0), 0);
  const average = weight
    ? items.reduce((acc, r) => acc + r.tasa * (r.monto > 0 ? r.monto : 0), 0) / weight
    : items.reduce((acc, r) => acc + r.tasa, 0) / items.length;
  const sorted = [...items].sort((a, b) => b.tasa - a.tasa);
  const two = (n) => Math.round(n * 100) / 100;
  return {
    entidades: items.length,
    promedio_ponderado: two(average),
    minima: two(sorted.at(-1).tasa),
    maxima: two(sorted[0].tasa),
    mejores: sorted.slice(0, 5).map((r) => ({ entidad: r.entidad, tasa_ea: two(r.tasa) })),
  };
}

/**
 * Crea las herramientas del asistente para un usuario. Las de sus datos solo devuelven totales
 * (RN-05); las de mercado leen datos abiertos oficiales. Las dependencias se inyectan para probar.
 *
 * @param {string} userId
 * @param {object} [deps]
 * @param {typeof summarizeTransactions} [deps.summarizeTransactions]
 * @param {typeof listCategories} [deps.listCategories]
 * @param {typeof fetch} [deps.fetch]
 * @param {() => Date} [deps.now]
 * @param {Map<string, { at: number, data: unknown }>} [deps.cache]
 * @returns {import('./ai-client.service.js').AiTool[]}
 */
export function createAssistantTools(userId, deps = {}) {
  const summarize = deps.summarizeTransactions ?? summarizeTransactions;
  const getCategories = deps.listCategories ?? listCategories;
  const http = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const cache = deps.cache ?? sharedCache;

  /**
   * Consulta datos.gov.co con caché; lanza si no responde para que la herramienta diga "no disponible".
   * @param {string} dataset Identificador del conjunto de datos.
   * @param {Record<string, string>} query Parámetros SoQL.
   * @returns {Promise<object[]>}
   */
  async function datosGov(dataset, query) {
    const url = `${DATOS_GOV}/${dataset}.json?${new URLSearchParams(query)}`;
    const hit = cache.get(url);
    if (hit && now().getTime() - hit.at < CACHE_MS) return hit.data;
    const response = await http(url, { signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`datos.gov.co respondió ${response.status}`);
    const data = await response.json();
    cache.set(url, { at: now().getTime(), data });
    return data;
  }

  async function categoryNames() {
    const categories = await getCategories(userId);
    return new Map(categories.map((c) => [c.key, c.name]));
  }

  return [
    {
      name: 'resumen_de_movimientos',
      description:
        'Ingresos y gastos del usuario por categoría entre dos fechas (incluidas). Úsala para cualquier ' +
        'pregunta sobre sus movimientos de un periodo: un mes, una semana, un año o un rango.',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD' },
          hasta: { type: 'string', description: 'Fecha final AAAA-MM-DD' },
        },
        required: ['desde', 'hasta'],
      },
      async run({ desde, hasta }) {
        if (!DATE_RE.test(desde ?? '') || !DATE_RE.test(hasta ?? '') || desde > hasta) {
          return {
            error: 'Las fechas deben ser AAAA-MM-DD y "desde" no puede ser posterior a "hasta"',
          };
        }
        const [{ byCategory }, names] = await Promise.all([
          summarize({ userId, from: desde, to: hasta, groupBy: 'month' }),
          categoryNames(),
        ]);
        const total = (type) =>
          byCategory.filter((r) => r.type === type).reduce((acc, r) => acc + r.total, 0);
        return {
          desde,
          hasta,
          ingresos: total('ingreso'),
          gastos: total('gasto'),
          por_categoria: byCategory.map((r) => ({
            tipo: r.type,
            categoria: r.category ? (names.get(r.category) ?? r.category) : 'Sin clasificar',
            total: r.total,
          })),
        };
      },
    },
    {
      name: 'ahorro_promedio',
      description:
        'Cuánto le sobra al usuario en promedio al mes (ingresos menos gastos) en sus últimos 3 meses ' +
        'completos. Úsala para saber cuánto podría ahorrar o invertir.',
      parameters: { type: 'object', properties: {} },
      async run() {
        const today = todayIso(now());
        const [year, month] = today.split('-').map(Number);
        const firstMonth = new Date(Date.UTC(year, month - 4, 1)).toISOString().slice(0, 10);
        const lastMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
        const { series } = await summarize({
          userId,
          from: firstMonth,
          to: periodRange('month', lastMonth).to,
          groupBy: 'month',
        });
        const months = new Map();
        for (const row of series) {
          const entry = months.get(row.date) ?? {
            mes: row.date.slice(0, 7),
            ingresos: 0,
            gastos: 0,
          };
          entry[row.type === 'ingreso' ? 'ingresos' : 'gastos'] += row.total;
          months.set(row.date, entry);
        }
        const list = [...months.values()].map((m) => ({ ...m, sobrante: m.ingresos - m.gastos }));
        if (list.length === 0)
          return { meses: [], nota: 'No hay movimientos en los últimos 3 meses completos' };
        const average = list.reduce((acc, m) => acc + m.sobrante, 0) / list.length;
        return { meses: list, sobrante_promedio_mensual: Math.round(average) };
      },
    },
    {
      name: 'dolar_hoy',
      description:
        'Tasa Representativa del Mercado (TRM) oficial del dólar en Colombia, la más reciente.',
      parameters: { type: 'object', properties: {} },
      async run() {
        const [row] = await datosGov(TRM_DATASET, { $order: 'vigenciadesde DESC', $limit: '1' });
        if (!row) return { error: 'No hay TRM publicada' };
        return {
          trm: Number(row.valor),
          vigente_desde: row.vigenciadesde.slice(0, 10),
          fuente: 'Superintendencia Financiera, datos.gov.co',
        };
      },
    },
    {
      name: 'tasas_cdt',
      description:
        'Tasas efectivas anuales que reportaron las entidades financieras de Colombia para CDT de un plazo, ' +
        'en el corte más reciente: promedio ponderado, mínima, máxima y las 5 que más pagan.',
      parameters: {
        type: 'object',
        properties: {
          plazo_dias: {
            type: 'integer',
            description: 'Plazo del CDT en días, p. ej. 90, 180 o 360',
          },
        },
        required: ['plazo_dias'],
      },
      async run({ plazo_dias: days }) {
        const plazo = Number(days);
        if (!Number.isInteger(plazo) || plazo < 1 || plazo > 3650)
          return { error: 'El plazo debe estar en días' };
        const term = cdtTerm(plazo);
        const where = `uca='${CDT_UNIT}' AND subcuenta='${term.subcuenta}'`;
        const [{ max_fechacorte: latest } = {}] = await datosGov(RATES_DATASET, {
          $select: 'max(fechacorte)',
          $where: where,
        });
        if (!latest) return { error: 'No hay tasas publicadas para ese plazo' };
        const rows = await datosGov(RATES_DATASET, {
          $select: 'nombreentidad,tasa,monto',
          $where: `${where} AND fechacorte='${latest}'`,
          $limit: '200',
        });
        if (rows.length === 0) return { error: 'No hay tasas publicadas para ese plazo' };
        return {
          plazo: term.label,
          fecha_corte: latest.slice(0, 10),
          ...summarizeCdtRates(rows),
          fuente: 'Superintendencia Financiera, tasas de captación (datos.gov.co)',
        };
      },
    },
    {
      name: 'simular_cdt',
      description:
        'Calcula cuánto rinde un CDT: interés bruto, retención en la fuente (4 %), interés neto y total al ' +
        'vencer. Úsala con una tasa de "tasas_cdt" o la que diga el usuario.',
      parameters: {
        type: 'object',
        properties: {
          monto: { type: 'number', description: 'Pesos a invertir' },
          plazo_dias: { type: 'integer', description: 'Plazo en días' },
          tasa_ea: {
            type: 'number',
            description: 'Tasa efectiva anual en porcentaje, p. ej. 10.5',
          },
        },
        required: ['monto', 'plazo_dias', 'tasa_ea'],
      },
      async run({ monto, plazo_dias: plazoDias, tasa_ea: tasaEA }) {
        const values = [monto, plazoDias, tasaEA].map(Number);
        if (
          values.some((v) => !Number.isFinite(v) || v <= 0) ||
          values[0] > 1e12 ||
          values[2] > 100
        ) {
          return { error: 'Monto, plazo y tasa deben ser números positivos' };
        }
        return simulateCdt({ monto: values[0], plazoDias: values[1], tasaEA: values[2] });
      },
    },
  ];
}

/** Caché compartida entre peticiones (en memoria; se vacía si el servidor se reinicia). */
const sharedCache = new Map();
