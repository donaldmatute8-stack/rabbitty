# ADR-016 · Rabbit Chair (La Silla) — Fase 0/1

| | |
|---|---|
| Estado | **Aceptado e implementado (backend)** |
| Fecha | 2026-11-25 |
| Alcance | Activación, cupo, hold, créditos, cronómetro y cierre |
| Fuera de alcance | Cobro real, orden/POS UI, app, push, fecha aleatoria, lista de espera |

---

## 1. Contexto

Rabbit Chair ya tenía landing privada, token firmado, solicitudes y aprobación
en God. Faltaba el núcleo que hace real la experiencia: abrir una silla, tomar
un lugar sin sobreventa, cobrar (fase 2), servir y cerrar.

El plan original (`DOCS/CONCEPTOS/RABBIT-CHAIR-FASE-1-BUILD.md`) proponía
`0033_rabbit_chair.sql`. Ese número ya estaba ocupado; la migración real es
**`0058_rabbit_chair.sql`**.

## 2. Decisiones

### 2.1 Producto

| # | Decisión |
|---|---|
| 1 | **Cobro:** Stripe para la app y terminal física del POS en fase 2. |
| 2 | **Momento del cobro:** el tenant elige `PREPAID` (app, al tomar el lugar) o `POSTPAID` (aporte abierto al final, en POS/terminal/QR). |
| 3 | **Cupo:** el tenant elige la experiencia. `SINGLE` (1 por turbo), `BLOCK` (varios a la vez), `WAVES` (oleadas, campo `waveMinutes`), `COUPLES` (parejas, `partySize = 2`). |
| 4 | **Créditos:** 3 activaciones por hito, con vencimiento y consumo atómico. Se pueden revocar y se devuelven si el borrador se cancela. |
| 5 | **Edad:** si la carta incluye alcohol (`ALCOHOL` o `BOTH`), `requiresAgeCheck` se fuerza a `true`. |
| 6 | **Drop:** miembros/lista de espera, iOS-first, pase con QR de membresía (fase 3). |
| 7 | **Datos:** activaciones y créditos en restaurant DB; solicitudes/tokens en core DB. |

### 2.2 Desviación consciente: los grants viven en restaurant DB

La propuesta inicial era core DB para los grants. Se movieron a **restaurant
DB** porque consumir el crédito y crear la activación deben ser **una sola
transacción**. Con bases separadas habría que compensar a mano si falla la
segunda escritura, justo el tipo de inconsistencia que este proyecto evita.

Las solicitudes (`rabbit_chair_requests`) y los tokens siguen en core DB.

## 3. Modelo

### `rabbitChairGrants`

Créditos por negocio: `creditsTotal`, `creditsUsed`, `expiresAt`, `revokedAt`,
`requestId` (único cuando viene de una aprobación).

### `rabbitChairGrantUses`

Una fila por activación que consumió crédito (`activationId` único). Es la
prueba de consumo y permite devolver el crédito al cancelar un borrador.

### `rabbitChairActivations`

`status` (`DRAFT | LIVE | SOLD_OUT | DONE | CANCELLED`), `format`, `capacity`,
`partySize`, `chargeMode`, `minContributionCents`, `durationMinutes`,
`menuMode`, `requiresAgeCheck`, ventana aleatoria, música/luz/bartender.

Índice único parcial: **una sola activación `LIVE` por sucursal**.

### `rabbitChairSlots`

`status` (`FREE | HELD | PAID | SEATED | SERVED | DONE | EXPIRED`),
`paymentStatus` (`UNPAID | AUTHORIZED | PAID | REFUNDED`), `heldUntil`,
`servedAt`, `endsAt`, `paymentRef` único.

## 4. Cómo se mitigan los riesgos

| Riesgo | Mitigación implementada |
|---|---|
| **Sobreventa** | `claim` usa `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)`; dos claims simultáneos dejan uno solo. Test dedicado. |
| **Doble cobro** | `paymentRef` único + checkout idempotente: repetir la misma referencia devuelve el mismo lugar. |
| **Créditos fantasma** | Consumo y creación en la misma transacción; `activationId` único; cancelar borrador devuelve el crédito una sola vez. |
| **Cronómetro** | `servedAt`/`endsAt` en servidor; `serve` idempotente no reinicia el tiempo; holds y `SERVED` vencidos se resuelven en lectura (sin cron). |
| **Dos drops en la misma barra** | Índice único parcial de `LIVE` por sucursal. |
| **Menores con alcohol** | `requiresAgeCheck` forzado cuando `menuMode` incluye alcohol. |
| **Cobro real accidental** | `RABBIT_CHAIR_PAYMENTS=live` bloquea el checkout sandbox con `PRECONDITION_FAILED`. |
| **Scope creep** | Pagos, orden, POS UI, app, push y fecha aleatoria quedan explícitamente en fase 2/3. |

## 5. Contrato de fase 2

`checkoutSandbox` ya valida monto mínimo, `chargeMode`, titular del hold y
marca `PAID` con `paymentRef`. En fase 2 solo se sustituye el marcado por:

1. crear payment intent / cobro en terminal,
2. confirmar el webhook o la respuesta del terminal,
3. llamar al mismo cierre con la referencia del proveedor.

La orden `channel = 'RABBIT_CHAIR'` y el ítem placeholder se agregan en fase 2
para no tocar caja antes de que el riel esté probado.

## 6. Migración y pruebas

- Migración: `packages/database-restaurant/migrations/manual/0058_rabbit_chair.sql`.
  **Aplicar antes de desplegar** (el runner automático solo lee
  `migrations/*.sql`; los `manual/` se aplican con el procedimiento actual).
- Tests: `packages/api/src/routers/rabbitChair.integration.test.ts` (10 casos:
  cupo, sobreventa, mínimo, idempotencia, cronómetro, hold vencido, cierre,
  créditos, POSTPAID y edad).
- `pnpm --filter @rabbitty/api typecheck` limpio.

## 7. Riesgos abiertos (no bloquean fase 1, sí fase 2)

| Riesgo | Estado / mitigación pendiente |
|---|---|
| **No-show y reembolso** | Falta política escrita. Propuesta: reembolso completo hasta 2 h antes; después, crédito o retención según el caso. No se implementa hasta fase 2. |
| **CFDI / impuestos** | La aportación es una venta, no una propina. Se factura con el flujo de CFDI existente antes de cobrar dinero real. |
| **Rate limit de la landing** | Hoy es memoria por instancia. Mover a DB/Redis antes de promover el enlace masivamente. |
| **Token en URL** | Mitigado con `Referrer-Policy: no-referrer` + `noindex` en `/rabbit-chair`; el token sigue siendo un bearer, no se comparte por canales públicos. |
| **Push Android** | El drop arranca iOS-first; Android verá in-app. FCM queda para después. |
| **Radio/proximidad** | No existe push por radio todavía; fase 2 arranca con miembros/lista de espera. |

## 8. Siguiente gate

Fase 2 no arranca hasta que:

1. La migración 0058 esté aplicada en staging/producción.
2. El riel de cobro esté decidido y probado en sandbox del proveedor.
3. La política de no-show/reembolso esté escrita.
4. El módulo admin pueda crear/abrir una activación (fase 4) o God pueda
   hacerlo por procedimiento mientras se construye la UI.
