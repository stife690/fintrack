import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createDiskStorage,
  createSupabaseStorage,
  selectStorage,
} from './services/attachment-storage.service.js';
import { cleanName, createAttachmentsService, detectType } from './services/attachments.service.js';

// Soportes de pago (FT-0044), sin base de datos.

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1');
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1');
const EXE = Buffer.from('MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000', 'latin1');

test('reconoce el tipo por los primeros bytes, no por el nombre', () => {
  assert.deepEqual(detectType(JPG), { type: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(detectType(PNG), { type: 'image/png', ext: 'png' });
  assert.deepEqual(detectType(WEBP), { type: 'image/webp', ext: 'webp' });
  assert.deepEqual(detectType(PDF), { type: 'application/pdf', ext: 'pdf' });
  assert.equal(detectType(EXE), null, 'un ejecutable no pasa aunque se llame foto.jpg');
  assert.equal(detectType(Buffer.from('hola')), null);
});

test('el nombre para mostrar no trae carpetas ni caracteres de control', () => {
  assert.equal(cleanName('../../.env', 'jpg'), '.env');
  assert.equal(cleanName('C:\\fotos\\factura.jpg', 'jpg'), 'factura.jpg');
  assert.equal(cleanName('fac\r\ntura.pdf', 'pdf'), 'factura.pdf');
  assert.equal(cleanName('', 'pdf'), 'soporte.pdf');
  assert.equal(cleanName(undefined, 'jpg'), 'soporte.jpg');
  assert.equal(cleanName('x'.repeat(200), 'jpg').length, 120);
});

test('quién puede usarlos: lista de correos, todos con *, y nadie sin dónde guardar', () => {
  const storage = createDiskStorage(tmpdir());
  const service = (config, s = storage) => createAttachmentsService({ storage: s, config });
  const prod = (list) => service({ nodeEnv: 'production', attachmentsAllowedEmails: list });

  assert.equal(
    prod([]).isEnabledFor('ana@correo.com'),
    false,
    'en producción, lista vacía es nadie',
  );
  assert.equal(prod(['ana@correo.com']).isEnabledFor('Ana@Correo.com'), true);
  assert.equal(prod(['ana@correo.com']).isEnabledFor('otro@correo.com'), false);
  assert.equal(prod(['*']).isEnabledFor('otro@correo.com'), true);
  assert.equal(
    service({ nodeEnv: 'development', attachmentsAllowedEmails: [] }).isEnabledFor('a@b.co'),
    true,
    'en desarrollo, lista vacía es todos',
  );
  assert.equal(
    service({ nodeEnv: 'production', attachmentsAllowedEmails: ['*'] }, null).isEnabledFor(
      'a@b.co',
    ),
    false,
  );
});

test('en producción sin Supabase no hay almacenamiento: nunca el disco de Render', () => {
  const base = { attachmentsBucket: 'soportes', uploadsDir: 'uploads' };
  assert.equal(selectStorage({ ...base, nodeEnv: 'production' }), null);
  assert.equal(selectStorage({ ...base, nodeEnv: 'development' }).kind, 'disco');
  const withSupabase = {
    ...base,
    nodeEnv: 'production',
    supabaseUrl: 'https://x.supabase.co',
    supabaseServiceKey: 'k',
  };
  assert.equal(selectStorage(withSupabase).kind, 'supabase');
});

test('el disco guarda, lee y borra (y borrar dos veces no falla)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'soportes-'));
  try {
    const disk = createDiskStorage(dir);
    await disk.save('usuario/archivo.pdf', PDF, 'application/pdf');
    assert.deepEqual(await disk.read('usuario/archivo.pdf'), PDF);
    await disk.remove(['usuario/archivo.pdf']);
    await disk.remove(['usuario/archivo.pdf']);
    await assert.rejects(disk.read('usuario/archivo.pdf'), { code: 'ENOENT' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Supabase: pide al espacio privado con la clave del backend', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers, body: init.body });
    return { ok: true, arrayBuffer: async () => PDF };
  };
  const storage = createSupabaseStorage({
    url: 'https://x.supabase.co',
    key: 'clave',
    bucket: 'soportes',
    fetchImpl,
  });

  await storage.save('u/a.pdf', PDF, 'application/pdf');
  assert.deepEqual(await storage.read('u/a.pdf'), PDF);
  await storage.remove(['u/a.pdf']);

  assert.deepEqual(
    calls.map((c) => [c.method, c.url]),
    [
      ['POST', 'https://x.supabase.co/storage/v1/object/soportes/u/a.pdf'],
      ['GET', 'https://x.supabase.co/storage/v1/object/soportes/u/a.pdf'],
      ['DELETE', 'https://x.supabase.co/storage/v1/object/soportes'],
    ],
  );
  assert.equal(calls[0].headers.Authorization, 'Bearer clave');
  assert.equal(calls[0].headers['Content-Type'], 'application/pdf');
  assert.deepEqual(JSON.parse(calls[2].body), { prefixes: ['u/a.pdf'] });
});

test('Supabase: si responde con error, se avisa', async () => {
  const storage = createSupabaseStorage({
    url: 'https://x.supabase.co',
    key: 'k',
    bucket: 'soportes',
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });
  await assert.rejects(storage.read('u/a.pdf'), /403/);
});
