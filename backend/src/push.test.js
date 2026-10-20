import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors/app-error.js';
import {
  parseReminderSettings,
  parseSubscribeBody,
  parseUnsubscribeBody,
} from './validators/push.validator.js';
import { createPushSender } from './services/push-sender.service.js';
import { createPushService } from './services/push.service.js';
import {
  checkReminderDue,
  createReminderScheduler,
  REMINDER_PAYLOAD,
} from './services/reminder-scheduler.service.js';

const SUBSCRIPTION = {
  endpoint: 'https://push.example.com/abc',
  keys: { p256dh: 'clave-publica', auth: 'secreto' },
};

/**
 * @param {() => unknown} fn
 * @param {number} status
 * @param {string} [field] Campo que debe aparecer en `details`.
 * @returns {void}
 */
function assertAppError(fn, status, field) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, status);
    assert.equal(err.code, 'VALIDATION_ERROR');
    if (field)
      assert.ok(
        err.details.some((d) => d.field === field),
        `falta detalle de ${field}`,
      );
    return true;
  });
}

// ---------------------------------------------------------------- validadores

test('parseSubscribeBody acepta una suscripción válida', () => {
  assert.deepEqual(parseSubscribeBody({ subscription: SUBSCRIPTION }), SUBSCRIPTION);
});

test('parseSubscribeBody rechaza con 400 cuerpos sin la forma de una suscripción', () => {
  const bad = [
    undefined,
    {},
    { subscription: 'texto' },
    { subscription: { endpoint: 'http://inseguro.test/x', keys: SUBSCRIPTION.keys } },
    { subscription: { endpoint: 'no-es-url', keys: SUBSCRIPTION.keys } },
    { subscription: { endpoint: SUBSCRIPTION.endpoint } },
    { subscription: { endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: 'a' } } },
    { subscription: { endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: '', auth: 'b' } } },
  ];
  for (const body of bad) assertAppError(() => parseSubscribeBody(body), 400);
});

test('parseUnsubscribeBody exige un endpoint de texto', () => {
  assert.equal(parseUnsubscribeBody({ endpoint: SUBSCRIPTION.endpoint }), SUBSCRIPTION.endpoint);
  assertAppError(() => parseUnsubscribeBody({}), 400);
  assertAppError(() => parseUnsubscribeBody({ endpoint: 5 }), 400);
});

test('parseReminderSettings acepta varias horas (ordenadas y sin repetir) y [] para desactivar', () => {
  assert.deepEqual(
    parseReminderSettings({ times: ['20:00', '08:30', '20:00'], timezone: 'America/Bogota' }),
    { times: ['08:30', '20:00'], timezone: 'America/Bogota' },
  );
  assert.deepEqual(parseReminderSettings({ times: [], timezone: 'UTC' }), {
    times: [],
    timezone: 'UTC',
  });
});

test('parseReminderSettings sigue aceptando `time` de los clientes anteriores', () => {
  assert.deepEqual(parseReminderSettings({ time: '20:00', timezone: 'UTC' }), {
    times: ['20:00'],
    timezone: 'UTC',
  });
  assert.deepEqual(parseReminderSettings({ time: null, timezone: 'UTC' }), {
    times: [],
    timezone: 'UTC',
  });
});

test('parseReminderSettings: tipos incorrectos → 400; horas, cantidad o zona inválidas → 422 con details', () => {
  assertAppError(() => parseReminderSettings({ time: 20, timezone: 'UTC' }), 400);
  assertAppError(() => parseReminderSettings({ times: '20:00', timezone: 'UTC' }), 400);
  assertAppError(() => parseReminderSettings({ times: [20], timezone: 'UTC' }), 400);
  assertAppError(() => parseReminderSettings({ times: ['20:00'] }), 400);
  assertAppError(() => parseReminderSettings({ timezone: 'UTC' }), 400);
  assertAppError(() => parseReminderSettings(null), 400);
  assertAppError(() => parseReminderSettings({ time: '24:00', timezone: 'UTC' }), 422, 'time');
  assertAppError(() => parseReminderSettings({ times: ['8:00'], timezone: 'UTC' }), 422, 'times');
  assertAppError(
    () =>
      parseReminderSettings({
        times: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
        timezone: 'UTC',
      }),
    422,
    'times',
  );
  assertAppError(
    () => parseReminderSettings({ times: ['20:00'], timezone: 'Marte/Olimpo' }),
    422,
    'timezone',
  );
});

// ---------------------------------------------------------------- emisor

test('el emisor firma con VAPID y reporta ok', async () => {
  const calls = [];
  const sender = createPushSender({
    publicKey: 'pub',
    privateKey: 'priv',
    subject: 'mailto:a@b.co',
    client: {
      sendNotification: async (...args) => {
        calls.push(args);
      },
    },
  });
  assert.equal(sender.isConfigured, true);
  assert.deepEqual(await sender.send(SUBSCRIPTION, { title: 'Hola' }), { ok: true, gone: false });
  assert.equal(calls[0][1], JSON.stringify({ title: 'Hola' }));
  assert.deepEqual(calls[0][2].vapidDetails, {
    subject: 'mailto:a@b.co',
    publicKey: 'pub',
    privateKey: 'priv',
  });
});

