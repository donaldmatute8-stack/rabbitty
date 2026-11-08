# Registro de Actividades de Tratamiento (RAT)

> **Borrador de trabajo.** Base para la revisión de privacidad. No es una opinión
> legal. La identificación de roles (responsable/encargado) debe confirmarse por
> flujo real, no solo por etiqueta contractual.

**Responsable:** MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. (RABBITTY)
**RFC:** MEB2402087Z3
**Contacto de privacidad:** `privacidad@rabbitty.me`
**Corte:** 8 de noviembre de 2026

---

## 1. Cómo leer este registro

- **Rol RABBITTY:** `R` = responsable; `E` = encargado; `R/E` = depende del flujo.
- **Base legal:** `CT` = relación contractual/precontractual; `LEG` = obligación
  legal; `IL` = interés legítimo; `CON` = consentimiento.
- Las tablas citadas son las del esquema Drizzle del repositorio.
- La conservación es una **propuesta**; se valida en el documento 02.

---

## 2. Actividades

### A01 · Alta y autenticación de Rabbitters

| Campo | Detalle |
|---|---|
| Finalidad | Crear cuenta, autenticar, recuperar acceso, prevenir abuso |
| Titulares | Usuarios (Rabbitters) |
| Datos | Nombre, usuario, correo, teléfono, Telegram ID, wallet TON, credenciales, TOTP, passkeys (llave pública y metadatos), dispositivos push, sesiones, IP/UA |
| Base legal | CT, IL (seguridad), LEG (cuando aplique) |
| Rol | R |
| Encargados | Railway, Neon, AWS S3, APNs, Telegram, Resend, SignalWire |
| Tablas | `users`, `passkeys`, `trustedSessions`, `pushDevices`, `verificationTokens`, `webSessions` |
| Conservación | Cuenta activa + 5 años para evidencia; logs 12 meses |
| Notas | No se guardan plantillas biométricas; passkey = credencial pública |

### A02 · Programa de recompensas Bunz

| Campo | Detalle |
|---|---|
| Finalidad | Acumular, transferir y redimir Bunz; estados de cuenta; antifraude |
| Titulares | Rabbitters y afiliados |
| Datos | Saldos, movimientos, ledger, recompensas, redenciones, reversos, obligaciones |
| Base legal | CT, LEG (contable/fiscal), IL (fraude) |
| Rol | R |
| Encargados | Neon, Railway |
| Tablas | `users`, `transactions`, `bunz_ledger_entries`, `bunz_obligations`, `bunz_redemption_attempts`, `bunz_reserves`, `ledger_entries` |
| Conservación | 5 años (fiscal/contable), validar con contador |
| Notas | Bunz no son dinero electrónico ni convertibles a efectivo |

### A03 · Alta y operación de afiliados

| Campo | Detalle |
|---|---|
| Finalidad | Verificar negocio, representación y facultades; operar sucursales y menú |
| Titulares | Afiliados, representantes legales, personal autorizado |
| Datos | Nombre comercial, razón social, RFC, domicilio, categoría, horarios, sucursales, menú, documentos de facultades, contacto |
| Base legal | CT, LEG (fiscal), CON (cuando aplique) |
| Rol | R |
| Encargados | Neon, Railway, AWS S3 |
| Tablas | `ownedBusinesses`, `restaurants`, `branches`, `staff`, `menu_*`, `billingProfiles` |
| Conservación | Relación activa + 5 años |
| Notas | El nombre comercial no sustituye a la parte contratante |

### A04 · Pedidos, pagos y entregas

| Campo | Detalle |
|---|---|
| Finalidad | Registrar consumo, cobrar, conciliar, entregar, facturar |
| Titulares | Clientes/Rabbitters, personal del afiliado |
| Datos | Folio, productos, importes, propina, método de pago, Bunz aplicados/ganados, dirección de entrega, teléfono, estado, CFDI |
| Base legal | CT, LEG (fiscal) |
| Rol | R/E (el afiliado es responsable de su relación comercial; RABBITTY puede ser encargado) |
| Encargados | Stripe, Uber Direct, Neon, Railway |
| Tablas | `orders`, `order_items`, `payments`, `paymentIntents`, `deliveries`, `invoices`, `customers` |
| Conservación | 5 años (fiscal/contable) |
| Notas | Dirección y teléfono solo para entrega; no usar para marketing sin base |

