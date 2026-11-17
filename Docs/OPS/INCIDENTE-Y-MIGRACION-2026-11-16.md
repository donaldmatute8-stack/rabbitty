# Incidente y migración de base — 16/17 de noviembre de 2026

**Estado:** resuelto. Sistema operando sobre la base nueva.
**Resumen en una línea:** una cadena de fallos (migración no aplicada → guardas →
cuota de Neon) terminó en una migración completa de base, con recreación de
datos y endurecimiento. Este documento es la bitácora para cotejar.

---

## 1. Cadena de incidentes

### 1.1 POS sin abrir terminal (16 nov, mañana)

`staff.hourlyRate` / `commissionPct` se agregaron al esquema y la migración
`0024` se aplicó a **localhost**, no a producción. El contexto tRPC leía la fila
completa de `staff` en cada request → todo el admin/POS quedó inoperante.

- **Fix**: migración aplicada a prod + columnas explícitas en rutas calientes.
- **Candado**: `preDeployCommand` que migra y verifica esquema antes de promover.

### 1.2 Staging bloqueado por libro de migraciones vacío

Staging es un clon de Neon: tablas sí, ledger no → el runner intentó repetir
desde `0000` y chocó con "ya existe".

- **Fix**: modo **reconciliación** (intento atómico por archivo y, si choca,
pasada tolerante que ignora "ya existe" y difiere lo que depende de una
migración posterior).

### 1.3 Roles separados y rotación

- `rabbitty_app` (solo DML) para el runtime; `neondb_owner` solo en `MIGRATE_*`
  del pre-deploy.
- Rotación **ping-pong** de credencial (`scripts/rotate-app-role.mjs`): se
  resetea la contraseña del rol inactivo, se verifica, se publica y el anterior
  queda 72 h para rollback.

### 1.4 Cuota de Neon agotada (17 nov, madrugada)

`ERROR: Your account or project has exceeded the quota.` → **producción y
staging caídos a la vez** (misma cuenta). No era código: sin conexión, todo
falla (incluido el POS con "Failed query … from staff").

Causa de fondo: tope mensual de cómputo del plan gratuito + actividad que
mantiene el endpoint despierto (POS + monitoreo cada 15 min + ~20 despliegues
del día + staging).

---

## 2. Migración a la base nueva

| Paso | Detalle |
|---|---|
| Origen | **respaldo propio** de las 17:24 UTC (la base vieja quedó inaccesible por la cuota) |
| Destino | proyecto Neon nuevo (`ep-square-fog-bbrges04`), Postgres 18.7 |
| Restauración | `pg_restore --no-owner --no-privileges` → **164 tablas** |
| Verificación | 186 órdenes · $28,078.40 · schema-guard sin desajustes |
| Variables | actualizadas en **admin (4), kds (2), bot (2), landing (1)** |
| Rol de app | recreado (`rabbitty_app_b`) con DDL **bloqueado** (verificado) |
| Staging | base separada `rabbitty_staging` (**esquema sin datos**), servicio apagado |
| Vercel | el dueño borró `CORE_DATABASE_URL`; la app cayó a `DATABASE_URL` y revivió |

### Trampa resuelta: el pooler de Neon

El pooler **ignora `search_path`** y rechaza el parámetro en la URL
(*"unsupported startup parameter"*). Síntoma: `no schema has been selected to
create in` y `relation "orders" does not exist`.

**Solución aplicada** (a nivel de base, no de rol):

```sql
ALTER DATABASE neondb SET search_path TO public, pg_catalog;
```

Con eso la URL **pooled** vuelve a servir. (Setearlo con `ALTER ROLE` no basta:
el pooler no lo aplica.)

### Trampa resuelta: prioridad de variables en el miniapp

```ts
process.env.CORE_DATABASE_URL || process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL
```

Si quedaba la `CORE_DATABASE_URL` vieja, ganaba aunque se hubiera conectado la
base nueva. Al borrarla, todo apunta a `DATABASE_URL`.

---

## 3. Datos recreados (para cotejar)

Las ventas posteriores al respaldo de las 17:24 se reconstruyeron con su monto y
hora originales. Llevan una línea técnica **"Venta reconstruida (migración)"**
—ítem oculto del menú— para que el total cuadre sin atribuir a un producto real.