test('el emisor marca como "gone" las suscripciones 404/410 y no lanza con otros errores', async () => {
  const failing = (statusCode) =>
    createPushSender({
      publicKey: 'pub',
      privateKey: 'priv',
      client: {
        sendNotification: async () => {
          throw Object.assign(new Error('fallo'), { statusCode });
        },
      },
    });
  assert.deepEqual(await failing(410).send(SUBSCRIPTION, {}), { ok: false, gone: true });
  assert.deepEqual(await failing(404).send(SUBSCRIPTION, {}), { ok: false, gone: true });
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await failing(500).send(SUBSCRIPTION, {}), { ok: false, gone: false });
  } finally {
    console.error = original;
  }
});

test('sin llaves VAPID el emisor queda desconfigurado', () => {
  assert.equal(
    createPushSender({ publicKey: undefined, privateKey: undefined }).isConfigured,
    false,
  );
});

// ---------------------------------------------------------------- servicio

/**
 * @param {object} [overrides]
 * @returns {{ service: ReturnType<typeof createPushService>, store: object }}
 */
function buildService(overrides = {}) {
  const store = { saved: [], deleted: [], devices: [SUBSCRIPTION], removedOnSend: [] };
  const service = createPushService({
    vapidPublicKey: 'clave-vapid',
    sender: overrides.sender ?? {
      isConfigured: true,
      send: async () => ({ ok: true, gone: false }),
    },
    subscriptions: {
      upsertSubscription: async (data) => store.saved.push(data),
      deleteSubscription: async (data) => {
        store.deleted.push(data);
        return overrides.deleteResult ?? true;
      },
      deleteSubscriptionByEndpoint: async (endpoint) => store.removedOnSend.push(endpoint),
      listSubscriptionsByUser: async () => store.devices,
    },
    reminders: {
      findReminderSettings: async () =>
        'settings' in overrides
          ? overrides.settings
          : { times: ['08:00', '20:00'], timezone: 'UTC' },
      saveReminderSettings: async (_id, settings) =>
        overrides.settings === null ? null : settings,
    },
  });
  return { service, store };
}

test('getVapidPublicKey devuelve la llave, o 500 si el push no está configurado', () => {
  assert.deepEqual(buildService().service.getVapidPublicKey(), { key: 'clave-vapid' });
  const unconfigured = createPushService({ vapidPublicKey: undefined });
  assert.throws(
    () => unconfigured.getVapidPublicKey(),
    (err) => err.statusCode === 500 && err.code === 'INTERNAL_ERROR',
  );
});

test('subscribe guarda la suscripción del usuario', async () => {
  const { service, store } = buildService();
  await service.subscribe('u1', SUBSCRIPTION);
  assert.deepEqual(store.saved, [{ userId: 'u1', ...SUBSCRIPTION }]);
});

test('unsubscribe responde 404 si la suscripción no existe o es de otro usuario', async () => {
  const { service } = buildService({ deleteResult: false });
  await assert.rejects(
    () => service.unsubscribe('u1', SUBSCRIPTION.endpoint),
    (err) => err.statusCode === 404 && err.code === 'NOT_FOUND',
  );
  await buildService().service.unsubscribe('u1', SUBSCRIPTION.endpoint);
});

test('sendToUser envía a cada dispositivo y borra los que el navegador dio de baja', async () => {
  const { service, store } = buildService({
    sender: { isConfigured: true, send: async () => ({ ok: false, gone: true }) },
  });
  assert.deepEqual(await service.sendToUser('u1', { title: 'x' }), { sent: 0, removed: 1 });
  assert.deepEqual(store.removedOnSend, [SUBSCRIPTION.endpoint]);

  const ok = buildService();
  assert.deepEqual(await ok.service.sendToUser('u1', { title: 'x' }), { sent: 1, removed: 0 });
});

test('sendToUser no hace nada si el push no está configurado', async () => {
  const { service } = buildService({
    sender: { isConfigured: false, send: async () => assert.fail() },
  });
  assert.deepEqual(await service.sendToUser('u1', {}), { sent: 0, removed: 0 });
});

test('reminder-settings: lee y actualiza; con cuenta inexistente responde 401', async () => {
  const { service } = buildService();
  assert.deepEqual(await service.getReminderSettings('u1'), {
    times: ['08:00', '20:00'],
    time: '08:00',
    timezone: 'UTC',
  });
  assert.deepEqual(await service.updateReminderSettings('u1', { times: [], timezone: 'UTC' }), {
    times: [],
    time: null,
    timezone: 'UTC',
  });
  const gone = buildService({ settings: null }).service;
  await assert.rejects(
    () => gone.getReminderSettings('u1'),
    (err) => err.statusCode === 401,
  );
});

