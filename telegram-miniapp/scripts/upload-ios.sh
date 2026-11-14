#!/usr/bin/env bash
#
# ── Sube la app iOS (miniapp) a App Store Connect ──────────────────────────
#
#   bash telegram-miniapp/scripts/upload-ios.sh
#
# Requisitos:
#   · Xcode con la cuenta de Apple Developer iniciada
#     (Xcode → Settings → Accounts). Firma automática: team FW97275K5X.
#   · Sin credenciales de sesión, exporta con una API key de App Store Connect:
#       export ASC_KEY_PATH=~/ruta/AuthKey_XXXX.p8
#       export ASC_KEY_ID=XXXX
#       export ASC_ISSUER_ID=xxxx-xxxx
#     y el script añade -authenticationKeyPath/-authenticationKeyID/
#     -authenticationKeyIssuerID al export.
#
# El build sube como 2.5 (18). Para el siguiente, sube
# CURRENT_PROJECT_VERSION en ios/App/App.xcodeproj/project.pbxproj.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Sincronizando Capacitor…"
npx cap sync ios

cd ios/App
rm -rf build

echo "▸ Archivando (Release)…"
xcodebuild \
  -project App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Rabbitty.xcarchive \
  archive

APP="$(find build/Rabbitty.xcarchive/Products/Applications -maxdepth 1 -name '*.app' | head -1)"
echo "▸ Verificando el binario: $APP"
plutil -p "$APP/Info.plist" | grep -A 3 UIBackgroundModes || true
plutil -p "$APP/Info.plist" | grep -E "CFBundleShortVersionString|CFBundleVersion" || true

EXTRA_AUTH=()
if [[ -n "${ASC_KEY_PATH:-}" && -n "${ASC_KEY_ID:-}" && -n "${ASC_ISSUER_ID:-}" ]]; then
  EXTRA_AUTH=(
    -authenticationKeyPath "$ASC_KEY_PATH"
    -authenticationKeyID "$ASC_KEY_ID"
    -authenticationKeyIssuerID "$ASC_ISSUER_ID"
  )
  echo "▸ Autenticando con API key ($ASC_KEY_ID)…"
else
  echo "▸ Autenticando con la cuenta de Xcode…"
fi

echo "▸ Exportando y subiendo a App Store Connect…"
xcodebuild \
  -exportArchive \
  -archivePath build/Rabbitty.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/upload \
  -allowProvisioningUpdates \
  "${EXTRA_AUTH[@]}"

echo "✔ Upload succeeded. Espera el procesamiento en App Store Connect."
