# 🚀 Kit Oficial de Envío a App Store Connect — Rabbitty iOS

**Aplicación:** Rabbitty (App de Usuarios y Pagos QR)  
**Bundle Identifier:** `com.rabbitty.app`  
**Versión Actualizada:** `2.2` (Build `6`)  
**Equipo Apple Developer:** `FW97275K5X`  
**Target:** iOS 15.0+ (iPhone & iPad)

---

## 📸 1. Capturas Oficiales de la App (App Store Screenshots)

El paquete gráfico consta de **7 capturas de pantalla de la interfaz de Rabbitty**:

1. **Pantalla 1 — Pase Digital & Home:**  
   _Muestra el Rabbitty Pass Lvl. 1, el saldo de Bunz y el feed de cafeterías y restaurantes cercanos con multiplicadores (+20% Bunz)._
2. **Pantalla 2 — Pago QR Dinámico & Rabbitty ID:**  
   _Muestra el código visual con identificador animado, diseñado para escanear en caja con velocidad y brillo optimizado._
3. **Pantalla 3 — Bunzy AI (Asistente Local Inteligente):**  
   _Muestra la conversación fluida con Bunzy respondiendo dudas sobre el ecosistema, locales asociados y preguntas frecuentes._
4. **Pantalla 4 — Rabbitty Mood:**  
   _Selector ambiental y sensorial (Calma, Energía, Enfoque, Celebración, Conexión, Sorpresa) para personalizar la experiencia culinaria y musical._
5. **Pantalla 5 — Rabbitty Vibe Passport (Rutas Urbanas):**  
   _Muestra la Ruta Creativa & Deep Work con sellos coleccionables en cafeterías de especialidad, bistros y espacios silenciosos._
6. **Pantalla 6 — Portal de Afiliados (Comercios):**  
   _Muestra la vista de negocio (Ka13), métricas de tickets/clientes, crédito de minteo y control de la tasa de recompensa en tiempo real._
7. **Pantalla 7 — Stock de Ofertas & Cupones:**  
   _Muestra las ofertas disponibles canjeables directamente con Bunz en comercios destacados (626 Café, Surf & Co)._

---

## 📝 2. Textos Oficiales de la Ficha (Metadatos de App Store Connect)

### Nombre de la App (Máx. 30 caracteres)

```text
Rabbitty — Gana Bunz y Paga
```

_(27 caracteres)_

### Subtítulo (Máx. 30 caracteres)

```text
Recompensas y cashback local
```

_(28 caracteres)_

### Categoría Principal

- **Principal:** Estilo de vida (Lifestyle) o Comida y Bebida (Food & Drink).
- **Secundaria:** Finanzas (Finance) o Compras (Shopping).

### Palabras Clave / Keywords (Máx. 100 caracteres separados por coma, sin espacios extras)

```text
bunz,cashback,puntos,lealtad,restaurantes,cafeterias,descuentos,huatulco,recompensas,pagos,qr,wallet
```

_(99 caracteres)_

### Texto Promocional (Máx. 170 caracteres - editable sin nueva versión)

```text
¡Llegó la versión 2.2! Descubre cafeterías y restaurantes locales, acumula Bunz en cada consumo, conversa con Bunzy tu asistente IA y canjea beneficios reales al instante.
```

### Descripción Completa de la App (Para la Ficha Pública)

