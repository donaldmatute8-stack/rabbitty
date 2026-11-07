/**
 * MCCE · Contrato para el afiliado (v1.0).
 *
 * Texto estable y versionado. Al firmar se guarda versión + hash + evidencia.
 * La caracterización legal definitiva requiere revisión en México.
 */

export const MCCE_CONTRACT_VERSION = "2026.11-v1";

export const MCCE_CONTRACT_TEXT = `ACUERDO DE CAPACIDAD COMERCIAL RABBITTY — v1.0

1. Partes. Rabbitty y el negocio identificado en el alta.

2. Objeto. Rabbitty habilita al negocio una capacidad para recibir redenciones de Bunz de los usuarios Rabbitters. El negocio no compra Bunz ni recibe un préstamo de dinero. La capacidad se expresa en Bunz y no implica una equivalencia con pesos.

3. Componentes. La capacidad puede incluir:
   a) Incentivo de incorporación: capacidad condicionada, sin compromiso de devolución automática, sujeta a evaluación y actividad.
   b) Capacidad adelantada: capacidad que Rabbitty habilita y que el negocio recupera con actividad elegible, conforme a este acuerdo.

4. Uso. El negocio acepta redenciones de Bunz hasta la capacidad disponible, en las condiciones de horario, productos y precios publicados. No puede condicionar, discriminar ni inflar precios para el canje.

5. Capacidad generada. Cuando un Rabbiter consume fiat en el negocio y se emite una recompensa, el negocio genera capacidad nueva. Una parte puede destinarse a recuperar la capacidad adelantada; el resto queda disponible.

6. Protección de lo comprometido. Ninguna recuperación, reducción o suspensión puede afectar redenciones ya comprometidas. Primero se protege a los Rabbitters; después se ajusta la capacidad futura.

7. Incentivo condicionado. El incentivo tiene una ventana de evaluación. Puede reducirse o retirarse la parte no comprometida si el negocio no activa su cuenta, no registra actividad o incumple las condiciones. No se retira retroactivamente lo comprometido.

8. Recuperación. La capacidad adelantada se recupera con una parte de la capacidad generada por actividad elegible, o con una fuente independiente que las partes acuerden por escrito. No genera intereses por defecto. No se amplía automáticamente.

9. Suspensión y declive. Rabbitty puede suspender nuevas autorizaciones o rechazar una solicitud cuando no se cumplan las condiciones, haya riesgo de concentración o falta de cobertura. La suspensión no extingue redenciones ya comprometidas.

10. Terminación. Al terminar, se cierran las autorizaciones futuras y se concilian la capacidad comprometida y la recuperación pendiente. Los Rabbitters conservan el derecho a redimir lo comprometido.

11. Evidencia y firma. El negocio acepta este acuerdo con su nombre completo y, cuando esté disponible, verificación biométrica del dispositivo (Face ID / Touch ID). Se registran versión, hash del contrato, fecha, hora, IP y agente.

12. Datos. El tratamiento de datos se rige por el aviso de privacidad de Rabbitty.

13. Legislación. México. La caracterización legal definitiva de la capacidad adelantada será revisada por asesoría legal antes de su activación.

RESUMEN EN LENGUAJE SIMPLE
Te damos capacidad para recibir a los Rabbitters. No compras Bunz. Una parte es un incentivo de bienvenida y otra es capacidad adelantada que vas recuperando con tu actividad. Lo que ya está comprometido con los Rabbitters se protege siempre.`;

export const MCCE_CONTRACT_SUMMARY =
  "Te damos capacidad para recibir a los Rabbitters. No compras Bunz. Una parte es un incentivo de bienvenida y otra es capacidad adelantada que vas recuperando con tu actividad. Lo que ya está comprometido se protege siempre.";

/** Hash estable del contrato para evidencia. */
export async function hashContract(text: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fallback */
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}
