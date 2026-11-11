# 0B-1 · Integridad de órdenes — ejecución

**Estado:** implementado en rama, **sin cablear y sin migrar**
**Rama:** `feat/pos-0b1-integridad-ordenes`
**Base:** `feat/pos-phase0`
**ADR:** [`ADR-018`](./ADR-018-integridad-ordenes.md)
**Riesgos que ataca:** R-01

---

## 1. Qué se construyó

| Artefacto | Ruta | Estado |
|---|---|---|
| Migración (no aplicada) | `packages/database-restaurant/migrations/manual/0038_pos_order_integrity.sql` | Escrita, **bloqueada** |
| Esquema | `packages/database-restaurant/src/schema/index.ts` → `orders.version`, `updatedBy*`, `orderEvents` | Compila |
| Helper | `packages/api/src/services/orderIntegrity.ts` | Escrito |
| Cableado | `addToCart`, `removeFromCart`, `clearCart`, `voidItem` | **Hecho, sin probar en base** |
| Test de arquitectura | `packages/api/src/test/architecture/orderWriteBoundary.test.ts` | **Verde** (77 → 73 pendientes) |
| Baseline (trinquete) | `packages/api/src/test/architecture/order-write-baseline.json` | Congelado |

---

## 2. Alcance real de esta entrega

- **Sí** se cablearon 4 procedimientos: `addToCart`, `removeFromCart`, `clearCart`, `voidItem`.
- `removeFromCart` ahora es transaccional (antes borraba y recalculaba fuera de transacción).
- La migración **no se aplicó** porque **no existe una base aislada**.
- Consecuencia: el código de esta rama **no puede ejecutarse** hasta aplicar `0038`.

### 2.0 Base aislada y migración aplicada (11-nov-2026)

Se creó un **branch de Neon** para staging (`ep-ancient-meadow-ap18nmme`) y ahí se aplicó `0038`:

```
version              | integer | default 1
updatedByStaffId     | text
updatedByTerminalId  | text
order_events         | tabla creada
151 órdenes         | version = 1
```

**Producción sigue con `orders.version = 0`** (sin migrar).

### 2.0.1 Prueba de concurrencia ejecutada (staging)

10 mutaciones concurrentes sobre la misma orden:

```
mutaciones ok:        10/10
ítems en base:        10 (esperado 10)
suma ítems:           550.00
orders.total:         550.00
version final:        11 (esperado 11)
order_events:         10
```

Resultado: **sin pérdida de ítems, sin descuadre de total, una versión por mutación.**

Bug encontrado y corregido en el camino: `ON CONFLICT ("idempotencyKey")` fallaba
porque el índice único es **parcial**; Postgres exige el predicado. Se cambió a
`ON CONFLICT DO NOTHING` sin target.

### 2.1 Bloqueo histórico (ya resuelto)

El ambiente `staging` de Railway fue clonado copiando las variables de entorno:
`RESTAURANT_DATABASE_URL` y `CORE_DATABASE_URL` apuntan a **la misma base Neon de producción**
(`ep-delicate-violet-ap6izh0k-pooler.c-7.us-east-1.aws.neon.tech / neondb`).

Por eso **no se aplicó 0038**: habría modificado producción.

Verificación de que producción sigue intacta:

```sql
SELECT count(*) FROM information_schema.columns
WHERE table_name='orders' AND column_name='version';
-- 0
```

---

## 3. ⚠️ Condición operativa obligatoria

Al agregar columnas al esquema Drizzle, cualquier `.select().from(orders)` las incluye.
**Sin la migración aplicada, Postgres falla.**

Por eso:

| Entorno | Acción antes de ejecutar código de esta rama |
|---|---|
| Local | Aplicar `0038_pos_order_integrity.sql` |
| Staging | Aplicar `0038_pos_order_integrity.sql` |
| Producción | **No desplegar esta rama** hasta que la migración esté aplicada y verificada |

**Orden de despliegue (cuando se autorice):** migración → verificación → código.
Nunca al revés.

---

## 4. El trinquete de escrituras

El test compara el código real contra `order-write-baseline.json`:

| Categoría | Significado | Hoy |
|---|---|---|
| `ALLOWED` | el helper (`orderIntegrity.ts`) — destino final | 2 |
| `PENDING_MIGRATION` | debe migrar al helper | **77** |
| `SANDBOX` | `sandbox.ts`, migra con flag | 8 |
| `SEED` | script de seed, no producción | 2 |
| **Total escaneado** | | **89** |

Reglas:

