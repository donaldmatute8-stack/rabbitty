# 02 · Anexo de Pagos — Rabbitty Pay, Stripe y comisiones

**Versión:** 2026-11-18 · **Anexo inseparable** de los Términos (documento 01)

---

## 1. Quién cobra y en qué cuenta

1.1 El cobro con tarjeta se procesa con **Stripe** (y, si el Afiliado lo activa,
Mercado Pago) bajo sus propios términos. Rabbitty **no** es adquiriente ni
institución financiera.

1.2 En el modelo vigente (*destination charge*), el cargo se crea en la cuenta
de Rabbitty y el neto se transfiere a la cuenta conectada del Afiliado, menos la
comisión de plataforma.

1.3 El Afiliado debe completar la verificación (KYC) del proveedor de pagos. Sin
verificación **no hay liquidación**, aunque el cobro se haya autorizado.

`[REVISAR]` Si Rabbitty concentra el dinero, definir con contador cómo se
declara (comisión vs mandato) y el IVA de la comisión.

---

## 2. Comisiones vigentes

La comisión aplicable es la que muestre el panel al momento del alta. Como
referencia del sistema:

| Concepto | Valor vigente | Se descuenta de |
|---|---|---|
| **Comisión de plataforma** | **1.0 %** del monto cobrado | el neto al Afiliado |
| **Comisión del procesador** (Stripe/Mercado Pago) | según tarifa del proveedor | el neto al Afiliado |
| **Cuota de equipo** (lector/impresora, si aplica) | según acta | liquidación o cargo aparte |
| **Cargo por contracargo** | según documento 04 | liquidación |

2.1 Las comisiones se expresan **sin IVA**; el IVA se suma conforme a la ley.

2.2 Rabbitty puede ajustar comisiones con **30 días** de aviso (documento 01 §5).

---

## 3. Liquidaciones

3.1 El proveedor de pagos transfiere al Afiliado conforme a su calendario (típico
en México: **T+2 a T+7** hábiles). Rabbitty no controla ese plazo.

3.2 Rabbitty puede **retener** de una liquidación: contracargos en proceso, montos
en conciliación y adeudos de equipo. La retención se libera o aplica una vez
resuelto el asunto.

3.3 Los montos en conciliación (cobros que el sistema no pudo atribuir) se
resuelven en el panel **Conciliaciones** con dos pasos: el negocio decide y
Rabbitty autoriza la entrega.

---

## 4. Propinas

4.1 La propina es **voluntaria** y se captura como parte del ticket o en el
lector, según configure el Afiliado.

4.2 La propina se liquida **junto con el pago** y se identifica por separado en el
corte. Su reparto al personal es responsabilidad del Afiliado (documento 08 §1).

4.3 En reembolsos, la propina se devuelve **solo si el Afiliado lo autoriza** de
forma expresa.

---

## 5. Bunz y pagos mixtos

5.1 Los Bunz **no** son dinero y **no** se liquidan en efectivo. Se rigen por el
Reglamento Bunz (documento 07).

5.2 En un pago mixto (Bunz + tarjeta/efectivo), la parte fiat se cobra por el
proveedor y la parte Bunz se descuenta del libro interno. Ambas quedan en el
mismo ticket y con el mismo folio.

5.3 La emisión de Bunz por una compra **no** altera la comisión de plataforma,
que se calcula sobre el monto fiat efectivamente cobrado.

---

## 6. Reembolsos

6.1 Todo reembolso se hace **contra la transacción original** y por el mismo
medio (documento 04).

6.2 Rabbitty no reembolsa comisiones ya devengadas al procesador, salvo que el
proveedor las devuelva.

---

## 7. Impuestos

7.1 El Afiliado es el único responsable de los impuestos de su operación y de
emitir el CFDI correspondiente con su PAC.

7.2 Rabbitty emite el comprobante de **su comisión**, no del consumo.

7.3 `[REVISAR]` Confirmar tratamiento de IVA por comisión y retenciones aplicables.

---

## 8. Hardware

8.1 El equipo es propiedad de Rabbitty y se entrega en comodato (documento 03).

8.2 La cuota de equipo no otorga propiedad ni derecho de retención.

8.3 El costo de reposición por daño, pérdida o robo se rige por la tabla del
documento 03 §6.

---

## 9. Aceptación

El Afiliado acepta este Anexo en el mismo acto que los Términos. El sistema
registra versión, fecha, correo e IP. Cambios de comisión se avisan por panel y
correo con 30 días.
