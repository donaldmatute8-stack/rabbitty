export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: '¿Qué son los Bunz?',
    a: 'Los Bunz son puntos de lealtad del ecosistema Rabbitty. Recibes Bunz como recompensa cuando consumes en negocios afiliados y puedes usarlos en otros negocios participantes. No son dinero de curso legal, no son inversión y no se convierten a efectivo.',
  },
  {
    q: '¿Cómo gano Bunz?',
    a: '¡Es automático! Cada vez que pagas en un restaurante o negocio con el sistema Rabbitty POS, muestras el código QR de tu billetera o das tu número de teléfono. El cajero lo escanea y un porcentaje de tu cuenta se regresa en Bunz, conforme a la recompensa publicada por el negocio.',
  },
  {
    q: 'Pagué y no me llegaron mis Bunz, ¿qué hago?',
    a: 'Avisa en el negocio con tu ticket (folio RBBTY). El comercio abre una **conciliación** desde su panel: ahí se compara lo que la orden debía acreditar contra lo que realmente se acreditó. Si estás de acuerdo, el negocio la aprueba y el equipo Rabbitty autoriza la entrega; los Bunz se acreditan con la misma llave de la orden original, así que **nunca se duplican**. Te llega una notificación diciendo “Tus Bunz ya han sido actualizados” con el monto corregido.',
  },
  {
    q: '¿Qué es una conciliación de Bunz?',
    a: 'Es el mecanismo para corregir un acreditado que no cuadra (se cobró y no se emitieron Bunz, o se emitió de menos). Tiene dos pasos: el negocio revisa y decide, y Rabbitty autoriza la entrega. Queda registrada en la bitácora con quién, cuándo y cuánto. Sirve para que el ajuste no dependa de “un favor” por mensaje: queda auditado y visible para el comensal en su billetera.',
  },
  {
    q: '¿Tienen fecha de vencimiento?',
    a: 'Los Bunz en tu cuenta registrada no vencen. Sin embargo, si un negocio te emite Bunz a tu número telefónico y aún no has creado tu cuenta (Bóveda Temporal), tienes 3 meses para registrarte antes de que expiren.',
  },
  {
    q: '¿Puedo transferir mis Bunz a otra persona?',
    a: '¡Sí! Puedes transferir Bunz al instante a cualquier usuario por su @usuario, ID o código QR desde el chat de Bunzy o tu Billetera. Las transferencias están protegidas por Face ID / PIN de seguridad y verificación en dos pasos (2FA). Los Bunz son fungibles: puedes ganarlos en un negocio y usarlos en cualquier otro negocio afiliado. No son convertibles a efectivo. La regla de “no transferible” aplica al incentivo o capacidad del negocio afiliado, no a tus Bunz.',
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
  {
    q: 'Soy negocio afiliado. ¿Qué es la capacidad y cómo se recupera?',
    a: 'La capacidad es el límite operativo para recibir redenciones de Bunz. No es dinero, depósito, inversión ni compra de Bunz. Puede incluir un incentivo de incorporación y capacidad adelantada recuperable. La recuperación se calcula por ciclo con una tasa dinámica, se te avisa con el importe exacto y debes aceptarla en un modal antes de que se aplique. Nunca se toca la capacidad comprometida con los Rabbitters, no genera intereses y no tiene efectos retroactivos. Si rechazas la propuesta, no se descuenta nada.',
  },
  {
    q: '¿La capacidad o los paquetes tienen montos fijos?',
    a: 'No. La capacidad se estima con tus ventas mensuales elegibles, tu porcentaje de recompensa y los meses de cobertura que elijas. El alta muestra una estimación referencial; la capacidad real se confirma en una oferta individual después de revisar tu negocio. No se activa nada sin tu aceptación.',
  },
  {
    q: '¿Qué son las Membresías Rabbitty?',
    a: 'Son planes de un negocio afiliado que te dan derechos recurrentes: consumos incluidos (ej. 1 café al día), descuentos permanentes o saldo de crédito. Pagas una cuota (mensual, trimestral, semestral o anual) y muestras tu QR dorado en caja para canjear tus beneficios.',
  },
  {
    q: '¿Cómo me suscribo a una membresía?',
    a: 'Entra al perfil del negocio en la app → pestaña Sucursal → sección 🎟️ Membresías → elige el plan y toca "Suscribirse". El pago es seguro con Stripe y al confirmar, tu membresía aparece en Perfil → Mis Membresías con su QR.',
  },
  {
    q: '¿Cómo canjeo mi membresía en el local?',
    a: 'Abre Perfil → Mis Membresías → toca tu membresía → muestra el QR dorado (se renueva cada 30 segundos por seguridad) al cajero. Él lo escanea y tu beneficio se aplica al instante; verás cuántos usos te quedan del ciclo.',
  },
  {
    q: '¿Cómo cancelo mi membresía?',
    a: 'En Perfil → Mis Membresías → abre la membresía y usa "Cancelar". Conservas todos tus beneficios hasta el final del periodo ya pagado; no se renueva el siguiente ciclo.',
  },
  {
    q: '¿Qué pasa si se me vence la membresía?',
    a: 'Cuando termina tu periodo pagado, la membresía pasa a "Expirada" y deja de canjear. Puedes renovarte desde el perfil del negocio en cualquier momento.',
  },
  {
    q: '¿Cómo funcionan las membresías de Rabbitty?',
    a: 'Una membresía es un plan de un negocio afiliado que te da beneficios durante tu ciclo: consumo incluido (por ejemplo un café al día), descuentos, crédito o acceso a eventos. Se compra desde la app en Descubrir o en caja; tu pase vive en Mis Membresías con un QR que el negocio escanea. Al escanearlo se aplican tus beneficios automáticamente y el sistema lleva la cuenta de la cuota: no puedes canjear dos veces el mismo beneficio.',
  },
  {
    q: '¿Qué es el bono de lealtad y cómo lo gano?',
    a: 'Es un extra de Bunz por mantener tu membresía. Con 2 a 4 renovaciones entras a Plata (+10 % sobre el cashback de tus compras) y con 5 o más a Oro (+20 %). No es emisión libre: se paga de un pozo mensual equivalente al 10 % del neto de tu membresía, así que si se agota se detiene hasta el siguiente mes. Las cortesías y promociones no generan bono.',
  },
  {
    q: '¿Qué es la lista de deseos y cómo me regalan algo?',
    a: 'En Perfil → Mi lista de deseos guardas lo que quieres de tus lugares (toca el corazón en un producto) o un deseo libre con monto. Puedes compartirla con un grupo de tu madriguera; ellos ven tus deseos y pueden "apuntarse" a regalarte o pagarlo de una vez: al pagar se genera un código que tú muestras en caja para recogerlo. Los deseos caducan a los 90 días y los vales a los 60.',
  },
  {
    q: '¿Por qué no me llegan avisos de "ya te alcanza"?',
    a: 'Porque son opt-in: actívalos en Ajustes → Notificaciones → "Avisarme cuando me alcance para mi favorito". Además solo se envían si tu saldo cubre el precio, si estás en tu horario habitual o cerca del local, máximo uno por negocio cada 3 días y tres por semana. Nunca llegan entre 21:00 y 09:00, ni como push si tienes la app abierta (salen in-app).',
  },
];

