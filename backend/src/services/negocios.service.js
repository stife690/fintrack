import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { findUserById } from '../repositories/users.repository.js';
import * as repo from '../repositories/negocios.repository.js';
import { sendBusinessInvitationEmail } from './mail.service.js';
import { pushService } from './push.service.js';
import { displayName, generateCode } from './vacas.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PARTNERS = 20;
const MAX_INVITATIONS = 30;
/** No se reenvía el correo de invitación a la misma persona antes de esto. */
const RESEND_MINUTES = 2;
/** Rol de quien entra con el código sin una invitación por correo. */
const DEFAULT_ROLE = 'editor';

/**
 * @typedef {import('../repositories/negocios.repository.js').BusinessRole} BusinessRole
 * @typedef {import('../repositories/negocios.repository.js').BusinessRecord} BusinessRecord
 * @typedef {import('../repositories/negocios.repository.js').PartnerRecord} PartnerRecord
 */

/** @returns {AppError} 404: no existe o el usuario no es socio (no se revela cuál). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Negocio no encontrado');
}

/** @returns {AppError} 403 para acciones de dueño. Solo se usa con socios. */
function ownerOnly() {
  return new AppError(403, 'FORBIDDEN', 'Solo un dueño del negocio puede hacer esto');
}

/** @returns {AppError} 409: el negocio se quedaría sin dueño. */
function lastOwner() {
  return new AppError(
    409,
    'LAST_OWNER',
    'El negocio necesita al menos un dueño. Pásale el rol a otro socio primero.',
  );
}

/**
 * Suma de participaciones si a `targetId` se le pone `share` (los demás quedan igual).
 * @param {Array<{ userId: string, share: number|null }>} partners
 * @param {string} targetId
 * @param {number|null} share
 * @returns {number} Redondeada a centésimas.
 */
export function totalShareWith(partners, targetId, share) {
  const total = partners.reduce(
    (acc, p) => acc + (p.userId === targetId ? (share ?? 0) : (p.share ?? 0)),
    0,
  );
  return Math.round(total * 100) / 100;
}

/**
 * Cuántos dueños quedan si `targetId` pasa a tener `role` (o se va, con `role` en `null`).
 * @param {Array<{ userId: string, role: BusinessRole }>} partners
 * @param {string} targetId
 * @param {BusinessRole|null} role
 * @returns {number}
 */
export function ownersAfter(partners, targetId, role) {
  return partners.filter((p) => (p.userId === targetId ? role : p.role) === 'dueno').length;
}

/**
 * Detalle de un negocio para uno de sus socios. Los correos solo los ven los dueños (y cada quien
 * el suyo); el código de invitación, solo los dueños, que son quienes invitan.
 * @param {{ business: BusinessRecord & { role: BusinessRole }, partners: PartnerRecord[], userId: string }} data
 * @returns {object}
 */
export function buildDetail({ business, partners, userId }) {
  const isOwner = business.role === 'dueno';
  const me = partners.find((p) => p.userId === userId);
  return {
    id: business.id,
    name: business.name,
    description: business.description,
    nit: business.nit,
    code: isOwner ? business.code : null,
    role: business.role,
    myShare: me?.share ?? null,
    membersCount: partners.length,
    totalShare: totalShareWith(partners, '', null),
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
    partners: partners.map((p) => ({
      userId: p.userId,
      name: displayName(p.name, p.email),
      email: isOwner || p.userId === userId ? p.email : null,
      role: p.role,
      share: p.share,
      isMe: p.userId === userId,
      joinedAt: p.joinedAt,
    })),
  };
}

/**
 * Negocio del que el usuario es socio, o 404.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<BusinessRecord & { role: BusinessRole }>}
 */
async function requirePartner(userId, id) {
  if (!UUID_RE.test(id)) throw notFound();
  const business = await repo.findBusinessForMember(id, userId);
  if (!business) throw notFound();
  return business;
}

/**
 * Como `requirePartner`, pero además exige ser dueño.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<BusinessRecord & { role: BusinessRole }>}
 */
async function requireOwner(userId, id) {
  const business = await requirePartner(userId, id);
  if (business.role !== 'dueno') throw ownerOnly();
  return business;
}

/**
 * Detalle completo de un negocio ya cargado (con las invitaciones, para los dueños).
 * @param {string} userId
 * @param {BusinessRecord & { role: BusinessRole }} business
 * @returns {Promise<object>}
 */
async function loadDetail(userId, business) {
  const partners = await repo.listPartners(business.id);
  const detail = buildDetail({ business, partners, userId });
  if (business.role === 'dueno') detail.invitations = await repo.listInvitations(business.id);
  return detail;
}

/**
 * Envía un push a varios socios sin esperar ni fallar: las notificaciones son un extra.
 * @param {string[]} userIds
 * @param {{ title: string, body: string, url: string }} payload
 * @returns {void}
 */
