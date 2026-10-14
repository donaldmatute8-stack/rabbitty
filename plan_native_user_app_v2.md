# 📱 Plan de Arquitectura Corregido: Rabbitty App de Usuarios (Omnicanal)

Este documento incorpora todas las correcciones de auditoría y seguridad para transformar `telegram-miniapp` en una **aplicación nativa multiplataforma (iOS & Android)** manteniendo activa la **Telegram Mini App**, bajo una sola fuente de verdad financiera en el backend.

---

## 🏛️ 1. Correcciones de Seguridad y Arquitectura

### 1.1 Identidad Canónica vs. Vinculación Verificada (No fusión ciega)
* **Principio:** Dos identidades nunca se fusionan porque un usuario escriba un texto coincidente.
* **Modelo Canónico:**
  ```
  User (Canonical Entity)
   ├── id: UUID (Primary Key inmutable)
   ├── totalBunzEarned / totalBunzSpent (Ledger centralizado)
   ├── role: 'USER' | 'AFFILIATE'
   ├── telegramId: String (Opcional, verificado por HMAC initData)
   ├── email: String (Opcional, verificado por OTP de Resend)
   ├── phoneNumber: String (Opcional, verificado por OTP)
   └── appleSub / googleSub: String (Opcional)
  ```
* **Flujo de Vinculación Seguro:**
  1. Si un usuario nativo desea vincular su Telegram, solicita un token efímero firmado (`linkingToken`, TTL = 5 minutos).
  2. La app abre `https://t.me/RabbittyBot?start=link_<token>`.
  3. El backend recibe el webhook de Telegram con la identidad verificada del usuario de Telegram, valida el token efímero y asocia el `telegramId` a la cuenta canónica existente.

### 1.2 Sesiones Seguras y Revocables (No `localStorage` para credenciales sensibles)
* **En la App Nativa:** Se utiliza `@capacitor/preferences` (almacenamiento encriptado de sistema operativo) para resguardar únicamente el `sessionToken` firmado.
* **En el Backend:** Se aprovecha la tabla existente `webSessions` en `@rabbitty/database-core`:
  ```sql
  webSessions (
    id: UUID,
    jwtToken: text UNIQUE,      -- Hash SHA-256 del token de sesión
    userId: UUID REFERENCES users(id),
    expiresAt: timestamp,       -- Expiración forzada
    createdAt: timestamp
  )
  ```
* **Revocación:** El usuario puede cerrar sesión desde cualquier dispositivo y el backend invalida la fila en `webSessions`, rechazando peticiones posteriores inmediatamente.

### 1.3 Estrategia de Publicación Nativa (No dependencia ciega de `server.url`)
* Para pasar la **Guía 4.2 de Apple (Minimum Functionality)** y garantizar estabilidad:
  - Los activos estáticos de la interfaz se compilan dentro del paquete nativo (`webDir: 'out'`).
  - La aplicación arranca instantáneamente sin pantalla en blanco.
  - La sincronización de balances, recompensas, mapa y catálogo se realiza mediante APIs REST/JSON autenticadas (`https://api.rabbitty.me` / `https://app.rabbitty.me/api/*`).

---

## 🛠️ 2. Plan de Implementación de 6 Fases

### Fase 01: Auditoría de Esquema y Migración de Identidad
1. **Esquema de Base de Datos:**
   - Modificar `packages/database-core/src/schema/index.ts`: cambiar `telegramId` a opcional (`text("telegramId").unique()`, sin `.notNull()`).
   - Ejecutar la migración SQL segura:
     ```sql
     ALTER TABLE "users" ALTER COLUMN "telegramId" DROP NOT NULL;
     ```
2. **Verificación de Cuentas Existentes:** Garantizar que ningún usuario actual de Telegram pierda acceso a sus Bunz.

### Fase 02: PlatformBridge (`src/lib/platform.ts`)
Crear una capa de abstracción única que aísle las llamadas de Telegram del entorno nativo:
```typescript
export interface PlatformCapabilities {
  isTelegram: boolean;
  isNative: boolean;
  isWeb: boolean;
  hapticFeedback: (type?: 'light' | 'medium' | 'success' | 'error') => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  getSafeInsets: () => { top: number; bottom: number };
}
```
* Centraliza las vibraciones (llama a Telegram en TMA, o a `@capacitor/haptics` en iOS/Android).
* Elimina márgenes artificiales en `AppOpener.tsx` cuando no se ejecuta dentro de Telegram.

