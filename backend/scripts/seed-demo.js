/**
 * Crea una cuenta de pruebas con tres meses de historial creíble (transacciones, presupuestos
 * y alertas) para probar FinTrack con una sola cuenta: dashboard con datos, presupuestos en
 * 80 % y por encima del 100 %, insights (hace falta más de un mes de historial), exportación
 * y filtros.
 *
 * Uso (desde `backend/`):
 *   DATABASE_URL=... DEMO_PASSWORD=... node scripts/seed-demo.js           # crea la cuenta
 *   DATABASE_URL=... DEMO_PASSWORD=... node scripts/seed-demo.js --reset   # la borra y la recrea
 *
 * Variables:
 * - `DATABASE_URL` (obligatoria): la misma cadena que usa el backend (en Supabase, con
 *   `?sslmode=require` si hace falta).
 * - `DEMO_PASSWORD` (obligatoria): contraseña de la cuenta. No se guarda en el repositorio.
 * - `DEMO_EMAIL` (opcional): por defecto `demo.fintrack@example.com`.
 *
 * Solo toca la cuenta indicada en `DEMO_EMAIL`: `--reset` borra únicamente a ese usuario (sus
 * transacciones, presupuestos y sesiones caen por `ON DELETE CASCADE`). Los datos son
 * deterministas respecto a la fecha de hoy: la misma fecha produce el mismo historial.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

/** Mismo costo de bcrypt que el backend (`auth.service.js`). */
const BCRYPT_ROUNDS = 10;
/** Meses de historial hacia atrás, además del mes actual. */
const MONTHS_BACK = 3;

/**
 * Generador pseudoaleatorio determinista (mulberry32), para que el historial sea repetible.
 * @param {number} seed
 * @returns {() => number} Números en [0, 1).
 */
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fecha de hoy (AAAA-MM-DD) en Bogotá, que es donde vive el usuario de la app.
 * @returns {string}
 */
function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

/**
 * @param {string} date AAAA-MM-DD
 * @param {number} days Días a sumar (puede ser negativo).
 * @returns {string} AAAA-MM-DD
 */
function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * @param {string} date AAAA-MM-DD
 * @returns {number} 0 = domingo ... 6 = sábado
 */
function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Gastos e ingresos recurrentes de cada mes (día fijo del mes).
 * `origin` es `manual` porque son los que el usuario escribe con su categoría.
 */
const MONTHLY = [
  {
    day: 1,
    type: 'ingreso',
    category: 'salario',
    description: 'Pago de nómina',
    amount: 3_200_000,
  },
  {
    day: 3,
    type: 'gasto',
    category: 'ahorro_inversion',
    description: 'Aporte al ahorro mensual',
    amount: 200_000,
  },
  {
    day: 5,
    type: 'gasto',
    category: 'vivienda',
    description: 'Arriendo del apartamento',
    amount: 950_000,
  },
  {
    day: 8,
    type: 'gasto',
    category: 'servicios_publicos',
    description: 'Internet hogar',
    amount: 89_900,
  },
  {
    day: 10,
    type: 'gasto',
    category: 'servicios_publicos',
    description: 'Factura de energía',
    amount: 118_000,
    jitter: 25_000,
  },
  {
    day: 12,
    type: 'gasto',
    category: 'servicios_publicos',
    description: 'Factura de acueducto',
    amount: 46_000,
    jitter: 8_000,
  },
  { day: 14, type: 'gasto', category: 'entretenimiento', description: 'Netflix', amount: 24_900 },
  { day: 15, type: 'gasto', category: 'entretenimiento', description: 'Spotify', amount: 16_900 },
  {
    day: 20,
    type: 'gasto',
    category: 'tecnologia',
    description: 'Hosting del proyecto de la universidad',
    amount: 35_000,
  },
];

/**
 * Movimientos variables: cada día cada regla se sortea con probabilidad `p` (y solo en los
 * días de la semana de `weekdays`, si se indica).
 */
