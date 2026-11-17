# 08 · Anexos operativos (propinas, offline, soporte, baja)

**Versión:** 2026-11-18 · Anexo de los Términos (documento 01)

---

## 1. Propinas

1.1 La propina es **voluntaria**. El sistema sugiere porcentajes del catálogo
(5/10/15 u otros publicados por el negocio); el cajero no puede capturar montos
arbitrarios ni aplicar propina en un canal distinto al configurado.

1.2 La propina se identifica por separado en el pago y en el corte de caja.

1.3 El **reparto** al personal es responsabilidad del Afiliado conforme a su
política interna y a la ley laboral. Rabbitty no decide el reparto.

1.4 En reembolsos, la propina se devuelve solo con autorización expresa.

1.5 Para el comensal, la propina se explica antes de pagar y se refleja en el
ticket.

---

## 2. Continuidad y operación sin conexión

2.1 **Cobro con tarjeta:** requiere conexión. No se autoriza tarjeta sin red.

2.2 **Cobro en efectivo:** puede operar sin red mediante la cola local del POS.
Reglas:

- Solo efectivo.
- Cada cobro lleva una **llave de idempotencia** para que un reintento no
  duplique el cargo.
- Al volver la red, los cobros se envían en orden. Lo que el sistema no pueda
  aplicar solo cae en **Conciliaciones** para revisión humana.
- Mientras un cobro offline no esté conciliado, **no** se acreditan Bunz por esa
  compra.

2.3 **Pantalla de cocina (KDS):** sin red muestra la última cola conocida; los
cambios de estado se encolan y se aplican al reconectar.

2.4 Rabbitty no responde por ventas no realizadas por caída de la red del local,
energía o del proveedor de internet.

---

## 3. Soporte y hardware (SLA operativo)

| Nivel | Qué cubre | Canal | Tiempo objetivo |
|---|---|---|---|
| **1. Autoservicio** | dudas de uso, guías | Ayuda / Bunzy / Manual de Operaciones | inmediato |
| **2. Soporte Rabbitty** | fallas del sistema, cobros, conciliación | panel / correo de soporte | **8 h hábiles** |
| **3. Hardware** | lector o impresora sin funcionar | soporte con folio del acta | **48 h** para diagnóstico |
| **4. Reemplazo** | equipo irreparable por falla de fábrica | soporte | **5 días hábiles** (sujeto a disponibilidad) |

3.1 El soporte de hardware **no** cubre daño por líquidos, golpes, robo ni mal
uso (documento 03 §6).

3.2 Mientras el hardware no opere, el Afiliado puede seguir cobrando en efectivo
(§2.2) sin penalización.

3.3 `[REVISAR]` Si el Afiliado paga cuota de equipo, definir si el tiempo sin
servicio genera crédito proporcional.

---

## 4. Baja y devolución

4.1 **Baja voluntaria:** aviso por el panel o correo con **15 días** de
anticipación.

4.2 **Requisitos para cerrar:** adeudos liquidados, contracargos resueltos,
equipos devueltos y datos de acceso revocados.

4.3 **Devolución de equipos:** en **10 días naturales**, conforme al acta.

4.4 **Datos:** se conservan los plazos legales (documento 05 §5) y se eliminan
los demás.

4.5 **Bunz emitidos:** siguen siendo válidos para los comensales en el resto del
ecosistema (Reglamento Bunz §9). El Afiliado debe liquidar sus compromisos de
emisión pendientes.

4.6 **Baja por incumplimiento:** puede ser inmediata, con suspensión de cobro y
retención de liquidaciones para cubrir contracargos o daños.

---

## 5. Seguridad de la información

5.1 El Afiliado debe: revocar terminales perdidas, no compartir PIN, cambiar
contraseñas ante cualquier sospecha y reportar incidentes en **24 h**.

5.2 Rabbitty puede suspender accesos comprometidos sin previo aviso cuando exista
riesgo inminente.

5.3 Los datos de tarjeta **nunca** pasan por la plataforma; si alguien solicita
“el número completo de la tarjeta” en nombre de Rabbitty, es fraude: repórtalo.

---

## 6. Comunicaciones

6.1 **Transaccionales** (ticket, cobro, conciliación, seguridad): se envían
siempre que la cuenta esté activa, sin necesidad de consentimiento de marketing.

6.2 **Promocionales:** requieren consentimiento y se pueden desactivar en
Ajustes.

6.3 Las comunicaciones oficiales se envían desde el dominio `rabbitty.me`.

---

## 7. Registro y auditoría

7.1 Toda operación sensible (cobro, reembolso, cambio de precio, baja de
empleado) queda en bitácora con usuario, fecha y detalle.

7.2 El Afiliado puede solicitar su expediente de operación por periodo.

7.3 Los comprobantes digitales se conservan conforme a la normativa aplicable
`[REVISAR: NOM-151 / conservación de mensajes de datos]`.
