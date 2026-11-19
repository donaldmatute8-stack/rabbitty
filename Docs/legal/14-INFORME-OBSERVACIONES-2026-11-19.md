# 14 · Informe de observaciones legales — 2026-11-19

> **Para qué sirve.** Prepara la conversación con el abogado: qué se corrigió ya,
> qué queda abierto y **qué preguntas requieren dictamen**. No es un dictamen ni
> una certificación de cumplimiento.
>
> **Texto canónico:** `packages/legal/src/documents.ts` (versión vigente
> **`2026-11-19.2`**, hash `b0575a3677188a60`, publicada en `rabbitty.me/legal` y
> `app.rabbitty.me/legal`). La versión **`.1` queda derogada** y no debe citarse.
> Los archivos `01-…`, `02-…`, `05-…` de esta carpeta son el borrador de trabajo y
> quedan subordinados al texto publicado.
>
> **Fuentes normativas revisadas:** LFPDPPP (reforma del 14-nov-2025), **LRITF
> arts. 22, 23 y 24, fracción I** (y el límite del 20 % de establecimientos) y
> **LFPC art. 76 Bis, fracciones VIII y IX** (vigentes desde el 13-dic-2025).

---

## 1. Lo aplicado en esta revisión (sin cambiar reglas económicas)

| # | Documento | Corrección aplicada |
|---|---|---|
| 1 | **Términos (afiliados)** | Nueva §1 con entidad, RFC, domicilio y contacto; jerarquía documental explícita; presunción de credenciales **admite prueba en contrario** con reporte y bitácora; §9 con **procedimiento** de suspensión/retención (causa, evidencia, plazo para subsanar, límite del monto, liberación, revisión); limitación de responsabilidad con **excepciones** (dolo, negligencia grave, confidencialidad, datos, fondos, derechos del consumidor); nueva §10 de terminación con efectos y supervivencia de obligaciones. |
| 2 | **Anexo de Pagos** | Nueva §5 **flujo del dinero**: quién recibe, quién es acreedor de cada importe, cuándo se considera pagado, cuándo nace la obligación de liquidar, propina fuera de la comisión; §6 retención **limitada, notificada y con plazo** de liberación; §7 IVA con emisor del CFDI identificado y eliminación de la frase abierta; §8 aviso de cambios con forma y fecha efectiva; §9 remite al anexo de contracargos **ya publicado**; nueva §10 pagos fallidos y devoluciones parciales. |
| 3 | **Anexo de Contracargos y Reembolsos** | **Publicado** (antes se citaba y no existía): definiciones, quién asume, plazos de evidencia, retención preventiva acotada, reembolsos totales y parciales, cancelaciones y reclamos. |
| 4 | **DPA** | **Publicado**: roles responsable/encargado, instrucciones, subencargados, seguridad, incidentes, derechos de titulares, devolución/supresión y auditoría. |
| 5 | **Aviso de Privacidad** | §1 **responsable y domicilio** (faltaban); §2 datos por categoría (incluye personal y seguridad); §3 finalidades primarias/secundarias con límites; §4 **encargados vs transferencias** y **transferencias internacionales**; §5 rol cuando el negocio es responsable; §6 conservación **por categoría**; §7 **procedimiento ARCO** con requisitos y plazos (20/15 días hábiles); §8 protocolo de incidentes. |
| 6 | **Reglamento Bunz** | Naturaleza reforzada (sin retiro, sin rendimiento, valor promocional); §3 **qué significa el respaldo** (obligación del afiliado y compensación de red, no reserva ni derecho de conversión); §4 vigencia **sin cancelación por inactividad** y Bóveda Temporal con garantías; §6 transferencias sin contraprestación ni intermediación; §7 **saldo negativo no es deuda en dinero**; §9 compensación entre afiliados. Queda **una sola** nota `[REVISAR-ABOGADO]` (Bóveda Temporal) más la de clasificación regulatoria. |
| 7 | **Términos del Rabbitter** | §1 identifica entidad, domicilio y contacto; §2 separa responsabilidad de Rabbitty, del negocio y del proveedor de pagos; §5 **política mínima de membresías** (precio total, vigencia, beneficios, sucursales, cancelación, reembolso, cambio de precio, cierre del negocio); §6 propinas (voluntarias, modificables, sin comisión); §8 baja y Bunz coordinados con el Reglamento, con plazo para reclamar. |

**Reglas económicas congeladas:** comisión 3.8 %, su base (total − Bunz), topes de
Bunz, pozo del 10 % y caducidad de la Bóveda Temporal (3 meses, provisional) **se
mantienen sin cambio**.

