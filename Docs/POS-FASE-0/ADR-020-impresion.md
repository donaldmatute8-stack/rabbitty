# ADR-020 · Impresión: deduplicación, incertidumbre y reimpresión controlada

**Estado:** aprobado para diseño
**Fecha:** 11 de noviembre de 2026
**Decide:** D-09, D-10
**Relacionado:** [`ADR-017`](./ADR-017-transporte-eventos.md) · [`ADR-018`](./ADR-018-integridad-ordenes.md) · [`RIESGOS`](./RIESGOS.md)

---

## 1. Corrección de premisa

El diseño anterior prometía impresión "exactamente una vez". **Se retira.**

> Con impresoras ESC/POS no es posible garantizar el efecto físico exactamente una vez.

## 2. Evidencia

| Hecho | Ubicación |
|---|---|
| Existe un solo punto de impresión, síncrono | `apps/admin/src/app/api/print/route.ts` |
| Se envía a CUPS por backend USB | `spawn("/usr/libexec/cups/backend/usb", …)` |
| Una sola impresora configurada por restaurante | `printing.ts` (60 LOC) lee `restaurant.printerType` / `printerConfig` |
| Sin cola, sin reintento, sin dedupe | mismo archivo |
| Fallback actual: `window.print()` | comentario en `print/route.ts` |
| CUPS reporta éxito al **aceptar en la cola**, no al imprimir | comportamiento del spooler |

## 3. Modelo de estados

```
QUEUED → SENT_TO_SPOOLER → { CONFIRMED | IN_DOUBT | FAILED }
                              ↑
        sin acuse del dispositivo en N segundos
```

- `SENT_TO_SPOOLER`: CUPS aceptó el trabajo. **No significa impreso.**
- `CONFIRMED`: solo con acuse real del hardware (ESC/POS `DLE EOT` o API de estado del modelo).
- `IN_DOUBT`: se envió, no hubo acuse, y **no se sabe** si salió.

## 4. Política ante `IN_DOUBT` (decisión D-10)

1. **Nunca reintentar automáticamente** después de `SENT_TO_SPOOLER`.
   El reintento automático es exactamente el generador de duplicados.
2. El trabajo queda visible en el POS como **"impresión incierta"**.
3. Decide el operador:
   - **Reimprimir** → job nuevo, `rev+1`, encabezado `*** DUPLICADO ***`.
   - **Marcar como entregado** → cierra el trabajo sin imprimir.
4. Todo queda registrado con `staffId`, `terminalId` y hora.

## 5. Modelo propuesto

```sql
CREATE TABLE printers (
  id text PRIMARY KEY,
  "branchId" text NOT NULL,
  "stationId" text,
  name text NOT NULL,
  kind text NOT NULL,        -- CUPS | NETWORK | BLUETOOTH
  target text NOT NULL,
  width integer DEFAULT 58,
  "isActive" boolean DEFAULT true
);

CREATE TABLE print_jobs (
  id text PRIMARY KEY,
  "printerId" text NOT NULL,
  "orderId" text,
  "stationId" text,
  kind text NOT NULL,               -- TICKET | KITCHEN | REPORT
  "idempotencyKey" text NOT NULL UNIQUE,  -- order:{id}:item:{id}:rev{n}
  payload jsonb NOT NULL,
  status text DEFAULT 'QUEUED',     -- QUEUED|SENT_TO_SPOOLER|CONFIRMED|IN_DOUBT|FAILED
  attempts integer DEFAULT 0,
  "lastError" text,
  "lockedUntil" timestamp,
  "sentAt" timestamp,
  "confirmedAt" timestamp,
  "resolvedByStaffId" text
);
```

### 5.1 Fotografía del destino

`orderItems.stationId` y `orderItems.printerId` se copian **al confirmar la comanda**.

Si mañana cambia la categoría o la estación, la orden histórica se reimprime igual.
Sin esto, un cambio de menú reescribe el pasado (ver [ADR-018 §9](./ADR-018-integridad-ordenes.md)).

## 6. Worker

- Claim con `FOR UPDATE SKIP LOCKED`.
- Máximo 3 intentos **antes** de `SENT_TO_SPOOLER` (errores de conexión al spooler).
- Después de `SENT_TO_SPOOLER`: **cero reintentos automáticos**.
- `FAILED` solo por error determinista (impresora inexistente, formato inválido).

## 7. Métrica desde el día uno

```
jobs_created
jobs_sent_to_spooler
jobs_confirmed
jobs_in_doubt          ← mide la calidad real del parque de impresoras
reprints_manual
```

## 8. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-05 | Duplicado físico al reintentar | `IN_DOUBT` + decisión humana |
| — | `CONFIRMED` falso | Solo con acuse del hardware; si no existe, se queda en `SENT_TO_SPOOLER` |
| — | Reimpresión no auditada | Job nuevo con `rev+1` y marca visual |
| — | Ruteo por configuración cambiante | Snapshot en la comanda |

## 9. Criterios de aceptación

- [ ] Apagar impresora → jobs quedan `QUEUED`/`IN_DOUBT`, ninguno se pierde.
- [ ] Reenviar la misma comanda no genera job nuevo (misma `idempotencyKey`).
- [ ] Reimprimir exige acción explícita y deja marca.
- [ ] Informe de `sent_to_spooler` vs `confirmed` disponible.

## 10. Rollback

Cola detrás de flag. Apagada = `/api/print` directo actual. Los jobs históricos quedan como registro.

## 11. Evidencia

- `apps/admin/src/app/api/print/route.ts` (ESC/POS + CUPS + `OPEN_DRAWER`)
- `packages/api/src/routers/printing.ts` (60 LOC, una impresora)
- `packages/database-restaurant/src/schema/index.ts` → `restaurants.printerType/printerConfig`