- Escritura en archivo **nuevo** → test rojo.
- Escritura **adicional** en archivo existente → test rojo.
- Migrar una escritura al helper → bajar su contador en el baseline → test verde.

**Probado:** se agregó un archivo con una escritura ficticia y el test falló con el mensaje esperado; al eliminarlo, volvió a verde.

> Nota de auditoría: el ADR-018 documenta **85** escrituras de producción. El escaneo de 0B-1 da **89** porque suma las 2 del propio helper y las 2 del seed. Las 85 de producción siguen siendo 85.

---

## 5. Qué falta para cerrar 0B-1

| Paso | Qué | Requiere |
|---|---|---|
| 1 | Aplicar `0038` en local/staging | Base disponible |
| 2 | Cablear `addToCart` / `removeFromCart` / `clearCart` / `voidItem` al helper | Migración aplicada |
| 3 | Propagar `expectedVersion` desde el POS y manejar `CONFLICT` en la UI | Cambio de cliente |
| 4 | Prueba de 2 terminales concurrentes | Staging |
| 5 | Bajar contadores del baseline conforme se migra | Por cada paso |

**0B-1 no se cierra** hasta que `PENDING_MIGRATION` baje de 77 a 42 (los 35 `M` de `pos.ts`) y la prueba de concurrencia esté en verde.

---

## 6. Cómo verificar sin tocar producción

```bash
# 1. El test de arquitectura (no necesita base de datos)
cd packages/api && npx vitest run src/test/architecture/orderWriteBoundary.test.ts

# 2. Tipos
cd packages/api && npx tsc --noEmit
cd packages/database-restaurant && npx tsc --noEmit

# 3. Migración (solo local/staging)
psql "$RESTAURANT_DATABASE_URL" -v ON_ERROR_STOP=1 -f \
  packages/database-restaurant/migrations/manual/0038_pos_order_integrity.sql
```

---

## 6.1 Cómo desbloquear (una sola vez)

1. Neon → proyecto → **Branches → New branch** desde `main`, nombre `staging`.
2. Copiar la cadena de conexión (pooled).
3. Railway → ambiente **staging** → servicio `rabbitty-admin` (y los que usen base):
   `RESTAURANT_DATABASE_URL` y `CORE_DATABASE_URL` = cadena del branch.
4. Redesplegar staging.
5. Aplicar `0038` en esa base.
6. Recién entonces: probar el flujo y la concurrencia.

> Mientras staging apunte a producción, **cualquier** clic en el admin de staging escribe en producción.

## 7. Rollback

- Código: revertir el commit de la rama. Sin efecto en producción.
- Migración: es aditiva (columnas con default, tabla nueva). Para revertir:

```sql
DROP TABLE IF EXISTS order_events;
ALTER TABLE orders
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS "updatedByStaffId",
  DROP COLUMN IF EXISTS "updatedByTerminalId";
```

---

## 8. Evidencia de esta entrega

```
vitest  orderWriteBoundary.test.ts → 3 passed
tsc     packages/api              → 0 errores
tsc     packages/database-restaurant → 0 errores
main                               → intacto (30952b0)
```


---

## 9. Restricciones de infraestructura (Neon)

**Medido el 11-nov-2026:** la base de staging pesa **21 MB** y no tiene conexiones
externas activas. El consumo de Neon (97 %) **no es almacenamiento**; es **horas de
compute**.

### Por qué el compute no duerme

| Fuente | Intervalo | ¿Despierta Neon? |
|---|---|---|
| KDS abierto (`apps/kds`) | 10 s | **Sí** |
| POS abierto (`apps/admin/(pos)`) | 5–15 s | **Sí** |
| Bot de Telegram | 2 s (poll a Telegram) | **No** (no consulta la DB) |
| Healthcheck del bot | estático (`/health`) | **No** |

Un KDS o un POS dejados abiertos mantienen el compute despierto 24/7.
730 h/mes × 0.25 CU ≈ **182 CU-h**, que es prácticamente el cupo gratuito.

### Reglas para no salirnos

1. **Staging**: el branch de Neon solo se usa en ventanas de prueba. No dejar los
   servicios de Railway apuntando a él de forma permanente.
2. **Nada de deploys de staging 24/7**: duplicaría las horas de compute.
3. **Autosuspend 5 min** y **mínimo de CU** configurados en el branch.
4. **Crons externos**: verificar que ningún scheduler llame `/api/cron/*` cada minuto.
5. **Ahorro estimado** de pausar el polling con la pestaña oculta: ~10 h/día × 30 =
   300 h → **~75 CU-h menos al mes** (≈ 39 % del cupo).

