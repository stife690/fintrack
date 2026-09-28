import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuración de Vite. El plugin de React habilita JSX y Fast Refresh.
 * (`vite-plugin-pwa` se agregará con la tarea del manifest.)
 * @see https://vitejs.dev/config/
 */
export default defineConfig({ plugins: [react()] });
