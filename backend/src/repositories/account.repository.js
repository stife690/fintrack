import { pool } from '../config/db.js';

/**
 * Borra la cuenta y todo lo personal del usuario en una sola transacción (FT-0017): si algo falla,
 * no se borra nada.
 *
 * Casi todo cae solo por `ON DELETE CASCADE` al borrar la fila de `usuarios` (movimientos,
 * presupuestos, tarjetas, Mi plata, sesiones, WhatsApp, push...). Lo compartido necesita pasos antes:
 * - En las vacas y negocios donde era el único administrador (o dueño), el miembro más antiguo
 *   pasa a serlo, para que el grupo no quede sin quién lo maneje. En los negocios se prefiere a un
 *   editor antes que a un lector.
 * - Las vacas y negocios donde ya no queda nadie más se borran.
 * - Sus aportes en vacas ajenas se quedan sin nombre (`SET NULL`): la plata que reunió el grupo
 *   sigue cuadrando.
 * - Se borran las invitaciones pendientes a su correo (otro dato personal).
 *
 * Los archivos de los soportes no están en la base: se devuelven sus rutas para borrarlos después.
 * @param {string} userId
 * @returns {Promise<{ email: string, attachmentKeys: string[] }|null>} `null` si la cuenta ya no existe.
 */
export async function deleteAccount(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: users } = await client.query(
      'SELECT email FROM usuarios WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (users.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const { email } = users[0];

    // Bloquea sus grupos (en orden, para no cruzarse con otro que se va al mismo tiempo).
    await client.query(
      `SELECT id FROM vacas WHERE id IN (SELECT vaca_id FROM vaca_miembros WHERE usuario_id = $1)
       ORDER BY id FOR UPDATE`,
      [userId],
    );
    await client.query(
      `SELECT id FROM negocios
       WHERE id IN (SELECT negocio_id FROM negocio_socios WHERE usuario_id = $1)
       ORDER BY id FOR UPDATE`,
      [userId],
    );

    await client.query(
      `UPDATE vaca_miembros m SET rol = 'admin'
       FROM (
         SELECT DISTINCT ON (o.vaca_id) o.vaca_id, o.usuario_id
         FROM vaca_miembros o
         WHERE o.usuario_id <> $1
           AND o.vaca_id IN (SELECT vaca_id FROM vaca_miembros WHERE usuario_id = $1 AND rol = 'admin')
           AND NOT EXISTS (
             SELECT 1 FROM vaca_miembros a
             WHERE a.vaca_id = o.vaca_id AND a.rol = 'admin' AND a.usuario_id <> $1)
         ORDER BY o.vaca_id, o.created_at, o.usuario_id
       ) heredero
       WHERE m.vaca_id = heredero.vaca_id AND m.usuario_id = heredero.usuario_id`,
      [userId],
    );
    await client.query(
      `UPDATE negocio_socios s SET rol = 'dueno'
       FROM (
         SELECT DISTINCT ON (o.negocio_id) o.negocio_id, o.usuario_id
         FROM negocio_socios o
         WHERE o.usuario_id <> $1
           AND o.negocio_id IN (
             SELECT negocio_id FROM negocio_socios WHERE usuario_id = $1 AND rol = 'dueno')
           AND NOT EXISTS (
             SELECT 1 FROM negocio_socios d
             WHERE d.negocio_id = o.negocio_id AND d.rol = 'dueno' AND d.usuario_id <> $1)
         ORDER BY o.negocio_id, (o.rol = 'lector'), o.created_at, o.usuario_id
       ) heredero
       WHERE s.negocio_id = heredero.negocio_id AND s.usuario_id = heredero.usuario_id`,
      [userId],
    );

    await client.query(
      `DELETE FROM vacas v
       WHERE EXISTS (SELECT 1 FROM vaca_miembros WHERE vaca_id = v.id AND usuario_id = $1)
         AND NOT EXISTS (SELECT 1 FROM vaca_miembros WHERE vaca_id = v.id AND usuario_id <> $1)`,
      [userId],
    );
    await client.query(
      `DELETE FROM negocios n
       WHERE EXISTS (SELECT 1 FROM negocio_socios WHERE negocio_id = n.id AND usuario_id = $1)
         AND NOT EXISTS (SELECT 1 FROM negocio_socios WHERE negocio_id = n.id AND usuario_id <> $1)`,
      [userId],
    );

    await client.query('DELETE FROM vaca_invitaciones WHERE lower(email) = lower($1)', [email]);
    await client.query('DELETE FROM negocio_invitaciones WHERE lower(email) = lower($1)', [email]);

    const { rows: files } = await client.query(
      'SELECT ruta AS key FROM transaccion_soportes WHERE usuario_id = $1',
      [userId],
    );
    await client.query('DELETE FROM usuarios WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return { email, attachmentKeys: files.map((f) => f.key) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
