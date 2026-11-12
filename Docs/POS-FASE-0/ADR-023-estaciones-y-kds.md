# ADR-023 · Estaciones y KDS — diseño listo para implementar

**Estado:** diseño aprobado para arrancar (no implementado)
**Fecha:** 11 de noviembre de 2026
**Fase:** 0C
**Depende de:** [`ADR-018`](./ADR-018-integridad-ordenes.md) (hecho) · [`ADR-017`](./ADR-017-transporte-eventos.md) (diseño) · [`ADR-020`](./ADR-020-impresion.md) (diseño)
**Objetivo:** que cocina, barra y cualquier otra estación reciban **solo** lo suyo, con ruteo configurable y sin tocar el núcleo transaccional.

---

## 1. Punto de partida (verificado)

| Hecho | Evidencia |
|---|---|
| El KDS filtra **solo por sucursal** | `kds.getOrders` (`branchId`) |
| `menu_categories.printerZone` existe con default `"MAIN"` y **nadie lo lee** | esquema restaurant |
| Impresión: una sola impresora por restaurante | `printing.ts` (60 LOC) |
| No hay `stationId` en ítems ni en categorías | esquema |
| Eventos del KDS no cruzan servicios (bus en memoria) | `packages/events/src/bus.ts` |
| `orders.version` + `order_events` ya existen y funcionan | 0B-1 en producción |

> **Ventaja:** la mitad de la infraestructura ya está. 0C es sobre todo **modelo + ruteo + UI**, no plomería nueva.

---

## 2. Modelo de datos propuesto

```sql
-- PROPUESTA · no aplicar sin autorización
CREATE TABLE stations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId" text NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'KITCHEN',   -- KITCHEN | BAR | EXPO | COLD
  "printerId" text,                        -- FK a printers (ADR-020)
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX stations_branch_name_uidx ON stations ("branchId", lower(name));

-- Asociación: override por producto, hereda de categoría
ALTER TABLE menu_categories ADD COLUMN "stationId" text REFERENCES stations(id) ON DELETE SET NULL;
ALTER TABLE menu_items      ADD COLUMN "stationId" text REFERENCES stations(id) ON DELETE SET NULL;

-- Fotografía al enviar a cocina (nunca se recalcula)
ALTER TABLE order_items
  ADD COLUMN "stationId" text,
  ADD COLUMN "printerId" text,
  ADD COLUMN "sentToStationAt" timestamp;
```

**Regla de resolución (en orden):**

```
order_items.stationId  ←  menu_items.stationId  ←  menu_categories.stationId  ←  estación por defecto de la sucursal
```

La estación se **congela** en el ítem al enviar la comanda. Si mañana cambia la categoría, la orden histórica se imprime/rutea igual.

**Compatibilidad:** `stationId` es nullable. Sin configuración, todo cae a la estación por defecto → **cero cambio de comportamiento**.

---

## 3. Migración de datos (segura)

Al aplicar la migración se crea, por sucursal, una estación `Cocina` (type `KITCHEN`) y se deja como **default**. Ningún ítem existente se modifica.

```
0039_pos_stations.sql
  ├─ CREATE TABLE stations
  ├─ ALTER menu_categories / menu_items (nullable)
  ├─ ALTER order_items (snapshot)
  ├─ INSERT estación "Cocina" por sucursal existente
  └─ CREATE INDEX order_items_station_idx
```

Idempotente (`IF NOT EXISTS`). Rollback: `DROP TABLE stations` + drop columnas.

---

## 4. Contratos (tRPC)

| Contrato | Tipo | Qué hace |
|---|---|---|
| `stations.list` | query | estaciones de la sucursal |
| `stations.upsert` | mutation | crear/editar (solo dueño/manager) |
| `stations.assignCategory` | mutation | categoría → estación |
| `stations.assignItem` | mutation | producto → estación (override) |
| `pos.sendToKitchen` | mutation | congela `stationId`/`printerId` en los ítems y emite eventos por estación |
| `kds.getStationQueue` | query | cola **de una estación** (reemplaza el filtro por sucursal) |
| `kds.snapshot` | query | estado completo + `since` (recuperación tras reconexión) |
| `kds.updateItemStatus` | mutation | ya existe; se mantiene |

`sendToKitchen` **no** toca importes: usa `withOrderMutation` (ya en producción) para el snapshot y escribe el outbox en la misma transacción.

---

## 5. Eventos y aislamiento (ADR-017)

```
canal:  biz:{businessId}:branch:{branchId}:station:{stationId}
token:  claims { businessId, branchId, stationId, role: "KDS" }
```

- Un KDS **solo** puede suscribirse al canal de su estación (sin comodines).
- El evento lleva `orderVersion` para descartar desactualizados.
- Reconexión: `kds.snapshot(since=<seq>)` + polling 10 s como red de seguridad.

---

## 6. UI

| Pantalla | Cambio |
|---|---|
| `/kitchen` (admin) | selector de estación; por defecto la primera activa |
| `apps/kds` | arranca pidiendo estación (o la recibe del token) |
| POS | al enviar comanda, muestra "enviado a Cocina / Barra" por ítem |
| Admin → menú | selector de estación por categoría y por producto |

Sin estaciones configuradas, la UI se comporta como hoy (una sola cola).

---

## 7. Plan incremental (5 bloques, un commit cada uno)

| Bloque | Alcance | Criterio de aceptación |
|---|---|---|
| **0C-1** | Migración `0039` + `stations` + estación default + `stations.*` | ✅ **staging aplicado** · POS sin cambios · falta prod |
| **0C-2** | Resolución de estación + snapshot al insertar el ítem | ✅ **hecho** · 4 puntos de inserción cubiertos |
| **0C-3** | `kds.getStationQueue` + aislamiento por sucursal/estación | ✅ **hecho** · verificación en staging |
| **0C-4** | UI de estaciones (admin + KDS) | Dos pantallas simultáneas, cada una con su cola |
| **0C-5** | Outbox realtime + Centrifugo | Reconexión <5 s sin perder comandas; polling se mantiene 30 días |

