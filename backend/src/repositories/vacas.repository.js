import { pool } from '../config/db.js';

/**
 * @typedef {object} VacaRecord
 * @property {string} id UUID de la vaca.
 * @property {string} name Nombre de la vaca.
 * @property {string|null} description Para qué es la plata.
 * @property {number} goal Meta del grupo.
 * @property {string|null} deadline Fecha límite AAAA-MM-DD.
 * @property {'igual'|'personalizado'} split Cómo se reparte la meta entre los miembros.
 * @property {string} code Código de invitación.
 * @property {string|null} creatorId Quien la creó (`null` si borró su cuenta).
 * @property {number} total Suma de los aportes no borrados.
 * @property {number} membersCount Cantidad de miembros.
 * @property {string|null} firstContributionDate Fecha del primer aporte (AAAA-MM-DD).
 * @property {string} createdDate Día de creación (AAAA-MM-DD, zona de la app).
 * @property {Date} createdAt Hora de creación.
 * @property {Date} updatedAt Último cambio (datos, miembros o aportes).
 * @property {string|null} advice Último consejo guardado.
 * @property {number|null} adviceTotal Total con el que se generó el consejo.
 * @property {Date|null} adviceAt Hora del último consejo.
 * @property {Date|null} reminderAt Último recordatorio a los atrasados.
 */

/**
 * @typedef {object} MemberRecord
 * @property {string} userId UUID del miembro.
 * @property {string|null} name Nombre que puso en su perfil.
 * @property {string} email Correo de su cuenta.
 * @property {'admin'|'miembro'} role Rol dentro de la vaca.
 * @property {number|null} quota Cuota personalizada (con reparto personalizado).
 * @property {number} contributed Lo que ha aportado (aportes no borrados).
 * @property {Date} joinedAt Cuándo entró.
 */

/**
 * @typedef {object} ContributionRecord
 * @property {string} id UUID del aporte.
 * @property {string} vacaId UUID de la vaca.
 * @property {string|null} userId Quien aportó (`null` si borró su cuenta).
 * @property {string|null} name Nombre del perfil de quien aportó.
 * @property {string|null} email Correo de quien aportó.
 * @property {number} amount Monto aportado.
 * @property {string|null} note Nota opcional.
 * @property {string} date AAAA-MM-DD
 * @property {string|null} transactionId Gasto que quedó en los movimientos del miembro.
 * @property {string|null} localId Id que le dio el dispositivo.
 * @property {Date} createdAt Hora de registro.
 * @property {Date|null} deletedAt Hora de borrado lógico.
 */

/** Vaca con su total, cantidad de miembros y primer aporte. */
const SELECT_VACA = `SELECT v.id, v.nombre AS name, v.descripcion AS description,
  v.meta::float8 AS goal, to_char(v.fecha_limite, 'YYYY-MM-DD') AS deadline, v.reparto AS split,
  v.codigo AS code, v.creador_id AS "creatorId",
  COALESCE(a.total, 0)::float8 AS total, to_char(a.primero, 'YYYY-MM-DD') AS "firstContributionDate",
  (SELECT COUNT(*) FROM vaca_miembros m WHERE m.vaca_id = v.id)::int AS "membersCount",
  to_char(v.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "createdDate",
  v.created_at AS "createdAt", v.updated_at AS "updatedAt",
  v.consejo AS advice, v.consejo_total::float8 AS "adviceTotal", v.consejo_at AS "adviceAt",
  v.recordatorio_at AS "reminderAt"
  FROM vacas v
  LEFT JOIN LATERAL (
    SELECT SUM(monto) AS total, MIN(fecha) AS primero FROM vaca_aportes
    WHERE vaca_id = v.id AND deleted_at IS NULL
  ) a ON true`;

/** Aporte con el nombre y correo de quien lo hizo. */
const SELECT_CONTRIBUTION = `SELECT a.id, a.vaca_id AS "vacaId", a.usuario_id AS "userId",
  u.nombre AS name, u.email, a.monto::float8 AS amount, a.nota AS note,
  to_char(a.fecha, 'YYYY-MM-DD') AS date, a.transaccion_id AS "transactionId",
  a.local_id AS "localId", a.created_at AS "createdAt", a.deleted_at AS "deletedAt"
  FROM vaca_aportes a LEFT JOIN usuarios u ON u.id = a.usuario_id`;

/**
 * Crea una vaca y deja a su creador como administrador, en una sola transacción.
 * @param {{ name: string, description: string|null, goal: number, deadline: string|null, split: string, code: string, creatorId: string }} data
 * @returns {Promise<string>} Id de la vaca.
 */