```text
Bienvenido a Rabbitty, la forma más inteligente y divertida de descubrir tu ciudad, disfrutar de tus cafeterías y restaurantes favoritos y recibir recompensas reales por cada consumo.

Olvídate de las tarjetas de cartón que se pierden o apps de puntos complejas. Con Rabbitty tienes:

🐰 TU RABBITTY PASS DIGITAL
Tu pase de membresía siempre en tu bolsillo. Sube de nivel conforme visitas tus lugares favoritos y desbloquea multiplicadores de puntos automáticos.

⚡ PAGO Y CHECK-IN CON CÓDIGO QR
Muestra tu Rabbitty Code dinámico en la caja del establecimiento afiliado y acumula puntos Bunz en cuestión de segundos. Sin demoras ni fricciones.

💎 BUNZ: RECOMPENSAS QUE SÍ VALEN
Tus Bunz no expiran sin sentido. Úsalos directamente para pagar consumos, canjear bebidas de cortesía, postres o promociones exclusivas en la red de comercios participantes.

🤖 BUNZY — TU ASISTENTE LOCAL INTELIGENTE
¿No sabes a dónde ir hoy? Pregúntale a Bunzy. Nuestro asistente de inteligencia artificial te recomienda los mejores spots de café, cenas o promociones especiales basadas en tus gustos y ubicación.

🗺️ VIBE PASSPORT Y RUTAS URBANAS
Colecciona sellos digitales en cada parada gastronómica, completa circuitos urbanos y gana multiplicadores dobles de puntos.

Únete hoy a la comunidad Rabbitty y haz que cada salida cuente.
```

### URLs Requeridas por Apple

- **URL de Soporte:** `https://rabbitty.me/support` (o `https://app.rabbitty.me`)
- **URL de Marketing:** `https://rabbitty.me`
- **URL de Política de Privacidad:** `https://rabbitty.me/privacy`

---

## 🕵️‍♂️ 3. Información para el Revisor de Apple (App Review Notes)

> **CRÍTICO:** Los revisores de Apple rechazan apps si no pueden iniciar sesión de inmediato sin recibir SMS o enlaces externos de Telegram. Debe proporcionarse este acceso demo directo.

### Información de Inicio de Sesión Demo (Sign-in information en App Store Connect)

- **¿Requiere inicio de sesión?**: Sí (marcar casilla).
- **Nombre de usuario / Email:** `tester@rabbitty.me` _(o simplemente la palabra `tester`)_
- **Contraseña / Código OTP de 6 dígitos:** `123456`
- **Notas adicionales para el Revisor:**  
  _El usuario ingresa `tester@rabbitty.me` en la pantalla de bienvenida y el código fijo de 6 dígitos `123456` para acceso instantáneo sin requerir SMS ni Telegram._

### Notas de Revisión (Review Notes para el equipo de Cupertino)

```text
Dear Apple Review Team,

Rabbitty is a local rewards, loyalty, and QR payment companion app for curated coffee shops and restaurants.

To easily test all features of version 2.2:
1. Launch the app and sign in using the demo account credentials provided above:
   - Email: tester@rabbitty.me
   - OTP Code: 123456
2. The Home screen features the Rabbitty Pass, active Bunz balance, and nearby featured venues.
3. Tap the "Pagar" (Pay) button or QR icon to display the dynamic member Rabbitty Code intended for counter scanning at POS terminals.
4. Tap the "Bunzy AI" tab to interact with our local venue recommendation assistant.
5. In the "Vibe Passport" section, reviewers can explore themed urban dining routes and rewards progression.
6. Under the "Profile" tab, reviewers can also verify the "Eliminar cuenta permanentemente" (Account Deletion) feature compliant with App Store Guideline 5.1.1(v).

Note on permissions:
- Camera: Used exclusively for scanning partner QR codes at store locations.
- Push Notifications: Used to alert users when Bunz rewards are credited after a purchase.
- Biometrics (Face ID/Touch ID): Optional, for fast app unlock.

Thank you for your review. If you have any questions or require additional test data, please contact us at support@rabbitty.me.
```

---

## 🔒 4. Cuestionario de Privacidad (App Privacy Nutrition Labels)

Al responder las preguntas de privacidad de datos en App Store Connect:

1. **Información de Contacto:**
   - _Teléfono / Nombre:_ Sí, para autenticación y cuenta de usuario (vinculado a la identidad del usuario). No se comparte con terceros ni para rastreo publicitario.
