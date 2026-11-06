#!/usr/bin/env bash
# Captura semanal (M2). Solo lectura. Pensado para cron/launchd.
#
#   ./scripts/cron-weekly.sh
#
# Variables:
#   RESTAURANT_DATABASE_URL  (o se lee de apps/admin/.env.local)
#   CORE_REPLICA_URL         (opcional; sin ella los afiliados se derivan)
#   GIT_COMMIT               (opcional; por defecto el HEAD corto)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${RESTAURANT_DATABASE_URL:-}" ] && [ -f apps/admin/.env.local ]; then
  RESTAURANT_DATABASE_URL="$(grep -E '^RESTAURANT_DATABASE_URL=' apps/admin/.env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  export RESTAURANT_DATABASE_URL
fi
: "${RESTAURANT_DATABASE_URL:?falta RESTAURANT_DATABASE_URL}"

export GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
LABEL="$(date +%F)"

mkdir -p apps/admin/documents/validation

ARGS=(--restaurant-url "$RESTAURANT_DATABASE_URL" --documents-dir apps/admin/documents/validation --label "$LABEL")
if [ -n "${CORE_REPLICA_URL:-}" ]; then
  ARGS+=(--core-url "$CORE_REPLICA_URL")
fi

exec node scripts/capture-weekly.mjs "${ARGS[@]}"
