# 🚀 Kit Oficial de Envío a App Store Connect — Rabbitty iOS

**Aplicación:** Rabbitty (App de Usuarios y Pagos QR)  
**Bundle Identifier:** `com.rabbitty.app`  
**Versión Actualizada:** `2.2` (Build `6`)  
**Equipo Apple Developer:** `FW97275K5X`  
**Target:** iOS 15.0+ (iPhone & iPad)  

---

## 📸 1. Capturas Oficiales Generadas para la Ficha (App Store Display)

Las 4 capturas han sido diseñadas con estética premium (tema oscuro, contrastes neón, métricas de alto impacto y copy de conversión):

1. **Pantalla 1 — Tu pase diario y recompensas en tus lugares favoritos:**  
   ![Hero Home Rabbitty](/Users/Marco/.gemini/antigravity-ide/brain/1d65ed07-e6d1-465f-9652-5cc7aa95546d/appstore_screen_1_hero_1792702521531.jpg)
   *Destaca el Rabbitty Pass Lvl. 1, saldo de 250 Bunz y los comercios afiliados destacados (626 Café).*

2. **Pantalla 2 — Paga escaneando al instante con Rabbitty Code:**  
   ![QR Payment](/Users/Marco/.gemini/antigravity-ide/brain/1d65ed07-e6d1-465f-9652-5cc7aa95546d/appstore_screen_2_qr_1792702538609.jpg)
   *Enfoque en velocidad, cashback automático acumulado y pago seguro en terminales de afiliados.*

3. **Pantalla 3 — Bunzy AI: Tu asistente local de recomendaciones y reservas:**  
   ![Bunzy Asistente IA](/Users/Marco/.gemini/antigravity-ide/brain/1d65ed07-e6d1-465f-9652-5cc7aa95546d/appstore_screen_3_bunzy_1792702557791.jpg)
   *Muestra la inteligencia conversacional recomendando mesas, platos y reservas en Huatulco/locales asociados.*

4. **Pantalla 4 — Rabbitty Vibe Passport: Rutas urbanas y multiplicadores:**  
   ![Vibe Passport](/Users/Marco/.gemini/antigravity-ide/brain/1d65ed07-e6d1-465f-9652-5cc7aa95546d/appstore_screen_4_vibe_1792702575545.jpg)
   *Gamificación pura: stamps coleccionables, multiplicadores 2X Bunz y recompensas desbloqueables.*

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
