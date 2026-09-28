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
