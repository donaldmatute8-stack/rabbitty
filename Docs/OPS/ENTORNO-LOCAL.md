# Entorno local (sin consumir Neon)

> Objetivo: desarrollar y depurar en el MacBook **sin despertar ni gastar cuota de
> Neon**, con el mismo esquema que producción. Nace del incidente del 17-nov-2026:
> producción se quedó sin `RESTAURANT_DATABASE_URL`, la app del cliente falló con
> `ECONNREFUSED 127.0.0.1:5432` y el pedido moría con "no se pudo completar".
> Hasta entonces el entorno local apuntaba a un cluster de Neon que ya no existe.

## Qué quedó montado

| Pieza | Valor |
|---|---|
| Servidor | Postgres 16 de Homebrew (`localhost:5432`) |
| Base core | `rabbitty_core` |
| Base restaurante | `rabbitty_restaurant` |
| Rol de la app | `rabbitty` / `rabbitty_dev` (creado por el setup de `.env.example`) |
| Extensiones | `vector` (pgvector 0.8.7 compilado para `postgresql@16`) |
| Esquema | clon **schema-only** de producción (`ep-square-fog-bbrges04`, PG 18.7 → local 16.10) |
| Datos | sólo referencia de 626 Café: negocio, 3 sucursales, 12 mesas, 218 platillos, planes de membresía |

Copiar el esquema (no los datos) evita tener PII de clientes en el portátil, y
como en producción core y restaurante viven en la **misma** base, las dos bases
locales llevan el esquema completo: así una query que en prod cruza tablas no
falla sólo por estar en local.

Las URLs viven en `telegram-miniapp/.env.local` y `apps/admin/.env.local`
(ambos ignorados por git). Los respaldos de las bases anteriores están en
`.local-backups/`.

## Variables de entorno: una sola base, ningún tenant

`RESTAURANT_DATABASE_URL` **no es por inquilino**. La app es multi-tenant por
filas: todos los negocios viven en la misma base y se separan por `businessId` /
`branchId`. Añadir un negocio nuevo no requiere tocar variables ni desplegar.

Como hoy core y restaurante comparten base (`neondb`), el pool de restaurante
cae a `DATABASE_URL` y, si tampoco existe, a `CORE_DATABASE_URL` (en ese orden).
Es decir: **basta `CORE_DATABASE_URL` por entorno**; `RESTAURANT_DATABASE_URL`
sólo haría falta el día que se separen en dos bases distintas. El log
`[DB_CONFIG] restaurant: … → host` dice de dónde salió, así que un fallback no
pasa desapercibido.

## Cómo se regenera

```bash
# 1. Esquema desde producción (usa una credencial con DDL; leerla de Railway)
railway variables --service rabbitty-admin --environment production --json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log(v.MIGRATE_RESTAURANT_DATABASE_URL||v.RESTAURANT_DATABASE_URL)})" > /tmp/prod_url

/opt/homebrew/opt/postgresql@18/bin/pg_dump --schema-only --no-owner --no-privileges --no-acl \
  "$(cat /tmp/prod_url)" -f /tmp/prod_schema.sql   # pg_dump 18: el cluster es PG 18

for db in rabbitty_core rabbitty_restaurant; do
  psql -h 127.0.0.1 -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db OWNER rabbitty"
  psql -h 127.0.0.1 -d "$db" -q -f /tmp/prod_schema.sql
  psql -h 127.0.0.1 -d "$db" -q -c 'GRANT ALL ON SCHEMA public TO rabbitty' \
    -c 'GRANT ALL ON ALL TABLES IN SCHEMA public TO rabbitty' \
    -c 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rabbitty'
done

# 2. Datos de referencia de 626 Café (idempotente, sólo local)
PROD_URL="$(cat /tmp/prod_url)" TARGET_DB=rabbitty_restaurant ./scripts/local-seed-626.sh
PROD_URL="$(cat /tmp/prod_url)" TARGET_DB=rabbitty_core       ./scripts/local-seed-626.sh
```

`scripts/local-seed-626.sh` aborta si el destino no es una base `rabbitty_*`
local, y vacía sólo sus tablas antes de recopiarlas.

## Comprobación

```bash
curl -s localhost:3000/api/health              # {"status":"ok", checks core+restaurant}
curl -s localhost:3000/api/health?strict=1 -o /dev/null -w '%{http_code}\n'   # 200
```

En los logs del server aparece de qué variable salió cada conexión:

```
[DB_CONFIG] core: CORE_DATABASE_URL → localhost:5432
[DB_CONFIG] restaurant: RESTAURANT_DATABASE_URL → localhost:5432
```

## Fallos que este diseño hace evidentes

- **Falta la variable** → `[DB_CONFIG] Falta la conexión a la base de datos de
  "X"` y, en `/api/health`, `checks.<base>.error = "config_missing"`. Las queries
  caen contra `db-config-missing.invalid` (`getaddrinfo ENOTFOUND`), no contra
  `127.0.0.1` — así nadie confunde configuración con base caída.
- **Base caída o cuota agotada** → `db_unreachable`, con la causa real en una
  sola línea (`describeError` desenvuelve el `cause` de Drizzle/pg).

## Pendiente

- **Sesión para probar la app en local**: el login real es por Telegram
  (`initData`) o por token de `webSessions`. Sin sembrar una sesión, las pantallas
  autenticadas no se pueden recorrer en localhost. Falta decidir si se añade un
  bypass de desarrollo (sólo con `NODE_ENV=development`) o un script que cree una
  `webSessions` de prueba.
- Las tablas de **clientes, órdenes, Bunz y ledger no se copian**: si hace falta
  reproducir un caso con datos reales, copiarlas a mano y borrarlas al terminar.