### Fase 03: Gateway de Autenticación Omnicanal
1. **Flujo Telegram (Intacto):** Sigue autenticando automáticamente por `initData` criptográfico validado por HMAC-SHA256.
2. **Flujo Nativo Real:**
   - Implementar verificación OTP por correo mediante el servicio existente `resend` (`src/lib/email.ts`).
   - Generación de código de 6 dígitos con expiración de 10 minutos (guardado en `verificationTokens`).
   - Creación de sesión revocable en `webSessions` al verificar el código.
3. **Flujo de Vinculación de Cuentas:** Endpoint `/api/auth/link-telegram` con validación criptográfica de dos factores.

### Fase 04: Motor Capacitor para Usuarios (`com.rabbitty.app`)
1. Instalar dependencias exactas y probadas con React 19 y Next 16:
   - `@capacitor/core@8.5.3`
   - `@capacitor/cli@8.5.3`
   - `@capacitor/android@8.5.3`
   - `@capacitor/ios@8.5.3`
   - `@capacitor/app@8.1.2`
   - `@capacitor/haptics@8.0.0`
   - `@capacitor/preferences@8.0.0`
2. Configurar `telegram-miniapp/capacitor.config.ts`:
   - `appId: 'com.rabbitty.app'` (Aislado de `com.rabbitty.pos`).
   - `appName: 'Rabbitty'`.
3. Generar assets nativos con `@capacitor/assets`.

### Fase 05: Pruebas de Sincronización y Seguridad
Ejecución de las 8 pruebas de aceptación obligatorias:
1. **Telegram:** Sesión, compras, reclamos y escaneo siguen operando sin regresión.
2. **Nativo:** Registro, login OTP, guardado seguro de sesión en `@capacitor/preferences`.
3. **Persistencia:** Al reiniciar la app nativa, la sesión se reanuda sin pedir login.
4. **Revocabilidad:** Al cerrar sesión o vencer `expiresAt`, la sesión es rechazada.
5. **Saldo Único:** Modificar saldo en backend refleja el mismo valor en Telegram y en la App Nativa.
6. **QR Canónico:** El código QR generado contiene el mismo `userId` unificado.
7. **Vinculación Segura:** Dos identidades no se fusionan sin validar la propiedad de ambas.
8. **Blindaje Financiero:** Ninguna pantalla nativa tiene acceso a mutar saldos directamente.

### Fase 06: Compilación y Distribución
1. Compilar el APK de prueba: `rabbitty-app.apk`.
2. Sincronizar el proyecto Xcode (`telegram-miniapp/ios/`).
3. Copiar `rabbitty-app.apk` a la raíz del repositorio.

---

## 🎯 Criterios de Aceptación (Checklist de Salida: 8 de 8 Completados)
- [x] **1. Telegram intacto:** Mini App operativa sin regresiones (`initData` criptográfico preservado).
- [x] **2. Acceso nativo real:** Login OTP verificado por correo electrónico con Resend (`/api/auth/otp/send` y `/api/auth/otp/verify`).
- [x] **3. Sesión segura:** Credenciales en `@capacitor/preferences`, validadas contra `webSessions` con expiración y revocabilidad (`/api/auth/logout`).
- [x] **4. Saldo canónico:** Una sola fuente de verdad en PostgreSQL/Ledger compartida entre todos los canales.
- [x] **5. QR consistente:** Identifica a la entidad canónica UUID en ambos canales.
- [x] **6. Aislamiento estricto:** Prohibida la auto-fusión de cuentas por strings no verificados; vinculación explícita criptográfica (`/api/auth/link-telegram`).
- [x] **7. Sin rutas paralelas:** Autoridad 100% en el backend. `users.id` con `gen_random_uuid()` server-side y `$defaultFn`.
- [x] **8. Binarios generados:** `rabbitty-app.apk` compilado con package ID `com.rabbitty.app` en la raíz del repositorio.