**Sí se corrigieron dos caducidades, por riesgo jurídico y no por economía:**

| Regla anterior | Estado en `.2` |
|---|---|
| Cancelación del saldo por inactividad (24 meses + 30 días) | **Eliminada.** La inactividad sólo limita funciones (transferencias/canje) por seguridad, con aviso; **el saldo se conserva** y se reactiva al iniciar sesión. |
| Pérdida del saldo 30 días después de cerrar la cuenta | **Eliminada como confiscación.** Hay 30 días para consultar, transferir o reclamar, con aviso al inicio y al final; si no se reclama, se cancela el beneficio promocional **sin convertirlo en dinero ni en deuda**. |

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

La página pública y la app leen el **mismo** archivo, lo que **reduce** —no
elimina— el riesgo de divergencia: un build viejo o una caché pueden servir otra
revisión. Por eso, tras cada deploy se comprueba la versión y el hash **servidos**
en ambas superficies (§7). En esta comprobación, la diferencia era caché del
revisor.

**Rev. 2 aplica además:** caducidad por inactividad **eliminada**; cierre de cuenta
**sin confiscación** (30 días para consultar, transferir o reclamar, con aviso al
inicio y al final); Bóveda Temporal mantenida de forma provisional con aviso al
emitir, recordatorio, prueba de titularidad y suspensión por error técnico; y dos
documentos nuevos publicados (**Membresías y Suscripciones**, **Propinas y
Distribución**).

---

## 2. Los tres dictámenes que no deberían esperar a 2027

### 2.1 Bunz — clasificación regulatoria (LRITF arts. 22, 23 y 24-I)

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

**Datos reales de la red al 2026-11-19** (detalle y consultas en
`15-EXPEDIENTE-BUNZ.md`): 4 negocios en el padrón, **3 aprobados** (1 de ellos
sandbox), **3 aceptan Bunz**, **5 sucursales activas de 6** (2 son de
entrenamiento), **1 establecimiento con cobro con tarjeta habilitado**
(`chargesEnabled = true`). Con esa base, **el 20 % no puede calcularse todavía**:
el denominador legal no es "comercios de Rabbitty" sino el total de
establecimientos habilitados para recibir pagos con tarjeta, y el padrón aún no
tiene razón social ni RFC de cada afiliado. Ése es el entregable `15`.

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

**Corregido en producto (2026-11-19):** la app ofrecía "Rabbitty Pay · tarjeta"
leyendo sólo el registro global de rieles. Ahora `/api/pay/capabilities?businessId=`
consulta la cuenta Connect de la **sucursal de producción** y sólo muestra la
opción si `chargesEnabled = true`; si no, la deshabilita con el motivo. Caso real
detectado: **626 Café tiene `chargesEnabled = false`** (`account_missing`), así que
su cobro con tarjeta fallaría con `STRIPE_CONNECT_NOT_READY` aunque el riel exista.
Bunz también se oculta si el negocio no lo acepta.

### 2.3 Datos personales — responsable vs encargado

**Qué preguntar:** en cada tratamiento (cuenta, lealtad, pedidos del POS, personal
del afiliado, analítica), quién decide finalidades y medios.

**Lo que ya dice el corpus:** Aviso integral con responsable identificado y DPA
publicado para los tratamientos por cuenta del afiliado.

**Entregable:** `16-MATRIZ-TRATAMIENTOS.md` con el rol por tratamiento y el
proveedor real (Vercel, Railway/Postgres, S3, Resend, Stripe, OpenAI/Ollama,
Telegram, Uber Direct, Redis).

**Falta:** cotejar cada fila con el contrato firmado y confirmar las transferencias
internacionales (infraestructura, correo, pagos y modelos) para cerrar el aviso y
el DPA.

---

## 3. Documentos del paquete: publicados y pendientes

**Publicados en `.2` (ya no son pendientes):**

| Documento | Estado |
|---|---|
| **Política de Membresías y Suscripciones** | Publicada (`/legal/membresias`). El comercio vende y presta; Rabbitty administra tecnología y cobro. |
| **Política de Propinas y Distribución** | Publicada (`/legal/propinas`). Voluntaria, con opción de cero, modificable antes de pagar; Rabbitty no es beneficiario ni cobra comisión sobre ella. |

**Siguen pendientes (y no conviene meterlos como cláusulas sueltas):**

