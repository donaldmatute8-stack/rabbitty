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
   *Muestra el Rabbitty Pass Lvl. 1, el saldo de Bunz y el feed de cafeterías y restaurantes cercanos con multiplicadores (+20% Bunz).*
2. **Pantalla 2 — Pago QR Dinámico & Rabbitty ID:**  
   *Muestra el código visual con identificador animado, diseñado para escanear en caja con velocidad y brillo optimizado.*
3. **Pantalla 3 — Bunzy AI (Asistente Local Inteligente):**  
   *Muestra la conversación fluida con Bunzy respondiendo dudas sobre el ecosistema, locales asociados y preguntas frecuentes.*
4. **Pantalla 4 — Rabbitty Mood:**  
   *Selector ambiental y sensorial (Calma, Energía, Enfoque, Celebración, Conexión, Sorpresa) para personalizar la experiencia culinaria y musical.*
5. **Pantalla 5 — Rabbitty Vibe Passport (Rutas Urbanas):**  
   *Muestra la Ruta Creativa & Deep Work con sellos coleccionables en cafeterías de especialidad, bistros y espacios silenciosos.*
6. **Pantalla 6 — Portal de Afiliados (Comercios):**  
   *Muestra la vista de negocio (Ka13), métricas de tickets/clientes, crédito de minteo y control de la tasa de recompensa en tiempo real.*
7. **Pantalla 7 — Stock de Ofertas & Cupones:**  
   *Muestra las ofertas disponibles canjeables directamente con Bunz en comercios destacados (626 Café, Surf & Co).*

---

## 📝 2. Textos Oficiales de la Ficha (Metadatos de App Store Connect)

### Nombre de la App (Máx. 30 caracteres)
```text
Rabbitty — Gana Bunz y Paga
```
*(27 caracteres)*

### Subtítulo (Máx. 30 caracteres)
```text
Recompensas y cashback local
```
*(28 caracteres)*

### Categoría Principal
- **Principal:** Estilo de vida (Lifestyle) o Comida y Bebida (Food & Drink).
- **Secundaria:** Finanzas (Finance) o Compras (Shopping).

### Palabras Clave / Keywords (Máx. 100 caracteres separados por coma, sin espacios extras)
```text
bunz,cashback,puntos,lealtad,restaurantes,cafeterias,descuentos,huatulco,recompensas,pagos,qr,wallet
```
*(99 caracteres)*

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

### Información de Inicio de Sesión Demo (Sign-in information)
- **¿Requiere inicio de sesión?**: Sí (marcar casilla).
- **Nombre de usuario / Teléfono demo:** `+52 958 100 0000` (o usuario demo fijado en base de datos).
- **Código OTP / Contraseña demo:** `123456` *(Configurado en backend/bypass de testing).*

### Notas de Revisión (Review Notes para el equipo de Cupertino)
```text
Dear Apple Review Team,

Rabbitty is a local rewards, loyalty, and QR payment companion app for curated coffee shops and restaurants. 

To easily test all features of version 2.2:
1. Launch the app and enter the demo phone number / test credentials provided above.
2. The Home screen features the Rabbitty Pass, active Bunz balance, and nearby featured venues.
3. Tap the "Pagar" (Pay) button or QR icon to display the dynamic member Rabbitty Code intended for counter scanning at POS terminals.
4. Tap the "Bunzy AI" tab to interact with our local venue recommendation assistant.
5. In the "Vibe Passport" section, reviewers can explore themed urban dining routes and rewards progression.

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
   - *Teléfono / Nombre:* Sí, para autenticación y cuenta de usuario (vinculado a la identidad del usuario). No se comparte con terceros ni para rastreo publicitario.
2. **Identificadores:**
   - *User ID:* Sí, para identificar la cuenta y sincronizar los saldos de Bunz y transacciones.
3. **Datos de Uso / Analítica:**
   - *Interacciones con el producto:* Sí (App Analytics básico para estabilidad y diagnóstico de fallos).
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

---

# 🏢 PARTE II: Kit Oficial para Rabbitty POS (iPad & Mac)

**Aplicación:** Rabbitty POS (Terminal de Punto de Venta y Gestión para Afiliados)  
**Bundle Identifier:** `com.rabbitty.pos`  
**Dispositivos Destino:** iPad (iPadOS 15.0+) y Mac con procesador Apple Silicon (Designed for iPad / Mac Catalyst)  
**Proyecto Local:** `apps/admin/ios/App/App.xcodeproj`  
**Servidor Remoto:** `https://admin.rabbitty.me`  

