import { pool } from '../config/db.js';

/**
 * @typedef {'dueno'|'editor'|'lector'} BusinessRole
 *   `dueno`: administra el negocio y sus socios. `editor`: registra movimientos. `lector`: solo ve.
 */

/**
 * @typedef {object} BusinessRecord
 * @property {string} id UUID del negocio.
 * @property {string} name Nombre del negocio.
 * @property {string|null} description A qué se dedica.
 * @property {string|null} nit NIT o documento del negocio.
 * @property {string} code Código de invitación.
 * @property {string|null} creatorId Quien lo creó (`null` si borró su cuenta).
 * @property {number} membersCount Cantidad de socios.
 * @property {Date} createdAt Hora de creación.
 * @property {Date} updatedAt Último cambio (datos o socios).
 */

/**
 * @typedef {object} PartnerRecord
 * @property {string} userId UUID del socio.
 * @property {string|null} name Nombre que puso en su perfil.
 * @property {string} email Correo de su cuenta.
 * @property {BusinessRole} role Rol dentro del negocio.
 * @property {number|null} share Participación en % (opcional).
 * @property {Date} joinedAt Cuándo entró.
 */

/** Negocio con su cantidad de socios. */
const SELECT_BUSINESS = `SELECT n.id, n.nombre AS name, n.descripcion AS description, n.nit,
  n.codigo AS code, n.creador_id AS "creatorId",
  (SELECT COUNT(*) FROM negocio_socios s WHERE s.negocio_id = n.id)::int AS "membersCount",
  n.created_at AS "createdAt", n.updated_at AS "updatedAt"
  FROM negocios n`;

/**
 * Crea un negocio y deja a su creador como dueño, en una sola transacción.
 * @param {{ name: string, description: string|null, nit: string|null, code: string, creatorId: string }} data
 * @returns {Promise<string>} Id del negocio.
 */
export async function insertBusiness(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO negocios (nombre, descripcion, nit, codigo, creador_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.name, data.description, data.nit, data.code, data.creatorId],
    );
    await client.query(
      "INSERT INTO negocio_socios (negocio_id, usuario_id, rol) VALUES ($1, $2, 'dueno')",
      [rows[0].id, data.creatorId],
    );
    await client.query('COMMIT');
    return rows[0].id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Negocios de los que el usuario es socio, con su rol y su participación. El de último cambio
 * primero.
 * @param {string} userId
 * @returns {Promise<Array<BusinessRecord & { role: BusinessRole, share: number|null }>>}
 */
export async function listBusinessesForUser(userId) {
  const { rows } = await pool.query(
    `SELECT x.*, s.rol AS role, s.participacion::float8 AS share
     FROM (${SELECT_BUSINESS}) x JOIN negocio_socios s ON s.negocio_id = x.id AND s.usuario_id = $1
     ORDER BY x."updatedAt" DESC`,
    [userId],
  );
  return rows;
}

/**
 * Busca un negocio del que el usuario es socio (si no lo es, no lo revela).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<(BusinessRecord & { role: BusinessRole })|null>}
 */
