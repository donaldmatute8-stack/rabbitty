# Comisión de plataforma (marketplace)

> Distinta del **1 % por uso del riel**. Ese excedente (`payment_intents.platformFeeCents`)
> cubre el costo de cobrar con un método de pago (Stripe/terminal). Esta comisión es
> el ingreso de Rabbitty por traer al cliente.

## Reglas implementadas

| Regla | Por qué |
|---|---|
| **Bunz nunca paga comisión** | Si el cliente paga con Bunz, Rabbitty ya ganó con la membresía/pozo. Cobrar otra vez castiga el riel que queremos que crezca. |
| Base = **total − parte pagada con Bunz** | Un pedido 40 % Bunz paga comisión solo sobre el 60 % en dinero. |
| **`APP_ORDERS` por defecto** | Solo pedidos que llegan por la app. La venta de mostrador no paga: el comercio no ganó nada por nosotros ahí y cobrarla es lo que rompe la adopción. |
| **Apagada por defecto** | `enabled: false`. Nada se cobra hasta que el negocio la acepte (va en el contrato). |
| **Tarifa congelada en la orden** | `orders.commissionPct` / `commissionCents` guardan la foto. Cambiar el % después no reescribe historial ni liquidaciones. |

## Dónde se calcula

`packages/api/src/services/platformCommission.ts` → `computePlatformCommission()`.

Se invoca en los **dos puntos donde se cierra una venta**:

1. **App** (`/api/pos/checkout`) al crear el pedido: `fromApp = true`.
2. **POS** (`pos.processPayment`) al completar: `fromApp = Boolean(order.customerId)` —
   así el pedido que nació en la app y se pagó en caja con efectivo **sí** genera
   comisión, y la venta de mostrador a un cliente nuevo **no**.

Nunca puede tumbar un cobro: si el cálculo falla, el pago sigue y solo se registra
un aviso.

## Dónde se configura y se ve

- **Admin → God · Comisión de plataforma** (`/god/comisiones`): **único lugar donde
  se edita** (activar, %, alcance y mínimo por negocio). Es ingreso de Rabbitty: si
  viviera en el panel del comercio, el afiliado podría ponerla en 0.
- **Admin → Tienda & Envíos** (comercio): la misma tarjeta pero **solo lectura**
  (tarifa vigente, comisión de 30 días, del mes y ventas gravadas) para que sepa
  qué paga.
- **Admin → Dinero (hub)**: tarjeta *Comisión plataforma (30 d)* junto a ventas.
- **Conciliación de pagos**: el 1 % del riel sigue separado (`platformFeeMxn`).

## Cifras de referencia (para elegir el %)

| Modelo | Qué cobra | Comisión |
|---|---|---|
| Amazon / eBay / Mercado Libre | marketplace con logística | **8–16 %** |
| Rappi / Uber Eats | entrega a domicilio | **20–30 %** |
| Toast / Square / Mercado Pago Point | POS + cobro, sin demanda | **0 % comisión** (+2.5–3.6 % del riel) |
| Snackpass / Ritual (descubrimiento local) | pedidos hechos por la app | **~5–10 %** |

Rabbitty no entrega ni aloja el catálogo como Amazon: aporta **demanda** (Bunz,
proximidad, mood, descubrimiento). Un número defendible y competitivo es
**2–3 % solo en pedidos de la app**, con Bunz exento. Con el riel de tarjeta (1 %)
el costo total del comercio queda en **3–4 % en tarjeta** y **2–3 % en efectivo** —
muy por debajo de una app de delivery y alineado con un POS moderno.

**Tarifa de la casa: `3.8 %`** (`pct = 0.038`) sobre pedidos de la app, Bunz exento,
sin mínimo por venta. El 8 es el número simbólico de Rabbitty; queda alineado con
la banda 2–4 % que hace competitivo el modelo frente a delivery (20–30 %) y por
encima del POS puro (0 %).

## Lo que falta para cobrarla de verdad

1. **Activarla por negocio** en **God → Comisión de plataforma** (hoy apagada).
   El sistema **exige** que el negocio haya aceptado el Anexo de Pagos en la
   versión vigente (`/legal/payments`): sin aceptación, la activación falla.
2. **Contrato**: publicado el **Anexo de Pagos** (3.8 %, Bunz exento, solo pedidos
   de la app) en `/legal/payments` y en `Docs/LEGAL/02-ANEXO-PAGOS.md`, con
   versión de aceptación `2026-11-19`. Falta la revisión del abogado sobre el
   texto (puntos `[REVISAR]` del corpus) antes de darlo por definitivo.
3. **Tarjeta**: sumar la comisión al `application_fee_amount` de Stripe Connect
   (hoy ese monto solo lleva el 1 % del riel) para retenerla en el split.
4. **Efectivo**: acumularla como cuenta por cobrar y liquidarla en el corte mensual
   (el campo ya queda por orden para sumarla).
5. **Factura**: definir si se emite CFDI de la comisión (hoy no se timbra).
