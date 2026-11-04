import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReminderScheduler } from './services/reminder-scheduler.service.js';

const CARD = {
  id: 'c1',
  name: 'Amex Blue ••1234',
  used: 500000,
  statementTotal: 616000,
  nextPaymentDate: '2026-11-15',
  daysToPayment: 3,
  paidThisCycle: false,
  reminderSentFor: null,
};

/** Arma un programador con una tarjeta y un usuario (09:00 en Bogotá = 14:00 UTC). */
function setup(card = {}) {
  const sent = [];
  const cards = [{ ...CARD, ...card }];
  const scheduler = createReminderScheduler({
    listCandidates: async () => [],
    listCardUsers: async () => [{ id: 'u1', timezone: 'America/Bogota', time: '09:00' }],
    listUserCards: async () => cards.map((c) => ({ ...c })),
    sendToUser: async (id, payload) => sent.push([id, payload]),
    markCardReminded: async (_id, _user, date) => {
      cards[0].reminderSentFor = date;
    },
    now: () => new Date('2026-11-12T14:00:00Z'),
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  return { scheduler, sent };
}

test('una tarjeta a 3 días del pago envía un solo push aunque el tick corra dos veces', async () => {
  const { scheduler, sent } = setup();
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], [
    'u1',
    {
      title: 'Pago de tarjeta',
      body: 'Tu Amex Blue ••1234 se paga el 15 nov. Debes $616.000.',
      url: '/app/tarjetas/c1',
    },
  ]);
});

test('sin extracto el monto es lo usado', async () => {
  const { scheduler, sent } = setup({ statementTotal: null });
  await scheduler.tick();
  assert.match(sent[0][1].body, /Debes \$500\.000\.$/);
});

test('con la tarjeta pagada o a otra distancia no envía nada', async () => {
  for (const change of [{ paidThisCycle: true }, { daysToPayment: 2 }]) {
    const { scheduler, sent } = setup(change);
    await scheduler.tick();
    assert.equal(sent.length, 0);
  }
});

test('sin nada que pagar no envía "Debes $0"', async () => {
  const { scheduler, sent } = setup({ used: 0, statementTotal: null });
  await scheduler.tick();
  assert.equal(sent.length, 0);
});

test('fuera de la hora del usuario no envía nada', async () => {
  const { scheduler, sent } = setup();
  const late = createReminderScheduler({
    listCandidates: async () => [],
    listCardUsers: async () => [{ id: 'u1', timezone: 'America/Bogota', time: '20:00' }],
    listUserCards: async () => [CARD],
    sendToUser: async (id, p) => sent.push([id, p]),
    now: () => new Date('2026-11-12T14:00:00Z'),
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  await late.tick();
  await scheduler.tick(); // control: sí envía a su hora
  assert.equal(sent.length, 1);
});

test('con cardReminders en false no hay usuarios que avisar', async () => {
  // El filtro vive en listCardReminderUsers (recordar_tarjetas); aquí se verifica que sin usuarios no se envía.
  const sent = [];
  const scheduler = createReminderScheduler({
    listCandidates: async () => [],
    listCardUsers: async () => [],
    sendToUser: async (id, p) => sent.push([id, p]),
    now: () => new Date('2026-11-12T14:00:00Z'),
  });
  await scheduler.tick();
  assert.equal(sent.length, 0);
});
