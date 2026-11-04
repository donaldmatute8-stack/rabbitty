# ADR-014 · POS con sesión propia, Admin protegido y onboarding por nicho

**Fecha:** 2026-11-04 · **Estado:** cimentación aplicada (aditiva) · **Wiring pendiente**
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
**1** | `pos_terminals` + `pos_terminal_sessions` + endpoints de activación/validación | bajo | flag `pos_terminal_sessions`; si está apagado, el POS sigue con la sesión de admin (comportamiento actual) |
**2** | POS usa la sesión de terminal (layout/route handler) | **medio** | doble lectura: acepta terminal **o** admin; telemetría de cuál se usó |
**3** | PIN del empleado al iniciar turno (`pos_operator_sessions`) | bajo | opcional por sucursal |
**4** | Reautorización desde el móvil (`pos_auth_requests`) | bajo | solo recuperación |
**5** | Pantalla de terminales (revocar, historial) | bajo | solo lectura + revocar |

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

## 8 · Siguiente paso

Fase 1: endpoints `pos.activateTerminal` / `pos.terminalStatus` /
`pos.issueTerminalSession` + flag, **sin tocar** el layout del POS todavía.
Se valida con el POS actual y solo después se cambia la autorización (Fase 2).
