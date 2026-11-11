# ADR-022 · `directCheckout` — mapa y plan de cableado

**Estado:** mapeo aprobado para implementación (no implementado)
**Fecha:** 11 de noviembre de 2026
**Procedimiento:** `packages/api/src/routers/pos.ts` · `directCheckout` (líneas 2042-2828, 787 líneas)
**Relacionado:** [`ADR-018`](./ADR-018-integridad-ordenes.md) · [`PLAN-PRUEBAS-COBRO.md`](./PLAN-PRUEBAS-COBRO.md)

---

## 1. Por qué no es "un procedimiento más"

`directCheckout` no solo cobra: **crea la orden, la cotiza, aplica membresía, cobra,
cierra mesa, premia y limpia si algo falla**. Es el camino más crítico del POS y el
único que hoy tiene 11 escrituras sin protección.

---

## 2. Las 11 escrituras (individualizadas)

| # | Línea | Operación | Cuándo ocurre | Destino |
|---:|---:|---|---|---|
| W1 | 2147 | `update(orders)` | **Reutiliza** una orden existente (`existingOrderId`) y refresca cabecera | `withOrderMutation` |
| W2 | 2182 | `insert(orders)` | Crea orden nueva | `withOrderCreate` |
| W3 | 2228 | `insert(orderItems)` | Inserta ítems en loop | `withOrderCreate` (misma tx) |
| W4 | 2380 | `update(orders)` | Escribe subtotal/IVA/total antes de cobrar | `withOrderMutation` |
| W5 | 2470 | `update(orders)` | **Repite** W4 solo para el split (el intent necesita el total) | **eliminar** (W4 ya lo escribió) |
| W6 | 2526 | `update(orders)` | Totales dentro de la tx de cobro | `withOrderMutation` (tx de cobro) |
| W7 | 2534 | `insert(payments)` | Pago principal | misma tx de cobro |
| W8 | 2546 | `insert(payments)` | Crédito de membresía aplicado | misma tx de cobro |
| W9 | 2566 | `update(orders)` | Marca `COMPLETED` | misma tx de cobro |
| W10 | 2659 | `delete(orderItems)` | **Limpieza** si el cobro falló y la orden era nueva | `withOrderRollback` |
| W11 | 2660 | `delete(orders)` | Ídem: no dejar borrador huérfano | `withOrderRollback` |
| W12 | 2668 | `update(orders)` | Libera `idempotencyKey` si se reutilizó orden | `withOrderMutation` |
| W13 | 2778 | `update(orders)` | Guarda `bunzReward` tras el premio | `withOrderMutation` |

> W7 y W8 son de `payments`, no de `orders`, pero viven dentro del mismo bloque
> crítico y deben seguir en la **misma transacción** que W6/W9.

---

## 3. Estructura propuesta

```
FASE A · Preparación (1 tx)
  ├─ si existingOrderId → withOrderMutation (W1: cabecera)
  ├─ si nueva           → withOrderCreate  (W2 + W3: orden + ítems)
  └─ withOrderMutation   (W4: precios una sola vez)   ← elimina W5

FASE B · Membresía (fuera de lock, ya tiene compensaciones)
  └─ applyMembershipBenefitsToOrder (sin cambios)

FASE C · Cobro (1 tx)
  └─ withOrderMutation
       ├─ W6 totales (idempotente: mismo cálculo)
       ├─ W7/W8 payments
       ├─ W9 COMPLETED
       └─ cierre de mesa (tableSessions)

FASE D · Solo si C falló (1 tx)
  └─ withOrderRollback
       ├─ W10/W11 delete ítems + orden  (solo si createdNew)
       └─ W12 liberar idempotencyKey    (si se reutilizó)

FASE E · Premio (1 tx, post-commit)
  └─ withOrderMutation (W13 bunzReward)
```

---

## 4. Contratos nuevos que faltan en el helper

| Helper | Firma | Para qué |
|---|---|---|
| `withOrderRollback(tx, { orderId }, fn)` | lock + valida que la orden **no tenga pagos** + `fn` puede borrar | W10/W11 sin dejar que un rollback borre una orden ya cobrada |
| `withOrderCreate` ya existe | — | W2/W3 |

`withOrderRollback` debe **rechazar** el borrado si existe algún `payment` con
`status = COMPLETED` para esa orden. Hoy el código borra sin comprobarlo: si el
cobro se aplicó y luego falló la respuesta del premio, se podría borrar una orden
pagada.

---

## 5. Riesgos específicos de este procedimiento

| Riesgo | Detalle | Mitigación |
|---|---|---|
| **R-A** Borrar orden pagada | La limpieza (W10/W11) no verifica pagos | `withOrderRollback` exige 0 pagos |
| **R-B** Doble precio | W4 y W5 escriben los mismos totales | Eliminar W5; una sola escritura |
| **R-C** Compensación de membresía | Si el cobro falla, se devuelven créditos/cuotas | Debe ejecutarse **antes** del rollback de la orden |
| **R-D** Idempotencia | La clave se libera solo si se reutilizó orden | Mantener semántica exacta; probar reintento |
| **R-E** Split | Ya corregido H-4; el intent solo aporta Bunz | Re-ejecutar C-03 tras el refactor |
| **R-F** Reutilizar orden | `existingOrderId` trae cabecera y estado | Validar estado permitido antes de mutar (`allowedStatuses`) |

---

## 6. Criterios de aceptación

- [ ] `directCheckout` sin escrituras fuera del helper (trinquete).
- [ ] C-01 (efectivo) re-ejecutado en staging: orden `COMPLETED`, Σ pagos = total.
- [ ] C-03 (split) re-ejecutado: BUNZ + CASH = total, sin `CREDIT_CARD` fantasma.
- [ ] Fallo simulado de cobro: la orden nueva **no** queda huérfana, y si hubiera
      pago aplicado **no** se borra.
- [ ] Reintento con la misma `idempotencyKey` no duplica.
- [ ] Membresía: beneficio aplicado una vez y compensado si el cobro falla.

---

## 7. Orden de implementación sugerido

1. `withOrderRollback` en `orderIntegrity.ts` (+ prueba de que rechaza órdenes pagadas).
2. Fase A (creación/precios) — comportamiento idéntico, sin tocar el cobro.
3. Fase C (cobro) — el bloque crítico.
4. Fase D (rollback) y E (premio).
5. Ventana de staging: C-01 + C-03 y limpieza de datos.

Cada paso se puede mergear a `feat/pos-phase0` por separado; **nada a `main`** hasta
cerrar toda la fase.
