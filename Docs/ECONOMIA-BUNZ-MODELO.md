# MODELO ECONÓMICO BUNZ — v2 (NORMATIVA)

> **Estado:** 🟡 **Modelo conceptual APROBADO** (Marco + asesor, 2026-11-02) ·
> **Correspondencia de implementación PENDIENTE de verificación** (auditoría H17-doc +
> `Docs/ECONOMIA-BUNZ-AUDIT-H17.md`).
> Este documento es la referencia normativa para cualquier cambio en Bunz (ledger, setters,
> settle, migración a blockchain). NO es una garantía probada hasta que la auditoría de
> correspondencia demuestre cada invariante. Dictamen del asesor incorporado 1:1.

---

## 0. Definición normativa de `bunzBalance`

> **`ownedBusinesses.bunzBalance` = capacidad de redención RESPALDADA y DISPONIBLE del
> afiliado.** No son los Bunz que el afiliado posee, ni los Bunz en circulación, ni un
> registro de claims.

Cada incremento debe tener **origen económico identificable**:

| Operación | ¿Incrementa disponibilidad? | Respaldo que la autoriza |
|---|---|---|
| Reward por consumo fiat | Sí, si la regla de recompensa autoriza esa capacidad | Transacción fiat elegible + obligación de recompensa asociada |
| Claim de inventory-backed vault | Sí | Inventario previamente comprometido |
| Refill manual | Solo si está autorizado y respaldado | Fuente documentada y aprobada (actor + motivo) |
| Redención | **No — consume disponibilidad** | La oferta se cumple |
| Pago de fee | Según la naturaleza REAL del fee | ⚠️ No debe confundirse automáticamente con una redención (auditar) |

## 1. Terminología de estados (la que usaremos en docs, specs y blockchain)

| Estado/concepto | Significado | Dónde vive hoy |
|---|---|---|
| `PENDING` | Bunz autorizados/preparados para reclamo, NO circulantes | `pendingVaults.status = 'PENDING'` |
| `CLAIMED` | Bunz acreditados efectivamente al Rabbitter | `pendingVaults = 'CLAIMED'` + ledger EARN |
| `CIRCULATING` | Bunz en cuentas de Rabbitters | proyección de ledger (users como acumulador) |
| `BACKING_AVAILABLE` | Capacidad de redención no consumida | `ownedBusinesses.bunzBalance` |
| `BACKING_CONSUMED` | Respaldo ya cumplido por redención | ledger SPEND del/business + bunzBalance decrements |

Un claim **puede** aumentar circulación y (según regla del negocio) la disponibilidad de
redención — pero son **dos efectos contables distintos**. `bunzBalance` NO es el registro
de los Bunz reclamados.

## 2. Fuente de verdad = LEDGER

`users.totalBunzEarned/Spent` son **proyecciones/acumuladores de lectura rápida**, NO la
autoridad económica. El settledo conceptual:

```
Saldo Rabbitter = Σ Créditos válidos (ledger) − Σ Débitos válidos (ledger)
```

Los contadores deben **reconciliarse contra el ledger** (D-17). Especialmente crítico
antes de blockchain.

## 3. Invariantes no negociables (normativa final de la revisión)

| Invariante | Garantía |
|---|---|
| No emitir sin origen económico válido | Toda emisión asociada a transacción fiat elegible o inventario previamente comprometido y autorizado |
| No comprometer dos veces el mismo inventario | Reservas cuantificables, identificables y **atómicas** (la revisión humana NO sustituye el control transaccional) |
| Separar PENDING de CLAIMED | Pendientes de reclamo no forman parte de la circulación |
| Separar circulación de disponibilidad de redención | `users` = saldos de Rabbitters; `bunzBalance` = capacidad de redención respaldada disponible del negocio |
| No redimir sin disponibilidad suficiente | Disponibilidad verificada y consumida **atómicamente** en la misma operación económica |
| No consumir dos veces el mismo respaldo | Cada redención vinculada a reserva/capacidad concreta, con idempotencia y control de concurrencia |
| No crear Bunz por redención | La redención debita Bunz del Rabbitter y consume respaldo del Affiliate. Sin créditos de Bunz |
| No generar cashback por pagos con Bunz | D-10: sin componente fiat elegible ⇒ sin recompensa fiat |
| No alterar el ledger retroactivamente | Correcciones mediante movimientos compensatorios vinculados al original |
| No liberar respaldo comprometido arbitrariamente | El respaldo de Bunz ya reclamados permanece exigible hasta su redención o resolución válida |
| Toda modificación auditable | Emisiones, claims, reservas, redenciones, liberaciones, reversas y ajustes conservan origen, actor, fecha, motivo e idempotencia |

**Regla de concurrencia (normativa):** ningún control basado exclusivamente en
`GREATEST(0)`, validaciones previas en aplicación o revisión administrativa constituye
garantía suficiente. La autorización y el consumo del respaldo se ejecutan mediante
**operaciones atómicas de base de datos**:

```sql
UPDATE ownedBusinesses
SET bunzBalance = bunzBalance − :amount
WHERE id = :businessId
  AND bunzBalance >= :amount
RETURNING bunz_balance;
```
Sin fila devuelta ⇒ la redención **no puede completarse**. `GREATEST(0)` queda como
protección secundaria de escritura, no como regla económica. La transacción debe ser
atómica entre: débito del Rabbitter + ledger + reducción del respaldo + idempotencia
por operación.

### 3.1 Estado de aplicación del patrón (2026-11-03 — D-13 CERRADA en código)