2. **Identificadores:**
   - _User ID:_ Sí, para identificar la cuenta y sincronizar los saldos de Bunz y transacciones.
3. **Datos de Uso / Analítica:**
   - _Interacciones con el producto:_ Sí (App Analytics básico para estabilidad y diagnóstico de fallos).
4. **¿Los datos se usan para rastreo (Tracking across apps/websites)?**:
   - **NO**. Rabbitty no rastrea al usuario a través de aplicaciones o sitios web de terceros (no requiere framework App Tracking Transparency ATT).

---

## 🛠️ 5. Pasos para Compilar y Subir el Archivo a App Store Connect

En tu Mac:

1. Abre el proyecto en Xcode:
   ```bash
   pnpm --filter telegram-miniapp exec cap open ios
   ```
2. En la barra superior de Xcode, selecciona el target **App** y el destino **Any iOS Device (arm64)**.
3. En el menú superior de Xcode:
   - Haz clic en **Product** -> **Archive**.
   - Una vez finalizado el archivado, se abrirá automáticamente el **Organizer** de Xcode.
4. Selecciona el archivo versión **2.2 (Build 6)** y haz clic en **Distribute App**.
5. Selecciona **App Store Connect** -> **Upload** -> Deja las casillas predeterminadas de símbolos y firma automática -> Haz clic en **Upload**.
6. En 10 a 15 minutos el build aparecerá en App Store Connect listo para adjuntarse a la versión 2.2.

### ✅ Checklist previo a TestFlight / App Store (no bloquea el piloto dev)

- [ ] **APNs production:** en `telegram-miniapp/ios/App/App/App.entitlements`, `aps-environment` debe ser `production` (hoy es `development`; el mismo archivo sirve a Debug y Release). Además, `APNS_ENV=production` en Vercel.
- [ ] **Universal Links `/pay/*`:** el AASA (`/.well-known/apple-app-site-association`) abre la app nativa para `/scan`, `/qr` y `/pay`. Probar `/pay/[orderId]` (visor + Stripe Element) dentro del WebView de Capacitor en el piloto, no solo en Safari.

---

# 🏢 PARTE II: Kit Oficial para Rabbitty POS (iPad & Mac)

**Aplicación:** Rabbitty POS (Terminal de Punto de Venta y Gestión para Afiliados)  
**Bundle Identifier:** `com.rabbitty.pos`  
**Dispositivos Destino:** iPad (iPadOS 15.0+) y Mac con procesador Apple Silicon (Designed for iPad / Mac Catalyst)  
**Proyecto Local:** `apps/admin/ios/App/App.xcodeproj`  
**Servidor Remoto:** `https://admin.rabbitty.me`

### Estado de Compilación:

- Verificado con `xcodebuild`: **BUILD SUCCEEDED**. No requiere cambios de código adicionales.

---

---

## 📝 1. Metadatos de Ficha para Rabbitty POS (App Information)

### Nombre de la App (App Name — Máx. 30 caracteres)

```text
Rabbitty POS — Afiliados y Caja
```

_(29 caracteres)_

### Subtítulo (Subtitle — Máx. 30 caracteres)

```text
Terminal y fidelización Bunz
```

_(28 caracteres)_

### Categorías

- **Categoría Principal (Primary Category):** Empresa (Business)
- **Categoría Secundaria (Secondary Category):** Comida y Bebida (Food & Drink)

---

## 🚀 2. Formulario de Versión de App Store (Version Release Fields)

### Header Asset (0 of 1 Header Asset)

> **Estado:** Opcional. No es requerido para enviar a revisión. Solo se usa para features promocionales destacados en la App Store (5244 × 2950px o 3840 × 1646px). Puedes dejarlo vacío.

### Texto Promocional (Promotional Text — Máx. 170 caracteres)

