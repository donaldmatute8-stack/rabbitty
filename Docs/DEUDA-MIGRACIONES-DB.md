# Deuda Técnica — Migraciones de Base de Datos (`packages/database-core`)

> **ESTADO: RESUELTO el 2026-10-17.**
> Limpieza de journal fantasma (0001/0002) completada y baseline en `drizzle.__drizzle_migrations` aplicado y verificado.
> `drizzle-kit migrate` y `drizzle-kit check` operando 100% limpios sin errores.
> Alcance: el esquema `core` (24 tablas) en la base compartida de Neon.

---

## 1. Resumen

La base de datos `core` se fue construyendo con **`drizzle-kit push` y SQL manual** en el
editor de Neon, en vez de con `drizzle-kit migrate`. Resultado: el **historial de migraciones
está desincronizado** con el estado real de la base y las herramientas `db:migrate` /
`db:generate` están **rotas**. El runtime de la app **no se ve afectado** (drizzle-orm usa el
esquema TypeScript, no el journal), pero cualquier trabajo futuro de esquema es frágil.

---

## 2. Síntomas detectados

### 2.1 `_journal.json` referencia migraciones que no existen en disco
`packages/database-core/migrations/meta/_journal.json` lista 9 entradas, pero en disco hay 7:

| idx | tag (en el journal) | ¿Archivo en disco? |
|---|---|---|
| 0 | `0000_small_norman_osborn` | ✅ |
| 1 | `0001_mysterious_typhoid_mary` | ❌ **no existe** |
| 2 | `0002_aspiring_nemesis` | ❌ **no existe** |
| 3 | `0003_add_audit_entries` | ✅ |
| 4 | `0004_strange_lockjaw` | ✅ |
| 5 | `0005_spicy_captain_universe` | ✅ |
| 6 | `0006_reflective_imperial_guard` | ✅ |
| 7 | `0007_stiff_meggan` | ✅ |
| 8 | `0008_dizzy_rage` | ✅ |

- No hay archivos `.sql` ni snapshots `0001_snapshot.json` / `0002_snapshot.json`, ni rastro en
  el historial de git (`git log --all -- 0001*` vacío).
- La **cadena de snapshots** salta directo: `0000` → `0003` → `0004` → … → `0008`
  (el `prevId` de `0003_snapshot.json` es el `id` de `0000_snapshot.json`).
- Consecuencia: `drizzle-kit migrate` lanza `No file 0001_mysterious_typhoid_mary.sql found`.
  Es decir, **`pnpm db:migrate` y `pnpm db:generate` fallan hoy**.

### 2.2 `__drizzle_migrations` vacía
```
select count(*) from drizzle.__drizzle_migrations;  -- 0
```
Nunca se registró ninguna migración aplicada → no hay historia en la base.

### 2.3 Drift de *casing* por columnas agregadas a mano
Al agregar columnas directamente en Neon SQL se hizo **sin comillas**, y Postgres las guardó en
minúsculas. Drizzle consulta con comillas camelCase (sensible a mayúsculas) → `column does not exist`.

**Ya corregido en producción el 2026-10-17** (renames aplicados y verificados, `drift restante: 0`):
```sql
ALTER TABLE "conversations" RENAME COLUMN "participant1typingat" TO "participant1TypingAt";
ALTER TABLE "conversations" RENAME COLUMN "participant2typingat" TO "participant2TypingAt";
ALTER TABLE "conversations" RENAME COLUMN "lastmessageat"        TO "lastMessageAt";
ALTER TABLE "messages"      RENAME COLUMN "readat"               TO "readAt";
```
> Nota para el futuro: **siempre citar** identificadores camelCase, o mejor, no tocar la base a
> mano y usar `db:generate` + el archivo SQL.

### 2.4 Migración `0007` nunca aplicada como archivo
Sus efectos existen en la base (columnas `type`, `metadata`, `readAt`, `participant*TypingAt`,
`lastMessageAt`, `verificationTokens`, …) pero fueron creados a mano. No está registrada como
aplicada en ningún lado.

---

## 3. Impacto