| Prioridad | Documento | Por qué |
|---|---|---|
| Media | **Política de cancelaciones, devoluciones y reembolsos (consumidor)** | El anexo publicado cubre el lado del afiliado y contracargos; falta la cara del comensal. |
| Media | **SLA / soporte y continuidad** | Los Términos remiten a la propuesta comercial; conviene anexo por nivel. |
| Media | **Promociones, campañas y recompensas** | Reglas de campañas flash, cupones y topes. |
| Media | **Integraciones y delivery** | Responsabilidades con Uber Direct y agregadores. |
| Baja | **Multi-sucursal**, **prevención de fraude**, **conservación/bloqueo/eliminación** | Crecimiento y operación. |
| Pendiente | **Comodato + acta** | Ya escrito; se publica cuando haya hardware. |

---

## 3 bis. Membresías y art. 76 Bis VIII/IX — qué aplica hoy y qué falta

Las fracciones VIII y IX del art. 76 Bis de la LFPC (vigentes desde el
**13-dic-2025**) obligan, para cobros recurrentes, a informar periodicidad, monto y
fecha; recabar consentimiento expreso; **avisar al menos 5 días naturales antes de
la renovación automática**; y permitir cancelar de inmediato sin penalización.

**Hecho verificado en producto (2026-11-19):** hoy **no hay renovación automática**.
El esquema `membership_subscriptions` existe con `cancelAtPeriodEnd` y
`paymentProviderSubId`, pero hay **2 suscripciones y ninguna con cobro recurrente
del proveedor** (`paymentProviderSubId` nulo). La renovación se ejecuta por el
endpoint **manual** `memberships.renewPaidMembership` y no hay cron de renovación.

**Consecuencia jurídica:** mientras la renovación sea manual, la obligación de
aviso de 5 días **no se activa**; el documento de Membresías ya describe precio,
vigencia, cancelación y reembolso. **No debe afirmarse que el producto cumple
76 Bis VIII/IX** mientras no exista cobro recurrente.

**Si se automatiza la renovación, el producto necesita antes:**

| # | Requisito | Estado |
|---|---|---|
| 1 | Consentimiento **separado** para renovación recurrente | No existe |
| 2 | Registro de monto, periodicidad, fecha y versión aceptada | Parcial (`membership_plan_versions` guarda precio e intervalo; falta la aceptación) |
| 3 | Aviso automático 5 días antes del corte | No existe (no hay cron) |
| 4 | Cancelación inmediata con comprobante | Parcial (`cancelAtPeriodEnd`, falta comprobante) |
| 5 | Bitácora de fecha, usuario y resultado de cada acción | Parcial (estados, sin bitácora dedicada) |

**Decisión:** mantener la renovación manual hasta tener 1-5. Documentarlo así ante
el despacho evita que se dictamine sobre una obligación que aún no nace.

---

## 3 ter. Propinas — auditoría del POS

**Regla legal:** voluntaria, nunca preseleccionada de forma engañosa, modificable
por el consumidor y sin condicionar el servicio (LFPC; criterio PROFECO 2026).

**Verificado en el código del POS (2026-11-19):**

| Requisito | Evidencia |
|---|---|
| Default en cero | `posTip` nace vacío; el cobro usa `Number(posTip \|\| 0)`. |
| Opción explícita de no dejar | Botón **"No dejar"** activo por defecto. |
| Modificable antes de pagar | Pills de porcentaje, campo manual y botón **✕** para quitarla. |
| Registro separado de la venta | `orders.tip` como columna propia; el comprobante muestra "Gratificación voluntaria" aparte del consumo. |
| Sin condicionar el servicio | No hay bloqueo de la venta por propina cero. |
| No es ingreso de Rabbitty | La comisión se calcula sobre el consumo; la propina no entra a la base (`platformCommission`). |

**Pendiente (no bloquea):** quién recibe jurídicamente la propina, cómo se
distribuye, quién la entera y qué pasa con propinas disputadas o sujetas a
contracargo. Es pregunta para el despacho y el contador, no un cambio de código.

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
3. Commit + deploy: la app, la landing y el panel leen la misma fuente. **Compartir
   archivo reduce el riesgo, no lo elimina:** tras cada deploy se comprueba la
   versión y el hash **servidos** en `app.rabbitty.me/legal` y en
   `rabbitty.me/legal` (un build viejo o una caché pueden servir otra revisión);
   si no coinciden, no se da por publicada.
4. El afiliado y el consumidor vuelven a aceptar la versión nueva; queda
   registrada con fecha, usuario, correo, IP y user-agent en
   `business_consents` (afiliado) y en el registro de consentimiento del
   consumidor.
5. La comisión **no puede activarse** si el negocio no aceptó la versión vigente
   del Anexo de Pagos (bloqueo en `god.setPlatformCommission`).
