# 16 · Matriz de tratamientos de datos personales

> **Para qué sirve.** El DPA publicado explica *cómo* Rabbitty trata datos por
> cuenta de un afiliado, pero no responde la pregunta que el despacho necesita:
> **en cada tratamiento, ¿quién decide la finalidad y los medios, y con qué
> proveedor salen los datos?**
>
> **Cómo se usa.** Cada fila se coteja con el contrato del proveedor y con la
> operación real. Donde dice *por determinar*, **no se asume** que Rabbitty es
> encargado: se dictamina.
>
> **Fecha de corte:** 2026-11-19. **Base legal citada:** LFPDPPP (reforma del
> 14-nov-2025), arts. 8 (consentimiento), 9 (datos sensibles), 10 (finalidades),
> 26-28 (relación responsable-encargado), 34-36 (transferencias y remisiones) y
> 16 (deber de información).

---

## 1. Regla de lectura (para no equivocarse de rol)

| Rol | Quién decide | Qué implica |
|---|---|---|
| **Responsable** | Rabbitty decide finalidad y medios | Debe dar aviso propio, atender ARCO y responder por el tratamiento. |
| **Encargado** | El afiliado decide; Rabbitty sólo ejecuta | Necesita contrato (DPA), instrucciones documentadas y no usar los datos para fines propios. |
| **Corresponsable** | Dos o más deciden conjuntamente | Requiere reparto de obligaciones y un punto de contacto único para el titular. |
| **Transferencia** | Sale a un tercero que decide | Aviso, base legal y, si es internacional, cumplir arts. 34-36. |
| **Remisión** | Sale a un proveedor que sólo presta servicio | Contrato y confidencialidad; no se considera transferencia. |

**Advertencia:** la declaración general “Rabbitty siempre es encargada de los datos
de los comercios” **no es sostenible**. En cuenta, lealtad, analítica y seguridad
Rabbitty decide finalidades, y por tanto es responsable (o corresponsable).

---

## 2. Matriz por tratamiento

### 2.1 Titulares: comensales / Rabbitter

| # | Tratamiento | Datos | Para qué | Decide finalidad | Rol de Rabbitty | Proveedor / destino | Retención |
|---|---|---|---|---|---|---|---|
| T1 | **Cuenta Rabbitter** (registro, login) | Identificador de Telegram o correo, nombre, foto, idioma | Crear y autenticar la cuenta | Rabbitty | **Responsable** | Telegram (autenticación), Auth.js + Resend (magic link), Railway/Postgres | Mientras la cuenta viva + plazo de conservación |
| T2 | **Perfil y preferencias** | Nombre, foto, ciudad, gustos, restricciones declaradas | Personalizar la experiencia | Rabbitty | **Responsable** | Railway/Postgres | Igual que la cuenta |
| T3 | **Pedidos en el POS / app** | Nombre, historial de consumo, mesa, notas, dirección de entrega | Preparar, cobrar y entregar el pedido | **Afiliado** (finalidad comercial); Rabbitty opera la herramienta | **Encargado** para el afiliado · **Responsable** para métricas propias agregadas | Railway/Postgres; Uber Direct si hay entrega | Según política del afiliado + conservación fiscal |
| T4 | **Lealtad y Bunz** | Saldo, emisiones, canjes, transferencias, teléfono de la Bóveda Temporal | Operar el programa de recompensas | **Por determinar** (Rabbitty diseña el programa; el afiliado lo patrocina) | **Responsable o corresponsable** — dictaminar | Railway/Postgres (`bunz_ledger_entries`, `bunz_obligations`) | Mientras el saldo exista + plazo para reclamar |
| T5 | **Pagos** | Importe, últimos dígitos, estado, correo, datos de facturación | Cobrar y conciliar | **Según el flujo**: Stripe decide medios; Rabbitty decide conciliación | **Por determinar** (encargado frente al afiliado, responsable del registro propio) | **Stripe** (Connect), efectivo en POS | Plazo fiscal y de contracargos |
| T6 | **Facturación / CFDI** | RFC, razón social, régimen, domicilio fiscal | Emitir comprobantes | Rabbitty (si factura) o el afiliado | **Responsable** del CFDI que emite | Proveedor de CFDI / `cfdi_credentials` | Plazo fiscal (5 años) |
| T7 | **Comunicaciones** | Correo, teléfono, token de push, chat de Telegram | Avisos de pedido, seguridad y marketing | Rabbitty (transaccional) · afiliado (promocional) | **Responsable** (transaccional) · **Encargado** (promocional del afiliado) | **Resend** (correo), **Telegram** (bot), push web | Mientras la cuenta viva; baja inmediata al revocar |
| T8 | **Soporte y reclamaciones** | Conversación, adjuntos, identificadores | Resolver el caso | Rabbitty | **Responsable** | Telegram, correo, Railway | Plazo de defensa + 2 años |
| T9 | **Analítica y métricas** | Eventos de uso, dispositivo, ciudad aproximada | Mejorar producto y detectar fraude | Rabbitty | **Responsable** | Railway/Postgres (métricas propias) · sin SDK de terceros identificado | Agregada; cruda acotada |
| T10 | **Seguridad y prevención de fraude** | IP, user-agent, intentos, señales de abuso | Proteger la plataforma y a los usuarios | Rabbitty | **Responsable** | Railway/Postgres (`bunz_abuse_signals`), Redis (rate limit) | Plazo de seguridad |
| T11 | **Medios de productos** | Fotos de platillos y locales | Mostrar catálogo | Afiliado | **Encargado** (hospedaje) | Bucket **S3-compatible** (`AWS_ENDPOINT_URL`) — confirmar región | Mientras el afiliado los conserve |
| T12 | **Entrega a domicilio** | Dirección, teléfono, nombre, notas | Entregar el pedido | Afiliado / Rabbitty según el contrato de delivery | **Encargado** o **corresponsable** — dictaminar | **Uber Direct** | Plazo del pedido + reclamos |
| T13 | **Asistencia con IA** | Texto de la consulta, contexto del negocio | Responder y clasificar | Rabbitty | **Responsable** | **OpenAI** (externo) · **Ollama** (autoalojado) | Acotada; no entrenar con datos del titular sin base |

