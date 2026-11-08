# Memorándum fiscal — borrador por flujo

> **Borrador para validación del contador/fiscalista.** No es un dictamen ni una
> opinión fiscal. Las propuestas son puntos de partida para discusión, no
> conclusiones aplicables.

**Entidad:** MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V.
**RFC:** MEB2402087Z3
**Marca:** RABBITTY · **Nombre comercial:** AGOD ECOSYSTEM
**Corte:** 8 de noviembre de 2026
**Régimen:** S.A. de C.V. (confirmar régimen fiscal y obligaciones en CSF)

---

## 1. Objetivo

Definir, por cada flujo, la naturaleza fiscal, el momento de reconocimiento, el
tratamiento de ISR/IVA, la documentación (CFDI) y el asiento contable, antes de
escalar la operación o activar capacidad real.

---

## 2. Flujos a dictaminar

### F1 · Incentivo de incorporación (promocional)

| Campo | Detalle |
|---|---|
| Hecho | RABBITTY asigna Bunz promocionales al afiliado al incorporarse |
| Pregunta | ¿Es gasto de marketing, bonificación, descuento, derecho condicionado o ingreso? |
| Propuesta | Tratarlo como **gasto de marketing/promoción condicionado**, no como ingreso del afiliado; reconocer al cumplir condiciones y documentar la baja si no se cumple |
| ISR | Deducible si cumple requisitos de gasto estrictamente indispensable; validar |
| IVA | No debería generar IVA por sí solo si no hay contraprestación; validar |
| CFDI | No emitir al afiliado por el incentivo; documentar internamente |
| Asiento | Gasto promocional / provisión de incentivo |
| Riesgo | Que se interprete como ingreso o como descuento no aplicado |

### F2 · Capacidad adelantada

| Campo | Detalle |
|---|---|
| Hecho | RABBITTY autoriza capacidad comercial recuperable al afiliado |
| Pregunta | ¿Es financiamiento, anticipo, prestación condicionada, derecho contractual u otra figura? ¿Se reconoce pasivo? |
| Propuesta | Tratarla como **derecho contractual condicionado, no como préstamo en efectivo**, mientras no haya entrega de dinero; reconocer obligación/compromiso en cuentas de orden y conciliar |
| ISR | No debería ser ingreso al otorgarse; validar si genera interés presunto |
| IVA | No debería causar IVA al otorgarse; validar si la recuperación se considera contraprestación |
| CFDI | No emitir por la autorización; documentar en contrato y anexo |
| Asiento | Cuenta de orden / obligación condicionada |
| Riesgo | Recalificación como financiamiento regulado o ingreso |

### F3 · Recuperación de capacidad

| Campo | Detalle |
|---|---|
| Hecho | Se retiene parte de la capacidad futura generada para recuperar el adelanto |
| Pregunta | ¿Qué hecho extingue la obligación? ¿Es reducción de pasivo, ingreso o descuento? |
| Propuesta | Tratarla como **reducción de la obligación condicionada**, no como ingreso nuevo; documentar cada aceptación y aplicar contra la cuenta correspondiente |
| ISR | No generar ingreso por la recuperación; validar efecto en utilidad |
| IVA | No causar IVA por la recuperación si no hay contraprestación dineraria; validar |
| CFDI | No emitir CFDI por la recuperación; el estado de cuenta es evidencia |
| Asiento | Obligación condicionada / capacidad recuperada |
| Riesgo | Doble conteo o reconocimiento anticipado |

### F4 · Redención de Bunz

| Campo | Detalle |
|---|---|
| Hecho | El afiliado entrega producto/servicio a cambio de Bunz |
| Pregunta | ¿Es descuento, recompensa, bonificación o contraprestación? ¿IVA sobre qué base? |
| Propuesta | Tratarlo como **descuento comercial** aplicado al precio, con documentación del programa y límites; el afiliado factura el neto cobrado, validando requisitos de descuento |
| ISR | El ingreso del afiliado es el neto efectivamente cobrado; validar |
| IVA | Aplicar al valor de la contraprestación efectiva; validar tratamiento de descuentos |
| CFDI | El afiliado emite CFDI por el monto cobrado; documentar Bunz aplicados |
| Asiento | Ventas netas / descuento |
| Riesgo | Recalificación como ingreso por recompensa o como operación con tercero |

### F5 · Comisión fiat (Rabbitty Pay / Stripe)

| Campo | Detalle |
|---|---|
| Hecho | RABBITTY cobra comisión por procesamiento o intermediación |
| Pregunta | ¿Es servicio, comisión, intermediación o margen? ¿CFDI? |
| Propuesta | Tratarlo como **servicio de plataforma** con CFDI por la comisión; separar de los fondos del afiliado |
| ISR | Ingreso acumulable al devengarse |
| IVA | Gravar la comisión conforme al servicio |
| CFDI | Emitir CFDI de servicios; retenciones según aplique |
| Asiento | Ingreso por servicios / IVA trasladado |
| Riesgo | Confusión entre fondos de terceros e ingresos propios |

### F6 · Cuotas de entrega (Uber Direct / delivery)

