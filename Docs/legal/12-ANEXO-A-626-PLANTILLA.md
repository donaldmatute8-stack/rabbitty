# Anexo A · Oferta económica individual — 626 Café (post-reset)

> **Plantilla.** Se llena después del re-onboarding y con la nueva oferta calculada
> sin el piso distorsionador. No es una opinión legal ni económica.

**Afiliado:** 626 Café (razón social pendiente de documento)
**RFC:** `[PENDIENTE]`
**Representante:** Alfonso Herrera Ruiz (confirmar identidad y facultades)
**Domicilio:** Lázaro Cárdenas 74, Las Palmas, Bucerías, Nayarit (confirmar)
**Anexo A versión:** `[v1.0]`
**Fecha:** `[DD/MM/AAAA]`
**Estado:** `[BORRADOR / ACEPTADO]`

---

## 1. Punto de partida después del reset

| Concepto | Valor |
|---|---:|
| Saldo Bunz del negocio | 0 |
| Capacidad total | 0 |
| Capacidad adelantada | 0 |
| Obligación pendiente | 0 |
| Recuperación acumulada | 0 |
| Estado del piloto | Activo (emisión/redención con topes) |
| MCCE | `shadow` |
| Recuperación | `proposal` |

**Regla:** la oferta anterior de 3,500 Bunz quedó sin efecto. No se arrastra.

---

## 2. Nueva oferta propuesta

| Concepto | Valor |
|---|---:|
| Capacidad promocional | `[ ]` |
| Capacidad adelantada | `[ ]` |
| Capacidad total autorizada | `[ ]` |
| Capacidad inicialmente provisionada | `[ ]` |
| Capacidad comprometida al inicio | `[ ]` |
| Capacidad disponible al inicio | `[ ]` |
| Cobertura | `[ ]` días |
| Revisión | `[ ]` |
| Tasa de recuperación | Dinámica 20%–60% |
| Horizonte | `[ ]` meses |
| Cobertura mínima | `[ ]` días |

### Fórmula dinámica

```
requiredMonthly = outstanding / targetMonths
baseRate        = requiredMonthly / max(expectedMonthlyGenerated, 1)
coverageFactor  = clamp(coverageDays / minCoverageDays, 0.5, 1.5)
progressFactor  = clamp(1 + (repaidRatio − 0.5) × 0.4, 0.8, 1.2)
rate            = clamp(round5(baseRate × coverageFactor × progressFactor), rateMin, rateMax)
proposedAmount  = min(grossGenerated × rate, outstanding, available)
```

**Regla:** la propuesta se presenta por ciclo con importe exacto y requiere
aceptación. Sin aceptación no se retiene nada.

---

## 3. Condiciones del incentivo

- Inicio: `[ ]`
- Ventana: `[ ]`
- Criterios de conservación: `[ ]`
- Reducción/retiro: `[ ]`
- Subsanación: `[ ]`
- Vencimiento: `[ ]`
- No transferible, no convertible a efectivo.

---

## 4. Condiciones de la capacidad adelantada

- Importe autorizado: `[ ]`
- Importe provisionado: `[ ]`
- Obligación inicial: `[ ]`
- Fuente de recuperación: capacidad generada
- Fórmula y límites: ver sección 2
- Devoluciones/reversos: `[ ]`
- Cobertura mínima: `[ ]`
- Suspensión/revisión/cierre: `[ ]`
- Mecanismo de aceptación: modal con importe exacto + nombre + checkbox

---

## 5. Evidencia de aceptación

| Campo | Valor |
|---|---|
| Nombre completo | `[ ]` |
| Carácter | `[ ]` |
| Fecha y hora | `[ ]` |
| Método | Nombre + checkbox |
| Versión | `[ ]` |
| Hash del texto | `[ ]` |
| Hash del anexo | `[ ]` |
| IP / UA | `[ ]` |
| Copia entregada | `[ ]` |
| Confirmación RABBITTY | `[ ]` |

---

## 6. Declaraciones del afiliado

- [ ] Conozco el programa y sus límites.
- [ ] Entiendo que Bunz no son dinero ni convertibles a efectivo.
- [ ] Entiendo que la capacidad es condicionada y recuperable.
- [ ] Entiendo que la recuperación requiere aceptación por ciclo.
- [ ] Entiendo que el rechazo no genera deuda fiat ni intereses.
- [ ] Recibí copia del contrato y anexos.

---

## 7. Aprobaciones

| Rol | Nombre | Fecha | Firma/acción |
|---|---|---|---|
| Afiliado | `[ ]` | `[ ]` | `[ ]` |
| RABBITTY (legal) | `[ ]` | `[ ]` | `[ ]` |
| RABBITTY (económico) | `[ ]` | `[ ]` | `[ ]` |

---

## 8. Notas

- No activar capacidad real hasta que el contrato esté aprobado y el anexo
  aceptado con evidencia.
- No usar el piso de 1,000 que distorsionaba el cálculo anterior.
- Si el afiliado rechaza la oferta, se mantiene en 0 y se puede reproponer.
