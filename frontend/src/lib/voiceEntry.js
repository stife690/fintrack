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
  // Sin una cifra antes, pegada o no: en "30.000mil pesos" o "10 mil pesos", "mil pesos" no es otro monto.
  [/(?<!\p{L})(?<!\d\s*)medio palo(?!\p{L})/u, 500_000],
  [/(?<!\p{L})(?<!\d\s*)(un palo|un mill[oó]n)(?!\p{L})/u, 1_000_000],
  [/(?<!\p{L})(?<!\d\s*)una luca(?!\p{L})/u, 1_000],
  [/(?<!\p{L})(?<!\d\s*)mil pesos(?!\p{L})/u, 1_000],
];

/** Cuánto vale cada unidad que puede ir después del número. */
const UNITS = { mil: 1e3, k: 1e3, luca: 1e3, lucas: 1e3, palo: 1e6, palos: 1e6, millon: 1e6, millón: 1e6, millones: 1e6 };

/** Un número (con puntos o comas) y, opcionalmente, su unidad: "15 mil", "26.900", "1,2 millones". */
const NUMBER = /\$?\s?(\d+(?:[.,]\d+)*)\s*(mil|k|lucas?|palos?|mill[oó]n|millones)?(?!\p{L})/gu;

/** Cantidades dichas con palabras ("tres almuerzos"); el dictado suele escribirlas así. */
const QUANTITY_WORDS = ['dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const QUANTITY_WORD = new RegExp(`(?<!\\p{L})(${QUANTITY_WORDS.join('|')})(?!\\p{L})(?!\\s+(mil|mill))`, 'u');

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']; // como Date#getDay
const DAYS_AGO = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

/**
 * Formas de decir cuándo fue, de la más precisa a la más general. Cada una da la fecha a partir
 * de "hoy" (medianoche local), o `null` si no existe ("31 de febrero"). Nunca da una fecha futura:
 * "el 20 de diciembre" dicho en octubre es el del año pasado; "el 30", el del mes pasado.
 */
const DATE_PATTERNS = [
  {
    re: /(?<!\p{L})(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?(?!\p{L})/iu,
    date: (m, today) => {
      const month = m[2].toLowerCase() === 'setiembre' ? 8 : MONTHS.indexOf(m[2].toLowerCase());
      const year = m[3] ? Number(m[3]) : today.getFullYear();
      const date = validDate(year, month, Number(m[1]));
      if (!date || m[3] || date <= today) return date;
      return validDate(year - 1, month, Number(m[1]));
    },
  },
  { re: /(?<!\p{L})(antier|anteayer|antes de ayer)(?!\p{L})/iu, date: (m, today) => addDays(today, -2) },
  { re: /(?<!\p{L})ayer(?!\p{L})/iu, date: (m, today) => addDays(today, -1) },
  { re: /(?<!\p{L})hoy(?!\p{L})/iu, date: (m, today) => today },
  {
    re: /(?<!\p{L})hace\s+(\d{1,2}|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+d[ií]as?(?!\p{L})/iu,
    date: (m, today) => addDays(today, -(DAYS_AGO[m[1].toLowerCase()] ?? Number(m[1]))),
  },
  {
    re: /(?<!\p{L})(?:el\s+)?(?:pasado\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:\s+pasado)?(?!\p{L})/iu,
    date: (m, today) => {
      const weekday = WEEKDAYS.indexOf(m[1].toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''));
      return addDays(today, -((today.getDay() - weekday + 7) % 7));
    },
  },
  {
    // "el 12 gasté…": día de este mes. No si sigue una unidad ("el 15 mil" es un monto).
    re: /(?<!\p{L})el\s+(\d{1,2})(?![\d.,])(?!\s*(?:mil|k|lucas?|palos?|mill))(?!\p{L})/iu,
    date: (m, today) => {
      const day = Number(m[1]);
      const date = validDate(today.getFullYear(), today.getMonth(), day);
      return date && date <= today ? date : validDate(today.getFullYear(), today.getMonth() - 1, day);
    },
  },
];

/** "un millón 200 mil" o "1 millón 200 mil": millones y miles dichos por separado. */
const MILLIONS_AND_THOUSANDS = /(?<!\p{L})(un|\d+)\s+mill[oó]n(?:es)?\s+(?:y\s+)?(\d{1,3})\s+mil(?!\p{L})/iu;

/** Puntuación y comillas que el dictado deja al principio o al final ("Almuerzo."). */
const EDGE_PUNCTUATION = /^[\s.,;:!?¡¿"“”']+|[\s.,;:!?¡¿"“”']+$/g;

/** Palabras que sobran en la descripción. */
const FILLER =
  /(?<!\p{L})(me pagaron|me consignaron|me dieron|recib[ií]|gast[eé]|pagu[eé]|compr[eé]|y cada un[oa]|cada un[oa]|me cost[oó]|cost[oó]|me sali[oó]|de|en|por|a|el|la|los|las|pesos?)(?!\p{L})/giu;

/**
 * @param {string} text Lo que entendió el reconocimiento de voz.
 * @param {Date} [now] Para las pruebas: "hoy" desde el que se cuentan "ayer", "el lunes"…
 * @returns {{ type: 'gasto'|'ingreso', amount: number|null, options: number[], description: string, date: string, ambiguous: boolean }}
 *   `amount` es el número mayor que se dijo (`null` si no hubo un monto válido). `ambiguous` es
 *   `true` si se dijo más de un número; en ese caso la pantalla pide revisar el monto y, si uno era
 *   una cantidad ("2 almuerzos de 12 mil"), `options` trae el precio y el total: `[12000, 24000]`.
 *   `date` es AAAA-MM-DD: la que se dijo ("ayer", "el 12 de octubre") u hoy si no se dijo ninguna.
 */
export function parseSpokenTransaction(text, now = new Date()) {
  // La fecha se quita primero para que su número ("el 12 de octubre") no se tome como monto.
  const { date, rest } = extractDate(String(text ?? '').trim(), now);
  const said = rest.replace(MILLIONS_AND_THOUSANDS, (_, millions, thousands) =>
    String((millions.toLowerCase() === 'un' ? 1 : Number(millions)) * 1e6 + Number(thousands) * 1e3),
  );
  const lower = said.toLowerCase();
  const type = INCOME_WORDS.test(lower) ? 'ingreso' : 'gasto';

  const found = [...lower.matchAll(NUMBER)].map((match) => ({
    text: match[0].trim(),
    value: toNumber(match[1]) * unitValue(match[1], match[2]),
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
  description = description.replace(FILLER, ' ').replace(/\s+/g, ' ').replace(EDGE_PUNCTUATION, '').slice(0, 200);
  if (description) description = description[0].toUpperCase() + description.slice(1);
  else if (type === 'ingreso') description = 'Pago recibido';

  return { type, amount, options, description, date, ambiguous: found.length > 1 };
}

/**
 * Busca la primera forma de decir la fecha y la quita del texto.
 * @param {string} text
 * @param {Date} now
 * @returns {{ date: string, rest: string }} Fecha AAAA-MM-DD (hoy si no se dijo) y el texto sin ella.
 */
function extractDate(text, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.re.exec(text);
    const date = match && pattern.date(match, today);
    if (date) {
      const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
      return { date: toIsoDate(date), rest: rest.replace(/\s+/g, ' ').trim() };
    }
  }
  return { date: toIsoDate(today), rest: text };
}

/** Fecha local, o `null` si el día no existe en ese mes ("31 de febrero"). */
function validDate(year, month, day) {
  const date = new Date(year, month, day);
  return date.getDate() === day ? date : null;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** AAAA-MM-DD en la zona del dispositivo (como `today()` del formulario). */
function toIsoDate(date) {
  return date.toLocaleDateString('en-CA');
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

/**
 * Cuánto multiplica la unidad. Si la cifra ya viene con puntos de miles ("30.000mil"), el "mil"
 * se dijo de más: "treinta mil" escrito dos veces, no treinta millones.
 * @param {string} digits
 * @param {string|undefined} unit
 * @returns {number}
 */
function unitValue(digits, unit) {
  const factor = UNITS[unit] ?? 1;
  return factor === 1e3 && /^\d{1,3}([.,]\d{3})+$/.test(digits) ? 1 : factor;
}

/** Un número entero pequeño y sin unidad, como el 2 de "2 almuerzos". */
function isQuantity(item) {
  return item.plain && Number.isInteger(item.value) && item.value >= 2 && item.value <= 20;
}

/** Escapa un texto para usarlo dentro de una expresión regular. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
