/**
 * ── Documentos legales publicados (fuente ÚNICA) ────────────────────────────
 *
 * Vive en `@rabbitty/legal` para que la app del cliente, el admin y la landing
 * rendericen **exactamente el mismo texto**. Antes la landing tenía su propia
 * política de privacidad con otra fecha.
 *
 * Reglas:
 * - Cada documento lleva `version` (AAAA-MM-DD) y `updated`.
 * - Si cambia cualquier texto, sube `LEGAL_VERSION` y actualiza
 *   `LEGAL_CONTENT_HASH` (una prueba en CI falla si no coincide).
 * - Estos textos están alineados con lo que el sistema HACE.
 *
 * `[REVISAR-ABOGADO]` Requieren revisión de abogado y, cuando aplique, registro
 * ante PROFECO antes de considerarse definitivos. Hay tres dictámenes
 * pendientes: clasificación regulatoria de Bunz (art. 22 LFITF), delimitación
 * de fondos/liquidaciones y roles de datos (responsable vs encargado).
 */

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = {
  slug: string;
  title: string;
  audience: string;
  version: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
  /**
   * `false` = documento listo pero NO publicado: existe para cuando el producto
   * lo justifique (p. ej. comodato de equipos antes de tener hardware).
   */
  published?: boolean;
};

export const LEGAL_VERSION = "2026-11-19.1";

/**
 * Huella del TEXTO de los documentos.
 *
 * Existe para que no se pueda cambiar un documento y olvidar subir la versión:
 * una prueba compara esta huella con el contenido real y falla si no coincide.
 * Si editas cualquier texto: sube `LEGAL_VERSION`, actualiza esta huella y
 * commitea las dos cosas juntas.
 */
export const LEGAL_CONTENT_HASH = "aecdcc878a5a8d03";

/** Identificación del responsable legal (fuente: expediente corporativo). */
const ENTIDAD =
  "MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. (en adelante «Rabbitty»), RFC MEB2402087Z3";