**Nada de esto toca pagos, caja ni Bunz.**

---

## 8. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-13 | Rutear mal una comanda (plato a la barra) | Resolución determinista + snapshot + prueba por caso |
| R-14 | Ítems viejos sin estación | Fallback a estación default; nunca "sin destino" |
| R-15 | KDS ve otra sucursal | Token por canal + matriz de aislamiento (bloque 0C-3) |
| R-16 | Ruido al migrar (todos a "Cocina") | Es el comportamiento actual; el tenant separa barra cuando quiera |
| R-17 | Cambiar categoría altera historial | Snapshot inmutable en `order_items` |

---

## 9. Primer paso exacto para la próxima sesión

```bash
git checkout main && git pull
git checkout -b feat/pos-0c1-estaciones
```

1. Escribir `packages/database-restaurant/migrations/manual/0039_pos_stations.sql`.
2. Añadir `stations` y las columnas al esquema Drizzle.
3. `stations.*` en un router nuevo (`packages/api/src/routers/stations.ts`).
4. Aplicar en **staging** y verificar que el POS **no cambia**.
5. Solo entonces, merge a `main`.

**Bloqueante conocido:** ninguna. La base de staging ya tiene `0038` y el trinquete está en 0.

---

## 10. Lo que NO entra en 0C

- Cursos y disparos (Fase 1).
- Asientos y split por comensal (Fase 1).
- Impresión por estación real (ADR-020; 0C solo guarda `printerId` en el snapshot).
- Expediter (Fase 1).
- Offline (fuera de alcance, evaluación aparte).


---

## 11. Registro 0C-1 (12-nov-2026)

**Implementado:** migración `0039_pos_stations.sql`, tabla `stations`, columnas
`menu_categories.stationId`, `menu_items.stationId` y snapshot en `order_items`,
más el router `stations.*` (`list`, `upsert`, `setDefault`, `assignCategory`,
`assignItem`).

**Aplicado en staging:**

```
estaciones creadas:      6 (una "Cocina" default por sucursal)
columnas nuevas:         5
items con estación:      0 de 245   ← nada cambió
órdenes:                 159 intactas
```

**Comportamiento:** idéntico. Sin estaciones configuradas todo cae en "Cocina",
que es exactamente lo que hacía el POS antes.

**Pendiente para cerrar 0C-1:** aplicar `0039` en producción (misma ventana que
`0038`) y mergear a `main`. Hasta entonces la rama no se despliega.


---

## 12. Registro 0C-2 (12-nov-2026)

**Servicio** `services/stationRouting.ts`: resuelve el destino de N ítems en **3
consultas** (productos, categorías, estación default) y devuelve también la
impresora de la estación.

**Snapshot en los 4 puntos donde nacen ítems:**

| Punto | Cuándo |
|---|---|
| `addToCart` | al agregar a la comanda |
| `directCheckout` | cobro directo con ítems |
| `createPaymentIntent` | cobro por QR |
| `createStripeChargeIntent` | cobro con tarjeta |

Cada ítem guarda `stationId`, `printerId` y `sentToStationAt` **en el momento de
crearse**. Si mañana cambia la categoría o se borra la estación, el ítem histórico
conserva su destino.

**Comportamiento actual:** todas las sucursales tienen una sola estación default
("Cocina"), así que el resultado visible es idéntico.

**Pendiente de 0C-2:** validar en staging que un carrito con categorías distintas
produce `stationId` distintos una vez que el tenant cree la estación Barra.
## 13. Registro 0C-3 (12-nov-2026)

**Refactor:** la lógica de la cola salió a `loadKdsQueue(ctx, { status, stationId })`.

- `kds.getOrders` → delega **sin** `stationId` (comportamiento histórico intacto).
- `kds.getStationQueue({ stationId })` → filtra **ítems** de esa estación y descarta
  comandas sin nada para ella.
- Los ítems ahora exponen `stationId`, `printerId` y `sentToStationAt`.
- **Aislamiento:** si la estación no pertenece a `ctx.branchId`, responde
  `FORBIDDEN`. Un cliente no puede pedir la cola de otra sucursal.

**Nota:** el binding duro *terminal → estación* (para que la tablet de cocina no
pueda pedir la barra aunque sepa el id) llega con la UI de 0C-4, donde se asigna
la estación a cada terminal.

---

## 14. Validación end-to-end en staging (12-nov-2026)

Con el código de 0C-2 + 0C-3 desplegado en staging:

```
stations.list (terminal)  → Cocina (default) · Barra
orden creada + 2 addToCart por API

CAFÉ AMERICANO      → Cocina   (sentToStationAt = sí)
CAFÉ FRIO MINERAL   → Barra    (sentToStationAt = sí)
```

**0C-2 validado en la app real**, no solo en el servicio: el snapshot ocurre al
insertar el ítem y respeta el override de categoría.

### Bloqueo resuelto en el camino

El deploy de staging falló por un error de TypeScript en `next build`:
`loadKdsQueue` devolvía `any` y el cliente perdía tipos (implicit any en
`kitchen/page.tsx`). Se tipó la cola con `KdsQueueItem` / `KdsQueueOrder`.

También se detectó que el deploy por CLI usa **NIXPACKS** (por `railway.json`)
mientras los deploys de GitHub usan **RAILPACK**; y que tras varios fallos
Railway dejó de disparar deploys al pushear a `staging`. El deploy por CLI sí
funciona.
