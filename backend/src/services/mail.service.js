import { env } from '../config/env.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 8000;

/**
 * Envía un correo con la API de Brevo (HTTPS: Render bloquea SMTP en el plan gratis).
 * Sin `EMAIL_API_KEY` no envía nada: en desarrollo imprime el texto en la consola para poder
 * seguir el enlace a mano; en producción solo avisa del error, porque el texto trae un enlace
 * que da acceso a la cuenta y no debe quedar en los logs.
 * @param {{ to: string, subject: string, html: string, text: string }} mail
 * @returns {Promise<void>}
 * @throws {Error} Si Brevo responde con error o no responde a tiempo.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!env.emailApiKey || !env.emailFrom) {
    if (env.nodeEnv === 'production') {
      console.error('No se envió el correo: faltan EMAIL_API_KEY o EMAIL_FROM');
    } else {
      console.info(`[correo de desarrollo] Para: ${to} | ${subject}\n${text}`);
    }
    return;
  }
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': env.emailApiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'FinTrack', email: env.emailFrom },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Brevo respondió ${res.status}`);
}

/**
 * Envía el correo con el enlace para crear una contraseña nueva.
 * @param {{ to: string, link: string, minutes: number }} data `minutes`: cuánto dura el enlace.
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail({ to, link, minutes }) {
  const text = [
    'Recibimos una solicitud para cambiar la contraseña de tu cuenta de FinTrack.',
    `Crea una nueva desde este enlace (vence en ${minutes} minutos):`,
    link,
    '',
    'Si no la pediste, ignora este correo: tu contraseña sigue igual.',
  ].join('\n');
  await sendEmail({
    to,
    subject: 'Recupera tu contraseña de FinTrack',
    html: resetHtml(link, minutes),
    text,
  });
}

/**
 * Plantilla HTML del correo. Usa tablas y estilos en línea porque Gmail y Outlook ignoran el CSS
 * moderno; los colores son los de la marca (violeta #6142ff).
 * @param {string} link
 * @param {number} minutes
 * @returns {string}
 */
function resetHtml(link, minutes) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f4f9;font-family:Arial,Helvetica,sans-serif;color:#16141f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px 32px">
        <tr><td>
          <p style="margin:0 0 32px;font-size:20px;font-weight:bold">
            <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#6142ff;vertical-align:middle"></span>
            <span style="vertical-align:middle;margin-left:8px">FinTrack</span>
          </p>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">Crea una nueva contraseña</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b4858">
            Recibimos una solicitud para cambiar la contraseña de tu cuenta. Toca el botón para crear una nueva.
          </p>
          <a href="${link}" style="display:inline-block;background:#6142ff;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:12px">
            Crear nueva contraseña
          </a>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#6e6b7b">
            El enlace vence en ${minutes} minutos y sirve una sola vez. Si el botón no funciona, copia esta dirección en tu navegador:<br>
            <a href="${link}" style="color:#5b3df5;word-break:break-all">${link}</a>
          </p>
          <hr style="border:none;border-top:1px solid #ece9f3;margin:28px 0">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6e6b7b">
            Si no pediste este cambio, ignora este correo: tu contraseña sigue igual.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Escapa un texto escrito por un usuario (nombre de la vaca, de quien invita) antes de ponerlo
 * en el HTML del correo.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Envía la invitación a una vaca (FT-0014) con el enlace para unirse.
 * @param {{ to: string, inviter: string, vacaName: string, goal: string, link: string }} data
 *   `goal`: la meta ya formateada (p. ej. "$ 500.000").
 * @returns {Promise<void>}
 */
export async function sendVacaInvitationEmail({ to, inviter, vacaName, goal, link }) {
  const text = [
    `${inviter} te invitó a la vaca "${vacaName}" en FinTrack (meta: ${goal}).`,
    'Únete desde este enlace (si no tienes cuenta, créala con este mismo correo):',
    link,
    '',
    'Si no conoces a quien te invita, ignora este correo.',
  ].join('\n');
  await sendEmail({
    to,
    subject: `${inviter} te invitó a la vaca "${vacaName}"`,
    html: invitationHtml({
      inviter: escapeHtml(inviter),
      vacaName: escapeHtml(vacaName),
      goal: escapeHtml(goal),
      link,
    }),
    text,
  });
}

/**
 * Plantilla HTML de la invitación, con el mismo estilo que la de recuperar la contraseña.
 * Los textos ya vienen escapados.
 * @param {{ inviter: string, vacaName: string, goal: string, link: string }} data
 * @returns {string}
 */
function invitationHtml({ inviter, vacaName, goal, link }) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f4f9;font-family:Arial,Helvetica,sans-serif;color:#16141f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px 32px">
        <tr><td>
          <p style="margin:0 0 32px;font-size:20px;font-weight:bold">
            <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#6142ff;vertical-align:middle"></span>
            <span style="vertical-align:middle;margin-left:8px">FinTrack</span>
          </p>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">Te invitaron a una vaca</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b4858">
            <strong>${inviter}</strong> te invitó a <strong>${vacaName}</strong>, una meta de ahorro en grupo de ${goal}.
            Únete para ver cuánto lleva cada uno y registrar tus aportes.
          </p>
          <a href="${link}" style="display:inline-block;background:#6142ff;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:12px">
            Unirme a la vaca
          </a>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#6e6b7b">
            Si no tienes cuenta, créala con este mismo correo. Si el botón no funciona, copia esta dirección en tu navegador:<br>
            <a href="${link}" style="color:#5b3df5;word-break:break-all">${link}</a>
          </p>
          <hr style="border:none;border-top:1px solid #ece9f3;margin:28px 0">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6e6b7b">
            Si no conoces a quien te invita, ignora este correo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
