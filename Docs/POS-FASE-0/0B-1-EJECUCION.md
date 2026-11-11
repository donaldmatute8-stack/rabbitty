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

### 2.1 Bloqueo detectado (crítico)

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
