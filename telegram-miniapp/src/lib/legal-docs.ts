/**
 * ── Documentos legales publicados ─────────────────────────────────────────────
 *
 * Fuente de verdad de lo que el usuario VE y ACEPTA dentro del producto.
 * El corpus completo para revisión legal vive en `Docs/LEGAL/` (repo).
 *
 * Reglas:
 * - Cada documento lleva `version` (AAAA-MM-DD) y `updated`.
 * - Si cambia cualquier texto, sube la versión y se re-pide aceptación:
 *   la versión aceptada se guarda por usuario y por negocio.
 * - Estos textos están alineados con lo que el sistema HACE. No prometer
 *   funciones que no existen (p. ej. "terminal en el iPad").
 *
 * `[REVISAR]` Antes de considerarse definitivos requieren revisión de abogado y,
 * cuando aplique, registro ante PROFECO.
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

export const LEGAL_VERSION = "2026-11-19";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terminos",
    title: "Términos y Condiciones de la Plataforma",
    audience: "Afiliados (negocios)",
    version: LEGAL_VERSION,
    updated: "18 de noviembre de 2026",
    summary:
      "Reglas del servicio para el comercio: qué hace Rabbitty, qué no hace, qué se espera de ti y cómo se limita la responsabilidad.",
    sections: [
      {
        heading: "1. Partes y aceptación",
        body: [
          "Rabbitty presta servicios de punto de venta, comandas, cocina, lealtad y cobro. El Afiliado es el comercio que se da de alta y opera el sistema.",
          "La aceptación ocurre al concluir el alta y marcar la casilla. El sistema registra la versión aceptada, la fecha, el correo y la IP.",
        ],
      },
      {
        heading: "2. Qué es y qué no es Rabbitty",
        body: [
          "Rabbitty no es institución financiera, no capta recursos del público y no es adquiriente de tarjetas. Los cobros con tarjeta se procesan con proveedores autorizados bajo sus propias reglas.",
          "Rabbitty no emite el CFDI del cobro presencial: la facturación es responsabilidad del Afiliado con su PAC.",
          "Los Bunz son un programa de lealtad, no dinero, y se rigen por el Reglamento de la Economía Bunz.",
        ],
      },
      {
        heading: "3. Cuenta, accesos y responsabilidad",
        body: [
          "El Afiliado responde por la veracidad de sus datos, por el uso de sus usuarios y terminales, y por custodiar sus credenciales y PIN.",
          "Toda operación registrada con una credencial o dispositivo del Afiliado se presume realizada por el Afiliado, salvo prueba en contrario en la bitácora del sistema.",
        ],
      },
      {
        heading: "4. Uso aceptable",
        body: [
          "No se permite registrar productos o precios falsos, simular ventas, inflar recompensas, alterar totales para evadir comisiones, emitir Bunz sin operación real, revender el servicio ni usar datos de comensales para fines distintos.",
          "El incumplimiento faculta a suspender el servicio y a retener liquidaciones para cubrir contracargos o daños.",
        ],
      },
      {
        heading: "5. Comisiones y pagos",
        body: [
          "Las comisiones vigentes son las que muestra el panel y las del Anexo de Pagos aceptado al alta.",
          "Rabbitty puede modificar comisiones con 30 días naturales de aviso. Si no estás de acuerdo, puedes dar de baja sin penalidad antes de que entre en vigor.",
        ],
      },
      {
        heading: "6. Disponibilidad",
        body: [
          "Rabbitty procura disponibilidad continua pero no garantiza un porcentaje mientras dependa de terceros (hosting, base de datos, proveedores de pago y la red del local).",
          "El cobro con tarjeta requiere conexión. En contingencia se puede cobrar en efectivo y reconciliar después.",
        ],
      },
      {
        heading: "7. Datos y tarjetas",
        body: [
          "El tratamiento de datos personales se rige por el Aviso de Privacidad.",
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
        heading: "9. Limitación de responsabilidad",
        body: [
          "La responsabilidad total de Rabbitty se limita al monto de comisiones efectivamente cobradas al Afiliado en los tres meses anteriores al hecho que la origine.",
          "No responde por lucro cesante, pérdida de clientela ni daños indirectos. Esta limitación no aplica a dolo o mala fe, ni a derechos irrenunciables del consumidor.",
        ],
      },
      {
        heading: "10. Ley aplicable",
        body: [
          "Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Antes de demandar, las partes intentarán resolver la controversia de buena fe por escrito en 30 días.",
        ],
      },
    ],
  },
  {
    slug: "payments",
    title: "Anexo de Pagos — comisiones y liquidaciones",
    audience: "Afiliados (negocios)",
    version: LEGAL_VERSION,
    updated: "19 de noviembre de 2026",
    summary:
      "Cuánto cuesta cobrar con un método de pago, cuánto cobra Rabbitty por traerte clientes y cómo se liquida. Los Bunz nunca pagan comisión.",
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
        heading: "5. IVA",
        body: [
          "Los importes de comisión se expresan sin IVA. El IVA se suma y se factura conforme a la ley aplicable, salvo que tu comprobante se emita de otra forma acordada por escrito.",
        ],
      },
      {
        heading: "6. Liquidación y retención",
        body: [
          "La comisión se descuenta del importe que se te liquida o se acumula como saldo por cobrar, según el riel utilizado. El detalle por operación está disponible en tu panel (historial de ventas y conciliación).",
          "Rabbitty puede retener de una liquidación contracargos en proceso, montos en disputa y comisiones devengadas impagas, informando el motivo.",
        ],
      },
      {
        heading: "7. Cambios",
        body: [
          "Rabbitty puede ajustar la comisión de plataforma con 30 días naturales de aviso. Si no estás de acuerdo, puedes dar de baja sin penalidad antes de que entre en vigor.",
          "La aceptación de este anexo queda registrada con la fecha, la versión y el usuario que la otorgó.",
        ],
      },
      {
        heading: "8. Contracargos y reembolsos",
        body: [
          "Los contracargos se rigen por el documento de chargebacks y reembolsos. Un pedido cancelado o anulado antes de cobrarse no genera comisión.",
        ],
      },
    ],
  },
  {
    slug: "privacidad",
    title: "Aviso de Privacidad",
    audience: "Comensales, personal y afiliados",
    version: LEGAL_VERSION,
    updated: "18 de noviembre de 2026",
    summary:
      "Qué datos tratamos, para qué, con quién los compartimos, cuánto los conservamos y cómo ejercer tus derechos.",
    sections: [
      {
        heading: "1. Datos que tratamos",
        body: [
          "Identificación: nombre, teléfono, correo, foto de perfil y usuario, para crear y asegurar la cuenta.",
          "Operación: consumos, tickets, propinas, sucursal y mesa, para prestar el servicio y emitir comprobantes.",
          "Lealtad y membresías: Bunz ganados y usados, nivel, misiones, plan y beneficios usados.",
          "Pago: método, últimos cuatro dígitos, marca, referencia y folio del proveedor. Nunca el número completo, el CVV ni la banda.",
          "Técnicos: dispositivo, IP y registros de acceso, para seguridad y diagnóstico.",
        ],
      },
      {
        heading: "2. Finalidades",
        body: [
          "Primarias: crear y administrar la cuenta; procesar consumos, cobros, propinas y reembolsos; operar Bunz, membresías y misiones; prevenir fraude; cumplir obligaciones legales; atender aclaraciones.",
          "Secundarias (requieren consentimiento y son revocables): promociones, recomendaciones y analítica para personalizar ofertas. Se desactivan en Ajustes sin afectar el servicio.",
        ],
      },
      {
        heading: "3. Con quién compartimos",
        body: [
          "Con el negocio donde consumes (nombre, consumo y membresía) para prestarte el servicio y aplicar beneficios.",
          "Con el procesador de pagos para autorizar y liquidar, con el proveedor de infraestructura como encargado y con el servicio de mensajería para entregar avisos.",
          "Con la autoridad cuando exista obligación legal. No vendemos datos personales.",
        ],
      },
      {
        heading: "4. Conservación",
        body: [
          "Datos de cuenta mientras exista y hasta 5 años después, por obligaciones fiscales y defensa legal.",
          "Registros de seguridad hasta 12 meses. Bóveda temporal de Bunz (teléfono sin cuenta): 3 meses.",
        ],
      },
      {
        heading: "5. Tus derechos",
        body: [
          "Puedes acceder, rectificar, cancelar u oponerte, y revocar el consentimiento, desde Ajustes → Privacidad o por correo al contacto de privacidad.",
          "Respondemos en 20 días hábiles y hacemos efectiva la determinación en 15 días hábiles.",
        ],
      },
      {
        heading: "6. Seguridad",
        body: [
          "Cifrado en tránsito, credenciales de proveedores cifradas en reposo con llave fuera del código, acceso por roles y PIN por empleado, bitácora de operaciones sensibles y rotación periódica de credenciales.",
          "Si ocurre un incidente que afecte datos personales, se comunica a los titulares y a la autoridad conforme a la ley.",
        ],
      },
      {
        heading: "7. Cambios y contacto",
        body: [
          "Los cambios sustanciales se avisan con 15 días de anticipación. La versión vigente y su fecha se muestran en este documento y el sistema registra la versión aceptada.",
          "Contacto de privacidad: privacidad@rabbitty.me.",
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
    updated: "18 de noviembre de 2026",
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
    updated: "18 de noviembre de 2026",
    summary:
      "Los Bunz son puntos de lealtad: no son dinero, no se compran ni se cambian por efectivo. Aquí están las reglas de emisión, uso, transferencia y abuso.",
    sections: [
      {
        heading: "1. Qué son los Bunz",
        body: [
          "Son puntos de recompensa del ecosistema Rabbitty. Se obtienen por consumir en negocios afiliados y por misiones y promociones.",
          "No son dinero de curso legal, ni moneda electrónica, ni saldo prepagado, ni criptoactivo, ni inversión. No se compran con dinero ni se convierten a efectivo en ningún caso.",
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
        heading: "3. Respaldos y topes",
        body: [
          "No se emite un Bunz sin respaldo: cada emisión queda en el libro con el negocio que la respalda, la orden y el motivo.",
          "Topes vigentes: hasta 40 % de un ticket pagable con Bunz; 15 Bunz de bono de membresía por ticket; pozo mensual del 10 % del neto de la membresía; emisión diaria según la capacidad declarada del negocio.",
          "Los topes pueden cambiar para proteger la economía; no aplican retroactivamente a Bunz ya acreditados.",
        ],
      },
      {
        heading: "4. Vigencia",
        body: [
          "Los Bunz en una cuenta registrada no vencen.",
          "Si se emiten a un teléfono sin cuenta (Bóveda Temporal), hay 3 meses para registrarse y reclamarlos.",
          "Una cuenta inactiva por 24 meses recibe aviso y el saldo no usado puede cancelarse 30 días después.",
        ],
      },
      {
        heading: "5. Uso",
        body: [
          "Se canjean en negocios afiliados en las condiciones que cada negocio publique (porcentaje máximo, productos excluidos, horarios).",
          "El pago con Bunz no genera cashback sobre la parte pagada con Bunz. El uso es personal, salvo transferencia permitida.",
        ],
      },
      {
        heading: "6. Transferencias",
        body: [
          "Se permite transferir Bunz entre cuentas registradas.",
          "Está prohibido venderlos por dinero o bienes, usarlos para pagar salarios o deudas, intermediar o automatizar transferencias para extraer valor.",
          "Rabbitty puede limitar monto y frecuencia, y revertir operaciones que violen este Reglamento.",
        ],
      },
      {
        heading: "7. Devoluciones y fraudes",
        body: [
          "Si una compra se reembolsa, los Bunz de esa compra se revocan. Si ya se usaron, el saldo puede quedar negativo y se compensa con futuras emisiones.",
          "Simular compras, crear cuentas múltiples, manipular terminales o coludir con personal se considera abuso: reversión, suspensión, cancelación y, en su caso, acciones legales.",
        ],
      },
      {
        heading: "8. Si un negocio cierra",
        body: [
          "Los Bunz son fungibles: los ganados en un negocio se usan en cualquier afiliado que los acepte y siguen siendo válidos aunque ese negocio cierre.",
          "Rabbitty no garantiza un valor monetario ni reembolsa Bunz en efectivo.",
        ],
      },
    ],
  },
  {
    slug: "rabbitter",
    title: "Términos de Uso del Rabbitter",
    audience: "Comensales",
    version: LEGAL_VERSION,
    updated: "18 de noviembre de 2026",
    summary:
      "Qué puedes esperar de Rabbitty, qué espera Rabbitty de ti, cómo funcionan tus Bunz y tus membresías, y cómo cerrar tu cuenta.",
    sections: [
      {
        heading: "1. Qué es Rabbitty para ti",
        body: [
          "Rabbitty es una app para descubrir negocios, acumular Bunz y usar membresías. Los alimentos y servicios los presta cada negocio afiliado, que es responsable de su calidad, precios e higiene.",
          "Al crear tu cuenta aceptas estos Términos y el Aviso de Privacidad. El sistema registra la versión aceptada, la fecha y el medio.",
        ],
      },
      {
        heading: "2. Tu cuenta",
        body: [
          "Da datos veraces y mantén tu teléfono actualizado: es tu llave de acceso y donde pueden llegar tus Bunz.",
          "Eres responsable de tu dispositivo y tu PIN. Una persona, una cuenta: las cuentas duplicadas para obtener beneficios se pueden cancelar.",
        ],
      },
      {
        heading: "3. Bunz y membresías",
        body: [
          "Los Bunz son puntos de lealtad: no son dinero, no se compran ni se convierten a efectivo. No vencen en una cuenta registrada.",
          "Las membresías las vende cada negocio y sus beneficios los define ese negocio: usos por ciclo, productos incluidos, sucursales y tope por ticket. Se muestran antes de contratar.",
          "La cancelación y el reembolso de una membresía se rigen por la política que publique el negocio, visible antes de pagar.",
        ],
      },
      {
        heading: "4. Pagos y propinas",
        body: [
          "Los cobros con tarjeta se procesan con proveedores certificados; no guardamos los datos completos de tu tarjeta.",
          "El comprobante y el CFDI los emite el negocio, no Rabbitty. La propina es voluntaria, se sugiere un porcentaje y llega al negocio para su reparto al personal.",
        ],
      },
      {
        heading: "5. Conducta y contenido",
        body: [
          "No está permitido suplantar identidad, manipular cobros o recompensas, automatizar el uso, acosar al personal ni usar la app para fines distintos.",
          "Si publicas reseñas o fotos, garantizas que son tuyas y veraces; Rabbitty puede retirar contenido ofensivo o falso.",
        ],
      },
      {
        heading: "6. Baja y responsabilidad",
        body: [
          "Puedes cerrar tu cuenta desde la app o por correo; el saldo de Bunz se pierde 30 días después del aviso.",
          "Rabbitty responde por el funcionamiento de su plataforma, no por el servicio del negocio. Nada limita los derechos que la ley reconoce como irrenunciables al consumidor.",
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

/** Resumen para casillas de aceptación (onboarding). */
export const CONSENT_SUMMARY =
  "Acepto los Términos, el Aviso de Privacidad y el Reglamento de Bunz. Entiendo que los Bunz son puntos de lealtad, no dinero.";
