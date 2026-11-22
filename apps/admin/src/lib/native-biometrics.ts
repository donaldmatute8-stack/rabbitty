/**
 * ── Puente nativo de biometría (opcional) ──
 *
 * El WebView de la app de iPad en Mac ("Designed for iPad") NO implementa
 * WebAuthn: `window.PublicKeyCredential` no existe, así que las passkeys no
 * pueden funcionar ahí. Este módulo usa el plugin nativo
 * `RabbittyBiometrics` (LocalAuthentication + Keychain) cuando el binario lo
 * incluye.
 *
 * Regla: si el plugin no está en el binario, todo devuelve null/false y la UI
 * se queda en TOTP. Nunca lanza.
 */

export type NativeBiometrics = {
  isAvailable: () => Promise<{ available: boolean; biometryType: string; reason?: string }>;
  authenticate: (options: { reason?: string }) => Promise<{ success: boolean; error?: string }>;
  setSecret: (options: { key: string; value: string }) => Promise<{ success: boolean; error?: string }>;
  getSecret: (options: { key: string }) => Promise<{ value?: string }>;
  deleteSecret: (options: { key: string }) => Promise<{ success: boolean }>;
};

/** Llave en el Keychain del dispositivo. */
export const DEVICE_TOKEN_KEY = "god2fa_device";

export function getNativeBiometrics(): NativeBiometrics | null {
  if (typeof window === "undefined") return null;
  const plugin = (window as any)?.Capacitor?.Plugins?.RabbittyBiometrics;
  return plugin ?? null;
}

export async function nativeBiometricsAvailable(): Promise<{ available: boolean; biometryType: string }> {
  const plugin = getNativeBiometrics();
  if (!plugin) return { available: false, biometryType: "none" };
  try {
    const res = await plugin.isAvailable();
    return { available: Boolean(res?.available), biometryType: res?.biometryType ?? "none" };
  } catch {
    return { available: false, biometryType: "none" };
  }
}

export async function hasDeviceToken(): Promise<boolean> {
  const plugin = getNativeBiometrics();
  if (!plugin) return false;
  try {
    const res = await plugin.getSecret({ key: DEVICE_TOKEN_KEY });
    return Boolean(res?.value);
  } catch {
    return false;
  }
}

/** Guarda el token de dispositivo tras verificar el TOTP. */
export async function storeDeviceToken(token: string): Promise<boolean> {
  const plugin = getNativeBiometrics();
  if (!plugin) return false;
  try {
    const res = await plugin.setSecret({ key: DEVICE_TOKEN_KEY, value: token });
    return Boolean(res?.success);
  } catch {
    return false;
  }
}

export async function forgetDeviceToken(): Promise<void> {
  const plugin = getNativeBiometrics();
  if (!plugin) return;
  try {
    await plugin.deleteSecret({ key: DEVICE_TOKEN_KEY });
  } catch {
    /* noop */
  }
}

/** Pide biometría y devuelve el token guardado (sin exponerlo al servidor dos veces). */
export async function readDeviceTokenWithBiometrics(): Promise<string | null> {
  const plugin = getNativeBiometrics();
  if (!plugin) return null;
  try {
    const auth = await plugin.authenticate({ reason: "Confirma tu identidad para entrar a Rabbitty" });
    if (!auth?.success) return null;
    const res = await plugin.getSecret({ key: DEVICE_TOKEN_KEY });
    return res?.value ?? null;
  } catch {
    return null;
  }
}
