import { useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Cada cuánto se pregunta al servidor si hay versión nueva mientras la app sigue abierta. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Si tras pulsar "Actualizar" la página no se recargó sola, se recarga a los 3 s. */
const FALLBACK_RELOAD_MS = 3000;

/**
 * Pregunta si hay versión nueva: al volver a la app (cambiar de pestaña o sacarla del segundo
 * plano en el celular) y cada `UPDATE_CHECK_MS`. iOS casi nunca lo hace solo con la app
 * instalada, por eso se fuerza. Sin conexión o con la app oculta no se pregunta.
 * @param {ServiceWorkerRegistration} registration
 * @returns {void}
 */
function watchForUpdates(registration) {
  const check = () => {
    if (navigator.onLine && document.visibilityState === 'visible') registration.update().catch(() => {});
  };
  setInterval(check, UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', check);
}

/**
 * Aviso "Hay una versión nueva · Actualizar" (FT-0020). El service worker descarga la versión
 * nueva en segundo plano y la deja esperando; al tocar "Actualizar" la activa y recarga la
 * página. No se recarga sola: así no se pierde un movimiento a medio escribir. Con "Ahora no"
 * se oculta y la versión nueva entra la próxima vez que se abra la app.
 */
export default function UpdatePrompt() {
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) watchForUpdates(registration);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-obsidian py-2.5 pl-4 pr-2 text-sm text-white shadow-elevated ring-1 ring-white/15"
    >
      <RefreshCw className="size-4 shrink-0 text-violet-light" aria-hidden="true" />
      <p className="min-w-0 flex-1">Hay una versión nueva de FinTrack.</p>
      <button
        type="button"
        onClick={() => {
          setUpdating(true);
          updateServiceWorker(true);
          // workbox recarga cuando la versión nueva toma el control de la página. Si ningún service
          // worker la controlaba (se abrió antes de instalarse), ese aviso no llega: se recarga igual.
          setTimeout(() => window.location.reload(), FALLBACK_RELOAD_MS);
        }}
        disabled={updating}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet px-3 py-2 font-medium text-white transition-colors hover:bg-violet-light disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {updating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Actualizar
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Ahora no"
        className="grid size-9 shrink-0 place-items-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
