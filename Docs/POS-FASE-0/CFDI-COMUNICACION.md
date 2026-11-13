# CFDI · Inventario de comunicación a corregir

**Estado:** inventario documentado — **sin cambios aplicados**
**Fecha:** 11 de noviembre de 2026
**Base:** [`ADR-021`](./ADR-021-cfdi.md)
**Requiere:** autorización independiente para cada corrección de contenido

---

## 1. Regla

> Mientras no exista timbrado real y validado, **Rabbitty no anuncia CFDI como funcionalidad disponible.**

Este documento **identifica y prepara** los cambios. No los ejecuta.

---

## 2. Menciones activas

| # | Ubicación | Qué dice hoy | Riesgo | Corrección propuesta |
|---|---|---|---|---|
| M-01 | `packages/api/src/routers/customer.ts:125-145` | Inserta factura y devuelve `https://rabbitty.mx/invoices/{id}.pdf` | **Alto** — el cliente recibe una URL que no existe | Responder `501 NOT_IMPLEMENTED` con mensaje claro, o retirar el endpoint del flujo hasta tener PAC |
| M-02 | `apps/admin/src/app/(dashboard)/invoices/page.tsx:40-42` | "Facturación CFDI · Historial de facturas emitidas y estatus CFDI" | Medio — sugiere emisión real | "Solicitudes de factura · registro interno (sin timbrado)" |
| M-03 | `apps/admin/src/app/(dashboard)/academy/page.tsx:313` | Menciona "estatus CFDI" en export contable | Bajo | Aclarar: campo informativo del registro interno, no fiscal |
| M-04 | `telegram-miniapp/src/lib/support-content.ts:132` | "Admin → Facturación" (configuración de pagos Bunz) | Bajo — ambigüedad | Renombrar a "Admin → Pagos con Bunz" |
| M-05 | `landing-page/src` | **Sin menciones de CFDI** (verificado) | — | Nada |
| M-06 | Guías de App Store (`APP_STORE_*.md`, raíz) | Pendiente de inventario final | Medio | Revisar antes de publicar ficha |
| M-07 | Material comercial / presentaciones | Fuera del repositorio | **Alto** | Revisión manual de dirección |
| M-08 | Bunzy (RAG / soporte) | No se detectó mención explícita de CFDI; sí de "Facturación" como módulo de pagos | Bajo | Confirmar en pruebas de conversación |

**Verificación de M-05:** búsqueda de `CFDI|facturación|factura` en `landing-page/src` → sin resultados.

---

## 3. Textos propuestos (para aprobar)

### M-01 · respuesta del endpoint

```
Esta función aún no está disponible. La facturación fiscal (CFDI) está en
evaluación y todavía no emite comprobantes válidos ante el SAT.
```

### M-02 · encabezado de la pantalla

```
Solicitudes de factura
Registro interno de solicitudes. Aún no se emiten comprobantes fiscales (CFDI).
```

### M-04 · etiqueta

```
Admin → Pagos con Bunz
```

---

## 4. Lo que NO debe decirse en ventas hasta nuevo aviso

- "Incluye facturación CFDI".
- "Timbramos tus facturas".
- "Cumple con el SAT".
- "Tu contador recibe el XML".

Se puede decir, con precisión:

> "Registramos las solicitudes de factura de tus clientes. La emisión fiscal está en evaluación."

---

## 5. Criterios de aceptación

- [ ] Inventario aprobado por dirección.
- [ ] Cada corrección autorizada individualmente.
- [ ] Cero menciones activas que prometan emisión fiscal.
- [ ] Material comercial alineado (fuera del repo).

## 6. Rollback

Al ser cambios de contenido, el rollback es revertir el texto. Se recomienda corregir **antes** de cualquier campaña.

---

## 7. Estado al 12-nov-2026

| # | Estado | Nota |
|---|---|---|
| M-01 | **Resuelto** | `customer.requestInvoice` va por el PAC; sin PAC conectado responde con error claro y no marca la orden como facturada. Se eliminó la URL falsa. |
| M-02 | **Resuelto** | Encabezado: "Se timbra con el PAC que conectes. Sin PAC configurado no se emite ningún comprobante", más banner con enlace a `/settings/billing` cuando no hay conexión. |
| M-03 | **Resuelto** | El CSV y la guía dicen "estatus de factura (registro interno; la emisión fiscal depende de tu PAC)". |
| M-04 | **Pendiente (otro repo)** | `telegram-miniapp/src/lib/support-content.ts` → "Admin → Pagos con Bunz". No está en este repositorio. |
| M-05 | **Sin acción** | El landing no menciona CFDI. |
| M-06 | **Verificado** | `APP_STORE_POS_SUBMISSION_GUIDE.md` y `APP_STORE_SUBMISSION_GUIDE.md` no mencionan CFDI. |
| M-07 | **Fuera del repo** | Material comercial: revisión manual de dirección. |
| M-08 | **Pendiente** | Confirmar en conversación con Bunzy que no prometa timbrado. |

También se renombraron rutas ambiguas que ahora chocaban con la pantalla de
facturación fiscal: "Admin → Facturación → Bunz" pasó a "Admin → Ajustes → Bunz"
y "Configuración → Facturación" (tipo de cambio USD) a "Configuración → Moneda".
