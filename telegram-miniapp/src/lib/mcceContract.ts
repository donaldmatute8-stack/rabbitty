/**
 * MCCE · Contrato dinámico para el afiliado (v1.1 draft).
 *
 * La plantilla se renderiza con los datos del participante y la oferta calculada
 * en el onboarding. El hash se calcula sobre el texto renderizado y se guarda
 * junto con la evidencia.
 *
 * Estado: borrador para revisión legal. No es un contrato ejecutable hasta que
 * `MCCE_CONTRACT_STATUS` cambie a "approved" y el texto aprobado coincida con
 * este archivo.
 */

export const MCCE_CONTRACT_VERSION = "2026.11-v1.2-draft";
export const RABBITTY_LEGAL_ENTITY = "MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V.";
export const RABBITTY_RFC = "MEB2402087Z3";
export const MCCE_CONTRACT_STATUS: "draft" | "approved" = "draft";

export type ContractData = {
  rabbittyEntity?: string;
  rabbittyRfc?: string;
  affiliateLegalName?: string;
  affiliateRfc?: string;
  affiliateAddress?: string;
  representative?: string;
  representativePosition?: string;
  businessName?: string;
  niche?: string;
  offerId?: string;
  offerDate?: string;
  capacityTotal?: number;
  promo?: number;
  credit?: number;
  provisioned?: number;
  coverageDays?: number;
  reviewDate?: string;
  recoveryTerms?: string;
  operationalTerms?: string;
  contactEmail?: string;
};

const MISSING = "[POR COMPLETAR]";