const DAILY = [
  {
    p: 0.62,
    weekdays: [1, 2, 3, 4, 5],
    category: 'alimentacion',
    min: 13_000,
    max: 24_000,
    descriptions: ['Almuerzo corrientazo', 'Almuerzo en el restaurante', 'Almuerzo ejecutivo'],
  },
  {
    p: 0.3,
    category: 'alimentacion',
    min: 4_500,
    max: 9_500,
    descriptions: ['Café y empanada en la universidad', 'Tinto y pan', 'Jugo natural'],
  },
  {
    p: 0.14,
    category: 'alimentacion',
    min: 27_000,
    max: 48_000,
    descriptions: ['Domicilio Rappi', 'Pizza a domicilio', 'Hamburguesa por Rappi'],
  },
  {
    p: 0.9,
    weekdays: [6],
    category: 'alimentacion',
    min: 110_000,
    max: 210_000,
    descriptions: ['Mercado en el Éxito', 'Mercado de la semana', 'Compra en D1 y Ara'],
  },
  {
    p: 0.5,
    weekdays: [1, 2, 3, 4, 5],
    category: 'transporte',
    min: 3_000,
    max: 6_000,
    descriptions: ['Pasaje en bus', 'Recarga tarjeta de transporte', 'Pasaje busetas'],
  },
  {
    p: 0.13,
    category: 'transporte',
    min: 12_000,
    max: 26_000,
    descriptions: ['Uber a la universidad', 'Taxi nocturno', 'Uber al centro'],
  },
  {
    p: 0.1,
    category: 'transporte',
    min: 22_000,
    max: 40_000,
    descriptions: ['Gasolina moto', 'Tanqueada de la moto'],
  },
  {
    p: 0.07,
    category: 'entretenimiento',
    min: 28_000,
    max: 62_000,
    descriptions: [
      'Cine con amigos',
      'Salida con amigos',
      'Entradas al concierto',
      'Videojuego en Steam',
    ],
  },
  {
    p: 0.05,
    category: 'salud',
    min: 14_000,
    max: 65_000,
    descriptions: ['Droguería La Rebaja', 'Medicamentos', 'Cita odontológica copago'],
  },
  {
    p: 0.035,
    category: 'educacion',
    min: 20_000,
    max: 80_000,
    descriptions: ['Fotocopias y libros', 'Curso en Platzi', 'Impresiones del proyecto'],
  },
  {
    p: 0.03,
    category: 'ropa_accesorios',
    min: 45_000,
    max: 140_000,
    descriptions: ['Camiseta Studio F', 'Zapatillas', 'Gorra y medias'],
  },
  {
    p: 0.03,
    category: 'tecnologia',
    min: 18_000,
    max: 95_000,
    descriptions: ['Cable USB-C', 'Mouse inalámbrico', 'Funda para el celular'],
  },
  {
    p: 0.025,
    category: 'otros',
    min: 15_000,
    max: 90_000,
    descriptions: [
      'Regalo de cumpleaños',
      'Vaca para el regalo del profe',
      'Mantenimiento de la bicicleta',
    ],
  },
];

/** Descripciones ambiguas: la IA no las clasifica, quedan `sin_clasificar` y editables. */
const UNCLASSIFIED = [
  'Pago Nequi',
  'Compra varios',
  'Transferencia a Juan',
  'Cobro tarjeta',
  'Ajuste',
];

/**
 * Entradas de ingreso extra: trabajos freelance ocasionales.
 */
const FREELANCE = [
  { day: 18, description: 'Pago por proyecto web de un cliente', min: 450_000, max: 900_000 },
  { day: 26, description: 'Pago por mantenimiento de una página', min: 150_000, max: 300_000 },
];

/**
 * Redondea a la centena (los pesos colombianos rara vez llevan unidades sueltas).
 * @param {number} value
 * @returns {number}
 */
const roundTo100 = (value) => Math.round(value / 100) * 100;