const DOMICILIO = "Lázaro Cárdenas 74, Col. Dorada, C.P. 63732, Bucerías, Nayarit, México";
const CONTACTO = "hola@rabbitty.me";
const PRIVACIDAD = "privacidad@rabbitty.me";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terminos",
    title: "Términos y Condiciones de la Plataforma",
    audience: "Afiliados (negocios)",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Reglas del servicio para el comercio: quién presta el servicio, qué hace Rabbitty y qué no, qué se espera de ti, cómo se suspende y cómo se limita la responsabilidad.",
    sections: [
      {
        heading: "1. Partes, entidad y documentos que rigen",
        body: [
          `Quien presta el servicio es ${ENTIDAD}, con domicilio en ${DOMICILIO}. Contacto contractual: ${CONTACTO}.`,
          "Al aceptar estos Términos celebras un contrato de prestación de servicios tecnológicos con Rabbitty, por tiempo indefinido y sin exclusividad. No hay relación laboral, sociedad ni representación entre las partes.",
          "Documentos que rigen la relación, en este orden: (1) estos Términos; (2) el Anexo de Pagos; (3) el Anexo de Contracargos y Reembolsos; (4) el Acuerdo de Tratamiento de Datos (DPA) cuando Rabbitty trate datos por tu cuenta; (5) el Reglamento de la Economía Bunz; (6) el Contrato de Comodato y su acta, si hay equipos. En caso de conflicto prevalece el documento específico sobre el general, y los Términos sobre cualquier comunicación comercial.",
          "La aceptación es electrónica y queda registrada con fecha, usuario, correo, versión e identificadores técnicos de la conexión. Puedes pedir copia escribiendo a " + CONTACTO + ".",
          "Rabbitty puede actualizar los documentos con 30 días naturales de aviso por correo al contacto registrado y aviso en el panel, indicando la fecha efectiva. La aceptación de una versión nueva es requisito para seguir operando.",
        ],
      },
      {
        heading: "2. Qué es y qué no es Rabbitty",
        body: [
          "Rabbitty presta servicios de punto de venta, comandas, cocina, lealtad, membresías y herramientas de cobro. El Afiliado es el comercio que se da de alta y opera el sistema.",
          "Rabbitty no es institución financiera, no capta recursos del público y no es adquiriente de tarjetas. Los cobros con tarjeta se procesan con proveedores autorizados bajo sus propias reglas; su disponibilidad y sus tiempos de abono dependen de esos proveedores.",
          "Rabbitty no emite el CFDI del cobro presencial: la facturación del consumo es responsabilidad del Afiliado con su PAC. La comisión de plataforma se factura por separado conforme al Anexo de Pagos.",
          "Los Bunz son un programa de lealtad, no dinero, y se rigen por el Reglamento de la Economía Bunz.",
          "El Afiliado es el único responsable del producto o servicio que vende, de sus precios, de su higiene, de sus permisos y de sus obligaciones laborales y fiscales.",
        ],
      },
      {
        heading: "3. Cuenta, accesos y responsabilidad",
        body: [
          "El Afiliado responde por la veracidad de sus datos, por el uso de sus usuarios y terminales, y por custodiar sus credenciales y PIN. Cada persona debe tener su propio usuario: las credenciales compartidas son responsabilidad del Afiliado.",
          "Las operaciones registradas con una credencial o dispositivo del Afiliado se presumen realizadas por personal autorizado. Es una presunción que admite prueba en contrario: la bitácora, los controles de acceso y el análisis del sistema pueden desvirtuarla.",
          "Si el Afiliado detecta un acceso no autorizado debe reportarlo a " + CONTACTO + ". Rabbitty revisa la bitácora y las sesiones involucradas y responde por escrito con su determinación. El reporte oportuno es requisito para reclamar por operaciones no reconocidas.",
          "El Afiliado mantiene la titularidad de su información operativa (menú, precios, ventas). Rabbitty la usa para prestar el servicio y para analítica agregada, conforme al Aviso de Privacidad.",
        ],
      },
      {
        heading: "4. Uso aceptable",
        body: [
          "No se permite registrar productos o precios falsos, simular ventas, inflar recompensas, alterar totales para evadir comisiones, emitir Bunz sin operación real, revender el servicio ni usar datos de comensales para fines distintos.",
          "El incumplimiento faculta a suspender el servicio y a retener liquidaciones conforme al punto 9, con la evidencia correspondiente.",
        ],
      },
      {
        heading: "5. Comisiones y pagos",
        body: [
          "Las comisiones vigentes son las que muestra el panel y las del Anexo de Pagos aceptado al alta.",
          "Rabbitty puede modificar comisiones con 30 días naturales de aviso por correo y en el panel, indicando la fecha efectiva. Si no estás de acuerdo, puedes dar de baja sin penalidad antes de esa fecha.",
          "Las operaciones realizadas antes de la fecha efectiva conservan la tarifa con la que fueron calculadas.",
        ],
      },
      {
        heading: "6. Disponibilidad y soporte",
        body: [
          "Rabbitty procura disponibilidad continua pero no garantiza un porcentaje mientras dependa de terceros (hosting, base de datos, proveedores de pago y la red del local).",
          "El objetivo de disponibilidad, el horario de soporte y los canales de atención se acuerdan en la propuesta comercial de cada Afiliado. Las interrupciones por mantenimiento programado, fuerza mayor, red del local o terceros no cuentan como incumplimiento.",
          "El cobro con tarjeta requiere conexión. En contingencia se puede cobrar en efectivo y reconciliar después.",
        ],
      },
      {
        heading: "7. Datos y tarjetas",
        body: [
          "El tratamiento de datos personales se rige por el Aviso de Privacidad y, cuando Rabbitty trate datos por cuenta del Afiliado, por el DPA.",
          "Rabbitty nunca recibe ni almacena el número completo de tarjeta, el CVV ni la banda. El cobro presencial ocurre en terminales certificadas que cifran la información. Solo se guardan metadatos (últimos cuatro dígitos, marca, referencia y folio).",
        ],
      },
      {
        heading: "8. Equipos",
        body: [
          "Si Rabbitty entrega equipos, aplica el Contrato de Comodato junto con su acta de entrega-recepción firmada.",
          "El Afiliado responde por el equipo desde su recepción hasta su devolución, salvo desgaste normal. La pérdida, robo o daño por líquidos o mal uso se cobra conforme al acta.",
        ],
      },
      {
        heading: "9. Suspensión, retención y limitación de responsabilidad",
        body: [
          "Rabbitty puede suspender el servicio o retener liquidaciones por: contracargos o disputas en proceso, comisiones devengadas impagas, uso fraudulento comprobado o incumplimiento grave de estos documentos.",
          "Procedimiento: se notifica al Afiliado por correo y en el panel con la causa y la evidencia disponible; se da un plazo razonable para subsanar cuando el incumplimiento sea subsanable; la retención se limita al monto estimado del adeudo o la disputa y se libera el remanente al resolverse. El Afiliado puede pedir revisión por escrito y recibir respuesta motivada.",
          "La responsabilidad total de Rabbitty se limita al monto de comisiones efectivamente cobradas al Afiliado en los tres meses anteriores al hecho que la origine.",
          "No responde por lucro cesante, pérdida de clientela ni daños indirectos. Esta limitación no aplica a dolo o negligencia grave, confidencialidad, tratamiento de datos personales, fondos de terceros ni derechos irrenunciables del consumidor.",
        ],
      },
      {
        heading: "10. Terminación",
        body: [
          "Cualquiera de las partes puede terminar el contrato con 30 días naturales de aviso por escrito. Rabbitty puede terminar de inmediato por uso fraudulento o incumplimiento grave, notificando la causa.",
          "Al terminar: se liquidan las comisiones y saldos pendientes conforme al Anexo de Pagos, se desactivan los accesos, se devuelven los equipos en el plazo del comodato y se conservan los datos con los plazos del Aviso de Privacidad.",
          "Las obligaciones de confidencialidad, datos personales y pago de adeudos sobreviven a la terminación.",
        ],
      },
      {
        heading: "11. Ley aplicable y controversias",
        body: [
          "Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Antes de demandar, las partes intentarán resolver la controversia de buena fe por escrito en 30 días.",
          "Si no hay acuerdo, las partes se someten a los tribunales competentes del domicilio de Rabbitty, salvo que la ley disponga otra cosa para relaciones de consumo.",
        ],
      },
    ],
  },
  {
    slug: "payments",
    title: "Anexo de Pagos — comisiones, liquidaciones y contracargos",
    audience: "Afiliados (negocios)",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Cuánto cuesta cobrar con un método de pago, cuánto cobra Rabbitty por traerte clientes, quién recibe el dinero y cómo se liquida. Los Bunz nunca pagan comisión.",
    sections: [
      {
        heading: "1. Dos conceptos distintos",
        body: [
          "Costo por uso del riel de cobro: lo que cuesta procesar un pago (terminal, adquirente o pasarela). Se cobra por operación y no es ingreso de Rabbitty.",
          "Comisión de plataforma: lo que Rabbitty cobra por traerte clientes. Se describe en el punto 3 y es independiente del riel.",
        ],
      },
      {
        heading: "2. Riel de cobro",
        body: [
          "El cobro con tarjeta se procesa con terminales certificadas o con la pasarela habilitada. El costo del riel se informa en el panel y en la conciliación de cada liquidación.",
          "Efectivo: se registra en caja y no genera costo de riel. La terminal y su costo se detallan en el acta o en la cotización vigente.",
        ],
      },
      {
        heading: "3. Comisión de plataforma",
        body: [
          "La comisión vigente es de 3.8 % sobre el monto pagado en dinero del pedido.",
          "Base de cálculo: total del pedido menos la parte pagada con Bunz. Los Bunz nunca pagan comisión.",
          "Alcance: pedidos que llegan por la aplicación de Rabbitty. La venta de mostrador cobrada directamente en caja no genera comisión, salvo que se acuerde por escrito un alcance distinto en tu anexo.",
          "La comisión se calcula y se congela al momento de la venta. Un cambio posterior de tarifa no modifica operaciones ya realizadas.",
        ],
      },
      {
        heading: "4. Ejemplo",
        body: [
          "Pedido de $280 pagado en efectivo, hecho por la app: comisión de $10.64 (3.8 %).",
          "El mismo pedido con 40 % pagado en Bunz: la base son $168 y la comisión $6.38.",
          "Pedido pagado 100 % con Bunz: comisión de $0.",
        ],
      },
      {
        heading: "5. Flujo del dinero y obligación de liquidar",
        body: [
          "El dinero del comensal lo recibe el proveedor de pagos (pasarela o adquirente) y se abona a la cuenta del Afiliado o a la cuenta de concentración que se indique por escrito. Rabbitty no custodia fondos del comensal ni del Afiliado; su función es registrar la operación, calcular comisiones y conciliar.",
          "Un pedido se considera pagado cuando el proveedor confirma la autorización y el importe queda liquidado, no cuando el comensal recibe confirmación en pantalla.",
          "La obligación de liquidar al Afiliado nace cuando el proveedor abona el importe. Los tiempos de abono son los del proveedor y se muestran en la conciliación.",
          "El acreedor de la comisión de plataforma es Rabbitty. El acreedor del consumo es el Afiliado. La propina no es ingreso de Rabbitty y se entrega al Afiliado para su reparto al personal.",
        ],
      },
      {
        heading: "6. Liquidación, retención y saldos",
        body: [
          "La comisión se descuenta del importe que se te liquida o se acumula como saldo por cobrar, según el riel utilizado. El detalle por operación está en tu panel (historial de ventas y conciliación).",
          "Retención preventiva: sólo procede por contracargos o disputas en proceso, comisiones devengadas impagas o uso fraudulento comprobado. Se limita al monto estimado del adeudo o la disputa, se notifica por correo y panel con la causa y la evidencia, dura lo que dure la investigación y se libera el remanente al resolverse.",
          "El Afiliado puede pedir revisión por escrito; Rabbitty responde con su determinación y libera el remanente en un plazo máximo de 10 días hábiles desde la resolución, salvo resolución judicial o del proveedor de pagos.",
        ],
      },
      {
        heading: "7. IVA y comprobantes",
        body: [
          "Los importes de comisión se expresan sin IVA. El IVA se suma y se factura conforme a la ley aplicable.",
          "La comisión de plataforma la factura MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. (RFC MEB2402087Z3). El consumo lo factura el Afiliado con su propio PAC.",
          "Si el Afiliado requiere una forma distinta de comprobación, se acuerda por escrito antes de la primera liquidación del ciclo; no se aplica retroactivamente.",
        ],
      },
      {
        heading: "8. Cambios",
        body: [
          "Rabbitty puede ajustar la comisión de plataforma con 30 días naturales de aviso por correo al contacto registrado y aviso en el panel, indicando la fecha efectiva.",
          "Si no estás de acuerdo, puedes dar de baja sin penalidad antes de la fecha efectiva. Las operaciones anteriores conservan su tarifa.",
          "La aceptación de este anexo queda registrada con la fecha, la versión y el usuario que la otorgó.",
        ],
      },
      {
        heading: "9. Contracargos y reembolsos",
        body: [
          "Los contracargos se rigen por el Anexo de Contracargos y Reembolsos, publicado y disponible para consulta y aceptación.",
          "Un pedido cancelado o anulado antes de cobrarse no genera comisión; si ya se cobró, la comisión se reversa cuando el reembolso se confirma.",
        ],
      },
      {
        heading: "10. Pagos fallidos y devoluciones parciales",
        body: [
          "Si el proveedor rechaza o revierte una operación, el pedido no se considera pagado y no se genera comisión. Si el Afiliado ya entregó el producto, la pérdida es del Afiliado, salvo que Rabbitty haya causado el error.",
          "En devoluciones parciales, la comisión se recalcula sobre el importe que efectivamente se conserva; el excedente se acredita en la siguiente liquidación.",
        ],
      },
    ],
  },
  {
    slug: "chargebacks",
    title: "Anexo de Contracargos y Reembolsos",
    audience: "Afiliados (negocios)",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Qué es un contracargo, quién lo asume, qué evidencia se necesita y cómo se reembolsa una venta sin perder el rastro.",
    sections: [
      {
        heading: "1. Definiciones",
        body: [
          "Contracargo (chargeback): el comensal o su banco impugna un cargo ya autorizado y el emisor lo revierte.",
          "Reembolso: devolución total o parcial que el Afiliado autoriza sobre una venta ya cobrada.",
          "Disputa: etapa previa a la resolución del emisor, en la que se presentan pruebas.",
        ],
      },
      {
        heading: "2. Quién asume el contracargo",
        body: [
          "El contracargo se descuenta al Afiliado porque es quien recibió el importe del consumo y quien puede demostrar la entrega del producto o servicio.",
          "Rabbitty colabora con la evidencia que tiene: ticket, hora, sucursal, método y bitácora de la operación. Si el contracargo es consecuencia de un error atribuible a Rabbitty, este asume el importe.",
        ],
      },
      {
        heading: "3. Plazos y evidencia",
        body: [
          "El Afiliado recibe aviso por correo y en el panel al detectarse la disputa, con el plazo que fije el proveedor de pagos para responder.",
          "Evidencia útil: ticket firmado o comprobante, detalle del pedido, registro de entrega, comunicación con el comensal y bitácora interna. La falta de evidencia en plazo se resuelve a favor del comensal por regla del emisor.",
        ],
      },
      {
        heading: "4. Retención preventiva",
        body: [
          "Mientras la disputa está abierta, Rabbitty puede retener el importe del contracargo de la liquidación correspondiente, sin retener más de ese monto y liberando el remanente al resolverse.",
          "La retención se informa con la causa y se identifica por operación en la conciliación.",
        ],
      },
      {
        heading: "5. Reembolsos",
        body: [
          "El reembolso lo autoriza el Afiliado. Rabbitty ejecuta la devolución por el mismo riel, salvo imposibilidad técnica, y ajusta la comisión de plataforma sobre el importe devuelto.",
          "En reembolsos parciales se recalcula la comisión sobre el importe conservado y el excedente se acredita en la siguiente liquidación.",
        ],
      },
      {
        heading: "6. Cancelaciones del pedido",
        body: [
          "Un pedido cancelado antes de cobrarse no genera comisión ni cargos. Si ya se cobró, se aplica el punto 5.",
          "Cuando el cobro ocurrió en efectivo, el reembolso se realiza en el local y queda registrado en la bitácora para que la conciliación lo refleje.",
        ],
      },
      {
        heading: "7. Reclamos y soporte",
        body: [
          "Cualquier reclamación se envía a " + CONTACTO + " con el folio del pedido. Rabbitty responde por escrito y conserva la evidencia del caso mientras la ley lo exija.",
        ],
      },
    ],
  },
  {
    slug: "dpa",
    title: "Acuerdo de Tratamiento de Datos Personales (DPA)",
    audience: "Afiliados (negocios)",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Cuándo Rabbitty trata datos por cuenta de tu negocio, con qué instrucciones, qué subencargados usa y cómo se devuelven o suprimen al terminar.",
    sections: [
      {
        heading: "1. Roles",
        body: [
          "Afiliado (responsable): decide las finalidades y los medios del tratamiento de los datos de sus comensales.",
          "Rabbitty (encargado): trata esos datos únicamente para operar el POS, pedidos, mesas, tickets, reservas y las funciones que el Afiliado tenga activas.",
          "Para datos de cuenta del Afiliado, de su personal y del programa de lealtad, Rabbitty actúa como responsable conforme al Aviso de Privacidad.",
        ],
      },
      {
        heading: "2. Objeto y alcance",
        body: [
          "Datos tratados por cuenta del Afiliado: identificadores del comensal, consumos, tickets, propinas, mesa o sucursal, y registros técnicos de la operación.",
          "Duración: mientras el Afiliado tenga el servicio activo y los plazos de conservación legales.",
        ],
      },
      {
        heading: "3. Instrucciones del Afiliado",
        body: [
          "Rabbitty trata los datos sólo conforme a estas instrucciones y a la configuración que el Afiliado aplique en el producto. Si una instrucción contradice la ley, Rabbitty lo informa y no la ejecuta.",
          "El Afiliado garantiza que cuenta con base legal para tratar los datos que sube al sistema (aviso de privacidad propio, consentimiento u obligación legal).",
        ],
      },
      {
        heading: "4. Subencargados",
        body: [
          "Rabbitty usa proveedores de infraestructura, base de datos, mensajería y pagos. Se listan por categoría y función en el Aviso de Privacidad; los cambios relevantes se avisan con anticipación.",
          "Los subencargados asumen obligaciones equivalentes de confidencialidad y seguridad.",
        ],
      },
      {
        heading: "5. Seguridad",
        body: [
          "Cifrado en tránsito, credenciales de proveedores cifradas en reposo con llave fuera del código, acceso por roles, PIN por empleado, bitácora de operaciones sensibles y rotación periódica de credenciales.",
          "El Afiliado mantiene sus propios controles: usuarios nominales, contraseñas robustas y baja inmediata de personal que deja de laborar.",
        ],
      },
      {
        heading: "6. Incidentes",
        body: [
          "Ante una vulneración que afecte significativamente derechos del titular, Rabbitty informa sin dilación al Afiliado con la información disponible y colabora en la evaluación, el registro y la notificación a titulares y autoridad.",
          "Si el incidente se origina en el entorno del Afiliado, es el Afiliado quien notifica a sus titulares y a la autoridad, con la colaboración técnica de Rabbitty.",
        ],
      },
      {
        heading: "7. Derechos de los titulares",
        body: [
          "Las solicitudes ARCO de comensales se atienden por el Afiliado cuando él es responsable. Rabbitty habilita las herramientas y responde en el plazo legal cuando actúa como responsable.",
          "Rabbitty no responde solicitudes de titulares de un Afiliado sin su instrucción, salvo obligación legal.",
        ],
      },
      {
        heading: "8. Devolución, supresión y auditoría",
        body: [
          "Al terminar el servicio, Rabbitty devuelve o suprime los datos por cuenta del Afiliado conforme al plazo acordado, salvo los que deba conservar por obligación legal.",
          "El Afiliado puede solicitar información razonable sobre medidas de seguridad, con aviso previo y sin comprometer la seguridad de otros clientes.",
        ],
      },
    ],
  },
  {
    slug: "privacidad",
    title: "Aviso de Privacidad",
    audience: "Comensales, personal y afiliados",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Quién es el responsable, qué datos tratamos, para qué, con quién los compartimos, cuánto los conservamos y cómo ejercer tus derechos.",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        body: [
          `El responsable es ${ENTIDAD}, con domicilio en ${DOMICILIO} y contacto de privacidad ${PRIVACIDAD}.`,
          "Este aviso es integral y aplica a la app, al sitio web, al panel de negocios y a los canales de atención. Para tratamientos específicos existen avisos simplificados en el momento de la recolección.",
        ],
      },
      {
        heading: "2. Datos que tratamos",
        body: [
          "Identificación y contacto: nombre, teléfono, correo, usuario, foto de perfil y, cuando aplique, datos del negocio (razón social, RFC, domicilio).",
          "Operación y consumo: pedidos, tickets, propinas, sucursal, mesa, historial de visitas y preferencias declaradas.",
          "Lealtad: Bunz ganados y usados, nivel, misiones, membresías y beneficios utilizados.",
          "Pagos: método, últimos cuatro dígitos, marca, folio y referencia del proveedor. Nunca el número completo, el CVV ni la banda.",
          "Datos de personal del Afiliado: nombre, correo, rol, PIN y registro de turnos, para control de accesos y auditoría.",
          "Técnicos y de seguridad: dispositivo, sistema operativo, IP, ubicación aproximada cuando la autorizas, y registros de acceso y errores.",
        ],
      },
      {
        heading: "3. Finalidades",
        body: [
          "Primarias: crear y administrar la cuenta; procesar consumos, cobros, propinas y reembolsos; operar Bunz, membresías y misiones; prevenir fraude y abuso; cumplir obligaciones legales, fiscales y de facturación; atender aclaraciones y soporte.",
          "Secundarias (requieren consentimiento y son revocables): promociones, recomendaciones personalizadas, analítica de preferencias y campañas de los negocios. Se desactivan en Ajustes sin afectar el servicio.",
          "No usamos tus datos para decisiones que produzcan efectos jurídicos sin intervención humana, ni para perfilamiento con fines financieros.",
        ],
      },
      {
        heading: "4. Encargados y transferencias",
        body: [
          "Encargados (tratan datos por cuenta de Rabbitty, con contrato y confidencialidad): infraestructura y hospedaje, base de datos administrada, mensajería transaccional, envío de correo y conciliación de pagos.",
          "Transferencias necesarias: al negocio donde consumes (nombre, consumo y membresía) para prestarte el servicio y aplicar beneficios; al proveedor de pagos para autorizar, liquidar y atender contracargos; a la autoridad cuando exista obligación legal.",
          "Transferencias internacionales: algunos proveedores de infraestructura, correo y pagos están fuera de México (principalmente Estados Unidos). Se realizan bajo contratos que imponen obligaciones de protección equivalentes. Puedes solicitar el detalle por correo.",
          "No vendemos ni rentamos datos personales.",
        ],
      },
      {
        heading: "5. Cuándo actúas con un negocio",
        body: [
          "Cuando consumes en un negocio afiliado, el negocio es responsable de los datos que recaba para su propia operación (por ejemplo, su programa de lealtad o su facturación). Rabbitty puede actuar como encargado y trata esos datos sólo para operar el sistema, conforme al DPA.",
          "El aviso de privacidad del negocio debe estar disponible en el local o en sus canales.",
        ],
      },
      {
        heading: "6. Conservación",
        body: [
          "Cuenta y operación: mientras exista la cuenta y hasta 5 años después, por obligaciones fiscales y defensa legal.",
          "Registros de seguridad y bitácoras: hasta 12 meses, salvo investigación en curso.",
          "Bóveda temporal de Bunz (teléfono sin cuenta): 3 meses.",
          "Datos de facturación: el plazo fiscal aplicable (mínimo 5 años).",
          "Al vencer el plazo se suprimen o se bloquean para su posterior eliminación, dejando constancia.",
        ],
      },
      {
        heading: "7. Tus derechos (ARCO)",
        body: [
          "Puedes acceder, rectificar, cancelar u oponerte al tratamiento, y revocar el consentimiento, desde Ajustes → Privacidad o escribiendo a " + PRIVACIDAD + ".",
          "La solicitud debe incluir nombre, medio de contacto, documento que acredite identidad y descripción clara del derecho que ejerces. Si falta algún requisito, se te pide completarla en 5 días hábiles.",
          "Respondemos en 20 días hábiles y hacemos efectiva la determinación en 15 días hábiles. En ampliación de datos podemos extender el plazo conforme a la ley, informándote el motivo.",
          "El ejercicio es gratuito. Puedes acudir a la autoridad de protección de datos si no estás conforme con la respuesta.",
        ],
      },
      {
        heading: "8. Seguridad e incidentes",
        body: [
          "Cifrado en tránsito, credenciales de proveedores cifradas en reposo, acceso por roles, PIN por empleado, bitácora de operaciones sensibles y rotación de credenciales.",
          "Ante una vulneración que afecte significativamente tus derechos, se informa sin dilación con la información disponible: qué ocurrió, qué datos, qué medidas tomamos y qué puedes hacer. Se lleva registro interno del incidente y de la respuesta.",
        ],
      },
      {
        heading: "9. Cambios y contacto",
        body: [
          "Los cambios sustanciales se avisan con 15 días de anticipación en la app y por correo. La versión vigente y su fecha se muestran en este documento y el sistema registra la versión aceptada.",
          `Contacto de privacidad: ${PRIVACIDAD}.`,
        ],
      },
    ],
  },
  {
    slug: "equipos",
    title: "Contrato de Comodato de Equipos",
    // NO publicado: aún no entregamos lectores ni impresoras. Se activa el día
    // que haya hardware (cambiar a true y subir LEGAL_VERSION).
    published: false,
    audience: "Afiliados con lector o impresora de Rabbitty",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "El lector y la impresora son de Rabbitty y se entregan para usarse en tu local. Aquí está qué cuidar, quién paga qué y cómo se devuelven.",
    sections: [
      {
        heading: "1. Objeto",
        body: [
          "Rabbitty entrega en comodato, para uso exclusivo en el local del Afiliado: lector de tarjetas, impresora térmica (58 u 80 mm; BLE, SPP, USB o red) y accesorios.",
          "La entrega se formaliza con el acta de entrega-recepción, que identifica cada equipo, su serie y su estado.",
        ],
      },
      {
        heading: "2. Plazo y contraprestación",
        body: [
          "Dura mientras la cuenta esté activa y al corriente. Termina por baja, falta de pago, uso indebido o decisión de Rabbitty con 15 días de aviso (salvo incumplimiento grave, que es inmediato).",
          "La cuota de equipo cubre administración, actualización de software y reposición por desgaste normal. No transfiere la propiedad.",
        ],
      },
      {
        heading: "3. Obligaciones del Afiliado",
        body: [
          "Usar el equipo conforme a su manual, mantenerlo seco y lejos de calor y líquidos, y cargarlo solo con el cargador incluido.",
          "No prestarlo, rentarlo, venderlo, modificarlo ni abrirlo. Reportar en 24 horas cualquier pérdida, robo, daño o falla; en caso de robo, presentar denuncia.",
          "Devolverlo en 10 días naturales al terminar, en el estado recibido salvo desgaste normal. Permitir actualizaciones automáticas del software.",
        ],
      },
      {
        heading: "4. Obligaciones de Rabbitty",
        body: [
          "Entregar el equipo funcionando y configurado, dar soporte de primer nivel, reemplazar por falla de fábrica sin costo y reponer por desgaste normal cubierto por la cuota.",
          "No responde por el servicio del Afiliado, por caídas de su red eléctrica o de internet, ni por uso indebido.",
        ],
      },
      {
        heading: "5. Daño, pérdida o robo",
        body: [
          "Falla de fábrica y desgaste normal: los cubre Rabbitty.",
          "Caída, golpe, líquidos, pérdida o robo sin denuncia: los cubre el Afiliado, al costo de reparación o reposición vigente más envío.",
          "Modificación o apertura del equipo: reposición íntegra y posible baja del servicio.",
        ],
      },
      {
        heading: "6. Terminación",
        body: [
          "Al terminar, el Afiliado deja de usar el equipo, lo devuelve y Rabbitty desregistra el lector de la cuenta de cobro y borra los datos del dispositivo.",
          "Si no se devuelve en plazo, se presume pérdida y se cobra la reposición más gastos de cobranza.",
        ],
      },
    ],
  },
  {
    slug: "bunz",
    title: "Reglamento de la Economía Bunz",
    audience: "Comensales y afiliados",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Los Bunz son puntos de lealtad: no son dinero, no se compran ni se cambian por efectivo. Aquí están las reglas de emisión, uso, transferencia, respaldo y abuso.",
    sections: [
      {
        heading: "1. Naturaleza de los Bunz",
        body: [
          "Son puntos de recompensa del ecosistema Rabbitty. Se obtienen por consumir en negocios afiliados y por misiones y promociones.",
          "No son dinero de curso legal, ni moneda electrónica, ni saldo prepagado, ni criptoactivo, ni inversión. No se compran con dinero ni se convierten a efectivo en ningún caso.",
          "No otorgan derecho a retiro en efectivo ni a rendimiento. Su valor es promocional y se agota al canjearse en la red de afiliados.",
          "[REVISAR-ABOGADO] La calificación regulatoria de la red (emisión, administración, transferencia y redención) requiere dictamen expreso sobre el artículo 22 de la Ley para Regular las Instituciones de Tecnología Financiera, considerando el funcionamiento real del sistema.",
        ],
      },
      {
        heading: "2. Cómo se obtienen",
        body: [
          "Cashback por consumo: el porcentaje que publica cada negocio sobre el monto fiat pagado.",
          "Bono de membresía: se paga de un pozo mensual respaldado por el neto de la membresía, con tope por ticket.",
          "Misiones y campañas según sus reglas, y transferencias de otro usuario.",
          "El cashback se acredita cuando el pago queda liquidado, no cuando se autoriza.",
        ],
      },
      {
        heading: "3. Respaldo y topes",
        body: [
          "No se emite un Bunz sin respaldo: cada emisión queda en el libro con el negocio que la respalda, la orden y el motivo.",
          "Ese respaldo significa que el afiliado que emite asume la obligación de aceptar esos Bunz en su local y de participar en la compensación de la red; no representa una reserva de dinero a favor del usuario ni un derecho de conversión.",
          "Topes vigentes: hasta 40 % de un ticket pagable con Bunz; 15 Bunz de bono de membresía por ticket; pozo mensual del 10 % del neto de la membresía; emisión diaria según la capacidad declarada del negocio.",
          "Los topes pueden cambiar para proteger la economía; no aplican retroactivamente a Bunz ya acreditados.",
        ],
      },
      {
        heading: "4. Vigencia y saldos",
        body: [
          "Los Bunz en una cuenta registrada no vencen.",
          "Si se emiten a un teléfono sin cuenta (Bóveda Temporal), hay 3 meses para registrarse y reclamarlos. Al vencer, el saldo se cancela y no es reclamable en dinero.",
          "Una cuenta inactiva por 24 meses recibe aviso por correo y en la app; el saldo no usado puede cancelarse 30 días después del aviso. El titular puede evitar la cancelación iniciando sesión o respondiendo al aviso.",
          "[REVISAR-ABOGADO] La caducidad de la bóveda y la cancelación por inactividad deben justificarse en naturaleza, proporcionalidad y procedimiento antes de considerarse definitivas.",
        ],
      },
      {
        heading: "5. Uso y aceptación en la red",
        body: [
          "Se canjean en negocios afiliados en las condiciones que cada negocio publique (porcentaje máximo, productos excluidos, horarios).",
          "Los Bunz son fungibles: los ganados en un negocio se usan en cualquier afiliado que los acepte. Los afiliados se comprometen a aceptarlos conforme a su configuración y a la compensación de la red.",
          "El pago con Bunz no genera cashback sobre la parte pagada con Bunz. El uso es personal, salvo transferencia permitida.",
        ],
      },
      {
        heading: "6. Transferencias",
        body: [
          "Se permite transferir Bunz entre cuentas registradas, sin contraprestación y sin que exista compraventa, intermediación financiera ni obligación de conversión a dinero.",
          "Está prohibido venderlos por dinero o bienes, usarlos para pagar salarios o deudas, intermediar o automatizar transferencias para extraer valor. Rabbitty puede fijar límites de monto y frecuencia.",
          "Rabbitty puede revertir operaciones que violen este Reglamento y suspender la cuenta involucrada.",
        ],
      },
      {
        heading: "7. Devoluciones, saldos negativos y fraude",
        body: [
          "Si una compra se reembolsa, los Bunz de esa compra se revocan. Si ya se usaron, el saldo puede quedar negativo y se compensa con futuras emisiones.",
          "Un saldo negativo derivado de una reversión no se convierte en deuda exigible en dinero: se compensa con emisiones futuras y no genera intereses ni cobranza.",
          "Simular compras, crear cuentas múltiples, manipular terminales o coludir con personal se considera abuso: reversión, suspensión, cancelación y, en su caso, acciones legales.",
        ],
      },
      {
        heading: "8. Si un negocio cierra",
        body: [
          "Los Bunz siguen siendo válidos aunque ese negocio cierre: se usan en cualquier afiliado que los acepte.",
          "Rabbitty no garantiza un valor monetario ni reembolsa Bunz en efectivo.",
        ],
      },
      {
        heading: "9. Compensación entre afiliados",
        body: [
          "Cada emisión queda registrada con el negocio que la respalda. La redención en otro afiliado se compensa en la red conforme al libro de emisión y redención.",
          "El detalle de la compensación de cada ciclo está disponible en el panel del negocio y en la conciliación.",
        ],
      },
      {
        heading: "10. Cambios y contacto",
        body: [
          `Los cambios a este Reglamento se avisan con 30 días naturales y no aplican retroactivamente a Bunz ya acreditados. Dudas: ${CONTACTO}.`,
        ],
      },
    ],
  },
  {
    slug: "rabbitter",
    title: "Términos de Uso del Rabbitter",
    audience: "Comensales",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026 (rev. 1)",
    summary:
      "Qué puedes esperar de Rabbitty, qué espera Rabbitty de ti, cómo funcionan tus Bunz y tus membresías, y cómo cerrar tu cuenta.",
    sections: [
      {
        heading: "1. Quién es Rabbitty",
        body: [
          `Rabbitty es operado por ${ENTIDAD}, con domicilio en ${DOMICILIO}. Medios de contacto y aclaraciones: ${CONTACTO}.`,
          "Al crear tu cuenta aceptas estos Términos, el Aviso de Privacidad y el Reglamento de Bunz. El sistema registra la versión aceptada, la fecha y el medio.",
        ],
      },
      {
        heading: "2. Qué hace y qué no hace Rabbitty",
        body: [
          "Rabbitty opera la plataforma: descubrimiento de negocios, pedidos, lealtad, membresías y herramientas de pago. Los alimentos y servicios los presta cada negocio afiliado, que es responsable de su calidad, precios, higiene y permisos.",
          "Los cobros con tarjeta los procesa un proveedor de pagos autorizado; Rabbitty no custodia tu dinero ni es adquiriente. Rabbitty sí responde por el funcionamiento de su plataforma, por la administración de Bunz y por los servicios que opera directamente.",
          "El comprobante y el CFDI del consumo los emite el negocio, no Rabbitty.",
        ],
      },
      {
        heading: "3. Tu cuenta",
        body: [
          "Da datos veraces y mantén tu teléfono actualizado: es tu llave de acceso y donde pueden llegar tus Bunz.",
          "Eres responsable de tu dispositivo y tu PIN. Una persona, una cuenta: las cuentas duplicadas para obtener beneficios se pueden cancelar.",
        ],
      },
      {
        heading: "4. Bunz",
        body: [
          "Los Bunz son puntos de lealtad: no son dinero, no se compran ni se convierten a efectivo. No vencen en una cuenta registrada.",
          "Las reglas de emisión, uso, transferencia y cancelación están en el Reglamento de la Economía Bunz, que forma parte de estos Términos.",
        ],
      },
      {
        heading: "5. Membresías",
        body: [
          "Las membresías las vende cada negocio y sus beneficios los define ese negocio. Antes de contratar se muestran: precio total con impuestos, vigencia y renovación, beneficios y limitaciones, sucursales participantes, tope por ticket y política de cancelación.",
          "Rabbitty exige a los afiliados una política mínima común: precio total visible antes de pagar, cancelación antes de usar el beneficio, reembolso cuando el servicio no se presta, aviso de cambio de precio con 30 días y qué ocurre si el negocio deja de operar.",
          "Si un negocio deja de operar, el usuario puede solicitar el reembolso de la parte no disfrutada del ciclo en curso conforme a esa política; Rabbitty colabora con el afiliado para resolverlo.",
        ],
      },
      {
        heading: "6. Pagos y propinas",
        body: [
          "Los cobros con tarjeta se procesan con proveedores certificados; no guardamos los datos completos de tu tarjeta.",
          "La propina es voluntaria y puedes modificarla o dejarla en cero antes de pagar. Se entrega al negocio para su reparto al personal; no es ingreso de Rabbitty y no se cobra comisión de plataforma sobre ella.",
          "Los ajustes y devoluciones de propina se registran y se reflejan en el comprobante del negocio.",
        ],
      },
      {
        heading: "7. Conducta y contenido",
        body: [
          "No está permitido suplantar identidad, manipular cobros o recompensas, automatizar el uso, acosar al personal ni usar la app para fines distintos.",
          "Si publicas reseñas o fotos, garantizas que son tuyas y veraces; Rabbitty puede retirar contenido ofensivo o falso.",
        ],
      },
      {
        heading: "8. Baja y responsabilidad",
        body: [
          "Puedes cerrar tu cuenta desde la app o por correo. Al cerrarla, el saldo de Bunz se pierde 30 días después del aviso; durante ese plazo puedes reclamarlo o transferirlo conforme al Reglamento.",
          "Rabbitty responde por el funcionamiento de su plataforma, no por el servicio del negocio. Nada limita los derechos que la ley reconoce como irrenunciables al consumidor.",
          `Para aclaraciones y reclamaciones: ${CONTACTO}. Conservamos la evidencia de la contratación electrónica conforme al Aviso de Privacidad.`,
        ],
      },
    ],
  },
];

/** Documentos visibles para el usuario (los borradores quedan fuera). */
export const PUBLISHED_LEGAL_DOCS = LEGAL_DOCS.filter((d) => d.published !== false);

export function getLegalDoc(slug: string): LegalDoc | undefined {
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  // Un documento no publicado no se sirve ni por URL directa.
  if (!doc || doc.published === false) return undefined;
  return doc;
}
