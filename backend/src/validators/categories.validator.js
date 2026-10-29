import { AppError } from '../errors/app-error.js';

/** Íconos que puede elegir el usuario; el frontend tiene el dibujo de cada uno. */
export const CATEGORY_ICONS = [
  'paw-print',
  'dumbbell',
  'gift',
  'plane',
  'baby',
  'car',
  'fuel',
  'coffee',
  'pizza',
  'beer',
  'gamepad',
  'music',
  'book',
  'shopping-cart',
  'heart',
  'smartphone',
  'scissors',
  'briefcase',
  'piggy-bank',
  'sparkles',
];

/** Colores que puede elegir el usuario. */
export const CATEGORY_COLORS = [
  'orange',
  'sky',
  'amber',
  'rose',
  'teal',
  'fuchsia',
  'indigo',
  'emerald',
];

const NAME_MAX = 30;

/** @returns {AppError} 400: el cuerpo no es un objeto JSON. */
function invalidBody() {
  return new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
}

/**
 * @param {unknown} body
 * @returns {boolean} `true` si es un objeto normal (no `null`, no una lista).
 */
function isObject(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/**
 * Revisa los campos que se pueden cambiar y devuelve los presentes, limpios.
 * @param {Record<string, unknown>} body
 * @param {Array<{ field: string, problem: string }>} details Lista a la que se añaden los problemas.
 * @returns {{ name?: string, icon?: string, color?: string }}
 */
function readEditable(body, details) {
  const out = {};
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > NAME_MAX) {
      details.push({ field: 'name', problem: `Debe tener entre 1 y ${NAME_MAX} caracteres` });
    } else {
      out.name = name;
    }
  }
  if ('icon' in body) {
    if (CATEGORY_ICONS.includes(body.icon)) out.icon = body.icon;
    else details.push({ field: 'icon', problem: 'Ícono no válido' });
  }
  if ('color' in body) {
    if (CATEGORY_COLORS.includes(body.color)) out.color = body.color;
    else details.push({ field: 'color', problem: 'Color no válido' });
  }
  return out;
}

/**
 * Valida `POST /categories`: `{ name, type, icon, color }`.
 * @param {unknown} body
 * @returns {{ name: string, type: 'ingreso'|'gasto', icon: string, color: string }}
 * @throws {AppError} 400 si no es un objeto; 422 con el detalle por campo.
 */
export function parseNewCategory(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  for (const field of ['name', 'icon', 'color']) {
    if (!(field in body)) details.push({ field, problem: 'Es obligatorio' });
  }
  const values = readEditable(body, details);
  if (!['ingreso', 'gasto'].includes(body.type)) {
    details.push({ field: 'type', problem: 'Debe ser "ingreso" o "gasto"' });
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return { ...values, type: body.type };
}

/**
 * Valida `PATCH /categories/:key`: al menos uno de `name`, `icon` o `color`. El tipo no cambia.
 * @param {unknown} body
 * @returns {{ name?: string, icon?: string, color?: string }}
 * @throws {AppError} 400 si no es un objeto; 422 con el detalle por campo.
 */
export function parseCategoryChanges(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const values = readEditable(body, details);
  if (details.length === 0 && Object.keys(values).length === 0) {
    details.push({ field: 'name', problem: 'Envía al menos name, icon o color' });
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return values;
}
