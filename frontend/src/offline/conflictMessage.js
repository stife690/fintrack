/**
 * Texto del aviso cuando un cambio hecho sin conexión chocó con uno de otro dispositivo. FT-0009.
 *
 * El servidor resuelve con last-write-wins (RN-07): gana el cambio más reciente. Lo que le importa
 * al usuario es si **su** cambio se perdió, así que el tono depende de quién ganó.
 */

/**
 * @typedef {object} SyncConflict Conflicto de `/sync/batch` con lo que el dispositivo sabe de la operación.
 * @property {'server_wins'|'client_wins'} resolution Quién ganó.
 * @property {'update'|'delete'} op Qué había hecho el usuario sin conexión.
 * @property {import('@/services/transactionService').Transaction|null} serverVersion Versión que quedó
 *   en el servidor; `null` si ya no existe.
 * @property {string} [name] Descripción del movimiento, para nombrarlo en el mensaje.
 */

/**
 * @typedef {object} ConflictMessage
 * @property {'warning'|'info'} tone `warning` si el cambio del usuario no se aplicó; `info` si ganó.
 * @property {string} text
 */

/** Primera letra en mayúscula, para empezar una oración con el nombre del movimiento. */
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * @param {SyncConflict} conflict
 * @returns {ConflictMessage}
 */
export function conflictMessage({ resolution, op, serverVersion, name }) {
  const subject = name ? `«${name}»` : 'el movimiento';
  const removedOnServer = !serverVersion || Boolean(serverVersion.deletedAt);

  if (resolution === 'client_wins') {
    return op === 'delete'
      ? { tone: 'info', text: `Eliminaste ${subject}, que otro dispositivo había modificado.` }
      : { tone: 'info', text: `Tu edición de ${subject} reemplazó un cambio hecho en otro dispositivo.` };
  }

  if (op === 'delete') {
    // Sin versión en el servidor no hay nada que conservar: el resultado es el que el usuario quería.
    return removedOnServer
      ? { tone: 'info', text: `${capitalize(subject)} ya no existía en el servidor; no había nada que eliminar.` }
      : { tone: 'warning', text: `No se eliminó ${subject}: otro dispositivo lo modificó después.` };
  }

  return removedOnServer
    ? { tone: 'warning', text: `${capitalize(subject)} se eliminó en otro dispositivo; tu edición no se aplicó.` }
    : {
        tone: 'warning',
        text: `Tu edición de ${subject} no se aplicó: otro dispositivo lo cambió después. Quedó la versión más reciente.`,
      };
}
