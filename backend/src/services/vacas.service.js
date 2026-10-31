import { randomInt, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { findUserById } from '../repositories/users.repository.js';
import * as repo from '../repositories/vacas.repository.js';
import { completeText } from './ai-client.service.js';
import { todayIso } from './insights.service.js';
import { sendVacaInvitationEmail } from './mail.service.js';
import { pushService } from './push.service.js';
import * as transactions from './transactions.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sin 0/O ni 1/I/L, para que el código se pueda dictar o copiar a mano sin confundirse. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_MEMBERS = 50;
const MAX_INVITATIONS = 30;
/** No se reenvía el correo de una invitación antes de este tiempo. */
const RESEND_MINUTES = 2;
/** Un recordatorio a los atrasados cada 12 horas como máximo. */
const REMINDER_HOURS = 12;
/** El consejo de la IA se reutiliza mientras no cambie el total y no pase este tiempo. */
const ADVICE_TTL_HOURS = 6;
const CONTRIBUTIONS_LIMIT = 50;
/** Categoría del gasto que deja cada aporte si el miembro no elige otra. */
const DEFAULT_CATEGORY = 'ahorro_inversion';
const DEFAULT_TIMEZONE = 'America/Bogota';
const DAY_MS = 24 * 60 * 60 * 1000;

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * @typedef {'cumplido'|'al_dia'|'atrasado'|'pendiente'} MemberStatus
 *   `cumplido`: ya puso su cuota. `al_dia`: va al ritmo que pide la fecha límite. `atrasado`: va
 *   por debajo. `pendiente`: le falta, pero la vaca no tiene fecha límite para medir el ritmo.
 */

/**
 * @typedef {object} Projection
 * @property {number} remaining Lo que falta para la meta.
 * @property {number} averagePerDay Ritmo de aportes desde el primero (o desde que se creó).
 * @property {string|null} estimatedDate Cuándo se completa a ese ritmo (`null` si no hay aportes o ya se completó).
 * @property {number|null} daysLeft Días hasta la fecha límite (negativo si ya pasó).
 * @property {number|null} neededPerDay Lo que hay que juntar cada día para llegar a tiempo.
 * @property {number|null} neededPerWeek Lo mismo, por semana.
 * @property {boolean|null} onTrack Si a este ritmo llega a tiempo (`null` sin fecha límite).
 */

/** @returns {AppError} 404: no existe o el usuario no es miembro (no se revela cuál). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Vaca no encontrada');
}

/** @returns {AppError} 403 para acciones de administrador. Solo se usa con miembros. */
function adminOnly() {
  return new AppError(403, 'FORBIDDEN', 'Solo un administrador de la vaca puede hacer esto');
}

/**
 * @param {number} value
 * @returns {number} Redondeado a centavos.
 */
function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Días entre dos fechas AAAA-MM-DD (`to - from`).
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function daysBetween(from, to) {
  const toUtc = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/**
 * @param {string} date AAAA-MM-DD
 * @param {number} days
 * @returns {string} AAAA-MM-DD
 */
function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Fecha para leer en un mensaje, p. ej. "7 de noviembre de 2026".
 * @param {string} date AAAA-MM-DD
 * @returns {string}
 */
function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Nombre que ven los demás miembros: el del perfil o, si no tiene, la parte del correo antes de
 * la @. Nunca el correo completo.
 * @param {string|null} name
 * @param {string|null} email
 * @returns {string}
 */
export function displayName(name, email) {
  return name?.trim() || email?.split('@')[0] || 'Ex miembro';
}

/**
 * Código de invitación aleatorio.
 * @param {(max: number) => number} [random] Para las pruebas.
 * @returns {string}
 */
export function generateCode(random = randomInt) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return code;
}

/**
 * Cuota de cada miembro. Con reparto igual, la meta dividida entre todos. Con reparto
 * personalizado, quien tiene cuota la conserva y lo que falta se divide entre los demás.
 * @param {number} goal
 * @param {Array<{ userId: string, quota: number|null }>} members
 * @param {'igual'|'personalizado'} split
 * @returns {Map<string, number>}
 */
export function computeQuotas(goal, members, split) {
  const quotas = new Map();
  if (members.length === 0) return quotas;
  if (split === 'igual') {
    const share = roundMoney(goal / members.length);
    members.forEach((m) => quotas.set(m.userId, share));
    return quotas;
  }
  const fixed = members.filter((m) => m.quota !== null && m.quota !== undefined);
  const open = members.filter((m) => m.quota === null || m.quota === undefined);
  const assigned = fixed.reduce((acc, m) => acc + m.quota, 0);
  const share = open.length ? roundMoney(Math.max(goal - assigned, 0) / open.length) : 0;
  fixed.forEach((m) => quotas.set(m.userId, m.quota));
  open.forEach((m) => quotas.set(m.userId, share));
  return quotas;
}

/**
 * Parte del plazo que ya pasó (0 a 1), o `null` si la vaca no tiene fecha límite.
 * @param {string} createdDate
 * @param {string|null} deadline
 * @param {string} today
 * @returns {number|null}
 */
export function elapsedFraction(createdDate, deadline, today) {
  if (!deadline) return null;
  const total = daysBetween(createdDate, deadline);
  if (total <= 0) return 1;
  return Math.min(Math.max(daysBetween(createdDate, today) / total, 0), 1);
}

/**
 * Estado de un miembro según su cuota, lo que lleva y el plazo transcurrido. Se le da un 10 % de
 * margen para no marcar atrasado a quien aportó hace poco y va casi al día.
 * @param {{ quota: number, contributed: number, fraction: number|null }} data
 * @returns {MemberStatus}
 */
export function memberStatus({ quota, contributed, fraction }) {
  if (contributed >= quota) return 'cumplido';
  if (fraction === null) return 'pendiente';
  return contributed + 0.005 >= quota * fraction * 0.9 ? 'al_dia' : 'atrasado';
}

/**
 * Proyección del grupo: ritmo actual, fecha estimada y lo que hace falta para llegar a tiempo.
 * @param {{ goal: number, total: number, createdDate: string, firstContributionDate: string|null, deadline: string|null, today: string }} data
 * @returns {Projection}
 */
export function buildProjection({
  goal,
  total,
  createdDate,
  firstContributionDate,
  deadline,
  today,
}) {
  const remaining = roundMoney(Math.max(goal - total, 0));
  const start =
    firstContributionDate && firstContributionDate < createdDate
      ? firstContributionDate
      : createdDate;
  const days = Math.max(daysBetween(start, today) + 1, 1);
  // En pesos enteros: son cifras para leer, no para cuadrar centavos.
  const averagePerDay = Math.round(total / days);

  let estimatedDate = null;
  if (remaining > 0 && total > 0) {
    estimatedDate = addDays(today, Math.ceil((remaining * days) / total));
  }

  const daysLeft = deadline ? daysBetween(today, deadline) : null;
  const neededPerDay =
    deadline && remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : null;

  let onTrack = null;
  if (deadline) {
    onTrack = remaining === 0 || (estimatedDate !== null && estimatedDate <= deadline);
  }

  return {
    remaining,
    averagePerDay,
    estimatedDate,
    daysLeft,
    neededPerDay,
    neededPerWeek: neededPerDay === null ? null : Math.ceil((remaining * 7) / daysLeft),
    onTrack,
  };
}

/**
 * @param {number} total
 * @param {number} goal
 * @param {string|null} deadline
 * @param {string} today
 * @returns {'completada'|'vencida'|'activa'}
 */
export function vacaStatus(total, goal, deadline, today) {
  if (total >= goal) return 'completada';
  if (deadline && today > deadline) return 'vencida';
  return 'activa';
}

/**
 * Datos agregados del grupo para el consejo: sin nombres, correos ni aportes individuales.
 * @typedef {object} AdviceStats
 * @property {number} goal Meta del grupo.
 * @property {number} total Lo reunido.
 * @property {number} percentage Avance, de 0 a 100 o más.
 * @property {number} membersCount Cantidad de miembros.
 * @property {number} behindCount Miembros atrasados.
 * @property {number} doneCount Miembros que ya pusieron su cuota.
 * @property {Projection} projection Ritmo y fechas.
 * @property {'completada'|'vencida'|'activa'} status Estado de la vaca.
 */

/**
 * Consejo armado con reglas, para cuando la IA no está disponible. Mismos datos que el de la IA.
 * @param {AdviceStats} stats
 * @returns {string}
 */
export function ruleAdvice({ total, status, behindCount, membersCount, projection }) {
  if (status === 'completada') {
    return '¡Meta cumplida! Ya pueden usar la plata de la vaca. Si quieren seguir ahorrando, suban la meta o creen una nueva.';
  }
  if (status === 'vencida') {
    return `Pasó la fecha límite y faltan ${money.format(projection.remaining)}. Acuerden una fecha nueva y cuánto pondrá cada uno.`;
  }
  if (total === 0) {
    return `Nadie ha aportado todavía. Si cada uno de los ${membersCount} pone su parte esta semana, arrancan con buen ritmo.`;
  }
  if (projection.onTrack === false && projection.neededPerWeek !== null) {
    return `A este ritmo no llegan a tiempo. Necesitan juntar unos ${money.format(projection.neededPerWeek)} por semana entre todos para cumplir.`;
  }
  if (behindCount > 0) {
    return `Van bien, pero ${behindCount === 1 ? 'hay 1 miembro atrasado' : `hay ${behindCount} miembros atrasados`}. Un recordatorio amable ayuda a no quedarse cortos al final.`;
  }
  if (projection.estimatedDate) {
    return `Van al día: a este ritmo completan la meta hacia el ${longDate(projection.estimatedDate)}. Sigan así.`;
  }
  return 'Van bien. Registren cada aporte apenas lo hagan para que todos vean el avance.';
}

/**
 * Prompt del consejo para la IA. Solo lleva cifras agregadas del grupo.
 * @param {AdviceStats} stats
 * @returns {string}
 */
function advicePrompt({
  goal,
  total,
  percentage,
  membersCount,
  behindCount,
  doneCount,
  projection,
  status,
}) {
  return [
    `Meta: ${money.format(goal)}. Reunido: ${money.format(total)} (${percentage} %). Estado: ${status}.`,
    `Miembros: ${membersCount}. Ya cumplieron su cuota: ${doneCount}. Atrasados: ${behindCount}.`,
    `Ritmo: ${money.format(projection.averagePerDay)} por día.`,
    projection.daysLeft === null
      ? 'Sin fecha límite.'
      : `Días para la fecha límite: ${projection.daysLeft}. Hace falta ${projection.neededPerWeek === null ? 'nada más' : `${money.format(projection.neededPerWeek)} por semana`}.`,
    projection.estimatedDate
      ? `Fecha estimada a este ritmo: ${longDate(projection.estimatedDate)}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const ADVICE_SYSTEM =
  'Eres el asistente de ahorro de FinTrack, una app colombiana. Un grupo de personas (familia o amigos) ' +
  'junta plata para una meta común ("hacer una vaca"). Con los datos del grupo, da UN consejo práctico y ' +
  'amable en español de Colombia, de máximo 2 frases y 280 caracteres, sin saludos, sin emojis y sin ' +
  'inventar datos. Usa pesos colombianos con el formato de los datos.';

/**
 * Arma el detalle de una vaca para un miembro: cuotas, estado de cada uno, proyección y aportes.
 * Función pura: la usan el servicio y las pruebas.
 * @param {object} data
 * @param {import('../repositories/vacas.repository.js').VacaRecord & { role: string }} data.vaca
 * @param {import('../repositories/vacas.repository.js').MemberRecord[]} data.members
 * @param {import('../repositories/vacas.repository.js').ContributionRecord[]} data.contributions
 * @param {string} data.userId Quien consulta.
 * @param {string} data.today
 * @returns {object}
 */
export function buildDetail({ vaca, members, contributions, userId, today }) {
  const quotas = computeQuotas(vaca.goal, members, vaca.split);
  const fraction = elapsedFraction(vaca.createdDate, vaca.deadline, today);
  const memberViews = members.map((m) => {
    const quota = quotas.get(m.userId) ?? 0;
    return {
      userId: m.userId,
      name: displayName(m.name, m.email),
      isMe: m.userId === userId,
      role: m.role,
      quota,
      customQuota: m.quota,
      contributed: m.contributed,
      remaining: roundMoney(Math.max(quota - m.contributed, 0)),
      percentage: quota > 0 ? Math.round((m.contributed / quota) * 1000) / 10 : 100,
      status: memberStatus({ quota, contributed: m.contributed, fraction }),
      joinedAt: m.joinedAt,
    };
  });
  const me = memberViews.find((m) => m.isMe);
  const projection = buildProjection({ ...vaca, today });
  const status = vacaStatus(vaca.total, vaca.goal, vaca.deadline, today);

  return {
    id: vaca.id,
    name: vaca.name,
    description: vaca.description,
    goal: vaca.goal,
    deadline: vaca.deadline,
    split: vaca.split,
    code: vaca.code,
    role: vaca.role,
    total: vaca.total,
    percentage: Math.round((vaca.total / vaca.goal) * 1000) / 10,
    status,
    membersCount: members.length,
    myQuota: me?.quota ?? 0,
    myContributed: me?.contributed ?? 0,
    myRemaining: me?.remaining ?? 0,
    myStatus: me?.status ?? 'pendiente',
    projection,
    members: memberViews,
    contributions: contributions.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: displayName(c.name, c.email),
      isMe: c.userId === userId,
      amount: c.amount,
      note: c.note,
      date: c.date,
      createdAt: c.createdAt,
    })),
    createdAt: vaca.createdAt,
    updatedAt: vaca.updatedAt,
  };
}

/**
 * Resumen de una vaca para la lista (sin miembros ni aportes).
 * @param {object} detail Lo que devuelve `buildDetail`.
 * @returns {object}
 */
function toSummary(detail) {
  const summary = { ...detail };
  delete summary.members;
  delete summary.contributions;
  return summary;
}

/**
 * @param {string} userId
 * @returns {Promise<string>} Hoy en la zona horaria del usuario.
 */
async function todayFor(userId) {
  const user = await findUserById(userId);
  try {
    return todayIso(new Date(), user?.timezone ?? DEFAULT_TIMEZONE);
  } catch {
    return todayIso(new Date(), DEFAULT_TIMEZONE);
  }
}

/**
 * Vaca de la que el usuario es miembro, o 404.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<import('../repositories/vacas.repository.js').VacaRecord & { role: string }>}
 */
async function requireMember(userId, id) {
  if (!UUID_RE.test(id)) throw notFound();
  const vaca = await repo.findVacaForMember(id, userId);
  if (!vaca) throw notFound();
  return vaca;
}

/**
 * Como `requireMember`, pero además exige ser administrador.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<import('../repositories/vacas.repository.js').VacaRecord & { role: string }>}
 */
async function requireAdmin(userId, id) {
  const vaca = await requireMember(userId, id);
  if (vaca.role !== 'admin') throw adminOnly();
  return vaca;
}

/**
 * Detalle completo de una vaca ya cargada.
 * @param {string} userId
 * @param {import('../repositories/vacas.repository.js').VacaRecord & { role: string }} vaca
 * @param {string} [today]
 * @returns {Promise<object>}
 */
async function loadDetail(userId, vaca, today) {
  const [members, contributions, day] = await Promise.all([
    repo.listMembers(vaca.id),
    repo.listContributions(vaca.id, CONTRIBUTIONS_LIMIT),
    today ?? todayFor(userId),
  ]);
  const detail = buildDetail({ vaca, members, contributions, userId, today: day });
  if (vaca.role === 'admin') detail.invitations = await repo.listInvitations(vaca.id);
  return detail;
}

/**
 * Envía un push a varios miembros sin esperar ni fallar: las notificaciones son un extra.
 * @param {string[]} userIds
 * @param {{ title: string, body: string, url: string }} payload
 * @returns {void}
 */
function notify(userIds, payload) {
  for (const id of userIds) {
    pushService
      .sendToUser(id, payload)
      .catch((err) => console.error('No se pudo enviar el push de la vaca', err));
  }
}

/**
 * Vacas del usuario, con su avance y lo que le toca a él.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function list(userId) {
  const [vacas, today] = await Promise.all([repo.listVacasForUser(userId), todayFor(userId)]);
  return Promise.all(
    vacas.map(async (vaca) => {
      const members = await repo.listMembers(vaca.id);
      return toSummary(buildDetail({ vaca, members, contributions: [], userId, today }));
    }),
  );
}

/**
 * Crea una vaca con el usuario como administrador.
 * @param {string} userId
 * @param {{ name: string, description: string|null, goal: number, deadline: string|null, split: 'igual'|'personalizado' }} data
 * @returns {Promise<object>} El detalle de la vaca nueva.
 */
export async function create(userId, data) {
  const today = await todayFor(userId);
  if (data.deadline && data.deadline < today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'deadline', problem: 'No puede ser una fecha pasada' },
    ]);
  }
  // El código es único: si choca con otro (muy raro), se intenta con uno nuevo.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const id = await repo.insertVaca({ ...data, code: generateCode(), creatorId: userId });
      return loadDetail(userId, await repo.findVacaForMember(id, userId), today);
    } catch (err) {
      if (err.code !== '23505' || attempt >= 4) throw err;
    }
  }
}

/**
 * Detalle de una vaca para uno de sus miembros.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function get(userId, id) {
  return loadDetail(userId, await requireMember(userId, id));
}

/**
 * Cambia los datos de una vaca (solo administradores).
 * @param {string} userId
 * @param {string} id
 * @param {object} changes Ya validados.
 * @returns {Promise<object>}
 */
export async function update(userId, id, changes) {
  const vaca = await requireAdmin(userId, id);
  const today = await todayFor(userId);
  if (changes.deadline && changes.deadline < today && changes.deadline !== vaca.deadline) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'deadline', problem: 'No puede ser una fecha pasada' },
    ]);
  }
  await repo.updateVaca(id, changes);
  return loadDetail(userId, await repo.findVacaForMember(id, userId), today);
}

/**
 * Elimina una vaca (solo administradores). Los gastos de los aportes siguen en los movimientos
 * de cada miembro.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(userId, id) {
  await requireAdmin(userId, id);
  await repo.deleteVaca(id);
}

/**
 * Lo que ve quien abre un enlace de invitación, antes de unirse.
 * @param {string} userId
 * @param {string} code Ya validado.
 * @returns {Promise<object>}
 */
export async function preview(userId, code) {
  const vaca = await repo.findVacaByCode(code);
  if (!vaca) throw new AppError(404, 'NOT_FOUND', 'El código de invitación no existe o ya cambió');
  const member = await repo.findVacaForMember(vaca.id, userId);
  return {
    id: vaca.id,
    name: vaca.name,
    description: vaca.description,
    goal: vaca.goal,
    total: vaca.total,
    deadline: vaca.deadline,
    membersCount: vaca.membersCount,
    createdBy: vaca.creatorId ? displayName(vaca.creatorName, vaca.creatorEmail) : null,
    isMember: Boolean(member),
  };
}

/**
 * Une al usuario a la vaca del código. Si ya era miembro, solo devuelve el detalle.
 * @param {string} userId
 * @param {string} code Ya validado.
 * @returns {Promise<{ joined: boolean, vaca: object }>}
 */
export async function join(userId, code) {
  const vaca = await repo.findVacaByCode(code);
  if (!vaca) throw new AppError(404, 'NOT_FOUND', 'El código de invitación no existe o ya cambió');
  let joined = false;
  if (!(await repo.findVacaForMember(vaca.id, userId))) {
    if (vaca.membersCount >= MAX_MEMBERS) {
      throw new AppError(409, 'VACA_FULL', `La vaca ya tiene ${MAX_MEMBERS} miembros`);
    }
    joined = await repo.addMember(vaca.id, userId);
    const user = await findUserById(userId);
    if (user) await repo.deleteInvitation(vaca.id, user.email);
    if (joined) {
      const others = (await repo.listMembers(vaca.id)).filter((m) => m.userId !== userId);
      notify(
        others.map((m) => m.userId),
        {
          title: vaca.name,
          body: `${displayName(user?.name, user?.email)} se unió a la vaca.`,
          url: `/app/vacas/${vaca.id}`,
        },
      );
    }
  }
  return { joined, vaca: await loadDetail(userId, await repo.findVacaForMember(vaca.id, userId)) };
}

/**
 * Cambia el código de invitación (solo administradores): el enlace anterior deja de servir.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ code: string }>}
 */
export async function regenerateCode(userId, id) {
  await requireAdmin(userId, id);
  for (let attempt = 0; ; attempt += 1) {
    const code = generateCode();
    try {
      await repo.updateCode(id, code);
      return { code };
    } catch (err) {
      if (err.code !== '23505' || attempt >= 4) throw err;
    }
  }
}

/**
 * Invita por correo a una vaca (cualquier miembro). El correo trae el enlace con el código.
 * Si se invitó a ese correo hace menos de 2 minutos, no se vuelve a enviar.
 * @param {string} userId
 * @param {string} id
 * @param {string} email Ya validado, en minúsculas.
 * @param {typeof sendVacaInvitationEmail} [mailer] Las pruebas pasan uno falso.
 * @returns {Promise<{ email: string, sentAt: Date, sent: boolean }>}
 */
export async function invite(userId, id, email, mailer = sendVacaInvitationEmail) {
  const vaca = await requireMember(userId, id);
  const members = await repo.listMembers(id);
  if (members.some((m) => m.email.toLowerCase() === email)) {
    throw new AppError(409, 'ALREADY_MEMBER', 'Esa persona ya está en la vaca');
  }
  if ((await repo.countInvitations(id)) >= MAX_INVITATIONS) {
    throw new AppError(
      409,
      'TOO_MANY_INVITATIONS',
      'Hay demasiadas invitaciones pendientes. Cancela alguna primero.',
    );
  }
  const invitation = await repo.upsertInvitation({ vacaId: id, email, invitedBy: userId });
  const recent =
    invitation.previousSentAt &&
    Date.now() - invitation.previousSentAt.getTime() < RESEND_MINUTES * 60_000;
  if (!recent) {
    const inviter = members.find((m) => m.userId === userId);
    await mailer({
      to: email,
      inviter: displayName(inviter?.name, inviter?.email),
      vacaName: vaca.name,
      goal: money.format(vaca.goal),
      link: `${env.appUrl}/app/vacas/unirse/${vaca.code}`,
    }).catch((err) => {
      console.error('No se pudo enviar la invitación a la vaca', err);
      throw new AppError(
        503,
        'EMAIL_UNAVAILABLE',
        'No pudimos enviar el correo. Comparte el enlace mientras tanto.',
      );
    });
  }
  return { email: invitation.email, sentAt: invitation.sentAt, sent: !recent };
}

/**
 * Cancela una invitación por correo (solo administradores).
 * @param {string} userId
 * @param {string} id
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function cancelInvitation(userId, id, email) {
  await requireAdmin(userId, id);
  if (!(await repo.deleteInvitation(id, email))) {
    throw new AppError(404, 'NOT_FOUND', 'Invitación no encontrada');
  }
}

/**
 * Cambia el rol o la cuota de un miembro (solo administradores). La vaca nunca se queda sin
 * administrador, y la cuota solo aplica con reparto personalizado.
 * @param {string} userId
 * @param {string} id
 * @param {string} memberId
 * @param {{ role?: 'admin'|'miembro', quota?: number|null }} changes
 * @returns {Promise<object>} El detalle actualizado.
 */
export async function updateMember(userId, id, memberId, changes) {
  const vaca = await requireAdmin(userId, id);
  if (!UUID_RE.test(memberId)) throw new AppError(404, 'NOT_FOUND', 'Miembro no encontrado');
  const members = await repo.listMembers(id);
  const target = members.find((m) => m.userId === memberId);
  if (!target) throw new AppError(404, 'NOT_FOUND', 'Miembro no encontrado');

  if (changes.role === 'miembro' && target.role === 'admin') {
    if (members.filter((m) => m.role === 'admin').length === 1) {
      throw new AppError(409, 'LAST_ADMIN', 'La vaca necesita al menos un administrador');
    }
  }
  if ('quota' in changes && changes.quota !== null && vaca.split !== 'personalizado') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'quota', problem: 'Cambia el reparto a personalizado para poner cuotas' },
    ]);
  }
  await repo.updateMember(id, memberId, changes);
  return loadDetail(userId, await repo.findVacaForMember(id, userId));
}

/**
 * Saca a un miembro (un administrador) o deja la vaca (el propio miembro). Si no queda nadie, la
 * vaca se elimina; si se fue el único administrador, pasa a serlo el miembro más antiguo.
 * @param {string} userId
 * @param {string} id
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function removeMember(userId, id, memberId) {
  const vaca = await requireMember(userId, id);
  if (memberId !== userId && vaca.role !== 'admin') throw adminOnly();
  if (!UUID_RE.test(memberId) || !(await repo.removeMember(id, memberId))) {
    throw new AppError(404, 'NOT_FOUND', 'Miembro no encontrado');
  }
  if ((await repo.listMembers(id)).length === 0) {
    await repo.deleteVaca(id);
    return;
  }
  await repo.ensureAdmin(id);
}

/**
 * Registra un aporte del usuario. También queda como un gasto en sus movimientos (categoría
 * Ahorro/Inversión si no elige otra). Reenviar el mismo `localId` (aporte hecho sin conexión cuya
 * respuesta se perdió) no duplica ni el aporte ni el gasto.
 * @param {string} userId
 * @param {string} id
 * @param {{ amount: number, date: string, note: string|null, category: string|null, localId: string|null }} input
 * @returns {Promise<{ contribution: object, transaction: object|null, vaca: object }>}
 */
export async function contribute(userId, id, input) {
  const vaca = await requireMember(userId, id);
  const today = await todayFor(userId);
  if (input.date > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'date', problem: 'No puede ser una fecha futura' },
    ]);
  }
  const localId = input.localId ?? randomUUID();

  const existing = await repo.findContributionByLocalId(userId, localId);
  if (existing) {
    const transaction = existing.transactionId
      ? await transactions.get(userId, existing.transactionId).catch(() => null)
      : null;
    return { contribution: existing, transaction, vaca: await loadDetail(userId, vaca, today) };
  }

  // Primero el gasto (también idempotente por localId) y después el aporte que lo enlaza.
  const transaction = await transactions.create(userId, {
    amount: input.amount,
    description: `Aporte a la vaca "${vaca.name}"`.slice(0, 200),
    type: 'gasto',
    date: input.date,
    category: input.category ?? DEFAULT_CATEGORY,
    localId: `vaca-${localId}`,
  });
  await repo.insertContribution({
    vacaId: id,
    userId,
    amount: input.amount,
    note: input.note,
    date: input.date,
    transactionId: transaction.id,
    localId,
  });

  const contribution = await repo.findContributionByLocalId(userId, localId);
  const updated = await repo.findVacaForMember(id, userId);
  const detail = await loadDetail(userId, updated, today);

  const others = detail.members.filter((m) => !m.isMe).map((m) => m.userId);
  const me = detail.members.find((m) => m.isMe);
  const url = `/app/vacas/${id}`;
  if (vaca.total < vaca.goal && updated.total >= vaca.goal) {
    notify(
      detail.members.map((m) => m.userId),
      { title: vaca.name, body: `¡Meta cumplida! Juntaron ${money.format(updated.total)}.`, url },
    );
  } else {
    notify(others, {
      title: vaca.name,
      body: `${me?.name ?? 'Alguien'} aportó ${money.format(input.amount)}. Van ${money.format(updated.total)} de ${money.format(vaca.goal)}.`,
      url,
    });
  }

  return {
    contribution: { ...contribution, name: me?.name ?? null, isMe: true },
    transaction,
    vaca: detail,
  };
}

/**
 * Borra un aporte propio y el gasto que dejó en los movimientos. Nadie puede borrar el aporte
 * de otro: tocaría sus finanzas personales.
 * @param {string} userId
 * @param {string} id
 * @param {string} contributionId
 * @returns {Promise<{ transactionId: string|null }>}
 */
export async function removeContribution(userId, id, contributionId) {
  await requireMember(userId, id);
  const contribution = UUID_RE.test(contributionId)
    ? await repo.findContribution(contributionId, id)
    : null;
  if (!contribution) throw new AppError(404, 'NOT_FOUND', 'Aporte no encontrado');
  if (contribution.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Solo quien hizo el aporte puede borrarlo');
  }
  await repo.softDeleteContribution(contributionId);
  if (contribution.transactionId) {
    // Si el usuario ya había borrado el gasto en Movimientos, no hay nada más que hacer.
    await transactions.remove(userId, contribution.transactionId).catch((err) => {
      if (err.statusCode !== 404) throw err;
    });
  }
  return { transactionId: contribution.transactionId };
}

/**
 * Consejo para el grupo. Lo genera la IA con datos agregados (sin nombres ni correos) y se guarda
 * mientras no cambie el total; si la IA no está disponible, se arma con reglas.
 * @param {string} userId
 * @param {string} id
 * @param {typeof completeText} [generate] Las pruebas pasan uno falso.
 * @returns {Promise<{ advice: string, source: 'ia'|'reglas', generatedAt: Date }>}
 */
export async function getAdvice(userId, id, generate = completeText) {
  const vaca = await requireMember(userId, id);
  const fresh =
    vaca.advice &&
    vaca.adviceTotal === vaca.total &&
    Date.now() - vaca.adviceAt.getTime() < ADVICE_TTL_HOURS * 3_600_000;
  if (fresh) return { advice: vaca.advice, source: 'ia', generatedAt: vaca.adviceAt };

  const detail = await loadDetail(userId, vaca);
  const stats = {
    goal: detail.goal,
    total: detail.total,
    percentage: detail.percentage,
    membersCount: detail.membersCount,
    behindCount: detail.members.filter((m) => m.status === 'atrasado').length,
    doneCount: detail.members.filter((m) => m.status === 'cumplido').length,
    projection: detail.projection,
    status: detail.status,
  };

  try {
    const text = String(
      await generate({ system: ADVICE_SYSTEM, prompt: advicePrompt(stats), maxTokens: 400 }),
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);
    if (!text) throw new Error('Respuesta vacía');
    await repo.saveAdvice(id, text, vaca.total);
    return { advice: text, source: 'ia', generatedAt: new Date() };
  } catch {
    return { advice: ruleAdvice(stats), source: 'reglas', generatedAt: new Date() };
  }
}

/**
 * Envía un recordatorio push a los miembros atrasados (o, sin fecha límite, a los que les falta
 * parte de su cuota), con lo que les falta. Solo administradores; uno cada 12 horas.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ reminded: number, delivered: number }>} `reminded`: miembros avisados;
 *   `delivered`: notificaciones que llegaron a algún dispositivo.
 */
export async function remind(userId, id) {
  const vaca = await requireAdmin(userId, id);
  const detail = await loadDetail(userId, vaca);
  const targets = detail.members.filter(
    (m) => !m.isMe && (m.status === 'atrasado' || m.status === 'pendiente') && m.remaining > 0,
  );
  if (targets.length === 0) return { reminded: 0, delivered: 0 };
  if (!(await repo.claimReminder(id, REMINDER_HOURS))) {
    throw new AppError(
      429,
      'REMINDER_RECENT',
      `Ya se envió un recordatorio hace poco. Espera ${REMINDER_HOURS} horas para enviar otro.`,
    );
  }

  let delivered = 0;
  for (const member of targets) {
    const result = await pushService
      .sendToUser(member.userId, {
        title: `Tu aporte a "${vaca.name}"`,
        body: `Te faltan ${money.format(member.remaining)} para completar tu parte. ¡Pon tu granito!`,
        url: `/app/vacas/${id}`,
      })
      .catch(() => ({ sent: 0 }));
    delivered += result.sent;
  }
  return { reminded: targets.length, delivered };
}
