# 14 · Informe de observaciones legales — 2026-11-19

> **Para qué sirve.** Prepara la conversación con el abogado: qué se corrigió ya,
> qué queda abierto y **qué preguntas requieren dictamen**. No es un dictamen ni
> una certificación de cumplimiento.
>
> **Texto canónico:** `packages/legal/src/documents.ts` (versión vigente
> `2026-11-19.1`, publicada en `rabbitty.me/legal` y `app.rabbitty.me/legal`).
> Los archivos `01-…`, `02-…`, `05-…` de esta carpeta son el borrador de trabajo y
> quedan subordinados al texto publicado.
>
> **Fuentes normativas revisadas:** LFPDPPP, LRITF (art. 22) y LFPC.

---

## 1. Lo aplicado en esta revisión (sin cambiar reglas económicas)

| # | Documento | Corrección aplicada |
|---|---|---|
| 1 | **Términos (afiliados)** | Nueva §1 con entidad, RFC, domicilio y contacto; jerarquía documental explícita; presunción de credenciales **admite prueba en contrario** con reporte y bitácora; §9 con **procedimiento** de suspensión/retención (causa, evidencia, plazo para subsanar, límite del monto, liberación, revisión); limitación de responsabilidad con **excepciones** (dolo, negligencia grave, confidencialidad, datos, fondos, derechos del consumidor); nueva §10 de terminación con efectos y supervivencia de obligaciones. |
| 2 | **Anexo de Pagos** | Nueva §5 **flujo del dinero**: quién recibe, quién es acreedor de cada importe, cuándo se considera pagado, cuándo nace la obligación de liquidar, propina fuera de la comisión; §6 retención **limitada, notificada y con plazo** de liberación; §7 IVA con emisor del CFDI identificado y eliminación de la frase abierta; §8 aviso de cambios con forma y fecha efectiva; §9 remite al anexo de contracargos **ya publicado**; nueva §10 pagos fallidos y devoluciones parciales. |
| 3 | **Anexo de Contracargos y Reembolsos** | **Publicado** (antes se citaba y no existía): definiciones, quién asume, plazos de evidencia, retención preventiva acotada, reembolsos totales y parciales, cancelaciones y reclamos. |
| 4 | **DPA** | **Publicado**: roles responsable/encargado, instrucciones, subencargados, seguridad, incidentes, derechos de titulares, devolución/supresión y auditoría. |
| 5 | **Aviso de Privacidad** | §1 **responsable y domicilio** (faltaban); §2 datos por categoría (incluye personal y seguridad); §3 finalidades primarias/secundarias con límites; §4 **encargados vs transferencias** y **transferencias internacionales**; §5 rol cuando el negocio es responsable; §6 conservación **por categoría**; §7 **procedimiento ARCO** con requisitos y plazos (20/15 días hábiles); §8 protocolo de incidentes. |
| 6 | **Reglamento Bunz** | Naturaleza reforzada (sin retiro, sin rendimiento, valor promocional); §3 **qué significa el respaldo** (obligación del afiliado y compensación de red, no reserva ni derecho de conversión); §4 vigencia con **procedimiento y derecho a evitar la cancelación**; §6 transferencias sin contraprestación ni intermediación; §7 **saldo negativo no es deuda en dinero**; §9 compensación entre afiliados. Los tres puntos de caducidad quedan marcados `[REVISAR-ABOGADO]`. |
| 7 | **Términos del Rabbitter** | §1 identifica entidad, domicilio y contacto; §2 separa responsabilidad de Rabbitty, del negocio y del proveedor de pagos; §5 **política mínima de membresías** (precio total, vigencia, beneficios, sucursales, cancelación, reembolso, cambio de precio, cierre del negocio); §6 propinas (voluntarias, modificables, sin comisión); §8 baja y Bunz coordinados con el Reglamento, con plazo para reclamar. |

**No se tocó** ninguna regla económica: comisión 3.8 %, base, topes de Bunz, pozo
del 10 %, caducidad de bóveda (3 meses) e inactividad (24 + 30 días) siguen igual.
Cambiarlas requiere decisión del negocio y, en dos casos, dictamen.

---

## 1 bis. Verificación de publicación (rev. 2 · `2026-11-19.2`)

La revisión anterior se hizo sobre una versión en caché. Comprobado en vivo el
2026-11-19 con `?t=<timestamp>`:

