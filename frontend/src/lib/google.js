/**
 * Carga de Google Identity Services (GIS), la librería de Google que muestra el botón
 * "Continuar con Google" y entrega un `credential` (id_token) firmado. El backend lo verifica
 * en `POST /auth/google`; aquí no se maneja ningún secreto.
 */

/** ID de cliente OAuth de Google (`VITE_GOOGLE_CLIENT_ID`); vacío si no está configurado. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** @type {Promise<any>|null} */
let loading = null;

/**
 * Carga el script de Google una sola vez.
 * @returns {Promise<any>} `window.google` (con `accounts.id`).
 * @throws {Error} Si el script no se pudo cargar (sin conexión o bloqueado por el navegador).
 */
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        loading = null; // permite reintentar
        script.remove();
        reject(new Error("No pudimos cargar Google. Revisa tu conexión."));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
