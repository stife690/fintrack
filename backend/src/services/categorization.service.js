import { listCategories } from '../repositories/categories.repository.js';
import { AppError } from '../errors/app-error.js';
import { completeText } from './ai-client.service.js';

/** Instrucciones fijas del modelo: solo puede responder con una clave del catálogo. */
const SYSTEM_PROMPT =
  'Eres un clasificador de transacciones financieras personales. ' +
  'Responde ÚNICAMENTE con la clave de una categoría de la lista, sin explicación, ' +
  'sin comillas y sin puntuación.';

/**
 * Normaliza la respuesta del modelo para compararla con el catálogo.
 * @param {string} text
 * @returns {string}
 */
function normalizeKey(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s"'`.]+/g, '');
}

/**
 * Crea el categorizador. Las dependencias se inyectan para poder probarlo sin red ni BD.
 *
 * @param {{ listCategories?: typeof listCategories, completeText?: typeof completeText }} [deps]
 * @returns {{
 *   suggestCategory: (input: { description: string, type: 'ingreso'|'gasto', userId?: string }) => Promise<{ category: string|null, source: 'ia'|'sin_clasificar' }>,
 *   resolveCategory: (input: { category?: string|null, description: string, type: 'ingreso'|'gasto', userId?: string }) => Promise<{ category: string|null, source: 'manual'|'ia'|'sin_clasificar' }>
 * }}
 */
export function createCategorizer(deps = {}) {
  const getCategories = deps.listCategories ?? listCategories;
  const ask = deps.completeText ?? completeText;

  /**
   * Pide a la IA una categoría de las que puede usar el usuario (REQ-010): las de todos y las
   * suyas. Solo se envían la descripción y las claves y nombres de las categorías: nunca monto,
   * fecha ni datos del usuario.
   * La respuesta se valida contra el catálogo (RN-02); si no es válida, o la IA no
   * está disponible, devuelve `sin_clasificar` en vez de fallar (REQ-011).
   *
   * @param {{ description: string, type: 'ingreso'|'gasto', userId?: string }} input
   * @returns {Promise<{ category: string|null, source: 'ia'|'sin_clasificar' }>}
   */
  async function suggestCategory({ description, type, userId }) {
    const catalog = (await getCategories(userId)).filter((c) => c.type === type);
    const keys = new Set(catalog.map((c) => c.key));
    const list = catalog.map((c) => `- ${c.key}: ${c.name}`).join('\n');

    let answer;
    try {
      answer = await ask({
        system: SYSTEM_PROMPT,
        prompt: `Categorías disponibles:\n${list}\n\nDescripción: ${description}`,
      });
    } catch (err) {
      if (err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
        return { category: null, source: 'sin_clasificar' };
      }
      throw err;
    }

    const key = normalizeKey(answer);
    if (!keys.has(key)) {
      // Ayuda a diagnosticar: la IA respondió, pero no con una clave del catálogo.
      console.warn(
        `La IA respondió "${answer.trim().slice(0, 60)}", que no es una categoría de tipo ${type}`,
      );
      return { category: null, source: 'sin_clasificar' };
    }
    return { category: key, source: 'ia' };
  }

  /**
   * Punto de integración para el guardado de una transacción (REQ-010/011):
   * si el usuario eligió categoría se respeta (`manual`); si no, se pide a la IA.
   * Nunca lanza por fallos de la IA: la transacción siempre se puede guardar.
   *
   * @param {{ category?: string|null, description: string, type: 'ingreso'|'gasto', userId?: string }} input
   * @returns {Promise<{ category: string|null, source: 'manual'|'ia'|'sin_clasificar' }>}
   */
  async function resolveCategory({ category, description, type, userId }) {
    if (category) {
      return { category, source: 'manual' };
    }
    return suggestCategory({ description, type, userId });
  }

  return { suggestCategory, resolveCategory };
}

const categorizer = createCategorizer();

/** Categorizador con las dependencias reales (BD y proveedor de IA). */
export const { suggestCategory, resolveCategory } = categorizer;
