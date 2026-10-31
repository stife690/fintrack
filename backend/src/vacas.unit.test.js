import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDetail,
  buildProjection,
  computeQuotas,
  daysBetween,
  displayName,
  elapsedFraction,
  generateCode,
  memberStatus,
  ruleAdvice,
  vacaStatus,
} from './services/vacas.service.js';
import {
  parseCode,
  parseContribution,
  parseMemberChanges,
  parseNewVaca,
  parseVacaChanges,
} from './validators/vacas.validator.js';

/**
 * Comprueba que `fn` lance un 422 con esos campos en `details`.
 * @param {() => unknown} fn
 * @param {string[]} fields
 * @returns {void}
 */
function assertInvalid(fn, fields) {
  assert.throws(fn, (err) => {
    assert.equal(err.statusCode, 422);
    assert.deepEqual(err.details.map((d) => d.field).sort(), [...fields].sort());
    return true;
  });
}

test('reparto igual: la meta se divide entre todos', () => {
  const quotas = computeQuotas(
    300000,
    [
      { userId: 'a', quota: null },
      { userId: 'b', quota: 50 },
      { userId: 'c', quota: null },
    ],
    'igual',
  );
  assert.deepEqual([...quotas.values()], [100000, 100000, 100000]);
});

test('reparto personalizado: las cuotas fijas se respetan y lo demás se divide', () => {
  const quotas = computeQuotas(
    300000,
    [
      { userId: 'a', quota: 200000 },
      { userId: 'b', quota: null },
      { userId: 'c', quota: null },
    ],
    'personalizado',
  );
  assert.equal(quotas.get('a'), 200000);
  assert.equal(quotas.get('b'), 50000);
  assert.equal(quotas.get('c'), 50000);
});

test('reparto personalizado: si las cuotas fijas superan la meta, a los demás no les toca nada', () => {
  const quotas = computeQuotas(
    100,
    [
      { userId: 'a', quota: 150 },
      { userId: 'b', quota: null },
    ],
    'personalizado',
  );
  assert.equal(quotas.get('b'), 0);
});

test('plazo transcurrido: sin fecha límite es null; se limita entre 0 y 1', () => {
  assert.equal(elapsedFraction('2026-10-01', null, '2026-10-15'), null);
  assert.equal(elapsedFraction('2026-10-01', '2026-10-31', '2026-10-16'), 0.5);
  assert.equal(elapsedFraction('2026-10-01', '2026-10-31', '2026-12-01'), 1);
  assert.equal(elapsedFraction('2026-10-10', '2026-10-31', '2026-10-01'), 0);
});

test('estado del miembro: cumplido, al día (con 10 % de margen), atrasado y pendiente', () => {
  assert.equal(memberStatus({ quota: 100, contributed: 100, fraction: 0.2 }), 'cumplido');
  assert.equal(memberStatus({ quota: 100, contributed: 45, fraction: 0.5 }), 'al_dia');
  assert.equal(memberStatus({ quota: 100, contributed: 40, fraction: 0.5 }), 'atrasado');
  assert.equal(memberStatus({ quota: 100, contributed: 10, fraction: null }), 'pendiente');
});

test('proyección: ritmo, fecha estimada y lo que falta por semana para llegar a tiempo', () => {
  const p = buildProjection({
    goal: 1000,
    total: 100,
    createdDate: '2026-10-01',
    firstContributionDate: '2026-10-01',
    deadline: '2026-10-31',
    today: '2026-10-10',
  });
  assert.equal(p.remaining, 900);
  assert.equal(p.averagePerDay, 10);
  assert.equal(p.estimatedDate, '2027-01-08');
  assert.equal(p.daysLeft, 21);
  assert.equal(p.neededPerDay, 43);
  assert.equal(p.neededPerWeek, 300);
  assert.equal(p.onTrack, false);
});

test('proyección: sin aportes no hay fecha estimada; completada va a tiempo', () => {
  const empty = buildProjection({
    goal: 1000,
    total: 0,
    createdDate: '2026-10-01',
    firstContributionDate: null,
    deadline: null,
    today: '2026-10-05',
  });
  assert.equal(empty.estimatedDate, null);
  assert.equal(empty.onTrack, null);
  const done = buildProjection({
    goal: 1000,
    total: 1200,
    createdDate: '2026-10-01',
    firstContributionDate: '2026-10-02',
    deadline: '2026-10-20',
    today: '2026-10-05',
  });
  assert.equal(done.remaining, 0);
  assert.equal(done.onTrack, true);
  assert.equal(done.neededPerDay, null);
});