export const DOC_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Bunzy Connect — comunicación, estrategias y cadencias',
    body: 'Bunzy Connect es el canal oficial de Rabbitty dentro del chat del negocio y de la app. Categorías: PRODUCTO (actualizaciones de producto, SIEMPRE manuales: se envían cuando hay algo nuevo), TIPS (consejos prácticos, máximo 1 por semana), NOVEDADES (campañas y eventos; 1-2 al mes para afiliados y mensual para Rabbitters) y AVISOS DE SISTEMA (mantenimiento/seguridad; siempre llegan y no respetan preferencias). Topes: TIP 6 días, NEWS 15 días, PRODUCTO sin automatización, SISTEMA sin tope. Estrategias de ataque: PRODUCTO = lanzamiento manual + un recordatorio 3-7 días después; TIPS = serie semanal rotando menú digital, productos populares, recompensas Bunz y revisión de actividad; NOVEDADES = quincenal para afiliados y mensual para Rabbitters, con un solo CTA; SISTEMA = inmediato, claro y con hora de restauración. Segmentación: un negocio, todos los afiliados o todos los Rabbitters; los masivos se encolan y el cron entrega por lotes. Mejores prácticas: un CTA por mensaje, máximo 3 bullets, no prometer ingresos ni funciones no lanzadas, revisar lectura/clics/opt-out y pausar si el opt-out sube. El afiliado puede apagar tips y novedades; los avisos de sistema no. Producto y cambios nuevos se anuncian manualmente, no por serie.',
  },
  {
    title: 'Pagar cuentas con Bunz (sin QR)',
    body: 'Los negocios afiliados pueden aceptar que tu cuenta se pague 100% con Bunz directamente desde tu App (botón "Pagar con Bunz" en el recibo), sin escanear QR. Requiere: que el negocio lo permita (Admin → Ajustes → Bunz), que tengas saldo suficiente, y horario dentro del que el negocio publicado. No genera cashback (los Bunz no generan Bunz). Si el pago es parcial por límite de % configurable del negocio, el resto se cobra en fiat en el local. El negocio configura disponibilidad (horario), mínimos/máximos por factura, límite diario atómico, % máximo de la factura pagable en Bunz y catálogo de productos. Al redimirse los Bunz, el stock de disponibilidad del negocio se reduce (su oferente cumple el compromiso) — sin cashback por pagos en Bunz.',
  },

  {
    title: 'Alta de negocio, capacidad dinámica y recuperación',
    body: 'El alta de un afiliado empieza eligiendo NICHO. Hoy están cubiertos: restaurante, cafetería, bar, panadería/postres, pizzería, taquería/antojitos, barbería/estética, gym/fitness, tienda/retail y servicios con cita. El nicho define qué módulos ve el negocio (mesas, cocina/KDS, reservas, propinas, inventario, recetas, código de barras, citas) y de él se deriva la categoría operativa. Después del nicho vienen: bienvenida/contrato, datos básicos (nombre, dirección), recompensa en Bunz (mínimo 10%), capacidad dinámica y firma. La capacidad no es un paquete fijo: se estima con ventas mensuales elegibles × % de recompensa × meses de cobertura. Es una estimación referencial y no autoriza capacidad. La capacidad autorizada puede incluir un incentivo de incorporación y capacidad adelantada recuperable. Al cierre de cada ciclo, Rabbitty calcula una propuesta de recuperación con el importe exacto y el afiliado debe aceptarla en un modal antes de que se aplique; si la rechaza, no se descuenta nada y no se toca la capacidad comprometida con los Rabbitters. Bunzy explica cada paso sin inventar condiciones ni montos: los números salen de la operación del negocio y de la oferta que revise Rabbitty.',
  },

  {
    title: 'Nichos que todavía no cubrimos (solicitud de giro)',
    body: 'Rabbitty conoce el contexto de más giros de los que ya opera. Además de los cubiertos (restaurante, cafetería, bar, panadería, pizzería, taquería, barbería, gym, retail y servicios con cita), existen giros conocidos pero aún NO disponibles: veterinaria, farmacia, lavandería, hotel/hospedaje, florería, ferretería, papelería, taller mecánico, estética canina y coworking; y puede llegar cualquier otro. Si el giro de la persona no está cubierto, Bunzy NO la fuerza a un nicho ajeno: le dice que todavía no llegamos a su nicho de mercado, que la solicitud queda registrada y le pide CORREO y WHATSAPP (los dos obligatorios). La app guarda la solicitud en la cola de producto y envía de inmediato un correo de bienvenida personalizado por giro con Resend. Bunzy nunca promete fechas ni módulos que aún no existen. Un nicho inactivo se reconoce como contexto, pero no aparece como opción en el onboarding.',
  },

  {
    title: 'Dónde configuro mi negocio (Admin)',
    body: 'Toda la configuración del negocio vive en UN solo lugar: menú Configuración → "Mi negocio" (/perfil-negocio), con 5 pestañas. (1) Perfil público: nombre, "Acerca de", dirección, sitio web, portada y logo, días y horario, % de cashback, y el canal de atención del chat. Es lo que ve el Rabbitter en la app. (2) Sucursal: nombre en el ticket, slug para QR y links, teléfono, email, pie del ticket y datos fiscales (razón social, RFC, régimen, moneda, IVA, zona horaria). (3) Operación POS: Happy Hour, tipo de cambio USD (automático o manual), horas antes de expirar una comanda sin pagar, sonido y alerta de pedidos nuevos, mostrar USD en el ticket, propinas de tarjeta pagables en caja y gratificación voluntaria (opciones 5/10/15%). (4) Bunz: aceptar Bunz como pago, disponibilidad, mínimos/máximos, % máximo de la cuenta pagable en Bunz y límite diario. (5) Equipo & Hardware: accesos directos. Lo operativo sigue en su propia pantalla: Menú & productos (/menu), Personal y PIN (/staff), Impresoras (/hardware), POS (/pos), Sucursales y afiliados (/restaurants). La seguridad de la cuenta (2FA, Face ID, dispositivos) está en Ajustes → Seguridad.',
  },

  {
    title: 'Face ID, 2FA y seguridad de la cuenta (incluye negocios)',
    body: 'En Ajustes → Seguridad, cualquier cuenta —también las de negocio/afiliado— puede registrar Face ID o huella como llave de acceso (se guarda por usuario, en el dispositivo) y activar 2FA con app autenticadora. La tarjeta de biometría del founder es distinta: gestiona la llave maestra de la plataforma. Si un afiliado dice que no ve la opción de Face ID, es porque estaba entrando a la tarjeta equivocada; ahora su cuenta tiene su propia tarjeta con sus propias llaves.',
  },

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
  {
    title: 'Rabbitty Memberships — cómo opera por dentro',
    body: 'Un negocio crea planes versionados (precio, periodicidad y beneficios). Al publicar una versión el plan aparece en Descubrir (marketplace) si está visible. La suscripción se paga con Stripe Connect (recurrente) o en caja (efectivo/promo). El pase del cliente lleva un QR firmado de 30 segundos; el POS lo escanea, resuelve sus beneficios y los aplica, y el canje es atómico e idempotente (no se duplica). El ticket no imprime Bunz ni QR cuando la membresía cubre todo; si hay productos pagados, imprime el desglose y el QR solo si no hubo crédito automático. Métricas: miembros activos, MRR, churn y retención a 30 días, renovaciones, canjes por socio y niveles Bronce/Plata/Oro.',
  },
  {
    title: 'Bono de lealtad — regla económica',
    body: 'El bono premia la antigüedad, no el gasto: Plata (2-4 renovaciones) suma 10 % y Oro (5+) 20 % sobre el cashback de una compra pagada. Se financia con un pozo mensual del 10 % del neto de la membresía (precio menos 8 % de comisión de plataforma); si el pozo se agota, no hay bono ese mes. No aplica a cortesías, invitaciones o promociones, ni a consumos cubiertos por la membresía. El ticket muestra "Incluye +X Bunz por lealtad". Los Bunz son fungibles y no vencen.',
  },
  {
    title: 'Lista de deseos y regalos',
    body: 'El cliente guarda deseos desde el corazón de un producto (con negocio, foto y precio) o como deseo libre con monto. La lista es privada; se comparte explícitamente con grupos de la madriguera. Otros miembros pueden "apuntarse" a regalar (compromiso) o pagar el regalo: se cobra con Stripe Connect al negocio con 8 % de comisión, se genera un código de 8 caracteres y el destinatario lo canjea en caja (POS → Canjear vale). El vale vence a los 60 días y los deseos a los 90. El negocio nunca ve la lista; solo ve el vale al canjear y métricas agregadas.',
  },
  {
    title: 'Avisos inteligentes — qué se envía y cuándo',
    body: 'Tipos: "ya te alcanza" (saldo cubre tu favorito, en tu franja o cerca), "hace 21 días que no vienes", cumpleaños (solo si compartiste tu lista), promo sobre tu favorito y "ya te alcanza para tu deseo". Todos son opt-in explícito en Ajustes → Notificaciones. Reglas: máximo un aviso de engagement al día, uno por negocio cada 72 horas, tres por semana, nada entre 21:00 y 09:00, y si la app está abierta el aviso sale in-app (no push duplicado). Los avisos transaccionales (pedidos, pagos, chat, seguridad) siempre llegan.',
  },
  {
    title: 'Panel del afiliado — qué revisar cada semana',
    body: 'En Admin → Memberships: miembros activos, MRR, churn y retención 30d, renovaciones, canjes por socio y niveles. En la tarjeta de lealtad: bono otorgado contra pozo disponible, órdenes bonificadas y detalle por socio. En preferencias: favoritos más comunes, categorías, demanda semanal por producto y % de quienes tienen favorito que son socios. En lista de deseos: deseos activos, regalos pagados y canjeados. En avisos: enviados, apertura y conversión. Si el consumo del pozo supera 90 % conviene ajustar el porcentaje; si la conversión es baja, revisar horarios y opt-in.',
  },
  {
    title: 'Empleados, roles y terminales del negocio (operación diaria)',
    body: 'DÓNDE: Admin → Personal & Roles (fichas del equipo) y Admin → Ajustes → Terminales (dispositivos). Son dos mitades distintas: la ficha dice QUIÉN es la persona; la terminal dice EN QUÉ dispositivo trabaja. Roles y permisos: Propietario, Admin y Gerente pueden todo lo operativo (pedidos, cobrar, caja, descuentos, reembolsos, configuración, reportes); Cajero cobra, maneja caja y redime Bunz pero NO reembolsa ni regala cortesías ni configura; Mesero toma pedidos y cobra pero NO abre/cierra caja ni reembolsa; Cocina solo usa KDS. El rol nunca amplía la sucursal: un cajero sigue atado a su sucursal. ALTA DE EMPLEADO: nombre, correo (único por sucursal), rol y PIN de 4 dígitos (único entre empleados; se guarda cifrado y nadie puede leerlo). Solo el dueño o un ADMIN crean o editan administradores; un gerente no puede fabricar pares con más privilegios. BAJA: se DESACTIVA (no se borra): deja de entrar, su PIN deja de servir y se conserva su historial de ventas, propinas y turnos; es reversible. Nunca se puede dejar la sucursal sin un Admin/Gerente activo. TERMINALES: cada dispositivo se autoriza una vez. Primera vinculación: abrir /pos/link con la cuenta del negocio, poner nombre (Caja 1) y vincular. Dispositivo sin sesión: /pos/auth genera un código de 6 dígitos que el dueño/admin recibe por push o Telegram (un solo uso, atado a ese dispositivo). También hay invitación por QR de un solo uso en Ajustes → Terminal Móvil. ASIGNACIÓN (no es automática): en Ajustes → Terminales, por cada terminal se define Tipo (Caja cobra / Comandero toma pedidos / KDS cocina), Caja-gaveta (registerId, por defecto MAIN; las terminales con el mismo nombre comparten corte) y Estación fija (a qué estación de preparación manda los pedidos). El empleado NO se asigna en Ajustes: se identifica en el POS al abrir turno con su PIN, y así queda atado a esa terminal y gaveta. Regla mental: el dispositivo se asigna a la caja, la persona se asigna al turno. TURNOS: un turno abierto por terminal; al abrir uno nuevo se cierran los huérfanos de esa terminal; las acciones sensibles (anular, reembolsar, autorizar) piden PIN de Admin/Gerente, no el del cajero. REVOCAR una terminal impide que ese dispositivo abra sesión nueva, pero NO borra ventas ni historial. IMPRESIÓN EN IPAD: solo la app nativa Rabbitty POS imprime por Bluetooth; Safari/Edge/PWA en iPadOS no exponen Web Bluetooth. ACCESO AL PANEL: sin contraseña; se entra con enlace mágico/código al correo o con Telegram, y opcionalmente passkey (Face ID/Touch ID) donde el dispositivo lo soporte. Un correo sin cuenta no recibe el enlace: primero se crea la cuenta y la ficha de staff.',
  },
  {
    title: 'Rabbit Chair (La Silla) — experiencia del negocio',
    body: 'Rabbit Chair es una activación secreta del negocio: una silla bajo un spot, un bartender (a veces con máscara), música curada y diez minutos para tomar algo. El cliente NO habla: configura su bebida desde el teléfono y paga con tarjeta (aporte libre, mínimo $50). Acceso: por créditos que Rabbitty otorga por hito (regalo); no se vende dentro de la app. El negocio elige formato (una silla de uno en uno, varias a la vez, oleadas o parejas), cupo, duración, carta (café, coctelería o ambas) y bartender (fijo o sorpresa). Si hay alcohol, la experiencia es +18. Operación: el negocio crea y abre la activación en Marketing → Rabbit Chair; en el POS toca La Silla para apartar lugar, sentar y marcar Servido (arranca el cronómetro). El cronómetro es de 10 minutos desde que se sirve. Cerrar la activación la archiva y entra a la caja como cualquier venta. Cancelar un borrador devuelve el crédito. Para pedir acceso o créditos, el negocio escribe por el chat de soporte o recibe su enlace privado. Ya incluye: aviso push del lanzamiento, fecha aleatoria, lista de espera con invitación y cobro del aporte en caja. El cliente toma su lugar desde la app, configura la bebida sin hablar, paga con tarjeta (Stripe del negocio) y recibe un pase con QR. La fila se invita cada 5 minutos por cron.',
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
  '\n\nSOPORTE Y COMUNIDADES (TODO DENTRO DE LA APP):\n' +
  '· Soporte 1:1: chat directo con el equipo de Rabbitty. Un hilo por negocio, con historial; no hay grupos externos.\n' +
  '· Avisos oficiales: canal Bunzy con novedades, mantenimiento y tips.\n' +
  '· Guías y FAQ: /support/docs y /support/faq.\n' +
  'Nota para Bunzy: si preguntan por soporte, grupos o comunidades, dirige SIEMPRE al chat de soporte in-app; no ofrezcas Telegram ni canales externos.\n\n' +
  'RABBITTY CODE (QR NEÓN PROPIETARIO):\n' +
  '· El RabbittyCode es el QR neón propietario de Rabbitty (anillos de onda + esquinas holográficas). NO es un QR estándar: SOLO la App Rabbitty puede escanearlo (el escáner interno decodifica sus barras de onda). La cámara normal del iPhone NO lo lee.\n' +
  '· Cada Rabbitter tiene su RabbittyCode en /scan?tab=my-code ("Mi Código"). Los comercios afiliados tienen el suyo en su portal de negocio. Sirve para identificarse, transferir bunz entre Rabbitters y check-in en locales.\n' +
  '· Donde se necesita cámara genérica (cajas con iPad, impresos), Rabbitty usa QR estándar complementario o QRs con tokens.\n\n' +
  'KIT DE MATERIALES IMPRESOS (/impresos):\n' +
  '· Los afiliados y el God Admin generan habladores de mesa, carteles A3, señalética POS y stickers en https://www.rabbitty.me/impresos — dinámicos por tenant con QRs permanentes (los QRs impresos no cambian aunque evolucionen las rutas internas).\n' +
  '· ACCESO: los dueños de negocio entran escaneando el código de acceso con su App Rabbitty (queda autorizado su rol de afiliado). El God Admin entra igual o con su clave.\n' +
  '· Cada afiliado puede generar CÓDIGOS DE ACCESO TEMPORALES (24 h) desde la barra superior de /impresos para su equipo (impresor, marketing): solo ven/impresan SU material, sin poder modificar nada. El God Admin puede generar accesos con vista de todos los tenants.\n' +
  '· El porcentaje de bunz del material sale del mismo % configurado en el Admin (fuente única), y el bono de bienvenida del QR lo define el dueño (split triangular 60% afiliado / 40% Tesorería Rabbitty con tope mensual).\n' +
  'Nota para Bunzy: si un afiliado pregunta cómo imprimir sus materiales o dar acceso a su impresor, refiérelo a https://www.rabbitty.me/impresos (desde su Admin también puede abrirlo) y explícale el acceso temporal de 24 h para su equipo.';

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
