import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Dónde viven los archivos de los soportes de pago (FT-0044). Hay dos formas con las mismas tres
 * operaciones; el resto del código no sabe cuál se usa:
 * - Disco: en desarrollo, en `backend/uploads/` (ignorado por git).
 * - Supabase Storage: en producción, en un espacio privado. Render borra su disco en cada
 *   despliegue, así que allá nunca se usa el disco.
 *
 * @typedef {object} AttachmentStorage
 * @property {'disco'|'supabase'} kind Cuál de las dos es.
 * @property {(key: string, data: Buffer, contentType: string) => Promise<void>} save Guarda un archivo.
 * @property {(key: string) => Promise<Buffer>} read Lee un archivo.
 * @property {(keys: string[]) => Promise<void>} remove No falla si alguno ya no existe.
 */

/**
 * @param {string} dir Carpeta base.
 * @returns {AttachmentStorage}
 */
export function createDiskStorage(dir) {
  // `key` la arma el servicio (usuario/uuid.ext), nunca viene del usuario: no puede salir de `dir`.
  const fileOf = (key) => path.join(dir, ...key.split('/'));
  return {
    kind: 'disco',
    async save(key, data) {
      await mkdir(path.dirname(fileOf(key)), { recursive: true });
      await writeFile(fileOf(key), data);
    },
    read: (key) => readFile(fileOf(key)),
    async remove(keys) {
      await Promise.all(keys.map((key) => rm(fileOf(key), { force: true })));
    },
  };
}

/**
 * Espacio privado de Supabase Storage por su API REST, con la clave `service_role` (solo en el
 * backend). El frontend nunca habla con Supabase: los archivos pasan siempre por la API.
 * @param {{ url: string, key: string, bucket: string, fetchImpl?: typeof fetch }} config
 * @returns {AttachmentStorage}
 */
export function createSupabaseStorage({ url, key, bucket, fetchImpl = fetch }) {
  const headers = { Authorization: `Bearer ${key}`, apikey: key };
  const objectUrl = (objectKey) => `${url}/storage/v1/object/${bucket}/${objectKey}`;
  const check = async (res, action) => {
    if (!res.ok) throw new Error(`Supabase Storage respondió ${res.status} al ${action}`);
    return res;
  };
  return {
    kind: 'supabase',
    async save(objectKey, data, contentType) {
      await check(
        await fetchImpl(objectUrl(objectKey), {
          method: 'POST',
          headers: { ...headers, 'Content-Type': contentType, 'x-upsert': 'false' },
          body: data,
        }),
        'guardar',
      );
    },
    async read(objectKey) {
      const res = await check(await fetchImpl(objectUrl(objectKey), { headers }), 'leer');
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(keys) {
      if (keys.length === 0) return;
      await check(
        await fetchImpl(`${url}/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: keys }),
        }),
        'borrar',
      );
    },
  };
}

/**
 * Elige el almacenamiento según la configuración. En producción sin Supabase devuelve `null`: los
 * soportes quedan apagados en vez de guardarse en un disco que se borra.
 * @param {typeof env} [config]
 * @returns {AttachmentStorage|null}
 */
export function selectStorage(config = env) {
  if (config.supabaseUrl && config.supabaseServiceKey) {
    return createSupabaseStorage({
      url: config.supabaseUrl,
      key: config.supabaseServiceKey,
      bucket: config.attachmentsBucket,
    });
  }
  if (config.nodeEnv === 'production') return null;
  return createDiskStorage(path.resolve(config.uploadsDir));
}
