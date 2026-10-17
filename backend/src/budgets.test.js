import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/`.
// Si la tabla `presupuestos` no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query("SELECT to_regclass('public.presupuestos') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@budgets-test.fintrack.test';
const MONTH = '2026-10';

// Borra los usuarios de prueba; sus presupuestos y transacciones caen por ON DELETE CASCADE.
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});
/**
 * Cliente de prueba: hace una petición a la API y devuelve el código y el cuerpo.
 * @typedef {(path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: object }>} Api
 */

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(api: Api) => Promise<void>} fn
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
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

/**
 * Registra un usuario nuevo y devuelve su access token.
 * @param {Api} api
 * @returns {Promise<string>}
 */
async function newUserToken(api) {
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' },
  });
  return body.accessToken;
}

/**
 * Crea un presupuesto de prueba y devuelve la respuesta.
 * @param {Api} api
 * @param {string} token
 * @param {object} [overrides]
 * @returns {Promise<{ status: number, body: object }>}
 */
function createBudget(api, token, overrides = {}) {
  return api('/budgets', {
    method: 'POST',
    token,
    body: { category: 'alimentacion', month: MONTH, amount: 100000, ...overrides },
  });
}
test('todas las rutas de presupuestos exigen access token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/budgets')).status, 401);
    assert.equal((await api('/budgets', { method: 'POST', body: {} })).status, 401);
  });
});

test('crear devuelve 201 con la forma BudgetCreated del contrato', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const res = await createBudget(api, token);
    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body).sort(), ['amount', 'category', 'id', 'month']);
    assert.equal(res.body.category, 'alimentacion');
    assert.equal(res.body.month, MONTH);
    assert.equal(res.body.amount, 100000);
  });
});

test(
  'un presupuesto por categoría y mes: el repetido da 409 BUDGET_EXISTS (RN-03)',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      await createBudget(api, token);
      const repeated = await createBudget(api, token, { amount: 5 });
      assert.equal(repeated.status, 409);
      assert.equal(repeated.body.error.code, 'BUDGET_EXISTS');

      const otherMonth = await createBudget(api, token, { month: '2026-11' });
      assert.equal(otherMonth.status, 201, 'la misma categoría en otro mes sí se permite');
    });
  },
);

test('solo se permiten categorías de gasto del catálogo (422)', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    for (const category of ['salario', 'no-existe']) {
      const res = await createBudget(api, token, { category });
      assert.equal(res.status, 422);
      assert.deepEqual(
        res.body.error.details.map((d) => d.field),
        ['category'],
      );
    }
  });
});
test(
  'el listado suma solo los gastos del mes y la categoría, sin los borrados',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      await createBudget(api, token);

      const spend = (overrides) =>
        api('/transactions', {
          method: 'POST',
          token,
          body: {
            amount: 1,
            description: 'prueba',
            type: 'gasto',
            category: 'alimentacion',
            date: '2026-10-15',
            ...overrides,
          },
        });
      await spend({ amount: 50000, date: '2026-10-01' });
      await spend({ amount: 35000.5, date: '2026-10-31' });
      await spend({ amount: 10000, category: 'transporte' }); // otra categoría
      await spend({ amount: 70000, date: '2026-11-01' }); // otro mes
      const deleted = await spend({ amount: 99999 }); // se borra abajo
      await api(`/transactions/${deleted.body.transaction.id}`, { method: 'DELETE', token });

      const res = await api(`/budgets?month=${MONTH}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
      assert.deepEqual(res.body[0], {
        id: res.body[0].id,
        category: 'alimentacion',
        month: MONTH,
        amount: 100000,
        consumed: 85000.5,
        percentage: 85,
        alert: { level: 'warning_80', percentage: 85 },
      });
    });
  },
);

test('sin ?month= se listan los del mes actual; un mes inválido da 422', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const current = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());
    await createBudget(api, token, { month: current });

    const res = await api('/budgets', { token });
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((b) => b.month),
      [current],
    );

    const invalid = await api('/budgets?month=octubre', { token });
    assert.equal(invalid.status, 422);
  });
});
test('editar el monto recalcula el porcentaje y la alerta (REQ-017)', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const { body: budget } = await createBudget(api, token);
    await api('/transactions', {
      method: 'POST',
      token,
      body: {
        amount: 85000,
        description: 'mercado',
        type: 'gasto',
        category: 'alimentacion',
        date: '2026-10-15',
      },
    });

    const res = await api(`/budgets/${budget.id}`, {
      method: 'PUT',
      token,
      body: { amount: 80000 },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.amount, 80000);
    assert.equal(res.body.percentage, 106.25);
    assert.equal(res.body.alert.level, 'exceeded_100');
  });
});

test(
  'un usuario no puede ver, editar ni borrar el presupuesto de otro (404, RN-01)',
  options,
  async () => {
    await withApi(async (api) => {
      const owner = await newUserToken(api);
      const intruder = await newUserToken(api);
      const { body: budget } = await createBudget(api, owner);

      const list = await api(`/budgets?month=${MONTH}`, { token: intruder });
      assert.deepEqual(list.body, []);

      const edit = await api(`/budgets/${budget.id}`, {
        method: 'PUT',
        token: intruder,
        body: { amount: 1 },
      });
      assert.equal(edit.status, 404);
      assert.equal(edit.body.error.code, 'NOT_FOUND');

      const remove = await api(`/budgets/${budget.id}`, { method: 'DELETE', token: intruder });
      assert.equal(remove.status, 404);
    });
  },
);

test('borrar responde 204, y después el presupuesto ya no existe (404)', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const { body: budget } = await createBudget(api, token);

    assert.equal((await api(`/budgets/${budget.id}`, { method: 'DELETE', token })).status, 204);
    assert.equal((await api(`/budgets/${budget.id}`, { method: 'DELETE', token })).status, 404);
    assert.equal((await api('/budgets/no-es-un-uuid', { method: 'DELETE', token })).status, 404);
  });
});