# Cotización I9 (HCCTG) — costos, decisiones y bloqueo de PSP

**Fecha:** 18-nov-2026 · **Proveedor:** HCCTG (Alibaba) · **Modelo:** I9

---

## 1. Lo que ofrecieron (respuesta textual resumida)

| Punto | Respuesta |
|---|---|
| Pantalla | **No tiene** (1 botón, 4 LEDs) → **sin branding en pantalla** |
| SDK | **Gratis con la muestra**; app y **integración con PSP corren por nuestra cuenta** |
| Precio 20 pzas | **$32 USD** c/u |
| Precio 100–499 | **$26 USD** c/u |
| Precio 500–9 999 | **$24 USD** c/u |
| Logo + caja personalizada | **desde 100 pzas** |
| Muestras | 2 × $32 = **$64** + envío; 2–3 días hábiles tras pago; incluye SDK/API docs |
| Certificados | EMV L1&L2, PCI, Visa payWave, Mastercard, TQM, CE/FCC/RoHS |
| Garantía | **12 meses** |
| Flete | **DAP** (ellos pagan el flete, **los impuestos y trámites son nuestros**) |
| Pendiente | ciudad + código postal, y **qué PSP usaremos**, para confirmar inyección de llaves y TMS en México |

---

## 2. 🚨 El bloqueo que hay que resolver antes de comprar

**Stripe no acepta lectores de terceros.** Stripe Terminal solo funciona con
hardware homologado por Stripe (S710, WisePOS E, M2 en EE. UU., Verifone, Tap to
Pay). Un I9 **no se puede conectar a Stripe**, aunque tenga EMV y PCI.

Consecuencia directa:

| Si Rabbitty Pay = | El I9… |
|---|---|
| **Stripe** | **no sirve para cobrar** (solo podría usarse como lector de otro PSP) |
| Otro adquirente/PSP con SDK MPOS en México | puede servir, **si** ese PSP lo certificó e inyecta llaves |

Y el proveedor lo confirma al pedir "qué PSP usarán para confirmar inyección de
llaves y TMS": **ellos no procesan**, solo entregan hardware + SDK.

**Pregunta que decide todo:** ¿qué PSP/adquirente en México tiene certificado el
I9 y puede inyectar llaves DUKPT para operar en MXN?

Si la respuesta es "ninguno confirmado", comprar el I9 es comprar hardware que
todavía no puede cobrar.

---

## 3. Costo real (estimado, no cotización aduanal)

Supuestos: 100 piezas con logo ($26), flete DAP estimado, DTA 0.8 % y IVA 16 %
(recuperable si Rabbitty está dado de alta).

| Concepto | Por unidad | 100 piezas |
|---|---|---|
| Equipo | $26.00 | $2 600 |
| Flete DAP (estimado) | $3.00–5.00 | $300–500 |
| DTA (0.8 % del valor) | ~$0.24 | ~$24 |
| **Subtotal antes de IVA** | **~$29–31** | **~$2 924–3 124** |
| IVA 16 % (acreditable) | ~$4.60–5.00 | ~$468–500 |
| **Desembolso total** | **~$34–36** | **~$3 400–3 600** |

> El flete real y la fracción arancelaria los define el agente aduanal. **No**
> comprometer precio al afiliado con estas cifras: son de planeación.

### Comparación con la alternativa certificada

| Opción | Costo equipo | PSP | Marca |
|---|---|---|---|
| **I9** | $26–32 | **hay que encontrar quién lo certifique en MX** | logo impreso + caja desde 100 pzas |
| **Stripe S710** | (consultar dashboard Stripe MX) | Stripe (ya integrado en el código) | splash personalizado + Apps on Devices |

**El ahorro de hardware del I9 puede desaparecer** si obliga a cambiar de PSP o a
construir una integración de pagos desde cero.

---

## 4. Plan de ejecución (lo que sí se puede hacer ya)

| Paso | Acción | Estado |
|---|---|---|
| 1 | Responder al proveedor con ciudad/CP y la pregunta del PSP | **listo para enviar** (§5) |
| 2 | Pedir los **PDF de certificados con el modelo visible** | en el mismo correo |
| 3 | Pedir **specs de serigrafía y caja** (formatos, tamaño, colores) | en el mismo correo |
| 4 | Cotizar flete **DAP a la ciudad** y comparar con **DDP** | en el mismo correo |
| 5 | **No comprar 100** hasta saber PSP y TMS | bloqueado por §2 |
| 6 | Si el PSP no aparece: **2 muestras** solo para validar el SDK, no para operar | opcional |

**Regla:** no se compran 100 piezas (donde empieza el logo) sin PSP confirmado y
TMS definido. Dos muestras sí valen la pena si el SDK sirve para evaluar el
esfuerzo real de integración.

---

## 5. Correo de respuesta (listo para enviar)

```
Subject: RE: RFQ — I9 reader · PSP path, branding specs and DAP quote

Hi {nombre},

Thanks, the terms are clear. Before moving to samples we need to close two points,
because they define whether the I9 can actually take payments for us.

1) PSP AND KEY INJECTION IN MEXICO (blocking)
   Our primary processing partner is Stripe, and Stripe only supports its own
   certified readers. So we need to know:
   - Which PSPs/acquirers in Mexico have certified this I9 and can process MXN?
   - Who performs key injection (DUKPT) for Mexico, and can devices ship
     pre-keyed to a Mexican acquirer?
   - What are the TMS terms: included, per-device license, or hosted by you?
   If no Mexican PSP is certified yet, please say so clearly — we would then treat
   the I9 as an evaluation unit only, not as our production reader.

2) BRANDING SPECS
   Confirmed: logo printing and custom carton from 100 pcs. Please send:
   - Artwork requirements (file format, resolution, print area, colors).
   - Mock-up or photo of a previously branded I9.
   - Price delta and lead time for branded units vs. plain.
   - Can the manual and quick-start be supplied in Spanish?

3) SHIPPING
   Please quote freight DAP to: {ciudad}, {código postal}, Mexico.
   Also send the DDP option so we can compare landed cost.

4) CERTIFICATES
   Please attach the PDFs with the model name visible: EMV L1&L2, PCI PTS (version),
   Visa payWave, Mastercard Contactless, TQM, CE/FCC/RoHS.

5) SDK
   Since the SDK comes with the sample, please confirm it includes:
   - iOS and Android libraries, API reference and a working demo app.
   - Whether pairing works from a web app via a native bridge (our POS is a web app
     wrapped in Capacitor) or requires a fully native screen.

We are ready to order 2 samples as soon as we know the PSP path; the 100-unit
branded order depends on that answer.

Best regards,
Marco Del Toro
Founder, Rabbitty
```

> Reemplazar `{nombre}`, `{ciudad}` y `{código postal}` antes de enviar.
