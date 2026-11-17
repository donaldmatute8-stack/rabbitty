# Estrategia Rabbitty Pay — de Stripe (puente) a rieles propios

**Fecha:** 18-nov-2026 · **Estado:** estrategia y arquitectura (nada implementado)
**Decisión del dueño:** Rabbitty Pay es el destino; **Stripe es temporal** para
operar mientras se construye el camino propio.

---

## 0. La verdad incómoda primero

"Ser tu propio sistema de pagos" tiene tres capas y **solo una** se puede hacer
desde cero rápido:

| Capa | Qué incluye | ¿Realista para Rabbitty? |
|---|---|---|
| **1. Experiencia** (marca, hardware, alta del comercio, conciliación, soporte) | lo que ve el afiliado y el comensal | ✅ **sí, ahora** |
| **2. Procesamiento** (autorización con el banco, EMV, llaves, PCI) | lo que mueve el dinero de la tarjeta | ⚠️ **con un adquirente/PSP detrás**: no se construye, se contrata |
| **3. Rieles de dinero** (liquidación, SPEI, custodia de fondos) | lo que pone el dinero en la cuenta del afiliado | ❌ requiere licencias (CNBV) — **fuera de alcance** |

**Conclusión:** Rabbitty Pay de verdad, a corto y mediano plazo, es **marca y
operación propias sobre el riel de un tercero**. Eso ya es enorme: es lo que
diferencia a Clip/Clip-style o a Square de una pasarela blanca. No requiere ser
banco.

`[REVISAR]` Cualquier modelo donde Rabbitty **custodie** el dinero del afiliado
(recibir y luego repartir) cambia la naturaleza regulatoria. En el modelo actual
(*destination charge*) ya se acerca: **validar con fiscal/legal**.

---

## 1. Dónde estamos hoy (activos reales)

| Activo | Estado | Valor para Rabbitty Pay |
|---|---|---|
| `paymentCore` (intents, idempotencia, liquidación, reembolsos) | ✅ operando | es el **cerebro** y no cambia: el proveedor es un detalle |
| `merchant_payment_accounts` por sucursal | ✅ | hoy guarda `stripeAccountId`; se generaliza a `providerAccountId` |
| Webhooks con bitácora por proveedor | ✅ | ya es multi-proveedor de hecho |
| Credenciales cifradas por proveedor (Mercado Pago) | ✅ AES-256-GCM | mismo patrón para el PSP propio |
| Ledger Bunz | ✅ | la parte que **sí es 100 % nuestra** |
| POS web (iPad + Android) | ✅ | el lector debe ser sustituible sin tocar el POS |

Lo que **falta** para que el cambio de proveedor sea barato: una **interfaz de
proveedor** explícita y el hardware abstraído.

---

## 2. La arquitectura que hace el cambio barato

### 2.1 Una interfaz, tres implementaciones

```ts
// packages/api/src/payments/provider.ts  (propuesto)
export interface PaymentProvider {
  id: "stripe" | "mercadopago" | "rabbitty" | string;

  /** Qué sabe hacer este riel. El POS pregunta antes de ofrecer un método. */
  capabilities: {
    cardTerminal: boolean;      // lector físico
    tapToPhone: boolean;
    hostedCheckout: boolean;    // link/QR
    mposSdk: boolean;           // lectores de terceros (I9)
    refunds: boolean;
    partialRefunds: boolean;
    splitPayments: boolean;
  };

  /** Alta del comercio (KYC). Stripe Connect lo hace; un PSP propio, también. */
  ensureAccount(branchId: string): Promise<{ providerAccountId: string; status: "PENDING" | "ACTIVE" }>;

  /** Crear el cobro. Mismo shape para todos: lo resuelve cada riel. */
  createPayment(input: CreatePaymentInput): Promise<{ providerPaymentId: string; status: PaymentStatus }>;

  /** Presentar en un lector (si aplica). */
  presentToReader?(readerId: string, providerPaymentId: string): Promise<void>;

  refund(input: RefundInput): Promise<{ providerRefundId: string; status: string }>;

  /** Verificación de webhook (firma/secreto del riel). */
  verifyWebhook(req: Request): Promise<WebhookEvent | null>;
}
```

**Regla:** el POS **nunca** importa un SDK ni sabe de Stripe. Solo llama
`payments.capabilities` y `payments.charge`. Cambiar de riel = nueva
implementación + fila en `merchant_payment_accounts`.

### 2.2 Datos que hay que guardar desde hoy (para no quedar atados)

| Tabla | Campo | Por qué |
|---|---|---|
| `payments` | `provider` (ya `verificationMethod`/metadata) | saber por qué riel pasó cada peso |
| `payment_intents` | `providerPaymentId`, `providerAccountId` | conciliar con el riel sin depender del nombre del proveedor |
| `merchant_payment_accounts` | generalizar `stripeAccountId` → `provider` + `providerAccountId` | hoy el nombre del campo ya duele |
| nueva `terminal_readers` | `provider`, `readerId`, `keyInjectionProvider`, `tmsProvider` | el I9 y el S710 no se gestionan igual |
| nueva `provider_fees` | `provider`, `scheme`, `fixed`, `percent`, `iva` | comparar costo real por riel |

### 2.3 Lo que NO debe cambiar

- **Ledger Bunz** y sus reglas (nunca depende del riel).
- **Idempotencia** (`idempotencyKey`): vive en nuestro dominio, no en el del PSP.
- **Webhooks como fuente de verdad** del estado final (autorización ≠ liquidación).
- **Conciliación** en dos pasos (negocio decide, Rabbitty autoriza).

---

## 3. Los tres caminos posibles (y cuál conviene)

