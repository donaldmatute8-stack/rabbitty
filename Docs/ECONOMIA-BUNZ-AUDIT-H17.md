# ECONOMÍA BUNZ — AUDITORÍA DE CORRESPONDENCIA (H17-doc)

> **Alcance:** verificar que cada writer económico del código cumple el modelo normativo
> v2 (`Docs/ECONOMIA-BUNZ-MODELO.md`).
> **Metodología:** lectura de código fuente (rutas, funciones, locks, idempotencia) +
> cruces de esquem. **Estado:** PRIMERA PASADA — veredictos por writer. Los veredictos
> "REVISAR" requieren segunda lectura con traza completa (no se declara aún correcto).

---

## 1. Writers de `ownedBusinesses.bunzBalance` (BACKING_AVAILABLE)

| # | Ruta / escritura | Guard de idempotencia | Atomicidad | Veredicto | Acción requerida |
|---|---|---|---|---|---|
| W1 | `business/scan/mint` → `+ bunzReward` | `findLedgerEntry(idempotencyKey)` replay-guard + `for('update')` de user y business en tx | tx completa | 🟡 REVISAR-FORMAL | Demostrar que el mint **autoriza capacidad** (reward rule) y que un retry no re-suma (replay guard presente ✓) — registrar origen en metadata del ledger |
| W2 | `bot/webhook claim` vault → `+ bunzToMint` (creación de vault) | pendings por orderId | tx | 🟡 REVISAR-FORMAL | Mismo estándar que W1 (claim/origen inventario) — pertenece a D-15 |
| W3 | `auth/telegram claim` vault → `+ bunzToAward` | `findLedgerEntry` prior-guard + `for('update')` x2 + `PENDING→CLAIMED` condicional | tx | 🟢 Estructura correcta / enfoke D-15 | Traza D-15 de punta a punta (reintentos del bot) |
| W4 | `admin/business` refill → `+ bunzToAdd` | actor=ADMIN (core users role check) — sin ledger audit entry verificado | direct | 🔴 REVISAR (D-14) | Exigir: actor + motivo + entrada de ledger de respaldo ("fuente documentada y aprobada") |
| W5 | `business/pay-fee` → `− feeAmount` | `findLedgerEntry(idempotencyKey)` prior-guard + `for('update')` + **conditional UPDATE** | tx completa (conditional `WHERE bunzBalance >= feeAmount RETURNING`) | 🟢 **CERRADO 2026-11-03** | Hecho: check-then-act eliminado; sin fila devuelta ⇒ `INSUFFICIENT_BUNZ_BALANCE` y rollback |
| W6 | `business/scan/redeem` → `− bunzCost` (H17 flip) | `findLedgerEntry` prior + `for('update')` user + **conditional UPDATE business** | tx (user+business) | 🟢 **CERRADO 2026-11-03** | Hecho: `AND bunzBalance >= :amount RETURNING`; sin fila ⇒ `BUSINESS_BACKING_INSUFFICIENT` → HTTP 409 |
| W7 | `paymentIntentDomain.approveIntent` (QR-Bunz + bill-bunz-pay) → `− bunzAmount` (H17 flip) | intent `for('update')` + SETTLED early-return + ledger SPEND unique + **conditional UPDATE business** | tx del settle (users+ledger+intent+order) | 🟢 **CERRADO 2026-11-03** | Hecho: consumo movido **fuera** de `if (intent.orderId)` (cubre bill-bunz-pay) + `BUNZ_BACKING_INSUFFICIENT`/`BUNZ_BACKING_UNRESOLVED` revierten todo |
| W8 | `pos/reward` (+vault claim path) | idempotencia por order | tx | 🟡 REVISAR-FORMAL | Igual estándar W1 |
| W9 | `pos/claim-ticket` → `+ bunzToMint` | replay-guard ledger + `PENDING→CLAIMED` + tx | tx | 🟡 REVISAR-FORMAL | Igual estándar W1/W3 |

## 2. Writers del saldo de Rabbitters (`users.totalBunzEarned/Spent`)

