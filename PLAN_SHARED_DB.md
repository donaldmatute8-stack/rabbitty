# Shared DB Migration Plan — Mini App → Core DB

## Problem
Mini app tiene su propia DB PostgreSQL (16 tablas) separada de las 2 DBs del software principal (restaurant + core). Datos duplicados: users, transactions, referrals, levels, achievements existen en ambos lados.

## Goal
Unificar para que mini app use `@rabbitty/database-core` directamente, eliminando su schema independiente.

## Migration Steps

### Phase 1: Schema Audit (Pre-migration)
1. Mapear cada tabla de mini app a su equivalente en core/restaurant DB:
   - `users` → core.users (agregar campos faltantes: telegramId, firstName, lastName, tonWalletAddress, hops, levelId)
   - `ownedBusinesses` → no existe en core, crear tabla nueva
   - `transactions` → core.transactions (ya existe, alinear campos)
   - `conversations` + `messages` → nuevo en core
   - `qrSessions` → nuevo en core
   - `webSessions` → nuevo en core
   - `reservations` → restaurant.reservations (ya existe)
   - `referrals` → core.referrals (ya existe)
   - `notifications` → nuevo en core
   - `pendingVaults` → nuevo en core
   - `levels` → core.levels (ya existe)
   - `hatTricks` + `userHatTricks` → nuevo en core
   - `achievements` → core.achievements (ya existe)
   - `userAchievements` → nuevo en core

### Phase 2: Schema Migration
2. Agregar tablas faltantes a `packages/database-core/src/schema.ts`
3. Agregar tablas faltantes a `packages/database-restaurant/src/schema.ts`
4. Generar migración Drizzle: `pnpm --filter @rabbitty/database-core db:generate`
5. Aplicar migración: `pnpm --filter @rabbitty/database-core db:migrate`

### Phase 3: Data Migration
6. Exportar datos de mini app DB: todas las tablas
7. Transformar IDs para evitar conflictos (mini app usa UUID, core usa serial/ULID)
8. Importar a core DB con nuevos IDs
9. Verificar integridad referencial

### Phase 4: Code Migration
10. Actualizar `telegram-miniapp/src/db/schema.ts` para importar desde `@rabbitty/database-core` en lugar de schema local
11. Actualizar `telegram-miniapp/src/db/index.ts` para usar `CORE_DATABASE_URL` en lugar de `DATABASE_URL`
12. Eliminar schema duplicado de mini app
13. Actualizar importaciones en todos los archivos de mini app

### Phase 5: Validation
14. Desplegar mini app actualizada en staging
15. Ejecutar tests end-to-end
16. Verificar que todas las features funcionan
17. Desplegar a producción

## Risk Assessment
- **HIGH**: Cambiar DB de mini app en producción requiere downtime o migración en caliente
- **MEDIUM**: IDs pueden colisionar — usar UUIDs consistentes
- **LOW**: Las tablas duplicadas (users, transactions) tienen estructuras similares

## Recommendation
Ejecutar Phase 1 ahora (audit), dejar Phase 2-5 para cuando haya ventana de mantenimiento.
