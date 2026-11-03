# Tarjetas de crédito — diseño

Fecha: 2026-11-03 · Autor: Nicolas Mosquera · Estado: listo para aprobar

## Por qué

Muchos usuarios de FinTrack pagan con tarjeta de crédito (ejemplo real: 16.000 en Farmatodo con la
American Express de Bancolombia). Hoy esa compra se puede registrar como gasto, pero la app no dice
**cuánto cupo queda, cuánto se debe ni cuándo hay que pagar**. Nicolas quiere tener sus cuentas en un
solo lugar, con un apartado de tarjetas.

Lo que más le importa: que sea **sencillo e intuitivo, con pocos pasos**, fácil de crear la tarjeta,
fácil de registrar el gasto y fácil de editarlo.

## Objetivos

1. Crear una tarjeta en **una sola pantalla con 5 datos**:
   - tipo de tarjeta (elegido en una galería);
   - últimos 4 dígitos;
   - cupo total;
   - cupo disponible hoy;
   - día de pago.
2. Marcar un gasto como **"Pagado con" una tarjeta** con un solo toque extra en el formulario de
   movimientos, también sin conexión.
3. Ver por tarjeta: **usado / cupo total, disponible, días para el pago** y las compras hechas con ella.
4. **Registrar el pago** de la tarjeta: baja lo que se debe y libera cupo, pero **no cuenta como gasto**.
5. **Actualizar con el banco**: reescribir el cupo disponible cuando FinTrack no cuadra con el banco
   (por intereses, cuota de manejo o una compra no anotada). Solo corrige el número.
6. Una **tarjeta dibujada** según el tipo elegido (franquicia + nivel) con los últimos 4 dígitos y una
   animación sutil.

## No objetivos (en esta entrega)

- **Atajo de iPhone** que lee el SMS del banco y la notificación "Gasto registrado": es la fase 2.
  Por eso se piden ya los últimos 4 dígitos: los usará el atajo para elegir la tarjeta.
- **Transferencias bancarias** detectadas solas: también fase 2, con el mismo atajo.
- "con amex" en la **barra rápida, voz o WhatsApp**: fase 2 (el analizador tiene dos copias,
  frontend y backend, y conviene tocarlo una sola vez junto con el atajo).
- Calcular intereses con la tasa del banco, tablas de amortización o el pago mínimo.
- Cuentas de ahorro / débito como entidades propias.

## Anti-objetivos (fallaría aunque funcione)

- **Pedir o guardar el número completo** de la tarjeta, el CVV o la fecha de vencimiento. Solo los
  últimos 4 dígitos.
- **Copiar el diseño real** de Amex, Bancolombia, Visa o Mastercard (logos, ilustraciones). Los
  diseños son propios, inspirados en el color del nivel; la franquicia se escribe como texto.
- **Contar dos veces**: la compra cuenta como gasto el día que se hace; el pago de la tarjeta no.
- Un flujo largo: si crear una tarjeta toma más de una pantalla, está mal.
- Mostrar un número "exacto" que en realidad es inventado (intereses calculados por FinTrack): de
  momento FinTrack no maneja intereses.

## Reglas de negocio (decididas con Nicolas)

### Lo usado y el disponible

Con el cupo total y el disponible de partida, FinTrack sabe la deuda que ya existía (incluye los
diferidos que la persona traía), sin registrarlos uno por uno:

```
deuda_base   = cupo_total − cupo_disponible_dado      (en el momento base_at)
usado        = deuda_base
             + compras con la tarjeta registradas después de base_at
             − pagos de la tarjeta registrados después de base_at
disponible   = cupo_total − usado
```

- Ejemplo: cupo 3.000.000, disponible 2.400.000 → debe 600.000. Compra 16.000 en Farmatodo →
  "Usado 616.000 de 3.000.000".
