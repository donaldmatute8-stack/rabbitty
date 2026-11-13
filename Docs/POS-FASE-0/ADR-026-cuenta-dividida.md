# ADR-026 · Cuenta dividida en dos formas de pago

**Estado:** implementado (13-nov-2026)
**Reemplaza:** el split fijo “efectivo + Bunz”.

---

## 1. Decisión

Una cuenta puede cobrarse con **exactamente dos formas de pago distintas** sobre
la misma orden: efectivo + tarjeta, tarjeta + Bunz, efectivo + Bunz, etc.

La UI deja de llamarse “Dividida” para describir un par fijo: ahora el cajero
**elige los dos métodos y cuánto va en cada uno**.

---

## 2. API

`pos.directCheckout` acepta:

```ts
splitPayments: [
  { method: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "BUNZ", amount, reference? },
  { … }
]   // exactamente 2
```

Reglas del servidor:

| Regla | Motivo |
|---|---|
| exactamente 2 patas, cada una > 0 | el concepto es “dos formas”, no N |
| suma == total (±0.01) | nunca se cobra de más ni de menos |
| máximo una pata Bunz | el motor canónico captura una sola redención |
| pata Bunz exige Rabbitter vinculado | sin cliente no hay saldo que debitar |
| pata tarjeta exige referencia de terminal | P0-3: no se registra tarjeta sin autorización |
| sin descuento ni membresía | ya existía; evita ambigüedad de base |
| propina solo en la primera pata | no se duplica el asiento |

Compatibilidad: `splitCash` + `splitBunz` siguen funcionando y se traducen a las
dos patas equivalentes.

---

## 3. Ejecución

1. La pata Bunz (si existe) se captura con el motor canónico
   (`createOrGetPaymentIntent` + `confirmPaymentIntentSettled`), que reserva
   saldo, valida capacidad del afiliado y escribe el libro.
2. Las demás patas se insertan como pagos `COMPLETED` con su método y
   referencia.
3. La invariante de cierre exige que la suma de pagos `COMPLETED` cubra el
   total; si no, la orden no se marca `COMPLETED`.

---

## 4. UI

En el selector de método → **Dividida**:

- dos selectores (Efectivo / Tarjeta terminal / Bunz),
- monto de la primera pata (la segunda se calcula),
- referencia de terminal si alguna pata es tarjeta,
- aviso si falta vincular al Rabbitter para la pata Bunz.

El botón sigue pasando por la **confirmación del Rabbitter** cuando hay cliente
(el monto autorizado es el total).

---

## 5. Límites

- Dos patas, no tres. Si el negocio necesita tres, es otra decisión (la
  invariante y la UI cambian).
- No se divide una cuenta con membresía aplicada ni con descuento manual.
- La propina va completa en la primera pata; no se reparte.
