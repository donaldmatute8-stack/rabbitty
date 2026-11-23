# Build 1.4 — biometría nativa (Touch ID / Face ID) en la app POS

> Estado: **código listo, no incluido en un build todavía** (2026-11-22)
> Aplica a `com.rabbitty.pos` (app POS/admin). Próximo build: **1.4 (5)**.

---

## 1. Por qué existe

El WebView de la app de iPad en Mac (“Designed for iPad”) **no implementa WebAuthn**:
`window.PublicKeyCredential` no existe (verificado con `/biometric-check`). Por eso las
passkeys no funcionan ahí, aunque el entitlement y el AASA estén correctos.

Solución: puente nativo con `LocalAuthentication` + Keychain. Touch ID/Face ID lo pide el
sistema operativo, no el WebView.

---

## 2. Qué quedó implementado

| Pieza | Archivo | Estado |
|---|---|---|
| Plugin Swift (biometría + Keychain) | `apps/admin/ios/App/App/RabbittyBiometricsPlugin.swift` | ✅ compila (archive de prueba OK) |
| Registro en el proyecto Xcode | `App.xcodeproj/project.pbxproj` (Sources del target App) | ✅ |
| Wrapper JS tolerante a ausencia del plugin | `apps/admin/src/lib/native-biometrics.ts` | ✅ |
| Botón “Entrar con Touch ID/Face ID” | `apps/admin/src/app/verify-2fa/page.tsx` | ✅ (solo aparece si el binario trae el plugin y hay token) |
| Enrolamiento tras TOTP | mismo archivo (`action: "enroll"`) | ✅ |
| Endpoint de token de dispositivo | `apps/admin/src/app/api/auth/2fa/device/route.ts` | ✅ |

Comportamiento en el binario actual (1.3): el plugin **no existe**, `nativeBiometricsAvailable()`
devuelve `false`, no se muestra el botón y todo sigue con TOTP. Sin regresiones.

---

## 3. Cómo funciona

```
1) TOTP correcto
   → POST /api/auth/2fa/device { action: "enroll" }   (usa la cookie god2fa recién emitida)
   → token firmado (HMAC, 30 días, ligado al correo)
   → se guarda en el Keychain del dispositivo (no en localStorage)

2) Siguiente entrada
   → el plugin pide Touch ID / Face ID
   → lee el token del Keychain
   → POST /api/auth/2fa/device { action: "redeem", token }
   → cookie god2fa (12 h) → entra sin teclear el código
```

Seguridad:

- El token solo se emite con la cookie `god2fa` vigente (es decir, tras un TOTP real).
- HMAC con `GOD_DEVICE_SECRET` (o `RABBITTY_API_SECRET` si no existe).
- Caducidad 30 días; rotar el secreto invalida **todos** los dispositivos.
- Keychain con `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- La biometría la valida el sistema; si falla, se cae a TOTP sin bloquear.

---

## 4. Antes de compilar la 1.4

1. **Variable de entorno** (Railway · admin · production):
   `GOD_DEVICE_SECRET` = cadena aleatoria de 32+ caracteres.
   (Si no se define, usa `RABBITTY_API_SECRET`; definirla permite revocar tokens sin tocar el resto.)
2. **`Info.plist`**: ya tiene `NSFaceIDUsageDescription` (Face ID). Touch ID no requiere texto.
3. **Verificar el plugin en el target** (por si un `npx cap sync` regenerara archivos):
   ```bash
   grep -c "RabbittyBiometricsPlugin.swift" apps/admin/ios/App/App.xcodeproj/project.pbxproj
   # debe dar >= 3 (build file, file reference, sources)
   ```
4. **Compilar de prueba** (sin subir):
   ```bash
   cd apps/admin/ios/App
   xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
     -destination 'generic/platform=iOS' -archivePath build/probe.xcarchive \
     archive CODE_SIGNING_ALLOWED=NO
   nm -gU build/probe.xcarchive/Products/Applications/App.app/App | grep RabbittyBiometrics | head -3
   ```

---

## 5. Build y publicación

1. `CURRENT_PROJECT_VERSION` **4 → 5**; `MARKETING_VERSION` **1.3 → 1.4**
   en `apps/admin/ios/App/App.xcodeproj/project.pbxproj`.
2. Archive + export/upload:
   ```bash
   xcodebuild -project App.xcodeproj -scheme App -configuration Release \
     -destination 'generic/platform=iOS' -archivePath build/RabbittyPOS-1.4-5.xcarchive \
     archive -allowProvisioningUpdates
   xcodebuild -exportArchive -archivePath build/RabbittyPOS-1.4-5.xcarchive \
     -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates
   ```
3. Publicar con el script (adjunta build, notas y App Review Info):
   ```bash
   ASC_KEY_ID=N7TA398ARA ASC_ISSUER_ID=<issuer> \
   node scripts/asc-release.mjs --bundle com.rabbitty.pos --version 1.4 --build 5 \
     --whats-new "Entra con Touch ID / Face ID\n• Desbloqueo biométrico nativo...\n" \
     --submit
   ```

---

## 6. Prueba en el dispositivo

| Paso | Esperado |
|---|---|
| Abrir la app en **iPad** | Tras TOTP, la siguiente entrada muestra “Entrar con Face ID/Touch ID” |
| Abrir la app en **Mac (Designed for iPad)** | Si el Mac expone biometría al binario, aparece el botón; si no, **no aparece** y se usa TOTP (no es un error) |
| Cancelar la biometría | Cae a TOTP sin bloquear |
| `/biometric-check` | `App nativa: sí · ios`; el resto sigue mostrando `NO existe` (WebAuthn), es lo esperado |

> El punto abierto: no sabemos si macOS expone biometría a una app “Designed for iPad”.
> El *probe* del plugin lo resuelve en el primer arranque: si no hay biometría, el botón no se pinta.

---

## 7. App Review (notas sugeridas)

> “Biometric authentication is optional and only used to unlock the merchant’s own admin session
> on that device. It is not used for purchases, paywalls or content. TOTP remains available as a
> fallback.”

---

## 8. Rollback

- **Código**: no hay feature flag; el botón depende de que el binario tenga el plugin. Un build sin
  el plugin (o el 1.3 actual) se comporta exactamente como antes.
- **Tokens**: rotar `GOD_DEVICE_SECRET` invalida todos los tokens emitidos.
- **Dispositivo**: borrar el token del Keychain se hace al cerrar sesión y desde
  `forgetDeviceToken()`.

---

## 9. Pendiente / fuera de alcance

- Passkeys en el WebView: imposible en “Designed for iPad” (limitación de WebKit).
- Build Mac Catalyst/nativa: única vía para WebAuthn real en Mac (evaluar más adelante).
- `trustedSessions.verify` tiene la comparación de expiración invertida
  (`lt(expiresAt, now)` valida solo las vencidas). No se usa en este flujo, pero conviene corregirlo
  cuando se toque ese router.