| # | Route | Escritura | Guard | Veredicto | Acción |
|---|---|---|---|---|---|
| U1 | `business/scan/mint` | `+ bunzReward` | ledger replay-guard + `for('update')` | 🟢 | Registrar `claimed` en metadata (PENDING→CLAIMED mapping para D-17) |
| U2 | `business/scan/redeem` / `reserve` / `pos/charge` / `pos/checkout` | `+ Spent bunzCost` | `for('update')` + balance check app-side + **conditional UPDATE** en `paymentCore` (hold) | 🟢 **CERRADO 2026-11-03 (rutas vivas)** | Hecho en `paymentCore` (`BUNZ_RESERVE_INSUFFICIENT_FUNDS`) y `paymentIntentDomain` (`LEDGER_INSUFFICIENT_FUNDS`). Las rutas POS pasan por `miniappClient.chargeBunz` → mismo path |
| U3 | `wallet/transfer` | remitente `+ Spent` + receptor `+ Earned` (dos updates, proxy dual) | `for('update')` x2 en una tx + ledger transfer | 🟢 Estructura | Reconcilar contra D-17 |
| U4 | `pos/reward` / `pos/claim-ticket` | `+ Earned remainingMint` | replay-guard ledger + `PENDING→CLAIMED` | 🟢 OK | — |
| U5 | `business/credit` (credit add) | `+ bunzAmount` | rol ADMIN en llamada | 🟡 REVISAR-FORMAL | Origen económico de "credit" debe documentarse (¿emisión autorizada por oferta?) |
| U6 | `campaigns/redemption` | `+ bunzAwarded` | idempotencia de campaign tx | 🟢 | — |
| U7 | `auth/telegram claim` vault | `+ bunzToAward` | prior-guard ledger + tx | 🟢 | — |
| U8 | `reservations` | `+ Spent` con reserva | `for('update')` + **conditional UPDATE** | 🟢 **CERRADO 2026-11-03** | Hecho: `WHERE … totalBunzEarned − totalBunzSpent >= :cost RETURNING`; sin fila ⇒ `INSUFFICIENT_BUNZ` y rollback |
| U9 | `auth/delete-account` | `+ Spent` por burn en delete | guard del flow delete | 🟡 REVISAR | Marcar como BURN explícito en ledger (tipo BURN ya existe en ledgerEntries) |
| U10 | `paymentCore / paymentIntentDomain` (hold / release / approveIntent) | Holds `bunzReserves` + debit settle | `for('update')` xN + ledger + **conditional UPDATE** | 🟢 **CERRADO 2026-11-03** | Hecho: hold y débito con `WHERE earned − spent >= :amt RETURNING` |

## 3. Transiciones `pendingVaults` (PENDING / CLAIMED / EXPIRED_TO_TREASURY)

| # | Ruta | Transición | Guard | Veredicto |
|---|---|---|---|---|
| P1 | `auth/telegram` claim | PENDING → CLAIMED (condicional where status='PENDING') | prior-guard ledger + `for('update')` | 🟢 |
| P2 | `pos/claim-ticket` | PENDING → CLAIMED (condicional) + `VAULT_ALREADY_CLAIMED`/`ALREADY_MINTED` | tx + guards | 🟢 |
| P3 | `bot/webhook` (creación de vaults) | crea PENDING | — | 🟢 creación |
| P4 | `cron/vault-expiration` | PENDING → `EXPIRED_TO_TREASURY` (Bunz a Tesorería del sistema al vencer) | cron | 🟢 — entender como recupero al Tesorería Rabbitty (documentarlo) |
| P5 | `reconciliation/request` | referencia de pendingVaults para conciliación | — | 🟡 verificar en D-17 |

## 4. Flujos de redención — resumen del dictamen (lo que quedó pendiente de código)

| Pendiente | Dónde aplica | Estado |
|---|---|---|
| **Conditional atomic UPDATE** (`WHERE bunzBalance >= amount RETURNING`) | W5, W6, W7, U2, U8, U10 (todos los débitos) | ✅ **APLICADO 2026-11-03** — ver §1/§2 y `Docs/ECONOMIA-BUNZ-MODELO.md` §3.1 |
| **Reserva atómica de inventario** (BackingReservation) | catálogo/campañas (D-16) | ⏳ diseño pendiente |
| **Auditoría metadata de origen** en todo writer de backing | W1-W9 | ⏳ completar metadata |
| **D-17 conciliación** (query report) | todas las tablas | ⏳ reporte aún no construido |

## 5. Conclusiones de la auditoría de correspondencia (primera pasada)

- La **estructura de guards** (ledger UNIQUE + `for('update')`) existe en la gran mayoría
  de los writers — la base es buena.
- **Deuda de precisión CERRADA (2026-11-03)**: los cinco puntos de débito que usaban
  "comparación app-side + `GREATEST(0)`" ya usan el patrón condicional-atómico §3
  (`WHERE … >= :amount RETURNING`, sin fila ⇒ throw ⇒ rollback). Ver §1 (W5/W6/W7) y §2
  (U2/U8/U10). `GREATEST(0)` quedó solo como protección secundaria de escritura.
- Los writers `+` de backing necesitan **metadata de origen** alineada a la tabla §0
  del modelo (reward/vault-claim/refill) raíz para auditabilidad completa — insumo de D-17.
- Los veredictos dubios (REVISAR-FORMAL) se cierran cuando la traza completa del ruta
  demuestre el origen económico + retry no re-suma (documen en la misma matriz).
- **Lo que sigue abierto NO es código de dinero**: D-14/D-17 (conciliación histórica) y
  D-15/D-16 (semántica de vault y reserva de inventario).

**Estado permanente:** *Modelo conceptual aprobado; correspondencia de implementación
pendiente de segunda pasada de verificación con patrón condicional atómico aplicado.*