### Camino A — Marca propia sobre un adquirente/PSP *(recomendado)*

```
POS Rabbitty  →  Rabbitty Pay (nuestra marca y flujo)
                     ↓
              PSP/adquirente (procesa, inyecta llaves, liquida)
                     ↓
              Banco del afiliado (SPEI)
```

- **Qué es nuestro:** hardware, SDK/UX, alta del comercio, soporte, conciliación,
  comisión de plataforma, lector con logo.
- **Qué es del PSP:** autorización, EMV, llaves, PCI, disputas de red.
- **Requisito:** un PSP que certifique el hardware elegido (aquí entra el I9) y
  opere en México con MXN.
- **Esfuerzo:** 4–8 semanas de integración (SDK + webhooks + conciliación).
- **Riesgo:** el PSP tiene que existir; si no certifica el I9, se elige otro lector.

### Camino B — PayFac con patrocinador

Igual que A, pero además Rabbitty hace el **alta de comercios** bajo el paraguas
de un patrocinador (sub-merchant). Añade contratos, control de riesgo y capital
de garantía. **Solo cuando haya volumen** (cientos de comercios).

### Camino C — Ser adquirente (licencia propia)

Afiliación a Visa/Mastercard vía un miembro, certificaciones, capital y
cumplimiento. **Años y millones.** Descartado como plan; se reevalúa solo si
Rabbitty Pay factura como negocio propio de gran escala.

---

## 4. Cómo encaja Stripe (el puente) y cómo se retira

### 4.1 Regla de oro del puente

**Stripe se usa para aprender, no para casarse.** Lo que se construye alrededor
(interfaz, ledger, conciliación, onboarding, hardware abstracto) debe sobrevivir
a Stripe.

### 4.2 Qué se queda aunque Stripe se vaya

| Se queda | Se va con Stripe |
|---|---|
| `paymentCore` y sus reglas | `stripeConnect.ts` (implementación del riel) |
| Webhook con bitácora | SDK JS de Stripe y `Payment Element` |
| Conciliación / conciliaciones | cuentas conectadas de Stripe |
| Hardware y su gestión | lectores Stripe (no reutilizables) |
| Ledger Bunz | — |

### 4.3 Plan de salida (cuando llegue el PSP propio)

1. Implementar `RabbittyProvider` (o `MexPspProvider`) con la misma interfaz.
2. Alta de comercios: migrar `providerAccountId` sin tocar `paymentCore`.
3. **Doble riel temporal:** nuevos comercios en el riel nuevo, los existentes se
   migran cuando terminen su ciclo de liquidación.
4. Apagar Stripe cuando el riel nuevo lleve **30 días** sin incidentes.

**Criterio de salida:** ningún cobro nuevo en Stripe, conciliación al 100 %,
contracargos funcionando en el riel nuevo.

---

## 5. Lo que hay que construir AHORA (aunque Stripe siga)

Ordenado por retorno y por lo que desbloquea:

| # | Pieza | Por qué ahora | Esfuerzo |
|---|---|---|---|
| 1 | **`payments.capabilities`** | el POS debe preguntar qué puede el riel, no asumir Stripe | 2–3 h |
| 2 | **`provider` en pagos e intents** | sin esto, migrar exige reescribir reportes | 3–5 h |
| 3 | **`terminal_readers` + TMS/keys** | es la pieza que el I9 y el S710 comparten | 1 día |
| 4 | **Costo por riel (`provider_fees`)** | para negociar y para saber cuánto cuesta Rabbitty Pay | 3–4 h |
| 5 | **Panel de rieles** (estado, tarifas, lector asignado) | el afiliado ve “Rabbitty Pay” aunque detrás cambie el riel | 1–2 días |

Nada de esto cambia el comportamiento actual: son campos, no flujos nuevos.

---

## 6. Cómo se decide (métricas)

| Señal | Umbral | Acción |
|---|---|---|
| Cobros con tarjeta por mes | > 3 000 | justifica negociar tarifa propia con un PSP |
| Comisión pagada al procesador | > 40 000 MXN/mes | buscar riel propio (Camino A) |
| % de afiliados con lector propio | > 50 % | estandarizar hardware + comodato |
| Contracargos | > 0,5 % de tickets | reforzar riesgo **antes** de crecer |

---

## 7. Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Quedar atado a Stripe | interfaz + `provider` en datos (lo de §5) |
| Comprar hardware que no cobra | no comprar 100 piezas sin PSP confirmado (ver `COTIZACION-Y-DECISION-I9.md`) |
| Custodia de dinero sin licencia | definir con fiscal si el modelo es comisión o mandato; evaluar pasar a direct charges |
| Dependencia de un solo adquirente | diseñar el adapter desde el inicio (dos implementaciones) |
| Prometer “sistema propio” y ser solo marca | comunicar con honestidad: **Rabbitty Pay = nuestra experiencia, riel certificado detrás** |

---

## 8. Lo que significa para el I9 (hoy)

| Escenario | Qué hacer con el I9 |
|---|---|
| **Rabbitty Pay con PSP mexicano en ≤ 12 meses** | **2 muestras ahora** para validar el SDK; las 100 con logo después de cerrar el PSP |
| Stripe indefinido | no comprar I9 para cobrar (Stripe no lo acepta); el S710 es la vía |
| Ambos (puente Stripe + Rabbitty Pay en paralelo) | S710 para Stripe hoy; I9 cuando el riel propio exista — **mismo POS, distinto adapter** |

**Lo importante:** el I9 **es el hardware correcto para la visión** (marca propia,
logo, bajo costo) y el **S710 es el hardware correcto para el puente** (Stripe).
Comprar 2 muestras del I9 no compromete la estrategia; comprar 100 sí.