export async function insertVaca(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO vacas (nombre, descripcion, meta, fecha_limite, reparto, codigo, creador_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.name,
        data.description,
        data.goal,
        data.deadline,
        data.split,
        data.code,
        data.creatorId,
      ],
    );
    await client.query(
      "INSERT INTO vaca_miembros (vaca_id, usuario_id, rol) VALUES ($1, $2, 'admin')",
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
 * Vacas de las que el usuario es miembro, con su rol, su cuota y lo que ha aportado.
 * La más reciente (por último cambio) primero.
 * @param {string} userId
 * @returns {Promise<Array<VacaRecord & { role: 'admin'|'miembro', quota: number|null, myContributed: number }>>}
 */
export async function listVacasForUser(userId) {
  const { rows } = await pool.query(
    `SELECT x.*, m.rol AS role, m.cuota::float8 AS quota,
       COALESCE((SELECT SUM(monto) FROM vaca_aportes
                  WHERE vaca_id = x.id AND usuario_id = $1 AND deleted_at IS NULL), 0)::float8
         AS "myContributed"
     FROM (${SELECT_VACA}) x JOIN vaca_miembros m ON m.vaca_id = x.id AND m.usuario_id = $1
     ORDER BY x."updatedAt" DESC`,
    [userId],
  );
  return rows;
}

/**
 * Busca una vaca de la que el usuario es miembro (si no lo es, no la revela).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<(VacaRecord & { role: 'admin'|'miembro' })|null>}
 */
export async function findVacaForMember(id, userId) {
  const { rows } = await pool.query(
    `SELECT x.*, m.rol AS role FROM (${SELECT_VACA} WHERE v.id = $1) x
     JOIN vaca_miembros m ON m.vaca_id = x.id AND m.usuario_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Busca una vaca por su código de invitación.
 * @param {string} code
 * @returns {Promise<(VacaRecord & { creatorName: string|null, creatorEmail: string|null })|null>}
 */
export async function findVacaByCode(code) {
  const { rows } = await pool.query(
    `SELECT x.*, u.nombre AS "creatorName", u.email AS "creatorEmail"
     FROM (${SELECT_VACA} WHERE v.codigo = $1) x LEFT JOIN usuarios u ON u.id = x."creatorId"`,
    [code],
  );
  return rows[0] ?? null;
}

/**
 * Miembros de una vaca con lo que ha aportado cada uno, del más antiguo al más reciente.
 * @param {string} vacaId
 * @returns {Promise<MemberRecord[]>}
 */
export async function listMembers(vacaId) {
  const { rows } = await pool.query(
    `SELECT m.usuario_id AS "userId", u.nombre AS name, u.email, m.rol AS role,
       m.cuota::float8 AS quota, m.created_at AS "joinedAt",
       COALESCE((SELECT SUM(monto) FROM vaca_aportes a
                  WHERE a.vaca_id = m.vaca_id AND a.usuario_id = m.usuario_id
                    AND a.deleted_at IS NULL), 0)::float8 AS contributed
     FROM vaca_miembros m JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.vaca_id = $1 ORDER BY m.created_at, m.usuario_id`,
    [vacaId],
  );
  return rows;
}

/**
 * Últimos aportes no borrados de una vaca, del más reciente al más antiguo.
 * @param {string} vacaId
 * @param {number} limit
 * @returns {Promise<ContributionRecord[]>}
 */
export async function listContributions(vacaId, limit) {
  const { rows } = await pool.query(
    `${SELECT_CONTRIBUTION} WHERE a.vaca_id = $1 AND a.deleted_at IS NULL
     ORDER BY a.fecha DESC, a.created_at DESC LIMIT $2`,
    [vacaId, limit],
  );
  return rows;
}

/**
 * Cambia los datos de una vaca. Solo toca los campos presentes en `changes`.
 * @param {string} id
 * @param {{ name?: string, description?: string|null, goal?: number, deadline?: string|null, split?: string }} changes
 * @returns {Promise<void>}
 */
export async function updateVaca(id, changes) {
  const columns = {
    name: 'nombre',
    description: 'descripcion',
    goal: 'meta',
    deadline: 'fecha_limite',
    split: 'reparto',
  };
  const sets = [];
  const values = [id];
  for (const [field, column] of Object.entries(columns)) {
    if (field in changes) {
      values.push(changes[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  // Pasar a reparto igual borra las cuotas personalizadas, para no dejar datos que ya no aplican.
  if (changes.split === 'igual') {
    await pool.query('UPDATE vaca_miembros SET cuota = NULL WHERE vaca_id = $1', [id]);
  }
  await pool.query(
    `UPDATE vacas SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1`,
    values,
  );
}

/**
 * Elimina una vaca con sus miembros, invitaciones y aportes (ON DELETE CASCADE). Los gastos que
 * dejaron los aportes en los movimientos de cada miembro se conservan.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteVaca(id) {
  await pool.query('DELETE FROM vacas WHERE id = $1', [id]);
}

/**
 * Cambia el código de invitación (el anterior deja de servir).
 * @param {string} id
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function updateCode(id, code) {
  await pool.query('UPDATE vacas SET codigo = $2, updated_at = now() WHERE id = $1', [id, code]);
}

/**
 * Marca que la vaca cambió (aporte nuevo o borrado), para ordenar la lista y avisar a los demás.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function touchVaca(id) {
  await pool.query('UPDATE vacas SET updated_at = now() WHERE id = $1', [id]);
}

/**
 * Agrega un miembro. Si ya estaba, no hace nada.
 * @param {string} vacaId
 * @param {string} userId
 * @returns {Promise<boolean>} `true` si entró ahora.
 */
export async function addMember(vacaId, userId) {
  const { rowCount } = await pool.query(
    `INSERT INTO vaca_miembros (vaca_id, usuario_id) VALUES ($1, $2)
     ON CONFLICT (vaca_id, usuario_id) DO NOTHING`,
    [vacaId, userId],
  );
  if (rowCount > 0) await touchVaca(vacaId);
  return rowCount > 0;
}

/**
 * Cambia el rol o la cuota de un miembro.
 * @param {string} vacaId
 * @param {string} userId
 * @param {{ role?: 'admin'|'miembro', quota?: number|null }} changes
 * @returns {Promise<boolean>} `false` si no es miembro.
 */
export async function updateMember(vacaId, userId, changes) {
  const sets = [];
  const values = [vacaId, userId];
  if ('role' in changes) {
    values.push(changes.role);
    sets.push(`rol = $${values.length}`);
  }
  if ('quota' in changes) {
    values.push(changes.quota);
    sets.push(`cuota = $${values.length}`);
  }
  if (sets.length === 0) return true;
  const { rowCount } = await pool.query(
    `UPDATE vaca_miembros SET ${sets.join(', ')} WHERE vaca_id = $1 AND usuario_id = $2`,
    values,
  );
  if (rowCount > 0) await touchVaca(vacaId);
  return rowCount > 0;
}

/**
 * Saca a un miembro. Sus aportes se conservan en el total del grupo.
 * @param {string} vacaId
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si no era miembro.
 */
export async function removeMember(vacaId, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM vaca_miembros WHERE vaca_id = $1 AND usuario_id = $2',
    [vacaId, userId],
  );
  if (rowCount > 0) await touchVaca(vacaId);
  return rowCount > 0;
}

/**
 * Deja como administrador al miembro más antiguo, si el grupo se quedó sin ninguno.
 * @param {string} vacaId
 * @returns {Promise<void>}
 */
export async function ensureAdmin(vacaId) {
  await pool.query(
    `UPDATE vaca_miembros SET rol = 'admin'
     WHERE vaca_id = $1
       AND NOT EXISTS (SELECT 1 FROM vaca_miembros WHERE vaca_id = $1 AND rol = 'admin')
       AND usuario_id = (SELECT usuario_id FROM vaca_miembros WHERE vaca_id = $1
                          ORDER BY created_at, usuario_id LIMIT 1)`,
    [vacaId],
  );
}

/**
 * Guarda (o renueva) la invitación por correo a una vaca.
 * @param {{ vacaId: string, email: string, invitedBy: string }} data
 * @returns {Promise<{ email: string, sentAt: Date, previousSentAt: Date|null }>} `previousSentAt`
 *   es la hora del envío anterior (para no reenviar el correo muchas veces seguidas).
 */
export async function upsertInvitation({ vacaId, email, invitedBy }) {
  const { rows: previous } = await pool.query(
    'SELECT enviada_at FROM vaca_invitaciones WHERE vaca_id = $1 AND lower(email) = lower($2)',
    [vacaId, email],
  );
  const { rows } = await pool.query(
    `INSERT INTO vaca_invitaciones (vaca_id, email, invitado_por) VALUES ($1, $2, $3)
     ON CONFLICT (vaca_id, lower(email)) DO UPDATE SET enviada_at = now(), invitado_por = $3
     RETURNING email, enviada_at AS "sentAt"`,
    [vacaId, email, invitedBy],
  );
  return { ...rows[0], previousSentAt: previous[0]?.enviada_at ?? null };
}

/**
 * Invitaciones por correo que siguen pendientes (la persona aún no ha entrado).
 * @param {string} vacaId
 * @returns {Promise<Array<{ email: string, sentAt: Date }>>}
 */
export async function listInvitations(vacaId) {
  const { rows } = await pool.query(
    `SELECT email, enviada_at AS "sentAt" FROM vaca_invitaciones
     WHERE vaca_id = $1 ORDER BY enviada_at DESC`,
    [vacaId],
  );
  return rows;
}

/**
 * Cantidad de invitaciones pendientes de una vaca.
 * @param {string} vacaId
 * @returns {Promise<number>}
 */
export async function countInvitations(vacaId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM vaca_invitaciones WHERE vaca_id = $1',
    [vacaId],
  );
  return rows[0].n;
}

/**
 * Borra la invitación de un correo (la cancela o la persona ya entró).
 * @param {string} vacaId
 * @param {string} email
 * @returns {Promise<boolean>} `false` si no existía.
 */
export async function deleteInvitation(vacaId, email) {
  const { rowCount } = await pool.query(
    'DELETE FROM vaca_invitaciones WHERE vaca_id = $1 AND lower(email) = lower($2)',
    [vacaId, email],
  );
  return rowCount > 0;
}

/**
 * Inserta un aporte. Si ese `localId` ya existe para el usuario, no inserta nada.
 * @param {{ vacaId: string, userId: string, amount: number, note: string|null, date: string, transactionId: string|null, localId: string }} data
 * @returns {Promise<string|null>} Id del aporte, o `null` si ya existía.
 */
export async function insertContribution(data) {
  const { rows } = await pool.query(
    `INSERT INTO vaca_aportes (vaca_id, usuario_id, monto, nota, fecha, transaccion_id, local_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (usuario_id, local_id) WHERE local_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [data.vacaId, data.userId, data.amount, data.note, data.date, data.transactionId, data.localId],
  );
  if (rows[0]) await touchVaca(data.vacaId);
  return rows[0]?.id ?? null;
}

/**
 * Busca un aporte del usuario por el id que le dio su dispositivo (borrado o no).
 * @param {string} userId
 * @param {string} localId
 * @returns {Promise<ContributionRecord|null>}
 */
export async function findContributionByLocalId(userId, localId) {
  const { rows } = await pool.query(
    `${SELECT_CONTRIBUTION} WHERE a.usuario_id = $1 AND a.local_id = $2`,
    [userId, localId],
  );
  return rows[0] ?? null;
}

/**
 * Busca un aporte no borrado de una vaca.
 * @param {string} id
 * @param {string} vacaId
 * @returns {Promise<ContributionRecord|null>}
 */
export async function findContribution(id, vacaId) {
  const { rows } = await pool.query(
    `${SELECT_CONTRIBUTION} WHERE a.id = $1 AND a.vaca_id = $2 AND a.deleted_at IS NULL`,
    [id, vacaId],
  );
  return rows[0] ?? null;
}

/**
 * Borrado lógico de un aporte.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function softDeleteContribution(id) {
  const { rows } = await pool.query(
    'UPDATE vaca_aportes SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING vaca_id',
    [id],
  );
  if (rows[0]) await touchVaca(rows[0].vaca_id);
}

/**
 * Guarda el consejo generado y el total con el que se generó.
 * @param {string} id
 * @param {string} advice
 * @param {number} total
 * @returns {Promise<void>}
 */
export async function saveAdvice(id, advice, total) {
  await pool.query(
    'UPDATE vacas SET consejo = $2, consejo_total = $3, consejo_at = now() WHERE id = $1',
    [id, advice, total],
  );
}

/**
 * Anota la hora del último recordatorio, solo si el anterior fue hace más de `hours` horas.
 * Así dos administradores que pulsan a la vez no mandan dos recordatorios.
 * @param {string} id
 * @param {number} hours
 * @returns {Promise<boolean>} `false` si ya se envió uno hace menos de `hours` horas.
 */
export async function claimReminder(id, hours) {
  const { rowCount } = await pool.query(
    `UPDATE vacas SET recordatorio_at = now()
     WHERE id = $1 AND (recordatorio_at IS NULL OR recordatorio_at < now() - make_interval(hours => $2))`,
    [id, hours],
  );
  return rowCount > 0;
}
