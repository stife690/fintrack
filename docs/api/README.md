# Contrato de la API

La especificación formal está en [`openapi.yaml`](openapi.yaml) (OpenAPI 3, versión 2.0 del contrato). Es la fuente de verdad para frontend y backend: si un endpoint cambia, se actualiza primero este archivo.

Puedes visualizarla pegando el archivo en <https://editor.swagger.io>.

## Convenciones

| Tema | Regla |
|---|---|
| Prefijo | `/api/v1` (excepto `GET /health`) |
| Autenticación | Access token JWT (15 min) + refresh token (30 días) |
| Nombres de campos | Inglés, `snake_case` |
| Recursos ajenos | Se responde `404` (nunca `403`) para no revelar su existencia |

## Formato de errores

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos inválidos", "details": [] } }
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `BAD_REQUEST`, `INVALID_JSON` | Solicitud o JSON mal formado |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | Sin sesión / access token vencido (renovar con refresh) |
| 404 | `NOT_FOUND` | Ruta o recurso inexistente (o ajeno) |
| 409 | `CONFLICT` | Conflicto de estado (p. ej. correo ya registrado) |
| 422 | `VALIDATION_ERROR` | Datos que no cumplen las reglas |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |
| 503 | `AI_UNAVAILABLE` | Servicio de IA no disponible |
| 500 | `INTERNAL_ERROR` | Error inesperado |

El backend implementa este formato en `backend/src/middlewares/error.middleware.js` y las fábricas de `backend/src/errors/app-error.js`.
