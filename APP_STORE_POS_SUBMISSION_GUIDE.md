# Rabbitty POS (iPad & Mac) — Guía Maestra de Lanzamiento en App Store

Esta guía contiene la ficha técnica, configuración paso a paso y textos exactos para enviar a revisión **Rabbitty POS** (`com.rabbitty.pos`) en App Store Connect.

---

## 📋 1. Metadatos de la App (App Information)

- **Nombre de la App:** `Rabbitty POS: Restaurantes` *(o `Rabbitty POS`)*
- **Subtítulo (30 caracteres máx):** `Comandas, Ventas y Lealtad`
- **Categoría Primaria:** `Business` (Negocios) o `Food & Drink` (Comida y bebida)
- **Categoría Secundaria:** `Productivity` (Productividad)
- **Bundle ID:** `com.rabbitty.pos`
- **SKU:** `rabbitty-pos-01`

---

## 📝 2. Descripción y Palabras Clave

### Palabras Clave (Keywords - 100 caracteres máx)
```text
pos,punto de venta,restaurante,comandas,cafeteria,mesas,tickets,impresora termica,lealtad,bunz,caja
```

### Descripción (Description)
```text
Rabbitty POS es el sistema integral de punto de venta y gestión de comandas diseñado específicamente para cafeterías de especialidad, restaurantes, bares y comercios gastronómicos modernos.

Transforma tu iPad o Mac en una terminal de cobro inteligente y ágil:

⚡ PUNTO DE VENTA RÁPIDO Y FLUIDO
Toma pedidos en segundos con una interfaz táctil ultra intuitiva. Organiza tu menú por categorías, personaliza variantes y modificadores de platillos al instante.

🖨️ IMPRESIÓN TÉRMICA NATIVA (BLUETOOTH & RED)
Conéctate directamente a impresoras térmicas de tickets y comandas (ESC/POS, POS-58, POS-80) vía Bluetooth Low Energy o red local. Imprime órdenes de cocina y tickets de cliente sin cables ni configuraciones complejas.

🍽️ GESTIÓN DE MESAS Y COMANDAS EN VIVO
Visualiza el plano de tu restaurante en tiempo real. Asigna pedidos a mesas específicas, divide cuentas, gestiona el estado de ocupación y envía comandas directas a cocina o barra.

💎 INTEGRACIÓN NATIVA CON BUNZ REWARDS
Escanea el código Rabbitty del cliente desde la cámara del iPad o scanner para aplicar descuentos automáticos con puntos Bunz, acreditar recompensas de lealtad y fomentar la recurrencia de tus clientes.

📊 CIERRES DE CAJA Y REPORTES PRECISOS
Controla tus turnos, arqueos de caja, métodos de pago y estadísticas de ventas diarias con total transparencia.

Diseñado para la velocidad del servicio gastronómico.
```

---

## 🔗 3. Enlaces Requeridos por Apple
- **URL de Soporte:** `https://admin.rabbitty.me/support` (o `https://rabbitty.me/support`)
- **URL de Marketing:** `https://rabbitty.me`
- **URL de Política de Privacidad:** `https://rabbitty.me/privacy`

---

## 🕵️‍♂️ 4. Credenciales Demo para el Revisor de Apple (App Review Notes)

> **CRÍTICO:** Apple necesita poder entrar de inmediato a la terminal POS sin pedir códigos a un teléfono celular.

- **¿Requiere inicio de sesión?:** Sí (marcar casilla).
- **Usuario / Email:** `pos-reviewer@rabbitty.me` *(o `tester@rabbitty.me`)*
- **Contraseña / PIN de Caja:** `1234` *(o contraseña `RabbittyTest2026!`)*
- **Review Notes para el Revisor:**
```text
Dear Apple Review Team,

Rabbitty POS is a companion point-of-sale and table management application for restaurant and coffee shop staff members.

To test the application on iPad / Mac:
1. Launch the app and sign in using the demo restaurant credentials:
   - User: pos-reviewer@rabbitty.me
   - Access PIN / Password: 1234
2. The main POS interface displays the active restaurant menu categories and item grid.
3. Tap on any food or beverage item to add it to the active order ticket on the left panel.
4. Reviewers can test table management by tapping the "Mesas" (Tables) view.
5. In the settings / hardware section, reviewers can test printer connection states (simulated Bluetooth ESC/POS printer status).
6. Camera permission is requested solely to scan customer loyalty QR codes for Bunz rewards discounts.
7. Bluetooth permission is used to communicate with receipt and kitchen thermal printers (POS-58/80).

Thank you for your review. Please contact support@rabbitty.me if you require any assistance.
```

---

## 🖼️ 5. Capturas de Pantalla Oficiales Generadas (iPad 13 pulgadas)

Ya generadas con la resolución exacta que exige Apple (**2732 x 2048 px** en horizontal para iPad):

1. **Pantalla 1 (Terminal POS & Comandas):**  
   `dApp/Rabbitty_POS_iPad_Screen1.png`
2. **Pantalla 2 (Impresión Térmica & Mapa de Mesas):**  
   `dApp/Rabbitty_POS_iPad_Screen2.png`

---

## 🔒 6. Cuestionario de Privacidad (Nutrition Labels) para Rabbitty POS

Al responder **App Privacy** en App Store Connect para Rabbitty POS:

- **¿Recopila datos?**: **Yes, we collect data from this app**
- **Categorías a declarar:**
  1. **Contact Info:**
     - `Email Address` y `Name` (para el perfil del cajero/administrador del restaurante).
     - *Propósito:* `App Functionality`.
     - *¿Linked to user?*: `Yes`.
     - *¿Tracking?*: `No`.
  2. **Identifiers:**
     - `User ID` (identificador del empleado/negocio).
     - *Propósito:* `App Functionality`.
     - *¿Linked to user?*: `Yes`.
     - *¿Tracking?*: `No`.
  3. **Usage Data:**
     - `Product Interaction` (métricas de uso del sistema POS).
     - *Propósito:* `Analytics` & `App Functionality`.
     - *¿Linked to user?*: `Yes`.
     - *¿Tracking?*: `No`.
  4. **Diagnostics:**
     - `Crash Data` (estabilidad del POS).
     - *Propósito:* `App Functionality`.
     - *¿Linked to user?*: `No`.
     - *¿Tracking?*: `No`.

*(No declarar Financial info personal de tarjetas porque la app no almacena números de tarjeta de crédito de los comensales).*

---

## 🔞 7. Clasificación por Edad (Age Rating)
- Controles parentales: **No**
- Acceso web irrestricto: **No**
- Chat / Mensajería: **No** *(es una app interna de comandas de restaurante)*
- Alcohol: **Infrequent / Mild** *(porque el menú de un restaurante incluye vinos, cervezas o cócteles)*
- Violencia / Sexualidad / Apuestas: **None**
- **Resultado calculado esperado:** **4+** o **12+**
