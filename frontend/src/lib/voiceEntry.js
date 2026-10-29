import { MAX_AMOUNT } from '@/lib/money';

/**
 * Convierte lo que el usuario dijo ("almuerzo 15 mil", "me pagaron 1,2 millones") en los datos
 * de un movimiento nuevo. Corre en el dispositivo, sin red ni IA: la categoría la sigue
 * eligiendo la IA del servidor al guardar, igual que en el formulario.
 */

/** Palabras que indican que entró plata; todo lo demás se toma como gasto. */
const INCOME_WORDS =
  /(?<!\p{L})(me pagaron|pagaron|recib[ií]|me consignaron|me dieron|vend[ií]|salario|sueldo|prima|ingreso)(?!\p{L})/u;

/** Montos dichos solo con palabras, como se habla en Colombia. */
const SPOKEN_AMOUNTS = [
  [/(?<!\p{L})medio palo(?!\p{L})/u, 500_000],
  [/(?<!\p{L})(un palo|un mill[oó]n)(?!\p{L})/u, 1_000_000],
  [/(?<!\p{L})una luca(?!\p{L})/u, 1_000],
  [/(?<!\p{L})mil pesos(?!\p{L})/u, 1_000],
];

/** Cuánto vale cada unidad que puede ir después del número. */
const UNITS = { mil: 1e3, k: 1e3, luca: 1e3, lucas: 1e3, palo: 1e6, palos: 1e6, millon: 1e6, millón: 1e6, millones: 1e6 };

/** Un número (con puntos o comas) y, opcionalmente, su unidad: "15 mil", "26.900", "1,2 millones". */
const NUMBER = /\$?\s?(\d+(?:[.,]\d+)*)\s*(mil|k|lucas?|palos?|mill[oó]n|millones)?(?!\p{L})/gu;

/** Cantidades dichas con palabras ("tres almuerzos"); el dictado suele escribirlas así. */
const QUANTITY_WORDS = ['dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const QUANTITY_WORD = new RegExp(`(?<!\\p{L})(${QUANTITY_WORDS.join('|')})(?!\\p{L})(?!\\s+(mil|mill))`, 'u');

/** Palabras que sobran en la descripción. */
const FILLER =
  /(?<!\p{L})(me pagaron|me consignaron|me dieron|recib[ií]|gast[eé]|pagu[eé]|compr[eé]|de|en|por|a|el|la|los|las|pesos?)(?!\p{L})/giu;

/**
 * @param {string} text Lo que entendió el reconocimiento de voz.
 * @returns {{ type: 'gasto'|'ingreso', amount: number|null, options: number[], description: string, ambiguous: boolean }}
 *   `amount` es el número mayor que se dijo (`null` si no hubo un monto válido). `ambiguous` es
 *   `true` si se dijo más de un número; en ese caso la pantalla pide revisar el monto y, si uno era
 *   una cantidad ("2 almuerzos de 12 mil"), `options` trae el precio y el total: `[12000, 24000]`.
 */
export function parseSpokenTransaction(text) {
  const said = String(text ?? '').trim();
  const lower = said.toLowerCase();
  const type = INCOME_WORDS.test(lower) ? 'ingreso' : 'gasto';

  const found = [...lower.matchAll(NUMBER)].map((match) => ({
    text: match[0].trim(),
    value: toNumber(match[1]) * (UNITS[match[2]] ?? 1),
    plain: !match[2], // sin unidad: puede ser una cantidad ("2 almuerzos")
    atEnd: lower.slice(match.index + match[0].length).trim() === '',
  }));
  for (const [pattern, value] of SPOKEN_AMOUNTS) {
    const match = lower.match(pattern);
    if (match) found.push({ text: match[0], value, plain: false, atEnd: false });
  }
  // "tres almuerzos de 15 mil": la cantidad en palabras cuenta como un número más. No se toma si
  // va antes de "mil" o "millones" ("dos mil"), porque ahí es parte del monto.
  const word = found.length === 1 && lower.match(QUANTITY_WORD);
  if (word) found.push({ text: word[0], value: QUANTITY_WORDS.indexOf(word[1]) + 2, plain: true, atEnd: false });

  const biggest = found.reduce((best, item) => (item.value > (best?.value ?? 0) ? item : best), null);
  // El dictado a veces se come el "mil" ("3 almuerzos de 15"). Nadie paga $15 pesos: un número
  // sin unidad, menor que 100 y al final de la frase, es un precio en miles.
  if (biggest?.plain && biggest.atEnd && biggest.value < 100) biggest.value *= 1000;
  const amount = biggest && biggest.value > 0 && biggest.value <= MAX_AMOUNT ? biggest.value : null;

  // "2 almuerzos de 12 mil": se ofrece el precio dicho y el total; la persona elige.
  const quantity = found.length === 2 ? found.find((item) => item !== biggest && isQuantity(item)) : null;
  const total = quantity && amount * quantity.value <= MAX_AMOUNT ? amount * quantity.value : null;
  const options = amount ? (total ? [amount, total] : [amount]) : [];

  // Solo se quita el número usado como monto: "2 almuerzos de 12 mil" → "2 almuerzos".
  let description = biggest ? said.replace(new RegExp(escapeRegExp(biggest.text), 'i'), ' ') : said;
  description = description.replace(FILLER, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (description) description = description[0].toUpperCase() + description.slice(1);
  else if (type === 'ingreso') description = 'Pago recibido';

  return { type, amount, options, description, ambiguous: found.length > 1 };
}

/**
 * Número escrito por el reconocimiento de voz → valor. Los grupos de 3 dígitos son miles, con
 * punto o coma ("15.000", "1,500,000"); 1 o 2 dígitos tras el separador son decimales ("1,2",
 * "1500.50"). No recorta dígitos como el campo de monto: un número enorme da `Infinity` y se
 * descarta, en vez de convertirse en otro monto en silencio.
 * @param {string} digits
 * @returns {number}
 */
function toNumber(digits) {
  if (/^\d{1,3}([.,]\d{3})+$/.test(digits)) return Number(digits.replace(/[.,]/g, ''));
  if (/^\d+[.,]\d{1,2}$/.test(digits)) return Number(digits.replace(',', '.'));
  if (/^\d+$/.test(digits)) return Number(digits);
  return Infinity; // "1.2.3": no es un monto
}

/** Un número entero pequeño y sin unidad, como el 2 de "2 almuerzos". */
function isQuantity(item) {
  return item.plain && Number.isInteger(item.value) && item.value >= 2 && item.value <= 20;
}

/** Escapa un texto para usarlo dentro de una expresión regular. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
