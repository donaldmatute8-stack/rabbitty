# Roadmap de cobros presenciales — decisiones, hardware y políticas

**Fecha:** 18-nov-2026 · **Estado:** documentación de rumbo (nada implementado)
**Documento hermano:** `Docs/ANALISIS-TERMINAL-PAGOS.md` (auditoría técnica)

---

## 0. Decisiones ya tomadas (contestadas por el dueño)

| # | Decisión | Consecuencia directa |
|---|---|---|
| 1 | **El POS debe correr en iPad y en Android** | Descarta cualquier ruta que dependa de un SDK nativo como *camino principal* (Bluetooth, Tap to Pay) |
| 2 | **Los lectores los paga el afiliado, pero los provee y marca Rabbitty** | Compra/gestión centralizada + imagen de marca; hay que definir comodato y responsabilidad del equipo |
| 3 | **Rabbitty Pay es el camino principal**; las alternativas existen, pero deben sentirse *peores* que nuestro flujo | Prioridad de producto: integración y fricción baja, no solo “otra opción” |
| 4 | **Hacen falta políticas, términos y temas legales** | Checklist en §5 |

> **Y antes de todo esto: el offline.** Se acordó hacer primero el offline con
> 626 Café (efectivo, cola idempotente y conciliación). Un terminal agrava el
> offline porque depende de la red; por eso va después.

---

## 1. La modalidad que cumple las cuatro decisiones

Con "iPad **y** Android" + "sin app nativa" + "lector que nosotros proveemos y
marcamos", queda **una sola** combinación viable como camino principal:

```
POS web (Safari en iPad / Chrome en Android)
        │  HTTPS (API propia)
        ▼
Servidor Rabbitty  ──►  Stripe API
        │                 └─ process_payment_intent
        ▼
Lector inteligente en la red del comercio (Stripe Reader S710)
```

**Integración server-driven + lector inteligente.** Ventajas:

- Funciona **igual** desde iPad y Android, sin SDK ni Bluetooth.
- El POS solo pregunta “¿ya pagó?” al servidor (polling corto + webhook).
- El lector es un dispositivo **con pantalla**: puede mostrar el monto, pedir
  propina y (más adelante) correr una app propia en el dispositivo.

### Disponibilidad real en México (verificado en docs de Stripe, 18-nov-2026)

| Producto | Estado en MX |
|---|---|
| **Stripe Reader S710** (lector inteligente, Wi-Fi + **4G LTE**) | **Vista previa pública** |
| BBPOS WisePad 3 (Bluetooth/USB) | Vista previa pública — *requiere SDK móvil* |
| Tap to Pay **iPhone** | Vista previa pública |
| Tap to Pay **Android** | Vista previa pública |

Nota: el texto que circulaba decía que Tap to Pay Android no estaba en MX; la
documentación actual **sí lo lista** para México. Antes de prometerlo hay que
confirmarlo con la cuenta real de Stripe.

**S710 es el único lector inteligente listado para México** → es el candidato.

---

## 2. Por qué no las otras rutas (como camino principal)

| Ruta | Por qué no | Cuándo sí |
|---|---|---|
| **Tap to Pay iPhone** | Solo iPhone (no iPad) y exige **SDK nativo** (nuestra app es Capacitor) | Cuando haya app nativa y clientes que lo pidan |
| **Tap to Pay Android** | Exige SDK nativo y dispositivos soportados | Ídem; podría ser el “plan B sin hardware” |
| **WisePad 3 (Bluetooth)** | Requiere SDK móvil; Web Bluetooth no existe en Safari | Nunca desde el POS web |
| **Apps on Devices** (correr Rabbitty POS *dentro* del S710) | Requiere Android SDK y app nativa; es lo más “de marca” pero lo más caro | Fase avanzada: hardware 100 % Rabbitty |
| **Mercado Pago Point** | Es otro ecosistema; el afiliado cobra en *su* cuenta MP, no en Rabbitty Pay | Solo si un afiliado lo exige |
| **Referencia manual** (`TARJETA_EXTERNA`, ya existe) | No integra: el cajero teclea el folio del lector ajeno | Puente mientras se despliega hardware propio |

---

## 3. Marca y hardware

### 3.1 Qué permite personalizar Stripe

