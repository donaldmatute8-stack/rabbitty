# Conciliación Bunz · 626 Café (2026-11-09)

> **Registro operativo.** Documenta el borrado de transacciones históricas
> pre-reset y la conservación de la transacción real del 9-nov-2026.

**Afiliado:** 626 Café (`fb7f4847-920f-4482-8ae3-c810a20e75ad`)
**Restaurante:** 626 CAFE (`6274c80e-0ece-4be2-8041-fec5b1a0d322`)
**Sucursal:** 626 Café (`44a211ff-3340-401d-b40c-b07d19b853ec`)
**Corte de economía:** `2026-11-07T23:51:55.196Z`

---

## 1. Qué se borró

Se eliminaron **6 transacciones MINTED anteriores al reset**, que sumaban **68 BZ**:

| Fecha | Fiat | BZ |
|---|---:|---:|
| 31-oct-2026 20:02 | $55 | 8 |
| 02-nov-2026 02:30 | $95 | 14 |
| 02-nov-2026 17:30 | $55 | 8 |
| 02-nov-2026 17:39 | $138 | 20 |
| 02-nov-2026 20:35 | $55 | 8 |
| 05-nov-2026 22:44 | $69 | 10 |
| **Total** | **$467** | **68** |

**Respaldo previo:** `DOCS/data/backups/bunz-626-pre-reset-2026-11-08.json`
(6 filas completas, 1,733 bytes).

**Ledger relacionado:** 0 filas en `ledger_entries` y 0 en `bunz_ledger_entries`
para esas transacciones. El reset ya había limpiado el ledger; solo quedaban las
filas de `transactions`.

---

## 2. Qué se conservó

La transacción real del **9-nov-2026**:

| Campo | Valor |
|---|---|
| Order | `8f7442a2-f08b-4df5-bd10-bd698ab3d56e` |
| Transaction | `0cdb229a-5064-4731-8e8b-463239f62229` |
| Cliente | Marco Del Toro |
| Producto | Latte en 626 Café |
| Fiat | $75 |
| Bunz | 11 |
| Estado | MINTED |
| Fecha | 2026-11-09 00:04:14 UTC |

Ledger:
- `bunz_ledger_entries`: `user_wallet +11`, `emission_budget -11`.
- `ledger_entries`: `EARN 11 BUNZ`.

---

## 3. Estado después del borrado

| Métrica | Valor |
|---|---:|
| Transacciones pre-reset de 626 | **0** |
| Entregado total de 626 | **11 BZ** |
| Entregado desde el reset | **11 BZ** |
| Saldo/capacidad del negocio (`bunzBalance`) | **18,000 BZ** |
| Usuario Marco (`totalBunzEarned`) | **11 BZ** |

> El `bunzBalance` de 18,000 corresponde a la capacidad del **re-onboarding del
> 8-nov-2026 22:59 UTC** (promo 7,000 + adelantada 11,000), no al saldo histórico.
> Si se decide dejar la capacidad en cero, es un movimiento separado.

---

## 4. Por qué se conserva el latte

El corte de economía es del **7-nov-2026 23:51 UTC**. El latte ocurrió el
**9-nov-2026 00:04 UTC**, es posterior al corte, tiene ledger propio y es una
operación real. Por eso no se incluye en el borrado histórico.

---

## 5. Verificación

```sql
-- Pre-reset: debe ser 0
SELECT COUNT(*) FROM transactions
WHERE "businessId" = 'fb7f4847-920f-4482-8ae3-c810a20e75ad'
  AND "createdAt" < '2026-11-07T23:51:55.196Z';

-- Total vigente: debe ser 11
SELECT COALESCE(SUM("bunzMinted") FILTER (WHERE status IN ('MINTED','COMPLETED')), 0)
FROM transactions
WHERE "businessId" = 'fb7f4847-920f-4482-8ae3-c810a20e75ad';
```

Resultado: **0** y **11**.

---

## 6. Ajuste de capacidad (2026-11-09)

**Decisión:** capacidad conservadora a **1 mes** con las ventas observadas.

| Concepto | Antes | Después |
|---|---:|---:|
| Capacidad total | 18,000 | **4,000** |
| Incentivo promocional (40%) | 7,000 | **1,500** |
| Capacidad adelantada (60%) | 11,000 | **2,500** |
| Cobertura | 60 días | **30 días** |
| Ventas mensuales base | 60,000 | **27,000** |
| Recompensa | 15% | 15% |
| `bunzBalance` | 18,011 | **4,011** |
| `creditLimit` | 18,000 | **4,000** |
| `creditOutstanding` | 11,000 | **2,500** |
| `creditDisbursed` | 11,000 | **2,500** |
| `available` | 18,000 | **4,000** |
| Límite emisión/redenção 7d | 5,000 | **4,000 / 4,000** |
| Límite liquidación 7d | 2,000 | 2,000 |