export const MCCE_CONTRACT_TEMPLATE = `ACUERDO MARCO DE PARTICIPACIÓN Y CAPACIDAD COMERCIAL RABBITTY
Versión {{CONTRACT_VERSION}} — Borrador para revisión legal
Estado: no aprobado para firma ni activación de capacidad real.

PARTES
Rabbitty: {{RABBITTY_ENTITY}} (RFC {{RABBITTY_RFC}})
Afiliado: {{AFFILIATE_LEGAL_NAME}} (RFC {{AFFILIATE_RFC}})
Domicilio: {{AFFILIATE_ADDRESS}}
Representante: {{REPRESENTATIVE}} ({{REPRESENTATIVE_POSITION}})
Negocio: {{BUSINESS_NAME}}
Nicho: {{NICHE}}
Contacto: {{CONTACT_EMAIL}}

DECLARACIONES
Rabbitty opera una plataforma tecnológica de recompensas y consumo en establecimientos afiliados. El Afiliado declara contar con capacidad y facultades para operar su negocio y aceptar las redenciones que correspondan. Ambas partes reconocen que la naturaleza jurídica de los derechos y operaciones deberá corresponder a su funcionamiento efectivo y a la legislación aplicable.

1. OBJETO
Rabbitty habilita al Afiliado, sujeto a autorización, una capacidad comercial para recibir redenciones de Bunz de los usuarios Rabbitters, en los establecimientos, productos, servicios y condiciones habilitados. La capacidad no constituye entrega de dinero, depósito, inversión ni adquisición de Bunz por el Afiliado.

2. DEFINICIONES
Bunz: unidades de recompensa internas del ecosistema Rabbitty, sujetas a las reglas del programa y a la caracterización jurídica que corresponda.
Rabbitter: usuario registrado que puede utilizar los Bunz disponibles.
Capacidad comercial: límite operativo autorizado para aceptar redenciones.
Capacidad promocional: componente de incorporación condicionado.
Capacidad adelantada: componente habilitado anticipadamente y sujeto a recuperación.
Capacidad generada: capacidad reconocida por actividad comercial elegible.
Capacidad comprometida: capacidad asociada a operaciones confirmadas o reservadas.
Capacidad disponible: capacidad autorizada y no consumida, reservada ni bloqueada.
Obligación de recuperación: obligación comercial asociada a la capacidad adelantada.

3. AUTORIZACIÓN Y COMPOSICIÓN
La capacidad podrá integrar capacidad promocional y capacidad adelantada. La Oferta Económica Individual (Anexo A) identifica la capacidad total, la composición, la provisionada, la vigencia, la ventana de evaluación, la fórmula y límites de recuperación, la cobertura y las causas de revisión. Las estimaciones del onboarding no constituyen autorización. La autorización requiere aceptación expresa de la Oferta y confirmación de Rabbitty.

4. OBLIGACIONES DE RABBITTY
Mantener registros razonablemente íntegros y trazables de autorizaciones, movimientos, redenciones, recuperaciones, ajustes y suspensiones; informar las condiciones de la capacidad y facilitar el estado de cuenta; proteger las redenciones confirmadas salvo fraude, error material, imposibilidad legal o fuerza mayor; comunicar modificaciones relevantes; atender incidencias y aclaraciones; aplicar los criterios de forma consistente; tratar los datos personales conforme a la ley y al aviso de privacidad; no presentar la participación como garantía de ventas o rentabilidad.

5. OBLIGACIONES DEL AFILIADO
Aceptar las redenciones confirmadas dentro de la capacidad disponible y conforme a productos, servicios, sucursales, horarios y condiciones publicados; mantener precios y condiciones ordinarias sin incrementos artificiales, recargos no informados ni discriminación por el uso de Bunz; mantener disponibles los productos y servicios elegibles; capacitar a su personal; no simular consumos, dividir operaciones, generar transacciones ficticias o circular Bunz; no manipular precios, tickets, ventas, devoluciones, cancelaciones, identidades o registros; mantener actualizados sus datos fiscales, comerciales y de representación; atender reclamaciones sobre sus bienes o servicios; cumplir las disposiciones aplicables; informar suspensiones, pérdida de permisos, cierre, insolvencia o incidentes relevantes.

6. REGLAS DE REDENCIÓN
Una redención será válida cuando haya sido confirmada por los sistemas de Rabbitty. El Afiliado verificará la confirmación antes de entregar el producto o prestar el servicio, salvo el procedimiento de contingencia autorizado. La redención confirmada consume la capacidad correspondiente y los Bunz del Rabbitter conforme a los registros. El Afiliado no podrá exigir otro método de pago ni modificar unilateralmente las condiciones de una redención confirmada. Las restricciones legítimas deberán informarse antes de la redención y no podrán modificarse retroactivamente respecto de operaciones confirmadas. Devoluciones, cancelaciones, contracargos, errores y disputas se procesarán conforme al procedimiento de incidencias y reversos.

7. CAPACIDAD GENERADA POR ACTIVIDAD
La actividad comercial elegible podrá generar capacidad adicional cuando exista una operación fiat real, registrada y validada. La emisión de una recompensa, la generación de capacidad, la redención y la recuperación son eventos distintos. La capacidad generada no podrá contabilizarse dos veces ni respaldar compromisos incompatibles. Rabbitty podrá excluir operaciones fraudulentas, canceladas, reversadas o no elegibles, registrando el motivo y permitiendo aclaración.

8. INCENTIVO PROMOCIONAL CONDICIONADO
El incentivo es una asignación de incorporación sujeta a condiciones, ventana de evaluación y vigencia. No genera devolución automática. Su conservación podrá depender de activación, disponibilidad, actividad, atención de redenciones, ausencia de fraude y cumplimiento. Rabbitty podrá revisar, reducir o retirar exclusivamente la porción no comprometida por causas objetivas informadas, con notificación y plazo de subsanación cuando proceda. Ninguna reducción afectará redenciones confirmadas ni derechos de Rabbitters derivados de operaciones válidas. El incentivo no es transferible, no se convierte en dinero y no puede exigirse en efectivo.

9. CAPACIDAD ADELANTADA Y RECUPERACIÓN
La capacidad adelantada se concede solo tras aceptar el Anexo A. El Anexo identifica importe autorizado y provisionado, naturaleza y alcance de la obligación, fuente y mecanismo de recuperación, fórmula dinámica por ciclo, periodicidad, límites, tratamiento de devoluciones, cobertura mínima y supuestos de suspensión y cierre. La tasa de recuperación se calcula con el progreso del Afiliado, la capacidad generada esperada, la cobertura y el horizonte de recuperación. Al cierre de cada ciclo, Rabbitty presenta una propuesta con base generada, tasa, importe exacto, pendiente antes y después, disponible antes y después, cobertura antes y después y vigencia. La propuesta requiere aceptación expresa del Afiliado con nombre completo y acción afirmativa; sin aceptación no se aplica retención. Si el Afiliado rechaza o no acepta en plazo, no se descuenta nada y el pendiente se mantiene. La aceptación no autoriza ampliaciones futuras. No podrá recuperarse dos veces el mismo valor ni reducir la capacidad comprometida. No se devengan intereses, penalizaciones ni cargos salvo instrumento adicional válido y aceptado. No habrá ampliaciones automáticas. Si la fuente deja de estar disponible, Rabbitty no podrá sustituirla unilateralmente por un cargo fiat no pactado. La obligación pendiente se mostrará separada de la capacidad disponible.

10. ESTADOS DE CUENTA, AUDITORÍA Y ACLARACIONES
Rabbitty pondrá a disposición un estado de cuenta al menos mensual con capacidad autorizada, provisionada, promocional, adelantada, generada, disponible, reservada, redenciones, reversos, recuperaciones, obligación pendiente, bloqueos y referencias. El Afiliado podrá presentar aclaraciones dentro de los quince días hábiles siguientes, sin renuncia a derechos irrenunciables. Rabbitty resolverá de forma fundada en un plazo razonable que no excederá treinta días hábiles salvo complejidad informada. Los registros serán evidencia documental y técnica, no irrebatible. Toda corrección conservará el registro original, motivo, fecha, responsable y referencia.

11. REVISIÓN, LIMITACIÓN Y SUSPENSIÓN
Rabbitty podrá suspender nuevas autorizaciones, limitar capacidad futura o bloquear nuevas redenciones por fraude, incumplimiento material, riesgo de seguridad, falta de cobertura, concentración excesiva o requerimiento legal. Cuando sea posible, notificará causa, alcance y duración y permitirá aclaraciones. En fraude o riesgo inmediato podrá actuar sin aviso previo, documentando y comunicando después. La suspensión no extingue redenciones confirmadas ni obligaciones adquiridas.

12. VIGENCIA, RENOVACIÓN Y TERMINACIÓN
La vigencia inicial y renovación se indican en el Anexo A. Cualquiera de las Partes podrá terminar con aviso escrito de treinta días naturales, sin perjuicio de obligaciones pendientes. Rabbitty podrá terminar de inmediato por fraude comprobado, uso ilícito, pérdida de permisos, falsedad material, incumplimiento grave no subsanable o mandato de autoridad. Al terminar, se detendrán nuevas autorizaciones, se identificarán redenciones y compromisos, se atenderán derechos de Rabbitters, se conciliará la capacidad y la obligación pendiente y se conservarán los registros. La terminación no convierte unilateralmente la obligación de capacidad en deuda monetaria.

13. RESPONSABILIDAD E INDEMNIZACIÓN
Cada Parte responderá por los daños directos que cause por dolo, culpa, incumplimiento o violación legal. El Afiliado responde por la calidad, seguridad, legalidad, entrega y prestación de sus productos y servicios, y por sus relaciones con consumidores, empleados, proveedores y autoridades. Rabbitty responde por la operación de la plataforma bajo su control y por las obligaciones que asuma. Cada Parte mantendrá indemne a la otra frente a reclamaciones de terceros derivadas de sus propios actos u omisiones. No se excluye la responsabilidad por dolo, fraude, confidencialidad, datos personales, daños personales ni derechos irrenunciables.

14. PROPIEDAD INTELECTUAL Y MARCA
Cada Parte conserva sus marcas, contenidos, software y derechos. El Afiliado concede a Rabbitty una licencia limitada, no exclusiva y revocable para usar su nombre, logotipo y materiales autorizados para operar y promocionar su participación. El Afiliado no podrá presentarse como representante, agente, socio o empleado de Rabbitty.

15. CONFIDENCIALIDAD Y SEGURIDAD
Las Partes mantendrán confidencial la información técnica, comercial, financiera, operativa y de usuarios no pública. Solo se usará para ejecutar el Acuerdo. Cada Parte implementará medidas razonables de seguridad y notificará incidentes que puedan comprometer a la otra.

16. PROTECCIÓN DE DATOS PERSONALES
Cada Parte será responsable del tratamiento que realice por cuenta propia, salvo que actúe como encargada. Cumplirán la legislación, sus avisos de privacidad y las instrucciones aplicables. Cuando una trate datos por cuenta de la otra, celebrarán el instrumento correspondiente. La aceptación de este Acuerdo no sustituye avisos ni consentimientos adicionales. No se almacenarán plantillas biométricas del dispositivo como mecanismo ordinario; se registrará únicamente la evidencia técnica que corresponda.

17. RELACIÓN ENTRE LAS PARTES
Este Acuerdo no crea sociedad, asociación, mandato, representación, franquicia, relación laboral, agencia ni subordinación. El Afiliado actúa por cuenta propia y conserva la dirección y responsabilidad de su negocio.

18. MODIFICACIONES Y DOCUMENTOS INTEGRANTES
El Acuerdo solo se modifica por instrumento escrito o electrónico aceptado por representantes facultados. Rabbitty podrá modificar reglas técnicas u operativas generales por seguridad, integridad, cumplimiento o funcionamiento, sin alterar retroactivamente condiciones económicas aceptadas ni compromisos existentes. Toda modificación material de capacidad, incentivo, recuperación, vigencia o responsabilidad requerirá aceptación expresa del Afiliado. Forman parte del Acuerdo: Anexo A (Oferta Económica Individual), Anexo B (Condiciones Operativas y de Redención), Anexo C (Aclaraciones, Reversos y Disputas), Anexo D (Datos Personales) y Anexo E (Evidencia de Aceptación). En caso de contradicción, prevalecerá el convenio modificatorio posterior, la Oferta Individual en sus condiciones particulares, el Anexo Operativo y este Acuerdo Marco.

19. NOTIFICACIONES, FUERZA MAYOR Y LEY
Las notificaciones se enviarán a los datos del Anexo A y deberán poder acreditarse. Ninguna Parte responderá por retrasos causados por eventos imprevisibles o inevitables fuera de su control, con notificación y mitigación. El Acuerdo se rige por las leyes federales de México y las locales aplicables. Las Partes intentarán resolver controversias de buena fe durante quince días hábiles; si no, se someten a los tribunales competentes de {{JURISDICTION}}, sin perjuicio de competencias irrenunciables.

20. ACEPTACIÓN Y EVIDENCIA
La aceptación se realiza con el nombre completo del firmante y una acción afirmativa (checkbox), mediante un mecanismo que identifica al firmante, acredita su intención de obligarse, vincula la versión exacta y detecta alteraciones. La autenticación local del dispositivo (Face ID / Touch ID) es opcional y no constituye firma biométrica ni e.firma. El Afiliado declara haber tenido oportunidad de revisar el Acuerdo y sus anexos, conservar copia y recibir información clara sobre la capacidad. La aceptación por representante de persona moral incluye evidencia razonable de facultades. El Acuerdo no se considera activado hasta cumplir aceptación, autorización y confirmación.

ANEXO A — OFERTA ECONÓMICA INDIVIDUAL
Identificador: {{OFFER_ID}}
Fecha: {{OFFER_DATE}}
Afiliado: {{AFFILIATE_LEGAL_NAME}}
Negocio: {{BUSINESS_NAME}}
Nicho: {{NICHE}}
Capacidad total autorizada: {{CAPACITY_TOTAL}} Bunz
Capacidad promocional: {{PROMO}} Bunz
Capacidad adelantada: {{CREDIT}} Bunz
Capacidad inicialmente provisionada: {{PROVISIONED}} Bunz
Cobertura propuesta: {{COVERAGE_DAYS}} días
Próxima revisión: {{REVIEW_DATE}}
Condiciones de recuperación: {{RECOVERY_TERMS}}
Condiciones operativas: {{OPERATIONAL_TERMS}}

ANEXO B — CONDICIONES OPERATIVAS Y DE REDENCIÓN
Sucursales, horarios, productos, servicios elegibles, precios, restricciones, procedimiento de confirmación, responsables de incidencias y contacto de emergencia: {{OPERATIONAL_TERMS}}

ANEXO C — ACLARACIONES, REVERSOS Y DISPUTAS
Toda aclaración incluirá identificador de operación, fecha, sucursal, importe, tipo de incidencia, evidencia y solicitud. Rabbitty conservará el movimiento original y documentará el ajuste. Las operaciones disputadas se marcarán y no se eliminarán.

ANEXO D — DATOS PERSONALES
Las Partes incorporarán el instrumento de tratamiento que identifique responsables, encargados, finalidades, categorías, seguridad, transferencias, derechos, incidentes y conservación. Este Anexo no sustituye los avisos de privacidad.

ANEXO E — EVIDENCIA DE ACEPTACIÓN
Se conservará identificador de contrato y oferta, identidad y facultades del representante, versión y hash, copia íntegra, fecha y hora, método de autenticación local, acción afirmativa, sesión, IP y agente cuando se recaben legalmente, resultado de autenticación sin plantillas biométricas, entrega de copia y confirmación de autorización.

RESUMEN EN LENGUAJE SIMPLE
Te damos capacidad para recibir a los Rabbitters. No compras Bunz. Una parte es un incentivo de bienvenida y otra es capacidad adelantada que vas recuperando con tu actividad. Lo que ya está comprometido con los Rabbitters se protege siempre.`;