| Capacidad | S710 | Nota |
|---|---|---|
| **Splash screen personalizado** | ✅ | Lo mínimo para que el lector “sea Rabbitty” |
| **Apps on-device (de pago)** | ✅ | Correr nuestra app en el lector (fase futura) |
| Propina en pantalla del lector | ✅ | Decide quién la captura: lector o POS |
| Entrada en pantalla (teléfono, propina) | ✅ | Útil para ticket por correo |
| Modo standalone (app de Stripe) | ✅ | Alternativa sin POS, no la queremos |

**Realidad del branding:** Stripe no imprime tu logo en el plástico. Lo que sí se
puede: splash personalizado, accesorios/etiquetas y **Apps on Devices** para que
la pantalla completa sea Rabbitty. Si el objetivo es “hardware de marca”, eso se
resuelve en la fase de Apps on Devices, no comprando otro lector.

### 3.2 Quién paga y de quién es el equipo (hay que decidirlo por escrito)

El afiliado paga el lector, pero Rabbitty lo compra y lo entrega. Eso es un
**comodato** (préstamo de uso) o una venta a plazos, y cambia quién responde si
se rompe, se pierde o se lo roban. Opciones:

| Modelo | Quién es dueño | Implicación |
|---|---|---|
| **Comodato** (recomendado) | Rabbitty | Se recupera al terminar la relación; el afiliado paga una cuota de uso/garantía |
| Venta directa | Afiliado | Rabbitty no recupera hardware; el soporte se complica |
| Renta mensual | Rabbitty | Ingreso recurrente; requiere logística de devolución |

---

## 4. Arquitectura (resumen; detalle técnico en el documento hermano)

```
Nuevo:  terminal_readers (branchId, provider, readerId, label, status, lastSeenAt)
        terminal_locations (branchId, providerLocationId)

Servidor:
  payments.terminalConnectionToken   → token efímero por sucursal (nunca cachear)
  payments.terminalRegisterReader    → registra el S710 en la cuenta correcta
  payments.terminalCharge            → crea intent (card_present) + process_payment_intent
  webhook terminal.reader.action_*   → estado del lector
  webhook payment_intent.succeeded   → YA EXISTE → confirmPaymentIntentSettled

POS:
  Método "Tarjeta" → sub-opciones:
     (a) Rabbitty Pay (link/QR al cliente)     ← principal
     (b) Lector Rabbitty (S710)                ← nuevo
     (c) Otra terminal (referencia manual)     ← existe hoy
```

### Decisión pendiente que bloquea el registro del lector

| Modelo | Lector registrado en | Efecto |
|---|---|---|
| **Destination charge** (lo que usa Rabbitty Pay hoy) | cuenta **plataforma** | el afiliado no necesita Stripe; Rabbitty es dueño del lector → encaja con “nosotros lo proveemos” |
| Direct charge | cuenta **del afiliado** | el afiliado cobra en su cuenta; más KYC y menos control de marca |

**Recomendación:** destination charge, coherente con el modelo actual y con el
hecho de que Rabbitty compra y entrega el equipo.

---

## 5. Políticas, términos y legal (checklist)

Sin esto no se puede cobrar con tarjeta a nombre de terceros. Orden de prioridad:

### 5.1 Bloqueantes antes del primer cobro

| # | Documento | Qué debe decir |
|---|---|---|
| 1 | **Contrato de afiliación — anexo de pagos** | quién cobra, quién es el comercio ante el banco/Stripe, comisiones (plataforma 1 %, Stripe, IVA sobre comisiones), plazos de liquidación |
| 2 | **Comodato / entrega del lector** | propiedad, responsabilidad por pérdida/daño/robo, devolución al terminar, quién paga el reemplazo, garantía |
| 3 | **Política de chargebacks y contracargos** | plazos de respuesta, evidencia exigida (ticket firmado, comprobante del lector, ubicación), **quién absorbe la pérdida**, derecho a retener liquidaciones |
| 4 | **Política de reembolsos y devoluciones** | reembolso siempre contra la transacción original; plazos; quién lo autoriza en el POS; qué pasa con propinas y Bunz |
| 5 | **Aviso de privacidad y datos de pago** | el PAN nunca toca Rabbitty (el lector cifra); qué se guarda (últimos 4, marca, referencia), retención |

### 5.2 Necesarios al crecer

