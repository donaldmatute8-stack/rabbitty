#!/usr/bin/env bash
#
# Genera los 5 valores de Wallet desde el certificado que da Apple + tu llave.
#
#   bash telegram-miniapp/scripts/wallet-from-cer.sh <pass.cer> <rabbitty-wallet.key> [pass.type.id]
#
# Ejemplo:
#   bash telegram-miniapp/scripts/wallet-from-cer.sh ~/Downloads/pass.cer ~/Downloads/rabbitty-wallet.key pass.com.rabbitty.membership
#
# No hace falta exportar nada desde el Llavero: usa el .cer que descargas del
# portal y la llave con la que generaste el CSR.
set -euo pipefail

CER="${1:-}"
KEY="${2:-}"
PASS_TYPE_ID="${3:-pass.com.rabbitty.membership}"
TEAM_ID="${APPLE_WALLET_TEAM_ID:-FW97275K5X}"

if [[ -z "$CER" || -z "$KEY" ]]; then
  echo "Uso: $0 <pass.cer> <rabbitty-wallet.key> [pass.type.id]" >&2
  exit 1
fi
[[ -f "$CER" ]] || { echo "No existe: $CER" >&2; exit 1; }
[[ -f "$KEY" ]] || { echo "No existe: $KEY" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Apple entrega DER; aceptamos también PEM.
if grep -q "BEGIN CERTIFICATE" "$CER"; then
  cp "$CER" "$TMP/cert.pem"
else
  openssl x509 -inform der -in "$CER" -out "$TMP/cert.pem"
fi

echo "▸ Certificado:"
openssl x509 -in "$TMP/cert.pem" -noout -subject -enddate | sed 's/^/  /'

# ── El certificado debe ser del Pass Type ID (UID = pass.type.id) ──
UID_LINE="$(openssl x509 -in "$TMP/cert.pem" -noout -subject | tr ',' '\n' | grep -m1 'UID=' | sed 's/.*UID=//' | tr -d ' ' || true)"
if [[ "$UID_LINE" != "$PASS_TYPE_ID" ]]; then
  echo "✗ El certificado es de tipo '${UID_LINE:-desconocido}', no del Pass Type ID '$PASS_TYPE_ID'." >&2
  echo "  Descarga el certificado DENTRO del Pass Type ID, no el de Apple Development." >&2
  exit 1
fi
echo "  ✓ Pass Type ID coincide: $PASS_TYPE_ID"

# ── La llave debe corresponder al certificado ──
CERT_MOD="$(openssl x509 -in "$TMP/cert.pem" -noout -modulus | openssl md5)"
KEY_MOD="$(openssl rsa -in "$KEY" -noout -modulus 2>/dev/null | openssl md5)"
if [[ "$CERT_MOD" != "$KEY_MOD" ]]; then
  echo "✗ La llave no corresponde a este certificado (usa la llave del CSR)." >&2
  exit 1
fi
echo "  ✓ La llave coincide con el certificado"

if ! openssl x509 -in "$TMP/cert.pem" -noout -checkend 0 >/dev/null 2>&1; then
  echo "✗ El certificado está vencido." >&2
  exit 1
fi

echo "▸ Descargando Apple WWDR G4…"
curl -fsSL "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" -o "$TMP/wwdr.cer"
openssl x509 -inform der -in "$TMP/wwdr.cer" -out "$TMP/wwdr.pem"
echo "  ✓ $(openssl x509 -in "$TMP/wwdr.pem" -noout -subject)"

echo
echo "════════════════════════════════════════════════════════════"
echo "Pega estos 5 valores en Vercel → Settings → Environment Variables"
echo "(Production y Preview). Los PEM van completos."
echo "════════════════════════════════════════════════════════════"
echo
echo "APPLE_WALLET_PASS_TYPE_ID=$PASS_TYPE_ID"
echo "APPLE_WALLET_TEAM_ID=$TEAM_ID"
echo
echo "APPLE_WALLET_CERT_PEM=$(cat "$TMP/cert.pem")"
echo
echo "APPLE_WALLET_KEY_PEM=$(cat "$KEY")"
echo
echo "APPLE_WALLET_WWDR_PEM=$(cat "$TMP/wwdr.pem")"
