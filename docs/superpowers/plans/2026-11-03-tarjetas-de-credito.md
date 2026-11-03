# Tarjetas de crédito: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apartado de tarjetas de crédito: crear una tarjeta en una pantalla, marcar gastos como
"Pagado con" una tarjeta (también sin conexión), ver usado/disponible/próximo pago, "Ya pagué" y
"Actualizar con el banco", con una tarjeta dibujada y un recordatorio push.

**Architecture:** Tablas nuevas `tarjetas`, `pagos_tarjeta` y `ajustes_tarjeta`, más `tarjeta_id`
y `cuotas` en `transacciones`. La lógica pura (usado, próximo pago, pagada) vive en
`backend/src/services/cards.logic.js`, y las capas siguen el patrón routes → controllers → services
→ repositories. Mi plata solo cambia en sus dos consultas de "plata en mano". El frontend agrega
`cardService`, una caché de tarjetas en Dexie `meta`, `CreditCardArt`, las páginas `/app/tarjetas`
y `/app/tarjetas/:id`, y la fila "Pagado con" en `TransactionForm`.

**Tech Stack:** Node 20 + Express + pg (`node --test`), PostgreSQL 16, React 18 + Vite + Tailwind 4
+ Dexie + zod + react-hook-form (Vitest), framer-motion solo en `Sheet`.

**Spec:** `docs/superpowers/specs/2026-11-03-tarjetas-de-credito-design.md`

## Global Constraints

- Nunca pedir ni guardar el número completo, el CVV ni el vencimiento: solo `ultimos4`, 4 dígitos exactos (`^\d{4}$`).
- Franquicias: `visa | mastercard | amex | otra`. Niveles: visa/mastercard → `clasica | gold | platinum | black`; amex → `green | blue | gold | platinum`; otra → `clasica`.
- Cuotas: entero 1–48, 1 por defecto. Solo un `tipo = 'gasto'` puede tener tarjeta.
- Montos `NUMERIC(12,2)`, redondeados a centavos; `cupo_total > 0` y `0 ≤ disponible ≤ cupo_total`.
- `dia_pago` obligatorio 1–31 y `dia_corte` opcional 1–31. El 31 cae en el último día del mes (reusar `dateInMonth` de `money-plan.service.js`).
- "Después de la base" = `created_at > base_at AND fecha >= (base_at AT TIME ZONE u.timezone)::date`, la misma regla que `changesSinceBalance`.
- Textos exactos (español):
  - Nota de cuotas: "Los intereses los calcula tu banco a la fecha de corte."
  - Gasto de ajuste: "Cargos del banco · {nombre}", categoría `otros`, con la nota "Intereses, cuota de manejo u otros cargos".
  - Línea de ajuste negativo: "Ajuste con el banco −$X".
  - Botones y chips: "Ya pagué", "Actualizar con el banco", "Pagado con", "Efectivo o débito".
  - Avisos: "Necesitas conexión", "Tarjeta eliminada".
  - Push: "Tu {nombre} se paga el {d MMM}. Debes $X."
- No copiar logos ni diseños reales: la franquicia se escribe como texto.
- Animación: solo `transform`/`opacity`. Entrada `opacity` + `scale(0.96)` en 250 ms `cubic-bezier(0.23,1,0.32,1)`; al presionar, `scale(0.98)`. Nada de movimiento con `prefers-reduced-motion`.
- Tarjetas: crear, editar, pagar, actualizar y eliminar solo con conexión. Registrar un gasto con tarjeta funciona sin conexión.
- CONTRIBUTING:
  - actualizar `docs/api/openapi.yaml` antes de cada endpoint nuevo;
  - JSDoc en lo público;
  - errores con `AppError`;
  - Conventional Commits en español, **sin** línea `Co-Authored-By`;
  - Prettier solo sobre los archivos tocados;
  - `npm run lint` (backend) y `npm run build` (frontend) en verde.
- Toda prueba con BD corre contra el Postgres local de Docker (`backend/.env`, puerto 5434).

## Review Focus