| Área | ¿Afectada? |
|---|---|
| App en producción (runtime drizzle-orm) | ❌ No |
| `pnpm db:migrate` | ✅ Sí — **roto** |
| `pnpm db:generate` | ✅ Sí — puede fallar por el journal |
| Onboarding de un entorno nuevo / CI | ✅ Sí — no reproducible |
| Deploy de cambios de esquema (p. ej. tabla de preferencias de push) | ✅ Sí — hoy no hay camino limpio |

**Urgencia:** media. No rompe producción, pero **bloquea el próximo cambio de esquema**
(ver `DOCS/PUSH-NOTIFICATIONS-PLAN.md` §6, que necesita migraciones nuevas).

---

## 4. Corrección (paso a paso, para hacer más adelante)

Hacer esto **en una rama** y **antes del próximo cambio de esquema**.

### Paso 1 — Arreglar el journal (quitar las entradas fantasma)
Editar `packages/database-core/migrations/meta/_journal.json`:
- Eliminar la entrada `idx: 1` (`0001_mysterious_typhoid_mary`) y `idx: 2` (`0002_aspiring_nemesis`).
- Re-indexar `idx` para que quede `0..6` (los `tag` y `when` se conservan).

Resultado esperado (7 entradas):
```
0 0000_small_norman_osborn            when 1780506933410
1 0003_add_audit_entries              when 1781297198647
2 0004_strange_lockjaw                when 1781934634118
3 0005_spicy_captain_universe         when 1782891548301
4 0006_reflective_imperial_guard      when 1782894607944
5 0007_stiff_meggan                   when 1792191094762
6 0008_dizzy_rage                     when 1792215202333
```

> Alternativa (no recomendada): crear archivos vacíos `0001_*.sql` / `0002_*.sql` solo para
> callar el error. Ensucia el historial; preferir eliminarlos.

### Paso 2 — Baseline de `__drizzle_migrations`
Marcar en la base que las migraciones vigentes ya están aplicadas, para que `migrate` no intente
re-ejecutarlas. Drizzle compara por `created_at` (= el `when` del journal) contra el máximo
existente; por eso basta registrar hasta la última (`0008`).

El `hash` que espera drizzle es **sha256 (hex) del contenido exacto del archivo `.sql`**:

| tag | hash (sha256) | `when` |
|---|---|---|
| `0000_small_norman_osborn` | `e102fe7b73477fac4ad757e64b522f08624aa11ec88f574ed4e7b58fe3b903e4` | `1780506933410` |
| `0003_add_audit_entries` | `ffa092349ae539646b75c607f3d541cec1e02d0eb91b5ceb4059cae43c798e82` | `1781297198647` |
| `0004_strange_lockjaw` | `c52a3b93b579ca0c91cbc6156b94360547c944b51bc7d60b2426a7c306afc4be` | `1781934634118` |
| `0005_spicy_captain_universe` | `80d4997899801ea29e9c5cf6f55f37a59ca316e12fa4890c57cbcb00c01f7f51` | `1782891548301` |
| `0006_reflective_imperial_guard` | `0ac95e2022e40e58146e46a870d73f97b0282672e0930dd7688688655be0210d` | `1782894607944` |
| `0007_stiff_meggan` | `d3fe257b7bb4f4d7c00864ae3f2577ab2167778cdaefcc81028d7e37e19742cb` | `1792191094762` |
| `0008_dizzy_rage` | `e7f3e0ac72ad61550f4f3a83d6f6cb828309ec9672c77806233502e90e1f79c7` | `1792215202333` |

SQL de baseline (ejecutar en la base compartida de Neon):
```sql
-- La tabla la crea drizzle; si no existe, créala primero:
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES
  ('e102fe7b73477fac4ad757e64b522f08624aa11ec88f574ed4e7b58fe3b903e4', 1780506933410),
  ('ffa092349ae539646b75c607f3d541cec1e02d0eb91b5ceb4059cae43c798e82', 1781297198647),
  ('c52a3b93b579ca0c91cbc6156b94360547c944b51bc7d60b2426a7c306afc4be', 1781934634118),
  ('80d4997899801ea29e9c5cf6f55f37a59ca316e12fa4890c57cbcb00c01f7f51', 1782891548301),
  ('0ac95e2022e40e58146e46a870d73f97b0282672e0930dd7688688655be0210d', 1782894607944),
  ('d3fe257b7bb4f4d7c00864ae3f2577ab2167778cdaefcc81028d7e37e19742cb', 1792191094762),
  ('e7f3e0ac72ad61550f4f3a83d6f6cb828309ec9672c77806233502e90e1f79c7', 1792215202333);
```
> Si en el futuro cambias un archivo `.sql` ya aplicado, el hash deja de coincidir; recalcula con
> `shasum -a 256 packages/database-core/migrations/<archivo>.sql`.

