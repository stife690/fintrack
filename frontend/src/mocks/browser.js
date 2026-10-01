import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Service worker de MSW para el navegador (solo se arranca en desarrollo). */
export const worker = setupWorker(...handlers);