function notify(userIds, payload) {
  for (const id of userIds) {
    pushService
      .sendToUser(id, payload)
      .catch((err) => console.error('No se pudo enviar el push del negocio', err));
  }
}

/**
 * Negocios del usuario con su rol.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function list(userId) {
  const businesses = await repo.listBusinessesForUser(userId);
  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    nit: b.nit,
    role: b.role,
    myShare: b.share,
    membersCount: b.membersCount,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));
}

/**
 * Crea un negocio con el usuario como dueño.
 * @param {string} userId
 * @param {{ name: string, description: string|null, nit: string|null }} data
 * @returns {Promise<object>} El detalle del negocio nuevo.
 */
export async function create(userId, data) {
  // El código es único: si choca con otro (muy raro), se intenta con uno nuevo.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const id = await repo.insertBusiness({ ...data, code: generateCode(), creatorId: userId });
      return loadDetail(userId, await repo.findBusinessForMember(id, userId));
    } catch (err) {
      if (err.code !== '23505' || attempt >= 4) throw err;
    }
  }
}

/**
 * Detalle de un negocio para uno de sus socios.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function get(userId, id) {
  return loadDetail(userId, await requirePartner(userId, id));
}

/**
 * Cambia los datos de un negocio (solo dueños).
 * @param {string} userId
 * @param {string} id
 * @param {object} changes Ya validados.
 * @returns {Promise<object>}
 */
export async function update(userId, id, changes) {
  await requireOwner(userId, id);
  await repo.updateBusiness(id, changes);
  return loadDetail(userId, await repo.findBusinessForMember(id, userId));
}

/**
 * Elimina un negocio para todos sus socios (solo dueños).
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(userId, id) {
  await requireOwner(userId, id);
  await repo.deleteBusiness(id);
}

/**
 * Lo que ve quien abre un enlace de invitación, antes de unirse.
 * @param {string} userId
 * @param {string} code Ya validado.
 * @returns {Promise<object>}
 */
export async function preview(userId, code) {
  const business = await repo.findBusinessByCode(code);
  if (!business) {
    throw new AppError(404, 'NOT_FOUND', 'El código de invitación no existe o ya cambió');
  }
  const [member, user] = await Promise.all([
    repo.findBusinessForMember(business.id, userId),
    findUserById(userId),
  ]);
  const invitation = user ? await repo.findInvitation(business.id, user.email) : null;
  return {
    id: business.id,
    name: business.name,
    description: business.description,
    membersCount: business.membersCount,
    createdBy: business.creatorId ? displayName(business.creatorName, business.creatorEmail) : null,
    role: member?.role ?? invitation?.role ?? DEFAULT_ROLE,
    isMember: Boolean(member),
  };
}

/**
 * Une al usuario al negocio del código, con el rol de su invitación por correo (si la tiene) o
 * de editor. Si ya era socio, solo devuelve el detalle.
 * @param {string} userId
 * @param {string} code Ya validado.
 * @returns {Promise<{ joined: boolean, business: object }>}
 */
export async function join(userId, code) {
  const business = await repo.findBusinessByCode(code);
  if (!business) {
    throw new AppError(404, 'NOT_FOUND', 'El código de invitación no existe o ya cambió');
  }
  let joined = false;
  if (!(await repo.findBusinessForMember(business.id, userId))) {
    if (business.membersCount >= MAX_PARTNERS) {
      throw new AppError(409, 'BUSINESS_FULL', `El negocio ya tiene ${MAX_PARTNERS} socios`);
    }
    const user = await findUserById(userId);
    const invitation = user ? await repo.findInvitation(business.id, user.email) : null;
    joined = await repo.addPartner(business.id, userId, invitation?.role ?? DEFAULT_ROLE);
    if (invitation) await repo.deleteInvitation(business.id, user.email);
    if (joined) {
      const owners = (await repo.listPartners(business.id)).filter(
        (p) => p.role === 'dueno' && p.userId !== userId,
      );
      notify(
        owners.map((p) => p.userId),
        {
          title: business.name,
          body: `${displayName(user?.name, user?.email)} se unió al negocio.`,
          url: `/app/negocios/${business.id}`,
        },
      );
    }
  }
  return {
    joined,
    business: await loadDetail(userId, await repo.findBusinessForMember(business.id, userId)),
  };
}

/**
 * Cambia el código de invitación (solo dueños): el enlace anterior deja de servir.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ code: string }>}
 */
