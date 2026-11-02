import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import * as repo from '../repositories/whatsapp.repository.js';
import { parseSpokenTransaction } from './entry-parser.js';
import { todayIso } from './insights.service.js';
import { create as createTransaction, summary as summarizePeriod } from './transactions.service.js';
import { sendText } from './whatsapp-client.service.js';

/** Minutos que dura el código para vincular; la pantalla de Cuenta dice lo mismo. */
export const LINK_CODE_MINUTES = 10;

/** Sin 0, O, 1, I ni L, que se confunden al leerlos. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_RE = /^FT-[A-Z0-9]{8}$/;

/** Preguntas que entiende el bot, sobre el texto en minúsculas y sin tildes. */
const BALANCE_QUESTION = /(?<!\p{L})(cuanto tengo|cuanta plata tengo|cuanto me queda|saldo|balance)(?!\p{L})/u;
const EXPENSE_QUESTION = /(?<!\p{L})(cuanto (he gastado|llevo gastado|gaste)|mis gastos|gastos del mes)(?!\p{L})/u;
const ANY_QUESTION = /\?|^¿?\s*(cuanto|cuanta|que|como|cual)(?!\p{L})/u;

export const REPLIES = {
  unlinked: 'Hola. Para usar este chat, conecta tu número en FinTrack, en Cuenta → WhatsApp.',
  linked: 'Listo, tu número quedó conectado. Escríbeme algo como "almuerzo 15 mil".',
  invalidCode: 'Ese código no es válido o ya venció. Genera uno nuevo en FinTrack, en Cuenta.',
  taken: 'Este número ya está conectado a otra cuenta de FinTrack.',
  textOnly: 'Por ahora solo leo mensajes de texto. Prueba con "almuerzo 15 mil".',
  noAmount: 'No encontré el monto. Prueba con algo como "almuerzo 15 mil".',
  severalAmounts: 'Vi varios números. Escríbelo con un solo monto, como "almuerzos 24 mil".',
  noDescription: '¿En qué fue? Agrega una palabra, como "almuerzo 15 mil".',
  dailyLimit: 'Llegaste al límite de mensajes de hoy. Mañana sigo registrando.',
  failed: 'No pude guardar ese movimiento. Inténtalo de nuevo en un momento.',
  help: 'Por ahora puedo decirte tu saldo y tus gastos del mes. Prueba con "cuánto tengo" o "cuánto he gastado".',
  queryFailed: 'No pude consultar tus movimientos. Inténtalo de nuevo en un momento.',
  noMovements: (month) => `En ${month} aún no tienes movimientos.`,
  noExpenses: (month) => `En ${month} aún no tienes gastos.`,
};

/**
 * ¿Está configurado todo lo que necesita el bot?
 * @returns {boolean}
 */
export function isAvailable() {
  return Boolean(
    env.whatsappAccessToken &&
    env.whatsappPhoneNumberId &&
    env.whatsappAppSecret &&
    env.whatsappVerifyToken,
  );
}

/**
 * Compara dos textos sin que el tiempo de respuesta revele cuánto coinciden.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * ¿La verificación del webhook trae el token configurado?
 * @param {string|undefined} mode
 * @param {string|undefined} token
 * @returns {boolean}
 */
export function isValidVerification(mode, token) {
  return (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    Boolean(env.whatsappVerifyToken) &&
    safeEqual(token, env.whatsappVerifyToken)
  );
}

/**
 * ¿El cuerpo fue firmado por Meta con la clave secreta de la app?
 * @param {Buffer} rawBody Cuerpo tal como llegó.
 * @param {string|undefined} signature Cabecera `X-Hub-Signature-256`.
 * @param {string|undefined} [secret]
 * @returns {boolean}
 */
export function isValidSignature(rawBody, signature, secret = env.whatsappAppSecret) {
  if (!secret || typeof signature !== 'string') return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeEqual(signature, expected);
}

/**
 * @param {string} code
 * @returns {string} Huella del código; es lo único que se guarda.
 */
function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * @returns {string} Código como `FT-AB23CD45`.
 */
