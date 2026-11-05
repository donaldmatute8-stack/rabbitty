# ADR-014 · POS con sesión propia, Admin protegido y onboarding por nicho

**Fecha:** 2026-11-04 · **Estado:** Fases 0–5 + re-onboarding (flags apagados) · deploy pendiente
**Contexto:** en producción. Regla: **solo cambios aditivos + feature flag** hasta validar.

---

## 1 · Auditoría del flujo actual (lo que hay)

| Pieza | Estado real |
|---|---|
Auth del admin | **NextAuth** (`apps/admin`) + endpoints propios: `2fa`, `passkey-login`, `otp`, `pairing`, `qr` |
Auth del POS | **No tiene sesión propia**: el layout `(pos)/layout.tsx` valida con `admin.getProfile` → **depende de la sesión del admin** |
Contexto de sucursal | `x-branch-id` validado en el route handler (tenancy) |
PIN | **`staff.pinCode` ya existe** por empleado, con `role` (WAITER/CASHIER/KITCHEN/MANAGER/ADMIN) y bloqueo por intentos |
PIN de admin | Hoy se usa **solo para salir** del POS al dashboard (y con gracia de 15 min) |
Dispositivo | `pushDevices` (push) y `trustedSessions` (2FA) — **no hay modelo de terminal POS** |
Nicho | Solo `ownedBusinesses.category` (texto libre) |

**Conclusión:** el PIN por empleado ya está; lo que falta es (a) sesión de terminal
independiente del admin, (b) nicho explícito, (c) reautorización móvil.

---

## 2 · Paso 0 · Nichos (antes que nada)

`niches` (catálogo) + `ownedBusinesses.niche`, con **capacidades por nicho**:

```json
{ "tables": true, "kitchen": true, "menu": true, "reservations": false,
  "tips": true, "inventory": true, "recipes": true, "barcode": false }
```

Incluye: restaurante, cafetería, bar, panadería, pizzería, taquería, barbería,
gym, retail, servicios y "otro". El onboarding **empieza eligiendo nicho**, y de
ahí se derivan los módulos que se muestran (POS, KDS, mesas, citas…).

Backfill hecho con la categoría actual (2 restaurant, 1 fitness).

**Por qué primero**: sin esto, cada nicho nuevo vuelve a tocar onboarding, POS y
permisos. Con `capabilities` se configura, no se programa.

---

## 3 · Los tres niveles

| Nivel | Qué es | Vida | Qué NO puede |
|---|---|---|---|
**A · Terminal** | Dispositivo registrado por el admin (sucursal + caja) | Larga, revocable | Entrar al admin |
**B · Empleado** | Turno identificado con **su PIN** (`staff.pinCode`) | Su jornada | Cambiar sucursal/caja, tocar configuración |
**C · Admin** | Sesión administrativa (NextAuth + 2FA) | Corta | — |

Regla de oro: **salir del POS no revoca la terminal**. Lo que se protege es el
admin, no la operación diaria.

---

## 4 · Fases (con criterio de no-regresión)

| Fase | Qué | Riesgo | Cómo se protege |
|---|---|---|---|
**0** | Catálogo de nichos + `ownedBusinesses.niche` | **nulo** (aditivo) | ✅ ya aplicado |
**1** | `pos_terminals` + `pos_terminal_sessions` + endpoints de activación/validación | bajo | ✅ aplicado · flag `POS_TERMINAL_SESSIONS`; apagado, el POS sigue con la sesión de admin |
**2** | POS usa la sesión de terminal (layout/route handler) | **medio** | ✅ aplicado · doble lectura (terminal **o** admin), allowlist de routers y telemetría de uso |
**3** | PIN del empleado al iniciar turno (`pos_operator_sessions`) | bajo | ✅ aplicado · flag `POS_OPERATOR_SESSIONS`; el PIN es `staff.pinCode` con lockout |
**3.5** | Permisos por rol (matriz única servidor + UI) | bajo | ✅ aplicado · terminal con turno siempre; panel admin con `POS_ROLE_ENFORCEMENT=1` |
**4** | Reautorización desde el móvil (`pos_auth_requests`) | bajo | ✅ aplicado · código de 6 dígitos + QR, aprobación con sesión de admin |
**5** | Pantalla de terminales (revocar, historial) | bajo | ✅ aplicado · `/settings/terminals`: listar, ver turno, cerrarlo y revocar |

---

