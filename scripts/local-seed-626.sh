#!/usr/bin/env bash
# Copia SOLO los datos de referencia de 626 Café desde producción a la base
# local `rabbitty_dev` (esquema ya clonado). No copia clientes, órdenes ni
# sesiones: únicamente el negocio, sus sucursales, menú y mesas.
#
# Uso: PROD_URL='postgres://...' [TARGET_DB=rabbitty_core] ./scripts/local-seed-626.sh
set -euo pipefail

if [ -z "${PROD_URL:-}" ]; then
  echo "Falta PROD_URL en el entorno" >&2
  exit 1
fi

BIZ="fb7f4847-920f-4482-8ae3-c810a20e75ad"
TMP="$(mktemp -d)"
TARGET_DB="${TARGET_DB:-rabbitty_restaurant}"
LOCAL=(psql -h 127.0.0.1 -d "$TARGET_DB" -v ON_ERROR_STOP=1 -q)

copy_table() {
  local table="$1" filter="$2"
  echo "→ $table"
  psql "$PROD_URL" -v ON_ERROR_STOP=1 -q \
    -c "\copy (select * from $table where $filter) to '$TMP/$table.csv' with (format csv)"
  "${LOCAL[@]}" -c "\copy $table from '$TMP/$table.csv' with (format csv)"
}

trap 'rm -rf "$TMP"' EXIT

# Guarda: esto copia datos ENCIMA de la base local, así que sólo se permite
# sobre bases locales con el prefijo del proyecto (nunca sobre Neon).
case "$TARGET_DB" in
  rabbitty_*) ;;
  *) echo "TARGET_DB debe empezar con 'rabbitty_' (recibido: $TARGET_DB)" >&2; exit 1 ;;
esac
if ! "${LOCAL[@]}" -tAc "select 1" | grep -q 1; then
  echo "No puedo conectar a la base local $TARGET_DB" >&2
  exit 1
fi
if "${LOCAL[@]}" -tAc "select coalesce(host(inet_server_addr()),'local')" | grep -qvE "^local$|^127\.0\.0\.1$|^::1$"; then
  echo "TARGET_DB no parece local. Abortado por seguridad." >&2
  exit 1
fi

# Idempotente: vaciamos sólo las tablas de referencia antes de recopiarlas.
"${LOCAL[@]}" -c "TRUNCATE users, \"ownedBusinesses\", restaurants, branches, tables, menu_categories, menu_items, menu_item_modifiers, menu_item_ingredients, membership_plans, membership_plan_versions, membership_referral_programs, membership_mission_rewards CASCADE"

BRANCHES="select id from branches where \"restaurantId\" = (select id from restaurants where \"businessId\" = '$BIZ')"
ITEMS="select id from menu_items where \"branchId\" in ($BRANCHES)"

copy_table 'users' "id = (select \"ownerId\" from \"ownedBusinesses\" where id = '$BIZ')"
copy_table '"ownedBusinesses"' "id = '$BIZ'"
copy_table 'restaurants' "\"businessId\" = '$BIZ'"
copy_table 'branches' "\"restaurantId\" = (select id from restaurants where \"businessId\" = '$BIZ')"
copy_table 'tables' "\"branchId\" in ($BRANCHES)"
copy_table 'menu_categories' "\"branchId\" in ($BRANCHES)"
copy_table 'menu_items' "\"branchId\" in ($BRANCHES)"
copy_table 'menu_item_modifiers' "\"itemId\" in ($ITEMS)"
copy_table 'menu_item_ingredients' "\"menuItemId\" in ($ITEMS)"
copy_table 'membership_plans' "\"businessId\" = '$BIZ'"
copy_table 'membership_plan_versions' "\"planId\" in (select id from membership_plans where \"businessId\" = '$BIZ')"
copy_table 'membership_referral_programs' "\"businessId\" = '$BIZ'"
copy_table 'membership_mission_rewards' "\"businessId\" = '$BIZ'"

echo "✔ Datos de referencia copiados"
"${LOCAL[@]}" -tAc "select 'sucursales=' || (select count(*) from branches) || ' platillos=' || (select count(*) from menu_items) || ' mesas=' || (select count(*) from tables)"
