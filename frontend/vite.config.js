import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuración de Vite. El plugin de React habilita JSX y Fast Refresh;
 * el de Tailwind compila las utilidades de `src/index.css`.
 * El alias `@` apunta a `src/` (convención de shadcn/ui).
 * `vite-plugin-pwa` genera el service worker y el manifest (íconos y colores en `public/icons`).
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'FinTrack',
        short_name: 'FinTrack',
        description:
          'Registra tus gastos, controla tu presupuesto y sincroniza tus finanzas, incluso sin conexión.',
        lang: 'es',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Android arma la pantalla de carga con este fondo, el nombre y el ícono de 512 px.
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Manejadores de notificaciones push (public/push-sw.js), importados por el service worker.
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,webp,png,woff2}'],
        // Las pantallas de carga de iOS las lee el sistema; no hace falta precachearlas.
        globIgnores: ['**/mockServiceWorker.js', 'splash/**'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
