# Plan de pruebas de cobro (ventana de staging)

**Objetivo:** validar los 5 caminos de dinero de `pos.ts` antes de cablearlos a la saga.
**Cuándo:** en una ventana de staging encendida (ver [`STAGING-ON-OFF.md`](./STAGING-ON-OFF.md)).
**ADR:** [`ADR-019`](./ADR-019-saga-pagos.md) · [`ADR-018`](./ADR-018-integridad-ordenes.md)

---

## 1. Procedimientos a validar

| Procedimiento | Qué hace hoy | Riesgo si se cablea a ciegas |
|---|---|---|
| `payOrder` | cobro en caja (efectivo/Bunz/split) | doble cobro, orden pagada sin asiento |
| `directCheckout` | cobro completo con 11 escrituras | el más crítico del POS |
| `createStripeChargeIntent` | intención de cobro con tarjeta | intención duplicada, orden sin marcar |
| `createPaymentIntent` | intención + orden de respaldo | idem |
| `pollPaymentIntent` | reconciliación al consultar | aplicar dos veces un settlement |

---

## 2. Precondiciones

- [ ] Rama `feat/pos-0b1-integridad-ordenes` desplegada o corriendo local contra staging.
- [ ] Migración `0038` aplicada en el branch de Neon (ya está).
- [ ] Sucursal de prueba con al menos 3 platillos y 1 método de cobro habilitado.
- [ ] Cliente de prueba con saldo Bunz.
- [ ] Stripe en modo test (nunca llaves live).
- [ ] `STAGING-ON-OFF.md` §5 completado.

---

## 3. Casos

### C-01 · Efectivo simple
1. Orden con 2 ítems.
2. Cobro en efectivo por el total.

**Esperado:** `orders.status = PAID`, un `payments` CASH, un `order_events` con `version` antes/después, total intacto.

### C-02 · Tarjeta (Stripe test)
Intención con tarjeta de prueba `4242…` y webhook simulado.

**Esperado:** intención `APPLIED` una sola vez; orden `PAID`; sin asiento doble.

### C-03 · Bunz parcial + efectivo
Split con parte Bunz y parte efectivo.

**Esperado:** `SPLIT_MISMATCH` no aparece; ledger suma 0; `bunzPaid` refleja solo la parte Bunz.

### C-04 · Bunz 100 %
Pago completo con Bunz.

**Esperado:** orden `PAID`, sin cashback generado por Bunz, asiento de redención único.

### C-05 · Reembolso total
Reembolsar C-01.

**Esperado:** refund en Stripe (si aplica) o asiento inverso; orden `REFUNDED`/`VOIDED` coherente; ledger revierte.

### C-06 · Reembolso parcial
Reembolsar 50 %.

**Esperado:** no excede el original (`> original + 0.01` debe fallar); asiento parcial.

### C-07 · Webhook duplicado
Enviar dos veces el mismo evento de Stripe.

**Esperado:** índice único `(provider, eventId)` lo absorbe; una sola aplicación; sin error visible.

### C-08 · Settlement tardío (`SETTLED_AFTER_EXPIRY`)
Dejar expirar la intención y luego confirmar el cobro.

**Esperado:** estado `SETTLED_AFTER_EXPIRY` → resolución explícita (aplicar o reembolsar), nunca descartar.

### C-09 · Dos terminales cobrando la misma orden
Lanzar `payOrder`/`directCheckout` en paralelo.

**Esperado:** exactamente un cobro; la segunda recibe `CONFLICT` con `currentVersion`.

### C-10 · Anulación después de cobrar
`voidOrder` sobre una orden `PAID`.

**Esperado:** política definida (rechazo o reverso con asiento); nunca silencio.

### C-11 · Membresía + cobro
Canje de beneficio en el mismo ticket.

**Esperado:** descuento aplicado una vez; `entitlementUsages` con `idempotencyKey` único.

---

## 4. Invariantes que deben cumplirse siempre

```
1. Σ ledger del turno = 0 (débitos = créditos)
2. orders.total = subtotal + tax − discount + tip  (±0.01)
3. Ninguna orden PAID sin al menos un payment aplicado
4. Un payment no se aplica dos veces (appliedAt único)
5. version aumenta exactamente una vez por mutación
6. order_events tiene un asiento por mutación
```

Consulta de verificación sugerida:

```sql
-- deriva de totales
SELECT id, total, subtotal, tax, discount, tip
FROM orders
WHERE abs(total - (subtotal + tax - discount + tip)) > 0.01;

-- eventos por orden (debe igualar mutaciones)
SELECT "orderId", count(*) FROM order_events GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

---

## 5. Evidencia a registrar

Por caso: resultado, captura o log, y el id de orden/intención.
Se anexa a este documento al cerrar la ventana.

---

## 6. Después de la ventana

- [ ] Apagar staging (`STAGING-ON-OFF.md` §3).
- [ ] Registrar resultados aquí.
- [ ] Solo con todo en verde: cablear los 5 procedimientos a la saga.
- [ ] Actualizar baseline del trinquete (debe bajar a 0 procedimientos pendientes).

---

## 7. Rollback

Ningún caso de este plan modifica producción: todo corre en el branch de Neon y
en Stripe test. Si algo falla, se apaga staging y se revierte la rama.


---

## 8. Ventana abierta — 11-nov-2026

**Entorno:** `https://rabbitty-admin-staging.up.railway.app` (rama `feat/pos-0b1-integridad-ordenes`)
**Base:** branch de Neon `ep-ancient-meadow` (21 MB, copia de producción)
**Migración 0038:** aplicada
**Estado del deployment:** SUCCESS · `/` y `/pos` responden 200

### Invariantes de partida (medidos antes de probar)

| Invariante | Resultado |
|---|---|
| Deriva de totales (`total ≠ subtotal + tax − discount + tip`) | **0 filas** ✅ |
| Órdenes `PAID` sin pago `COMPLETED` | **0** ✅ |
| Órdenes con pagos duplicados | **0** ✅ |
| `orders.version` | 151 órdenes en `version = 1` (default de la migración) ✅ |

> La base de partida está sana: cualquier fallo posterior será del código, no de los datos.

### Casos ejecutados automáticamente

| Caso | Estado |
|---|---|
| C-09 (concurrencia) | **Ya validado** en el branch con 10 mutaciones: 10/10, total exacto, versión 11 |
| Invariantes §4 | **Validados** (tabla arriba) |

### Casos que requieren sesión en la UI

C-01 a C-08, C-10 y C-11 necesitan credenciales de cajero en staging.
Duración estimada: 20-25 minutos.

Al terminar, registrar aquí el resultado por caso y **apagar staging**.
