# ADR-027 · Cobro en Bunz desde el escáner del negocio

**Estado:** implementado (14-nov-2026)
**Complementa:** ADR-025 (comandero) — no lo sustituye.

---

## 1. Decisión

El dueño/encargado puede **cobrar Bunz** desde el escáner que ya existe en su app
(`/business/scan`), con un conmutador:

```
[ Dar Bunz ]  [ Cobrar Bunz ]
```

- **Dar Bunz** = recompensa (ya existía).
- **Cobrar Bunz** = consumo: descuenta saldo del Rabbitter.

---

## 2. Por qué no es una vía paralela

El cobro **crea una orden real** en `orders` (tipo `TO_GO`, estado `PENDING` →
`COMPLETED`) y usa el **motor canónico** (`paymentCore`: reserva, saldo,
capacidad del afiliado, libro y comprobante). Por tanto:

- aparece en el POS, en los turnos y en los reportes;
- suma al mismo ledger de Bunz;
- si falla, no marca nada como cobrado.

No se crean líneas de platillo: es un cobro de mostrador, no una comanda, así
que no toca inventario ni la cola de cocina.

---

## 3. Controles

| Control | Por qué |
|---|---|
| **Solo el dueño** (`ownedBusinesses.ownerId`) | no cualquier staff cobra desde su app |
| **Aprobación del cliente** en su app (`pos_charge_requests`) | el Rabbitter autoriza el cargo antes de que se capture |
| **Geocerca de 300 m** | el cobro solo se origina cerca del negocio |
| **Wi-Fi** (bloqueo si el navegador informa datos móviles) | misma regla que el comandero |
| **Tope de 5,000 MXN** por operación | limita un error de tecleo o abuso |
| **Caducidad de 5 min** | una solicitud vieja no se captura |

La geocerca y el Wi-Fi son disuasión: el control real es la **aprobación del
cliente**, que ocurre en su propio dispositivo.

---

## 4. Flujo

```
dueño escanea QR del Rabbitter
        ↓
monto → POST /api/business/scan/charge
        ├─ crea order (PENDING) + pos_charge_requests (PENDING)
        └─ notifica al cliente (/pay/confirm/<requestId>)
        ↓
cliente aprueba en su app
        ↓
la app del dueño sondea POST /api/business/scan/charge/settle
        ├─ APPROVED → paymentCore captura
        ├─ marca CHARGED y la orden COMPLETED
        └─ devuelve saldo restante
```

---

## 5. Por qué el comandero no lo reemplaza

El comandero es del **mesero** y por diseño **no cobra** (un `COMANDERO` no
puede llamar `directCheckout`). Mantener esa separación es lo que evita que un
mesero cierre cuentas sin pasar por caja.

Tres superficies, tres momentos:

| Superficie | Para qué |
|---|---|
| Comandero | levantar el pedido en mesa |
| POS / caja | cobrar cualquier método |
| Escáner del dueño | cobro rápido Bunz en mostrador |

---

## 6. Alternativa recomendada para el cliente

Que **el cliente pague desde su app** escaneando el QR del negocio o de la mesa
(ya existe con `/pay/...`). Cero fricción, sin aprobación de ida y vuelta y sin
dispositivo extra. El cobro desde el escáner cubre el caso en que el cliente no
puede o no quiere usar su app en ese momento.