## 5 · Flujo objetivo

```
App instalada → ¿terminal autorizada?
    ├── sí  → PIN del empleado → POS (opera)
    └── no  → activación con cuenta admin → registra terminal → POS

POS ──[Administración]──► pide auth admin (2FA) ──► admin
      ▲                                              │
      └──────── volver al POS: NO pide clave ────────┘

Terminal vencida/revocada:
   POS muestra código corto → admin lo aprueba en el móvil → POS recibe
   autorización de TERMINAL (nunca un token de admin)
```

---

## 6 · Controles de seguridad

- `deviceKeyHash`: se guarda **solo el hash** del secreto del dispositivo.
- El token de terminal es **propio**, con expiración y revocación; el POS nunca
  recibe tokens de administrador.
- Código de reautorización: un solo uso, expiración corta, ligado a
  terminal+sucursal, auditado (`resolvedBy`, `resolvedAt`).
- Revocación remota: nuevas operaciones bloqueadas, la UI pide reautorización.
- El empleado **no** puede cambiar sucursal/caja ni tocar configuración.

---

## 7 · Lo que NO cambia (para no romper producción)

- Los chats, pedidos, pagos y Live Activity: intactos.
- El PIN de admin al salir sigue existiendo (con su gracia de 15 min).
- Si el flag está apagado, el POS funciona **exactamente** como hoy.

---

## 8 · Fase 2 implementada (autorización del POS)

**Cómo se resuelve la identidad** (`apps/admin/src/app/api/trpc/[trpc]/route.ts`):

1. Si `POS_TERMINAL_SESSIONS=1` y llega `x-pos-terminal-token`, se valida contra
   `pos_terminal_sessions` + `pos_terminals` (sesión no revocada, terminal
   ACTIVE, sin vencimientos) y se verifica que su sucursal exista y esté activa.
2. Ese principal se expone como `ctx.posAuth = { method: 'terminal', … }` y fija
   `ctx.branchId` a **su** sucursal.
3. La sesión de admin se sigue leyendo igual. Si existe, se mantiene
   (`ctx.userId`), pero la sucursal del POS es la de la terminal.
4. Con el flag apagado, no se toca la DB ni el contexto: comportamiento actual.

**Procedimientos**

- `posProcedure` = admin (idéntico a `protectedProcedure`) **o** terminal.
- La terminal solo puede llamar namespaces del POS: `pos.*`, `payments.*`,
  `memberships.*`, `cashDrops.*`, `printing.*` y `staff.verifyAdminPin`.
  Cualquier otro path (`admin.*`, `sandbox.*`, etc.) sigue siendo solo admin.
- `resolveBranchId` devuelve siempre la sucursal de la terminal: no puede
  cambiarla con `x-branch-id` ni con input, aunque sea del mismo tenant.
- Rate limit por **sesión de terminal** (no cae en el cubo `anonymous`).

**Entrada del POS**

- `posTerminals.sessionContext` responde `{ mode: 'terminal' | 'admin', branchId,
  businessId, role, branches }`. Es la puerta del layout.
- `/pos/link` vincula el dispositivo: genera el secreto local, llama `activate`
  (requiere admin), guarda la sesión y redirige al POS. Revocar borra la sesión
  local y revoca en el servidor.
- El header de terminal solo se envía en `/pos*` y `/kiosk` (nunca en el panel
  admin), para que una terminal vinculada no cambie la sucursal del admin.

**Telemetría**

- `pos_terminal_sessions.useCount` / `lastUsedAt` (una escritura cada 5 min).
- `console.info('[POS_AUTH]', …)` una vez por arranque del POS: dice si entró
  como `terminal` o `admin`. Con eso se mide adopción sin escribir por request.

**Pruebas hechas (local, flag ON)**

- Token válido → `sessionContext` modo terminal y `pos.getCategories` 200.
- Token válido → `admin.getProfile` 401 (allowlist funciona).
- Sin token / token inválido / sesión revocada / terminal revocada → 401/403.
- `useCount` y `lastUsedAt` se actualizan; log `[POS_AUTH] method=terminal`.

**Límites conocidos de la Fase 2**

- `apps/pos` (POS standalone) tiene su propio `api/trpc`: no se tocó.
- El empleado aún no tiene identidad propia (Fase 3): el PIN de gerente se
  valida contra la sucursal, pero no hay turno por empleado.
- La administración de terminales (listar/revocar) sigue siendo Fase 5.