El `bunzBalance` de **4,011** = 4,000 de capacidad + 11 del latte real ya emitido.

### Evidencia del cambio

- `merchant_capacity_events`:
  - `CAPACITY_REONBOARDED` (4,000) por el alta oficial.
  - `CAPACITY_ADJUSTED` (4,000) por la revisión del fundador.
- `auditEntries`: `AFFILIATE_REONBOARDED` + `CAPACITY_ADJUSTED`.
- `verificationData`:
  - `contractSignature`: `2026.11-v1.2`, `approved`, firmante **Marco Arturo Muñoz Del Toro**.
  - `contractSignatureHistory`: conserva la aceptación **draft** de Alfonso Herrera Ruiz (18,000 / 2 meses).
  - `capacityAdjustment`: 18,000 → 4,000, ventas 27,000, 15%, 1 mes.
  - `adminAttestation`: nota del fundador; aceptación formal de la versión aprobada pendiente.
- Respaldos:
  - `DOCS/data/backups/626-verification-before-2026-11-09.json`
  - `DOCS/data/backups/626-capacity-before-2026-11-09.json`

### Invariantes verificados

- `ownedBusinesses.creditLimit` = `merchant_capacity_accounts.authorizedTotal` = 4,000.
- `promoAuthorized` + `creditAuthorized` = 4,000.
- `creditOutstanding` = `creditDisbursed` = 2,500.
- `coverageDays` = 30.
- `bunz_economic_limits` = 4,000 / 4,000 / 2,000.
- `transactions` de 626: 1 (latte), 11 BZ; pre-reset: 0.
- Ledger del latte: `user_wallet +11`, `emission_budget −11`, `EARN 11 BUNZ`.
- Tokens de re-onboarding: ambos usados; ninguno reutilizable. El segundo se usó para
  ejecutar el alta oficial desde el servidor (inyección), no se envió al afiliado.
- Copia del contrato aprobado: enviada a `poncho.herreraru@gmail.com` el 2026-11-09,
  `copyDeliveryStatus: sent`, `copyMessageId: 01a1be70-1a80-7758-9a6e-6dd0f294fbcf`.
- `auditEntries`: `AFFILIATE_REONBOARDED`, `CAPACITY_ADJUSTED`, `CONTRACT_COPY_SENT`.
- Verificador reutilizable: `scripts/verify-affiliate-capacity.sql`.
  Ejecutado contra 626: **13/13 checks en `true`** (capacidad, split, outstanding,
  cobertura, `bunzBalance`, límites, contrato aprobado, copia, pre-reset y ledger).

---

## 7. Solicitud de más capacidad (diseño futuro)

Para afiliados que necesiten más capacidad, sin volver a un re-onboarding completo:

1. **Tabla** `capacity_increase_requests`:
   - `id`, `affiliateId`, `requestedBunz`, `monthlySales`, `rewardPct`, `coverageMonths`,
   - `reason`, `status` (`PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`),
   - `reviewedBy`, `reviewedAt`, `reviewNote`, `createdAt`, `updatedAt`.
2. **UI afiliado:** botón “Solicitar más capacidad” en `Mi negocio → Bunz` o `Ajustes → Legal`.
   - Muestra capacidad actual, ventas observadas y una propuesta calculada.
   - Exige motivo y aceptación de que la capacidad no es dinero.
3. **UI GOD:** cola en `/god/economia` o `/god/tenants`.
   - Revisa ventas, capacidad actual y propuesta.
   - Aprueba o rechaza con nota; nunca automático.
4. **Al aprobar:**
   - Actualiza `ownedBusinesses.creditLimit`/`bunzBalance`.
   - Actualiza `merchant_capacity_accounts` (autorizado, promo, crédito, disponible, outstanding).
   - Actualiza `bunz_economic_limits` y `merchant_recovery_terms` si cambia cobertura.
   - Inserta `CAPACITY_INCREASE_APPROVED` en `merchant_capacity_events` y `auditEntries`.
   - Conserva la solicitud y la evidencia.
5. **Guardrails:**
   - Capacidad propuesta = ventas observadas × reward × cobertura.
   - No superar 2–3 meses de cobertura sin evidencia.
   - No aprobar si hay obligación pendiente alta o fraude.
   - Revisión humana obligatoria.