/**
 * Arma el historial: de hace `MONTHS_BACK` meses hasta hoy.
 * @param {string} today AAAA-MM-DD
 * @returns {Array<{ date: string, type: 'ingreso'|'gasto', category: string|null, description: string, amount: number, source: 'manual'|'ia'|'sin_clasificar' }>}
 */
export function buildTransactions(today) {
  const random = createRandom(Number(today.replaceAll('-', '')));
  const pick = (list) => list[Math.floor(random() * list.length)];
  const between = (min, max) => roundTo100(min + random() * (max - min));
  const [ty, tm] = today.split('-').map(Number);
  const firstMonth = new Date(Date.UTC(ty, tm - 1 - MONTHS_BACK, 1));
  const start = firstMonth.toISOString().slice(0, 10);

  const out = [];
  const push = (date, type, category, description, amount, source) => {
    if (date >= start && date <= today)
      out.push({ date, type, category, description, amount, source });
  };

  // Recurrentes y freelance, mes por mes.
  for (let i = 0; i <= MONTHS_BACK; i += 1) {
    const base = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1));
    const ym = base.toISOString().slice(0, 7);
    for (const item of MONTHLY) {
      const amount = item.jitter
        ? between(item.amount - item.jitter, item.amount + item.jitter)
        : item.amount;
      push(
        `${ym}-${String(item.day).padStart(2, '0')}`,
        item.type,
        item.category,
        item.description,
        amount,
        'manual',
      );
    }
    // Freelance: solo en algunos meses, para que no sea un ingreso fijo.
    FREELANCE.forEach((f, index) => {
      if ((i + index) % 2 === 0) {
        push(
          `${ym}-${String(f.day).padStart(2, '0')}`,
          'ingreso',
          'freelance',
          f.description,
          between(f.min, f.max),
          'manual',
        );
      }
    });
  }

  // Variables, día por día. De los que llevan categoría, ~70 % los "sugirió la IA".
  for (let date = start; date <= today; date = addDays(date, 1)) {
    for (const rule of DAILY) {
      if (rule.weekdays && !rule.weekdays.includes(weekday(date))) continue;
      if (random() >= rule.p) continue;
      push(
        date,
        'gasto',
        rule.category,
        pick(rule.descriptions),
        between(rule.min, rule.max),
        random() < 0.7 ? 'ia' : 'manual',
      );
    }
  }

  // Unos pocos movimientos que la IA no pudo clasificar, repartidos en el periodo.
  UNCLASSIFIED.forEach((description, index) => {
    const date = addDays(today, -(6 + index * 17));
    push(date, 'gasto', null, description, between(12_000, 70_000), 'sin_clasificar');
  });

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Presupuestos del mes actual y del anterior, calculados sobre lo gastado para que las
 * alertas se puedan ver: alimentación al ~85 % (advertencia), transporte pasado del 100 %
 * (excedido) y entretenimiento y servicios con holgura (sin alerta).
 * @param {ReturnType<typeof buildTransactions>} transactions
 * @param {string} today AAAA-MM-DD
 * @returns {Array<{ month: string, category: string, limit: number }>}
 */
export function buildBudgets(transactions, today) {
  const month = today.slice(0, 7);
  const previous = addDays(`${month}-01`, -1).slice(0, 7);
  const consumed = (m, category) =>
    transactions
      .filter((t) => t.type === 'gasto' && t.category === category && t.date.startsWith(m))
      .reduce((sum, t) => sum + t.amount, 0);
  const ceil10k = (value) => Math.ceil(value / 10_000) * 10_000;
  const limitFor = (m, category, ratio, fallback) => {
    const spent = consumed(m, category);
    return spent > 0 ? Math.max(ceil10k(spent / ratio), 10_000) : fallback;
  };

  const budgets = [];
  for (const [m, ratios] of [
    [
      month,
      { alimentacion: 0.85, transporte: 1.12, entretenimiento: 0.4, servicios_publicos: 0.8 },
    ],
    [
      previous,
      { alimentacion: 0.9, transporte: 0.75, entretenimiento: 0.6, servicios_publicos: 0.85 },
    ],
  ]) {
    const fallback = {
      alimentacion: 900_000,
      transporte: 200_000,
      entretenimiento: 120_000,
      servicios_publicos: 300_000,
    };
    for (const [category, ratio] of Object.entries(ratios)) {
      budgets.push({ month: m, category, limit: limitFor(m, category, ratio, fallback[category]) });
    }
  }
  return budgets;
}

