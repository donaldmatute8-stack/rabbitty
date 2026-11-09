# Evidencia de aceptación contractual — especificación y prueba E2E

> **Borrador técnico y legal.** Define qué debe demostrar la evidencia y cómo
> probarla. No es una opinión legal.

**Superficies de aceptación:**

1. Landing `/contrato` (afiliado nuevo).
2. Re-onboarding tokenizado (`/re-onboarding/<token>`).
3. Modal de recuperación de capacidad (`/settings/recovery`).
4. Onboarding del admin y aceptación de términos.

---

## 1. Qué debe probar la evidencia

Que una persona determinada, con facultades, aceptó **un texto exacto** en una
fecha determinada, y que RABBITTY le entregó una copia.

| Elemento | Pregunta que responde |
|---|---|
| Identidad | ¿Quién aceptó? |
| Representación | ¿Tenía facultades? |
| Texto | ¿Qué aceptó exactamente? |
| Versión y hash | ¿Es el documento vigente? |
| Fecha y hora | ¿Cuándo aceptó? |
| Método | ¿Cómo aceptó? |
| Acción afirmativa | ¿Fue una conducta positiva? |
| Sesión / IP / UA | ¿Desde dónde aceptó? |
| Copia | ¿Recibió el documento? |
| Confirmación | ¿RABBITTY lo registró? |
| Inmutabilidad | ¿Se puede alterar después? |

---

## 2. Estado actual en código

### Re-onboarding (`landing-page/src/app/api/re-onboarding/apply/route.ts`)

> **Actualización 8-nov-2026:** G1–G2 corregidos. El contrato vive en
> `landing-page/src/lib/contractContent.ts` (misma fuente que `/contrato`) y la
> evidencia se construye en `landing-page/src/lib/contractEvidence.ts`.

Ya captura:

```json
{
  "acceptanceId": "uuid",
  "offerId": "A-<business>-<fecha>",
  "contractVersion": "2026.11-v1.2",
  "contractStatus": "approved",
  "hashVersion": "canonical-v1",
  "contractHash": "sha256(canonical)",
  "contractTextHash": "sha256(texto del contrato)",
  "annexBHash": "sha256(anexo B)",
  "textHash": "sha256(contrato + anexo + datos)",
  "signedBy": "nombre escrito",
  "signatureMethod": "name_checkbox",
  "acceptedAt": "ISO",
  "acceptedIp": "IP",
  "acceptedUserAgent": "UA",
  "legalName": "...",
  "rfc": "...",
  "representative": "...",
  "capacity": 0,
  "coverageMonths": 0,
  "copyDelivered": true,
  "copyDeliveryStatus": "sent | failed | not_configured",
  "copyDeliveredAt": "ISO",
  "copyMessageId": "id de Resend"
}
```

También guarda `contractEvidence` con el texto íntegro, el Anexo B y los hashes.

### Hallazgos

| # | Hallazgo | Impacto | Estado |
|---|---|---|---|
| G1 | El hash se calculaba sobre un JSON de datos, no sobre el texto íntegro | No probaba qué texto se aceptó | **Corregido:** hash canónico sobre contrato + Anexo B + datos |
| G2 | `copyDelivered: true` era fijo, sin envío ni acuse | La evidencia afirmaba algo no verificado | **Corregido:** envío real por Resend con `messageId` o estado `not_configured`/`failed` |
| G3 | No se guardaba el texto renderizado | No se podía reconstruir la aceptación | **Corregido:** se guarda `contractEvidence.text` |
| G4 | No se versionaba el Anexo A/B aceptado | La oferta podía cambiar sin evidencia | **Parcial:** se guarda Anexo B y la oferta; el Anexo A individual falta |
| G5 | No había endpoint de reproducción | Difícil auditar | **Parcial:** existe `/api/re-onboarding/contract`; falta verificación por `acceptanceId` |

## 3. Modelo de evidencia propuesto

### 3.1 Hash canónico

```
canonical =
  "RABBITTY-CONTRACT\n" +
  "version=" + contractVersion + "\n" +
  "offerId=" + offerId + "\n" +
  "text-sha256=" + sha256(contractText) + "\n" +
  "annex-a-sha256=" + sha256(annexAText) + "\n" +
  "annex-b-sha256=" + sha256(annexBText) + "\n" +
  "acceptedBy=" + legalName + "\n" +
  "representative=" + representative + "\n" +
  "acceptedAt=" + acceptedAt.toISOString()

contractHash = sha256(canonical)
```

Reglas:

- El texto se normaliza (UTF-8, saltos `\n`, sin espacios finales).
- Se guarda el texto íntegro o una referencia inmutable (S3 con hash).
- El hash se calcula **después** de fijar versión, oferta y anexos.
- No se incluye el nombre escrito en el hash si se quiere verificar el texto;
  se guarda como campo separado.

### 3.2 Registro de aceptación

| Campo | Tipo | Obligatorio |
|---|---|---|
| `acceptanceId` | UUID | Sí |
| `contractVersion` | string | Sí |
| `contractStatus` | `draft`/`approved` | Sí |
| `offerId` | string | Sí |
| `contractHash` | sha256 | Sí |
| `textHash` | sha256 | Sí |
| `annexAHash` | sha256 | Sí |
| `annexBHash` | sha256 | Sí |
| `signedBy` | string | Sí |
| `signatureMethod` | `name_checkbox` | Sí |
| `acceptedAt` | ISO UTC | Sí |
| `acceptedIp` | string | Sí |
| `acceptedUserAgent` | string | Sí |
| `sessionId` | string | Recomendado |
| `authResult` | `password`/`passkey`/`totp` | Recomendado |
| `copyMessageId` | string | Sí |
| `copyDeliveredAt` | ISO | Sí |
| `copyAcknowledgedAt` | ISO | Recomendado |
| `evidenceStorageKey` | string | Sí |
| `actorType` | `affiliate`/`god`/`system` | Sí |

### 3.3 Inmutabilidad

- Guardar en tabla append-only o con trigger que impida `UPDATE`/`DELETE`.
- Guardar copia en S3 con `Object Lock` o versionado + hash.
- Registrar en `auditEntries`.
- No permitir editar la evidencia; correcciones = nuevo registro.

---

## 4. Entrega de copia

1. Generar PDF/HTML con el texto aceptado, anexos, hash, fecha y firmante.
2. Enviar por correo al afiliado (Resend) y guardar `messageId`.
3. Guardar copia en S3 con la misma clave de evidencia.
4. Mostrar enlace de descarga en el panel del afiliado.
5. Registrar `copyDeliveredAt` solo cuando el proveedor confirme el envío.
6. Si el correo rebota, reintentar y marcar pendiente; no afirmar entrega.

---

## 5. Reproducción y verificación

### Endpoint propuesto

`GET /api/legal/acceptance/:acceptanceId/verify`

Devuelve:

```json
{
  "acceptanceId": "...",
  "contractVersion": "...",
  "contractHash": "...",
  "recomputedHash": "...",
  "matches": true,
  "acceptedAt": "...",
  "signedBy": "...",
  "copyMessageId": "...",
  "evidenceStorageKey": "..."
}
```

Reglas:

- Solo accesible para el afiliado, God Admin o auditor autorizado.
- No expone datos de terceros.
- Registra el acceso en auditoría.

### Procedimiento manual

1. Descargar el texto y anexos desde `evidenceStorageKey`.
2. Recalcular los hashes con el script de verificación.
3. Comparar con los guardados.
4. Confirmar fecha, firmante e IP/UA.
5. Archivar el resultado.

---

## 6. Prueba E2E

| # | Paso | Resultado esperado |
|---|---|---|
| E1 | Crear token de re-onboarding | Token de un solo uso, con vencimiento |
| E2 | Abrir enlace y llenar datos | Validaciones correctas |
| E3 | Aceptar con nombre + checkbox | Se registra aceptación |
| E4 | Verificar hash | Coincide con el texto y anexos |
| E5 | Verificar copia | Correo enviado con `messageId` y copia en S3 |
| E6 | Verificar inmutabilidad | No se puede editar/borrar |
| E7 | Reproducir aceptación | Hash recalculado coincide |
| E8 | Intentar reusar token | Rechazo |
| E9 | Intentar aceptar sin checkbox | Rechazo |
| E10 | Auditar en `auditEntries` | Evento presente |
| E11 | Verificar versión `draft` | Se muestra como borrador, no como aprobado |
| E12 | Cambiar texto sin nueva versión | El hash anterior deja de coincidir y se detecta |

---

## 7. Criterio de cierre

- G1–G3 corregidos; G4–G5 parciales (Anexo A individual y verificación por acceptanceId).
- E1–E12 ejecutados con evidencia.
- Copia entregada y verificable.
- Texto y anexos almacenados de forma inmutable.
- Endpoint de verificación disponible.
- Contrato marcado como `approved` solo cuando el texto esté aprobado.
