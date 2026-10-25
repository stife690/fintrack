# Auditoría de Lighthouse

Meta del Sprint 3: score **≥ 90** en Rendimiento, Accesibilidad, Buenas prácticas y SEO.
Lighthouse 12+ eliminó la categoría "PWA"; la instalabilidad y el modo offline se verifican con el
[checklist PWA](#checklist-pwa).

## Cómo medir

### Con el script (todas las páginas, incluidas las de la app con sesión)

```bash
docker compose up -d                       # backend + BD (API en :3000)
cd frontend
npm run build && npx vite preview --port 5173
npm run lighthouse                         # en otra terminal
```

El script ([frontend/scripts/lighthouse.mjs](../frontend/scripts/lighthouse.mjs)) crea un usuario de
prueba con tres movimientos, guarda la sesión y audita `/`, `/login`, `/registro`, `/app`,
`/app/transacciones` y `/app/presupuestos` con el perfil **móvil** (CPU 4x más lenta, 4G simulado).
Imprime una tabla, guarda los reportes HTML en `frontend/lighthouse-reports/` y termina con código 1
si alguna categoría queda por debajo de 90.

```bash
PAGES=/app,/login npm run lighthouse       # solo algunas páginas
APP_URL=https://fintrack-seven-delta.vercel.app API_URL=https://fintrack-api-2z1p.onrender.com npm run lighthouse
```

> **Local vs. producción.** `vite preview` sirve por HTTP/1.1 (máximo 6 conexiones), así que
> Rendimiento sale 5–10 puntos más bajo que en Vercel, que usa HTTP/2 y brotli. Las cifras de abajo
> se midieron con un servidor local HTTP/2 + brotli sobre el mismo `dist/`, para parecerse a Vercel.
> La medición que cuenta es la de producción. Lighthouse varía ±5 puntos entre corridas: se reporta
> la mediana de 3.

### A mano (Chrome DevTools)

1. Abrir la página en una ventana de incógnito (sin extensiones). Para `/app`, iniciar sesión antes.
2. DevTools → pestaña **Lighthouse** → *Mode: Navigation*, *Device: Mobile*, marcar las 4 categorías.
3. **Analyze page load**.

## Resultados (móvil, mediana de 3 corridas)

| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| `/` | 88 → **94** | 92 → **100** | 100 | 83 → **100** |
| `/login` | 98 → **99** | 100 | 100 | 91 → **100** |
| `/registro` | 98 → **99** | 100 | 100 | 91 → **100** |
| `/app` | 89 → **90** | 96 → **100** | 100 | 91 → **100** |
| `/app/transacciones` | 94 → **94** | 96 → **100** | 100 | 91 → **100** |
| `/app/presupuestos` | 84 → **94** | 96 → **100** | 100 | 91 → **100** |

Antes = `main` al 2026-10-24 (commit `01de0b0`). En escritorio la landing da 99.
Criterio acordado: la app (login, registro y `/app/*`) en móvil; la landing en escritorio si en
producción quedara bajo 90 en móvil (es la página más pesada: 9 secciones animadas).

## Qué se cambió y por qué

| Problema que marcó Lighthouse | Cambio |
|---|---|
| `robots.txt is not valid` (no existía: Vercel devolvía el `index.html`) | `public/robots.txt` |
| Texto con contraste < 4.5:1 (`text-ink/45`, `/50`, `/55`, footer, tarjeta de balance) | Se unificaron en `text-ink/60` (4.6–4.8:1), `text-white/55` en el footer, `text-white/90` sobre violeta y `--color-muted-foreground: #666` |
| `aria-label` en un `div` sin rol (estrellas de testimonios) | `role="img"` |
| Enlace con texto genérico ("Empezar") | "Crear cuenta" |
| `registerSW.js` bloqueaba el primer pintado | `injectRegister: 'script-defer'` en `vite.config.js` |
| `coin.webp` (34 KB) precargada en **todas** las páginas | Se quitó el `preload` de `index.html` (solo la usa la landing) |
| El `<h1>` de la landing (LCP) esperaba la animación de entrada | El titular ya no se anima |
| Bundle inicial de 142 KB gzip con la landing y framer-motion para todos | `Home` se carga con `lazy()` como las demás páginas; `MotionConfig` pasó a `Home.jsx`; login/registro animan con CSS (`animate-fade-up`). Bundle inicial: **82 KB** gzip |
| Recharts (~95 KB) dentro del chunk del dashboard | El gráfico va en `IncomeExpenseBars.jsx`, un chunk aparte con `lazy()`: el dashboard se pinta sin esperarlo |
| Decenas de chunks de ~1 KB (un ícono por archivo) | `experimentalMinChunkSize: 20000` en `vite.config.js`: 56 → 41 archivos JS |
| Salto de layout (CLS 0.21) en Presupuestos al llegar las categorías | `CategoryPicker` reserva 11 casillas mientras cargan |

## Checklist PWA

Se verifica en DevTools → **Application** (o con `Page.getInstallabilityErrors` del protocolo de Chrome).

- [x] Se sirve por HTTPS (Vercel).
- [x] Manifest sin errores: `name`, `short_name`, `start_url: /app`, `display: standalone`, `theme_color`, `background_color`.
- [x] Íconos 192×192, 512×512 y 512×512 *maskable*.
- [x] Chrome no reporta errores de instalabilidad (Application → Manifest → *Installability*): aparece "Instalar".
- [x] El service worker (Workbox) controla la página y precachea el build (Application → Cache Storage, ~75 entradas).
- [x] Sin conexión (Network → *Offline*) `/` y `/login` cargan; `/app` muestra la copia local (ver `docs/pruebas-sincronizacion.md`).
- [x] El SW nuevo se activa solo al desplegar (`registerType: 'autoUpdate'`).
