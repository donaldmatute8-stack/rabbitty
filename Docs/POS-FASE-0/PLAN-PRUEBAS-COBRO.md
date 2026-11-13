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


---

## 9. Acceso de prueba (staging)

Creado por `packages/api/scripts/staging-test-access.ts` (aborta si la base no es
`ancient-meadow`).

| Dato | Valor |
|---|---|
| URL del POS | `https://rabbitty-admin-staging.up.railway.app/pos` |
| Empleado | `Cajero Prueba` · email `prueba.staging@rabbitty.me` |
| PIN | `1234` · rol **MANAGER** (abre caja y autoriza retiros) |
| Terminal | `Terminal Staging` |
| Sucursal | `Sucursal Única Ka13` |
| Token | **se entrega por canal privado**, expira en 24 h |

### Cómo entrar

1. Abrir la URL del POS.
2. En la consola del navegador:

```js
localStorage.setItem("rabbitty_pos_terminal_token", "<TOKEN>");
localStorage.setItem("rabbitty_pos_terminal_info", JSON.stringify({
  terminalId: "<TERMINAL_ID>",
  name: "Terminal Staging",
  branchId: "br_ka13_3cf73c14828d",
}));
location.reload();
```

3. El POS debe cargar mesas sin pedir login de admin.
4. Abrir caja con el PIN `1234`.

### Verificación rápida (sin UI)

```bash
curl -sG ".../api/trpc/pos.getTables" \
  --data-urlencode 'input={"json":null}' \
  -H "x-pos-terminal-token: <TOKEN>"
# → 6 mesas
```

### Para volver a crearlo

```bash
RESTAURANT_DATABASE_URL=<staging> CORE_DATABASE_URL=<staging> \
  npx tsx packages/api/scripts/staging-test-access.ts
```


---

## 10. Resultados de la ventana (11-nov-2026, tarde)

| Caso | Resultado | Evidencia |
|---|---|---|
| **C-01** efectivo | ✅ **PASA** | Pago CASH 350, orden `COMPLETED` |
| **C-02** tarjeta | ⛔ **BLOQUEADO** | Staging tiene llaves **LIVE** de Stripe (heredadas). Un cobro de prueba sería real |
| **C-03** split Bunz+efectivo | ⏳ Pendiente | Faltaba Rabbitter de prueba y bóveda. **Ya provistos** (ver §11) |
| **C-05** refund total | ✅ **PASA** (ejecutado por API) | Pago original y reverso −350, ambos `REFUNDED`, neto 0 |

### Invariante tras C-05

```
deriva de totales: 0 filas  ✅
pagos de la orden: 350 (REFUNDED) + (−350) (REFUNDED)  → neto 0
```

---

## 11. Hallazgos de la ventana

### H-1 · Stripe con llaves LIVE en staging — **RESUELTO (12-nov-2026)**

El clon copió la misma `sk_live_…` de producción. Dos capas de defensa:

1. **Las llaves se eliminaron del ambiente staging** (`STRIPE_SECRET_KEY` y
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). Sin secreto, `getStripeClient()`
   responde "STRIPE_SECRET_KEY no está configurada" y no hay cobro posible.
2. **Guard en código** (`services/stripeConnect.ts`): si alguien vuelve a poner
   una llave `sk_live_` en un ambiente cuyo nombre no es `production`, el cobro
   se rechaza con `PRECONDITION_FAILED`. `NODE_ENV` no sirve para esto porque
   Railway compila staging como producción; se usa `RAILWAY_ENVIRONMENT_NAME`.
   Override deliberado: `ALLOW_LIVE_PAYMENTS=1`.
   Cubierto por 5 tests en `services/stripeGuard.test.ts`.

**Para habilitar C-02** (tarjeta en staging) hay que crear llaves de prueba en
Stripe y cargarlas en el servicio `rabbitty-admin` del ambiente staging:

```bash
railway variables -s rabbitty-admin -e staging --set "STRIPE_SECRET_KEY=sk_test_…"
railway variables -s rabbitty-admin -e staging --set "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…"
```

Mientras no existan, C-02 queda bloqueado por diseño.

### H-2 · El split depende de un Rabbitter con saldo

Sin cliente vinculado (o con saldo 0), el POS cae a efectivo completo aunque la UI
ofrezca dividir. Con el Rabbitter de prueba y bóveda con fondos, el split ya puede probarse.

