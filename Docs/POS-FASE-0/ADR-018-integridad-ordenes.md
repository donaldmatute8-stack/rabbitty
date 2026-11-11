# ADR-018 · Integridad de órdenes (concurrencia, versión y punto único de escritura)

**Estado:** aprobado para diseño — **documento crítico**
**Fecha:** 11 de noviembre de 2026
**Decide:** D-03, D-04, D-05, D-13, D-14
**Relacionado:** [`ADR-019`](./ADR-019-saga-pagos.md) · [`RIESGOS`](./RIESGOS.md) · [`README`](./README.md)

---

## 1. Problema

Dos terminales pueden editar la misma cuenta y **perder ítems** sin que nadie lo note.

## 2. Evidencia

| Hecho | Ubicación |
|---|---|
| `orders` no tiene columna de versión | `packages/database-restaurant/src/schema/index.ts` |
| Sin bloqueo en escritura de totales | `pos.ts::addToCart` recalcula con `SELECT items` dentro de tx, sin `FOR UPDATE` |
| `removeFromCart` **no** es transaccional | `pos.ts` — delete + recálculo separados |
| `payOrder` valida por estado, sin lock | `pos.ts` — `isOrderPaidStatus` |
| 46 escrituras en un solo archivo | `packages/api/src/routers/pos.ts` |
| 39 escrituras más en 17 archivos | ver §4 |
| Dinero en `real` (float) | 68 columnas monetarias en esquema restaurant |

## 3. Universo real de escrituras: **85 en 18 archivos**

```
packages/api/src/routers/pos.ts ......... 46
fuera de pos.ts ......................... 39
TOTAL ................................... 85
```

> Si el helper solo cubre `pos.ts`, la concurrencia sigue rota por las rutas de la miniapp.
> El test de arquitectura debe cubrir **los 18 archivos**.

## 4. Los 46 caminos de `pos.ts` (individualizados)

**Destino:**
`M` = `withOrderMutation` (lock + versión obligatoria) ·
`C` = `withOrderCreate` (alta, idempotente, sin versión) ·
`A` = excepción autorizada (aplicación/confirmación de pago)

| # | Línea | Procedimiento | Op | Tabla | Destino |
|---:|---:|---|---|---|---|
| 1 | 895 | `ensureCustomerTab` | update | orders | M |
| 2 | 904 | `ensureCustomerTab` | update | orders | M |
| 3 | 917 | `ensureCustomerTab` | insert | orders | C |
| 4 | 963 | `releaseCustomerTab` | update | orders | M |
| 5 | 985 | `createOrder` | insert | orders | C |
| 6 | 1033 | `addToCart` | insert | orderItems | M |
| 7 | 1045 | `addToCart` | update | orders | M |
| 8 | 1061 | `removeFromCart` | delete | orderItems | M |
| 9 | 1065 | `removeFromCart` | update | orders | M |
| 10 | 1077 | `clearCart` | delete | orderItems | M |
| 11 | 1084 | `clearCart` | update | orders | M |
| 12 | 1134 | `voidItem` | update | orderItems | M |
| 13 | 1145 | `voidItem` | update | orders | M |
| 14 | 1220 | `payOrder` | update | orders | M |
| 15 | 1237 | `payOrder` | update | orders | M |
| 16 | 1261 | `payOrder` | update | orders | M |
| 17 | 1305 | `payOrder` | update | orders | **A** |
| 18 | 1473 | `linkCustomerToOrder` | update | orders | M |
| 19 | 1505 | `linkCustomerToOrder` | update | orders | M |
| 20 | 1593 | `createStripeChargeIntent` | insert | orders | C |
| 21 | 1608 | `createStripeChargeIntent` | insert | orderItems | C |
| 22 | 1631 | `createStripeChargeIntent` | update | orders | M |
| 23 | 1710 | `voidOrder` | update | orders | M |
| 24 | 1844 | `claimTableSession` | update | orders | M |
| 25 | 2037 | `directCheckout` | update | orders | M |
| 26 | 2072 | `directCheckout` | insert | orders | C |
| 27 | 2118 | `directCheckout` | insert | orderItems | C |
| 28 | 2270 | `directCheckout` | update | orders | M |
| 29 | 2360 | `directCheckout` | update | orders | M |
| 30 | 2416 | `directCheckout` | update | orders | M |
| 31 | 2456 | `directCheckout` | update | orders | **A** |
| 32 | 2549 | `directCheckout` | delete | orderItems | M |
| 33 | 2550 | `directCheckout` | delete | orders | M |
| 34 | 2558 | `directCheckout` | update | orders | M |
| 35 | 2668 | `directCheckout` | update | orders | M |
| 36 | 2739 | `createPaymentIntent` | insert | orders | C |
| 37 | 2761 | `createPaymentIntent` | insert | orderItems | C |
| 38 | 2784 | `createPaymentIntent` | update | orders | M |
| 39 | 2880 | `pollPaymentIntent` | update | orders | **A** (reconciliación) |
| 40 | 3149 | `setOrderStage` | update | orders | M |
| 41 | 3162 | `setOrderStage` | update | orders | M |
| 42 | 3170 | `setOrderStage` | update | orderItems | M |
| 43 | 3178 | `setOrderStage` | update | orderItems | M |
| 44 | 3422 | `createUberDelivery` | update | orders | M |
| 45 | 3596 | `assignDelivery` | update | orders | M |
| 46 | 3758 | `sendBillToCustomer` | update | orders | M |

