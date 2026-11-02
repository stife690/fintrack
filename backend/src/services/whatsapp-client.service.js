import { env } from '../config/env.js';

/** Versión de la Graph API de Meta. */
const GRAPH_URL = 'https://graph.facebook.com/v25.0';
const SEND_TIMEOUT_MS = 8000;

/**
 * Envía un texto por WhatsApp. No registra el número ni el contenido si falla.
 * @param {string} to Número con indicativo, solo dígitos.
 * @param {string} body
 * @param {typeof fetch} [http]
 * @returns {Promise<void>}
 * @throws {Error} Si Meta no acepta el mensaje.
 */
export async function sendText(to, body, http = fetch) {
  const response = await http(`${GRAPH_URL}/${env.whatsappPhoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Meta respondió ${response.status}`);
}
