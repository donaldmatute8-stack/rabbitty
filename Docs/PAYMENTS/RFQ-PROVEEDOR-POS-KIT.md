# RFQ · Proveedor de kit POS + impresora (Alibaba)

**Fecha:** 18-nov-2026 · **Modelo evaluado:** YK967 (JR) · Android 14, 6.56", 2D scanner

---

## Mensaje para enviar (copiar y pegar)

```
Subject: RFQ — Android POS + printer kit for restaurant chains in Mexico (pilot + scaling)

Hello,

I'm Marco, founder of Rabbitty (rabbitty.me), a growing restaurant-tech ecosystem in
Mexico. We provide our affiliated restaurants and cafés with a point-of-sale system
(orders, kitchen display, loyalty) and we are selecting the hardware kit we will
standardize on.

We are interested in your YK967 (Android 14, 6.56" industrial touch screen, 2D scanner)
as the handheld terminal, and we would like to evaluate it together with a matching
thermal printer as a single "business kit".

About us, so you can price accordingly:
- We are a small but fast-growing ecosystem. We expect to start with a pilot of
  10–30 kits and scale to several hundred units over the next 12 months as we onboard
  more businesses.
- We are looking for a long-term hardware partner, not a one-time purchase.
- We will handle local deployment, support and configuration ourselves.

What we need from you:

1) KIT AND SPECS
   - Full kit contents: terminal + printer + charger/cradle + cables + packaging.
   - Which printer model do you pair with the YK967? Paper width (58 mm or 80 mm),
     interface (Bluetooth / USB / network), ESC/POS support, and whether it can be
     battery powered.
   - Battery life under real restaurant use (continuous shifts of 8–12 hours).
   - Drop resistance / IP rating, and operating temperature.

2) PAYMENT CAPABILITY (critical for us)
   - Is the YK967 a payment terminal with an EMV/PCI-PTS certified card reader, or is
     it an order-taking PDA?
   - If it can take card payments: which PSP/SDK integrations are supported, which
     certifications does the payment module carry, and in which countries is it
     approved?
   - If it is not EMV certified, please confirm clearly, because we would use it for
     order taking and pair payments with a separate certified reader.

3) CERTIFICATIONS FOR MEXICO
   - CE / FCC / RoHS and any IFT / NOM homologation for radio (WiFi/Bluetooth/4G).
   - Please state exactly which certificates you can provide as PDF, with the model
     they cover.

4) SOFTWARE
   - Android SDK/API docs, ability to preinstall our own APK, kiosk mode, and
     automatic OS updates.
   - Can the boot splash screen and packaging carry our brand (OEM/ODM)? What is the
     MOQ for branded units and for custom packaging?
   - Do you provide MDM or remote device management?

5) COMMERCIAL TERMS
   - Unit price for the kit at 10, 50, 100 and 500 units (please quote all tiers).
   - MOQ per SKU and per branded order.
   - Sample price and lead time for 2 sample kits shipped to Mexico.
   - Production lead time after PO, and shipping method (we prefer DDP to Mexico,
     please quote both DDP and FOB).
   - Warranty terms, spare parts policy and RMA process. What is your defect rate?
   - Payment terms for a first order and for repeat orders.

6) SUPPORT
   - Technical contact for integration questions and a WhatsApp/WeChat channel for
     fast support during the pilot.

Since we are building a standardized ecosystem and expect volume, we would appreciate
your best partner/distributor pricing rather than retail pricing, and your
recommendation on which configuration you would choose for a busy café/restaurant in
Mexico.

If it helps, we can sign an NDA and share our deployment plan and branding guidelines.

Looking forward to your quotation and datasheets.

Best regards,
Marco Del Toro
Founder, Rabbitty
rabbitty.me · hola@rabbitty.me
```

---

## Checklist interno antes de comprar (lo que hay que verificar)

| # | Punto | Por qué |
|---|---|---|
| 1 | **¿Es terminal de pago certificada?** | Un Android POS genérico **no** puede cobrar tarjeta legalmente sin EMV/PCI-PTS y un PSP. Si no lo es, sirve para comandas, no para cobrar. |
| 2 | **Homologación IFT/NOM** | En México, el radio (WiFi/BT/4G) debe estar homologado. Sin eso, el equipo no se puede importar/vender formalmente. |
| 3 | **Certificados en PDF con el modelo** | “CE/FCC” genéricos sin modelo no sirven para el expediente ni para aduana. |
| 4 | **Printer: ESC/POS + ancho** | Nuestro sistema habla ESC/POS; 58 mm es lo más común en tickets. Confirmar batería y autonomía. |
| 5 | **SDK y preinstalación del APK** | Si no permiten instalar/preinstalar nuestra app y modo kiosco, el kit no sirve. |
| 6 | **MOQ y costo de branding** | El splash y la caja con marca suelen tener MOQ distinto al del equipo. |
| 7 | **DDP vs FOB** | DDP te da costo final; FOB esconde flete, seguro y aduana. |
| 8 | **Tasa de defectos y RMA** | Con 30 equipos, un 5 % de fallas ya es un problema operativo. |
| 9 | **Repuestos de impresora** | El papel y el cabezal son el consumible que más falla. |
| 10 | **Muestra antes de comprometer** | Pedir 2 unidades y probarlas con nuestro POS **antes** de cualquier orden grande. |

## Nota sobre el modelo del anuncio

El YK967 es un **PDA/handheld con escáner 2D** (6.56", Android 14, 5000 mAh, 306 g).
Es excelente para **comandas, inventario y cobro asistido**, pero por sus
características **no parece un terminal EMV**: no menciona lector de tarjetas
certificado, PIN pad ni certificaciones de pago. Para cobrar con tarjeta seguimos
necesitando el lector certificado (Stripe S710, o el que defina el PSP).

Sirve perfecto para el **kit de operación**: terminal de comandas + impresora,
mientras el cobro con tarjeta va por su canal certificado.