**Verificar hashes antes de confiar en ellos** (desde la raíz del repo):
```bash
cd packages/database-core/migrations && for f in *.sql; do
  printf "%s  %s\n" "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"
done
```

### Paso 3 — Validar que quedó sano
```bash
# No debe intentar aplicar nada; debe salir sin cambios:
CORE_DATABASE_URL='<prod>' pnpm --filter '@rabbitty/database-core' db:migrate
```
Debe terminar sin ejecutar SQL (todo ya registrado). Si intenta aplicar algo, revisar el Paso 2.

Luego, para confirmar que `generate` vuelve a funcionar:
```bash
pnpm --filter '@rabbitty/database-core' db:generate
# Debe decir "No schema changes" o generar SOLO lo nuevo.
```

### Paso 4 — Regla hacia adelante
1. **Nunca más `db:push` contra producción** (hace diff y puede alterar/dropear sin control).
2. Flujo correcto: editar `src/schema/index.ts` → `pnpm db:generate` → revisar el `.sql` →
   `pnpm db:migrate` (o aplicar el archivo) → commit del `.sql`, snapshot y journal juntos.
3. Si hay que tocar la base a mano (emergencia), **citar camelCase**:
   `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "readAt" timestamp;`

---

## 5. Verificación final (checklist)
- [ ] `_journal.json` sin entradas 0001/0002 e `idx` re-secuenciado.
- [ ] `select count(*) from drizzle.__drizzle_migrations;` = 7.
- [ ] `db:migrate` corre sin aplicar nada.
- [ ] `db:generate` no produce cambios espurios.
- [ ] `git status` con journal + snapshots consistentes commiteados.

---

## 6. Rollback / notas
- El baseline es aditivo (solo inserta filas de registro); no altera el esquema. Revertir = borrar
  esas 7 filas de `drizzle.__drizzle_migrations`.
- Los `RENAME` del §2.3 ya están aplicados y verificados en producción; no repetir.
- Este documento se debe actualizar (o marcar como resuelto) cuando se ejecute la corrección.

---

## 7. Cuándo hacerlo
**Antes del primer cambio de esquema nuevo** (p. ej. las tablas
`notificationPreferences` / `notificationDeliveries` del plan de push). No es urgente para
producción, pero sí bloqueante para seguir evolucionando el esquema con seguridad.

## DRIFT-001 — Drift de journal en database-core (detectado 2026-11-02)

**Síntoma:** `pnpm db:generate` en database-core genera migraciones con cambios que YA
existían en produccion (behaviorRules, presenceSessions, reconciliationRequests,
columnas noExpiration/membershipOrigin de membership_subscriptions).

**Estado:** produccion está BIEN (esas tablas/columnas existen). El journal de Drizzle
(migrations/meta) está desincronizado respecto a produccion. La migración `0011_breezy_songbird.sql`
generada contiene ese drift — **no aplicar** (usaría IF NOT EXISTS… falla) y NO está registrada
en el journal (fue sobrescrita por 0012).

**Norma adoptada:** para core se aplican las migraciones manualmente a Neon
(`psql -f migrations/XXXX.sql`) y el archivo se incluye en el repo; el journal se documenta
aquí. Antes de volver a `db:generate`/`db:migrate` en core, **resolver el drift completo**
(snapshots en `migrations/meta`).

**Recuperación:** 1) Comparar `meta/_journal.json` vs `information_schema` real. 2) Generar
una migración de "sincronización de journal" o marcar las existentes. 3) Solo entonces
regresar al flujo drizzle-kit normal.

**Relacionado:** `0012_notification_v21_infra.sql` (outbox + deliveries, P0 notificaciones —
aplicada manualmente y incluida).