**Distribución:** 35 `M` · 8 `C` · 3 `A`.

## 5. Los 39 caminos externos a `pos.ts`

| Archivo:línea | Op | Tabla | Destino | Nota |
|---|---|---|---|---|
| `packages/api/src/services/paymentCore.ts:541` | update | orders | **A** | aplicación de pago |
| `…/paymentCore.ts:652` | update | orders | **A** | aplicación de pago |
| `…/paymentCore.ts:690` | update | orders | **A** | aplicación de pago |
| `…/paymentCore.ts:941` | update | orders | **A** | reversión contable |
| `…/paymentCore.ts:1415` | update | orders | **A** | reconciliación |
| `packages/api/src/services/paymentIntentDomain.ts:478` | update | orders | **A** | dominio de intención |
| `packages/api/src/routers/payments.ts:420` | update | orders | **A** | cobro |
| `…/payments.ts:855` | update | orders | **A** | reembolso |
| `…/payments.ts:915` | update | orders | **A** | reembolso |
| `telegram-miniapp/src/app/api/pos/checkout/route.ts:286` | insert | orderItems | C | **ruta paralela** |
| `…/pos/checkout/route.ts:293` | update | orders | M | **ruta paralela** |
| `…/pos/checkout/route.ts:341` | insert | orders | C | **ruta paralela** |
| `…/pos/checkout/route.ts:357` | update | orders | M | **ruta paralela** |
| `…/pos/checkout/route.ts:369` | insert | orderItems | C | **ruta paralela** |
| `…/pos/checkout/route.ts:420` | update | orders | M | **ruta paralela** |
| `…/pos/checkout/route.ts:594` | update | orders | **A** | marca `PAID` |
| `telegram-miniapp/src/app/api/bot/webhook/route.ts:459` | update | orders | **A** | **marca `PAID` directo** — revisar |
| `telegram-miniapp/src/app/api/pos/claim-table/route.ts:119` | update | orders | M | |
| `telegram-miniapp/src/app/api/pos/claim-ticket/route.ts:406` | update | orders | M | |
| `telegram-miniapp/src/app/api/pos/request-cash/route.ts:54` | update | orders | M | |
| `telegram-miniapp/src/app/api/track/[orderId]/cancel/route.ts:124` | update | orders | M | |
| `telegram-miniapp/src/app/api/chat/order/route.ts:88` | insert | orders | C | |
| `packages/api/src/services/tabsSweep.ts:37` | update | orders | M | cron |
| `…/tabsSweep.ts:69` | update | orders | M | cron |
| `apps/admin/src/app/api/cron/expire-orders/route.ts:55` | update | orders | M | cron |
| `apps/admin/src/app/api/aggregators/webhook/route.ts:43` | insert | orders | C | ingesta externa |
| `…/aggregators/webhook/route.ts:58` | insert | orderItems | C | ingesta externa |
| `apps/admin/src/app/api/webhooks/uber-direct/route.ts:82` | update | orders | M | estado de entrega |
| `packages/api/src/routers/kds.ts:94` | update | orderItems | M | |
| `packages/api/src/routers/invoices.ts:116` | update | orders | M | |
| `packages/api/src/routers/customer.ts:142` | update | orders | M | |
| `packages/api/src/routers/sandbox.ts:254` | delete | orderItems | **S** | sandbox |
| `…/sandbox.ts:256` | delete | orders | **S** | sandbox |
| `…/sandbox.ts:281` | delete | orderItems | **S** | sandbox |
| `…/sandbox.ts:283` | delete | orders | **S** | sandbox |
| `…/sandbox.ts:319` | insert | orders | **S** | sandbox |
| `…/sandbox.ts:335` | insert | orderItems | **S** | sandbox |
| `…/sandbox.ts:372` | insert | orders | **S** | sandbox |
| `…/sandbox.ts:388` | insert | orderItems | **S** | sandbox |