---

## 9 · Fase 3 implementada (turno del empleado)

**Identidad en dos capas**

| Capa | Qué identifica | Token |
|---|---|---|
Terminal | El **dispositivo** | `x-pos-terminal-token` (Fase 2) |
Turno | La **persona** | `x-pos-operator-token` |

El token de turno **solo se resuelve si antes hay terminal válida**. Robarlo no
sirve sin el dispositivo.

**Flujo**

```
/pos (terminal autorizada)
   │  flag POS_OPERATOR_SESSIONS=1 y sin turno
   ▼
PosShiftGate · "Inicia tu turno" (PIN de 4 dígitos)
   │  POST posOperators.startShift { pin }
   ▼
pos_operator_sessions (token 64 hex, 16 h) → POS opera
   │
   └─ "Terminar turno" → cierra el turno y vuelve al PIN (la terminal sigue)
```

**Endpoints** (`terminalProcedure`, solo terminal — el admin no inicia turnos)

- `posOperators.status` — `required`, `active`, `operator`, `terminalName`.
- `posOperators.staffList` — nombres/roles con PIN; nunca el hash.
- `posOperators.startShift` — valida PIN contra `staff.pinCode` de la sucursal.
- `posOperators.endShift` — cierra el turno (y huérfanos de esa terminal).

**Seguridad**

- PIN con scrypt + `timingSafeEqual` (el mismo `verifyPin` de caja).
- Lockout por sucursal: 5 fallos → 5 minutos (`pin_attempts`).
- Un turno abierto por terminal; al iniciar se cierran los huérfanos.
- Turno atado a `terminalId` y a la sucursal; si el empleado se desactiva o
  cambia de sucursal, el turno deja de resolver.
- Vence a las 16 h (se renueva volviendo a meter el PIN).
- `endShift` / revocación de terminal no requieren admin: el dispositivo manda.
- Auditoría: las mutaciones con turno guardan `staffId`, `staffRole`, `terminalId`.
- Telemetría: `lastSeenAt` (cada 5 min) y `[POS_OPERATOR] start|end`.

**UI**

- `PosShiftGate`: teclado numérico, puntos, mensaje de lockout, aviso si no hay
  empleados con PIN. Se monta en el layout solo en `/pos*` (no `/kiosk`, no
  `/pos/link`).
- El botón "Dashboard" se convierte en "Terminar turno" cuando hay turno activo.

**Pruebas hechas (local, ambos flags ON)**

- `status` sin turno → `required:true, active:false`.
- PIN incorrecto → 401; 5 fallos → 429 con mensaje de lockout.
- PIN correcto → token + operador (nombre/rol) y `status.active:true`.
- `pos.*` con terminal + turno → 200.
- Token de turno **sin** terminal → 403.
- `startShift` sin terminal → 403.
- `endShift` → `closed:true` y `status.active:false`.
- Logs `[POS_OPERATOR] start/end` correctos.

**Límites**

- El turno no cambia permisos por rol: todos los empleados con PIN operan el POS.
  Restringir acciones por rol (mesero vs cajero) es una fase posterior.
- `apps/pos` standalone sigue fuera de este circuito.

---

## 10 · Permisos por rol (Fase 3.5)

Una sola matriz en `packages/api/src/services/posPermissions.ts`, usada por el
servidor y por la UI. El rol **nunca** amplía el alcance de sucursal.

| Rol | Pedidos | Cobrar | Caja | Descuentos/Cortesías | Reembolsos | Config | Reportes |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
Propietario / Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
Gerente | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
Cajero | ✅ | ✅ | ✅ | — | — | — | — |
Mesero | ✅ | ✅ | — | — | — | — | — |
Cocina | — | — | — | — | — | — | — |

**Enforcement**

- Terminal con turno: **siempre** se aplica (camino nuevo).
- Terminal sin turno (flag de turnos encendido): sin rol → acciones sensibles
  bloqueadas; lecturas permitidas.
- Panel admin: se aplica solo con `POS_ROLE_ENFORCEMENT=1`. La UI ya respeta la
  matriz en ambos casos, así que se puede activar sin tocar código.

**Endpoints anotados**

