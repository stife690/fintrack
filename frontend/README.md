# FinTrack — Frontend

PWA *offline-first* de FinTrack: registro de gastos, categorización y visualización de insights.

> **Estado:** hello world (FT-0010). Pantalla mínima que consulta `GET /health` del backend para validar el despliegue de punta a punta. Manifest, íconos y service worker llegan con `vite-plugin-pwa` (a cargo del Integrante 1).

## Stack

- **Vite + React**
- **vite-plugin-pwa** *(pendiente)* · **Dexie.js** *(pendiente)*

## Levantar en local

```bash
cd frontend
cp .env.example .env    # VITE_API_URL apunta al backend
npm install
npm run dev             # http://localhost:5173
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL pública del backend, sin barra final. En Vercel se define en *Settings → Environment Variables*. |

## Despliegue (Vercel)

Importar el repo con **Root Directory = `frontend`**. `vercel.json` ya define el build (`npm run build` → `dist`) y la reescritura a `index.html`.