test('estado de la vaca y días entre fechas', () => {
  assert.equal(vacaStatus(1000, 1000, null, '2026-10-01'), 'completada');
  assert.equal(vacaStatus(10, 1000, '2026-09-30', '2026-10-01'), 'vencida');
  assert.equal(vacaStatus(10, 1000, '2026-10-30', '2026-10-01'), 'activa');
  assert.equal(daysBetween('2026-02-27', '2026-03-01'), 2);
});

test('nombre visible: el del perfil o la parte del correo, nunca el correo completo', () => {
  assert.equal(displayName('Ana', 'ana@x.co'), 'Ana');
  assert.equal(displayName(null, 'beto.p@x.co'), 'beto.p');
  assert.equal(displayName(null, null), 'Ex miembro');
});

test('código de invitación: 6 caracteres sin letras que se confundan', () => {
  const code = generateCode();
  assert.match(code, /^[A-HJ-KM-NP-Z2-9]{6}$/);
  assert.equal(
    generateCode(() => 0),
    'AAAAAA',
  );
});

test('detalle: cuotas, estado de cada miembro y datos propios', () => {
  const detail = buildDetail({
    vaca: {
      id: 'v',
      name: 'Paseo',
      description: null,
      goal: 300,
      deadline: '2026-10-31',
      split: 'igual',
      code: 'ABCDEF',
      role: 'admin',
      total: 150,
      createdDate: '2026-10-01',
      firstContributionDate: '2026-10-02',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    members: [
      {
        userId: 'a',
        name: 'Ana',
        email: 'ana@x.co',
        role: 'admin',
        quota: null,
        contributed: 100,
        joinedAt: new Date(),
      },
      {
        userId: 'b',
        name: null,
        email: 'beto@x.co',
        role: 'miembro',
        quota: null,
        contributed: 50,
        joinedAt: new Date(),
      },
      {
        userId: 'c',
        name: 'Caro',
        email: 'c@x.co',
        role: 'miembro',
        quota: null,
        contributed: 0,
        joinedAt: new Date(),
      },
    ],
    contributions: [],
    userId: 'b',
    today: '2026-10-16',
  });
  assert.equal(detail.percentage, 50);
  assert.deepEqual(
    detail.members.map((m) => [m.name, m.status]),
    [
      ['Ana', 'cumplido'],
      ['beto', 'al_dia'],
      ['Caro', 'atrasado'],
    ],
  );
  assert.equal(detail.myQuota, 100);
  assert.equal(detail.myRemaining, 50);
  assert.ok(!('email' in detail.members[0]), 'no expone el correo de los miembros');
});

test('consejo con reglas según el estado del grupo', () => {
  const base = {
    goal: 1000,
    total: 100,
    percentage: 10,
    membersCount: 3,
    behindCount: 0,
    doneCount: 0,
    status: 'activa',
    projection: { remaining: 900, onTrack: true, neededPerWeek: 100, estimatedDate: '2026-11-01' },
  };
  assert.match(ruleAdvice({ ...base, status: 'completada' }), /Meta cumplida/);
  assert.match(ruleAdvice({ ...base, total: 0 }), /Nadie ha aportado/);
  assert.match(
    ruleAdvice({ ...base, projection: { ...base.projection, onTrack: false } }),
    /no llegan a tiempo/,
  );
  assert.match(ruleAdvice({ ...base, behindCount: 2 }), /2 miembros atrasados/);
  assert.match(ruleAdvice(base), /Van al día/);
});

test('validar una vaca nueva: nombre y meta obligatorios, reparto igual por defecto', () => {
  assert.deepEqual(parseNewVaca({ name: ' Paseo ', goal: 500000.456 }), {
    name: 'Paseo',
    goal: 500000.46,
    description: null,
    deadline: null,
    split: 'igual',
  });
  assertInvalid(() => parseNewVaca({}), ['goal', 'name']);
  assertInvalid(
    () => parseNewVaca({ name: 'x'.repeat(61), goal: -1, deadline: '2026-02-30', split: 'otro' }),
    ['deadline', 'goal', 'name', 'split'],
  );
  assertInvalid(() => parseVacaChanges({}), ['body']);
});

test('validar cuota, código y aporte', () => {
  assert.deepEqual(parseMemberChanges({ quota: null }), { quota: null });
  assertInvalid(() => parseMemberChanges({ quota: -5, role: 'jefe' }), ['quota', 'role']);
  assert.equal(parseCode(' abc234 '), 'ABC234');
  assertInvalid(() => parseCode('a!'), ['code']);
  assert.deepEqual(
    parseContribution({ amount: 20000, date: '2026-10-20', note: '  ', localId: 'x1' }),
    {
      amount: 20000,
      date: '2026-10-20',
      note: null,
      category: null,
      localId: 'x1',
    },
  );
  assertInvalid(
    () => parseContribution({ amount: 0, date: 'ayer', localId: 'x'.repeat(57) }),
    ['amount', 'date', 'localId'],
  );
});