| URL | Prueba encontrada |
|---|---|
| `app.rabbitty.me/legal/privacidad` | "Responsable del tratamiento" + "MXHUB ECOSISTEMA BLOCKCHAIN" |
| `app.rabbitty.me/legal/payments` | "Flujo del dinero y obligación de liquidar" |
| `app.rabbitty.me/legal/terminos` | "Suspensión, retención y limitación" |
| `app.rabbitty.me/legal/rabbitter` | "política mínima común" |
| `app.rabbitty.me/legal/bunz` | nota `[REVISAR-ABOGADO]` |
| `rabbitty.me/legal` | misma fuente (`@rabbitty/legal`) |

La página pública y la app leen el **mismo** archivo, así que no puede haber
textos distintos entre superficies: sólo caché del revisor.

**Rev. 2 aplica además:** caducidad por inactividad **eliminada**; cierre de cuenta
**sin confiscación** (30 días para consultar, transferir o reclamar, con aviso al
inicio y al final); Bóveda Temporal mantenida de forma provisional con aviso al
emitir, recordatorio, prueba de titularidad y suspensión por error técnico; y dos
documentos nuevos publicados (**Membresías y Suscripciones**, **Propinas y
Distribución**).

---

## 2. Los tres dictámenes que no deberían esperar a 2027

### 2.1 Bunz — clasificación regulatoria (LRITF art. 22)

**Qué preguntar (revisado):** no basta con el artículo 22. El dictamen debe
cubrir:

1. ¿Rabbitty encaja en la **exclusión del artículo 24, fracción I** (programas de
   lealtad o recompensa)?
2. ¿Qué comercios cuentan como **sociedades afiliadas** para ese supuesto?
3. **¿Cómo se calcula el límite del 20 %** del total de establecimientos
   habilitados para recibir pagos con tarjeta, con datos reales de la red?
4. ¿Las **transferencias entre usuarios** afectan la clasificación o son
   compatibles con el programa?
5. ¿La **compensación entre comercios** crea una obligación distinta de la mera
   aceptación de puntos promocionales?

El art. 23 define los elementos de los fondos de pago electrónico y el 24 las
exclusiones; analizar el 22 aislado lleva a una conclusión incompleta.

**Hechos que el abogado debe ponderar:** fungibilidad entre comercios,
transferencias entre usuarios, respaldo por negocio emisor, compensación de red,
imposibilidad de retiro.

**Lo que ya hace el sistema y sostiene la tesis de puntos promocionales:**
no se compran con dinero, no hay retiro, no hay rendimiento, cada emisión queda en
el libro con negocio/orden/motivo, y el saldo negativo no es exigible en dinero.

**Decisión aplicada:** se **eliminó** la cancelación por inactividad y la
confiscación al cerrar cuenta. La caducidad de la Bóveda Temporal (3 meses) se
mantiene **provisional**, con aviso al emitir, recordatorio, prueba de titularidad
y suspensión por error técnico, a la espera del dictamen.

### 2.2 Pagos — quién es dueño de qué

**Qué preguntar:** si el modelo es *agente* (Rabbitty cobra por cuenta del
afiliado) o *mandato/tecnológico* (el proveedor de pagos cobra y Rabbitty sólo
concilia), y qué obligaciones adicionales implica cada uno.

**Lo que ya dice el Anexo:** el dinero lo recibe el proveedor de pagos; Rabbitty no
custodia fondos; la obligación de liquidar nace cuando el proveedor abona; el
acreedor del consumo es el afiliado y el de la comisión es Rabbitty; la retención
tiene causa, tope y plazo.

**Falta decidir:** contrato con cada adquirente/pasarela y quién responde ante el
emisor en un contracargo cuando el afiliado ya recibió su liquidación.

### 2.3 Datos personales — responsable vs encargado

**Qué preguntar:** en cada tratamiento (cuenta, lealtad, pedidos del POS, personal
del afiliado, analítica), quién decide finalidades y medios.

**Lo que ya dice el corpus:** Aviso integral con responsable identificado y DPA
publicado para los tratamientos por cuenta del afiliado.

**Falta:** revisar transferencias internacionales reales (infraestructura, correo,
pagos) y ajustar la lista de encargados a los contratos firmados.

---

## 3. Documentos que aún no existen (y no conviene meter como cláusulas sueltas)

