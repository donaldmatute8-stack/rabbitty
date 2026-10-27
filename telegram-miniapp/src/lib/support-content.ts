export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: '¿Qué son los Bunz?',
    a: 'Los Bunz son la moneda digital exclusiva del ecosistema Rabbitty. Sirven para recibir recompensas cuando consumes en negocios afiliados y luego gastarlos como dinero real en otros negocios participantes.',
  },
  {
    q: '¿Cómo gano Bunz?',
    a: '¡Es automático! Cada vez que pagas en un restaurante o negocio con el sistema Rabbitty POS, muestras el código QR de tu billetera o das tu número de teléfono. El cajero lo escanea y un porcentaje de tu cuenta se regresa inmediatamente en Bunz.',
  },
  {
    q: '¿Tienen fecha de vencimiento?',
    a: 'Los Bunz en tu cuenta registrada no vencen. Sin embargo, si un negocio te emite Bunz a tu número telefónico y aún no has creado tu cuenta (Bóveda Temporal), tienes 3 meses para registrarte antes de que expiren.',
  },
  {
    q: '¿Puedo transferir mis Bunz a otra persona?',
    a: '¡Sí! Puedes transferir Bunz al instante a cualquier usuario por su @usuario, ID o código QR desde el chat de Bunzy o tu Billetera. Las transferencias están protegidas por Face ID / PIN de seguridad y verificación en dos pasos (2FA).',
  },
  {
    q: '¿Cómo protejo mi cuenta con Face ID, PIN y 2FA?',
    a: 'En Configuración > Seguridad puedes activar Face ID / Touch ID biométrico, PIN de 4 dígitos (con sal y hash seguro PBKDF2), y 2FA real mediante código a tu correo, SignalWire SMS o App Autenticadora TOTP (Google Authenticator / Authy).',
  },
  {
    q: '¿Qué es Rabbitty Mood y cómo funcionan las campañas por Mood?',
    a: 'Rabbitty Mood permite a los usuarios compartir su estado de ánimo (calma, energía, enfoque, fiesta, etc.) para recibir listas de música curadas y descubrir negocios ideales para su vibra. Los comercios afiliados pueden activar Campañas por Mood para premiar con bunz extras en horas específicas según el ánimo de los clientes.',
  },
  {
    q: '¿Qué es Proof of Atmosphere (PoA)?',
    a: 'Proof of Atmosphere (PoA) mide cómo la música, iluminación y ambiente físico de un local mejoran la satisfacción y permanencia de los clientes. Los baristas y gerentes registran intervenciones ambientales desde el Portal de Negocios para optimizar sus ventas y retención.',
  },
  {
    q: '¿Qué pueden hacer los negocios afiliados en el Portal de Negocios?',
    a: 'Pueden emitir recompensas en caja por consumos (Mint), validar y canjear cupones (Redeem), ver su libro contable (Ledger) y crédito, crear Campañas por Mood, registrar recetas de Atmósfera (PoA) y consultar recomendaciones estratégicas con Hermes IA.',
  },
  {
    q: '¿Cómo funciona el programa de referidos?',
    a: 'En tu perfil encontrarás un enlace único. Compártelo con tus amigos y, cuando ellos creen su cuenta y realicen su primera transacción, tú recibirás Bunz automáticamente en tu billetera.',
  },
  {
    q: '¿Cómo funciona el Corte de Caja y Cierre de Turno en Rabbitty POS?',
    a: 'En Rabbitty POS la caja funciona por turnos con PIN: 1. Abres caja (botón "Caja cerrada · Abrir") con tu PIN y el fondo inicial; sin turno abierto no se cobra en efectivo. 2. Los retiros piden tu PIN y, sobre el umbral configurado, también PIN de manager/admin. 3. El cierre parcial (Ticket X) es un arqueo ciego que deja el turno abierto. 4. En el cambio de cajero, el que sale y el que entra confirman con su PIN. 5. El cierre Z pide arqueo ciego, PIN del cajero y PIN de manager/admin; si hay sobrante o faltante la nota es obligatoria. Todo queda en la bitácora de Turnos de Caja del admin (/cash-shifts).',
  },
  {
    q: '¿Cómo funcionan los Reportes de Ventas y exportación contable?',
    a: 'En el menú lateral de Admin > Reportes, accedes al desglose de ventas netas, el IVA (16%), la proporción de pagos por Efectivo, Tarjeta o Bunz, los platillos más vendidos y el botón de exportación CSV con formato contable oficial.',
  },
  {
    q: '¿Qué es el KDS (Kitchen Display System)?',
    a: 'El KDS es la pantalla digital para cocina y barra (/kitchen). Las órdenes recibidas en el POS o Kiosko avanzan en tiempo real: PENDING (amarillo) → IN_PROGRESS (naranja) → READY (verde). Cuenta con alertas térmicas por colores según los minutos de espera del ticket.',
  },
  {
    q: '¿Cómo se configura el Kiosko Autoservicio?',
    a: 'El Kiosko (/kiosk) está diseñado para colocarse en iPads o pantallas táctiles en mostrador. Utiliza la WakeLock API para evitar que la pantalla se apague, permitiendo a los comensales armar su orden visualmente y pagar con QR Rabbitty o ticket para caja.',
  },
  {
    q: '¿Cómo evalúo el nivel de preparación (% Readiness) de mi negocio en Rabbitty Admin?',
    a: 'En la pantalla principal del Admin (/), cuentas con la "Barra de Preparación Inteligente (Business Readiness)". Evalúa 7 pilares operativos: 1. Menú y platillos (/menu), 2. Personal y roles (/staff), 3. Menú digital TV y QR de mesa (/menu-boards), 4. Cashback Bunz (/loyalty), 5. Corte de caja y fondo de gaveta (/pos), 6. Pantalla KDS e impresoras (/kitchen), y 7. Capacitación en Academy (/academy). Cada paso completado incrementa el % de preparación hacia el 100%.',
  },
  {
    q: '¿Qué es el Growth Engine y cómo funcionan las Campañas Comerciales de Afiliados?',
    a: 'El Growth Engine permite a los negocios afiliados crear campañas de marketing con presupuesto tope en Bunz, límite por usuario y vigencia (ej. 2h a 48h). Detecta oportunidades con k-anonimato (≥ 5 clientes) para recuperar inactivos (25+ días), incentivar horas valle frente a históricos de 3 semanas, o premiar a clientes VIP (5+ visitas). Toda redención es auditada y registrada en el Ledger contable al momento de pagar en caja.',
  },
  {
    q: '¿Cómo asiste Bunzy en la creación de campañas y marketing para comercios?',
    a: 'Dentro de cualquier chat de negocio o en el panel de marketing, el afiliado puede invocar a Bunzy Co-Pilot en modo "Crear propuesta comercial". Bunzy analiza la oportunidad y redacta una propuesta estructurada con mensaje cordial, % de cashback en caja, tope de Bunz y vigencia. El afiliado siempre debe revisar y aprobar explícitamente antes de que la campaña se active.',
  },
  {
    q: '¿Cómo funciona la detección de proximidad y las alertas de fidelidad?',
    a: 'Cuando un Rabbitter voluntariamente activa o consulta el mapa interactivo Freehands (/map), el sistema evalúa negocios cercanos (≤ 250m). Si el cliente tiene 10 o más consumos históricos con el afiliado, recibe una alerta con bonificación especial de doble cashback (con tope de 50 Bunz) para su consumo en caja. Si está en la puerta (≤ 60m), emite un aviso discreto al POS para que el staff salude al comensal.',
  },
  {
    q: '¿Dónde encuentro cada función en el Admin de Rabbitty?',
    a: 'El Admin se organiza en 4 pilares: 1. Operación En Vivo (Dashboard, POS /pos, Kiosko /kiosk, Cocina KDS /kitchen, Turnos /staff/shifts, Mesas /table-layout, Reportes /reports). 2. Carta & Productos (Menú /menu, Recetas /recipes, Inventario /inventory, Proveedores /suppliers, Gastos /expenses). 3. Crecimiento (Lealtad /loyalty, Clientes /customers, Campañas /campaigns, Referidos /referrals, Guías /academy). 4. Configuración (Sucursales, Hardware, Sincronización POS).',
  },
  {
    q: '¿Dónde veo qué negocios aceptan Bunz?',
    a: "En la pantalla principal (Stock o Feed) y en la pestaña Freehands (nuestro mapa inteligente), verás en tiempo real todos los negocios afiliados cercanos a tu ubicación.",
  },
  {
    q: '¿Cómo reclamo mis Bunz con el QR de mi ticket?',
    a: 'Cada ticket impreso trae un QR de reclamo y un Folio Rabbitty. Opción 1: abre la cámara de tu iPhone y escanea el QR; se abre directo la app Rabbitty y se acreditan tus Bunz. Opción 2: dentro de la app toca Escanear y apunta al QR. Cada ticket se puede reclamar una sola vez. Si la cámara te abre el navegador en lugar de la app, actualiza Rabbitty a la última versión y vuelve a intentarlo.',
  },
  {
    q: '¿Qué hago si el cajero no me identificó antes de pagar?',
    a: 'No pierdes tus Bunz. Tienes tres vías: 1. Escanea el QR de tu ticket impreso (arriba). 2. Pídele al cajero que, justo después de cobrar, escanee tu QR Rabbitty con la cámara del POS o teclee tu teléfono de 10 dígitos. 3. Si estás en un negocio con kiosko o mostrador, escanea el QR Neón del negocio para identificarte.',
  },
  {
    q: '¿Me avisan cuando gano o gasto Bunz?',
    a: 'Sí. Recibes una notificación push al instante: "Ticket canjeado con éxito" cuando ganas Bunz, y "Pago realizado con éxito / Has gastado X Bunz en [negocio]" cuando pagas o canjeas. Si no te llegan, revisa que las notificaciones de Rabbitty estén activas en Ajustes de tu iPhone. Todas quedan también en tu centro de notificaciones dentro de la app.',
  },
];