> Acción pendiente (no autorizada aún): rama `fix/neon-idle` desde `main` para
> pausar el polling cuando la pestaña no es visible y aplicar backoff al KDS.


---

## 10. Lote 2 — procedimientos cableados (11-nov-2026)

Además de los 4 iniciales, quedaron bajo el helper:

| Procedimiento | Qué se protegió |
|---|---|
| `ensureCustomerTab` | limpieza de borradores $0 (una por orden), refresco de identidad y alta |
| `releaseCustomerTab` | liberar borrador |
| `linkCustomerToOrder` | vínculo de cliente + emisión de Bunz |
| `voidOrder` | anulación de orden |
| `claimTableSession` | vínculo de cliente a la mesa |
| `createOrder` | alta de orden (`withOrderCreate`) |
| `setOrderStage` | ETA, cierre y movimiento bulk de ítems |

**Procedimientos de `pos.ts` aún pendientes: 8**

```
payOrder · createStripeChargeIntent · directCheckout · createPaymentIntent
pollPaymentIntent · createUberDelivery · assignDelivery · sendBillToCustomer
```

Son los caminos de dinero: se cablean con la saga de [ADR-019](./ADR-019-saga-pagos.md)
y requieren prueba en staging antes de darlos por cerrados.

## 11. El trinquete, corregido

La primera versión contaba *sitios de escritura*: al cablear, las escrituras se mueven
dentro del callback del helper y el número no bajaba. Se cambió a medir **protección**:

| Nivel | Regla |
|---|---|
| `pos.ts` | **por procedimiento**: si escribe órdenes, debe contener `withOrderMutation(`/`withOrderCreate(` |
| resto de archivos | **por archivo**: debe importar el helper o estar en una excepción documentada |

Estado medido:

```
archivos sin helper:        12  (14 escrituras)
procedimientos sin helper:   8  (en pos.ts)
escrituras totales:         85
```

Ambas listas viven en `order-write-baseline.json` y **solo pueden encoger**.


---

## 12. Lote 4 — caminos externos (11-nov-2026)

**Archivos sin helper: 0.** Todos los caminos que no son de dinero ya están protegidos.

| Archivo | Tratamiento |
|---|---|
| `routers/kds.ts` | bump de ítem bajo el helper |
| `routers/customer.ts` | registro de CFDI |
| `routers/invoices.ts` | cancelación de CFDI |
| `services/tabsSweep.ts` | **excepción**: mantenimiento en bloque con `version = version + 1` |
| `cron/expire-orders` | **excepción**: idem |
| `webhooks/uber-direct` | ETA de entrega bajo el helper |
| `aggregators/webhook` | alta con `withOrderCreate` |
| `miniapp pos/claim-table` | vínculo de mesa |
| `miniapp pos/claim-ticket` | canje de ticket |
| `miniapp pos/request-cash` | pedir cuenta |
| `miniapp track/cancel` | cancelación del cliente |
| `miniapp chat/order` | alta con `withOrderCreate` |

### Estado del trinquete

```
archivos sin helper:        0   ✅
procedimientos en pos.ts:   5   (solo dinero)
escrituras totales:        85
```

Quedan **solo** los 5 caminos de dinero, bloqueados a propósito hasta ejecutar
[`PLAN-PRUEBAS-COBRO.md`](./PLAN-PRUEBAS-COBRO.md) en staging.


---

## 13. Deprecación de `payOrder` (11-nov-2026)

`payOrder` queda marcado `@deprecated` dentro del propio procedimiento:

- El POS activo usa `directCheckout` (fiat) y `createPaymentIntent` (Bunz).
- Ya está bloqueado para Bunz salvo `RABBITTY_LEGACY_BUNZ=true`.
- El test de arquitectura **excluye** los procedimientos marcados `@deprecated`:
  no se protege código que se va a retirar.

### Trinquete actualizado

```
procedimientos sin helper en pos.ts:  4
  createStripeChargeIntent · directCheckout
  createPaymentIntent · pollPaymentIntent
archivos sin helper:                  0
```

## 14. Hotfix del split fuera de la fase

El arreglo H-4 vive en una rama aparte sobre `main`:

```
fix/split-doble-asiento  @28d9659
  └── solo packages/api/src/services/paymentCore.ts (1 archivo, 7 líneas)
      sin esquema, sin migración, sin helper
```

Motivo: la rama de 0B-1 **no puede mergearse** a `main` porque incluye
`orders.version` y `order_events`, y producción no tiene la migración `0038`.
El hotfix permite corregir el dinero en producción sin arrastrar la fase.
