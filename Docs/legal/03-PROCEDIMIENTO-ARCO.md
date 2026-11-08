# Procedimiento operativo de derechos ARCO

> **Borrador operativo.** Debe validarse con privacidad/legal antes de publicarse.
> No sustituye el aviso de privacidad ni la asesoría legal.

**Canal oficial:** `privacidad@rabbitty.me`
**Responsable:** MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. (RABBITTY)
**Versión:** 1.0 · 8 de noviembre de 2026

---

## 1. Alcance

Aplica a solicitudes de **Acceso, Rectificación, Cancelación y Oposición**, así
como limitación o revocación del consentimiento, de:

- Rabbitters (usuarios).
- Afiliados y sus representantes legales.
- Personal autorizado del afiliado.
- Visitantes de la plataforma.

---

## 2. Plazos

| Etapa | Plazo | Fundamento |
|---|---|---|
| Acuse de recibo | 5 días hábiles | Buena práctica / control interno |
| Respuesta a la solicitud | 20 días hábiles | LFPDPPP |
| Prórroga (si procede) | 10 días hábiles adicionales | LFPDPPP, notificando motivo |
| Ejecución de la medida | 15 días hábiles desde la respuesta | LFPDPPP |
| Conservación de evidencia | 5 años | Defensa de reclamaciones |

Si falta información, el plazo se suspende **una sola vez** y se notifica al
titular qué debe completar.

---

## 3. Roles internos

| Rol | Responsabilidad |
|---|---|
| **Receptor** (`privacidad@rabbitty.me`) | Registrar folio, acusar recibo, clasificar |
| **Verificador** | Validar identidad y representación |
| **Responsable de datos** | Localizar y ejecutar la medida en cada sistema |
| **Aprobador** | Autorizar cancelación/oposición cuando haya retención legal |
| **Custodio de evidencia** | Archivar solicitud, respuesta y ejecución |

Nadie puede ejecutar una cancelación sin aprobación cuando exista obligación
legal, disputa o operación pendiente.

---

## 4. Verificación de identidad

### Titular

- Nombre completo.
- Documento oficial vigente (INE/pasaporte) o medio equivalente.
- Correo o teléfono registrado en la cuenta.
- Si no coincide, se solicita información adicional sin pedir más de lo necesario.

### Representante legal

- Identificación del representante.
- Instrumento que acredite representación (poder, carta, acta).
- Identificación del titular.
- Se valida que el alcance del poder cubra el derecho ejercido.

### Reglas

- No se aceptan solicitudes por redes sociales o mensajes informales.
- No se pide más información de la necesaria.
- La documentación se guarda cifrada y con acceso restringido.
- Si hay duda razonable, se solicita aclaración por escrito.

---

## 5. Formulario de recepción

Campos mínimos:

1. Nombre completo del titular.
2. Correo y teléfono de contacto.
3. Calidad (titular o representante).
4. Derecho que ejerce (A/R/C/O/limitación/revocación).
5. Descripción clara de lo solicitado.
6. Datos que faciliten la localización (usuario, correo, teléfono, folio, negocio).
7. Documentación de identidad/representación.
8. Firma o acción afirmativa de envío.
9. Fecha y hora de recepción.
10. Folio asignado.

**Formato de folio:** `ARCO-YYYYMMDD-####`.

---

## 6. Mapa de localización de datos

| Sistema / tabla | Qué contiene | Cómo se localiza |
|---|---|---|
| `users` | Cuenta, contacto, identificadores | `id`, `email`, `phoneNumber`, `telegramId`, `username` |
| `passkeys`, `trustedSessions`, `pushDevices` | Credenciales y dispositivos | `userId` |
| `orders`, `orderItems`, `payments` | Consumo y pagos | `customerId`, `customerPhone`, `customerName` |
| `customers` | Cliente del afiliado | `phone`, `name`, `restaurantId` |
| `reservations`, `waitlistEntries` | Reservas y fila | `customerPhone`, `customerName` |
| `messages`, `conversations` | Chat | `senderId`, membresía de conversación |
| `transactions`, `bunz_*` | Bunz y ledger | `userId`, `businessId` |
| `auditEntries` | Evidencia y seguridad | `userId`, `resourceId` |
| `invoices` | Facturación | RFC/correo del titular |
| `userMemories`, `memoryCandidates` | Preferencias IA | `userId` |
| `moodEvents`, `vibePassportStamps` | Mood/rutas | `userId` |
| `staff`, `staffShifts` | Personal del afiliado | `userId`, `branchId` |
| `verificationData`, `merchantRecovery*` | Evidencia contractual | `ownedBusinesses.id` |
| AWS S3 | Adjuntos y medios | Referencia en mensajes/productos |

---

## 7. Procedimiento por derecho

### 7.1 Acceso

