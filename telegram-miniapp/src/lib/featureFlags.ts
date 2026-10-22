/**
 * Centralized Feature Flags & Circuit Breakers for Rabbitty Client & Backend
 * Permite encender o apagar en caliente funcionalidades nuevas (biometría, mapa 3d,
 * animaciones complejas, etc.) sin tumbar el sistema en caso de fallos.
 */

export interface FeatureFlags {
  enableBiometrics: boolean;
  enable3DGlobe: boolean;
  enablePushNotifications: boolean;
  enableDynamicAudioRitual: boolean;
  enableDirectPOSBunzCheckout: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enableBiometrics: true,
  enable3DGlobe: true,
  enablePushNotifications: true,
  enableDynamicAudioRitual: true,
  enableDirectPOSBunzCheckout: false, // Apagado por seguridad contable (CA-0)
};

export const RabbittyGuard = {
  /**
   * Obtiene el estado actual de una bandera (con fallback seguro en memoria y LocalStorage)
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    if (typeof window === 'undefined') {
      return DEFAULT_FLAGS[flag];
    }

    try {
      // 1. Revisar override forzado por URL (ej. ?flag_enable3DGlobe=false) para debug
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get(`flag_${flag}`);
      if (urlParam === 'true') return true;
      if (urlParam === 'false') return false;

      // 2. Revisar configuración local guardada
      const stored = localStorage.getItem(`rabbitty_flag_${flag}`);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // Fallback a defecto seguro
    }

    return DEFAULT_FLAGS[flag];
  },

  /**
   * Ejecuta una acción dentro de un Circuit Breaker.
   * Si la función falla repetidamente, se apaga temporalmente la función
   * evitando loops de recarga o pantallazos en blanco.
   */
  async runSafe<T>(
    operationName: string,
    operation: () => Promise<T>,
    fallbackValue: T
  ): Promise<T> {
    const errorKey = `rabbitty_cb_${operationName}_errors`;
    try {
      const errorCount = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem(errorKey) || '0', 10) : 0;
      if (errorCount >= 3) {
        console.warn(`[CircuitBreaker] Operation '${operationName}' is tripped (open). Falling back to safe value.`);
        return fallbackValue;
      }

      const result = await operation();
      // Si tuvo éxito, limpiar errores previos
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(errorKey);
      }
      return result;
    } catch (err) {
      console.error(`[CircuitBreaker] Error in operation '${operationName}':`, err);
      if (typeof window !== 'undefined') {
        const count = parseInt(sessionStorage.getItem(errorKey) || '0', 10);
        sessionStorage.setItem(errorKey, String(count + 1));
      }
      return fallbackValue;
    }
  },

  /**
   * Resetea el contador de errores del circuit breaker manualmente (útil para dev/QA)
   */
  reset(operationName?: string): void {
    if (typeof window === 'undefined') return;
    try {
      if (operationName) {
        sessionStorage.removeItem(`rabbitty_cb_${operationName}_errors`);
        localStorage.removeItem(`rabbitty_cb_${operationName}_errors`);
        console.log(`[CircuitBreaker] Reset counter for '${operationName}'`);
      } else {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith('rabbitty_cb_')) sessionStorage.removeItem(k);
        });
        console.log('[CircuitBreaker] Reset all circuit breakers');
      }
    } catch {}
  },
};

// Exponer en window para debugging fácil desde DevTools / QA (solo en entornos no productivos o de desarrollo)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { RabbittyGuard?: typeof RabbittyGuard }).RabbittyGuard = RabbittyGuard;
}