1. Un gasto con tarjeta que pasa a `ingreso` (PUT `type`) → el servicio le quita la tarjeta y las cuotas; nunca viola el check. Prueba: Task 5.
2. `disponible > cupo_total`, disponible negativo, o editar el cupo total a un valor menor que lo ya usado → 422 con `field`. Prueba: Task 4.
3. Gasto creado ahora con fecha anterior a `base_at` → no suma a lo usado (ya estaba en el cupo dado). Prueba: Task 2.
4. Tarjeta de otro usuario o borrada en `POST /transactions` → 422 `card`; en `/sync/batch` → se guarda sin tarjeta, con aviso `cardDropped`. Prueba: Task 5.
5. Día de pago 31 en febrero, y "Ya pagué" registrado justo el día de pago → el próximo pago es el último día del mes siguiente y la tarjeta queda pagada. Prueba: Task 2.

---

### Task 1: Esquema (parche 014)

**Files:**
- Create: `db/patches/014_tarjetas.sql`
- Modify: `db/init/01_schema.sql` (mismas tablas, para bases nuevas), `backend/src/config/migrations.js` (entrada `014_tarjetas`), `.github/workflows/ci.yml` (conteo de tablas `23` → `26`)
- Test: `backend/src/migrations.test.js`

**Interfaces:**
- Produces:
  - Tabla `tarjetas(id uuid pk, usuario_id fk, nombre varchar(40), franquicia, nivel, ultimos4 char(4), cupo_total numeric(12,2) >0, deuda_base numeric(12,2) >=0, base_at timestamptz, dia_pago smallint 1–31, dia_corte smallint null, total_extracto numeric null, fecha_limite_extracto date null, recordatorio_enviado_para date null, created_at, updated_at, deleted_at)`.
    - Único parcial `(usuario_id, ultimos4) WHERE deleted_at IS NULL`.
    - Checks de franquicia/nivel según Global Constraints.
  - `transacciones.tarjeta_id uuid null references tarjetas(id)` y `transacciones.cuotas smallint null check (cuotas between 1 and 48)`.
    - Check `tarjeta_id IS NULL OR tipo = 'gasto'`.
    - Índice `(tarjeta_id) WHERE deleted_at IS NULL`.
  - `pagos_tarjeta(id, usuario_id, tarjeta_id, monto numeric(12,2) >0, fecha date, created_at, deleted_at)`.
  - `ajustes_tarjeta(id, usuario_id, tarjeta_id, diferencia numeric(12,2) <> 0, transaccion_id uuid null, created_at)`.
  - `usuarios.recordar_tarjetas boolean not null default true`.

