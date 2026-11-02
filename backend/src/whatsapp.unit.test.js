import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseSpokenTransaction } from './services/entry-parser.js';
import {
  REPLIES,
  createWhatsappService,
  extractMessages,
  isValidSignature,
  maskPhone,
} from './services/whatsapp.service.js';

const PHONE = '573001112233';
const message = (text, id = 'wamid.1') => ({ id, from: PHONE, text });

/**
 * Servicio con repositorio en memoria.
 * @param {{ linked?: boolean, recent?: number, save?: (userId: string, input: object) => Promise<object> }} [options]
 * @returns {{ service: ReturnType<typeof createWhatsappService>, sent: string[], saved: object[] }}
 */
function setup(options = {}) {
  const { linked = true, recent = 0, save } = options;
  const sent = [];
  const saved = [];
  const claimed = new Set();
  const service = createWhatsappService({
    repository: {
      findUserIdByPhone: async () => (linked ? 'usuario-1' : null),
      confirmLink: async () => 'linked',
      countRecentMessages: async () => recent,
      claimMessage: async ({ messageId }) => {
        if (claimed.has(messageId)) return false;
        claimed.add(messageId);
        return true;
      },
    },
    createTransaction:
      save ??
      (async (_userId, input) => {
        saved.push(input);
        return { ...input, category: 'alimentacion' };
      }),
    listCategories: async () => [{ key: 'alimentacion', name: 'Alimentación' }],
    sendText: async (_to, body) => sent.push(body),
    now: () => new Date('2026-11-02T15:00:00Z'),
    dailyMax: 3,
  });
  return { service, sent, saved };
}

test('la copia del analizador es igual a la del frontend', async () => {
  const body = (text) => text.slice(text.indexOf('/**\n * Convierte lo que el usuario dijo'));
  const clean = (text) => body(text.replace(/\r\n/g, '\n'));
  const [frontend, backend] = await Promise.all([
    readFile(new URL('../../frontend/src/lib/voiceEntry.js', import.meta.url), 'utf8'),
    readFile(new URL('./services/entry-parser.js', import.meta.url), 'utf8'),
  ]);
  assert.equal(clean(backend), clean(frontend));
});

test('el analizador toma "me entraron" como ingreso', () => {
  const parsed = parseSpokenTransaction('me entraron 15palos de un trabajo');
  assert.equal(parsed.type, 'ingreso');
  assert.equal(parsed.amount, 15_000_000);
  assert.equal(parsed.description, 'Un trabajo');
});

test('el analizador entiende un gasto y un ingreso', () => {
  const now = new Date('2026-11-02T12:00:00');
  assert.deepEqual(
    (({ type, amount, description }) => ({ type, amount, description }))(
      parseSpokenTransaction('almuerzo 15 mil', now),
    ),
    { type: 'gasto', amount: 15000, description: 'Almuerzo' },
  );
  assert.equal(parseSpokenTransaction('me pagaron 1,2 millones', now).type, 'ingreso');
});

test('la firma solo es válida con la clave y el cuerpo correctos', () => {
  const body = Buffer.from('{"a":1}');
  const good = `sha256=${createHmac('sha256', 'secreto').update(body).digest('hex')}`;
  assert.equal(isValidSignature(body, good, 'secreto'), true);
  assert.equal(isValidSignature(Buffer.from('{"a":2}'), good, 'secreto'), false);
  assert.equal(isValidSignature(body, good, 'otra'), false);
  assert.equal(isValidSignature(body, undefined, 'secreto'), false);
  assert.equal(isValidSignature(body, good, undefined), false);
});

test('extractMessages ignora avisos de estado y otros números', () => {
  const value = (id, extra) => ({ changes: [{ value: { metadata: { phone_number_id: id }, ...extra } }] });
  const text = { id: 'm1', from: '+57 300', type: 'text', text: { body: ' hola ' } };
  const payload = {
    entry: [
      value('bot', { statuses: [{ id: 's1' }] }),
      value('otro', { messages: [text] }),
      value('bot', { messages: [text, { id: 'm2', from: '57300', type: 'image' }] }),
    ],
  };
  assert.deepEqual(extractMessages(payload, 'bot'), [
    { id: 'm1', from: '57300', text: 'hola' },
    { id: 'm2', from: '57300', text: null },
  ]);
  assert.deepEqual(extractMessages({}, 'bot'), []);
});

test('maskPhone solo deja los últimos cuatro dígitos', () => {
  assert.equal(maskPhone(PHONE), '•••• 2233');
});

test('registra el movimiento y confirma', async () => {
  const { service, sent, saved } = setup();
  await service.handleMessage(message('almuerzo 15 mil'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].amount, 15000);
  assert.equal(saved[0].date, '2026-11-02');
  assert.ok(saved[0].localId.length <= 64);
  assert.match(sent[0], /^Guardé un gasto de \$15\.000 en Alimentación\.$/);
});

test('un mensaje reenviado por Meta no se registra dos veces', async () => {
  const { service, sent, saved } = setup();
  await service.handleMessage(message('almuerzo 15 mil'));
  await service.handleMessage(message('almuerzo 15 mil'));
  assert.equal(saved.length, 1);
  assert.equal(sent.length, 1);
});

test('pregunta en vez de adivinar', async () => {
  const cases = [
    ['hola', REPLIES.noAmount],
    ['2 almuerzos de 12 mil', REPLIES.severalAmounts],
    ['15 mil', REPLIES.noDescription],
  ];
  for (const [i, [text, reply]] of cases.entries()) {
    const { service, sent, saved } = setup();
    await service.handleMessage(message(text, `m${i}`));
    assert.equal(sent[0], reply);
    assert.equal(saved.length, 0);
  }
});

test('un número sin vincular no registra nada', async () => {
  const { service, sent, saved } = setup({ linked: false });
  await service.handleMessage(message('almuerzo 15 mil'));
  assert.equal(sent[0], REPLIES.unlinked);
  assert.equal(saved.length, 0);
});

test('solo acepta texto y respeta el límite diario', async () => {
  const media = setup();
  await media.service.handleMessage(message(null));
  assert.equal(media.sent[0], REPLIES.textOnly);

  const limit = setup({ recent: 3 });
  await limit.service.handleMessage(message('almuerzo 15 mil'));
  assert.equal(limit.sent[0], REPLIES.dailyLimit);
  assert.equal(limit.saved.length, 0);
});

test('si no se puede guardar, avisa', async () => {
  const { service, sent } = setup({
    save: async () => {
      throw new Error('falló');
    },
  });
  await service.handleMessage(message('almuerzo 15 mil'));
  assert.equal(sent[0], REPLIES.failed);
});
