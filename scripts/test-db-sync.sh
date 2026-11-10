#!/usr/bin/env bash
# Sincroniza el esquema de la base LOCAL de tests con el schema de Drizzle.
#
# Motivo: la base local se creó con `db:push` y quedó atrás (faltaban columnas
# como restaurants.businessType). Las suites de integración fallaban por eso,
# no por el código. Un rojo permanente deja de avisar.
#
# Seguridad: SOLO acepta localhost/127.0.0.1. Nunca apunta a producción.
# Uso:   bash scripts/test-db-sync.sh
#        (lo invoca `pnpm --filter @rabbitty/api test` como pretest)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="${RESTAURANT_DATABASE_URL:-postgres://rabbitty:rabbitty_dev@localhost:5432/rabbitty_restaurant}"

case "$URL" in
  *@localhost:*|*@127.0.0.1:*) ;;
  *)
    echo "✗ test-db-sync: solo bases locales (recibido: ${URL%%@*}@…)" >&2
    exit 2
    ;;
esac

echo "· sincronizando esquema de test en $(printf '%s' "$URL" | sed -E 's#^.*@([^/]+/[^?]+).*#\1#')"
cd "$ROOT/packages/database-restaurant"
RESTAURANT_DATABASE_URL="$URL" npx --yes drizzle-kit push --force
