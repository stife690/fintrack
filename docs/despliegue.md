# Despliegue (FT-0010)

Frontend en **Vercel**, backend en **Render**. Orden recomendado:

## 1. Backend en Render
1. Render → *New → Blueprint* → elegir este repo (lee `render.yaml`).
2. Esperar el deploy y anotar la URL, p. ej. `https://fintrack-api.onrender.com`.
3. Comprobar: `https://<url>/health` responde `{"status":"ok", ...}`.

## 2. Frontend en Vercel
1. Vercel → *Add New → Project* → elegir este repo.
2. **Root Directory: `frontend`** (Vite se detecta solo).
3. *Environment Variables*: `VITE_API_URL` = URL de Render, sin barra final.
4. Deploy y anotar la URL, p. ej. `https://fintrack.vercel.app`.

## 3. Cerrar el círculo (CORS)
En Render → *Environment*: `CORS_ORIGIN` = URL de Vercel, sin barra final. Render redespliega solo.

## 4. Verificar
Ejecutar el smoke test (ver `scripts/smoke-test.mjs`):

```bash
FRONTEND_URL=https://fintrack.vercel.app API_URL=https://fintrack-api.onrender.com node scripts/smoke-test.mjs
```

> En el plan gratuito de Render el servicio se duerme por inactividad; la primera petición puede tardar ~50 s.
> Si cambia `VITE_API_URL`, hay que redesplegar el frontend (Vite la incrusta en el build).

## URLs de producción

| Servicio | URL |
|---|---|
| Frontend (Vercel) | https://fintrack-seven-delta.vercel.app |
| Backend (Render) | https://fintrack-api-2z1p.onrender.com |
| Health check | https://fintrack-api-2z1p.onrender.com/health |

Variables configuradas:

| Plataforma | Variable | Valor |
|---|---|---|
| Vercel | `VITE_API_URL` | URL del backend en Render |
| Render | `CORS_ORIGIN` | URL del frontend en Vercel |
| Render | `NODE_VERSION` | `20` |

Verificado el 28/09/2026 (FT-0010): frontend 200 HTML, `GET /health` ok, CORS desde el origen de Vercel y 404 con formato de error.