### 2.2 Titulares: personal del afiliado

| # | Tratamiento | Datos | Para qué | Decide finalidad | Rol de Rabbitty | Proveedor | Retención |
|---|---|---|---|---|---|---|---|
| T14 | **Cuentas de operador del POS** | Nombre, rol, PIN, permisos, terminal asignada | Controlar acceso y auditoría | **Afiliado** | **Encargado** | Railway/Postgres | Mientras dure la relación laboral + plazo del afiliado |
| T15 | **Registro de operaciones** | Quién cobró, anuló, abrió caja, hora | Trazabilidad y prevención de fraude | Afiliado y Rabbitty (seguridad) | **Encargado** (operación) · **Responsable** (seguridad de la plataforma) | Railway/Postgres | Plazo de auditoría del afiliado |

### 2.3 Titulares: afiliados (personas físicas o sus representantes)

| # | Tratamiento | Datos | Para qué | Decide finalidad | Rol de Rabbitty | Proveedor | Retención |
|---|---|---|---|---|---|---|---|
| T16 | **Alta y verificación de afiliado** | Nombre, RFC, razón social, domicilio, identificación, datos bancarios | Contratar, verificar y pagar | Rabbitty | **Responsable** | Railway/Postgres; Stripe (datos de payout) | Mientras dure el contrato + plazo fiscal |
| T17 | **Consentimiento y versiones legales** | Usuario, correo, IP, user-agent, versión aceptada | Probar la aceptación | Rabbitty | **Responsable** | Railway/Postgres (`business_consents`) | Plazo contractual + 5 años |

---

## 3. Proveedores y salida de datos

| Proveedor | Función | Dónde corre | Mecanismo | Contrato / acción |
|---|---|---|---|---|
| **Vercel** | Hosting de app, admin y landing | EE. UU. (edge) | Remisión | Confirmar DPA y región; revisar logs |
| **Railway** | API admin y PostgreSQL | EE. UU. | Remisión / transferencia | Contrato, región y respaldo cifrado |
| **Stripe** | Cobros, Connect, payouts | EE. UU. / global | **Transferencia** (decide medios) | DPA de Stripe + aviso de transferencia |
| **Resend** | Correo transaccional y magic link | EE. UU. | Remisión | DPA y lista de subencargados |
| **Telegram** | Autenticación, bot y chat | Global | Transferencia / remisión | Aviso; limitar datos enviados |
| **Bucket S3-compatible** | Fotos de productos | **Por confirmar** (`AWS_ENDPOINT_URL`) | Remisión | Confirmar proveedor y región |
| **OpenAI** | Asistencia con IA | EE. UU. | **Transferencia** | Verificar que no entrene con los datos; DPA |
| **Ollama** (autoalojado) | Modelos locales y embeddings | Infraestructura propia | Sin salida | Documentar ubicación |
| **Uber Direct** | Entrega | México / global | Transferencia / corresponsabilidad | Contrato y aviso |
| **Redis** | Rate limit y caché | Infraestructura propia | Sin salida | Cifrado y TTL |
| **CFDI** | Facturación | México | Remisión | Contrato con el proveedor autorizado |

