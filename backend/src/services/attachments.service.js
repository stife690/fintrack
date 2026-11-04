import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import * as defaultRepo from '../repositories/attachments.repository.js';
import { findTransaction } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { selectStorage } from './attachment-storage.service.js';

/**
 * Soportes de pago (FT-0044): foto o PDF adjunto a un movimiento. Solo el dueño del movimiento
 * los ve, y se borran con él. Sin lectura con IA en este sprint.
 */

/** Tamaño máximo de un soporte. Las fotos llegan comprimidas desde el celular (~300 KB). */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Soportes por movimiento (mockup 3 de la propuesta). */
export const MAX_ATTACHMENTS = 3;

const MAX_NAME_LENGTH = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Firma de cada tipo permitido: sus primeros bytes ("números mágicos") y la extensión. */
const SIGNATURES = [
  {
    type: 'image/jpeg',
    ext: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/png',
    ext: 'png',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: 'image/webp',
    ext: 'webp',
    matches: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  },
  { type: 'application/pdf', ext: 'pdf', matches: (b) => b.toString('latin1', 0, 5) === '%PDF-' },
];

/**
 * Tipo real del archivo según sus primeros bytes. No se confía en lo que dice el navegador: así
 * nadie sube un ejecutable con extensión `.jpg`.
 * @param {Buffer} data
 * @returns {{ type: string, ext: string }|null} `null` si no es JPG, PNG, WebP ni PDF.
 */
export function detectType(data) {
  if (data.length < 12) return null;
  const found = SIGNATURES.find((s) => s.matches(data));
  return found ? { type: found.type, ext: found.ext } : null;
}

/**
 * Nombre para mostrar: sin carpetas ni caracteres de control, y no muy largo. Solo se muestra;
 * el archivo se guarda con un nombre aleatorio.
 * @param {unknown} raw
 * @param {string} ext
 * @returns {string}
 */
export function cleanName(raw, ext) {
  const base = typeof raw === 'string' ? raw.split(/[\\/]/).pop() : '';
  // Los caracteres de control (saltos de línea, etc.) podrían romper la cabecera al descargarlo.
  // eslint-disable-next-line no-control-regex
  const CONTROL = /[\u0000-\u001f\u007f]/g;
  const name = base.replace(CONTROL, '').trim().slice(0, MAX_NAME_LENGTH);
  return name || `soporte.${ext}`;
}

/**
 * @param {string} [what] Qué no se encontró.
 * @returns {AppError} 404 sin revelar si el movimiento o el soporte es de otro usuario (RN-01).
 */
function notFound(what = 'El movimiento') {
  return new AppError(404, 'NOT_FOUND', `${what} no existe`);
}

/**
 * Lo que se le muestra al usuario de un soporte: sin la ruta del almacenamiento.
 * @param {import('../repositories/attachments.repository.js').AttachmentRecord} record
 * @returns {{ id: string, name: string, type: string, size: number, createdAt: Date }}
 */
function toView(record) {
  const { id, name, type, size, createdAt } = record;
  return { id, name, type, size, createdAt };
}

/**
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {import('./attachment-storage.service.js').AttachmentStorage|null} [deps.storage]
 * @param {typeof defaultRepo} [deps.repository]
 * @param {typeof env} [deps.config]
 * @returns {object} `isEnabledFor`, `list`, `upload`, `read`, `remove`, `removeAllOf` y `removeFiles`.
 */
