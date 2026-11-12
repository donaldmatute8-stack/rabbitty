# ADR-021 · CFDI: proveedor, integración y límites fiscales

**Estado:** aprobado para diseño — **sandbox únicamente**
**Fecha:** 11 de noviembre de 2026
**Decide:** D-11, D-12
**Relacionado:** [`CFDI-COMUNICACION.md`](./CFDI-COMUNICACION.md) · [`RIESGOS`](./RIESGOS.md) · [`ADR-019`](./ADR-019-saga-pagos.md)

---

## 1. Hallazgo

La facturación fiscal **no existe** en el producto. Lo que existe es un registro y una URL genérica.

| Hecho | Ubicación |
|---|---|
| Se inserta factura y se devuelve `https://rabbitty.mx/invoices/{id}.pdf` (inexistente) | `packages/api/src/routers/customer.ts:125-145` |
| El router de facturas solo lista, consulta, cancela y da stats: **no timbra** | `packages/api/src/routers/invoices.ts` |
| Sin PAC, sin XML, sin sello, sin UUID fiscal | ausencia verificada por búsqueda |
| La UI anuncia "Facturación CFDI · facturas emitidas" | `apps/admin/src/app/(dashboard)/invoices/page.tsx:40-42` |

**Riesgo:** un Rabbitter puede recibir una URL que no existe. Ver [`CFDI-COMUNICACION.md`](./CFDI-COMUNICACION.md) y R-03.

## 2. Decisión

1. `PacProvider` como **abstracción** obligatoria.
2. **Facturama** se evalúa en **sandbox**. Sin contratación, sin timbrado productivo.
3. Ninguna regla fiscal se codifica como verdad mientras no exista dictamen.

## 3. Comparativa de PAC (a verificar antes de contratar)

| PAC | Modelo | Ventaja | Desventaja | Costo |
|---|---|---|---|---|
| **Facturama** | REST/JSON + sandbox | Curva corta, sandbox real, docs claras | Menos barato a volumen alto | Mensualidad baja + costo por timbre |
| **SW Sapien** | REST/SOAP | Maduro, multi-ambiente | Integración verbosa | Por volumen |
| **Finkok** | SOAP/XML | Muy económico a volumen | SOAP, menos ergonómico | Por timbre |
| **Solución Factible** | REST | Simple, soporte local | Ecosistema menor | Cotización |

> Los rangos de precio deben confirmarse por escrito con cada proveedor. No se asumen aquí.

## 4. Arquitectura propuesta

```ts
// packages/api/src/services/cfdi/PacProvider.ts
interface PacProvider {
  readonly name: string;
  stamp(input: StampInput): Promise<StampResult>;    // idempotente por requestKey
  cancel(input: CancelInput): Promise<CancelResult>;
  status(uuid: string): Promise<StatusResult>;
}

// Implementaciones: FacturamaSandbox (0B), FacturamaProd / Finkok (posterior)
```

```sql
CREATE TABLE cfdi_documents (
  id text PRIMARY KEY,
  "orderId" text NOT NULL,
  "billingProfileId" text,
  rfc text NOT NULL,
  "legalName" text NOT NULL,
  "taxRegime" text,
  "cfdiUse" text,
  "zipCode" text,
  "billableSubtotal" numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  status text NOT NULL,          -- PENDING | STAMPED | CANCELLED | FAILED
  "pacProvider" text,
  uuid text,                     -- UUID fiscal
  xml text,                      -- retención 5 años
  "pdfUrl" text,
  "pacRequest" jsonb,
  "pacResponse" jsonb,
  "cancelReason" text,
  "cancelledAt" timestamp,
  "replacedByUuid" text,         -- relación 04 (sustitución)
  "idempotencyKey" text UNIQUE,  -- order:{id}:{hash(rfc+total)}
  "createdAt" timestamp DEFAULT now()
);
```

## 5. Reglas que **no** se fijan en este ADR

Se retiran del diseño anterior y pasan a `BillingPolicy` **configurable**, pendiente de dictamen fiscal:

- ❌ "Prohibido facturar una orden pagada 100 % con Bunz".
- ❌ "Importe facturable = total − bunzPaid".

El sistema solo debe poder aplicar **cualquiera** de esas políticas sin reescribir código, cuando exista decisión fiscal.

## 6. Checklist de verificación (bloqueante antes de producción)

| Punto | Por qué |
|---|---|
| CFDI 4.0 + complementos requeridos | Régimen, uso, forma de pago |
| Cancelación con aceptación del receptor | Regla SAT vigente |
| Sustitución (relación 04) | Refacturaciones |
| Retención y recuperación de XML | Obligación legal (5 años) |
| Manejo de errores y conciliación | Facturas "timbradas" sin XML guardado |
| Costo real por volumen | Define viabilidad económica |
| Tratamiento fiscal de pagos mixtos fiat/Bunz | **Requiere dictamen externo** |

## 7. Plan de pruebas (sandbox)

1. Emisión válida → UUID + XML + PDF.
2. Doble request con misma clave → **no** duplica UUID.
3. Cancelación dentro de 24 h.
4. Cancelación después de 72 h con aceptación.
5. Cancelación rechazada por el receptor.
6. Pago mixto fiat/Bunz → verifica que la política configurable se aplica sin tocar código.
7. PAC caído → documento queda `PENDING`, no se pierde.
8. Orden ya facturada → rechazo idempotente.

## 8. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-03 | URL de factura inexistente entregada al cliente | Ver [`CFDI-COMUNICACION.md`](./CFDI-COMUNICACION.md) |
| R-11 | Fiscalidad de Bunz mal asumida | D-12: dictamen externo |
| — | PAC sin XML almacenado | Prueba 7 + conciliación diaria |
| — | Timbrado productivo accidental | Sandbox con credenciales separadas y flag |

## 9. Criterios de aceptación

- [ ] `PacProvider` definido con 3 implementaciones planificadas.
- [ ] Facturama sandbox probado con los 8 casos.
- [ ] Cero reglas fiscales fijas en código.
- [ ] Ninguna contratación ni activación productiva.

## 10. Rollback

Integración en sandbox detrás de flag. Apagada = comportamiento actual (registro sin timbrado), con la comunicación corregida para no prometer.

## 11. Evidencia

- `packages/api/src/routers/customer.ts:125-145`
- `packages/api/src/routers/invoices.ts` (`list`, `getByOrder`, `cancel`, `stats`)
- `apps/admin/src/app/(dashboard)/invoices/page.tsx:40-42`