**Pendiente crítico:** confirmar la **región real** del bucket y de Railway, porque
de eso depende si hay transferencia internacional y qué cláusulas deben añadirse.

---

## 4. Hallazgos que el despacho debe resolver

| # | Hallazgo | Riesgo | Acción |
|---|---|---|---|
| H1 | La frase “Rabbitty siempre es encargado” es falsa en cuenta, lealtad, analítica y seguridad | Aviso y bases legales insuficientes; ARCO mal atribuido | Dictaminar rol por tratamiento (esta matriz es la base) |
| H2 | **Bunz**: el programa lo diseña Rabbitty y lo patrocina el afiliado | Corresponsabilidad no documentada | Definir reparto de obligaciones y contacto único |
| H3 | **Pagos**: Stripe decide medios; Rabbitty concilia y conserva | Rol mixto | Dictaminar y reflejarlo en el aviso |
| H4 | **OpenAI** recibe texto y contexto | Transferencia internacional | Verificar no-entrenamiento y DPA |
| H5 | **Bucket y Railway**: región sin confirmar | Transferencia no declarada | Confirmar región y actualizar aviso |
| H6 | **Personal del afiliado**: Rabbitty sólo hospeda | Fuga de responsabilidad si se usa para fines propios | DPA con instrucciones y prohibición de uso propio |
| H7 | **Retención** definida por categoría en el aviso, sin calendario operativo | Conservar de más o de menos | Calendario de conservación por tabla |
| H8 | **Bunz** guarda teléfonos de la Bóveda Temporal de personas sin cuenta | Datos de no usuarios | Base legal, aviso específico y plazo |
| H9 | **Uber Direct** recibe dirección y teléfono | Transferencia por pedido | Aviso y contrato |
| H10 | **Marketing** del afiliado sobre bases de Rabbitty | Uso para fin distinto | Consentimiento separado y trazabilidad |

---

## 5. Acciones mínimas antes de cerrar el expediente

1. **Cotejar cada fila con el contrato firmado** del proveedor (DPA, subencargados,
   región).
2. **Confirmar región** de Railway y del bucket S3; si es fuera de México,
   actualizar la cláusula de transferencias del aviso.
3. **Calendario de conservación** por tabla (cuenta, pedidos, pagos, Bunz,
   personal, seguridad).
4. **Registro de consentimientos** con versión, fecha, usuario, correo, IP y
   user-agent (ya existe para afiliados en `business_consents`; extender al
   consumidor).
5. **Designar responsable de privacidad** y publicar el canal ARCO con plazos
   (20/15 días hábiles ya descritos en el aviso).
6. **Revisar el aviso** para que declare: identidad y domicilio del responsable
   (ya está), categorías, finalidades, opciones para limitar uso, ARCO y
   procedimiento de cambios.
7. **Prohibición expresa** de vender o comprar Bunz con dinero (control de riesgo
   regulatorio, ver `15-EXPEDIENTE-BUNZ.md`).

---

## 6. Relación con los demás documentos

| Documento | Qué aporta |
|---|---|
| `packages/legal/src/documents.ts` → `privacidad` | Aviso integral con responsable, domicilio, finalidades, ARCO e incidentes. |
| `packages/legal/src/documents.ts` → `dpa` | Contrato marco de encargo para tratamientos por cuenta del afiliado. |
| `15-EXPEDIENTE-BUNZ.md` | Hechos, padrón y preguntas sobre el programa de lealtad. |
| `14-INFORME-OBSERVACIONES-2026-11-19.md` | Estado del corpus y preguntas por materia. |