### Estado de Compilación:
* Verificado con `xcodebuild`: **BUILD SUCCEEDED**. No requiere cambios de código adicionales.

---

## 📝 1. Metadatos de Ficha para Rabbitty POS

### Nombre de la App (Máx. 30 caracteres)
```text
Rabbitty POS — Afiliados y Caja
```
*(29 caracteres)*

### Subtítulo (Máx. 30 caracteres)
```text
Terminal y fidelización Bunz
```
*(28 caracteres)*

### Categoría Principal
- **Principal:** Empresa (Business).
- **Secundaria:** Comida y Bebida (Food & Drink) o Finanzas (Finance).

### Palabras Clave / Keywords (Máx. 100 caracteres)
```text
pos,punto de venta,restaurante,cafeteria,caja,tickets,recompensas,fidelizacion,bunz,afiliados,huatulco
```
*(100 caracteres)*

### Descripción de la App
```text
Rabbitty POS es la terminal oficial de cobro, fidelización y gestión de recompensas diseñada exclusivamente para comercios, cafeterías y restaurantes afiliados a la red Rabbitty.

CARACTERÍSTICAS PRINCIPALES:
⚡ REGISTRO Y RECOMPENSA EN CAJA
Escanea el Rabbitty Code de tus clientes al instante para otorgar Bunz por su consumo o cobrar mediante saldo digital.

📊 CONTROL DE COMERCIO EN TIEMPO REAL
Monitorea tu volumen de ventas, número de clientes fidelizados, tickets emitidos y tasa de recompensa configurada (de 2% a 50%).

🖨️ IMPRESIÓN Y EXPORTACIÓN DE MATERIAL
Genera e imprime el Kit de Impresos para tu local: carteles A3 con tu código QR oficial, habladores de mesa y material para caja en formato PDF de alta resolución.

🧪 MODO ENTRENAMIENTO (SANDBOX)
Capacita a tus cajeros y personal de servicio en un entorno simulado seguro sin alterar la contabilidad real de tu negocio.

Diseñado optimizado para iPad y estaciones de cobro fijas. Requiere una cuenta de comercio previamente aprobada por Rabbitty.
```

---

## 🕵️‍♂️ 2. Información para el Revisor de Apple (POS Review Notes)

### Credenciales Demo para el Revisor:
* **¿Requiere inicio de sesión?**: Sí.
* **Email / Usuario Demo:** `demo.pos@rabbitty.me` (o el número telefónico configurado para el comercio demo).
* **Contraseña / PIN Demo:** `RabbittyPos2026!` / PIN: `1234`

### Review Notes (Texto en inglés para el revisor en Cupertino):
```text
Dear Apple Review Team,

Rabbitty POS is a companion business tool for merchants and affiliated venue managers (restaurants, coffee shops) to manage loyalty points (Bunz) and process member transactions at checkout.

Review Instructions:
1. Open Rabbitty POS on iPad.
2. Sign in using the demo merchant credentials provided in the Sign-In Info section.
3. Reviewers can explore the POS Dashboard (displaying sales, active tickets, and reward rate settings).
4. Tap "Generar código QR" to simulate counter QR generation for customer rewards.
5. Reviewers can toggle the "Modo Entrenamiento (Sandbox)" at any time to verify that mock sales do not affect production accounting.

Permissions Used:
- Bluetooth (LE): Optional, used to connect with thermal receipt printers.
- Camera: Used for barcode / ticket scanning.

If you have any questions or require additional assistance, please reach out at support@rabbitty.me.
```

---

## 🔒 3. Privacidad para Rabbitty POS (Nutrition Labels)
* **Datos de Contacto:** Email/teléfono comercial para autenticación del personal del establecimiento.
* **Identificadores:** Business ID y User ID del afiliado.
* **Datos de Uso:** Analítica técnica interna para rendimiento del POS.
* **Tracking:** **NO**, no se realiza tracking publicitario cruzado entre apps de terceros.

