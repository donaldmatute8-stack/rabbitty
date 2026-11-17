# RFQ · Lector de tarjetas Bluetooth I9 (HCCTG)

**Fecha:** 18-nov-2026 · **Modelo:** I9 · BT 4.2 · EMV L1&L2 · PCI · payWave · DUKPT

---

## Mensaje para enviar (copiar y pegar)

```
Subject: RFQ — I9 Bluetooth card reader with custom logo (Mexico, restaurant ecosystem)

Hello,

I'm Marco, founder of Rabbitty (rabbitty.me), a growing restaurant-tech ecosystem in
Mexico. We give our affiliated restaurants and cafés a point-of-sale system (orders,
kitchen display, loyalty) and we are selecting the card reader we will standardize on.

We are interested in your model I9 (BT 4.2, EMV L1&L2, PCI, Visa payWave, DUKPT/MK/SK,
USB-C, 500 mAh) because it matches what we need: a simple, certified reader that pairs
with a tablet and is managed remotely.

Our context, so you can quote accordingly:
- Pilot of 20–50 units, scaling to several hundred over the next 12 months.
- Our POS runs on iPad (Safari, web app) and on Android; the reader would pair with a
  companion app or SDK.
- We handle deployment, support and merchant onboarding ourselves, together with a PSP.
- We want a long-term hardware partner, not a one-time purchase.

What we need to know:

1) PAYMENT ARCHITECTURE (most important)
   - Which PSPs / acquirers / gateways are already integrated with this reader?
     (Adyen, Stripe, Worldpay, Fiserv, First Data, dLocal, Mercado Pago, or others.)
   - Is there an MPOS SDK for iOS and Android? Please share the documentation and a
     sandbox/demo APK or TestFlight build.
   - Does it work through a generic EMV kernel via your SDK, or does it require a
     specific PSP integration?
   - How is cardholder data protected end to end (PCI PTS version, SRED)?

2) TMS, KEYS AND REMOTE MANAGEMENT
   - Do you provide a TMS (terminal management system) for remote key injection,
     firmware updates and fleet monitoring? Is it included, licensed per device, or
     hosted by you?
   - Confirm DUKPT key management and that keys can be injected by a certified
     facility (not in our premises).
   - Can you ship devices "key-injected for Mexico" and ready to pair?

3) CERTIFICATIONS FOR MEXICO
   - Please send the certificate PDFs **with the model name visible**: EMV L1 & L2,
     PCI PTS (version), Visa payWave, Mastercard Contactless, and the TQM report.
   - Do you provide IFT / NOM homologation for the Bluetooth radio, or do we need to
     homologate locally? What is your experience shipping to Mexico?
   - Are CE/FCC/RoHS also available?

4) BRANDING (we want our identity on it)
   - Can the device carry our logo? Options and limits: silk-screen/print on the
     enclosure, logo on the box and manual, custom color.
   - Is there a splash/display branding option, or is it a screenless reader?
   - What is the MOQ for branded units and for custom packaging?
   - Can you supply the product manual and quick-start in Spanish?

5) COMMERCIAL TERMS
   - Unit price at 20, 100, 300 and 500 units (please quote every tier).
   - Price difference for branded units and custom packaging.
   - Sample price and lead time for 2 units shipped to Mexico.
   - Production lead time after PO; shipping DDP to Mexico (please quote DDP and FOB
     so we can compare).
   - Warranty, spare parts, RMA process and your field defect rate.
   - Payment terms for a first order and for repeat orders.

6) SUPPORT
   - Technical contact for integration and a WhatsApp/WeChat channel for fast support
     during the pilot.
   - Do you provide a battery/charging accessory kit (cradle, USB-C cable)?

Since we are standardizing hardware across a growing ecosystem and expect volume, we
would appreciate your best partner/distributor pricing rather than retail, and your
recommendation on the best configuration for a busy café or restaurant in Mexico.

We are happy to sign an NDA to receive the SDK, technical documentation and your
integration guide.

Looking forward to your quotation and datasheets.

Best regards,
Marco Del Toro
Founder, Rabbitty
rabbitty.me · hola@rabbitty.me
```

---

## Checklist interno antes de comprar

| # | Punto | Por qué importa |
|---|---|---|
| 1 | **¿Con qué PSP está integrado?** | El lector es hardware: sin un PSP que lo certifique y procese, no cobras. Es **la** pregunta. |
| 2 | **SDK iOS + Android** | Nuestro POS es web (iPad/Safari y Android). El SDK nativo es obligatorio para el lector; hay que ver el puente. |
| 3 | **TMS incluido y quién paga** | Sin TMS no hay inyección remota de llaves ni actualizaciones: se vuelve logística manual. |
| 4 | **Certificados con el modelo visible** | “EMV/PCI” genéricos no sirven para el expediente ni para aduana. |
| 5 | **Homologación IFT/NOM del Bluetooth** | Sin eso no se importa/vende formalmente en México. |
| 6 | **Marca: qué sí y qué no** | Serigrafía y caja son realistas; **splash en pantalla no aplica si el lector no tiene pantalla**. |
| 7 | **MOQ de branding** | Suele ser distinto (y mayor) al del producto genérico. |
| 8 | **Batería real** | 500 mAh es poco para un turno completo: preguntar autonomía y si hay base de carga. |
| 9 | **DDP vs FOB** | DDP te da costo final; FOB esconde flete, seguro y aduana. |
| 10 | **2 muestras primero** | Probar pairing + cobro real **antes** de cualquier orden grande. |

## Nota técnica para nosotros

El I9 **sí es un lector de cobro** (EMV L1&L2, PCI, payWave), a diferencia del PDA
del anuncio anterior. Pero un lector certificado **no cobra solo**: necesita

```
Lector I9  ──BT──►  App acompañante (SDK nativo)  ──►  PSP / adquirente  ──►  liquidación
```

Es decir: además del hardware hay que elegir **quién procesa** (Stripe, Adyen, un
adquirente local, etc.) y quién inyecta llaves (TMS). Eso es lo que define si el kit
sirve para Rabbitty Pay o si solo sirve como lector de un tercero.

**Batería de 500 mAh** y sin pantalla: encaja para un cobro rápido de mesa, no para
un turno completo sin base de carga. Preguntar por la base/cradle en el punto 6.
