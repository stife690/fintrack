/**
 * Cabeceras de seguridad para todas las respuestas de la API (FT-0042). La API solo entrega JSON y
 * archivos para descargar, así que no necesita cargar nada en el navegador: se le prohíbe todo.
 * No usa `helmet` a propósito: son pocas cabeceras y aquí queda escrita y explicada cada una. La
 * CSP del frontend (Vercel) es otra cosa y se hace aparte.
 */
const HEADERS = {
  // El navegador no "adivina" el tipo: un JSON nunca se interpreta como script o HTML.
  'X-Content-Type-Options': 'nosniff',
  // Si alguien abre una respuesta de la API en el navegador, no se carga ni ejecuta nada, y
  // ninguna página la puede meter en un marco (clickjacking).
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  // Lo mismo que `frame-ancestors`, para navegadores viejos que no lo entienden.
  'X-Frame-Options': 'DENY',
  // Las direcciones de la API no se filtran a otros sitios en la cabecera Referer.
  'Referrer-Policy': 'no-referrer',
  // Durante 180 días el navegador solo habla con la API por HTTPS. En localhost (HTTP) se ignora.
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
};

/**
 * Pone las cabeceras de seguridad. Va primero en `app.js` para cubrir también los errores, los 404
 * y los 429 del límite de intentos.
 * @type {import('express').RequestHandler}
 */
export function securityHeaders(_req, res, next) {
  res.set(HEADERS);
  next();
}
