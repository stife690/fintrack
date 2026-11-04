/**
 * Comprime una foto antes de subirla como soporte de pago (FT-0044): la foto de una factura del
 * celular pesa 3-5 MB y con 1600 px de lado ya se lee bien (~300 KB). De paso convierte las HEIC
 * del iPhone a JPG, que el backend sí acepta. Los PDF se suben tal cual.
 */

/** Lado más largo de la foto comprimida, en píxeles. */
export const MAX_SIDE = 1600;

/** Calidad del JPG (0 a 1). */
const QUALITY = 0.8;

/**
 * Tamaño que conserva la proporción sin pasar de `max` en el lado más largo. Nunca agranda.
 * @param {number} width
 * @param {number} height
 * @param {number} [max]
 * @returns {{ width: number, height: number }}
 */
export function fitSize(width, height, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Nombre del archivo con extensión `.jpg`.
 * @param {string} name
 * @returns {string}
 */
export function jpgName(name) {
  const base = name.replace(/\.[^.]*$/, '') || 'foto';
  return `${base}.jpg`;
}

/**
 * Prepara un archivo para subirlo: las fotos se reducen y pasan a JPG; lo demás queda igual.
 * Si comprimir no la achica (ya era pequeña), se sube la original.
 * @param {File} file
 * @returns {Promise<{ blob: Blob, name: string }>}
 * @throws {Error} Si el navegador no puede leer la foto.
 */
export async function prepareUpload(file) {
  if (!file.type.startsWith('image/')) return { blob: file, name: file.name };
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pudimos leer la foto. Prueba con otra o súbela como PDF.');
  }
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('No pudimos preparar la foto. Prueba con otra.');
  // Una JPG/PNG/WebP ya pequeña se sube como estaba; una HEIC siempre pasa a JPG.
  const accepted = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (accepted && blob.size >= file.size) return { blob: file, name: file.name };
  return { blob, name: jpgName(file.name) };
}