export function createAttachmentsService(deps = {}) {
  const storage = 'storage' in deps ? deps.storage : selectStorage();
  const repo = deps.repository ?? defaultRepo;
  const config = deps.config ?? env;

  /**
   * ¿Puede este correo usar los soportes? Hace falta dónde guardarlos y estar en
   * `ATTACHMENTS_ALLOWED_EMAILS` (o `*`). Fuera de producción, la lista vacía es para todos.
   * @param {string} email
   * @returns {boolean}
   */
  function isEnabledFor(email) {
    if (!storage) return false;
    const allowed = config.attachmentsAllowedEmails;
    if (allowed.length === 0) return config.nodeEnv !== 'production';
    return allowed.includes('*') || allowed.includes(email.toLowerCase());
  }

  /**
   * @param {string} userId
   * @returns {Promise<void>}
   * @throws {AppError} 403 `FEATURE_DISABLED` si el usuario no tiene los soportes activos.
   */
  async function ensureEnabled(userId) {
    const user = await findUserById(userId);
    if (!user || !isEnabledFor(user.email)) {
      throw new AppError(
        403,
        'FEATURE_DISABLED',
        'Los soportes de pago todavía no están disponibles',
      );
    }
  }

  /**
   * @param {string} userId
   * @param {string} transactionId
   * @returns {Promise<void>}
   * @throws {AppError} 404 si el movimiento no es del usuario o está borrado.
   */
  async function ensureTransaction(userId, transactionId) {
    if (!UUID_RE.test(transactionId) || !(await findTransaction(transactionId, userId))) {
      throw notFound();
    }
  }

  return {
    isEnabledFor,

    /**
     * Soportes de un movimiento.
     * @param {string} userId
     * @param {string} transactionId
     * @returns {Promise<{ items: object[], max: number, maxBytes: number }>}
     */
    async list(userId, transactionId) {
      await ensureEnabled(userId);
      await ensureTransaction(userId, transactionId);
      const items = await repo.listAttachments(transactionId, userId);
      return { items: items.map(toView), max: MAX_ATTACHMENTS, maxBytes: MAX_ATTACHMENT_BYTES };
    },

    /**
     * Adjunta un archivo a un movimiento. Primero se guarda el archivo y luego la fila; si la
     * fila no entra (límite o movimiento borrado), el archivo se borra.
     * @param {string} userId
     * @param {string} transactionId
     * @param {{ data: Buffer, name?: string }} file
     * @returns {Promise<object>} El soporte creado.
     */
    async upload(userId, transactionId, { data, name }) {
      await ensureEnabled(userId);
      if (!UUID_RE.test(transactionId)) throw notFound();
      if (!Buffer.isBuffer(data) || data.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'No llegó ningún archivo');
      }
      if (data.length > MAX_ATTACHMENT_BYTES) {
        throw new AppError(413, 'FILE_TOO_LARGE', 'El archivo pesa más de 5 MB');
      }
      const detected = detectType(data);
      if (!detected) {
        throw new AppError(415, 'UNSUPPORTED_FILE', 'Solo se aceptan fotos (JPG, PNG, WebP) o PDF');
      }
      const key = `${userId}/${randomUUID()}.${detected.ext}`;
      await storage.save(key, data, detected.type);
      const saved = await repo.insertAttachment({
        transactionId,
        userId,
        name: cleanName(name, detected.ext),
        type: detected.type,
        size: data.length,
        key,
        max: MAX_ATTACHMENTS,
      });
      if (saved) return toView(saved);

      await storage.remove([key]);
      await ensureTransaction(userId, transactionId); // 404 si el movimiento no es suyo
      throw new AppError(
        409,
        'ATTACHMENT_LIMIT',
        `Un movimiento puede tener hasta ${MAX_ATTACHMENTS} soportes`,
      );
    },

    /**
     * Archivo de un soporte, para verlo.
     * @param {string} userId
     * @param {string} transactionId
     * @param {string} id
     * @returns {Promise<{ data: Buffer, type: string, name: string }>}
     */
    async read(userId, transactionId, id) {
      await ensureEnabled(userId);
      const found =
        UUID_RE.test(transactionId) && UUID_RE.test(id)
          ? await repo.findAttachment(id, transactionId, userId)
          : null;
      if (!found) throw notFound('El soporte');
      return { data: await storage.read(found.key), type: found.type, name: found.name };
    },

    /**
     * Borra un soporte (la fila y el archivo).
     * @param {string} userId
     * @param {string} transactionId
     * @param {string} id
     * @returns {Promise<void>}
     */
    async remove(userId, transactionId, id) {
      await ensureEnabled(userId);
      const key =
        UUID_RE.test(transactionId) && UUID_RE.test(id)
          ? await repo.deleteAttachment(id, transactionId, userId)
          : null;
      if (!key) throw notFound('El soporte');
      await storage.remove([key]);
    },

    /**
     * Borra los soportes de un movimiento que se eliminó. No exige tener los soportes activos:
     * lo que se subió antes siempre se limpia. Si falla el almacenamiento, el movimiento igual
     * queda borrado y el error va al log (las filas ya no existen).
     * @param {string} userId
     * @param {string} transactionId
     * @returns {Promise<void>}
     */
    async removeAllOf(userId, transactionId) {
      await removeFiles(await repo.deleteAttachmentsOf(transactionId, userId));
    },

    removeFiles,
  };

  /**
   * Borra archivos cuyas filas ya no existen (movimiento o cuenta eliminados). Si falla el
   * almacenamiento, el error va al log y no se lanza: lo importante (la base) ya quedó borrado.
   * @param {string[]} keys
   * @returns {Promise<void>}
   */
  async function removeFiles(keys) {
    if (keys.length === 0 || !storage) return;
    await storage.remove(keys).catch((err) => {
      console.error(`No se pudieron borrar ${keys.length} soportes (${err.message})`);
    });
  }
}

export const attachments = createAttachmentsService();