El patrón ya no es una intención: está aplicado en los **cinco puntos de dinero** que
tocaban `bunzBalance` o el saldo del Rabbitter. En todos, la condición vive en el `WHERE`
y la ausencia de fila devuelta lanza un error que **revierte la transacción completa**:

| Punto | Archivo | Operación | Error al no haber disponibilidad |
|---|---|---|---|
| **W7** | `packages/api/src/services/paymentIntentDomain.ts` | Consumo de respaldo al liquidar un cobro con Bunz (fuera de `if (intent.orderId)`, cubre también bill-bunz-pay) | `BUNZ_BACKING_INSUFFICIENT` (si el negocio no se resuelve: `BUNZ_BACKING_UNRESOLVED`) |
| **U2/U10** | `packages/api/src/services/paymentIntentDomain.ts` | Débito de `totalBunzSpent` del Rabbitter al liquidar | `LEDGER_INSUFFICIENT_FUNDS` |
| **W6** | `telegram-miniapp/src/app/api/business/scan/redeem/route.ts` | Redención en local (canje escaneado) | `BUSINESS_BACKING_INSUFFICIENT` → HTTP 409 "Tus Bunz siguen intactos" |
| **W5** | `telegram-miniapp/src/app/api/business/pay-fee/route.ts` | Fee de alta del afiliado | `INSUFFICIENT_BUNZ_BALANCE` (se eliminó el check-then-act previo) |
| **U2** | `packages/api/src/services/paymentCore.ts` | Hold de Bunz al crear el intent (reserva) | `BUNZ_RESERVE_INSUFFICIENT_FUNDS` |
| **U8** | `telegram-miniapp/src/app/api/reservations/route.ts` | Débito por reserva de oferta | `INSUFFICIENT_BUNZ` |

Notas de implementación:
- Los errores de respaldo del afiliado se mapean a `TRPCError` legibles en
  `packages/api/src/routers/payments.ts` (`approveIntent`) — una regla económica no debe
  salir como 500 opaco.
- `GREATEST(0)` **permanece** en las expresiones de escritura, pero ya no decide nada:
  es cinturón de seguridad, no la regla.
- Lo que **sigue abierto** no es código sino **conciliación histórica** (D-14/D-17): los
  saldos actuales en prod (Bull Box 5000, 626 Café 3550, Ka13 37) incluyen efectos de la
  época en que la redención acreditaba en vez de consumir.

## 4. Pago mixto — contabilidad de la factura

PaymentIntent/factura debe **mantener separados** en su registro (los estados de
`payments` ya distinguen método; agregar detalles audibles en la fase H-pills):

- Importe fiat
- Importe cubierto por Bunz
- Cantidad de Bunz debitados
- Respaldo consumido (por negocio)
- Recompensa fiat eventualmente generada

Elnorme ejemplo NO implica que 300 Bunz se conviertan en $300 MXN para el Affiliate:
la regla de valoración/elegibilidad define la parte cubierta por redención, y el cashback
(fiat) se calcula **solo** sobre la parte fiat elegible según D-10/reglas vigentes.
Una misma operación **jamás** genera doble recompensa.

## 5. Mapa de writers — requisitos de demostración

Cada writer que incrementa `ownedBusinesses.bunzBalance` debe demostrar **qué capacidad
de redención incorpora y qué respaldo la autoriza**; un retry no debe volver a sumar.
Detalle por writer en `Docs/ECONOMIA-BUNZ-AUDIT-H17.md` (veredictos por ruta).

**Estado 2026-11-03:** los writers de **consumo** (W5, W6, W7, U2, U8, U10) ya cumplen el
patrón §3, y el writer de **refill administrativo** (W4) ya exige motivo, actor y asiento
de ledger `MINT` — un incremento de respaldo ya no puede ocurrir sin fuente documentada.
Lo que falta para declarar el mapa completo es la **metadata de origen** en los writers de
**incremento automático** (W1/W2/W3: venta fiat o inventario comprometido) — es el insumo
de D-17, no un cambio de código pendiente de dinero.

## 6..Future — Tesorería de afiliados y blockchain

La arquitectura conceptual **permite** la tesorería después, con precisiones:
- El ledger incorporará **cuenta/subledger específica** para la tesorería.
- Las **transferencias entre afiliados tienen reglas distintas de la redención**.
- **NO reutilizar** `ownedBusinesses.bunzBalance` como tesorería.
- **NO alterar** el significado de EARN, SPEND, CLAIMED o BACKING.

Pre-blockchain, el ledger interno debe poder responder: de dónde salió cada Bunz
(fiatsale o inventory-backed), cuándo entró en circulación, qué respaldo lo autorizó,
dónde se redimió, qué inventario se consumió y qué saldo permanece en circulación.
Blockchain = capa de registro/verificación de eventos, no cambio económico.

## 7. Pendientes de cierre (con criterio de éxito)

| ID | Pendiente | Qué debe demostrar el cierre |
|---|---|---|
| D-14 | Normalización histórica de `bunzBalance` | Reporte por negocio, reconstrucción de movimientos, diferencias detectadas, aprobación y plan de corrección reversible |
| D-15 | Catalogar bot claim | Recorrido completo vault→acreditación→disponibilidad, incluyendo reintentos |
| D-16 | Productos respaldados no cash-backed | Estados de reserva, reclamación, vencimiento, cancelación y liberación del inventario |
| **D-17** | **Conciliación integral de circulación y respaldo** | Comparación de: emitidos, reclamados, gastados, en cuentas de Rabbitters, respaldo disponible por Affiliate, respaldo consumido por redención, diferencias históricas y ajustes (conciliación **por origen y derecho de redención** — no sumas simples entre dimensiones) |