```text
Terminal inteligente de comandas, cobro rápido y recompensas Bunz para restaurantes y cafeterías.
```

### Palabras Clave (Keywords — Máx. 100 caracteres)

```text
pos,punto de venta,restaurante,cafeteria,caja,tickets,recompensas,fidelizacion,bunz,afiliados,huatulco
```

_(100 caracteres exactos)_

### Descripción (Description — Máx. 4,000 caracteres)

```text
Rabbitty POS es la terminal oficial de cobro, comandas y gestión de lealtad diseñada exclusivamente para comercios, cafeterías de especialidad y restaurantes afiliados a la red Rabbitty.

Transforma tu iPad o Mac en una estación inteligente de servicio ágil:

⚡ PUNTO DE VENTA RÁPIDO Y FLUIDO
Toma pedidos en mostrador y mesas en segundos con una interfaz táctil ultra intuitiva. Organiza tu menú por categorías, personaliza variantes y modificadores de platillos al instante.

🖨️ IMPRESIÓN TÉRMICA NATIVA (BLUETOOTH & RED)
Conéctate directamente a impresoras térmicas de tickets y comandas (ESC/POS, POS-58, POS-80) vía Bluetooth Low Energy o red local. Imprime órdenes de cocina y tickets de cliente sin cables ni configuraciones complejas.

🍽️ GESTIÓN DE MESAS Y COMANDAS EN VIVO
Visualiza el plano de tu restaurante en tiempo real. Asigna pedidos a mesas específicas, divide cuentas, gestiona el estado de ocupación y envía comandas directas a cocina o barra.

💎 INTEGRACIÓN NATIVA CON BUNZ REWARDS
Escanea el código Rabbitty del cliente desde la cámara del iPad para aplicar descuentos automáticos con puntos Bunz, acreditar recompensas de lealtad y fomentar la recurrencia de tus comensales.

📊 CIERRES DE CAJA Y REPORTES PRECISOS
Controla tus turnos, arqueos de caja, métodos de pago y estadísticas de ventas diarias con total transparencia.

🧪 MODO ENTRENAMIENTO (SANDBOX)
Capacita a tus cajeros y nuevo personal de servicio en un entorno simulado seguro sin alterar la contabilidad real de tu negocio.

Diseñado optimizado para iPad y estaciones de cobro fijas. Requiere una cuenta de comercio previamente aprobada por Rabbitty.
```

### Enlaces Requeridos (URLs)

- **Support URL:** `https://admin.rabbitty.me/support` _(o `https://rabbitty.me/support`)_
- **Marketing URL (Opcional):** `https://rabbitty.me`

### Versión & Copyright

- **Version:** `1.0` _(o `1.0.0`)_
- **Copyright:** `2026 Rabbitty Technologies Inc.`

### Campos Opcionales / No Requeridos

- **Routing App Coverage File:** Dejar vacío (solo aplica a apps de navegación/mapas paso a paso).
- **App Clip:** Dejar vacío (no aplica).
- **iMessage App:** Dejar vacío (no aplica).
- **Game Center:** Dejar desmarcado / apagado.

### Compilación (Build)

- Dale clic a **Add Build** y selecciona la compilación que subas de `com.rabbitty.pos` desde Xcode.

---

## 🕵️‍♂️ 3. Información para el Revisor de Apple (App Review Information)

### Información de Inicio de Sesión (Sign-In Information)

- **¿Requiere inicio de sesión? (Sign-in required):** ☑️ **Marcar casilla**
- **User Name:** `pos-reviewer@rabbitty.me`
- **Password:** `123456`
- **Notas adicionales sobre el login:**  
  _El revisor ingresa `pos-reviewer@rabbitty.me` en la pantalla de bienvenida y el código fijo de 6 dígitos `123456` para acceso instantáneo a la terminal POS sin requerir SMS ni teléfono real._

### Información de Contacto (Contact Information)

