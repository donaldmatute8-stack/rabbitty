# Migraciones y guarda de esquema — el candado contra "desplegué sin migrar"

> Incidente del **2026-11-16**: se agregaron `staff.hourlyRate` y
> `staff.commissionPct` al esquema, se escribió la migración `0024`… y se aplicó a
> **`localhost`**. Producción nunca recibió las columnas. Como el código pedía la
> fila completa de `staff` en cada request, el POS dejó de abrir la terminal en el
> comercio. Se corrigió aplicando la migración a producción.

Lo que sigue es lo que evita que vuelva a pasar.

---

## 1. Por qué pasó (y no fue "un descuido" aislado)

| Causa | Consecuencia |
|---|---|
| Las migraciones se aplicaban **a mano**, con la URL que hubiera en `.env.local` | Se aplicaron a `localhost` sin que nada lo impidiera |
| El código pedía **la fila completa** (`select()` sin columnas) en el contexto de tRPC | Un drift de esquema tumba **todo** el admin/POS, no una pantalla |
| Nada comparaba el esquema del código contra la base real | El desajuste se descubrió con el comercio sin poder cobrar |
| Ya había drift previo sin detectar | Faltaba la tabla `printers` en producción (la página de impresoras estaba rota) y `reservations` tenía otra forma |

---

## 2. Las tres piezas

### a) `scripts/sql-migrate.mjs` — aplicar migraciones sin equivocarse de base

- **El destino es obligatorio y se imprime**: `--target local | prod | env`.
- **Guarda anti-confusión**: si pides `--target prod` y la URL es local (o al
  revés), **aborta**. Es exactamente el error que causó el incidente.
- **Libro mayor** `_sql_migrations`: cada archivo aplicado queda con checksum.
  Re-ejecutar es inocuo; los pendientes se listan antes de tocar nada.
- **Línea base** (`--baseline-through <archivo>`): registra lo ya aplicado a mano
  sin ejecutarlo, para arrancar el libro mayor sin repetir historia.

```bash
# ver qué falta (no ejecuta nada)
node scripts/sql-migrate.mjs --target prod --db restaurant

# aplicar
node scripts/sql-migrate.mjs --target prod --db restaurant --apply
```

### b) `scripts/schema-guard.mjs` — el código y la base deben coincidir

Lee el esquema real de Drizzle (no una copia) y lo compara contra
`information_schema`. Si el código pide tablas o columnas que la base no tiene,
**sale con código 1**.

```bash
node scripts/schema-guard.mjs --target prod --all
```

### c) `scripts/predeploy.mjs` — el candado

Corre en Railway como **pre-deploy** (`railway.json` → `deploy.preDeployCommand`).
Si falla, **el despliegue no procede** y producción sigue con la versión anterior.

Secuencia: migrar pendientes → verificar esquema, para `restaurant` y `core`.

- Solo actúa en el servicio `rabbitty-admin`; en los demás sale sin hacer nada.
- Si las URLs no están en el entorno del servicio admin, **falla a propósito**:
  desplegar código sin poder migrar es justo lo que rompió producción.

---

## 3. Resultado del primer barrido (2026-11-16)

| Hallazgo | Acción |
|---|---|
| `staff.hourlyRate`, `staff.commissionPct` ausentes en producción | aplicado `0024` (era la causa del POS caído) |
| Tabla `printers` ausente → página de impresoras rota | aplicado `0023` |
| `reservations` con forma de Bunz, sin las columnas del restaurante | aplicado `0025` (aditivo, nullable) |
| `wishlist_shares.updatedAt` ausente | aplicado `0018` (core) |
| `staff` leído con `select()` en cada request | columnas explícitas en el contexto tRPC y al abrir turno de caja |

Después del barrido: **`restaurant` y `core` sin desajustes**.

---

## 4. Deuda conocida (decisión pendiente)

`reservations` es **una sola tabla** para dos cosas distintas: reservas de Bunz
(`packages/database-core`: `businessId`, `title`, `bunzCost`) y reservas de mesa
del restaurante (`packages/database-restaurant`: `branchId`, `partySize`…). Hoy
conviven porque `0025` agregó las columnas del restaurante como nullable.

El arreglo de fondo es separarlas (p. ej. `table_reservations` para el
restaurante) con su migración y su cambio de código, y volver a correr la guarda.
Mientras tanto ninguna de las dos rompe: la de mesa filtra por `branchId` y las
filas viejas de Bunz lo tienen en `NULL`.

---

## 5. Reglas para el equipo (cortas y no negociables)

1. **Ninguna migración se aplica "a mano"** con la URL que esté a la mano. Se usa
   el runner con `--target` explícito.
2. **Toda migración es aditiva e idempotente**: `CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, con default o nullable. Nada destructivo en el
   mismo deploy que el código que lo necesita.
3. **Nunca `select()` completo en rutas calientes** (contexto tRPC, abrir turno,
   cobro). Se piden las columnas que se usan. Un drift así deja de tumbar el
   comercio.
4. **Si la guarda falla, no se "arregla" desactivándola**: se escribe la
   migración que falta.
