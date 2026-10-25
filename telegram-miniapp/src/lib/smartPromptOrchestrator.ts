type ModalType = 'mood' | 'faceid' | 'notifications';

interface PromptConfig {
  minVisits?: number;
  cooldownHours: number;
}

const STORAGE_KEYS = {
  VISIT_COUNT: 'rabbitty_app_visit_count',
  ACTIVE_MODAL: 'rabbitty_active_modal',
  LAST_PROMPT_PREFIX: 'rabbitty_prompt_last_',
};

const PROMPT_CONFIGS: Record<ModalType, PromptConfig> = {
  // Rabbitty Mood: Aparece 1 vez al día tras explorar un momento
  mood: { cooldownHours: 20 },
  // Face ID / Biometría: Aparece tras familiarizarse (mínimo 2da sesión) o tras una acción de valor
  faceid: { minVisits: 2, cooldownHours: 48 },
  // Turn on notifications: Importante pero jamás invasivo (mínimo 2da visita o tras ganar bunz)
  notifications: { minVisits: 2, cooldownHours: 72 },
};

export class SmartPromptOrchestrator {
  private static isLocked = false;

  /**
   * Registra una visita en la sesión actual
   */
  static recordVisit(): number {
    if (typeof window === 'undefined') return 1;
    try {
      const count = parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '0', 10) + 1;
      localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, String(count));
      return count;
    } catch {
      return 1;
    }
  }

  static getVisitCount(): number {
    if (typeof window === 'undefined') return 1;
    try {
      return parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '1', 10);
    } catch {
      return 1;
    }
  }

  /**
   * Evalúa si un modal tiene permiso para abrirse sin chocar con otros
   */
  static canShow(type: ModalType): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isLocked) return false;

    try {
      const config = PROMPT_CONFIGS[type];
      const visits = this.getVisitCount();

      if (config.minVisits && visits < config.minVisits) {
        return false;
      }

      // Comprobar cooldown
      const lastShown = localStorage.getItem(`${STORAGE_KEYS.LAST_PROMPT_PREFIX}${type}`);
      if (lastShown) {
        const lastMs = parseInt(lastShown, 10);
        if (!isNaN(lastMs)) {
          const hoursPassed = (Date.now() - lastMs) / (1000 * 60 * 60);
          if (hoursPassed < config.cooldownHours) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reclama el turno de visualización. Bloquea que cualquier otro modal se abra a la vez.
   */
  static acquireLock(type: ModalType): boolean {
    if (this.isLocked) return false;
    this.isLocked = true;
    try {
      localStorage.setItem(
        `${STORAGE_KEYS.LAST_PROMPT_PREFIX}${type}`,
        String(Date.now())
      );
    } catch {}
    return true;
  }

  /**
   * Libera el turno para que en futuras sesiones o flujos pueda presentarse otro.
   */
  static releaseLock(): void {
    this.isLocked = false;
  }

  /**
   * Marca el prompt como completado exitosamente (no volver a pedir nunca)
   */
  static markCompleted(type: ModalType): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_KEYS.LAST_PROMPT_PREFIX}${type}_completed`, 'true');
    } catch {}
    this.releaseLock();
  }

  static isCompleted(type: ModalType): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(`${STORAGE_KEYS.LAST_PROMPT_PREFIX}${type}_completed`) === 'true';
    } catch {
      return false;
    }
  }
}