- [ ] **Step 1:** Agregar a `migrations.test.js` una prueba "el parche 014 crea tarjetas y es idempotente". Debe correr `runMigrations` dos veces y comprobar en `information_schema.columns` que existen `transacciones.tarjeta_id`, `transacciones.cuotas` y `usuarios.recordar_tarjetas`, y en `information_schema.tables` las 3 tablas nuevas.
- [ ] **Step 2:** `cd backend && node --env-file=.env --test src/migrations.test.js` → FAIL (no existe `tarjetas`).
- [ ] **Step 3:** Escribir el parche (idempotente: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` y los checks dentro de un bloque `DO $$`, como en el 012) y copiar sus sentencias en `MIGRATIONS` y en `01_schema.sql`.
- [ ] **Step 4:** Repetir el comando del Step 2 → PASS. Además: `docker compose down -v && docker compose up -d db`, luego aplicar `db/init/*.sql` con `psql` y contar las tablas → `26`.
- [ ] **Step 5:** Commit `feat(db): tablas de tarjetas de crédito, pagos y ajustes`.

### Task 2: Lógica pura de la tarjeta

**Files:**
- Create: `backend/src/services/cards.logic.js`
- Test: `backend/src/cards.unit.test.js`

**Interfaces:**
- Consumes: `dateInMonth(month, day)` de `money-plan.service.js`.
- Produces:
  - `NETWORKS`, `TIERS` (mapa franquicia → niveles), `MAX_INSTALLMENTS = 48`.
  - `dueDates(paymentDay: number, today: string) → { previous: string, next: string }`. `next` es el primer día de pago ≥ hoy y `previous` es el del mes anterior a `next`.
  - `cardState({ card: { limit, debtBase, paymentDay }, purchases: number, payments: Array<{ date: string, amount: number }>, today: string }) → { used, available, nextPaymentDate, daysToPayment, paidThisCycle }`:
    - `used = debtBase + purchases − Σpayments`, mínimo 0;
    - `available = limit − used`;
    - `paidThisCycle` es verdadero si algún pago tiene `date > previous`; en ese caso `nextPaymentDate` pasa al día de pago del mes siguiente a `next`.
  - `bankAdjustment({ used: number, limit: number, available: number }) → { difference: number, newDebtBase: number }`, con `difference = (limit − available) − used`.

- [ ] **Step 1: Pruebas** (una por regla):
  - `cardState`: `debtBase 600000`, `limit 3000000`, `purchases 16000` → `used 616000`, `available 2384000`.
  - Un pago de 616000 deja `used 0`. Un pago mayor que lo usado deja `used 0`, nunca negativo.
  - `dueDates(31, '2026-02-10')` → `next '2026-02-28'`.
  - Con `paymentDay 15`, `today '2026-11-10'` y un pago `'2026-11-10'` → `paidThisCycle true` y `nextPaymentDate '2026-12-15'`.
  - Con el pago hecho el mismo `'2026-11-15'` → igual.
  - Sin pagos → `nextPaymentDate '2026-11-15'` y `daysToPayment 5`.
  - `bankAdjustment({ used: 616000, limit: 3000000, available: 2350000 })` → `{ difference: 34000, newDebtBase: 650000 }`. La diferencia negativa también se devuelve con su signo.
- [ ] **Step 2:** `node --test src/cards.unit.test.js` → FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar las funciones con las firmas de Interfaces, redondeando a centavos.
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Commit `feat(tarjetas): cálculo de usado, disponible y próximo pago`.

### Task 3: Repositorio de tarjetas

**Files:**
- Create: `backend/src/repositories/cards.repository.js`

**Interfaces:**
- Produces (todas filtran `usuario_id` y `deleted_at IS NULL`, salvo donde se diga):
  - `CardRecord = { id, userId, name, network, tier, last4, limit, debtBase, baseAt: Date, paymentDay, cutoffDay, statementTotal, statementDueDate, reminderSentFor, createdAt, updatedAt }`.
  - `insertCard(data)`, `listCards(userId)`, `findCard(id, userId, { includeDeleted = false })`.
  - `updateCard(id, userId, changes)` → `CardRecord|null`.
  - `softDeleteCard(id, userId)` → `boolean`.
  - `rebaseCard(id, userId, { debtBase, baseAt, statementTotal?, statementDueDate? })`.
  - `purchasesSince(cardId, userId)` → `number`: suma de gastos con `tarjeta_id` después de la base (regla de Global Constraints).
  - `paymentsSince(cardId, userId)` → `Array<{ id, date, amount }>`, con `created_at > base_at`.
  - `insertPayment`, `softDeletePayment(id, cardId, userId)`, `insertAdjustment`.
  - `listMovements(cardId, userId)` → compras (`kind: 'purchase'`, con `installments`), pagos (`'payment'`) y ajustes negativos (`'adjustment'`) desde la base, de la fecha más nueva a la más vieja.
  - `cardsDueForReminder(dateLocal)`: para el Task 7.

Se prueba a través del servicio en el Task 4 (pruebas con BD); no lleva prueba propia.

- [ ] **Step 1:** Implementar con `pool.query` y el SQL parametrizado del estilo de `transactions.repository.js`.
- [ ] **Step 2:** `npm run lint` → 0 errores.
- [ ] **Step 3:** Commit `feat(tarjetas): repositorio de tarjetas, pagos y ajustes`.

### Task 4: API de tarjetas

**Files:**
- Modify: `docs/api/openapi.yaml` (primero), `backend/src/app.js` (montar `/api/v1/cards`)
- Create: `backend/src/validators/cards.validator.js`, `backend/src/services/cards.service.js`, `backend/src/controllers/cards.controller.js`, `backend/src/routes/cards.routes.js`
- Test: `backend/src/cards.test.js` (BD, mismo arranque que `budgets.test.js`)

**Interfaces:**
- Consumes: Task 2 y Task 3; `transactions.create` (para el gasto de cargos).
- Produces:
  - `GET /cards` y `POST /cards`; `GET`, `PUT` y `DELETE /cards/:id`; `POST /cards/:id/payments` y `DELETE /cards/:id/payments/:paymentId`; `POST /cards/:id/sync-with-bank`; `GET /cards/:id/movements`.
  - Tarjeta en la respuesta: `{ id, name, network, tier, last4, limit, used, available, paymentDay, cutoffDay, statementTotal, statementDueDate, nextPaymentDate, daysToPayment, paidThisCycle }`.
  - `POST /cards` recibe `{ network, tier, last4, limit, available, paymentDay, name?, cutoffDay? }`, y `name` por defecto es "{Franquicia} {Nivel} ••{last4}". `PUT /cards/:id` recibe los mismos campos menos `available`; si cambia `limit`, se mantiene `debtBase`. `sync-with-bank` recibe `{ available, statementTotal?, statementDueDate? }` y devuelve `{ card, chargeTransaction|null }`.
  - Pago `{ amount, date? }` (hoy por defecto).

- [ ] **Step 1: Pruebas con BD:**
  - `POST /cards` responde 201 con `used = limit − available`.
  - 422 en: `last4` `'12a4'`, `available > limit`, `available` negativo, `tier` que no corresponde a la franquicia, y `last4` repetido en otra tarjeta activa (409 `CARD_EXISTS`).
  - `PUT` con `available` → 422.
  - `PUT` con `limit` menor que lo usado → 422 `limit`.
  - Pago de 100000 → `used` baja y `paidThisCycle true`.
  - `sync-with-bank` con disponible menor → crea un gasto con descripción "Cargos del banco · {nombre}", categoría `otros`, la tarjeta y `used` igual al banco.
  - `sync-with-bank` con disponible mayor → no crea gasto y `movements` trae `kind 'adjustment'` con diferencia negativa.
  - `DELETE` → 204; después `GET /cards` ya no la lista, pero el gasto conserva `card`.
  - Tarjeta de otro usuario → 404.
- [ ] **Step 2:** `node --env-file=.env --test src/cards.test.js` → FAIL (404 en `/cards`).
- [ ] **Step 3:** Escribir el openapi; validador con `AppError` 422 y `details[{field, problem}]`; servicio que arma la respuesta con `cardState`; `sync-with-bank` en una transacción SQL que primero crea el gasto y luego hace `rebaseCard` con `baseAt = now()`, para que el gasto de cargos no se cuente dos veces.
- [ ] **Step 4:** Repetir el comando → PASS; `npm run lint` → 0 errores.
- [ ] **Step 5:** Commit `feat(tarjetas): API de tarjetas, pagos y ajuste con el banco`.

### Task 5: Transacciones con tarjeta y cuotas (incluye sync)

**Files:**
- Modify:
  - `backend/src/validators/transactions.validator.js` (`readFields`: `card` uuid|null, `installments` 1–48);
  - `backend/src/repositories/transactions.repository.js` (`COLUMNS` + `insertTransaction` + `updateTransaction`);
  - `backend/src/repositories/sync.repository.js` (`insertFromDevice`);
  - `backend/src/services/transactions.service.js` (`create` y `update`);
  - `backend/src/services/sync.service.js` (`applyCreate` y `applyChange`);
  - `docs/api/openapi.yaml`.
- Test: `backend/src/transactions.test.js`, `backend/src/sync.test.js`

**Interfaces:**
- Consumes: `findCard` (Task 3).
- Produces:
  - `TransactionRecord` suma `card: { id, name, last4, deleted: boolean } | null` e `installments: number|null`. En `COLUMNS` va con `LEFT JOIN tarjetas k ON k.id = t.tarjeta_id`, incluidas las borradas.
  - `POST` y `PUT /transactions` aceptan `card` e `installments`: `installments` sin `card` se ignora y `card` sin `installments` guarda 1.
  - El resultado de `/sync/batch` suma `notices: [{ localId, code: 'cardDropped' }]`.

- [ ] **Step 1: Pruebas:**
  - `POST` de un gasto con `card` y `installments: 3` → la respuesta trae `card.last4` e `installments 3`.
  - `POST` de un ingreso con `card` → 422 `card`.
  - Tarjeta ajena → 422 `card`.
  - `PUT` con `type: 'ingreso'` sobre un gasto con tarjeta → `card null` e `installments null`.
  - `PUT` con `card: null` → la quita.
  - `/sync/batch` con un create de una tarjeta inexistente → la transacción queda guardada con `card null` y `notices[0].code` es `'cardDropped'`.
- [ ] **Step 2:** `node --env-file=.env --test src/transactions.test.js src/sync.test.js` → FAIL.
- [ ] **Step 3:** Implementar. En el servicio, `findCard` valida que la tarjeta sea del usuario y que el tipo sea gasto. En sync, una tarjeta inválida pone `card = null` y agrega el aviso en vez de lanzar el error.
- [ ] **Step 4:** Repetir el comando → PASS; `npm test` completo → 0 fallos.
- [ ] **Step 5:** Commit `feat(tarjetas): gastos con tarjeta y cuotas, también sin conexión`.

### Task 6: Mi plata y calendario de pagos

**Files:**
- Modify: `backend/src/repositories/money-profile.repository.js` (`changesSinceBalance`, `movementTotals`), `backend/src/services/payment-calendar.service.js` (`buildPaymentCalendar` recibe `cards`), y quien lo llama (el servicio que arma `data.vacas`)
- Test: `backend/src/money-profile.test.js`, `backend/src/payment-calendar.unit.test.js`

**Interfaces:**
- Produces:
  - `changesSinceBalance` y `movementTotals` devuelven `expense` = gastos **sin** tarjeta + pagos de tarjeta (en el modo con saldo, los posteriores a `saldo_at`; en `movementTotals`, todos).
  - El calendario recibe `cards: Array<{ id, name, nextPaymentDate, amount, paidThisCycle }>`, con `amount = statementTotal ?? used`, y emite un evento `kind: 'card'` con estado `pagado` si `paidThisCycle`, `atrasado` si la fecha ya pasó y `pendiente` en otro caso.

- [ ] **Step 1: Pruebas:**
  - Con saldo dado, un gasto con tarjeta de 16000 no cambia la plata en mano y un pago de tarjeta de 16000 sí la baja.
  - En el modo sin saldo pasa lo mismo.
  - El calendario muestra la tarjeta como `pendiente` con su monto, y como `pagado` cuando `paidThisCycle`.
- [ ] **Step 2:** `node --env-file=.env --test src/money-profile.test.js src/payment-calendar.unit.test.js` → FAIL.
- [ ] **Step 3:** Cambiar el SQL con `FILTER (WHERE t.tipo='gasto' AND t.tarjeta_id IS NULL)` y sumar una subconsulta de `pagos_tarjeta`; agregar `cards` al calendario. `money-plan.service.js` no se toca: el ritmo y el gasto del día ya cuentan las compras con tarjeta, como se decidió.
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Commit `feat(mi-plata): las compras con tarjeta no restan la plata en mano; el pago sí`.

### Task 7: Recordatorio de pago

**Files:**
- Modify: `backend/src/services/reminder-scheduler.service.js` (nuevo chequeo diario de tarjetas), `backend/src/repositories/reminders.repository.js` y el validador o servicio de `reminder-settings` (campo `cardReminders: boolean` ↔ `usuarios.recordar_tarjetas`), `docs/api/openapi.yaml`
- Test: `backend/src/push.test.js` (o el archivo de pruebas del scheduler)

**Interfaces:**
- Produces:
  - `cardReminderPayload(card, today)` → `{ title: 'Pago de tarjeta', body: 'Tu {nombre} se paga el {d MMM}. Debes $X.', url: '/app/tarjetas/{id}' }`.
  - Se envía una vez por ciclo cuando `daysToPayment === 3`, la tarjeta no está `paidThisCycle` y el usuario tiene `recordar_tarjetas`. Después se guarda `recordatorio_enviado_para = nextPaymentDate`.

- [ ] **Step 1: Pruebas:**
  - Una tarjeta a 3 días del pago envía un solo push, aunque el `tick` corra dos veces.
  - Con `paidThisCycle` no envía nada.
  - Con `cardReminders false` no envía nada.
  - El cuerpo es exacto: "Tu Amex Blue ••1234 se paga el 15 nov. Debes $616.000."
- [ ] **Step 2:** Correr ese archivo de pruebas → FAIL.
- [ ] **Step 3:** Implementar. La hora del envío es la primera hora de `reminder_times` del usuario, o las 9:00 locales si no tiene ninguna.
- [ ] **Step 4:** Repetir el comando → PASS; `npm test` y `npm run lint` en verde.
- [ ] **Step 5:** Commit `feat(tarjetas): recordatorio push 3 días antes del pago`.

### Task 8: Servicio, caché y tarjeta dibujada (frontend)

**Files:**
- Create: `frontend/src/services/cardService.js`, `frontend/src/lib/cardStyles.js`, `frontend/src/components/cards/CreditCardArt.jsx`
- Modify: `frontend/src/offline/sync.js` o un módulo nuevo `frontend/src/offline/cardCache.js` (caché en `db.meta`, clave `cards:<userId>`)
- Test: `frontend/src/lib/cardStyles.test.js`, `frontend/src/components/cards/CreditCardArt.test.jsx`, `frontend/src/services/cardService.test.js`

**Interfaces:**
- Produces:
  - `listCards()`: guarda en caché al responder y, si responde `NETWORK_ERROR`, devuelve la caché.
  - `getCard(id)`, `createCard(data)`, `updateCard(id, data)`, `deleteCard(id)`.
  - `payCard(id, { amount, date })`, `syncCardWithBank(id, data)`, `getCardMovements(id)`.
  - `CARD_STYLES`: `{ [network]: { [tier]: { label, background, foreground } } }`, con `foreground` a ≥ 4.5:1 sobre el color dominante del degradado. Además `cardLabel(network, tier)` → p. ej. "Amex Blue".
  - `<CreditCardArt network tier last4 name size="sm"|"lg" />`: un `role="img"` con `aria-label="{label} terminada en {last4}"`.

- [ ] **Step 1: Pruebas:**
  - `cardLabel('amex','blue')` → `'Amex Blue'`.
  - Cada combinación de `TIERS` tiene un estilo.
  - El render contiene `•••• 1234` y el `aria-label`.
  - Sin conexión, `listCards` devuelve la caché.
- [ ] **Step 2:** `npx vitest run src/lib/cardStyles.test.js src/components/cards src/services/cardService.test.js` → FAIL.
- [ ] **Step 3:** Implementar. Proporción 1.586:1, chip dibujado en SVG, animación según Global Constraints con clases `motion-safe:`.
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Commit `feat(frontend): servicio de tarjetas y tarjeta dibujada`.

### Task 9: Página Tarjetas y hoja para crear o editar

**Files:**
- Create: `frontend/src/pages/app/Cards.jsx`, `frontend/src/components/cards/CardForm.jsx`, `frontend/src/lib/validation/card.js`
- Modify: `frontend/src/App.jsx` (ruta `/app/tarjetas`), `frontend/src/components/layout/AppShell.jsx` ("Tarjetas" en "Mis finanzas", después de "Mi plata", ícono `CreditCard`), `frontend/src/components/layout/MoreSheet.jsx` (en "Mi dinero", con el detalle "Cupo y próximo pago")
- Test: `frontend/src/components/cards/CardForm.test.jsx`, `frontend/src/pages/app/Cards.test.jsx`

**Interfaces:**
- Consumes: Task 8.
- Produces: `<CardForm initial={CardRecord|null} onSubmit(values) onCancel />`, que en edición oculta "Cupo disponible hoy".

- [ ] **Step 1: Pruebas:**
  - El formulario nuevo muestra la galería de tipos, "Últimos 4 dígitos", "Cupo total", "Cupo disponible hoy" y "Día de pago", con "Más detalles" plegado.
  - En edición no muestra "Cupo disponible hoy".
  - El zod rechaza un disponible mayor que el cupo y menos de 4 dígitos.
  - La lista vacía muestra "Agregar mi primera tarjeta".
  - Con una tarjeta, muestra "Usado $616.000 de $3.000.000" y "Pagas en 5 días".
  - Sin conexión, los botones quedan deshabilitados con "Necesitas conexión".
- [ ] **Step 2:** `npx vitest run src/components/cards src/pages/app/Cards.test.jsx` → FAIL.
- [ ] **Step 3:** Implementar con `Sheet`, `MoneyInput`, `ChipGroup` y `useHiddenAmounts` (los montos se ocultan con el ojo).
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Commit `feat(frontend): sección Tarjetas para crear y editar tarjetas`.

### Task 10: Detalle de tarjeta

**Files:**
- Create: `frontend/src/pages/app/CardDetail.jsx`, `frontend/src/components/cards/PayCardForm.jsx`, `frontend/src/components/cards/BankSyncForm.jsx`
- Modify: `frontend/src/App.jsx` (ruta `/app/tarjetas/:id`)
- Test: `frontend/src/pages/app/CardDetail.test.jsx`

**Interfaces:**
- Consumes: Task 8 y Task 9.

- [ ] **Step 1: Pruebas:**
  - El detalle muestra "Ya pagué" y "Actualizar con el banco".
  - "Ya pagué" sugiere el `statementTotal`, o lo usado si no hay.
  - Un movimiento `purchase` con `installments > 1` muestra "*" y la nota exacta de cuotas.
  - Un `adjustment` muestra "Ajuste con el banco −$X".
  - Al eliminar pide confirmación (`ConfirmButton`) y vuelve a `/app/tarjetas`.
- [ ] **Step 2:** `npx vitest run src/pages/app/CardDetail.test.jsx` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Commit `feat(frontend): detalle de tarjeta con Ya pagué y Actualizar con el banco`.

### Task 11: "Pagado con" en movimientos

**Files:**
- Modify:
  - `frontend/src/components/transactions/TransactionForm.jsx`;
  - `frontend/src/lib/validation/transaction.js` (`card: z.string().nullable()`, `installments: z.coerce.number().int().min(1).max(48)`);
  - `frontend/src/components/transactions/TransactionList.jsx` (marca "Amex ••1234" o "Tarjeta eliminada", y el asterisco);
  - `frontend/src/pages/app/Transactions.jsx` (envía `card` e `installments` y muestra el aviso `cardDropped`);
  - `frontend/src/offline/sync.js` (las operaciones llevan los dos campos y leen `notices`).
- Test: `frontend/src/components/transactions/TransactionForm.test.jsx` (crear si no existe), `frontend/src/offline/saveNewTransaction.test.js`

**Interfaces:**
- Consumes: `listCards()` (caché, Task 8).
- Produces: `onSubmit(values)` suma `card: string|null` e `installments: number|null`.

- [ ] **Step 1: Pruebas:**
  - Sin tarjetas no aparece "Pagado con".
  - Con una tarjeta aparecen los chips "Efectivo o débito" (elegido) y "Amex ••1234". Al elegir la tarjeta aparece "Cuotas" con 1.
  - En "Ingreso" la fila desaparece y el envío lleva `card null`.
  - Al editar un gasto sin tarjeta se le puede asignar una.
  - Sin conexión, el gasto en cola conserva `card` e `installments`.
- [ ] **Step 2:** `npx vitest run src/components/transactions src/offline` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Commit `feat(frontend): marcar un gasto como pagado con tarjeta`.

### Task 12: Inicio, notificaciones y cierre

**Files:**
- Create: `frontend/src/components/dashboard/CardsSummary.jsx`
- Modify: `frontend/src/pages/app/Dashboard.jsx` (debajo de la tarjeta de balance), `frontend/src/components/notifications/NotificationSettings.jsx` (interruptor "Pago de tarjetas"), `docs/despliegue.md` (sin variables nuevas: dejarlo anotado)
- Test: `frontend/src/components/dashboard/CardsSummary.test.jsx`

- [ ] **Step 1: Pruebas:**
  - Sin tarjetas, el componente no renderiza nada.
  - Con dos tarjetas (usado 616000 y 100000) muestra "Debes $716.000 en tarjetas · próximo pago en 5 días" y enlaza a `/app/tarjetas`.
  - Con montos ocultos muestra la máscara.
- [ ] **Step 2:** `npx vitest run src/components/dashboard/CardsSummary.test.jsx` → FAIL.
- [ ] **Step 3:** Implementar e integrar.
- [ ] **Step 4: Verificación final:**
  - `cd backend && npm test && npm run lint`;
  - `cd frontend && npx vitest run && npm run build`;
  - recorrido en el navegador con la cuenta demo: crear la Amex Blue (cupo 3.000.000, disponible 2.400.000, día 15), registrar 16.000 en Farmatodo con ella, ver "Usado $616.000", tocar "Ya pagué", "Actualizar con el banco" con 2.350.000 y ver el gasto "Cargos del banco".
- [ ] **Step 5:** Commit `feat(frontend): resumen de tarjetas en Inicio y recordatorio configurable`.
