import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuración de Vite. El plugin de React habilita JSX y Fast Refresh;
 * el de Tailwind compila las utilidades de `src/index.css`.
 * El alias `@` apunta a `src/` (convención de shadcn/ui).
 * (`vite-plugin-pwa` se agregará con la tarea del manifest.)
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { name: 'FinTrack', short_name: 'FinTrack', lang: 'es' },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2}'],
        globIgnores: ['**/mockServiceWorker.js'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