| Campo | Detalle |
|---|---|
| Hecho | Se cobra o absorbe el costo de entrega |
| Pregunta | ¿Es reembolso, servicio o gasto? ¿Quién factura? |
| Propuesta | Si se cobra al cliente, tratar como **servicio/reembolso** según contrato; si lo absorbe el afiliado, gasto deducible |
| ISR | Deducible si es indispensable; validar |
| IVA | Gravar si es servicio; reembolso con comprobante |
| CFDI | CFDI del proveedor de entrega y del afiliado al cliente cuando aplique |
| Asiento | Gasto o ingreso por entrega |
| Riesgo | No trasladar el CFDI o duplicar ingresos |

### F7 · Propinas

| Campo | Detalle |
|---|---|
| Hecho | Propinas voluntarias en POS o digitales |
| Pregunta | ¿Forman parte del precio? ¿IVA? ¿ISR del personal? |
| Propuesta | Mantenerlas separadas del precio; documentar su naturaleza voluntaria y el destino |
| ISR | Tratamiento del personal según relación laboral; validar |
| IVA | No deberían gravarse si son voluntarias y no forman parte del precio; validar |
| CFDI | No incluir en el CFDI del servicio salvo que la ley lo exija |
| Asiento | Cuenta puente de propinas |
| Riesgo | Recalificación como parte del precio |

### F8 · Devoluciones y reversos

| Campo | Detalle |
|---|---|
| Hecho | Se cancela o revierte una operación |
| Pregunta | ¿Nota de crédito? ¿Ajuste de IVA/ISR? ¿Reverso de Bunz? |
| Propuesta | Emitir **nota de crédito** cuando corresponda y revertir Bunz en el mismo periodo; conservar evidencia |
| ISR | Ajustar ingreso en el periodo; validar |
| IVA | Ajustar IVA trasladado con nota de crédito |
| CFDI | Nota de crédito relacionada |
| Asiento | Reverso de venta / IVA |
| Riesgo | Diferencias entre reverso de Bunz y CFDI |

### F9 · Saldo no recuperado (incobrable)

| Campo | Detalle |
|---|---|
| Hecho | La capacidad adelantada no se recupera |
| Pregunta | ¿Deterioro, castigo, pérdida? ¿Requisitos fiscales? |
| Propuesta | Evaluar **deterioro** y castigo con expediente; no cancelar sin evidencia |
| ISR | Deducible solo si cumple requisitos; validar |
| IVA | No aplica IVA en el castigo |
| CFDI | No aplica; documentar gestión de cobro |
| Asiento | Estimación / castigo |
| Riesgo | No poder deducir por falta de evidencia |

### F10 · Sandbox (Ka13, Bull Box)

| Campo | Detalle |
|---|---|
| Hecho | Operaciones de prueba sin efectos reales |
| Pregunta | ¿Cómo se separa de la operación real? ¿Se factura? |
| Propuesta | **No facturar**, no generar obligaciones, marcar `sandbox`, excluir de métricas y estados financieros |
| ISR/IVA | Sin efecto |
| CFDI | No emitir |
| Asiento | Fuera de libros reales o cuenta de control |
| Riesgo | Mezclar datos y emitir CFDI por prueba |

### F11 · Membresías y suscripciones

| Campo | Detalle |
|---|---|
| Hecho | Cobro recurrente por planes |
| Pregunta | ¿Servicio continuo? ¿IVA? ¿Cancelaciones? |
| Propuesta | Ingreso por servicio conforme al periodo; CFDI por cada cobro |
| ISR | Acumulable conforme se devenga |
| IVA | Gravar el servicio |
| CFDI | CFDI por suscripción y notas por cancelación |
| Asiento | Ingreso diferido / devengado |
| Riesgo | Reconocer todo el ingreso al cobrar |

---

## 3. Información que debe entregar RABBITTY al fiscalista

- Contrato marco, anexos y aviso de privacidad.
- Corte de ledger Bunz (emisión, redención, reversos, saldos).
- Corte de capacidad (autorizado, provisionado, recuperado, pendiente).
- Conciliación fiat/Bunz.
- Facturas/CFDI emitidos y recibidos.
- Política de incentivos, recuperación y devoluciones.
- Evidencia de aceptación y estados de cuenta.
- Separación de sandbox.

---

## 4. Entregable esperado del especialista

1. Naturaleza fiscal de cada flujo.
2. Momento de reconocimiento.
3. ISR e IVA.
4. CFDI y complementos.
5. Asientos contables.
6. Tratamiento de devoluciones, incobrables y sandbox.
7. Riesgos y recomendaciones.
8. Requisitos de documentación y conservación.

---

## 5. Reglas operativas mientras no haya dictamen

- No activar capacidad adelantada nueva (`MCCE` en `shadow`).
- No reconocer ingresos por recuperación.
- No facturar incentivos ni capacidad.
- No facturar sandbox.
- Mantener separados los fondos de terceros.
- Documentar cada decisión y conservar evidencia.

---

## 6. Preguntas abiertas

1. ¿El incentivo es gasto deducible desde su otorgamiento o al cumplirse condiciones?
2. ¿La capacidad adelantada requiere reconocimiento de pasivo o cuenta de orden?
3. ¿La recuperación extingue obligación o genera ingreso?
4. ¿La redención de Bunz es descuento o contraprestación?
5. ¿Qué CFDI corresponde a cada flujo y con qué complementos?
6. ¿Cómo se tratan devoluciones y reversos en el mismo periodo?
7. ¿Qué requisitos se necesitan para castigar un incobrable?
8. ¿Cómo se separa contablemente el sandbox?
