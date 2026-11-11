# Plan de merge a `main` — cierre de 0B-1

**Estado:** propuesto (no ejecutado)
**Fecha:** 11 de noviembre de 2026
**Rama a integrar:** `feat/pos-0b1-integridad-ordenes` @ `fed5cd2`
**Base actual de `main`:** `02837fd` (incluye el hotfix del split)

---

## 1. La condición que manda

> El código de 0B-1 **no puede llegar a `main` antes** de que la migración `0038`
> esté aplicada en producción.

Motivo: el esquema declara `orders.version` y la tabla `order_events`. Drizzle
incluye esas columnas en cualquier `.select().from(orders)`. Si el código entra
primero, **todas las consultas a órdenes fallan** con `column does not exist`.

```
migración  →  verificar  →  merge  →  deploy
```

Nunca al revés.

---

## 2. Qué incluye la rama

| Cambio | Riesgo | Nota |
|---|---|---|
| `orders.version`, `updatedBy*`, tabla `order_events` | **Alto si falta la migración** | Aditivo, con `IF NOT EXISTS` |
| Helper `orderIntegrity.ts` (`withOrderMutation`, `withOrderCreate`, `withOrderRollback`) | Bajo | Código nuevo, sin efecto hasta el cableado |
| Cableado de `pos.ts` (46 escrituras) | Medio | Comportamiento equivalente + versión/bitácora |
| Rutas de miniapp, crons y webhooks (12 archivos) | Medio | Mismo patrón |
| `payOrder` marcado `@deprecated` | Bajo | Sigue funcionando igual |
| Documentación (`Docs/POS-FASE-0/`) | Nulo | — |

---

## 3. Pre-flight (antes de tocar nada)

- [ ] `main` desplegado y verde (`/` y `/pos` → 200).
- [ ] Sin cambios pendientes en la rama: `git status` limpio en `feat/pos-0b1`.
- [ ] `tsc` limpio en `packages/api`, `apps/admin`, `telegram-miniapp`.
- [ ] Test de arquitectura en verde (trinquete en 0).
- [ ] **Snapshot/backup de la base de producción** (Neon permite branch instantáneo).
- [ ] Ventana acordada (bajo tráfico: madrugada o cierre del local).
- [ ] Aviso al afiliado piloto si hay operación en curso.

---

## 4. Paso a paso

### Paso 1 · Snapshot de producción
En Neon: crear un branch `pre-0038` desde el branch principal. Es copy-on-write,
tarda segundos y permite volver sin restaurar dump.

### Paso 2 · Aplicar `0038` en producción

```bash
psql "$PROD_RESTAURANT_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f packages/database-restaurant/migrations/manual/0038_pos_order_integrity.sql
```

Es aditiva e idempotente:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1, …
CREATE TABLE IF NOT EXISTS order_events (…);
CREATE INDEX IF NOT EXISTS …;
```

### Paso 3 · Verificar la migración

```sql
SELECT count(*) FROM information_schema.columns
WHERE table_name='orders' AND column_name='version';        -- 1
SELECT to_regclass('public.order_events');                   -- order_events
SELECT count(*) FROM orders WHERE version = 1;               -- todas
```

Si algo falla aquí: **no se mergea**. Se revierte el branch de Neon si hiciera falta.

### Paso 4 · Merge y deploy

```bash
git checkout main && git pull
git merge --no-ff feat/pos-0b1-integridad-ordenes
git push origin main
```

Railway despliega `rabbitty-admin` desde `main`. **Staging no se despierta**
(ahora apunta a la rama `staging`).

### Paso 5 · Smoke test en producción (no destructivo)

| Check | Cómo | Esperado |
|---|---|---|
| POS abre | `admin.rabbitty.me/pos` | 200 y carga |
| Órdenes listan | abrir Operación | sin errores |
| Cobro real pequeño | 1 café en efectivo | `PAID`, ticket, versión +1 |
| Bitácora | `SELECT * FROM order_events ORDER BY "createdAt" DESC LIMIT 5` | evento del cobro |

### Paso 6 · Vigilancia 24 h

- `order_events` creciendo con cada cobro.
- Cero errores `column "version" does not exist` en logs.
- Cero `CHECKOUT_CLEANUP` bloqueados por `OrderRollbackBlockedError`.

---

## 5. Rollback

| Escenario | Acción | Efecto |
|---|---|---|
| El deploy falla | `git revert` del merge + push | Código vuelve a `02837fd` |
| El código falla por esquema | Idem | Las columnas nuevas **no molestan** al código viejo (son nullable/default) |
| Datos corruptos | Restaurar el branch `pre-0038` de Neon | Vuelve al estado previo a la migración |

**Clave:** las columnas nuevas son **compatibles hacia atrás**. Revertir el código
no requiere revertir la migración. Eso hace el rollback de una sola dirección y
sin pérdida de datos.

---

## 6. Después del merge

- Actualizar `ROADMAP-Y-CHECKPOINTS.md §7` con `C1..C5` cerrados.
- Marcar `feat/pos-0b1` como `mergeada a main` en la bitácora de ramas.
- Siguiente bloque: **0C** (modelo de estaciones + contratos KDS), que no toca
  órdenes ni pagos.

---

## 7. Riesgos del propio merge

| Riesgo | Mitigación |
|---|---|
| Migración a medias | `BEGIN/COMMIT` en el SQL + `ON_ERROR_STOP` |
| Deploy tarda y el POS queda sin sesión | Ventana de bajo tráfico; el rollback de código es inmediato |
| Terminal con bundle viejo | Sigue funcionando: los contratos no cambiaron, solo se agregó `version` interno |
| `order_events` crece rápido | Índice por `orderId` + política de retención a definir en 0C |
