# Revisión de la semana — consumo de Neon y salud del sistema

**Cuándo:** una semana después de la migración (**~24 de noviembre de 2026**)
**Por qué:** el plan gratuito de Neon agotó su cuota y tumbó producción. Hay que
decidir con datos si el plan aguanta o hay que subir.

---

## 1. Lo primero: consumo de Neon

En **console.neon.tech** → cuenta dueña del proyecto → **Billing / Usage**:

| Métrica | Límite Free | Qué anotar |
|---|---|---|
| Compute hours | ~192 h/mes | **el número más importante** |
| Storage | 0.5 GB | la base pesa ~25 MB, sobra |
| Egress / transferencia | 5 GB/mes | |

### Cómo interpretarlo

| Consumo a la semana | Lectura | Acción |
|---|---|---|
| < 30 h | holgado | quedarse en Free |
| 30–40 h | justo | vigilar; considerar Launch |
| > 40 h | **se va a repetir** | subir a **Launch (~19 USD/mes)** |

> Regla mental: el Free da ~192 h al mes ≈ **6.4 h al día**. Si el endpoint está
> despierto más que eso (POS abierto + monitoreo + despliegues), se agota antes
> de fin de mes.

---

## 2. Qué cambió para reducir consumo (verificar que está activo)

| Medida | Cómo comprobarla |
|---|---|
| Fuera de horario no se consulta la base (salvo slots 00/06/12/18) | logs de Railway: `[ops-scheduler] fuera de horario: sin consultas a la base` |
| Staging apagado | `railway deployment list --service rabbitty-admin --environment staging` → sin deployment corriendo |
| Respaldos siguen cada ~6 h | invariante `backup_age_hours` en verde (≤ 12 h) |
| Pooler funcionando | `/api/health?strict=1` → `ok` |

Si alguno falla, el consumo sube sin que se note: revisarlos primero.

---

## 3. Salud del sistema (10 minutos)

| Check | Comando / dónde |
|---|---|
| Servicios | Railway: admin, kds, bot, landing en **SUCCESS** |
| Salud real | `https://admin.rabbitty.me/api/health?strict=1` → `status: ok` |
| App | `https://app.rabbitty.me/api/memberships/marketplace` → devuelve planes |
| Invariantes | tabla `ops_health_snapshots`: ¿hubo `critical`? ¿cuántos `warn`? |
| Respaldos | bucket: ¿hay dumps de la base **nueva** (fechas posteriores al 17-nov)? |
| Alertas | correos de `OPS_ALERT_EMAIL`: ¿llegó alguno? ¿por qué? |
| CI | GitHub Actions: últimos runs en verde |

### Consulta rápida de invariantes

```sql
SELECT "metric", "status", count(*)
FROM "ops_health_snapshots"
WHERE "checkedAt" > now() - interval '7 days'
GROUP BY 1,2 ORDER BY 1,2;
```

---

## 4. Verificaciones de negocio

| Qué | Cómo |
|---|---|
| **Bunz emitiéndose** | una venta real con cliente vinculado debe acreditar y notificar |
| **Conteo de Bunz** | `SELECT count(*) FROM ledger_entries WHERE "createdAt" > now() - interval '7 days'` — no debe ser 0 |
| **Efectivo sin fricción** | cobrar en efectivo con Rabbitter vinculado no debe pedir aprobación |
| **Membresía Nido Familiar** | cupo 99 por semana; cada ticket consume 1 |
| **Conciliaciones** | que no queden `DELIVERY_PROCESSING` viejas |
| **Descubrir** | solo los planes reales (Demo no debe aparecer) |

```sql
-- Membresía: cupo y uso
SELECT p.name, e."benefitType", e."quotaPerCycle", e."currentUsageInCycle"
FROM membership_entitlements e
JOIN membership_subscriptions s ON s.id = e."subscriptionId"
JOIN membership_plan_versions v ON v.id = s."planVersionId"
JOIN membership_plans p ON p.id = v."planId"
WHERE p.name ILIKE '%Nido%';

-- Conciliaciones atascadas
SELECT status, count(*) FROM reconciliationRequests GROUP BY 1;
```

---

## 5. Decisiones que hay que tomar con esos datos

1. **Plan de Neon**: quedarse en Free (holgado), o **Launch** (si el consumo
   semanal supera ~30 h). Subir es reversible.
2. **Frecuencia del monitoreo**: si el consumo está justo, bajar los invariantes
   en horario de 15 a 30 min (menos detección, menos cuota).
3. **Respaldos**: hoy 4/día (~10 s cada uno). Bajarlos a 2/día duplica la
   ventana de pérdida (el PITR de Neon Free solo cubre 6 h): **no recomiendo
   tocarlos**.
4. **Despliegues**: cada uno despierta la base para migraciones. Agruparlos
   ahorra cuota real.
5. **Staging**: mantenerlo apagado salvo pruebas puntuales.

---

## 6. Señales de que la migración dejó algo mal

| Síntoma | Dónde mirar |
|---|---|
| Totales de la semana no cuadran | las 4 ventas recreadas (`a0000000…`) y su nota de migración |
| Cliente sin sus Bunz | ledger `usr_<id>`, no la tabla de usuarios |
| Reportes con "Venta reconstruida" | es esperado en esas 4 órdenes; no aparece en el menú |
| Error `relation … does not exist` | `search_path` de la base (`ALTER DATABASE … SET search_path`) |
| Falla al cobrar con cliente | prioridad de variables: `CORE_DATABASE_URL` gana sobre `DATABASE_URL` |

---

## 7. Cierre de la semana

Al terminar, dejar anotado aquí (o en el estado del proyecto):

- Consumo de Neon de la semana: ______ h
- Decisión: ______
- Incidentes: ______
- Ajustes hechos: ______
