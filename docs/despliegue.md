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

Variables de entorno en producción:

| Plataforma | Variable | Valor |
|---|---|---|
| Vercel | `VITE_API_URL` | URL del backend en Render, sin barra final |
| Render | `NODE_VERSION` | `20` |
| Render | `CORS_ORIGIN` | URL del frontend en Vercel, sin barra final |
| Render | `JWT_SECRET` | Secreto aleatorio (el blueprint lo genera). Obligatorio: sin él el servidor no arranca |
| Render | `DATABASE_URL` | Cadena del **Session pooler** de Supabase, terminada en `?sslmode=no-verify` |
| Render | `AI_PROVIDER` | `gemini` |
| Render | `AI_API_KEY` | Clave de Google AI Studio (nunca en el repo ni en el chat) |

## Base de datos (Supabase)

- Usar la cadena del **Session pooler** (host `...pooler.supabase.com`, usuario `postgres.<ref>`). La conexión directa es solo IPv6 y Render falla con `ENETUNREACH`.
- Añadir `?sslmode=no-verify` al final: `pg` trata `sslmode=require` como `verify-full` y rechaza el certificado.
- El esquema está en `db/init/01_schema.sql` y las categorías en `db/init/02_seed_categorias.sql`; se ejecutan una vez en el *SQL Editor* de Supabase.
- Activar RLS en las tablas del esquema `public`.
- Los proyectos gratuitos de Supabase se pausan tras ~1 semana sin actividad; hay que reanudarlos desde el dashboard.

Verificado el 28/09/2026 (FT-0010): frontend 200 HTML, `GET /health` ok, CORS desde el origen de Vercel y 404 con formato de error.
