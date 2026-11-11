# ADR-019 · Saga de pagos y reconciliación

**Estado:** aprobado para diseño
**Fecha:** 11 de noviembre de 2026
**Decide:** D-06, D-07, D-08
**Relacionado:** [`ADR-018`](./ADR-018-integridad-ordenes.md) · [`RIESGOS`](./RIESGOS.md) · [`ADR-021`](./ADR-021-cfdi.md)

---

## 1. Corrección de premisa

El diseño anterior prometía "exactly once". **Se retira.**

> Objetivo real: **aplicación at-most-once en Rabbitty** + **reconciliación de la incertidumbre**.
> Stripe y PostgreSQL no comparten transacción; el efecto externo no puede garantizarse exactamente una vez solo con lógica local.

## 2. Evidencia (primitivas ya existentes)

| Pieza | Ubicación | Qué aporta |
|---|---|---|
| Idempotencia de webhook a nivel ingesta | `payment_provider_events`, índice único `(provider, eventId)` | Duplicados no re-procesan |
| Confirmación de settlement | `paymentCore.confirmPaymentIntentSettled` | Aplicación del pago |
| Discrepancia | `markProviderWebhookEventDiscrepancy` | Marca lo que no cuadra |
| Liberación de hold | `paymentCore.releasePaymentIntentHold` — `FOR UPDATE` + guard `SUCCEEDED` | Evita liberar con cobro en vuelo |
| Reversión contable | `reverseOrderLedger` | Deshacer asiento |
| Registro de webhook | `registerProviderWebhookEvent` | Trazabilidad de eventos |
| Intención con clave | `paymentIntents.idempotencyKey` único | Idempotencia de creación |

## 3. Máquina de estados propuesta

```
CREATED
  → HOLD                 (reserva Bunz, si aplica)
  → PROVIDER_PENDING
  → PROVIDER_SETTLED
  → APPLIED

Ramas:
  FAILED
  EXPIRED
  SETTLED_AFTER_EXPIRY   ← nuevo, primera clase
  RECONCILED
```

### 3.1 `SETTLED_AFTER_EXPIRY`

Escenario: el hold se liberó y el intent expiró, pero el proveedor confirma el cobro después.

Regla: **no se ignora**. Se resuelve explícitamente:

1. Si la orden sigue abierta y sin pagar → aplicar (marcar `SETTLED_AFTER_EXPIRY` → `APPLIED`) con transición registrada.
2. Si la orden ya se cobró por otra vía → reembolsar o abonar a favor del cliente, con asiento y notificación.
3. Nunca "descartar por tardío".

## 4. Hazards y cobertura

| Hazard | Cómo se cubre | Falta |
|---|---|---|
| Webhook duplicado | Índice único `(provider, eventId)` | — |
| Webhook tardío | `SETTLED_AFTER_EXPIRY` | Implementar flujo |
| Liberar hold con cobro en vuelo | `FOR UPDATE` + guard `SUCCEEDED` | Ventana release→webhook documentada |
| Doble aplicación local | Transición con `appliedAt IS NULL` | `payment_transitions` |
| Idempotencia del proveedor | — | Enviar `Idempotency-Key` a Stripe |
| Reembolso posterior | `reverseOrderLedger` | Reglas de orden con Bunz |

## 5. Trazabilidad: `payment_transitions`

```sql
CREATE TABLE payment_transitions (
  id text PRIMARY KEY,
  "intentId" text NOT NULL,
  "fromStatus" text NOT NULL,
  "toStatus" text NOT NULL,
  source text NOT NULL,          -- WEBHOOK | CRON | POS | RECONCILER
  "externalEventId" text,
  reason text,
  "createdAt" timestamp DEFAULT now()
);
```

`appliedAt` dice *si* se aplicó; `payment_transitions` dice *cómo* llegó ahí. Sin esto, un incidente no se puede reconstruir.

## 6. Condición dura

> `paymentCore` **no se modifica** hasta tener regresión completa verde sobre:
> fiat · Bunz · refunds · reservas.

Cualquier cambio en `paymentCore` requiere autorización independiente y su propio rollback.

## 7. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-02 | Doble aplicación de pago | Estados + transiciones + idempotencia |
| R-09 | Regresión en `paymentCore` | Condición dura §6 |
| — | Reconciliación ciega | Cron consulta al proveedor, nunca asume estado |
| — | Cobro con orden desactualizada | Lock de orden (`ADR-018`) antes de aplicar |

## 8. Criterios de aceptación

- [ ] Webhook duplicado → una sola aplicación.
- [ ] Webhook tardío → `SETTLED_AFTER_EXPIRY` resuelto con transición registrada.
- [ ] Corte de red entre settlement y aplicación → la reconciliación lo cierra sin duplicar.
- [ ] Regresión de fiat, Bunz, refund y reservas en verde antes de tocar `paymentCore`.

## 9. Rollback

Saga detrás de flag. Apagada = comportamiento actual documentado. Ningún cambio de datos históricos.

## 10. Evidencia

- `packages/api/src/services/paymentCore.ts` (`confirmPaymentIntentSettled`, `releasePaymentIntentHold`, `reverseOrderLedger`, `registerProviderWebhookEvent`)
- `packages/database-restaurant/src/schema/index.ts` → `payment_provider_events` (índice único)
- `paymentIntents.idempotencyKey` (único)