`S` = mismo helper con `flag: sandbox` (no consume secuencia real, no altera métricas).

### 5.1 Hallazgo que requiere atención inmediata

`bot/webhook:459` y `pos/checkout:594` escriben `status: 'PAID'` **sin pasar por la aplicación de pago**. Deben quedar bajo la excepción `A` con auditoría, o migrarse a la saga de [ADR-019](./ADR-019-saga-pagos.md). Se documenta como riesgo **R-02b**.

## 6. Contrato del helper

```ts
// packages/api/src/services/orderIntegrity.ts  (propuesta)

withOrderMutation(
  tx,
  { orderId, expectedVersion, actor: { staffId, terminalId } },
  (order, ctx) => { /* mutación */ }
)
// 1. SELECT … FOR UPDATE sobre orders
// 2. valida estado permitido
// 3. valida expectedVersion (si viene)
// 4. ejecuta la mutación
// 5. recalcula totales (única función de cálculo)
// 6. UPDATE orders SET version = version + 1
// 7. INSERT order_events
// → { order, version }

withOrderCreate(tx, { branchId, idempotencyKey, actor }, (ctx) => { … })
```

### 6.1 Contrato de conflicto

```
mutación → { orderId, expectedVersion }
  200 → { version: n+1 }
  409 → { code: CONFLICT, currentVersion, snapshot }
```

La terminal **refresca**, no adivina.

### 6.2 Persistencia propuesta

```sql
ALTER TABLE orders
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN "updatedByStaffId" text,
  ADD COLUMN "updatedByTerminalId" text;

CREATE TABLE order_events (
  id text PRIMARY KEY,
  "orderId" text NOT NULL,
  type text NOT NULL,
  "versionBefore" integer NOT NULL,
  "versionAfter" integer NOT NULL,
  "staffId" text,
  "terminalId" text,
  "idempotencyKey" text UNIQUE,
  payload jsonb,
  "createdAt" timestamp DEFAULT now()
);
```

## 7. Test de arquitectura (CI, no disciplina)

```
Regla: ningún archivo fuera de orderIntegrity.ts puede
       insert/update/delete sobre orders u orderItems.

Implementación:
  - test que escanea los 18 archivos identificados en este ADR
  - allowlist explícita para destinos A y S, con motivo y fecha
  - el build falla si aparece una escritura nueva sin clasificar
```