// ---------------------------------------------------------------- programador

test('checkReminderDue respeta la zona horaria del usuario', () => {
  // 01:00 UTC del 14/10 = 20:00 del 13/10 en Bogotá (UTC-5).
  const now = new Date('2026-10-14T01:00:00Z');
  assert.equal(checkReminderDue({ time: '20:00', timezone: 'America/Bogota', now }).due, true);
  assert.equal(checkReminderDue({ time: '20:00', timezone: 'UTC', now }).due, false);
  assert.equal(checkReminderDue({ time: '01:00', timezone: 'UTC', now }).due, true);
});

test('checkReminderDue tolera unos minutos de retraso y no avisa antes de la hora', () => {
  const at = (hhmm) => new Date(`2026-10-14T${hhmm}:00Z`);
  const due = (hhmm) => checkReminderDue({ time: '20:00', timezone: 'UTC', now: at(hhmm) }).due;
  assert.equal(due('19:59'), false);
  assert.equal(due('20:00'), true);
  assert.equal(due('20:04'), true);
  assert.equal(due('20:05'), false);
});

test('checkReminderDue usa la misma clave de día al cruzar la medianoche local', () => {
  const before = checkReminderDue({
    time: '23:58',
    timezone: 'UTC',
    now: new Date('2026-10-14T23:58:00Z'),
  });
  const after = checkReminderDue({
    time: '23:58',
    timezone: 'UTC',
    now: new Date('2026-10-15T00:01:00Z'),
  });
  assert.equal(before.due, true);
  assert.equal(after.due, true);
  assert.equal(before.key, after.key);
});

test('el programador envía una vez al día y omite a quien no tiene notificaciones activadas', async () => {
  const sent = [];
  const logs = [];
  let clock = new Date('2026-10-14T01:00:00Z');
  const scheduler = createReminderScheduler({
    listCandidates: async () => [
      { id: 'con-push', times: ['20:00'], timezone: 'America/Bogota', hasSubscription: true },
      { id: 'sin-push', times: ['20:00'], timezone: 'America/Bogota', hasSubscription: false },
      { id: 'otra-hora', times: ['07:00'], timezone: 'America/Bogota', hasSubscription: true },
    ],
    sendToUser: async (id, payload) => sent.push([id, payload]),
    now: () => clock,
    log: { info: (m) => logs.push(m), error: (m) => assert.fail(m) },
  });

  assert.deepEqual(await scheduler.tick(), { sent: 1, skipped: 1 });
  assert.deepEqual(sent, [['con-push', REMINDER_PAYLOAD]]);
  assert.match(logs[0], /sin-push/);

  // Un minuto después, dentro de la ventana: no se repite.
  clock = new Date('2026-10-14T01:01:00Z');
  assert.deepEqual(await scheduler.tick(), { sent: 0, skipped: 0 });

  // Al día siguiente vuelve a enviarse.
  clock = new Date('2026-10-15T01:00:00Z');
  assert.deepEqual(await scheduler.tick(), { sent: 1, skipped: 1 });
});

test('un fallo con un usuario no impide avisar a los demás', async () => {
  const sent = [];
  const errors = [];
  const scheduler = createReminderScheduler({
    listCandidates: async () => [
      { id: 'falla', times: ['20:00'], timezone: 'UTC', hasSubscription: true },
      { id: 'bien', times: ['20:00'], timezone: 'UTC', hasSubscription: true },
    ],
    sendToUser: async (id) => {
      if (id === 'falla') throw new Error('boom');
      sent.push(id);
    },
    now: () => new Date('2026-10-14T20:00:00Z'),
    log: { info: () => {}, error: (m) => errors.push(m) },
  });
  assert.deepEqual(await scheduler.tick(), { sent: 1, skipped: 0 });
  assert.deepEqual(sent, ['bien']);
  assert.match(errors[0], /falla/);
});

test('el programador envía cada hora del usuario por separado, una vez al día cada una', async () => {
  const sent = [];
  let clock = new Date('2026-10-14T13:00:00Z'); // 08:00 en Bogotá
  const scheduler = createReminderScheduler({
    listCandidates: async () => [
      { id: 'u1', times: ['08:00', '20:00'], timezone: 'America/Bogota', hasSubscription: true },
    ],
    sendToUser: async (id) => sent.push(id),
    now: () => clock,
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });

  assert.deepEqual(await scheduler.tick(), { sent: 1, skipped: 0 }); // la de las 8
  assert.deepEqual(await scheduler.tick(), { sent: 0, skipped: 0 }); // no se repite

  clock = new Date('2026-10-15T01:00:00Z'); // 20:00 en Bogotá
  assert.deepEqual(await scheduler.tick(), { sent: 1, skipped: 0 }); // la de las 20
  assert.deepEqual(sent, ['u1', 'u1']);
});