| # | ID (corto) | Monto | Método | Hora original | Cliente |
|---|---|---|---|---|---|
| 1 | `a0000000…0001` | $55.00 | Efectivo | 17:53:54 | deltoro |
| 2 | `a0000000…0002` | $69.00 | Efectivo | 17:53:33 | — |
| 3 | `a0000000…0003` | $95.00 | Efectivo | 19:15:25 | — |
| 4 | `a0000000…0004` | $190.00 | Tarjeta | 22:43:42 | — |

**Total recreado: $409.00** · IVA desglosado al 16 %.
No se recreó la orden de $0 en `PENDING` (era el intento de cobro bloqueado por
el bug de efectivo, no una venta).

### Bunz

| | |
|---|---|
| Acreditado | **+8 Bunz** a `deltoro` sobre la venta de $55 (15 % de 55) |
| Saldo resultante | **19** (29 ganados − 10 usados) |
| Ledger | `biz_fb7f4847… → usr_daffee99…` |
| Notificación | *"Tus Bunz ya han sido actualizados"* — entregada |

> **Error corregido en el camino:** el primer acreditado se hizo a la cuenta
> equivocada (`iaherrera`) por identificar al comensal por aproximación. Se
> revirtió con asiento de compensación `REFUND` (el ledger es *append-only*), se
> borró el aviso erróneo y se acreditó a quien correspondía. **Regla adoptada:
> para mover dinero, el destinatario se confirma por usuario o teléfono, nunca
> por nombre parecido.**

---

## 4. Bugs funcionales corregidos de paso

| Bug | Causa | Fix |
|---|---|---|
| Efectivo pedía confirmación del Rabbitter | la aprobación se exigía a **todo** método menos membresía | `CASH` exento en servidor y POS; solo Bunz y tarjeta registrada la piden |
| Bebida de membresía no se descontaba | el POS **no enviaba** `INCLUDED_PRODUCT` al escanear el pase | se incluye en la auto-selección |
| Botón "Cobrar" fuera de pantalla | el pie del carrito crecía sin límite | alto máximo + scroll, botones *sticky* |
| **Ningún Bunz se emitía** | el ledger exige `^(usr|biz|sys)_` y se insertaba el UUID crudo del negocio | `payerSubjectId = biz_<id>` + guarda si falta negocio |
| Notificaciones nunca se entregaban | el worker de GitHub no corría desde las 16:37 | el planificador interno drena la cola |
| Saldo de Bunz no se actualizaba en la app | `/api/auth/session` sin `no-store` | `force-dynamic` + `Cache-Control: no-store` |
| Membresía "todo incluido" no aplicaba | cupo semanal 2/2 consumido | cupo **99** (la regla real es 1 por ticket) |

---

## 5. Estado final

| Componente | Estado |
|---|---|
| admin | ok · ambas bases · rol de app sin DDL |
| app (Vercel) | ok · marketplace devuelve planes reales |
| kds / bot / landing | SUCCESS |
| staging | apagado · base separada `rabbitty_staging` (sin datos) |
| Descubrir | solo *Nido Familiar 626* y *Ritual Esencial* (Demo oculto) |
| CI | verde (lint + typecheck + 234 tests + build) |
| Respaldos | bucket sin cambios; primer dump de la base nueva en el siguiente ciclo |

---

## 6. Regla de trabajo acordada (17 nov)

> **Solo commit. Sin push ni deploy automático.** En este repo *push = deploy* en
> Railway, así que "solo commit" implica no empujar. El dueño decide cuándo
> publicar, para poder revertir sin afectar producción.

---

## 7. Pendientes conocidos

| # | Pendiente | Nota |
|---|---|---|
| 1 | **Offline POS/KDS con 626 Café** | mañana; requiere ventana sin operación |
| 2 | Fila de outbox queda `QUEUED` aunque el aviso se entrega | el worker reporta `processed: 0`; cosmético, provoca una consulta extra cada 15 min |
| 3 | Producto incluido en *Nido Familiar 626* | el plan es "todo incluido" (`MEMBER_CONSUMPTION`), no necesita `INCLUDED_PRODUCT` |
| 4 | Revisión de consumo de Neon | ver `Docs/OPS/REVISION-SEMANA.md` |
