# ADR-024 · Membresías aplicadas al ticket en el POS

**Estado:** implementado (13-nov-2026)
**Contexto:** Rabbitty Memberships ya se detectaba en el POS, pero el ticket se
cobraba completo.

---

## 1. El problema

Tres causas, todas en el cliente:

1. `const total = cart.reduce(...)` — el total mostrado **ignoraba los
   beneficios**. El cajero veía y cobraba el precio de lista.
2. La auto-selección solo cubría `MEMBER_CONSUMPTION` y `DISCOUNT_PCT`:
   `INCLUDED_PRODUCT` y `CREDIT_BALANCE` nunca se aplicaban solos.
3. El carrito se **recortaba a 1 artículo** al detectar membresía, con lo que un
   plan familiar no podía pedir nada más y los acompañantes desaparecían.
4. No existía camino para un ticket de $0: siempre se pedía método de pago.

El servidor ya sabía aplicar los beneficios (`applyMembershipBenefitsToOrder`);
lo que faltaba era que el POS supiera **cuánto** se va a cobrar antes de cobrar.

---

## 2. Decisión

**La aritmética vive en el servidor y se expone como vista previa.**

`computeBenefitPlan` (puro) es la única fuente del cálculo. La usan:

- `applyMembershipBenefitsToOrder` — cobro real, consume cuota/crédito;
- `previewMembershipBenefits` — vista previa, no consume nada.

`memberships.previewOrderBenefits({ customerId, items, entitlementIds?,
memberMenuItemIds? })` devuelve:

```
{ baseAmount, finalAmount, discount, creditApplied, covered, lines[] }
```

`covered = true` cuando el ticket queda en cero **y** hubo beneficio aplicado.

El POS usa `finalAmount` como total de la venta. El servidor lo recalcula al
cobrar, así que la vista previa nunca es la fuente de verdad: solo la UI.

---

## 3. Cierre sin cobro (`paymentMethod: "MEMBERSHIP"`)

Si el ticket queda en 0 hay una sola acción posible: completar la orden. El POS
cambia el botón **COBRAR** por **CONTINUAR · Membresía** y no abre el selector
de método de pago.

`pos.directCheckout` acepta `paymentMethod: "MEMBERSHIP"` con estas reglas:

| Regla | Motivo |
|---|---|
| exige `total <= 0.005` | no se puede "cerrar" una venta con dinero pendiente |
| exige al menos un beneficio aplicado | evita saltarse el cobro sin membresía |
| sin propina | una propina sin medio de pago no tiene dónde cobrarse |
| sin split | no hay nada que dividir |
| no pide autorización del Rabbitter | no hay cargo que autorizar |

Se registra un pago de **importe 0** con método `MEMBERSHIP`: deja rastro en el
ticket y en el histórico, suma 0 en los totales y no mueve caja ni banco.

Un ticket en cero con otro método sigue permitido (descuento manual al 100 %),
como antes; no se rompió ese camino.

---

## 4. Qué se aplica solo y qué no

Se auto-aplican todos los beneficios que tocan el ticket:

```
MEMBER_CONSUMPTION · INCLUDED_PRODUCT · DISCOUNT_PCT
```

**`CREDIT_BALANCE` no se auto-aplica**: es dinero del socio y el cajero decide
si lo usa (el panel lo sigue ofreciendo como opción).

---

## 5. Guardas de producto

Antes: un plan con cualquier beneficio bloqueaba el carrito completo a 1
artículo. Eso protegía de regalos, pero rompía los planes familiares.

Ahora:

- el carrito no se toca;
- lo que el plan cubre se descuenta;
- **lo que no está cubierto se cobra normal**;
- el panel de beneficios muestra qué se cubre y qué se paga.

Queda pendiente una decisión de producto: ¿algún plan debe **prohibir** añadir
artículos fuera de su cobertura? Hoy la protección es económica (se cobra), no
un bloqueo duro. Si se quiere bloqueo, hace falta un campo de plan
(`maxItemsPerVisit` o lista de productos permitidos) y su migración.

---

## 6. Modelo de beneficios existente (revisado)

| Tipo | Efecto en el ticket | Cuota |
|---|---|---|
| `MEMBER_CONSUMPTION` | ítems marcados del socio, sin costo | sí (usos/ciclo) |
| `INCLUDED_PRODUCT` | 1 unidad del producto `targetRefId` | sí |
| `DISCOUNT_PCT` | % sobre el neto restante | sí |
| `CREDIT_BALANCE` | saldo como pago (nunca cubre el 100 %) | no (saldo) |
| `EVENT_ACCESS` / `BULK_PACK` | no tocan el ticket | — |

Prioridad de aplicación: consumo → incluido → % → crédito. Así el porcentaje de
acompañantes se calcula sobre lo que queda.

Planes reales hoy: **Nido Familiar 626** (`MEMBER_CONSUMPTION` ×2/ciclo) y
**Demo App Review** (`INCLUDED_PRODUCT` ×2/ciclo).

---

## 7. Evidencia

```
preview (solo carajillo 185)        → final 0 · covered true
preview (carajillo + papas 330)     → final 145 · covered false
checkout MEMBERSHIP total 0         → orden COMPLETED, pago MEMBERSHIP=0, uso 1
MEMBERSHIP con total 145            → 400 MEMBERSHIP_REQUIRES_ZERO_TOTAL
MEMBERSHIP sin beneficio            → 400 MEMBERSHIP_REQUIRES_BENEFIT
7 tests de computeBenefitPlan       → en verde
```

Archivos: `services/membershipBenefits.ts`, `routers/memberships.ts`,
`routers/pos.ts`, `apps/admin/src/app/(pos)/pos/page.tsx`.