1. Localizar datos en las fuentes del mapa.
2. Generar un extracto legible (no volcar tablas crudas).
3. Incluir finalidades, categorías, destinatarios y conservación.
4. Entregar por canal seguro; no adjuntar datos de terceros.
5. Registrar entrega y acuse.

**Criterio de suficiencia:** el titular debe entender qué datos se tienen, para
qué, con quién se comparten y por cuánto tiempo.

### 7.2 Rectificación

1. Verificar el dato actual y el solicitado.
2. Pedir evidencia del dato correcto cuando aplique.
3. Corregir en todas las fuentes (incluyendo respaldos según política).
4. Notificar a encargados cuando el dato se haya compartido.
5. Registrar antes/después y evidencia.

**No procede** si el dato es parte de una operación cerrada que debe conservarse
por obligación legal; en ese caso se agrega una nota aclaratoria.

### 7.3 Cancelación

1. Verificar si existe obligación legal, contractual o disputa.
2. Si no hay retención: suprimir o anonimizar en todas las fuentes.
3. Si hay retención: bloquear y explicar el plazo y la base.
4. Revocar accesos, sesiones, passkeys y dispositivos.
5. Confirmar al titular qué se suprimió y qué se conservó.

**Regla:** los asientos contables y fiscales no se eliminan; se disocian cuando
sea posible.

### 7.4 Oposición

1. Identificar la finalidad cuestionada (marketing, analítica, perfilamiento).
2. Detener el tratamiento para esa finalidad.
3. Mantener lo necesario para el servicio y obligaciones legales.
4. Actualizar preferencias y supresiones técnicas.
5. Confirmar por escrito.

### 7.5 Limitación o revocación del consentimiento

1. Identificar la base y el alcance.
2. Actualizar la preferencia en el sistema correspondiente.
3. Detener la finalidad secundaria.
4. Informar que el servicio principal no se condiciona a ella.

---

## 8. Causas de improcedencia

- El titular no acredita identidad o representación.
- El dato no existe o no corresponde al titular.
- Existe obligación legal de conservar.
- Afecta derechos de terceros.
- La solicitud es manifiestamente excesiva o repetitiva sin justificación.
- Se trata de datos de una operación ya cerrada que deben conservarse.

Toda improcedencia se responde por escrito, con motivo y vía de inconformidad.

---

## 9. Plantillas de respuesta

### Acuse

> Recibimos tu solicitud **ARCO-YYYYMMDD-####** el **DD/MM/AAAA**. Estamos
> verificando tu identidad y localizando la información. Te responderemos en un
> plazo máximo de 20 días hábiles, prorrogable por 10 días hábiles si es necesario.

### Acceso (procedente)

> En atención a tu solicitud **ARCO-…**, adjuntamos el extracto de tus datos,
> finalidades, destinatarios y plazos de conservación. Si detectas una inexactitud,
> puedes solicitar rectificación.

### Rectificación (procedente)

> Se corrigió el dato **[…]**. El cambio quedó registrado el **DD/MM/AAAA** y se
> notificó a los encargados correspondientes cuando aplicó.

### Cancelación (procedente)

> Se suprimieron tus datos de **[sistemas]**. Se conservan **[datos]** por
> **[obligación legal/plazo]**, con acceso restringido. Se revocaron tus sesiones
> y credenciales asociadas.

### Cancelación (parcial)

> No es posible suprimir **[datos]** porque **[obligación legal/disputa]**. Se
> bloquearon y permanecerán restringidos hasta **[fecha]**. El resto fue suprimido.

### Oposición (procedente)

> Detuvimos el tratamiento de tus datos para **[finalidad]**. Mantendremos lo
> necesario para el servicio y obligaciones legales.

### Improcedencia

> Tu solicitud **ARCO-…** no procede porque **[motivo]**. Puedes presentar
> aclaración o acudir a la autoridad competente.

---

## 10. Registro y métricas

Por cada solicitud se conserva:

- Folio, fecha de recepción, canal y titular.
- Documentación de identidad (cifrada).
- Derecho ejercido y descripción.
- Sistemas consultados y resultado.
- Fecha de respuesta, prórroga y ejecución.
- Evidencia de entrega y acuse.
- Motivo de improcedencia o retención.
- Actor que aprobó y ejecutó.

**Métricas mensuales:** recibidas, resueltas, tiempo promedio, prórrogas,
improcedentes, incidentes.

---

## 11. Prueba controlada (para cerrar el hallazgo)

1. Crear un usuario de prueba con datos ficticios.
2. Enviar solicitud de acceso y medir el flujo completo.
3. Verificar que el extracto no incluya datos de terceros.
4. Ejecutar rectificación y confirmar propagación.
5. Ejecutar cancelación y verificar revocación de sesiones/passkeys.
6. Confirmar que la evidencia quedó archivada.
7. Documentar tiempos reales y corregir el procedimiento.

**Criterio de cierre:** un caso de cada derecho ejecutado de inicio a fin, con
evidencia y tiempos dentro del plazo.
