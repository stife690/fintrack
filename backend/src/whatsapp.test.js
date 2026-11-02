import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';

// `env.js` lee las variables al importarse: estos valores van antes y evitan llamar a la IA real.
const SECRET = 'secreto-de-prueba';
const VERIFY = 'token-de-prueba';
const BOT_ID = '123456';
Object.assign(process.env, {
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: BOT_ID,
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_VERIFY_TOKEN: VERIFY,
  WHATSAPP_BOT_NUMBER: '15551234567',
  AI_API_KEY: '',
});
const { createApp } = await import('./app.js');
const { pool } = await import('./config/db.js');
const { env } = await import('./config/env.js');
const { signAccessToken } = await import('./services/token.service.js');

// Usa la base real: necesita el esquema de `db/init/` (o el parche 010).
const { rows } = await pool.query("SELECT to_regclass('public.whatsapp_mensajes') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@whatsapp-test.fintrack.test';
const realFetch = globalThis.fetch;
/** Mensajes que el bot le habría enviado a Meta. */
const outbox = [];
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://graph.facebook.com/')) return realFetch(url, init);
  outbox.push(JSON.parse(init.body));
  return new Response('{}', { status: 200 });
};

after(async () => {
  globalThis.fetch = realFetch;
  if (!options.skip) await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

/**
 * Crea un usuario de prueba.
 * @param {{ allowed?: boolean }} [options] `allowed: false` lo deja fuera de la lista del bot.
 * @returns {Promise<{ id: string, token: string }>}
 */
async function createUser({ allowed = true } = {}) {
  const email = `${randomUUID()}${TEST_DOMAIN}`;
  const { rows: created } = await pool.query(
    'INSERT INTO usuarios (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, 'x'],
  );
  if (allowed) env.whatsappAllowedEmails.push(email);
  return { id: created[0].id, token: signAccessToken(created[0].id) };
}

/**
 * Número de prueba único para cada corrida.
 * @returns {string}
 */
function randomPhone() {
  return `57300${Math.floor(Math.random() * 1e7)
    .toString()
    .padStart(7, '0')}`;
}

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(base: string) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withServer(fn) {
  const server = createApp().listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api/v1/whatsapp`);
  } finally {
    server.close();
  }
}

/**
 * Envía un aviso al webhook; sin `secret` va sin firma.
 * @param {string} base
 * @param {object} payload
 * @param {string|null} [secret]
 * @returns {Promise<Response>}
 */
function postWebhook(base, payload, secret = SECRET) {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['X-Hub-Signature-256'] =
      `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }
  return fetch(`${base}/webhook`, { method: 'POST', headers, body });
}

/**
 * Aviso de Meta con un mensaje de texto.
 * @param {string} from
 * @param {string} text
 * @param {string} [id]
 * @returns {object}
 */
function incoming(from, text, id = `wamid.${randomUUID()}`) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: BOT_ID },
              messages: [{ id, from, type: 'text', text: { body: text } }],
            },
          },
        ],
      },
    ],
  };
}

/**
 * Espera a que el bot le responda a un número, porque el webhook procesa después de responder.
 * @param {string} to
 * @param {number} [count] Qué respuesta esperar, contando desde 1.
 * @returns {Promise<string>}
 */
async function waitReply(to, count = 1) {
  for (let i = 0; i < 100; i += 1) {
    const replies = outbox.filter((m) => m.to === to);
    if (replies.length >= count) return replies[count - 1].text.body;
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  throw new Error('El bot no respondió');
}

const json = (token, method = 'GET') => ({ method, headers: { Authorization: `Bearer ${token}` } });

test('Meta verifica el webhook solo con el token correcto', options, async () => {
  await withServer(async (base) => {
    const url = (token) =>
      `${base}/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc123`;
    const ok = await fetch(url(VERIFY));
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), 'abc123');
    assert.equal((await fetch(url('malo'))).status, 403);
  });
});

