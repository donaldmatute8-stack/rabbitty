# Brief de búsqueda de hardware en Alibaba — terminal que SÍ pueda cobrar en México

**Fecha:** 18-nov-2026 · **Objetivo:** encontrar un terminal Android con impresora y
lector EMV que pueda operar en México **con un adquirente real**, no solo con
certificados de laboratorio.

> Lección del I9: **EMV L1&L2 y PCI no bastan.** Hace falta **EMV L3 con un
> adquirente** (end-to-end) y una ruta de inyección de llaves DUKPT. Por eso todas
> las preguntas del brief giran alrededor de eso.

---

## 1. Qué estamos buscando (dos formatos posibles)

| Formato | Uso | Ejemplo de referencia |
|---|---|---|
| **A. Smart POS todo en uno** (recomendado) | terminal + impresora 58 mm + EMV + pantalla, en un equipo | PAX A920/A930, Sunmi P2 Pro, Newland N910/N950, Ingenico AXIUM |
| **B. Lector mPOS sin pantalla** | se empareja con iPad/Android (el I9 era este) | requiere app + PSP; más barato, más dependencia |

**Recomendación:** buscar **formato A**, porque elimina el problema de tener dos
dispositivos (lector + tablet) y es lo que el restaurante espera de un "terminal".

---

## 2. Cadenas de búsqueda en Alibaba (copiar y pegar)

```
android pos terminal with printer emv pci
smart pos terminal 4g wifi nfc emv
handheld android pos 5.5 inch thermal printer emv
android payment terminal pci pts sred emv l1 l2
pos terminal android 13 printer 58mm contactless
PAX A920 alternative android pos
sunmi p2 pro alternative
newland n910 alternative
emv certified android pos terminal latin america
```

### Filtros que hay que activar
- **Trade Assurance** ✔
- **Verified Supplier** ✔
- Años en Alibaba ≥ **4**
- MOQ ≤ **10** (para poder pedir muestra)
- Rango de precio: **$60–180 USD** por unidad (formato A)
- Región: Guangdong / Fujian (donde están los fabricantes reales)

---

## 3. Especificaciones obligatorias (lo que debe cumplir)

### 3.1 Hardware

| Spec | Mínimo | Por qué |
|---|---|---|
| SO | **Android 12+** (ideal 13/14) | SDK y parches; Android 10 ya se queda sin soporte |
| Pantalla | **5.5"–6.5"** táctil | operación con guantes/luz de cocina |
| Impresora | **térmica integrada 58 mm**, ESC/POS | el ticket sale del mismo equipo |
| Lector | **chip EMV + contactless/NFC** (y banda si se puede) | tarjeta física y wallets |
| Conectividad | **4G + WiFi + Bluetooth** | 4G evita depender del WiFi del local |
| Batería | **≥ 4 000 mAh** o toma de corriente | turno completo |
| Memoria | ≥ 2 GB RAM / 16 GB (ideal 3/32) | app + catálogo |
| Cámara | trasera ≥ 5 MP (opcional pero útil para QR) | pago por QR |
| SDK | **Android SDK + demo app + docs** | integración con nuestro POS |
| Gestión | **TMS / OTA** para firmware y llaves | sin esto, cada equipo es manual |
| Durabilidad | resistencia a caídas ≥ 1.2 m, IP54 si es posible | mesa de restaurante |

### 3.2 Certificaciones (la parte que decide)

| Certificación | Obligatorio | Qué pedir |
|---|---|---|
| **PCI PTS (5.x o 6.x) SRED** | ✅ | PDF con **versión y modelo** |
| **EMV L1 y L2** | ✅ | PDF con laboratorio y modelo |
| **EMV L3 (end-to-end con adquirente)** | ✅ **crítico** | **nombre del adquirente y país** donde ya transacciona |
| **Visa payWave / Mastercard Contactless** | ✅ | PDF |
| **TQM / CE / FCC / RoHS** | recomendable | PDF |
| **Homologación IFT/NOM (radio MX)** | ✅ para importar | ¿la tienen? ¿o la tramitamos? |

### 3.3 Comercial

| Punto | Qué pedir |
|---|---|
| Precio | por tramos: 5 / 20 / 100 / 500 |
| Muestra | 1–2 unidades, precio y flete |
| Flete | **DDP a México** (preferido) y **DAP** para comparar |
| Garantía | ≥ 12 meses, política de RMA y tasa de defectos |
| Repuestos | cabezal de impresora y batería (los que más fallan) |
| Marca | logo en carcasa, **splash de arranque**, caja y manual en español; MOQ de branding |
| Software | ¿permiten preinstalar nuestra app y modo kiosco? |

---

## 4. Mensaje inicial para cada proveedor (corto, filtra rápido)

```
Hi, we are Rabbitty (Mexico), a restaurant POS platform. We are selecting an
Android smart POS with integrated 58 mm printer and EMV reader to deploy with our
own app.

Before price, one question decides: does this model already have EMV Level 3
certification with an acquirer operating in Mexico or Latin America? If yes,
please tell us the acquirer name and country, and send the certificate PDFs
(PCI PTS version, EMV L1/L2, L3 reference) with the model visible.

If it does not have L3 yet: do you have a documented path (which acquirer, how
long, who pays) and which of your models is closest to it?

If the answer is yes, please also send:
- Price at 5 / 20 / 100 / 500 units
- Sample price and DDP shipping to Mexico
- SDK docs index (Android), TMS terms and who injects DUKPT keys
- Branding options (logo, boot splash, box, Spanish manual) and MOQ
```

---

## 5. Banderas rojas (descartar sin perder tiempo)

| Señal | Por qué |
|---|---|
| “EMV certified” sin PDF con **modelo** | no sirve para el expediente ni aduana |
| “We can do L3 for you” sin nombrar adquirente | L3 no lo hace el fabricante, lo hace el adquirente |
| No conocen **PCI PTS version** | señal de que no tienen el certificado |
| Sin SDK o “te mandamos APK” | no se puede integrar |
| Sin TMS | llaves y firmware manuales = inviable a escala |
| MOQ 100 sin muestra | te compromete antes de probar |
| Solo WiFi, sin 4G | dependes de la red del restaurante |
| Pantalla < 5" o Android < 10 | operación incómoda y sin soporte |

---

## 6. Comparativa con lo que ya evaluamos

| Modelo | Formato | Certificación | Sirve en MX hoy | Comentario |
|---|---|---|---|---|
| **I9 (HCCTG)** | B (sin pantalla) | EMV L1&L2, PCI 5.x, **sin L3** | ❌ | cerrado: ningún adquirente lo certifica |
| **Stripe S710** | A (lector inteligente) | L3 con Stripe | ✅ vía Stripe | no se puede marcar con nuestro logo en el plástico |
| **PAX A920 / Sunmi P2 / Newland N910** | A | habitualmente **L3 con adquirentes LatAm** | **por confirmar** | los candidatos reales: preguntar al adquirente cuál certifica |

---

## 7. Orden de ejecución

1. Enviar el mensaje de §4 a **5–8 proveedores** de formato A.
2. En paralelo, mandar el `CUESTIONARIO-PSP-MEXICO.md` a 3 adquirentes.
3. Cruzar las dos listas: **el modelo que aparezca en ambas** es el que se compra.
4. Pedir 1–2 muestras **solo de ese modelo**.
5. Probar pairing + cobro real de $1 en sandbox y luego en producción controlada.

> Regla: **el hardware se elige por la certificación, no al revés.**
