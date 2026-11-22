import Foundation
import Capacitor
import LocalAuthentication
import Security

/**
 * ── RabbittyBiometrics ──────────────────────────────────────────────────────
 * Puente nativo de biometría para la app POS/admin.
 *
 * Por qué existe: el WebView de la app de iPad en Mac ("Designed for iPad") no
 * implementa WebAuthn (`window.PublicKeyCredential` no existe), así que las
 * passkeys no pueden funcionar ahí. Este plugin usa LocalAuthentication del
 * sistema y guarda el token de dispositivo en el Keychain (nunca en
 * localStorage).
 *
 * Contrato JS (ver apps/admin/src/lib/native-biometrics.ts):
 *   isAvailable()            → { available, biometryType, reason }
 *   authenticate({ reason }) → { success, error? }
 *   setSecret({ key, value })→ { success }
 *   getSecret({ key })       → { value? }
 *   deleteSecret({ key })    → { success }
 *
 * Si el dispositivo no expone biometría (p. ej. una app de iPad en Mac), el JS
 * simplemente no muestra el botón: TOTP sigue siendo la vía.
 */
@objc(RabbittyBiometricsPlugin)
public class RabbittyBiometricsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RabbittyBiometricsPlugin"
    public let jsName = "RabbittyBiometrics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSecret", returnType: CAPPluginReturnPromise)
    ]

    private func keychainService(_ key: String) -> String { "me.rabbitty.pos.\(key)" }

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let can = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        var type = "none"
        if can {
            switch context.biometryType {
            case .faceID: type = "face"
            case .touchID: type = "touch"
            case .opticID: type = "optic"
            default: type = "none"
            }
        }

        call.resolve([
            "available": can,
            "biometryType": type,
            "reason": error?.localizedDescription ?? ""
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            call.resolve(["success": false, "error": "BIOMETRY_UNAVAILABLE"])
            return
        }

        let reason = call.getString("reason") ?? "Confirma tu identidad"
        DispatchQueue.main.async {
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { ok, authError in
                if ok {
                    call.resolve(["success": true])
                } else {
                    call.resolve(["success": false, "error": authError?.localizedDescription ?? "AUTH_FAILED"])
                }
            }
        }
    }

    @objc func setSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("MISSING_ARGS")
            return
        }

        let service = keychainService(key)
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        if status == errSecSuccess {
            call.resolve(["success": true])
        } else {
            call.resolve(["success": false, "error": "KEYCHAIN_ADD_\(status)"])
        }
    }

    @objc func getSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("MISSING_KEY")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService(key),
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else {
            call.resolve([:])
        }
    }

    @objc func deleteSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("MISSING_KEY")
            return
        }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService(key)
        ]
        SecItemDelete(query as CFDictionary)
        call.resolve(["success": true])
    }
}