| Permiso | Endpoints |
|---|---|
`POS_CASH` | `cashShifts.open/withdraw/partialClose/handover/close`, `cashDrops.createDrop/updateSettings` |
`POS_CHARGE` | `pos.directCheckout`, `pos.createStripeChargeIntent`, `pos.releaseCustomerTab`, `payments.processPayment/splitBill/addTip` |
`POS_DISCOUNT` | `memberships.grantCourtesy/revokeCourtesy/revokePaidMembership/renewPaidMembership` |
`POS_REFUND` | `payments.refund` |
`POS_SETTINGS` | `payments.createStripeConnectLink` |

`posProcedure` y `cashShifts.*` ya aceptan terminal (se añadió `cashShifts.` a la
allowlist de la Fase 2).

**UI**

- Badge del rol + nombre del empleado en el header del POS.
- `openCashShift` y los cobros pasan por la matriz: si el rol no puede, toast
  explicativo (“Tu rol (Mesero) no permite abrir, cerrar y mover caja”).
- El aviso de “retiro requerido” solo aparece si el rol puede operar caja.
- Si la caja está cerrada y el rol no puede abrirla, se le pide llamar a un
  cajero/gerente en vez de abrir un modal inútil.

**Límites**

- `voidItem` valida el **PIN de gerente en el servidor** (no solo en la UI), así
  que un mesero puede pedir autorización sin que el rol habilite la anulación.
- Cocina (KITCHEN) no opera el POS: su pantalla es `/kitchen`.

---

## 11 · Fase 4 implementada (reautorización móvil)

**Flujo**

```
Terminal con sesión inválida/vencida
   │  "Solicitar autorización"
   ▼
POST posTerminals.createAuthRequest { deviceKey }
   │  código de 6 dígitos (10 min) + QR
   ▼
Admin escanea el QR → /pos/auth?code=XXXXXX (su teléfono, su sesión)
   │  authRequestDetail → Aprobar / Rechazar
   ▼
Terminal hace polling (3 s) → APPROVED → issueSession { deviceKey }
   │
   ▼
Nueva sesión guardada → POS abre (turno por PIN si aplica)
```

**Endpoints**

| Endpoint | Quién | Nota |
|---|---|---|
`createAuthRequest` | público + `deviceKey` | idempotente: reutiliza el código vivo; máx. 3 cada 10 min por terminal |
`authRequestStatus` | público + `deviceKey` | el código **no** se puede consultar sin el dispositivo |
`issueSession` | público + `deviceKey` | solo si la terminal sigue ACTIVE y autorizada |
`authRequestDetail` | admin/manager | valida que la terminal sea de su sucursal |
`pendingAuthRequests` | admin/manager | lista de solicitudes vivas de la sucursal |
`resolveAuthRequest` | admin/manager | aprueba/deniega; al aprobar extiende la autorización |

**Contexto**: una terminal sin sesión no tiene sucursal, así que los endpoints
públicos de recuperación (`featureEnabled`, `status`, `issueSession`,
`createAuthRequest`, `authRequestStatus`) se permiten explícitamente sin
tenancy y se validan por dentro con el `deviceKey`.

**Seguridad**

- Código de 6 dígitos + `deviceKey`: sin el dispositivo no se puede consultar
  ni canjear.
- Expira en 10 minutos; un solo uso (`PENDING` → `APPROVED/DENIED`).
- La aprobación exige sesión de admin/manager y terminal de su sucursal.
- Reutilizar el código vivo evita spamear al administrador.
- Telemetría: `[POS_AUTH_REQUEST] created`.

**Aviso al dueño**

- Canal principal: **app nativa**. El admin llama a
  `POST {RABBITTY_MINIAPP_URL}/api/notifications/send` con
  `x-push-secret: PUSH_SEND_SECRET`; el proyecto mobile encola en outbox y
  entrega por APNs. La notificación abre `/pos/auth?code=…`.
- `telegram-miniapp/src/app/pos/auth` es un **puente**: muestra el código y abre
  `admin.rabbitty.me/pos/auth?code=…` (la aprobación real requiere sesión de
  admin). Así el deep link funciona dentro de la app nativa.
- Respaldo: Telegram, solo si el push no registró ninguna entrega.

**UI**

- `PosReauthPanel` (terminal): código grande, QR, cuenta regresiva, polling y
  canje automático de la sesión. Si la terminal fue revocada, pide revincular.
- `/pos/auth` (móvil del admin): detalle, aprobar/rechazar, entrada manual del
  código y lista de solicitudes pendientes de la sucursal.

**Pruebas hechas (local)**