- **First Name:** `Marco`
- **Last Name:** `Del Toro`
- **Phone Number:** `+52 958 123 4567` _(tu número con código de país)_
- **Email Address:** `marco@rabbitty.me` _(o tu correo de desarrollador)_

### Notas para el Revisor (Review Notes — Máx. 4,000 caracteres)

```text
Dear Apple Review Team,

Rabbitty POS is a companion business tool for merchants and affiliated venue managers (restaurants, coffee shops) to process orders, manage tables, and grant loyalty points (Bunz) at checkout.

Review Instructions:
1. Open Rabbitty POS on iPad / Mac.
2. In the initial sign-in screen, enter the demo account identifier:
   - Email / User: pos-reviewer@rabbitty.me
   - Tap "Continuar con este correo" (Continue with this email).
3. On the 6-digit verification code screen, enter the fixed demo code:
   - Code: 123456
   - Tap "Entrar" (Enter).
4. The main POS interface displays the restaurant menu categories, item grid, and active ticket sidebar.
5. Cash register shifts: cash payments require an open cash shift. Tap the "Caja cerrada · Abrir" button in the top bar, enter the demo manager/cashier PIN 1234 and an opening float (e.g. 500), then confirm. Card and Bunz payments do not require an open shift.
6. Processing orders & confirmation:
   - Tap menu items to add them to the ticket.
   - Select a payment method (Efectivo / Tarjeta / QR Bunz / Dividida).
   - A charge confirmation modal appears displaying the chosen method and exact total amount. Tap "Confirmar y cobrar" to finalize.
   - Upon confirmation, the order is registered and the "Ticket de Venta Generado" modal opens, allowing thermal printing ("Imprimir ticket") or sending the receipt via WhatsApp.
7. Table management: tap the "Mesas" (Tables) view to inspect floor plan statuses.
8. Cash register operations (Top Bar):
   - Withdraw cash: Cashier PIN 1234 (withdrawals above threshold ask for manager PIN 1234).
   - Partial audit count (Ticket X): Blind count entry; reveals expected vs counted cash and prints an X ticket.
   - Shift handover: Double-PIN flow (outgoing cashier PIN 1234, incoming cashier PIN 5678).
   - End-of-day close (Ticket Z): Cashier PIN 1234 + Manager PIN 1234; discrepancy note required if difference != 0.
9. Sandbox Mode: toggle "Modo Entrenamiento (Sandbox)" at any time to verify that mock orders do not affect live accounting.

Permissions Used:
- Bluetooth (LE): Optional, used to connect with thermal receipt and kitchen printers (POS-58/80).
- Camera: Used exclusively for scanning customer loyalty QR codes for Bunz rewards discounts.

Attachment: Not needed (full demo access is configured).

If you have any questions or require additional assistance, please reach out at support@rabbitty.me.
```

### 📋 Checklist interno del equipo (Estado de Producción)

El sistema de caja y turnos está blindado con las siguientes verificaciones completadas en la base de datos de producción (Neon):

1. **Migración 0014 (`0014_cash_shifts.sql`)**:  
   - ✅ **Aplicada exitosamente en producción** en una sola transacción segura.
   - Tablas `cash_shifts`, `cash_shift_events` y `pin_attempts` activas.
   - Trigger `cash_shift_events_no_update_delete` activo (bitácora inmutable).
   - Columnas `numeric(12,2)` para cantidades de dinero (sin errores de redondeo de punto flotante).
   - Llave foránea e índice `cash_drops_shift_idx` activos.
2. **Empleados Demo (`db:seed:review`)**:  
   - ✅ **Sembrados y verificados en producción** en todas las sucursales (*Sucursal Principal* y *Modo Entrenamiento*):
     - **Cajero Demo (Gerente)**: Rol `MANAGER`, PIN `1234`.
     - **Cajera Demo**: Rol `CASHIER`, PIN `5678`.