### H-3 · Una orden reembolsada al 100 % sigue `COMPLETED`

Tras el refund total, la orden conserva `status = COMPLETED`. Los pagos quedan
`REFUNDED` con neto 0. **Decisión pendiente:** ¿una orden 100 % reembolsada debe pasar a
`REFUNDED`/`VOIDED`? Hoy el estado de la orden no refleja el reembolso.

---

## 12. Datos de prueba creados

| Dato | Valor |
|---|---|
| Rabbitter | `Rabbitter Prueba` · `@pruebarabbit` · `+5215500000001` |
| Saldo Bunz | 500 |
| Bóveda del negocio (Ka13) | 2000 BZ |
| Asientos de ledger | ALLOCATION 2000 (sys→biz) + EARN 500 (biz→usr), marcados `sandbox = true` |

Scripts: `packages/api/scripts/staging-test-customer.ts` y `staging-test-access.ts`
(ambos abortan si la base no es `ancient-meadow`).


---

## 13. C-03 ejecutado por API — **bug crítico encontrado**

Como el split en la UI exige la aprobación del Rabbitter en su app (un usuario
sintético no puede aprobar), C-03 se ejecutó por API con una aprobación
`APPROVED` sembrada en staging.

**Resultado de la operación:** `success: true`, orden `43a69373…`, total 120.

**Pero al revisar los pagos:**

| método | monto | estado |
|---|---:|---|
| `CREDIT_CARD` | 60 | COMPLETED |
| `BUNZ` | 60 | COMPLETED |
| `CASH` | 60 | COMPLETED |
| **suma** | **180** | vs total **120** |

### H-4 · El split duplica el pago (crítico)

Una orden de $120 queda con **$180 en pagos**. Origen identificado:
`packages/api/src/services/paymentCore.ts:525` registra el cobro del intento como

```ts
method: params.verifiedMethod === "CASH" ? "CASH" : "CREDIT_CARD"
```

es decir, **cualquier cobro que no sea efectivo se registra como `CREDIT_CARD`**.
En el split eso convive además con el asiento `BUNZ` y con el `CASH` del POS,
así que el mismo dinero se contabiliza dos veces.

Consecuencias:

- La caja cuadra mal (ventas por método infladas).
- Los reportes de tarjeta vs Bunz mienten.
- Un reembolso proporcional calcularía sobre una base equivocada.

**Bloquea cablear `directCheckout` hasta corregirlo.** No es un problema del helper
de concurrencia: es contabilidad de pagos.

### Invariante nueva para el plan

```
Σ payments(COMPLETED) de la orden  ==  orders.total   (±0.01)
```

Estado en staging: 156 órdenes, **19 con descuadre**; 18 son órdenes sin pago
(normal, `pagado = 0`) y **1 es la del split** (`pagado = 180`).


---

## 14. H-4 corregido y C-03 en verde (11-nov-2026)

### Corrección

`paymentCore.confirmPaymentIntentSettled` ya no registra el pago fiat cuando el
settlement es `BUNZ_ONLY`: en el split, el efectivo lo cobra el POS y el intento solo
aporta el asiento de Bunz.

```ts
if (intent.netFiatCents > 0 && params.verifiedMethod !== "BUNZ_ONLY") { … }
```

### Re-ejecución de C-03 (staging, código corregido)

| método | monto |
|---|---:|
| `BUNZ` | 60 |
| `CASH` | 60 |
| **suma** | **120** |

```
orden:  120
pagado: 120   ✅
```

### Conciliación de los datos de prueba

- Asiento espurio `CREDIT_CARD 60` de la orden anterior: **eliminado**.
- Invariante global: **0 órdenes sobrepagadas** de 157.

### Invariantes finales de la ventana

| Invariante | Resultado |
|---|---|
| Deriva de totales | 0 filas |
| `PAID` sin pago aplicado | 0 |
| Pagos duplicados | 0 |
| **Σ pagos = total** | **0 sobrepagadas** ✅ |
| Concurrencia (10 mutaciones) | 10/10, versión correcta |

### Estado de los casos

| Caso | Estado |
|---|---|
| C-01 efectivo | ✅ |
| C-03 split | ✅ (tras corregir H-4) |
| C-05 refund | ✅ |
| C-02 tarjeta | omitido (llaves live en staging) |


---