export const DOC_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'El Ecosistema Rabbitty',
    body: 'Rabbitty es una red de recompensas que conecta negocios locales y consumidores con un modelo Give-to-Get. Al visitar los comercios de la red Stock y escanear tu billetera, recibes un porcentaje de tus compras en Bunz.',
  },
  {
    title: 'Affiliate Growth Engine & Bunzy Co-Pilot',
    body: 'Motor comercial para que los comercios afiliados activen campañas flash en horas valle, recuperen comensales inactivos y premien a clientes fieles. Incluye auditoría ROI (fiat generado por Bunz invertido), topes presupuestarios por comensal, deduplicación e integración con el Ledger contable.',
  },
  {
    title: 'Ubicación Inteligente y Radar de Proximidad',
    body: 'Geolocalización en primer plano que permite a los usuarios descubrir locales en el mapa y recibir ofertas de doble cashback por fidelidad (al pagar en caja). Cuenta con k-anonimato (≥ 5 personas) para proteger la privacidad del comensal y notificaciones de llegada sutiles al POS.',
  },
  {
    title: 'La Billetera Bunz',
    body: 'Tu billetera funciona con tecnología blockchain invisible: tus Bunz te pertenecen. Para cobrar, muestra tu código QR en el establecimiento. Bóvedas Temporales: si recibiste Bunz por teléfono antes de registrarte, tienes 3 meses para crear tu cuenta o se devuelven a la Tesorería.',
  },
  {
    title: 'Stock y Freehands (Mapas)',
    body: 'En el menú inferior encuentras dos formas de descubrir recompensas: Stock (Feed) lista negocios activos y sus cashbacks en Bunz; Freehands (Mapa) es un mapa interactivo y geolocalizado para encontrar los locales más cercanos en tiempo real.',
  },
  {
    title: 'Niveles y Referidos',
    body: 'Acumulas Hops (puntos de experiencia por tus visitas) y tu nivel de Madriguera sube, cambiando el borde de tu avatar a colores únicos (Legendario, Épico, Raro). Con el Programa de Referidos invitas a tus amigos y ambos ganan Bunz en la primera transacción del invitado.',
  },
  {
    title: 'Rabbitty Mood y Campañas Dinámicas',
    body: 'El usuario registra cómo se siente hoy para recibir música y lugares afines. Los negocios afiliados lanzan Campañas por Mood en franjas horarias clave para atraer clientes con bonos especiales de Bunz.',
  },
  {
    title: 'Estrategia Hermes IA & Proof of Atmosphere (PoA)',
    body: 'Hermes analiza el pulso comercial, horas muertas y optimización de carta para los afiliados. Con Proof of Atmosphere (PoA), los comercios aplican recetas de iluminación, música y ambientación para elevar el tiempo de estancia y satisfacción.',
  },
  {
    title: 'Rabbitty POS y Corte de Caja',
    body: 'El sistema POS opera en iPad, Mac y Web. Permite asignación de mesas y cobro multidivisa (Efectivo, Tarjeta, Bunz). La caja opera por turnos con PIN: apertura con fondo inicial (obligatoria para cobrar en efectivo), retiros con PIN, cierre parcial X, cambio de cajero con doble PIN y cierre Z con arqueo ciego y PIN de manager/admin. La bitácora inmutable está en el admin en Turnos de Caja.',
  },
  {
    title: 'KDS Cocina y Kiosko Autoservicio',
    body: 'El KDS digitaliza las comandas de cocina con alertas visuales de tiempo (verde, naranja, rojo). El Kiosko autoservicio en pantalla táctil acelera pedidos con catálogo interactivo y pago con QR o ticket de mostrador.',
  },
  {
    title: 'Seguridad de Última Generación',
    body: 'Protección con biometría nativa (Face ID / Touch ID / WebAuthn), PIN local de 4 dígitos hasheado con PBKDF2 y sal criptográfica, y verificación en dos pasos (2FA) real mediante OTP por correo, SignalWire SMS o App Autenticadora TOTP.',
  },
];

