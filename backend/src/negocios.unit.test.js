import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDetail, ownersAfter, totalShareWith } from './services/negocios.service.js';
import {
  parseBusinessChanges,
  parseInvitation,
  parseNewBusiness,
  parsePartnerChanges,
} from './validators/negocios.validator.js';

/**
 * Comprueba que `fn` lance un 422 con esos campos en `details`.
 * @param {() => unknown} fn
 * @param {string[]} fields
 * @returns {void}
 */
function assertInvalid(fn, fields) {
  assert.throws(fn, (err) => {
    assert.equal(err.statusCode, 422);
    assert.deepEqual(
      err.details.map((d) => d.field),
      fields,
    );
    return true;
  });
}

const partners = [
  { userId: 'a', name: 'Ana', email: 'ana@x.co', role: 'dueno', share: 60, joinedAt: new Date() },
  { userId: 'b', name: null, email: 'beto@x.co', role: 'editor', share: 30, joinedAt: new Date() },
  {
    userId: 'c',
    name: 'Caro',
    email: 'caro@x.co',
    role: 'lector',
    share: null,
    joinedAt: new Date(),
  },
];

test('totalShareWith: suma las participaciones con el cambio de un socio', () => {
  assert.equal(totalShareWith(partners, 'c', 10), 100);
  assert.equal(totalShareWith(partners, 'b', null), 60);
  assert.equal(totalShareWith(partners, '', null), 90);
  const thirds = [
    { userId: 'a', share: 33.33 },
    { userId: 'b', share: 33.33 },
    { userId: 'c', share: null },
  ];
  assert.equal(totalShareWith(thirds, 'c', 33.34), 100);
});

test('ownersAfter: cuenta los dueños que quedan tras cambiar o sacar a uno', () => {
  assert.equal(ownersAfter(partners, 'a', 'editor'), 0);
  assert.equal(ownersAfter(partners, 'a', null), 0);
  assert.equal(ownersAfter(partners, 'b', 'dueno'), 2);
  assert.equal(ownersAfter(partners, 'c', null), 1);
});

test('buildDetail: el código y los correos ajenos solo los ven los dueños', () => {
  const business = {
    id: 'n1',
    name: 'Arepas',
    description: null,
    nit: null,
    code: 'K7M2QX',
    creatorId: 'a',
    membersCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const owner = buildDetail({ business: { ...business, role: 'dueno' }, partners, userId: 'a' });
  assert.equal(owner.code, 'K7M2QX');
  assert.deepEqual(
    owner.partners.map((p) => p.email),
    ['ana@x.co', 'beto@x.co', 'caro@x.co'],
  );
  assert.equal(owner.myShare, 60);
  assert.equal(owner.totalShare, 90);

  const editor = buildDetail({ business: { ...business, role: 'editor' }, partners, userId: 'b' });
  assert.equal(editor.code, null);
  assert.deepEqual(
    editor.partners.map((p) => p.email),
    [null, 'beto@x.co', null],
  );
  assert.equal(editor.partners[1].name, 'beto');
  assert.equal(editor.partners[1].isMe, true);
});

test('parseNewBusiness: nombre obligatorio, NIT con números y guiones', () => {
  assert.deepEqual(parseNewBusiness({ name: '  Arepas Doña Rosa ', nit: '900.123.456-7' }), {
    name: 'Arepas Doña Rosa',
    description: null,
    nit: '900.123.456-7',
  });
  assertInvalid(() => parseNewBusiness({}), ['name']);
  assertInvalid(() => parseNewBusiness({ name: 'X', nit: 'abc' }), ['nit']);
  assertInvalid(() => parseNewBusiness({ name: 'x'.repeat(61) }), ['name']);
  assert.throws(() => parseNewBusiness(null), { statusCode: 400 });
});

test('parseBusinessChanges: al menos un campo; NIT vacío lo borra', () => {
  assert.deepEqual(parseBusinessChanges({ nit: '' }), { nit: null });
  assertInvalid(() => parseBusinessChanges({}), ['body']);
});

test('parseInvitation: correo en minúsculas y rol editor por defecto', () => {
  assert.deepEqual(parseInvitation({ email: ' Socia@X.CO ' }), {
    email: 'socia@x.co',
    role: 'editor',
  });
  assert.deepEqual(parseInvitation({ email: 'c@x.co', role: 'lector' }), {
    email: 'c@x.co',
    role: 'lector',
  });
  assertInvalid(() => parseInvitation({ email: 'c@x.co', role: 'admin' }), ['role']);
  assertInvalid(() => parseInvitation({ email: 'no-es-correo' }), ['email']);
});

test('parsePartnerChanges: rol válido y participación entre 0 y 100', () => {
  assert.deepEqual(parsePartnerChanges({ role: 'dueno', share: 33.333 }), {
    role: 'dueno',
    share: 33.33,
  });
  assert.deepEqual(parsePartnerChanges({ share: null }), { share: null });
  assertInvalid(() => parsePartnerChanges({ share: 101 }), ['share']);
  assertInvalid(() => parsePartnerChanges({ share: '10' }), ['share']);
  assertInvalid(() => parsePartnerChanges({ role: 'jefe' }), ['role']);
  assertInvalid(() => parsePartnerChanges({}), ['body']);
});