- `status` sin sesión y sin sucursal → `EXPIRED` (endpoint público OK).
- `createAuthRequest` sin sesión → código; segunda llamada → mismo código (`reused`).
- `authRequestStatus` con otro `deviceKey` → `NOT_FOUND`.
- Aprobación simulada → `APPROVED` → `issueSession` → `pos.getCategories` 200.
- `authRequestDetail` sin admin → denegado.
- `/pos`, `/pos/auth`, `/pos/link` compilan.

**Límites**

- La notificación nativa depende de que APNs esté configurado en el proyecto
  mobile; sin APNs no hay entrega y entra el respaldo de Telegram.
- La aprobación aún no manda push al admin; el aviso es el código/QR en la
  terminal y la lista de pendientes.

---

## 12 · Fase 5 implementada (gestión de terminales)

**Backend**

- `posTerminals.overview` (admin/manager): terminales de la sucursal con su
  turno abierto (nombre y rol del empleado), última conexión, vencimiento y
  solicitudes de reautorización vivas.
- `posTerminals.forceEndShift`: cierra el turno de una terminal sin revocarla
  (relevo de personal). Valida que la terminal sea de su sucursal.
- `posTerminals.shiftHistory`: historial paginado por cursor (quién, en qué
  terminal, inicio, fin y duración).
- `createAuthRequest` avisa al dueño por la **app nativa** (endpoint interno de
  push del proyecto mobile → outbox + APNs). Si no hay entrega, cae a
  **Telegram** como respaldo. No bloquea la solicitud si el aviso falla.
- `revoke`: además de anular sesiones, cierra cualquier turno abierto.

**UI** (`/settings/terminals`, en el sidebar como “Terminales POS”)

- Estado del modo terminal (activo/apagado) con la variable que lo controla.
- Tarjeta por terminal: estado (`Activa / Vencida / Revocada`), plataforma,
  alta, última conexión, vencimiento y **turno abierto**.
- Acciones: “Cerrar turno” y “Revocar” (con confirmación y refresh inmediato).
- Bloque de solicitudes pendientes con enlace directo a `/pos/auth?code=…`.
- **Historial de turnos** con carga incremental.
- Estado vacío con la instrucción correcta: vincular desde `/pos/link` en el
  dispositivo (el secreto nunca viaja al panel).

**Límites**

- No se vincula desde el panel: sigue siendo un acto del dispositivo.
- No hay historial paginado de sesiones; se muestran última conexión y turno
  actual. Un historial completo puede colgarse de `pos_terminal_sessions`.

---

## 13 · Siguiente paso (operación)

El circuito completo (nichos → terminal → turno → roles → reautorización →
gestión) está implementado con **todos los flags apagados**. Para llevarlo a
producción sin sorpresas:

1. **Deploy del código** con los flags apagados. El POS se comporta igual que hoy.
2. Verificar POS/Admin normales (cobro, caja, turnos).
3. Activar `POS_TERMINAL_SESSIONS=1` y vincular UNA terminal real desde
   `/pos/link`; validar cobro y revocación desde `/settings/terminals`.
4. Activar `POS_OPERATOR_SESSIONS=1`; validar PIN de cada rol y permisos.
5. Activar `POS_ROLE_ENFORCEMENT=1` para aplicar la matriz también al panel
   admin (opcional; la UI ya la respeta).
6. Re-ingestar el RAG de Bunzy (script del ADR-015).

Mejoras posteriores (no bloquean): `apps/pos` standalone (tiene su propio
`api/trpc` y auth), exportar el historial de turnos a CSV, y aprobación inline
en la app sin salir a admin (requiere sesión de admin en el móvil).


---

## 14 · Configuración (flags) y multitenant

Los flags son **globales por entorno**, no por tenant. Activar el modo terminal
no obliga a nadie a usarlo: solo habilita la capacidad; cada negocio decide qué
dispositivos vincula. **No hay que agregar variables por cada tenant nuevo.**

| Necesidad futura | Dónde va |
|---|---|
¿Este negocio usa PIN de turno? | preferencia en DB por negocio/sucursal, no env |
¿Este nicho necesita mesas/KDS? | `niches.capabilities` (ya existe) |
¿Esta terminal está activa? | `pos_terminals` (datos) |

`POS_TERMINAL_PEPPER` es opcional pero recomendable en producción **antes** de
vincular terminales: cambiarlo después obliga a revincular los dispositivos.

