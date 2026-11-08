# Auditoría técnica de passkeys / WebAuthn

> **Borrador técnico.** No es una opinión legal. Busca demostrar que el flujo es
> seguro y que no se almacenan datos biométricos.

**Implementación:** `packages/api/src/routers/passkeys.ts`
**Librería:** `@simplewebauthn/server`
**Tabla:** `passkeys` (`credentialId`, `publicKey`, `counter`, `transports`, `deviceName`, `createdAt`)

---

## 1. Qué se guarda y qué no

| Dato | ¿Se guarda? | Dónde | Nota |
|---|---|---|---|
| Llave pública | Sí | `passkeys.publicKey` | Base64URL |
| ID de credencial | Sí | `passkeys.credentialId` | Único |
| Contador de firma | Sí | `passkeys.counter` | Se actualiza al autenticar |
| Transportes | Sí | `passkeys.transports` | JSON |
| Nombre del dispositivo | Sí | `passkeys.deviceName` | Opcional |
| Fecha de alta | Sí | `passkeys.createdAt` | |
| Plantilla biométrica | **No** | — | Nunca llega al servidor |
| Imagen de rostro/huella | **No** | — | Procesada por el SO |

---

## 2. Flujo esperado

### Registro

1. Usuario autenticado solicita opciones.
2. Servidor genera `challenge` y opciones con `rpID`, `rpName`, `userName`.
3. Cliente crea credencial con Face ID/Touch ID.
4. Servidor verifica `challenge`, `origin`, `rpID` y atestación.
5. Guarda llave pública, contador y transportes.
6. **Debe** registrar evento de auditoría.

### Autenticación

1. Cliente solicita opciones.
2. Servidor genera `challenge` y lista de credenciales permitidas.
3. Cliente firma.
4. Servidor localiza **la credencial exacta** por `id`/`rawId`.
5. Verifica `challenge`, `origin`, `rpID`, firma y contador.
6. Actualiza contador y elimina el reto (single-use).
7. **Debe** registrar evento de auditoría.

### Login público

1. `loginOptions` genera reto y lo persiste con expiración (3 min).
2. `loginVerify` localiza credencial por `rawId`, verifica y consume el reto.
3. Emite token single-use para NextAuth (5 min).

---

## 3. Hallazgos

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| P1 | Reto de registro/autenticación autenticada en `Map` en memoria | Se pierde al reiniciar o con varias instancias | Persistir en `verificationTokens` con expiración, como en login |
| P2 | Registro sin `userVerification` explícito | Política dependiente del default | Fijar `"preferred"` o `"required"` y documentarlo |
| P3 | `verifyAuthentication` toma la primera passkey del usuario (`limit(1)`) | Falla si el usuario tiene 2+ passkeys y usa la segunda | Localizar por `rawId`/`id`, no por usuario |
| P4 | Sin evento de auditoría al crear/borrar passkey | Difícil reconstruir altas/bajas | Insertar en `auditEntries` |
| P5 | `RP_ID`/`ORIGIN` dependen de variables de entorno | Si están mal, el reto falla o acepta origen incorrecto | Verificar producción: `RP_ID=admin.rabbitty.me`, `ORIGIN=https://admin.rabbitty.me` |
| P6 | Sin prueba de autenticador clonado | El contador debe detectar regresión | Verificar que la librería rechace contador menor o igual |
| P7 | Borrado exige TOTP solo si está activo | Usuario sin TOTP puede borrar con sesión | Aceptable si la sesión es fuerte; documentar |

---

## 4. Casos de prueba

| # | Caso | Resultado esperado |
|---|---|---|
| T1 | Registrar passkey en producción | Se guarda llave pública; no hay biometría |
| T2 | Autenticar con la passkey correcta | Éxito y contador actualizado |
| T3 | Autenticar con una passkey distinta del mismo usuario | Debe funcionar (hoy falla por P3) |
| T4 | Reusar el mismo reto | Debe rechazarse |
| T5 | Reto expirado (más de 3 min) | Debe rechazarse |
| T6 | Origen distinto (`evil.example`) | Debe rechazarse |
| T7 | `RP_ID` incorrecto | Debe rechazarse |
| T8 | Contador repetido o menor | Debe rechazarse (clon) |
| T9 | Borrar passkey sin TOTP / con TOTP | Comportamiento documentado |
| T10 | Reiniciar el servidor entre opciones y verificación | Debe funcionar (hoy falla por P1) |
| T11 | Dos instancias balanceadas | Debe funcionar (hoy falla por P1) |
| T12 | Usuario sin passkey intenta login | Mensaje claro, sin filtrar datos |
| T13 | Passkey borrada intenta login | Rechazo claro |
| T14 | Evento de auditoría en alta/baja | Registro presente (hoy falta por P4) |

---

## 5. Evidencia a archivar

- Captura de configuración `RP_ID`/`ORIGIN` de producción (sin secretos).
- Resultado de T1–T14 con fecha y responsable.
- Consulta a `passkeys` mostrando solo campos permitidos.
- Confirmación de que no existe columna de biometría.
- Registro de auditoría de alta/baja.
- Reporte de la librería sobre verificación de contador.

---

## 6. Criterio de cierre

- P1–P5 corregidos o aceptados con justificación.
- T1–T14 ejecutados; los que fallen tienen plan.
- Producción con `RP_ID` y `ORIGIN` correctos.
- Aviso de privacidad coherente con lo observado.
- Evidencia archivada.
