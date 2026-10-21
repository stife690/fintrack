# Pruebas de sincronización con conexión intermitente (FT-0009)

Casos de prueba del registro sin conexión y la sincronización con `POST /sync/batch`, ejecutados el **2026-10-20** con las correcciones de los bugs encontrados.

**Resultado: 15 de 15 casos pasan.** Los 3 que fallaban en la primera ejecución (C6, C7 y C11) eran bugs registrados en ClickUp y ya están corregidos.

## Entorno

- Backend y base de datos con `docker compose up -d` (API en `http://localhost:3000`).
- Frontend compilado: `npm run build` y `npx vite preview --port 5173` en `frontend/` (el puerto 5173 es el que permite `CORS_ORIGIN`). Hace falta el build, porque el service worker no se registra con `npm run dev`.
- Chrome 155 sin interfaz, controlado con `puppeteer-core`. Cada caso usa un usuario nuevo y un perfil de navegador limpio (IndexedDB y service worker propios).

## Cómo ejecutarlos

Los 15 casos están automatizados en [`frontend/scripts/sync-cases.mjs`](../frontend/scripts/sync-cases.mjs):

```bash
docker compose up -d                       # en la raíz
cd frontend
npm run build && npx vite preview --port 5173 &
npm run test:sync                          # imprime ✓/✗ por caso; sale con 1 si alguno falla
```

Para correr solo algunos casos: `CASES=C6,C11 npm run test:sync`. Si un caso falla por tiempo de espera, el script indica si el servidor respondió 429 (límite de peticiones). Si Chrome no está en la ruta por defecto, indícala con `CHROME_PATH=/ruta/a/chrome npm run test:sync`. Cada ejecución registra 12 usuarios de prueba, y el backend permite 20 registros cada 15 minutos: para repetirla enseguida en local, usa `docker restart fintrack-backend`.

## Cómo se simula cada situación

| Situación | Automatizado | A mano, en Chrome |
|---|---|---|
| Sin conexión | `page.setOfflineMode(true)` | DevTools → **Network** → *Offline* |
| Otro dispositivo | Otro contexto de navegador, con la misma cuenta | Otro navegador o una ventana de incógnito |
| Respuesta perdida | Se intercepta la petición: el servidor la recibe y la aplica, pero al navegador le llega un error de red | DevTools → **Network** → *Offline* justo después de enviar (difícil de hacer a tiempo) |
| Servidor caído | Se bloquean las peticiones a `:3000` y luego se liberan | `docker stop fintrack-backend` y después `docker start fintrack-backend` |

La cola se revisa en DevTools → **Application → IndexedDB → fintrack → pending**.

## Casos

| # | Caso | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C1 | Registrar sin conexión y sincronizar al volver | Sin red, registrar un gasto. Volver a conectar. | El gasto queda en la cola (1) y no en el servidor. Al conectar se envía solo: cola 0, servidor 1. | ✅ Pasa |
| C2 | Recargar y cerrar la pestaña sin conexión | Sin red, registrar. Recargar. Cerrar la pestaña y abrir otra, todavía sin red. Conectar. | El pendiente sigue visible tras recargar y tras reabrir. Al conectar llega una sola vez. | ✅ Pasa |
| C3 | Varios movimientos sin conexión | Sin red, registrar 3 gastos. Conectar. | Se envían en un solo lote. Servidor: 3. | ✅ Pasa (1 petición con 3 operaciones) |
| C4 | Conexión que va y viene | 3 veces seguidas: quitar la red, registrar, devolver la red y volver a quitarla a los 150 ms. | Los 3 llegan, sin duplicados. | ✅ Pasa |
| C5 | Se pierde la respuesta de `/sync/batch` | Sin red, registrar. Conectar: el servidor aplica el lote, pero la respuesta no llega. Reabrir la app. | La cola conserva el pendiente; al reenviarlo con el mismo `localId`, el servidor no lo duplica. Servidor: 1. | ✅ Pasa |
| C6 | Servidor caído al reconectar | Sin red, registrar. Volver la red con el servidor sin responder. Recuperar el servidor y esperar 8 s. | Se reintenta solo cuando el servidor vuelve. | ✅ Pasa: reintenta solo a los 5 s, 15 s y 60 s (antes no reintentaba hasta recargar) |
| C7 | Se pierde la respuesta de `POST /transactions` con conexión | Con red, registrar: el servidor lo guarda, pero la respuesta no llega. | El movimiento queda una sola vez. | ✅ Pasa: el mismo `localId` viaja en el POST y en la cola; el servidor no duplica (antes quedaba duplicado) |
| C8 | Dos dispositivos, uno sin conexión | Celular sin red registra A; computador con red registra B. El celular se conecta. El computador recarga. | Servidor: A y B. El computador ve A al recargar. | ✅ Pasa |
| C9 | Dos pestañas del mismo dispositivo | Dos pestañas abiertas, sin red. Registrar en una. Volver la red en ambas. | Llega una sola vez, aunque las dos pestañas intenten enviar. | ✅ Pasa (lo frena el `localId` en el servidor) |
| C10 | Otra cuenta en el mismo dispositivo | Ana registra sin red. Sin enviar, entra Beto en el mismo navegador, con red. Después vuelve Ana. | Con Beto no se envía el pendiente de Ana (ni a su cuenta ni a la de ella). Al volver Ana, llega a su cuenta. | ✅ Pasa |
| C11 | Operación rechazada (422) | En la cola hay un pendiente válido y uno con una categoría que el servidor ya no acepta. Conectar. | El válido llega y el rechazado no se pierde: se reintenta sin categoría o se le muestra al usuario. | ✅ Pasa: el rechazado por categoría se reenvía sin categoría y llega (antes se borraba de la cola) |
| C12 | Historial visible sin conexión | Con red, registrar 2 gastos. Quitar la red y recargar. Filtrar por "Ingresos". | Se ven los 2 desde la copia guardada en el dispositivo, con un aviso. El filtro funciona sin red. | ✅ Pasa |
| C13 | Cambio hecho en otro dispositivo | El computador registra un gasto. El celular abre la app (con red), luego pierde la conexión y recarga. | El celular ve el gasto del computador sin conexión. | ✅ Pasa |
| C14 | Operación rechazada por otro motivo | En la cola hay un pendiente válido y uno con monto negativo. Conectar. | El válido llega; el inválido no se borra: queda en "Pendientes" con el motivo y el botón Descartar. | ✅ Pasa |
| C15 | `lastSyncedAt` dañado en el dispositivo | Con un pendiente, guardar un `lastSyncedAt` inválido en IndexedDB. Conectar. | La app reinicia la fecha y el lote se envía (la cola no se traba). | ✅ Pasa |

## Bugs encontrados

| Caso | Bug en ClickUp | Estado |
|---|---|---|
| C6 | [FT-0009] Bug: no reintenta si falla el primer envío al reconectar | Corregido |
| C7 | [FT-0009] Bug: movimiento duplicado si se pierde la respuesta del POST | Corregido |
| C11 | [FT-0009] Bug: un 422 borra el movimiento de la cola offline | Corregido |
| C15 | [FT-0009] Bug: la cola queda trabada si el 422 no apunta a una operación | Corregido |

## Límites conocidos (no son fallas de estos casos)

- Solo se registran **movimientos nuevos** sin conexión: editar o eliminar sigue necesitando internet.
- Con la app **cerrada** no se sincroniza: se envía al volver a abrirla. El service worker no puede leer la sesión, que está en `localStorage`.
- Background Sync existe solo en navegadores basados en Chromium. En Safari y Firefox, la sincronización depende del evento `online` mientras la app está abierta.