### Variables para el aviso nativo (solo en el admin de Railway)

| Variable | Valor |
|---|---|
`RABBITTY_MINIAPP_URL` | `https://app.rabbitty.me` |
`PUSH_SEND_SECRET` | **el mismo** que tiene el proyecto mobile en Vercel |


---

## 15 · Re-onboarding de tenants existentes

Los negocios que ya operan no pasaron por el onboarding nuevo (nicho, copy de
Bunzy, módulos). En lugar de pedirles datos otra vez, se les muestra **una vez**
una pantalla con lo que YA tienen inyectado.

**Modelo**

- `ownedBusinesses.onboardingCompletedAt` (migración `0044`, nullable).
- `NULL` + `status` `APPROVED`/`VERIFIED` → pendiente de revisar.
- Las altas nuevas desde la miniapp se marcan completas al crear el negocio
  (ya hicieron su onboarding).
- El staff no se redirige; el God Admin sin negocio tampoco.

**Flujo**

```
Login al admin (dueño)
   │  OnboardingGate consulta admin.onboardingStatus
   ▼
/onboarding · MISMO flujo de 5 pasos que el alta web
   1. Nicho (prellenado con el actual)
   2. Datos actuales (solo lectura; "Editar en Ajustes")
   3. Recompensa actual
   4. Paquete y crédito actuales
   5. Confirmación (checkbox + Confirmar / Saltar)
   · Bunzy: video por paso + burbuja de typing
   ▼
completeOnboarding → guarda nicho (si cambió) + timestamp
   ▼
Dashboard (y checklist de Preparación reiniciado, con pasos ya detectados)
```

No hay aprobación ni cambios de estado: el negocio ya está APPROVED. Solo se
revisa la información inyectada y se confirma.

**Endpoints**

| Endpoint | Qué hace |
|---|---|
`admin.onboardingStatus` | `pending` + negocio + conteos de lo inyectado |
`admin.onboardingNiches` | catálogo activo de nichos |
`admin.completeOnboarding` | valida el nicho, actualiza y marca completado |

**Repetirlo a propósito** (solo el negocio que quieras):

```sql
UPDATE "ownedBusinesses"
SET "onboardingCompletedAt" = NULL
WHERE id = '<businessId>';
```

---

## 16 · Auditoría final (gaps cerrados)

| Gap | Corrección |
|---|---|
Solicitud de reautorización vencida podía aprobarse | `resolveAuthRequest` la marca `EXPIRED` y rechaza |
Derivación de nicho por categoría: “Barbería” → `bar` y “Restaurante” → `barbershop` | reglas regex específicas y orden correcto |
`PATCH /api/business` no aceptaba `niche` | validado contra el catálogo y actualizado |
Solicitud de un giro **activo** | se rechaza con “ya está disponible, selecciónalo en la lista” |
Dedupe de solicitudes distinguía mayúsculas | comparación `ilike` |
Tras reautorizar, el dispositivo podía guardar `terminalId` vacío | se consulta `status` y se guarda el id real |
Catálogo de nichos cacheado indefinidamente en la miniapp | `cache: 'no-store'` |
Bunzy con un nicho sin copy mostraba “undefined” | fallback de copy |


---

## 17 · Flujo desde la landing (rabbitty.me)

**Antes**: el CTA de negocios abría el login del admin viejo y el formulario de
solicitud de la landing (`/api/apply`) mandaba un lead que se aprobaba aparte.

**Ahora**:

```
rabbitty.me
  ├─ "Soy negocio" / "Crear mi negocio" / elegir paquete
  │      → app.rabbitty.me/business?intent=affiliate&from=landing
  │      → login/registro (teléfono) → onboarding por nicho + Bunzy
  │
  └─ "Ya tengo cuenta" → admin.rabbitty.me/login (solo tenants existentes)
```

- La intención se guarda en `localStorage` (`rabbitty_intent_affiliate`) y se
  respeta después del login, del registro y del fast-login. Sin eso, un usuario
  nuevo aterrizaba en el home de consumidor.
- El onboarding **se consume** al crear el negocio o al abrir el dashboard de
  afiliado (se limpia la intención).
- La selección de paquete de la landing ya no abre el formulario viejo: manda
  al onboarding (se conserva el evento `Lead` para analítica). El modal de
  `/api/apply` queda retirado de la UI; el endpoint se conserva por
  compatibilidad.

**Aprobación (el flujo que ya existía)**

