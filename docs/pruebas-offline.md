# Pruebas offline de punta a punta (Sprint 3)

Recorrido de **todas las funcionalidades** sin conexión y con conexión intermitente. Complementa [pruebas-sincronizacion.md](pruebas-sincronizacion.md), que cubre la cola offline y `POST /sync/batch` (FT-0008, FT-0009).

Ejecutadas el **2026-10-22**. **Resultado: 13 de 13 casos pasan**, y la batería de sincronización sigue en 20 de 20. Se encontraron 2 problemas y los dos se corrigieron.

## Entorno

El mismo de las pruebas de sincronización: backend en `:3000`, frontend compilado servido en `:5173` y Chrome sin interfaz controlado con `puppeteer-core`. Cada caso usa un usuario nuevo y un perfil de navegador limpio.

```bash
cd frontend
npm run build && npx vite preview --port 5173 &
npm run test:offline              # imprime ✓/✗ por caso; sale con 1 si alguno falla
CASES=O1,O9 npm run test:offline  # solo algunos casos
```

Los casos están en [`frontend/scripts/offline-cases.mjs`](../frontend/scripts/offline-cases.mjs).

### Cómo se simula el modo avión

`page.setOfflineMode(true)` corta la red, pero al **cargar o recargar** una página Chrome vuelve a reportar `navigator.onLine = true`; en un celular en modo avión es `false`. El script lo fija en `false` desde antes de que cargue la app (`airplane()`), igual que en el dispositivo. Sin ese ajuste, Presupuestos, Exportar e Insights se verían "en línea" y mostrarían errores genéricos en lugar de su aviso de sin conexión.

## Casos

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| O1 | Abrir la app en modo avión en cada pantalla (Inicio, Movimientos, Presupuestos, Insights, Exportar, Cuenta) | Carga desde el service worker, con el aviso "Sin conexión", sin pantalla de error y sin perder la sesión. Presupuestos no afirma "No tienes presupuestos" si no pudo consultarlos. | ✅ Pasa (tras corregir el bug 1) |
| O2 | Navegar por el menú sin conexión | Todas las pantallas abren: su código está precargado. | ✅ Pasa |
| O3 | Gasto sin categoría registrado sin conexión | Al sincronizar lo clasifica la IA; si no está disponible queda "Sin clasificar" (REQ-011), nunca se pierde. | ✅ Pasa (en local, sin clave de IA: "Sin clasificar") |
| O4 | Gasto sin conexión que pasa el presupuesto (60.000 de 50.000) | Sin red no hay alerta (se calcula en el servidor); al sincronizar el presupuesto queda en 120 % `exceeded_100` y la pantalla lo muestra. | ✅ Pasa |
| O5 | Presupuestos sin conexión | Crear, editar y eliminar quedan desactivados; lo ya cargado sigue visible. | ✅ Pasa |
| O6 | Insights sin conexión | "Sin conexión. Los insights necesitan internet…", con Reintentar. | ✅ Pasa |
| O7 | Exportar sin conexión | Botón desactivado y aviso "Necesitas conexión para exportar"; se reactiva solo al volver la red. | ✅ Pasa |
| O8 | Cuenta sin conexión | "Agregar nombre" desactivado; el tema, que es local, sigue funcionando. | ✅ Pasa |
| O9 | El access token vence mientras no hay red | El usuario sigue en la app y registra; al volver la red se renueva la sesión y se envía el pendiente. | ✅ Pasa |
| O10 | Iniciar sesión sin conexión | La pantalla abre y muestra "No pudimos conectar con el servidor", sin romperse. | ✅ Pasa |
| O11 | Abrir Inicio en modo avión y volver a conectar | Últimos movimientos desde la copia del dispositivo, ningún "No pudimos…" y un aviso neutral en balance y presupuestos; al volver la red el balance carga solo. | ✅ Pasa (tras corregir el bug 2) |
| O12 | Conexión intermitente navegando por toda la app (3 vueltas) | Sin pantallas de error; 3 movimientos, sin duplicados. | ✅ Pasa |
| O13 | Cerrar sesión sin conexión con un pendiente | La sesión se cierra; al volver a entrar con red, el pendiente se envía. | ✅ Pasa |

## Bugs encontrados

| # | Caso | Problema | Estado |
|---|---|---|---|
| 1 | O1 | Presupuestos, abierto sin red, mostraba el error **y además** "No tienes presupuestos en octubre", aunque no pudo saber si había. | Corregido en `Budgets.jsx`: si la carga falla, solo queda el error con Reintentar. |
| 2 | O11 | Inicio, sin red, muestra 4 avisos "No pudimos conectar con el servidor" (balance, últimos movimientos y presupuestos) en lugar de un solo aviso o de la copia local del historial. No se pierde nada, pero se ve roto. | Corregido en `Dashboard.jsx`: los últimos movimientos salen de la copia local (como en Movimientos), el balance y los presupuestos dicen "Sin conexión: se actualiza al volver internet." y todo se recarga al reconectar. Los gráficos se calculan en el servidor y esperan a la conexión. |

## Revisión de Gemini sobre el script

Se le pidió a Gemini (`gemini-3.8-flash`) una revisión del script. De 8 observaciones se aplicaron 4: cerrar la conexión a IndexedDB en cada consulta, esperar a que React vuelva a pintar en O5, no fallar en O7 si el botón no existe y buscar `120 %` en lugar de `120`. Se descartaron las demás porque el script ya las cubría: por ejemplo, la cola solo borra un pendiente después de que el servidor lo confirma, así que no hay carrera con la consulta al servidor.

## Prueba manual en un celular real

Lo automatizado no reemplaza el modo avión de un teléfono. Checklist sobre la app instalada (PWA) en producción:

1. Con internet, abrir la app instalada, entrar y recorrer todas las pantallas una vez.
2. Activar el **modo avión** y cerrar la app desde el gestor de tareas.
3. Abrir la app desde el ícono: debe cargar con el aviso "Sin conexión".
4. Registrar un gasto y un ingreso; editar y eliminar uno ya existente.
5. Visitar Presupuestos, Insights, Exportar y Cuenta: ninguna debe mostrar "Algo salió mal".
6. Desactivar el modo avión **con la app abierta**: los pendientes deben sincronizarse solos en unos segundos.
7. Revisar desde el computador que los cambios llegaron.

## Límites conocidos

- La alerta de presupuesto de un gasto hecho sin conexión aparece al sincronizar, no al guardarlo, porque se calcula en el servidor.
- La clasificación con IA de los gastos offline ocurre en el servidor al sincronizar. En local, sin `AI_API_KEY`, quedan "Sin clasificar". La rama con IA está cubierta por las pruebas unitarias del backend (`sync.unit.test.js`, `categorization.test.js`).
