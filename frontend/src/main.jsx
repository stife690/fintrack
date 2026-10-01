import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '@fontsource-variable/inter-tight';
import App from './App.jsx';
import './index.css';

/*
 * Tras un despliegue nuevo, los chunks con hash viejo ya no existen en el servidor:
 * recargar una vez para obtener el index.html actual. La marca en sessionStorage evita
 * un bucle. Sin conexión no se recarga (el navegador mostraría su página de error):
 * en ese caso, o si vuelve a fallar, el ErrorBoundary muestra el error.
 */
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return;
  try {
    if (sessionStorage.getItem('chunk-reload')) return;
    sessionStorage.setItem('chunk-reload', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => {
  try {
    sessionStorage.removeItem('chunk-reload');
  } catch {
    // sessionStorage no disponible: nada que limpiar
  }
});

/**
 * En desarrollo, MSW simula los endpoints que el backend aún no expone.
 * Se desactiva con `VITE_API_MOCKS=false`. Nunca entra en el build de producción.
 */
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_MOCKS === 'false') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

/**
 * Punto de entrada del frontend: monta `<App />` en `#root` con el router
 * y desactiva las animaciones si el sistema pide movimiento reducido.
 * La fuente se sirve desde el propio bundle (no Google Fonts) para que
 * el futuro service worker pueda precachearla y funcione sin conexión.
 */
enableMocking().then(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </BrowserRouter>
    </StrictMode>,
  ),
);
