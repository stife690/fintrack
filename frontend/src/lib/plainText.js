const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' };

/**
 * Texto para comparar en una búsqueda: sin mayúsculas ni tildes. La ñ se conserva, igual que en
 * `GET /transactions?q=`, para que sin conexión se encuentre lo mismo.
 * @param {string} text
 * @returns {string}
 */
export function plainText(text) {
  return text.toLowerCase().replace(/[áéíóúü]/g, (letter) => ACCENTS[letter]);
}