/**
 * Valida la contraseña con las mismas reglas del registro de la app.
 * @param {string|undefined} password
 * @returns {string}
 */
function requirePassword(password) {
  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error(
      'DEMO_PASSWORD es obligatoria: mínimo 8 caracteres, con una letra y un número.',
    );
  }
  return password;
}

/** Punto de entrada: crea (o recrea) la cuenta y carga el historial en una sola transacción. */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL.');
  const password = requirePassword(process.env.DEMO_PASSWORD);
  const email = (process.env.DEMO_EMAIL || 'demo.fintrack@example.com').trim().toLowerCase();
  const reset = process.argv.includes('--reset');
  const today = todayBogota();

  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  await client.connect();
  const { host, pathname } = new URL(databaseUrl);
  console.log(`Base de datos: ${host}${pathname}`);

  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      if (!reset) {
        throw new Error(`La cuenta ${email} ya existe. Usa --reset para borrarla y recrearla.`);
      }
      await client.query('DELETE FROM usuarios WHERE email = $1', [email]);
      console.log(`Cuenta anterior de ${email} eliminada.`);
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await client.query(
      `INSERT INTO usuarios (email, nombre, password_hash, timezone)
       VALUES ($1, 'Demo FinTrack', $2, 'America/Bogota') RETURNING id`,
      [email, hash],
    );
    const userId = rows[0].id;

    const categories = new Map(
      (await client.query('SELECT id, key FROM categorias')).rows.map((c) => [c.key, c.id]),
    );
    if (categories.size === 0)
      throw new Error('La tabla categorias está vacía: carga db/init primero.');

    const transactions = buildTransactions(today);
    for (const t of transactions) {
      await client.query(
        `INSERT INTO transacciones
           (usuario_id, categoria_id, monto, descripcion, tipo, fecha, origen, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, ($6::date + time '12:00') AT TIME ZONE 'America/Bogota',
                 ($6::date + time '12:00') AT TIME ZONE 'America/Bogota')`,
        [
          userId,
          t.category ? categories.get(t.category) : null,
          t.amount,
          t.description,
          t.type,
          t.date,
          t.source,
        ],
      );
    }

    const budgets = buildBudgets(transactions, today);
    for (const b of budgets) {
      await client.query(
        `INSERT INTO presupuestos (usuario_id, categoria_id, mes, monto_limite) VALUES ($1, $2, $3, $4)`,
        [userId, categories.get(b.category), b.month, b.limit],
      );
    }
    await client.query('COMMIT');

    const expenses = transactions.filter((t) => t.type === 'gasto');
    console.log(`Cuenta creada: ${email}`);
    console.log(
      `Transacciones: ${transactions.length} (${expenses.length} gastos, ${transactions.length - expenses.length} ingresos)`,
    );
    console.log(`Desde ${transactions[0].date} hasta ${transactions.at(-1).date}`);
    console.log(
      `Sin clasificar: ${transactions.filter((t) => t.source === 'sin_clasificar').length}`,
    );
    console.log('Presupuestos del mes actual:');
    for (const b of budgets.filter((x) => x.month === today.slice(0, 7))) {
      const spent = transactions
        .filter(
          (t) => t.type === 'gasto' && t.category === b.category && t.date.startsWith(b.month),
        )
        .reduce((sum, t) => sum + t.amount, 0);
      console.log(
        `  ${b.category}: ${spent} de ${b.limit} (${Math.round((spent / b.limit) * 100)} %)`,
      );
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// Solo se ejecuta al correrlo directamente (las pruebas importan las funciones sin ejecutar `main`).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-demo.js')) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
