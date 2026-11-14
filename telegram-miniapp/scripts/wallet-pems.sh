#!/usr/bin/env bash
#
# Genera los PEM que Vercel necesita para firmar los .pkpass de Wallet.
#
#   bash telegram-miniapp/scripts/wallet-pems.sh <ruta.p12> <contraseña> [pass.type.id]
#
# Ejemplo:
#   bash telegram-miniapp/scripts/wallet-pems.sh ~/Downloads/pass.p12 miapp pass.com.rabbitty.membership
#
# Requisitos: openssl, curl. El .p12 sale de Llavero → exportar el certificado
# "Pass Type ID: <id>" con su llave privada.
set -euo pipefail

P12="${1:-}"
P12_PASS="${2:-}"
PASS_TYPE_ID="${3:-pass.com.rabbitty.membership}"
TEAM_ID="${APPLE_WALLET_TEAM_ID:-FW97275K5X}"

if [[ -z "$P12" || -z "$P12_PASS" ]]; then
  echo "Uso: $0 <ruta.p12> <contraseña> [pass.type.id]" >&2
  exit 1
fi
if [[ ! -f "$P12" ]]; then
  echo "No existe el archivo: $P12" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "▸ Extrayendo certificado y llave…"
openssl pkcs12 -in "$P12" -clcerts -nokeys -passin "pass:$P12_PASS" -out "$TMP/cert.pem" 2>/dev/null
openssl pkcs12 -in "$P12" -nocerts -nodes -passin "pass:$P12_PASS" -out "$TMP/key.pem" 2>/dev/null

# ── Validaciones ──
SUBJECT="$(openssl x509 -in "$TMP/cert.pem" -noout -subject)"
echo "  $SUBJECT"

if ! grep -q "BEGIN CERTIFICATE" "$TMP/cert.pem" || ! grep -q "BEGIN" "$TMP/key.pem"; then
  echo "✗ El .p12 no contenía certificado + llave privada." >&2
  exit 1
fi

UID_LINE="$(openssl x509 -in "$TMP/cert.pem" -noout -subject | tr ',' '\n' | grep -m1 'UID=' | sed 's/.*UID=//' | tr -d ' ')"
if [[ "$UID_LINE" != "$PASS_TYPE_ID" ]]; then
  echo "✗ El certificado es de tipo '$UID_LINE', no del Pass Type ID '$PASS_TYPE_ID'." >&2
  echo "  Ese .p12 es de firma de apps, no de Wallet. Crea el certificado del Pass Type ID." >&2
  exit 1
fi
echo "  ✓ Pass Type ID coincide: $PASS_TYPE_ID"

if openssl x509 -in "$TMP/cert.pem" -noout -checkend 0 >/dev/null 2>&1; then
  echo "  ✓ Certificado vigente (vence $(openssl x509 -in "$TMP/cert.pem" -noout -enddate | cut -d= -f2))"
else
  echo "  ✗ El certificado está vencido." >&2
  exit 1
fi

# ── WWDR G4 (intermedio que Wallet exige) ──
echo "▸ Descargando Apple WWDR G4…"
curl -fsSL "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" -o "$TMP/wwdr.cer"
openssl x509 -inform der -in "$TMP/wwdr.cer" -out "$TMP/wwdr.pem"
echo "  ✓ $(openssl x509 -in "$TMP/wwdr.pem" -noout -subject)"

echo
echo "════════════════════════════════════════════════════════════"
echo "Pega estos 5 valores en Vercel → Settings → Environment Variables"
echo "(Production y Preview). Los PEM van completos, con sus BEGIN/END."
echo "════════════════════════════════════════════════════════════"
echo
echo "APPLE_WALLET_PASS_TYPE_ID=$PASS_TYPE_ID"
echo "APPLE_WALLET_TEAM_ID=$TEAM_ID"
echo
echo "APPLE_WALLET_CERT_PEM=$(cat "$TMP/cert.pem")"
echo
echo "APPLE_WALLET_KEY_PEM=$(cat "$TMP/key.pem")"
echo
echo "APPLE_WALLET_WWDR_PEM=$(cat "$TMP/wwdr.pem")"