| # | Documento | Notas |
|---|---|---|
| 6 | **Alcance PCI** | los lectores son pre-certificados; Rabbitty queda en SAQ A/A-EP. **Documentar** el alcance y no almacenar datos de tarjeta jamás |
| 7 | **Términos de uso del POS** | disponibilidad, mantenimiento, límites de responsabilidad, uso indebido |
| 8 | **Política de propinas** | si se captura en el lector: quién la recibe, cuándo se paga, cómo se refleja en el corte |
| 9 | **Facturación (CFDI)** | hoy **fuera de alcance**: el afiliado factura con su PAC. Debe decirlo el contrato para no prometerlo |
| 10 | **Política de offline** | si se cae la red con un terminal: no se cobra tarjeta, se cae a efectivo/QR; queda registrado |
| 11 | **Soporte y SLA del hardware** | tiempos de reemplazo, quién paga el envío, qué pasa en temporada alta |
| 12 | **Baja y devolución** | qué pasa con el lector, con las liquidaciones pendientes y con los Bunz al terminar la relación |

### 5.3 Riesgo regulatorio a validar con abogado

- **Rol ante el dinero de terceros**: con destination charges Rabbitty aparece
  como plataforma que cobra y transfiere. Hay que confirmar con asesoría fiscal
  mexicana cómo se declara (comisión vs. mandato) y el **IVA sobre la comisión**.
- **KYC/AML**: Stripe Connect lo hace del afiliado; documentar que Rabbitty no
  sustituye esa obligación.
- **Terminal en vista previa pública** en México: no comprometer disponibilidad
  contractual (SLA) mientras Stripe no lo pase a disponibilidad general.

---

## 6. Roadmap por fases (con puertas de decisión)

| Fase | Qué | Entregable | Puerta para pasar |
|---|---|---|---|
| **0** | **Offline POS/KDS** (626 Café) | cobro en efectivo sin red + conciliación | usado un turno real sin descuadres |
| **1** | **Rabbitty Pay como camino obvio** | método por defecto, menos pasos, recordatorio de que no hay hardware | ≥ 60 % de los cobros con tarjeta pasan por Rabbitty Pay |
| **2** | **Un lector piloto** (S710, server-driven) | un comercio cobrando desde el POS | 2 semanas sin incidentes + chargeback simulado resuelto |
| **3** | **Fleet + comodato** | 5–10 lectores con splash de Rabbitty y contrato firmado | proceso de alta < 15 min por afiliado |
| **4** | **Tap to Pay (iPhone/Android)** | plugin nativo Capacitor | solo si la fase 2 muestra demanda de “sin hardware” |
| **5** | **Apps on Devices** | Rabbitty POS corriendo **dentro** del lector | hardware 100 % de marca justificado por volumen |

---

## 7. Métricas para decidir cada fase

| Pregunta | Métrica | Umbral sugerido |
|---|---|---|
| ¿Rabbitty Pay basta? | % de cobros con tarjeta por Rabbitty Pay vs. referencia manual | > 60 % |
| ¿Hace falta hardware? | tickets/día que caen a “otra terminal” | > 30 % de los tickets |
| ¿El lector se paga solo? | comisión capturada vs. costo del equipo | < 6 meses |
| ¿El soporte es sostenible? | incidencias por lector al mes | < 0,2 |

---

## 8. Preguntas abiertas (para cuando llegue la fase 2)

1. **Precio y disponibilidad del S710 en México** — confirmar en el dashboard de
   Stripe (Terminal shop); está en vista previa pública, no publicar precios aún.
2. **¿Comodato o venta?** (§3.2) — define contrato y logística.
3. **¿Quién absorbe el chargeback?** — el afiliado, Rabbitty, o un fondo de reserva.
4. **¿Propina en el lector o en el POS?** — cambia el flujo y el corte.
5. **¿Cuenta Stripe del afiliado o plataforma?** (§4) — si es plataforma, Rabbitty
   concentra el dinero y debe declararlo; validar con fiscal.
6. **¿Se permite cobrar con terminal ajeno** (referencia manual) o se deprecia
   cuando haya lector propio.

---

## 9. Lo que NO se debe hacer

- **Prometer “terminal en el iPad”**: no existe.
- **Comprometerse con SLA** de Terminal mientras esté en vista previa.
- **Guardar datos de tarjeta** en nuestra base (nunca; el lector cifra).
- **Cobrar en la cuenta plataforma sin definir** quién declara ese dinero.
- **Meter terminal antes del offline**: se duplica el riesgo operativo.
