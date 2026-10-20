/**
 * Utilidades para escribir montos en pesos colombianos con separadores de miles.
 *
 * El campo guarda siempre un texto "crudo" con solo dígitos y un punto decimal opcional
 * (por ejemplo `"1234567.5"`), que es lo que entiende `z.coerce.number()` y lo que se envía a
 * la API. Lo que se ve en pantalla (`1.234.567,5`) se calcula a partir de ese texto, así que
 * el formato nunca cambia el valor.
 */

/** Monto máximo que acepta la API (numeric(12,2)); coincide con los esquemas de validación. */
export const MAX_AMOUNT = 9_999_999_999.99;
/** A partir de aquí se avisa que el monto es inusualmente grande. */
export const LARGE_AMOUNT = 100_000_000;
/** Dígitos enteros máximos que se dejan escribir (el tope de la API tiene 10). */
const MAX_INTEGER_DIGITS = 10;
const MAX_DECIMALS = 2;

const compactFormat = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});
const fullFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/**
 * Convierte lo que se escribe en el campo en texto crudo. La coma es el decimal; los puntos se
 * ignoran porque son los separadores de miles que el propio campo agrega. Limita los dígitos a
 * 10 enteros y 2 decimales.
 * @param {string} text Texto del campo (con o sin separadores).
 * @returns {string} Por ejemplo `"1234.5"`, `"12."` (mientras se escribe el decimal) o `""`.
 */
export function parseMoneyInput(text) {
  const cleaned = String(text ?? "").replace(/[^\d,]/g, "");
  const [integerPart, ...rest] = cleaned.split(",");
  const integer = integerPart
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_INTEGER_DIGITS);
  if (rest.length === 0) return integer;
  const decimals = rest.join("").slice(0, MAX_DECIMALS);
  return `${integer || "0"}.${decimals}`;
}

/**
 * Interpreta un texto pegado, donde sí hay que adivinar el punto: `1500.50` y `1.500.000` son
 * cosas distintas. Un único punto seguido de 1 o 2 dígitos (y sin comas) es decimal; en los
 * demás casos los puntos son separadores de miles.
 * @param {string} text
 * @returns {string} Texto crudo, como en {@link parseMoneyInput}.
 */
export function parsePastedMoney(text) {
  const value = String(text ?? "").trim();
  if (/^\d+\.\d{1,2}$/.test(value))
    return parseMoneyInput(value.replace(".", ","));
  return parseMoneyInput(value);
}

/**
 * Texto crudo → texto con separadores de miles para mostrar.
 * @param {string} raw Por ejemplo `"1234567.5"`.
 * @returns {string} Por ejemplo `"1.234.567,5"`.
 */
export function formatMoneyInput(raw) {
  if (!raw) return "";
  const [integer, decimals] = String(raw).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals === undefined ? grouped : `${grouped},${decimals}`;
}

/**
 * Describe el monto escrito para dar retroalimentación mientras se teclea.
 * @param {string} raw Texto crudo del campo.
 * @returns {{ level: 'none'|'info'|'warning'|'error', message: string }}
 */
export function describeAmount(raw) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0)
    return { level: "none", message: "" };
  if (value > MAX_AMOUNT) {
    return {
      level: "error",
      message: `Supera el máximo permitido ($${fullFormat.format(MAX_AMOUNT)}).`,
    };
  }
  if (value >= LARGE_AMOUNT) {
    return {
      level: "warning",
      message: `Monto muy grande (${compact(value)} de pesos). Revisa que no sobren ceros.`,
    };
  }
  if (value >= 1_000_000)
    return { level: "info", message: `≈ ${compact(value)} de pesos` };
  if (value < 1_000) {
    return { level: "info", message: `Son menos de $1.000. ¿Faltan ceros?` };
  }
  return { level: "none", message: "" };
}

/**
 * Cantidad abreviada en palabras: `1500000` → `"1,5 millones"`.
 * @param {number} value
 * @returns {string}
 */
function compact(value) {
  if (value >= 1_000_000_000)
    return `${compactFormat.format(value / 1_000_000_000)} mil millones`;
  const millions = Math.round((value / 1_000_000) * 10) / 10;
  return `${compactFormat.format(millions)} ${millions === 1 ? "millón" : "millones"}`;
}