Sin esto, en seis meses vuelve el bug.

## 8. Invariante y redondeo

- PostgreSQL **no permite `CHECK … DEFERRABLE`** (solo PK, UNIQUE, FK, EXCLUDE).
  Mecanismo correcto:

```sql
CREATE CONSTRAINT TRIGGER orders_totals_invariant
  AFTER INSERT OR UPDATE ON orders
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_order_totals();
```

- Tolerancia documentada de **±$0.01** por redondeo.
- **Conciliación nocturna** que reporte deriva entre `orders.total` y la suma de sus componentes.
- **Deuda registrada (D-13):** 68 columnas monetarias en `real`. `paymentIntents` ya usa centavos enteros (`amountCents`) — ese es el patrón a seguir. La migración a `numeric(12,2)` es un bloque propio, **fuera de 0B**.

## 9. Historia de estación (append-only)

```sql
CREATE TABLE order_item_station_events (
  id text PRIMARY KEY,
  "orderItemId" text NOT NULL,
  "stationId" text NOT NULL,
  "printerId" text,
  type text NOT NULL,   -- SENT | FIRED | READY | SERVED | VOIDED | MOVED | REPRINTED
  "staffId" text,
  "terminalId" text,
  "createdAt" timestamp DEFAULT now(),
  payload jsonb
);
```

- `orderItems.stationId` = **destino actual** (operar).
- `order_item_station_events` = **qué ocurrió** (auditar y reconstruir un servicio).
- Mover una comanda de barra a cocina **agrega** `MOVED`; nunca borra el anterior.

## 10. Orden de migración propuesto (0B)

| Paso | Alcance | Por qué en ese orden |
|---|---|---|
| 1 | Helper + `order_events` + test de arquitectura | Base sin cambiar comportamiento |
| 2 | Los 35 `M` de `pos.ts` | Núcleo de la operación |
| 3 | Las 13 rutas de la miniapp + 3 crons | Fuga de concurrencia más grave |
| 4 | Los 14 `A` documentados con auditoría (3 en `pos.ts`, 11 externos) | Requiere ADR-019 |
| 5 | Los 8 `S` de sandbox | Aislado, sin riesgo |

## 11. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-01 | Pérdida de ítems entre terminales | Este ADR |
| R-07 | Rutas miniapp fuera del helper | Incluidas explícitamente (§5) |
| R-02b | `PAID` escrito sin saga | Paso 4 + ADR-019 |
| R-06 | Deriva por `real` | Tolerancia + conciliación + D-13 |

## 12. Criterios de aceptación

- [ ] Las 85 escrituras clasificadas: **63 M/C** · **14 A** · **8 S**.
      (pos.ts: 35 M · 8 C · 3 A · externos: 20 M/C · 11 A · 8 S)
- [ ] Test de arquitectura verde y fallando ante una escritura nueva.
- [ ] Prueba de 2 terminales concurrentes: total exacto, un solo cobro, `CONFLICT` en la segunda.
- [ ] `removeFromCart` dentro de transacción.
- [ ] Conciliación nocturna reportando deriva.

## 13. Rollback

El helper se introduce **sin cambiar comportamiento** (paso 1). Si algo falla: revertir el paso y desactivar el test de arquitectura. No hay migración destructiva en este ADR.

## 14. Evidencia

Extraído con análisis estático sobre:
`packages/api/src/routers/pos.ts`, `payments.ts`, `kds.ts`, `invoices.ts`, `customer.ts`, `sandbox.ts`,
`packages/api/src/services/{paymentCore,paymentIntentDomain,tabsSweep}.ts`,
`apps/admin/src/app/api/**`, `telegram-miniapp/src/app/api/**`.
Comando reproducible: buscar `(insert|update|delete)\((orders|orderItems)\)` en `packages apps telegram-miniapp`.
