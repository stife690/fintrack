# Contrato de la API

La especificación formal está en [`openapi.yaml`](openapi.yaml) (OpenAPI 3, versión 2.0.1 del contrato). Es la fuente de verdad para frontend y backend: si un endpoint cambia, se actualiza primero este archivo.

Puedes visualizarla pegando el archivo en <https://editor.swagger.io>.

## Convenciones

| Tema | Regla |
|---|---|
| Prefijo | `/api/v1` (excepto `GET /health`) |
| Autenticación | Access token JWT (15 min) + refresh token (30 días) |
| Nombres de campos | Inglés y `camelCase` (`amount`, `createdAt`, `totalIncome`) |
| Valores de dominio | En español: `type` es `ingreso` o `gasto`; las claves de categoría no llevan tildes |
| Recursos ajenos | Se responde `404` (nunca `403`) para no revelar su existencia |

## Formato de errores

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos inválidos", "details": [{ "field": "amount", "problem": "Debe ser un número mayor que 0" }] } }
```

`details` solo aparece en los errores de validación (422) e indica qué campo marcar.

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Cuerpo malformado a nivel de tipos (JSON inválido o no es un objeto) |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | Sin token o inválido / access token vencido (renovar con `/auth/refresh`) |
| 404 | `NOT_FOUND` | Ruta o recurso inexistente, o de otro usuario (nunca `403`) |
| 409 | `EMAIL_TAKEN` / `BUDGET_EXISTS` | Conflicto con una restricción de unicidad de negocio |
| 422 | `VALIDATION_ERROR` | Datos que no cumplen las reglas, con `details` |
| 422 | `INSUFFICIENT_HISTORY` / `NO_DATA` | Petición válida sin datos suficientes para responder |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes (login, registro y endpoints que consumen la IA) |
| 500 | `INTERNAL_ERROR` | Error inesperado |
| 503 | `AI_UNAVAILABLE` | El proveedor de IA no respondió a tiempo |

El backend implementa este formato en `backend/src/middlewares/error.middleware.js` y las fábricas de `backend/src/errors/app-error.js`.