- Las altas sin Google verificado nacen `PENDING`; el God Admin las aprueba en
  `/restaurants`, que ahora muestra el **nicho**.
- Al aprobar se aprovisiona **restaurante + sucursal** (idempotente) si el
  negocio aún no los tiene. Sin esto, el negocio aprobado no podía entrar al
  admin ni operar el POS.
- El alta auto-aprobada (Google verificado) aprovisiona en el mismo momento.
- El dueño recibe aviso por **app nativa** (push) y Telegram como respaldo, con
  la URL del panel. Entra con su teléfono o correo (el login del admin soporta
  ambos).


---

## 18 · Onboarding web de negocios (`/negocios`)

El canal principal de alta es la web. La app queda como alternativa para quien
ya la usa.

**Flujo**

```
rabbitty.me
  ├─ "Soy negocio" · "Crear mi negocio" · elegir paquete
  │     → /negocios
  │        1. Nicho (catálogo DB)
  │        2. Datos del negocio + contacto
  │        3. Recompensa Bunz (2–50%)
  │        4. Paquete de crédito
  │        5. Firma + aceptación
  │     → POST /api/apply
  │        · ownedBusinesses PENDING + niche + reward + package + credit
  │        · onboardingCompletedAt = ahora
  │        · correo de confirmación al solicitante + Telegram al equipo
  │
  └─ "Ya tengo cuenta" → admin.rabbitty.me/login
```

**Aprobación**

- El God Admin aprueba en `/restaurants` (ve el nicho).
- Se aprovisiona **restaurante + sucursal** (idempotente) y se envía:
  - **email de aprobación** al dueño (canal principal para leads web),
  - push a la app si la tiene,
  - Telegram solo como respaldo.
- El dueño entra a `admin.rabbitty.me/login` con su correo o teléfono.
- Como `onboardingCompletedAt` se marcó al crear, **no** pasa por el
  re-onboarding de tenants existentes; entra directo a su panel.

**Bunzy en web**

El onboarding web (alta y re-onboarding) incluye la **burbuja de Bunzy con
typing** además del video por paso. Así el flujo no se siente como un formulario
y mantiene el mismo lenguaje que la app móvil.

**Aviso no bloqueante en el POS**

Si el negocio tiene el re-onboarding pendiente, el POS muestra un **banner
informativo una sola vez por dispositivo** ("Configuración de tu negocio" →
Revisar). No bloquea cobro, turno ni terminal; el gate completo sigue viviendo
en el dashboard. El aviso se apaga con `localStorage` al revisarlo o cerrarlo.

Los tres tenants iniciales: **Ka13 y Bull Box** se marcaron completos
(`onboardingCompletedAt = NOW()`); **626 Café** queda pendiente para que lo vea
una vez. Para repetirlo:

```sql
UPDATE "ownedBusinesses"
SET "onboardingCompletedAt" = NULL
WHERE id = 'fb7f4847-920f-4482-8ae3-c810a20e75ad';
```

**Archivos**

| Archivo | Rol |
|---|---|
`landing-page/src/app/negocios/page.tsx` | Onboarding web (5 pasos + éxito) |
`landing-page/src/components/BunzyTypingBubble.tsx` | Burbuja de Bunzy con typing en web |
`apps/admin/src/components/BunzyTypingBubble.tsx` | Misma burbuja en el re-onboarding |
`landing-page/src/app/negocios/layout.tsx` | Metadata / SEO |
`landing-page/src/app/api/niches/route.ts` | Catálogo activo desde DB |
`landing-page/src/app/api/apply/route.ts` | Alta: validación, DB, email, Telegram |
`landing-page/src/components/BunzyVideoStage.tsx` | Videos de Bunzy (copia local) |
`landing-page/src/app/page.tsx` | CTAs → `/negocios` (nicho + paquete) |
`packages/api/src/routers/admin.ts` | Aprobación: provisioning + email/push/Telegram |

**Notas**

- Dedupe por `ownerId`: si el contacto ya tiene negocio, no se duplica; la
  respuesta marca `existing`.
- El formulario viejo de la landing quedó retirado de la UI; `/api/apply` se
  conserva y ahora es el backend del onboarding nuevo.
- El correo de confirmación usa Resend (`RESEND_API_KEY`/`AUTH_RESEND_KEY`/
  `RESEND_KEY`); si falta la clave, la solicitud se registra pero no se envía.