export async function findBusinessForMember(id, userId) {
  const { rows } = await pool.query(
    `SELECT x.*, s.rol AS role FROM (${SELECT_BUSINESS} WHERE n.id = $1) x
     JOIN negocio_socios s ON s.negocio_id = x.id AND s.usuario_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Busca un negocio por su código de invitación.
 * @param {string} code
 * @returns {Promise<(BusinessRecord & { creatorName: string|null, creatorEmail: string|null })|null>}
 */
export async function findBusinessByCode(code) {
  const { rows } = await pool.query(
    `SELECT x.*, u.nombre AS "creatorName", u.email AS "creatorEmail"
     FROM (${SELECT_BUSINESS} WHERE n.codigo = $1) x LEFT JOIN usuarios u ON u.id = x."creatorId"`,
    [code],
  );
  return rows[0] ?? null;
}

/**
 * Socios de un negocio, del más antiguo al más reciente.
 * @param {string} businessId
 * @returns {Promise<PartnerRecord[]>}
 */
export async function listPartners(businessId) {
  const { rows } = await pool.query(
    `SELECT s.usuario_id AS "userId", u.nombre AS name, u.email, s.rol AS role,
       s.participacion::float8 AS share, s.created_at AS "joinedAt"
     FROM negocio_socios s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.negocio_id = $1 ORDER BY s.created_at, s.usuario_id`,
    [businessId],
  );
  return rows;
}

/**
 * Cambia los datos de un negocio. Solo toca los campos presentes en `changes`.
 * @param {string} id
 * @param {{ name?: string, description?: string|null, nit?: string|null }} changes
 * @returns {Promise<void>}
 */
export async function updateBusiness(id, changes) {
  const columns = { name: 'nombre', description: 'descripcion', nit: 'nit' };
  const sets = [];
  const values = [id];
  for (const [field, column] of Object.entries(columns)) {
    if (field in changes) {
      values.push(changes[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  await pool.query(
    `UPDATE negocios SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1`,
    values,
  );
}

/**
 * Elimina un negocio con sus socios e invitaciones (ON DELETE CASCADE).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBusiness(id) {
  await pool.query('DELETE FROM negocios WHERE id = $1', [id]);
}

/**
 * Cambia el código de invitación (el anterior deja de servir).
 * @param {string} id
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function updateCode(id, code) {
  await pool.query('UPDATE negocios SET codigo = $2, updated_at = now() WHERE id = $1', [id, code]);
}

/**
 * Marca que el negocio cambió, para ordenar la lista.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function touchBusiness(id) {
  await pool.query('UPDATE negocios SET updated_at = now() WHERE id = $1', [id]);
}

/**
 * Agrega un socio. Si ya estaba, no hace nada.
 * @param {string} businessId
 * @param {string} userId
 * @param {BusinessRole} role
 * @returns {Promise<boolean>} `true` si entró ahora.
 */
export async function addPartner(businessId, userId, role) {
  const { rowCount } = await pool.query(
    `INSERT INTO negocio_socios (negocio_id, usuario_id, rol) VALUES ($1, $2, $3)
     ON CONFLICT (negocio_id, usuario_id) DO NOTHING`,
    [businessId, userId, role],
  );
  if (rowCount > 0) await touchBusiness(businessId);
  return rowCount > 0;
}

/**
 * Cambia el rol o la participación de un socio.
 * @param {string} businessId
 * @param {string} userId
 * @param {{ role?: BusinessRole, share?: number|null }} changes
 * @returns {Promise<boolean>} `false` si no es socio.
 */
export async function updatePartner(businessId, userId, changes) {
  const sets = [];
  const values = [businessId, userId];
  if ('role' in changes) {
    values.push(changes.role);
    sets.push(`rol = $${values.length}`);
  }
  if ('share' in changes) {
    values.push(changes.share);
    sets.push(`participacion = $${values.length}`);
  }
  if (sets.length === 0) return true;
  const { rowCount } = await pool.query(
    `UPDATE negocio_socios SET ${sets.join(', ')} WHERE negocio_id = $1 AND usuario_id = $2`,
    values,
  );
  if (rowCount > 0) await touchBusiness(businessId);
  return rowCount > 0;
}

/**
 * Saca a un socio.
 * @param {string} businessId
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si no era socio.
 */
export async function removePartner(businessId, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM negocio_socios WHERE negocio_id = $1 AND usuario_id = $2',
    [businessId, userId],
  );
  if (rowCount > 0) await touchBusiness(businessId);
  return rowCount > 0;
}

/**
 * Guarda (o renueva) la invitación por correo a un negocio.
 * @param {{ businessId: string, email: string, role: BusinessRole, invitedBy: string }} data
 * @returns {Promise<{ email: string, role: BusinessRole, sentAt: Date, previousSentAt: Date|null }>}
 *   `previousSentAt` es la hora del envío anterior (para no reenviar el correo muchas veces).
 */
export async function upsertInvitation({ businessId, email, role, invitedBy }) {
  const { rows: previous } = await pool.query(
    'SELECT enviada_at FROM negocio_invitaciones WHERE negocio_id = $1 AND lower(email) = lower($2)',
    [businessId, email],
  );
  const { rows } = await pool.query(
    `INSERT INTO negocio_invitaciones (negocio_id, email, rol, invitado_por) VALUES ($1, $2, $3, $4)
     ON CONFLICT (negocio_id, lower(email))
       DO UPDATE SET enviada_at = now(), rol = $3, invitado_por = $4
     RETURNING email, rol AS role, enviada_at AS "sentAt"`,
    [businessId, email, role, invitedBy],
  );
  return { ...rows[0], previousSentAt: previous[0]?.enviada_at ?? null };
}

/**
 * Invitaciones por correo que siguen pendientes.
 * @param {string} businessId
 * @returns {Promise<Array<{ email: string, role: BusinessRole, sentAt: Date }>>}
 */
export async function listInvitations(businessId) {
  const { rows } = await pool.query(
    `SELECT email, rol AS role, enviada_at AS "sentAt" FROM negocio_invitaciones
     WHERE negocio_id = $1 ORDER BY enviada_at DESC`,
    [businessId],
  );
  return rows;
}

/**
 * Invitación pendiente de un correo, si la hay.
 * @param {string} businessId
 * @param {string} email
 * @returns {Promise<{ email: string, role: BusinessRole }|null>}
 */
export async function findInvitation(businessId, email) {
  const { rows } = await pool.query(
    `SELECT email, rol AS role FROM negocio_invitaciones
     WHERE negocio_id = $1 AND lower(email) = lower($2)`,
    [businessId, email],
  );
  return rows[0] ?? null;
}

/**
 * Cantidad de invitaciones pendientes de un negocio.
 * @param {string} businessId
 * @returns {Promise<number>}
 */
export async function countInvitations(businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM negocio_invitaciones WHERE negocio_id = $1',
    [businessId],
  );
  return rows[0].n;
}

/**
 * Borra la invitación de un correo (la cancelan o la persona ya entró).
 * @param {string} businessId
 * @param {string} email
 * @returns {Promise<boolean>} `false` si no existía.
 */
export async function deleteInvitation(businessId, email) {
  const { rowCount } = await pool.query(
    'DELETE FROM negocio_invitaciones WHERE negocio_id = $1 AND lower(email) = lower($2)',
    [businessId, email],
  );
  return rowCount > 0;
}