export const SUPPORT_QUICK_QUESTIONS: string[] = [
  '¿Qué son los Bunz?',
  '¿Cómo gano Bunz?',
  '¿Puedo transferir mis Bunz?',
  '¿Cómo funciona el programa de referidos?',
  '¿Dónde veo los negocios que aceptan Bunz?',
];

export const SUPPORT_KNOWLEDGE =
  'CENTRO DE AYUDA RABBITTY (FAQ):\n' +
  FAQS.map((f) => `· ${f.q}\n  → ${f.a}`).join('\n') +
  '\n\nGUÍA / DOCUMENTACIÓN:\n' +
  DOC_SECTIONS.map((d) => `· ${d.title}: ${d.body}`).join('\n') +
  '\n\nCOMUNIDADES OFICIALES EN RABBITTY HUB (TELEGRAM & IN-APP):\n' +
  '· General (#): Comunidad principal y anuncios para todos los usuarios.\n' +
  '· Soporte Técnico (S): Resolución de incidencias, pagos y dudas técnicas dentro de la app.\n' +
  '· Soporte Demos (S): Demostraciones guiadas y onboarding para nuevos usuarios y comercios.\n' +
  '· Affiliates Circle (A): Comunidad de negocios y comercios afiliados.\n' +
  '· Rabbitters Zone (R): Círculo exclusivo de Rabbitters (Nodos de la red).\n' +
  'Nota para Bunzy: Cuando un usuario pregunte por grupos, soporte o comunidades, puedes darle asistencia directa in-app y ofrecerle el enlace directo si desea entrar al grupo de Telegram.';

