import { useCallback, useEffect, useState } from 'react';

/**
 * Captura el evento `beforeinstallprompt` para ofrecer instalar la PWA con un botón propio.
 * El navegador solo lo dispara cuando existen manifest y service worker
 * (tarea de `vite-plugin-pwa`); mientras tanto `canInstall` es `false`.
 *
 * @returns {{ canInstall: boolean, isInstalled: boolean, install: () => Promise<void> }}
 */
export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { canInstall: Boolean(deferredPrompt), isInstalled, install };
}
