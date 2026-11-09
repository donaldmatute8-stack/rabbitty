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