const SUPPORT_STOPWORDS = new Set([
  'que', 'con', 'para', 'por', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'del', 'esta', 'este',
  'como', 'donde', 'cuando', 'hola', 'quiero', 'puedo', 'podria', 'puedes', 'tienes', 'hay',
  'mas', 'pero', 'sin', 'sobre', 'mis', 'tus', 'the', 'and',
]);

function supportTokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !SUPPORT_STOPWORDS.has(t));
}

/**
 * Devuelve la mejor FAQ para una consulta de soporte, o null si no hay match claro.
 * Requiere score >= 4 o coincidencia directa con la pregunta clave para no secuestrar
 * conversaciones generales sobre negocios o comida.
 */
export function matchFaq(content: string): FaqItem | null {
  const norm = (content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Pregunta directa obligatoria de soporte
  if (/\b(que son los bunz|para que sirven los bunz|que es un bunz)\b/.test(norm)) {
    return FAQS[0]; // ¿Qué son los Bunz?
  }
  if (/\b(como ganar bunz|como gano bunz|como conseguir bunz)\b/.test(norm)) {
    return FAQS[1]; // ¿Cómo gano Bunz?
  }
  // Preguntas directas de POS, Corte de Caja y Admin
  if (/\b(corte de caja|cierre de caja|cierre de turno|arqueo|ticket z)\b/.test(norm)) {
    return FAQS.find((f) => f.q.includes('Corte de Caja')) || FAQS[0];
  }
  if (/\b(reporte|reportes|exportar csv|metricas de venta|p&l|iva)\b/.test(norm)) {
    return FAQS.find((f) => f.q.includes('Reportes de Ventas')) || FAQS[0];
  }
  if (/\b(kds|cocina digital|comanda digital|pantalla de cocina)\b/.test(norm)) {
    return FAQS.find((f) => f.q.includes('KDS')) || FAQS[0];
  }
  if (/\b(kiosko|kiosk|autoservicio|terminal de autoservicio)\b/.test(norm)) {
    return FAQS.find((f) => f.q.includes('Kiosko')) || FAQS[0];
  }
  if (/\b(readiness|preparacion|porcentaje|nivel de preparacion|barra de preparacion|onboarding)\b/.test(norm)) {
    return FAQS.find((f) => f.q.includes('Readiness')) || FAQS[0];
  }
  if (/\b(donde encuentro|donde esta|como llegar a|que funciones|donde se encuentran|mapa del admin)\b/.test(norm)) {
    return FAQS.find((f) => f.q.includes('dónde encuentro cada función') || f.q.includes('Dónde encuentro')) || FAQS[0];
  }

  const tokens = new Set(supportTokens(content));
  if (tokens.size === 0) return null;

  let best: FaqItem | null = null;
  let bestScore = 0;

  for (const faq of FAQS) {
    const hay = new Set(supportTokens(faq.q));
    let score = 0;
    for (const t of tokens) if (hay.has(t)) score += t.length >= 6 ? 3 : 2;
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  // Solo si hay coincidencia real con la pregunta de FAQ (score >= 4)
  return bestScore >= 4 ? best : null;
}