export const MCCE_CONTRACT_SUMMARY =
  "Te damos capacidad para recibir a los Rabbitters. No compras Bunz. Una parte es un incentivo de bienvenida y otra es capacidad adelantada que vas recuperando con tu actividad. Lo que ya está comprometido se protege siempre.";

export function renderContract(data: ContractData = {}): string {
  const values: Record<string, string> = {
    CONTRACT_VERSION: MCCE_CONTRACT_VERSION,
    RABBITTY_ENTITY: data.rabbittyEntity || RABBITTY_LEGAL_ENTITY,
    RABBITTY_RFC: data.rabbittyRfc || RABBITTY_RFC,
    AFFILIATE_LEGAL_NAME: data.affiliateLegalName || MISSING,
    AFFILIATE_RFC: data.affiliateRfc || MISSING,
    AFFILIATE_ADDRESS: data.affiliateAddress || MISSING,
    REPRESENTATIVE: data.representative || MISSING,
    REPRESENTATIVE_POSITION: data.representativePosition || MISSING,
    BUSINESS_NAME: data.businessName || MISSING,
    NICHE: data.niche || MISSING,
    OFFER_ID: data.offerId || MISSING,
    OFFER_DATE: data.offerDate || new Date().toISOString().slice(0, 10),
    CAPACITY_TOTAL: data.capacityTotal != null ? String(data.capacityTotal) : MISSING,
    PROMO: data.promo != null ? String(data.promo) : MISSING,
    CREDIT: data.credit != null ? String(data.credit) : MISSING,
    PROVISIONED: data.provisioned != null ? String(data.provisioned) : MISSING,
    COVERAGE_DAYS: data.coverageDays != null ? String(data.coverageDays) : MISSING,
    REVIEW_DATE: data.reviewDate || MISSING,
    RECOVERY_TERMS: data.recoveryTerms || MISSING,
    OPERATIONAL_TERMS: data.operationalTerms || MISSING,
    CONTACT_EMAIL: data.contactEmail || MISSING,
    JURISDICTION: "México",
  };
  return MCCE_CONTRACT_TEMPLATE.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) =>
    values[key] ?? MISSING
  );
}

/** Hash estable del contrato renderizado para evidencia. */
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
