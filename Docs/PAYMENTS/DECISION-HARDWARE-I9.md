# Decisión de hardware — el I9 queda fuera como lector de producción

**Fecha:** 18-nov-2026 · **Base:** respuesta del proveedor HCCTG

---

## 1. Lo que dijo el proveedor (literal, resumido)

| Punto | Respuesta |
|---|---|
| **PSP mexicano** | **“No tengo registro de ningún PSP/adquirente mexicano que certifique el I9”** |
| Llaves DUKPT | **Se inyectan por adquirente** → sin adquirente, no hay llaves |
| Recomendación | **“Trátalo como unidad de evaluación, no como lector de producción”** |
| Alcance certificado | EMV L1&L2, PCI, Visa payWave, Mastercard, TQM, CE/FCC/RoHS |
| SDK | Librerías iOS y Android, API reference y demo app; **el puente Capacitor corre por nuestra cuenta** |
| Branding | Arte **AI/CDR vectorial con Pantone**, área de impresión según su troquel; **manual en español desde 100 pzas** con lead time extra |
| Foto de I9 marcado | **No tiene** |
| Envío | Caja 8×8×4 cm, 0.127 kg; **DAP**, impuestos por nuestra cuenta; faltan ciudad y CP |

---

## 2. Decisión

> **El I9 NO se usa como lector de producción en México por ahora.**

No es un problema de calidad del equipo (tiene EMV, PCI y payWave). Es que **falta
la pieza que lo hace cobrar**: un adquirente que lo certifique e inyecte llaves.
Comprar 100 piezas hoy es comprar hardware que no procesa.

| Compra | Decisión |
|---|---|
| **100 pzas con logo** | ❌ **No.** Bloqueado hasta que exista PSP que lo certifique |
| **2 muestras ($64)** | ⚠️ **Opcional**, solo para medir el esfuerzo del puente nativo; el proveedor lo llama “unidad de evaluación” |
| **1 muestra** | ✅ si queremos tocar el SDK antes de negociar con un PSP |

---

## 3. Qué significa para Rabbitty Pay

El destino sigue siendo nuestro, pero el orden cambia:

```
AHORA      Stripe (puente)  →  S710 o Rabbitty Pay por link/QR    ← operar
PARALELO   Buscar adquirente mexicano que certifique hardware de terceros
DESPUÉS    SDK nativo (Capacitor) + lector de marca               ← Rabbitty Pay
```

**El cuello de botella no es el hardware: es el adquirente.** Y eso se resuelve
con una conversación comercial, no comprando equipo.

---

## 4. Lo que hay que pedirle al proveedor (cuando exista PSP)

- Certificados **con el modelo visible** (PDF) para el expediente.
- Arte vectorial: confirmar **AI/CDR + Pantone** y área de impresión.
- Manual en español: costo y lead time por 100 pzas.
- Flete **DAP** a ciudad/CP de México y **DDP** para comparar.
- Términos de **TMS** por dispositivo (incluido, licencia o alojado).

---

## 5. Riesgo registrado

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Comprar hardware sin riel | 100 equipos que no cobran | regla: **sin PSP confirmado, no se compra** |
| Elegir mal el PSP | reescribir pagos | interfaz `PaymentProvider` (ver `RABBITTY-PAY-ESTRATEGIA.md`) |
| Puente nativo subestimado | 2–4 semanas por plataforma | presupuestarlo antes de prometer hardware propio |
| Depender de un solo adquirente | precio y SLA a su merced | evaluar al menos **dos** |

---

## 6. Pendiente inmediato

1. **Ciudad y código postal** para cotizar flete (si se piden muestras).
2. Confirmar si pedimos **1 muestra** para evaluar el SDK.
3. Arrancar la búsqueda de adquirente con el cuestionario
   `CUESTIONARIO-PSP-MEXICO.md`.
