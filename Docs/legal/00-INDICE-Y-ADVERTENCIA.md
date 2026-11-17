# Corpus legal Rabbitty — índice y advertencia

**Versión del corpus:** 2026-11-18 · **Estado:** borradores operativos, listos para revisión legal
**Ámbito:** México · plataforma digital, POS presencial, economía de lealtad (Bunz)

---

## ⚠️ Advertencia importante (leer antes que nada)

Estos documentos son un **borrador funcional** escrito con base en el
funcionamiento real del sistema (código, flujos y datos verificados). **No son
asesoría legal** y no sustituyen la revisión de un abogado y un contador
mexicanos antes de publicarse o firmarse.

Lo que **sí** aportan:

- Están alineados con lo que el sistema hace hoy (no prometen funciones que no
  existen).
- Identifican los puntos que **sí o sí** requieren revisión profesional (marcados
  con `[REVISAR]`).
- Dejan listo el mecanismo de aceptación y versionado dentro del producto.

Lo que **no** se debe hacer: publicarlos tal cual sin revisión, o firmarlos con
un afiliado sin que un abogado los haya visto.

---

## 1. Inventario

| # | Documento | Para quién | Bloqueante para operar |
|---|---|---|---|
| 01 | Términos y Condiciones de la Plataforma | Afiliados (negocios) | **Sí** |
| 02 | Anexo de Pagos (Rabbitty Pay · Stripe · comisiones) | Afiliados | **Sí** |
| 03 | Contrato de Comodato de Equipos (lector + impresora) | Afiliados con hardware | **Sí**, antes de entregar equipo |
| 03B | Opción de venta del equipo (alternativa al comodato) | Afiliados | No |
| 04 | Política de Chargebacks y Reembolsos | Afiliados | **Sí** |
| 05 | Aviso de Privacidad (integral y simplificado) | Todos | **Sí** |
| 06 | Términos de Uso del Rabbitter (consumidor) | Comensales | **Sí** |
| 07 | Reglamento de la Economía Bunz | Todos | **Sí** (Bunz ya opera) |
| 08 | Anexos operativos (propinas, offline, soporte, baja) | Afiliados | No, pero recomendado |
| 09 | Aceptación, versiones y correos transaccionales | Interno | **Sí** |

---

## 2. Cómo se aceptan (mecanismo real del sistema)

Hoy el producto ya registra consentimiento con versión:

| Momento | Dónde está | Qué guarda |
|---|---|---|
| Alta del Rabbitter (onboarding) | `telegram-miniapp/src/app/onboarding/page.tsx` (`CONSENT_VERSION`) | `termsVersion` + `privacyVersion` por usuario vía `/api/auth/consent` |
| Verificación OTP | `telegram-miniapp/src/app/api/auth/otp/verify/route.ts` | idem, en el alta |
| Aceptación del afiliado | se envía al aprobar el negocio (`packages/api/src/routers/admin.ts`) | correo de bienvenida; **falta** registrar versión aceptada |

**Regla que se propone:** cuando cambie cualquier documento, sube
`CONSENT_VERSION` (formato `AAAA-MM-DD`) y el sistema vuelve a pedir aceptación.
La aceptación debe guardar: **versión + fecha + IP + correo**.

`[REVISAR]` Un consentimiento por “clic” es defendible en México si se prueba
quién, cuándo y qué versión aceptó. Hoy ya guardamos esto para el Rabbitter; para
el afiliado hay que cerrarlo (ver documento 09).

---

## 3. Puntos que exigen revisión profesional (marcados `[REVISAR]`)

1. **Contrato de adhesión y PROFECO.** Los contratos con consumidores y los de
   adhesión deben registrarse ante PROFECO antes de usarse (Ley Federal de
   Protección al Consumidor). Aplica a los Términos del Rabbitter y
   probablemente al contrato de afiliación.
2. **Naturaleza de los Bunz.** Deben quedar como **programa de lealtad**, no como
   dinero electrónico ni monedero (evitar la Ley para Regular las Instituciones
   de Tecnología Financiera). El punto delicado son las **transferencias entre
   usuarios**: hay que redactar el límite (sin conversión a efectivo, sin compra
   con dinero).
3. **Datos personales.** Verificar la autoridad vigente en 2026 y el formato del
   aviso de privacidad; el corpus usa principios de la LFPDPPP y su reforma.
4. **Quién es el comercio ante Stripe** con *destination charges*: si Rabbitty
   concentra el dinero, hay que definir cómo se declara (comisión vs mandato) y
   el IVA sobre la comisión.
5. **CFDI**: declarar explícitamente que Rabbitty **no** emite el CFDI del cobro
   presencial; lo hace el afiliado con su PAC.
6. **Comodato**: confirmar régimen (Código Civil Federal) y si conviene
   comodato, arrendamiento o venta con reserva de dominio.
7. **Conservación de mensajes** (comercio electrónico): NOM-151 para los
   comprobantes digitales y el expediente de aceptación.

---

## 4. Reglas de redacción que sigue este corpus

- **Nunca prometer** lo que el sistema no hace (p. ej. “terminal en iPad”).
- **Nunca** calificar a los Bunz como dinero, saldo, monedero o inversión.
- Toda obligación del afiliado se ata a algo verificable en el sistema (turno de
  caja, folio, ticket, lector registrado).
- Toda obligación de Rabbitty se limita a lo que controla (no responde por la red
  del local ni por el banco del afiliado).
- Los plazos son concretos y cortos; los silencios no generan derechos.

---

## 5. Cómo se publican

| Documento | Superficie en el producto |
|---|---|
| Términos de plataforma + anexo de pagos | `/legal/terminos` (app y admin) |
| Aviso de privacidad | `/legal/privacidad` (app y admin) |
| Comodato de equipos | `/legal/equipos` + PDF firmable |
| Reglamento Bunz | `/legal/bunz` |
| Términos del Rabbitter | `/legal/rabbitter` |

Todas llevan **versión visible** y fecha de última actualización; la versión del
texto publicado debe coincidir con `CONSENT_VERSION` del código.
