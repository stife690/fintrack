# FinTrack — Frontend

PWA *offline-first* de FinTrack: registro de gastos, categorización y visualización de insights.

> **Estado (Sprint 1):** landing, inicio de sesión y registro, con los endpoints de autenticación simulados por MSW mientras el backend los expone. La PWA es instalable: service worker con precache, manifest (nombre, colores, íconos normales y *maskable*) y pantallas de carga para iOS en `public/splash/`. En Android la pantalla de carga sale del manifest (fondo negro, nombre e ícono de 512 px).

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
| `/app` | Inicio (requiere sesión): balance y gráficos del periodo, presupuestos y últimos movimientos. Sin ningún movimiento muestra un estado vacío con accesos para registrar el primero |
| `/app/transacciones` | Registrar, listar, filtrar, editar y eliminar transacciones; la categoría la sugiere la IA si no se elige |
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

En desarrollo, MSW intercepta en el navegador los endpoints de autenticación, categorías y transacciones y responde según `docs/api/openapi.yaml`. Los handlers están en `src/mocks/handlers.js`.

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

> El service worker solo guarda los archivos de la app, no las respuestas de la API.

## Registro sin conexión y sincronización (FT-0009)

| Archivo | Función |
|---|---|
| `src/offline/db.js` | Base IndexedDB (Dexie): cola `pending` y datos sueltos en `meta` (`lastSyncedAt`, copia de categorías). |
| `src/offline/sync.js` | `queueCreate` guarda el movimiento; `syncNow` envía la cola a `POST /sync/batch` y borra lo confirmado. |
| `src/hooks/useOfflineSync.js` | En `AppShell`: sincroniza al abrir la app, al volver la conexión y con el aviso de Background Sync. |
| `public/push-sw.js` | Evento `sync` (Background Sync): avisa a las pestañas abiertas para que sincronicen. |

- Si no hay red (o el servidor no responde), el movimiento nuevo queda en el dispositivo y aparece en *Pendientes de sincronizar*.
- Reenviar no duplica: cada movimiento lleva un `localId` que el servidor reconoce, tanto en `/sync/batch` como en `POST /transactions` (si se pierde la respuesta, el mismo `localId` va a la cola).
- Si el envío falla (sin red, servidor caído, 429), se reintenta solo a los 5 s, 15 s y 60 s mientras haya pendientes.
- Si el servidor rechaza un movimiento (422): por categoría, se reenvía sin categoría; por otro motivo, queda en "Pendientes" con el motivo y el botón **Descartar** (nunca se borra solo).
- **Copia local del historial** (`db.transactions`): se llena al abrir la app y al volver la conexión con `serverChanges` de `/sync/batch` (un lote vacío, que no cuenta para el límite de la IA), y con la respuesta de cada crear/editar/eliminar. Sin red, Movimientos muestra esa copia con un aviso. Al cerrar sesión se borra (la cola de pendientes no).
- La sesión vive en `localStorage`, que el service worker no puede leer; por eso el envío lo hace la app abierta. Con la app cerrada, se sincroniza la próxima vez que se abra.
- Sin conexión también se puede **editar y eliminar**: el cambio se ve al instante en la copia local y va a la cola como `update`/`delete`. Si otro dispositivo cambió el mismo movimiento, decide el servidor por la hora del cambio (last-write-wins): la copia queda con la versión final y el evento `fintrack:sync` trae `conflicts` para avisarle al usuario.

Casos de prueba con conexión intermitente y resultados: [`docs/pruebas-sincronizacion.md`](../docs/pruebas-sincronizacion.md).

**Cómo verificarlo:** `npm run build && npm run preview`, inicia sesión, en DevTools → **Network** marca *Offline* y registra un gasto: aparece como pendiente (DevTools → **Application → IndexedDB → fintrack**). Quita *Offline*: se envía solo y aparece en el historial.

## Estado vacío del inicio (FT-0004)

Si el usuario todavía no tiene movimientos (`total === 0` en `GET /transactions`), `src/pages/app/Dashboard.jsx` reemplaza el selector de periodo, el balance y los gráficos por `src/components/dashboard/DashboardEmpty.jsx`: un mensaje de bienvenida, botones para registrar un gasto o un ingreso (abren el formulario con el tipo elegido) y un adelanto de lo que verá. La tarjeta de presupuestos se mantiene, porque se pueden crear antes del primer movimiento.

**Cómo verificarlo:** crea una cuenta nueva y entra a `/app`: aparece "Registra tu primer movimiento". Registra un gasto y vuelve al inicio: ya se ven el balance y los gráficos. La prueba está en `DashboardEmpty.test.jsx` (`npm test`).

## Despliegue (Vercel)

Importar el repo con **Root Directory = `frontend`**. `vercel.json` ya define el build (`npm run build` → `dist`) y la reescritura a `index.html`. Guía completa en [`docs/despliegue.md`](../docs/despliegue.md).
## Notificaciones push (FT-0011)

- Pantalla: `/app/notificaciones` (activar notificaciones del dispositivo y hora del recordatorio diario).
- `public/push-sw.js` contiene los manejadores `push` y `notificationclick`; `vite.config.js` lo importa en el service worker generado (`workbox.importScripts`).
- Con mocks (`VITE_USE_MOCKS`) se puede probar la pantalla, pero el aviso real exige el backend con llaves VAPID configuradas.
- Probar en un dispositivo real: HTTPS (Vercel) y PWA instalada; en iPhone solo funciona con la PWA añadida a la pantalla de inicio.
