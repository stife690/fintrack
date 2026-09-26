# FinTrack

PWA *offline-first* de control de gastos personales con categorización automática e insights financieros generados por IA.

Proyecto final de **Computación en el Servidor** — Ingeniería de Software, Universidad Surcolombiana (USCO). Se presenta en **INNOVASOFT IX**.

## Arquitectura

Cliente-servidor de 3 capas:

```
Frontend (PWA, React)  →  Backend (API REST, Express)  →  PostgreSQL
                                     ↓
                               LLM externo (IA)
```

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| [`backend/`](backend/) | API REST en Node.js + Express. Ver [backend/README.md](backend/README.md). |
| `frontend/` | PWA en Vite + React *(pendiente)*. |

## Flujo de trabajo

- La rama `main` es la versión estable. Se trabaja en ramas propias y se integra con Pull Request.
- Toda PR la revisa un integrante distinto al autor.
- Los secretos (`.env`) nunca se suben al repositorio.
