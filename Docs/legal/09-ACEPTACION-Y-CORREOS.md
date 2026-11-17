# 09 · Aceptación, versiones y correos transaccionales

**Versión:** 2026-11-18 · **Documento interno + plantillas**

---

## 1. Cómo se prueba la aceptación (y por qué importa)

En México un consentimiento por “clic” es defendible si se puede probar **quién,
cuándo y qué versión** aceptó. El sistema ya lo hace parcialmente:

| Momento | Estado | Qué guarda hoy |
|---|---|---|
| Alta del Rabbitter | ✅ funciona | `termsVersion` + `privacyVersion` por usuario (`/api/auth/consent`, OTP verify) |
| Aceptación del afiliado | ⚠️ **falta** | el correo de aprobación se envía, pero no se registra versión aceptada |
| Comodato de equipos | ⚠️ **falta** | el acta es en papel/digital sin registro en el sistema |
| Cambios de versión | ⚠️ **falta** | no hay re-aceptación cuando cambia la versión |

### Regla propuesta (implementar)

1. `CONSENT_VERSION` en formato `AAAA-MM-DD` (hoy `2026-11-08` en el onboarding).
2. Guardar por aceptación: **documento**, **versión**, **fecha-hora**, **correo**,
   **IP** y **user-agent**.
3. Si cambia la versión de cualquiera de los documentos, el usuario debe
   **re-aceptar** en el siguiente inicio de sesión (aviso bloqueante, no modal
   descartable).
4. El afiliado acepta **términos + anexo de pagos + comodato (si aplica)** en un
   solo acto, con su propia versión.

### Dónde vive cada cosa

| Dato | Tabla propuesta | Nota |
|---|---|---|
| Aceptación por usuario | `users.termsVersion`, `users.privacyVersion` (existe) | añadir `termsAcceptedAt`, `privacyAcceptedAt`, `acceptedIp` |
| Aceptación del afiliado | `business_consents` (nueva) | `businessId`, `doc`, `version`, `acceptedAt`, `acceptedBy`, `ip`, `userAgent` |
| Acta de equipo | `equipment_actas` (nueva) | folio, equipo(s), serie, estado, fotos, firmas |

---

## 2. Plantillas de correo transaccional

> Todas se envían desde `hola@rabbitty.me`. Son **transaccionales** (no requieren
> consentimiento de marketing).

### 2.1 · Bienvenida al afiliado + aceptación de términos

**Asunto:** `Bienvenido a Rabbitty · Términos y siguientes pasos`

```
Hola {nombre},

Tu negocio {negocio} ya está activo en Rabbitty.

Antes de operar necesitamos dejar constancia de la aceptación de los documentos
que rigen el servicio:

  · Términos y Condiciones de la Plataforma (v2026-11-18)
  · Anexo de Pagos — comisiones y liquidaciones
  · Aviso de Privacidad

Puedes leerlos y aceptarlos aquí: {enlace}/legal
Al aceptar, registramos la fecha, tu correo y la versión aceptada.

Siguientes pasos
  1. Configura tu menú y tus sucursales.
  2. Conecta tu cuenta de cobro (Stripe) para liquidaciones.
  3. Si recibes equipo de Rabbitty, firma el acta de entrega-recepción.
  4. Abre tu primer turno de caja y haz una venta de prueba.

Guía completa: {enlace}/operations-manual

Cualquier duda, responde a este correo.
— Equipo Rabbitty
```

### 2.2 · Confirmación de aceptación (comprobante)

**Asunto:** `Comprobante de aceptación — {negocio}`

```
Hola {nombre},

Dejamos constancia de que el {fecha} a las {hora} aceptaste:

  · Documento: {documento}
  · Versión: {versión}
  · Medio: panel web Rabbitty
  · IP: {ip}

Puedes consultar la versión vigente en {enlace}/legal.
Si no reconoces esta aceptación, escríbenos de inmediato.

— Equipo Rabbitty
```

### 2.3 · Entrega de equipo (comodato)

**Asunto:** `Acta de entrega de equipo — folio {folio}`

```
Hola {nombre},

Registramos la entrega de los siguientes equipos en comodato:

  · Lector de tarjetas · Serie {serie}
  · Impresora térmica · Serie/MAC {serie}
  · Folio del acta: {folio}
  · Fecha: {fecha}

Recuerda:
  · El equipo es propiedad de Rabbitty y se usa solo en {negocio}.
  · Cualquier pérdida, robo o daño se reporta en 24 h.
  · Al terminar la relación, se devuelve en 10 días naturales.

Contrato completo: {enlace}/legal/equipos

— Equipo Rabbitty
```

### 2.4 · Aviso de contracargo

**Asunto:** `⚠️ Contracargo recibido — necesitamos evidencia en 5 días`

```
Hola {nombre},

El banco del comensal impugnó un cargo:

  · Folio del ticket: {folio}
  · Monto: ${monto} {moneda}
  · Fecha y hora: {fecha}
  · Método: {método}
  · Terminal/sucursal: {terminal} / {sucursal}

Tenemos hasta el {fechaLimite} para responder. Necesitamos de tu parte:

  · Copia del ticket firmado o comprobante de entrega
  · Cualquier evidencia de que el servicio se prestó

Sin evidencia en plazo, el contracargo se descuenta de tu siguiente liquidación.
Detalle de la política: {enlace}/legal/chargebacks

— Equipo Rabbitty
```

### 2.5 · Cambio de versión de documentos

**Asunto:** `Actualizamos nuestros términos — entra en vigor el {fecha}`

```
Hola {nombre},

Actualizamos {documento} (versión {versión}). Los cambios principales son:

  · {cambio1}
  · {cambio2}

Entra en vigor el {fecha}. Puedes leer la versión vigente en {enlace}/legal.
Si no estás de acuerdo, puedes dar de baja sin penalidad antes de esa fecha
escribiendo a hola@rabbitty.me.

— Equipo Rabbitty
```

---

## 3. Checklist de implementación (cuando se apruebe)

- [ ] Publicar `/legal/terminos`, `/legal/privacidad`, `/legal/equipos`,
      `/legal/bunz`, `/legal/rabbitter` con versión visible.
- [ ] Subir `CONSENT_VERSION` y registrar `termsAcceptedAt` / `privacyAcceptedAt` / IP.
- [ ] Crear `business_consents` y `equipment_actas`.
- [ ] Aceptación del afiliado **obligatoria** antes de operar (bloqueo suave:
      puede ver, no cobrar).
- [ ] Acta digital de equipo con foto y firma desde el panel.
- [ ] Correos 2.1–2.5 conectados a sus eventos.
- [ ] Re-aceptación automática cuando cambie la versión.

`[REVISAR]` Antes de publicar: revisión legal del corpus, registro ante PROFECO
de lo que aplique y validación fiscal de comisiones.
