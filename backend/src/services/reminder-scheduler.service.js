import { listReminderCandidates } from '../repositories/reminders.repository.js';
import { pushService } from './push.service.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Mensaje del recordatorio diario (REQ-030). */
export const REMINDER_PAYLOAD = {
  title: 'FinTrack',
  body: '¿Ya registraste tus gastos de hoy?',
  url: '/app/transacciones',
};

/**
 * Obtiene la fecha (YYYY-MM-DD) y los minutos transcurridos del día en una zona horaria.
 * @param {Date} date
 * @param {string} timezone Zona horaria IANA.
 * @returns {{ localDate: string, minutes: number }}
 */
function localClock(date, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * Indica si el recordatorio de un usuario debe enviarse ahora.
 * Se envía durante `windowMinutes` minutos desde la hora configurada (en la hora local del usuario),
 * para no perder el aviso si el servidor tardó en despertar o saltó un ciclo.
 *
 * @param {{ time: string, timezone: string, now: Date, windowMinutes?: number }} input
 * @returns {{ due: boolean, key: string }} `key` identifica el recordatorio del día (evita duplicados).
 */
export function checkReminderDue({ time, timezone, now, windowMinutes = 5 }) {
  const [hours, minutes] = time.split(':').map(Number);
  const target = hours * 60 + minutes;
  const local = localClock(now, timezone);
  const elapsed = (local.minutes - target + 1440) % 1440;
  // Si ya pasó la medianoche local, el recordatorio pertenece al día anterior.
  const wrapped = local.minutes < target;
  const day = wrapped
    ? localClock(new Date(now.getTime() - DAY_MS), timezone).localDate
    : local.localDate;
  return { due: elapsed < windowMinutes, key: `${day}|${time}` };
}

/**
 * Crea el programador del recordatorio diario. Cada `intervalMs` revisa qué usuarios tienen
 * un recordatorio a la hora actual (pueden tener varios al día) y les envía la notificación,
 * una sola vez por cada hora y día.
 * Los usuarios sin dispositivo suscrito se omiten y se deja constancia en el log (REQ-029).
 *
 * @param {object} [deps]
 * @param {typeof listReminderCandidates} [deps.listCandidates]
 * @param {(userId: string, payload: object) => Promise<unknown>} [deps.sendToUser]
 * @param {() => Date} [deps.now]
 * @param {{ info: (message: string) => void, error: (message: string) => void }} [deps.log]
 * @param {number} [deps.intervalMs] Cada cuánto revisa (por defecto 1 minuto).
 * @param {number} [deps.windowMinutes] Minutos de tolerancia tras la hora configurada.
 * @returns {{ tick: () => Promise<{ sent: number, skipped: number }>, start: () => void, stop: () => void }}
 */
export function createReminderScheduler(deps = {}) {
  const listCandidates = deps.listCandidates ?? listReminderCandidates;
  const sendToUser = deps.sendToUser ?? pushService.sendToUser;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? console;
  const intervalMs = deps.intervalMs ?? MINUTE_MS;
  const windowMinutes = deps.windowMinutes ?? 5;

  /** @type {Map<string, number>} Recordatorios ya atendidos: "usuario|fecha|hora" → momento. */
  const handled = new Map();
  /** @type {ReturnType<typeof setInterval>|undefined} */
  let timer;
  let running = false;

  /**
   * Revisa los recordatorios pendientes ahora mismo.
   * @returns {Promise<{ sent: number, skipped: number }>}
   */
  async function tick() {
    const moment = now();
    let sent = 0;
    let skipped = 0;

    for (const [key, at] of handled) {
      if (moment.getTime() - at > 2 * DAY_MS) handled.delete(key);
    }

    for (const user of await listCandidates()) {
      // Cada hora del usuario es un recordatorio independiente: una falla no frena a las demás.
      for (const time of user.times) {
        try {
          const { due, key } = checkReminderDue({
            time,
            timezone: user.timezone,
            now: moment,
            windowMinutes,
          });
          const id = `${user.id}|${key}`;
          if (!due || handled.has(id)) continue;
          handled.set(id, moment.getTime());

          if (!user.hasSubscription) {
            skipped += 1;
            log.info(
              `Recordatorio omitido: el usuario ${user.id} no tiene notificaciones activadas`,
            );
            continue;
          }
          await sendToUser(user.id, REMINDER_PAYLOAD);
          sent += 1;
        } catch (err) {
          log.error(`Error enviando el recordatorio al usuario ${user.id}: ${err.message}`);
        }
      }
    }
    return { sent, skipped };
  }

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
          await tick();
        } catch (err) {
          log.error(`Error revisando los recordatorios: ${err.message}`);
        } finally {
          running = false;
        }
      }, intervalMs);
      // No impide que el proceso termine (apagado limpio y pruebas).
      timer.unref();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}
