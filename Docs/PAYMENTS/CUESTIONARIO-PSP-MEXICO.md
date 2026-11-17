# Cuestionario para adquirentes/PSP en México — el riel de Rabbitty Pay

**Fecha:** 18-nov-2026 · **Objetivo:** encontrar quién certifica hardware de
terceros (MPOS) e inyecta llaves en México para poder cobrar con **nuestro**
lector y nuestra marca.

> El proveedor del I9 ya dijo que **no conoce** ningún PSP mexicano que lo
> certifique. Por eso la pregunta no es “¿me venden un lector?” sino
> **“¿certifican hardware de terceros y quién inyecta las llaves?”**.

---

## 1. A quién preguntar (lista inicial, estado por confirmar)

| Candidato | Tipo | Por qué |
|---|---|---|
| **Openpay (BBVA)** | adquirente/PSP | tiene API y opera MXN; preguntar por MPOS de terceros |
| **Conekta** | PSP | API fuerte; preguntar por terminales y SDK |
| **Clip** | adquirente con hardware propio | probablemente cerrado, pero vale confirmar SDK |
| **Mercado Pago (Point)** | adquirente con hardware propio | tiene API de Point; confirmar si acepta hardware ajeno (poco probable) |
| **Netpay / Sr. Pago** | PSP/terminales | ofrecen terminales y API |
| **Evertec / Paymentez** | procesador LatAm | opera en México, preguntar MPOS |
| **Getnet (Santander) / EVO** | adquirentes | terminales propias; preguntar por integración |
| **dLocal** | PSP LatAm | fuerte en cross-border; preguntar MPOS en MX |
| **Adyen** | adquirente global | Terminal SDK, pero solo con lectores Adyen |
| **Stripe** | PSP | **solo sus lectores** (queda como puente) |

`[VERIFICAR]` Cada uno debe responder con hechos, no con “sí se puede”. Pedir
siempre el **nombre del programa/SDK** y una referencia de un comercio mexicano.

---

## 2. Correo base (español) para enviar

```
Asunto: Integración de terminales MPOS de terceros — Rabbitty (México)

Hola {nombre},

Soy Marco Del Toro, fundador de Rabbitty (rabbitty.me), una plataforma de punto de
venta y lealtad para restaurantes y cafés en México. Hoy procesamos con un PSP
internacional y estamos evaluando construir nuestra propia experiencia de cobro
(Rabbitty Pay) sobre un adquirente mexicano.

Nuestro modelo: damos el sistema al restaurante y queremos entregar el lector con
nuestra marca, cobrando en MXN y liquidando al comercio.

Necesitamos confirmar cinco puntos técnicos y comerciales:

1) HARDWARE DE TERCEROS
   ¿Certifican terminales MPOS de fabricantes de terceros (por ejemplo equipos
   Android/Bluetooth con EMV L1&L2 y PCI) mediante un SDK propio?
   Si sí: ¿qué modelos están ya certificados y cuál es el proceso para certificar
   uno nuevo? ¿Cuánto tarda y cuánto cuesta?

2) SDK E INTEGRACIÓN
   ¿Tienen SDK nativo iOS y Android? ¿Documentación pública o bajo NDA?
   ¿Existe un puente para aplicaciones web (nuestro POS es una app web envuelta en
   Capacitor) o requiere una pantalla nativa completa?

3) LLAVES Y TMS
   ¿Quién inyecta las llaves DUKPT: ustedes, un tercero certificado o nosotros?
   ¿Ofrecen TMS para actualización remota y monitoreo? ¿Cómo se cobra (incluido,
   por dispositivo, licencia mensual)?

4) MODELO COMERCIAL
   - Tarifa por transacción (porcentaje + fijo) y costo mensual por terminal.
   - ¿Modelo marketplace/plataforma (nosotros damos de alta a los comercios) o cada
     comercio firma con ustedes?
   - ¿Quién es el comercio ante la red: nosotros o el restaurante?
   - Liquidación: ¿SPEI directo al comercio? ¿En cuántos días?
   - ¿Quién asume los contracargos y con qué evidencia?

5) MARCA
   ¿Permiten que el lector y la app lleven la marca Rabbitty? ¿Hay restricciones de
   branding o de app propia en el dispositivo?

Nos interesa empezar con un piloto pequeño y crecer. Agradezco su tarifa para
piloto y para volumen, y el contacto técnico para revisar el SDK.

Saludos,
Marco Del Toro
Founder, Rabbitty · rabbitty.me · hola@rabbitty.me
```

---

## 3. Qué evaluar en cada respuesta

| Señal | Buena | Mala |
|---|---|---|
| “Sí certificamos terceros” | dan **modelo ya certificado** y proceso | “se puede” sin nombre ni caso |
| SDK | docs + demo + soporte | “te mandamos el APK” y nada más |
| Llaves | dicen **quién** y **dónde** | “se inyectan al fabricar” sin adquirente |
| Modelo | marketplace/plataforma con nosotros como agregador | obligan a cada comercio a firmar |
| Liquidación | SPEI al comercio, plazo claro | “depende” sin número |
| Contracargos | regla escrita y evidencia | “se ve caso por caso” |
| Branding | permitido con lineamientos | prohibido o solo en la caja |

---

## 4. Criterio de decisión

Elegimos el riel que cumpla **los cuatro**:

1. Certifica hardware de terceros (o al menos, un lector con SDK abierto).
2. Permite modelo plataforma (nosotros damos de alta al comercio).
3. Liquida en MXN por SPEI con plazo definido.
4. Acepta que la app y el lector lleven la marca Rabbitty.

Si ninguno lo cumple hoy, **Stripe sigue siendo el riel** y Rabbitty Pay se
construye como **experiencia** (marca, onboarding, conciliación) sobre Stripe, con
la interfaz lista para cambiar después.

---

## 5. Lo que se puede hacer en paralelo (sin esperar respuestas)

- Implementar la interfaz `PaymentProvider` + `capabilities` (3–4 días).
- Añadir `provider`/`providerAccountId` a los datos de pago.
- Crear `terminal_readers` y `provider_fees`.
- Con eso, el día que un adquirente diga “sí”, el cambio es un módulo.
