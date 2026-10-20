import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Configuración de las pruebas del frontend (Vitest). Va aparte de `vite.config.js` para no
 * cargar el plugin de PWA ni Tailwind, que no hacen falta para probar componentes y servicios.
 * Los componentes se prueban renderizándolos a HTML (sin navegador).
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.{js,jsx}'] },
});