| Prioridad | Documento | Por qué |
|---|---|---|
| Alta | **Política de membresías y suscripciones** | Hoy se remite a la política de cada negocio; los Términos ya exigen un mínimo, falta el documento propio. |
| Alta | **Política de propinas y distribución** | Obligación laboral/fiscal del afiliado y claridad para el consumidor. |
| Media | **Política de cancelaciones, devoluciones y reembolsos (consumidor)** | El anexo publicado cubre el lado del afiliado y contracargos; falta la cara del comensal. |
| Media | **SLA / soporte y continuidad** | Los Términos remiten a la propuesta comercial; conviene anexo por nivel. |
| Media | **Promociones, campañas y recompensas** | Reglas de campañas flash, cupones y topes. |
| Media | **Integraciones y delivery** | Responsabilidades con Uber Direct y agregadores. |
| Baja | **Multi-sucursal**, **prevención de fraude**, **conservación/bloqueo/eliminación** | Crecimiento y operación. |
| Pendiente | **Comodato + acta** | Ya escrito; se publica cuando haya hardware. |

---

## 4. Datos de la entidad a verificar antes de la versión definitiva

| Dato | Valor usado en los documentos | Verificar |
|---|---|---|
| Razón social | MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. | Confirmado por el negocio; falta cotejo con acta y que sea la sociedad que factura |
| RFC | MEB2402087Z3 | Confirmado por el negocio; falta constancia de situación fiscal |
| Domicilio | Lázaro Cárdenas 74, Col. Dorada, C.P. 63732, Bucerías, Nayarit | Confirmado por el negocio; falta comprobante a nombre de la sociedad |
| Representante | Marco Arturo Muñoz Del Toro (CEO) | Confirmado por el negocio; falta poder notarial en el expediente |
| Contacto contractual | hola@rabbitty.me | Que el buzón esté atendido |
| Contacto de privacidad | privacidad@rabbitty.me | Responsable interno designado |

**Riesgo si no coincide:** una cláusula con entidad equivocada puede volver
inoponible el contrato o, peor, obligar a quien no presta el servicio.

---

## 5. Fiscal (para el contador, no para el abogado)

1. **Comisión de plataforma:** hoy el Anexo dice “sin IVA, se factura conforme a
   la ley”. Falta definir tasa, emisor (MXHUB), CFDI (servicios) y si se cobra IVA
   sobre la comisión.
2. **Costos del riel:** ¿se facturan al afiliado o los cobra directamente el
   proveedor? Hoy se informan en la conciliación, no se facturan.
3. **Propinas:** tratamiento de IVA/ISR y quién las entera.
4. **Liquidaciones:** comprobante de la transferencia al afiliado y su
   conciliación contable.
5. **Bunz:** no son ingreso gravable por sí mismos; verificar el tratamiento del
   respaldo y de las reversiones.

---

## 6. Orden de trabajo sugerido con el despacho

1. **Sesión 1 (2 h):** entidad, partes, jerarquía documental y quién factura qué.
2. **Sesión 2 (2 h):** Bunz — clasificación LRITF con el funcionamiento real.
3. **Sesión 3 (2 h):** pagos, liquidaciones, retención y contracargos.
4. **Sesión 4 (2 h):** datos personales (aviso + DPA + transferencias).
5. **Sesión 5 (2 h):** consumo (Rabbitter, membresías, propinas, reembolsos).
6. **Entrega:** paquete consolidado + dictamen escrito de Bunz y de pagos.

**Lo que el despacho debe devolver por escrito:** (a) dictamen de clasificación de
Bunz; (b) quién es acreedor y custodio en cada flujo de pago; (c) validación del
aviso y del DPA; (d) cláusulas de consumo que no pueden usarse; (e) lista de
documentos faltantes con prioridad.

---

## 7. Cómo se publica una corrección (para no romper la evidencia)

1. Editar `packages/legal/src/documents.ts`.
2. Subir `LEGAL_VERSION` y actualizar `LEGAL_CONTENT_HASH` (una prueba de CI falla
   si el texto cambió sin subir versión).
3. Commit + deploy: la app, la landing y el panel leen la misma fuente.
4. El afiliado y el consumidor vuelven a aceptar la versión nueva; queda
   registrada con fecha, usuario, correo, IP y user-agent en
   `business_consents` (afiliado) y en el registro de consentimiento del
   consumidor.
5. La comisión **no puede activarse** si el negocio no aceptó la versión vigente
   del Anexo de Pagos (bloqueo en `god.setPlatformCommission`).