3. **Flujo de Cobro y Tickets**:  
   - ✅ Confirmación previa requerida antes de disparar cobro (`requestCheckout` → modal con monto y método → `confirmCheckout`).
   - ✅ Botón explícito **"Imprimir ticket"** en el comprobante final de venta para reimpresión manual en impresora térmica.
   - ✅ Mensaje de WhatsApp codificado con `encodeURIComponent` para garantizar envío íntegro de artículos, total, folio con `#` y emojis.
4. **Verificación final antes de grabar el video de review**:
   - Iniciar sesión con `pos-reviewer@rabbitty.me` / `123456`.
   - Probar: Abrir caja (1234 + $500) → Cobrar orden en efectivo con confirmación → Retiro → Arqueo X → Traspaso (1234 a 5678) → Cierre Z.
   - Probar que Tarjeta y QR Bunz operan sin requerir turno abierto.

### Adjunto (Attachment)

- Dejar vacío (Opcional).

---

## 📅 4. Publicación de la Versión (App Store Version Release)

Selecciona la opción recomendada:

- 🔘 **Manually release this version** (Recomendado para tener control total de cuándo publicar en la tienda después de que Apple la apruebe).  
  _O si prefieres que se lance sola al instante:_ 🔘 **Automatically release this version**.

---

## 🖼️ 5. Capturas de Pantalla Oficiales de iPad (iPad 13-inch Display)

Ya generadas con la resolución oficial exigida por Apple (**2732 × 2048 px** en horizontal / landscape):