function generateCode() {
  const chars = [...randomBytes(CODE_LENGTH)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `FT-${chars.join('')}`;
}

/**
 * @param {string} phone
 * @returns {string} Solo los últimos cuatro dígitos.
 */
export function maskPhone(phone) {
  return `•••• ${phone.slice(-4)}`;
}

/**
 * Mensajes entrantes de un aviso de Meta. Los avisos de estado (entregado, leído) no traen ninguno.
 * @param {object} payload
 * @param {string|undefined} [phoneNumberId] Solo se aceptan los dirigidos a este número.
 * @returns {Array<{ id: string, from: string, text: string|null }>} `text` es `null` si no es texto.
 */
export function extractMessages(payload, phoneNumberId = env.whatsappPhoneNumberId) {
  const messages = [];
  for (const entry of payload?.entry ?? []) {
    for (const { value } of entry?.changes ?? []) {
      if (value?.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of value?.messages ?? []) {
        if (typeof message?.id !== 'string' || typeof message?.from !== 'string') continue;
        messages.push({
          id: message.id,
          from: message.from.replace(/\D/g, ''),
          text: message.type === 'text' ? String(message.text?.body ?? '').trim() : null,
        });
      }
    }
  }
  return messages;
}

/**
 * @param {number} value
 * @returns {string} Monto en pesos, p. ej. "$15.000" o "-$15.000".
 */
function money(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
}

/**
 * @param {string} date AAAA-MM-DD.
 * @returns {string} Nombre del mes, p. ej. "noviembre".
 */
function monthName(date) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Crea el servicio del bot. Las dependencias se inyectan para probarlo sin BD, IA ni Meta.
 * @param {object} [deps]
 * @param {Pick<typeof repo, 'findPhone'|'findUserIdByPhone'|'saveLinkCode'|'confirmLink'|'removeLink'|'claimMessage'|'countRecentMessages'>} [deps.repository]
 * @param {typeof createTransaction} [deps.createTransaction]
 * @param {typeof listCategories} [deps.listCategories]
 * @param {typeof summarizePeriod} [deps.summarize]
 * @param {typeof sendText} [deps.sendText]
 * @param {typeof findUserById} [deps.findUser]
 * @param {() => Date} [deps.now]
 * @param {number} [deps.dailyMax]
 * @returns {{ status: (userId: string) => Promise<object>, createLinkCode: (userId: string) => Promise<object>, unlink: (userId: string) => Promise<void>, handleMessage: (message: { id: string, from: string, text: string|null }) => Promise<void>, handleWebhook: (payload: object) => Promise<void> }}
 */
export function createWhatsappService(deps = {}) {
  const store = deps.repository ?? repo;
  const save = deps.createTransaction ?? createTransaction;
  const categoriesOf = deps.listCategories ?? listCategories;
  const summarize = deps.summarize ?? summarizePeriod;
  const send = deps.sendText ?? sendText;
  const findUser = deps.findUser ?? findUserById;
  const now = deps.now ?? (() => new Date());
  const dailyMax = deps.dailyMax ?? env.whatsappDailyMax;

  /**
   * ¿Este usuario puede conectar el bot? Con el número de prueba, Meta solo deja responderles a
   * cinco destinatarios: la lista evita ofrecerles el bot a los demás.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async function canUse(userId) {
    if (!isAvailable()) return false;
    const user = await findUser(userId);
    return Boolean(user) && env.whatsappAllowedEmails.includes(user.email.toLowerCase());
  }

  /**
   * Estado de la conexión para la pantalla de Cuenta.
   * @param {string} userId
   * @returns {Promise<{ available: boolean, linked: boolean, phone: string|null, botNumber: string|null }>}
   */
  async function status(userId) {
    const phone = await store.findPhone(userId);
    return {
      available: await canUse(userId),
      linked: phone !== null,
      phone: phone && maskPhone(phone),
      botNumber: env.whatsappBotNumber ?? null,
    };
  }

  /**
   * Genera el código de un solo uso que el usuario le envía al bot.
   * @param {string} userId
   * @returns {Promise<{ code: string, expiresAt: Date, botNumber: string|null }>}
   * @throws {AppError} 403 si el usuario no está en la lista.
   */
  async function createLinkCode(userId) {
    if (!(await canUse(userId))) {
      throw new AppError(403, 'FORBIDDEN', 'WhatsApp aún no está disponible para tu cuenta');
    }
    const code = generateCode();
    const expiresAt = new Date(now().getTime() + LINK_CODE_MINUTES * 60 * 1000);
    await store.saveLinkCode({ userId, codeHash: hashCode(code), expiresAt });
    return { code, expiresAt, botNumber: env.whatsappBotNumber ?? null };
  }

  /**
   * Desconecta el número del usuario.
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async function unlink(userId) {
    await store.removeLink(userId);
  }

  /**
   * @param {string} userId
   * @param {string|null} key
   * @returns {Promise<string>} Nombre de la categoría.
   */
  async function categoryName(userId, key) {
    const categories = await categoriesOf(userId);
    return categories.find((c) => c.key === key)?.name ?? 'Sin clasificar';
  }

  /**
   * Responde el balance del mes con las mismas cuentas del dashboard.
   * @param {string} userId
   * @param {string} today AAAA-MM-DD.
   * @returns {Promise<string>}
   */
  async function balanceReply(userId, today) {
    const month = monthName(today);
    const { income, expense } = await summarize(userId, { period: 'month', date: today });
    if (income.total === 0 && expense.total === 0) return REPLIES.noMovements(month);
    const balance = Math.round((income.total - expense.total) * 100) / 100;
    return `En ${month} llevas:\nIngresos: ${money(income.total)}\nGastos: ${money(expense.total)}\nBalance: ${money(balance)}`;
  }

  /**
   * Responde cuánto se ha gastado en el mes y la categoría que más pesa.
   * @param {string} userId
   * @param {string} today AAAA-MM-DD.
   * @returns {Promise<string>}
   */
  async function expensesReply(userId, today) {
    const month = monthName(today);
    const { expense } = await summarize(userId, { period: 'month', date: today });
    if (expense.total === 0) return REPLIES.noExpenses(month);
    const [top] = expense.byCategory;
    const name = await categoryName(userId, top.category);
    return `En ${month} has gastado ${money(expense.total)}.\nLo que más pesa: ${name}, ${money(top.total)}.`;
  }

  /**
   * Responde un mensaje sin monto: una consulta del mes o, si no lo es, qué hace falta aclarar.
   * @param {string} userId
   * @param {string} text
   * @param {string} today AAAA-MM-DD.
   * @returns {Promise<string>} Respuesta para el usuario.
   */
  async function answer(userId, text, today) {
    const asked = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
    const query = BALANCE_QUESTION.test(asked) ? balanceReply : EXPENSE_QUESTION.test(asked) && expensesReply;
    if (!query) return ANY_QUESTION.test(asked) ? REPLIES.help : REPLIES.noAmount;
    return query(userId, today).catch((err) => {
      console.error(`No se pudo consultar el mes por WhatsApp (${err.message})`);
      return REPLIES.queryFailed;
    });
  }

  /**
   * Registra un movimiento a partir del texto, o devuelve qué hace falta aclarar. El analizador
   * trabaja con la fecha local del servidor: se le pasa el mediodía de hoy en Bogotá.
   * @param {string} userId
   * @param {{ id: string, text: string }} message
   * @returns {Promise<string>} Respuesta para el usuario.
   */
  async function register(userId, { id, text }) {
    const today = todayIso(now());
    const parsed = parseSpokenTransaction(text, new Date(`${today}T12:00:00`));
    if (parsed.amount === null) return answer(userId, text, today);
    if (parsed.ambiguous) return REPLIES.severalAmounts;
    if (!parsed.description) return REPLIES.noDescription;

    const saved = await save(userId, {
      amount: parsed.amount,
      description: parsed.description,
      type: parsed.type,
      date: parsed.date,
      category: null,
      // Como máximo 64 caracteres, igual que `transacciones.local_id`.
      localId: `wa-${hashCode(id).slice(0, 61)}`,
    });
    const name = await categoryName(userId, saved.category);
    const when =saved.date === today ? '' : ` del ${saved.date}`;
    const what = saved.type === 'ingreso' ? 'ingreso' : 'gasto';
    return `Guardé un ${what} de ${money(saved.amount)}${when} en ${name}.`;
  }

  /**
   * Procesa un mensaje y responde. Quien no está vinculado solo puede enviar su código.
   * @param {{ id: string, from: string, text: string|null }} message
   * @returns {Promise<void>}
   */
  async function handleMessage(message) {
    const { from, text } = message;
    const candidate = text?.toUpperCase() ?? '';
    if (CODE_RE.test(candidate)) {
      const result = await store.confirmLink({ codeHash: hashCode(candidate), phone: from });
      const replies = { linked: REPLIES.linked, invalid: REPLIES.invalidCode, taken: REPLIES.taken };
      await send(from, replies[result]);
      return;
    }

    const userId = await store.findUserIdByPhone(from);
    if (!userId) {
      await send(from, REPLIES.unlinked);
      return;
    }
    if ((await store.countRecentMessages(userId)) >= dailyMax) {
      await send(from, REPLIES.dailyLimit);
      return;
    }
    if (!(await store.claimMessage({ messageId: message.id, userId }))) return;
    if (text === null) {
      await send(from, REPLIES.textOnly);
      return;
    }
    const reply = await register(userId, { id: message.id, text }).catch((err) => {
      console.error(`No se pudo registrar un mensaje de WhatsApp (${err.message})`);
      return REPLIES.failed;
    });
    await send(from, reply);
  }

  /**
   * Procesa un aviso de Meta. Un mensaje que falle no detiene los demás.
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async function handleWebhook(payload) {
    for (const message of extractMessages(payload)) {
      await handleMessage(message).catch((err) => {
        console.error(`No se pudo procesar un mensaje de WhatsApp (${err.message})`);
      });
    }
  }

  return { status, createLinkCode, unlink, handleMessage, handleWebhook };
}

export const { status, createLinkCode, unlink, handleWebhook } = createWhatsappService();