export async function regenerateCode(userId, id) {
  await requireOwner(userId, id);
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
 * Invita por correo a un negocio con un rol (solo dueños). El correo trae el enlace con el
 * código; quien entra con ese correo recibe el rol de la invitación. Si se invitó a ese correo
 * hace menos de 2 minutos, no se vuelve a enviar (pero sí se guarda el rol nuevo).
 * @param {string} userId
 * @param {string} id
 * @param {{ email: string, role: BusinessRole }} input Ya validado; el correo en minúsculas.
 * @param {typeof sendBusinessInvitationEmail} [mailer] Las pruebas pasan uno falso.
 * @returns {Promise<{ email: string, role: BusinessRole, sentAt: Date, sent: boolean }>}
 */
export async function invite(userId, id, { email, role }, mailer = sendBusinessInvitationEmail) {
  const business = await requireOwner(userId, id);
  const partners = await repo.listPartners(id);
  if (partners.some((p) => p.email.toLowerCase() === email)) {
    throw new AppError(409, 'ALREADY_MEMBER', 'Esa persona ya es socia del negocio');
  }
  const pending = await repo.findInvitation(id, email);
  if (!pending && (await repo.countInvitations(id)) >= MAX_INVITATIONS) {
    throw new AppError(
      409,
      'TOO_MANY_INVITATIONS',
      'Hay demasiadas invitaciones pendientes. Cancela alguna primero.',
    );
  }
  const invitation = await repo.upsertInvitation({
    businessId: id,
    email,
    role,
    invitedBy: userId,
  });
  const recent =
    invitation.previousSentAt &&
    Date.now() - invitation.previousSentAt.getTime() < RESEND_MINUTES * 60_000;
  if (!recent) {
    const inviter = partners.find((p) => p.userId === userId);
    await mailer({
      to: email,
      inviter: displayName(inviter?.name, inviter?.email),
      businessName: business.name,
      role,
      link: `${env.appUrl}/app/negocios/unirse/${business.code}`,
    }).catch((err) => {
      console.error('No se pudo enviar la invitación al negocio', err);
      throw new AppError(
        503,
        'EMAIL_UNAVAILABLE',
        'No pudimos enviar el correo. Comparte el enlace mientras tanto.',
      );
    });
  }
  return {
    email: invitation.email,
    role: invitation.role,
    sentAt: invitation.sentAt,
    sent: !recent,
  };
}

/**
 * Cancela una invitación por correo (solo dueños).
 * @param {string} userId
 * @param {string} id
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function cancelInvitation(userId, id, email) {
  await requireOwner(userId, id);
  if (!(await repo.deleteInvitation(id, email))) {
    throw new AppError(404, 'NOT_FOUND', 'Invitación no encontrada');
  }
}

/**
 * Cambia el rol o la participación de un socio (solo dueños). El negocio nunca se queda sin
 * dueño y las participaciones no suman más de 100 %.
 * @param {string} userId
 * @param {string} id
 * @param {string} partnerId
 * @param {{ role?: BusinessRole, share?: number|null }} changes
 * @returns {Promise<object>} El detalle actualizado.
 */
export async function updatePartner(userId, id, partnerId, changes) {
  await requireOwner(userId, id);
  if (!UUID_RE.test(partnerId)) throw new AppError(404, 'NOT_FOUND', 'Socio no encontrado');
  const partners = await repo.listPartners(id);
  if (!partners.some((p) => p.userId === partnerId)) {
    throw new AppError(404, 'NOT_FOUND', 'Socio no encontrado');
  }
  if (changes.role && ownersAfter(partners, partnerId, changes.role) === 0) throw lastOwner();
  if ('share' in changes && totalShareWith(partners, partnerId, changes.share) > 100) {
    const free = 100 - totalShareWith(partners, partnerId, 0);
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      {
        field: 'share',
        problem: `Las participaciones no pueden pasar de 100 %. Queda ${Math.max(free, 0)} % libre.`,
      },
    ]);
  }
  await repo.updatePartner(id, partnerId, changes);
  return loadDetail(userId, await repo.findBusinessForMember(id, userId));
}

/**
 * Saca a un socio (un dueño) o deja el negocio (el propio socio). El último dueño no puede irse
 * mientras haya otros socios; si era el único socio, el negocio se elimina.
 * @param {string} userId
 * @param {string} id
 * @param {string} partnerId
 * @returns {Promise<void>}
 */
export async function removePartner(userId, id, partnerId) {
  const business = await requirePartner(userId, id);
  if (partnerId !== userId && business.role !== 'dueno') throw ownerOnly();
  const partners = await repo.listPartners(id);
  if (!UUID_RE.test(partnerId) || !partners.some((p) => p.userId === partnerId)) {
    throw new AppError(404, 'NOT_FOUND', 'Socio no encontrado');
  }
  if (partners.length === 1) {
    await repo.deleteBusiness(id);
    return;
  }
  if (ownersAfter(partners, partnerId, null) === 0) throw lastOwner();
  await repo.removePartner(id, partnerId);
}