### A05 · Reservaciones y lista de espera

| Campo | Detalle |
|---|---|
| Finalidad | Gestionar reservas y fila del establecimiento |
| Titulares | Clientes |
| Datos | Nombre, teléfono, tamaño de grupo, hora, notas, mesa |
| Base legal | CT (servicio solicitado) |
| Rol | R/E |
| Encargados | Neon, Railway |
| Tablas | `reservations`, `waitlistEntries`, `tables` |
| Conservación | 12 meses salvo obligación o disputa |
| Notas | No incluir datos de salud ni preferencias sensibles en notas |

### A06 · Chat y mensajería

| Campo | Detalle |
|---|---|
| Finalidad | Comunicación entre usuarios, afiliados y soporte |
| Titulares | Rabbitters, afiliados, personal |
| Datos | Contenido de mensajes, metadatos, adjuntos, llaves públicas de dispositivo, estado de lectura, edición/borrado |
| Base legal | CT, CON (cuando el canal lo requiera), IL (seguridad) |
| Rol | R/E |
| Encargados | Neon, Railway, AWS S3 |
| Tablas | `conversations`, `conversationMembers`, `messages`, `userDeviceKeys`, `conversationKeys`, `messageHides`, `chat_*` |
| Conservación | Hasta borrado + 30 días; disputas según necesidad |
| Notas | Mensajes E2E: el servidor guarda cifrado; no puede leer el contenido |

### A07 · Notificaciones y marketing

| Campo | Detalle |
|---|---|
| Finalidad | Avisos operativos, push, correo, campañas, Bunzy Connect |
| Titulares | Rabbitters, afiliados |
| Datos | Token push, plataforma, preferencias, correo, teléfono, entregas, lecturas, clics |
| Base legal | CT (operativas), CON/IL (marketing) |
| Rol | R |
| Encargados | APNs, Resend, SignalWire, Telegram, Neon, Railway |
| Tablas | `pushDevices`, `notifications`, `bunzyBroadcasts`, `bunzyDeliveries`, `bunzyPreferences`, `affiliateCampaigns`, `campaigns` |
| Conservación | Marketing hasta oposición; operativas 24 meses |
| Notas | Debe existir opt-out por categoría y canal |

### A08 · Reputación, reseñas y moderación

| Campo | Detalle |
|---|---|
| Finalidad | Calificar servicio, detectar abuso, moderar contenido |
| Titulares | Rabbitters, afiliados, personal |
| Datos | Calificación, comentario, eventos, scores, motivos de moderación |
| Base legal | CT, IL (seguridad/calidad) |
| Rol | R |
| Encargados | Neon, Railway |
| Tablas | `orderRatings`, `orderRatingEvents`, `rabbitterScoreShadow`, `merchantScoreShadow`, `moderationLog` |
| Conservación | 24 meses; moderación 5 años si hay disputa |
| Notas | Los scores son señales internas; no usar para decisiones automatizadas sin revisión |

### A09 · Seguridad, auditoría y antifraude

| Campo | Detalle |
|---|---|
| Finalidad | Prevenir fraude, investigar incidentes, cumplir auditoría |
| Titulares | Todos |
| Datos | IP, UA, sesiones, eventos, señales de abuso, intentos PIN, accesos |
| Base legal | IL (seguridad), LEG |
| Rol | R |
| Encargados | Railway, Neon |
| Tablas | `auditEntries`, `bunzAbuseSignals`, `pinAttempts`, `trustedSessions`, `posTerminalSessions` |
| Conservación | 12 meses logs; 5 años incidentes |
| Notas | Documentar decisiones automatizadas y permitir revisión humana |

### A10 · Evidencia contractual y capacidad