test('rechaza avisos sin firma o con firma falsa', options, async () => {
  await withServer(async (base) => {
    const payload = incoming(randomPhone(), 'almuerzo 15 mil');
    assert.equal((await postWebhook(base, payload, null)).status, 401);
    assert.equal((await postWebhook(base, payload, 'clave-falsa')).status, 401);
    assert.equal(outbox.length, 0);
  });
});

test('las rutas de conexión exigen sesión', options, async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/link`)).status, 401);
  });
});

test('quien no está en la lista no ve el bot ni puede pedir un código', options, async () => {
  const user = await createUser({ allowed: false });
  await withServer(async (base) => {
    const status = await (await fetch(`${base}/link`, json(user.token))).json();
    assert.equal(status.available, false);
    assert.equal((await fetch(`${base}/link`, json(user.token, 'POST'))).status, 403);
  });
});

test('vincula el número, registra y desconecta', options, async () => {
  const user = await createUser();
  const phone = randomPhone();
  await withServer(async (base) => {
    const before = await (await fetch(`${base}/link`, json(user.token))).json();
    assert.deepEqual(before, {
      available: true,
      linked: false,
      phone: null,
      botNumber: '15551234567',
    });

    assert.equal((await postWebhook(base, incoming(phone, 'almuerzo 15 mil'))).status, 200);
    assert.match(await waitReply(phone), /conecta tu número/);

    const created = await fetch(`${base}/link`, json(user.token, 'POST'));
    assert.equal(created.status, 201);
    const { code } = await created.json();
    assert.match(code, /^FT-[A-Z0-9]{8}$/);

    await postWebhook(base, incoming(phone, code.toLowerCase()));
    assert.match(await waitReply(phone, 2), /quedó conectado/);

    const linked = await (await fetch(`${base}/link`, json(user.token))).json();
    assert.equal(linked.linked, true);
    assert.equal(linked.phone, `•••• ${phone.slice(-4)}`);

    // El mismo aviso dos veces, como cuando Meta reintenta.
    const repeated = incoming(phone, 'almuerzo 15 mil');
    await postWebhook(base, repeated);
    await postWebhook(base, repeated);
    assert.match(await waitReply(phone, 3), /Guardé un gasto de \$15\.000/);
    await postWebhook(base, incoming(phone, 'taxi 12 mil'));
    assert.match(await waitReply(phone, 4), /\$12\.000/);

    const { rows: saved } = await pool.query(
      'SELECT monto::float8 AS amount, origen FROM transacciones WHERE usuario_id = $1 ORDER BY monto DESC',
      [user.id],
    );
    assert.deepEqual(
      saved.map((t) => t.amount),
      [15000, 12000],
    );

    assert.equal((await fetch(`${base}/link`, json(user.token, 'DELETE'))).status, 204);
    await postWebhook(base, incoming(phone, 'pan 3 mil'));
    assert.match(await waitReply(phone, 5), /conecta tu número/);
  });
});

test('un código vencido, usado o de un número ajeno no vincula', options, async () => {
  const first = await createUser();
  const second = await createUser();
  const phone = randomPhone();
  await withServer(async (base) => {
    const { code } = await (await fetch(`${base}/link`, json(first.token, 'POST'))).json();
    await postWebhook(base, incoming(phone, code));
    assert.match(await waitReply(phone), /quedó conectado/);

    await postWebhook(base, incoming(phone, code));
    assert.match(await waitReply(phone, 2), /no es válido/);

    const other = await (await fetch(`${base}/link`, json(second.token, 'POST'))).json();
    await postWebhook(base, incoming(phone, other.code));
    assert.match(await waitReply(phone, 3), /otra cuenta/);

    const expired = await (await fetch(`${base}/link`, json(second.token, 'POST'))).json();
    await pool.query(
      "UPDATE whatsapp_vinculos SET codigo_expira = now() - interval '1 minute' WHERE usuario_id = $1",
      [second.id],
    );
    await postWebhook(base, incoming(randomPhone(), expired.code));
    const status = await (await fetch(`${base}/link`, json(second.token))).json();
    assert.equal(status.linked, false);
  });
});
