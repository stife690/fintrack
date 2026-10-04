# FinTrack — Frontend

PWA *offline-first* de FinTrack: registro de gastos, categorización y visualización de insights.

> **Estado (Sprint 1):** landing, inicio de sesión y registro, con los endpoints de autenticación simulados por MSW mientras el backend los expone. La base PWA (service worker y precache) ya está configurada; los íconos, colores y la pantalla de carga del manifest llegan con la tarea de manifest de FT-0010.

## Stack

- **Vite 5 + React 18**
- **Tailwind CSS 4** y componentes **shadcn/ui** (Radix)
- **React Router 7** para las rutas
- **React Hook Form + Zod** para formularios y validación
- **MSW** para simular la API en desarrollo
- **vite-plugin-pwa** (Workbox) para el service worker y el manifest
- **Dexie.js** *(pendiente, FT-0008)*

## Levantar en local

Requiere Node.js 22.12 o superior (lo exige MSW).

```bash
cd frontend
cp .env.example .env
npm install
npm run dev             # http://localhost:5173
```

Con los mocks activos no hace falta levantar el backend para probar login y registro. Usuario de prueba: `demo@fintrack.com` / `demo1234`. Los usuarios que registres viven en memoria y se pierden al recargar la página.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente y mocks de MSW. |
| `npm run build` | Build de producción en `dist/`. Genera `sw.js` y `manifest.webmanifest`. |
| `npm run preview` | Sirve `dist/` en `http://localhost:4173` para probar el build y la PWA. |

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL pública del backend, sin barra final. En local: `http://localhost:3000`. En Vercel se define en *Settings → Environment Variables*. |
| `VITE_API_MOCKS` | Solo en desarrollo. `true` (por defecto) simula `/api/v1/auth/*` (registro, login, refresh y logout) y `/api/v1/users/me` con MSW; `false` usa la API real. |

Vite incrusta estas variables en el build: si cambian, hay que volver a compilar o redesplegar.

## Rutas

| Ruta | Pantalla |
|---|---|
| `/` | Landing |
| `/login` | Inicio de sesión |
| `/registro` | Crear cuenta |
| `*` | 404 |

## Estructura

```
frontend/
├── public/            # Archivos estáticos (imágenes, favicon, worker de MSW)
├── src/
│   ├── auth/          # Contexto de sesión y rutas protegidas
│   ├── components/    # UI por dominio (auth, home, layout, charts, ui)
│   ├── hooks/         # Hooks reutilizables (instalación de la PWA, salud de la API)
│   ├── lib/           # URL de la API, utilidades y esquemas de validación
│   ├── mocks/         # Handlers de MSW
│   ├── pages/         # Una página por ruta
│   ├── services/      # Llamadas a la API
│   ├── App.jsx        # Definición de rutas
│   └── main.jsx       # Punto de entrada
└── vite.config.js     # Plugins: React, Tailwind y PWA
```

El alias `@` apunta a `src/`.

## Mocks de la API (MSW)

Mientras el backend no expone los endpoints de autenticación, MSW los intercepta en el navegador y responde según `fintrack-openapi.yaml`. Los handlers están en `src/mocks/handlers.js`.

- Solo arrancan en `npm run dev`; nunca entran en el build de producción.
- Para probar contra el backend real, pon `VITE_API_MOCKS=false` en `.env` y reinicia el servidor de desarrollo.

## PWA

### Cómo quedó configurada

1. Se instaló el plugin: `npm install -D vite-plugin-pwa`.
2. Se agregó `VitePWA` a los plugins en `vite.config.js` con estas opciones:

| Opción | Para qué sirve |
|---|---|
| `registerType: 'autoUpdate'` | Tras un despliegue, el service worker se actualiza solo. |
| `manifest` | Datos de la app instalable. Por ahora solo nombre e idioma. |
| `workbox.globPatterns` | Tipos de archivo que se guardan para uso sin conexión. |
| `workbox.globIgnores` | Excluye `mockServiceWorker.js`, que es solo de desarrollo. |
| `workbox.navigateFallback` | Responde cualquier ruta con `index.html` para que funcione sin conexión. |

### Dos service workers, dos entornos

| Archivo | Entorno | Función |
|---|---|---|
| `mockServiceWorker.js` | `npm run dev` | Simula la API (MSW). |
| `sw.js` | Build de producción | Guarda los archivos de la app para uso sin conexión. |

No se deben mezclar: `devOptions.enabled` del plugin queda desactivado para que en desarrollo solo actúe MSW.

### Cómo verificarla

```bash
npm run build && npm run preview
```

En Chrome, abre `http://localhost:4173` y DevTools → **Application**:

1. **Service Workers:** `sw.js` aparece activo.
2. **Cache Storage:** existe el precache con los archivos de la app y no incluye `mockServiceWorker.js`.
3. **Manifest:** muestra el nombre FinTrack.
4. En **Network**, marca *Offline* y recarga: `/` y `/login` siguen cargando.

Después corre `npm run dev` y confirma que el login con mocks sigue funcionando.

> El service worker solo guarda los archivos de la app, no las respuestas de la API. El registro de transacciones sin conexión se implementa en FT-0008 y FT-0009.

## Despliegue (Vercel)

Importar el repo con **Root Directory = `frontend`**. `vercel.json` ya define el build (`npm run build` → `dist`) y la reescritura a `index.html`. Guía completa en [`docs/despliegue.md`](../docs/despliegue.md).