- La deuda de partida **no es un gasto**: se hizo antes de usar FinTrack y no aparece en Inicio.
- "Después de base_at" usa la misma regla que Mi plata (`created_at > base_at` y fecha del movimiento
  ≥ día de base_at en la zona del usuario), para no contar dos veces lo que ya estaba en el cupo dado.

### Compras con tarjeta

- Son **gastos normales**: cuentan en Inicio, presupuestos, Consejos y reportes, el día de la compra.
- Llevan la tarjeta y el **número de cuotas** (1 por defecto, 1–48). En esta entrega las cuotas son
  informativas: se muestran en la compra ("a 3 cuotas"); no reparten el monto.
- Una compra a **más de una cuota** muestra un asterisco pequeño con la nota *"Los intereses los
  calcula tu banco a la fecha de corte."* FinTrack no calcula intereses. *(Decidido con Nicolas)*
- Solo los **gastos** pueden llevar tarjeta (un ingreso no).
- Un gasto con tarjeta **no resta de la plata en mano de Mi plata** (la plata sale cuando se paga la
  tarjeta), **pero sí cuenta para el gasto del día, el ritmo y las alertas** de Mi plata ("Puedes
  gastar $X por día"): ya es plata comprometida. Un pago fijo (Netflix) cobrado a la tarjeta cuenta
  como pagado ese mes. *(Decidido con Nicolas)*
- Esto aplica en los dos modos de Mi plata: con saldo dado (`saldo_at`) y sin saldo (todos los
  ingresos − todos los gastos). En el modo sin saldo, los pagos de tarjeta también restan, incluidos
  los que pagan la deuda de partida.

### Pago de la tarjeta: "Ya pagué"

- Botón **"Ya pagué"** en la tarjeta: monto (sugerido: el total del extracto si se dio; si no, lo
  usado) y fecha (hoy por defecto).
- Al guardarlo, el **mes queda marcado como pagado**: no hay más recordatorios ese mes, el calendario
  de Mi plata lo muestra como pagado y el próximo pago pasa al mes siguiente. Sin "Ya pagué", la app
  sigue recordando el pago aunque se haya pagado en el banco. *(Decidido con Nicolas)*
- **No es una transacción ni un gasto**: es un registro propio de la tarjeta.
- Baja lo usado y **sí resta de la plata de Mi plata** (sale de tu cuenta).

### Actualizar con el banco

- Botón "Actualizar con el banco": la persona escribe el **cupo disponible** que muestra el banco hoy
  y, opcional, el **total a pagar** y la **fecha límite** del extracto.
- FinTrack **solo corrige el número**: `deuda_base = cupo_total − disponible_nuevo`, `base_at = ahora`.
  No crea ningún gasto de intereses. *(Decidido con Nicolas: de momento no se manejan intereses.)*
- Total a pagar y fecha límite, si se dan, se muestran en la tarjeta y se sugieren en "Ya pagué".

### Fechas

- Día de pago obligatorio (1–31; 31 = último día del mes, como en Mi plata).
- Día de corte opcional; si no se da, no se muestra "periodo actual" (solo usado y días para pagar).

## Pantallas y flujos

### Navegación

- Sección nueva **"Tarjetas"** en el grupo "Mis finanzas" de la barra lateral y en la hoja "Más" del
  celular. Ruta `/app/tarjetas` y detalle `/app/tarjetas/:id`.
- *(Decisión del diseño)* No se agrega a la barra inferior de 3 ítems.

### Crear tarjeta (una pantalla, en una hoja `Sheet`)

1. **Galería de tipos**: tarjetas pequeñas dibujadas, agrupadas por franquicia.
   - Visa y Mastercard: Clásica, Gold, Platinum, Black.
   - American Express: Green, Blue, Gold, Platinum.
   - Opción "Otra": tarjeta neutra.
   - Al tocar una, la vista previa grande cambia (con transición).
2. Últimos 4 dígitos (teclado numérico, exactamente 4).
3. Cupo total y cupo disponible hoy (con el `MoneyInput` existente). Ayuda: "Los ves en la app de tu
   banco".
4. Día de pago (selector 1–31).
5. "Más detalles" (plegado): nombre propio (por defecto "Amex Blue ••1234"), día de corte.
6. Botón "Agregar tarjeta". Validación: disponible ≤ cupo total; 4 dígitos.

### Lista de tarjetas (`/app/tarjetas`)

- Cada tarjeta dibujada con, debajo, una barra de uso, "Usado $X de $Y · Disponible $Z" y "Pagas en
  N días (15 nov)".
- Estado vacío con la tarjeta de ejemplo y "Agregar mi primera tarjeta".
- Si los montos están ocultos (ojo de Inicio), se ocultan aquí también.

### Detalle de tarjeta (`/app/tarjetas/:id`)

- Tarjeta dibujada grande + uso + próximo pago (y total a pagar del extracto si se dio).
- Acciones: **Ya pagué**, **Actualizar con el banco**, Editar, Eliminar.
- Lista de lo que movió la tarjeta desde la base: compras (con cuotas y su asterisco) y pagos.
- Editar abre la misma hoja de crear, **sin** el campo "cupo disponible hoy": la deuda solo cambia
  con compras, pagos o "Actualizar con el banco". Si cambia el cupo total, la deuda se mantiene y
  cambia el disponible. *(Decisión del diseño)*
- Eliminar pide confirmación y es un borrado suave: las compras y los pagos conservan su
  `tarjeta_id` apuntando a la tarjeta borrada, así Mi plata y los totales no saltan. Borrar
  solo la quita de la lista de tarjetas: ningún número cambia. En los
  movimientos la marca dice "Tarjeta eliminada". *(Decisión del diseño)*
- Cambiar o quitar la tarjeta de un gasto viejo está permitido; mueve lo usado y Mi plata como es de
  esperar (un gasto que pasa a "Efectivo o débito" sí resta de la plata).

### Formulario de movimientos

- Fila nueva **"Pagado con"** (solo en gastos) con chips: "Efectivo o débito" (por defecto) y una
  chip por tarjeta ("Amex ••1234"). Si el usuario no tiene tarjetas, la fila no aparece.
- Al elegir una tarjeta aparece "Cuotas" (1 por defecto).
- Al editar un gasto se puede cambiar o quitar la tarjeta.
- En la lista de movimientos, un gasto con tarjeta muestra una marca pequeña "Amex ••1234".

### Inicio

- *(Decisión del diseño)* Si hay tarjetas, una línea compacta debajo de la tarjeta de balance: "Debes
  $X en tarjetas · próximo pago en N días", que lleva a Tarjetas. Sin tarjetas, no aparece nada.

### La tarjeta dibujada

- Componente propio (`CreditCardArt`): proporción 1.586:1, degradado del nivel, chip dibujado,
  franquicia como texto, "•••• 1234" y el nombre.
- Paletas propias por nivel: Clásica azul, Gold dorado, Platinum plateado, Black negro mate, Amex
  Green verde, Amex Blue azul claro, etc.
- Animación (siguiendo la revisión con la skill de Emil Kowalski): entrada con `opacity` +
  `scale(0.96)` en ~250 ms con ease-out fuerte; al presionar, `scale(0.98)`; brillo diagonal suave
  al aparecer. Sin animación con "reducir movimiento". Solo `transform` y `opacity`.

### Notificaciones

- *(Decisión del diseño)* Recordatorio push **3 días antes del día de pago**, reutilizando el
  sistema de recordatorios existente: "Tu Amex ••1234 se paga el 15 nov. Debes $X." Se puede apagar
  en Cuenta → Notificaciones con un interruptor "Pago de tarjetas".
- La notificación "Gasto registrado" es de la fase 2 (atajo); en la app basta la confirmación
  existente.

## Datos

Parche nuevo `db/patches/014_tarjetas.sql` (el 013 ya existe) (idempotente, copiado en `migrations.js` y en `db/init`):

- `tarjetas`: id, usuario_id, nombre, franquicia (`visa|mastercard|amex|otra`), nivel (texto de una
  lista cerrada), ultimos4 (`char(4)`, solo dígitos), cupo_total, deuda_base, base_at, dia_pago,
  dia_corte (null), total_extracto (null), fecha_limite_extracto (null), created_at, updated_at,
  deleted_at.
  - Únicos: (usuario_id, ultimos4) entre las no borradas, para que el atajo no dude entre dos.
- La FK de `transacciones.tarjeta_id` no se usa para borrar: las tarjetas se borran suave.
- `transacciones`: columnas nuevas `tarjeta_id` (FK nullable, `ON DELETE SET NULL`) y `cuotas`
  (smallint nullable, 1–48). Check: solo `tipo = 'gasto'` puede tener tarjeta.
- `pagos_tarjeta`: id, usuario_id, tarjeta_id, monto, fecha, created_at, deleted_at.

## API (actualizar `docs/api/openapi.yaml` primero)

- `GET/POST /cards`, `GET/PATCH/DELETE /cards/:id`.
- `POST /cards/:id/payments`, `DELETE /cards/:id/payments/:paymentId`.
- `POST /cards/:id/sync-with-bank` { available, statementTotal?, statementDueDate? } → devuelve la
  tarjeta actualizada.
- `GET /cards/:id/movements`: compras y pagos desde la base.
- Transacciones (`POST/PATCH /transactions` y `/sync/batch`) aceptan `card` (id o null) y
  `installments`.
- La tarjeta se responde con `used`, `available`, `nextPaymentDate` y `daysToPayment` ya calculados.

Capas según CONTRIBUTING: routes → controllers → services → repositories; errores con `AppError`;
pruebas con `node --test` por cada regla (base, compras, pagos, ajuste, ingreso
con tarjeta rechazado, tarjeta de otro usuario rechazada).

## Sin conexión

- Registrar un gasto con tarjeta funciona sin conexión: la operación de `/sync/batch` lleva `card`
  e `installments`. La lista de tarjetas se guarda en el dispositivo (como las categorías) para poder
  mostrar las chips.
- Si un gasto hecho sin conexión trae una tarjeta que ya no existe o no es del usuario, `/sync/batch`
  **guarda el gasto sin tarjeta** (no se pierde lo que la persona anotó) y lo reporta como aviso, no
  como rechazo. Después se le puede asignar una tarjeta desde Editar. En `POST/PATCH /transactions` sí se responde 422. *(Decisión del diseño)*
- Crear, editar, pagar, actualizar y eliminar tarjetas requiere conexión en esta entrega *(decisión del
  diseño)*: se muestran deshabilitados con "Necesitas conexión".

## Mi plata

- La plata en mano ya no resta los gastos con tarjeta, y sí resta los pagos de tarjeta posteriores a
  su `saldo_at`.
- El calendario de pagos de Mi plata muestra el próximo pago de cada tarjeta (total del extracto si se
  dio; si no, lo usado) *(decisión del diseño)*.

## Lo que queda al criterio de quien lo construya

- Nombres internos, estructura de componentes y consultas SQL.
- Paletas exactas de cada nivel (deben pasar contraste AA con el texto encima).
- Si "Movimientos de la tarjeta" pagina o no (pocas filas esperadas).
- División en PRs (sugerido: 1) datos + API, 2) pantallas de tarjetas, 3) formulario + Inicio + Mi
  plata + recordatorio).

## Decisiones del diseño para que Nicolas las revise

- Línea compacta de tarjetas en Inicio.
- Recordatorio push 3 días antes del pago, que se puede apagar.
- Editar no permite cambiar el cupo disponible (eso es "Actualizar con el banco").
- Borrar una tarjeta es suave: sus compras siguen ligadas y Mi plata no salta.
- Un gasto sin conexión con una tarjeta que ya no existe se guarda sin tarjeta.
- Tarjetas solo se crean, editan, pagan, actualizan y eliminan con conexión.