1. [Rabbitty_POS_iPad_Screen1.png](file:///Users/Marco/Documents/Company/Rabbitty/dApp/Rabbitty_POS_iPad_Screen1.png) _(Terminal POS, Comandas y Descuento Bunz)_
2. [Rabbitty_POS_iPad_Screen2.png](file:///Users/Marco/Documents/Company/Rabbitty/dApp/Rabbitty_POS_iPad_Screen2.png) _(Impresora Térmica, Gestión de Mesas en Vivo)_

---

## 🔒 6. Cuestionario de Privacidad para Rabbitty POS (Nutrition Labels)

- **¿Recopila datos?**: **Yes, we collect data from this app**
- **Categorías a declarar:**
  1. **Contact Info (Email Address, Name):**
     - _Propósito:_ `App Functionality`
     - _Linked to identity:_ `Yes`
     - _Tracking:_ `No`
  2. **Identifiers (User ID):**
     - _Propósito:_ `App Functionality`
     - _Linked to identity:_ `Yes`
     - _Tracking:_ `No`
  3. **Usage Data (Product Interaction):**
     - _Propósito:_ `Analytics` & `App Functionality`
     - _Linked to identity:_ `Yes`
     - _Tracking:_ `No`
  4. **Diagnostics (Crash Data):**
     - _Propósito:_ `App Functionality`
     - _Linked to identity:_ `No`
     - _Tracking:_ `No`

---

## 🔞 7. Clasificación por Edad (Age Rating)

- Controles parentales: **No**
- Acceso web irrestricto: **No**
- Chat / Mensajería: **No**
- Alcohol, tabaco o drogas: **Infrequent / Mild** _(los restaurantes afiliados ofrecen bebidas en su menú)_
- Violencia / Sexualidad / Apuestas: **None** / **No**
- **Resultado calculado esperado:** **4+** o **12+**

---

## 🛡️ 8. Respuesta Oficial a Revisor Apple (Guideline 2.1 - Information Needed)

> **Contexto:** Apple solicita información adicional para cuentas con historial limitado de revisiones. Este es el texto exacto a responder en el **Resolution Center de App Store Connect** y pegar en las **Review Notes**:

```text
Dear Apple App Review Team,

Thank you for your feedback. We are pleased to provide the requested information regarding Rabbitty (iOS Version 1.0) to complete the review process.

---

### 1. Screen Recording
We have uploaded a comprehensive screen recording demonstrating the core user flow captured on a physical iPhone running iOS 18:
- Video Demo Link: [Adjunta aquí un enlace de Google Drive / Dropbox / YouTube Unlisted, o sube el video en "Attachment" del Resolution Center].
- Flows shown:
  a) Launching the app & Sign-in with the demo credentials (tester@rabbitty.me / 123456).
  b) Main interface: Member dynamic Rabbitty Code (QR) for counter rewards, active Bunz balance, and nearby verified venues.
  c) Bunzy AI local concierge assistant recommendations.
  d) Vibe Passport dining routes and gamification progression.
  e) Profile tab: Permanent Account Deletion flow located under Profile > Settings > "Eliminar cuenta permanentemente", fully compliant with App Store Guideline 5.1.1(v).
  f) Note: Rabbitty contains no paid digital content or In-App Purchases, nor unmoderated public UGC feeds.

---

### 2. App Purpose & Target Audience
- Problem Solved: Local specialty venues (coffee shops, bakeries, casual dining restaurants) often struggle with fragmented, friction-heavy punch cards, while consumers lose track of paper rewards.
- Value Provided: Rabbitty bridges local communities and specialty dining spots by providing a streamlined, digital QR loyalty companion. Consumers earn points ("Bunz") automatically at checkout, redeem them for discounts and promotional perks at verified merchants, discover curated local spots with Bunzy AI, and collect digital route stamps through the Vibe Passport.
- Target Audience: Coffee lovers, diners, and urban explorers looking to discover curated gastronomic spots and earn loyalty benefits.

---

### 3. Instructions for Setting Up and Accessing Main Features
- Sign-In Credentials (Demo Account):
  • User / Email: tester@rabbitty.me (or simply type "tester")
  • Verification OTP Code: 123456
- Steps:
  1. Open Rabbitty and enter "tester@rabbitty.me" on the sign-in screen.
  2. Enter the static test code "123456" to instantly access the pre-configured active demo wallet.
  3. Tap the "Ver QR" button to view the active member Rabbitty Code.
  4. Explore the "Bunzy AI" concierge tab to query recommendations for coffee or casual food.
  5. Visit the "Vibe Passport" to test the urban stamp collection and rewards milestones.
  6. Visit "Perfil" (Profile) to verify user settings, account security, and the complete account deletion mechanism.

---

### 4. External Services & Platforms Used
- Authentication: Custom passwordless OTP infrastructure with deterministic sandbox testing credentials.
- Database & Infrastructure: PostgreSQL hosted on secure cloud infrastructure (Neon/Railway) with Next.js edge runtime.
- Push Notifications: Apple Push Notification service (APNs) for real-time transaction and reward updates.
- AI Concierge: Bunzy AI engine powered by Google Gemini API / OpenAI API with strict domain-specific prompt sandboxing for local dining queries.
- Payment / Loyalty: Rabbitty operates a first-party loyalty rewards accounting ledger ("Bunz"). It does not process credit cards or fiat banking within the app.

---

### 5. Regional Differences
- The app functions consistently across all global regions without geoblocking. Any user worldwide can download the app and explore partner venues and passport routes. Featured partner establishments are initially concentrated in Oaxaca / Mexico tourist corridors (e.g. Huatulco, Puerto Escondido) and expanding globally.

---

### 6. Regulatory & Third-Party Material Disclosures
- Rabbitty does not operate in a regulated banking or medical industry. "Bunz" are digital merchant loyalty points (equivalent to airline miles or coffee punch stamps), strictly non-transferable to fiat currencies and non-financial in nature.
- All intellectual property, logos, character art ("Bunzy"), and software code are original assets owned by Rabbitty Technologies.

Thank you for your diligence in keeping the App Store safe and high quality. We remain at your disposal should you require any additional information.

Sincerely,
Marco Del Toro
Rabbitty Technologies
support@rabbitty.me
```