| Campo | Detalle |
|---|---|
| Finalidad | Acreditar aceptación, oferta, recuperación y consentimiento |
| Titulares | Afiliados y representantes |
| Datos | Nombre del firmante, versión, hash, fecha, método, IP/UA, copia, oferta, propuesta, aceptación/rechazo |
| Base legal | CT, LEG (defensa de reclamaciones) |
| Rol | R |
| Encargados | Neon, Railway, Resend |
| Tablas | `merchantRecoveryTerms`, `merchantRecoveryProposals`, `merchantCapacityAccounts`, `affiliate_reonboarding_tokens`, `auditEntries` |
| Conservación | Vigencia + 5 años |
| Notas | Ver hallazgos G1/G2 del documento 00 |

### A11 · Asistente de IA y memoria

| Campo | Detalle |
|---|---|
| Finalidad | Responder consultas, personalizar, extraer preferencias |
| Titulares | Rabbitters, afiliados |
| Datos | Mensajes/consultas, preferencias declaradas o inferidas, embeddings, conocimiento del negocio |
| Base legal | CON (si es opcional), CT (soporte), IL (mejora) |
| Rol | R/E |
| Encargados | OpenAI, Neon, Railway |
| Tablas | `userMemories`, `memoryCandidates`, `knowledgeChunks`, `ai_strategies`, `messages` |
| Conservación | Preferencias hasta supresión/expiración; embeddings mientras exista la fuente |
| Notas | No enviar datos sensibles al modelo; documentar prompts y retención del proveedor |

### A12 · Mood, atmósfera y rutas

| Campo | Detalle |
|---|---|
| Finalidad | Recomendar atmósfera y experiencias; medir preferencias |
| Titulares | Rabbitters (pseudonimizado), afiliados |
| Datos | Mood, rating, feedback, activaciones, sellos de ruta, businessId |
| Base legal | CON, IL (mejora) |
| Rol | R |
| Encargados | Neon, Railway |
| Tablas | `moodEvents`, `moodCampaigns`, `atmosphereInterventions`, `vibePassportStamps` |
| Conservación | 24 meses o hasta supresión |
| Notas | Evitar combinaciones que reidentifiquen sin necesidad |

### A13 · Facturación y datos fiscales

| Campo | Detalle |
|---|---|
| Finalidad | Emitir CFDI, conciliar, cumplir obligaciones |
| Titulares | Afiliados, clientes que facturan |
| Datos | RFC, razón social, régimen, domicilio, uso de CFDI, montos, CFDIs |
| Base legal | LEG |
| Rol | R/E |
| Encargados | Stripe, Neon, Railway |
| Tablas | `invoices`, `billingProfiles`, `orders`, `payments` |
| Conservación | 5 años (CFF art. 30, validar) |
| Notas | No facturar sandbox |

### A14 · Personal y operadores POS

| Campo | Detalle |
|---|---|
| Finalidad | Gestionar turnos, permisos, operación de caja |
| Titulares | Personal del afiliado |
| Datos | Nombre, rol, sucursal, turnos, sesiones, intentos PIN |
| Base legal | CT, LEG (laboral/fiscal) |
| Rol | R/E |
| Encargados | Neon, Railway |
| Tablas | `staff`, `staffShifts`, `posOperatorSessions`, `posTerminalSessions`, `pinAttempts` |
| Conservación | Relación + 5 años |
| Notas | El afiliado es responsable de su personal; RABBITTY procesa por instrucciones |

---

## 3. Datos sensibles y decisiones automatizadas

- **Biometría:** no se recaban plantillas. Face ID/Touch ID se procesa localmente.
- **Passkeys:** se guarda llave pública, contador, transports y nombre del
  dispositivo. No es dato biométrico.
- **Decisiones automatizadas:** reglas de fraude y scores pueden afectar
  operaciones. Debe existir revisión humana y explicación (aviso §12).
- **Menores:** la plataforma no está dirigida a menores sin autorización.

---

## 4. Preguntas abiertas para privacidad

1. ¿En qué flujos RABBITTY es encargado del afiliado y en cuáles responsable?
2. ¿La base legal de marketing es consentimiento o interés legítimo?
3. ¿Qué datos de personal del afiliado debe tratar RABBITTY y con qué instrucción?
4. ¿Se enviarán datos personales a OpenAI? ¿Con qué configuración de retención?
5. ¿Qué regiones de almacenamiento se usarán por proveedor?
6. ¿Cómo se documentará la revisión humana de decisiones automatizadas?