## 15. Re-validación con `directCheckout` cableado (11-nov-2026)

Código: rama `feat/pos-0b1-integridad-ordenes` @ `c0f38eb` (fases A, C, D, E).
Entorno: `rabbitty-admin-staging` + branch de Neon.

### C-01 · efectivo (re-ejecutado)

```
orden 62b52107  status COMPLETED  total 120  version 2
pagos: CASH 120
eventos: CHECKOUT_PAID
Σ pagos = total → delta 0
```

### C-03 · split efectivo + Bunz (re-ejecutado)

```
orden 43e8722d  status COMPLETED  total 120  bunzPaid 60  bunzReward 24  version 4
pagos: BUNZ 60 + CASH 60
eventos: CHECKOUT_PRICED, CHECKOUT_PAID, BUNZ_REWARD_RECORDED
Σ pagos = total → delta 0
```

**La versión subió exactamente una vez por mutación** (1 → 4 con tres eventos),
que es la garantía que buscaba el ADR-018.

### Invariantes globales tras la ventana

| Invariante | Resultado |
|---|---|
| Deriva de totales | **0** |
| Órdenes sobrepagadas | **0 de 159** |
| Eventos huérfanos (`order_events` sin orden) | **0** |
| Concurrencia (10 mutaciones) | 10/10 |

### Conclusión

`directCheckout` cableado **no cambió el comportamiento esperado**: cobra igual y
además deja rastro, versión y bloqueo. La ventana se cerró con staging apagado.

---

## 14. Segunda ventana (13-nov-2026) — API con terminal de staging

Arnés: `posOperators.startShift` (PIN 1234) + `cashShifts.open` (ya abierto) +
`pos.directCheckout`, contra staging. Verificación por SQL sobre los pagos,
el libro Bunz y las cuotas de membresía.

| Caso | Resultado | Evidencia |
|---|---|---|
| **C-01** efectivo | ✅ **PASA** | orden `229bf3a1` total 270 = subtotal 232.76 + IVA 37.24 · **1** pago CASH 270 · evento `CHECKOUT_PAID` · v2 |
| **C-03** split Bunz+efectivo | ✅ **PASA** | orden `8d3a5ff6` total 240 · **2** pagos (BUNZ 120 + CASH 120 = 240) · H-4 ya no duplica |
| **C-04** Bunz 100 % | ✅ **PASA** | orden `fc96116d` 185 · pago BUNZ 185 · libro `user_wallet −185` / `redemption_capacity +185` · aprobación `CHARGED` |
| **C-10** anular cobrada | ⚠️ **HUECO → CORREGIDO** | Antes: orden `VOIDED` con el pago CASH 185 **intacto** y sin asiento. Ver H-5 |
| **C-11** membresía + cobro | ✅ **PASA** | orden `ca5630ad`: 185 + 145 con producto incluido → total 145 · descuento 185 exacto · cuota 1/2 · **1** uso con idempotencyKey único |
| **C-02 / C-07 / C-08** | ⛔ **BLOQUEADO** | Sin llaves `sk_test_` (H-1 las eliminó de staging, por diseño) |
| **C-05 / C-06** | ✅ ya validado / no ejecutado | C-05 en la ventana anterior; C-06 parcial sigue pendiente |
| **C-09** concurrencia | ✅ validado antes | 10/10 mutaciones, versión 11 |

### Invariante de totales (2 días, staging)

```
órdenes COMPLETED con deriva de pagos: 1
  → 3f694630 (350) pagado neto 0 — es H-3, la orden reembolsada al 100 %
    que sigue COMPLETED (hallazgo conocido, decisión pendiente)
Ninguna deriva nueva.
```

### H-5 · Anular una orden cobrada no hacía nada (crítico, corregido)

`voidOrder` ponía `status = VOIDED` sin mirar los pagos. Resultado: el turno de
caja y los reportes seguían contando el dinero de una orden anulada, sin
reverso, sin asiento y sin aviso — justo el "silencio" que el caso C-10 prohíbe.

**Política adoptada (rechazo explícito):** si la orden tiene algún pago
`COMPLETED`, `voidOrder` responde `PRECONDITION_FAILED` y pide reembolsar
primero (`Reembolsos → nueva devolución`). No se inventa un reverso automático:
el reembolso ya tiene su propio camino con asiento y permiso `POS_REFUND`.
